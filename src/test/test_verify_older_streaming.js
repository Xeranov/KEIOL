const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const otakudesuService = require('../main/otakudesuService');
const aniSkipService = require('../main/aniSkipService');
const mediaServer = require('../main/mediaServer');

async function runVerification() {
  console.log('=== Starting Comprehensive Verification for Older Anime & Skip Intro ===');
  await mediaServer.start();

  // Set up request headers as in src/main/index.js
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const url = details.url.toLowerCase();
    const requestHeaders = { ...details.requestHeaders };
    if (url.includes('vidcache.net') || url.includes('yourupload.com')) {
      requestHeaders['Referer'] = 'https://www.yourupload.com/';
      requestHeaders['Origin'] = 'https://www.yourupload.com';
    } else if (url.includes('dramiyos-cdn') || url.includes('acek-cdn') || url.includes('vidhide') || url.includes('morencius.com')) {
      requestHeaders['Referer'] = 'https://odvidhide.com/';
    } else if (url.includes('desustream') || url.includes('desudrive') || url.includes('playdesu') || url.includes('desuwatch') || url.includes('odesu') || url.includes('moeplay') || url.includes('desudesu')) {
      requestHeaders['Referer'] = 'https://otakudesu.blog/';
    } else if (url.includes('googlevideo.com') || url.includes('videoplayback')) {
      delete requestHeaders['Referer'];
      delete requestHeaders['Origin'];
      requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    } else if (url.includes('blogger.com') || url.includes('googleusercontent.com') || url.includes('blogspot.com')) {
      requestHeaders['Referer'] = 'https://odgoingthree.blogspot.com/';
    }
    callback({ cancel: false, requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      if (/^(x-frame-options|content-security-policy|content-security-policy-report-only)$/i.test(key)) {
        delete responseHeaders[key];
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    callback({ cancel: false, responseHeaders });
  });

  // Register necessary mock IPC handlers
  ipcMain.handle('server:getPort', () => mediaServer.port);
  ipcMain.handle('aniskip:getSkipTimes', async (_e, title, ep) => aniSkipService.getSkipTimes(title, ep));
  ipcMain.handle('aniskip:validateSkipIntervals', (_e, intervals, dur) => aniSkipService.validateSkipIntervals(intervals, dur));
  ipcMain.handle('aniskip:extractEpisodeNumber', (_e, raw, title) => aniSkipService.extractEpisodeNumber(raw, title));
  ipcMain.handle('library:scan', () => ({ libraryPath: '', seriesList: [], movies: [], continueWatching: null }));
  ipcMain.handle('library:getOnlineHistory', () => []);
  ipcMain.handle('library:getDownloadPath', () => 'C:\\Downloads');
  ipcMain.handle('app:getVersion', () => '1.0.0');
  ipcMain.handle('settings:get-close-to-tray', () => false);

  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false
    }
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 1. Test Death Note Ep 1 Streaming & Controls
  console.log('\n--- 1. Testing Death Note Episode 1 ---');
  const dnStream = await otakudesuService.getEpisodeStream('https://otakudesu.blog/episode/dhtnt-episode-1-sub-indo/');
  console.log('Death Note Stream URL type:', dnStream.streamType, 'Has URL:', !!dnStream.streamUrl);

  const dnPlayResult = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const streamData = ${JSON.stringify(dnStream)};
      const finalStreamUrl = streamData.streamUrl || streamData.embedUrl;
      const streamType = streamData.streamType || 'direct';

      await window.playerCore.loadRemoteStream(finalStreamUrl, {
        title: "Death Note - Episode 1",
        animeTitle: "Death Note",
        episodeTitle: "Episode 1",
        streamType: streamType,
        embedUrl: streamData.embedUrl,
        availableQualities: streamData.availableQualities
      });

      const video = document.getElementById('mainVideo');
      const iframe = document.getElementById('iframePlayer');

      const checkReady = () => {
        if (video.readyState >= 1 && video.duration > 0) {
          resolve({
            success: true,
            duration: video.duration,
            readyState: video.readyState,
            videoHidden: video.classList.contains('hidden'),
            iframeHidden: iframe.classList.contains('hidden'),
            skipIntervals: window.playerCore.getSkipIntervals(),
            playbackMode: window.playerCore.playbackMode
          });
          return true;
        }
        return false;
      };

      if (!checkReady()) {
        video.addEventListener('loadedmetadata', () => checkReady(), { once: true });
        video.addEventListener('canplay', () => checkReady(), { once: true });
        setTimeout(() => {
          resolve({
            success: checkReady(),
            duration: video.duration,
            readyState: video.readyState,
            videoHidden: video.classList.contains('hidden'),
            iframeHidden: iframe.classList.contains('hidden'),
            skipIntervals: window.playerCore.getSkipIntervals(),
            playbackMode: window.playerCore.playbackMode,
            error: video.error ? { code: video.error.code, message: video.error.message } : null
          });
        }, 7000);
      }
    })
  `);
  console.log('Death Note Playback Result:', dnPlayResult);

  if (!dnPlayResult.success || dnPlayResult.videoHidden || !dnPlayResult.iframeHidden) {
    throw new Error('Death Note failed to play directly in #mainVideo!');
  }

  // 2. Test Skip Intro on Death Note (Manual and Auto-Skip)
  console.log('\n--- 2. Testing Skip Intro Functionality ---');
  const skipTestResult = await win.webContents.executeJavaScript(`
    (() => {
      const video = document.getElementById('mainVideo');
      const btnOverlay = document.getElementById('btnSkipIntroOverlay');
      const txtLabel = document.getElementById('txtSkipIntroLabel');

      // Set mock validated intervals for testing OP and ED skip triggers
      window.playerCore.setSkipIntervals({
        op: { startTime: 10, endTime: 95 },
        ed: { startTime: 1250, endTime: 1340 }
      });

      // Part A: Test Manual Skip (disable auto-skip)
      window.controlsManager.isAutoSkipIntro = false;
      window.controlsManager.hasAutoSkippedOP = false;
      window.controlsManager.hasAutoSkippedED = false;

      // 1. Inside OP
      video.currentTime = 25;
      window.controlsManager.handleTimeUpdateForSkip(25);
      const manualOpBtnVisible = !btnOverlay.classList.contains('hidden');
      const manualOpLabel = txtLabel.textContent;
      window.controlsManager.triggerSkipIntro();
      const manualOpSeekPos = video.currentTime;

      // 2. Inside ED
      video.currentTime = 1260;
      window.controlsManager.handleTimeUpdateForSkip(1260);
      const manualEdBtnVisible = !btnOverlay.classList.contains('hidden');
      const manualEdLabel = txtLabel.textContent;
      window.controlsManager.triggerSkipIntro();
      const manualEdSeekPos = video.currentTime;

      // Part B: Test Auto-Skip
      window.controlsManager.isAutoSkipIntro = true;
      window.controlsManager.hasAutoSkippedOP = false;
      window.controlsManager.hasAutoSkippedED = false;

      video.currentTime = 15;
      window.controlsManager.handleTimeUpdateForSkip(15);
      const autoOpSeekPos = video.currentTime;
      const autoOpSkipped = window.controlsManager.hasAutoSkippedOP;

      video.currentTime = 1270;
      window.controlsManager.handleTimeUpdateForSkip(1270);
      const autoEdSeekPos = video.currentTime;
      const autoEdSkipped = window.controlsManager.hasAutoSkippedED;

      // Part C: Test Backward Seek Prevention & Rewind Reset
      // C1: Middle of episode (500s) -> triggerSkipIntro must NOT jump back to 95s
      video.currentTime = 500;
      window.controlsManager.triggerSkipIntro();
      const midEpisodeSeekPos = video.currentTime;

      // C2: Rewinding before OP (< 8s) -> resets hasAutoSkippedOP
      video.currentTime = 5;
      window.controlsManager.handleTimeUpdateForSkip(5);
      const rewindOpReset = !window.controlsManager.hasAutoSkippedOP;

      return {
        manualOpBtnVisible,
        manualOpLabel,
        manualOpSeekPos,
        manualEdBtnVisible,
        manualEdLabel,
        manualEdSeekPos,
        autoOpSeekPos,
        autoOpSkipped,
        autoEdSeekPos,
        autoEdSkipped,
        midEpisodeSeekPos,
        rewindOpReset
      };
    })()
  `);
  console.log('Skip Intro Test Result:', skipTestResult);

  if (!skipTestResult.manualOpBtnVisible || skipTestResult.manualOpLabel !== 'Lewati Intro' || skipTestResult.manualOpSeekPos !== 95) {
    throw new Error('Manual OP skip failed!');
  }
  if (!skipTestResult.manualEdBtnVisible || skipTestResult.manualEdLabel !== 'Lewati Ending' || skipTestResult.manualEdSeekPos !== 1340) {
    throw new Error('Manual ED skip failed!');
  }
  if (!skipTestResult.autoOpSkipped || skipTestResult.autoOpSeekPos !== 95) {
    throw new Error('Auto OP skip failed!');
  }
  if (!skipTestResult.autoEdSkipped || skipTestResult.autoEdSeekPos !== 1340) {
    throw new Error('Auto ED skip failed!');
  }
  if (skipTestResult.midEpisodeSeekPos !== 500) {
    throw new Error(`Backward seek bug detected! Position changed from 500 to ${skipTestResult.midEpisodeSeekPos}`);
  }
  if (!skipTestResult.rewindOpReset) {
    throw new Error('Rewind auto-skip reset failed!');
  }
  console.log('✓ Skip Intro (Manual, Auto-Skip, Rewind Reset & Backward Seek Protection) passed!');

  // 3. Test Toradora Ep 1 Streaming
  console.log('\n--- 3. Testing Toradora Episode 1 ---');
  const tdStream = await otakudesuService.getEpisodeStream('https://otakudesu.blog/episode/trdr-episode-1-sub-indo/');
  console.log('Toradora Stream URL type:', tdStream.streamType, 'Has URL:', !!tdStream.streamUrl);

  const tdPlayResult = await win.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const streamData = ${JSON.stringify(tdStream)};
      const finalStreamUrl = streamData.streamUrl || streamData.embedUrl;
      const streamType = streamData.streamType || 'direct';

      await window.playerCore.loadRemoteStream(finalStreamUrl, {
        title: "Toradora! - Episode 1",
        animeTitle: "Toradora!",
        episodeTitle: "Episode 1",
        streamType: streamType,
        embedUrl: streamData.embedUrl,
        availableQualities: streamData.availableQualities
      });

      const video = document.getElementById('mainVideo');
      const iframe = document.getElementById('iframePlayer');

      const checkReady = () => {
        if (video.readyState >= 1 && video.duration > 0) {
          resolve({
            success: true,
            duration: video.duration,
            readyState: video.readyState,
            videoHidden: video.classList.contains('hidden'),
            iframeHidden: iframe.classList.contains('hidden'),
            playbackMode: window.playerCore.playbackMode
          });
          return true;
        }
        return false;
      };

      if (!checkReady()) {
        video.addEventListener('loadedmetadata', () => checkReady(), { once: true });
        video.addEventListener('canplay', () => checkReady(), { once: true });
        setTimeout(() => {
          resolve({
            success: checkReady(),
            duration: video.duration,
            readyState: video.readyState,
            videoHidden: video.classList.contains('hidden'),
            iframeHidden: iframe.classList.contains('hidden'),
            playbackMode: window.playerCore.playbackMode,
            error: video.error ? { code: video.error.code, message: video.error.message } : null
          });
        }, 7000);
      }
    })
  `);
  console.log('Toradora Playback Result:', tdPlayResult);

  if (!tdPlayResult.success || tdPlayResult.videoHidden || !tdPlayResult.iframeHidden) {
    throw new Error('Toradora failed to play directly in #mainVideo!');
  }

  // 4. Test Clannad Episode 1 & OVA Sorting
  console.log('\n--- 4. Testing Clannad Episode 1 & OVA Sorting ---');
  const clannadDetail = await otakudesuService.getAnimeDetail('https://otakudesu.blog/anime/clanad-subtitle-indonesia/');
  console.log('Clannad First Episode Title:', clannadDetail.episodes[0]?.title);
  if (!clannadDetail.episodes[0]?.title.includes('Episode 1')) {
    throw new Error(`Clannad Episode 1 should be first, but got: ${clannadDetail.episodes[0]?.title}`);
  }
  const lastEp = clannadDetail.episodes[clannadDetail.episodes.length - 1];
  console.log('Clannad Last Episode Title (OVA sorted to end):', lastEp?.title);
  if (!/ova|special|sp/i.test(lastEp?.title)) {
    throw new Error(`Clannad OVA should be sorted to the end, but got: ${lastEp?.title}`);
  }
  console.log('✓ Clannad Episode 1 & OVA Sorting passed!');

  console.log('\n========================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');

  mediaServer.stop();
  app.quit();
}

app.whenReady().then(runVerification).catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
