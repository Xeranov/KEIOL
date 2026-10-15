const { app, shell, ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

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
    this.targetVersion = null;
    this.isDownloading = false;
    this.downloadComplete = false;
    this.cachedManifest = null;
    this.downloadedInstallerPath = null;
    this.currentDownloadReq = null;
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

  /**
   * Fetch remote JSON helper
   */
  fetchJson(url) {
    return new Promise((resolve) => {
      const client = url.startsWith('http:') ? http : https;
      const options = {
        headers: {
          'User-Agent': 'KEIOL-Update-Checker',
          'Accept': 'application/vnd.github.v3+json, application/json'
        },
        timeout: 8000
      };

      const req = client.get(url, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(this.fetchJson(res.headers.location));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(null);
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
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

  fetchRemoteManifest() {
    return this.fetchJson(this.manifestUrl);
  }

  /**
   * Dynamically resolve direct Windows installer (.exe) download URL
   */
  async resolveInstallerUrl(version) {
    // 1. Direct explicit URL from version manifest
    if (this.cachedManifest && this.cachedManifest.installerUrl) {
      return this.cachedManifest.installerUrl;
    }

    // 2. Query GitHub Releases API to locate published .exe asset for this specific tag
    const endpoint = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/tags/v${version}`;
    try {
      const releaseData = await this.fetchJson(endpoint);
      if (releaseData && releaseData.assets && Array.isArray(releaseData.assets)) {
        const exeAsset = releaseData.assets.find(a =>
          typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe')
        );
        if (exeAsset && exeAsset.browser_download_url) {
          return exeAsset.browser_download_url;
        }
      }
    } catch (e) {
      // Continue to fallback
    }

    // 3. Fallback standard electron-builder naming convention
    return `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v${version}/KEIOL-Setup-${version}.exe`;
  }

  /**
   * Direct streaming file downloader supporting HTTP 301/302/307 redirects and progress callbacks
   */
  downloadFile(url, targetPath, onProgress, maxRedirects = 6) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) {
        return reject(new Error('Terlalu banyak pengalihan (too many redirects)'));
      }

      const client = url.startsWith('http:') ? http : https;
      const options = {
        headers: {
          'User-Agent': 'KEIOL-InApp-Updater',
          'Accept': '*/*'
        },
        timeout: 25000
      };

      const req = client.get(url, options, (res) => {
        // Handle Redirects (GitHub releases redirect to AWS S3 objects)
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http')) {
            const parsed = new URL(url);
            redirectUrl = new URL(redirectUrl, parsed.origin).href;
          }
          return resolve(this.downloadFile(redirectUrl, targetPath, onProgress, maxRedirects - 1));
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          return reject(new Error(`Server unduhan merespon status ${res.statusCode} (${res.statusMessage || 'Not Found'})`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReportedTime = Date.now();
        let lastReportedBytes = 0;

        const fileStream = fs.createWriteStream(targetPath);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          fileStream.write(chunk);

          const now = Date.now();
          if (now - lastReportedTime >= 150) {
            const timeDeltaSec = (now - lastReportedTime) / 1000;
            const bytesDelta = downloadedBytes - lastReportedBytes;
            const speed = timeDeltaSec > 0 ? Math.round(bytesDelta / timeDeltaSec) : 0;
            lastReportedTime = now;
            lastReportedBytes = downloadedBytes;

            const percent = totalBytes > 0
              ? Math.min(Math.round((downloadedBytes / totalBytes) * 100), 99)
              : 0;

            if (typeof onProgress === 'function') {
              onProgress({
                percent,
                transferred: downloadedBytes,
                total: totalBytes,
                bytesPerSecond: speed
              });
            }
          }
        });

        res.on('end', () => {
          fileStream.end(() => {
            if (typeof onProgress === 'function') {
              onProgress({
                percent: 100,
                transferred: downloadedBytes,
                total: totalBytes || downloadedBytes,
                bytesPerSecond: 0
              });
            }
            resolve({ downloadedBytes, totalBytes });
          });
        });

        res.on('error', (err) => {
          fileStream.destroy();
          try { fs.unlinkSync(targetPath); } catch (e) {}
          reject(err);
        });

        fileStream.on('error', (err) => {
          res.destroy();
          try { fs.unlinkSync(targetPath); } catch (e) {}
          reject(err);
        });
      });

      req.on('error', (err) => {
        try { fs.unlinkSync(targetPath); } catch (e) {}
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        try { fs.unlinkSync(targetPath); } catch (e) {}
        reject(new Error('Koneksi unduhan pembaruan timeout'));
      });

      this.currentDownloadReq = req;
    });
  }

  init(mainWindow) {
    this.mainWindow = mainWindow;

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

      const hasNewerVersion = this.compareSemver(remoteVer, this.currentVersion) > 0;
      const isBelowMinVersion = this.compareSemver(this.currentVersion, minSupportedVer) < 0;

      // Jika versi saat ini sudah sama atau lebih baru dari rilis remote, jangan tampilkan popup update
      if (!hasNewerVersion) {
        if (manual && this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('update:check-result', {
            status: 'up-to-date',
            currentVersion: this.currentVersion,
            message: `KEIOL sudah menggunakan versi terbaru (v${this.currentVersion}).`
          });
        }
        return;
      }

      this.targetVersion = remoteVer;

      // Ada versi baru (remoteVer > currentVersion).
      // Wajib jika manifest meminta forceUpdate: true ATAU versi saat ini di bawah minSupportedVersion.
      const isForceUpdate = Boolean(manifest.forceUpdate) || isBelowMinVersion;

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

      // Pembaruan normal
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

      if (manual && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:check-result', {
          status: 'update-available',
          currentVersion: this.currentVersion,
          newVersion: remoteVer,
          message: `Tersedia pembaruan baru: v${remoteVer}!`
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

  /**
   * Start in-app automatic download of the Windows installer
   */
  async startDownload() {
    if (this.isDownloading) {
      return { success: false, message: 'Unduhan pembaruan sedang berlangsung' };
    }
    this.isDownloading = true;
    this.downloadComplete = false;

    const targetVer = this.targetVersion || (this.cachedManifest ? this.cachedManifest.version : 'latest');
    const tempDir = app ? app.getPath('temp') : os.tmpdir();
    const finalInstallerPath = path.join(tempDir, `KEIOL-Setup-${targetVer}.exe`);
    const partInstallerPath = path.join(tempDir, `KEIOL-Setup-${targetVer}.exe.part`);

    try {
      // Notify starting progress
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:download-progress', {
          percent: 0,
          transferred: 0,
          total: 0,
          bytesPerSecond: 0,
          statusText: 'Menghubungkan ke GitHub & mencari paket instalasi...'
        });
      }

      const installerUrl = await this.resolveInstallerUrl(targetVer);
      console.log(`[UpdateService] Mengunduh installer dari: ${installerUrl}`);

      // Perform streaming download with real progress reporting
      await this.downloadFile(installerUrl, partInstallerPath, (progress) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('update:download-progress', progress);
        }
      });

      // Rename .part to .exe
      if (fs.existsSync(partInstallerPath)) {
        if (fs.existsSync(finalInstallerPath)) {
          try { fs.unlinkSync(finalInstallerPath); } catch (e) {}
        }
        fs.renameSync(partInstallerPath, finalInstallerPath);
      }

      // Verify downloaded installer integrity (must be at least 1MB)
      if (!fs.existsSync(finalInstallerPath) || fs.statSync(finalInstallerPath).size < 1000000) {
        throw new Error('File installer yang diunduh tidak lengkap atau tidak valid.');
      }

      this.downloadedInstallerPath = finalInstallerPath;
      this.downloadComplete = true;
      this.isDownloading = false;

      console.log(`[UpdateService] Installer siap di: ${finalInstallerPath}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:download-complete', {
          version: targetVer,
          installerPath: finalInstallerPath,
          external: false
        });
      }

      return { success: true, installerPath: finalInstallerPath };

    } catch (err) {
      this.isDownloading = false;
      this.downloadComplete = false;
      try { if (fs.existsSync(partInstallerPath)) fs.unlinkSync(partInstallerPath); } catch (e) {}

      console.error('[UpdateService] Gagal mengunduh pembaruan:', err);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update:check-result', {
          status: 'error',
          message: 'Gagal mengunduh pembaruan otomatis: ' + err.message
        });
      }
      throw err;
    }
  }

  /**
   * Execute downloaded installer and restart KEIOL automatically
   */
  installAndRestart() {
    const installerPath = this.downloadedInstallerPath;

    if (installerPath && fs.existsSync(installerPath)) {
      console.log('[UpdateService] Menjalankan installer otomatis:', installerPath);

      // Launch installer detached
      // --updated: flag penanda auto-update
      // /S: silent installation ke folder yang sudah terpasang
      // --force-run: jalankan kembali KEIOL setelah instalasi selesai
      try {
        const child = spawn(installerPath, ['--updated', '/S', '--force-run'], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        child.on('error', (spawnErr) => {
          console.warn('[UpdateService] Gagal mode silent, mencoba installer interaktif:', spawnErr);
          try {
            const fallbackChild = spawn(installerPath, ['--updated'], {
              detached: true,
              stdio: 'ignore'
            });
            fallbackChild.unref();
          } catch (e) {
            shell.openPath(installerPath);
          }
        });
      } catch (err) {
        console.warn('[UpdateService] Spawn installer gagal, membuka via shell.openPath:', err);
        shell.openPath(installerPath);
      }

      // Tutup instans aplikasi saat ini agar file executable tidak terkunci
      app.isQuitting = true;
      setTimeout(() => {
        app.quit();
      }, 300);
      return { success: true };
    }

    // Fallback jika installer belum tersimpan
    console.warn('[UpdateService] Installer lokal tidak ditemukan, membuka tautan GitHub...');
    if (this.cachedManifest && this.cachedManifest.downloadUrl) {
      shell.openExternal(this.cachedManifest.downloadUrl);
    } else {
      shell.openExternal(`https://github.com/${this.repoOwner}/${this.repoName}/releases/latest`);
    }
    app.isQuitting = true;
    app.quit();
    return { success: false, fallback: 'browser' };
  }
}

module.exports = new UpdateService();
