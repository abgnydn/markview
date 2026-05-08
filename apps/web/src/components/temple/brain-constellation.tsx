'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchBrainDocs } from '@/lib/brain-hub-client';
import type { VaultDoc } from '@/components/vault/vault-store';
import { buildEdges } from '@/components/vault/vault-links';

const TINT_HEX: Record<VaultDoc['tint'], string> = {
  cyan: '#67e8f9',
  violet: '#a78bfa',
  amber: '#fbbf24',
  rose: '#ff7a94',
};

interface PlacedDoc {
  doc: VaultDoc;
  collapsed: THREE.Vector3;
  expanded: THREE.Vector3;
  color: THREE.Color;
}

export interface BrainConstellationProps {
  /** When true, the constellation expands into a graph orbit around the
   *  visitor with wikilink edges drawn. When false, it sits as a small
   *  cloud at the face's head. Toggled by the visitor pressing B. */
  expanded: boolean;
  /** World-space anchor of the face (head). Match TempleFace. */
  faceHeadAnchor?: [number, number, number];
  /** World-space visitor anchor. Match VisitorBody. */
  visitorAnchor?: [number, number, number];
  /** Called once docs load (or fail) so the HUD can show a count. */
  onLoaded?: (count: number, error: string | null) => void;
  /** Called when visitor clicks a doc node. */
  onSelect?: (doc: VaultDoc) => void;
}

const COLLAPSED_RADIUS = 1.5;   // tight cloud near head
const EXPANDED_RADIUS = 18;     // big orbit around visitor

export function BrainConstellation({
  expanded,
  faceHeadAnchor = [0, 19, -36],
  visitorAnchor = [0, 1.6, 1.5],
  onLoaded,
  onSelect,
}: BrainConstellationProps): React.JSX.Element {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const blendRef = useRef(0); // 0 = collapsed, 1 = expanded
  const sphereRefs = useRef(new Map<string, THREE.Mesh>());

  useEffect(() => {
    const ac = new AbortController();
    fetchBrainDocs(ac.signal)
      .then((d) => {
        setDocs(d);
        onLoaded?.(d.length, null);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        onLoaded?.(0, e instanceof Error ? e.message : String(e));
      });
    return () => ac.abort();
  }, [onLoaded]);

  // Two layouts in face-local & world coords. We store BOTH on each
  // doc and lerp between them per-frame based on `expanded`.
  const placed = useMemo<PlacedDoc[]>(() => {
    const out: PlacedDoc[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    const n = docs.length;
    for (let i = 0; i < n; i++) {
      // Collapsed: tight Fibonacci cloud at face head, suggesting "her thoughts."
      const yC = 1 - (i / Math.max(1, n - 1)) * 2;
      const rC = Math.sqrt(1 - yC * yC);
      const thetaC = phi * i;
      const collapsed = new THREE.Vector3(
        faceHeadAnchor[0] + Math.cos(thetaC) * rC * COLLAPSED_RADIUS,
        faceHeadAnchor[1] + yC * COLLAPSED_RADIUS * 0.7,
        faceHeadAnchor[2] + Math.sin(thetaC) * rC * COLLAPSED_RADIUS * 0.5,
      );

      // Expanded: bigger Fibonacci sphere around the visitor — same
      // mapping the vault uses, so users feel "their brain in 3D."
      const yE = 1 - (i / Math.max(1, n - 1)) * 2;
      const rE = Math.sqrt(1 - yE * yE);
      const thetaE = phi * i;
      const expandedPos = new THREE.Vector3(
        visitorAnchor[0] + Math.cos(thetaE) * rE * EXPANDED_RADIUS,
        visitorAnchor[1] + yE * EXPANDED_RADIUS * 0.55 + 4,
        visitorAnchor[2] + Math.sin(thetaE) * rE * EXPANDED_RADIUS * 0.7 - 6,
      );

      const color = new THREE.Color(TINT_HEX[docs[i].tint] ?? '#67e8f9');
      out.push({ doc: docs[i], collapsed, expanded: expandedPos, color });
    }
    return out;
  }, [docs, faceHeadAnchor, visitorAnchor]);

  // Edge geometry — build once when docs change. We render a static
  // segments object whose vertex positions we rewrite per frame so
  // wires follow the lerping nodes.
  const edges = useMemo(() => buildEdges(docs), [docs]);
  const edgeIndexById = useMemo(() => {
    const m = new Map<string, number>();
    placed.forEach((p, i) => m.set(p.doc.id, i));
    return m;
  }, [placed]);

  const lineGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // 2 vertices × 3 floats per edge.
    const positions = new Float32Array(edges.length * 6);
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [edges.length]);

  useEffect(() => () => lineGeometry.dispose(), [lineGeometry]);

  // Lerp blend toward target each frame; rewrite node positions and
  // edge endpoints from the same source-of-truth.
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    const target = expanded ? 1 : 0;
    blendRef.current += (target - blendRef.current) * Math.min(1, dt * 3.5);
    const k = blendRef.current;

    // Update sphere positions.
    for (const p of placed) {
      const m = sphereRefs.current.get(p.doc.id);
      if (!m) continue;
      tmpVec.copy(p.collapsed).lerp(p.expanded, k);
      m.position.copy(tmpVec);
    }

    // Update edge endpoints (only when expanded enough to matter).
    if (k > 0.05 && lineGeometry.attributes.position) {
      const arr = lineGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i];
        const ia = edgeIndexById.get(a);
        const ib = edgeIndexById.get(b);
        if (ia === undefined || ib === undefined) continue;
        const pa = placed[ia];
        const pb = placed[ib];
        tmpVec.copy(pa.collapsed).lerp(pa.expanded, k);
        arr[i * 6 + 0] = tmpVec.x; arr[i * 6 + 1] = tmpVec.y; arr[i * 6 + 2] = tmpVec.z;
        tmpVec.copy(pb.collapsed).lerp(pb.expanded, k);
        arr[i * 6 + 3] = tmpVec.x; arr[i * 6 + 4] = tmpVec.y; arr[i * 6 + 5] = tmpVec.z;
      }
      lineGeometry.attributes.position.needsUpdate = true;
    }

    // Slow rotation when expanded for that "graph drifting" feel.
    if (groupRef.current && k > 0.1) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.012 * k;
    } else if (groupRef.current) {
      groupRef.current.rotation.y *= 0.98;
    }

    // Edge opacity rides the blend so wires fade in only as we expand.
    if (linesRef.current) {
      const mat = linesRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.18 * k;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Edges — drawn first so node spheres render on top. */}
      {edges.length > 0 && (
        <lineSegments ref={linesRef} geometry={lineGeometry}>
          <lineBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}
      {placed.map(({ doc, collapsed, color }) => (
        <mesh
          key={doc.id}
          ref={(m) => {
            if (m) sphereRefs.current.set(doc.id, m);
            else sphereRefs.current.delete(doc.id);
          }}
          position={collapsed}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(doc);
          }}
        >
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
