const { app, shell, ipcMain } = require('electron');
const https = require('https');
const path = require('path');
const fs = require('fs');

// Try importing electron-updater if available
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
} catch (e) {
  // Will run in standalone/manifest mode
}

class UpdateService {
  constructor() {
    this.mainWindow = null;
    this.repoOwner = 'Xeranov';
    this.repoName = 'KEIOL';
    this.manifestUrl = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/version.json`;
    this.currentVersion = this.getCurrentVersion();
    this.isDownloading = false;
    this.downloadComplete = false;
    this.cachedManifest = null;
  }

  getCurrentVersion() {
    if (app && app.getVersion) {
      const v = app.getVersion();
      if (v && v !== '0.0.0') return v;
    }
    try {
      const pkgPath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return pkg.version || '1.0.0';
      }
    } catch (e) {}
    return '1.0.0';
  }

  /**
   * Compare two semver strings: v1 vs v2
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
   */
  compareSemver(v1, v2) {
    if (!v1 || !v2) return 0;
    const clean1 = v1.replace(/^v/, '').trim();
    const clean2 = v2.replace(/^v/, '').trim();
    const p1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
    const p2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(p1.length, p2.length, 3); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  fetchRemoteManifest() {
    return new Promise((resolve) => {
      const options = {
        headers: {
          'User-Agent': 'KEIOL-Update-Checker'
        },
        timeout: 6000
      };

      const req = https.get(this.manifestUrl, options, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(null);
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const manifest = JSON.parse(data);
            resolve(manifest);
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  init(mainWindow) {
    this.mainWindow = mainWindow;

    // Configure electron-updater if packaged
    if (autoUpdater && app.isPackaged) {
      try {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('download-progress', (progressObj) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update:download-progress', {
              percent: Math.round(progressObj.percent),
              transferred: progressObj.transferred,
              total: progressObj.total,
              bytesPerSecond: progressObj.bytesPerSecond
            });
          }
        });

        autoUpdater.on('update-downloaded', (info) => {
          this.isDownloading = false;
          this.downloadComplete = true;
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update:download-complete', {
              version: info.version
            });
          }
        });

        autoUpdater.on('error', (err) => {
          console.warn('autoUpdater error:', err.message);
        });
      } catch (err) {
        console.warn('Error setting up autoUpdater:', err);
      }
    }

    // Check updates on startup with a brief delay so UI has mounted
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 2500);
  }

  async checkForUpdates(manual = false) {
    try {
      const manifest = await this.fetchRemoteManifest();
      if (!manifest) {
        if (manual && this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('update:check-result', {
            status: 'error',
            message: 'Tidak dapat menghubungi server pembaruan GitHub. Periksa koneksi internet Anda.'
          });
        }
        return;
      }

      this.cachedManifest = manifest;
      const remoteVer = manifest.version || '1.0.0';
      const minSupportedVer = manifest.minSupportedVersion || '1.0.0';
      const isForceUpdate = Boolean(manifest.forceUpdate) || (this.compareSemver(this.currentVersion, minSupportedVer) < 0);

      // Check for force update
      if (isForceUpdate) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('update:force-required', {
            currentVersion: this.currentVersion,
            newVersion: remoteVer,
            minSupportedVersion: minSupportedVer,
            forceMessage: manifest.forceUpdateMessage || 'Pembaruan wajib diperlukan untuk memperbaiki masalah kritis pada versi sebelumnya.',
            changelog: manifest.changelog || 'Pembaruan keamanan & stabilitas.',
            downloadUrl: manifest.downloadUrl || `https://github.com/${this.repoOwner}/${this.repoName}/releases/latest`
          });
        }
        return;
      }

      // Check for normal update
      if (this.compareSemver(remoteVer, this.currentVersion) > 0) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('update:available', {
            currentVersion: this.currentVersion,
            newVersion: remoteVer,
            changelog: manifest.changelog || 'Pembaruan versi terbaru KEIOL tersedia.',
            downloadUrl: manifest.downloadUrl || `https://github.com/${this.repoOwner}/${this.repoName}/releases/latest`,
            releaseDate: manifest.releaseDate || '',
            manual: manual
          });
        }
        return;
      }

      // Already up to date
      if (manual && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:check-result', {
          status: 'up-to-date',
          currentVersion: this.currentVersion,
          message: `KEIOL sudah menggunakan versi terbaru (v${this.currentVersion}).`
        });
      }
    } catch (e) {
      if (manual && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:check-result', {
          status: 'error',
          message: 'Terjadi kesalahan saat memeriksa update: ' + e.message
        });
      }
    }
  }

  async startDownload() {
    if (this.isDownloading) return;
    this.isDownloading = true;

    if (autoUpdater && app.isPackaged) {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true, mode: 'auto-updater' };
      } catch (err) {
        this.isDownloading = false;
        console.warn('autoUpdater download failed, opening browser:', err);
      }
    }

    // In dev mode or fallback: simulate progress and open release download in browser
    let percent = 0;
    const interval = setInterval(() => {
      percent += 20;
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:download-progress', {
          percent: Math.min(percent, 100),
          bytesPerSecond: 1024 * 1024 * 2
        });
      }
      if (percent >= 100) {
        clearInterval(interval);
        this.isDownloading = false;
        this.downloadComplete = true;
        if (this.cachedManifest && this.cachedManifest.downloadUrl) {
          shell.openExternal(this.cachedManifest.downloadUrl);
        } else {
          shell.openExternal(`https://github.com/${this.repoOwner}/${this.repoName}/releases/latest`);
        }
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('update:download-complete', {
            version: this.cachedManifest ? this.cachedManifest.version : 'latest',
            external: true
          });
        }
      }
    }, 400);

    return { success: true, mode: 'external' };
  }

  installAndRestart() {
    if (autoUpdater && app.isPackaged && this.downloadComplete) {
      autoUpdater.quitAndInstall(false, true);
    } else {
      if (this.cachedManifest && this.cachedManifest.downloadUrl) {
        shell.openExternal(this.cachedManifest.downloadUrl);
      }
      app.isQuitting = true;
      app.quit();
    }
  }
}

module.exports = new UpdateService();
