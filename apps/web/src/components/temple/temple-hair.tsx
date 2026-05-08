'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Hair / crown ornaments — galaxy spirals attached around the upper
 * head, like the nebula-hair the reference image painted onto her
 * scalp. Each spiral has its own scale, color and spin direction so
 * the cluster reads as a flowing crown of galaxies, not a tidy ring.
 */

interface OrnamentSpec {
  /** Face-local position. */
  pos: [number, number, number];
  /** World radius of the spiral. */
  radius: number;
  spinDir: number;
  arms: number;
  twist: number;
  /** HSL hue 0..1 — gives each spiral its own tint. */
  hue: number;
}

const ORNAMENTS: OrnamentSpec[] = [
  // Crown ring across the top of the head, plus two larger ones flanking
  // the forehead. Positions are relative to face-local mesh coords —
  // forehead ~y=8, sides ~x=±7, crown wraps slightly back (z=2..5).
  { pos: [-6.5, 7.5, 4.0], radius: 2.4, spinDir: 1, arms: 3, twist: 5.5, hue: 0.78 }, // left temple
  { pos: [-3.0, 9.5, 3.5], radius: 1.6, spinDir: -1, arms: 4, twist: 4.8, hue: 0.62 },
  { pos: [0.0, 10.5, 3.2], radius: 1.4, spinDir: 1, arms: 3, twist: 5.2, hue: 0.85 }, // crown
  { pos: [3.0, 9.5, 3.5], radius: 1.6, spinDir: 1, arms: 4, twist: 4.8, hue: 0.55 },
  { pos: [6.5, 7.5, 4.0], radius: 2.4, spinDir: -1, arms: 3, twist: 5.5, hue: 0.92 }, // right temple
  // Two smaller back ornaments — only visible when orbiting around.
  { pos: [-5.0, 5.5, 0.0], radius: 1.4, spinDir: -1, arms: 3, twist: 5.0, hue: 0.50 },
  { pos: [5.0, 5.5, 0.0], radius: 1.4, spinDir: 1, arms: 3, twist: 5.0, hue: 0.95 },
];

interface GalaxyUniforms {
  uTime: { value: number };
  uIntensity: { value: number };
  uSpinDir: { value: number };
}

const GALAXY_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aR;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vR;
  uniform float uTime, uIntensity, uSpinDir;
  void main() {
    vColor = aColor;
    vR = aR;
    float omega = uSpinDir * mix(0.40, 0.10, smoothstep(0.0, 1.0, aR));
    float ang = uTime * omega;
    mat3 R = mat3(cos(ang), -sin(ang), 0.0,
                  sin(ang),  cos(ang), 0.0,
                  0.0,       0.0,      1.0);
    vec3 p = R * position;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.2 + aPhase);
    vAlpha = uIntensity * twinkle;
    gl_PointSize = aSize * (220.0 / max(-mv.z, 1.0)) * (0.7 + (1.0 - aR) * 0.6);
  }
`;

const GALAXY_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vR;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    float spike = (1.0 - vR) * (max(0.0, 1.0 - abs(c.x) * 18.0) + max(0.0, 1.0 - abs(c.y) * 18.0));
    gl_FragColor = vec4(vColor * (a + spike * 0.5), (a + spike * 0.4) * vAlpha);
  }
`;

function buildGalaxyGeometry(opts: OrnamentSpec, n: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  const r01 = new Float32Array(n);
  const ph = new Float32Array(n);
  const tmpC = new THREE.Color();
  const baseColor = new THREE.Color().setHSL(opts.hue, 0.65, 0.65);
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 1.5) * opts.radius;
    const arm = Math.floor(Math.random() * opts.arms);
    const baseAng = (arm / opts.arms) * Math.PI * 2;
    const ang = baseAng + r * opts.twist + (Math.random() - 0.5) * 0.5;
    pos[i * 3 + 0] = r * Math.cos(ang);
    pos[i * 3 + 1] = r * Math.sin(ang);
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
    const t = r / opts.radius;
    if (t < 0.12) tmpC.setRGB(1.0, 0.95, 0.85);
    else if (t < 0.4) tmpC.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.4);
    else tmpC.copy(baseColor);
    if (Math.random() < 0.10) tmpC.setRGB(1.0, 0.7, 0.5);
    col[i * 3 + 0] = tmpC.r;
    col[i * 3 + 1] = tmpC.g;
    col[i * 3 + 2] = tmpC.b;
    sz[i] = (1 - t) * 1.1 + 0.4;
    r01[i] = t;
    ph[i] = Math.random() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aR', new THREE.BufferAttribute(r01, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  return g;
}

interface OrnamentProps {
  spec: OrnamentSpec;
  pointCount?: number;
}

function HairOrnament({ spec, pointCount = 700 }: OrnamentProps): React.JSX.Element {
  const geometry = useMemo(() => buildGalaxyGeometry(spec, pointCount), [spec, pointCount]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo<GalaxyUniforms>(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.7 },
      uSpinDir: { value: spec.spinDir },
    }),
    [spec.spinDir],
  );
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });
  return (
    <points position={spec.pos} geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms as unknown as Record<string, THREE.IUniform>}
        vertexShader={GALAXY_VERT}
        fragmentShader={GALAXY_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export interface TempleHairProps {
  /** World-space face center. Match TempleFace.FACE. */
  faceCenter?: [number, number, number];
}

export function TempleHair({ faceCenter = [0, 8.5, -36] }: TempleHairProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  // Slowly rotate the whole crown so it feels alive.
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.07) * 0.06;
    }
  });
  return (
    <group ref={groupRef} position={faceCenter}>
      {ORNAMENTS.map((s, i) => (
        <HairOrnament key={i} spec={s} />
      ))}
    </group>
  );
}
