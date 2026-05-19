'use client';

import dynamic from 'next/dynamic';

// Code-split wrapper. Lives in a Client Component because `next/dynamic` with
// `ssr: false` is only allowed outside Server Components. Keeps Three.js +
// transformers.js + the 3D orbit out of every other route's first-load JS.
const VaultExperience = dynamic(
  () => import('./vault-experience').then(m => m.VaultExperience),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: 'rgba(226, 232, 240, 0.55)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '13px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Loading vault…
      </div>
    ),
  },
);

export function VaultClient({ roomId }: { roomId?: string | null }) {
  return <VaultExperience roomId={roomId ?? null} />;
}
