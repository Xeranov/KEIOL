const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaServer = require('../main/mediaServer');
const idlixService = require('../main/idlixService');
const libraryService = require('../main/libraryService');

// Setup mock / temporary history storage
const tempHistoryPath = path.join(__dirname, 'temp_history_test.json');
fs.writeFileSync(tempHistoryPath, JSON.stringify({
  folders: [],
  seriesList: {},
  episodes: {},
  onlineHistory: {
    'solo-leveling': {
      animeSlug: 'solo-leveling',
      animeTitle: 'Solo Leveling',
      lastEpisodeUrl: 'https://otakudesu.cloud/episode/solo-leveling-episode-12-sub-indo/',
      lastEpisodeTitle: 'Episode 12',
      currentTime: 1200,
      duration: 1420,
      lastWatched: Date.now() - 5000,
      poster: 'https://otakudesu.cloud/wp-content/uploads/solo-leveling.jpg',
      source: 'anime'
    },
    'frieren': {
      animeSlug: 'frieren',
      animeTitle: 'Sousou no Frieren',
      lastEpisodeUrl: 'https://otakudesu.cloud/episode/frieren-episode-28-sub-indo/',
      lastEpisodeTitle: 'Episode 28',
      currentTime: 600,
      duration: 1440,
      lastWatched: Date.now() - 10000,
      poster: 'https://otakudesu.cloud/wp-content/uploads/frieren.jpg',
      source: 'anime'
    },
    'avatar-the-way-of-water': {
      animeSlug: 'avatar-the-way-of-water',
      animeTitle: 'Avatar: The Way of Water',
      lastEpisodeUrl: 'idlix://avatar-the-way-of-water',
      lastEpisodeTitle: 'Film',
      currentTime: 3600,
      duration: 11520,
      lastWatched: Date.now() - 2000,
      poster: 'https://image.tmdb.org/t/p/w500/avatar.jpg',
      source: 'idlix',
      mediaObj: {
        id: 76600,
        title: 'Avatar: The Way of Water',
        slug: 'avatar-the-way-of-water',
        runtime: 192
      }
    },
    'wednesday-s1e1': {
      animeSlug: 'wednesday-s1e1',
      animeTitle: 'Wednesday',
      lastEpisodeUrl: 'idlix://wednesday-s1e1',
      lastEpisodeTitle: 'S1 Ep 1: Wednesday\'s Child Is Full of Woe',
      currentTime: 950,
      duration: 2800,
      lastWatched: Date.now() - 1000,
      poster: 'https://image.tmdb.org/t/p/w500/wednesday.jpg',
      source: 'idlix',
      mediaObj: {
        id: 119051,
        title: 'Wednesday',
        slug: 'wednesday'
      },
      episodeObj: {
        id: 3959952,
        episodeNumber: 1,
        seasonNumber: 1,
        name: 'Wednesday\'s Child Is Full of Woe'
      },
      seasonNumber: 1
    }
  }
}, null, 2));

// Point libraryService to use tempHistoryPath
libraryService.historyFile = tempHistoryPath;
libraryService.history = JSON.parse(fs.readFileSync(tempHistoryPath, 'utf8'));

// Register IPC handlers
ipcMain.handle('idlix:getMovies', async (_event, options) => idlixService.getMovies(options));
ipcMain.handle('idlix:getSeries', async (_event, options) => idlixService.getSeries(options));
ipcMain.handle('idlix:getMovieDetail', async (_event, slug) => idlixService.getMovieDetail(slug));
ipcMain.handle('idlix:getSeriesDetail', async (_event, slug) => idlixService.getSeriesDetail(slug));
ipcMain.handle('idlix:getSeasonEpisodes', async (_event, slug, seasonNumber) => idlixService.getSeasonEpisodes(slug, seasonNumber));
ipcMain.handle('idlix:search', async (_event, query, type) => idlixService.search(query, type));
ipcMain.handle('idlix:getFilterOptions', async (_event, type) => idlixService.getFilterOptions(type));
ipcMain.handle('idlix:getTrending', async () => idlixService.getTrending());
ipcMain.handle('server:getPort', () => mediaServer.port);
ipcMain.handle('library:scan', () => ({ items: [], libraryPath: '' }));
ipcMain.handle('library:getPath', () => '');
ipcMain.handle('library:getContinueWatching', () => []);
ipcMain.handle('library:getOnlineHistory', () => libraryService.getOnlineHistory());
ipcMain.handle('library:saveOnlineProgress', (_event, animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster, extra) => {
  libraryService.saveOnlineProgress(animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster, extra);
  return true;
});
ipcMain.handle('library:deleteOnlineProgress', (_event, slug) => {
  libraryService.deleteOnlineProgress(slug);
  return true;
});
ipcMain.handle('app:getVersion', () => '2.0.0');
ipcMain.handle('otakudesu:getSchedule', () => ({}));
ipcMain.handle('anichin:getSchedule', () => ({}));
ipcMain.handle('otakudesu:getGenres', () => []);
ipcMain.handle('otakudesu:getAnimeList', () => []);
ipcMain.handle('kusonime:getAnimeList', () => []);
ipcMain.handle('anichin:getAnimeList', () => []);
ipcMain.handle('otakudesu:getOngoing', () => ({
  animeList: [
    { title: 'One Piece', url: 'https://otakudesu.cloud/anime/op/', currentEpisode: '1120' }
  ]
}));
ipcMain.handle('anichin:getOngoing', () => ({ animeList: [] }));
ipcMain.handle('library:getDownloadPath', () => '');
ipcMain.handle('settings:get-close-to-tray', () => false);

app.whenReady().then(async () => {
  console.log('Testing Continue Watching Separation & History Management...');
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

  // Test 1: Verify Web Tab Continue Watching only contains Anime items
  const webContinueCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const tabWeb = document.getElementById('tabWeb');
      tabWeb.click();
      await new Promise(r => setTimeout(r, 600));

      const otakudesuMgr = window.otakudesuManager;
      await otakudesuMgr.refreshOnlineHistory();
      await otakudesuMgr.loadOngoing(true);

      const section = document.getElementById('webContinueWatchingSection');
      const cards = section ? Array.from(section.querySelectorAll('.continue-watching-card')) : [];
      const cardTitles = cards.map(c => c.getAttribute('aria-label') || c.querySelector('.netflix-card-title')?.textContent);
      const cardUrls = cards.map(c => c.getAttribute('data-url'));

      return {
        sectionExists: !!section,
        count: cards.length,
        cardTitles,
        cardUrls
      };
    })()
  `);

  console.log('✓ Test 1 - Web Tab Continue Watching (Anime Only):', webContinueCheck);
  if (!webContinueCheck.sectionExists) {
    throw new Error('Test 1 Failed: webContinueWatchingSection not found');
  }
  if (webContinueCheck.count !== 2) {
    throw new Error(`Test 1 Failed: expected 2 anime items, got ${webContinueCheck.count}`);
  }
  const hasIdlixInWeb = webContinueCheck.cardUrls.some(u => u && u.includes('idlix://')) ||
                        webContinueCheck.cardTitles.some(t => t && (t.includes('Avatar') || t.includes('Wednesday')));
  if (hasIdlixInWeb) {
    throw new Error('Test 1 Failed: Idlix item was found in Web Tab Continue Watching!');
  }

  // Test 2: Verify Film & Series Tab has Continue Watching with ONLY Idlix items
  const idlixContinueCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const tabIdlix = document.getElementById('tabIdlix');
      tabIdlix.click();
      await new Promise(r => setTimeout(r, 700));

      const sections = Array.from(document.querySelectorAll('#idlixDynamicContainer .netflix-row-section'));
      const continueSec = sections.find(s => s.querySelector('.netflix-row-heading')?.textContent?.includes('Lanjutkan Menonton'));

      let cardTitles = [];
      let removeBtns = 0;
      if (continueSec) {
        const cards = Array.from(continueSec.querySelectorAll('.continue-watching-card'));
        cardTitles = cards.map(c => c.querySelector('.idlix-card-title')?.textContent);
        removeBtns = continueSec.querySelectorAll('.btn-remove-continue').length;
      }

      return {
        hasContinueSec: !!continueSec,
        cardTitles,
        removeBtns
      };
    })()
  `);

  console.log('✓ Test 2 - Film & Series Continue Watching (Idlix Only):', idlixContinueCheck);
  if (!idlixContinueCheck.hasContinueSec) {
    throw new Error('Test 2 Failed: Idlix Continue Watching row not found');
  }
  if (idlixContinueCheck.cardTitles.length !== 2) {
    throw new Error(`Test 2 Failed: expected 2 Idlix items, got ${idlixContinueCheck.cardTitles.length}`);
  }
  const hasAnimeInIdlix = idlixContinueCheck.cardTitles.some(t => t && (t.includes('Solo Leveling') || t.includes('Sousou no Frieren')));
  if (hasAnimeInIdlix) {
    throw new Error('Test 2 Failed: Anime item was found in Idlix Continue Watching!');
  }

  // Test 3: Delete an Idlix item using the remove button and verify removal
  const deleteCheck = await win.webContents.executeJavaScript(`
    (async () => {
      const sections = Array.from(document.querySelectorAll('#idlixDynamicContainer .netflix-row-section'));
      const continueSec = sections.find(s => s.querySelector('.netflix-row-heading')?.textContent?.includes('Lanjutkan Menonton'));
      const avatarCard = Array.from(continueSec.querySelectorAll('.continue-watching-card'))
        .find(c => c.querySelector('.idlix-card-title')?.textContent?.includes('Avatar'));

      const removeBtn = avatarCard?.querySelector('.btn-remove-continue');
      if (!removeBtn) return { success: false, reason: 'Remove button not found' };

      // Click remove button
      removeBtn.click();
      await new Promise(r => setTimeout(r, 500));

      const updatedSections = Array.from(document.querySelectorAll('#idlixDynamicContainer .netflix-row-section'));
      const updatedContinueSec = updatedSections.find(s => s.querySelector('.netflix-row-heading')?.textContent?.includes('Lanjutkan Menonton'));
      const remainingCards = updatedContinueSec ? Array.from(updatedContinueSec.querySelectorAll('.continue-watching-card')) : [];
      const remainingTitles = remainingCards.map(c => c.querySelector('.idlix-card-title')?.textContent);

      return {
        success: true,
        remainingCount: remainingCards.length,
        remainingTitles
      };
    })()
  `);

  console.log('✓ Test 3 - Idlix Remove Item From Continue Watching:', deleteCheck);
  if (!deleteCheck.success || deleteCheck.remainingCount !== 1) {
    throw new Error(`Test 3 Failed: expected 1 remaining card, got ${deleteCheck.remainingCount}`);
  }
  if (deleteCheck.remainingTitles.includes('Avatar: The Way of Water')) {
    throw new Error('Test 3 Failed: Avatar was not deleted!');
  }

  // Clean up temp file
  try { fs.unlinkSync(tempHistoryPath); } catch (e) {}

  console.log('\n=============================================================');
  console.log('🎉 ALL CONTINUE WATCHING SEPARATION & DELETION TESTS PASSED! 🎉');
  console.log('=============================================================\n');

  win.destroy();
  app.quit();
}).catch(err => {
  console.error('Test Failed:', err);
  try { fs.unlinkSync(tempHistoryPath); } catch (e) {}
  app.exit(1);
});

