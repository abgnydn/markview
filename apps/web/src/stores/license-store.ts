import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LicenseState {
  isPro: boolean;
  licenseKey: string | null;
  instanceId: string | null;
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string }>;
  removeLicense: () => void;
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      isPro: false,
      licenseKey: null,
      instanceId: null,

      activateLicense: async (key: string) => {
        try {
          const res = await fetch('/api/license/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: key }),
          });

          const data = await res.json();

          if (data.valid) {
            set({ 
              isPro: true, 
              licenseKey: key,
              instanceId: data.instanceId 
            });
            return { success: true };
          }

          return { success: false, error: data.error || 'Invalid license key' };
        } catch (error) {
          console.error('License validation failed:', error);
          return { success: false, error: 'Failed to connect to verification server' };
        }
      },

      removeLicense: () => {
        set({ isPro: false, licenseKey: null, instanceId: null });
      },
    }),
    {
      name: 'markview-license-storage',
    }
  )
);
