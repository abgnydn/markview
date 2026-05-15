'use client';

// LandingAtlas — the hero for `/`. Reframes markview as a universal local-first
// knowledge substrate: a glass-refracting core with five vertical "lenses"
// (Law/DavaKasası is the first live one) orbiting around it. Heavy three.js
// scene with MeshTransmissionMaterial + bloom + chromatic aberration + a 1.2k
// particle helio-stream spiraling into the core.
//
// SSR note: every three.js piece is rendered inside a single Canvas, which is
// itself behind a `'use client'` boundary, so Next's static export cleanly
// renders the HTML overlay first and bootstraps the WebGL scene on hydrate.

import React, { useMemo, useRef } from 'react';
import Link from 'next/link';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Float,
  Html,
  MeshTransmissionMaterial,
  Stars,
} from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import './landing-atlas.css';

interface Vertical {
  id: string;
  label: string;
  sub: string;
  color: string;
  live: boolean;
  href: string;
  copy: string;
}

const VERTICALS: Vertical[] = [
  {
    id: 'research',
    label: 'Research',
    sub: 'soon',
    color: '#a78bfa',
    live: false,
    href: '#vertical-research',
    copy: 'Paper graph: cite, follow, query — local citation memory.',
  },
  {
    id: 'medicine',
    label: 'Medicine',
    sub: 'soon',
    color: '#34d399',
    live: false,
    href: '#vertical-medicine',
    copy: 'Patient context vault. HIPAA-safe by design — never uploads.',
  },
  {
    id: 'code',
    label: 'Code',
    sub: 'soon',
    color: '#67e8f9',
    live: false,
    href: '#vertical-code',
    copy: 'Repo-wide knowledge: PRs, ADRs, postmortems, all linked.',
  },
  {
    id: 'finance',
    label: 'Finance',
    sub: 'soon',
    color: '#ff7a94',
    live: false,
    href: '#vertical-finance',
    copy: 'Deal rooms + memos that stay on the analyst’s laptop.',
  },
];

function Core() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.16;
    meshRef.current.rotation.x += delta * 0.05;
  });
  return (
    <Float floatIntensity={0.35} rotationIntensity={0.12} speed={0.55}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.18, 5]} />
        <MeshTransmissionMaterial
          ref={null as unknown as React.Ref<never>}
          backside
          backsideThickness={0.55}
          thickness={0.7}
          chromaticAberration={0.22}
          anisotropy={0.6}
          distortion={0.42}
          distortionScale={0.55}
          temporalDistortion={0.18}
          ior={1.55}
          color="#e0f2fe"
          attenuationColor="#7dd3fc"
          attenuationDistance={1.4}
          roughness={0.05}
          transmission={1}
        />
      </mesh>
      {/* Inner emissive seed — gives the glass core a luminous heart that
          bloom amplifies. */}
      <mesh>
        <icosahedronGeometry args={[0.42, 3]} />
        <meshBasicMaterial color="#a78bfa" toneMapped={false} />
      </mesh>
    </Float>
  );
}

interface DomainOrbProps extends Vertical {
  angle: number;
  radius: number;
  inclination: number;
  speed: number;
}

function DomainOrb({
  angle,
  radius,
  inclination,
  speed,
  color,
  label,
  sub,
  live,
  href,
}: DomainOrbProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime * speed + angle;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const y = Math.sin(t * 1.4) * inclination;
    groupRef.current.position.set(x, y, z);
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      {/* Outer halo — a translucent sphere catches the bloom and sells the
          "knowledge node lit from within" read. */}
      <mesh>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <Html
        center
        distanceFactor={5}
        style={{ pointerEvents: 'auto' }}
        zIndexRange={[10, 0]}
      >
        <Link
          href={href}
          className={`atlas-orb-chip ${live ? 'live' : 'soon'}`}
          style={
            {
              ['--chip-color' as string]: color,
            } as React.CSSProperties
          }
        >
          <span className="atlas-orb-dot" />
          <span className="atlas-orb-label">{label}</span>
          <span className="atlas-orb-sub">{sub}</span>
        </Link>
      </Html>
    </group>
  );
}

function ParticleStream({ count = 1200 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  // Initial positions — distribute uniformly over a spherical shell at radius
  // 4..8 so they read as a galaxy halo. Animation is a slow group rotation
  // around y; if we wanted "flow into core," we'd mutate the buffer per-frame
  // — saved for a follow-up because the bloom + chromatic aberration alone
  // already carry the visual.
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi) * 0.6; // squash the disc
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.04;
    pointsRef.current.rotation.x += delta * 0.012;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.024}
        color="#cbd5f5"
        transparent
        opacity={0.78}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CameraParallax() {
  useFrame(({ camera, mouse }) => {
    const targetX = mouse.x * 0.85;
    const targetY = 0.35 + mouse.y * 0.55;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function LandingAtlas() {
  return (
    <div className="atlas-root">
      <div className="atlas-canvas">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 0.35, 7], fov: 45 }}
        >
          <color attach="background" args={['#020617']} />
          <fog attach="fog" args={['#020617', 7, 24]} />
          <ambientLight intensity={0.22} />
          <pointLight position={[5, 4, 5]} intensity={3.4} color="#7dd3fc" />
          <pointLight position={[-4, -2, 4]} intensity={2.2} color="#a78bfa" />
          <pointLight position={[0, -4, -3]} intensity={1.6} color="#fbbf24" />
          <Stars radius={140} depth={70} count={4800} factor={4} fade speed={0.55} />
          <ParticleStream count={1400} />
          <Core />
          {VERTICALS.map((v, i) => {
            const angle = (i / VERTICALS.length) * Math.PI * 2;
            const radius = 2.55 + (i % 2 === 0 ? 0.18 : 0.55);
            const inclination = 0.35 + (i % 3) * 0.18;
            const speed = 0.11 + i * 0.013;
            return (
              <DomainOrb
                key={v.id}
                {...v}
                angle={angle}
                radius={radius}
                inclination={inclination}
                speed={speed}
              />
            );
          })}
          <CameraParallax />
          <EffectComposer>
            <Bloom
              mipmapBlur
              luminanceThreshold={0.55}
              luminanceSmoothing={0.2}
              intensity={1.7}
              levels={7}
            />
            <ChromaticAberration
              offset={new THREE.Vector2(0.0009, 0.0009)}
              radialModulation={false}
              modulationOffset={0}
            />
            <Vignette eskil={false} offset={0.28} darkness={0.66} />
          </EffectComposer>
        </Canvas>
      </div>

      <div className="atlas-hero">
        <div className="atlas-eyebrow">A second brain · for any profession</div>
        <h1 className="atlas-headline">
          Knowledge that <span className="atlas-grad-cyan">stays local</span>.
          <br />
          Agents that <span className="atlas-grad-violet">go anywhere</span>.
        </h1>
        <p className="atlas-sub">
          Drag any document into a 3D semantic graph. Query it from Claude, Cursor,
          ChatGPT — without uploading a single file. Five verticals, one substrate.
          <strong> Law is the first lens. Yours is next.</strong>
        </p>
        <div className="atlas-cta">
          <Link href="/vault" className="atlas-cta-primary">
            Open your vault
            <span className="atlas-cta-arrow">→</span>
          </Link>
        </div>
        <div className="atlas-scroll-hint">scroll · explore the verticals</div>
      </div>

      <section className="atlas-verticals" id="verticals">
        <div className="atlas-verticals-header">
          <h2>Five verticals. One brain.</h2>
          <p>
            The substrate is universal: drag · embed · graph · query. Each vertical
            wraps it in the language and rituals of one profession.
          </p>
        </div>
        <div className="atlas-verticals-grid">
          {VERTICALS.map((v) => (
            <Link
              key={v.id}
              href={v.href}
              id={`vertical-${v.id}`}
              className={`atlas-vcard ${v.live ? 'live' : 'soon'}`}
              style={
                {
                  ['--card-color' as string]: v.color,
                } as React.CSSProperties
              }
            >
              <div className="atlas-vcard-head">
                <span className="atlas-vcard-dot" />
                <span className="atlas-vcard-label">{v.label}</span>
                <span className="atlas-vcard-status">{v.live ? 'live' : 'soon'}</span>
              </div>
              <p className="atlas-vcard-copy">{v.copy}</p>
              <span className="atlas-vcard-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="atlas-pillars">
        <div className="atlas-pillars-header">
          <h2>Three commitments.</h2>
        </div>
        <div className="atlas-pillars-grid">
          <article>
            <h3>Local first</h3>
            <p>
              Documents are parsed in the browser. Embeddings run on-device.
              Nothing crosses the wire — and audits prove it.
            </p>
          </article>
          <article>
            <h3>Agent native</h3>
            <p>
              An MCP server bound to your vault. Claude, Cursor, ChatGPT —
              same context, no upload, deterministic graph queries.
            </p>
          </article>
          <article>
            <h3>Worldwide</h3>
            <p>
              Turkish lawyers today. Tokyo radiologists tomorrow. The substrate
              is locale- and law-agnostic; only the lens changes.
            </p>
          </article>
        </div>
      </section>

      <footer className="atlas-foot">
        <Link href="/vault">/vault</Link>
        <Link href="/brain">/brain</Link>
        <Link href="/agent">/agent</Link>
        <span className="atlas-foot-mark">markview · 2026</span>
      </footer>
    </div>
  );
}
