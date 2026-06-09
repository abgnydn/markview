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
  /** Optional per-workspace atmosphere — when set, switching to this
      workspace also switches the ambient layer to this painting. */
  atmosphere?: 'none' | 'fuji' | 'wave' | 'snow' | 'fields';
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

/**
 * Point-in-time snapshot of a file's content. Stored alongside files so
 * users can scrub back through "Save" + auto-snapshot history and restore
 * any version, including in collab sessions (the restore broadcasts to
 * peers through Yjs).
 */
export interface DBSnapshot {
  id: string;
  fileId: string;
  workspaceId: string;
  /** Frozen content at this moment. We store full text — small per row,
      easy to restore, no diff-walk required. Capped at 50 per file. */
  content: string;
  /** When the snapshot was taken (epoch ms — sortable index). */
  createdAt: number;
  /** What triggered it. UI uses this to label rows. */
  source: 'auto' | 'save' | 'manual' | 'collab-join';
  /** Optional human label (manual snapshots). */
  label?: string;
  /** Helpful for display — word count at snapshot time. */
  wordCount?: number;
}

/**
 * Per-paragraph embedding vector for semantic search + related-notes +
 * link suggestions. One row per (fileId, paragraphIndex). The embedding
 * is a 384-dim float32 array (MiniLM-L6-v2 output dimensionality) stored
 * as a single ArrayBuffer for fast cosine-similarity scoring later.
 *
 * Re-computed on every save; old rows for the file are dropped first so
 * paragraph re-indexing doesn't leave stale vectors.
 */
export interface DBEmbedding {
  id: string;                  // `${fileId}:${paragraphIndex}`
  fileId: string;
  workspaceId: string;
  paragraphIndex: number;
  /** First ~140 chars of the paragraph — keeps the search result preview
      cheap (no need to re-read the full file from IDB at query time). */
  preview: string;
  /** Raw float32 vector — Dexie serializes ArrayBuffer faithfully. */
  vector: ArrayBuffer;
}

/**
 * A pasted / dropped image, stored as a Blob and referenced from markdown as
 * `![alt](asset:<id>)`. The renderer resolves the id to a transient object
 * URL — keeps images local-first with no upload, and out of the document text
 * (which stays small and diffable).
 */
export interface DBAsset {
  id: string;
  workspaceId: string;
  blob: Blob;
  mime: string;
  createdAt: number;
}

class MarkViewDB extends Dexie {
  workspaces!: EntityTable<DBWorkspace, 'id'>;
  files!: EntityTable<DBFile, 'id'>;
  snapshots!: EntityTable<DBSnapshot, 'id'>;
  embeddings!: EntityTable<DBEmbedding, 'id'>;
  assets!: EntityTable<DBAsset, 'id'>;

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

    // v3 — snapshots table for version history
    this.version(3).stores({
      workspaces: 'id, updatedAt',
      files: 'id, workspaceId, [workspaceId+order]',
      snapshots: 'id, fileId, [fileId+createdAt], createdAt',
    });

    // v4 — embeddings table for semantic search + related-notes
    this.version(4).stores({
      workspaces: 'id, updatedAt',
      files: 'id, workspaceId, [workspaceId+order]',
      snapshots: 'id, fileId, [fileId+createdAt], createdAt',
      embeddings: 'id, fileId, workspaceId, [workspaceId+fileId]',
    });

    // v5 — assets table for pasted/dropped images
    this.version(5).stores({
      workspaces: 'id, updatedAt',
      files: 'id, workspaceId, [workspaceId+order]',
      snapshots: 'id, fileId, [fileId+createdAt], createdAt',
      embeddings: 'id, fileId, workspaceId, [workspaceId+fileId]',
      assets: 'id, workspaceId, createdAt',
    });
  }
}

export const db = new MarkViewDB();
