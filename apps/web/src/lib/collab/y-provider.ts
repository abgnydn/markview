'use client';

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollabSession {
  ydoc: Y.Doc;
  provider: WebrtcProvider;
  roomId: string;
  destroy: () => void;
}

// ---------------------------------------------------------------------------
// Room ID generation
// ---------------------------------------------------------------------------

/** Generate a short, URL-safe room ID */
export function generateRoomId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8);
  return `mkv-${id}`;
}

/** Extract room ID from URL */
export function getRoomIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

/** Build share URL from room ID */
export function getShareUrl(roomId: string): string {
  if (typeof window === 'undefined') return '';
  const base = window.location.origin;
  return `${base}?room=${roomId}`;
}

// ---------------------------------------------------------------------------
// Provider creation
// ---------------------------------------------------------------------------

const SIGNALING_SERVERS = ['wss://signaling.yjs.dev'];

/** Create a new Y.js doc + WebRTC provider for a room */
export function createProvider(roomId: string): CollabSession {
  const ydoc = new Y.Doc();

  const provider = new WebrtcProvider(roomId, ydoc, {
    signaling: SIGNALING_SERVERS,
  });

  return {
    ydoc,
    provider,
    roomId,
    destroy: () => {
      provider.destroy();
      ydoc.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Workspace → Y.Doc (host populates the shared document)
// ---------------------------------------------------------------------------

/** Load workspace files into a Y.js document (called by host) */
export function populateYDoc(
  ydoc: Y.Doc,
  workspaceTitle: string,
  files: Array<{ id: string; filename: string; displayName: string; content: string; order: number }>
): void {
  ydoc.transact(() => {
    // Workspace meta
    const meta = ydoc.getMap('meta');
    meta.set('title', workspaceTitle);
    meta.set('createdAt', Date.now());

    // File list (ordered metadata)
    const fileList = ydoc.getArray('files');
    for (const f of files) {
      const fileMap = new Y.Map();
      fileMap.set('id', f.id);
      fileMap.set('filename', f.filename);
      fileMap.set('displayName', f.displayName);
      fileMap.set('order', f.order);
      fileList.push([fileMap]);
    }

    // File contents (one Y.Text per file for future collaborative editing)
    const contents = ydoc.getMap('contents');
    for (const f of files) {
      const ytext = new Y.Text();
      ytext.insert(0, f.content);
      contents.set(f.id, ytext);
    }
  });
}

// ---------------------------------------------------------------------------
// Y.Doc → Local state (guests read from the shared document)
// ---------------------------------------------------------------------------

export interface SyncedFile {
  id: string;
  filename: string;
  displayName: string;
  order: number;
}

/** Read current files from Y.Doc */
export function readFilesFromYDoc(ydoc: Y.Doc): SyncedFile[] {
  const fileList = ydoc.getArray('files');
  const result: SyncedFile[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const fileMap = fileList.get(i) as Y.Map<unknown>;
    result.push({
      id: fileMap.get('id') as string,
      filename: fileMap.get('filename') as string,
      displayName: fileMap.get('displayName') as string,
      order: fileMap.get('order') as number,
    });
  }

  return result.sort((a, b) => a.order - b.order);
}

/** Read a file's content from Y.Doc */
export function readFileContent(ydoc: Y.Doc, fileId: string): string | null {
  const contents = ydoc.getMap('contents');
  const ytext = contents.get(fileId) as Y.Text | undefined;
  return ytext ? ytext.toString() : null;
}

/** Read workspace title from Y.Doc */
export function readWorkspaceTitle(ydoc: Y.Doc): string {
  const meta = ydoc.getMap('meta');
  return (meta.get('title') as string) || 'Shared Workspace';
}
