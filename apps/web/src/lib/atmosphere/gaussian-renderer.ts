// SPDX-License-Identifier: Apache-2.0

/**
 * Shared instanced Gaussian-splat renderer.
 *
 * Both the fixed backdrop (splat-painting) and the immersive walk-through
 * (splat-world) lift a painting into the same point cloud and draw it the
 * same way: one instanced quad per gaussian, a camera-facing billboard with
 * an exp(-r²) alpha falloff, blended back-to-front. This module owns that
 * geometry + shader + sort so there's a single definition to reason about.
 *
 * The only knobs that differ between the two callers are the footprint
 * multiplier and the falloff sharpness — both passed in as options and fed
 * to uniforms, so the shader source is identical.
 *
 * Sort: back-to-front ordering is required for correct alpha compositing.
 * We sort by view-space z with a 16-bit counting sort (O(N), no per-element
 * comparator closure) rather than Array.sort — at 100k+ splats the
 * comparator path was the dominant per-orbit cost and made dragging janky.
 * 65 536 depth buckets is far finer than any visible compositing seam.
 */

import type * as ThreeNS from 'three';
import type { GaussianCloud } from './splat-cloud';

type Three = typeof ThreeNS;

export interface SplatRenderer {
  mesh: ThreeNS.Mesh;
  material: ThreeNS.ShaderMaterial;
  /** Re-sort back-to-front for the given camera and re-upload instance data. */
  sort: (camera: ThreeNS.Camera) => void;
  dispose: () => void;
}

export interface SplatRendererOptions {
  /** Footprint multiplier on the cloud's intrinsic splatScale. Default 1. */
  scaleMul?: number;
  /** Gaussian falloff sharpness — higher = crisper core. Default 4.5. */
  falloff?: number;
}

const VERTEX_SHADER = /* glsl */ `
  precision highp float;
  attribute vec3 aOffset;
  attribute vec3 aColor;
  attribute vec3 aSeed;
  uniform float uScale;
  uniform float uCover;
  uniform float uReveal;
  varying vec2 vCorner;
  varying vec3 vColor;
  void main() {
    vCorner = position.xy * 2.0;            // [-1,1] across the quad
    vColor = aColor;
    // Assemble: lerp from scattered (aSeed) to settled (aOffset).
    float rv = clamp(uReveal, 0.0, 1.0);
    vec3 pos = mix(aOffset + aSeed * 1.4, aOffset, rv);
    // Billboard corner added in VIEW space so gaussians always face us.
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv.xy += position.xy * uScale * uCover * 2.0;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uFalloff;
  varying vec2 vCorner;
  varying vec3 vColor;
  void main() {
    float r2 = dot(vCorner, vCorner);
    if (r2 > 1.0) discard;
    // exp(-r²·k) gaussian footprint; premultiplied so overlapping splats
    // accumulate cleanly.
    float a = exp(-r2 * uFalloff) * uOpacity * clamp(uReveal * 1.2, 0.0, 1.0);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export function createSplatRenderer(
  THREE: Three,
  cloud: GaussianCloud,
  opts: SplatRendererOptions = {},
): SplatRenderer {
  const { base, colors, seeds, count: N, splatScale } = cloud;
  const scaleMul = opts.scaleMul ?? 1;
  const falloff = opts.falloff ?? 4.5;

  // Unit-quad billboard geometry, instanced. Corners are vec3 (z=0) because
  // ShaderMaterial injects `attribute vec3 position`.
  const quad = new THREE.InstancedBufferGeometry();
  const corners = new Float32Array([
    -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
  ]);
  quad.setAttribute('position', new THREE.BufferAttribute(corners, 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);

  const aOffset = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  aOffset.setUsage(THREE.DynamicDrawUsage);
  aColor.setUsage(THREE.DynamicDrawUsage);
  aSeed.setUsage(THREE.DynamicDrawUsage);
  quad.setAttribute('aOffset', aOffset);
  quad.setAttribute('aColor', aColor);
  quad.setAttribute('aSeed', aSeed);
  quad.instanceCount = N;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: splatScale * scaleMul },
      uCover: { value: 1.0 },
      uReveal: { value: 0.0 },
      uOpacity: { value: 1.0 },
      uFalloff: { value: falloff },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });

  const mesh = new THREE.Mesh(quad, material);
  mesh.frustumCulled = false;

  // ── Back-to-front counting sort ────────────────────────────────────
  const order = new Uint32Array(N);
  const viewZ = new Float32Array(N);
  const keys = new Uint16Array(N);
  const RADIX = 1 << 16;
  const counts = new Uint32Array(RADIX + 1);
  const offArr = aOffset.array as Float32Array;
  const colArr = aColor.array as Float32Array;
  const seedArr = aSeed.array as Float32Array;

  const sort = (camera: ThreeNS.Camera) => {
    mesh.updateMatrixWorld();
    const m = mesh.matrixWorld.elements;
    const vm = camera.matrixWorldInverse.elements;
    // Combined MV z-row coefficients (sort in view space). Uniform mesh
    // scale preserves ordering, so this is correct under cover-fit too.
    const a2 = vm[2] * m[0] + vm[6] * m[1] + vm[10] * m[2];
    const b2 = vm[2] * m[4] + vm[6] * m[5] + vm[10] * m[6];
    const c2 = vm[2] * m[8] + vm[6] * m[9] + vm[10] * m[10];
    const d2 = vm[2] * m[12] + vm[6] * m[13] + vm[10] * m[14] + vm[14];

    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < N; i++) {
      const z = a2 * base[i * 3] + b2 * base[i * 3 + 1] + c2 * base[i * 3 + 2] + d2;
      viewZ[i] = z;
      if (z < mn) mn = z;
      if (z > mx) mx = z;
    }

    // Quantise view-z into RADIX buckets, then counting-sort ascending
    // (most negative view-z = farthest = drawn first).
    const scale = (RADIX - 1) / (mx - mn || 1);
    counts.fill(0);
    for (let i = 0; i < N; i++) {
      const k = ((viewZ[i] - mn) * scale) | 0;
      keys[i] = k;
      counts[k + 1]++;
    }
    for (let b = 0; b < RADIX; b++) counts[b + 1] += counts[b];
    for (let i = 0; i < N; i++) order[counts[keys[i]]++] = i;

    for (let k = 0; k < N; k++) {
      const s = order[k];
      offArr[k * 3] = base[s * 3];
      offArr[k * 3 + 1] = base[s * 3 + 1];
      offArr[k * 3 + 2] = base[s * 3 + 2];
      colArr[k * 3] = colors[s * 3];
      colArr[k * 3 + 1] = colors[s * 3 + 1];
      colArr[k * 3 + 2] = colors[s * 3 + 2];
      seedArr[k * 3] = seeds[s * 3];
      seedArr[k * 3 + 1] = seeds[s * 3 + 1];
      seedArr[k * 3 + 2] = seeds[s * 3 + 2];
    }
    aOffset.needsUpdate = true;
    aColor.needsUpdate = true;
    aSeed.needsUpdate = true;
  };

  const dispose = () => {
    quad.dispose();
    material.dispose();
  };

  return { mesh, material, sort, dispose };
}
