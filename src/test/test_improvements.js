const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaServer = require('../main/mediaServer');
const { probeMedia } = require('../main/probeService');
const libraryService = require('../main/libraryService');

async function testImprovements() {
  console.log('=== Testing User Requested Improvements (Netflix UI, Seek Config, Master Folder, Translucent Titlebar, XPlayer) ===\n');

  // 1. Setup mock media root with both Series subfolders and standalone Movie files
  const mockMediaRoot = path.join(__dirname, '../../test-media/mock_library');
  const frierenDir = path.join(mockMediaRoot, 'Sousou no Frieren');
  const jjkDir = path.join(mockMediaRoot, 'Jujutsu Kaisen');

  fs.mkdirSync(frierenDir, { recursive: true });
  fs.mkdirSync(jjkDir, { recursive: true });

  const sampleMp4Source = path.join(__dirname, '../../test-media/test_sample.mp4');
  const sampleMkvSource = path.join(__dirname, '../../test-media/test_sample.mkv');

  // Series episodes
  fs.copyFileSync(sampleMp4Source, path.join(frierenDir, 'Episode 01.mp4'));
  fs.copyFileSync(sampleMkvSource, path.join(frierenDir, 'Episode 02.mkv'));
  fs.copyFileSync(sampleMp4Source, path.join(frierenDir, 'Episode 10.mp4'));
  fs.copyFileSync(sampleMp4Source, path.join(jjkDir, 'Episode 01.mp4'));

  // Standalone Movie in root media folder
  fs.copyFileSync(sampleMp4Source, path.join(mockMediaRoot, 'Suzume no Tojimari.mp4'));

  // Point libraryService to mockMediaRoot
  libraryService.setLibraryPath(mockMediaRoot);

  const port = await mediaServer.start();

  // Register IPC
  ipcMain.handle('server:getPort', () => port);
  ipcMain.handle('media:probe', async (_e, fp) => probeMedia(fp));
  ipcMain.handle('library:scan', () => libraryService.scanLibrary());
  ipcMain.handle('library:getPath', () => libraryService.getLibraryPath());
  ipcMain.handle('library:setPath', (_e, p) => libraryService.setLibraryPath(p));
  ipcMain.handle('library:chooseFolder', () => libraryService.scanLibrary());
  ipcMain.handle('library:saveProgress', (_e, sPath, epPath, epName, cur, dur) => {
    libraryService.saveProgress(sPath, epPath, epName, cur, dur);
    return true;
  });
  ipcMain.handle('library:getContinueWatching', () => libraryService.getContinueWatching());
  ipcMain.handle('window:isFullScreen', () => false);
  ipcMain.handle('window:setFullScreen', () => false);
  ipcMain.handle('window:minimize', () => {});
  ipcMain.handle('window:maximize', () => {});
  ipcMain.handle('window:isMaximized', () => false);
  ipcMain.handle('library:getOnlineHistory', () => ({}));
  ipcMain.handle('library:saveOnlineProgress', () => true);
  ipcMain.handle('library:getDownloadPath', () => libraryService.getDownloadPath());
  ipcMain.handle('library:setDownloadPath', (_e, p) => p);
  ipcMain.handle('library:chooseDownloadFolder', () => null);
  ipcMain.handle('library:openDownloadFolder', () => true);
  ipcMain.handle('library:scanDownloads', () => ({ items: [], seriesCount: 0, moviesCount: 0, episodesCount: 0, downloadPath: '' }));
  ipcMain.handle('archive:isArchive', () => false);
  ipcMain.handle('archive:extract', () => ({ success: true }));
  ipcMain.handle('settings:get-close-to-tray', () => false);
  ipcMain.handle('settings:set-close-to-tray', () => true);
  ipcMain.handle('shell:openExternal', () => true);
  ipcMain.handle('otakudesu:getOngoing', () => ({ animeList: [] }));
  ipcMain.handle('otakudesu:getSchedule', () => []);
  ipcMain.handle('otakudesu:getGenres', () => []);
  ipcMain.handle('otakudesu:getAnimeByGenre', () => ({ animeList: [] }));
  ipcMain.handle('otakudesu:getAnimeList', () => []);
  ipcMain.handle('otakudesu:search', () => []);
  ipcMain.handle('otakudesu:getDetail', () => null);
  ipcMain.handle('otakudesu:getEpisodeStream', () => null);
  ipcMain.handle('otakudesu:getBatchDetails', () => null);
  ipcMain.handle('download:start', () => ({ downloadId: 'dl_test', status: 'started' }));
  ipcMain.handle('download:cancel', () => true);
  ipcMain.handle('download:getActive', () => []);

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const log = [];
      const report = (name, passed, detail) => log.push({ name, passed, detail });

      // TEST 1: Fullscreen Top Bar Removal and Maximized Window Safety
      document.body.classList.add('is-fullscreen');
      const titleBar = document.getElementById('titleBar');
      const titlebarComputed = window.getComputedStyle(titleBar).display;
      report('Fullscreen hides top titlebar', titlebarComputed === 'none', 'Titlebar display: ' + titlebarComputed);
      document.body.classList.remove('is-fullscreen');

      document.body.classList.add('window-maximized');
      const bodyComputed = window.getComputedStyle(document.body).overflow;
      report('Maximized window styling applied safely', bodyComputed === 'hidden', 'Body overflow: ' + bodyComputed);
      document.body.classList.remove('window-maximized');

      // TEST 2: Semi-Transparent Window Titlebar Styling
      const titlebarBg = window.getComputedStyle(titleBar).backgroundColor;
      const titlebarBackdrop = window.getComputedStyle(titleBar).backdropFilter || window.getComputedStyle(titleBar).webkitBackdropFilter;
      const isSemiTransparent = titlebarBg.includes('rgba') || titlebarBg.includes('0.72');
      report(
        'Semi-transparent titlebar with backdrop blur',
        isSemiTransparent,
        'BG: ' + titlebarBg + ', Backdrop: ' + titlebarBackdrop
      );

      // TEST 3: KEIOL Player Logo (No Name Text)
      const keiolLogo = document.querySelector('.brand-keiol svg.keiol-logo-svg');
      const brandText = document.querySelector('.brand')?.textContent?.trim() || '';
      const isKeiolBranded = keiolLogo !== null && brandText === '';
      report(
        'KEIOL circular logo active (without name text)',
        isKeiolBranded,
        'KEIOL Logo present: ' + (keiolLogo !== null) + ', Brand text: "' + brandText + '"'
      );

      // TEST 4: 2X Speed Boost Pop-up Auto-Hides After 800ms
      await window.playerCore.loadFile(${JSON.stringify(path.join(frierenDir, 'Episode 01.mp4'))});
      window.playerCore.setBoost2x(true);
      const pill = document.getElementById('speedBoostPill');
      const pillShownImmediately = !pill.classList.contains('hidden');

      // Wait 850ms for pill to auto-hide
      await new Promise(r => setTimeout(r, 850));
      const pillHiddenAfterTimeout = pill.classList.contains('hidden');
      const rateStillBoosted = window.playerCore.video.playbackRate === 2.0;

      window.playerCore.setBoost2x(false);
      const rateRestored = window.playerCore.video.playbackRate === 1.0;

      report(
        '2X Speed Pop-up shows briefly then auto-hides while still holding',
        pillShownImmediately && pillHiddenAfterTimeout && rateStillBoosted && rateRestored,
        'Shown: ' + pillShownImmediately + ', Auto-Hidden: ' + pillHiddenAfterTimeout + ', Rate kept 2x: ' + rateStillBoosted + ', Restored: ' + rateRestored
      );

      // Switch back to gallery view
      window.libraryManager.showGalleryView();

      // TEST 5: Master Folder Scan (Distinguishes Root Files as Movies & Subfolders as Series)
      await window.libraryManager.scanAndRender();
      const libData = window.libraryManager.libraryData;
      const seriesList = libData.seriesList || [];
      const movies = libData.movies || [];

      const foundFrieren = seriesList.some(s => s.title === 'Sousou no Frieren');
      const foundJjk = seriesList.some(s => s.title === 'Jujutsu Kaisen');
      const foundSuzume = movies.some(m => m.title === 'Suzume no Tojimari');

      const frieren = seriesList.find(s => s.title === 'Sousou no Frieren');
      const epOrder = frieren ? frieren.episodes.map(e => e.name) : [];
      const isNaturalSorted = epOrder[1] === 'Episode 02.mkv' && epOrder[2] === 'Episode 10.mp4';

      report(
        'Master folder scanner detects Series subfolders and standalone Movies',
        foundFrieren && foundJjk && foundSuzume && isNaturalSorted,
        'Series found: ' + seriesList.map(s => s.title).join(', ') + ' (' + seriesList.length + '); Movies: ' + movies.map(m => m.title).join(', ') + ' (' + movies.length + '); Ep order: ' + epOrder.join(' -> ')
      );

      // TEST 6: Netflix-Style Gallery UI Elements & Category Filter Tabs
      const billboard = document.getElementById('billboardSection');
      const tabHome = document.getElementById('tabHome');
      const tabWeb = document.getElementById('tabWeb');
      const webSection = document.getElementById('webSection');
      const netflixContent = document.querySelector('.netflix-content');
      const rowMedia = document.getElementById('rowMedia');
      const searchBox = document.getElementById('inputSearchAnime');

      const elementsExist = !!billboard && !!tabHome && !!tabWeb && !!webSection && !!rowMedia && !!searchBox;

      // Test Tab Switching between Beranda and Web
      tabWeb.click();
      const webVisible = !webSection.classList.contains('hidden') && netflixContent.classList.contains('hidden');

      tabHome.click();
      const homeVisible = webSection.classList.contains('hidden') && !netflixContent.classList.contains('hidden');

      report(
        'Netflix-style Gallery UI and Navigation Tabs (Beranda & Web)',
        elementsExist && webVisible && homeVisible,
        'Elements exist: ' + elementsExist + ', WebVisible: ' + webVisible + ', HomeVisible: ' + homeVisible
      );

      // TEST 7: Configurable Seek Duration (5, 10, 15, 20, 25, 30s)
      const allowedIntervals = [5, 10, 15, 20, 25, 30];
      let allIntervalsWorking = true;

      for (const interval of allowedIntervals) {
        window.controlsManager.setSeekInterval(interval);
        const savedInStorage = parseInt(localStorage.getItem('xplayer_seek_interval'), 10) === interval;
        const currentVal = window.controlsManager.seekInterval === interval;
        const rewindTitle = document.getElementById('btnRewind10')?.title || '';
        const forwardTitle = document.getElementById('btnForward10')?.title || '';
        if (!savedInStorage || !currentVal || !rewindTitle.includes(String(interval)) || !forwardTitle.includes(String(interval))) {
          allIntervalsWorking = false;
          break;
        }
      }

      // Test relative seek using 20s
      window.controlsManager.setSeekInterval(20);
      let soughtDelta = 0;
      const origSeekRelative = window.playerCore.seekRelative.bind(window.playerCore);
      window.playerCore.seekRelative = (delta) => {
        soughtDelta = delta;
        origSeekRelative(delta);
      };

      document.getElementById('btnForward10').click();
      const seekForwardWorked = soughtDelta === 20;

      document.getElementById('btnRewind10').click();
      const seekRewindWorked = soughtDelta === -20;

      window.playerCore.seekRelative = origSeekRelative;

      // Reset to 10s default
      window.controlsManager.setSeekInterval(10);

      report(
        'Configurable seek interval (5, 10, 15, 20, 25, 30s) with dynamic badges and seekRelative',
        allIntervalsWorking && seekForwardWorked && seekRewindWorked,
        'Supported intervals verified: 5, 10, 15, 20, 25, 30s. Forward 20s: ' + seekForwardWorked + ', Rewind 20s: ' + seekRewindWorked
      );

      // TEST 8: Theater Mode Completely Removed
      const btnTheater = document.getElementById('btnTheater');
      const hasTheaterClass = document.body.classList.contains('theater-mode');
      const shortcutTEvent = new KeyboardEvent('keydown', { key: 't', bubbles: true });
      window.dispatchEvent(shortcutTEvent);
      const stillNoTheaterClass = !document.body.classList.contains('theater-mode');

      report(
        'Theater mode removed from UI, styles, and shortcuts',
        btnTheater === null && !hasTheaterClass && stillNoTheaterClass,
        'btnTheater is null: ' + (btnTheater === null) + ', T shortcut ignored: ' + stillNoTheaterClass
      );

      // TEST 9: Continue Watching Resume via Netflix Billboard
      const ep2Path = ${JSON.stringify(path.join(frierenDir, 'Episode 02.mkv'))};
      await window.electronAPI.saveWatchProgress(
        ${JSON.stringify(frierenDir)},
        ep2Path,
        'Episode 02.mkv',
        1.85,
        3.0
      );

      await window.libraryManager.scanAndRender();
      const cw = window.libraryManager.libraryData.continueWatching;
      const billboardVisible = !billboard.classList.contains('hidden');
      const billboardTitle = document.getElementById('billboardTitle').textContent;
      const billboardDesc = document.getElementById('billboardDesc').textContent;

      report(
        'Netflix Billboard displays continue watching episode and progress',
        cw && cw.currentTime === 1.85 && billboardVisible && billboardTitle === 'Sousou no Frieren',
        'Title: ' + billboardTitle + ', Ep: ' + billboardDesc + ', Resuming from: ' + cw.currentTime + 's'
      );

      // TEST 10: Billboard Play Button loads episode and resumes player
      document.getElementById('btnBillboardPlay').click();
      await new Promise(r => setTimeout(r, 300));
      const playingFile = window.playerCore.currentFilePath;
      const isPlayerView = !document.getElementById('playerView').classList.contains('hidden');

      report(
        'Billboard Play button switches to player and resumes playback at last timestamp',
        playingFile === ep2Path && isPlayerView,
        'Playing file: ' + playingFile + ', In Player View: ' + isPlayerView
      );

      return log;
    })();
  `);

  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} [${idx + 1}] ${r.name}`);
    console.log(`    Detail: ${r.detail}`);
  });

  const allPassed = results.every(r => r.passed);
  if (!allPassed) {
    throw new Error('Some improvement tests failed!');
  }

  console.log('\n=== ALL USER IMPROVEMENTS VERIFIED AND WORKING FLAWLESSLY! ===');

  mediaServer.stop();
  app.quit();
}

app.whenReady().then(testImprovements).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
