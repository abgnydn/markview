// SPDX-License-Identifier: Apache-2.0

/**
 * markview — YjsSignalRoom Durable Object
 * --------------------------------------------------------------
 * y-webrtc compatible signaling relay. One DO instance per room.
 *
 * Wire protocol (loose, mirrors y-webrtc client expectations):
 *   { type: "subscribe",   topics: string[] }     # join rooms
 *   { type: "unsubscribe", topics: string[] }     # leave rooms
 *   { type: "publish",     topic: string, ... }   # broadcast to a topic
 *   { type: "ping" }                              # heartbeat
 *
 * The DO does NOT parse Yjs payloads. Anything inside `publish` other
 * than `type` and `topic` is forwarded verbatim — `signal`, `announce`,
 * SDP offers/answers/ICE all flow through the same envelope.
 *
 * State is intentionally ephemeral: connections are kept in memory,
 * nothing is written to storage. If the DO is evicted, peers reconnect
 * and re-subscribe — y-webrtc handles that.
 *
 * Routing model:
 *   - The DO id is derived from the room id via `idFromName(roomId)`,
 *     so all peers in a room land on the same instance.
 *   - Within an instance we still keep a topic→Set<WebSocket> index so
 *     clients can multiplex multiple Yjs rooms over one socket if they
 *     want (matches y-webrtc-server reference behaviour).
 */

import type { DurableObjectState } from "@cloudflare/workers-types";

interface PeerState {
  socket: WebSocket;
  topics: Set<string>;
  alive: boolean;
}

interface Envelope {
  type: string;
  topic?: string;
  topics?: string[];
  [k: string]: unknown;
}

const PING_INTERVAL_MS = 30_000;

export class YjsSignalRoom {
  private peers = new Set<PeerState>();
  private topics = new Map<string, Set<PeerState>>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private state: DurableObjectState, private env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    // `WebSocketPair` is a Cloudflare global available in DO runtime.
    const pair = new (globalThis as unknown as {
      WebSocketPair: new () => Record<"0" | "1", WebSocket>;
    }).WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.accept(server);
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket });
  }

  private accept(socket: WebSocket): void {
    // `accept` is on the Cloudflare WebSocket; types may not surface it.
    (socket as unknown as { accept(): void }).accept();
    const peer: PeerState = { socket, topics: new Set(), alive: true };
    this.peers.add(peer);

    const ping = setInterval(() => {
      if (!peer.alive) {
        this.cleanup(peer);
        clearInterval(ping);
        return;
      }
      peer.alive = false;
      try {
        socket.send(JSON.stringify({ type: "ping" }));
      } catch {
        this.cleanup(peer);
        clearInterval(ping);
      }
    }, PING_INTERVAL_MS);

    socket.addEventListener("message", (ev: MessageEvent) => {
      peer.alive = true;
      let msg: Envelope | null = null;
      try {
        const raw = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object") msg = parsed as Envelope;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      this.handle(peer, msg);
    });

    socket.addEventListener("close", () => {
      this.cleanup(peer);
      clearInterval(ping);
    });
    socket.addEventListener("error", () => {
      this.cleanup(peer);
      clearInterval(ping);
    });
  }

  private handle(peer: PeerState, msg: Envelope): void {
    switch (msg.type) {
      case "subscribe": {
        const topics = Array.isArray(msg.topics) ? msg.topics : [];
        for (const t of topics) {
          if (typeof t !== "string" || t.length === 0 || t.length > 256) continue;
          peer.topics.add(t);
          let set = this.topics.get(t);
          if (!set) {
            set = new Set();
            this.topics.set(t, set);
          }
          set.add(peer);
        }
        return;
      }
      case "unsubscribe": {
        const topics = Array.isArray(msg.topics) ? msg.topics : [];
        for (const t of topics) {
          if (typeof t !== "string") continue;
          peer.topics.delete(t);
          const set = this.topics.get(t);
          if (set) {
            set.delete(peer);
            if (set.size === 0) this.topics.delete(t);
          }
        }
        return;
      }
      case "publish": {
        const t = typeof msg.topic === "string" ? msg.topic : null;
        if (!t) return;
        const set = this.topics.get(t);
        if (!set) return;
        const payload = JSON.stringify(msg);
        for (const recipient of set) {
          // y-webrtc reference relays back to the publisher too; we mirror.
          try {
            recipient.socket.send(payload);
          } catch {
            this.cleanup(recipient);
          }
        }
        return;
      }
      case "ping": {
        try {
          peer.socket.send(JSON.stringify({ type: "pong" }));
        } catch {
          this.cleanup(peer);
        }
        return;
      }
      case "pong": {
        peer.alive = true;
        return;
      }
      default:
        // Unknown verbs: drop. We deliberately do not echo errors —
        // y-webrtc clients treat any unknown frame as fatal.
        return;
    }
  }

  private cleanup(peer: PeerState): void {
    if (!this.peers.has(peer)) return;
    this.peers.delete(peer);
    for (const t of peer.topics) {
      const set = this.topics.get(t);
      if (!set) continue;
      set.delete(peer);
      if (set.size === 0) this.topics.delete(t);
    }
    try {
      peer.socket.close(1000, "bye");
    } catch {
      /* already closed */
    }
  }
}

/**
 * Default Worker entrypoint that fronts the DO. Routes:
 *
 *   GET /yjs/:room  (Upgrade: websocket)  →  forwards to YjsSignalRoom
 */
export interface YjsEnv {
  YJS_ROOMS: {
    idFromName(name: string): { toString(): string };
    get(id: { toString(): string }): { fetch(req: Request): Promise<Response> };
  };
}

const ROOM_ROUTE = /^\/yjs\/([A-Za-z0-9._~-]{1,128})\/?$/;

export default {
  async fetch(request: Request, env: YjsEnv): Promise<Response> {
    const url = new URL(request.url);
    const m = ROOM_ROUTE.exec(url.pathname);
    if (!m) return new Response("not found", { status: 404 });
    const roomId = m[1]!;
    const id = env.YJS_ROOMS.idFromName(roomId);
    const stub = env.YJS_ROOMS.get(id);
    return stub.fetch(request);
  },
};
