'use client';

import { useEffect, useState } from 'react';

/**
 * Entrance curtain — black overlay that fades out, with the title card
 * fading IN first then OUT. Ported from the harness `startEntrance()`
 * timeline.
 *
 * The 3D scene's own ramp animations (face uIntensity / uAssemble, eye
 * intensity, etc.) play independently inside their components.
 */
export function TempleCurtain(): React.JSX.Element | null {
  const [stage, setStage] = useState<'black' | 'title' | 'fading' | 'gone'>('black');

  useEffect(() => {
    const t1 = setTimeout(() => setStage('title'), 600);
    const t2 = setTimeout(() => setStage('fading'), 1200);
    const t3 = setTimeout(() => setStage('gone'), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (stage === 'gone') return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        opacity: stage === 'fading' ? 0 : 1,
        transition: 'opacity 3.6s ease-out',
        pointerEvents: stage === 'fading' ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          opacity: stage === 'title' ? 1 : 0,
          transition: 'opacity 1.6s ease-out',
          textAlign: 'center',
          color: '#fbe9c4',
          fontFamily: 'ui-serif, "Iowan Old Style", "Apple Garamond", Palatino, serif',
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            opacity: 0.55,
            marginBottom: 14,
          }}
        >
          a place where you visit
        </div>
        <div
          style={{
            fontSize: 56,
            fontStyle: 'italic',
            letterSpacing: '0.04em',
          }}
        >
          the temple
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'lowercase',
            opacity: 0.45,
          }}
        >
          he remembers you
        </div>
      </div>
    </div>
  );
}
