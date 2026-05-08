import type { Metadata } from 'next';
import { BrainExperience } from '@/components/vault/brain-experience';

export const metadata: Metadata = {
  title: 'Brain · MarkView',
  description:
    'Live 3D view of your ~/brain vault and every Claude Code session writing into it.',
};

export default function BrainPage(): React.JSX.Element {
  return <BrainExperience />;
}
