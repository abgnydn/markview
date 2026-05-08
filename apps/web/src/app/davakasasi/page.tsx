import type { Metadata } from 'next';
import { VaultExperience } from '@/components/vault/vault-experience';

export const metadata: Metadata = {
  title: 'DavaKasası — Dosya Kasası',
  description:
    'Türk avukatlar için yerel-öncelikli yapay zeka dosya kasası. Müvekkil dosyaları cihazdan çıkmaz.',
};

export default function DavaKasasiPage() {
  return <VaultExperience brand="davakasasi" forceLocale="tr" />;
}
