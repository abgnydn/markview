import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { RTCPeerConnection, RTCDataChannel } from 'werift';
import WebSocket from 'ws';

/**
 * Common base signaling integration for WebRTC MCP.
 * Uses a simple WebSocket pub/sub for SDP exchange.
 */
class SignalingClient {
  private ws: WebSocket;
  private connected = false;

  private messageQueue: any[] = [];

  constructor(
    private url: string,
    private roomId: string,
    private onMessage: (msg: any) => void,
    private onConnect?: () => void
  ) {
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => {
      console.log(`[Signaling] Connected to ${this.url}`);
      this.connected = true;
      // Join the room
      this.ws.send(JSON.stringify({ type: 'join', room: this.roomId }));
      
      // Flush queue
      for (const msg of this.messageQueue) {
        this.ws.send(JSON.stringify({ ...msg, room: this.roomId }));
      }
      this.messageQueue = [];

      this.onConnect?.();
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.room === this.roomId) {
          console.log(`[Signaling] Received message type: ${msg.type}`);
          this.onMessage(msg);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    this.ws.on('error', (err) => {
      console.error(`[Signaling] WebSocket error:`, err.message);
    });
  }

  send(msg: any) {
    if (this.connected) {
      this.ws.send(JSON.stringify({ ...msg, room: this.roomId }));
    } else {
      this.messageQueue.push(msg);
    }
  }

  close() {
    this.ws.close();
  }
}

/**
 * Server transport for WebRTC.
 * Acts as the offerer. Listens for connections and sets up the data channel.
 * 
 * IMPORTANT: This transport supports client reconnects. When a peer_joined
 * signal is received, the server tears down the old PeerConnection and creates
 * a fresh one. This is critical for extension reloads.
 */
export class WebRTCServerTransport implements Transport {
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  private pc: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private signaling: SignalingClient;
  private started = false;

  constructor(private roomId: string, private signalingUrl: string = 'ws://localhost:4445') {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.signaling = new SignalingClient(this.signalingUrl, this.roomId, this.handleSignalingMessage.bind(this));

    this.pc.onIceCandidate.subscribe((candidate) => {
      if (candidate) {
        this.signaling.send({ type: 'candidate', candidate: candidate.toJSON() });
      }
    });

    // DO NOT call this.close() on connection state changes — 
    // that kills the signaling server and makes reconnects impossible.
    this.pc.connectionStateChange.subscribe((state) => {
      console.log(`[Server] PeerConnection state: ${state}`);
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Server creates the data channel
    this.dc = this.pc.createDataChannel('mcp');
    this.setupDataChannel(this.dc);
    console.log(`[Server] Data channel created. Waiting for peers...`);
    // We will create and send the offer ONLY when a peer joins
  }

  private async handleSignalingMessage(msg: any) {
    try {
      if (msg.type === 'answer' && msg.answer) {
        console.log(`[Server] Received answer`);
        await this.pc.setRemoteDescription(msg.answer);
      } else if (msg.type === 'candidate' && msg.candidate) {
        console.log(`[Server] Received candidate`);
        await this.pc.addIceCandidate(msg.candidate);
      } else if (msg.type === 'peer_joined') {
        console.log(`[Server] Peer joined, recreating PeerConnection for fresh handshake`);

        // Tear down old connection gracefully
        try {
          this.dc?.close();
          await this.pc.close();
        } catch (e) {
          console.log(`[Server] Cleanup of old PC (expected):`, (e as Error).message);
        }

        // Create a brand new PeerConnection
        this.pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        this.pc.onIceCandidate.subscribe((candidate) => {
          if (candidate) {
            this.signaling.send({ type: 'candidate', candidate: candidate.toJSON() });
          }
        });

        this.pc.connectionStateChange.subscribe((state) => {
          console.log(`[Server] PeerConnection state: ${state}`);
        });

        // Create a new DataChannel and wire it up
        this.dc = this.pc.createDataChannel('mcp');
        this.setupDataChannel(this.dc);
        console.log(`[Server] New DataChannel created`);

        // Now create and send the offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.signaling.send({ type: 'offer', offer: this.pc.localDescription });
        console.log(`[Server] Offer sent to peer`);
      }
    } catch (e: any) {
      console.error(`[Server] handleSignalingMessage error:`, e);
      this.onerror?.(e);
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onMessage.subscribe((data) => {
      try {
        const message = JSON.parse(data.toString());
        this.onmessage?.(message);
      } catch (e: any) {
        this.onerror?.(e);
      }
    });

    dc.stateChanged.subscribe((state) => {
      console.log(`[Server] DataChannel state: ${state}`);
      // DO NOT call this.close() here — it kills the signaling server.
      // Just log the state change. A new peer_joined will reset everything.
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(message));
    } else {
      throw new Error('DataChannel is not open');
    }
  }

  async close(): Promise<void> {
    this.dc?.close();
    await this.pc.close();
    this.signaling.close();
    this.onclose?.();
  }
}

/**
 * Client transport for WebRTC.
 * Acts as the answerer.
 */
export class WebRTCClientTransport implements Transport {
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  private pc: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private signaling: SignalingClient;
  private started = false;

  constructor(private roomId: string, private signalingUrl: string = 'ws://localhost:4445') {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Client waits for data channel from server
    this.pc.onDataChannel.subscribe((dc) => {
      this.dc = dc;
      this.setupDataChannel(dc);
    });

    this.pc.onIceCandidate.subscribe((candidate) => {
      if (candidate) {
        console.log(`[Client] Generated ICE candidate`, candidate);
        this.signaling.send({ type: 'candidate', candidate: { candidate: candidate.candidate, sdpMLineIndex: candidate.sdpMLineIndex, sdpMid: candidate.sdpMid } });
      }
    });

    this.pc.connectionStateChange.subscribe((state) => {
      console.log(`[Client] Connection state: ${state}`);
      if (state === 'failed' || state === 'closed') {
        this.close();
      }
    });

    this.signaling = new SignalingClient(
      this.signalingUrl, 
      this.roomId, 
      this.handleSignalingMessage.bind(this),
      () => {
        // Announce we arrived to prompt an offer
        this.signaling.send({ type: 'peer_joined' });
      }
    );
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    
    // We don't create an offer here, we just wait for the signaling connection
    // and the incoming offer from the server.
    // Return when the data channel is actually open to ensure send() succeeds.
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.dc?.readyState === 'open') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Safety timeout after 10s
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(); // resolve anyway, send() might fail but we don't block forever
      }, 10000);
    });
  }

  private async handleSignalingMessage(msg: any) {
    try {
      if (msg.type === 'offer' && msg.offer) {
        if (this.pc.signalingState !== 'stable') {
          console.log(`[Client] Ignoring duplicate offer, signaling state: ${this.pc.signalingState}`);
          return;
        }
        console.log(`[Client] Received offer, creating answer`);
        await this.pc.setRemoteDescription(msg.offer);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        console.log(`[Client] Sending answer`);
        this.signaling.send({ type: 'answer', answer: this.pc.localDescription });
      } else if (msg.type === 'candidate' && msg.candidate) {
        console.log(`[Client] Received candidate`);
        await this.pc.addIceCandidate(msg.candidate);
      }
    } catch (e: any) {
      this.onerror?.(e);
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onMessage.subscribe((data) => {
      try {
        const message = JSON.parse(data.toString());
        this.onmessage?.(message);
      } catch (e: any) {
        this.onerror?.(e);
      }
    });

    dc.stateChanged.subscribe((state) => {
      console.log(`[Client] DataChannel state: ${state}`);
      if (state === 'closed') {
        this.close();
      }
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(message));
    } else {
      throw new Error('DataChannel is not open');
    }
  }

  async close(): Promise<void> {
    this.dc?.close();
    await this.pc.close();
    this.signaling.close();
    this.onclose?.();
  }
}
