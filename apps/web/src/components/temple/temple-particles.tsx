'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeParticleSystem } from './particle-system';

const FACE_RADIUS = 12;
const MOUTH_LOCAL = new THREE.Vector3(0, -0.22 * FACE_RADIUS, 0.4);

interface TempleParticlesProps {
  /** Speech amplitude 0..1; drives mouth burst rate. */
  speech?: number;
  /** Visitor world position — aura particles spawn around here. */
  visitor?: THREE.Vector3;
  /** Where the face lives in world space. Match TempleFace. */
  faceCenter?: [number, number, number];
}

export function TempleParticles({
  speech = 0,
  visitor,
  faceCenter = [0, 8.5, -36],
}: TempleParticlesProps): React.JSX.Element {
  const { scene } = useThree();

  const sys = useMemo(() => {
    const mouth = makeParticleSystem(700);
    const aura = makeParticleSystem(800);
    const burst = makeParticleSystem(600);
    return { mouth, aura, burst };
  }, []);

  // Mount face-local mouth particles + world-space aura/burst.
  useEffect(() => {
    const mouthAnchor = new THREE.Group();
    mouthAnchor.position.set(faceCenter[0], faceCenter[1], faceCenter[2]);
    mouthAnchor.add(sys.mouth.points);
    scene.add(mouthAnchor);
    scene.add(sys.aura.points);
    scene.add(sys.burst.points);
    return () => {
      scene.remove(mouthAnchor);
      scene.remove(sys.aura.points);
      scene.remove(sys.burst.points);
      sys.mouth.dispose();
      sys.aura.dispose();
      sys.burst.dispose();
    };
  }, [scene, sys, faceCenter]);

  const auraTimer = useMemo(() => ({ acc: 0 }), []);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    // Mouth — idle drift always, dense bursts when speech > 0.
    const idleRate = 0.05; // per-frame chance even when silent
    const speechRate = speech * 0.6;
    if (Math.random() < idleRate + speechRate) {
      tmpVec.set(
        MOUTH_LOCAL.x + (Math.random() - 0.5) * 1.3,
        MOUTH_LOCAL.y + (Math.random() - 0.5) * 0.3,
        MOUTH_LOCAL.z + 0.05,
      );
      tmpDir.set(0, 0, 1);
      const hue = 0.07 + Math.random() * 0.05;
      tmpColor.setHSL(hue, 0.85, 0.7);
      sys.mouth.emit({
        origin: tmpVec.clone(),
        direction: tmpDir.clone(),
        speed: 0.4 + Math.random() * (0.5 + speech * 0.6),
        color: tmpColor.clone(),
        size: 1.2 + Math.random() * (0.6 + speech * 0.6),
        lifeSec: 0.9 + speech * 0.5,
        spread: 0.45,
      });
    }

    // Visitor aura — gentle continuous emission of warm dust.
    auraTimer.acc += dt;
    if (auraTimer.acc > 0.18 && visitor) {
      auraTimer.acc = 0;
      tmpVec.set(
        visitor.x + (Math.random() - 0.5) * 0.4,
        visitor.y + 0.5 + Math.random() * 1.2,
        visitor.z + (Math.random() - 0.5) * 0.4,
      );
      tmpDir.set(
        (Math.random() - 0.5) * 0.4,
        0.4 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4,
      ).normalize();
      tmpColor.setHSL(0.1 + Math.random() * 0.05, 0.7, 0.65);
      sys.aura.emit({
        origin: tmpVec.clone(),
        direction: tmpDir.clone(),
        speed: 0.25 + Math.random() * 0.3,
        color: tmpColor.clone(),
        size: 0.9 + Math.random() * 0.5,
        lifeSec: 1.6,
        spread: 0.3,
      });
    }

    sys.mouth.step(dt);
    sys.aura.step(dt);
    sys.burst.step(dt);
  });

  return <></>;
}
