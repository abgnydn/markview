// Minimal preload for privacy dashboard
// Context isolation is on — this just provides a safe bridge
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('vault', {
  ready: true,
});
