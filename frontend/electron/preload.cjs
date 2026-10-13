const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  exitApp: () => {
    ipcRenderer.send('app:exit-confirmed');
  },
  onClearSession: (callback) => {
    ipcRenderer.on('app:clear-session', () => callback());
  },
});
