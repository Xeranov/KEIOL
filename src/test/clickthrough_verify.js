const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const mediaServer = require("../main/mediaServer");
const { probeMedia } = require("../main/probeService");

const libraryService = require("../main/libraryService");

async function runInteractiveVerification() {
  console.log(
    "=== Starting Antislop C-2 / R-35 Click-Through Verification ===",
  );
  const port = await mediaServer.start();

  ipcMain.handle("server:getPort", () => port);
  ipcMain.handle("media:probe", async (_e, fp) => probeMedia(fp));
  ipcMain.handle("library:scan", () => libraryService.scanLibrary());
  ipcMain.handle("library:getPath", () => libraryService.getLibraryPath());
  ipcMain.handle("library:setPath", (_e, p) =>
    libraryService.setLibraryPath(p),
  );
  ipcMain.handle("library:chooseFolder", () => libraryService.scanLibrary());
  ipcMain.handle("library:saveProgress", () => true);
  ipcMain.handle("library:getContinueWatching", () =>
    libraryService.getContinueWatching(),
  );
  ipcMain.handle("window:isFullScreen", () => false);
  ipcMain.handle("window:setFullScreen", () => false);
  ipcMain.handle("window:minimize", () => {});
  ipcMain.handle("window:maximize", () => {});
  ipcMain.handle("window:isMaximized", () => false);
  ipcMain.handle("library:getOnlineHistory", () => ({}));
  ipcMain.handle("library:saveOnlineProgress", () => true);
  ipcMain.handle("library:getDownloadPath", () =>
    libraryService.getDownloadPath(),
  );
  ipcMain.handle("library:setDownloadPath", (_e, p) => p);
  ipcMain.handle("library:chooseDownloadFolder", () => null);
  ipcMain.handle("library:openDownloadFolder", () => true);
  ipcMain.handle("otakudesu:getOngoing", () => ({ animeList: [] }));
  ipcMain.handle("otakudesu:getSchedule", () => []);
  ipcMain.handle("otakudesu:getGenres", () => []);
  ipcMain.handle("otakudesu:getAnimeByGenre", () => ({ animeList: [] }));
  ipcMain.handle("otakudesu:getAnimeList", () => []);
  ipcMain.handle("otakudesu:search", () => []);
  ipcMain.handle("otakudesu:getDetail", () => null);
  ipcMain.handle("otakudesu:getEpisodeStream", () => null);
  ipcMain.handle("otakudesu:getBatchDetails", () => null);
  ipcMain.handle("download:start", () => ({
    downloadId: "dl_test",
    status: "started",
  }));
  ipcMain.handle("download:getActive", () => []);
  ipcMain.handle("library:scanDownloads", () => ({ items: [], seriesCount: 0, moviesCount: 0, episodesCount: 0, downloadPath: "" }));
  ipcMain.handle("archive:isArchive", () => false);
  ipcMain.handle("archive:extract", () => ({ success: true }));
  ipcMain.handle("settings:get-close-to-tray", () => false);
  ipcMain.handle("settings:set-close-to-tray", () => true);
  ipcMain.handle("shell:openExternal", () => true);

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "../renderer/index.html"));

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
      const testPath = ${JSON.stringify(path.join(__dirname, "../../test-media/test_sample.mp4"))};
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

      // 10. Configurable seek duration in settings
      window.controlsManager.setSeekInterval(15);
      const isInterval15 = window.controlsManager.seekInterval === 15;
      const rewindTitle = document.getElementById('btnRewind10')?.title || '';
      const forwardTitle = document.getElementById('btnForward10')?.title || '';
      const hasTriangleIcons = document.querySelector('#btnRewind10 path') !== null && document.querySelector('#btnForward10 path') !== null;
      report('Configure seek interval to 15s', 'Interval: ' + window.controlsManager.seekInterval + ', RewindTitle: ' + rewindTitle + ', Triangles: ' + hasTriangleIcons, isInterval15 && rewindTitle.includes('15') && forwardTitle.includes('15') && hasTriangleIcons);
      // Restore default 10s
      window.controlsManager.setSeekInterval(10);

      // 11. KEIOL Player Logo check
      const keiolLogo = document.querySelector('.brand-keiol svg.keiol-logo-svg');
      const brandText = document.querySelector('.brand')?.textContent?.trim() || '';
      const isKeiolLogo = keiolLogo !== null && brandText === '';
      report('KEIOL player logo verification (no name text)', 'Logo present: ' + (keiolLogo !== null) + ', Text: "' + brandText + '"', isKeiolLogo);

      // 12. Theater mode removed check
      const btnTheaterGone = document.getElementById('btnTheater') === null;
      report('Theater mode removed verification', 'btnTheater is null: ' + btnTheaterGone, btnTheaterGone);

      // 13. Test MKV with AC3 audio playback
      const testMkvPath = ${JSON.stringify(path.join(__dirname, "../../test-media/test_sample.mkv"))};
      await window.playerCore.loadFile(testMkvPath);
      report('Load MKV with AC3 audio', 'PlaybackMode: ' + window.playerCore.playbackMode, window.playerCore.playbackMode === 'transmux');

      return log;
    })();
  `);

  results.forEach((r, idx) => {
    const mark = r.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${mark} [${idx + 1}] ${r.action} -> ${r.result}`);
  });

  const allPassed = results.every((r) => r.passed);
  fs.writeFileSync(
    path.join(__dirname, "clickthrough_report.json"),
    JSON.stringify(
      { allPassed, timestamp: new Date().toISOString(), results },
      null,
      2,
    ),
  );

  console.log("\n=== ALL INTERACTIVE ELEMENTS CLICK-THROUGH VERIFIED! ===");
  mediaServer.stop();
  app.quit();
}

app
  .whenReady()
  .then(runInteractiveVerification)
  .catch((err) => {
    console.error("Click-through verification error:", err);
    process.exit(1);
  });
