'use client';

import { create } from 'zustand';

/**
 * Version history entry — stores a snapshot of file content at a point in time.
 */
export interface VersionEntry {
  id: string;
  fileId: string;
  filename: string;
  content: string;
  timestamp: number;
  /** What triggered this save: manual, auto-save, or editor save */
  source: 'manual' | 'auto' | 'editor';
}

/** Max versions per file */
const MAX_VERSIONS_PER_FILE = 50;

/** IndexedDB database name and store */
const DB_NAME = 'markview-versions';
const STORE_NAME = 'versions';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fileId', 'fileId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putVersion(entry: VersionEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getVersionsForFile(fileId: string): Promise<VersionEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const idx = tx.objectStore(STORE_NAME).index('fileId');
    const req = idx.getAll(fileId);
    req.onsuccess = () => {
      const results = (req.result as VersionEntry[]).sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteVersion(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function pruneOldVersions(fileId: string): Promise<void> {
  const versions = await getVersionsForFile(fileId);
  if (versions.length > MAX_VERSIONS_PER_FILE) {
    const toDelete = versions.slice(MAX_VERSIONS_PER_FILE);
    for (const v of toDelete) {
      await deleteVersion(v.id);
    }
  }
}

interface VersionStore {
  /** Current file's versions (cached from IndexedDB) */
  versions: VersionEntry[];
  isLoading: boolean;
  /** Selected version for preview/diff */
  selectedVersion: VersionEntry | null;

  /** Save a version snapshot */
  saveVersion: (fileId: string, filename: string, content: string, source: VersionEntry['source']) => Promise<void>;
  /** Load versions for a file from IndexedDB */
  loadVersions: (fileId: string) => Promise<void>;
  /** Select a version for preview */
  selectVersion: (version: VersionEntry | null) => void;
  /** Delete a specific version */
  deleteVersion: (id: string, fileId: string) => Promise<void>;
}

export const useVersionStore = create<VersionStore>()((set, get) => ({
  versions: [],
  isLoading: false,
  selectedVersion: null,

  saveVersion: async (fileId, filename, content, source) => {
    const entry: VersionEntry = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fileId,
      filename,
      content,
      timestamp: Date.now(),
      source,
    };
    try {
      await putVersion(entry);
      await pruneOldVersions(fileId);
      // Refresh if we're viewing this file
      const current = get().versions;
      if (current.length > 0 && current[0]?.fileId === fileId) {
        await get().loadVersions(fileId);
      }
    } catch (e) {
      console.warn('Failed to save version:', e);
    }
  },

  loadVersions: async (fileId) => {
    set({ isLoading: true });
    try {
      const versions = await getVersionsForFile(fileId);
      set({ versions, isLoading: false });
    } catch (e) {
      console.warn('Failed to load versions:', e);
      set({ versions: [], isLoading: false });
    }
  },

  selectVersion: (version) => set({ selectedVersion: version }),

  deleteVersion: async (id, fileId) => {
    try {
      await deleteVersion(id);
      await get().loadVersions(fileId);
    } catch (e) {
      console.warn('Failed to delete version:', e);
    }
  },
}));
