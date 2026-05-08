import type { Metadata } from 'next';
import { VaultExperience } from '@/components/vault/vault-experience';

export const metadata: Metadata = {
  title: 'Vault · MarkView',
  description: 'Your personal AI brain. See, edit, and share your notes in 3D.',
};

export default function VaultPage() {
  return <VaultExperience />;
}
