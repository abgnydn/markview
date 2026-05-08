'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadFaceMesh, sampleSurface, type FaceMeshData } from './face-mesh';

/**
 * The constellation FACE — particles sampled from MediaPipe's canonical
 * 468-vertex face mesh, rendered with the nebula shader. Cheekbones,
 * brow, nose, lips, jawline all read because the particles are tracing
 * a real 3D surface, not a flat oval SDF.
 */

const FACE = {
  distance: -36,
  height: 8.5,
  /** World-space scale applied to the canonical mesh. The MediaPipe
   *  model is ~14 wide × 22 tall × 7 deep; scale 1.7 gives a face
   *  roughly 24 wide × 37 tall — matches the previous disc width and
   *  reads as monumentally large from the visitor's POV. */
  scale: 1.7,
};

const FACE_POINTS = 28000;

interface FaceUniforms {
  uTime: { value: number };
  uBreath: { value: number };
  uMouth: { value: number };
  uTilt: { value: THREE.Vector2 };
  uIntensity: { value: number };
  uAssemble: { value: number };
}

const VERT = /* glsl */ `
  attribute vec3 aHome;
  attribute vec3 aScatter;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRim;
  uniform float uTime, uBreath, uIntensity, uAssemble;
  uniform vec2 uTilt;
  void main() {
    vColor = aColor;
    vec3 target = aHome;
    // Subtle breath inflation along all axes — mesh-shaped, so we scale
    // outward from the centroid.
    float bScale = 1.0 + 0.012 * sin(uTime * 0.32) + 0.010 * uBreath;
    target *= bScale;
    target.x += cos(uTime * 0.3 + aPhase) * 0.04;
    target.y += sin(uTime * 0.27 + aPhase * 1.7) * 0.04;
    // Gaze tilt — face tilts slightly toward visitor.
    float tiltX = uTilt.x * 0.4;
    float tiltY = uTilt.y * 0.3;
    target.x += tiltX * (target.y / 12.0);
    target.y += tiltY * (target.x / 12.0);
    vec3 p = mix(aScatter, target, smoothstep(0.0, 1.0, uAssemble));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.6 + 0.4 * sin(uTime * 1.4 + aPhase);
    vAlpha = uIntensity * twinkle;
    // Rim brightness uses Z (depth into face) — features facing forward
    // glow more, hair/back stays cooler.
    vRim = smoothstep(2.0, 6.5, aHome.z);
    gl_PointSize = aSize * (380.0 / max(-mv.z, 1.0)) * twinkle * (0.85 + uBreath * 0.4);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRim;
  uniform float uMouth;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    float spike = max(0.0, 1.0 - abs(c.x) * 16.0) * max(0.0, 1.0 - abs(c.y) * 1.6) * 0.25;
    spike     += max(0.0, 1.0 - abs(c.y) * 16.0) * max(0.0, 1.0 - abs(c.x) * 1.6) * 0.25;
    vec3 col = vColor;
    col = mix(col, vec3(1.0, 0.7, 0.4), vRim * uMouth * 0.6);
    float alpha = (a + spike * 0.8) * vAlpha;
    gl_FragColor = vec4(col * (a + spike * 1.2), alpha);
  }
`;

export interface TempleFaceProps {
  /** 0..1 mouth pulse — drive from speech amplitude. */
  mouth?: number;
  /** 0..1 breathing depth. */
  breath?: number;
  /** Called once the mesh is loaded so siblings (eyes, hair) can
   *  position themselves at landmark coordinates. */
  onMeshReady?: (mesh: FaceMeshData, scale: number) => void;
}

export function TempleFace({
  mouth = 0,
  breath = 0.5,
  onMeshReady,
}: TempleFaceProps): React.JSX.Element | null {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [mesh, setMesh] = useState<FaceMeshData | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFaceMesh()
      .then((m) => {
        if (cancelled) return;
        setMesh(m);
        onMeshReady?.(m, FACE.scale);
      })
      .catch((err) => console.warn('[temple/face] mesh load failed', err));
    return () => { cancelled = true; };
  }, [onMeshReady]);

  const uniforms = useMemo<FaceUniforms>(
    () => ({
      uTime: { value: 0 },
      uBreath: { value: 0 },
      uMouth: { value: 0 },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uIntensity: { value: 0 },
      uAssemble: { value: 0 },
    }),
    [],
  );

  const geometry = useMemo(() => {
    if (!mesh) return null;
    const home = sampleSurface(mesh, FACE_POINTS, FACE.scale);
    const scatter = new Float32Array(FACE_POINTS * 3);
    const pos = new Float32Array(FACE_POINTS * 3);
    const col = new Float32Array(FACE_POINTS * 3);
    const sz = new Float32Array(FACE_POINTS);
    const ph = new Float32Array(FACE_POINTS);
    const tmpC = new THREE.Color();
    for (let i = 0; i < FACE_POINTS; i++) {
      const hx = home[i * 3 + 0];
      const hy = home[i * 3 + 1];
      const hz = home[i * 3 + 2];
      // Scatter origin: random sphere shell around face center.
      const u = Math.random(), v = Math.random();
      const theta = u * 2 * Math.PI;
      const phi = Math.acos(2 * v - 1);
      const r = 50 + Math.random() * 70;
      scatter[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      scatter[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      scatter[i * 3 + 2] = r * Math.cos(phi);
      pos[i * 3 + 0] = hx;
      pos[i * 3 + 1] = hy;
      pos[i * 3 + 2] = hz;
      // Color tint by height — warm rim around forehead/cheeks, cool blue
      // up by the brow + cool violet toward the back of the head.
      const norm = Math.hypot(hx, hy * 0.85);
      if (hz < 1.5) tmpC.setRGB(0.62, 0.74, 1.0);     // back of head — cool
      else if (norm > 7) tmpC.setRGB(1.0, 0.86, 0.62); // outer rim — warm gold
      else if (norm > 4) tmpC.setRGB(1.0, 0.92, 0.78); // mid-face — pale gold
      else tmpC.setRGB(0.88, 0.93, 1.0);               // center — cool white
      col[i * 3 + 0] = tmpC.r;
      col[i * 3 + 1] = tmpC.g;
      col[i * 3 + 2] = tmpC.b;
      sz[i] = 0.45 + Math.random() * 0.6;
      ph[i] = Math.random() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    return g;
  }, [mesh]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uBreath.value = breath;
    uniforms.uMouth.value = mouth;
    uniforms.uIntensity.value = Math.min(1, uniforms.uIntensity.value + dt * 0.35);
    uniforms.uAssemble.value = Math.min(1, uniforms.uAssemble.value + dt * 0.22);
    const camDx = camera.position.x;
    const camDy = camera.position.y - FACE.height;
    const gazeX = Math.max(-1, Math.min(1, camDx / 6));
    const gazeY = Math.max(-1, Math.min(1, camDy / 4));
    uniforms.uTilt.value.set(gazeX * 0.6, gazeY * 0.4);
  });

  // Surface mesh — same topology, custom nebula fragment shader so the
  // face has actual painted skin (FBM noise + iridescent ramp + fresnel
  // rim) instead of plastic standardMaterial.
  const surfaceGeometry = useMemo(() => {
    if (!mesh) return null;
    const g = new THREE.BufferGeometry();
    const scaled = new Float32Array(mesh.vertices.length);
    for (let i = 0; i < mesh.vertices.length; i++) scaled[i] = mesh.vertices[i] * FACE.scale;
    g.setAttribute('position', new THREE.BufferAttribute(scaled, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);

  useEffect(() => () => surfaceGeometry?.dispose(), [surfaceGeometry]);

  const surfaceUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBreath: { value: 0 },
      uMouth: { value: 0 },
      uIntensity: { value: 0 },
    }),
    [],
  );

  useFrame((_, dt) => {
    surfaceUniforms.uTime.value += dt;
    surfaceUniforms.uBreath.value = breath;
    surfaceUniforms.uMouth.value = mouth;
    surfaceUniforms.uIntensity.value = uniforms.uIntensity.value;
  });

  if (!geometry || !surfaceGeometry) return null;

  return (
    <group ref={groupRef} position={[0, FACE.height, FACE.distance]}>
      {/* Painted-nebula skin. */}
      <mesh geometry={surfaceGeometry}>
        <shaderMaterial
          uniforms={surfaceUniforms as unknown as Record<string, THREE.IUniform>}
          vertexShader={SURFACE_VERT}
          fragmentShader={SURFACE_FRAG}
          transparent
          depthWrite={true}
          side={THREE.FrontSide}
          blending={THREE.NormalBlending}
        />
      </mesh>
      {/* Sparkle dust on the skin. */}
      <points geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms as unknown as Record<string, THREE.IUniform>}
          vertexShader={VERT}
          fragmentShader={FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

const SURFACE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform float uTime, uBreath;
  void main() {
    vec3 p = position;
    // Subtle breath inflation along normal — face swells / settles.
    float bScale = 1.0 + 0.010 * sin(uTime * 0.32) + 0.008 * uBreath;
    p *= bScale;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - vWorldPos);
  }
`;

const SURFACE_FRAG = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform float uTime, uIntensity, uMouth;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), u.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.05 + vec3(uTime * 0.03); a *= 0.5; }
    return v;
  }

  void main() {
    // Sample fbm using a slowed, scaled world-space coord so the
    // nebula drifts visibly across the face.
    vec3 q = vWorldPos * 0.13 + vec3(uTime * 0.04, uTime * 0.018, 0.0);
    float n = fbm(q);
    float n2 = fbm(q * 2.4 + vec3(7.3, 1.1, 4.0));
    float density = pow(n, 1.4) * 1.2 + n2 * 0.35;

    // Iridescent color ramp — deep violet → magenta → warm gold → cool cyan.
    vec3 deep   = vec3(0.10, 0.07, 0.32);   // void
    vec3 violet = vec3(0.34, 0.15, 0.52);
    vec3 magenta= vec3(0.70, 0.22, 0.55);
    vec3 gold   = vec3(0.95, 0.72, 0.40);
    vec3 cyan   = vec3(0.55, 0.85, 1.00);

    vec3 col = deep;
    col = mix(col,    violet,  smoothstep(0.30, 0.55, density));
    col = mix(col,    magenta, smoothstep(0.55, 0.78, density));
    col = mix(col,    gold,    smoothstep(0.78, 0.92, density));
    col = mix(col,    cyan,    smoothstep(0.92, 1.00, density));

    // Fresnel rim glow — features facing edge glow brighter, simulating
    // a halo around the head silhouette.
    float fres = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.4);
    col += vec3(0.45, 0.62, 1.0) * fres * 0.55;

    // Mouth-pulse warm wash near the lower-front of the face when speech.
    col += vec3(1.0, 0.62, 0.32) * uMouth * 0.18;

    // Fade in via uIntensity entrance.
    float alpha = (0.70 + 0.30 * fres) * uIntensity;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Re-exported so siblings like temple-eyes can position themselves
 *  by mesh landmark in the same world frame as TempleFace. */
export const TEMPLE_FACE_TRANSFORM = {
  position: [0, FACE.height, FACE.distance] as const,
  scale: FACE.scale,
};
