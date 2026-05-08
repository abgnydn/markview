/**
 * MediaPipe FaceMesh canonical model loader + surface sampler.
 *
 * The OBJ at /temple/face-mesh.obj is Google's `canonical_face_model.obj`
 * — 468 vertices, ~898 triangles, MIT-licensed. We parse just `v` and
 * `f` lines (skip vt/vn since we don't need UVs/normals).
 *
 * MediaPipe coordinates: X→right, Y→down, Z→forward, units ~cm.
 * We flip Y so up is up in three.js, then scale.
 */

export interface FaceMeshData {
  /** flat [x0,y0,z0,x1,y1,z1,…], length = 3 * vertexCount, in three.js orientation. */
  vertices: Float32Array;
  /** Triangle vertex indices, length = 3 * triangleCount. */
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  /** Per-triangle area, used for surface sampling. */
  triangleAreas: Float32Array;
  /** Cumulative distribution of triangle areas, length = triangleCount. */
  triangleCdf: Float32Array;
  totalArea: number;
}

function parseObj(text: string): { vertices: Float32Array; indices: Uint32Array } {
  const verts: number[] = [];
  const tris: number[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line[0] === '#') continue;
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      // canonical_face_model.obj is already Y-up (forehead at +Y, chin at -Y).
      // Don't flip — that's what put the face upside down before.
      verts.push(parseFloat(x), parseFloat(y), parseFloat(z));
    } else if (line.startsWith('f ')) {
      // OBJ: f a/b/c d/e/f g/h/i (1-indexed; we want vertex idx only)
      const tokens = line.slice(2).trim().split(/\s+/);
      const vIdx = tokens.map((t) => parseInt(t.split('/')[0], 10) - 1);
      // Triangle fan if it's a quad/poly.
      for (let i = 1; i < vIdx.length - 1; i++) {
        tris.push(vIdx[0], vIdx[i], vIdx[i + 1]);
      }
    }
  }
  return {
    vertices: Float32Array.from(verts),
    indices: Uint32Array.from(tris),
  };
}

function computeAreas(vertices: Float32Array, indices: Uint32Array): {
  areas: Float32Array;
  cdf: Float32Array;
  total: number;
} {
  const n = indices.length / 3;
  const areas = new Float32Array(n);
  const cdf = new Float32Array(n);
  let total = 0;
  for (let t = 0; t < n; t++) {
    const ia = indices[t * 3 + 0] * 3;
    const ib = indices[t * 3 + 1] * 3;
    const ic = indices[t * 3 + 2] * 3;
    const ax = vertices[ia + 0], ay = vertices[ia + 1], az = vertices[ia + 2];
    const bx = vertices[ib + 0], by = vertices[ib + 1], bz = vertices[ib + 2];
    const cx = vertices[ic + 0], cy = vertices[ic + 1], cz = vertices[ic + 2];
    const ex1 = bx - ax, ey1 = by - ay, ez1 = bz - az;
    const ex2 = cx - ax, ey2 = cy - ay, ez2 = cz - az;
    // |e1 × e2| / 2
    const nx = ey1 * ez2 - ez1 * ey2;
    const ny = ez1 * ex2 - ex1 * ez2;
    const nz = ex1 * ey2 - ey1 * ex2;
    const area = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
    areas[t] = area;
    total += area;
    cdf[t] = total;
  }
  return { areas, cdf, total };
}

let cached: Promise<FaceMeshData> | null = null;

export function loadFaceMesh(url = '/temple/face-mesh.obj'): Promise<FaceMeshData> {
  if (cached) return cached;
  cached = (async () => {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`face-mesh fetch failed: ${res.status}`);
    const text = await res.text();
    const { vertices, indices } = parseObj(text);
    const { areas, cdf, total } = computeAreas(vertices, indices);
    return {
      vertices,
      indices,
      vertexCount: vertices.length / 3,
      triangleCount: indices.length / 3,
      triangleAreas: areas,
      triangleCdf: cdf,
      totalArea: total,
    };
  })();
  return cached;
}

/** Binary-search the CDF for area-weighted triangle sampling. */
function pickTriangle(cdf: Float32Array, total: number): number {
  const r = Math.random() * total;
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cdf[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Sample N points uniformly across the mesh surface. Returns a flat
 * Float32Array of [x0,y0,z0,...] positions, scaled by `scale` (mesh
 * is in MediaPipe cm units; scale ≈ FACE.radius / 11 fills the same
 * apparent size as the previous SDF disc).
 */
export function sampleSurface(
  mesh: FaceMeshData,
  n: number,
  scale: number,
): Float32Array {
  const out = new Float32Array(n * 3);
  const { vertices: V, indices: I, triangleCdf, totalArea } = mesh;
  for (let i = 0; i < n; i++) {
    const t = pickTriangle(triangleCdf, totalArea);
    const ia = I[t * 3 + 0] * 3;
    const ib = I[t * 3 + 1] * 3;
    const ic = I[t * 3 + 2] * 3;
    // Uniform barycentric over a triangle:
    // u = 1 - sqrt(r1), v = sqrt(r1) * (1 - r2), w = sqrt(r1) * r2
    const r1 = Math.random();
    const r2 = Math.random();
    const sr1 = Math.sqrt(r1);
    const u = 1 - sr1;
    const v = sr1 * (1 - r2);
    const w = sr1 * r2;
    out[i * 3 + 0] = (V[ia + 0] * u + V[ib + 0] * v + V[ic + 0] * w) * scale;
    out[i * 3 + 1] = (V[ia + 1] * u + V[ib + 1] * v + V[ic + 1] * w) * scale;
    out[i * 3 + 2] = (V[ia + 2] * u + V[ib + 2] * v + V[ic + 2] * w) * scale;
  }
  return out;
}

/** Get a single vertex's world position (after Y-flip + scale). */
export function landmark(
  mesh: FaceMeshData,
  index: number,
  scale: number,
): [number, number, number] {
  const i = index * 3;
  return [
    mesh.vertices[i + 0] * scale,
    mesh.vertices[i + 1] * scale,
    mesh.vertices[i + 2] * scale,
  ];
}

// Well-known MediaPipe FaceMesh landmark indices we care about.
export const LANDMARKS = {
  noseTip: 1,
  rightEyeOuter: 33,   // visitor's right (their left when facing them)
  leftEyeOuter: 263,
  rightEyeCenter: 468 - 1, // canonical model has 468 verts; eye iris extension 468..477 absent
  // Better: average ring of vertices around each eye for a stable center.
  rightEyeRing: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  leftEyeRing: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  upperLip: 13,
  lowerLip: 14,
  chin: 152,
  forehead: 10,
  rightTemple: 234,
  leftTemple: 454,
} as const;

/** Compute an eye-center position by averaging a ring of vertices. */
export function eyeCenter(
  mesh: FaceMeshData,
  ring: readonly number[],
  scale: number,
): [number, number, number] {
  let x = 0, y = 0, z = 0;
  for (const idx of ring) {
    const i = idx * 3;
    x += mesh.vertices[i + 0];
    y += mesh.vertices[i + 1];
    z += mesh.vertices[i + 2];
  }
  const n = ring.length;
  return [(x / n) * scale, (y / n) * scale, (z / n) * scale];
}
