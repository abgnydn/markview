'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Html,
  Stars,
  Stats,
  MeshDistortMaterial,
  MeshTransmissionMaterial,
  Environment,
  Lightformer,
  RoundedBox,
} from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  GodRays,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import type { VaultDoc } from './vault-store';
import type { PeerPresence } from './use-vault';
import { buildEdges } from './vault-links';
import type { SemanticEdge } from './vault-tfidf';
import { useSemanticEdges, type SemanticSource } from './use-semantic-edges';
import { EmbodiedRig } from './embodied/embodied-rig';

const TINT_HEX: Record<VaultDoc['tint'], string> = {
  cyan: '#67e8f9',
  violet: '#a78bfa',
  amber: '#fbbf24',
  rose: '#ff7a94', // live claude sessions
};

// -----------------------------------------------------------------------------
// Ring layout — scales orbit to hundreds of docs via LOD.
// Inner ring is the hero (full transmission glass). Middle is a cheaper glass.
// Outer is a flat emissive chip. Beyond the last ring, docs are drawn as tiny
// "galaxy" dots — still clickable, essentially free to render.
// -----------------------------------------------------------------------------

type LOD = 'high' | 'mid' | 'low' | 'dot';

interface RingSpec {
  radius: number;
  tiltFactor: number; // multiplier applied to BASE_TILT
  rotMult: number; // rotation direction/speed relative to time
  maxCount: number;
  lod: LOD;
  panelW: number;
  panelH: number;
}

const BASE_TILT = 0.28;

const RINGS: RingSpec[] = [
  { radius: 3.0,  tiltFactor: 1.0,  rotMult:  1.0,   maxCount: 8,   lod: 'high', panelW: 1.42, panelH: 0.86 },
  { radius: 4.5,  tiltFactor: 0.75, rotMult: -0.65,  maxCount: 16,  lod: 'mid',  panelW: 1.12, panelH: 0.66 },
  { radius: 6.2,  tiltFactor: 0.55, rotMult:  0.42,  maxCount: 24,  lod: 'low',  panelW: 0.82, panelH: 0.48 },
  { radius: 8.4,  tiltFactor: 0.40, rotMult: -0.25,  maxCount: 400, lod: 'dot',  panelW: 0.11, panelH: 0.11 },
];

interface Allocation {
  doc: VaultDoc;
  ringIdx: number;
  indexInRing: number;
  countInRing: number;
}

function allocateDocs(docs: VaultDoc[]): Allocation[] {
  const out: Allocation[] = [];
  let cursor = 0;
  for (let r = 0; r < RINGS.length && cursor < docs.length; r++) {
    const ring = RINGS[r];
    const count = Math.min(ring.maxCount, docs.length - cursor);
    for (let i = 0; i < count; i++) {
      out.push({ doc: docs[cursor + i], ringIdx: r, indexInRing: i, countInRing: count });
    }
    cursor += count;
  }
  return out;
}

function computeRingPosInto(
  out: THREE.Vector3,
  indexInRing: number,
  countInRing: number,
  ringIdx: number,
  rotation: number,
): void {
  const ring = RINGS[ringIdx];
  const tilt = BASE_TILT * ring.tiltFactor;
  const a =
    (indexInRing / Math.max(1, countInRing)) * Math.PI * 2 +
    rotation * ring.rotMult;
  out.set(
    Math.cos(a) * ring.radius,
    -Math.sin(a) * ring.radius * Math.sin(tilt),
    Math.sin(a) * ring.radius * Math.cos(tilt),
  );
}

// -----------------------------------------------------------------------------
// Force-directed Cluster layout.
// Spring-and-Coulomb model: linked docs attract, all docs repel, soft center
// pull keeps things contained. Linear O(N²) repulsion; fine up to ~250 nodes.
// -----------------------------------------------------------------------------

class VaultForceSim {
  positions = new Map<string, THREE.Vector3>();
  velocities = new Map<string, THREE.Vector3>();

  syncDocs(docs: VaultDoc[], allocation: Allocation[]) {
    const ids = new Set(docs.map((d) => d.id));
    const allocMap = new Map(allocation.map((a) => [a.doc.id, a]));
    const tmp = new THREE.Vector3();

    for (const d of docs) {
      if (!this.positions.has(d.id)) {
        const entry = allocMap.get(d.id);
        if (entry) {
          computeRingPosInto(
            tmp,
            entry.indexInRing,
            entry.countInRing,
            entry.ringIdx,
            0,
          );
          tmp.x += (Math.random() - 0.5) * 0.3;
          tmp.y += (Math.random() - 0.5) * 0.3;
          tmp.z += (Math.random() - 0.5) * 0.3;
          this.positions.set(d.id, tmp.clone());
        } else {
          this.positions.set(
            d.id,
            new THREE.Vector3(
              (Math.random() - 0.5) * 6,
              (Math.random() - 0.5) * 3,
              (Math.random() - 0.5) * 6,
            ),
          );
        }
        this.velocities.set(d.id, new THREE.Vector3());
      }
    }
    for (const id of Array.from(this.positions.keys())) {
      if (!ids.has(id)) {
        this.positions.delete(id);
        this.velocities.delete(id);
      }
    }
  }

  step(
    dt: number,
    docs: VaultDoc[],
    edges: Array<[string, string]>,
    semanticEdges: SemanticEdge[] = [],
  ) {
    // Tuned for a vault-scale graph — slow-settling, avoids "exploding nodes"
    // on big graphs.
    const K_REPEL = 0.9;
    const MIN_D2 = 0.35;
    const K_SPRING = 0.06;
    const K_SPRING_SEM = 0.03; // semantic springs are softer
    const REST = 2.2;
    const REST_SEM = 2.8; // and settle farther apart
    const CENTER_K = 0.03;
    const DAMPING = 0.86;
    const MAX_V = 6.0;
    const CAP_DT = Math.min(dt, 0.05); // skip-frame safety

    const ids: string[] = [];
    for (const d of docs) if (this.positions.has(d.id)) ids.push(d.id);
    const N = ids.length;
    if (N === 0) return;

    const fx = new Float32Array(N);
    const fy = new Float32Array(N);
    const fz = new Float32Array(N);
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const pz = new Float32Array(N);
    const indexMap = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const p = this.positions.get(ids[i])!;
      px[i] = p.x;
      py[i] = p.y;
      pz[i] = p.z;
      indexMap.set(ids[i], i);
    }

    // O(N²) repulsion
    for (let i = 0; i < N; i++) {
      const xi = px[i], yi = py[i], zi = pz[i];
      for (let j = i + 1; j < N; j++) {
        const dx = xi - px[j];
        const dy = yi - py[j];
        const dz = zi - pz[j];
        const d2 = Math.max(MIN_D2, dx * dx + dy * dy + dz * dz);
        const inv = 1 / Math.sqrt(d2);
        const k = K_REPEL / d2;
        const ux = dx * inv * k;
        const uy = dy * inv * k;
        const uz = dz * inv * k;
        fx[i] += ux; fy[i] += uy; fz[i] += uz;
        fx[j] -= ux; fy[j] -= uy; fz[j] -= uz;
      }
    }

    // Springs from explicit edges (full strength)
    for (const [a, b] of edges) {
      const ia = indexMap.get(a);
      const ib = indexMap.get(b);
      if (ia === undefined || ib === undefined) continue;
      const dx = px[ib] - px[ia];
      const dy = py[ib] - py[ia];
      const dz = pz[ib] - pz[ia];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const k = (K_SPRING * (dist - REST)) / dist;
      fx[ia] += dx * k; fy[ia] += dy * k; fz[ia] += dz * k;
      fx[ib] -= dx * k; fy[ib] -= dy * k; fz[ib] -= dz * k;
    }

    // Semantic springs (softer, weighted by cosine similarity)
    for (const { a, b, w } of semanticEdges) {
      const ia = indexMap.get(a);
      const ib = indexMap.get(b);
      if (ia === undefined || ib === undefined) continue;
      const dx = px[ib] - px[ia];
      const dy = py[ib] - py[ia];
      const dz = pz[ib] - pz[ia];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const k = (K_SPRING_SEM * w * (dist - REST_SEM)) / dist;
      fx[ia] += dx * k; fy[ia] += dy * k; fz[ia] += dz * k;
      fx[ib] -= dx * k; fy[ib] -= dy * k; fz[ib] -= dz * k;
    }

    // Gentle center attraction + integrate
    for (let i = 0; i < N; i++) {
      const id = ids[i];
      const p = this.positions.get(id)!;
      const v = this.velocities.get(id)!;
      fx[i] -= px[i] * CENTER_K;
      fy[i] -= py[i] * CENTER_K;
      fz[i] -= pz[i] * CENTER_K;

      v.x = (v.x + fx[i] * CAP_DT) * DAMPING;
      v.y = (v.y + fy[i] * CAP_DT) * DAMPING;
      v.z = (v.z + fz[i] * CAP_DT) * DAMPING;

      // Velocity clamp
      const speed2 = v.x * v.x + v.y * v.y + v.z * v.z;
      if (speed2 > MAX_V * MAX_V) {
        const s = MAX_V / Math.sqrt(speed2);
        v.x *= s; v.y *= s; v.z *= s;
      }

      p.x += v.x * CAP_DT;
      p.y += v.y * CAP_DT;
      p.z += v.z * CAP_DT;
    }
  }
}

export type LayoutMode = 'ring' | 'cluster';

// Resolve a doc's current target position given the active layout mode.
function resolveDocPos(
  out: THREE.Vector3,
  docId: string,
  allocByDocId: Map<string, Allocation>,
  layoutMode: LayoutMode,
  sim: VaultForceSim,
  rotation: number,
): boolean {
  if (layoutMode === 'cluster') {
    const p = sim.positions.get(docId);
    if (p) {
      out.copy(p);
      return true;
    }
  }
  const entry = allocByDocId.get(docId);
  if (!entry) return false;
  computeRingPosInto(out, entry.indexInRing, entry.countInRing, entry.ringIdx, rotation);
  return true;
}

// -----------------------------------------------------------------------------
// Brain / Sun / Satellites / CameraRig
// -----------------------------------------------------------------------------

function Brain({ activeRef }: { activeRef: React.MutableRefObject<boolean> }) {
  const wireRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (wireRef.current) {
      wireRef.current.rotation.x = t * 0.08;
      wireRef.current.rotation.y = t * 0.12;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.2;
      coreRef.current.rotation.x = t * 0.14;
      const target = activeRef.current ? 1.12 : 1.0;
      const cur = coreRef.current.scale.x;
      coreRef.current.scale.setScalar(cur + (target - cur) * 0.08);
    }
  });

  return (
    <group>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.3, 2]} />
        <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.14} toneMapped={false} />
      </mesh>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.98, 6]} />
        <MeshDistortMaterial
          color="#061933"
          emissive="#1393b3"
          emissiveIntensity={1.6}
          roughness={0.22}
          metalness={0.45}
          distort={0.42}
          speed={2.6}
        />
      </mesh>
    </group>
  );
}

function SunNode({ setSun }: { setSun: (m: THREE.Mesh | null) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.elapsedTime;
      meshRef.current.rotation.y = -t * 0.3;
      meshRef.current.rotation.z = -t * 0.22;
      meshRef.current.scale.setScalar(0.55);
    }
  });

  return (
    <mesh
      ref={(m) => {
        meshRef.current = m;
        setSun(m);
      }}
    >
      <icosahedronGeometry args={[1, 4]} />
      <MeshDistortMaterial
        color="#dff3fb"
        emissive="#7dd3fc"
        emissiveIntensity={2.2}
        roughness={0.12}
        distort={0.55}
        speed={3.0}
        toneMapped={false}
      />
    </mesh>
  );
}

// -----------------------------------------------------------------------------
// Panel variants — shared shell, LOD-specific body material.
// All three variants wrap the same <group> click/hover pattern so interaction
// stays uniform across rings.
// -----------------------------------------------------------------------------

interface BasePanelProps {
  doc: VaultDoc;
  indexInRing: number;
  countInRing: number;
  ringIdx: number;
  rotationRef: React.MutableRefObject<number>;
  activeId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  allocByDocId: Map<string, Allocation>;
  layoutMode: LayoutMode;
  sim: VaultForceSim;
}

function usePanelTransform(
  groupRef: React.RefObject<THREE.Group | null>,
  docId: string,
  rotationRef: React.MutableRefObject<number>,
  activeId: string | null,
  hoveredId: string | null,
  allocByDocId: Map<string, Allocation>,
  layoutMode: LayoutMode,
  sim: VaultForceSim,
) {
  const scaleRef = useRef(1);
  const target = useMemo(() => new THREE.Vector3(), []);
  const initialized = useRef(false);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const ok = resolveDocPos(
      target,
      docId,
      allocByDocId,
      layoutMode,
      sim,
      rotationRef.current,
    );
    if (!ok) return;

    if (!initialized.current) {
      group.position.copy(target);
      initialized.current = true;
    } else {
      // Lerp toward target for smooth mode transitions.
      group.position.lerp(target, layoutMode === 'cluster' ? 0.12 : 0.22);
    }
    group.lookAt(0, 0, 0);

    const isActive = activeId === docId;
    const isHover = hoveredId === docId;
    const targetScale = isActive ? 1.25 : isHover ? 1.12 : 1.0;
    scaleRef.current += (targetScale - scaleRef.current) * 0.12;
    group.scale.setScalar(scaleRef.current);
  });
}

function useGlowOpacity(
  matRef: React.RefObject<THREE.Material | null>,
  activeId: string | null,
  hoveredId: string | null,
  docId: string,
  activeTarget: number,
  hoverTarget: number,
) {
  useFrame(() => {
    const mat = matRef.current as (THREE.Material & { opacity: number }) | null;
    if (!mat) return;
    const target =
      activeId === docId ? activeTarget : hoveredId === docId ? hoverTarget : 0;
    mat.opacity += (target - mat.opacity) * 0.12;
  });
}

function HighPanel(props: BasePanelProps) {
  const { doc, activeId, hoveredId, onSelect, onHover } = props;
  const groupRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  usePanelTransform(
    groupRef,
    doc.id,
    props.rotationRef,
    activeId,
    hoveredId,
    props.allocByDocId,
    props.layoutMode,
    props.sim,
  );
  useGlowOpacity(glowMatRef, activeId, hoveredId, doc.id, 1.3, 0.55);
  const tint = TINT_HEX[doc.tint];

  return (
    <PanelGroup
      groupRef={groupRef}
      docId={doc.id}
      hitboxW={1.7}
      hitboxH={1.05}
      onSelect={onSelect}
      onHover={onHover}
    >
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[1.35, 0.8]} />
        <meshBasicMaterial ref={glowMatRef} color={tint} transparent opacity={0} toneMapped={false} />
      </mesh>
      <RoundedBox args={[1.42, 0.86, 0.06]} radius={0.05} smoothness={3}>
        <MeshTransmissionMaterial
          samples={2}
          resolution={128}
          thickness={0.28}
          roughness={0.08}
          transmission={1}
          ior={1.26}
          chromaticAberration={0.04}
          distortion={0.06}
          distortionScale={0.3}
          temporalDistortion={0.02}
          color="#e0f7ff"
          anisotropicBlur={0.15}
        />
      </RoundedBox>
      <PanelLabel title={doc.title} tint={tint} fontSize={11} />
    </PanelGroup>
  );
}

function MidPanel(props: BasePanelProps) {
  const { doc, activeId, hoveredId, onSelect, onHover } = props;
  const groupRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  usePanelTransform(
    groupRef,
    doc.id,
    props.rotationRef,
    activeId,
    hoveredId,
    props.allocByDocId,
    props.layoutMode,
    props.sim,
  );
  useGlowOpacity(glowMatRef, activeId, hoveredId, doc.id, 1.1, 0.45);
  const tint = TINT_HEX[doc.tint];

  return (
    <PanelGroup
      groupRef={groupRef}
      docId={doc.id}
      hitboxW={1.4}
      hitboxH={0.85}
      onSelect={onSelect}
      onHover={onHover}
    >
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[1.1, 0.64]} />
        <meshBasicMaterial ref={glowMatRef} color={tint} transparent opacity={0} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[1.12, 0.66]} />
        <meshPhysicalMaterial
          color="#dff3fb"
          transparent
          opacity={0.35}
          transmission={0.9}
          roughness={0.22}
          metalness={0.0}
          thickness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[0.57, 0.585, 32]} />
        <meshBasicMaterial color={tint} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <PanelLabel title={doc.title} tint={tint} fontSize={10} />
    </PanelGroup>
  );
}

function LowPanel(props: BasePanelProps) {
  const { doc, activeId, hoveredId, onSelect, onHover } = props;
  const groupRef = useRef<THREE.Group>(null);
  const emissiveMatRef = useRef<THREE.MeshBasicMaterial>(null);
  usePanelTransform(
    groupRef,
    doc.id,
    props.rotationRef,
    activeId,
    hoveredId,
    props.allocByDocId,
    props.layoutMode,
    props.sim,
  );
  const tint = TINT_HEX[doc.tint];

  useFrame(() => {
    const mat = emissiveMatRef.current;
    if (!mat) return;
    const isActive = activeId === doc.id;
    const isHover = hoveredId === doc.id;
    const target = isActive ? 0.85 : isHover ? 0.45 : 0.22;
    mat.opacity += (target - mat.opacity) * 0.12;
  });

  return (
    <PanelGroup
      groupRef={groupRef}
      docId={doc.id}
      hitboxW={1.05}
      hitboxH={0.62}
      onSelect={onSelect}
      onHover={onHover}
    >
      <mesh>
        <planeGeometry args={[0.82, 0.48]} />
        <meshBasicMaterial
          ref={emissiveMatRef}
          color={tint}
          transparent
          opacity={0.22}
          toneMapped={false}
        />
      </mesh>
      <PanelLabel title={doc.title} tint={tint} fontSize={9} />
    </PanelGroup>
  );
}

function DotPanel(props: BasePanelProps) {
  const { doc, activeId, hoveredId, onSelect, onHover } = props;
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  usePanelTransform(
    groupRef,
    doc.id,
    props.rotationRef,
    activeId,
    hoveredId,
    props.allocByDocId,
    props.layoutMode,
    props.sim,
  );
  const tint = TINT_HEX[doc.tint];

  useFrame(() => {
    const mesh = sphereRef.current;
    if (!mesh) return;
    const isActive = activeId === doc.id;
    const isHover = hoveredId === doc.id;
    const target = isActive ? 2.2 : isHover ? 1.6 : 1.0;
    const cur = mesh.scale.x;
    mesh.scale.setScalar(cur + (target - cur) * 0.15);
  });

  return (
    <PanelGroup
      groupRef={groupRef}
      docId={doc.id}
      hitboxW={0.3}
      hitboxH={0.3}
      onSelect={onSelect}
      onHover={onHover}
    >
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color={tint} toneMapped={false} />
      </mesh>
    </PanelGroup>
  );
}

// Shared group shell — uniform click/hover handling across variants.
function PanelGroup({
  groupRef,
  docId,
  hitboxW,
  hitboxH,
  onSelect,
  onHover,
  children,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  docId: string;
  hitboxW: number;
  hitboxH: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(docId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(docId);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = '';
      }}
    >
      <mesh>
        <planeGeometry args={[hitboxW, hitboxH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {children}
    </group>
  );
}

function PanelLabel({ title, tint, fontSize }: { title: string; tint: string; fontSize: number }) {
  return (
    <Html
      center
      distanceFactor={9}
      transform
      position={[0, 0, 0.06]}
      style={{ pointerEvents: 'none' }}
      zIndexRange={[0, 0]}
    >
      <div
        style={{
          color: 'rgba(240, 250, 255, 0.95)',
          fontSize: `${fontSize}px`,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          padding: '3px 9px',
          borderRadius: '999px',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${tint}55`,
          letterSpacing: '0.03em',
          textShadow: `0 0 10px ${tint}aa`,
          userSelect: 'none',
          boxShadow: `0 0 18px ${tint}22`,
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
    </Html>
  );
}

// -----------------------------------------------------------------------------
// Relation graph — renders [[wikilink]] / [text](other.md) edges as glowing
// line segments between any pair of doc panels (across rings).
// -----------------------------------------------------------------------------

const HIGHLIGHT_TINT_BOOST = 1.0;
const DIM_WHEN_OTHER_HOVERED = 0.22;
const BASE_EDGE_OPACITY = 0.55;

interface RelationGraphProps {
  docs: VaultDoc[];
  allocByDocId: Map<string, Allocation>;
  rotationRef: React.MutableRefObject<number>;
  hoveredId: string | null;
  activeId: string | null;
  layoutMode: LayoutMode;
  sim: VaultForceSim;
}

function RelationGraph({
  docs,
  allocByDocId,
  rotationRef,
  hoveredId,
  activeId,
  layoutMode,
  sim,
}: RelationGraphProps) {
  const edges = useMemo(() => buildEdges(docs), [docs]);

  const docById = useMemo(() => {
    const m = new Map<string, VaultDoc>();
    for (const d of docs) m.set(d.id, d);
    return m;
  }, [docs]);

  const vertexCount = edges.length * 2;
  const positions = useMemo(() => new Float32Array(vertexCount * 3), [vertexCount]);
  const colors = useMemo(() => new Float32Array(vertexCount * 3), [vertexCount]);

  const lineRef = useRef<THREE.LineSegments>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const cA = useMemo(() => new THREE.Color(), []);
  const cB = useMemo(() => new THREE.Color(), []);

  // Rebuild colors whenever edge set or hover/active target changes.
  useEffect(() => {
    const focus = hoveredId ?? activeId ?? null;

    for (let i = 0; i < edges.length; i++) {
      const [aId, bId] = edges[i];
      const aDoc = docById.get(aId);
      const bDoc = docById.get(bId);
      const aHex = aDoc ? TINT_HEX[aDoc.tint] : '#67e8f9';
      const bHex = bDoc ? TINT_HEX[bDoc.tint] : '#67e8f9';
      cA.set(aHex);
      cB.set(bHex);

      // Intensity modulation
      const touchesFocus = focus != null && (aId === focus || bId === focus);
      const mult = focus == null
        ? 1.0
        : touchesFocus
          ? 1.0 + HIGHLIGHT_TINT_BOOST
          : DIM_WHEN_OTHER_HOVERED;

      const base = i * 6;
      colors[base + 0] = cA.r * mult;
      colors[base + 1] = cA.g * mult;
      colors[base + 2] = cA.b * mult;
      colors[base + 3] = cB.r * mult;
      colors[base + 4] = cB.g * mult;
      colors[base + 5] = cB.b * mult;
    }

    if (lineRef.current) {
      const attr = lineRef.current.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
      if (attr) attr.needsUpdate = true;
    }
  }, [edges, docById, hoveredId, activeId, colors, cA, cB]);

  // Update positions every frame so edges follow whichever layout is active.
  useFrame(() => {
    const rotation = rotationRef.current;
    let write = 0;
    for (let i = 0; i < edges.length; i++) {
      const [aId, bId] = edges[i];
      const okA = resolveDocPos(tmpA, aId, allocByDocId, layoutMode, sim, rotation);
      const okB = resolveDocPos(tmpB, bId, allocByDocId, layoutMode, sim, rotation);
      if (!okA || !okB) {
        for (let k = 0; k < 6; k++) positions[write + k] = 0;
        write += 6;
        continue;
      }
      positions[write + 0] = tmpA.x;
      positions[write + 1] = tmpA.y;
      positions[write + 2] = tmpA.z;
      positions[write + 3] = tmpB.x;
      positions[write + 4] = tmpB.y;
      positions[write + 5] = tmpB.z;
      write += 6;
    }
    if (lineRef.current) {
      const attr = lineRef.current.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (attr) attr.needsUpdate = true;
    }
  });

  if (edges.length === 0) return null;

  return (
    <lineSegments
      ref={lineRef}
      // Disable raycasting on the edge layer — otherwise three's default
      // line-threshold (~1 world unit) intercepts clicks near edges and
      // swallows them before they reach the panel meshes.
      raycast={() => null}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={vertexCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={vertexCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        vertexColors
        transparent
        opacity={BASE_EDGE_OPACITY}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

// -----------------------------------------------------------------------------
// Semantic edge layer — dim, monotone lines weighted by cosine similarity.
// No hover highlight (that's reserved for explicit [[wikilinks]]). Raycast
// disabled to stay out of the click path.
// -----------------------------------------------------------------------------

interface SemanticGraphProps {
  edges: SemanticEdge[];
  allocByDocId: Map<string, Allocation>;
  rotationRef: React.MutableRefObject<number>;
  layoutMode: LayoutMode;
  sim: VaultForceSim;
}

function SemanticGraph({
  edges,
  allocByDocId,
  rotationRef,
  layoutMode,
  sim,
}: SemanticGraphProps) {
  const vertexCount = edges.length * 2;
  const positions = useMemo(() => new Float32Array(vertexCount * 3), [vertexCount]);
  const colors = useMemo(() => new Float32Array(vertexCount * 3), [vertexCount]);
  const lineRef = useRef<THREE.LineSegments>(null);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    for (let i = 0; i < edges.length; i++) {
      const w = edges[i].w; // cosine in ~[minSim, 1]
      // Whiter for stronger similarity; top-out brightness at ~0.95
      const v = Math.min(0.95, 0.45 + w * 0.6);
      const base = i * 6;
      colors[base + 0] = v; colors[base + 1] = v; colors[base + 2] = v;
      colors[base + 3] = v; colors[base + 4] = v; colors[base + 5] = v;
    }
    if (lineRef.current) {
      const attr = lineRef.current.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
      if (attr) attr.needsUpdate = true;
    }
  }, [edges, colors]);

  useFrame(() => {
    const rotation = rotationRef.current;
    let write = 0;
    for (let i = 0; i < edges.length; i++) {
      const { a, b } = edges[i];
      const okA = resolveDocPos(tmpA, a, allocByDocId, layoutMode, sim, rotation);
      const okB = resolveDocPos(tmpB, b, allocByDocId, layoutMode, sim, rotation);
      if (!okA || !okB) {
        for (let k = 0; k < 6; k++) positions[write + k] = 0;
        write += 6;
        continue;
      }
      positions[write + 0] = tmpA.x;
      positions[write + 1] = tmpA.y;
      positions[write + 2] = tmpA.z;
      positions[write + 3] = tmpB.x;
      positions[write + 4] = tmpB.y;
      positions[write + 5] = tmpB.z;
      write += 6;
    }
    if (lineRef.current) {
      const attr = lineRef.current.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (attr) attr.needsUpdate = true;
    }
  });

  if (edges.length === 0) return null;

  return (
    <lineSegments ref={lineRef} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={vertexCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={vertexCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

// -----------------------------------------------------------------------------
// Tendril — brain → active doc (any ring).
// -----------------------------------------------------------------------------

const PARTICLE_COUNT = 28;

interface TendrilProps {
  activePosRef: React.MutableRefObject<THREE.Vector3>;
  activeValidRef: React.MutableRefObject<boolean>;
}

function Tendril({ activePosRef, activeValidRef }: TendrilProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const tubeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const offsets = useMemo(
    () => Float32Array.from({ length: PARTICLE_COUNT }, () => Math.random()),
    [],
  );
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  const tmpFrom = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const tmpMid = useMemo(() => new THREE.Vector3(), []);
  const tmpLift = useMemo(() => new THREE.Vector3(0, 0.5, 0), []);
  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ),
    [],
  );
  const lastRebuild = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (!activeValidRef.current) {
      if (tubeMatRef.current) {
        tubeMatRef.current.opacity += (0 - tubeMatRef.current.opacity) * 0.1;
      }
      if (pointsRef.current) {
        const mat = pointsRef.current.material as THREE.PointsMaterial;
        mat.opacity += (0 - mat.opacity) * 0.1;
      }
      return;
    }

    const target = activePosRef.current;
    tmpMid.copy(tmpFrom).add(target).multiplyScalar(0.5).add(tmpLift);
    curve.v0.copy(tmpFrom);
    curve.v1.copy(tmpMid);
    curve.v2.copy(target);

    if (tubeRef.current && t - lastRebuild.current > 0.05) {
      const prev = tubeRef.current.geometry;
      tubeRef.current.geometry = new THREE.TubeGeometry(curve, 20, 0.022, 6, false);
      prev.dispose();
      lastRebuild.current = t;
    }

    if (tubeMatRef.current) {
      const beat = 1 + Math.sin(t * 6) * 0.12;
      tubeMatRef.current.opacity += (0.55 * beat - tubeMatRef.current.opacity) * 0.2;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = (offsets[i] + t * 0.5) % 1;
      const pt = curve.getPoint(p);
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    }
    if (pointsRef.current) {
      const attr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity += (1 - mat.opacity) * 0.12;
    }
  });

  return (
    <group>
      <mesh ref={tubeRef}>
        <tubeGeometry
          args={[
            new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, 0.5, 0),
              new THREE.Vector3(1, 0, 0),
            ),
            20,
            0.022,
            6,
            false,
          ]}
        />
        <meshBasicMaterial
          ref={tubeMatRef}
          color="#67e8f9"
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={PARTICLE_COUNT} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          color="#e0f7ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}

// -----------------------------------------------------------------------------
// Peer satellites (unchanged semantically — tendril recomputed from ring pos).
// -----------------------------------------------------------------------------

interface PeerSatelliteProps {
  peer: PeerPresence;
  orbitIndex: number;
  totalPeers: number;
  allocation: Allocation[];
  rotationRef: React.MutableRefObject<number>;
  peerOrbitRadiusRef: React.MutableRefObject<number>;
}

function PeerSatellite({
  peer,
  orbitIndex,
  totalPeers,
  allocation,
  rotationRef,
  peerOrbitRadiusRef,
}: PeerSatelliteProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const tubeRef = useRef<THREE.Mesh>(null);
  const tubeMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ),
    [],
  );
  const tmpLift = useMemo(() => new THREE.Vector3(0, 0.4, 0), []);
  const tmpTarget = useMemo(() => new THREE.Vector3(), []);
  const lastRebuild = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const peerRadius = peerOrbitRadiusRef.current;
    const peerAngle =
      (orbitIndex / Math.max(1, totalPeers)) * Math.PI * 2 -
      rotationRef.current * 1.6 +
      peer.joinedAt * 0.0000001;
    const px = Math.cos(peerAngle) * peerRadius;
    const py =
      Math.sin(peerAngle) * peerRadius * Math.sin(-BASE_TILT * 0.7) + 0.15;
    const pz = Math.sin(peerAngle) * peerRadius * Math.cos(-BASE_TILT * 0.7);

    if (groupRef.current) groupRef.current.position.set(px, py, pz);
    if (sphereRef.current) {
      const breath = 1 + Math.sin(t * 2.2 + orbitIndex) * 0.1;
      sphereRef.current.scale.setScalar(breath);
    }

    const entry = peer.activeId
      ? allocation.find((a) => a.doc.id === peer.activeId)
      : null;
    if (!entry) {
      if (tubeMatRef.current) {
        tubeMatRef.current.opacity += (0 - tubeMatRef.current.opacity) * 0.1;
      }
      return;
    }

    computeRingPosInto(
      tmpTarget,
      entry.indexInRing,
      entry.countInRing,
      entry.ringIdx,
      rotationRef.current,
    );
    curve.v0.set(px, py, pz);
    curve.v2.copy(tmpTarget);
    curve.v1.copy(curve.v0).add(curve.v2).multiplyScalar(0.5).add(tmpLift);

    if (tubeRef.current && t - lastRebuild.current > 0.08) {
      const prev = tubeRef.current.geometry;
      tubeRef.current.geometry = new THREE.TubeGeometry(curve, 16, 0.012, 5, false);
      prev.dispose();
      lastRebuild.current = t;
    }
    if (tubeMatRef.current) {
      const beat = 1 + Math.sin(t * 5 + orbitIndex) * 0.2;
      tubeMatRef.current.opacity += (0.45 * beat - tubeMatRef.current.opacity) * 0.15;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        <mesh ref={sphereRef}>
          <sphereGeometry args={[0.08, 18, 18]} />
          <meshBasicMaterial color={peer.color} toneMapped={false} />
        </mesh>
        <Html
          center
          distanceFactor={11}
          transform
          position={[0, 0.18, 0]}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[0, 0]}
        >
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              color: peer.color,
              letterSpacing: '0.05em',
              textShadow: `0 0 8px ${peer.color}aa`,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              opacity: 0.92,
            }}
          >
            {peer.name}
          </div>
        </Html>
      </group>

      <mesh ref={tubeRef}>
        <tubeGeometry
          args={[
            new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(),
              new THREE.Vector3(0, 0.3, 0),
              new THREE.Vector3(1, 0, 0),
            ),
            16,
            0.012,
            5,
            false,
          ]}
        />
        <meshBasicMaterial
          ref={tubeMatRef}
          color={peer.color}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// -----------------------------------------------------------------------------
// Camera
// -----------------------------------------------------------------------------

function CameraRig({ docCount }: { docCount: number }) {
  const { camera } = useThree();
  const tmp = useRef(new THREE.Vector3());
  const base = useMemo<[number, number, number]>(() => {
    if (docCount > 48) return [0, 2.6, 14];
    if (docCount > 24) return [0, 2.2, 11];
    if (docCount > 8) return [0, 1.9, 9];
    return [0, 1.6, 7.5];
  }, [docCount]);

  useFrame(({ mouse, clock }) => {
    const [bx, by, bz] = base;
    tmp.current.set(
      bx + mouse.x * 0.6,
      by + mouse.y * 0.35 + Math.sin(clock.elapsedTime * 0.3) * 0.08,
      bz + Math.cos(clock.elapsedTime * 0.22) * 0.12,
    );
    camera.position.lerp(tmp.current, 0.06);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// -----------------------------------------------------------------------------
// Scene
// -----------------------------------------------------------------------------

interface SceneProps {
  docs: VaultDoc[];
  activeId: string | null;
  peers: PeerPresence[];
  showGraph: boolean;
  showSemantic: boolean;
  layoutMode: LayoutMode;
  onSelect: (id: string) => void;
  setSun: (m: THREE.Mesh | null) => void;
  onSemanticStatus?: (source: SemanticSource, progress: number) => void;
}

function Scene({
  docs,
  activeId,
  peers,
  showGraph,
  showSemantic,
  layoutMode,
  onSelect,
  setSun,
  onSemanticStatus,
}: SceneProps) {
  const allocation = useMemo(() => allocateDocs(docs), [docs]);
  const allocByDocId = useMemo(
    () => new Map(allocation.map((a) => [a.doc.id, a])),
    [allocation],
  );
  const edges = useMemo(() => buildEdges(docs), [docs]);
  const {
    edges: semanticEdges,
    source: semanticSource,
    progress: semanticProgress,
  } = useSemanticEdges(docs, showSemantic);

  useEffect(() => {
    onSemanticStatus?.(semanticSource, semanticProgress);
  }, [onSemanticStatus, semanticSource, semanticProgress]);

  const simRef = useRef(new VaultForceSim());

  const rotationRef = useRef(0);
  const activeRef = useRef(false);
  const activePosRef = useRef(new THREE.Vector3());
  const activeValidRef = useRef(false);
  const peerOrbitRadiusRef = useRef(1.7);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Keep sim's node set in sync with the doc set.
  useEffect(() => {
    simRef.current.syncDocs(docs, allocation);
  }, [docs, allocation]);

  useFrame((_, delta) => {
    rotationRef.current += delta * 0.12;

    if (layoutMode === 'cluster') {
      simRef.current.step(delta, docs, edges, semanticEdges);
    }

    // Peer orbit radius adapts to the populated inner ring (or a sensible min).
    const peerTarget = Math.max(1.6, RINGS[0].radius - 1.3);
    peerOrbitRadiusRef.current += (peerTarget - peerOrbitRadiusRef.current) * 0.08;

    // Track active-doc position for tendril (works in either layout mode).
    if (activeId) {
      const ok = resolveDocPos(
        activePosRef.current,
        activeId,
        allocByDocId,
        layoutMode,
        simRef.current,
        rotationRef.current,
      );
      activeValidRef.current = ok;
      activeRef.current = ok;
    } else {
      activeValidRef.current = false;
      activeRef.current = false;
    }
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 0, 0]} intensity={4.5} color="#22d3ee" distance={11} decay={1.6} />
      <pointLight position={[5, 3, 4]} intensity={0.65} color="#a78bfa" />
      <pointLight position={[-5, -2, -3]} intensity={0.45} color="#fbbf24" />

      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.9} color="#22d3ee" position={[0, 3, 2]} scale={[6, 3, 1]} />
        <Lightformer intensity={1.3} color="#a78bfa" position={[-4, 1, -2]} scale={[4, 4, 1]} />
        <Lightformer intensity={1.2} color="#fbbf24" position={[4, -1, 2]} scale={[4, 4, 1]} />
        <Lightformer intensity={0.7} color="#ffffff" position={[0, -4, 0]} scale={[8, 2, 1]} />
      </Environment>

      <Brain activeRef={activeRef} />
      <SunNode setSun={setSun} />

      {allocation.map((entry) => {
        const common: BasePanelProps = {
          doc: entry.doc,
          indexInRing: entry.indexInRing,
          countInRing: entry.countInRing,
          ringIdx: entry.ringIdx,
          rotationRef,
          activeId,
          hoveredId,
          onSelect,
          onHover: setHoveredId,
          allocByDocId,
          layoutMode,
          sim: simRef.current,
        };
        const lod = RINGS[entry.ringIdx].lod;
        if (lod === 'high') return <HighPanel key={entry.doc.id} {...common} />;
        if (lod === 'mid') return <MidPanel key={entry.doc.id} {...common} />;
        if (lod === 'low') return <LowPanel key={entry.doc.id} {...common} />;
        return <DotPanel key={entry.doc.id} {...common} />;
      })}

      {showGraph && (
        <RelationGraph
          docs={docs}
          allocByDocId={allocByDocId}
          rotationRef={rotationRef}
          hoveredId={hoveredId}
          activeId={activeId}
          layoutMode={layoutMode}
          sim={simRef.current}
        />
      )}

      {showGraph && showSemantic && (
        <SemanticGraph
          edges={semanticEdges}
          allocByDocId={allocByDocId}
          rotationRef={rotationRef}
          layoutMode={layoutMode}
          sim={simRef.current}
        />
      )}

      <Tendril activePosRef={activePosRef} activeValidRef={activeValidRef} />

      {peers.map((peer, i) => (
        <PeerSatellite
          key={peer.clientId}
          peer={peer}
          orbitIndex={i}
          totalPeers={peers.length}
          allocation={allocation}
          rotationRef={rotationRef}
          peerOrbitRadiusRef={peerOrbitRadiusRef}
        />
      ))}

      <CameraRig docCount={docs.length} />
    </>
  );
}

// -----------------------------------------------------------------------------
// Canvas wrapper
// -----------------------------------------------------------------------------

interface VaultOrbitProps {
  docs: VaultDoc[];
  activeId: string | null;
  peers: PeerPresence[];
  onSelect: (id: string) => void;
  showStats?: boolean;
  showGraph?: boolean;
  showSemantic?: boolean;
  layoutMode?: LayoutMode;
  onSemanticStatus?: (source: SemanticSource, progress: number) => void;
  /** When true, mounts the EmbodiedRig: visitor body + flight controls.
   *  See embodied/embodied-rig.tsx. F-key toggle lives in VaultExperience. */
  embodied?: boolean;
  /** Notified when pointer-lock acquires/releases (for HUD copy). */
  onEmbodiedLockChange?: (locked: boolean) => void;
}

export function VaultOrbit({
  docs,
  activeId,
  peers,
  onSelect,
  showStats = false,
  showGraph = true,
  showSemantic = false,
  layoutMode = 'ring',
  onSemanticStatus,
  embodied = false,
  onEmbodiedLockChange,
}: VaultOrbitProps) {
  const [sun, setSun] = useState<THREE.Mesh | null>(null);

  return (
    <Canvas
      camera={{ position: [0, 1.6, 7.5], fov: 50 }}
      dpr={[1, 1.4]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{
        width: '100%',
        height: '100%',
        background:
          'radial-gradient(ellipse at 50% 42%, rgba(34, 211, 238, 0.10) 0%, rgba(15, 23, 42, 0.55) 50%, rgba(2, 6, 23, 1) 100%)',
      }}
    >
      <Stars radius={110} depth={45} count={320} factor={2.4} fade speed={0.3} />
      <Scene
        docs={docs}
        activeId={activeId}
        peers={peers}
        showGraph={showGraph}
        showSemantic={showSemantic}
        layoutMode={layoutMode}
        onSelect={onSelect}
        setSun={setSun}
        onSemanticStatus={onSemanticStatus}
      />
      <EmbodiedRig enabled={embodied} onLockChange={onEmbodiedLockChange} />

      <EffectComposer multisampling={0} enableNormalPass={false}>
        {sun ? (
          <GodRays
            sun={sun}
            samples={30}
            density={0.94}
            decay={0.92}
            weight={0.26}
            exposure={0.19}
            clampMax={0.85}
            blur
            kernelSize={KernelSize.SMALL}
            blendFunction={BlendFunction.SCREEN}
          />
        ) : (
          <></>
        )}
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.24}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.7}
        />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>

      {showStats && <Stats />}
    </Canvas>
  );
}
