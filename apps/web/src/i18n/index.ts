// Minimal dependency-free i18n for the vault surface.
//
// Turkish is the first-class locale because DavaKasası ships on top of this
// codebase and the working agreement is "never ship a DavaKasası view with only
// English microcopy." English is the fallback for any key not yet translated.
//
// Locale selection order (first match wins):
//   1. Explicit `?lang=tr` or `?lang=en` query param.
//   2. `<html lang>` attribute if present and supported.
//   3. `navigator.language` prefix (`tr*` → tr, everything else → en).
//   4. Hardcoded default: 'en'.
//
// No React context, no loader, no runtime dep. `t(key)` is a plain function
// that reads from a JSON dict and interpolates `{name}` placeholders.

import trDict from './tr.json';
import enDict from './en.json';

export type Locale = 'tr' | 'en';

// tr.json is the source-of-truth for the key set; en.json is checked at test
// time for parity. The union is derived from tr so typos fail at compile time.
export type TKey = keyof typeof trDict;

const DICTS: Record<Locale, Record<string, string>> = {
  tr: trDict as Record<string, string>,
  en: enDict as Record<string, string>,
};

let currentLocale: Locale = 'en';

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('lang');
    if (q === 'tr' || q === 'en') return q;
  } catch {
    // URLSearchParams throws on exotic locations — fall through.
  }
  const htmlLang = document.documentElement.lang;
  if (htmlLang?.toLowerCase().startsWith('tr')) return 'tr';
  if (htmlLang?.toLowerCase().startsWith('en')) return 'en';
  const nav = navigator.language?.toLowerCase() ?? '';
  if (nav.startsWith('tr')) return 'tr';
  return 'en';
}

let initialised = false;
function ensureInit(): void {
  if (initialised) return;
  initialised = true;
  currentLocale = detectLocale();
}

export function setLocale(loc: Locale): void {
  initialised = true;
  currentLocale = loc;
}

export function getLocale(): Locale {
  ensureInit();
  return currentLocale;
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  ensureInit();
  const primary = DICTS[currentLocale][key];
  const raw = primary ?? DICTS.en[key] ?? (key as string);
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

// Test-only hook: wipe detection memoisation so a test can re-detect per case.
export function __resetLocaleForTests(): void {
  initialised = false;
  currentLocale = 'en';
}
