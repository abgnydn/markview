'use client';

import * as THREE from 'three';

/**
 * Pooled additive-blended particle system. Ported from
 * harness-temple.html `makeParticleSystem`.
 *
 * - Capacity N is fixed at construction; emit() recycles slots round-robin.
 * - step(dt) advances life + position; dead particles are sent to (9999, 9999, 9999) so they cull.
 * - Render via `system.points` — add it as a child of any group.
 */
export interface ParticleEmitOpts {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  color: THREE.Color;
  size: number;
  lifeSec: number;
  spread?: number;
}

export interface ParticleSystem {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  capacity: number;
  emit: (opts: ParticleEmitOpts) => void;
  step: (dt: number) => void;
  dispose: () => void;
}

const VERT = /* glsl */ `
  attribute float aLife;
  attribute float aLifeMax;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float t = aLife / max(aLifeMax, 0.0001);
    vAlpha = smoothstep(0.0, 0.15, t) * smoothstep(0.0, 0.6, 1.0 - t);
    gl_PointSize = aSize * (240.0 / max(-mv.z, 1.0)) * (0.7 + 0.3 * t);
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
    gl_FragColor = vec4(vColor * a, a * vAlpha);
  }
`;

export function makeParticleSystem(capacity: number): ParticleSystem {
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const lifeMax = new Float32Array(capacity);
  const col = new Float32Array(capacity * 3);
  const sz = new Float32Array(capacity);
  for (let i = 0; i < capacity; i++) {
    pos[i * 3 + 0] = 9999;
    pos[i * 3 + 1] = 9999;
    pos[i * 3 + 2] = 9999;
    lifeMax[i] = 1;
    col[i * 3 + 0] = 1;
    col[i * 3 + 1] = 0.8;
    col[i * 3 + 2] = 0.5;
    sz[i] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geometry.setAttribute('aLifeMax', new THREE.BufferAttribute(lifeMax, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);

  let nextIdx = 0;

  return {
    points,
    material,
    geometry,
    capacity,
    emit({ origin, direction, speed, color, size, lifeSec, spread = 0.3 }) {
      const i = nextIdx;
      nextIdx = (nextIdx + 1) % capacity;
      pos[i * 3 + 0] = origin.x;
      pos[i * 3 + 1] = origin.y;
      pos[i * 3 + 2] = origin.z;
      const jx = (Math.random() - 0.5) * spread;
      const jy = (Math.random() - 0.5) * spread;
      const jz = (Math.random() - 0.5) * spread;
      vel[i * 3 + 0] = direction.x * speed + jx;
      vel[i * 3 + 1] = direction.y * speed + jy;
      vel[i * 3 + 2] = direction.z * speed + jz;
      life[i] = lifeSec;
      lifeMax[i] = lifeSec;
      col[i * 3 + 0] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
      sz[i] = size;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aLife.needsUpdate = true;
      geometry.attributes.aLifeMax.needsUpdate = true;
      geometry.attributes.aColor.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
    },
    step(dt) {
      for (let i = 0; i < capacity; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3 + 0] += vel[i * 3 + 0] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 0] *= 0.985;
        vel[i * 3 + 1] *= 0.985;
        vel[i * 3 + 2] *= 0.985;
        if (life[i] <= 0) {
          pos[i * 3 + 0] = 9999;
          pos[i * 3 + 1] = 9999;
          pos[i * 3 + 2] = 9999;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aLife.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
