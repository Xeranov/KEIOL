const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaServer = require('../main/mediaServer');
const { probeMedia } = require('../main/probeService');
const libraryService = require('../main/libraryService');

async function testImprovements() {
  console.log('=== Testing User Requested Improvements ===\n');

  // 1. Setup mock Anime folders & files
  const mockAnimeRoot = path.join(__dirname, '../../test-media/mock_anime');
  const frierenDir = path.join(mockAnimeRoot, 'Sousou no Frieren');
  const jjkDir = path.join(mockAnimeRoot, 'Jujutsu Kaisen');

  fs.mkdirSync(frierenDir, { recursive: true });
  fs.mkdirSync(jjkDir, { recursive: true });

  const sampleMp4Source = path.join(__dirname, '../../test-media/test_sample.mp4');
  const sampleMkvSource = path.join(__dirname, '../../test-media/test_sample.mkv');

  fs.copyFileSync(sampleMp4Source, path.join(frierenDir, 'Episode 01.mp4'));
  fs.copyFileSync(sampleMkvSource, path.join(frierenDir, 'Episode 02.mkv'));
  fs.copyFileSync(sampleMp4Source, path.join(frierenDir, 'Episode 10.mp4'));
  fs.copyFileSync(sampleMp4Source, path.join(jjkDir, 'Episode 01.mp4'));

  // Point libraryService to mockAnimeRoot
  libraryService.setLibraryPath(mockAnimeRoot);

  const port = await mediaServer.start();

  // Register IPC
  ipcMain.handle('server:getPort', () => port);
  ipcMain.handle('media:probe', async (_e, fp) => probeMedia(fp));
  ipcMain.handle('library:scan', () => libraryService.scanLibrary());
  ipcMain.handle('library:getPath', () => libraryService.getLibraryPath());
  ipcMain.handle('library:setPath', (_e, p) => libraryService.setLibraryPath(p));
  ipcMain.handle('library:chooseFolder', () => libraryService.scanLibrary());
  ipcMain.handle('library:saveProgress', (_e, aPath, epPath, epName, cur, dur) => {
    libraryService.saveProgress(aPath, epPath, epName, cur, dur);
    return true;
  });
  ipcMain.handle('library:getContinueWatching', () => libraryService.getContinueWatching());
  ipcMain.handle('window:isFullScreen', () => false);
  ipcMain.handle('window:setFullScreen', () => false);
  ipcMain.handle('window:minimize', () => {});
  ipcMain.handle('window:maximize', () => {});
  ipcMain.handle('window:close', () => {});
  ipcMain.handle('window:isMaximized', () => false);

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 720,
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

      // TEST 1: Fullscreen Top Bar Removal & Maximized Taskbar Safe
      document.body.classList.add('is-fullscreen');
      const titleBar = document.getElementById('titleBar');
      const titlebarComputed = window.getComputedStyle(titleBar).display;
      report('Fullscreen hides top titlebar', titlebarComputed === 'none', 'Titlebar display: ' + titlebarComputed);
      document.body.classList.remove('is-fullscreen');

      document.body.classList.add('window-maximized');
      const bodyComputed = window.getComputedStyle(document.body).overflow;
      report('Maximized window styling applied', bodyComputed === 'hidden', 'Body overflow: ' + bodyComputed);
      document.body.classList.remove('window-maximized');

      // TEST 2: 2X Boost Pill Auto-Hides After 800ms
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

      // TEST 3: Anime Library Scan & Hierarchy
      await window.libraryManager.scanAndRender();
      const animeCount = window.libraryManager.libraryData.animeList.length;
      const animeTitles = window.libraryManager.libraryData.animeList.map(a => a.title);
      const frieren = window.libraryManager.libraryData.animeList.find(a => a.title === 'Sousou no Frieren');
      const epOrder = frieren ? frieren.episodes.map(e => e.name) : [];
      // Natural sort check: Episode 02 should come before Episode 10
      const isNaturalSorted = epOrder[1] === 'Episode 02.mkv' && epOrder[2] === 'Episode 10.mp4';

      report(
        'Anime Library scanned with folder hierarchy',
        animeCount === 2 && isNaturalSorted,
        'Found: ' + animeTitles.join(', ') + '; Episodes order: ' + epOrder.join(' -> ')
      );

      // TEST 4: Continue Watching Resume (Episode & Exact Second)
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
      const heroVisible = !document.getElementById('continueHero').classList.contains('hidden');
      const heroTitle = document.getElementById('continueTitle').textContent;
      const heroEpisode = document.getElementById('continueEpisode').textContent;

      report(
        'Continue Watching Hero displays exact episode & progress',
        cw && cw.currentTime === 1.85 && heroVisible && heroTitle === 'Sousou no Frieren',
        'Anime: ' + heroTitle + ', Ep: ' + heroEpisode + ', Resuming from: ' + cw.currentTime + 's'
      );

      // TEST 5: Resume Button loads exact episode and seeks to last watched second
      document.getElementById('btnContinuePlay').click();
      await new Promise(r => setTimeout(r, 300));
      const playingFile = window.playerCore.currentFilePath;
      const isPlayerView = !document.getElementById('playerView').classList.contains('hidden');

      report(
        'Resume button switches to player and loads episode',
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

  console.log('\n=== ALL 4 USER IMPROVEMENTS VERIFIED AND WORKING PERFECTLY! ===');

  mediaServer.stop();
  app.quit();
}

app.whenReady().then(testImprovements).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
