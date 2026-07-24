// SPDX-License-Identifier: Apache-2.0
//
// /projects/3d — a journey through the portfolio.
//
// Layout: projects are grouped into per-category clusters spread far apart
// across a sphere (cluster centers = Fibonacci distribution in curated
// manifest order). Within each cluster the projects sit on a small inner
// Fibonacci shell — no overlap.
//
// Field: each project is a camera-facing billboard textured with its OG
// card (/og/<slug>.png), so it's identifiable at a glance.
//
// Focus mode (← / → arrows, click a card, or prev/next): the camera flies to
// a project, approaching from OUTSIDE its cluster so neighbors never occlude
// it. If the project has a live_url, a live mini-browser iframe of the real
// site appears (one iframe at a time; falls back to the OG card if the site
// blocks embedding). esc → overview, enter → open /p/<slug>.

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMarketingBeacon } from "@/lib/analytics";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { ConstellationSfx } from "./constellation-sfx";
import "./projects.css";

const LEGENDARY_SLUG = "neuropulse";   // the single flagship — gets a unique aura

interface CategoryDef { label: string; color: string; }
interface ProjectMin {
  slug: string;
  name: string;
  tagline: string;
  impact?: string;
  proof?: string;
  doi?: string | null;
  npm?: string | null;
  related?: string[];
  tags?: string[];
  featured: boolean;
  language: string | null;
  commits_synced: number;
  live_url: string | null;
  pushed_at?: string;
  stars?: number;
}
interface PortfolioIndex {
  generated_at: string;
  project_count: number;
  categories?: Record<string, CategoryDef>;
  tour?: string[];
  projects: ProjectMin[];
}

interface JourneyEntry {
  project: ProjectMin;
  worldPos: THREE.Vector3;
  localPos: THREE.Vector3;   // card position relative to its cluster center
}

// A real rounded-rectangle card mesh (not a rectangle wearing a rounded
// texture) → no sharp transparent corners showing the layers behind.
function roundedCardGeometry(w: number, h: number, r: number): THREE.ShapeGeometry {
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(s, 10);
  // ShapeGeometry UVs are raw coordinates — remap to 0..1 over the bounds.
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const uvs = geo.attributes.uv as THREE.BufferAttribute;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uvs.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h);
  }
  uvs.needsUpdate = true;
  return geo;
}

function fibSphere(n: number, r: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  if (n === 1) { pts.push(new THREE.Vector3(0, 0, 0)); return pts; }
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * rad * r, y * r, Math.sin(theta) * rad * r));
  }
  return pts;
}

const CARD_ASPECT = 63 / 88;           // real trading-card ratio (portrait)
const CARD_BASE_W = 2.05;
const CARD_BASE_H = CARD_BASE_W / CARD_ASPECT;
const CLUSTER_SPHERE_R = 40;          // cluster centers spread on this radius
const OVERVIEW_CAM_DIST = 100;         // overview default distance (frames whole sphere)
const FOCUS_CAM_DIST = 8.5;            // focus distance from a card (framed, not in-your-face)
const LERP_SPEED = 0.07;               // camera tween speed

// ── element / "type" system — each region is a TCG energy type ─────────
interface ElementDef { name: string; icon: string; }
const ELEMENTS: Record<string, ElementDef> = {
  "llm-inference":     { name: "Lightning", icon: "⚡" },
  "llm-training":      { name: "Fire",      icon: "🔥" },
  "kernel-fusion":     { name: "Steel",     icon: "⚙" },
  "quantum-chemistry": { name: "Psychic",   icon: "🔮" },
  "radiobiology":      { name: "Radiant",   icon: "☢" },
  "biology":           { name: "Grass",     icon: "🌿" },
  "federated":         { name: "Water",     icon: "💧" },
  "privacy":           { name: "Dark",      icon: "🌑" },
  "knowledge-base":    { name: "Mind",      icon: "📖" },
  "agent":             { name: "Colorless", icon: "🤖" },
  "3d":                { name: "Fairy",     icon: "✦" },
  "vision":            { name: "Sight",     icon: "👁" },
  "benchmark":         { name: "Metal",     icon: "🏁" },
  "vertical":          { name: "Guardian",  icon: "🏛" },
  "tooling":           { name: "Craft",     icon: "🔧" },
  "evolutionary":      { name: "Swarm",     icon: "🐝" },
  "simulation":        { name: "Aether",    icon: "🌀" },
  "security":          { name: "Shield",    icon: "🛡" },
  "climate":           { name: "Ember",     icon: "🌋" },
  "legal-tech":        { name: "Order",     icon: "⚖" },
  "education":         { name: "Spark",     icon: "🎓" },
  "research-paper":    { name: "Lore",      icon: "📜" },
  "mcp":               { name: "Link",      icon: "🔗" },
  "ternary":           { name: "Trit",      icon: "△" },
  "misc":              { name: "Normal",    icon: "✧" },
};
const elementOf = (key: string): ElementDef => ELEMENTS[key] ?? ELEMENTS.misc;

// Per-type musical note (major-pentatonic so any path through the cards
// sounds melodic). Maps each region key → semitones above the root.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
const ELEMENT_NOTE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  Object.keys(ELEMENTS).forEach((k, i) => { m[k] = PENTA[i % PENTA.length]; });
  return m;
})();

// ── evolution chains — research lineage rendered as Pokémon evolutions ──
const EVO_CHAINS: string[][] = [
  ["fused-lora", "fusedx", "iz"],
  ["webgpu-kernel-fusion", "webgpu-transformer-fusion", "webgpu-fusion-sdk"],
  ["zero-tvm", "neuropulse"],
  ["webgpu-p2p-evolution", "swarm-bio", "the-swarm"],
  ["gpubench", "wgpu-native-bench", "wgpu-adas-bench"],
  ["webgpu-q", "webgpu-dna"],
  ["draw-instant", "webgpu-fusion-max"],
];
// ── card moves & weaknesses — the move name is flavour; the weakness is
//    the honest limitation, gamified. Unknowns fall back gracefully.
const MOVE_NAME: Record<string, string> = {
  "webgpu-q": "Hartree–Fock Collapse", "the-swarm": "Byzantine Wall",
  "neuropulse": "Live Ablation", "veil": "Pseudonymize", "iz": "Carbon Audit",
  "postnet-cf": "Flip & Accept", "webgpu-dna": "Strand Break", "gpubench": "Cross-Device Sweep",
  "zero-tvm": "Ten-Shader Strike", "fused-lora": "Ternary Tune", "fusedx": "Vision Forge",
  "kernelfusion": "Single Dispatch", "webgpu-kernel-fusion": "Fuse the Loop",
  "webgpu-transformer-fusion": "Decode Fusion", "webgpu-fusion-sdk": "Drop-In Inference",
  "quill": "On-Device Edit", "safenpm": "Sandbox Lock", "panel": "Five Voices",
  "wonderlab": "Ask Anything", "draw-instant": "Realtime Diffuse", "butterfly": "Context Heal",
  "swarm-bio": "Evolve Sequence", "mycosim": "Directed Evolution", "teklifci": "Drawing → Quote",
  "davakasasi": "Sealed Vault", "webgpu-fly": "Brain in a Body", "markview": "Self-Host",
  "webgpu-p2p-evolution": "Peer Genome", "wgpu-adas-bench": "Sensor Fuse", "wgpu-native-bench": "Bare Metal",
  "webgpu-fusion-max": "Scale the Fuse", "zero-burn-lab": "Smoke Sim", "hub": "Live Stream",
  "vault": "Idea Galaxy", "temple": "Embodied Visit", "context-vault": "Read-Only Bridge",
  "tether": "Browser Brain", "the-town": "Fifteen Souls", "deps0": "Zero Dep",
  "swarm-ensemble": "Six Systems", "founder-lab": "Four Advisors",
};
const WEAKNESS: Record<string, string> = {
  "webgpu-q": "scale (C₆₀)", "the-swarm": "proxy fitness", "swarm-bio": "proxy fitness",
  "swarm-ensemble": "toy task", "iz": "field validation", "neuropulse": "single model",
  "webgpu-dna": "small geometry", "mycosim": "no wet lab", "teklifci": "domain-specific",
  "draw-instant": "discrete GPU", "fused-lora": "tiny LoRA", "butterfly": "long-context cost",
  "postnet-cf": "synthetic net", "webgpu-p2p-evolution": "demo-scale",
  "webgpu-fusion-max": "single model", "zero-tvm": "no autotune", "quill": "early build",
  "panel": "hackathon scope", "wonderlab": "BYO-LLM", "webgpu-fly": "LIF only",
  "founder-lab": "advisory only", "davakasasi": "TR-only",
  "the-town": "prototype", "tether": "WIP", "safenpm": "npm-only",
};
const moveName = (slug: string) => MOVE_NAME[slug] ?? "Execute";
const weaknessOf = (slug: string) => WEAKNESS[slug] ?? "scope";

// ── card sets / expansions (authored research eras) ───────────────────
const SETS: { id: string; name: string; symbol: string; slugs: string[] }[] = [
  { id: "fusion", name: "Kernel Fusion", symbol: "◆", slugs: ["kernelfusion", "webgpu-kernel-fusion", "webgpu-transformer-fusion", "webgpu-fusion-sdk", "webgpu-fusion-max", "wgpu-adas-bench", "wgpu-native-bench", "gpubench", "zero-burn-lab"] },
  { id: "browser-ml", name: "Browser-Native ML", symbol: "▲", slugs: ["neuropulse", "zero-tvm", "fused-lora", "fusedx", "draw-instant", "webgpu-q", "webgpu-dna", "webgpu-fly", "wonderlab"] },
  { id: "swarm", name: "The Swarm", symbol: "✦", slugs: ["the-swarm", "swarm-bio", "swarm-ensemble", "webgpu-p2p-evolution", "postnet-cf", "mycosim", "the-town"] },
  { id: "on-device", name: "On-Device & Privacy", symbol: "●", slugs: ["veil", "tether", "quill", "butterfly", "safenpm", "deps0", "context-vault", "davakasasi", "teklifci"] },
  { id: "agents", name: "Agents & Worlds", symbol: "❖", slugs: ["panel", "founder-lab", "temple", "vault", "hub", "markview", "iz"] },
];
const SET_OF: Record<string, { name: string; symbol: string }> = (() => {
  const m: Record<string, { name: string; symbol: string }> = {};
  for (const s of SETS) for (const slug of s.slugs) m[slug] = { name: s.name, symbol: s.symbol };
  return m;
})();

interface EvoInfo { stage: string; prev: string | null; next: string | null; }
const EVO: Record<string, EvoInfo> = (() => {
  const m: Record<string, EvoInfo> = {};
  const STAGE = ["Basic", "Stage 1", "Stage 2", "Stage 3"];
  for (const chain of EVO_CHAINS) {
    chain.forEach((slug, i) => {
      m[slug] = { stage: STAGE[i] ?? `Stage ${i}`, prev: chain[i - 1] ?? null, next: chain[i + 1] ?? null };
    });
  }
  return m;
})();

// ── rarity tiers — derived from real artifacts (published > live > code) ─
type RarityTier = "common" | "rare" | "holo" | "secret";
// foilPattern: -1 none, 0 cracked-ice, 1 linear, 2 cosmos
interface Rarity { tier: RarityTier; symbol: string; label: string; gold: boolean; foil: boolean; foilPattern: number; }
function rarityOf(p: ProjectMin): Rarity {
  if (p.doi) return { tier: "secret", symbol: "✦", label: "Secret Rare", gold: true, foil: true, foilPattern: 2 };
  if (p.featured) return { tier: "holo", symbol: "★", label: "Holo Rare", gold: false, foil: true, foilPattern: 1 };
  if (p.live_url || p.npm) return { tier: "rare", symbol: "◆", label: "Rare", gold: false, foil: true, foilPattern: 0 };
  return { tier: "common", symbol: "●", label: "Common", gold: false, foil: false, foilPattern: -1 };
}
const RARITY_COLOR: Record<RarityTier, string> = {
  common: "#9aa0ac", rare: "#5ea1e6", holo: "#b07aff", secret: "#e8c66a",
};

// rounded-rect path helper
function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

interface CardFaceOpts {
  ogImg: HTMLImageElement | null;
  regionColor: string;
  regionLabel: string;
  element: ElementDef;
  rarity: Rarity;
  power: number;
  number: number;
  total: number;
  stage: string | null;     // evolution stage label, e.g. "Stage 2"
  minted: boolean;          // most-recently-pushed project → "JUST MINTED"
  moveName: string;
  weakness: string;
  setName: string;
  setSymbol: string;
}

// Composite a full trading-card face onto a canvas → texture.
function buildCardFaceTexture(p: ProjectMin, o: CardFaceOpts): THREE.CanvasTexture {
  const W = 512, H = Math.round(512 / CARD_ASPECT);   // 512 × 715
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const frameCol = o.rarity.gold ? "#e8c66a" : o.regionColor;
  const pad = 20;

  // ── outer card body ──
  ctx.fillStyle = "#0b0a0d";
  rrPath(ctx, 4, 4, W - 8, H - 8, 34); ctx.fill();
  // metallic frame: gradient stroke in the region/gold color
  const fg = ctx.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, frameCol);
  fg.addColorStop(0.5, o.rarity.gold ? "#fff0c0" : "#ffffff");
  fg.addColorStop(1, frameCol);
  ctx.lineWidth = 13; ctx.strokeStyle = fg;
  rrPath(ctx, 9, 9, W - 18, H - 18, 30); ctx.stroke();
  // inner matte panel
  ctx.fillStyle = "#13111a";
  rrPath(ctx, 20, 20, W - 40, H - 40, 22); ctx.fill();

  // ── title bar ──
  ctx.fillStyle = "#ece8e0";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 33px Georgia, 'Times New Roman', serif";
  let nm = p.name;
  while (ctx.measureText(nm).width > W - 200 && nm.length) nm = nm.slice(0, -1);
  if (nm !== p.name) nm = nm.slice(0, -1) + "…";
  ctx.fillText(nm, pad + 16, 62);
  // power stat (right)
  ctx.textAlign = "right";
  ctx.font = "700 15px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(236,232,224,0.55)";
  ctx.fillText("HP", W - pad - 56, 50);
  ctx.font = "700 30px Georgia, serif";
  ctx.fillStyle = frameCol;
  ctx.fillText(String(o.power), W - pad - 16, 62);
  ctx.textAlign = "left";
  // type badge (under the name, left)
  const badge = `${o.element.icon} ${o.element.name}`;
  ctx.font = "600 16px ui-monospace, Menlo, monospace";
  const bw = ctx.measureText(badge).width + 22;
  ctx.fillStyle = frameCol + "22";
  rrPath(ctx, pad + 14, 74, bw, 26, 8); ctx.fill();
  ctx.strokeStyle = frameCol; ctx.lineWidth = 1.4;
  rrPath(ctx, pad + 14, 74, bw, 26, 8); ctx.stroke();
  ctx.fillStyle = frameCol;
  ctx.fillText(badge, pad + 25, 93);

  // ── art window (the OG screenshot, cover-fit) ──
  const ax = 30, ay = 112, aw = W - 60, ah = 250;
  ctx.save();
  rrPath(ctx, ax, ay, aw, ah, 14); ctx.clip();
  ctx.fillStyle = "#0b0a0d"; ctx.fillRect(ax, ay, aw, ah);
  if (o.ogImg) {
    const ir = o.ogImg.width / o.ogImg.height;
    const wr = aw / ah;
    let dw = aw, dh = ah, dx = ax, dy = ay;
    if (ir > wr) { dw = ah * ir; dx = ax - (dw - aw) / 2; }
    else { dh = aw / ir; dy = ay - (dh - ah) / 2; }
    ctx.drawImage(o.ogImg, dx, dy, dw, dh);
  }
  ctx.restore();
  ctx.strokeStyle = frameCol; ctx.lineWidth = 2.5;
  rrPath(ctx, ax, ay, aw, ah, 14); ctx.stroke();

  // ── move / ability box ──
  const tx = 30, ty = 378, tw = W - 60, th = H - ty - 96;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  rrPath(ctx, tx, ty, tw, th, 12); ctx.fill();
  ctx.strokeStyle = "rgba(236,232,224,0.12)"; ctx.lineWidth = 1.2;
  rrPath(ctx, tx, ty, tw, th, 12); ctx.stroke();

  let cy = ty + 30;
  if (o.stage) {
    ctx.font = "700 13px ui-monospace, Menlo, monospace";
    ctx.fillStyle = frameCol;
    ctx.fillText(o.stage.toUpperCase(), tx + 18, cy);
    cy += 22;
  }
  // move: energy dot + name (left) + damage (right)
  ctx.fillStyle = o.element.icon ? frameCol : "#ece8e0";
  ctx.font = "600 16px ui-monospace, Menlo, monospace";
  ctx.fillText(o.element.icon, tx + 16, cy + 1);
  ctx.fillStyle = "#ece8e0";
  ctx.font = "700 19px Georgia, serif";
  ctx.fillText(o.moveName, tx + 44, cy + 2);
  ctx.textAlign = "right";
  ctx.font = "800 22px ui-monospace, Menlo, monospace";
  ctx.fillStyle = frameCol;
  ctx.fillText(String(o.power), tx + tw - 16, cy + 3);
  ctx.textAlign = "left";
  cy += 26;
  // effect = the impact line
  ctx.font = "400 15px Georgia, serif";
  ctx.fillStyle = "rgba(236,232,224,0.82)";
  for (const ln of wrapText(ctx, p.impact || p.tagline || "", tw - 36, 3)) {
    ctx.fillText(ln, tx + 18, cy); cy += 21;
  }
  if (p.proof) {
    cy += 4;
    ctx.font = "italic 400 13px Georgia, serif";
    ctx.fillStyle = frameCol;
    for (const ln of wrapText(ctx, `✓ ${p.proof}`, tw - 36, 1)) { ctx.fillText(ln, tx + 18, cy); cy += 18; }
  }

  // ── weakness / resistance / retreat row ──
  const fy = ty + th + 14;
  ctx.font = "600 11px ui-monospace, Menlo, monospace";
  const cell = (label: string, val: string, cx: number, col: string) => {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(236,232,224,0.42)"; ctx.fillText(label, cx, fy);
    ctx.fillStyle = col; ctx.font = "700 13px ui-monospace, Menlo, monospace"; ctx.fillText(val, cx, fy + 17);
    ctx.font = "600 11px ui-monospace, Menlo, monospace";
  };
  cell("WEAKNESS", o.weakness, pad + 95, "#e07a5f");
  cell("RESIST", o.element.name, W / 2 + 20, "#7ab989");
  cell("RETREAT", "◇".repeat(Math.max(1, Math.min(3, Math.round(o.power / 80)))), W - pad - 70, "rgba(236,232,224,0.7)");
  ctx.textAlign = "left";

  // ── bottom strip: set · collector number · rarity ──
  ctx.font = "600 13px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(236,232,224,0.5)";
  ctx.fillText(`${o.setSymbol} ${o.setName}`, pad + 16, H - 30);
  ctx.textAlign = "right";
  ctx.fillStyle = o.rarity.gold ? "#e8c66a" : "rgba(236,232,224,0.7)";
  ctx.fillText(`${o.rarity.symbol} ${String(o.number).padStart(2, "0")}/${o.total}`, W - pad - 16, H - 30);
  ctx.textAlign = "left";

  // "JUST MINTED" stamp — angled across the art for the freshest project.
  if (o.minted) {
    ctx.save();
    ctx.translate(W - 120, 150);
    ctx.rotate(-0.34);
    ctx.strokeStyle = "#e07a5f";
    ctx.lineWidth = 3;
    ctx.font = "800 22px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    const tw = ctx.measureText("JUST MINTED").width + 24;
    rrPath(ctx, -tw / 2, -22, tw, 34, 6); ctx.stroke();
    ctx.fillStyle = "#e07a5f";
    ctx.fillText("JUST MINTED", 0, 4);
    ctx.restore();
    ctx.textAlign = "left";
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Shared branded card back (the "reverse" you see during the pack reveal).
function buildCardBackTexture(): THREE.CanvasTexture {
  const W = 512, H = Math.round(512 / CARD_ASPECT);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1a1525"); g.addColorStop(1, "#0b0a0d");
  ctx.fillStyle = g; rrPath(ctx, 4, 4, W - 8, H - 8, 34); ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = "#9b7dff";
  rrPath(ctx, 10, 10, W - 20, H - 20, 28); ctx.stroke();
  // central emblem
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = "rgba(155,125,255,0.55)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 120, 46, (i * Math.PI) / 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#ece8e0";
  ctx.font = "700 64px Georgia, serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("✦", 0, 4);
  ctx.restore();
  ctx.fillStyle = "rgba(236,232,224,0.5)";
  ctx.font = "600 18px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("THE CONSTELLATION", W / 2, H - 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The Trainer card — a "Supporter"-style card for the person behind it all.
function buildTrainerCardTexture(stats: { cards: number; commits: number; langs: number }): THREE.CanvasTexture {
  const W = 512, H = Math.round(512 / CARD_ASPECT);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const gold = "#e8c66a", accent = "#b07aff", pad = 20;
  ctx.fillStyle = "#0b0a0d"; rrPath(ctx, 4, 4, W - 8, H - 8, 34); ctx.fill();
  const fg = ctx.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, accent); fg.addColorStop(0.5, "#fff0c0"); fg.addColorStop(1, gold);
  ctx.lineWidth = 13; ctx.strokeStyle = fg; rrPath(ctx, 9, 9, W - 18, H - 18, 30); ctx.stroke();
  ctx.fillStyle = "#15111d"; rrPath(ctx, 20, 20, W - 40, H - 40, 22); ctx.fill();
  // TRAINER banner
  ctx.fillStyle = accent; rrPath(ctx, 20, 20, W - 40, 44, 22); ctx.fill();
  ctx.fillStyle = "#14111a"; ctx.font = "800 22px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center"; ctx.fillText("TRAINER · SUPPORTER", W / 2, 50);
  // emblem
  ctx.save(); ctx.translate(W / 2, 150);
  ctx.strokeStyle = "rgba(176,122,255,0.6)"; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 64, 26, (i * Math.PI) / 5, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = "#ece8e0"; ctx.font = "700 44px Georgia, serif"; ctx.fillText("✦", 0, 16); ctx.restore();
  // name + subtitle
  ctx.fillStyle = "#ece8e0"; ctx.font = "700 30px Georgia, serif"; ctx.textAlign = "center";
  ctx.fillText("Baris Günaydın", W / 2, 235);
  ctx.fillStyle = gold; ctx.font = "600 14px ui-monospace, Menlo, monospace";
  ctx.fillText("INDEPENDENT RESEARCHER · CHIANG MAI", W / 2, 262);
  // stats
  ctx.textAlign = "left";
  const rows: [string, string][] = [["Cards forged", String(stats.cards)], ["Commits", stats.commits.toLocaleString()], ["Languages", String(stats.langs)]];
  rows.forEach((r, i) => {
    const y = 312 + i * 36;
    ctx.fillStyle = "rgba(236,232,224,0.7)"; ctx.font = "400 17px Georgia, serif"; ctx.fillText(r[0], pad + 24, y);
    ctx.fillStyle = gold; ctx.font = "700 19px ui-monospace, Menlo, monospace"; ctx.textAlign = "right"; ctx.fillText(r[1], W - pad - 24, y); ctx.textAlign = "left";
  });
  // supporter effect
  ctx.fillStyle = "rgba(0,0,0,0.3)"; rrPath(ctx, 30, 430, W - 60, 180, 12); ctx.fill();
  ctx.fillStyle = accent; ctx.font = "700 14px ui-monospace, Menlo, monospace"; ctx.fillText("SUPPORTER EFFECT", 48, 460);
  ctx.fillStyle = "rgba(236,232,224,0.82)"; ctx.font = "400 16px Georgia, serif";
  for (const [i, ln] of ["Every card in play is verified against", "ground truth, not taken on faith.", "Ships open-source. Builds in the open."].entries())
    ctx.fillText(ln, 48, 488 + i * 24);
  ctx.fillStyle = "rgba(236,232,224,0.5)"; ctx.font = "italic 13px Georgia, serif";
  ctx.fillText("\"The same falsifiable discipline as the physics.\"", 48, 588);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Soft radial halo behind each card → blooms into a colored glow.
function makeGlowTexture(): THREE.Texture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Holographic foil — distinct pattern per rarity:
//   0 = cracked-ice (Rare), 1 = linear-streak (Holo), 2 = cosmos (Secret).
function makeHoloMaterial(pattern: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uShift: { value: 0 }, uPat: { value: pattern } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime; uniform float uShift; uniform float uPat;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float band = vUv.x + vUv.y * 0.6 + uTime * 0.05 + uShift;
        vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (band + vec3(0.0, 0.33, 0.66)));
        float sheen;
        if (uPat < 0.5) {
          // cracked-ice: angular shards
          vec2 g = floor(vUv * 9.0);
          float c = hash(g);
          float crack = smoothstep(0.45, 0.5, abs(fract((vUv.x + vUv.y) * 9.0 + c) - 0.5));
          sheen = (0.25 + 0.4 * c) * (0.6 + 0.4 * sin(uTime + c * 6.28)) * (0.4 + 0.6 * crack);
        } else if (uPat < 1.5) {
          // linear-streak holo
          float streak = smoothstep(0.42, 0.5, abs(fract(band) - 0.5));
          sheen = (1.0 - streak) * 0.5;
        } else {
          // cosmos / galaxy
          float streak = smoothstep(0.40, 0.5, abs(fract(band) - 0.5));
          float gal = 0.30 * (0.5 + 0.5 * sin(vUv.x * 40.0 + uTime) * cos(vUv.y * 52.0 - uTime));
          sheen = (1.0 - streak) * 0.7 + gal;
        }
        gl_FragColor = vec4(rainbow * sheen * 0.62, sheen * 0.42);
      }
    `,
  });
}

// Prismatic refraction rim — a rainbow that lives only on the card's edge
// and slides with view angle. Additive, on every card.
function makePrismMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      uniform float uTime;
      void main() {
        // edge mask: bright only near the border
        float ex = min(vUv.x, 1.0 - vUv.x);
        float ey = min(vUv.y, 1.0 - vUv.y);
        float edge = 1.0 - smoothstep(0.0, 0.06, min(ex, ey));
        float fres = pow(1.0 - max(dot(vN, vView), 0.0), 2.0);
        float h = vUv.x + vUv.y + fres * 1.5 + uTime * 0.08;
        vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.66)));
        float a = edge * (0.3 + 0.5 * fres) * 0.6;
        gl_FragColor = vec4(rainbow * a, a * 0.7);
      }
    `,
  });
}

// Twinkling foil sparkles scattered across rare cards (additive points).
function makeSparkleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying float vTw;
      uniform float uTime;
      void main() {
        vTw = 0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 6.2831);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp((1.2 + vTw * 2.6) * (26.0 / -mv.z), 0.0, 16.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTw;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        // crisp core + soft halo → a sparkle, not a fuzzy blob
        float a = (smoothstep(0.5, 0.12, r) * 0.45 + smoothstep(0.18, 0.0, r)) * vTw;
        gl_FragColor = vec4(1.0, 0.97, 0.88, a);
      }
    `,
  });
}

export default function ProjectsConstellation() {
  useMarketingBeacon();
  const [index, setIndex] = useState<PortfolioIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ProjectMin | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [focused, setFocused] = useState<number | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tourPos, setTourPos] = useState<number | null>(null);
  const [packOpen, setPackOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState<null | "secret">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [regionTitle, setRegionTitle] = useState<{ label: string; color: string; count: number } | null>(null);
  const [discovered, setDiscovered] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mv-discovered") || "[]")); } catch { return new Set(); }
  });
  const [inspect, setInspect] = useState<ProjectMin | null>(null);
  const [inspectBack, setInspectBack] = useState(false);
  const [inspectTilt, setInspectTilt] = useState({ x: 0, y: 0 });
  const [photo, setPhoto] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const [deckMode, setDeckMode] = useState(false);
  const [deck, setDeck] = useState<string[]>([]);
  const [lite, setLite] = useState<boolean>(() => {
    try { return window.matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 8) < 8; }
    catch { return false; }
  });
  const reduceMotion = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
  const [battle, setBattle] = useState<[ProjectMin, ProjectMin] | null>(null);
  const [quiz, setQuiz] = useState<{ answer: ProjectMin; options: ProjectMin[]; picked: string | null } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const cardImgRef = useRef<Map<string, string>>(new Map());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const timelineRef = useRef<number>(1);     // 1 = all cards present
  const trailerRef = useRef(false);
  const [timeline, setTimeline] = useState(1);
  useEffect(() => { trailerRef.current = trailer; }, [trailer]);

  const sfxRef = useRef<ConstellationSfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new ConstellationSfx();
  const packOpenedRef = useRef(false);
  const prevFocusRef = useRef<number | null>(null);
  const redealRef = useRef(false);
  const prevClusterRef = useRef<string | null>(null);
  const shownAchRef = useRef<Set<string>>(new Set());

  const focusedRef = useRef<number | null>(null);
  const journeyOrderRef = useRef<JourneyEntry[]>([]);
  const setFocusedAll = useCallback((i: number | null) => {
    focusedRef.current = i;
    setFocused(i);
  }, []);
  const flyToSlug = useCallback((slug: string) => {
    const i = journeyOrderRef.current.findIndex((x) => x.project.slug === slug);
    if (i >= 0) setFocusedAll(i);
  }, [setFocusedAll]);

  useEffect(() => {
    document.body.classList.add("proj-route-mounted");
    return () => document.body.classList.remove("proj-route-mounted");
  }, []);

  useEffect(() => {
    fetch("/portfolio/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: PortfolioIndex) => setIndex(d))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!index || !containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050406, 0.005);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 400);
    camera.position.set(0, 12, 158);            // starts far → dollies in to OVERVIEW_CAM_DIST

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x050406, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;       // filmic highlights
    renderer.toneMappingExposure = 1.04;
    container.appendChild(renderer.domElement);

    // ── bloom compositor — the colored halos bleed light (the "AAA" look) ──
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.35, 0.92);
    bloom.strength = 0.42;    // dialed down — restrained, not shiny
    bloom.radius = 0.35;
    bloom.threshold = 0.92;   // only the very brightest cores bloom
    composer.addPass(bloom);
    // depth-of-field — focused card crisp, the field melts to bokeh (cinematic)
    const bokeh = new BokehPass(scene, camera, { focus: FOCUS_CAM_DIST, aperture: 0, maxblur: 0.01 });
    bokeh.setSize(width, height);
    const bokehU = bokeh.uniforms as Record<string, THREE.IUniform>;
    composer.addPass(bokeh);
    // chromatic aberration — subtle baseline, ramps on warp / secret reveal
    const rgbShift = new ShaderPass(RGBShiftShader);
    rgbShift.uniforms["amount"].value = 0.0006;
    composer.addPass(rgbShift);
    // film grain + faint scanlines — the "premium screen" finish
    const film = new FilmPass(0.28, false);
    composer.addPass(film);
    composer.addPass(new OutputPass());
    // performance-lite / reduced-motion: drop the most expensive passes
    bokeh.enabled = !lite;
    film.enabled = !lite;
    rgbShift.enabled = !lite;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;
    controls.minDistance = 3;
    controls.maxDistance = 150;
    controls.target.set(0, 0, 0);

    // ── clusters in curated manifest order ───────────────────────────────
    const categories = index.categories ?? {};
    const categoryKeys = Object.keys(categories);
    const clusterCenters = fibSphere(Math.max(categoryKeys.length, 1), CLUSTER_SPHERE_R);

    const projectsByCluster = new Map<string, ProjectMin[]>();
    for (const p of index.projects) {
      const firstValid = (p.tags ?? []).find((t) => categories[t]);
      const key = firstValid ?? "misc";
      if (!projectsByCluster.has(key)) projectsByCluster.set(key, []);
      projectsByCluster.get(key)!.push(p);
    }
    for (const arr of projectsByCluster.values()) {
      arr.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        if (a.commits_synced !== b.commits_synced) return b.commits_synced - a.commits_synced;
        return a.name.localeCompare(b.name);
      });
    }

    interface ClusterDef { key: string; label: string; color: string; center: THREE.Vector3; projects: ProjectMin[]; }
    const clusters: ClusterDef[] = [];
    categoryKeys.forEach((k, i) => {
      const projects = projectsByCluster.get(k) ?? [];
      if (projects.length === 0) return;
      clusters.push({ key: k, label: categories[k].label, color: categories[k].color, center: clusterCenters[i], projects });
    });
    const misc = projectsByCluster.get("misc") ?? [];
    if (misc.length > 0) clusters.push({ key: "misc", label: "other", color: "#a5a5b2", center: new THREE.Vector3(0, -CLUSTER_SPHERE_R, 0), projects: misc });

    // ── place cards inside their cluster (no overlap) ────────────────────
    type Card = {
      group: THREE.Group; pickMesh: THREE.Mesh; frontMat: THREE.MeshBasicMaterial;
      backMesh: THREE.Mesh; holo: THREE.Mesh | null; gloss: THREE.Mesh | null;
      glowMat: THREE.MeshBasicMaterial; glowOpacity: number; tierColor: THREE.Color;
      glowColor: THREE.Color; project: ProjectMin; basePos: THREE.Vector3;
      phase: number; revealDelay: number; foil: boolean;
    };
    const cards: Card[] = [];
    const pickMeshes: THREE.Mesh[] = [];
    const disposables: { dispose: () => void }[] = [];
    const maxCommits = Math.max(...index.projects.map((p) => p.commits_synced || 1));
    const journeyOrder: JourneyEntry[] = [];

    // shared dressing — three foil patterns, prism edge, sparkles, gloss
    const glowTex = makeGlowTexture();
    const backTex = buildCardBackTexture();
    const holoIce = makeHoloMaterial(0);       // Rare
    const holoLinear = makeHoloMaterial(1);    // Holo
    const holoCosmos = makeHoloMaterial(2);    // Secret
    const prismMat = makePrismMaterial();
    const sparkleMat = makeSparkleMaterial();
    disposables.push(glowTex, backTex, holoIce, holoLinear, holoCosmos, prismMat, sparkleMat);
    const holoForPattern = (pat: number) => (pat === 2 ? holoCosmos : pat === 1 ? holoLinear : holoIce);
    const clusterColorOf = new Map<string, THREE.Color>();
    for (const cl of clusters) clusterColorOf.set(cl.key, new THREE.Color(cl.color));
    const numberOf = new Map<string, number>();
    index.projects.forEach((p, i) => numberOf.set(p.slug, i + 1));
    const total = index.projects.length;
    // most-recently-pushed project → wears the JUST MINTED stamp
    let mintedSlug = "";
    let mintedAt = "";
    for (const p of index.projects) {
      if (p.pushed_at && p.pushed_at > mintedAt) { mintedAt = p.pushed_at; mintedSlug = p.slug; }
    }
    let gIndex = 0;

    for (const cluster of clusters) {
      const N = cluster.projects.length;
      // inner shell radius scaled so portrait cards never touch
      const innerR = N <= 1 ? 0 : 3.8 + Math.sqrt(N) * 2.0;
      const innerPts = fibSphere(N, innerR);

      cluster.projects.forEach((p, j) => {
        const localPos = innerPts[j];
        const worldPos = new THREE.Vector3().addVectors(cluster.center, localPos);
        const rarity = rarityOf(p);

        const scale = 0.92 + Math.sqrt(p.commits_synced / maxCommits) * 0.45 + (p.featured ? 0.18 : 0);
        const w = CARD_BASE_W * scale;
        const h = CARD_BASE_H * scale;
        const cardNumber = numberOf.get(p.slug) ?? gIndex + 1;
        const power = Math.min(999, Math.round(50 + Math.sqrt(p.commits_synced || 1) * 6 + (p.featured ? 40 : 0)));
        const auraK = 1 + Math.min(1, Math.max(0, (power - 60) / 130)) * 0.6;   // power-scaled aura

        const group = new THREE.Group();
        group.position.copy(worldPos);

        const tint = clusterColorOf.get(cluster.key) ?? new THREE.Color(cluster.color);
        const glowColor = (rarity.gold ? new THREE.Color("#e8c66a") : tint.clone()).multiplyScalar(1.25);
        const tierColor = new THREE.Color(RARITY_COLOR[rarity.tier]).multiplyScalar(1.5);
        const glowOpacity = (rarity.foil ? 0.62 : 0.4) * (0.7 + 0.3 * auraK);

        // (1) power-scaled colored halo → blooms into a regional glow
        const glowGeom = new THREE.PlaneGeometry(w * (rarity.foil ? 1.95 : 1.6) * auraK, h * (rarity.foil ? 1.85 : 1.55) * auraK);
        const glowMat = new THREE.MeshBasicMaterial({
          map: glowTex, color: glowColor, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, opacity: glowOpacity * 0.8,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.z = -0.03;
        group.add(glow);
        disposables.push(glowGeom, glowMat);

        const cardGeom = roundedCardGeometry(w, h, w * 0.066);
        disposables.push(cardGeom);

        // (2) card back (visible during the pack-reveal flip)
        const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.FrontSide });
        const backMesh = new THREE.Mesh(cardGeom, backMat);
        backMesh.rotation.y = Math.PI;
        backMesh.position.z = -0.012;
        group.add(backMesh);
        disposables.push(backMat);

        // (3) the trading-card face (composited async once the OG art loads)
        const frontMat = new THREE.MeshBasicMaterial({ color: 0x13111a, transparent: true, side: THREE.FrontSide });
        const cardMesh = new THREE.Mesh(cardGeom, frontMat);
        cardMesh.userData.project = p;
        group.add(cardMesh);
        disposables.push(frontMat);

        const setInfo = SET_OF[p.slug] ?? { name: "Promo", symbol: "✧" };
        const finalize = (ogImg: HTMLImageElement | null) => {
          const tex = buildCardFaceTexture(p, {
            ogImg, regionColor: cluster.color, regionLabel: cluster.label,
            element: elementOf(cluster.key), rarity, power,
            number: cardNumber, total, stage: EVO[p.slug]?.stage ?? null,
            minted: p.slug === mintedSlug, moveName: moveName(p.slug),
            weakness: weaknessOf(p.slug), setName: setInfo.name, setSymbol: setInfo.symbol,
          });
          frontMat.map = tex; frontMat.color.set(0xffffff); frontMat.needsUpdate = true;
          disposables.push(tex);
          try { cardImgRef.current.set(p.slug, (tex.image as HTMLCanvasElement).toDataURL("image/png")); } catch { /* ignore */ }
        };
        const img = new Image();
        img.onload = () => finalize(img);
        img.onerror = () => finalize(null);
        img.src = `/og/${p.slug}.png`;

        // (4) prismatic refraction edge — every card
        const prism = new THREE.Mesh(cardGeom, prismMat);
        prism.position.z = 0.003;
        group.add(prism);

        // (5) parallax gloss — a soft specular glare that slides on tilt
        const glossGeom = new THREE.PlaneGeometry(w * 0.7, h * 0.5);
        const glossMat = new THREE.MeshBasicMaterial({
          map: glowTex, color: 0xffffff, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.0,
        });
        const gloss = new THREE.Mesh(glossGeom, glossMat);
        gloss.position.z = 0.0045;
        group.add(gloss);
        disposables.push(glossGeom, glossMat);

        // (6) holographic foil sheen — pattern by rarity tier
        let holo: THREE.Mesh | null = null;
        if (rarity.foil) {
          holo = new THREE.Mesh(cardGeom, holoForPattern(rarity.foilPattern));
          holo.position.z = 0.006;
          group.add(holo);

          // (7) twinkling foil sparkles
          const SP = rarity.gold ? 26 : rarity.tier === "holo" ? 16 : 10;
          const sp = new Float32Array(SP * 3);
          const ph = new Float32Array(SP);
          for (let k = 0; k < SP; k++) {
            sp[k * 3] = (Math.random() - 0.5) * w * 0.9;
            sp[k * 3 + 1] = (Math.random() - 0.5) * h * 0.92;
            sp[k * 3 + 2] = 0.01;
            ph[k] = Math.random();
          }
          const spGeo = new THREE.BufferGeometry();
          spGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
          spGeo.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
          group.add(new THREE.Points(spGeo, sparkleMat));
          disposables.push(spGeo);
        }

        group.scale.setScalar(0.001);                 // reveal grows it in
        scene.add(group);
        cards.push({
          group, pickMesh: cardMesh, frontMat, backMesh, holo, gloss,
          glowMat, glowOpacity, tierColor, glowColor,
          project: p, basePos: worldPos.clone(), phase: Math.random() * Math.PI * 2,
          revealDelay: gIndex * 0.04, foil: rarity.foil,
        });
        pickMeshes.push(cardMesh);
        journeyOrder.push({ project: p, worldPos, localPos: localPos.clone() });
        gIndex++;
      });
    }

    // ── the Trainer card — a Supporter card for the person behind it all ──
    {
      const trainer: ProjectMin = {
        slug: "trainer-baris", name: "Baris Günaydın",
        tagline: "Independent Researcher · Chiang Mai",
        impact: "Built all 41 of these solo — open-source, verified against ground truth.",
        featured: false, language: null, commits_synced: 0, live_url: null,
      };
      const langs = new Set(index.projects.map((p) => p.language).filter(Boolean)).size;
      const commitSum = index.projects.reduce((a, p) => a + (p.commits_synced || 0), 0);
      const tw = CARD_BASE_W * 1.18, th = CARD_BASE_H * 1.18;
      const worldPos = new THREE.Vector3(0, CLUSTER_SPHERE_R + 12, 0);   // crowning the constellation
      const group = new THREE.Group();
      group.position.copy(worldPos);
      const glowColor = new THREE.Color("#b07aff").multiplyScalar(1.3);
      const glowGeom = new THREE.PlaneGeometry(tw * 2.2, th * 2.1);
      const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: glowColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 });
      const glow = new THREE.Mesh(glowGeom, glowMat); glow.position.z = -0.03; group.add(glow);
      disposables.push(glowGeom, glowMat);
      const cardGeom = roundedCardGeometry(tw, th, tw * 0.066); disposables.push(cardGeom);
      const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.FrontSide });
      const backMesh = new THREE.Mesh(cardGeom, backMat); backMesh.rotation.y = Math.PI; backMesh.position.z = -0.012; group.add(backMesh);
      disposables.push(backMat);
      const tex = buildTrainerCardTexture({ cards: index.projects.length, commits: commitSum, langs });
      try { cardImgRef.current.set("trainer-baris", (tex.image as HTMLCanvasElement).toDataURL("image/png")); } catch { /* ignore */ }
      const frontMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.FrontSide });
      const cardMesh = new THREE.Mesh(cardGeom, frontMat); cardMesh.userData.project = trainer; group.add(cardMesh);
      disposables.push(frontMat, tex);
      const prism = new THREE.Mesh(cardGeom, prismMat); prism.position.z = 0.003; group.add(prism);
      const holo = new THREE.Mesh(cardGeom, holoCosmos); holo.position.z = 0.006; group.add(holo);
      group.scale.setScalar(0.001);
      scene.add(group);
      cards.push({
        group, pickMesh: cardMesh, frontMat, backMesh, holo, gloss: null,
        glowMat, glowOpacity: 0.95, tierColor: new THREE.Color("#e8c66a").multiplyScalar(1.7),
        glowColor, project: trainer, basePos: worldPos.clone(), phase: 0,
        revealDelay: gIndex * 0.04, foil: true,
      });
      pickMeshes.push(cardMesh);
      journeyOrder.push({ project: trainer, worldPos, localPos: new THREE.Vector3(0, 1, 0) });
    }

    journeyOrderRef.current = journeyOrder;

    // ── relationship edges (the lineage graph from the brain [[links]]) ──
    // Faint lines connect related projects so the constellation shows how
    // the research descends from itself. The focused node's edges brighten.
    const slugToWorld = new Map<string, THREE.Vector3>();
    for (const c of cards) slugToWorld.set(c.project.slug, c.basePos);
    type Edge = { a: string; b: string; pa: THREE.Vector3; pb: THREE.Vector3 };
    const edges: Edge[] = [];
    const seenEdge = new Set<string>();
    for (const p of index.projects) {
      for (const rel of p.related ?? []) {
        const pa = slugToWorld.get(p.slug);
        const pb = slugToWorld.get(rel);
        if (!pa || !pb) continue;                                  // dangling → skip
        const key = p.slug < rel ? `${p.slug}|${rel}` : `${rel}|${p.slug}`;
        if (seenEdge.has(key)) continue;                           // undirected dedup
        seenEdge.add(key);
        edges.push({ a: p.slug, b: rel, pa, pb });
      }
    }

    const edgePos = new Float32Array(Math.max(edges.length, 1) * 6);
    edges.forEach((e, i) => {
      edgePos.set([e.pa.x, e.pa.y, e.pa.z, e.pb.x, e.pb.y, e.pb.z], i * 6);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
    edgeGeo.setDrawRange(0, edges.length * 2);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x9b7dff, transparent: true, opacity: 0.09 });
    scene.add(new THREE.LineSegments(edgeGeo, edgeMat));
    disposables.push(edgeGeo, edgeMat);

    // dynamic overlay: only the focused project's edges, brighter
    const hiPos = new Float32Array(Math.max(edges.length, 1) * 6);
    const hiGeo = new THREE.BufferGeometry();
    hiGeo.setAttribute("position", new THREE.BufferAttribute(hiPos, 3));
    hiGeo.setDrawRange(0, 0);
    const hiMat = new THREE.LineBasicMaterial({ color: 0xc4b0ff, transparent: true, opacity: 0.85 });
    scene.add(new THREE.LineSegments(hiGeo, hiMat));
    disposables.push(hiGeo, hiMat);

    function updateHighlightEdges() {
      const f = focusedRef.current;
      const slug = f !== null ? journeyOrderRef.current[f]?.project.slug : null;
      if (!slug) { hiGeo.setDrawRange(0, 0); edgeMat.opacity = 0.09; return; }
      let n = 0;
      for (const e of edges) {
        if (e.a === slug || e.b === slug) {
          hiPos.set([e.pa.x, e.pa.y, e.pa.z, e.pb.x, e.pb.y, e.pb.z], n * 6);
          n++;
        }
      }
      (hiGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      hiGeo.setDrawRange(0, n * 2);
      edgeMat.opacity = 0.04;                       // dim the rest while one is lit
    }

    // ── starfield ────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const rad = 90 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3]     = rad * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = rad * Math.cos(phi);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    // glowTex (soft radial) maps every point → round, soft dots, not squares
    const starMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size: 0.18, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // parallax depth layers — nearer stars drift faster than far ones
    const starLayers: THREE.Points[] = [];
    for (const [rad0, sz, op, spd] of [[55, 0.28, 0.5, 0.0003], [150, 0.13, 0.4, 0.00006]] as const) {
      const g = new THREE.BufferGeometry();
      const n = 900;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = rad0 + Math.random() * 40, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph);
      }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size: sz, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const pts = new THREE.Points(g, m); pts.userData.spd = spd;
      scene.add(pts); starLayers.push(pts); disposables.push(g, m);
    }

    // ── aurora ribbons — flowing colored light curtains ───────────────────
    const auroraMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; uniform float uTime;
        void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.08 + uTime*0.5)*6.0 + cos(p.y*0.1 - uTime*0.3)*4.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uTime;
        void main(){ float band = sin(vUv.x*10.0 + uTime)*0.5+0.5; vec3 col = mix(vec3(0.2,0.7,0.6), vec3(0.5,0.3,0.9), vUv.x);
          float a = smoothstep(0.0,0.3,vUv.y)*smoothstep(1.0,0.7,vUv.y)*(0.10+0.10*band); gl_FragColor = vec4(col*a*2.0, a); }`,
    });
    const aurora = new THREE.Mesh(new THREE.PlaneGeometry(260, 70, 40, 8), auroraMat);
    aurora.position.set(0, 55, -120);
    scene.add(aurora);
    disposables.push(auroraMat, aurora.geometry);

    // ── shooting stars — occasional comets across the field ──────────────
    const cometCount = 5;
    const cometPos = new Float32Array(cometCount * 3);
    const cometData = Array.from({ length: cometCount }, (_, i) => ({
      from: new THREE.Vector3(), to: new THREE.Vector3(), t0: i * 3.3, dur: 1.4,
    }));
    const resetComet = (cd: typeof cometData[0], now: number) => {
      const a = Math.random() * 6.283, r = 120;
      cd.from.set(Math.cos(a) * r, 40 + Math.random() * 60, Math.sin(a) * r);
      cd.to.copy(cd.from).multiplyScalar(-0.3).add(new THREE.Vector3((Math.random() - 0.5) * 60, -40, (Math.random() - 0.5) * 60));
      cd.t0 = now + Math.random() * 6; cd.dur = 1.0 + Math.random();
    };
    const cometGeo = new THREE.BufferGeometry();
    cometGeo.setAttribute("position", new THREE.BufferAttribute(cometPos, 3));
    const cometMat = new THREE.PointsMaterial({ map: glowTex, color: 0xfff4d8, size: 1.2, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const comets = new THREE.Points(cometGeo, cometMat);
    scene.add(comets);
    disposables.push(cometGeo, cometMat);
    const cometAttr = cometGeo.attributes.position as THREE.BufferAttribute;

    // ── materialize "poof" — a sparkle burst when a card is focused ───────
    const poofN = 40;
    const poofPos = new Float32Array(poofN * 3);
    const poofPh = new Float32Array(poofN);
    const poofDir: THREE.Vector3[] = [];
    for (let i = 0; i < poofN; i++) { poofPh[i] = Math.random(); poofDir.push(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()); }
    const poofGeo = new THREE.BufferGeometry();
    poofGeo.setAttribute("position", new THREE.BufferAttribute(poofPos, 3));
    poofGeo.setAttribute("aPhase", new THREE.BufferAttribute(poofPh, 1));
    const poof = new THREE.Points(poofGeo, sparkleMat);
    poof.visible = false;
    scene.add(poof);
    disposables.push(poofGeo);
    const poofAttr = poofGeo.attributes.position as THREE.BufferAttribute;
    const poofCenter = new THREE.Vector3();
    let poofStart = -1;

    // ── lightning arcs between two same-type cards, now and then ─────────
    const clusterMembers = new Map<string, Card[]>();
    for (const cd of cards) {
      const key = (cd.project.tags ?? []).find((tg) => categories[tg]) ?? "misc";
      if (!clusterMembers.has(key)) clusterMembers.set(key, []);
      clusterMembers.get(key)!.push(cd);
    }
    const arcN = 10;
    const arcPos = new Float32Array(arcN * 3);
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute("position", new THREE.BufferAttribute(arcPos, 3));
    const arcMat = new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const arc = new THREE.Line(arcGeo, arcMat);
    scene.add(arc);
    disposables.push(arcGeo, arcMat);
    const arcAttr = arcGeo.attributes.position as THREE.BufferAttribute;
    let nextBolt = 3;
    const multiKeys = [...clusterMembers.values()].filter((m) => m.length >= 2);
    function fireBolt() {
      if (!multiKeys.length) return;
      const grp = multiKeys[Math.floor((nextBolt * 7.13) % multiKeys.length)];
      const a = grp[Math.floor((nextBolt * 3.7) % grp.length)];
      const b = grp[Math.floor((nextBolt * 5.1 + 1) % grp.length)];
      if (a === b) return;
      for (let i = 0; i < arcN; i++) {
        const f = i / (arcN - 1);
        const jitter = (i === 0 || i === arcN - 1) ? 0 : (Math.sin(i * 12.9 + nextBolt) * 1.2);
        arcPos[i * 3] = a.basePos.x + (b.basePos.x - a.basePos.x) * f + jitter;
        arcPos[i * 3 + 1] = a.basePos.y + (b.basePos.y - a.basePos.y) * f + Math.cos(i * 7.7 + nextBolt) * 1.2;
        arcPos[i * 3 + 2] = a.basePos.z + (b.basePos.z - a.basePos.z) * f + jitter;
      }
      arcAttr.needsUpdate = true;
      arcMat.opacity = 0.9;
    }

    // ── nebula skydome — volumetric-ish colored clouds behind everything ──
    const nebGeo = new THREE.SphereGeometry(195, 32, 32);
    // time-of-day tint — cool at night, warm in the evening
    const hr = new Date().getHours();
    const tod = hr < 6 ? new THREE.Color(0.75, 0.85, 1.25) : hr < 12 ? new THREE.Color(1.15, 1.05, 0.9)
      : hr < 18 ? new THREE.Color(1.1, 0.95, 1.05) : new THREE.Color(1.25, 0.82, 0.95);
    const nebMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uTod: { value: tod } },
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vP; uniform float uTime; uniform vec3 uTod;
        float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
        void main(){
          vec3 d = normalize(vP);
          float n = pow(fbm(d*3.0 + vec3(0.0, uTime*0.008, 0.0)), 2.2);
          vec3 base = mix(vec3(0.04,0.09,0.20), vec3(0.12,0.06,0.24), fbm(d*2.0 + 11.0));
          vec3 col = (base + vec3(0.34,0.20,0.52) * n * 0.7) * uTod;
          gl_FragColor = vec4(col * 0.55, 1.0);
        }`,
    });
    const nebula = new THREE.Mesh(nebGeo, nebMat);
    scene.add(nebula);
    disposables.push(nebGeo, nebMat);

    // ── foil dust — slow-drifting glitter motes catching the bloom ────────
    const dustCount = 280;
    const dPos = new Float32Array(dustCount * 3);
    const dPh = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      const r = 14 + Math.random() * 72, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
      dPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      dPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      dPos[i * 3 + 2] = r * Math.cos(ph);
      dPh[i] = Math.random();
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute("aPhase", new THREE.BufferAttribute(dPh, 1));
    const dust = new THREE.Points(dustGeo, sparkleMat);
    scene.add(dust);
    disposables.push(dustGeo);

    // ── energy pulses travelling along the lineage edges ──────────────────
    // Each edge carries a short comet-trail of soft round dots that fade
    // toward the tail — reads as light flowing, not a square sliding.
    const TRAIL = 6;
    const travCount = Math.max(edges.length, 1) * TRAIL;
    const travPos = new Float32Array(travCount * 3);
    const travLife = new Float32Array(travCount);
    for (let i = 0; i < edges.length; i++) for (let k = 0; k < TRAIL; k++) travLife[i * TRAIL + k] = k / (TRAIL - 1);
    const travGeo = new THREE.BufferGeometry();
    travGeo.setAttribute("position", new THREE.BufferAttribute(travPos, 3));
    travGeo.setAttribute("aLife", new THREE.BufferAttribute(travLife, 1));
    const travMat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aLife; varying float vL;
        void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = (1.0 - aLife * 0.62) * 240.0 / -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        varying float vL;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d);
          float a = smoothstep(0.5, 0.0, r) * (1.0 - vL) * 0.9;
          gl_FragColor = vec4(0.80, 0.72, 1.0, a) * 1.5; }`,
    });
    const travelers = new THREE.Points(travGeo, travMat);
    scene.add(travelers);
    disposables.push(travGeo, travMat);
    const travPhase = edges.map(() => Math.random());
    const travAttr = travGeo.attributes.position as THREE.BufferAttribute;
    function updateTravelers(t: number) {
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const lead = (t * 0.16 + travPhase[i]) % 1;
        for (let k = 0; k < TRAIL; k++) {
          let f = lead - k * 0.035; if (f < 0) f += 1;
          const idx = (i * TRAIL + k) * 3;
          travPos[idx] = e.pa.x + (e.pb.x - e.pa.x) * f;
          travPos[idx + 1] = e.pa.y + (e.pb.y - e.pa.y) * f;
          travPos[idx + 2] = e.pa.z + (e.pb.z - e.pa.z) * f;
        }
      }
      travAttr.needsUpdate = true;
    }

    // ── legendary aura — a ring of orbiting sparkles on the flagship ──────
    const legCard = cards.find((c) => c.project.slug === LEGENDARY_SLUG);
    let legAttr: THREE.BufferAttribute | null = null;
    let legPos: Float32Array | null = null;
    let legPh: Float32Array | null = null;
    if (legCard) {
      const oc = 44;
      legPos = new Float32Array(oc * 3);
      legPh = new Float32Array(oc);
      for (let i = 0; i < oc; i++) legPh[i] = i / oc;
      const legGeo = new THREE.BufferGeometry();
      legGeo.setAttribute("position", new THREE.BufferAttribute(legPos, 3));
      legGeo.setAttribute("aPhase", new THREE.BufferAttribute(legPh, 1));
      legAttr = legGeo.attributes.position as THREE.BufferAttribute;
      legCard.group.add(new THREE.Points(legGeo, sparkleMat));
      disposables.push(legGeo);
    }
    function updateLegendary(t: number) {
      if (!legAttr || !legPos || !legPh) return;
      const n = legPh.length;
      for (let i = 0; i < n; i++) {
        const a = t * 0.7 + legPh[i] * Math.PI * 2;
        legPos[i * 3] = Math.cos(a) * 1.9;
        legPos[i * 3 + 1] = Math.sin(a) * 1.3 + Math.sin(t * 2 + i) * 0.05;
        legPos[i * 3 + 2] = 0.05;
      }
      legAttr.needsUpdate = true;
    }

    // ── god-ray streaks behind the legendary card ────────────────────────
    function makeRayTexture(): THREE.Texture {
      const s = 256;
      const cv = document.createElement("canvas"); cv.width = cv.height = s;
      const cx = cv.getContext("2d")!;
      cx.translate(s / 2, s / 2);
      for (let i = 0; i < 16; i++) {
        cx.rotate((Math.PI * 2) / 16);
        const grd = cx.createLinearGradient(0, 0, 0, -s / 2);
        grd.addColorStop(0, "rgba(255,238,180,0.5)");
        grd.addColorStop(1, "rgba(255,238,180,0)");
        cx.fillStyle = grd;
        cx.beginPath(); cx.moveTo(-4, 0); cx.lineTo(4, 0); cx.lineTo(1, -s / 2); cx.lineTo(-1, -s / 2); cx.closePath(); cx.fill();
      }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
    }
    let godRays: THREE.Mesh | null = null;
    if (legCard) {
      const rayTex = makeRayTexture();
      const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.38 });
      const rayGeom = new THREE.PlaneGeometry(7, 7);
      godRays = new THREE.Mesh(rayGeom, rayMat);
      godRays.position.z = -0.08;
      legCard.group.add(godRays);
      disposables.push(rayTex, rayMat, rayGeom);
    }

    // ── lens flare sprite that rides the focused card ────────────────────
    function makeFlareTexture(): THREE.Texture {
      const s = 256;
      const cv = document.createElement("canvas"); cv.width = cv.height = s;
      const cx = cv.getContext("2d")!;
      const g = cx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.15, "rgba(255,250,235,0.5)");
      g.addColorStop(0.5, "rgba(255,240,210,0.08)");
      g.addColorStop(1, "rgba(255,240,210,0)");
      cx.fillStyle = g; cx.fillRect(0, 0, s, s);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
    }
    const flareTex = makeFlareTexture();
    const flareMat = new THREE.SpriteMaterial({ map: flareTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0 });
    const flare = new THREE.Sprite(flareMat);
    flare.scale.setScalar(2.0);
    scene.add(flare);
    disposables.push(flareTex, flareMat);

    // ── reflective floor far below (display-case mirror) — skipped in lite ─
    let floor: Reflector | null = null;
    if (!lite) {
      floor = new Reflector(new THREE.PlaneGeometry(220, 220), {
        color: 0x141018, textureWidth: 1024, textureHeight: 1024,
      });
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -CLUSTER_SPHERE_R - 12;
      scene.add(floor);
    }

    // ── raycast for hover + click ────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    let currentHover: Card | null = null;
    let lastInteractT = 0;
    const touch = () => { lastInteractT = clock.getElapsedTime(); };

    function onPointerMove(e: PointerEvent) {
      touch();
      const rect = renderer.domElement.getBoundingClientRect();
      mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setMouse({ x: e.clientX, y: e.clientY });
      raycaster.setFromCamera(mouseVec, camera);
      const hits = raycaster.intersectObjects(pickMeshes);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        currentHover = cards.find((c) => c.pickMesh === hitMesh) ?? null;
        setHovered(hitMesh.userData.project as ProjectMin);
        renderer.domElement.style.cursor = "pointer";
      } else {
        currentHover = null;
        setHovered(null);
        renderer.domElement.style.cursor = "grab";
      }
    }
    function onClick() {
      touch();
      sfxRef.current?.ensure();           // unlock audio on a user gesture
      raycaster.setFromCamera(mouseVec, camera);
      const hits = raycaster.intersectObjects(pickMeshes);
      if (hits.length > 0) {
        const p = (hits[0].object as THREE.Mesh).userData.project as ProjectMin;
        const idx = journeyOrderRef.current.findIndex((x) => x.project.slug === p.slug);
        if (idx >= 0) setFocusedAll(idx);
      }
    }
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    // ── animate ──────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let frame = 0;
    const tmpScale = new THREE.Vector3();
    const HOVER_SCALE = 1.16;
    const FOCUS_SCALE = 1.34;
    const REVEAL_DUR = 0.7;
    const CENTER = new THREE.Vector3(0, 0, 0);
    const Y_AXIS = new THREE.Vector3(0, 1, 0);
    const qBill = new THREE.Quaternion();
    const qFlip = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    const eTilt = new THREE.Euler();
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
    const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

    const desiredTarget = new THREE.Vector3();
    const desiredCamPos = new THREE.Vector3();
    const dirTmp = new THREE.Vector3();
    const prevCamPos = new THREE.Vector3().copy(camera.position);
    let lastAppliedFocus: number | null = null;
    let revealStart = -1;          // captured the frame the pack is opened

    function recomputeCameraDesire() {
      const f = focusedRef.current;
      if (f === null) {
        desiredTarget.set(0, 0, 0);
        dirTmp.subVectors(camera.position, controls.target).normalize();
        if (dirTmp.lengthSq() < 0.01) dirTmp.set(0, 0.12, 1).normalize();
        desiredCamPos.copy(dirTmp.multiplyScalar(OVERVIEW_CAM_DIST));
        controls.autoRotate = true;
      } else {
        controls.autoRotate = false;
        const entry = journeyOrderRef.current[f];
        if (!entry) return;
        desiredTarget.copy(entry.worldPos);
        // approach from OUTSIDE the cluster: direction = card-relative-to-center
        dirTmp.copy(entry.localPos);
        if (dirTmp.lengthSq() < 0.01) dirTmp.copy(entry.worldPos);     // single-card cluster
        if (dirTmp.lengthSq() < 0.01) dirTmp.set(0, 0, 1);
        dirTmp.normalize();
        desiredCamPos.copy(entry.worldPos).addScaledVector(dirTmp, FOCUS_CAM_DIST);
      }
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      frame++;
      const t = clock.getElapsedTime();

      if (lastAppliedFocus !== focusedRef.current) {
        recomputeCameraDesire();
        updateHighlightEdges();
        const nf = focusedRef.current;
        if (nf !== null && journeyOrderRef.current[nf]) {
          poofCenter.copy(journeyOrderRef.current[nf].worldPos);
          poofStart = t; poof.visible = true;            // materialize burst
        }
        lastAppliedFocus = focusedRef.current;
      }

      camera.position.lerp(desiredCamPos, LERP_SPEED);
      controls.target.lerp(desiredTarget, LERP_SPEED);

      // pack-gated reveal clock: cards stay hidden until the booster is opened
      if (revealStart < 0 && packOpenedRef.current) revealStart = t;
      if (redealRef.current) { revealStart = t; redealRef.current = false; }   // "open another pack"
      const introT = revealStart < 0 ? -999 : t - revealStart;

      const focusSlug = focusedRef.current !== null ? journeyOrderRef.current[focusedRef.current]?.project.slug : null;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const dur = c.foil ? 1.0 : REVEAL_DUR;          // rares flip in slower
        const rp = Math.min(1, Math.max(0, (introT - c.revealDelay) / dur));

        if (rp < 1) {
          // booster-pack reveal: deal out from the deck, flipping back→front
          const eo = easeOutCubic(rp);
          c.group.position.lerpVectors(CENTER, c.basePos, eo);
          qBill.copy(camera.quaternion);
          qFlip.setFromAxisAngle(Y_AXIS, (1 - rp) * Math.PI);
          c.group.quaternion.copy(qBill).multiply(qFlip);
          c.group.scale.setScalar(Math.max(0.0001, easeOutBack(rp)));
          // rarity escalation: the glow flashes the tier colour as it flips
          const pulse = Math.sin(rp * Math.PI);
          c.glowMat.color.copy(c.glowColor).lerp(c.tierColor, pulse);
          c.glowMat.opacity = c.glowOpacity + pulse * 0.9;
          if (c.gloss) (c.gloss.material as THREE.MeshBasicMaterial).opacity = 0;
        } else {
          c.glowMat.color.copy(c.glowColor);
          c.glowMat.opacity = c.glowOpacity;
          c.group.position.set(c.basePos.x, c.basePos.y + Math.sin(t * 0.5 + c.phase) * 0.08, c.basePos.z);
          const isFocus = c.project.slug === focusSlug;
          if (isFocus) {
            // holo tilt + slow orbit-inspect so you see the foil roll
            const wob = Math.sin(t * 0.8) * 0.08;
            const orbit = Math.sin(t * 0.4) * 0.22;        // gentle inspect sway
            eTilt.set(wob, Math.cos(t * 0.62) * 0.1 + orbit, 0, "XYZ");
            qTilt.setFromEuler(eTilt);
            c.group.quaternion.copy(camera.quaternion).multiply(qTilt);
            if (c.gloss) {
              const gm = c.gloss.material as THREE.MeshBasicMaterial;
              gm.opacity = 0.18;
              c.gloss.position.x = -Math.sin(t * 0.45 + orbit) * 0.5;   // parallax glare
              c.gloss.position.y = 0.25 + Math.cos(t * 0.6) * 0.15;
            }
          } else {
            c.group.quaternion.copy(camera.quaternion);
            if (c.gloss) (c.gloss.material as THREE.MeshBasicMaterial).opacity = 0;
          }
          const breathe = isFocus ? 1 : 1 + Math.sin(t * 1.3 + c.phase) * 0.012;  // idle breathing
          const target = (isFocus ? FOCUS_SCALE : c === currentHover ? HOVER_SCALE : 1) * breathe;
          tmpScale.set(target, target, target);
          c.group.scale.lerp(tmpScale, 0.18);
        }
        // timeline scrubber: hide cards "newer" than the cursor
        c.group.visible = c.project.commits_synced >= 0 && (timelineRef.current >= 1 || (c.revealDelay / 0.04) <= timelineRef.current * cards.length);
      }

      const shift = Math.sin(t * 0.3) * 0.2;
      for (const hm of [holoIce, holoLinear, holoCosmos]) { hm.uniforms.uTime.value = t; hm.uniforms.uShift.value = shift; }
      prismMat.uniforms.uTime.value = t;
      sparkleMat.uniforms.uTime.value = t;
      nebMat.uniforms.uTime.value = t;
      updateTravelers(t);
      updateLegendary(t);
      if (godRays) godRays.rotation.z += 0.0035;

      // lens flare on the focused card
      const ff = focusedRef.current;
      if (ff !== null && journeyOrderRef.current[ff]) {
        flare.position.copy(journeyOrderRef.current[ff].worldPos);
        flareMat.opacity += (0.22 - flareMat.opacity) * 0.07;
      } else {
        flareMat.opacity += (0 - flareMat.opacity) * 0.1;
      }

      // attract mode: idle in the overview → a faster cinematic camera sweep
      const idle = t - lastInteractT;
      const attract = (idle > 22 || trailerRef.current) && focusedRef.current === null && packOpenedRef.current;
      controls.autoRotateSpeed = attract ? 0.7 : 0.22;

      // parallax star layers + aurora
      for (const pl of starLayers) pl.rotation.y += pl.userData.spd as number;
      auroraMat.uniforms.uTime.value = t;

      // shooting stars
      for (let i = 0; i < cometData.length; i++) {
        const cd = cometData[i];
        const pr = (t - cd.t0) / cd.dur;
        if (pr < 0 || pr > 1) { if (pr > 1) resetComet(cd, t); cometPos[i * 3] = cometPos[i * 3 + 1] = cometPos[i * 3 + 2] = 99999; continue; }
        cometPos[i * 3] = cd.from.x + (cd.to.x - cd.from.x) * pr;
        cometPos[i * 3 + 1] = cd.from.y + (cd.to.y - cd.from.y) * pr;
        cometPos[i * 3 + 2] = cd.from.z + (cd.to.z - cd.from.z) * pr;
      }
      cometAttr.needsUpdate = true;

      // materialize poof
      if (poofStart >= 0) {
        const pr = (t - poofStart) / 0.6;
        if (pr >= 1) { poof.visible = false; poofStart = -1; }
        else { for (let i = 0; i < poofN; i++) { const d = poofDir[i], rr = pr * 3.0; poofPos[i * 3] = poofCenter.x + d.x * rr; poofPos[i * 3 + 1] = poofCenter.y + d.y * rr; poofPos[i * 3 + 2] = poofCenter.z + d.z * rr; } poofAttr.needsUpdate = true; }
      }

      // lightning arcs
      if (t > nextBolt) { fireBolt(); nextBolt = t + 2.5 + (Math.sin(t) * 0.5 + 0.5) * 3; }
      arcMat.opacity *= 0.86;

      // constellation sigil — edges brighten as you pull back; hover ripples
      if (focusedRef.current === null) {
        const dist = camera.position.length();
        edgeMat.opacity = Math.min(0.32, 0.09 + Math.max(0, (dist - 90) / 120) * 0.5);
        if (currentHover) edgeMat.opacity = Math.max(edgeMat.opacity, 0.24);
      }

      // dolly-zoom on the legendary
      const legFocus = focusedRef.current !== null && journeyOrderRef.current[focusedRef.current]?.project.slug === LEGENDARY_SLUG;
      const wantFov = legFocus ? 40 : 55;
      if (Math.abs(camera.fov - wantFov) > 0.1) { camera.fov += (wantFov - camera.fov) * 0.06; camera.updateProjectionMatrix(); }

      // depth-of-field: shallow when focused on a card, off in the overview
      const focusDist = camera.position.distanceTo(controls.target);
      bokehU["focus"].value = focusDist;
      const wantAperture = focusedRef.current !== null ? 0.00042 : 0;
      bokehU["aperture"].value += (wantAperture - bokehU["aperture"].value) * 0.08;
      bokehU["maxblur"].value = 0.01;

      // warp: stars stretch & brighten when the camera rushes between cards
      const camSpeed = camera.position.distanceTo(prevCamPos);
      prevCamPos.copy(camera.position);
      const warp = Math.min(1, camSpeed * 0.45);
      starMat.size = 0.07 + warp * 0.55;
      starMat.opacity = 0.55 + warp * 0.4;
      rgbShift.uniforms["amount"].value = 0.0006 + warp * 0.0035;   // aberration on rush

      stars.rotation.y += 0.00012;
      controls.update();
      composer.render();
    }
    // Deep link: ?focus=<slug> flies straight to that project on load.
    const focusParam = new URLSearchParams(window.location.search).get("focus");
    if (focusParam) {
      const di = journeyOrder.findIndex((x) => x.project.slug === focusParam);
      if (di >= 0) setFocusedAll(di);
    }

    recomputeCameraDesire();
    updateHighlightEdges();
    tick();

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      bokeh.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    let interacted = false;
    const onInteract = () => { if (!interacted) { interacted = true; controls.autoRotate = false; } };
    renderer.domElement.addEventListener("pointerdown", onInteract);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerdown", onInteract);
      for (const d of disposables) d.dispose();
      starGeo.dispose();
      starMat.dispose();
      floor?.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [index, setFocusedAll, lite]);

  // Keyboard journey nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const N = journeyOrderRef.current.length;
      if (!N) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;   // don't hijack search typing
      if (e.key === "ArrowRight") { e.preventDefault(); setFocusedAll(focusedRef.current === null ? 0 : (focusedRef.current + 1) % N); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setFocusedAll(focusedRef.current === null ? N - 1 : (focusedRef.current - 1 + N) % N); }
      else if (e.key === "Escape") { e.preventDefault(); setFocusedAll(null); }
      else if (e.key === "Enter" && focusedRef.current !== null) {
        const p = journeyOrderRef.current[focusedRef.current]?.project;
        if (p) navigate(`/p/${p.slug}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, setFocusedAll]);

  // Close the live browser whenever the focused project changes (or we leave focus).
  useEffect(() => { setBrowserOpen(false); }, [focused]);

  // Skip the unboxing if it was already opened this session, or if a deep
  // link (?focus=) means the visitor wants a specific card straight away.
  useEffect(() => {
    const deep = new URLSearchParams(window.location.search).has("focus");
    let already = false;
    try { already = !!sessionStorage.getItem("mv-pack-opened"); } catch { /* ignore */ }
    if (deep || already || reduceMotion) { packOpenedRef.current = true; setPackOpen(true); }
  }, [reduceMotion]);

  // Sound + secret-rare flash whenever the focused card changes.
  useEffect(() => {
    const sfx = sfxRef.current;
    const prev = prevFocusRef.current;
    prevFocusRef.current = focused;
    if (!sfx || focused === null || focused === prev) return;
    const p = journeyOrderRef.current[focused]?.project;
    if (!p) return;
    sfx.flip();
    const key = (p.tags ?? []).find((tg) => index?.categories?.[tg]) ?? "misc";
    const semi = ELEMENT_NOTE[key] ?? 0;
    sfx.note(semi, ((semi % 12) / 12 - 0.5) * 1.4);   // per-type melody, panned
    if (rarityOf(p).tier === "secret") {
      sfx.secret();
      setFlash("secret");
      const id = window.setTimeout(() => setFlash(null), 1500);
      return () => window.clearTimeout(id);
    }
  }, [focused, index]);

  // Tear down the audio graph on unmount.
  useEffect(() => () => sfxRef.current?.dispose(), []);

  // Load a shared deck from the URL.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("deck");
    if (d) setDeck(d.split(",").filter(Boolean).slice(0, 6));
  }, []);

  // Esc closes the inspector / exits photo mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setInspect(null); setPhoto(false); setTrailer(false); }
      if (e.key.toLowerCase() === "p" && !inspect) setPhoto((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect]);

  // Collection meta: mark focused cards "discovered" (persisted), and pop a
  // region title-card whenever you cross into a new cluster.
  useEffect(() => {
    if (focused === null) { prevClusterRef.current = null; return; }
    const p = journeyOrderRef.current[focused]?.project;
    if (!p || p.slug.startsWith("trainer")) return;   // trainer isn't a collectible
    setDiscovered((prev) => {
      if (prev.has(p.slug)) return prev;
      const next = new Set(prev); next.add(p.slug);
      try { localStorage.setItem("mv-discovered", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    const cats = index?.categories ?? {};
    const keyOf = (pr: ProjectMin) => (pr.tags ?? []).find((tg) => cats[tg]) ?? "misc";
    const key = keyOf(p);
    if (key !== prevClusterRef.current) {
      prevClusterRef.current = key;
      const def = cats[key];
      const count = (index?.projects ?? []).filter((pr) => keyOf(pr) === key).length;
      setRegionTitle({ label: def?.label ?? "other", color: def?.color ?? "#a5a5b2", count });
      const id = window.setTimeout(() => setRegionTitle(null), 2200);
      return () => window.clearTimeout(id);
    }
  }, [focused, index]);

  // Achievement toasts — fire once each.
  useEffect(() => {
    if (!index) return;
    sfxRef.current?.setIntensity(discovered.size / Math.max(1, index.projects.length));
    const fire = (key: string, msg: string) => {
      if (shownAchRef.current.has(key)) return;
      shownAchRef.current.add(key);
      setToast(msg);
      sfxRef.current?.chime();
      window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
    };
    const secrets = index.projects.filter((p) => rarityOf(p).tier === "secret");
    if (secrets.length && secrets.every((p) => discovered.has(p.slug))) fire("secrets", "✦ All Secret Rares discovered!");
    if (discovered.size >= index.projects.length && index.projects.length) fire("complete", "★ Cardex complete — all 41 found!");
  }, [discovered, index]);

  // Leaving focus (esc / overview) also ends a guided tour.
  useEffect(() => { if (focused === null) setTourPos(null); }, [focused]);

  // Keep the URL shareable: ?focus=<slug> tracks the current project.
  useEffect(() => {
    const slug = focused !== null ? journeyOrderRef.current[focused]?.project.slug : null;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("focus", slug);
    else url.searchParams.delete("focus");
    window.history.replaceState(null, "", url.toString());
  }, [focused]);

  // Cluster membership (mirrors the scene's grouping) for the mini-map.
  const { clusterInfo, clusterOf } = useMemo(() => {
    const cats = index?.categories ?? {};
    const counts = new Map<string, number>();
    const ofSlug = new Map<string, string>();
    for (const p of index?.projects ?? []) {
      const key = (p.tags ?? []).find((t) => cats[t]) ?? "misc";
      counts.set(key, (counts.get(key) ?? 0) + 1);
      ofSlug.set(p.slug, key);
    }
    const info = Object.keys(cats)
      .filter((k) => (counts.get(k) ?? 0) > 0)
      .map((k) => ({ key: k, label: cats[k].label, color: cats[k].color, count: counts.get(k)! }));
    if ((counts.get("misc") ?? 0) > 0)
      info.push({ key: "misc", label: "other", color: "#a5a5b2", count: counts.get("misc")! });
    return { clusterInfo: info, clusterOf: ofSlug };
  }, [index]);

  // Search matches → fly-to suggestions.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !index) return [] as ProjectMin[];
    return index.projects
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.tagline ?? "").toLowerCase().includes(q))
      .slice(0, 7);
  }, [search, index]);

  if (error) return <div className="proj-3d-msg">failed to load: {error}</div>;
  if (!index) return <div className="proj-3d-msg">loading constellation…</div>;

  const focusedProject = focused !== null ? journeyOrderRef.current[focused]?.project : null;
  const N = journeyOrderRef.current.length;
  const liveHost = focusedProject?.live_url ? (() => { try { return new URL(focusedProject.live_url!).host; } catch { return focusedProject.live_url; } })() : null;
  const activeClusterKey = focusedProject ? clusterOf.get(focusedProject.slug) ?? null : null;
  const focusedEvo = focusedProject ? EVO[focusedProject.slug] ?? null : null;
  const nameOf = (slug: string) => index.projects.find((p) => p.slug === slug)?.name ?? slug;

  // Booster-pack unboxing → starts the reveal + the soundscape.
  const openPack = () => {
    const sfx = sfxRef.current;
    if (sfx) { sfx.ensure(); sfx.setMuted(muted); sfx.rip(); sfx.startPad(); }
    packOpenedRef.current = true;
    setPackOpen(true);
    try { sessionStorage.setItem("mv-pack-opened", "1"); } catch { /* ignore */ }
  };
  const toggleMute = () => {
    setMuted((m) => { const nm = !m; sfxRef.current?.setMuted(nm); return nm; });
  };
  const redeal = () => {
    const sfx = sfxRef.current;
    if (sfx) { sfx.ensure(); sfx.rip(); }
    redealRef.current = true;
    setFocusedAll(null);
  };

  // Cardex collection stats.
  const tierCounts = { common: 0, rare: 0, holo: 0, secret: 0 } as Record<string, number>;
  for (const p of index.projects) tierCounts[rarityOf(p).tier]++;
  const collected = discovered.size;
  const totalCards = index.projects.length;

  // Inspector / deck / photo / card-of-day handlers.
  const openInspect = () => { if (focusedProject) { setInspect(focusedProject); setInspectBack(false); setInspectTilt({ x: 0, y: 0 }); } };
  const downloadCard = (slug: string) => {
    const url = cardImgRef.current.get(slug);
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = `${slug}-card.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const toggleDeck = (slug: string) =>
    setDeck((d) => (d.includes(slug) ? d.filter((s) => s !== slug) : d.length < 6 ? [...d, slug] : d));
  const shareDeck = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("deck", deck.join(","));
    navigator.clipboard?.writeText(url.toString());
    setToast("deck link copied ↗");
    window.setTimeout(() => setToast((c) => (c === "deck link copied ↗" ? null : c)), 2400);
  };
  const enterPhoto = () => { setPhoto(true); setFocusedAll(null); };
  const screenshot = () => {
    const r = rendererRef.current; if (!r) return;
    const a = document.createElement("a");
    a.href = r.domElement.toDataURL("image/png"); a.download = "constellation.png";
    document.body.appendChild(a); a.click(); a.remove();
  };
  // Card of the day — deterministic from the date.
  let codHash = 0; for (const ch of new Date().toISOString().slice(0, 10)) codHash = (codHash * 31 + ch.charCodeAt(0)) >>> 0;
  const cardOfDay = index.projects[codHash % totalCards];
  const inspectImg = inspect ? cardImgRef.current.get(inspect.slug) ?? `/og/${inspect.slug}.png` : null;
  const nameBySlug = (s: string) => index.projects.find((p) => p.slug === s)?.name ?? s;

  // Share a beautiful "I pulled…" image (native share on mobile, else download).
  const sharePull = async (p: ProjectMin) => {
    const cardUrl = cardImgRef.current.get(p.slug);
    if (!cardUrl) { downloadCard(p.slug); return; }
    const r = rarityOf(p);
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
    const cx = cv.getContext("2d"); if (!cx) return;
    const g = cx.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, "#1a1230"); g.addColorStop(1, "#0b0a0d");
    cx.fillStyle = g; cx.fillRect(0, 0, 1080, 1350);
    cx.fillStyle = r.gold ? "#e8c66a" : r.tier === "holo" ? "#b07aff" : "#5ea1e6";
    cx.font = "800 46px ui-monospace, monospace"; cx.textAlign = "center";
    cx.fillText(`${r.symbol} ${r.label.toUpperCase()}`, 540, 110);
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.onerror = res; img.src = cardUrl; });
    const cw = 720, ch = cw / CARD_ASPECT; cx.drawImage(img, (1080 - cw) / 2, 150, cw, ch);
    cx.fillStyle = "rgba(236,232,224,0.7)"; cx.font = "500 30px ui-monospace, monospace";
    cx.fillText("markview.ai/projects/3d", 540, 1300);
    const out = cv.toDataURL("image/png");
    try {
      const blob = await (await fetch(out)).blob();
      const file = new File([blob], `${p.slug}-pull.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `I pulled ${p.name}` }); return;
      }
    } catch { /* fall through to download */ }
    const a = document.createElement("a"); a.href = out; a.download = `${p.slug}-pull.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const startBattle = () => {
    if (!focusedProject) return;
    const others = index.projects.filter((p) => p.slug !== focusedProject.slug);
    if (!others.length) return;
    setBattle([focusedProject, others[Math.floor(Math.random() * others.length)]]);
  };
  const startQuiz = () => {
    const pool = index.projects;
    const answer = pool[Math.floor(Math.random() * pool.length)];
    const options = [answer];
    let guard = 0;
    while (options.length < 4 && guard++ < 50) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (!options.includes(c)) options.push(c);
    }
    options.sort(() => Math.random() - 0.5);
    setQuiz({ answer, options, picked: null });
  };
  const powerOf = (p: ProjectMin) => Math.min(999, Math.round(50 + Math.sqrt(p.commits_synced || 1) * 6 + (p.featured ? 40 : 0)));

  // Guided "start here" tour.
  const tour = index.tour ?? [];
  const startTour = () => { if (tour.length) { setTourPos(0); flyToSlug(tour[0]); } };
  const tourNext = () => {
    if (tourPos === null) return;
    const next = tourPos + 1;
    if (next >= tour.length) { setTourPos(null); setFocusedAll(null); }
    else { setTourPos(next); flyToSlug(tour[next]); }
  };

  return (
    <div className={`proj-3d-shell${photo ? " is-photo" : ""}${trailer ? " is-trailer" : ""}`}>
      <header className="proj-3d-head">
        <Link to="/projects" className="proj-3d-back">← grid</Link>
        <span className="proj-3d-title">constellation · a journey through the work</span>
        <button className="proj-3d-mute" onClick={toggleMute} aria-label={muted ? "unmute" : "mute"} title={muted ? "unmute" : "mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="proj-3d-mute" onClick={() => setTrailer((v) => !v)} title="trailer mode">🎬</button>
        <button className="proj-3d-mute" onClick={enterPhoto} title="photo mode (P)">📷</button>
        <button className={`proj-3d-mute${lite ? " is-on" : ""}`} onClick={() => setLite((v) => !v)} title="performance mode (drops heavy effects)">⚡</button>

        <div className="proj-3d-search">
          <input
            type="search"
            className="proj-3d-search-input"
            placeholder="search → fly to a project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) { flyToSlug(matches[0].slug); setSearch(""); }
              if (e.key === "Escape") setSearch("");
            }}
          />
          {matches.length > 0 && (
            <div className="proj-3d-search-results">
              {matches.map((p) => (
                <button
                  key={p.slug}
                  className="proj-3d-search-row"
                  onMouseDown={(e) => { e.preventDefault(); flyToSlug(p.slug); setSearch(""); }}
                >
                  <span className="proj-3d-search-name">{p.name}</span>
                  <span className="proj-3d-search-tag">{p.tagline}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="proj-3d-hint">
          {focused === null
            ? "drag · scroll · click a card  →  ← / →  to start"
            : "← / →  step · esc overview · enter open"}
        </span>
      </header>

      <div ref={containerRef} className="proj-3d-stage" />

      {/* focus vignette — dims the world and spotlights the focused card */}
      <div className={`proj-3d-vignette${focused !== null ? " is-on" : ""}`} aria-hidden />

      {/* cardex — collection progress */}
      {packOpen && (
        <div className="proj-3d-cardex">
          <div className="proj-3d-cardex-head">cardex · {collected}/{totalCards}</div>
          <div className="proj-3d-cardex-bar"><div className="proj-3d-cardex-fill" style={{ width: `${(collected / totalCards) * 100}%` }} /></div>
          <div className="proj-3d-cardex-tiers">
            <span title="Secret Rare" style={{ color: "#e8c66a" }}>✦{tierCounts.secret}</span>
            <span title="Holo Rare" style={{ color: "#b07aff" }}>★{tierCounts.holo}</span>
            <span title="Rare" style={{ color: "#5ea1e6" }}>◆{tierCounts.rare}</span>
            <span title="Common" style={{ color: "#9aa0ac" }}>●{tierCounts.common}</span>
          </div>
        </div>
      )}

      {/* region title-card */}
      {regionTitle && (
        <div className="proj-3d-region-title" key={regionTitle.label}>
          <span className="proj-3d-region-bar" style={{ background: regionTitle.color }} />
          <span className="proj-3d-region-label">{regionTitle.label}</span>
          <span className="proj-3d-region-count">{regionTitle.count} card{regionTitle.count === 1 ? "" : "s"}</span>
        </div>
      )}

      {/* achievement toast */}
      {toast && <div className="proj-3d-toast">{toast}</div>}

      {/* timeline scrubber */}
      {packOpen && !photo && (
        <div className="proj-3d-timeline">
          <span className="proj-3d-timeline-label">{timeline >= 1 ? "now" : "growing…"}</span>
          <input
            type="range" min={0} max={1} step={0.02} value={timeline}
            onChange={(e) => { const v = +e.target.value; setTimeline(v); timelineRef.current = v; }}
            aria-label="timeline"
          />
        </div>
      )}

      {/* deck builder bar */}
      {deck.length > 0 && !photo && (
        <div className="proj-3d-deck">
          <span className="proj-3d-deck-label">deck {deck.length}/6</span>
          {deck.map((s) => (
            <button key={s} className="proj-3d-deck-card" onClick={() => flyToSlug(s)} onContextMenu={(e) => { e.preventDefault(); toggleDeck(s); }} title={`${nameBySlug(s)} — click fly, right-click remove`}>
              {cardImgRef.current.get(s) ? <img src={cardImgRef.current.get(s)} alt={nameBySlug(s)} /> : <span>{nameBySlug(s)}</span>}
            </button>
          ))}
          <button className="proj-3d-deck-share" onClick={shareDeck}>share ↗</button>
        </div>
      )}

      {/* photo-mode bar */}
      {photo && (
        <div className="proj-3d-photobar">
          <button onClick={screenshot}>capture ⬇</button>
          <button onClick={() => setPhoto(false)}>exit photo</button>
        </div>
      )}

      {/* full-screen card inspector */}
      {inspect && inspectImg && (
        <div className="proj-3d-inspect" onClick={() => setInspect(null)}>
          <div
            className={`proj-3d-inspect-card${inspectBack ? " is-back" : ""}`}
            style={{ transform: `perspective(1200px) rotateX(${inspectTilt.y}deg) rotateY(${inspectTilt.x}deg)` }}
            onClick={(e) => e.stopPropagation()}
            onMouseMove={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setInspectTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 26, y: -((e.clientY - r.top) / r.height - 0.5) * 26 });
            }}
            onMouseLeave={() => setInspectTilt({ x: 0, y: 0 })}
          >
            <img className="proj-3d-inspect-face" src={inspectImg} alt={inspect.name} />
            <div className="proj-3d-inspect-foil" style={{ opacity: Math.min(0.55, (Math.abs(inspectTilt.x) + Math.abs(inspectTilt.y)) / 30) }} />
            {inspectBack && (
              <div className="proj-3d-inspect-backface">
                <h3>{inspect.name}</h3>
                <p>{inspect.tagline}</p>
                {inspect.impact && <p className="proj-3d-inspect-impact">{inspect.impact}</p>}
                <dl>
                  {inspect.language && <><dt>stack</dt><dd>{inspect.language}</dd></>}
                  <dt>commits</dt><dd>{inspect.commits_synced.toLocaleString()}</dd>
                  {!!inspect.stars && <><dt>stars</dt><dd>★ {inspect.stars}</dd></>}
                  {inspect.pushed_at && <><dt>last push</dt><dd>{inspect.pushed_at.slice(0, 10)}</dd></>}
                  <dt>set</dt><dd>{(SET_OF[inspect.slug]?.name) ?? "Promo"}</dd>
                </dl>
              </div>
            )}
          </div>
          <div className="proj-3d-inspect-controls" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setInspectBack((v) => !v)}>{inspectBack ? "front ↺" : "flip ↻"}</button>
            <button onClick={() => sharePull(inspect)}>share ✦</button>
            <button onClick={() => downloadCard(inspect.slug)}>download ↓</button>
            <button onClick={() => setInspect(null)}>close ✕</button>
          </div>
        </div>
      )}

      {/* battle mode */}
      {battle && (() => {
        const [a, b] = battle; const pa = powerOf(a), pb = powerOf(b);
        const winner = pa === pb ? null : pa > pb ? a : b;
        return (
          <div className="proj-3d-battle" onClick={() => setBattle(null)}>
            <div className="proj-3d-battle-stage" onClick={(e) => e.stopPropagation()}>
              {[a, b].map((p, i) => (
                <div key={p.slug} className={`proj-3d-battle-card${winner === p ? " is-win" : ""}${winner && winner !== p ? " is-lose" : ""}`}>
                  {cardImgRef.current.get(p.slug) && <img src={cardImgRef.current.get(p.slug)} alt={p.name} />}
                  <div className="proj-3d-battle-hp">HP {powerOf(p)}</div>
                  {i === 0 && <div className="proj-3d-battle-vs">VS</div>}
                </div>
              ))}
            </div>
            <div className="proj-3d-battle-result" onClick={(e) => e.stopPropagation()}>
              {winner ? <>🏆 <b>{winner.name}</b> wins on power</> : "perfectly matched"}
              <button onClick={() => setBattle(null)}>close ✕</button>
            </div>
          </div>
        );
      })()}

      {/* guess-the-card quiz */}
      {quiz && (
        <div className="proj-3d-quiz" onClick={() => setQuiz(null)}>
          <div className="proj-3d-quiz-box" onClick={(e) => e.stopPropagation()}>
            <div className="proj-3d-quiz-q">which project is this?</div>
            <img className="proj-3d-quiz-art" src={`/og/${quiz.answer.slug}.png`} alt="guess" style={{ filter: quiz.picked ? "none" : "blur(2px) saturate(0.6)" }} />
            <div className="proj-3d-quiz-opts">
              {quiz.options.map((o) => {
                const state = !quiz.picked ? "" : o.slug === quiz.answer.slug ? " is-right" : o.slug === quiz.picked ? " is-wrong" : "";
                return (
                  <button key={o.slug} className={`proj-3d-quiz-opt${state}`}
                    onClick={() => { if (!quiz.picked) { setQuiz({ ...quiz, picked: o.slug }); sfxRef.current?.[o.slug === quiz.answer.slug ? "chime" : "flip"](); } }}>
                    {o.name}
                  </button>
                );
              })}
            </div>
            {quiz.picked && (
              <div className="proj-3d-quiz-after">
                <button onClick={startQuiz}>next ▸</button>
                <button onClick={() => { setQuiz(null); flyToSlug(quiz.answer.slug); }}>visit ↗</button>
                <button onClick={() => setQuiz(null)}>close ✕</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* secret-rare reveal flash */}
      {flash === "secret" && (
        <div className="proj-3d-flash" aria-hidden>
          <div className="proj-3d-flash-rays" />
          <div className="proj-3d-flash-burst" />
          <div className="proj-3d-flash-banner">✦ SECRET RARE</div>
        </div>
      )}

      {/* booster-pack unboxing — the entry ritual */}
      {!packOpen && (
        <div className="proj-3d-pack-overlay">
          <button className="proj-3d-pack" onClick={openPack} aria-label="open booster pack">
            <span className="proj-3d-pack-foil" />
            <span className="proj-3d-pack-emblem">✦</span>
            <span className="proj-3d-pack-title">THE CONSTELLATION</span>
            <span className="proj-3d-pack-sub">{index.projects.length}-card booster</span>
            <span className="proj-3d-pack-cta">tap to open ▸</span>
          </button>
        </div>
      )}

      {/* mini-map — which region of the work you're in ("you are here") */}
      {clusterInfo.length > 0 && (
        <div className="proj-3d-minimap" aria-label="regions of the portfolio">
          <div className="proj-3d-minimap-head">regions</div>
          {clusterInfo.map((c) => {
            const active = c.key === activeClusterKey;
            return (
              <button
                key={c.key}
                className={`proj-3d-minimap-row${active ? " is-active" : ""}`}
                onClick={() => {
                  const entry = journeyOrderRef.current.find((x) => clusterOf.get(x.project.slug) === c.key);
                  if (entry) flyToSlug(entry.project.slug);
                }}
                title={`fly to ${c.label}`}
              >
                <span className="proj-3d-minimap-dot" style={{ background: c.color }} />
                <span className="proj-3d-minimap-label" style={active ? { color: c.color } : undefined}>{c.label}</span>
                <span className="proj-3d-minimap-count">{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* guided-tour banner */}
      {tourPos !== null && tour[tourPos] && (
        <div className="proj-3d-tour">
          <span className="proj-3d-tour-step">tour · {tourPos + 1} / {tour.length}</span>
          <span className="proj-3d-tour-name">{focusedProject?.name ?? tour[tourPos]}</span>
          <div className="proj-3d-tour-actions">
            <button className="proj-3d-tour-btn" onClick={tourNext}>
              {tourPos + 1 >= tour.length ? "done ✓" : "next ▸"}
            </button>
            <button className="proj-3d-tour-btn is-ghost" onClick={() => { setTourPos(null); setFocusedAll(null); }}>exit</button>
          </div>
        </div>
      )}

      {/* live mini-browser — mounts only when the user opens it */}
      {focusedProject && focusedProject.live_url && browserOpen && (
        <div className="proj-3d-browser" key={focusedProject.slug}>
          <div className="proj-3d-browser-bar">
            <span className="proj-3d-browser-dots"><i /><i /><i /></span>
            <span className="proj-3d-browser-url">{liveHost}</span>
            <a className="proj-3d-browser-open" href={focusedProject.live_url} target="_blank" rel="noopener noreferrer">open ↗</a>
            <button className="proj-3d-browser-close" onClick={() => setBrowserOpen(false)} aria-label="close preview">×</button>
          </div>
          <div className="proj-3d-browser-body">
            <iframe
              src={focusedProject.live_url}
              title={focusedProject.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            <div className="proj-3d-browser-fallback">
              site blank? it blocks embedding — <a href={focusedProject.live_url} target="_blank" rel="noopener noreferrer">open in a new tab ↗</a>
            </div>
          </div>
        </div>
      )}

      {/* hover tooltip (overview only) */}
      {hovered && focused === null && (
        <div className="proj-3d-tooltip" style={{ left: mouse.x + 16, top: mouse.y + 16 }}>
          <div className="proj-3d-tooltip-name">{hovered.name}</div>
          <div className="proj-3d-tooltip-tag">{hovered.tagline}</div>
          {hovered.tags && hovered.tags.length > 0 && (
            <div className="proj-3d-tooltip-tags">
              {hovered.tags.map((t) => (
                <span key={t} className="proj-3d-tooltip-chip" style={{ borderColor: index.categories?.[t]?.color, color: index.categories?.[t]?.color }}>
                  {index.categories?.[t]?.label ?? t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* bottom HUD */}
      <div className="proj-3d-hud">
        <button className="proj-3d-hud-btn" onClick={() => setFocusedAll(focused === null ? N - 1 : (focused - 1 + N) % N)} aria-label="previous">← prev</button>

        {focusedProject ? (
          <div className="proj-3d-hud-card">
            <div className="proj-3d-hud-count">{(focused ?? 0) + 1} / {N}</div>
            <div className="proj-3d-hud-name">{focusedProject.name}</div>
            <div className="proj-3d-hud-tag">{focusedProject.tagline}</div>
            {focusedProject.impact && (
              <div className="proj-3d-hud-impact">{focusedProject.impact}</div>
            )}
            {focusedEvo && (
              <div className="proj-3d-evo">
                {focusedEvo.prev && (
                  <button className="proj-3d-evo-link" onClick={() => flyToSlug(focusedEvo.prev!)}>
                    ◂ evolves from {nameOf(focusedEvo.prev)}
                  </button>
                )}
                <span className="proj-3d-evo-stage">{focusedEvo.stage}</span>
                {focusedEvo.next && (
                  <button className="proj-3d-evo-link" onClick={() => flyToSlug(focusedEvo.next!)}>
                    evolves into {nameOf(focusedEvo.next)} ▸
                  </button>
                )}
              </div>
            )}
            <div className="proj-3d-hud-actions">
              {focusedProject.live_url && (
                <button
                  className={`proj-3d-hud-action${browserOpen ? "" : " proj-3d-hud-action--accent"}`}
                  onClick={() => setBrowserOpen((v) => !v)}
                >
                  {browserOpen ? "close preview" : "live preview ▸"}
                </button>
              )}
              <button className="proj-3d-hud-action" onClick={openInspect}>inspect ⛶</button>
              <button className="proj-3d-hud-action" onClick={() => toggleDeck(focusedProject.slug)}>
                {deck.includes(focusedProject.slug) ? "− deck" : "+ deck"}
              </button>
              <button className="proj-3d-hud-action" onClick={() => sharePull(focusedProject)}>share ✦</button>
              <button className="proj-3d-hud-action" onClick={startBattle}>battle ⚔</button>
              {!focusedProject.slug.startsWith("trainer") && (
                <Link to={`/p/${focusedProject.slug}`} className="proj-3d-hud-action">workspace ↗</Link>
              )}
              <button className="proj-3d-hud-action" onClick={() => setFocusedAll(null)}>overview</button>
            </div>
          </div>
        ) : (
          <div className="proj-3d-hud-card proj-3d-hud-card--ghost">
            <div className="proj-3d-hud-count">{N} projects · {clusterInfo.length} regions</div>
            <div className="proj-3d-hud-name">overview</div>
            <div className="proj-3d-hud-tag">press → or click a card to begin — or take the guided tour</div>
            <div className="proj-3d-hud-actions">
              {tour.length > 0 && (
                <button className="proj-3d-hud-action proj-3d-hud-action--accent" onClick={startTour}>
                  take the 2-min tour ▸
                </button>
              )}
              <button className="proj-3d-hud-action" onClick={redeal}>open another pack ↻</button>
              {cardOfDay && (
                <button className="proj-3d-hud-action" onClick={() => flyToSlug(cardOfDay.slug)} title={cardOfDay.name}>
                  card of the day ☼
                </button>
              )}
              <button className="proj-3d-hud-action" onClick={startQuiz}>quiz ?</button>
            </div>
          </div>
        )}

        <button className="proj-3d-hud-btn" onClick={() => setFocusedAll(focused === null ? 0 : (focused + 1) % N)} aria-label="next">next →</button>
      </div>
    </div>
  );
}
