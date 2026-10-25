const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mediaServer = require('../main/mediaServer');
const idlixService = require('../main/idlixService');

// Register Idlix and minimal app handlers
ipcMain.handle('idlix:getMovies', async (_event, options) => idlixService.getMovies(options));
ipcMain.handle('idlix:getSeries', async (_event, options) => idlixService.getSeries(options));
ipcMain.handle('idlix:getMovieDetail', async (_event, slug) => idlixService.getMovieDetail(slug));
ipcMain.handle('idlix:getSeriesDetail', async (_event, slug) => idlixService.getSeriesDetail(slug));
ipcMain.handle('idlix:getSeasonEpisodes', async (_event, slug, seasonNumber) => idlixService.getSeasonEpisodes(slug, seasonNumber));
ipcMain.handle('idlix:search', async (_event, query, type) => idlixService.search(query, type));
ipcMain.handle('idlix:getFilterOptions', async (_event, type) => idlixService.getFilterOptions(type));
ipcMain.handle('idlix:getTrending', async () => idlixService.getTrending());
ipcMain.handle('idlix:initiateStreamSession', async (_event, contentType, contentId) => idlixService.initiateStreamSession(contentType, contentId));
ipcMain.handle('idlix:claimAndRedeemStream', async (_event, gateToken, unlockAt) => idlixService.claimAndRedeemStream(gateToken, unlockAt));
ipcMain.handle('server:getPort', () => mediaServer.port);
ipcMain.handle('library:scan', () => ({ items: [], libraryPath: '' }));
ipcMain.handle('library:getPath', () => '');
ipcMain.handle('library:getContinueWatching', () => []);
ipcMain.handle('library:getOnlineHistory', () => []);
ipcMain.handle('app:getVersion', () => '1.2.0');
ipcMain.handle('otakudesu:getSchedule', () => ({}));
ipcMain.handle('anichin:getSchedule', () => ({}));
ipcMain.handle('otakudesu:getGenres', () => []);
ipcMain.handle('otakudesu:getAnimeList', () => []);
ipcMain.handle('kusonime:getAnimeList', () => []);
ipcMain.handle('anichin:getAnimeList', () => []);
ipcMain.handle('otakudesu:getOngoing', () => []);
ipcMain.handle('anichin:getOngoing', () => []);
ipcMain.handle('library:getDownloadPath', () => '');
ipcMain.handle('settings:get-close-to-tray', () => false);

app.whenReady().then(async () => {
  console.log('Testing Netflix & Idlix Redesign Features in Electron...');
  await mediaServer.start();

  const win = new BrowserWindow({
    show: false,
    width: 1366,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  console.log('✓ index.html loaded');

  // 1. Verify Switch to Film & Series Tab
  const navCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const tabIdlix = document.getElementById('tabIdlix');
      tabIdlix.click();
      await new Promise(r => setTimeout(r, 600));

      const idlixSection = document.getElementById('idlixSection');
      const pillAll = document.getElementById('pillIdlixAll');
      const pillMovies = document.getElementById('pillIdlixMovies');
      const pillSeries = document.getElementById('pillIdlixSeries');

      return {
        tabActive: tabIdlix.classList.contains('active'),
        sectionVisible: !idlixSection.classList.contains('hidden'),
        hasPillAll: !!pillAll && pillAll.classList.contains('active'),
        hasPillMovies: !!pillMovies,
        hasPillSeries: !!pillSeries
      };
    })()
  `);

  console.log('✓ Step 1 - Film & Series Navigation & Sub-pills:', navCheck);
  if (!navCheck.tabActive || !navCheck.sectionVisible || !navCheck.hasPillAll) {
    throw new Error('Step 1 Failed: Tab navigation or pillAll check failed');
  }

  // 2. Verify Rotating Hero Billboard Carousel (items, dots, prev/next)
  const carouselCheck = await win.webContents.executeJavaScript(`
    (async () => {
      // wait for billboard to populate
      for (let i = 0; i < 25; i++) {
        const dots = document.querySelectorAll('#idlixBillboardDots .billboard-dot');
        const titleEl = document.getElementById('idlixBillboardTitle');
        if (dots.length >= 3 && titleEl && titleEl.textContent && titleEl.textContent !== 'Judul Film') {
          break;
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const mgr = window.idlixManager;
      const initialIdx = mgr.billboardIndex;
      const initialTitle = document.getElementById('idlixBillboardTitle').textContent;
      const dots = document.querySelectorAll('#idlixBillboardDots .billboard-dot');

      // Test Next arrow
      const btnNext = document.getElementById('btnIdlixBillboardNext');
      btnNext.click();
      await new Promise(r => setTimeout(r, 200));
      const nextIdx = mgr.billboardIndex;
      const nextTitle = document.getElementById('idlixBillboardTitle').textContent;

      // Test Prev arrow
      const btnPrev = document.getElementById('btnIdlixBillboardPrev');
      btnPrev.click();
      await new Promise(r => setTimeout(r, 200));
      const prevIdx = mgr.billboardIndex;

      // Test Dot click
      if (dots.length > 2) {
        dots[2].click();
        await new Promise(r => setTimeout(r, 200));
      }
      const dotIdx = mgr.billboardIndex;

      return {
        hasItems: mgr.billboardItems.length >= 3,
        dotsCount: dots.length,
        initialIdx,
        nextIdx,
        prevIdx,
        dotIdx,
        titleChanged: initialTitle !== nextTitle
      };
    })()
  `);

  console.log('✓ Step 2 - Rotating Hero Carousel Controls:', carouselCheck);
  if (!carouselCheck.hasItems || carouselCheck.dotsCount < 3 || carouselCheck.dotIdx !== 2) {
    throw new Error('Step 2 Failed: Billboard carousel controls check failed');
  }

  // 3. Verify Multi-Row Horizontal Sliders
  const multiRowCheck = await win.webContents.executeJavaScript(`
    (async () => {
      // wait for multi-rows to render
      for (let i = 0; i < 25; i++) {
        const rows = document.querySelectorAll('.netflix-row-section');
        const tracks = document.querySelectorAll('.netflix-slider-track');
        if (rows.length >= 3 && tracks.length >= 3) {
          break;
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const rows = document.querySelectorAll('.netflix-row-section');
      const tracks = document.querySelectorAll('.netflix-slider-track');
      const arrows = document.querySelectorAll('.netflix-slider-arrow');

      const headings = Array.from(document.querySelectorAll('.netflix-row-heading')).map(h => h.textContent.trim());

      return {
        rowsCount: rows.length,
        tracksCount: tracks.length,
        arrowsCount: arrows.length,
        headings
      };
    })()
  `);

  console.log('✓ Step 3 - Multi-Row Horizontal Sliders:', multiRowCheck);
  if (multiRowCheck.rowsCount < 3 || multiRowCheck.tracksCount < 3) {
    throw new Error('Step 3 Failed: Multi-row horizontal sliders check failed');
  }

  // 4. Verify Netflix Expanding Pop-Out Card structure and actions
  const popoutCardCheck = await win.webContents.executeJavaScript(`
    (() => {
      const cards = document.querySelectorAll('.netflix-popout-card');
      if (cards.length === 0) return { hasCards: false };

      const firstCard = cards[0];
      const popoutPanel = firstCard.querySelector('.netflix-card-popout-panel');
      const btnPlay = firstCard.querySelector('.btn-popout-play');
      const btnBookmark = firstCard.querySelector('.btn-popout-bookmark');
      const btnInfo = firstCard.querySelector('.btn-popout-info');
      const popoutTitle = firstCard.querySelector('.popout-title');
      const matchBadge = firstCard.querySelector('.popout-match');

      // Test Bookmark toggle
      const wasBookmarked = btnBookmark.classList.contains('bookmarked');
      btnBookmark.click();
      const isNowBookmarked = btnBookmark.classList.contains('bookmarked');
      btnBookmark.click(); // revert
      const revertedBookmark = btnBookmark.classList.contains('bookmarked');

      return {
        hasCards: true,
        cardsCount: cards.length,
        hasPopoutPanel: !!popoutPanel,
        hasPlayBtn: !!btnPlay,
        hasBookmarkBtn: !!btnBookmark,
        hasInfoBtn: !!btnInfo,
        hasTitle: !!popoutTitle && !!popoutTitle.textContent,
        hasMatchBadge: !!matchBadge && matchBadge.textContent.includes('%'),
        bookmarkToggled: wasBookmarked !== isNowBookmarked && revertedBookmark === wasBookmarked
      };
    })()
  `);

  console.log('✓ Step 4 - Netflix Expanding Pop-Out Card:', popoutCardCheck);
  if (!popoutCardCheck.hasCards || !popoutCardCheck.hasPopoutPanel || !popoutCardCheck.bookmarkToggled) {
    throw new Error('Step 4 Failed: Pop-out card structure or bookmark toggle failed');
  }

  // 5. Verify Full-Page Immersive Detail View
  const detailCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const firstCard = document.querySelector('.netflix-popout-card');
      firstCard.click();

      const detailContainer = document.getElementById('idlixDetailContainer');
      const billboardEl = document.getElementById('idlixBillboard');
      const dynamicContainer = document.getElementById('idlixDynamicContainer');

      // Wait up to 3s for detail view to load
      for (let i = 0; i < 20; i++) {
        const title = detailContainer.querySelector('.detail-title');
        const backBtn = document.getElementById('btnBackToCatalog');
        if (title && backBtn) break;
        await new Promise(r => setTimeout(r, 150));
      }

      const backBtn = document.getElementById('btnBackToCatalog');
      const breadcrumbs = detailContainer.querySelector('.idlix-breadcrumbs');
      const heroHeader = detailContainer.querySelector('.detail-backdrop-header');
      const synopsis = detailContainer.querySelector('.detail-synopsis');
      const playBtn = document.getElementById('btnDetailPlayMovie') || document.getElementById('btnDetailScrollEpisodes');

      const isDetailVisible = !detailContainer.classList.contains('hidden');
      const isBillboardHidden = billboardEl.classList.contains('hidden');
      const isDynamicHidden = dynamicContainer.classList.contains('hidden');

      // Test Back button to return to catalog
      backBtn.click();
      await new Promise(r => setTimeout(r, 300));

      const isDetailClosed = detailContainer.classList.contains('hidden');
      const isDynamicRestored = !dynamicContainer.classList.contains('hidden');

      return {
        isDetailVisible,
        isBillboardHidden,
        isDynamicHidden,
        hasBackBtn: !!backBtn,
        hasBreadcrumbs: !!breadcrumbs,
        hasHeroHeader: !!heroHeader,
        hasSynopsis: !!synopsis && synopsis.textContent.length > 5,
        hasPlayBtn: !!playBtn,
        isDetailClosed,
        isDynamicRestored
      };
    })()
  `);

  console.log('✓ Step 5 - Full-Page Immersive Detail View & Back Navigation:', detailCheck);
  if (!detailCheck.isDetailVisible || !detailCheck.hasBackBtn || !detailCheck.isDetailClosed || !detailCheck.isDynamicRestored) {
    throw new Error('Step 5 Failed: Full-Page detail view or return navigation failed');
  }

  console.log('\n=============================================================');
  console.log('🎉 ALL NETFLIX & IDLIX REDESIGN VERIFICATION TESTS PASSED! 🎉');
  console.log('=============================================================');
  app.quit();
});

