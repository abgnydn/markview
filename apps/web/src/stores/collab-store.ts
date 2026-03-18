'use client';

import { create } from 'zustand';
import {
  createProvider,
  generateRoomId,
  getShareUrl,
  populateYDoc,
  readFilesFromYDoc,
  readFileContent,
  readWorkspaceTitle,
  type CollabSession,
  type SyncedFile,
} from '@/lib/collab/y-provider';
import {
  setLocalUser,
  setLocalActiveFile,
  getConnectedPeers,
  onAwarenessChange,
  type PeerInfo,
} from '@/lib/collab/awareness';
import { db } from '@/lib/storage/db';

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
}

export const useCollabStore = create<CollabState>((set, get) => ({
  isActive: false,
  isHost: false,
  isConnecting: false,
  roomId: null,
  shareUrl: null,
  peers: [],
  localUserName: 'Host',
  syncedTitle: null,
  syncedFiles: [],
  syncedActiveFileId: null,
  syncedActiveFileContent: null,
  _session: null,
  _unsubAwareness: null,
  _unsubFiles: null,

  // ---------- Host: Share Workspace ----------
  shareWorkspace: async (workspaceId: string) => {
    const { _session: existing } = get();
    if (existing) existing.destroy();

    const roomId = generateRoomId();
    const session = createProvider(roomId);

    // Load workspace files from IndexedDB
    const wsRecord = await db.workspaces.get(workspaceId);
    const dbFiles = await db.files
      .where('workspaceId')
      .equals(workspaceId)
      .sortBy('order');

    populateYDoc(
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

    setLocalUser(session.provider, 'Host');

    // Subscribe to awareness changes
    const unsubAwareness = onAwarenessChange(session.provider, (peers) => {
      set({ peers });
    });

    const shareUrl = getShareUrl(roomId);

    set({
      isActive: true,
      isHost: true,
      isConnecting: false,
      roomId,
      shareUrl,
      localUserName: 'Host',
      _session: session,
      _unsubAwareness: unsubAwareness,
    });

    return shareUrl;
  },

  // ---------- Guest: Join Room ----------
  joinRoom: async (roomId: string, userName: string) => {
    const { _session: existing } = get();
    if (existing) existing.destroy();

    set({ isConnecting: true });

    const session = createProvider(roomId);

    // Wait for initial sync (Y.js syncs very fast for small docs)
    await new Promise<void>((resolve) => {
      // Check if we already have data
      const files = readFilesFromYDoc(session.ydoc);
      if (files.length > 0) {
        resolve();
        return;
      }
      // Wait for the first update
      const handler = () => {
        const f = readFilesFromYDoc(session.ydoc);
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

    setLocalUser(session.provider, userName);

    const title = readWorkspaceTitle(session.ydoc);
    const files = readFilesFromYDoc(session.ydoc);
    const firstFile = files.length > 0 ? files[0] : null;
    const firstContent = firstFile
      ? readFileContent(session.ydoc, firstFile.id)
      : null;

    // Subscribe to awareness
    const unsubAwareness = onAwarenessChange(session.provider, (peers) => {
      set({ peers });
    });

    // Subscribe to file list changes
    const fileList = session.ydoc.getArray('files');
    const fileHandler = () => {
      const updated = readFilesFromYDoc(session.ydoc);
      set({ syncedFiles: updated });
    };
    fileList.observe(fileHandler);

    // Subscribe to content changes
    const contents = session.ydoc.getMap('contents');
    const contentHandler = () => {
      const { syncedActiveFileId } = get();
      if (syncedActiveFileId) {
        const content = readFileContent(session.ydoc, syncedActiveFileId);
        set({ syncedActiveFileContent: content });
      }
    };
    contents.observeDeep(contentHandler);

    set({
      isActive: true,
      isHost: false,
      isConnecting: false,
      roomId,
      shareUrl: getShareUrl(roomId),
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
  },

  // ---------- Guest: Switch File ----------
  setSyncedActiveFile: (fileId: string) => {
    const { _session } = get();
    if (!_session) return;

    const content = readFileContent(_session.ydoc, fileId);
    set({
      syncedActiveFileId: fileId,
      syncedActiveFileContent: content,
    });

    setLocalActiveFile(_session.provider, fileId);
  },
}));
