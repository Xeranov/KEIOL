const { contextBridge, ipcRenderer, webFrame } = require('electron');

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

  // Download Folder Settings & Downloads Scanner
  getDownloadPath: () => ipcRenderer.invoke('library:getDownloadPath'),
  setDownloadPath: (newPath) => ipcRenderer.invoke('library:setDownloadPath', newPath),
  chooseDownloadFolder: () => ipcRenderer.invoke('library:chooseDownloadFolder'),
  openDownloadFolder: () => ipcRenderer.invoke('library:openDownloadFolder'),
  scanDownloads: () => ipcRenderer.invoke('library:scanDownloads'),
  deleteSeries: (seriesPath) => ipcRenderer.invoke('library:deleteSeries', seriesPath),
  deleteAllDownloads: () => ipcRenderer.invoke('library:deleteAllDownloads'),
  clearCacheSettings: () => ipcRenderer.invoke('app:clearCacheSettings'),
  factoryReset: () => ipcRenderer.invoke('app:factoryReset'),

  // Online Watch History (Streaming)
  saveOnlineProgress: (...args) => ipcRenderer.invoke('library:saveOnlineProgress', ...args),
  getOnlineHistory: () => ipcRenderer.invoke('library:getOnlineHistory'),
  deleteOnlineProgress: (slug) => ipcRenderer.invoke('library:deleteOnlineProgress', slug),

  // Otakudesu Integration APIs
  otakudesuGetOngoing: (page) => ipcRenderer.invoke('otakudesu:getOngoing', page),
  otakudesuGetSchedule: () => ipcRenderer.invoke('otakudesu:getSchedule'),
  otakudesuGetGenres: () => ipcRenderer.invoke('otakudesu:getGenres'),
  otakudesuGetAnimeByGenre: (slug, page) => ipcRenderer.invoke('otakudesu:getAnimeByGenre', slug, page),
  otakudesuGetAnimeList: () => ipcRenderer.invoke('otakudesu:getAnimeList'),
  otakudesuSearch: (query) => ipcRenderer.invoke('otakudesu:search', query),
  otakudesuGetDetail: (urlOrSlug) => ipcRenderer.invoke('otakudesu:getDetail', urlOrSlug),
  otakudesuGetEpisodeStream: (urlOrSlug) => ipcRenderer.invoke('otakudesu:getEpisodeStream', urlOrSlug),
  otakudesuResolveStreamUrl: (embedUrl) => ipcRenderer.invoke('otakudesu:resolveStreamUrl', embedUrl),
  otakudesuGetBatchDetails: (urlOrSlug) => ipcRenderer.invoke('otakudesu:getBatchDetails', urlOrSlug),
  getAnimeSkipTimes: (animeTitle, episodeNum) => ipcRenderer.invoke('aniskip:getSkipTimes', animeTitle, episodeNum),
  validateAnimeSkipTimes: (intervals, videoDuration) => ipcRenderer.invoke('aniskip:validateSkipIntervals', intervals, videoDuration),
  aniskipExtractEpisodeNumber: (rawString, animeTitle) => ipcRenderer.invoke('aniskip:extractEpisodeNumber', rawString, animeTitle),

  // Kusonime Integration APIs (Batch Download Source)
  kusonimeSearch: (query) => ipcRenderer.invoke('kusonime:search', query),
  kusonimeGetDetail: (urlOrSlug) => ipcRenderer.invoke('kusonime:getDetail', urlOrSlug),
  kusonimeGetAnimeList: () => ipcRenderer.invoke('kusonime:getAnimeList'),

  // Ani-Chin Integration APIs (Donghua Streaming & Downloads)
  anichinGetOngoing: (page) => ipcRenderer.invoke('anichin:getOngoing', page),
  anichinGetSchedule: () => ipcRenderer.invoke('anichin:getSchedule'),
  anichinGetAnimeList: () => ipcRenderer.invoke('anichin:getAnimeList'),
  anichinGetDetail: (urlOrSlug) => ipcRenderer.invoke('anichin:getDetail', urlOrSlug),
  anichinGetAnimeDetail: (urlOrSlug) => ipcRenderer.invoke('anichin:getDetail', urlOrSlug),
  anichinGetEpisodeStream: (urlOrSlug) => ipcRenderer.invoke('anichin:getEpisodeStream', urlOrSlug),
  anichinSearch: (query) => ipcRenderer.invoke('anichin:search', query),

  // Idlix Integration APIs (Movies & TV Series Streaming)
  idlixGetMovies: (options) => ipcRenderer.invoke('idlix:getMovies', options),
  idlixGetSeries: (options) => ipcRenderer.invoke('idlix:getSeries', options),
  idlixGetMovieDetail: (slug) => ipcRenderer.invoke('idlix:getMovieDetail', slug),
  idlixGetSeriesDetail: (slug) => ipcRenderer.invoke('idlix:getSeriesDetail', slug),
  idlixGetSeasonEpisodes: (slug, seasonNumber) => ipcRenderer.invoke('idlix:getSeasonEpisodes', slug, seasonNumber),
  idlixSearch: (query, type) => ipcRenderer.invoke('idlix:search', query, type),
  idlixGetFilterOptions: (type) => ipcRenderer.invoke('idlix:getFilterOptions', type),
  idlixGetTrending: () => ipcRenderer.invoke('idlix:getTrending'),
  idlixInitiateStreamSession: (contentType, contentId) => ipcRenderer.invoke('idlix:initiateStreamSession', contentType, contentId),
  idlixClaimAndRedeemStream: (gateToken, unlockAt) => ipcRenderer.invoke('idlix:claimAndRedeemStream', gateToken, unlockAt),
  idlixGetStreamDirect: (contentType, contentId) => ipcRenderer.invoke('idlix:getStreamDirect', contentType, contentId),
  idlixLogin: (identifier, password) => ipcRenderer.invoke('idlix:login', identifier, password),
  idlixLogout: () => ipcRenderer.invoke('idlix:logout'),
  idlixGetCurrentUser: () => ipcRenderer.invoke('idlix:getCurrentUser'),

  // Application Version
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

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
  },

  // Screen & UI Zoom Controls
  getZoomFactor: () => webFrame.getZoomFactor(),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  zoomIn: () => {
    const current = webFrame.getZoomFactor();
    const next = Math.min(Math.round((current + 0.1) * 10) / 10, 3.0);
    webFrame.setZoomFactor(next);
    return next;
  },
  zoomOut: () => {
    const current = webFrame.getZoomFactor();
    const next = Math.max(Math.round((current - 0.1) * 10) / 10, 0.5);
    webFrame.setZoomFactor(next);
    return next;
  },
  resetZoom: () => {
    webFrame.setZoomFactor(1.0);
    return 1.0;
  },

  // External Browser Opener
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Batch Archive Extractor
  isArchive: (filePath) => ipcRenderer.invoke('archive:isArchive', filePath),
  extractArchive: (archivePath, targetDir, options) => ipcRenderer.invoke('archive:extract', archivePath, targetDir, options)
});
