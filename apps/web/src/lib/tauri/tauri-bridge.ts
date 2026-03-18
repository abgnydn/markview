/**
 * tauri-bridge.ts
 *
 * Detects if running inside Tauri and:
 * 1. On init: pulls any pending file that was opened before the bridge was ready
 * 2. Listens for `file-opened` events for files opened while app is already running
 *
 * No-op in the browser / extension environment.
 */

import type { Event as TauriEvent } from '@tauri-apps/api/event';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface FileOpenedPayload {
  path: string;
  content: string;
  filename: string;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

let initialized = false;

function loadFilePayload(payload: FileOpenedPayload) {
  if (!payload.content) return;
  const store = useWorkspaceStore.getState();
  const title = payload.filename.replace(/\.(md|markdown)$/i, '');
  store.createWorkspace(title, [{ filename: payload.filename, content: payload.content }]);
}

export async function initTauriBridge(): Promise<void> {
  if (!isTauri() || initialized) return;
  initialized = true;

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const { invoke } = await import('@tauri-apps/api/core');

    // 1. Pull any file that arrived before this listener was ready
    const pending = await invoke<FileOpenedPayload | null>('get_pending_file');
    if (pending) {
      loadFilePayload(pending);
    }

    // 2. Listen for files opened while the app is already running
    await listen('file-opened', (event: TauriEvent<FileOpenedPayload>) => {
      loadFilePayload(event.payload);
    });

    console.log('[Tauri] Bridge initialized');
  } catch (err) {
    console.warn('[Tauri] Failed to initialize bridge:', err);
  }
}
