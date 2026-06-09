// SPDX-License-Identifier: Apache-2.0

/**
 * Tauri desktop bridge.
 *
 * When MarkView runs inside the Tauri shell (the downloadable desktop app),
 * the native side lets the OS open `.md` files with MarkView. The Rust side
 * (apps/desktop/src-tauri) either:
 *   1. stashes a file passed at launch (argv / macOS Apple Event) and exposes
 *      it via the `get_pending_file` command, or
 *   2. emits a `file-opened` event for files opened while the app is running.
 *
 * This module pulls the pending file on init and listens for later opens,
 * loading each into a new workspace. It is a NO-OP in the browser / PWA —
 * `withGlobalTauri: true` in tauri.conf.json means we can use the global
 * `window.__TAURI__` and avoid bundling `@tauri-apps/api` into the web build.
 */

import { useWorkspaceStore } from '@/stores/workspace-store';

interface FileOpenedPayload {
  path: string;
  content: string;
  filename: string;
}

interface TauriGlobal {
  core: { invoke: <T>(cmd: string) => Promise<T> };
  event: {
    listen: <T>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>;
  };
}

function getTauri(): TauriGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__ ?? null;
}

export function isTauri(): boolean {
  return getTauri() !== null;
}

let initialized = false;

function loadFilePayload(payload: FileOpenedPayload): void {
  if (!payload?.content) return;
  const title = payload.filename.replace(/\.(md|markdown)$/i, '');
  void useWorkspaceStore.getState().createWorkspace(title, [
    { filename: payload.filename, content: payload.content },
  ]);
}

export async function initTauriBridge(): Promise<void> {
  const tauri = getTauri();
  if (!tauri || initialized) return;
  initialized = true;

  try {
    // 1. A file opened *before* this listener was ready (launch-time open).
    const pending = await tauri.core.invoke<FileOpenedPayload | null>('get_pending_file');
    if (pending) loadFilePayload(pending);

    // 2. Files opened while the app is already running.
    await tauri.event.listen<FileOpenedPayload>('file-opened', (e) => loadFilePayload(e.payload));

    console.log('[Tauri] bridge initialized');
  } catch (err) {
    console.warn('[Tauri] bridge init failed:', err);
  }
}
