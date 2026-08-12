
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

// URL/id helpers live in room-url.ts (dependency-light so the landing
// page can import them without pulling yjs). Re-exported here for the
// existing import sites and tests.
export { generateRoomId, generateRoomSecret, getRoomIdFromUrl, getRoomSecretFromUrl, getShareUrl } from './room-url';

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






// ---------------------------------------------------------------------------
// Provider creation
// ---------------------------------------------------------------------------

// y-webrtc connects to all servers in this list in parallel; the first
// one that finds a peer wins. Our own DO is the only entry — the public
// `signaling.yjs.dev` host was deprecated and now refuses connections,
// so listing it just produces noisy WebSocket errors in the console.
const SIGNALING_HOST = 'wss://markview-yjs.abgunaydin94.workers.dev';

/** Signaling endpoint for a room. The room id rides the PATH so the
 *  worker can route each room to its own Durable Object instead of
 *  funnelling every room in the world through one always-hot instance
 *  (one busy/abusive room used to degrade signaling for everyone).
 *  The id is already public in the share link's query string; the
 *  encrypting secret stays in the fragment and never leaves the browser. */
function signalingServers(roomId: string): string[] {
  return [`${SIGNALING_HOST}/r/${encodeURIComponent(roomId)}`];
}

// Explicit ICE config instead of simple-peer's defaults. STUN handles the
// ~85-90% of pairs where hole-punching works; the TURN slot is where a
// relay goes if/when connectivity complaints justify one (TURN relays the
// already-DTLS-encrypted stream, so content stays end-to-end encrypted —
// it would NOT weaken the privacy story).
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  // { urls: 'turn:…', username: '…', credential: '…' },
];

/** Create a new Y.js doc + WebRTC provider for a room. `secret`, when
 *  present, becomes the y-webrtc room password: all signaling payloads
 *  (SDP offers/answers/ICE) are AES-encrypted with a key derived from it,
 *  so neither the signaling server nor a room-ID guesser can read or
 *  MITM the handshake. */
export function createProvider(roomId: string, secret?: string): CollabSession {
  const ydoc = new Y.Doc();

  const provider = new WebrtcProvider(roomId, ydoc, {
    signaling: signalingServers(roomId),
    password: secret ?? null,
    peerOpts: { config: { iceServers: ICE_SERVERS } },
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
