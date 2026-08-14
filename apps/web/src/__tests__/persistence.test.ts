import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ensurePersistentStorage keeps a module-level "asked this session" flag, so
// every case re-imports the module through vi.resetModules() to get a fresh
// one. jsdom gives us a real localStorage and a navigator with no
// StorageManager — exactly the "feature absent" baseline we need to cover.

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

/** Install a fake StorageManager; pass `null` to remove the API entirely. */
function setStorage(value: object | null): void {
  Object.defineProperty(navigator, 'storage', { value, configurable: true });
}

async function load() {
  vi.resetModules();
  const mod = await import('@/lib/storage/persistence');
  return mod.ensurePersistentStorage;
}

describe('ensurePersistentStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    setUserAgent(CHROME_UA);
  });

  afterEach(() => {
    setStorage(undefined as unknown as object);
    vi.restoreAllMocks();
  });

  it('resolves quietly when navigator.storage is missing', async () => {
    setStorage(null);
    const ensure = await load();
    await expect(ensure()).resolves.toBeUndefined();
  });

  it('resolves quietly when persist() is not implemented', async () => {
    setStorage({ persisted: async () => false });
    const ensure = await load();
    await expect(ensure()).resolves.toBeUndefined();
  });

  it('records the grant so later sessions skip the call', async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persist, persisted: async () => false });

    const ensure = await load();
    await ensure();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('mv-storage-persisted')).toBe('1');

    // A fresh session with the flag still set must not ask again.
    const ensureAgain = await load();
    await ensureAgain();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('skips persist() when the origin is already persisted', async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persist, persisted: async () => true });

    const ensure = await load();
    await ensure();

    expect(persist).not.toHaveBeenCalled();
    expect(localStorage.getItem('mv-storage-persisted')).toBe('1');
  });

  it('asks at most once per session', async () => {
    const persist = vi.fn(async () => false);
    setStorage({ persist, persisted: async () => false });

    const ensure = await load();
    await ensure();
    await ensure();
    await ensure();

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('leaves no flag when denied, so the next session re-asks', async () => {
    const persist = vi.fn(async () => false);
    setStorage({ persist, persisted: async () => false });

    const ensure = await load();
    await ensure();
    expect(localStorage.getItem('mv-storage-persisted')).toBeNull();

    const ensureNextSession = await load();
    await ensureNextSession();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('warns on Safari only when the request did not take', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setStorage({ persist: async () => false, persisted: async () => false });
    setUserAgent(CHROME_UA);
    await (await load())();
    expect(warn).not.toHaveBeenCalled();

    setUserAgent(SAFARI_UA);
    await (await load())();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/Safari/);
  });

  it('never rejects when the storage API throws', async () => {
    setStorage({
      persist: async () => {
        throw new Error('nope');
      },
      persisted: async () => false,
    });

    const ensure = await load();
    await expect(ensure()).resolves.toBeUndefined();
  });
});
