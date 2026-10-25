const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mediaServer = require('../main/mediaServer');
const idlixService = require('../main/idlixService');

// Register Idlix IPC handlers for test
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
ipcMain.handle('idlix:login', async (_event, identifier, password) => idlixService.login(identifier, password));
ipcMain.handle('idlix:logout', async () => idlixService.logout());
ipcMain.handle('idlix:getCurrentUser', async () => idlixService.getCurrentUser());
ipcMain.handle('otakudesu:getSchedule', () => ({}));
ipcMain.handle('anichin:getSchedule', () => ({}));
ipcMain.handle('otakudesu:getGenres', () => []);
ipcMain.handle('server:getPort', () => mediaServer.port);
ipcMain.handle('library:scan', () => ({ items: [], libraryPath: '' }));
ipcMain.handle('library:getPath', () => '');
ipcMain.handle('library:getContinueWatching', () => []);
ipcMain.handle('library:getOnlineHistory', () => []);
ipcMain.handle('app:getVersion', () => '1.2.0');

app.whenReady().then(async () => {
  console.log('Testing Idlix UI in Electron...');
  await mediaServer.start();

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.log(`[Renderer Console] ${message}`);
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  console.log('✓ index.html loaded');

  // Verify DOM elements
  const check = await win.webContents.executeJavaScript(`
    (async () => {
      for (let i = 0; i < 30; i++) {
        if (window.idlixManager) break;
        await new Promise(r => setTimeout(r, 100));
      }

      const tabIdlix = document.getElementById('tabIdlix');
      const idlixSection = document.getElementById('idlixSection');
      const idlixBillboard = document.getElementById('idlixBillboard');
      const idlixDynamicContainer = document.getElementById('idlixDynamicContainer');
      const idlixDetailContainer = document.getElementById('idlixDetailContainer');
      const idlixUnlockOverlay = document.getElementById('idlixUnlockOverlay');
      const selectGenre = document.getElementById('selectIdlixGenre');
      const quickSpinner = document.getElementById('idlixQuickSpinner');
      const accountModal = document.getElementById('idlixAccountModal');
      const btnAccount = document.getElementById('btnIdlixAccount');
      const btnQualityDirect = document.getElementById('btnQualityDirect');
      const subDisplay = document.getElementById('subtitleDisplay');

      return {
        hasTab: !!tabIdlix,
        hasSection: !!idlixSection,
        hasBillboard: !!idlixBillboard,
        hasContainer: !!idlixDynamicContainer,
        hasDetail: !!idlixDetailContainer,
        hasUnlockOverlay: !!idlixUnlockOverlay,
        hasGenreSelect: !!selectGenre,
        hasQuickSpinner: !!quickSpinner,
        hasQualityDirect: !!btnQualityDirect,
        hasSubDisplay: !!subDisplay,
        noAccountModal: !accountModal,
        noAccountBtn: !btnAccount,
        hasIdlixManager: !!window.idlixManager
      };
    })()
  `);

  console.log('✓ Idlix DOM Check:', check);
  for (const [key, val] of Object.entries(check)) {
    if (!val) {
      console.error(`❌ Check failed for ${key}`);
      process.exit(1);
    }
  }

  // Test Tab Switching to Idlix
  const switchCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const tabIdlix = document.getElementById('tabIdlix');
      tabIdlix.click();
      await new Promise(r => setTimeout(r, 400));

      const idlixSection = document.getElementById('idlixSection');
      const searchInput = document.getElementById('inputSearchAnime');

      return {
        tabActive: tabIdlix.classList.contains('active'),
        sectionVisible: !idlixSection.classList.contains('hidden'),
        placeholderUpdated: searchInput.placeholder.includes('Film & Serial TV')
      };
    })()
  `);

  console.log('✓ Tab Switch to "Film & Series":', switchCheck);
  if (!switchCheck.tabActive || !switchCheck.sectionVisible || !switchCheck.placeholderUpdated) {
    console.error('❌ Tab switch check failed');
    process.exit(1);
  }

  // Wait for catalog to load in grid
  const catalogCheck = await win.webContents.executeJavaScript(`
    (async () => {
      // wait up to 4s for cards to render
      for (let i = 0; i < 20; i++) {
        const cards = document.querySelectorAll('#idlixDynamicContainer .netflix-card');
        if (cards.length > 0) {
          return { cardCount: cards.length, firstTitle: cards[0].querySelector('.card-title-text')?.textContent };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return { cardCount: 0 };
    })()
  `);

  console.log('✓ Idlix Catalog Cards Loaded:', catalogCheck);
  if (catalogCheck.cardCount === 0) {
    console.error('❌ No cards rendered in Idlix grid');
    process.exit(1);
  }

  // Test Scrollability and Subnav Alignment
  const styleCheck = await win.webContents.executeJavaScript(`
    (() => {
      const section = document.getElementById('idlixSection');
      const subnav = document.querySelector('.idlix-subnav-bar');
      const computedSec = window.getComputedStyle(section);
      const computedNav = window.getComputedStyle(subnav);

      return {
        overflowY: computedSec.overflowY,
        navPaddingLeft: computedNav.paddingLeft,
        navPaddingRight: computedNav.paddingRight
      };
    })()
  `);
  console.log('✓ Layout & Scroll Styling Check:', styleCheck);
  if (styleCheck.overflowY !== 'auto' && styleCheck.overflowY !== 'scroll') {
    console.error('❌ idlixSection is not scrollable (overflow-y must be auto)');
    process.exit(1);
  }
  if (parseInt(styleCheck.navPaddingLeft, 10) < 20) {
    console.error('❌ idlix-subnav-bar has insufficient padding-left, buttons will stick to edge');
    process.exit(1);
  }

  // Test Trending Tab click & catalog load
  const trendingCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const pillTrending = document.getElementById('pillIdlixTrending');
      pillTrending.click();
      for (let i = 0; i < 20; i++) {
        const cards = document.querySelectorAll('#idlixDynamicContainer .netflix-card');
        const titleEl = document.querySelector('#idlixDynamicContainer .netflix-row-title');
        if (cards.length > 0 && titleEl && titleEl.textContent.includes('Populer')) {
          return { success: true, count: cards.length, title: titleEl.textContent };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return { success: false };
    })()
  `);
  console.log('✓ Trending Sub-Tab Click & Load:', trendingCheck);
  if (!trendingCheck.success) {
    console.error('❌ Trending catalog failed to load');
    process.exit(1);
  }

  // Test Subtitle Rich Text (<i>, <b>) and Direct Quality Button
  const featureCheck = await win.webContents.executeJavaScript(`
    (() => {
      const player = window.playerCore;
      const subContainer = document.getElementById('subtitleDisplay');
      
      // Test rich text formatting
      const rawCueText = '<i>Jin adalah makhluk kuno</i>\\n<b>Roh jahat</b>';
      const formatted = player.formatSubtitleRichText(rawCueText);
      player.renderSubtitleCue(subContainer, { text: rawCueText });
      
      const italicEl = subContainer.querySelector('i');
      const boldEl = subContainer.querySelector('b');
      
      // Test quality direct button
      const btnQuality = document.getElementById('btnQualityDirect');
      const qualityText = document.getElementById('qualityDirectBadgeText');
      window.dispatchEvent(new CustomEvent('player:qualitiesupdated', {
        detail: {
          availableQualities: [
            { quality: '1080p', label: '1080p Full HD', levelIndex: 0 },
            { quality: '720p', label: '720p HD', levelIndex: 1 }
          ],
          currentQuality: '1080p'
        }
      }));

      return {
        formattedIncludesItalic: formatted.includes('<i>Jin adalah makhluk kuno</i>'),
        hasItalicNode: !!italicEl && italicEl.textContent === 'Jin adalah makhluk kuno',
        hasBoldNode: !!boldEl && boldEl.textContent === 'Roh jahat',
        qualityBtnVisible: !btnQuality.classList.contains('hidden'),
        qualityBadgeText: qualityText.textContent
      };
    })()
  `);
  console.log('✓ Subtitle Rich Text & Quality Direct Button Check:', featureCheck);
  if (!featureCheck.hasItalicNode || !featureCheck.hasBoldNode || !featureCheck.qualityBtnVisible) {
    console.error('❌ Subtitle rich text or quality button check failed:', featureCheck);
    process.exit(1);
  }

  await mediaServer.stop();
  console.log('=== ALL IDLIX ELECTRON UI TESTS PASSED! ===');
  app.quit();
});

