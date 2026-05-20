// @vitest-environment node
// workspace-store unit tests run against a stubbed Dexie surface. Real IDB
// behaviour is covered by the e2e suite — here we pin the pure-state contract.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the db module before importing the store. Each test sets up its own
// fixture data through the mocked surface.
vi.mock('@/lib/storage/db', () => {
  const workspaceMetas = new Map<string, any>();
  const files = new Map<string, any>();
  return {
    db: {
      transaction: vi.fn(async (_mode: string, ..._args: unknown[]) => {
        const cb = _args[_args.length - 1] as () => Promise<void>;
        if (typeof cb === 'function') await cb();
      }),
      workspaces: {
        toArray: vi.fn(async () => Array.from(workspaceMetas.values())),
        get: vi.fn(async (id: string) => workspaceMetas.get(id)),
        add: vi.fn(async (w: any) => {
          workspaceMetas.set(w.id, w);
          return w.id;
        }),
        update: vi.fn(async (id: string, patch: any) => {
          const w = workspaceMetas.get(id);
          if (w) workspaceMetas.set(id, { ...w, ...patch });
          return 1;
        }),
        delete: vi.fn(async (id: string) => workspaceMetas.delete(id)),
      },
      files: {
        toArray: vi.fn(async () => Array.from(files.values())),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(async () => Array.from(files.values())),
            sortBy: vi.fn(async (_k: string) =>
              Array.from(files.values()).sort((a, b) => a.order - b.order),
            ),
            delete: vi.fn(async () => 0),
          })),
        })),
        get: vi.fn(async (id: string) => files.get(id)),
        add: vi.fn(async (f: any) => {
          files.set(f.id, f);
          return f.id;
        }),
        update: vi.fn(async (id: string, patch: any) => {
          const f = files.get(id);
          if (f) files.set(id, { ...f, ...patch });
          return 1;
        }),
        delete: vi.fn(async (id: string) => files.delete(id)),
        bulkAdd: vi.fn(async (arr: any[]) => {
          for (const f of arr) files.set(f.id, f);
        }),
      },
    },
    _reset: () => {
      workspaceMetas.clear();
      files.clear();
    },
  };
});

// crypto.randomUUID is in Node 19+, the store calls it; mock just in case.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `uuid-${++counter}` },
  });
}

import { useWorkspaceStore } from '@/stores/workspace-store';

describe('workspace-store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspaceId: null,
      files: [],
      activeFileId: null,
      activeFileContent: null,
      isContentLoading: false,
      isLoaded: false,
    });
  });

  it('starts empty / unloaded', () => {
    const s = useWorkspaceStore.getState();
    expect(s.workspaces).toEqual([]);
    expect(s.activeWorkspaceId).toBeNull();
    expect(s.files).toEqual([]);
    expect(s.isLoaded).toBe(false);
  });

  it('createWorkspace adds metadata and activates it', async () => {
    await useWorkspaceStore.getState().createWorkspace('Test', [
      { filename: 'a.md', content: 'a' },
      { filename: 'b.md', content: 'b' },
    ]);
    const s = useWorkspaceStore.getState();
    expect(s.workspaces.length).toBe(1);
    expect(s.workspaces[0].title).toBe('Test');
    expect(s.workspaces[0].fileCount).toBe(2);
    expect(s.activeWorkspaceId).toBe(s.workspaces[0].id);
    expect(s.files.length).toBe(2);
  });

  it('reorderFiles swaps positions in place', async () => {
    await useWorkspaceStore.getState().createWorkspace('R', [
      { filename: '1.md', content: '1' },
      { filename: '2.md', content: '2' },
      { filename: '3.md', content: '3' },
    ]);
    useWorkspaceStore.getState().reorderFiles(0, 2);
    const ordered = useWorkspaceStore.getState().files.map((f) => f.filename);
    expect(ordered).toEqual(['2.md', '3.md', '1.md']);
  });

  it('reorderWorkspaces moves item between positions (splice semantics)', async () => {
    await useWorkspaceStore.getState().createWorkspace('A', [{ filename: 'a.md', content: '' }]);
    await useWorkspaceStore.getState().createWorkspace('B', [{ filename: 'b.md', content: '' }]);
    await useWorkspaceStore.getState().createWorkspace('C', [{ filename: 'c.md', content: '' }]);
    const before = useWorkspaceStore.getState().workspaces.map((w) => w.title);

    // Move first to last
    useWorkspaceStore.getState().reorderWorkspaces(0, 2);
    const after = useWorkspaceStore.getState().workspaces.map((w) => w.title);
    expect(after).not.toEqual(before);
    expect(after.length).toBe(3);
    expect(new Set(after)).toEqual(new Set(['A', 'B', 'C']));
  });

  it('reorderWorkspaces ignores out-of-bounds indices', async () => {
    await useWorkspaceStore.getState().createWorkspace('A', [{ filename: 'a.md', content: '' }]);
    await useWorkspaceStore.getState().createWorkspace('B', [{ filename: 'b.md', content: '' }]);
    const before = useWorkspaceStore.getState().workspaces.map((w) => w.id);
    useWorkspaceStore.getState().reorderWorkspaces(-1, 0);
    useWorkspaceStore.getState().reorderWorkspaces(0, 99);
    useWorkspaceStore.getState().reorderWorkspaces(0, 0); // no-op
    expect(useWorkspaceStore.getState().workspaces.map((w) => w.id)).toEqual(before);
  });
});
