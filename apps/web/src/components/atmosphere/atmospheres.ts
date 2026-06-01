// SPDX-License-Identifier: Apache-2.0

/**
 * Atmosphere registry — curated packs of public-domain paintings, one
 * per ambient mood. Each pack contains multiple paintings that rotate
 * daily (so the page feels like a living gallery rather than a fixed
 * wallpaper). The user can also pin a specific painting by clicking the
 * "next painting" button — that choice persists to localStorage.
 *
 * Every painting is in the public domain (CC0) and the digitization
 * comes from the Met's Open Access program.
 */

import type { Atmosphere } from '@/stores/theme-store';

export type ParticleKind = 'none' | 'petals' | 'snow' | 'spray' | 'motes';

export interface Painting {
  /** Stable id used for the cycle index + localStorage key. */
  key: string;
  imageSrc: string;
  attribution: string;
  attributionDetail: string;
  focal: string;
}

export interface AtmosphereConfig {
  id: Exclude<Atmosphere, 'none'>;
  label: string;
  particles: ParticleKind;
  opacityLight: number;
  opacityDark: number;
  filterLight: string;
  filterDark: string;
  /** Ordered list — today's painting picked by day-of-year modulo. */
  paintings: Painting[];
}

export const ATMOSPHERES: Record<Exclude<Atmosphere, 'none'>, AtmosphereConfig> = {
  fuji: {
    id: 'fuji',
    label: 'Fuji',
    particles: 'petals',
    opacityLight: 0.66,
    opacityDark: 0.42,
    filterLight: 'saturate(0.92) contrast(0.94) brightness(1.02)',
    filterDark: 'saturate(0.78) contrast(0.92) brightness(0.85)',
    paintings: [
      {
        key: 'red-fuji',
        imageSrc: '/atmospheres/fuji-hokusai.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Gaifū kaisei (Red Fuji), c. 1830 · The Met (CC0)',
        focal: 'center 60%',
      },
      {
        key: 'storm-below',
        imageSrc: '/atmospheres/fuji-36492.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Storm below Mount Fuji, c. 1830-31 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'noboto-bay',
        imageSrc: '/atmospheres/fuji-56216.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Noboto Bay, c. 1830-32 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'lake-suwa',
        imageSrc: '/atmospheres/fuji-56240.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Lake Suwa in Shinano, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'fujimigahara',
        imageSrc: '/atmospheres/fuji-56214.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Fujimigahara in Owari, c. 1830-32 · The Met (CC0)',
        focal: 'center 52%',
      },
      {
        key: 'ushibori',
        imageSrc: '/atmospheres/fuji-56132.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Ushibori in Hitachi, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'nakahara',
        imageSrc: '/atmospheres/fuji-56384.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Nakahara in Sagami, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'shichirigahama',
        imageSrc: '/atmospheres/fuji-36496.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Shichirigahama in Sagami, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
    ],
  },
  wave: {
    id: 'wave',
    label: 'Wave',
    particles: 'spray',
    opacityLight: 0.62,
    opacityDark: 0.40,
    filterLight: 'saturate(0.95) contrast(0.96)',
    filterDark: 'saturate(0.82) contrast(0.94) brightness(0.78)',
    paintings: [
      {
        key: 'great-wave',
        imageSrc: '/atmospheres/wave-hokusai.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Under the Wave off Kanagawa, c. 1831 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'umezawa-manor',
        imageSrc: '/atmospheres/wave-36501.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Umezawa Manor in Sagami, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'kazusa-sea',
        imageSrc: '/atmospheres/wave-56238.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'At Sea off Kazusa, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'yahagi-bridge',
        imageSrc: '/atmospheres/wave-53700.jpg',
        attribution: 'Katsushika Hokusai',
        attributionDetail: 'Yahagi Bridge at Okazaki, c. 1830-32 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'calm-sea',
        imageSrc: '/atmospheres/wave-436005.jpg',
        attribution: 'Gustave Courbet',
        attributionDetail: 'The Calm Sea, 1869 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'la-vague',
        imageSrc: '/atmospheres/wave-399926.jpg',
        attribution: 'Henri-Charles Guérard',
        attributionDetail: 'La Vague (The Mistral), Marseille, c. 1893 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'foilhummerum-bay',
        imageSrc: '/atmospheres/wave-383817.jpg',
        attribution: 'Robert Charles Dudley',
        attributionDetail: 'Foilhummerum Bay, Valentia, 1865-66 · The Met (CC0)',
        focal: 'center 52%',
      },
    ],
  },
  snow: {
    id: 'snow',
    label: 'Snow',
    particles: 'snow',
    opacityLight: 0.70,
    opacityDark: 0.50,
    filterLight: 'saturate(0.85) contrast(0.95) brightness(1.05)',
    filterDark: 'saturate(0.70) contrast(0.95) brightness(0.92)',
    paintings: [
      // snow-36531 and snow-56188 are different impressions of the SAME
      // Karasaki Pine in Rain print and read as duplicates when rotated;
      // dropped them. snow-57043 is technically rain (Shōno) but visually
      // distinct from the Kanbara village so the rotation reads as two
      // distinct atmospheres rather than four near-clones.
      {
        key: 'kanbara-evening',
        imageSrc: '/atmospheres/snow-hiroshige.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'A Snowy Evening at Kanbara, 1834 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'shono-white-rain',
        imageSrc: '/atmospheres/snow-57043.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'White Rain at Shōno, 1833-34 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'evening-snow',
        imageSrc: '/atmospheres/snow-57044.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'Evening Snow · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'river-gorge-snow',
        imageSrc: '/atmospheres/snow-55628.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'River Gorge in Snow · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'uchikawa-snow',
        imageSrc: '/atmospheres/snow-56890.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'Evening Snow at Uchikawa, c. 1836 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'kanda-temple-snow',
        imageSrc: '/atmospheres/snow-55604.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'Kanda Myōjin Shrine in Snow, 1861 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'gion-shrine-snow',
        imageSrc: '/atmospheres/snow-55998.jpg',
        attribution: 'Utagawa Hiroshige',
        attributionDetail: 'Gion Shrine in Snow · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'bamboo-in-snow',
        imageSrc: '/atmospheres/snow-49068.jpg',
        attribution: 'Taihō Shōkon',
        attributionDetail: 'Bamboo in Snow, 1774 · The Met (CC0)',
        focal: 'center 50%',
      },
      {
        key: 'forest-winter-sunset',
        imageSrc: '/atmospheres/snow-438816.jpg',
        attribution: 'Théodore Rousseau',
        attributionDetail: 'The Forest in Winter at Sunset, c. 1846-67 · The Met (CC0)',
        focal: 'center 52%',
      },
    ],
  },
  fields: {
    id: 'fields',
    label: 'Fields',
    particles: 'motes',
    opacityLight: 0.55,
    opacityDark: 0.36,
    filterLight: 'saturate(0.9) contrast(0.96)',
    filterDark: 'saturate(0.78) contrast(0.92) brightness(0.78)',
    paintings: [
      {
        key: 'wheat-field-cypresses',
        imageSrc: '/atmospheres/fields-vangogh.jpg',
        attribution: 'Vincent van Gogh',
        attributionDetail: 'Wheat Field with Cypresses, 1889 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'cypresses',
        imageSrc: '/atmospheres/fields-437980.jpg',
        attribution: 'Vincent van Gogh',
        attributionDetail: 'Cypresses, 1889 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'olive-trees',
        imageSrc: '/atmospheres/fields-437998.jpg',
        attribution: 'Vincent van Gogh',
        attributionDetail: 'Olive Trees, 1889 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'wheat-field',
        imageSrc: '/atmospheres/fields-335537.jpg',
        attribution: 'Vincent van Gogh',
        attributionDetail: 'Wheat Field, 1888 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'the-harvesters',
        imageSrc: '/atmospheres/fields-435809.jpg',
        attribution: 'Pieter Bruegel the Elder',
        attributionDetail: 'The Harvesters, 1565 · The Met (CC0)',
        focal: 'center 55%',
      },
      {
        key: 'grainfields',
        imageSrc: '/atmospheres/fields-437547.jpg',
        attribution: 'Jacob van Ruisdael',
        attributionDetail: 'Grainfields, late 1660s · The Met (CC0)',
        focal: 'center 50%',
      },
    ],
  },
};

/**
 * Rotation tempo — how fast the active painting rotates through its pack.
 *   manual      — never auto-advance; sticks to whatever the user pinned
 *   session     — random pick each page load
 *   daily       — one painting per local day (the default)
 *   hourly      — one per hour
 *   minutes-5   — cycle every 5 minutes
 *   minutes-15  — cycle every 15 minutes
 */
export type RotationTempo = 'manual' | 'session' | 'daily' | 'hourly' | 'minutes-5' | 'minutes-15';

const ROTATION_KEY = 'markview-painting-tempo';

export function getRotationTempo(): RotationTempo {
  try {
    const v = localStorage.getItem(ROTATION_KEY) as RotationTempo | null;
    if (v && ['manual', 'session', 'daily', 'hourly', 'minutes-5', 'minutes-15'].includes(v)) {
      return v;
    }
  } catch { /* ignore */ }
  return 'daily';
}

export function setRotationTempo(t: RotationTempo): void {
  try { localStorage.setItem(ROTATION_KEY, t); } catch { /* ignore */ }
}

// Stable session seed for the 'session' tempo so all atmospheres pick
// the same "slot" within a session but a different one per session.
const SESSION_SEED = Math.floor(Math.random() * 1e9);

/** Compute the rotation slot index for the active tempo. */
function rotationIndex(tempo: RotationTempo, total: number): number {
  switch (tempo) {
    case 'manual':     return 0;
    case 'session':    return SESSION_SEED % total;
    case 'hourly':     return Math.floor(Date.now() / 3_600_000) % total;
    case 'minutes-5':  return Math.floor(Date.now() / 300_000) % total;
    case 'minutes-15': return Math.floor(Date.now() / 900_000) % total;
    case 'daily':
    default:           return dayOfYear(new Date()) % total;
  }
}

/**
 * Returns the painting that should display *right now* for the given
 * atmosphere. Reads the global rotation tempo. If the user pinned a
 * painting via the cycle button OR if tempo is 'manual', the pinned
 * index wins.
 */
export function pickPaintingFor(id: Exclude<Atmosphere, 'none'>): Painting {
  const cfg = ATMOSPHERES[id];
  const n = cfg.paintings.length;
  const tempo = getRotationTempo();
  const pinned = readPinnedIndex(id);
  if (pinned !== null && pinned >= 0 && pinned < n) {
    return cfg.paintings[pinned];
  }
  return cfg.paintings[rotationIndex(tempo, n)];
}

export function nextPaintingFor(id: Exclude<Atmosphere, 'none'>): number {
  const cfg = ATMOSPHERES[id];
  const n = cfg.paintings.length;
  const tempo = getRotationTempo();
  const current = readPinnedIndex(id) ?? rotationIndex(tempo, n);
  const next = (current + 1) % n;
  writePinnedIndex(id, next);
  return next;
}

export function shufflePaintingFor(id: Exclude<Atmosphere, 'none'>): number {
  const cfg = ATMOSPHERES[id];
  const n = cfg.paintings.length;
  const current = readPinnedIndex(id) ?? 0;
  let next = Math.floor(Math.random() * n);
  if (n > 1 && next === current) next = (next + 1) % n;
  writePinnedIndex(id, next);
  return next;
}

export function resetPaintingFor(id: Exclude<Atmosphere, 'none'>): void {
  try { localStorage.removeItem(`markview-painting-${id}`); } catch { /* ignore */ }
}

/** Milliseconds until the *next* rotation tick for the given tempo. Used
    by the UI to schedule a re-render when timed rotation is on. */
export function nextRotationAtMs(tempo: RotationTempo): number {
  const now = Date.now();
  switch (tempo) {
    case 'hourly':      return 3_600_000 - (now % 3_600_000);
    case 'minutes-5':   return 300_000 - (now % 300_000);
    case 'minutes-15':  return 900_000 - (now % 900_000);
    case 'daily':       return (24 * 3_600_000) - (now % (24 * 3_600_000));
    default:            return Number.POSITIVE_INFINITY;
  }
}

function readPinnedIndex(id: string): number | null {
  try {
    const raw = localStorage.getItem(`markview-painting-${id}`);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function writePinnedIndex(id: string, idx: number): void {
  try { localStorage.setItem(`markview-painting-${id}`, String(idx)); } catch { /* ignore */ }
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}
