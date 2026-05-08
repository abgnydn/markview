'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Glowing platform under the visitor — translucent disc with a ringed
 * edge that pulses, plus a rim light underneath. Mirrors the dais the
 * visitor stands on in the reference image.
 */
export interface TempleDaisProps {
  /** World-space position of the dais top. The visitor's feet sit
   *  here. */
  position?: [number, number, number];
  /** Outer disc radius. */
  radius?: number;
}

export function TempleDais({
  position = [0, 0, 1.5],
  radius = 1.6,
}: TempleDaisProps): React.JSX.Element {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.MeshBasicMaterial>(null);

  const grad = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.0, 'rgba(255, 230, 180, 1)');
    g.addColorStop(0.4, 'rgba(180, 130, 255, 0.65)');
    g.addColorStop(0.85, 'rgba(60, 30, 120, 0.18)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (innerRef.current) {
      innerRef.current.opacity = 0.32 + 0.08 * Math.sin(t * 0.7);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.18;
    }
    if (haloRef.current) {
      haloRef.current.opacity = 0.55 + 0.18 * Math.sin(t * 0.55);
    }
  });

  return (
    <group position={position}>
      {/* Glow halo on the floor — radial gradient sprite, lays flat. */}
      {grad && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[radius * 4.2, radius * 4.2]} />
          <meshBasicMaterial
            ref={haloRef}
            map={grad}
            color="#ffe7c0"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* Solid disc top — translucent so the glow underneath bleeds through. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial
          ref={innerRef}
          color="#a07adf"
          transparent
          opacity={0.32}
          depthWrite={false}
          toneMapped={true}
        />
      </mesh>
      {/* Rim ring — slowly rotates, with three thinner arcs for the
          ornate carved look. */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[radius * 0.92, radius * 1.02, 96, 1]} />
        <meshBasicMaterial
          color="#ffe7c0"
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[radius * 0.78, radius * 0.82, 96, 1]} />
        <meshBasicMaterial
          color="#88aaff"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[radius * 0.55, radius * 0.58, 96, 1]} />
        <meshBasicMaterial
          color="#ffd58c"
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
