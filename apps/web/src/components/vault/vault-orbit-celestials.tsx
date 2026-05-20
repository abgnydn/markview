'use client';

/**
 * Brain + SunNode — the two centrepiece celestial bodies in the vault orbit.
 *
 * Split out from vault-orbit.tsx to bring that file under control. These
 * components share zero state with the panel/edge rendering pipeline; they're
 * decorative anchors at the centre and at the "sun" position.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

export function Brain({ activeRef }: { activeRef: React.MutableRefObject<boolean> }) {
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

export function SunNode({ setSun }: { setSun: (m: THREE.Mesh | null) => void }) {
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
