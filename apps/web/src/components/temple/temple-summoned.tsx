'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface SummonedObject {
  id: string;
  obj: 'orb' | 'crystal' | 'rune';
  color: string;
  /** World-space position the object floats around. */
  anchor: [number, number, number];
  /** Index within the burst — used as a phase offset for orbiting. */
  index: number;
  /** When set, the object circles the visitor at this radius. */
  orbitRadius?: number;
  /** Spawn timestamp (ms) for scale-in animation. */
  spawnAt: number;
}

interface OneObjectProps {
  o: SummonedObject;
}

function OneObject({ o }: OneObjectProps): React.JSX.Element {
  const ref = useRef<THREE.Group>(null);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const age = (performance.now() - o.spawnAt) / 1000;
    // Scale-in over ~0.6s with cubic-out.
    const k = Math.min(1, age / 0.6);
    const scale = 0.001 + (1 - 0.001) * (1 - Math.pow(1 - k, 3));
    ref.current.scale.setScalar(scale);

    if (o.orbitRadius && o.orbitRadius > 0) {
      const phase = (o.index % 5) * (Math.PI * 2 / 5);
      const angle = t * 0.6 + phase;
      tmpV.set(
        o.anchor[0] + Math.cos(angle) * o.orbitRadius,
        o.anchor[1] + 1.2 + Math.sin(t * 1.4 + phase) * 0.18,
        o.anchor[2] + Math.sin(angle) * o.orbitRadius,
      );
      ref.current.position.copy(tmpV);
    } else {
      ref.current.position.set(
        o.anchor[0] + ((o.index % 3) - 1) * 0.5,
        o.anchor[1] + 1.4 + Math.sin(t * 1.1 + o.index) * 0.08,
        o.anchor[2] + (Math.floor(o.index / 3) - 1) * 0.5,
      );
    }

    // Spin on local axis for crystals/runes; gentle bob-rotation for orbs.
    if (o.obj === 'crystal') {
      ref.current.rotation.y = t * 1.2 + o.index;
      ref.current.rotation.x = Math.sin(t * 0.6 + o.index) * 0.2;
    } else if (o.obj === 'rune') {
      ref.current.rotation.z = t * 0.7 + o.index;
    } else {
      ref.current.rotation.y = t * 0.3 + o.index;
    }
  });

  // Geometry per kind.
  const geometry = (() => {
    if (o.obj === 'crystal')
      return <octahedronGeometry args={[0.18, 0]} />;
    if (o.obj === 'rune')
      return <torusGeometry args={[0.15, 0.045, 12, 24]} />;
    return <sphereGeometry args={[0.13, 24, 24]} />;
  })();

  return (
    <group ref={ref}>
      <mesh>
        {geometry}
        <meshStandardMaterial
          color={o.color}
          emissive={o.color}
          emissiveIntensity={1.6}
          roughness={0.3}
          metalness={0.65}
          toneMapped={false}
        />
      </mesh>
      {/* Soft additive halo so it blooms. */}
      <mesh>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshBasicMaterial
          color={o.color}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function TempleSummoned({ objects }: { objects: SummonedObject[] }): React.JSX.Element {
  return (
    <>
      {objects.map((o) => (
        <OneObject key={o.id} o={o} />
      ))}
    </>
  );
}
