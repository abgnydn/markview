'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Html,
  Stars,
  MeshDistortMaterial,
  MeshTransmissionMaterial,
  Environment,
  Lightformer,
  RoundedBox,
} from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  GodRays,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';

interface PanelDef {
  label: string;
  emoji: string;
  tint: string;
}

const CYAN = '#67e8f9';
const VIOLET = '#a78bfa';
const AMBER = '#fbbf24';

const PANELS: PanelDef[] = [
  { label: 'github.com',  emoji: '🔀', tint: VIOLET },
  { label: 'claude.ai',   emoji: '💬', tint: AMBER  },
  { label: 'arxiv.org',   emoji: '📄', tint: CYAN   },
  { label: 'chatgpt.com', emoji: '💭', tint: AMBER  },
  { label: 'slack.com',   emoji: '#',  tint: VIOLET },
  { label: 'notion.so',   emoji: '📓', tint: CYAN   },
];

const ORBIT_TILT = 0.28;

interface Keyframe {
  t: number;
  camPos: [number, number, number];
  orbitRadius: number;
  activePanel: number;
  distortAmp: number;
  brainScale: number;
}

const KEYFRAMES: Keyframe[] = [
  { t: 0.00, camPos: [0, 2.4, 10.0],  orbitRadius: 4.4, activePanel: -1, distortAmp: 0.30, brainScale: 1.00 },
  { t: 0.08, camPos: [0, 1.8, 7.5],   orbitRadius: 3.6, activePanel: -1, distortAmp: 0.35, brainScale: 1.05 },
  { t: 0.24, camPos: [3.4, 0.9, 5.0], orbitRadius: 3.3, activePanel:  0, distortAmp: 0.42, brainScale: 1.12 },
  { t: 0.40, camPos: [-3.5, 1.1, 4.8], orbitRadius: 3.3, activePanel:  2, distortAmp: 0.42, brainScale: 1.12 },
  { t: 0.56, camPos: [0, 3.4, 4.3],   orbitRadius: 3.1, activePanel: -1, distortAmp: 0.6,  brainScale: 1.30 },
  { t: 0.72, camPos: [0, 0.3, 8.5],   orbitRadius: 4.2, activePanel: -2, distortAmp: 0.4,  brainScale: 1.00 },
  { t: 0.86, camPos: [0, 1.4, 7.0],   orbitRadius: 3.6, activePanel: -1, distortAmp: 0.35, brainScale: 1.10 },
  { t: 1.00, camPos: [0, 2.2, 10.5],  orbitRadius: 4.4, activePanel: -1, distortAmp: 0.28, brainScale: 0.85 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function sampleTimeline(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  while (i < KEYFRAMES.length - 1 && KEYFRAMES[i + 1].t < p) i++;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[Math.min(i + 1, KEYFRAMES.length - 1)];
  const span = Math.max(0.0001, b.t - a.t);
  const local = Math.max(0, Math.min(1, (p - a.t) / span));
  const eased = local * local * (3 - 2 * local);
  return {
    camPos: lerpVec3(a.camPos, b.camPos, eased),
    orbitRadius: lerp(a.orbitRadius, b.orbitRadius, eased),
    distortAmp: lerp(a.distortAmp, b.distortAmp, eased),
    brainScale: lerp(a.brainScale, b.brainScale, eased),
    activePanel: eased < 0.5 ? a.activePanel : b.activePanel,
  };
}

function computePanelPos(
  index: number,
  total: number,
  rotation: number,
  radius: number,
): THREE.Vector3 {
  const a = (index / total) * Math.PI * 2 + rotation;
  return new THREE.Vector3(
    Math.cos(a) * radius,
    -Math.sin(a) * radius * Math.sin(ORBIT_TILT),
    Math.sin(a) * radius * Math.cos(ORBIT_TILT),
  );
}

function Brain({
  distortRef,
  scaleRef,
}: {
  distortRef: React.MutableRefObject<number>;
  scaleRef: React.MutableRefObject<number>;
}) {
  const wireRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const distortMatRef = useRef<THREE.Material & { distort?: number }>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (wireRef.current) {
      wireRef.current.rotation.x = t * 0.08;
      wireRef.current.rotation.y = t * 0.12;
      wireRef.current.scale.setScalar(scaleRef.current);
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.22;
      coreRef.current.rotation.x = t * 0.14;
      coreRef.current.scale.setScalar(scaleRef.current);
    }
    if (distortMatRef.current?.distort !== undefined) {
      distortMatRef.current.distort = distortRef.current;
    }
  });

  return (
    <group>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.3, 2]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.14} toneMapped={false} />
      </mesh>

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.98, 6]} />
        <MeshDistortMaterial
          ref={distortMatRef as unknown as React.Ref<never>}
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

function SunNode({
  scaleRef,
  setSun,
}: {
  scaleRef: React.MutableRefObject<number>;
  setSun: (m: THREE.Mesh | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerDistortMatRef = useRef<THREE.Material & { distort?: number }>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.elapsedTime;
      meshRef.current.rotation.y = -t * 0.3;
      meshRef.current.rotation.z = -t * 0.22;
      meshRef.current.scale.setScalar(0.55 * scaleRef.current);
    }
    if (innerDistortMatRef.current?.distort !== undefined) {
      innerDistortMatRef.current.distort = 0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
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
        ref={innerDistortMatRef as unknown as React.Ref<never>}
        color="#dff3fb"
        emissive="#7dd3fc"
        emissiveIntensity={2.4}
        roughness={0.12}
        distort={0.55}
        speed={3.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Satellites({ scaleRef }: { scaleRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.6;
      groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.25;
      groupRef.current.scale.setScalar(scaleRef.current);
    }
  });

  const sats = useMemo(
    () => [
      { pos: [1.8, 0.3, 0] as [number, number, number],    color: VIOLET, size: 0.075 },
      { pos: [-1.55, -0.4, 0.6] as [number, number, number], color: AMBER,  size: 0.06  },
      { pos: [0.3, 1.75, -0.7] as [number, number, number],  color: CYAN,   size: 0.05  },
    ],
    [],
  );

  return (
    <group ref={groupRef}>
      {sats.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[s.size, 24, 24]} />
          <meshBasicMaterial color={s.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

interface PanelProps {
  index: number;
  rotationRef: React.MutableRefObject<number>;
  activePanelRef: React.MutableRefObject<number>;
  orbitRadiusRef: React.MutableRefObject<number>;
}

function Panel({ index, rotationRef, activePanelRef, orbitRadiusRef }: PanelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const scaleRef = useRef(1);

  useFrame(() => {
    const pos = computePanelPos(index, PANELS.length, rotationRef.current, orbitRadiusRef.current);
    if (groupRef.current) {
      groupRef.current.position.copy(pos);
      groupRef.current.lookAt(0, 0, 0);

      const ap = activePanelRef.current;
      const active = ap === index || ap === -2;
      const targetScale = active ? 1.22 : 1.0;
      scaleRef.current += (targetScale - scaleRef.current) * 0.1;
      groupRef.current.scale.setScalar(scaleRef.current);
    }
    if (glowMatRef.current) {
      const ap = activePanelRef.current;
      const active = ap === index || ap === -2;
      const targetOpacity = active ? 1.25 : 0.0;
      glowMatRef.current.opacity += (targetOpacity - glowMatRef.current.opacity) * 0.1;
    }
  });

  const tint = PANELS[index].tint;

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[1.25, 0.75]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color={tint}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>

      <RoundedBox args={[1.38, 0.84, 0.06]} radius={0.05} smoothness={3}>
        <MeshTransmissionMaterial
          samples={2}
          resolution={128}
          thickness={0.28}
          roughness={0.08}
          transmission={1}
          ior={1.26}
          chromaticAberration={0.04}
          distortion={0.06}
          distortionScale={0.3}
          temporalDistortion={0.02}
          color="#e0f7ff"
          anisotropicBlur={0.15}
        />
      </RoundedBox>

      <Html center distanceFactor={9} transform position={[0, 0, 0.06]}>
        <div
          style={{
            color: 'rgba(240, 250, 255, 0.95)',
            fontSize: '12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            padding: '5px 12px',
            borderRadius: '999px',
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${tint}55`,
            letterSpacing: '0.04em',
            textShadow: `0 0 12px ${tint}aa`,
            userSelect: 'none',
            boxShadow: `0 0 20px ${tint}33`,
          }}
        >
          {PANELS[index].emoji} {PANELS[index].label}
        </div>
      </Html>
    </group>
  );
}

interface TendrilProps {
  rotationRef: React.MutableRefObject<number>;
  activePanelRef: React.MutableRefObject<number>;
  orbitRadiusRef: React.MutableRefObject<number>;
}

const PARTICLE_COUNT = 28;

function Tendril({ rotationRef, activePanelRef, orbitRadiusRef }: TendrilProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const tubeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const packetRef = useRef<THREE.Mesh>(null);

  const offsets = useMemo(
    () => Float32Array.from({ length: PARTICLE_COUNT }, () => Math.random()),
    [],
  );
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  const packetState = useRef({ lastActive: -999, packetStart: 0 });

  const tmpFrom = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const tmpTarget = useMemo(() => new THREE.Vector3(), []);
  const tmpMid = useMemo(() => new THREE.Vector3(), []);
  const tmpLift = useMemo(() => new THREE.Vector3(0, 0.55, 0), []);
  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ),
    [],
  );

  const lastGeomRebuild = useRef(0);

  useFrame(({ clock }) => {
    const ap = activePanelRef.current;
    const t = clock.elapsedTime;

    if (ap < 0) {
      if (tubeMatRef.current) {
        tubeMatRef.current.opacity += (0 - tubeMatRef.current.opacity) * 0.08;
      }
      if (packetRef.current) {
        const mat = packetRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity += (0 - mat.opacity) * 0.1;
      }
      if (pointsRef.current) {
        const mat = pointsRef.current.material as THREE.PointsMaterial;
        mat.opacity += (0 - mat.opacity) * 0.1;
      }
      return;
    }

    const angle = (ap / PANELS.length) * Math.PI * 2 + rotationRef.current;
    const r = orbitRadiusRef.current;
    tmpTarget.set(
      Math.cos(angle) * r,
      -Math.sin(angle) * r * Math.sin(ORBIT_TILT),
      Math.sin(angle) * r * Math.cos(ORBIT_TILT),
    );
    tmpMid.copy(tmpFrom).add(tmpTarget).multiplyScalar(0.5).add(tmpLift);
    curve.v0.copy(tmpFrom);
    curve.v1.copy(tmpMid);
    curve.v2.copy(tmpTarget);

    if (tubeRef.current && t - lastGeomRebuild.current > 0.05) {
      const prev = tubeRef.current.geometry;
      tubeRef.current.geometry = new THREE.TubeGeometry(curve, 20, 0.022, 6, false);
      prev.dispose();
      lastGeomRebuild.current = t;
    }

    if (tubeMatRef.current) {
      const beat = 1 + Math.sin(t * 6) * 0.12;
      const targetOp = 0.58 * beat;
      tubeMatRef.current.opacity += (targetOp - tubeMatRef.current.opacity) * 0.2;
    }

    if (pointsRef.current) {
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity += (1 - mat.opacity) * 0.1;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = (offsets[i] + t * 0.55) % 1;
      const pt = curve.getPoint(p);
      positions[i * 3]     = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    }
    if (pointsRef.current) {
      const attr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }

    if (packetState.current.lastActive !== ap) {
      packetState.current.lastActive = ap;
      packetState.current.packetStart = t;
    }
    if (packetRef.current) {
      const since = t - packetState.current.packetStart;
      const progress = Math.min(since / 1.4, 1);
      const pt = curve.getPoint(progress);
      packetRef.current.position.copy(pt);
      const mat = packetRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = progress < 1 ? 1 : 0;
    }
  });

  return (
    <group>
      <mesh ref={tubeRef}>
        <tubeGeometry args={[
          new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.5, 0),
            new THREE.Vector3(1, 0, 0),
          ),
          20, 0.022, 6, false,
        ]} />
        <meshBasicMaterial
          ref={tubeMatRef}
          color={CYAN}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={PARTICLE_COUNT}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          color="#e0f7ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>

      <mesh ref={packetRef}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CameraRig({
  targetPosRef,
}: {
  targetPosRef: React.MutableRefObject<[number, number, number]>;
}) {
  const { camera } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useFrame(({ mouse, clock }) => {
    const [tx, ty, tz] = targetPosRef.current;
    tmp.current.set(
      tx + mouse.x * 0.6,
      ty + mouse.y * 0.4 + Math.sin(clock.elapsedTime * 0.3) * 0.1,
      tz + Math.cos(clock.elapsedTime * 0.2) * 0.15,
    );
    camera.position.lerp(tmp.current, 0.055);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

interface SceneProps {
  progressRef: React.MutableRefObject<number>;
  setSun: (m: THREE.Mesh | null) => void;
}

function Scene({ progressRef, setSun }: SceneProps) {
  const rotationRef = useRef(0);
  const activePanelRef = useRef(-1);
  const orbitRadiusRef = useRef(4.0);
  const distortRef = useRef(0.4);
  const scaleRef = useRef(1);
  const camTargetRef = useRef<[number, number, number]>([0, 2.4, 10]);

  useFrame((state, delta) => {
    rotationRef.current += delta * 0.12;
    const s = sampleTimeline(progressRef.current);

    activePanelRef.current = s.activePanel;
    orbitRadiusRef.current += (s.orbitRadius - orbitRadiusRef.current) * 0.08;
    distortRef.current += (s.distortAmp - distortRef.current) * 0.06;
    scaleRef.current += (s.brainScale - scaleRef.current) * 0.06;
    camTargetRef.current = s.camPos;
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 0, 0]} intensity={4.5} color={CYAN} distance={12} decay={1.6} />
      <pointLight position={[5, 3, 4]} intensity={0.7} color={VIOLET} />
      <pointLight position={[-5, -2, -3]} intensity={0.5} color={AMBER} />

      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.9} color={CYAN}   position={[0, 3, 2]}   scale={[6, 3, 1]} />
        <Lightformer intensity={1.3} color={VIOLET} position={[-4, 1, -2]} scale={[4, 4, 1]} />
        <Lightformer intensity={1.2} color={AMBER}  position={[4, -1, 2]}  scale={[4, 4, 1]} />
        <Lightformer intensity={0.7} color="#ffffff" position={[0, -4, 0]} scale={[8, 2, 1]} />
      </Environment>

      <Brain distortRef={distortRef} scaleRef={scaleRef} />
      <SunNode scaleRef={scaleRef} setSun={setSun} />
      <Satellites scaleRef={scaleRef} />
      {PANELS.map((_, i) => (
        <Panel
          key={i}
          index={i}
          rotationRef={rotationRef}
          activePanelRef={activePanelRef}
          orbitRadiusRef={orbitRadiusRef}
        />
      ))}
      <Tendril
        rotationRef={rotationRef}
        activePanelRef={activePanelRef}
        orbitRadiusRef={orbitRadiusRef}
      />
      <CameraRig targetPosRef={camTargetRef} />
    </>
  );
}

interface LandingOrbitProps {
  progressRef: React.MutableRefObject<number>;
}

export function LandingOrbit({ progressRef }: LandingOrbitProps) {
  const [sun, setSun] = useState<THREE.Mesh | null>(null);

  return (
    <Canvas
      camera={{ position: [0, 2.4, 10], fov: 48 }}
      dpr={[1, 1.4]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
      }}
    >
      <Stars radius={120} depth={45} count={320} factor={2.4} fade speed={0.3} />
      <Scene progressRef={progressRef} setSun={setSun} />

      <EffectComposer multisampling={0} enableNormalPass={false}>
        {sun ? (
          <GodRays
            sun={sun}
            samples={32}
            density={0.94}
            decay={0.92}
            weight={0.28}
            exposure={0.2}
            clampMax={0.85}
            blur
            kernelSize={KernelSize.SMALL}
            blendFunction={BlendFunction.SCREEN}
          />
        ) : (
          <></>
        )}
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.24}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.7}
        />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
