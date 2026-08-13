// @vitest-environment node
// Pins the snapshot retention policy: the 50-cap prunes oldest-first but
// must NEVER evict `manual` bookmarks (deliberate restore points), and
// identical-content saves dedupe. Both behaviors changed recently and had
// zero coverage.

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row {
  id: string; fileId: string; workspaceId: string; content: string;
  createdAt: number; source: string; label?: string; wordCount?: number;
}

const rows = new Map<string, Row>();

vi.mock('@/lib/storage/db', () => ({
  db: {
    snapshots: {
      where: (index: string) => {
        if (index === '[fileId+createdAt]') {
          return {
            between: ([fileId]: [string, number]) => ({
              last: async () => {
                const list = [...rows.values()]
                  .filter((r) => r.fileId === fileId)
                  .sort((a, b) => a.createdAt - b.createdAt);
                return list[list.length - 1];
              },
            }),
          };
        }
        // where('fileId').equals(id).sortBy('createdAt')
        return {
          equals: (fileId: string) => ({
            sortBy: async (_k: string) =>
              [...rows.values()].filter((r) => r.fileId === fileId).sort((a, b) => a.createdAt - b.createdAt),
            delete: async () => {
              for (const [k, v] of rows) if (v.fileId === fileId) rows.delete(k);
            },
            primaryKeys: async () =>
              [...rows.values()].filter((r) => r.fileId === fileId).map((r) => r.id),
          }),
        };
      },
      add: async (row: Row) => { rows.set(row.id, row); },
      bulkDelete: async (ids: string[]) => { for (const id of ids) rows.delete(id); },
      delete: async (id: string) => { rows.delete(id); },
      get: async (id: string) => rows.get(id),
    },
  },
}));

import { createSnapshot } from '@/lib/snapshots';

describe('snapshot prune policy', () => {
  beforeEach(() => rows.clear());

  it('caps auto snapshots at 50, dropping the oldest first', async () => {
    for (let i = 0; i < 55; i++) {
      await createSnapshot('f1', 'ws', `content ${i}`, 'auto');
    }
    const kept = [...rows.values()].sort((a, b) => a.createdAt - b.createdAt);
    expect(kept.length).toBe(50);
    // The five oldest are gone; the newest survives.
    expect(kept.some((r) => r.content === 'content 0')).toBe(false);
    expect(kept.some((r) => r.content === 'content 4')).toBe(false);
    expect(kept.some((r) => r.content === 'content 54')).toBe(true);
  });

  it('never prunes manual bookmarks, even under autosave pressure', async () => {
    await createSnapshot('f1', 'ws', 'KEEP ME', 'manual', 'my bookmark');
    for (let i = 0; i < 60; i++) {
      await createSnapshot('f1', 'ws', `auto ${i}`, 'auto');
    }
    const all = [...rows.values()];
    const manuals = all.filter((r) => r.source === 'manual');
    expect(manuals.length).toBe(1);
    expect(manuals[0].content).toBe('KEEP ME');
    // Cap applies to the prunable set only.
    expect(all.filter((r) => r.source !== 'manual').length).toBe(50);
  });

  it('dedupes identical consecutive content', async () => {
    const first = await createSnapshot('f1', 'ws', 'same', 'save');
    const dup = await createSnapshot('f1', 'ws', 'same', 'auto');
    expect(first).not.toBeNull();
    expect(dup).toBeNull();
    expect(rows.size).toBe(1);
  });
});
