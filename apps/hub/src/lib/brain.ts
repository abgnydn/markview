/**
 * Brain vault integration.
 *
 * - Reads the on-disk vault at $BRAIN_ROOT (default: ~/brain).
 * - Shells out to `claudectl --json` to inventory live Claude Code sessions.
 * - Tails ~/.claude/projects/<slug>/*.jsonl for real-time tool_use events.
 *
 * All filesystem/process work is kept server-side; callers run inside
 * Next.js route handlers with `export const runtime = 'nodejs'`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const BRAIN_ROOT = process.env.BRAIN_ROOT ?? path.join(os.homedir(), 'brain');
export const CLAUDECTL_BIN = process.env.CLAUDECTL_BIN ?? '/opt/homebrew/bin/claudectl';
export const FOCUS_SCRIPT =
  process.env.BRAIN_FOCUS_SCRIPT ??
  path.join(BRAIN_ROOT, 'scripts', 'focus-iterm.applescript');

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// ------- Types -------

export interface SessionFile {
  path: string;
  edits: number;
}

export interface SessionToolCall {
  tool: string;
  calls: number;
}

export interface SessionError {
  tool: string | null;
  message: string;
}

export interface FleetSession {
  pid: number;
  project: string | null;
  status: string | null;
  cost_usd: number | null;
  burn_rate_per_hr: number | null;
  context_pct: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  elapsed_secs: number | null;
  files_modified: SessionFile[];
  tool_usage: SessionToolCall[];
  recent_errors: SessionError[];
}

export interface FleetEvent {
  ts: number;
  slug: string;
  pids: number[];
  tool: string;
}

// ------- claudectl fleet -------

interface FleetCache {
  data: FleetSession[];
  fetchedAt: number;
}

const FLEET_TTL_MS = 5_000;
let _fleetCache: FleetCache | null = null;

function compactSession(raw: unknown): FleetSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.pid !== 'number') return null;
  const filesRecord = (s.files_modified ?? {}) as Record<string, number>;
  const files: SessionFile[] = Object.entries(filesRecord)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([p, n]) => ({ path: p, edits: n }));
  const toolsRecord = (s.tool_usage ?? {}) as Record<string, { calls?: number }>;
  const tools: SessionToolCall[] = Object.entries(toolsRecord)
    .map(([k, v]) => ({ tool: k, calls: v?.calls ?? 0 }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);
  const errs = Array.isArray(s.recent_errors) ? s.recent_errors : [];
  const recent: SessionError[] = errs.slice(0, 3).map((e) => {
    const obj = e as Record<string, unknown>;
    return {
      tool: typeof obj.tool === 'string' ? obj.tool : null,
      message: typeof obj.message === 'string' ? obj.message.slice(0, 240) : '',
    };
  });
  return {
    pid: s.pid,
    project: typeof s.project === 'string' ? s.project : null,
    status: typeof s.status === 'string' ? s.status : null,
    cost_usd: typeof s.cost_usd === 'number' ? s.cost_usd : null,
    burn_rate_per_hr: typeof s.burn_rate_per_hr === 'number' ? s.burn_rate_per_hr : null,
    context_pct: typeof s.context_pct === 'number' ? s.context_pct : null,
    tokens_in: typeof s.tokens_in === 'number' ? s.tokens_in : null,
    tokens_out: typeof s.tokens_out === 'number' ? s.tokens_out : null,
    elapsed_secs: typeof s.elapsed_secs === 'number' ? s.elapsed_secs : null,
    files_modified: files,
    tool_usage: tools,
    recent_errors: recent,
  };
}

export function getFleet(): { fleet: FleetSession[]; ageMs: number } {
  const now = Date.now();
  if (_fleetCache && now - _fleetCache.fetchedAt < FLEET_TTL_MS) {
    return { fleet: _fleetCache.data, ageMs: now - _fleetCache.fetchedAt };
  }
  let data: FleetSession[] = [];
  try {
    const r = spawnSync(CLAUDECTL_BIN, ['--json'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (r.status === 0 && r.stdout.trim()) {
      const parsed = JSON.parse(r.stdout);
      if (Array.isArray(parsed)) {
        data = parsed.map(compactSession).filter((s): s is FleetSession => s !== null);
      }
    }
  } catch {
    /* fall through with empty data */
  }
  _fleetCache = { data, fetchedAt: now };
  return { fleet: data, ageMs: 0 };
}

// ------- slug → PID mapping -------

let _slugToPid = new Map<string, number[]>();

export function refreshSlugToPid(sessions: FleetSession[]): void {
  const next = new Map<string, number[]>();
  for (const s of sessions) {
    try {
      const r = spawnSync('lsof', ['-p', String(s.pid), '-a', '-d', 'cwd', '-F', 'n'], {
        encoding: 'utf8',
        timeout: 2_000,
      });
      if (r.status !== 0) continue;
      for (const line of r.stdout.split('\n')) {
        if (line.startsWith('n')) {
          const cwd = line.slice(1);
          const slug = cwd.replace(/\//g, '-');
          const existing = next.get(slug) ?? [];
          existing.push(s.pid);
          next.set(slug, existing);
          break;
        }
      }
    } catch {
      /* ignore per-pid failure */
    }
  }
  _slugToPid = next;
}

export function pidsForSlug(slug: string): number[] {
  return _slugToPid.get(slug) ?? [];
}

// ------- JSONL tailer (shared event bus) -------

type EventListener = (ev: FleetEvent) => void;
const _listeners = new Set<EventListener>();
const _filePos = new Map<string, number>();
let _tailerStarted = false;

export function onFleetEvent(fn: EventListener): () => void {
  _listeners.add(fn);
  if (!_tailerStarted) startTailer();
  return () => _listeners.delete(fn);
}

function broadcast(ev: FleetEvent): void {
  for (const fn of _listeners) {
    try {
      fn(ev);
    } catch {
      /* ignore listener errors */
    }
  }
}

function startTailer(): void {
  _tailerStarted = true;
  const files = safeListJsonls();
  for (const f of files) {
    try {
      _filePos.set(f, fs.statSync(f).size);
    } catch {
      /* file gone */
    }
  }
  setInterval(tailOnce, 1_000);
}

function safeListJsonls(): string[] {
  try {
    const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);
    const out: string[] = [];
    for (const d of dirs) {
      const full = path.join(CLAUDE_PROJECTS_DIR, d);
      try {
        if (!fs.statSync(full).isDirectory()) continue;
      } catch {
        continue;
      }
      try {
        for (const entry of fs.readdirSync(full)) {
          if (entry.endsWith('.jsonl')) out.push(path.join(full, entry));
        }
      } catch {
        /* dir gone */
      }
    }
    return out;
  } catch {
    return [];
  }
}

function tailOnce(): void {
  for (const file of safeListJsonls()) {
    let size = 0;
    try {
      size = fs.statSync(file).size;
    } catch {
      continue;
    }
    const last = _filePos.get(file);
    if (last === undefined) {
      _filePos.set(file, size);
      continue;
    }
    if (size <= last) continue;
    let chunk = '';
    try {
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(size - last);
      fs.readSync(fd, buf, 0, size - last, last);
      fs.closeSync(fd);
      chunk = buf.toString('utf8');
    } catch {
      continue;
    }
    _filePos.set(file, size);
    const slug = path.basename(path.dirname(file));
    const pids = pidsForSlug(slug);
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!obj || typeof obj !== 'object') continue;
      const msg = (obj as { message?: { content?: unknown[] } }).message;
      const content = msg?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (!c || typeof c !== 'object') continue;
        const block = c as { type?: string; name?: string };
        if (block.type !== 'tool_use' || typeof block.name !== 'string') continue;
        const ts =
          typeof (obj as { timestamp?: unknown }).timestamp === 'number'
            ? (obj as { timestamp: number }).timestamp
            : Date.now();
        broadcast({ ts, slug, pids, tool: block.name });
      }
    }
  }
}

// ------- iTerm focus -------

export async function focusIterm(pid: number): Promise<{ ok: boolean; result: string }> {
  return new Promise((resolve) => {
    const proc = spawn('osascript', [FOCUS_SCRIPT, String(pid)], { timeout: 5_000 });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      const out = stdout.trim() || stderr.trim();
      resolve({
        ok: code === 0 && /focused/i.test(out),
        result: out,
      });
    });
    proc.on('error', (err) => resolve({ ok: false, result: err.message }));
  });
}

// ------- Vault doc reader (for /api/brain/graph later) -------

export interface VaultDoc {
  id: string;
  title: string;
  type: string | null;
  slot: string;
  tags: string[];
  sensitivity: string | null;
  permalink: string | null;
  body: string;
  mtimeMs: number;
  pid?: number;
  project?: string;
  status?: string;
  cost_usd?: number;
  context_pct?: number;
  files_modified?: Array<[string, number]>;
}

const SKIP_DIRS = new Set(['.brain', '.obsidian', '.venv', 'target', 'node_modules', '.git', '.cache']);

export function listVaultDocs(): VaultDoc[] {
  const out: VaultDoc[] = [];
  walk(BRAIN_ROOT, BRAIN_ROOT, out);
  return out;
}

function walk(root: string, dir: string, out: VaultDoc[]): void {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && !e.name.endsWith('.md')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(root, full, out);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      const doc = parseDoc(full, root);
      if (doc) out.push(doc);
    }
  }
}

function parseDoc(full: string, root: string): VaultDoc | null {
  let text = '';
  let mtimeMs = 0;
  try {
    text = fs.readFileSync(full, 'utf8');
    mtimeMs = fs.statSync(full).mtimeMs;
  } catch {
    return null;
  }
  const rel = path.relative(root, full).replace(/\.md$/, '');
  const slot = rel.split('/')[0] ?? '?';
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm: Record<string, string> = {};
  let body = text;
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
    body = text.slice(fmMatch[0].length);
  }
  const num = (s: string | undefined): number | undefined => {
    if (!s || s === 'null') return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  // For session docs, scrape the "## Files modified" block so the orbit can
  // draw session→file edges without a second parse pass.
  let filesModified: Array<[string, number]> | undefined;
  if (fm.type === 'claude-session') {
    filesModified = [];
    const filesBlock = body.match(/^## Files modified\n([\s\S]*?)(?=\n## |\n$|$)/m);
    if (filesBlock) {
      for (const line of filesBlock[1].split('\n')) {
        const m = line.match(/^- `([^`]+)` \((\d+) edit/);
        if (m) filesModified.push([m[1], Number(m[2])]);
      }
    }
  }
  return {
    id: rel,
    title: fm.title || path.basename(full, '.md'),
    type: fm.type ?? null,
    slot,
    tags: (fm.tags ?? '').replace(/[[\]]/g, '').split(',').map((t) => t.trim()).filter(Boolean),
    sensitivity: fm.sensitivity ?? null,
    permalink: fm.permalink ?? null,
    body,
    mtimeMs,
    pid: num(fm.pid),
    project: fm.project,
    status: fm.status,
    cost_usd: num(fm.cost_usd),
    context_pct: num(fm.context_pct),
    files_modified: filesModified,
  };
}
