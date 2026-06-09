// SPDX-License-Identifier: Apache-2.0

/**
 * Local-first image assets. Pasted/dropped images are stored as Blobs in
 * IndexedDB and referenced from markdown as `![alt](asset:<id>)`. The
 * renderer resolves the id to a transient object URL (see resolveAssets in
 * dom-enhancers). No upload, no data-URIs bloating the document text.
 */

import { db } from '@/lib/storage/db';

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

/** True for an image File/Blob. */
export function isImageFile(file: { type: string }): boolean {
  return /^image\//.test(file.type);
}

/** Persist an image blob; returns its id for an `asset:<id>` reference. */
export async function storeAsset(blob: Blob, workspaceId: string): Promise<string> {
  const id = genId();
  await db.assets.add({
    id,
    workspaceId,
    blob,
    mime: blob.type || 'image/png',
    createdAt: Date.now(),
  });
  return id;
}

// Object URLs are cached for the session so repeated renders of the same
// asset reuse one URL (and we don't churn createObjectURL on every re-render).
const urlCache = new Map<string, string>();

/** Resolve an asset id to a transient object URL (cached), or null. */
export async function getAssetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const row = await db.assets.get(id);
  if (!row) return null;
  const url = URL.createObjectURL(row.blob);
  urlCache.set(id, url);
  return url;
}
