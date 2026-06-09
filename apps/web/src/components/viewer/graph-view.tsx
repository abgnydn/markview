// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search as SearchIcon, GitMerge, Tag as TagIcon, Sparkles } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { db } from '@/lib/storage/db';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';

interface GraphViewProps {
  onClose: () => void;
}

interface Node {
  id: string;
  label: string;
  filename: string;
  x: number; y: number;
  vx: number; vy: number;
  outDeg: number;        // outbound link count
  inDeg: number;         // incoming link count
  tags: string[];
  primaryTag: string | null;
  wordCount: number;
}

interface Edge {
  a: string; b: string;   // node ids (a → b)
}

/**
 * GraphView — force-directed map of the current workspace.
 *
 * Files are nodes; markdown links between files ([[other]] / [text](other.md))
 * are *directed* edges. Tags drive cluster color so the graph reads as
 * a thematic map, not just a wiring diagram. Click a node to focus its
 * neighborhood; type in the search field to highlight a substring across
 * filenames + labels + tags. Orphans (zero links) get a dashed ring so
 * you can spot stranded notes at a glance.
 *
 * Pure-JS Verlet simulation, Canvas-2D render, no external libs.
 */
export function GraphView({ onClose }: GraphViewProps) {
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  // Hover is read only by the per-frame draw loop, never in JSX, so keep it
  // in a ref. As state it changed on every mouse-move → re-rendered the
  // component AND (being a dep below) tore down + rebuilt the entire RAF
  // loop and all canvas listeners dozens of times a second.
  const hoverIdRef = useRef<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // B2 — Constellation mode: pause the force simulation, persist node
  // positions per workspace, render with brighter glow so nodes feel
  // like stars instead of wired graph atoms. Drag-to-arrange becomes
  // the only motion; layout becomes spatial memory you actually own.
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const constellationKey = activeWorkspaceId ? `mv-constellation-${activeWorkspaceId}` : '';
  const [constellation, setConstellation] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const tagPaletteRef = useRef<Map<string, string>>(new Map());
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const dragRef = useRef<{ id: string | null; lastX: number; lastY: number; mode: 'pan' | 'node' | null; startX: number; startY: number }>({ id: null, lastX: 0, lastY: 0, mode: null, startX: 0, startY: 0 });
  const rafRef = useRef<number | null>(null);

  const filenameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files) {
      m.set(f.filename.toLowerCase(), f.id);
      m.set(f.filename.replace(/\.md$/i, '').toLowerCase(), f.id);
      m.set(f.displayName.toLowerCase(), f.id);
    }
    return m;
  }, [files]);

  // ── Build nodes + edges + tag palette from full file contents ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const fullFiles = await Promise.all(files.map((f) => db.files.get(f.id)));
      if (cancelled) return;

      const nodes: Node[] = files.map((f, i) => {
        const dbFile = fullFiles[i];
        const text = dbFile?.content ?? '';
        const fm = parseFrontmatter(text);
        const fmTags = extractTags(fm.data);
        const bodyTags = extractBodyHashtags(fm.content);
        const tags = Array.from(new Set([...fmTags, ...bodyTags]));
        const angle = Math.random() * Math.PI * 2;
        const r = 80 + Math.random() * 220;
        return {
          id: f.id,
          label: f.displayName || f.filename.replace(/\.md$/i, ''),
          filename: f.filename,
          x: W / 2 + Math.cos(angle) * r,
          y: H / 2 + Math.sin(angle) * r,
          vx: 0, vy: 0,
          outDeg: 0, inDeg: 0,
          tags,
          primaryTag: tags[0] || null,
          wordCount: text.split(/\s+/).filter(Boolean).length,
        };
      });

      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const edges: Edge[] = [];
      const wikiRe = /\[\[([^\]\n]+?)\]\]/g;
      const mdRe = /\[[^\]]*\]\(([^)\s#]+)\)/g;
      for (let i = 0; i < files.length; i++) {
        const dbFile = fullFiles[i];
        if (!dbFile) continue;
        const seen = new Set<string>();
        const text = dbFile.content;
        const pushEdge = (target: string | null) => {
          if (!target || target === files[i].id || seen.has(target)) return;
          seen.add(target);
          edges.push({ a: files[i].id, b: target });
          const na = nodeById.get(files[i].id);
          const nb = nodeById.get(target);
          if (na) na.outDeg++;
          if (nb) nb.inDeg++;
        };
        let m: RegExpExecArray | null;
        while ((m = wikiRe.exec(text)) !== null) {
          pushEdge(resolveTarget(m[1], filenameToId));
        }
        while ((m = mdRe.exec(text)) !== null) {
          const href = m[1];
          if (/^https?:\/\//.test(href) || href.startsWith('#') || href.startsWith('mailto:')) continue;
          pushEdge(resolveTarget(href, filenameToId));
        }
      }

      // Tag palette — assign a stable color per tag in encounter order.
      const palette = new Map<string, string>();
      const tagSet = new Set<string>();
      for (const n of nodes) if (n.primaryTag) tagSet.add(n.primaryTag);
      let idx = 0;
      for (const t of Array.from(tagSet).sort()) {
        palette.set(t, TAG_PALETTE[idx % TAG_PALETTE.length]);
        idx++;
      }

      nodesRef.current = nodes;
      edgesRef.current = edges;
      tagPaletteRef.current = palette;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Compute focus neighborhood whenever focusId changes.
  const focusNeighborhood = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const e of edgesRef.current) {
      if (e.a === focusId) set.add(e.b);
      if (e.b === focusId) set.add(e.a);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, edgesRef.current.length]);

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const n of nodesRef.current) {
      if (n.label.toLowerCase().includes(q)
          || n.filename.toLowerCase().includes(q)
          || n.tags.some((t) => t.toLowerCase().includes(q))) {
        set.add(n.id);
      }
    }
    return set;
  }, [query]);

  // ── Canvas setup + animation + interaction ───────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const screenToWorld = (sx: number, sy: number) => {
      const v = viewRef.current;
      return { x: (sx - v.panX) / v.zoom, y: (sy - v.panY) / v.zoom };
    };
    const nodeAt = (sx: number, sy: number): Node | null => {
      const { x, y } = screenToWorld(sx, sy);
      const ns = nodesRef.current;
      for (let i = ns.length - 1; i >= 0; i--) {
        const n = ns[i];
        const dx = x - n.x, dy = y - n.y;
        const r = nodeRadius(n);
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    };

    const onMouseMove = (e: MouseEvent) => {
      const n = nodeAt(e.clientX, e.clientY);
      hoverIdRef.current = n?.id ?? null;
      const d = dragRef.current;
      if (d.mode === 'pan') {
        const v = viewRef.current;
        v.panX += e.clientX - d.lastX;
        v.panY += e.clientY - d.lastY;
        d.lastX = e.clientX; d.lastY = e.clientY;
      } else if (d.mode === 'node' && d.id) {
        const target = nodesRef.current.find((nn) => nn.id === d.id);
        if (target) {
          const { x, y } = screenToWorld(e.clientX, e.clientY);
          target.x = x; target.y = y;
          target.vx = 0; target.vy = 0;
        }
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const n = nodeAt(e.clientX, e.clientY);
      if (n) {
        dragRef.current = { id: n.id, lastX: e.clientX, lastY: e.clientY, mode: 'node', startX: e.clientX, startY: e.clientY };
      } else {
        dragRef.current = { id: null, lastX: e.clientX, lastY: e.clientY, mode: 'pan', startX: e.clientX, startY: e.clientY };
        // Clicking empty space clears focus.
        if (focusId) setFocusId(null);
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      const d = dragRef.current;
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      const wasShortClick = dist < 6;
      dragRef.current = { id: null, lastX: 0, lastY: 0, mode: null, startX: 0, startY: 0 };
      if (wasShortClick && d.mode === 'node' && d.id) {
        // Click → focus its neighborhood. Double-click via prior focus → open.
        if (focusId === d.id) {
          void setActiveFile(d.id);
          onClose();
        } else {
          setFocusId(d.id);
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(3, Math.max(0.3, v.zoom * factor));
      const worldX = (e.clientX - v.panX) / v.zoom;
      const worldY = (e.clientY - v.panY) / v.zoom;
      v.zoom = newZoom;
      v.panX = e.clientX - worldX * v.zoom;
      v.panY = e.clientY - worldY * v.zoom;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const tick = () => {
      // In constellation mode the simulation is frozen — only manual
      // drags move nodes. Skip the simulate() call entirely; the
      // existing onMouseMove handler still updates the dragged node.
      if (!constellation) {
        simulate(nodesRef.current, edgesRef.current, dragRef.current.mode === 'node' ? dragRef.current.id : null);
      }
      draw(ctx, nodesRef.current, edgesRef.current, viewRef.current, hoverIdRef.current, activeFileId, focusNeighborhood, searchMatches, tagPaletteRef.current, constellation);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId, focusId, focusNeighborhood, searchMatches, constellation]);

  // Constellation persistence — when nodes are arranged manually, save
  // their (x,y) per-workspace so the layout survives reload + return
  // visits. Restore on toggle ON; save on toggle OFF and every 2s
  // while in constellation mode to catch in-progress drags.
  useEffect(() => {
    if (!constellationKey) return;
    if (constellation) {
      try {
        const raw = localStorage.getItem(constellationKey);
        if (raw) {
          const saved = JSON.parse(raw) as Record<string, { x: number; y: number }>;
          for (const n of nodesRef.current) {
            const p = saved[n.id];
            if (p) { n.x = p.x; n.y = p.y; n.vx = 0; n.vy = 0; }
          }
        }
      } catch { /* corrupt entry — ignore */ }
      const saveTimer = window.setInterval(() => {
        const out: Record<string, { x: number; y: number }> = {};
        for (const n of nodesRef.current) out[n.id] = { x: n.x, y: n.y };
        try { localStorage.setItem(constellationKey, JSON.stringify(out)); } catch { /* quota */ }
      }, 2_000);
      return () => window.clearInterval(saveTimer);
    }
  }, [constellation, constellationKey]);

  const orphanCount = nodesRef.current.filter((n) => n.outDeg + n.inDeg === 0).length;
  const tags = Array.from(tagPaletteRef.current.entries());

  return (
    <div className="graph-view-overlay">
      <canvas ref={canvasRef} className="graph-view-canvas" />
      <div className="graph-view-header">
        <span className="graph-view-title">Graph view</span>
        <div className="graph-view-search">
          <SearchIcon size={12} className="graph-view-search-icon" />
          <input
            type="text"
            className="graph-view-search-input"
            placeholder="Filter by name or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="graph-view-search-clear" onClick={() => setQuery('')}>
              <X size={11} />
            </button>
          )}
        </div>
        <span className="graph-view-stats">
          <GitMerge size={11} /> {nodesRef.current.length} · {edgesRef.current.length}
          {orphanCount > 0 && <> · {orphanCount} orphan{orphanCount === 1 ? '' : 's'}</>}
        </span>
        <button
          className={`graph-view-mode-btn${constellation ? ' is-active' : ''}`}
          onClick={() => setConstellation((v) => !v)}
          title={constellation
            ? 'Switch to force-graph mode'
            : 'Switch to constellation mode (drag-arranged, saved per workspace)'}
        >
          <Sparkles size={12} /> {constellation ? 'Force' : 'Constellation'}
        </button>
        <button className="graph-view-close" onClick={onClose} title="Close (Esc)">
          <X size={16} />
        </button>
      </div>

      {tags.length > 0 && (
        <div className="graph-view-legend">
          <div className="graph-view-legend-title"><TagIcon size={10} /> Tags</div>
          {tags.map(([tag, color]) => (
            <button
              key={tag}
              className={`graph-view-legend-tag${query === tag ? ' is-active' : ''}`}
              onClick={() => setQuery(query === tag ? '' : tag)}
              title={`Filter by #${tag}`}
            >
              <span className="graph-view-legend-swatch" style={{ background: color }} />
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="graph-view-hint">
        scroll to zoom · drag to pan · click to focus · double-click to open · <kbd>\</kbd> or <kbd>Esc</kbd>
      </div>
    </div>
  );
}

// ── Force simulation (Verlet) ───────────────────────────────────────────

function simulate(nodes: Node[], edges: Edge[], pinnedId: string | null) {
  if (nodes.length === 0) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  const cy = H / 2;

  for (const n of nodes) { n.vx *= 0.82; n.vy *= 0.82; }

  const K_REPEL = 4200;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy + 0.01;
      const force = K_REPEL / d2;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
  }

  const REST = 130;
  const K_SPRING = 0.026;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = byId.get(e.a); const b = byId.get(e.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const stretch = d - REST;
    const fx = (dx / d) * stretch * K_SPRING;
    const fy = (dy / d) * stretch * K_SPRING;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }

  // Tag attraction — files sharing primaryTag pulled gently together.
  const K_TAG = 0.004;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (!a.primaryTag || a.primaryTag !== b.primaryTag) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const fx = (dx / d) * d * K_TAG;
      const fy = (dy / d) * d * K_TAG;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
  }

  const K_CENTER = 0.0015;
  for (const n of nodes) {
    n.vx += (cx - n.x) * K_CENTER;
    n.vy += (cy - n.y) * K_CENTER;
  }

  for (const n of nodes) {
    if (n.id === pinnedId) { n.vx = 0; n.vy = 0; continue; }
    n.x += n.vx;
    n.y += n.vy;
  }
}

// ── Drawing ─────────────────────────────────────────────────────────────

function nodeRadius(n: Node): number {
  const degree = n.outDeg + n.inDeg;
  // Combine link degree + size so big AND well-connected files read.
  const sizeFactor = Math.min(4, Math.log10(Math.max(50, n.wordCount)) - 1);
  return 5 + Math.min(12, Math.sqrt(degree) * 3.5) + sizeFactor;
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: Node[],
  edges: Edge[],
  view: { zoom: number; panX: number; panY: number },
  hoverId: string | null,
  activeId: string | null,
  focusSet: Set<string> | null,
  searchSet: Set<string> | null,
  tagPalette: Map<string, string>,
  constellation = false,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // Constellation backdrop: deep indigo→near-black radial gradient so
  // the bright nodes feel like stars on night sky instead of UI atoms.
  if (constellation) {
    const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    grd.addColorStop(0, '#0b0c1a');
    grd.addColorStop(1, '#04050a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);

  const isDimmed = (id: string) => {
    if (focusSet && !focusSet.has(id)) return true;
    if (searchSet && !searchSet.has(id)) return true;
    return false;
  };

  // ── Edges (directional) ──
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = byId.get(e.a); const b = byId.get(e.b);
    if (!a || !b) continue;
    const hot = focusSet && focusSet.has(a.id) && focusSet.has(b.id);
    const dim = isDimmed(a.id) || isDimmed(b.id);
    ctx.lineWidth = hot ? 1.6 : 1;
    ctx.strokeStyle = hot
      ? 'rgba(155, 125, 255, 0.55)'
      : dim
        ? 'rgba(232, 230, 225, 0.04)'
        : 'rgba(232, 230, 225, 0.18)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Arrowhead near b — only when relevant (focused or hovered).
    if (hot || hoverId === a.id || hoverId === b.id) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / d; const uy = dy / d;
      const r = nodeRadius(b);
      const tipX = b.x - ux * (r + 2);
      const tipY = b.y - uy * (r + 2);
      const sz = 5;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - ux * sz - uy * sz * 0.5, tipY - uy * sz + ux * sz * 0.5);
      ctx.lineTo(tipX - ux * sz + uy * sz * 0.5, tipY - uy * sz - ux * sz * 0.5);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.fill();
    }
  }

  // ── Nodes ──
  for (const n of nodes) {
    const r = nodeRadius(n);
    const isHover = hoverId === n.id;
    const isActive = activeId === n.id;
    const isFocus = focusSet ? focusSet.has(n.id) : false;
    const dim = isDimmed(n.id);
    const isOrphan = n.outDeg + n.inDeg === 0;

    // Base color = tag palette if any, else neutral cream.
    const baseColor = n.primaryTag && tagPalette.get(n.primaryTag)
      ? tagPalette.get(n.primaryTag)!
      : 'rgba(232, 230, 225, 0.85)';

    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    if (isActive) {
      ctx.fillStyle = '#9b7dff';
      ctx.shadowColor = 'rgba(155, 125, 255, 0.7)';
      ctx.shadowBlur = 20;
    } else {
      const alpha = dim ? 0.28 : 0.9;
      ctx.fillStyle = colorWithAlpha(baseColor, alpha);
      ctx.shadowBlur = (isHover || isFocus) ? 12 : 0;
      ctx.shadowColor = colorWithAlpha(baseColor, 0.55);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Orphan ring — small dashed outline.
    if (isOrphan && !isHover && !isActive) {
      ctx.strokeStyle = dim ? 'rgba(232, 230, 225, 0.12)' : 'rgba(232, 230, 225, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Hover ring — solid violet.
    if (isHover) {
      ctx.strokeStyle = '#9b7dff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── Labels ── italic serif under each node
  ctx.font = 'italic 13px "Iowan Old Style","Charter","New York","Source Serif Pro",Georgia,serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const n of nodes) {
    const r = nodeRadius(n);
    const isHover = hoverId === n.id;
    const isActive = activeId === n.id;
    const dim = isDimmed(n.id);
    ctx.fillStyle = isActive
      ? '#9b7dff'
      : dim
        ? 'rgba(232, 230, 225, 0.25)'
        : isHover
          ? 'rgba(232, 230, 225, 0.95)'
          : 'rgba(232, 230, 225, 0.7)';
    ctx.fillText(n.label, n.x, n.y + r + 4);
  }
  ctx.restore();
}

function resolveTarget(href: string, filenameToId: Map<string, string>): string | null {
  const clean = href.replace(/^\.\//, '').replace(/^\//, '').trim().toLowerCase();
  return filenameToId.get(clean)
    ?? filenameToId.get(clean.replace(/\.md$/i, ''))
    ?? filenameToId.get(clean.replace(/\s+/g, '-'))
    ?? null;
}

// ── Tag parsing ─────────────────────────────────────────────────────────

function extractTags(fm: Record<string, string | string[] | number | boolean>): string[] {
  const raw = fm['tags'] ?? fm['tag'] ?? fm['categories'] ?? fm['category'];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
  return [];
}
const HASHTAG_RE = /(?:^|\s)#([\w-]{2,32})/g;
function extractBodyHashtags(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  // Skip code fences to avoid grabbing `#include` etc.
  const stripped = text.replace(/```[\s\S]*?```/g, '');
  while ((m = HASHTAG_RE.exec(stripped)) !== null) {
    out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

// Perceptually balanced palette — 8 hues for tag clusters.
const TAG_PALETTE = [
  '#9b7dff',  // violet (accent)
  '#67d8a4',  // teal
  '#f0b25e',  // amber
  '#e07a93',  // rose
  '#7ec8e3',  // sky
  '#c4b5fd',  // lavender
  '#a3d977',  // lime
  '#f78db1',  // pink
];

function colorWithAlpha(color: string, alpha: number): string {
  // Accept '#rgb', '#rrggbb', or 'rgba(...)' or 'rgb(...)'.
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
    // crude — replace the trailing alpha if present.
    return color.replace(/rgba?\(([^)]+)\)/, (_, inner: string) => {
      const parts = inner.split(',').map((s) => s.trim());
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const v = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
