'use client';

import { create } from 'zustand';
import { db, type DBWorkspace, type DBFile } from '@/lib/storage/db';

// ---------- Types ----------

/** Workspace metadata (no file content) */
export interface WorkspaceMeta {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: Date;
  updatedAt: Date;
  fileCount: number;
  totalSize: number;
}

/** File metadata (no content) */
export interface FileMeta {
  id: string;
  filename: string;
  displayName: string;
  order: number;
  size: number;
}

interface WorkspaceState {
  // All workspaces (metadata only)
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string | null;

  // Files for active workspace (metadata only)
  files: FileMeta[];
  activeFileId: string | null;

  // Content of the currently viewed file (loaded on demand)
  activeFileContent: string | null;
  isContentLoading: boolean;

  isLoaded: boolean;

  // Actions
  initialize: () => Promise<void>;
  createWorkspace: (title: string, inputFiles: { filename: string; content: string }[]) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, title: string) => Promise<void>;
  setActiveFile: (fileId: string) => Promise<void>;
  addFiles: (files: { filename: string; content: string }[]) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  reorderFiles: (fromIndex: number, toIndex: number) => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

function deriveDisplayName(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/^\d+\s*/, '')
    .trim() || filename;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  files: [],
  activeFileId: null,
  activeFileContent: null,
  isContentLoading: false,
  isLoaded: false,

  // ---------- Initialize ----------
  initialize: async () => {
    try {
      // Load all workspace metadata (no files)
      const dbWorkspaces = await db.workspaces.orderBy('updatedAt').reverse().toArray();
      const workspaces: WorkspaceMeta[] = dbWorkspaces.map((ws) => ({
        id: ws.id,
        title: ws.title,
        subtitle: ws.subtitle,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
        fileCount: ws.fileCount || 0,
        totalSize: ws.totalSize || 0,
      }));

      if (workspaces.length === 0) {
        set({ workspaces: [], isLoaded: true });
        return;
      }

      // Auto-select the most recent workspace
      const activeWs = workspaces[0];
      const dbFiles = await db.files
        .where('workspaceId')
        .equals(activeWs.id)
        .sortBy('order');

      const files: FileMeta[] = dbFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        displayName: f.displayName,
        order: f.order,
        size: f.size,
      }));

      // Load content of first file
      let activeFileContent: string | null = null;
      if (files.length > 0) {
        const firstFile = await db.files.get(files[0].id);
        activeFileContent = firstFile?.content || null;
      }

      set({
        workspaces,
        activeWorkspaceId: activeWs.id,
        files,
        activeFileId: files.length > 0 ? files[0].id : null,
        activeFileContent,
        isLoaded: true,
      });
    } catch (e) {
      console.error('Failed to initialize workspace store:', e);
      set({ isLoaded: true });
    }
  },

  // ---------- Create Workspace ----------
  createWorkspace: async (title, inputFiles) => {
    const id = generateId();
    const now = new Date();
    const sorted = [...inputFiles].sort((a, b) => a.filename.localeCompare(b.filename));

    const files: (FileMeta & { content: string })[] = sorted.map((f, i) => ({
      id: generateId(),
      filename: f.filename,
      displayName: deriveDisplayName(f.filename),
      content: f.content,
      order: i,
      size: new Blob([f.content]).size,
    }));

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    // Persist to IndexedDB
    const dbWorkspace: DBWorkspace = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      theme: 'system',
      fileCount: files.length,
      totalSize,
    };

    const dbFiles: DBFile[] = files.map((f) => ({
      id: f.id,
      workspaceId: id,
      filename: f.filename,
      displayName: f.displayName,
      content: f.content,
      order: f.order,
      size: f.size,
    }));

    await db.transaction('rw', db.workspaces, db.files, async () => {
      await db.workspaces.add(dbWorkspace);
      await db.files.bulkAdd(dbFiles);
    });

    // File metadata (no content in state)
    const fileMetas: FileMeta[] = files.map(({ content: _, ...meta }) => meta);

    // Load first file's content
    const firstContent = files.length > 0 ? files[0].content : null;

    const newWsMeta: WorkspaceMeta = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      fileCount: files.length,
      totalSize,
    };

    set((state) => ({
      workspaces: [newWsMeta, ...state.workspaces],
      activeWorkspaceId: id,
      files: fileMetas,
      activeFileId: fileMetas.length > 0 ? fileMetas[0].id : null,
      activeFileContent: firstContent,
    }));
  },

  // ---------- Switch Workspace ----------
  switchWorkspace: async (workspaceId) => {
    const { activeWorkspaceId } = get();
    if (workspaceId === activeWorkspaceId) return;

    set({ isContentLoading: true });

    const dbFiles = await db.files
      .where('workspaceId')
      .equals(workspaceId)
      .sortBy('order');

    const files: FileMeta[] = dbFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      displayName: f.displayName,
      order: f.order,
      size: f.size,
    }));

    let activeFileContent: string | null = null;
    if (files.length > 0) {
      const firstFile = await db.files.get(files[0].id);
      activeFileContent = firstFile?.content || null;
    }

    set({
      activeWorkspaceId: workspaceId,
      files,
      activeFileId: files.length > 0 ? files[0].id : null,
      activeFileContent,
      isContentLoading: false,
    });
  },

  // ---------- Delete Workspace ----------
  deleteWorkspace: async (workspaceId) => {
    await db.transaction('rw', db.workspaces, db.files, async () => {
      await db.files.where('workspaceId').equals(workspaceId).delete();
      await db.workspaces.delete(workspaceId);
    });

    const { workspaces, activeWorkspaceId } = get();
    const remaining = workspaces.filter((ws) => ws.id !== workspaceId);

    if (workspaceId === activeWorkspaceId) {
      if (remaining.length > 0) {
        // Switch to next workspace
        set({ workspaces: remaining });
        await get().switchWorkspace(remaining[0].id);
      } else {
        // No workspaces left — show upload screen
        set({
          workspaces: [],
          activeWorkspaceId: null,
          files: [],
          activeFileId: null,
          activeFileContent: null,
        });
      }
    } else {
      set({ workspaces: remaining });
    }
  },

  // ---------- Rename Workspace ----------
  renameWorkspace: async (workspaceId, title) => {
    await db.workspaces.update(workspaceId, { title, updatedAt: new Date() });

    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspaceId ? { ...ws, title, updatedAt: new Date() } : ws
      ),
    }));
  },

  // ---------- Set Active File (lazy load content) ----------
  setActiveFile: async (fileId) => {
    set({ activeFileId: fileId, isContentLoading: true });

    const dbFile = await db.files.get(fileId);
    set({
      activeFileContent: dbFile?.content || null,
      isContentLoading: false,
    });
  },

  // ---------- Add Files to Active Workspace ----------
  addFiles: async (inputFiles) => {
    const { activeWorkspaceId, files, workspaces } = get();
    if (!activeWorkspaceId) return;

    const existingMax = Math.max(...files.map((f) => f.order), -1);
    const newFiles: (FileMeta & { content: string })[] = inputFiles.map((f, i) => ({
      id: generateId(),
      filename: f.filename,
      displayName: deriveDisplayName(f.filename),
      content: f.content,
      order: existingMax + 1 + i,
      size: new Blob([f.content]).size,
    }));

    const dbFiles: DBFile[] = newFiles.map((f) => ({
      ...f,
      workspaceId: activeWorkspaceId,
    }));

    const addedSize = newFiles.reduce((sum, f) => sum + f.size, 0);

    await db.files.bulkAdd(dbFiles);
    await db.workspaces.update(activeWorkspaceId, {
      updatedAt: new Date(),
      fileCount: files.length + newFiles.length,
      totalSize: (workspaces.find((ws) => ws.id === activeWorkspaceId)?.totalSize || 0) + addedSize,
    });

    const newFileMetas: FileMeta[] = newFiles.map(({ content: _, ...meta }) => meta);

    set((state) => ({
      files: [...state.files, ...newFileMetas],
      workspaces: state.workspaces.map((ws) =>
        ws.id === activeWorkspaceId
          ? {
              ...ws,
              fileCount: ws.fileCount + newFiles.length,
              totalSize: ws.totalSize + addedSize,
              updatedAt: new Date(),
            }
          : ws
      ),
    }));
  },

  // ---------- Remove File ----------
  removeFile: async (fileId) => {
    const { activeWorkspaceId, files, activeFileId, workspaces } = get();
    if (!activeWorkspaceId) return;

    const removedFile = files.find((f) => f.id === fileId);
    await db.files.delete(fileId);

    const newFiles = files.filter((f) => f.id !== fileId);
    const removedSize = removedFile?.size || 0;

    await db.workspaces.update(activeWorkspaceId, {
      updatedAt: new Date(),
      fileCount: newFiles.length,
      totalSize: Math.max(0, (workspaces.find((ws) => ws.id === activeWorkspaceId)?.totalSize || 0) - removedSize),
    });

    // If removed file was active, switch to next
    if (activeFileId === fileId) {
      const nextFile = newFiles.length > 0 ? newFiles[0] : null;
      let nextContent: string | null = null;
      if (nextFile) {
        const dbFile = await db.files.get(nextFile.id);
        nextContent = dbFile?.content || null;
      }
      set({
        files: newFiles,
        activeFileId: nextFile?.id || null,
        activeFileContent: nextContent,
        workspaces: get().workspaces.map((ws) =>
          ws.id === activeWorkspaceId
            ? { ...ws, fileCount: newFiles.length, totalSize: ws.totalSize - removedSize, updatedAt: new Date() }
            : ws
        ),
      });
    } else {
      set({
        files: newFiles,
        workspaces: get().workspaces.map((ws) =>
          ws.id === activeWorkspaceId
            ? { ...ws, fileCount: newFiles.length, totalSize: ws.totalSize - removedSize, updatedAt: new Date() }
            : ws
        ),
      });
    }
  },

  // ---------- Reorder Files ----------
  reorderFiles: (fromIndex, toIndex) => {
    const { files } = get();
    if (fromIndex < 0 || fromIndex >= files.length) return;
    if (toIndex < 0 || toIndex >= files.length) return;
    if (fromIndex === toIndex) return;

    const newFiles = [...files];
    const [moved] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, moved);
    set({ files: newFiles });
  },
}));
