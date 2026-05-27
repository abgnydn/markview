// SPDX-License-Identifier: Apache-2.0

/**
 * Snapshot helpers — versioned history for files (including collab-shared).
 * Storage lives in IDB (`db.snapshots`). Capped at 50 per file with a
 * rolling delete-oldest policy so disk usage stays bounded.
 */

import { db, type DBSnapshot } from '@/lib/storage/db';

const MAX_PER_FILE = 50;

function id(): string {
  return crypto.randomUUID();
}

function countWords(text: string): number {
  return text.replace(/[#*`>\-]/g, '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Create a new snapshot for `fileId`. Skips if the content is identical to
 * the most recent snapshot (no point versioning a no-op). Returns the
 * created row, or `null` if it was deduped.
 */
export async function createSnapshot(
  fileId: string,
  workspaceId: string,
  content: string,
  source: DBSnapshot['source'] = 'auto',
  label?: string,
): Promise<DBSnapshot | null> {
  const latest = await db.snapshots
    .where('[fileId+createdAt]')
    .between([fileId, 0], [fileId, Infinity])
    .last();
  if (latest && latest.content === content) {
    return null;
  }

  const row: DBSnapshot = {
    id: id(),
    fileId,
    workspaceId,
    content,
    createdAt: Date.now(),
    source,
    label,
    wordCount: countWords(content),
  };
  await db.snapshots.add(row);

  // Trim down to MAX_PER_FILE — drop the oldest first.
  const all = await db.snapshots
    .where('fileId').equals(fileId)
    .sortBy('createdAt');
  if (all.length > MAX_PER_FILE) {
    const excess = all.length - MAX_PER_FILE;
    const toRemove = all.slice(0, excess).map((s) => s.id);
    await db.snapshots.bulkDelete(toRemove);
  }

  return row;
}

/** Newest-first list of snapshots for one file. */
export async function listSnapshotsForFile(fileId: string): Promise<DBSnapshot[]> {
  const all = await db.snapshots
    .where('fileId').equals(fileId)
    .sortBy('createdAt');
  return all.reverse();
}

/** Look up a single snapshot by id. */
export async function getSnapshot(snapshotId: string): Promise<DBSnapshot | undefined> {
  return db.snapshots.get(snapshotId);
}

/** Delete one snapshot. */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await db.snapshots.delete(snapshotId);
}

/** Clear every snapshot belonging to a file (used when the file is removed). */
export async function deleteSnapshotsForFile(fileId: string): Promise<void> {
  const ids = (await db.snapshots.where('fileId').equals(fileId).primaryKeys());
  await db.snapshots.bulkDelete(ids as string[]);
}

/** Pretty short timestamp like "2 min ago" / "Yesterday 14:32". */
export function formatSnapshotTime(ts: number): string {
  const now = Date.now();
  const delta = Math.max(0, now - ts);
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return hhmm;
  if (yesterday) return `Yesterday ${hhmm}`;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${hhmm}`;
}
