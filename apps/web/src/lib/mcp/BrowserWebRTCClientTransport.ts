import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export class BrowserWebRTCClientTransport implements Transport {
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  private pc: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private ws: WebSocket;
  private messageQueue: any[] = [];
  private wsConnected = false;
  private started = false;

  constructor(private roomId: string, private signalingUrl: string = 'ws://localhost:4444') {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.setupDataChannel(this.dc);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[BrowserClient] Generated ICE candidate`);
        this.sendSignaling({
          type: 'candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[BrowserClient] Connection state: ${this.pc.connectionState}`);
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
        this.close();
      }
    };

    // Setting up WebSocket directly in transport to avoid external dependencies
    this.ws = new WebSocket(this.signalingUrl);

    this.ws.onopen = () => {
      console.log(`[BrowserSignaling] Connected to ${this.signalingUrl}`);
      this.wsConnected = true;
      this.ws.send(JSON.stringify({ type: 'join', room: this.roomId }));
      
      for (const msg of this.messageQueue) {
        this.ws.send(JSON.stringify({ ...msg, room: this.roomId }));
      }
      this.messageQueue = [];

      // Prompt server to send offer
      this.sendSignaling({ type: 'peer_joined' });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.room === this.roomId) {
          this.handleSignalingMessage(msg);
        }
      } catch (e) {
        // Ignore
      }
    };
  }

  private sendSignaling(msg: any) {
    if (this.wsConnected) {
      this.ws.send(JSON.stringify({ ...msg, room: this.roomId }));
    } else {
      this.messageQueue.push(msg);
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.dc?.readyState === 'open') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });
  }

  private async handleSignalingMessage(msg: any) {
    try {
      if (msg.type === 'offer' && msg.offer) {
        if (this.pc.signalingState !== 'stable') {
          console.log(`[BrowserClient] Ignoring duplicate offer`);
          return;
        }
        console.log(`[BrowserClient] Received offer, creating answer`);
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        console.log(`[BrowserClient] Sending answer`);
        this.sendSignaling({ type: 'answer', answer: this.pc.localDescription });
      } else if (msg.type === 'candidate' && msg.candidate) {
        console.log(`[BrowserClient] Received candidate`);
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    } catch (e: any) {
      console.error('[BrowserClient] Signaling handling error', e);
      this.onerror?.(e);
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`[BrowserClient] Received DataChannel message`);
        this.onmessage?.(message);
      } catch (e: any) {
        this.onerror?.(e);
      }
    };

    dc.onclose = () => {
      console.log(`[BrowserClient] DataChannel closed`);
      this.close();
    };
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.dc?.readyState === 'open') {
      console.log(`[BrowserClient] Sending DataChannel message`, message);
      this.dc.send(JSON.stringify(message));
    } else {
      throw new Error('DataChannel is not open');
    }
  }

  async close(): Promise<void> {
    this.dc?.close();
    this.pc.close();
    this.ws.close();
    this.onclose?.();
  }
}
