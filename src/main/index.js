const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const mediaServer = require('./mediaServer');
const { probeMedia } = require('./probeService');

let mainWindow = null;

async function createWindow() {
  // Start local streaming server
  const serverPort = await mediaServer.start();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#0f0f0f',
    frame: false, // Custom borderless window with YouTube-styled controls
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Maximize / Unmaximize events
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:state-changed', { isMaximized: false });
  });

  // Handle file passed via CLI arguments (e.g. electron . "sample.mkv")
  const initialFile = process.argv.slice(1).find(arg => {
    const ext = path.extname(arg).toLowerCase();
    return ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.ts'].includes(ext);
  });

  if (initialFile) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('app:open-file', path.resolve(initialFile));
    });
  }
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File Video',
    properties: ['openFile'],
    filters: [
      {
        name: 'Video Files',
        extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'ts', 'm4v', 'vob', '3gp', 'mpg', 'mpeg', 'ogv']
      },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:openSubtitle', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File Subtitle',
    properties: ['openFile'],
    filters: [
      { name: 'Subtitles', extensions: ['srt', 'vtt', 'ass', 'ssa'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('media:probe', async (_event, filePath) => {
  return await probeMedia(filePath);
});

ipcMain.handle('server:getPort', () => {
  return mediaServer.port;
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window:setFullScreen', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setFullScreen(flag);
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('window:isFullScreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  mediaServer.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
