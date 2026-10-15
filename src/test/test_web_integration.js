const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaServer = require('../main/mediaServer');
const { probeMedia } = require('../main/probeService');
const libraryService = require('../main/libraryService');
const otakudesuService = require('../main/otakudesuService');
const downloadManager = require('../main/downloadManager');

async function runWebIntegrationTest() {
  console.log('=== Starting Otakudesu & Web Tab Integration Verification ===');
  const port = await mediaServer.start();

  // Register all actual production IPC handlers
  ipcMain.handle('server:getPort', () => port);
  ipcMain.handle('media:probe', async (_e, fp) => probeMedia(fp));
  ipcMain.handle('library:scan', () => libraryService.scanLibrary());
  ipcMain.handle('library:getPath', () => libraryService.getLibraryPath());
  ipcMain.handle('library:setPath', (_e, p) => libraryService.setLibraryPath(p));
  ipcMain.handle('library:chooseFolder', () => libraryService.scanLibrary());
  ipcMain.handle('library:openFolderInExplorer', async () => true);
  ipcMain.handle('library:saveProgress', (_e, s, p, n, c, d) => libraryService.saveProgress(s, p, n, c, d));
  ipcMain.handle('library:getContinueWatching', () => libraryService.getContinueWatching());

  ipcMain.handle('library:getDownloadPath', () => libraryService.getDownloadPath());
  ipcMain.handle('library:setDownloadPath', (_e, p) => libraryService.setDownloadPath(p));
  ipcMain.handle('library:chooseDownloadFolder', () => null);
  ipcMain.handle('library:openDownloadFolder', () => true);
  ipcMain.handle('library:saveOnlineProgress', (_e, s, t, u, epT, c, d, p) => {
    libraryService.saveOnlineProgress(s, t, u, epT, c, d, p);
    return true;
  });
  ipcMain.handle('library:getOnlineHistory', () => libraryService.getOnlineHistory());

  ipcMain.handle('otakudesu:getOngoing', async (_e, page) => otakudesuService.getOngoing(page));
  ipcMain.handle('otakudesu:getSchedule', async () => otakudesuService.getSchedule());
  ipcMain.handle('otakudesu:getGenres', async () => otakudesuService.getGenres());
  ipcMain.handle('otakudesu:getAnimeByGenre', async (_e, s, p) => otakudesuService.getAnimeByGenre(s, p));
  ipcMain.handle('otakudesu:getAnimeList', async () => otakudesuService.getAnimeList());
  ipcMain.handle('otakudesu:search', async (_e, q) => otakudesuService.search(q));
  ipcMain.handle('otakudesu:getDetail', async (_e, u) => otakudesuService.getAnimeDetail(u));
  ipcMain.handle('otakudesu:getEpisodeStream', async (_e, u) => otakudesuService.getEpisodeStream(u));
  ipcMain.handle('otakudesu:getBatchDetails', async (_e, u) => otakudesuService.getBatchDetails(u));

  ipcMain.handle('download:start', async (_e, opts) => downloadManager.startDownload(opts));
  ipcMain.handle('download:cancel', (_e, id) => downloadManager.cancelDownload(id));
  ipcMain.handle('download:getActive', () => downloadManager.getActiveDownloads());

  ipcMain.handle('window:isFullScreen', () => false);
  ipcMain.handle('window:setFullScreen', () => false);
  ipcMain.handle('window:minimize', () => {});
  ipcMain.handle('window:maximize', () => {});
  ipcMain.handle('window:close', () => {});
  ipcMain.handle('window:isMaximized', () => false);

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
      const logs = [];
      const report = (name, passed, detail) => logs.push({ name, passed, detail });

      // Wait for otakudesuManager to be ready
      for (let i = 0; i < 50; i++) {
        if (window.otakudesuManager) break;
        await new Promise(r => setTimeout(r, 100));
      }

      // 1. Verify OtakudesuManager initialized
      const mgr = window.otakudesuManager;
      report('1. OtakudesuManager diinisialisasi', !!mgr, 'Manager exists: ' + !!mgr);

      // 2. Verify Web tab subnav pills
      const pillOngoing = document.getElementById('pillOngoing');
      const pillSchedule = document.getElementById('pillSchedule');
      const pillGenres = document.getElementById('pillGenres');
      const pillAnimeList = document.getElementById('pillAnimeList');
      const pillDownloaded = document.getElementById('pillDownloaded');
      const allPills = pillOngoing && pillSchedule && pillGenres && pillAnimeList && pillDownloaded;
      report('2. Sub-nav pills Web lengkap (Ongoing, Jadwal, Genre, A-Z, Downloaded)', !!allPills, 'Pills found: ' + !!allPills);

      // 3. Switch to Web tab
      window.libraryManager.switchNavTab('web');
      const webSecVisible = !document.getElementById('webSection').classList.contains('hidden');
      const homeSecHidden = document.getElementById('netflixContent').classList.contains('hidden');
      report('3. Navigasi beralih ke tab Web', webSecVisible && homeSecHidden, 'WebVisible: ' + webSecVisible + ', HomeHidden: ' + homeSecHidden);

      // 4. Verify Download Folder Setting Pill
      const btnDlSetting = document.getElementById('btnDownloadFolderSetting');
      const dlLabel = document.getElementById('downloadFolderLabel');
      report('4. Tombol setelan folder download aktif', !!btnDlSetting && !!dlLabel && dlLabel.textContent.includes('Folder'), 'Label: ' + (dlLabel?.textContent));

      // 5. Test switching to Downloaded sub-tab
      mgr.switchSubTab('downloaded');
      for (let i = 0; i < 30; i++) {
        if (document.querySelector('.downloaded-folder-info')) break;
        await new Promise(r => setTimeout(r, 100));
      }
      const isDlActive = pillDownloaded.classList.contains('active');
      const hasDlHeader = document.querySelector('.downloaded-folder-info') !== null;
      report('5. Sub-tab Downloaded memuat info penyimpanan', isDlActive && hasDlHeader, 'Active: ' + isDlActive + ', Header: ' + hasDlHeader);

      // 6. Test switching to Schedule sub-tab
      mgr.switchSubTab('schedule');
      await new Promise(r => setTimeout(r, 200));
      const isSchedActive = pillSchedule.classList.contains('active');
      report('6. Sub-tab Jadwal Rilis beralih', isSchedActive, 'Schedule active: ' + isSchedActive);

      // 7. Test switching back to Ongoing sub-tab
      mgr.switchSubTab('ongoing');
      await new Promise(r => setTimeout(r, 200));
      const isOngoingActive = pillOngoing.classList.contains('active');
      report('7. Sub-tab Sedang Tayang beralih', isOngoingActive, 'Ongoing active: ' + isOngoingActive);

      // 8. Verify Otakudesu detail modal elements exist
      const modal = document.getElementById('otakudesuDetailModal');
      const resModal = document.getElementById('resolutionPickerModal');
      const toast = document.getElementById('downloadManagerToast');
      report('8. Modal detail, pemilih resolusi, dan toast download siap di DOM', !!modal && !!resModal && !!toast, 'Modals ready');

      // 9. Verify online watch history recording
      await window.electronAPI.saveOnlineProgress(
        'spy-family',
        'SPY x FAMILY',
        'https://otakudesu.blog/episode/spy-1',
        'Episode 1',
        600,
        1440,
        'https://example.com/poster.jpg'
      );
      await mgr.refreshOnlineHistory();
      const saved = mgr.onlineHistory['spy-family'];
      const hasSaved = saved && saved.episodes['https://otakudesu.blog/episode/spy-1'] && saved.episodes['https://otakudesu.blog/episode/spy-1'].currentTime === 600;
      report('9. Pencatatan Watch History streaming online tersimpan dan tersinkronisasi', !!hasSaved, 'Saved: ' + !!hasSaved);

      return logs;
    })();
  `);

  console.log('\n=== Hasil Pengujian Web Integration ===');
  let allPassed = true;
  for (const item of results) {
    if (item.passed) {
      console.log(`✓ PASS: ${item.name}`);
      console.log(`    Detail: ${item.detail}`);
    } else {
      console.error(`✗ FAIL: ${item.name}`);
      console.error(`    Detail: ${item.detail}`);
      allPassed = false;
    }
  }

  win.close();
  await mediaServer.stop();

  if (allPassed) {
    console.log('\n🎉 INTEGRASI OTAKUDESU & WEB TAB BERHASIL 100%!\n');
    app.quit();
    process.exit(0);
  } else {
    console.error('\n❌ Ada tes yang gagal.');
    app.quit();
    process.exit(1);
  }
}

app.whenReady().then(runWebIntegrationTest).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
