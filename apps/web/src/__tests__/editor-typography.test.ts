import { describe, it, expect } from 'vitest';
import { typographicReplacement } from '@/components/viewer/editor-typography';

describe('smart typography rules', () => {
  it('opens a double quote at the start or after space/bracket', () => {
    expect(typographicReplacement('', '"')).toEqual({ insert: '“', back: 0 });
    expect(typographicReplacement('say ', '"')).toEqual({ insert: '“', back: 0 });
    expect(typographicReplacement('(', '"')).toEqual({ insert: '“', back: 0 });
  });

  it('closes a double quote after a word char', () => {
    expect(typographicReplacement('word', '"')).toEqual({ insert: '”', back: 0 });
  });

  it('curls single quotes / apostrophes', () => {
    expect(typographicReplacement('', "'")).toEqual({ insert: '‘', back: 0 });
    expect(typographicReplacement('don', "'")).toEqual({ insert: '’', back: 0 }); // don’t
  });

  it('makes an ellipsis on the third dot', () => {
    expect(typographicReplacement('..', '.')).toEqual({ insert: '…', back: 2 });
    expect(typographicReplacement('a.', '.')).toBeNull();
  });

  it('makes an em dash on the third hyphen and an arrow for ->', () => {
    expect(typographicReplacement('--', '-')).toEqual({ insert: '—', back: 2 });
    expect(typographicReplacement('-', '>')).toEqual({ insert: '→', back: 1 });
  });

  it('returns null for ordinary characters', () => {
    expect(typographicReplacement('hello', 'x')).toBeNull();
    expect(typographicReplacement('a', '-')).toBeNull();
  });
});
