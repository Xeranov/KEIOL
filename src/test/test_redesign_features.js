const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const mediaServer = require('../main/mediaServer');
const { probeMedia } = require('../main/probeService');
const libraryService = require('../main/libraryService');

const mockDir = path.resolve(__dirname, '../../test-media/mock_library');
libraryService.setLibraryPath(mockDir);

let mainWindow = null;

async function runRedesignTests() {
  await app.whenReady();
  const port = await mediaServer.start();

  // Register IPC Handlers for test
  ipcMain.handle('server:getPort', () => port);
  ipcMain.handle('media:probe', async (_e, fp) => probeMedia(fp));
  ipcMain.handle('library:scan', () => libraryService.scanLibrary());
  ipcMain.handle('library:getPath', () => libraryService.getLibraryPath());
  ipcMain.handle('library:setPath', (_e, p) => libraryService.setLibraryPath(p));
  ipcMain.handle('library:chooseFolder', () => libraryService.scanLibrary());
  ipcMain.handle('library:openFolderInExplorer', async () => true);
  ipcMain.handle('library:saveProgress', (_e, sPath, epPath, epName, cur, dur) => {
    libraryService.saveProgress(sPath, epPath, epName, cur, dur);
    return true;
  });
  ipcMain.handle('library:getContinueWatching', () => libraryService.getContinueWatching());
  ipcMain.handle('window:isFullScreen', () => false);
  ipcMain.handle('window:setFullScreen', () => false);
  ipcMain.handle('window:minimize', () => {});
  ipcMain.handle('window:maximize', () => false);
  ipcMain.handle('window:isMaximized', () => false);
  ipcMain.handle('library:getOnlineHistory', () => ({}));
  ipcMain.handle('library:saveOnlineProgress', () => true);
  ipcMain.handle('library:getDownloadPath', () => libraryService.getDownloadPath());
  ipcMain.handle('library:setDownloadPath', (_e, p) => p);
  ipcMain.handle('library:chooseDownloadFolder', () => null);
  ipcMain.handle('library:openDownloadFolder', () => true);
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
  ipcMain.handle('app:getVersion', () => '1.1.1');
  ipcMain.handle('settings:get-close-to-tray', () => false);
  ipcMain.handle('settings:set-close-to-tray', () => true);
  ipcMain.handle('archive:isArchive', () => false);
  ipcMain.handle('archive:extract', () => true);
  ipcMain.handle('anichin:getOngoing', () => ({ data: [], totalPages: 1 }));
  ipcMain.handle('anichin:getSchedule', () => ({}));
  ipcMain.handle('anichin:getAnimeList', () => []);
  ipcMain.handle('anichin:getDetail', () => null);
  ipcMain.handle('anichin:getEpisodeStream', () => null);
  ipcMain.handle('anichin:search', () => []);
  ipcMain.handle('aniskip:getSkipTimes', async () => ({ found: false }));
  ipcMain.handle('aniskip:validateSkipIntervals', () => null);
  ipcMain.handle('aniskip:extractEpisodeNumber', () => 1);
  ipcMain.handle('otakudesu:resolveStreamUrl', () => null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  const results = await mainWindow.webContents.executeJavaScript(`
    (async () => {
      const logs = [];
      const report = (name, passed, detail) => logs.push({ name, passed, detail });

      // 1. KEIOL Player Logo check
      const logoEl = document.querySelector('.brand-keiol svg.keiol-logo-svg');
      const brandText = document.querySelector('.brand')?.textContent?.trim() || '';
      report('1. Logo KEIOL tanpa teks nama', logoEl !== null && brandText === '', 'SVG found: ' + (logoEl !== null) + ', Text: "' + brandText + '"');

      // 2. Folder Button Explorer Integration
      const chooseFolderBtn = document.getElementById('btnChooseFolder');
      const changeFolderBtn = document.getElementById('btnChangeFolder');
      const hasExplorerAPI = typeof window.electronAPI.openFolderInExplorer === 'function';
      report('2. Tombol Explorer & ganti folder tersedia', chooseFolderBtn !== null && changeFolderBtn !== null && hasExplorerAPI, 'ChooseBtn: ' + !!chooseFolderBtn + ', ChangeBtn: ' + !!changeFolderBtn + ', API: ' + hasExplorerAPI);

      // 3. Scan library and verify Series & Episodes Gallery (Netflix style)
      await window.libraryManager.scanAndRender();
      const seriesList = window.libraryManager.libraryData.seriesList || [];
      const testSeries = seriesList.find(s => s.title === 'Sousou no Frieren');
      
      // Open Netflix-style episodes modal
      window.libraryManager.openEpisodesModal(testSeries);
      const modal = document.getElementById('episodesModal');
      const isModalVisible = !modal.classList.contains('hidden');
      const episodeCards = document.querySelectorAll('.episode-gallery-card');
      const firstCardThumb = episodeCards[0]?.querySelector('.ep-gallery-thumb-img');
      const hasThumbUrl = firstCardThumb && firstCardThumb.src.includes('/thumbnail?path=');
      
      report('3. Klik anime membuka galeri kartu episode dengan thumbnail 16:9 ala Netflix',
        isModalVisible && episodeCards.length === 3 && hasThumbUrl,
        'Modal visible: ' + isModalVisible + ', Cards: ' + episodeCards.length + ', Thumb: ' + (firstCardThumb?.src || 'none')
      );

      // 4. Verification: Back to Home button in window titlebar beside logo (icon-only, no text)
      const btnBackToGallery = document.getElementById('btnBackToGallery');
      const isBesideLogo = btnBackToGallery?.parentElement?.classList.contains('titlebar-drag-region');
      const backBtnText = btnBackToGallery?.textContent?.trim() || '';
      report('4. Tombol beranda di window titlebar samping logo dan tanpa teks',
        btnBackToGallery !== null && isBesideLogo && backBtnText === '',
        'InTitlebar: ' + isBesideLogo + ', Text: "' + backBtnText + '"'
      );

      // 5. Verification: Window titlebar has no xplayer or vidplayer text
      const titleBarText = document.getElementById('titleBar')?.textContent || '';
      const hasXPlayerOrVidPlayer = /xplayer|vidplayer/i.test(titleBarText);
      report('5. Hapus tulisan xplayer dan vidplayer di window atas',
        !hasXPlayerOrVidPlayer,
        'Titlebar text clean: ' + !hasXPlayerOrVidPlayer
      );

      // 6. Verification: Triangle arrow icons for rewind and forward buttons (no text/numbers)
      const rewindPath = document.querySelector('#btnRewind10 path');
      const forwardPath = document.querySelector('#btnForward10 path');
      const rewindText = document.querySelector('#btnRewind10 text');
      const forwardText = document.querySelector('#btnForward10 text');
      report('6. Ganti icon maju atau mundur jadi arrow segitiga saja (tanpa teks angka)',
        rewindPath !== null && forwardPath !== null && rewindText === null && forwardText === null,
        'RewindPath: ' + !!rewindPath + ', ForwardPath: ' + !!forwardPath + ', NoText: ' + (rewindText === null && forwardText === null)
      );

      // 7. Verification: Lock Feature with click-to-reveal transparent unlock button
      const btnLock = document.getElementById('btnLockPlayer');
      const btnUnlock = document.getElementById('btnFloatingUnlock');
      const floatingLockBadge = document.getElementById('floatingLockBadge');
      const videoWrapper = document.getElementById('videoWrapper');

      btnLock.click();
      const isLocked = window.controlsManager.isLocked === true;
      const controlsLocked = document.getElementById('controlsBar').classList.contains('locked');
      const badgeInitiallyHidden = floatingLockBadge.classList.contains('hidden');

      // Moving mouse when locked should NOT reveal controls nor the unlock badge
      window.dispatchEvent(new MouseEvent('mousemove'));
      const controlsStillLocked = document.getElementById('controlsBar').classList.contains('locked');
      const badgeStillHidden = floatingLockBadge.classList.contains('hidden');

      // Clicking videoWrapper once should reveal the transparent padlock button
      videoWrapper.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      const badgeRevealedOnClick = !floatingLockBadge.classList.contains('hidden');
      const unlockBtnText = btnUnlock.textContent.trim();
      const isUnlockIconOnly = unlockBtnText === '';

      // Check unlock button is positioned at top of screen and cursor is not hidden
      const badgeRect = floatingLockBadge.getBoundingClientRect();
      const isAtTop = badgeRect.top < 120;
      const csWrapper = window.getComputedStyle(videoWrapper);
      const isCursorVisible = csWrapper.cursor !== 'none';

      // Unlocking via floating padlock button
      btnUnlock.click();
      const isUnlocked = window.controlsManager.isLocked === false;

      // Verify Alt+Tab preservation (Alt keydown not cancelled/swallowed)
      const altEvent = new KeyboardEvent('keydown', { key: 'Tab', altKey: true, cancelable: true });
      window.dispatchEvent(altEvent);
      const altSafe = !altEvent.defaultPrevented;

      report('7. Fitur lock: tombol unlock di atas layar, kursor tidak hilang, icon-only, dan Alt+Tab aman',
        isLocked && controlsLocked && badgeInitiallyHidden && badgeStillHidden && badgeRevealedOnClick && isAtTop && isCursorVisible && isUnlockIconOnly && isUnlocked && altSafe,
        'Locked: ' + isLocked + ', AtTop: ' + isAtTop + ' (' + Math.round(badgeRect.top) + 'px), Cursor: ' + csWrapper.cursor + ', RevealedOnClick: ' + badgeRevealedOnClick + ', IconOnly: ' + isUnlockIconOnly + ', AltSafe: ' + altSafe
      );

      // 8. Verification: Stop playback completely when returning to beranda
      if (episodeCards[0]) {
        episodeCards[0].click();
      }
      const playerView = document.getElementById('playerView');
      const isPlayerView = !playerView.classList.contains('hidden');
      
      // Click back to gallery
      btnBackToGallery.click();
      const isGalleryView = !document.getElementById('galleryView').classList.contains('hidden') && playerView.classList.contains('hidden');
      const isVideoStopped = window.playerCore.video.paused && window.playerCore.currentFilePath === null;

      report('8. Kembali ke beranda menghentikan total pemutaran video',
        isPlayerView && isGalleryView && isVideoStopped,
        'WasInPlayer: ' + isPlayerView + ', BackToGallery: ' + isGalleryView + ', VideoStopped: ' + isVideoStopped
      );

      // 9. Right scrollbar slider hidden
      const content = document.querySelector('.netflix-content');
      const computedStyle = window.getComputedStyle(content);
      const scrollbarWidth = computedStyle.getPropertyValue('scrollbar-width');
      report('9. Slider scrollbar kanan disembunyikan', scrollbarWidth === 'none', 'scrollbar-width: ' + scrollbarWidth);

      // 10. Toggle remaining playback time display on click
      const timeDisplay = document.getElementById('timeDisplay');
      const totalDurDisplay = document.getElementById('totalDuration');
      window.controlsManager.updateTimeDisplay(45, 120);
      const initialTotalText = totalDurDisplay.textContent.trim(); // "2:00"

      timeDisplay.click();
      const isRemainingMode = window.controlsManager.showRemainingTime === true;
      const remainingText = totalDurDisplay.textContent.trim(); // "-1:15"

      timeDisplay.click();
      const isBackToDurationMode = window.controlsManager.showRemainingTime === false;
      const restoredTotalText = totalDurDisplay.textContent.trim();

      report('11. Klik waktu pemutaran berganti ke waktu putar sisa berapa menit (-MM:SS)',
        initialTotalText === '2:00' && isRemainingMode && remainingText === '-1:15' && isBackToDurationMode && restoredTotalText === '2:00',
        'Initial: ' + initialTotalText + ', RemainingMode: ' + remainingText + ', Restored: ' + restoredTotalText
      );

      // 12. Last watched frame thumbnail in Continue Watching & Hero Billboard Backdrop
      const mockDirPath = ${JSON.stringify(mockDir.replace(/\\/g, '/'))};
      const continueWatchingData = {
        seriesPath: mockDirPath + '/Sousou no Frieren',
        title: 'Sousou no Frieren',
        episodePath: mockDirPath + '/Sousou no Frieren/Episode 01.mp4',
        episodeName: 'Episode 01.mp4',
        currentTime: 75,
        duration: 1500,
        lastWatched: new Date().toISOString()
      };
      window.libraryManager.libraryData.continueWatching = continueWatchingData;
      window.libraryManager.renderBillboard();
      window.libraryManager.renderRows();

      const billboardEl = document.getElementById('billboardBackdrop');
      const billboardBg = billboardEl ? (billboardEl.style.backgroundImage || '') : '';
      const hasBillboardTimeParam = billboardBg.includes('time=75');

      const continueCardThumb = document.querySelector('#sliderContinue .netflix-card img');
      const cardThumbSrc = continueCardThumb ? continueCardThumb.src : '';
      const hasCardTimeParam = cardThumbSrc.includes('time=75');

      report('12. Thumbnail dan backdrop beranda menggunakan frame terakhir yang ditonton',
        hasBillboardTimeParam && hasCardTimeParam,
        'BillboardBgTime: ' + hasBillboardTimeParam + ', CardThumbTime: ' + hasCardTimeParam
      );

      // 12. Beranda and Web Tabs & Search
      const tabHome = document.getElementById('tabHome');
      const tabWeb = document.getElementById('tabWeb');
      const webSection = document.getElementById('webSection');
      const netflixContent = document.getElementById('netflixContent');
      const searchInput = document.getElementById('inputSearchAnime');

      // Click Web tab
      tabWeb.click();
      const webActive = tabWeb.classList.contains('active');
      const webVisible = !webSection.classList.contains('hidden');
      const netflixHidden = netflixContent.classList.contains('hidden');

      // Click Home tab
      tabHome.click();
      const homeActive = tabHome.classList.contains('active');
      const webHidden = webSection.classList.contains('hidden');
      const netflixVisible = !netflixContent.classList.contains('hidden');

      report('13. Tab navigasi Beranda & Web serta integrasi web siap pakai',
        webActive && webVisible && netflixHidden && homeActive && webHidden && netflixVisible && !!searchInput,
        'webActive: ' + webActive + ', webVisible: ' + webVisible + ', netflixHidden: ' + netflixHidden + ', homeActive: ' + homeActive + ', webHidden: ' + webHidden + ', netflixVisible: ' + netflixVisible + ', search: ' + !!searchInput
      );

      return logs;
    })();
  `);

  console.log('\n==================================================');
  console.log('VidPlayer: New Redesign & User Improvements Verification');
  console.log('==================================================\n');

  let allPassed = true;
  results.forEach(r => {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    if (!r.passed) allPassed = false;
    console.log(`${mark}: ${r.name}`);
    console.log(`    Detail: ${r.detail}`);
  });

  // 7. Verify Thumbnail Endpoint via direct HTTP request
  const testEpPath = path.join(mockDir, 'Sousou no Frieren/Episode 01.mp4');
  const thumbUrl = `http://127.0.0.1:${mediaServer.port}/thumbnail?path=${encodeURIComponent(testEpPath)}`;

  const thumbTestPassed = await new Promise((resolve) => {
    http.get(thumbUrl, (res) => {
      let dataLen = 0;
      res.on('data', chunk => dataLen += chunk.length);
      res.on('end', () => {
        const isJpg = res.headers['content-type'] === 'image/jpeg';
        const hasContent = dataLen > 1000;
        console.log(`${isJpg && hasContent ? '✓ PASS' : '✗ FAIL'}: 10. Endpoint /thumbnail menghasilkan gambar JPEG valid dari video`);
        console.log(`    Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']}, Size: ${dataLen} bytes`);
        resolve(res.statusCode === 200 && isJpg && hasContent);
      });
    }).on('error', (err) => {
      console.log('✗ FAIL: 10. Thumbnail HTTP error:', err.message);
      resolve(false);
    });
  });

  if (!thumbTestPassed) allPassed = false;

  console.log('\n==================================================');
  if (allPassed) {
    console.log('🎉 ALL REDESIGN & USER IMPROVEMENTS PASSED!');
  } else {
    console.error('❌ SOME REDESIGN TESTS FAILED');
  }
  console.log('==================================================\n');

  mediaServer.stop();
  mainWindow.close();
  app.quit();
  process.exit(allPassed ? 0 : 1);
}

runRedesignTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
