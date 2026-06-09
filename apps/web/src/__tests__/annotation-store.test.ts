// @vitest-environment jsdom
//
// The annotation store is the single source of truth backed by the
// re-anchoring per-file storage. These cover the persistence round-trip
// and the legacy colour back-fill — the DOM/selection UI needs a browser.

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore } from '@/stores/annotation-store';
import { loadAnnotations, type Annotation, type AnnotationColor } from '@/lib/annotations';

const mk = (id: string, color: AnnotationColor): Annotation => ({
  id, fileId: 'f1', anchorText: 'hello world', contextBefore: 'a', contextAfter: 'b',
  note: 'note', color, createdAt: 0,
});

beforeEach(() => {
  localStorage.clear();
  useAnnotationStore.getState().load('f1');
});

describe('annotation store', () => {
  it('persists an add to per-file storage and reloads with its colour', () => {
    useAnnotationStore.getState().add(mk('a1', 'green'));
    expect(loadAnnotations('f1')).toHaveLength(1);
    expect(loadAnnotations('f1')[0].color).toBe('green');
    // A fresh load reflects what was saved.
    useAnnotationStore.getState().load('f1');
    expect(useAnnotationStore.getState().annotations[0].color).toBe('green');
  });

  it('persists a remove', () => {
    useAnnotationStore.getState().add(mk('a1', 'blue'));
    useAnnotationStore.getState().remove('a1');
    expect(loadAnnotations('f1')).toHaveLength(0);
  });

  it('keeps notes scoped per file', () => {
    useAnnotationStore.getState().add(mk('a1', 'pink'));
    useAnnotationStore.getState().load('f2');
    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(loadAnnotations('f1')).toHaveLength(1);
  });

  it('back-fills a missing colour to yellow for older stored notes', () => {
    const legacy = [{ id: 'x', fileId: 'f1', anchorText: 't', contextBefore: '', contextAfter: '', note: '', createdAt: 0 }];
    localStorage.setItem('mv-annotations-f1', JSON.stringify(legacy));
    useAnnotationStore.getState().load('f1');
    expect(useAnnotationStore.getState().annotations[0].color).toBe('yellow');
  });
});
