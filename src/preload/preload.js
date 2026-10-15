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
  openFolderInExplorer: (customPath) => ipcRenderer.invoke('library:openFolderInExplorer', customPath),
  saveWatchProgress: (animePath, episodePath, episodeName, currentTime, duration) =>
    ipcRenderer.invoke('library:saveProgress', animePath, episodePath, episodeName, currentTime, duration),
  getContinueWatching: () => ipcRenderer.invoke('library:getContinueWatching'),

  // Download Folder Settings
  getDownloadPath: () => ipcRenderer.invoke('library:getDownloadPath'),
  setDownloadPath: (newPath) => ipcRenderer.invoke('library:setDownloadPath', newPath),
  chooseDownloadFolder: () => ipcRenderer.invoke('library:chooseDownloadFolder'),
  openDownloadFolder: () => ipcRenderer.invoke('library:openDownloadFolder'),

  // Online Watch History (Streaming)
  saveOnlineProgress: (animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster) =>
    ipcRenderer.invoke('library:saveOnlineProgress', animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster),
  getOnlineHistory: () => ipcRenderer.invoke('library:getOnlineHistory'),

  // Otakudesu Integration APIs
  otakudesuGetOngoing: (page) => ipcRenderer.invoke('otakudesu:getOngoing', page),
  otakudesuGetSchedule: () => ipcRenderer.invoke('otakudesu:getSchedule'),
  otakudesuGetGenres: () => ipcRenderer.invoke('otakudesu:getGenres'),
  otakudesuGetAnimeByGenre: (slug, page) => ipcRenderer.invoke('otakudesu:getAnimeByGenre', slug, page),
  otakudesuGetAnimeList: () => ipcRenderer.invoke('otakudesu:getAnimeList'),
  otakudesuSearch: (query) => ipcRenderer.invoke('otakudesu:search', query),
  otakudesuGetDetail: (urlOrSlug) => ipcRenderer.invoke('otakudesu:getDetail', urlOrSlug),
  otakudesuGetEpisodeStream: (urlOrSlug) => ipcRenderer.invoke('otakudesu:getEpisodeStream', urlOrSlug),
  otakudesuGetBatchDetails: (urlOrSlug) => ipcRenderer.invoke('otakudesu:getBatchDetails', urlOrSlug),
  getAnimeSkipTimes: (animeTitle, episodeNum) => ipcRenderer.invoke('aniskip:getSkipTimes', animeTitle, episodeNum),

  // Background Download Manager
  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: (downloadId) => ipcRenderer.invoke('download:cancel', downloadId),
  getActiveDownloads: () => ipcRenderer.invoke('download:getActive'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download:progress', (_event, data) => callback(data));
  },

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
  },

  // KEIOL Auto-Update & Force-Update System
  checkForUpdates: (manual) => ipcRenderer.invoke('updater:check', manual),
  startUpdateDownload: () => ipcRenderer.invoke('updater:start-download'),
  installUpdateAndRestart: () => ipcRenderer.invoke('updater:install-and-restart'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_event, data) => callback(data));
  },
  onForceUpdate: (callback) => {
    ipcRenderer.on('update:force-required', (_event, data) => callback(data));
  },
  onUpdateCheckResult: (callback) => {
    ipcRenderer.on('update:check-result', (_event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:download-progress', (_event, data) => callback(data));
  },
  onUpdateComplete: (callback) => {
    ipcRenderer.on('update:download-complete', (_event, data) => callback(data));
  },

  // Settings & System Tray
  getCloseToTray: () => ipcRenderer.invoke('settings:get-close-to-tray'),
  setCloseToTray: (val) => ipcRenderer.invoke('settings:set-close-to-tray', val),
  onOpenSettingsFromMain: (callback) => {
    ipcRenderer.on('app:open-settings', () => callback());
  },
  onTogglePlayFromMain: (callback) => {
    ipcRenderer.on('player:toggle-play', () => callback());
  }
});
