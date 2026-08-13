
import { create } from 'zustand';
import {
  generateRoomId,
  generateRoomSecret,
  getRoomSecretFromUrl,
  getShareUrl,
} from '@/lib/collab/room-url';
import type { CollabSession, SyncedFile } from '@/lib/collab/y-provider';

// y-provider owns yjs + y-webrtc (~64 KB gz). It loads lazily inside the
// connect actions, so surfaces that merely subscribe to this store (the
// landing page, the viewer shell) never pay for the collab stack. `yp` is
// non-null whenever `_session` is — both are set together below.
// A value-position dynamic-import type: there is no static-import
// spelling that keeps the module lazy, so the rule is suppressed here.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type YProviderModule = typeof import('@/lib/collab/y-provider');
let yp: YProviderModule | null = null;
import {
  setLocalUser,
  setLocalActiveFile,
  getConnectedPeers,
  onAwarenessChange,
  type PeerInfo,
} from '@/lib/collab/awareness';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { db } from '@/lib/storage/db';
import { useWorkspaceStore } from '@/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollabState {
  // Session state
  isActive: boolean;
  isHost: boolean;
  isConnecting: boolean;
  roomId: string | null;
  shareUrl: string | null;

  // Peer data
  peers: PeerInfo[];
  localUserName: string;

  // Synced workspace (for guests)
  syncedTitle: string | null;
  syncedFiles: SyncedFile[];
  syncedActiveFileId: string | null;
  syncedActiveFileContent: string | null;

  // Internal
  _session: CollabSession | null;
  _unsubAwareness: (() => void) | null;
  _unsubFiles: (() => void) | null;

  // Actions
  shareWorkspace: (workspaceId: string) => Promise<string>;
  joinRoom: (roomId: string, userName: string) => Promise<void>;
  leaveSession: () => void;
  setSyncedActiveFile: (fileId: string) => void;
  /** Rename the local user. Updates store + broadcasts via awareness so
      every peer's UI re-labels this user (cursor tag, avatar tooltip). */
  setLocalUserName: (name: string) => void;

  // CRDT accessors — used by the editor to bind CodeMirror to a Y.Text
  // for real-time collaborative editing.
  getYText: (fileId: string) => Y.Text | null;
  getAwareness: () => Awareness | null;
}

export const useCollabStore = create<CollabState>((set, get) => ({
  isActive: false,
  isHost: false,
  isConnecting: false,
  roomId: null,
  shareUrl: null,
  peers: [],
  localUserName: (() => {
    try {
      return localStorage.getItem('markview:user-name') || 'Host';
    } catch {
      return 'Host';
    }
  })(),
  syncedTitle: null,
  syncedFiles: [],
  syncedActiveFileId: null,
  syncedActiveFileContent: null,
  _session: null,
  _unsubAwareness: null,
  _unsubFiles: null,

  // ---------- Host: Share Workspace ----------
  shareWorkspace: async (workspaceId: string) => {
    const y = (yp ??= await import('@/lib/collab/y-provider'));
    const { _session: existing, _unsubAwareness, _unsubFiles } = get();
    if (existing) {
      // Full teardown — destroy() alone leaves the old session's
      // pagehide/observeDeep handlers attached, and their late flush
      // can write a destroyed Y.Doc's (empty) text over real content.
      _unsubAwareness?.();
      _unsubFiles?.();
      existing.destroy();
    }

    const roomId = generateRoomId();
    // Per-room secret: encrypts all signaling (SDP/ICE) so neither the
    // signaling server nor a room-ID guesser can read or MITM the
    // handshake. It travels only in the share link's #fragment.
    const roomSecret = generateRoomSecret();
    const session = y.createProvider(roomId, roomSecret);

    // Load workspace files from IndexedDB
    const wsRecord = await db.workspaces.get(workspaceId);
    const dbFiles = await db.files
      .where('workspaceId')
      .equals(workspaceId)
      .sortBy('order');

    y.populateYDoc(
      session.ydoc,
      wsRecord?.title || 'Workspace',
      dbFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        displayName: f.displayName,
        content: f.content,
        order: f.order,
      }))
    );

    // Use the user's saved name (set via setLocalUserName) instead of
    // hardcoded "Host" so other peers see them by their real name.
    const hostName = get().localUserName || 'Host';
    setLocalUser(session.provider, hostName);

    // Broadcast the host's active file (now and on every switch) so
    // guests' "click to follow" has something to follow — guests already
    // do this via setSyncedActiveFile.
    const hostActiveId = useWorkspaceStore.getState().activeFileId;
    if (hostActiveId) setLocalActiveFile(session.provider, hostActiveId);
    const unsubHostActive = useWorkspaceStore.subscribe((state, prev) => {
      if (state.activeFileId && state.activeFileId !== prev.activeFileId) {
        setLocalActiveFile(session.provider, state.activeFileId);
      }
    });

    // Subscribe to awareness changes
    const unsubAwareness = onAwarenessChange(session.provider, (peers) => {
      set({ peers });
    });

    // Mirror the host's collaborative edits back to IndexedDB. The editor
    // binds CodeMirror directly to each file's Y.Text, but nothing else
    // persists those edits — so without this the host's own work is lost
    // when the session ends or the tab closes. Debounced per file, and
    // flushed eagerly on teardown / pagehide so nothing in flight is dropped.
    const contents = session.ydoc.getMap('contents');
    const dirty = new Set<string>();
    let flushTimer: number | null = null;
    const flushDirty = () => {
      if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
      for (const fileId of dirty) {
        const yText = contents.get(fileId) as Y.Text | undefined;
        if (yText) {
          const text = yText.toString();
          db.files.update(fileId, { content: text })
            .catch((err) => console.warn('[collab] failed to persist host edit', err));
          // Keep the host's reader view live too: the viewer/TOC render
          // from workspace-store's activeFileContent, which nothing else
          // updates during a session — without this the host keeps seeing
          // pre-session text while (and after) peers edit the open file.
          if (useWorkspaceStore.getState().activeFileId === fileId) {
            useWorkspaceStore.setState({ activeFileContent: text });
          }
        }
      }
      dirty.clear();
    };
    const contentHandler = (events: Array<Y.YEvent<Y.AbstractType<unknown>>>) => {
      for (const ev of events) {
        const fileId = ev.path[0];
        if (typeof fileId === 'string') dirty.add(fileId);
      }
      if (flushTimer === null) flushTimer = window.setTimeout(flushDirty, 800) as unknown as number;
    };
    contents.observeDeep(contentHandler);
    const onPageHide = () => flushDirty();
    window.addEventListener('pagehide', onPageHide);
    const unsubFiles = () => {
      window.removeEventListener('pagehide', onPageHide);
      contents.unobserveDeep(contentHandler);
      unsubHostActive();
      flushDirty();
    };

    const shareUrl = getShareUrl(roomId, roomSecret);

    set({
      isActive: true,
      isHost: true,
      isConnecting: false,
      roomId,
      shareUrl,
      localUserName: hostName,
      _session: session,
      _unsubAwareness: unsubAwareness,
      _unsubFiles: unsubFiles,
    });

    return shareUrl;
  },

  // ---------- Guest: Join Room ----------
  joinRoom: async (roomId: string, userName: string) => {
    const y = (yp ??= await import('@/lib/collab/y-provider'));
    const { _session: existing, _unsubAwareness, _unsubFiles } = get();
    if (existing) {
      _unsubAwareness?.();
      _unsubFiles?.();
      existing.destroy();
    }

    set({ isConnecting: true });

    // The room secret rides the link's #fragment (never sent to a server);
    // it decrypts the room's signaling. Old links without one still work.
    const session = y.createProvider(roomId, getRoomSecretFromUrl() ?? undefined);

    // Wait for initial sync (Y.js syncs very fast for small docs)
    await new Promise<void>((resolve) => {
      // Check if we already have data
      const files = y.readFilesFromYDoc(session.ydoc);
      if (files.length > 0) {
        resolve();
        return;
      }
      // Wait for the first update
      const handler = () => {
        const f = y.readFilesFromYDoc(session.ydoc);
        if (f.length > 0) {
          session.ydoc.off('update', handler);
          resolve();
        }
      };
      session.ydoc.on('update', handler);
      // Timeout after 10s
      setTimeout(() => {
        session.ydoc.off('update', handler);
        resolve();
      }, 10000);
    });

    // Nothing arrived: the host is offline, the room is stale, or P2P is
    // blocked between the two networks. FAIL here — "joining" into an
    // empty ghost workspace is a dead end that just looks broken.
    if (y.readFilesFromYDoc(session.ydoc).length === 0) {
      session.destroy();
      set({ isConnecting: false });
      throw new Error('room-empty');
    }

    setLocalUser(session.provider, userName);

    const title = y.readWorkspaceTitle(session.ydoc);
    const files = y.readFilesFromYDoc(session.ydoc);
    const firstFile = files.length > 0 ? files[0] : null;
    const firstContent = firstFile
      ? y.readFileContent(session.ydoc, firstFile.id)
      : null;

    // Subscribe to awareness. If every peer disappears after we saw at
    // least one, the host closed the tab or lost connection — say so,
    // otherwise the doc silently freezes and looks live but dead.
    let sawPeers = false;
    const unsubAwareness = onAwarenessChange(session.provider, (peers) => {
      if (peers.length > 0) {
        sawPeers = true;
      } else if (sawPeers && get().isActive && !get().isHost) {
        sawPeers = false; // announce once per drop
        window.dispatchEvent(new CustomEvent('markview:toast', {
          detail: { message: 'Host disconnected — the session ended. You are viewing the last-synced copy.' },
        }));
      }
      set({ peers });
    });

    // Subscribe to file list changes
    const fileList = session.ydoc.getArray('files');
    const fileHandler = () => {
      const updated = y.readFilesFromYDoc(session.ydoc);
      set({ syncedFiles: updated });
    };
    fileList.observe(fileHandler);

    // Subscribe to content changes
    const contents = session.ydoc.getMap('contents');
    const contentHandler = () => {
      const { syncedActiveFileId } = get();
      if (syncedActiveFileId) {
        const content = y.readFileContent(session.ydoc, syncedActiveFileId);
        set({ syncedActiveFileContent: content });
      }
    };
    contents.observeDeep(contentHandler);

    set({
      isActive: true,
      isHost: false,
      isConnecting: false,
      roomId,
      // Keep the #k secret in the guest's copyable URL — without it a
      // re-shared link joins a room nobody can decrypt.
      shareUrl: getShareUrl(roomId, getRoomSecretFromUrl() ?? undefined),
      localUserName: userName,
      syncedTitle: title,
      syncedFiles: files,
      syncedActiveFileId: firstFile?.id || null,
      syncedActiveFileContent: firstContent,
      peers: getConnectedPeers(session.provider),
      _session: session,
      _unsubAwareness: unsubAwareness,
      _unsubFiles: () => {
        fileList.unobserve(fileHandler);
        contents.unobserveDeep(contentHandler);
      },
    });
  },

  // ---------- Leave Session ----------
  leaveSession: () => {
    const { _session, _unsubAwareness, _unsubFiles } = get();
    if (_unsubAwareness) _unsubAwareness();
    if (_unsubFiles) _unsubFiles();
    if (_session) _session.destroy();

    set({
      isActive: false,
      isHost: false,
      isConnecting: false,
      roomId: null,
      shareUrl: null,
      peers: [],
      syncedTitle: null,
      syncedFiles: [],
      syncedActiveFileId: null,
      syncedActiveFileContent: null,
      _session: null,
      _unsubAwareness: null,
      _unsubFiles: null,
    });

    // Drop ?room= and #k from the URL — otherwise the join dialog
    // immediately re-opens for the room the user just left, and a
    // reload re-joins it.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room') || url.hash) {
        url.searchParams.delete('room');
        url.hash = '';
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      }
    }
  },

  // ---------- Guest: Switch File ----------
  setSyncedActiveFile: (fileId: string) => {
    const { _session } = get();
    if (!_session || !yp) return;

    const content = yp.readFileContent(_session.ydoc, fileId);
    set({
      syncedActiveFileId: fileId,
      syncedActiveFileContent: content,
    });

    setLocalActiveFile(_session.provider, fileId);
  },

  // ---------- CRDT accessors for the editor ----------
  getYText: (fileId: string) => {
    const { _session } = get();
    if (!_session) return null;
    const contents = _session.ydoc.getMap('contents');
    const yText = contents.get(fileId);
    return (yText as Y.Text | undefined) ?? null;
  },

  getAwareness: () => {
    const { _session } = get();
    return _session ? (_session.provider.awareness as Awareness) : null;
  },

  setLocalUserName: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set({ localUserName: trimmed });
    // Persist for next session — keyed locally, never sent anywhere.
    try {
      localStorage.setItem('markview:user-name', trimmed);
    } catch {
      /* ignore */
    }
    // If a session is live, broadcast the new name immediately so every
    // peer's UI re-labels the cursor + avatar tag.
    const { _session, syncedActiveFileId } = get();
    if (_session) {
      setLocalUser(_session.provider, trimmed, syncedActiveFileId);
    }
  },
}));
