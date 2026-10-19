const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  // Register full IPC handlers to properly mock backend during preload
  ipcMain.handle('server:getPort', () => 51234);
  ipcMain.handle('media:probe', async () => ({ duration: 0, playbackMode: 'direct' }));
  ipcMain.handle('library:scan', () => ({ movies: [], series: [] }));
  ipcMain.handle('library:getPath', () => '');
  ipcMain.handle('library:getOnlineHistory', () => ({}));
  ipcMain.handle('library:saveOnlineProgress', () => true);
  ipcMain.handle('library:getDownloadPath', () => 'C:\\Downloads');
  ipcMain.handle('otakudesu:getOngoing', () => ({
    page: 1,
    hasNextPage: false,
    animeList: [
      { title: 'Black Clover Season 2', url: '/anime/bc-s2', slug: 'bc-s2', poster: 'thumb.jpg', episode: 'Ep 1' },
      { title: 'Sousou no Frieren', url: '/anime/frieren', slug: 'frieren', poster: 'thumb2.jpg', episode: 'Ep 28' }
    ]
  }));
  ipcMain.handle('anichin:getOngoing', () => ({
    data: [],
    totalPages: 1
  }));
  ipcMain.handle('otakudesu:getSchedule', () => []);
  ipcMain.handle('anichin:getSchedule', () => []);
  ipcMain.handle('otakudesu:getGenres', () => []);
  ipcMain.handle('otakudesu:getAnimeList', () => []);
  ipcMain.handle('kusonime:getAnimeList', () => []);
  ipcMain.handle('anichin:getAnimeList', () => []);
  ipcMain.handle('app:getVersion', () => require('../../package.json').version);
  ipcMain.handle('settings:get-close-to-tray', () => false);
  ipcMain.handle('aniskip:getSkipTimes', () => ({ found: false }));
  ipcMain.handle('window:isFullScreen', () => false);
  ipcMain.handle('window:setFullScreen', () => false);
  ipcMain.handle('window:minimize', () => {});
  ipcMain.handle('window:maximize', () => {});
  ipcMain.handle('window:isMaximized', () => false);

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Wait 3s for startup preloading to complete and fade out
  await new Promise(r => setTimeout(r, 3000));

  const result = await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      const startupEl = document.getElementById('appStartupLoading');
      const hasStartupEl = Boolean(startupEl);
      const isFadedOut = startupEl ? startupEl.classList.contains('fade-out') : false;
      
      const webDynamicContainer = document.getElementById('webDynamicContainer');
      const containerChildrenCount = webDynamicContainer ? webDynamicContainer.children.length : 0;
      const hasCards = Boolean(webDynamicContainer && webDynamicContainer.querySelector('.netflix-card, .web-card, .card-poster-wrapper'));
      
      const manager = window.otakudesuManager;
      const hasCache = manager && (Boolean(manager.cache.ongoing) || Boolean(manager.cache.anichinOngoing));

      // Test switching to web tab
      const tabWeb = document.getElementById('tabWeb');
      if (tabWeb) tabWeb.click();

      // Check if spinner appeared or if it stayed clean
      const hasSpinnerAfterTabSwitch = Boolean(webDynamicContainer.querySelector('.web-loading-spinner, .yt-spinner'));

      resolve({
        hasStartupEl,
        isFadedOut,
        containerChildrenCount,
        hasCards,
        hasCache,
        hasSpinnerAfterTabSwitch
      });
    })
  `);

  console.log('STARTUP & WEB PRELOAD TEST RESULT:', result);

  if (!result.hasStartupEl) {
    console.error('FAIL: appStartupLoading element missing!');
    process.exit(1);
  }
  if (!result.isFadedOut) {
    console.error('FAIL: startup loading screen did not fade out!');
    process.exit(1);
  }
  if (!result.hasCache) {
    console.error('FAIL: ongoing catalog was not cached during startup preload!');
    process.exit(1);
  }
  if (!result.hasCards) {
    console.error('FAIL: anime cards were not preloaded into webDynamicContainer!');
    process.exit(1);
  }
  if (result.hasSpinnerAfterTabSwitch) {
    console.error('FAIL: loading spinner appeared on web tab switch even though preloaded!');
    process.exit(1);
  }

  console.log('✓ PASS: All startup loading & web preloading tests passed successfully!');
  win.destroy();
  app.quit();
});
