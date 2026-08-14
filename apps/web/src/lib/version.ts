// SPDX-License-Identifier: Apache-2.0

/**
 * Single source of truth for the published desktop build.
 *
 * Bump this in the same breath as `apps/desktop/src-tauri/tauri.conf.json`
 * + `Cargo.toml` when tagging `desktop-v*`, and only AFTER the GitHub
 * release is published (`gh release edit <tag> --draft=false --latest`) —
 * the landing page's download URLs 404 until the assets exist.
 *
 * Consumers: the landing download buttons and the desktop update check.
 */
export const DESKTOP_VERSION = '0.3.2';

export const RELEASES_LATEST_URL = 'https://github.com/abgnydn/markview/releases/latest';

/** `1.2.10` > `1.2.9` — numeric, segment-wise. Returns true when `a` is
 *  strictly newer than `b`. Non-numeric suffixes are ignored. */
export function isNewerVersion(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  const [av, bv] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
