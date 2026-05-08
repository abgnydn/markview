'use client';

export type VaultTint = 'cyan' | 'violet' | 'amber' | 'rose';

/** Brain Hub-specific fields. Optional — only populated when docs are sourced
 * from a filesystem vault (via apps/hub). Left undefined for localStorage docs. */
export interface VaultDocBrainExtras {
  /** Frontmatter `type` (claude-session, project, concept, experiment, meeting, agent, …). */
  docType?: string;
  /** Frontmatter `sensitivity` tier (public/internal/private/secret). */
  sensitivity?: string;
  /** Top-level vault slot (projects, experiments, cd, …). */
  slot?: string;
  /** Live Claude session fields (only set when docType === 'claude-session'). */
  pid?: number;
  project?: string;
  status?: string;
  cost_usd?: number;
  context_pct?: number;
  /** Files touched by this session (top N, each [path, edits]). */
  files_modified?: Array<[string, number]>;
}

export interface VaultDoc extends VaultDocBrainExtras {
  id: string;
  title: string;
  content: string;
  tint: VaultTint;
  createdAt: number;
  updatedAt: number;
}

export interface VaultState {
  name: string;
  docs: VaultDoc[];
}

const STORAGE_KEY = 'markview.vault.v1';

const TINT_CYCLE: VaultTint[] = ['violet', 'cyan', 'amber'];

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function seedDocs(): VaultDoc[] {
  const now = Date.now();
  return [
    {
      id: makeId(),
      title: 'welcome.md',
      tint: 'cyan',
      createdAt: now,
      updatedAt: now,
      content: `# Welcome to your vault

This is your **second brain**, rendered in 3D.

Each panel orbiting the core is a note. Click to open. Edit inline. Share the whole vault as a URL — gzip-packed into a hash, no server required.

See [[how-it-works]] for the tour, or [[ideas]] for what's next. The [[graph]] note explains the lines you see between panels.

> Nothing is uploaded. Everything lives in your browser, ready for the MCP to read when you ask an agent.

Press \`+ New\` above to add a note.`,
    },
    {
      id: makeId(),
      title: 'how-it-works.md',
      tint: 'violet',
      createdAt: now,
      updatedAt: now,
      content: `# How it works

1. Write notes locally — they persist in your browser.
2. Open a note by clicking its panel.
3. Toggle **Edit** to update; **Save** commits to local storage.
4. Click **Share** in the topbar to copy a URL that encodes the entire vault.
5. When the MCP runs, agents can search across these notes without any cloud round-trip.

The brain in the center is your context. The panels are your memory. The edges between panels are your [[graph]].

Go back to [[welcome]] or read [[ideas]].`,
    },
    {
      id: makeId(),
      title: 'graph.md',
      tint: 'cyan',
      createdAt: now,
      updatedAt: now,
      content: `# The relation graph

Any time you write \`[[wikilink]]\` or \`[text](other.md)\` inside a note, MarkView draws an edge between the two panels in 3D space.

- Hover a panel → its edges glow brighter
- All others dim out
- Works across every ring of the orbit

Your vault becomes a live knowledge graph you can fly through. Same idea as Obsidian's graph view — but the brain sits in the middle, and the lines travel through space.

Related: [[welcome]] · [[how-it-works]] · [[ideas]]`,
    },
    {
      id: makeId(),
      title: 'ideas.md',
      tint: 'amber',
      createdAt: now,
      updatedAt: now,
      content: `# Ideas

- Hand-gesture camera controls via MediaPipe Hands (pinch-select, two-hand zoom)
- Embedding-based vault search (nomic-embed local)
- Force-directed [[graph]] layout mode — panels rearrange by link density
- Public vault routes \`/vault/@user/slug\`
- \`markview pull\` CLI that syncs a vault with a local Obsidian directory

See also: [[welcome]] · [[how-it-works]]`,
    },
  ];
}

export function loadVault(): VaultState {
  if (typeof window === 'undefined') return { name: 'My Vault', docs: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded: VaultState = { name: 'My Vault', docs: seedDocs() };
      saveVault(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as VaultState;
    if (!parsed.name || !Array.isArray(parsed.docs)) {
      throw new Error('shape');
    }
    return parsed;
  } catch {
    const fallback: VaultState = { name: 'My Vault', docs: seedDocs() };
    saveVault(fallback);
    return fallback;
  }
}

export function saveVault(state: VaultState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or similar — swallow, avoid crash
  }
}

export function createDoc(state: VaultState, title = 'untitled.md'): VaultState {
  const idx = state.docs.length;
  const now = Date.now();
  const doc: VaultDoc = {
    id: makeId(),
    title,
    content: `# ${title.replace(/\.md$/, '')}\n\n`,
    tint: TINT_CYCLE[idx % TINT_CYCLE.length],
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, docs: [...state.docs, doc] };
}

function uniqueTitle(existing: string[], proposed: string): string {
  if (!existing.includes(proposed)) return proposed;
  const ext = proposed.endsWith('.md') ? '.md' : '';
  const stem = ext ? proposed.slice(0, -ext.length) : proposed;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

export interface ImportInput {
  title: string;
  content: string;
}

/** Append imported docs (e.g. from drag-and-drop .docx/.pdf ingest). Titles
 *  are de-duplicated against the existing vault and within the batch. */
export function importDocs(
  state: VaultState,
  inputs: ImportInput[],
): { state: VaultState; created: VaultDoc[] } {
  if (inputs.length === 0) return { state, created: [] };
  const now = Date.now();
  const taken = state.docs.map((d) => d.title);
  const created: VaultDoc[] = [];
  inputs.forEach((inp, i) => {
    const title = uniqueTitle(taken, inp.title);
    taken.push(title);
    created.push({
      id: makeId(),
      title,
      content: inp.content,
      tint: TINT_CYCLE[(state.docs.length + i) % TINT_CYCLE.length],
      createdAt: now + i,
      updatedAt: now + i,
    });
  });
  return { state: { ...state, docs: [...state.docs, ...created] }, created };
}

export function updateDoc(
  state: VaultState,
  id: string,
  patch: Partial<Pick<VaultDoc, 'title' | 'content'>>,
): VaultState {
  return {
    ...state,
    docs: state.docs.map((d) =>
      d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d,
    ),
  };
}

export function deleteDoc(state: VaultState, id: string): VaultState {
  return { ...state, docs: state.docs.filter((d) => d.id !== id) };
}

export function renameVault(state: VaultState, name: string): VaultState {
  return { ...state, name };
}

/** Dev/perf helper — bulk-seed N dummy docs, each linked to 2-4 random peers
 * so the graph actually has edges to render. */
export function seedManyDocs(state: VaultState, count: number): VaultState {
  const now = Date.now();
  const base = state.docs.length;
  const additions: VaultDoc[] = [];

  const existingTitles = state.docs.map((d) => d.title.replace(/\.md$/i, ''));
  const newTitles: string[] = [];
  for (let i = 0; i < count; i++) {
    newTitles.push(`note-${String(base + i + 1).padStart(3, '0')}`);
  }
  const allTitles = [...existingTitles, ...newTitles];

  for (let i = 0; i < count; i++) {
    const n = base + i + 1;
    const selfTitle = newTitles[i];
    const linkCount = 2 + Math.floor(Math.random() * 3); // 2..4
    const pool = allTitles.filter((t) => t !== selfTitle);
    const picks: string[] = [];
    for (let j = 0; j < linkCount && pool.length > 0; j++) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool[idx]);
      pool.splice(idx, 1);
    }
    const linkLine = picks.map((p) => `[[${p}]]`).join(' · ');
    additions.push({
      id: makeId(),
      title: `${selfTitle}.md`,
      tint: TINT_CYCLE[(base + i) % TINT_CYCLE.length],
      createdAt: now + i,
      updatedAt: now + i,
      content: `# Note ${n}\n\nSeed content for perf testing.\n\nRelated: ${linkLine}\n\n- Item A\n- Item B\n- Item C\n`,
    });
  }
  return { ...state, docs: [...state.docs, ...additions] };
}
