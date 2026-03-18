'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Annotation {
  id: string;
  fileId: string;
  /** The highlighted text (substring match to locate) */
  text: string;
  /** The user's note/comment */
  note: string;
  /** Color label */
  color: 'yellow' | 'green' | 'blue' | 'pink';
  createdAt: number;
}

interface AnnotationStore {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt'>) => void;
  removeAnnotation: (id: string) => void;
  updateNote: (id: string, note: string) => void;
  setActiveAnnotation: (id: string | null) => void;
  getAnnotationsForFile: (fileId: string) => Annotation[];
  clearAnnotationsForFile: (fileId: string) => void;
}

export const useAnnotationStore = create<AnnotationStore>()(
  persist(
    (set, get) => ({
      annotations: [],
      activeAnnotationId: null,

      addAnnotation: (annotation) => {
        const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
          annotations: [...state.annotations, { ...annotation, id, createdAt: Date.now() }],
          activeAnnotationId: id,
        }));
      },

      removeAnnotation: (id) => {
        set((state) => ({
          annotations: state.annotations.filter((a) => a.id !== id),
          activeAnnotationId: state.activeAnnotationId === id ? null : state.activeAnnotationId,
        }));
      },

      updateNote: (id, note) => {
        set((state) => ({
          annotations: state.annotations.map((a) => (a.id === id ? { ...a, note } : a)),
        }));
      },

      setActiveAnnotation: (id) => set({ activeAnnotationId: id }),

      getAnnotationsForFile: (fileId) => {
        return get().annotations.filter((a) => a.fileId === fileId);
      },

      clearAnnotationsForFile: (fileId) => {
        set((state) => ({
          annotations: state.annotations.filter((a) => a.fileId !== fileId),
        }));
      },
    }),
    {
      name: 'markview-annotations',
    }
  )
);
