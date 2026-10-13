const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openSubtitleDialog: () => ipcRenderer.invoke('dialog:openSubtitle'),

  // Media Probe & Streaming
  probeFile: (filePath) => ipcRenderer.invoke('media:probe', filePath),
  getServerPort: () => ipcRenderer.invoke('server:getPort'),

  // Anime Library & Watch History
  scanLibrary: () => ipcRenderer.invoke('library:scan'),
  getLibraryPath: () => ipcRenderer.invoke('library:getPath'),
  setLibraryPath: (newPath) => ipcRenderer.invoke('library:setPath', newPath),
  chooseLibraryFolder: () => ipcRenderer.invoke('library:chooseFolder'),
  saveWatchProgress: (animePath, episodePath, episodeName, currentTime, duration) =>
    ipcRenderer.invoke('library:saveProgress', animePath, episodePath, episodeName, currentTime, duration),
  getContinueWatching: () => ipcRenderer.invoke('library:getContinueWatching'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setFullScreen: (flag) => ipcRenderer.invoke('window:setFullScreen', flag),
  isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),

  // Event Listeners
  onFileDropFromMain: (callback) => {
    ipcRenderer.on('app:open-file', (_event, filePath) => callback(filePath));
  },
  onFullScreenChanged: (callback) => {
    ipcRenderer.on('window:fullscreen-changed', (_event, data) => callback(data));
  },
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window:state-changed', (_event, data) => callback(data));
  }
});
