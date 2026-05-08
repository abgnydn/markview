import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Pro licenses are currently handled manually — there is no automated
 * activation endpoint. If a user enters a key, surface a contact message
 * instead of hitting a backend that no longer exists.
 *
 * Any previously-persisted `isPro: true` state from localStorage still
 * works (keys issued before the change are grandfathered in until they
 * deactivate); only new activations are paused.
 */
const CONTACT_EMAIL = 'abgunaydin94@gmail.com';

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

      activateLicense: async (_key: string) => {
        // Automated activation is disabled — direct the user to email.
        return {
          success: false,
          error: `Pro licenses are handled manually right now — please email ${CONTACT_EMAIL} and we'll activate your key.`,
        };
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
