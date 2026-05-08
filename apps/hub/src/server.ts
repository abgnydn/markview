/**
 * Brain Hub — tiny Hono server.
 *
 * Serves two static pages (/hub, /brain) and four endpoints under /api/brain/*:
 *   GET  /api/brain/fleet           — current claudectl session list
 *   GET  /api/brain/graph           — {nodes, edges} of the vault
 *   GET  /api/brain/events          — SSE: live tool_use events from JSONLs
 *   POST /api/brain/focus/:pid      — focus the iTerm session hosting <pid>
 *
 * Start: `npm run dev` (or `npm start`). Port: $PORT or 3100.
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  focusIterm,
  getFleet,
  listVaultDocs,
  onFleetEvent,
  refreshSlugToPid,
  type FleetEvent,
  type VaultDoc,
} from './lib/brain.ts';
import { speakToFace } from './lib/temple-speak.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = Number.parseInt(process.env.PORT ?? '3100', 10);

const app = new Hono();

app.onError((err, c) => {
  console.error('[hub] error on', c.req.path, ':', err);
  return c.json({ error: String(err) }, 500);
});

// ---------- Static pages ----------

app.get('/', (c) => c.redirect('/hub'));

app.get('/hub', (c) => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'hub.html'), 'utf8');
  return c.html(html);
});

app.get('/brain', (c) => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'brain.html'), 'utf8');
  return c.html(html);
});

// Static assets under /public/*
app.use('/public/*', serveStatic({ root: './' }));

// ---------- API: fleet ----------

app.get('/api/brain/fleet', (c) => {
  const { fleet, ageMs } = getFleet();
  if (ageMs === 0) refreshSlugToPid(fleet);
  c.header('Cache-Control', 'no-store');
  return c.json({ fleet, age_s: Number((ageMs / 1000).toFixed(2)) });
});

// ---------- API: docs (vault-orbit compatible shape) ----------

interface VaultOrbitDoc {
  id: string;
  title: string;
  content: string;
  tint: 'cyan' | 'violet' | 'amber' | 'rose';
  createdAt: number;
  updatedAt: number;
  // Brain extras
  docType?: string;
  sensitivity?: string;
  slot?: string;
  pid?: number;
  project?: string;
  status?: string;
  cost_usd?: number;
  context_pct?: number;
  files_modified?: Array<[string, number]>;
}

function pickTint(d: VaultDoc): VaultOrbitDoc['tint'] {
  if (d.type === 'claude-session') return 'rose';
  if (d.slot === 'projects') return 'cyan';
  if (d.slot === 'resources' || d.type === 'concept') return 'violet';
  if (d.slot === 'experiments' || d.slot === 'meetings') return 'amber';
  return 'violet';
}

let _docsCache: { data: VaultOrbitDoc[]; fetchedAt: number } | null = null;
const DOCS_TTL_MS = 10_000;

app.get('/api/brain/docs', (c) => {
  const now = Date.now();
  if (!_docsCache || now - _docsCache.fetchedAt > DOCS_TTL_MS) {
    const docs = listVaultDocs();
    _docsCache = {
      data: docs.map<VaultOrbitDoc>((d) => ({
        id: d.id,
        title: d.title,
        content: d.body,
        tint: pickTint(d),
        createdAt: d.mtimeMs,
        updatedAt: d.mtimeMs,
        docType: d.type ?? undefined,
        sensitivity: d.sensitivity ?? undefined,
        slot: d.slot,
        pid: d.pid,
        project: d.project,
        status: d.status,
        cost_usd: d.cost_usd,
        context_pct: d.context_pct,
        files_modified: d.files_modified,
      })),
      fetchedAt: now,
    };
  }
  c.header('Cache-Control', 'no-store');
  c.header('Access-Control-Allow-Origin', '*');
  return c.json({ docs: _docsCache.data, age_s: (now - _docsCache.fetchedAt) / 1000 });
});

// ---------- API: graph ----------

interface GraphNode {
  id: string;
  label: string;
  type: string | null;
  slot: string;
  size: number;
  pid?: number;
  project?: string;
  status?: string;
  cost_usd?: number;
  context_pct?: number;
}

interface GraphEdge {
  src: string;
  dst: string;
  rel: string;
}

const WIKILINK = /\[\[([^[\]|]+?)(?:\|[^\[\]]*)?\]\]/g;
const RELATION = /^- (\w[\w_]*) \[\[([^[\]|]+?)(?:\|[^\[\]]*)?\]\]/gm;

let _graphCache: { data: { nodes: GraphNode[]; edges: GraphEdge[] }; ts: number } | null = null;
const GRAPH_TTL_MS = 30_000;

function resolveTarget(name: string, byBasename: Map<string, string>): string {
  return byBasename.get(name.toLowerCase().replace(/\s+/g, '-')) ?? `?/${name}`;
}

function buildGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const docs: VaultDoc[] = listVaultDocs();
  const nodeMap = new Map<string, GraphNode>();
  const byBasename = new Map<string, string>();
  for (const d of docs) {
    const basename = d.id.split('/').pop() ?? d.id;
    byBasename.set(basename.toLowerCase(), d.id);
    const node: GraphNode = {
      id: d.id,
      label: d.title,
      type: d.type,
      slot: d.slot,
      size: Math.max(1, Math.floor(d.body.length / 500)),
    };
    if (d.pid !== undefined) node.pid = d.pid;
    if (d.project) node.project = d.project;
    if (d.status) node.status = d.status;
    if (d.cost_usd !== undefined) node.cost_usd = d.cost_usd;
    if (d.context_pct !== undefined) node.context_pct = d.context_pct;
    nodeMap.set(d.id, node);
  }
  const edges: GraphEdge[] = [];
  for (const d of docs) {
    RELATION.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RELATION.exec(d.body)) !== null) {
      edges.push({ src: d.id, dst: resolveTarget(m[2], byBasename), rel: m[1] });
    }
    const seen = new Set<string>();
    WIKILINK.lastIndex = 0;
    while ((m = WIKILINK.exec(d.body)) !== null) {
      const dst = resolveTarget(m[1], byBasename);
      const key = `${d.id}|${dst}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ src: d.id, dst, rel: 'links_to' });
    }
    if (d.type === 'claude-session' && d.project) {
      edges.push({ src: d.id, dst: resolveTarget(d.project, byBasename), rel: 'works_on' });
    }
  }
  for (const e of edges) {
    if (!nodeMap.has(e.dst)) {
      nodeMap.set(e.dst, {
        id: e.dst,
        label: e.dst.replace(/^\?\//, ''),
        type: 'ghost',
        slot: '?',
        size: 1,
      });
    }
  }
  return { nodes: [...nodeMap.values()], edges };
}

app.get('/api/brain/graph', (c) => {
  const now = Date.now();
  if (!_graphCache || now - _graphCache.ts > GRAPH_TTL_MS) {
    _graphCache = { data: buildGraph(), ts: now };
  }
  c.header('Cache-Control', 'no-store');
  return c.json({ graph: _graphCache.data, age_s: (now - _graphCache.ts) / 1000 });
});

// ---------- API: SSE events ----------

app.get('/api/brain/events', (c) => {
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: 'hello', data: '{}' });
    const unsubscribe = onFleetEvent((ev: FleetEvent) => {
      stream.writeSSE({ data: JSON.stringify(ev) }).catch(() => {
        /* stream closed */
      });
    });
    const keepalive = setInterval(() => {
      stream.writeSSE({ event: 'ping', data: '{}' }).catch(() => {
        /* stream closed */
      });
    }, 15_000);
    c.req.raw.signal.addEventListener('abort', () => {
      unsubscribe();
      clearInterval(keepalive);
    });
    // Keep the stream alive until the client disconnects.
    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener('abort', () => resolve());
    });
    unsubscribe();
    clearInterval(keepalive);
  });
});

// ---------- API: iTerm focus ----------

app.post('/api/brain/focus/:pid', async (c) => {
  const pid = Number.parseInt(c.req.param('pid'), 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    return c.json({ ok: false, error: 'invalid pid' }, 400);
  }
  const result = await focusIterm(pid);
  return c.json({ pid, ...result });
});

// ---------- Temple speak bridge ----------

// CORS preflight + readiness probe used by the temple-experience HUD.
app.options('/api/temple/speak', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
  return c.body(null, 204);
});

app.post('/api/temple/speak', async (c) => {
  const body = await c.req.json().catch(() => null);
  const visitorId = (body?.visitorId ?? '').toString();
  const text = (body?.text ?? '').toString();
  if (!text.trim()) return c.json({ error: 'empty text' }, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (obj: unknown): void => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch {}
      };
      speakToFace({
        visitorId,
        text,
        onEvent: (ev) => {
          if (ev.type === 'end') {
            if (closed) return;
            closed = true;
            try { controller.close(); } catch {}
          } else {
            send(ev);
          }
        },
      }).catch((err) => {
        if (closed) return;
        send({ type: 'text', text: `(bridge error: ${err instanceof Error ? err.message : String(err)})` });
        closed = true;
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });
});

// ---------- Boot ----------

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' });
console.log(`brain-hub listening on http://127.0.0.1:${PORT}/`);
console.log(`  /hub   — kanban dashboard`);
console.log(`  /brain — 3D knowledge graph`);
console.log(`  /api/brain/{fleet,graph,events,focus/:pid}`);
console.log(`  /api/temple/speak — bridge to claude CLI for /temple route`);
