const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const mediaServer = require('./mediaServer');
const { probeMedia } = require('./probeService');
const libraryService = require('./libraryService');
const otakudesuService = require('./otakudesuService');
const kusonimeService = require('./kusonimeService');
const anichinService = require('./anichinService');
const idlixService = require('./idlixService');
const downloadManager = require('./downloadManager');
const extractorService = require('./extractorService');
const aniSkipService = require('./aniSkipService');
const trayManager = require('./trayManager');
const updateService = require('./updateService');

let mainWindow = null;

async function createWindow() {
  // Start local streaming server
  await mediaServer.start();

  // Set up request headers for media streaming CDNs (e.g. yourUpload, VidHide, OK.ru, Ani-Chin, etc.)
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const url = details.url.toLowerCase();
    const requestHeaders = { ...details.requestHeaders };
    if (url.includes('vidcache.net') || url.includes('yourupload.com')) {
      requestHeaders['Referer'] = 'https://www.yourupload.com/';
      requestHeaders['Origin'] = 'https://www.yourupload.com';
    } else if (url.includes('dramiyos-cdn') || url.includes('acek-cdn') || url.includes('vidhide') || url.includes('morencius.com')) {
      requestHeaders['Referer'] = 'https://odvidhide.com/';
    } else if (url.includes('majorplay.net') || url.includes('idlixku.com') || url.includes('/v/z7/')) {
      requestHeaders['Referer'] = 'https://z2.idlixku.com/';
      requestHeaders['Origin'] = 'https://z2.idlixku.com';
    } else if (url.includes('desustream') || url.includes('desudrive') || url.includes('playdesu') || url.includes('desuwatch') || url.includes('odesu') || url.includes('moeplay') || url.includes('desudesu')) {
      requestHeaders['Referer'] = 'https://otakudesu.blog/';
    } else if (url.includes('googlevideo.com') || url.includes('videoplayback')) {
      // Google Video CDN: MUST NOT have blogger / foreign referer, and must use standard Chrome User-Agent to prevent 403 Forbidden
      delete requestHeaders['Referer'];
      delete requestHeaders['referer'];
      delete requestHeaders['Origin'];
      delete requestHeaders['origin'];
      delete requestHeaders['User-Agent'];
      delete requestHeaders['user-agent'];
      requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    } else if (url.includes('blogger.com') || url.includes('googleusercontent.com') || url.includes('blogspot.com')) {
      requestHeaders['Referer'] = 'https://odgoingthree.blogspot.com/';
      delete requestHeaders['User-Agent'];
      delete requestHeaders['user-agent'];
      requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    } else if (url.includes('ok.ru') || url.includes('vkuser.net')) {
      requestHeaders['Referer'] = 'https://ok.ru/';
      requestHeaders['Origin'] = 'https://ok.ru';
    } else if (url.includes('ani-chin.id')) {
      requestHeaders['Referer'] = 'https://ani-chin.id/';
    }
    callback({ cancel: false, requestHeaders });
  });

  // Izinkan iframe embed streaming untuk anime lawas (hilangkan proteksi frame-ancestors & x-frame-options)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      if (/^(x-frame-options|content-security-policy|content-security-policy-report-only)$/i.test(key)) {
        delete responseHeaders[key];
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    callback({ cancel: false, responseHeaders });
  });

  const appIcon = process.platform === 'win32'
    ? path.join(__dirname, '../../build/icon.ico')
    : path.join(__dirname, '../../build/icon.png');

  mainWindow = new BrowserWindow({
    title: 'KEIOL',
    icon: appIcon,
    width: 1240,
    height: 760,
    minWidth: 720,
    minHeight: 450,
    backgroundColor: '#0f0f0f',
    frame: false, // Clean custom borderless window without taskbar overlap
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Forward download events to renderer
  downloadManager.onProgress((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', data);
    }
  });

  // Maximize / Unmaximize events
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:state-changed', { isMaximized: false });
  });

  // Fullscreen events
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', { isFullScreen: true });
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', { isFullScreen: false });
  });

  // Handle close event for minimize to tray
  mainWindow.on('close', (event) => {
    if (!app.isQuitting && trayManager.isCloseToTrayEnabled()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle file passed via CLI arguments (e.g. electron . "sample.mkv")
  const initialFile = process.argv.slice(1).find(arg => {
    const ext = path.extname(arg).toLowerCase();
    return ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.ts'].includes(ext);
  });

  if (initialFile) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('app:open-file', path.resolve(initialFile));
    });
  }

  // Initialize Windows System Tray & Update Service
  trayManager.init(mainWindow);
  updateService.init(mainWindow);
}

// IPC Handlers: Dialogs
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File Video',
    properties: ['openFile'],
    filters: [
      {
        name: 'Video Files',
        extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'ts', 'm4v', 'vob', '3gp', 'mpg', 'mpeg', 'ogv']
      },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:openSubtitle', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File Subtitle',
    properties: ['openFile'],
    filters: [
      { name: 'Subtitles', extensions: ['srt', 'vtt', 'ass', 'ssa'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC Handlers: Media Engine
ipcMain.handle('media:probe', async (_event, filePath) => {
  return await probeMedia(filePath);
});

ipcMain.handle('server:getPort', () => {
  return mediaServer.port;
});

// IPC Handlers: Library & Gallery
ipcMain.handle('library:scan', () => {
  return libraryService.scanLibrary();
});

ipcMain.handle('library:getPath', () => {
  return libraryService.getLibraryPath();
});

ipcMain.handle('library:setPath', (_event, newPath) => {
  return libraryService.setLibraryPath(newPath);
});

ipcMain.handle('library:chooseFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih Folder Utama Anime',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const chosen = result.filePaths[0];
    libraryService.setLibraryPath(chosen);
    return libraryService.scanLibrary();
  }
  return null;
});

ipcMain.handle('library:openFolderInExplorer', async (_event, customPath) => {
  const fs = require('fs');
  const targetDir = customPath || libraryService.getLibraryPath();
  if (targetDir) {
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (err) {}
    }
    await shell.openPath(targetDir);
    return true;
  }
  return false;
});

ipcMain.handle('library:saveProgress', (_event, animePath, episodePath, episodeName, currentTime, duration) => {
  libraryService.saveProgress(animePath, episodePath, episodeName, currentTime, duration);
  return true;
});

ipcMain.handle('library:getContinueWatching', () => {
  return libraryService.getContinueWatching();
});

// IPC Handlers: Download Folder Settings
ipcMain.handle('library:getDownloadPath', () => {
  return libraryService.getDownloadPath();
});

ipcMain.handle('library:setDownloadPath', (_event, newPath) => {
  return libraryService.setDownloadPath(newPath);
});

ipcMain.handle('library:chooseDownloadFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih Folder Unduhan Web',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const chosen = result.filePaths[0];
    libraryService.setDownloadPath(chosen);
    return chosen;
  }
  return null;
});

ipcMain.handle('library:openDownloadFolder', async () => {
  const fs = require('fs');
  const targetDir = libraryService.getDownloadPath();
  if (targetDir) {
    if (!fs.existsSync(targetDir)) {
      try { fs.mkdirSync(targetDir, { recursive: true }); } catch (err) {}
    }
    await shell.openPath(targetDir);
    return true;
  }
  return false;
});

// IPC Handler: Scan khusus folder unduhan (terpisah dari library Beranda)
ipcMain.handle('library:scanDownloads', () => {
  return libraryService.scanDownloads();
});

// IPC Handler: Hapus satu serial anime dari disk
ipcMain.handle('library:deleteSeries', async (_event, seriesPath) => {
  return libraryService.deleteSeries(seriesPath);
});

// IPC Handler: Hapus semua file di folder unduhan
ipcMain.handle('library:deleteAllDownloads', async () => {
  return libraryService.deleteAllDownloads();
});

// IPC Handler: Hapus cache & reset preferensi
ipcMain.handle('app:clearCacheSettings', async () => {
  return libraryService.clearCacheAndSettings();
});

// IPC Handler: Factory Reset total
ipcMain.handle('app:factoryReset', async () => {
  return libraryService.factoryReset();
});

// IPC Handlers: Batch Archive Extractor
ipcMain.handle('archive:isArchive', (_event, filePath) => {
  return extractorService.isArchive(filePath);
});

ipcMain.handle('archive:extract', async (_event, archivePath, targetDir, options) => {
  return await extractorService.extractArchive(archivePath, targetDir, options);
});

// IPC Handler: Buka URL di browser sistem default
ipcMain.handle('shell:openExternal', async (_event, url) => {
  if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// IPC Handlers: Online Watch History
ipcMain.handle('library:saveOnlineProgress', (_event, animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster, extra) => {
  libraryService.saveOnlineProgress(animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster, extra);
  return true;
});

ipcMain.handle('library:getOnlineHistory', () => {
  return libraryService.getOnlineHistory();
});

ipcMain.handle('library:deleteOnlineProgress', (_event, slug) => {
  libraryService.deleteOnlineProgress(slug);
  return true;
});

// IPC Handlers: Otakudesu Integration
ipcMain.handle('otakudesu:getOngoing', async (_event, page) => {
  return await otakudesuService.getOngoing(page);
});

ipcMain.handle('otakudesu:getSchedule', async () => {
  return await otakudesuService.getSchedule();
});

ipcMain.handle('otakudesu:getGenres', async () => {
  return await otakudesuService.getGenres();
});

ipcMain.handle('otakudesu:getAnimeByGenre', async (_event, genreSlug, page) => {
  return await otakudesuService.getAnimeByGenre(genreSlug, page);
});

ipcMain.handle('otakudesu:getAnimeList', async () => {
  return await otakudesuService.getAnimeList();
});

ipcMain.handle('otakudesu:search', async (_event, query) => {
  return await otakudesuService.search(query);
});

ipcMain.handle('otakudesu:getDetail', async (_event, urlOrSlug) => {
  return await otakudesuService.getAnimeDetail(urlOrSlug);
});

ipcMain.handle('otakudesu:getEpisodeStream', async (_event, urlOrSlug) => {
  return await otakudesuService.getEpisodeStream(urlOrSlug);
});

ipcMain.handle('otakudesu:resolveStreamUrl', async (_event, embedUrl) => {
  return await otakudesuService.resolveStreamUrl(embedUrl);
});

ipcMain.handle('otakudesu:getBatchDetails', async (_event, urlOrSlug) => {
  return await otakudesuService.getBatchDetails(urlOrSlug);
});

// IPC Handlers: Kusonime Integration (Batch Download Source)
ipcMain.handle('kusonime:search', async (_event, query) => {
  return await kusonimeService.search(query);
});

ipcMain.handle('kusonime:getDetail', async (_event, urlOrSlug) => {
  return await kusonimeService.getAnimeDetail(urlOrSlug);
});

ipcMain.handle('kusonime:getAnimeList', async () => {
  return await kusonimeService.getAnimeList();
});

// IPC Handlers: Ani-Chin Integration (Donghua Streaming & Downloads)
ipcMain.handle('anichin:getOngoing', async (_event, page) => {
  return await anichinService.getOngoing(page);
});

ipcMain.handle('anichin:getSchedule', async () => {
  return await anichinService.getSchedule();
});

ipcMain.handle('anichin:getAnimeList', async () => {
  return await anichinService.getAnimeList();
});

ipcMain.handle('anichin:getDetail', async (_event, urlOrSlug) => {
  return await anichinService.getDetail(urlOrSlug);
});

ipcMain.handle('anichin:getAnimeDetail', async (_event, urlOrSlug) => {
  return await anichinService.getDetail(urlOrSlug);
});

ipcMain.handle('anichin:getEpisodeStream', async (_event, urlOrSlug) => {
  return await anichinService.getEpisodeStream(urlOrSlug);
});

ipcMain.handle('anichin:search', async (_event, query) => {
  return await anichinService.search(query);
});

// IPC Handlers: Idlix Movies & TV Series Integration
ipcMain.handle('idlix:getMovies', async (_event, options) => {
  return await idlixService.getMovies(options);
});

ipcMain.handle('idlix:getSeries', async (_event, options) => {
  return await idlixService.getSeries(options);
});

ipcMain.handle('idlix:getMovieDetail', async (_event, slug) => {
  return await idlixService.getMovieDetail(slug);
});

ipcMain.handle('idlix:getSeriesDetail', async (_event, slug) => {
  return await idlixService.getSeriesDetail(slug);
});

ipcMain.handle('idlix:getSeasonEpisodes', async (_event, slug, seasonNumber) => {
  return await idlixService.getSeasonEpisodes(slug, seasonNumber);
});

ipcMain.handle('idlix:search', async (_event, query, type) => {
  return await idlixService.search(query, type);
});

ipcMain.handle('idlix:getFilterOptions', async (_event, type) => {
  return await idlixService.getFilterOptions(type);
});

ipcMain.handle('idlix:getTrending', async () => {
  return await idlixService.getTrending();
});

ipcMain.handle('idlix:initiateStreamSession', async (_event, contentType, contentId) => {
  return await idlixService.initiateStreamSession(contentType, contentId);
});

ipcMain.handle('idlix:claimAndRedeemStream', async (_event, gateToken, unlockAt) => {
  return await idlixService.claimAndRedeemStream(gateToken, unlockAt);
});

ipcMain.handle('idlix:getStreamDirect', async (_event, contentType, contentId) => {
  return await idlixService.getStreamDirect(contentType, contentId);
});

ipcMain.handle('idlix:login', async (_event, identifier, password) => {
  return await idlixService.login(identifier, password);
});

ipcMain.handle('idlix:logout', async () => {
  return await idlixService.logout();
});

ipcMain.handle('idlix:getCurrentUser', async () => {
  return await idlixService.getCurrentUser();
});

// IPC Handler: Application Version
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// IPC Handler: AniSkip Precise Skip Times & Redundant Validation
ipcMain.handle('aniskip:getSkipTimes', async (_event, animeTitle, episodeNum) => {
  return await aniSkipService.getSkipTimes(animeTitle, episodeNum);
});

ipcMain.handle('aniskip:validateSkipIntervals', (_event, intervals, videoDuration) => {
  return aniSkipService.validateSkipIntervals(intervals, videoDuration);
});

ipcMain.handle('aniskip:extractEpisodeNumber', (_event, rawString, animeTitle) => {
  return aniSkipService.extractEpisodeNumber(rawString, animeTitle);
});

// IPC Handlers: Background Download Manager
ipcMain.handle('download:start', async (_event, options) => {
  return await downloadManager.startDownload(options);
});

ipcMain.handle('download:cancel', (_event, downloadId) => {
  return downloadManager.cancelDownload(downloadId);
});

ipcMain.handle('download:getActive', () => {
  return downloadManager.getActiveDownloads();
});

// IPC Handlers: Window Management
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window:setFullScreen', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setFullScreen(flag);
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('window:isFullScreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

// IPC Handlers: Updater & Settings
ipcMain.handle('updater:check', (_event, manual) => {
  return updateService.checkForUpdates(Boolean(manual));
});

ipcMain.handle('updater:start-download', () => {
  return updateService.startDownload();
});

ipcMain.handle('updater:install-and-restart', () => {
  return updateService.installAndRestart();
});

ipcMain.handle('settings:get-close-to-tray', () => {
  return trayManager.isCloseToTrayEnabled();
});

ipcMain.handle('settings:set-close-to-tray', (_event, enabled) => {
  return trayManager.setCloseToTray(enabled);
});

app.whenReady().then(async () => {
  await createWindow();
  idlixService.ensureAuthenticatedSession().catch(() => {});
});

app.on('window-all-closed', () => {
  mediaServer.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
