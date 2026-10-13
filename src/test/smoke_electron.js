const { app, BrowserWindow } = require('electron');
const path = require('path');
const mediaServer = require('../main/mediaServer');

async function runSmoke() {
  console.log('Starting Electron smoke test...');
  const port = await mediaServer.start();
  console.log('MediaServer port:', port);

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console - Level ${level}] ${message} (${path.basename(sourceId)}:${line})`);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    process.exit(1);
  });

  await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  console.log('✓ index.html loaded successfully in Electron BrowserWindow');

  // Verify elements exist in DOM
  const elementsCheck = await win.webContents.executeJavaScript(`
    ({
      hasVideo: !!document.getElementById('mainVideo'),
      hasControlsBar: !!document.getElementById('controlsBar'),
      hasSpeedBoostPill: !!document.getElementById('speedBoostPill'),
      hasScrubber: !!document.getElementById('progressBarContainer'),
      hasSettingsMenu: !!document.getElementById('settingsMenu'),
      hasShortcutsModal: !!document.getElementById('shortcutsModal'),
      playerCoreReady: !!window.playerCore,
      gesturesReady: !!window.gesturesEngine,
      controlsReady: !!window.controlsManager,
      shortcutsReady: !!window.shortcutsEngine
    })
  `);

  console.log('✓ DOM & Engine Components Check:', elementsCheck);

  const allPassed = Object.values(elementsCheck).every(val => val === true);
  if (!allPassed) {
    throw new Error('Some components failed to initialize in DOM!');
  }

  console.log('✓ All components initialized cleanly with zero errors');

  mediaServer.stop();
  app.quit();
}

app.whenReady().then(runSmoke).catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});

