'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * VisitorBody — ethereal humanoid that floats at a fixed point in the
 * temple. Ported 1:1 from harness-temple.html `makeVisitor()`.
 *
 * Position default: (0, 0, 1.5) facing the face at (0, 1.4, 0). The
 * visitor is an OBJECT in the scene, not a camera-mount — the user
 * orbits around it (when EmbodiedRig is off) or flies past it (when on).
 */
export interface VisitorBodyProps {
  /** Optional callback so parent can read the live world position
   *  (used by the aura particle emitter and bubble anchors). */
  onPositionUpdate?: (worldPos: THREE.Vector3) => void;
  /** Skin / body color override (driven by Claude's edit_body action). */
  color?: string;
  /** Uniform scale multiplier. */
  scale?: number;
  /** Extra emissive intensity stacked on the base. */
  glow?: number;
}

export function VisitorBody({
  onPositionUpdate,
  color = '#b8c8e8',
  scale = 1,
  glow = 0,
}: VisitorBodyProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const haloMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const { scene } = useThree();

  // Sprite halo texture — radial gradient warm → purple → 0.
  const haloTexture = useMemo(() => {
    const c =
      typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!c) return null;
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.0, 'rgba(255, 230, 180, 1)');
    g.addColorStop(0.3, 'rgba(255, 200, 130, 0.55)');
    g.addColorStop(0.7, 'rgba(180, 120, 240, 0.18)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => haloTexture?.dispose(), [haloTexture]);

  // Face the giant face at (0, 1.4, 0) — fixed at mount, no per-frame work.
  useEffect(() => {
    if (groupRef.current) groupRef.current.lookAt(0, 1.4, 0);
  }, [scene]);

  // Subtle breathing bob + sway, halo opacity pulse.
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const targetScale = useRef(1);
  targetScale.current = scale;
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.0) * 0.020;
      groupRef.current.rotation.y = Math.PI + Math.sin(t * 0.4) * 0.04;
      // Animate scale changes toward the target so edit_body lands smoothly.
      const cur = groupRef.current.scale.x;
      const next = cur + (targetScale.current - cur) * Math.min(1, dt * 4);
      groupRef.current.scale.setScalar(next);
      if (onPositionUpdate) {
        groupRef.current.getWorldPosition(tmpVec);
        onPositionUpdate(tmpVec);
      }
    }
    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = 0.3 + 0.07 * Math.sin(t * 0.9) + glow * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 1.5]}>
      {/* Torso */}
      <mesh position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.18, 0.42, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55 + glow * 0.6}
          roughness={0.55}
          metalness={0.32}
        />
      </mesh>
      {/* Trim band on torso */}
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.205, 0.018, 6, 24]} />
        <meshStandardMaterial
          color="#ffe6b0"
          emissive="#ffd58c"
          emissiveIntensity={1.6}
          roughness={0.32}
          metalness={0.7}
        />
      </mesh>
      {/* Chest emblem */}
      <mesh position={[0, 1.1, 0.185]}>
        <circleGeometry args={[0.08, 24]} />
        <meshStandardMaterial
          color="#ffe6b0"
          emissive="#ffd58c"
          emissiveIntensity={1.6}
          roughness={0.32}
          metalness={0.7}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.16, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55 + glow * 0.6}
          roughness={0.55}
          metalness={0.32}
        />
      </mesh>
      {/* Visor — half-torus arc wrapping front of head. */}
      <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.165, 0.02, 6, 32, Math.PI]} />
        <meshStandardMaterial
          color="#ffe7b8"
          emissive="#ffe7b8"
          emissiveIntensity={2.4}
          roughness={0.25}
          metalness={0.7}
        />
      </mesh>
      {/* Arms */}
      {[-1, 1].map((side) => (
        <mesh
          key={`arm-${side}`}
          position={[side * 0.27, 0.95, 0]}
          rotation={[0, 0, side * 0.05]}
        >
          <capsuleGeometry args={[0.05, 0.55, 6, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.55 + glow * 0.6}
            roughness={0.55}
            metalness={0.32}
          />
        </mesh>
      ))}
      {/* Legs */}
      {[-1, 1].map((side) => (
        <mesh key={`leg-${side}`} position={[side * 0.1, 0.42, 0]}>
          <capsuleGeometry args={[0.07, 0.7, 8, 14]} />
          <meshStandardMaterial
            color="#141822"
            emissive="#0a0e18"
            emissiveIntensity={0.5}
            roughness={0.85}
            metalness={0.3}
          />
        </mesh>
      ))}
      {/* Feet */}
      {[-1, 1].map((side) => (
        <mesh key={`foot-${side}`} position={[side * 0.1, 0.05, 0.05]}>
          <boxGeometry args={[0.16, 0.06, 0.3]} />
          <meshStandardMaterial
            color="#141822"
            emissive="#0a0e18"
            emissiveIntensity={0.5}
            roughness={0.85}
            metalness={0.3}
          />
        </mesh>
      ))}
      {/* Halo — radial-gradient sprite, wide and soft. */}
      {haloTexture && (
        <sprite ref={haloRef} position={[0, 1.0, 0]} scale={[2.2, 2.6, 1]}>
          <spriteMaterial
            ref={haloMaterialRef}
            map={haloTexture}
            color="#ffe1a8"
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}
    </group>
  );
}
