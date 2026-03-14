import Dexie, { type EntityTable } from 'dexie';

export interface DBWorkspace {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: Date;
  updatedAt: Date;
  theme: 'dark' | 'light' | 'system';
  fileCount: number;
  totalSize: number;
}

export interface DBFile {
  id: string;
  workspaceId: string;
  filename: string;
  displayName: string;
  content: string;
  order: number;
  size: number;
}

class MarkViewDB extends Dexie {
  workspaces!: EntityTable<DBWorkspace, 'id'>;
  files!: EntityTable<DBFile, 'id'>;

  constructor() {
    super('markview');

    // v1 — original schema
    this.version(1).stores({
      workspaces: 'id, updatedAt',
      files: 'id, workspaceId, [workspaceId+order]',
    });

    // v2 — add fileCount, totalSize columns (backward compatible)
    this.version(2).stores({
      workspaces: 'id, updatedAt',
      files: 'id, workspaceId, [workspaceId+order]',
    }).upgrade(async (tx) => {
      // Backfill fileCount and totalSize for existing workspaces
      const workspaces = await tx.table('workspaces').toArray();
      for (const ws of workspaces) {
        const files = await tx.table('files').where('workspaceId').equals(ws.id).toArray();
        await tx.table('workspaces').update(ws.id, {
          fileCount: files.length,
          totalSize: files.reduce((sum: number, f: DBFile) => sum + (f.size || 0), 0),
        });
      }
    });
  }
}

export const db = new MarkViewDB();
