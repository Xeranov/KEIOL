const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openSubtitleDialog: () => ipcRenderer.invoke('dialog:openSubtitle'),
  probeFile: (filePath) => ipcRenderer.invoke('media:probe', filePath),
  getServerPort: () => ipcRenderer.invoke('server:getPort'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setFullScreen: (flag) => ipcRenderer.invoke('window:setFullScreen', flag),
  isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),
  onFileDropFromMain: (callback) => {
    ipcRenderer.on('app:open-file', (_event, filePath) => callback(filePath));
  }
});
