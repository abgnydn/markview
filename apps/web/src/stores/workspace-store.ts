
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
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void;
  /**
   * Move a file out of its current workspace into `targetWorkspaceId`.
   * Drops it at the end of the target's file list. If the moved file was
   * the active file in the source workspace, falls back to the next file
   * there. Returns `true` if the move succeeded.
   */
  moveFileToWorkspace: (fileId: string, targetWorkspaceId: string) => Promise<boolean>;
  /**
   * Promote a single file into its own brand-new workspace. The source
   * workspace loses the file; the new workspace gets it as its only file
   * and becomes active.
   */
  promoteFileToNewWorkspace: (fileId: string, newTitle?: string) => Promise<void>;
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

    // If this workspace has a saved atmosphere, switch the ambient layer
    // to match. Import lazily to avoid a circular dep at module load.
    try {
      const dbWs = await db.workspaces.get(workspaceId);
      if (dbWs?.atmosphere) {
        const { useThemeStore } = await import('@/stores/theme-store');
        useThemeStore.getState().setAtmosphere(dbWs.atmosphere);
      }
    } catch {
      /* ignore — atmosphere persistence is best-effort */
    }
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
  // Cross-fade the document swap via the View Transitions API. We load
  // the content first (IndexedDB read is usually <10ms) and only then
  // commit the state mutation, so the snapshot the browser captures has
  // the old document fully painted and the new one ready to fade in.
  // Falls back to a normal set() on browsers without the API.
  //
  // N16 — per-file scroll memory. Before swapping, snapshot the
  // outgoing file's scrollTop to localStorage; after the commit, fade
  // in at the incoming file's saved position (or 0).
  setActiveFile: async (fileId) => {
    const outgoingId = get().activeFileId;
    const main = typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('.viewer-main')
      : null;
    if (outgoingId && main && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(`mv-scroll-${outgoingId}`, String(main.scrollTop)); } catch { /* ignore */ }
    }
    const dbFile = await db.files.get(fileId);
    const commit = () => {
      set({
        activeFileId: fileId,
        activeFileContent: dbFile?.content || null,
        isContentLoading: false,
      });
    };
    const d = typeof document !== 'undefined' ? document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    } : null;
    if (d && typeof d.startViewTransition === 'function') {
      d.startViewTransition(commit);
    } else {
      commit();
    }
    // Restore scroll on next frames once new content has rendered.
    if (typeof window !== 'undefined') {
      let saved: number = 0;
      try { saved = parseInt(localStorage.getItem(`mv-scroll-${fileId}`) || '0', 10) || 0; } catch { /* ignore */ }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const m = document.querySelector<HTMLElement>('.viewer-main');
        if (m) m.scrollTop = saved;
      }));
    }
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
    // Drop embeddings + snapshots so we don't leave orphan rows.
    await db.embeddings.where('fileId').equals(fileId).delete();
    await db.snapshots.where('fileId').equals(fileId).delete();

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

    const reordered = [...files];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Renumber `order` to match the new positions and persist it — files are
    // loaded `.sortBy('order')`, so without this the reorder reverts on reload.
    const newFiles = reordered.map((f, i) => ({ ...f, order: i }));
    set({ files: newFiles });
    db.transaction('rw', db.files, async () => {
      for (let i = 0; i < newFiles.length; i++) {
        await db.files.update(newFiles[i].id, { order: i });
      }
    }).catch((err) => console.warn('[workspace] failed to persist file order', err));
  },

  // ---------- Move File To Another Workspace ----------
  moveFileToWorkspace: async (fileId, targetWorkspaceId) => {
    const { workspaces, activeWorkspaceId, files: currentFiles, activeFileId } = get();
    const dbFile = await db.files.get(fileId);
    if (!dbFile) return false;
    if (dbFile.workspaceId === targetWorkspaceId) return false;

    const sourceWsId = dbFile.workspaceId;
    const targetWs = workspaces.find((w) => w.id === targetWorkspaceId);
    if (!targetWs) return false;

    // Drop the file at the end of the target's file list.
    const targetFiles = await db.files.where('workspaceId').equals(targetWorkspaceId).toArray();
    const newOrder = targetFiles.length > 0 ? Math.max(...targetFiles.map((f) => f.order)) + 1 : 0;

    await db.files.update(fileId, {
      workspaceId: targetWorkspaceId,
      order: newOrder,
    });
    const now = new Date();
    await db.workspaces.update(sourceWsId, {
      updatedAt: now,
      fileCount: Math.max(0, (workspaces.find((w) => w.id === sourceWsId)?.fileCount ?? 1) - 1),
      totalSize: Math.max(0, (workspaces.find((w) => w.id === sourceWsId)?.totalSize ?? dbFile.size) - dbFile.size),
    });
    await db.workspaces.update(targetWorkspaceId, {
      updatedAt: now,
      fileCount: (targetWs.fileCount || 0) + 1,
      totalSize: (targetWs.totalSize || 0) + dbFile.size,
    });

    // Local state update — only the active workspace's `files` list lives
    // in store; others are loaded on demand by switchWorkspace.
    if (sourceWsId === activeWorkspaceId) {
      const remaining = currentFiles.filter((f) => f.id !== fileId);
      const wasActive = activeFileId === fileId;
      let nextActiveFile: string | null = activeFileId;
      let nextContent: string | null = get().activeFileContent;
      if (wasActive) {
        const nextFile = remaining[0] ?? null;
        nextActiveFile = nextFile?.id ?? null;
        if (nextFile) {
          nextContent = (await db.files.get(nextFile.id))?.content ?? null;
        } else {
          nextContent = null;
        }
      }
      set({
        files: remaining,
        activeFileId: nextActiveFile,
        activeFileContent: nextContent,
        workspaces: workspaces.map((w) =>
          w.id === sourceWsId
            ? { ...w, fileCount: Math.max(0, w.fileCount - 1), totalSize: Math.max(0, w.totalSize - dbFile.size), updatedAt: now }
            : w.id === targetWorkspaceId
              ? { ...w, fileCount: (w.fileCount || 0) + 1, totalSize: (w.totalSize || 0) + dbFile.size, updatedAt: now }
              : w
        ),
      });
    } else {
      set({
        workspaces: workspaces.map((w) =>
          w.id === sourceWsId
            ? { ...w, fileCount: Math.max(0, w.fileCount - 1), totalSize: Math.max(0, w.totalSize - dbFile.size), updatedAt: now }
            : w.id === targetWorkspaceId
              ? { ...w, fileCount: (w.fileCount || 0) + 1, totalSize: (w.totalSize || 0) + dbFile.size, updatedAt: now }
              : w
        ),
      });
    }

    return true;
  },

  // ---------- Promote File To New Workspace ----------
  promoteFileToNewWorkspace: async (fileId, newTitle) => {
    const dbFile = await db.files.get(fileId);
    if (!dbFile) return;

    const title = newTitle || deriveDisplayName(dbFile.filename) || 'new workspace';
    // Re-use createWorkspace + then removeFile from the original to avoid
    // duplicating ID-generation + storage logic.
    await get().createWorkspace(title, [{ filename: dbFile.filename, content: dbFile.content }]);
    // The original file remains in its workspace; remove it now that the
    // copy lives in the new one. We use the same fileId path: temporarily
    // switch back to the original workspace to use removeFile cleanly.
    const sourceWsId = dbFile.workspaceId;
    const newActiveWsId = get().activeWorkspaceId;
    if (sourceWsId !== newActiveWsId) {
      // Delete directly from DB without switching context — removeFile's
      // local-state updates only apply to the active workspace and we're
      // already on the new one. The source workspace's file count gets
      // recomputed lazily on next switchWorkspace.
      await db.files.delete(fileId);
      const sourceWs = get().workspaces.find((w) => w.id === sourceWsId);
      if (sourceWs) {
        await db.workspaces.update(sourceWsId, {
          updatedAt: new Date(),
          fileCount: Math.max(0, sourceWs.fileCount - 1),
          totalSize: Math.max(0, sourceWs.totalSize - dbFile.size),
        });
        set({
          workspaces: get().workspaces.map((w) =>
            w.id === sourceWsId
              ? { ...w, fileCount: Math.max(0, w.fileCount - 1), totalSize: Math.max(0, w.totalSize - dbFile.size), updatedAt: new Date() }
              : w
          ),
        });
      }
    }
  },

  // ---------- Reorder Workspaces ----------
  reorderWorkspaces: (fromIndex, toIndex) => {
    const { workspaces } = get();
    if (fromIndex < 0 || fromIndex >= workspaces.length) return;
    if (toIndex < 0 || toIndex >= workspaces.length) return;
    if (fromIndex === toIndex) return;

    const updated = [...workspaces];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    set({ workspaces: updated });

    // Persist order by updating timestamps so most-recently-ordered stays first
    const now = Date.now();
    db.transaction('rw', db.workspaces, async () => {
      for (let i = 0; i < updated.length; i++) {
        await db.workspaces.update(updated[i].id, {
          updatedAt: new Date(now - i),
        });
      }
    });
  },
}));
