import { describe, it, expect, beforeEach } from 'vitest';
import { useLicenseStore } from '@/stores/license-store';

// License store gates Pro features. Activation is currently manual (email
// the contact address) — these tests pin that contract so future automated
// activation doesn't silently flip premium features back on.

describe('license-store', () => {
  beforeEach(() => {
    useLicenseStore.setState({
      isPro: false,
      licenseKey: null,
      instanceId: null,
    });
  });

  it('defaults to free tier', () => {
    expect(useLicenseStore.getState().isPro).toBe(false);
    expect(useLicenseStore.getState().licenseKey).toBeNull();
  });

  it('activateLicense returns failure with contact message (manual flow)', async () => {
    const result = await useLicenseStore.getState().activateLicense('TEST-KEY');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email|manually/i);
  });

  it('activateLicense never sets isPro automatically', async () => {
    await useLicenseStore.getState().activateLicense('TEST-KEY');
    expect(useLicenseStore.getState().isPro).toBe(false);
  });

  it('removeLicense clears all fields', () => {
    useLicenseStore.setState({ isPro: true, licenseKey: 'X', instanceId: 'Y' });
    useLicenseStore.getState().removeLicense();
    expect(useLicenseStore.getState().isPro).toBe(false);
    expect(useLicenseStore.getState().licenseKey).toBeNull();
    expect(useLicenseStore.getState().instanceId).toBeNull();
  });
});
