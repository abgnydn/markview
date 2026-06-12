declare module 'y-webrtc' {
  import type { Doc } from 'yjs';
  import type { Awareness } from 'y-protocols/awareness';

  interface WebrtcProviderOptions {
    signaling?: string[];
    password?: string | null;
    awareness?: Awareness;
    maxConns?: number;
    filterBcConns?: boolean;
    peerOpts?: object;
  }

  export class WebrtcProvider {
    constructor(roomName: string, doc: Doc, options?: WebrtcProviderOptions);
    awareness: Awareness;
    roomName: string;
    doc: Doc;
    connected: boolean;
    destroy(): void;
    connect(): void;
    disconnect(): void;
  }
}

declare module 'y-protocols/awareness' {
  import type { Doc } from 'yjs';

  export class Awareness {
    clientID: number;
    doc: Doc;
    getLocalState(): Record<string, unknown> | null;
    setLocalState(state: Record<string, unknown> | null): void;
    setLocalStateField(field: string, value: unknown): void;
    getStates(): Map<number, Record<string, unknown>>;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}
