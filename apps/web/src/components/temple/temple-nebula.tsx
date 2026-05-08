'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime, uDensity, uSwirl;
  uniform vec3 uHue;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
    vec2 u = f*f*(3.0 - 2.0*f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.07 + vec2(uTime * 0.005); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = vUv - 0.5;
    float ang = uSwirl * 0.25 * sin(uTime * 0.04);
    mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    uv = R * uv;
    float r = length(uv);
    float n = fbm(uv * 4.0 + vec2(uTime * 0.012, 0.0));
    float n2 = fbm(uv * 9.0 - vec2(0.0, uTime * 0.008));
    float density = pow(n, 2.4) * 1.2 + n2 * 0.3;
    density *= smoothstep(0.55, 0.05, r);
    density *= uDensity;
    vec3 col = uHue * density;
    gl_FragColor = vec4(col, density);
  }
`;

interface NebulaLayerProps {
  size: number;
  distance: number;
  hue: number;
  density: number;
  swirl: number;
}

function NebulaLayer({ size, distance, hue, density, swirl }: NebulaLayerProps): React.JSX.Element {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHue: { value: new THREE.Color(hue) },
      uDensity: { value: density },
      uSwirl: { value: swirl },
    }),
    [hue, density, swirl],
  );
  useFrame((state, dt) => {
    uniforms.uTime.value += dt;
    if (meshRef.current) {
      // Slow drift rotation — matches harness `nebulaA.mesh.rotation.z`.
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.02 * swirl) * 0.05;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 4, distance]} renderOrder={-10}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms as unknown as Record<string, THREE.IUniform>}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function TempleNebula(): React.JSX.Element {
  return (
    <>
      <NebulaLayer size={220} distance={-120} hue={0x4a3aa0} density={0.85} swirl={1.0} />
      <NebulaLayer size={320} distance={-200} hue={0x6a2a5a} density={0.55} swirl={-1.0} />
      <NebulaLayer size={480} distance={-320} hue={0x1a1f5a} density={0.45} swirl={0.5} />
    </>
  );
}
