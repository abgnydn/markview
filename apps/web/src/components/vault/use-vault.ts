'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { WebrtcProvider } from 'y-webrtc';
import { createProvider } from '@/lib/collab/y-provider';
import {
  loadVault,
  saveVault,
  createDoc as createDocLocal,
  updateDoc as updateDocLocal,
  deleteDoc as deleteDocLocal,
  renameVault as renameVaultLocal,
  seedManyDocs as seedManyDocsLocal,
  importDocs as importDocsLocal,
  type VaultState,
  type VaultDoc,
  type VaultTint,
} from './vault-store';
import { parseFiles } from './vault-ingest';

export interface IngestReport {
  ingested: number;
  skipped: number;
  firstId: string | null;
}

const TINT_CYCLE: VaultTint[] = ['violet', 'cyan', 'amber'];
const PEER_PALETTE = [
  '#67e8f9', '#a78bfa', '#fbbf24', '#f472b6',
  '#34d399', '#fb923c', '#60a5fa', '#f87171',
];

export interface PeerPresence {
  clientId: number;
  name: string;
  color: string;
  activeId: string | null;
  joinedAt: number;
}

export interface UseVaultResult {
  state: VaultState;
  mode: 'solo' | 'room';
  roomId: string | null;
  peers: PeerPresence[];
  ready: boolean;
  localName: string;
  localColor: string;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  create: () => void;
  update: (id: string, patch: Partial<Pick<VaultDoc, 'title' | 'content'>>) => void;
  remove: (id: string) => void;
  rename: (name: string) => void;
  seedMany: (count: number) => void;
  /** Parse files (.md/.txt/.docx/.pdf) locally and add them as vault notes. */
  ingestFiles: (files: File[] | FileList) => Promise<IngestReport>;
  /** Returns a URL others can open to join this vault. */
  getShareUrl: () => string;
}

function makeId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

function readYDoc(ydoc: Y.Doc): VaultState {
  const meta = ydoc.getMap('vault-meta');
  const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
  const docs: VaultDoc[] = docsArr.toArray().map((m) => ({
    id: (m.get('id') as string) ?? makeId(),
    title: (m.get('title') as string) ?? 'untitled.md',
    content: (m.get('content') as string) ?? '',
    tint: ((m.get('tint') as VaultTint) ?? 'cyan'),
    createdAt: (m.get('createdAt') as number) ?? Date.now(),
    updatedAt: (m.get('updatedAt') as number) ?? Date.now(),
  }));
  return {
    name: (meta.get('name') as string) ?? 'Shared Vault',
    docs,
  };
}

function seedYDocFromLocal(ydoc: Y.Doc, state: VaultState) {
  ydoc.transact(() => {
    const meta = ydoc.getMap('vault-meta');
    if (!meta.has('name')) meta.set('name', state.name);

    const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
    if (docsArr.length === 0) {
      for (const d of state.docs) {
        const m = new Y.Map();
        m.set('id', d.id);
        m.set('title', d.title);
        m.set('content', d.content);
        m.set('tint', d.tint);
        m.set('createdAt', d.createdAt);
        m.set('updatedAt', d.updatedAt);
        docsArr.push([m]);
      }
    }
  });
}

function colorForClientId(clientId: number): string {
  return PEER_PALETTE[Math.abs(clientId) % PEER_PALETTE.length];
}

function ephemeralName(): string {
  const animals = ['Otter', 'Heron', 'Fox', 'Lynx', 'Cedar', 'Moth', 'Kite', 'Sable'];
  const adj = ['Quiet', 'Bright', 'Deep', 'Warm', 'Wry', 'Lucid', 'Swift', 'Keen'];
  return `${adj[Math.floor(Math.random() * adj.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
}

export function useVault(roomId: string | null): UseVaultResult {
  const mode: 'solo' | 'room' = roomId ? 'room' : 'solo';

  const [state, setState] = useState<VaultState>({ name: 'My Vault', docs: [] });
  const [peers, setPeers] = useState<PeerPresence[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const localNameRef = useRef<string>('');
  const localColorRef = useRef<string>('');

  // --------------------------- Mount / mode switch ---------------------------
  useEffect(() => {
    let cancelled = false;

    if (mode === 'solo') {
      // Local-first storage.
      const s = loadVault();
      if (!cancelled) {
        setState(s);
        setReady(true);
      }
      return () => {
        cancelled = true;
      };
    }

    // Room mode: set up Yjs + WebRTC provider.
    const session = createProvider(roomId!);
    ydocRef.current = session.ydoc;
    providerRef.current = session.provider;

    // If this client has a local vault and the Y.Doc is still empty,
    // seed it — first peer in the room becomes the initial contributor.
    // (Yjs will merge any other contributions automatically.)
    const localVault = loadVault();
    seedYDocFromLocal(session.ydoc, localVault);

    const sync = () => {
      if (cancelled) return;
      setState(readYDoc(session.ydoc));
    };
    sync();
    session.ydoc.on('update', sync);

    // Awareness / presence
    const awareness = session.provider.awareness;
    localNameRef.current = ephemeralName();
    localColorRef.current = colorForClientId(awareness.clientID);
    awareness.setLocalState({
      user: { name: localNameRef.current, color: localColorRef.current },
      activeId: null,
      joinedAt: Date.now(),
    });

    const onAware = () => {
      if (cancelled) return;
      const out: PeerPresence[] = [];
      awareness.getStates().forEach((raw, clientId) => {
        if (clientId === awareness.clientID) return;
        const s = raw as {
          user?: { name?: string; color?: string };
          activeId?: string | null;
          joinedAt?: number;
        };
        out.push({
          clientId,
          name: s.user?.name ?? 'Anon',
          color: s.user?.color ?? colorForClientId(clientId),
          activeId: s.activeId ?? null,
          joinedAt: s.joinedAt ?? Date.now(),
        });
      });
      out.sort((a, b) => a.joinedAt - b.joinedAt);
      setPeers(out);
    };
    awareness.on('change', onAware);
    onAware();

    setReady(true);

    return () => {
      cancelled = true;
      session.ydoc.off('update', sync);
      awareness.off('change', onAware);
      session.destroy();
      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [mode, roomId]);

  // --------------------------- Persist solo state ---------------------------
  useEffect(() => {
    if (mode === 'solo' && ready) saveVault(state);
  }, [mode, ready, state]);

  // --------------------------- Broadcast active id -------------------------
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    const awareness = providerRef.current?.awareness;
    if (awareness) {
      const prev = awareness.getLocalState() ?? {};
      awareness.setLocalState({ ...prev, activeId: id });
    }
  }, []);

  // --------------------------- Mutations ------------------------------------
  const create = useCallback(() => {
    const ydoc = ydocRef.current;
    if (ydoc) {
      let newId = '';
      ydoc.transact(() => {
        const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
        const idx = docsArr.length;
        const id = makeId();
        const m = new Y.Map();
        m.set('id', id);
        m.set('title', 'untitled.md');
        m.set('content', `# untitled\n\n`);
        m.set('tint', TINT_CYCLE[idx % TINT_CYCLE.length]);
        m.set('createdAt', Date.now());
        m.set('updatedAt', Date.now());
        docsArr.push([m]);
        newId = id;
      });
      setActiveId(newId);
    } else {
      setState((s) => {
        const next = createDocLocal(s);
        const newest = next.docs[next.docs.length - 1];
        setActiveId(newest.id);
        return next;
      });
    }
  }, [setActiveId]);

  const update = useCallback(
    (id: string, patch: Partial<Pick<VaultDoc, 'title' | 'content'>>) => {
      const ydoc = ydocRef.current;
      if (ydoc) {
        ydoc.transact(() => {
          const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
          for (const m of docsArr.toArray()) {
            if (m.get('id') === id) {
              if (patch.title !== undefined) m.set('title', patch.title);
              if (patch.content !== undefined) m.set('content', patch.content);
              m.set('updatedAt', Date.now());
              break;
            }
          }
        });
      } else {
        setState((s) => updateDocLocal(s, id, patch));
      }
    },
    [],
  );

  const remove = useCallback(
    (id: string) => {
      const ydoc = ydocRef.current;
      if (ydoc) {
        ydoc.transact(() => {
          const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
          const arr = docsArr.toArray();
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].get('id') === id) {
              docsArr.delete(i, 1);
              break;
            }
          }
        });
      } else {
        setState((s) => deleteDocLocal(s, id));
      }
      setActiveId(null);
    },
    [setActiveId],
  );

  const seedMany = useCallback((count: number) => {
    const ydoc = ydocRef.current;
    if (ydoc) {
      ydoc.transact(() => {
        const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
        const base = docsArr.length;
        const now = Date.now();

        // Collect titles currently in the Y.Doc plus the new batch's titles
        // so we can inject wikilinks between random neighbors.
        const existingTitles: string[] = [];
        for (const m of docsArr.toArray()) {
          const t = m.get('title') as string | undefined;
          if (t) existingTitles.push(t.replace(/\.md$/i, ''));
        }
        const newTitles: string[] = [];
        for (let i = 0; i < count; i++) {
          newTitles.push(`note-${String(base + i + 1).padStart(3, '0')}`);
        }
        const allTitles = [...existingTitles, ...newTitles];

        for (let i = 0; i < count; i++) {
          const n = base + i + 1;
          const selfTitle = newTitles[i];
          const linkCount = 2 + Math.floor(Math.random() * 3); // 2..4
          const pool = allTitles.filter((t) => t !== selfTitle);
          const picks: string[] = [];
          for (let j = 0; j < linkCount && pool.length > 0; j++) {
            const idx = Math.floor(Math.random() * pool.length);
            picks.push(pool[idx]);
            pool.splice(idx, 1);
          }
          const linkLine = picks.map((p) => `[[${p}]]`).join(' · ');

          const m = new Y.Map();
          m.set('id', makeId());
          m.set('title', `${selfTitle}.md`);
          m.set(
            'content',
            `# Note ${n}\n\nSeed content for perf testing.\n\nRelated: ${linkLine}\n\n- Item A\n- Item B\n- Item C\n`,
          );
          m.set('tint', TINT_CYCLE[(base + i) % TINT_CYCLE.length]);
          m.set('createdAt', now + i);
          m.set('updatedAt', now + i);
          docsArr.push([m]);
        }
      });
    } else {
      setState((s) => seedManyDocsLocal(s, count));
    }
  }, []);

  const ingestFiles = useCallback(
    async (files: File[] | FileList): Promise<IngestReport> => {
      const { results, skipped } = await parseFiles(files);
      if (results.length === 0) {
        return { ingested: 0, skipped: skipped.length, firstId: null };
      }

      let firstId: string | null = null;
      const ydoc = ydocRef.current;
      if (ydoc) {
        ydoc.transact(() => {
          const docsArr = ydoc.getArray<Y.Map<unknown>>('vault-docs');
          const existingTitles = new Set<string>();
          for (const m of docsArr.toArray()) {
            const t = m.get('title') as string | undefined;
            if (t) existingTitles.add(t);
          }
          const now = Date.now();
          const base = docsArr.length;
          results.forEach((res, i) => {
            let title = res.title;
            if (existingTitles.has(title)) {
              const stem = title.replace(/\.md$/i, '');
              let n = 2;
              while (existingTitles.has(`${stem}-${n}.md`)) n++;
              title = `${stem}-${n}.md`;
            }
            existingTitles.add(title);

            const id = makeId();
            if (i === 0) firstId = id;
            const m = new Y.Map();
            m.set('id', id);
            m.set('title', title);
            m.set('content', res.content);
            m.set('tint', TINT_CYCLE[(base + i) % TINT_CYCLE.length]);
            m.set('createdAt', now + i);
            m.set('updatedAt', now + i);
            docsArr.push([m]);
          });
        });
      } else {
        setState((s) => {
          const { state: next, created } = importDocsLocal(s, results);
          if (created.length > 0) firstId = created[0].id;
          return next;
        });
      }
      return { ingested: results.length, skipped: skipped.length, firstId };
    },
    [],
  );

  const rename = useCallback((name: string) => {
    const ydoc = ydocRef.current;
    if (ydoc) {
      ydoc.transact(() => ydoc.getMap('vault-meta').set('name', name));
    } else {
      setState((s) => renameVaultLocal(s, name));
    }
  }, []);

  const getShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    if (mode === 'room' && roomId) return `${origin}/vault/room?id=${roomId}`;
    return `${origin}/vault`;
  }, [mode, roomId]);

  return {
    state,
    mode,
    roomId,
    peers,
    ready,
    localName: localNameRef.current,
    localColor: localColorRef.current,
    activeId,
    setActiveId,
    create,
    update,
    remove,
    rename,
    seedMany,
    ingestFiles,
    getShareUrl,
  };
}
