/**
 * MarkView Context Bridge — Offscreen Document
 * 
 * This runs in Chrome's offscreen document context, which HAS access to
 * RTCPeerConnection, WebSocket, and other DOM APIs that service workers lack.
 */

let pc = null;
let dc = null;
let ws = null;
let pendingRequests = new Map();
let nextId = 1;

// Listen for commands from the background service worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;

  if (msg.type === 'CONNECT') {
    connect(msg.roomId, msg.signalingUrl);
  } else if (msg.type === 'DISCONNECT') {
    disconnect();
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATE') {
    sendResponse({ state: dc && dc.readyState === 'open' ? 'connected' : 'disconnected' });
  } else if (msg.type === 'CALL_TOOL') {
    sendToBackground('LOG', { message: `[offscreen] CALL_TOOL received: ${msg.toolName}` });
    callTool(msg.toolName, msg.args || {}).then((result) => {
      sendToBackground('LOG', { message: `[offscreen] CALL_TOOL success, sending response back` });
      sendResponse(result);
    }).catch((err) => {
      sendToBackground('LOG', { message: `[offscreen] CALL_TOOL error: ${err.message}`, logType: 'error' });
      sendResponse({ error: err.message });
    });
    return true; // async
  } else if (msg.type === 'LIST_TOOLS') {
    listTools().then((tools) => {
      sendResponse({ tools });
    }).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function connect(roomId, signalingUrl) {
  try {
    disconnect();
    sendToBackground('LOG', { message: 'Creating WebRTC peer connection...' });

    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // We are the "client" (answerer) — wait for the server's data channel
    pc.ondatachannel = (event) => {
      sendToBackground('LOG', { message: `[offscreen] ondatachannel fired, label=${event.channel.label}` });
      dc = event.channel;
      setupDataChannel(dc);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'candidate',
          room: roomId,
          candidate: event.candidate.toJSON(),
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      sendToBackground('LOG', { message: `Connection state: ${pc.connectionState}` });
      if (pc.connectionState === 'connected') {
        sendToBackground('LOG', { message: '[offscreen] ICE connected! Waiting for DataChannel...' });
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        sendToBackground('CONNECTION_STATE', { state: 'disconnected' });
      }
    };

    // Connect to signaling server
    sendToBackground('LOG', { message: `Connecting to signaling: ${signalingUrl}` });
    ws = new WebSocket(signalingUrl);

    ws.onopen = () => {
      sendToBackground('LOG', { message: `Signaling connected. Joining room: [${roomId}]` });
      ws.send(JSON.stringify({ type: 'join', room: roomId }));
      // Announce ourselves to trigger the server's offer
      ws.send(JSON.stringify({ type: 'peer_joined', room: roomId }));
    };

    ws.onmessage = async (event) => {
      sendToBackground('LOG', { message: `WS Data: ${event.data.substring(0, 50)}...` });
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        sendToBackground('LOG', { message: 'JSON parse error', logType: 'error' });
        return;
      }
      
      if (msg.room !== roomId) {
        sendToBackground('LOG', { message: `Room mismatch: expected [${roomId}], got [${msg.room}]`, logType: 'error' });
        return;
      }

      if (msg.type === 'offer' && msg.offer) {
        sendToBackground('LOG', { message: 'Received SDP offer, creating answer...' });
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({
          type: 'answer',
          room: roomId,
          answer: pc.localDescription.toJSON(),
        }));
        sendToBackground('LOG', { message: 'Sent SDP answer' });
      } else if (msg.type === 'candidate' && msg.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    };

    ws.onerror = () => {
      sendToBackground('LOG', { message: 'Signaling WebSocket error', logType: 'error' });
      sendToBackground('CONNECTION_STATE', { state: 'failed' });
    };

  } catch (err) {
    sendToBackground('LOG', { message: 'Connection failed: ' + err.message, logType: 'error' });
    sendToBackground('CONNECTION_STATE', { state: 'failed' });
  }
}

function setupDataChannel(channel) {
  channel.onopen = async () => {
    sendToBackground('LOG', { message: 'Data Channel OPEN — P2P established!' });
    sendToBackground('CONNECTION_STATE', { state: 'connected' });

    // MCP initialize
    try {
      const initResult = await sendMCPRequest('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'markview-context-bridge', version: '0.1.0' },
      });
      sendToBackground('LOG', { message: `MCP initialized: ${initResult.serverInfo?.name || 'server'}` });

      // Send initialized notification
      sendMCPNotification('notifications/initialized', {});

      // Discover tools
      const toolsResult = await sendMCPRequest('tools/list', {});
      const tools = toolsResult.tools || [];
      sendToBackground('LOG', { message: `Discovered ${tools.length} tools` });
      sendToBackground('TOOLS_DISCOVERED', {
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
      });
    } catch (err) {
      sendToBackground('LOG', { message: 'MCP init failed: ' + err.message, logType: 'error' });
    }
  };

  channel.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      sendToBackground('LOG', { message: `[offscreen] DC message received, id=${msg.id}, has result=${!!msg.result}, has error=${!!msg.error}` });
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      sendToBackground('LOG', { message: `[offscreen] DC parse error: ${e.message}`, logType: 'error' });
    }
  };

  channel.onclose = () => {
    sendToBackground('LOG', { message: 'Data Channel closed' });
    sendToBackground('CONNECTION_STATE', { state: 'disconnected' });
  };
}

function sendMCPRequest(method, params) {
  return new Promise((resolve, reject) => {
    if (!dc || dc.readyState !== 'open') {
      reject(new Error('Data channel not open'));
      return;
    }
    const id = nextId++;
    pendingRequests.set(id, { resolve, reject });
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    sendToBackground('LOG', { message: `[offscreen] Sending MCP request id=${id} method=${method}` });
    dc.send(payload);

    // CRITICAL FIX: Increase timeout from 10s to 120s.
    // Ollama on M2 can take 30-60s for large prompts.
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        sendToBackground('LOG', { message: `[offscreen] MCP request id=${id} TIMED OUT after 120s`, logType: 'error' });
        reject(new Error('Request timed out after 120s'));
      }
    }, 120000);
  });
}

function sendMCPNotification(method, params) {
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }
}

async function callTool(name, args) {
  return await sendMCPRequest('tools/call', { name, arguments: args });
}

async function listTools() {
  const result = await sendMCPRequest('tools/list', {});
  return result.tools || [];
}

function disconnect() {
  if (dc) { try { dc.close(); } catch(e) {} dc = null; }
  if (pc) { try { pc.close(); } catch(e) {} pc = null; }
  if (ws) { try { ws.close(); } catch(e) {} ws = null; }
  pendingRequests.clear();
  nextId = 1;
}

function sendToBackground(type, data = {}) {
  chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
}
