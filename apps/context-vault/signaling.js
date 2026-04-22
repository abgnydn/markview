/**
 * MarkView Context Vault — In-Process Signaling Server
 * 
 * Runs the WebSocket signaling relay inside the Electron process.
 * Identical to the standalone signaling-server.ts but as a module.
 */

const { WebSocketServer, WebSocket } = require('ws');

let wss = null;
const rooms = new Map();

function startSignaling(port = 4445) {
  if (wss) return;

  wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        const room = data.room;
        if (!room) return;

        if (data.type === 'join') {
          if (!rooms.has(room)) rooms.set(room, new Set());
          rooms.get(room).add(ws);
          console.log(`[Signaling] Peer joined room: ${room} (${rooms.get(room).size} peers)`);
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
      } catch (e) {
        // Ignore
      }
    });

    ws.on('close', () => {
      for (const [room, peers] of rooms.entries()) {
        if (peers.has(ws)) {
          peers.delete(ws);
          if (peers.size === 0) rooms.delete(room);
        }
      }
    });
  });

  wss.on('error', (err) => {
    console.error('[Signaling] Error:', err.message);
  });

  console.log(`[Signaling] Running on ws://localhost:${port}`);
}

function stopSignaling() {
  if (wss) {
    wss.close();
    wss = null;
    rooms.clear();
  }
}

module.exports = { startSignaling, stopSignaling };
