import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { log } from '@/lib/logger';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Browser-side WebRTC Client Transport for MCP.
 * Connects to a local MCP server running in WebRTC mode via a signaling relay.
 * 
 * Flow:
 *   1. Connect to signaling server via WebSocket
 *   2. Join a room and announce arrival
 *   3. Server (werift) will create an offer + datachannel and send the SDP offer
 *   4. We answer with our SDP and exchange ICE candidates
 *   5. DataChannel opens → ready for MCP JSON-RPC messages
 */
export class BrowserWebRTCClientTransport implements Transport {
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  private pc: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private ws?: WebSocket;
  private messageQueue: any[] = [];
  private wsConnected = false;
  private started = false;
  private dcOpenResolve?: () => void;
  private dcOpenReject?: (err: Error) => void;

  constructor(private roomId: string, private signalingUrl: string = 'ws://localhost:4445') {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // The SERVER creates the data channel → we receive it here
    this.pc.ondatachannel = (event) => {
      log.debug(`[BrowserClient] Received data channel: ${event.channel.label}`);
      this.dc = event.channel;
      this.setupDataChannel(this.dc);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        log.debug(`[BrowserClient] Sending ICE candidate`);
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

    this.pc.oniceconnectionstatechange = () => {
      log.debug(`[BrowserClient] ICE state: ${this.pc.iceConnectionState}`);
    };

    this.pc.onconnectionstatechange = () => {
      log.debug(`[BrowserClient] Connection state: ${this.pc.connectionState}`);
      if (this.pc.connectionState === 'failed') {
        const err = new Error('WebRTC connection failed');
        this.dcOpenReject?.(err);
        this.onerror?.(err);
      } else if (this.pc.connectionState === 'closed') {
        this.close();
      }
    };
  }

  private connectSignaling(): void {
    // Derive signaling URL: if the page is on 127.0.0.1, use 127.0.0.1 for WS too
    let url = this.signalingUrl;
    if (typeof window !== 'undefined') {
      try {
        const wsUrl = new URL(url);
        // If the signaling URL uses localhost but the page is on 127.0.0.1
        // or vice versa, unify them to avoid CORS/connect issues
        if (wsUrl.hostname === 'localhost' && window.location.hostname === '127.0.0.1') {
          wsUrl.hostname = '127.0.0.1';
          url = wsUrl.toString().replace(/\/$/, '');
        } else if (wsUrl.hostname === '127.0.0.1' && window.location.hostname === 'localhost') {
          wsUrl.hostname = 'localhost';
          url = wsUrl.toString().replace(/\/$/, '');
        }
      } catch {
        // fallback to original URL
      }
    }

    log.debug(`[BrowserSignaling] Connecting to ${url}`);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      log.debug(`[BrowserSignaling] Connected`);
      this.wsConnected = true;
      ws.send(JSON.stringify({ type: 'join', room: this.roomId }));

      // Flush queued messages
      for (const msg of this.messageQueue) {
        ws.send(JSON.stringify({ ...msg, room: this.roomId }));
      }
      this.messageQueue = [];

      // Tell the server we're here so it sends an offer
      this.sendSignaling({ type: 'peer_joined' });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.room === this.roomId) {
          this.handleSignalingMessage(msg);
        }
      } catch {
        // Ignore parse errors
      }
    };

    this.ws.onerror = (event) => {
      console.error(`[BrowserSignaling] WebSocket error`, event);
      const err = new Error('WebSocket connection to signaling server failed');
      this.dcOpenReject?.(err);
      this.onerror?.(err);
    };

    this.ws.onclose = () => {
      log.debug(`[BrowserSignaling] WebSocket closed`);
      this.wsConnected = false;
    };
  }

  private sendSignaling(msg: any) {
    if (this.wsConnected && this.ws) {
      this.ws.send(JSON.stringify({ ...msg, room: this.roomId }));
    } else {
      this.messageQueue.push(msg);
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Connect signaling AFTER start() is called so we can properly await
    this.connectSignaling();

    return new Promise<void>((resolve, reject) => {
      this.dcOpenResolve = resolve;
      this.dcOpenReject = reject;

      // Safety timeout
      setTimeout(() => {
        if (this.dc?.readyState !== 'open') {
          reject(new Error('DataChannel did not open within 15 seconds'));
        }
      }, 15000);
    });
  }

  private async handleSignalingMessage(msg: any) {
    try {
      if (msg.type === 'offer' && msg.offer) {
        if (this.pc.signalingState !== 'stable') {
          log.debug(`[BrowserClient] Ignoring offer — signaling state: ${this.pc.signalingState}`);
          return;
        }
        log.debug(`[BrowserClient] Received offer, creating answer`);

        // werift sends SDP as { type, sdp } — ensure it's a proper RTCSessionDescription
        const offer = msg.offer;
        const sdp = typeof offer === 'string' ? offer : offer;
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        log.debug(`[BrowserClient] Sending answer`);
        this.sendSignaling({
          type: 'answer',
          answer: {
            type: this.pc.localDescription?.type ?? 'answer',
            sdp: this.pc.localDescription?.sdp ?? '',
          },
        });
      } else if (msg.type === 'candidate' && msg.candidate) {
        log.debug(`[BrowserClient] Adding ICE candidate`);
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    } catch (e: any) {
      console.error('[BrowserClient] Signaling error:', e);
      this.onerror?.(e);
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      log.debug(`[BrowserClient] ✅ DataChannel open!`);
      this.dcOpenResolve?.();
    };

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.onmessage?.(message);
      } catch (e: any) {
        this.onerror?.(e);
      }
    };

    dc.onerror = (event) => {
      console.error(`[BrowserClient] DataChannel error`, event);
    };

    dc.onclose = () => {
      log.debug(`[BrowserClient] DataChannel closed`);
      this.close();
    };
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
    this.pc.close();
    this.ws?.close();
    this.onclose?.();
  }
}
