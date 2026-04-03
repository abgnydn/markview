import { RTCPeerConnection, RTCDataChannel } from 'werift';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Self-contained MCP-WebRTC Benchmark
 * 
 * This script runs its own signaling relay, server RTCPeerConnection,
 * and client RTCPeerConnection all in-process. No external dependencies.
 */

const TOOL_ITERATIONS = 10;
const BURST_COUNT = 20;

async function runBenchmarks() {
  console.log('═══════════════════════════════════════════════');
  console.log('  MCP-WebRTC Performance Benchmarks');
  console.log('═══════════════════════════════════════════════\n');

  // ── Phase 1: In-process Signaling Relay ──
  const PORT = 9999;
  const rooms = new Map<string, Set<WebSocket>>();
  const wss = new WebSocketServer({ port: PORT });
  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      const data = JSON.parse(message.toString());
      const room = data.room;
      if (!room) return;
      if (data.type === 'join') {
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room)!.add(ws);
      } else {
        const peers = rooms.get(room);
        if (peers) {
          for (const peer of peers) {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              peer.send(message.toString());
            }
          }
        }
      }
    });
  });
  
  await new Promise(r => setTimeout(r, 300));
  console.log(`  ✓ In-process signaling relay on port ${PORT}\n`);

  const ROOM = 'benchmark';
  const SIGNALING_URL = `ws://localhost:${PORT}`;

  // ── Phase 2: Create Server Peer Connection ──
  const serverPC = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  const serverDC = serverPC.createDataChannel('mcp');

  // Simple echo handler — respond to tool calls with a mock response
  serverDC.onMessage.subscribe((data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'initialize') {
      serverDC.send(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'bench-server', version: '1.0.0' } }
      }));
    } else if (msg.method === 'tools/call') {
      serverDC.send(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { content: [{ type: 'text', text: JSON.stringify({ documents: ['README.md', 'CONTRIBUTING.md'], totalFiles: 2 }) }] }
      }));
    }
  });

  // ── Phase 3: Create Client Peer Connection ──
  const clientPC = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  let clientDC: RTCDataChannel | null = null;
  const dcOpenPromise = new Promise<RTCDataChannel>((resolve) => {
    clientPC.onDataChannel.subscribe((dc) => {
      clientDC = dc;
      dc.stateChanged.subscribe((state) => {
        if (state === 'open') resolve(dc);
      });
    });
  });

  // ── Phase 4: Connect via Signaling ──
  const connStart = performance.now();

  // Connect both to the signaling relay
  const serverWS = new WebSocket(SIGNALING_URL);
  const clientWS = new WebSocket(SIGNALING_URL);

  await new Promise<void>((resolve) => {
    let count = 0;
    serverWS.on('open', () => { serverWS.send(JSON.stringify({ type: 'join', room: ROOM })); if (++count === 2) resolve(); });
    clientWS.on('open', () => { clientWS.send(JSON.stringify({ type: 'join', room: ROOM })); if (++count === 2) resolve(); });
  });

  // Server-side signaling
  serverWS.on('message', async (message) => {
    const msg = JSON.parse(message.toString());
    if (msg.type === 'answer' && msg.answer) {
      await serverPC.setRemoteDescription(msg.answer);
    } else if (msg.type === 'candidate' && msg.candidate) {
      await serverPC.addIceCandidate(msg.candidate);
    }
  });

  // Client-side signaling
  clientWS.on('message', async (message) => {
    const msg = JSON.parse(message.toString());
    if (msg.type === 'offer' && msg.offer) {
      await clientPC.setRemoteDescription(msg.offer);
      const answer = await clientPC.createAnswer();
      await clientPC.setLocalDescription(answer);
      clientWS.send(JSON.stringify({ type: 'answer', room: ROOM, answer: clientPC.localDescription }));
    } else if (msg.type === 'candidate' && msg.candidate) {
      await clientPC.addIceCandidate(msg.candidate);
    }
  });

  // ICE candidates
  serverPC.onIceCandidate.subscribe((c) => {
    if (c) serverWS.send(JSON.stringify({ type: 'candidate', room: ROOM, candidate: c.toJSON() }));
  });
  clientPC.onIceCandidate.subscribe((c) => {
    if (c) clientWS.send(JSON.stringify({ type: 'candidate', room: ROOM, candidate: { candidate: c.candidate, sdpMLineIndex: c.sdpMLineIndex, sdpMid: c.sdpMid } }));
  });

  // Server creates and sends the offer
  const offer = await serverPC.createOffer();
  await serverPC.setLocalDescription(offer);
  serverWS.send(JSON.stringify({ type: 'offer', room: ROOM, offer: serverPC.localDescription }));

  // Wait for data channel to open
  const dc = await dcOpenPromise;
  const connEnd = performance.now();
  const connectionTimeMs = (connEnd - connStart).toFixed(1);

  console.log(`── Benchmark 1: Connection Establishment ──`);
  console.log(`  Time: ${connectionTimeMs}ms`);
  console.log(`  (signaling + SDP + ICE + DTLS + data channel open)\n`);

  // ── Phase 5: Tool Call Latency ──
  console.log(`── Benchmark 2: Tool Call Round-Trip Latency ──`);

  // First, send MCP initialize
  let nextId = 1;
  const sendAndWait = (msg: any): Promise<any> => {
    return new Promise((resolve) => {
      const handler = (data: any) => {
        const resp = JSON.parse(data.toString());
        if (resp.id === msg.id) {
          dc.onMessage.unsubscribe(handler);
          resolve(resp);
        }
      };
      dc.onMessage.subscribe(handler);
      dc.send(JSON.stringify(msg));
    });
  };

  await sendAndWait({ jsonrpc: '2.0', id: nextId++, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'bench', version: '1.0.0' } } });

  const latencies: number[] = [];
  for (let i = 0; i < TOOL_ITERATIONS; i++) {
    const start = performance.now();
    await sendAndWait({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'list_documents', arguments: {} } });
    const end = performance.now();
    latencies.push(end - start);
    console.log(`  Run ${i + 1}: ${(end - start).toFixed(2)}ms`);
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length / 2)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log(`\n  Avg:  ${avg.toFixed(2)}ms`);
  console.log(`  Min:  ${min.toFixed(2)}ms`);
  console.log(`  Max:  ${max.toFixed(2)}ms`);
  console.log(`  P50:  ${p50.toFixed(2)}ms`);
  console.log(`  P99:  ${p99.toFixed(2)}ms\n`);

  // ── Phase 6: Burst Throughput ──
  console.log(`── Benchmark 3: Burst Throughput (${BURST_COUNT} concurrent) ──`);
  const burstStart = performance.now();
  const promises = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    promises.push(sendAndWait({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'list_documents', arguments: {} } }));
  }
  await Promise.all(promises);
  const burstEnd = performance.now();
  const burstTime = burstEnd - burstStart;
  const throughput = (BURST_COUNT / (burstTime / 1000)).toFixed(1);

  console.log(`  ${BURST_COUNT} concurrent calls in ${burstTime.toFixed(1)}ms`);
  console.log(`  Throughput: ${throughput} calls/sec\n`);

  // ── Summary ──
  console.log('═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Connection establishment:  ${connectionTimeMs}ms`);
  console.log(`  Tool call latency (avg):   ${avg.toFixed(2)}ms`);
  console.log(`  Tool call latency (p50):   ${p50.toFixed(2)}ms`);
  console.log(`  Tool call latency (p99):   ${p99.toFixed(2)}ms`);
  console.log(`  Burst throughput:          ${throughput} calls/sec`);
  console.log('═══════════════════════════════════════════════');

  // Cleanup
  dc.close();
  serverDC.close();
  await serverPC.close();
  await clientPC.close();
  serverWS.close();
  clientWS.close();
  wss.close();
  process.exit(0);
}

runBenchmarks().catch((e) => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
