'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VaultExperience } from '@/components/vault/vault-experience';

function RoomInner() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('id');
  return <VaultExperience roomId={roomId} />;
}

export default function VaultRoomPage() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#020617' }} />}>
      <RoomInner />
    </Suspense>
  );
}
