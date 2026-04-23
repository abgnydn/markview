/**
 * MarkView Context Bridge — Offscreen Document
 *
 * Runs in Chrome's offscreen document context which HAS access to
 * RTCPeerConnection, WebSocket, and other DOM APIs that service workers lack.
 */

import type {
  ExtensionMessage,
  MCPRequest,
  MCPNotification,
  MCPResponse,
  SignalingMessage,
  ToolInfo,
} from './types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let ws: WebSocket | null = null;
const pendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();
let nextId = 1;

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage & { target?: string }, _sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    switch (msg.type) {
      case 'CONNECT':
        connect(msg.roomId, msg.signalingUrl);
        break;

      case 'DISCONNECT':
        disconnect();
        sendResponse({ ok: true });
        break;

      case 'GET_STATE':
        sendResponse({
          state: dc && dc.readyState === 'open' ? 'connected' : 'disconnected',
        });
        break;

      case 'CALL_TOOL':
        log(`CALL_TOOL received: ${msg.toolName}`);
        callTool(msg.toolName, msg.args || {})
          .then((result) => {
            log('CALL_TOOL success');
            sendResponse(result);
          })
          .catch((err: Error) => {
            log(`CALL_TOOL error: ${err.message}`, 'error');
            sendResponse({ error: err.message });
          });
        return true; // async

      case 'LIST_TOOLS':
        listTools()
          .then((tools) => sendResponse({ tools }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true; // async
    }
  }
);

// ---------------------------------------------------------------------------
// WebRTC Connection
// ---------------------------------------------------------------------------

async function connect(roomId: string, signalingUrl: string): Promise<void> {
  try {
    disconnect();
    log('Creating WebRTC peer connection...');

    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Client (answerer) — wait for server's data channel
    pc.ondatachannel = (event: RTCDataChannelEvent) => {
      log(`ondatachannel fired, label=${event.channel.label}`);
      dc = event.channel;
      setupDataChannel(dc);
    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'candidate',
            room: roomId,
            candidate: event.candidate.toJSON(),
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      if (!pc) return;
      log(`Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        log('ICE connected! Waiting for DataChannel...');
      }
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        broadcast('CONNECTION_STATE', { state: 'disconnected' });
      }
    };

    // Signaling server
    log(`Connecting to signaling: ${signalingUrl}`);
    ws = new WebSocket(signalingUrl);

    ws.onopen = () => {
      log(`Signaling connected. Joining room: [${roomId}]`);
      ws!.send(JSON.stringify({ type: 'join', room: roomId }));
      ws!.send(JSON.stringify({ type: 'peer_joined', room: roomId }));
    };

    ws.onmessage = async (event: MessageEvent) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        log('Signaling JSON parse error', 'error');
        return;
      }

      if (msg.room !== roomId) return;

      if (msg.type === 'offer' && 'offer' in msg) {
        log('Received SDP offer, creating answer...');
        await pc!.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc!.createAnswer();
        await pc!.setLocalDescription(answer);
        ws!.send(
          JSON.stringify({
            type: 'answer',
            room: roomId,
            answer: pc!.localDescription!.toJSON(),
          })
        );
        log('Sent SDP answer');
      } else if (msg.type === 'candidate' && 'candidate' in msg) {
        await pc!.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    };

    ws.onerror = () => {
      log('Signaling WebSocket error', 'error');
      broadcast('CONNECTION_STATE', { state: 'failed' });
    };
  } catch (err) {
    log(`Connection failed: ${(err as Error).message}`, 'error');
    broadcast('CONNECTION_STATE', { state: 'failed' });
  }
}

// ---------------------------------------------------------------------------
// Data Channel
// ---------------------------------------------------------------------------

function setupDataChannel(channel: RTCDataChannel): void {
  channel.onopen = async () => {
    log('Data Channel OPEN — P2P established!');
    broadcast('CONNECTION_STATE', { state: 'connected' });

    try {
      const initResult = (await sendMCPRequest('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'markview-context-bridge', version: '0.1.0' },
      })) as { serverInfo?: { name: string } };

      log(`MCP initialized: ${initResult.serverInfo?.name || 'server'}`);
      sendMCPNotification('notifications/initialized', {});

      const toolsResult = (await sendMCPRequest('tools/list', {})) as {
        tools: ToolInfo[];
      };
      const tools = toolsResult.tools || [];
      log(`Discovered ${tools.length} tools`);
      broadcast('TOOLS_DISCOVERED', {
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
      });
    } catch (err) {
      log(`MCP init failed: ${(err as Error).message}`, 'error');
    }
  };

  channel.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as MCPResponse;
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id)!;
        pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (!msg.id && (msg as any).method === 'notifications/message') {
        // MCP server-initiated logging notification — handle streaming tokens
        try {
          const logData = JSON.parse((msg as any).params?.data || '{}');
          if (logData.type === 'stream_token') {
            broadcast('STREAM_TOKEN', { token: logData.token });
          } else if (logData.type === 'stream_end') {
            broadcast('STREAM_END', {
              promptTokens: logData.promptTokens || 0,
              completionTokens: logData.completionTokens || 0,
              inferenceMs: logData.inferenceMs || 0,
            });
          }
        } catch { /* ignore parse errors */ }
      }
    } catch (e) {
      log(`DC parse error: ${(e as Error).message}`, 'error');
    }
  };

  channel.onclose = () => {
    log('Data Channel closed');
    broadcast('CONNECTION_STATE', { state: 'disconnected' });
  };
}

// ---------------------------------------------------------------------------
// MCP Protocol
// ---------------------------------------------------------------------------

function sendMCPRequest(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!dc || dc.readyState !== 'open') {
      reject(new Error('Data channel not open'));
      return;
    }

    const id = nextId++;
    pendingRequests.set(id, { resolve, reject });

    const payload: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    log(`Sending MCP request id=${id} method=${method}`);
    dc.send(JSON.stringify(payload));

    // 120s timeout — Ollama on M2 can take 30-60s for large prompts
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        log(`MCP request id=${id} TIMED OUT after 120s`, 'error');
        reject(new Error('Request timed out after 120s'));
      }
    }, 120_000);
  });
}

function sendMCPNotification(
  method: string,
  params: Record<string, unknown>
): void {
  if (dc && dc.readyState === 'open') {
    const payload: MCPNotification = { jsonrpc: '2.0', method, params };
    dc.send(JSON.stringify(payload));
  }
}

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return sendMCPRequest('tools/call', { name, arguments: args });
}

async function listTools(): Promise<ToolInfo[]> {
  const result = (await sendMCPRequest('tools/list', {})) as {
    tools: ToolInfo[];
  };
  return result.tools || [];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function disconnect(): void {
  if (dc) { try { dc.close(); } catch {} dc = null; }
  if (pc) { try { pc.close(); } catch {} pc = null; }
  if (ws) { try { ws.close(); } catch {} ws = null; }
  pendingRequests.clear();
  nextId = 1;
}

function log(message: string, logType: 'error' | '' = ''): void {
  broadcast('LOG', { message: `[offscreen] ${message}`, logType });
}

function broadcast(type: string, data: Record<string, unknown> = {}): void {
  chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
}
