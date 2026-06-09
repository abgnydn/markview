
import { create } from 'zustand';
import {
  type Annotation,
  loadAnnotations,
  saveAnnotations,
  withDefaultColor,
} from '@/lib/annotations';

/**
 * Single source of truth for annotations, backed by the re-anchoring
 * storage in lib/annotations (text + context, so notes survive small
 * edits). The floating toolbar (writer), the margin layer (renderer),
 * and the side panel (list) all read/write through this store so a
 * highlight made in one shows up in the others immediately.
 *
 * Storage is per-file localStorage via lib/annotations — NOT zustand
 * persist — so this holds only the active file's notes at a time.
 */
interface AnnotationStore {
  fileId: string | null;
  annotations: Annotation[];
  activeAnnotationId: string | null;

  /** Load a file's annotations into the store (call on file switch). */
  load: (fileId: string) => void;
  /** Append a fully-built annotation (from annotationFromSelection). */
  add: (annotation: Annotation) => void;
  remove: (id: string) => void;
  updateNote: (id: string, note: string) => void;
  setActiveAnnotation: (id: string | null) => void;
}

export const useAnnotationStore = create<AnnotationStore>()((set, get) => ({
  fileId: null,
  annotations: [],
  activeAnnotationId: null,

  load: (fileId) => {
    set({ fileId, annotations: withDefaultColor(loadAnnotations(fileId)), activeAnnotationId: null });
  },

  add: (annotation) => {
    const next = [...get().annotations, annotation];
    set({ annotations: next, activeAnnotationId: annotation.id });
    const fid = get().fileId;
    if (fid) saveAnnotations(fid, next);
  },

  remove: (id) => {
    const next = get().annotations.filter((a) => a.id !== id);
    set((state) => ({
      annotations: next,
      activeAnnotationId: state.activeAnnotationId === id ? null : state.activeAnnotationId,
    }));
    const fid = get().fileId;
    if (fid) saveAnnotations(fid, next);
  },

  updateNote: (id, note) => {
    const next = get().annotations.map((a) => (a.id === id ? { ...a, note } : a));
    set({ annotations: next });
    const fid = get().fileId;
    if (fid) saveAnnotations(fid, next);
  },

  setActiveAnnotation: (id) => set({ activeAnnotationId: id }),
}));
