'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarTier {
  count: number;
  innerR: number;
  outerR: number;
  sizeMin: number;
  sizeMax: number;
  color: number;
}

const TIERS: StarTier[] = [
  { count: 1400, innerR: 60,  outerR: 180, sizeMin: 0.7, sizeMax: 2.4, color: 0xffffff },
  { count: 3200, innerR: 180, outerR: 380, sizeMin: 0.5, sizeMax: 1.6, color: 0xeef0ff },
  { count: 4500, innerR: 380, outerR: 700, sizeMin: 0.4, sizeMax: 1.0, color: 0xc8d0ff },
];

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uTime, uIntensity;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aPhase);
    vAlpha = uIntensity * twinkle;
    gl_PointSize = aSize * (320.0 / max(-mv.z, 1.0)) * twinkle;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    float spike = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 1.4) * 0.30;
    spike     += max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 1.4) * 0.30;
    gl_FragColor = vec4(vColor * (a + spike), (a + spike * 0.6) * vAlpha);
  }
`;

function buildStarTier(tier: StarTier): THREE.BufferGeometry {
  const { count, innerR, outerR, sizeMin, sizeMax, color } = tier;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sz = new Float32Array(count);
  const ph = new Float32Array(count);
  const c0 = new THREE.Color(color);
  const blueTint = new THREE.Color(0xb0d8ff);
  const goldTint = new THREE.Color(0xffd6a0);
  const redTint = new THREE.Color(0xffaaaa);
  const cc = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = Math.random(), v = Math.random();
    const theta = u * 2 * Math.PI;
    const phi = Math.acos(2 * v - 1);
    const r = innerR + Math.random() * (outerR - innerR);
    pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    cc.copy(c0);
    const tint = Math.random();
    if (tint < 0.20) cc.lerp(blueTint, 0.6);
    else if (tint < 0.40) cc.lerp(goldTint, 0.5);
    else if (tint < 0.50) cc.lerp(redTint, 0.3);
    col[i * 3 + 0] = cc.r;
    col[i * 3 + 1] = cc.g;
    col[i * 3 + 2] = cc.b;
    sz[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
    ph[i] = Math.random() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  return g;
}

interface TierPointsProps {
  tier: StarTier;
}

interface TierPointsRotationProps extends TierPointsProps {
  /** Y-axis rotation rate (rad/s). Far stars rotate slower than near. */
  rotateRate: number;
}

function TierPoints({ tier, rotateRate }: TierPointsRotationProps): React.JSX.Element {
  const geometry = useMemo(() => buildStarTier(tier), [tier]);
  const ref = useRef<THREE.Points>(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.95 },
    }),
    [],
  );
  useFrame((state, dt) => {
    uniforms.uTime.value += dt;
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * rotateRate;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms as unknown as Record<string, THREE.IUniform>}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Far stars rotate slower than mid; near are static so visitor parallax
// reads (matches harness frame loop).
const ROTATE_RATES = [0, 0.008, 0.005];

export function TempleStars(): React.JSX.Element {
  return (
    <>
      {TIERS.map((tier, i) => (
        <TierPoints key={i} tier={tier} rotateRate={ROTATE_RATES[i] ?? 0} />
      ))}
    </>
  );
}
