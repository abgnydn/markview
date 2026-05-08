'use client';

/**
 * EmbodiedRig — adds a flyable visitor body to the vault Canvas.
 *
 * v0 scope: F toggles flight (PointerLock); WASD strafes;
 * Space/Shift = up/down; mouselook rotates camera. The visitor
 * humanoid mesh follows 1.6m below the camera so when you look
 * down you see your own body inside your own brain.
 *
 * Mounts inside the existing <Canvas> in vault-orbit.tsx. Toggled
 * via the `embodied` prop driven from VaultExperience.
 *
 * Speech / WS bridge to claude-temple-loop comes in v1.
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface EmbodiedRigProps {
  enabled: boolean;
  /** Movement speed in m/s. Default 8. */
  speed?: number;
  /** Called when pointer-lock acquires/releases (e.g. so the parent
   *  can update HUD copy or disable other interactions). */
  onLockChange?: (locked: boolean) => void;
}

export function EmbodiedRig({
  enabled,
  speed = 8.0,
  onLockChange,
}: EmbodiedRigProps): React.JSX.Element | null {
  const { camera } = useThree();
  const visitorRef = useRef<THREE.Group>(null);
  const lockRef = useRef<{
    lock: () => void;
    unlock: () => void;
    isLocked?: boolean;
  } | null>(null);
  const moveKeys = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // ── Lock + unlock when `enabled` flips ────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try { lockRef.current?.lock(); } catch {}
    }, 50);
    return () => {
      clearTimeout(t);
      try { lockRef.current?.unlock(); } catch {}
    };
  }, [enabled]);

  // ── Keyboard input ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: KeyboardEvent) => {
      // Don't capture WASD when typing in any input/textarea
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement | null)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'w') { e.preventDefault(); moveKeys.current.forward = true; }
      else if (k === 's') { e.preventDefault(); moveKeys.current.back = true; }
      else if (k === 'a') { e.preventDefault(); moveKeys.current.left = true; }
      else if (k === 'd') { e.preventDefault(); moveKeys.current.right = true; }
      else if (k === ' ') { e.preventDefault(); moveKeys.current.up = true; }
      else if (k === 'shift') { e.preventDefault(); moveKeys.current.down = true; }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w') moveKeys.current.forward = false;
      else if (k === 's') moveKeys.current.back = false;
      else if (k === 'a') moveKeys.current.left = false;
      else if (k === 'd') moveKeys.current.right = false;
      else if (k === ' ') moveKeys.current.up = false;
      else if (k === 'shift') moveKeys.current.down = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      // reset key state on disable so stuck-key bugs don't carry over
      for (const k of Object.keys(moveKeys.current) as (keyof typeof moveKeys.current)[]) {
        moveKeys.current[k] = false;
      }
    };
  }, [enabled]);

  // ── Per-frame movement ────────────────────────────────────────
  useFrame((_state, dt) => {
    if (!enabled || !lockRef.current?.isLocked) return;
    const v = speed * dt;
    const mk = moveKeys.current;

    // Forward/right vectors derived from camera quaternion (yaw only —
    // we don't want WASD to drift you upward when you're looking up).
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();

    if (mk.forward) camera.position.addScaledVector(fwd, v);
    if (mk.back)    camera.position.addScaledVector(fwd, -v);
    if (mk.right)   camera.position.addScaledVector(right, v);
    if (mk.left)    camera.position.addScaledVector(right, -v);
    if (mk.up)      camera.position.y += v;
    if (mk.down)    camera.position.y -= v;

    // Visitor body sits 1.6 m below the eyes; faces camera-forward.
    if (visitorRef.current) {
      visitorRef.current.position.set(camera.position.x, camera.position.y - 1.6, camera.position.z);
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      // Visitor faces away from the camera (i.e. forward), so add π
      visitorRef.current.rotation.y = e.y + Math.PI;
    }
  });

  if (!enabled) return null;

  return (
    <>
      <PointerLockControls
        ref={(ctl) => {
          lockRef.current = ctl as never;
        }}
        onLock={() => onLockChange?.(true)}
        onUnlock={() => onLockChange?.(false)}
      />
      <group ref={visitorRef}>
        {/* Torso */}
        <mesh position={[0, 1.05, 0]}>
          <capsuleGeometry args={[0.18, 0.42, 8, 16]} />
          <meshStandardMaterial
            color="#b8c8e8"
            emissive="#88a0d0"
            emissiveIntensity={0.45}
            roughness={0.55}
            metalness={0.32}
          />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.50, 0]}>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshStandardMaterial
            color="#b8c8e8"
            emissive="#88a0d0"
            emissiveIntensity={0.5}
            roughness={0.55}
            metalness={0.32}
          />
        </mesh>

        {/* Glowing visor band */}
        <mesh position={[0, 1.50, 0.08]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.26, 0.05, 0.18]} />
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
          <mesh key={side} position={[side * 0.27, 0.95, 0]} rotation={[0, 0, side * 0.05]}>
            <capsuleGeometry args={[0.05, 0.55, 6, 12]} />
            <meshStandardMaterial color="#b8c8e8" emissive="#88a0d0" emissiveIntensity={0.4} roughness={0.55} metalness={0.32} />
          </mesh>
        ))}

        {/* Legs */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.10, 0.42, 0]}>
            <capsuleGeometry args={[0.07, 0.7, 8, 14]} />
            <meshStandardMaterial color="#1a2030" emissive="#0a0e18" emissiveIntensity={0.4} roughness={0.85} metalness={0.3} />
          </mesh>
        ))}

        {/* Halo (additive sprite) */}
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[1.0, 16, 16]} />
          <meshBasicMaterial
            color="#ffe1a8"
            transparent
            opacity={0.06}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Soft point light following the visitor (so the brain notes
          near the body get a warm rim from the visitor's presence). */}
      <pointLight
        position={[0, camera.position.y - 0.5, 0]}
        intensity={1.4}
        distance={6}
        decay={1.5}
        color="#ffe1a8"
      />
    </>
  );
}
