'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface GalaxyOpts {
  arms?: number;
  twist?: number;
  radius?: number;
  spinDir?: number;
}

interface GalaxyUniforms {
  uTime: { value: number };
  uIntensity: { value: number };
  uPupil: { value: THREE.Vector2 };
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
  uniform vec2 uPupil;
  void main() {
    vColor = aColor;
    vR = aR;
    float omega = uSpinDir * mix(0.55, 0.13, smoothstep(0.0, 1.0, aR));
    float ang = uTime * omega;
    mat3 R = mat3(cos(ang), -sin(ang), 0.0,
                  sin(ang),  cos(ang), 0.0,
                  0.0,       0.0,      1.0);
    vec3 p = R * position;
    p.x += uPupil.x * (1.0 - aR) * 0.45;
    p.y += uPupil.y * (1.0 - aR) * 0.45;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.5 + aPhase);
    vAlpha = uIntensity * twinkle;
    gl_PointSize = aSize * (240.0 / max(-mv.z, 1.0)) * (0.7 + (1.0 - aR) * 0.6);
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

function makeGalaxyGeometry(n: number, opts: GalaxyOpts): THREE.BufferGeometry {
  const arms = opts.arms ?? 3;
  const twist = opts.twist ?? 5.5;
  const radius = opts.radius ?? 1.0;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  const r01 = new Float32Array(n);
  const ph = new Float32Array(n);
  const tmpC = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 1.5) * radius;
    const arm = Math.floor(Math.random() * arms);
    const baseAng = (arm / arms) * Math.PI * 2;
    const ang = baseAng + r * twist + (Math.random() - 0.5) * 0.5;
    pos[i * 3 + 0] = r * Math.cos(ang);
    pos[i * 3 + 1] = r * Math.sin(ang);
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    const t = r / radius;
    if (t < 0.12) tmpC.setRGB(1.0, 0.95, 0.85);
    else if (t < 0.4) tmpC.setRGB(0.85, 0.9, 1.0);
    else tmpC.setRGB(0.7, 0.8, 1.0);
    if (Math.random() < 0.12) tmpC.setRGB(1.0, 0.7, 0.5);
    col[i * 3 + 0] = tmpC.r;
    col[i * 3 + 1] = tmpC.g;
    col[i * 3 + 2] = tmpC.b;
    sz[i] = (1 - t) * 1.4 + 0.4;
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

interface GalaxyEyeProps {
  spinDir: number;
  position: [number, number, number];
  pupilRadius: number;
  pointCount?: number;
}

function GalaxyEye({ spinDir, position, pupilRadius, pointCount = 1800 }: GalaxyEyeProps): React.JSX.Element {
  const { camera } = useThree();
  const geometry = useMemo(
    () =>
      makeGalaxyGeometry(pointCount, {
        arms: 3,
        twist: 5.0,
        radius: pupilRadius * 0.9,
        spinDir,
      }),
    [spinDir, pupilRadius, pointCount],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo<GalaxyUniforms>(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.85 },
      uPupil: { value: new THREE.Vector2(0, 0) },
      uSpinDir: { value: spinDir },
    }),
    [spinDir],
  );

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    // Pupil offset tracks camera horizontal/vertical relative to face.
    const camDx = camera.position.x;
    const camDy = camera.position.y - 8.5;
    const gazeX = Math.max(-1, Math.min(1, camDx / 6));
    const gazeY = Math.max(-1, Math.min(1, camDy / 4));
    uniforms.uPupil.value.set(gazeX * 0.7, gazeY * 0.5);
  });

  return (
    <group position={position}>
      <points geometry={geometry}>
        <shaderMaterial
          uniforms={uniforms as unknown as Record<string, THREE.IUniform>}
          vertexShader={GALAXY_VERT}
          fragmentShader={GALAXY_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Bright pupil core — small additive disc behind the galaxy.
          Dialed down so it doesn't out-bloom the face constellation. */}
      <mesh position={[0, 0, -0.05]}>
        <circleGeometry args={[pupilRadius * 0.18, 24]} />
        <meshBasicMaterial
          color="#fff2c8"
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={true}
        />
      </mesh>
    </group>
  );
}

export interface EyeAnchor {
  position: [number, number, number];
  pupilRadius: number;
}

export interface TempleEyesProps {
  /** World-space position of the face center. Match TempleFace.FACE. */
  faceCenter?: [number, number, number];
  /** Per-eye anchor in face-local coords. When provided (from MediaPipe
   *  landmarks), eyes snap to actual sockets; otherwise symmetric defaults. */
  rightEye?: EyeAnchor;
  leftEye?: EyeAnchor;
}

const DEFAULT_RIGHT: EyeAnchor = { position: [-2.16, 1.2, 5.0], pupilRadius: 0.81 };
const DEFAULT_LEFT: EyeAnchor = { position: [2.16, 1.2, 5.0], pupilRadius: 0.81 };

export function TempleEyes({
  faceCenter = [0, 8.5, -36],
  rightEye = DEFAULT_RIGHT,
  leftEye = DEFAULT_LEFT,
}: TempleEyesProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  return (
    <group ref={groupRef} position={faceCenter}>
      <GalaxyEye spinDir={1} position={rightEye.position} pupilRadius={rightEye.pupilRadius} />
      <GalaxyEye spinDir={-1} position={leftEye.position} pupilRadius={leftEye.pupilRadius} />
    </group>
  );
}
