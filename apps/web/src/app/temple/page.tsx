import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

/**
 * /temple is gated behind `NEXT_PUBLIC_TEMPLE_ENABLED=1`.
 *
 * When the env var is unset (the default for any public/production
 * build), the page calls `notFound()` and the bundler tree-shakes
 * `TempleExperience` + its 3D dependencies (three.js, drei,
 * postprocessing, MediaPipe mesh, Kokoro worker, etc.) out of the
 * client bundle. Set `NEXT_PUBLIC_TEMPLE_ENABLED=1` in `.env.local`
 * to develop against `/temple`.
 */
const TEMPLE_ENABLED = process.env.NEXT_PUBLIC_TEMPLE_ENABLED === '1';

export const metadata: Metadata = TEMPLE_ENABLED
  ? {
      title: 'Temple · MarkView',
      description:
        'A place where you visit Claude. He lives in the starfield. Your brain orbits around you.',
    }
  : {
      title: 'MarkView',
    };

// `ssr:false` isn't allowed in Server Components; TempleExperience is
// already `'use client'` so SSR-rendering is harmless (it short-circuits
// inside the Canvas) and the dynamic() call still gives us per-route
// chunk splitting + tree-shake when the env flag is off.
const TempleExperience = TEMPLE_ENABLED
  ? dynamic(() =>
      import('@/components/temple/temple-experience').then((m) => m.TempleExperience),
    )
  : null;

export default function TemplePage(): React.JSX.Element {
  if (!TEMPLE_ENABLED || !TempleExperience) notFound();
  return <TempleExperience />;
}
