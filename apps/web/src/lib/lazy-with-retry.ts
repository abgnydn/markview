// SPDX-License-Identifier: Apache-2.0

import { lazy, type ComponentType } from 'react';

/**
 * `React.lazy` with a couple of retries. A dynamic import can fail on a
 * transient network blip or a just-deployed hash change; without a retry
 * the failure propagates to the nearest error boundary (or, if there is
 * none, unmounts the whole tree to a blank screen). Retrying first turns
 * most of those into a successful load once the network is back.
 *
 * After the retries are exhausted the original error is rethrown so an
 * ErrorBoundary can show a recovery UI. We deliberately do NOT auto-reload
 * — offline, that would loop.
 */
export function lazyWithRetry<
  // Mirrors React.lazy's own signature — component props are heterogeneous,
  // so `any` here is the same escape hatch React uses in its typings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ComponentType<any>,
>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 400,
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }
    throw lastError;
  });
}
