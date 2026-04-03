import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { WebRTCClientTransport } from '../src/webrtc-transport.js';

async function runTest() {
  const roomId = process.argv[2] || 'test-room';
  const signalingUrl = process.argv[3] || 'ws://localhost:4444';

  console.log(`Connecting to room: ${roomId} via signaling: ${signalingUrl}...`);

  // Create the P2P Client Transport
  const transport = new WebRTCClientTransport(roomId, signalingUrl);
  
  // Create an MCP client
  const client = new Client({
    name: 'test-agent',
    version: '1.0.0',
  });

  // Connect via WebRTC
  await client.connect(transport);
  console.log('✅ WebRTC Data Channel established! Connected strictly peer-to-peer.');

  // Test calling a tool on the remote server
  console.log('Calling list_documents...');
  try {
    const result = await client.callTool({
      name: 'list_documents',
      arguments: {}
    });
    console.log('✅ Received response over WebRTC data channel:');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Failed to call tool:', e);
  }

  // Close the connection
  setTimeout(async () => {
    console.log('Closing connection...');
    await client.close();
    process.exit(0);
  }, 1000);
}

runTest().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
