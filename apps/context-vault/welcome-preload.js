const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vault', {
  closeWindow: () => ipcRenderer.send('close-welcome'),
});
