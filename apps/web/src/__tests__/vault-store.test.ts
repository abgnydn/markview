// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadVault,
  saveVault,
  createDoc,
  updateDoc,
  deleteDoc,
  renameVault,
  seedManyDocs,
  type VaultState,
} from '@/components/vault/vault-store';

function makeState(): VaultState {
  return { name: 'Test Vault', docs: [] };
}

describe('vault-store · pure reducers', () => {
  it('createDoc appends a doc with cycled tint and bumped timestamps', () => {
    let s = makeState();
    s = createDoc(s);
    s = createDoc(s);
    s = createDoc(s);
    s = createDoc(s);
    expect(s.docs.length).toBe(4);
    const tints = s.docs.map((d) => d.tint);
    // Cycle: violet, cyan, amber, violet
    expect(tints).toEqual(['violet', 'cyan', 'amber', 'violet']);
    for (const d of s.docs) {
      expect(d.title).toBe('untitled.md');
      expect(d.id.length).toBeGreaterThan(4);
      expect(typeof d.createdAt).toBe('number');
      expect(d.updatedAt).toBe(d.createdAt);
    }
  });

  it('updateDoc patches title + content and bumps updatedAt', async () => {
    let s = createDoc(makeState());
    const id = s.docs[0].id;
    const t0 = s.docs[0].updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    s = updateDoc(s, id, { title: 'renamed.md', content: '# New' });
    expect(s.docs[0].title).toBe('renamed.md');
    expect(s.docs[0].content).toBe('# New');
    expect(s.docs[0].updatedAt).toBeGreaterThan(t0);
  });

  it('updateDoc no-ops on unknown id without mutating', () => {
    const s = createDoc(makeState());
    const snapshot = JSON.stringify(s);
    const next = updateDoc(s, 'nonexistent', { content: 'x' });
    expect(JSON.stringify(next)).toBe(snapshot);
  });

  it('deleteDoc removes only the targeted doc', () => {
    let s = makeState();
    s = createDoc(s);
    s = createDoc(s);
    s = createDoc(s);
    const targetId = s.docs[1].id;
    s = deleteDoc(s, targetId);
    expect(s.docs.length).toBe(2);
    expect(s.docs.find((d) => d.id === targetId)).toBeUndefined();
  });

  it('renameVault updates name without touching docs', () => {
    let s = createDoc(makeState());
    const docsBefore = s.docs;
    s = renameVault(s, 'New Name');
    expect(s.name).toBe('New Name');
    expect(s.docs).toBe(docsBefore);
  });

  it('seedManyDocs creates N docs with auto-generated wikilinks', () => {
    const s = seedManyDocs(makeState(), 10);
    expect(s.docs.length).toBe(10);
    // Each seed doc should contain at least one [[wikilink]].
    for (const d of s.docs) {
      expect(d.content).toMatch(/\[\[.+?\]\]/);
    }
    // Titles are unique.
    const titles = s.docs.map((d) => d.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('seedManyDocs preserves existing docs and numbers new ones contiguously', () => {
    let s = makeState();
    s = seedManyDocs(s, 3);
    const firstThree = s.docs.map((d) => d.title);
    s = seedManyDocs(s, 2);
    expect(s.docs.length).toBe(5);
    expect(s.docs.slice(0, 3).map((d) => d.title)).toEqual(firstThree);
    // New titles should be note-004.md, note-005.md
    const lastTwo = s.docs.slice(3).map((d) => d.title);
    expect(lastTwo).toEqual(['note-004.md', 'note-005.md']);
  });
});

describe('vault-store · loadVault / saveVault round-trip', () => {
  beforeEach(() => {
    // jsdom gives us localStorage; clear between tests for isolation.
    window.localStorage.clear();
  });

  it('seeds a fresh vault on first load when storage is empty', () => {
    const s = loadVault();
    expect(s.name).toBe('My Vault');
    expect(s.docs.length).toBeGreaterThan(0);
    // Seed docs should cross-link (contain [[wikilinks]]).
    const anyLinks = s.docs.some((d) => /\[\[.+?\]\]/.test(d.content));
    expect(anyLinks).toBe(true);
  });

  it('saveVault persists and loadVault reads back the same shape', () => {
    const toSave: VaultState = {
      name: 'Persisted',
      docs: [
        {
          id: 'x',
          title: 'x.md',
          content: '# X',
          tint: 'amber',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    };
    saveVault(toSave);
    const loaded = loadVault();
    expect(loaded.name).toBe('Persisted');
    expect(loaded.docs.length).toBe(1);
    expect(loaded.docs[0].id).toBe('x');
    expect(loaded.docs[0].tint).toBe('amber');
  });

  it('loadVault falls back to seed docs on corrupt JSON', () => {
    window.localStorage.setItem('markview.vault.v1', '{{not json');
    const s = loadVault();
    expect(s.docs.length).toBeGreaterThan(0);
  });
});
