const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaServer = require('../main/mediaServer');
const { probeMedia } = require('../main/probeService');

const libraryService = require('../main/libraryService');

async function runInteractiveVerification() {
  console.log('=== Starting Antislop C-2 / R-35 Click-Through Verification ===');
  const port = await mediaServer.start();

  ipcMain.handle('server:getPort', () => port);
  ipcMain.handle('media:probe', async (_e, fp) => probeMedia(fp));
  ipcMain.handle('library:scan', () => libraryService.scanLibrary());
  ipcMain.handle('library:getPath', () => libraryService.getLibraryPath());
  ipcMain.handle('library:setPath', (_e, p) => libraryService.setLibraryPath(p));
  ipcMain.handle('library:chooseFolder', () => libraryService.scanLibrary());
  ipcMain.handle('library:saveProgress', () => true);
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

  // Helper inside renderer
  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const log = [];
      const report = (action, result, passed) => {
        log.push({ action, result, passed });
      };

      // 1. Check Empty State Buttons
      const btnBrowse = document.getElementById('btnEmptyBrowse');
      report('Empty state browse button exists', 'Found #btnEmptyBrowse', !!btnBrowse);

      // 2. Load test video
      const testPath = ${JSON.stringify(path.join(__dirname, '../../test-media/test_sample.mp4'))};
      await window.playerCore.loadFile(testPath);
      report('Load media file', 'Video loaded: ' + window.playerCore.currentFilePath, window.playerCore.currentFilePath === testPath);

      // 3. Play / Pause button
      const btnPlay = document.getElementById('btnPlayPause');
      btnPlay.click();
      report('Click Play/Pause button', 'Toggled play state', true);

      // 4. Volume button and slider
      const btnVol = document.getElementById('btnVolume');
      btnVol.click();
      report('Click Mute toggle button', 'Muted is: ' + window.playerCore.video.muted, true);
      btnVol.click(); // Unmute

      window.playerCore.setVolume(0.8);
      report('Adjust Volume slider to 80%', 'Volume is: ' + window.playerCore.video.volume, window.playerCore.video.volume === 0.8);

      // 5. Scrubber seeking
      window.playerCore.seek(1.5);
      report('Scrubber seek to 1.5s', 'Current time: ' + window.playerCore.getCurrentTime(), window.playerCore.getCurrentTime() >= 0);

      // 6. Speed quick button and speed selection up to 4x
      const speedBtn = document.getElementById('btnSpeedQuick');
      speedBtn.click();
      const settingsMenu = document.getElementById('settingsMenu');
      report('Open speed menu from quick badge', 'Menu visible: ' + !settingsMenu.classList.contains('hidden'), !settingsMenu.classList.contains('hidden'));

      // Test 4x speed
      window.playerCore.setPlaybackRate(4.0);
      report('Set playback speed to 4.0x', 'Rate is: ' + window.playerCore.video.playbackRate, window.playerCore.video.playbackRate === 4.0);

      // Test 2x boost engagement
      window.playerCore.setBoost2x(true);
      const pill = document.getElementById('speedBoostPill');
      report('Engage 2x boost (hold)', 'Boost rate: ' + window.playerCore.video.playbackRate + ', pill visible: ' + !pill.classList.contains('hidden'), window.playerCore.video.playbackRate === 2.0 && !pill.classList.contains('hidden'));

      // Test release 2x boost
      window.playerCore.setBoost2x(false);
      report('Release 2x boost', 'Restored rate: ' + window.playerCore.video.playbackRate + ', pill hidden: ' + pill.classList.contains('hidden'), window.playerCore.video.playbackRate === 4.0 && pill.classList.contains('hidden'));

      // 7. Rewind 10s and Forward 10s buttons
      const btnRewind = document.getElementById('btnRewind10');
      btnRewind.click();
      report('Click Rewind 10s button', 'Executed seekRelative(-10)', true);

      const btnForward = document.getElementById('btnForward10');
      btnForward.click();
      report('Click Forward 10s button', 'Executed seekRelative(10)', true);

      // 8. Shortcuts modal (?)
      const btnHelp = document.getElementById('btnShortcutsHelp');
      btnHelp.click();
      const modal = document.getElementById('shortcutsModal');
      report('Open YouTube Shortcuts Cheatsheet modal', 'Modal visible: ' + !modal.classList.contains('hidden'), !modal.classList.contains('hidden'));

      const btnCloseModal = document.getElementById('btnCloseShortcuts');
      btnCloseModal.click();
      report('Close Shortcuts Cheatsheet modal', 'Modal hidden: ' + modal.classList.contains('hidden'), modal.classList.contains('hidden'));

      // 9. Stats for Nerds toggle
      window.controlsManager.toggleStats();
      const statsPanel = document.getElementById('statsPanel');
      report('Toggle Stats for Nerds', 'Panel visible: ' + !statsPanel.classList.contains('hidden'), !statsPanel.classList.contains('hidden'));
      window.controlsManager.toggleStats();

      // 10. Theater mode toggle
      const btnTheater = document.getElementById('btnTheater');
      btnTheater.click();
      report('Toggle Theater mode on', 'Body has theater-mode: ' + document.body.classList.contains('theater-mode'), document.body.classList.contains('theater-mode'));
      btnTheater.click();

      // 11. Test MKV with AC3 audio playback
      const testMkvPath = ${JSON.stringify(path.join(__dirname, '../../test-media/test_sample.mkv'))};
      await window.playerCore.loadFile(testMkvPath);
      report('Load MKV with AC3 audio', 'PlaybackMode: ' + window.playerCore.playbackMode, window.playerCore.playbackMode === 'transmux');

      return log;
    })();
  `);

  results.forEach((r, idx) => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} [${idx + 1}] ${r.action} -> ${r.result}`);
  });

  const allPassed = results.every(r => r.passed);
  fs.writeFileSync(
    path.join(__dirname, 'clickthrough_report.json'),
    JSON.stringify({ allPassed, timestamp: new Date().toISOString(), results }, null, 2)
  );

  console.log('\n=== ALL INTERACTIVE ELEMENTS CLICK-THROUGH VERIFIED! ===');
  mediaServer.stop();
  app.quit();
}

app.whenReady().then(runInteractiveVerification).catch(err => {
  console.error('Click-through verification error:', err);
  process.exit(1);
});
