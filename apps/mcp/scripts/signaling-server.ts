import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 4445 });
const rooms = new Map<string, Set<WebSocket>>();

console.log('Local WebRTC signaling server running on ws://localhost:4445');

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const room = data.room;

      if (!room) return;

      if (data.type === 'join') {
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room)!.add(ws);
        console.log(`Peer joined room: ${room} (Total: ${rooms.get(room)!.size})`);
      } else {
        // Broadcast all other messages (offer, answer, candidate) to others in the room
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
      console.error('Invalid message format');
    }
  });

  ws.on('close', () => {
    for (const [room, peers] of rooms.entries()) {
      if (peers.has(ws)) {
        peers.delete(ws);
        console.log(`Peer left room: ${room} (Total: ${peers.size})`);
        if (peers.size === 0) {
          rooms.delete(room);
        }
      }
    }
  });
});
