const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

class TrayManager {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
    this.userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../');
    this.configFile = path.join(this.userDataPath, 'library_config.json');
    this.closeToTray = this.loadCloseToTray();
  }

  loadCloseToTray() {
    try {
      if (fs.existsSync(this.configFile)) {
        const text = fs.readFileSync(this.configFile, 'utf-8').trim();
        if (text) {
          const data = JSON.parse(text);
          if (typeof data.closeToTray === 'boolean') {
            return data.closeToTray;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load closeToTray setting:', e.message);
    }
    return true; // Default enabled
  }

  setCloseToTray(enabled) {
    this.closeToTray = Boolean(enabled);
    try {
      let config = {};
      if (fs.existsSync(this.configFile)) {
        try { config = JSON.parse(fs.readFileSync(this.configFile, 'utf-8')); } catch (e) {}
      }
      config.closeToTray = this.closeToTray;
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    } catch (e) {
      console.warn('Failed to save closeToTray setting:', e.message);
    }
    return this.closeToTray;
  }

  isCloseToTrayEnabled() {
    return this.closeToTray;
  }

  init(mainWindow) {
    if (this.tray) return;
    this.mainWindow = mainWindow;

    // Load tray icon
    let iconPath = path.join(__dirname, '../../build/tray-icon.png');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, '../../build/icon.png');
    }

    let trayIcon = null;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
    } catch (err) {
      console.warn('Error loading tray icon:', err);
    }

    this.tray = new Tray(trayIcon && !trayIcon.isEmpty() ? trayIcon : iconPath);
    this.tray.setToolTip('KEIOL - Video Player');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Buka KEIOL',
        click: () => this.showWindow()
      },
      { type: 'separator' },
      {
        label: 'Putar / Jeda',
        click: () => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('player:toggle-play');
          }
        }
      },
      {
        label: 'Pengaturan',
        click: () => {
          this.showWindow();
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('app:open-settings');
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Keluar',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    this.tray.on('click', () => {
      this.toggleWindow();
    });

    this.tray.on('double-click', () => {
      this.showWindow();
    });
  }

  showWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  toggleWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isVisible()) {
      if (this.mainWindow.isFocused()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.focus();
      }
    } else {
      this.showWindow();
    }
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = new TrayManager();

