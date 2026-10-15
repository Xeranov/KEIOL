/**
 * Download Manager for VidPlayer
 * Handles downloading anime episodes in the background, resolving redirection links,
 * tracking progress and speed, and saving files into the user's chosen download directory.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const libraryService = require('./libraryService');

class DownloadManager {
  constructor() {
    this.activeDownloads = new Map();
    this.eventListeners = new Set();
  }

  onProgress(callback) {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  notifyListeners(data) {
    for (const listener of this.eventListeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error notifying download listener:', err);
      }
    }
  }

  getActiveDownloads() {
    return Array.from(this.activeDownloads.values()).map(d => ({
      id: d.id,
      animeTitle: d.animeTitle,
      episodeTitle: d.episodeTitle,
      quality: d.quality,
      percent: d.percent,
      speedText: d.speedText,
      status: d.status,
      bytesDownloaded: d.bytesDownloaded,
      totalBytes: d.totalBytes
    }));
  }

  /**
   * Mulai mengunduh video anime
   */
  async startDownload({ animeTitle, episodeTitle, downloadUrl, quality = '720p', mirrorHost = '' }) {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const downloadItem = {
      id,
      animeTitle: animeTitle || 'Anime',
      episodeTitle: episodeTitle || 'Episode',
      quality,
      mirrorHost,
      percent: 0,
      speedText: '0 KB/s',
      status: 'resolving', // 'resolving' | 'downloading' | 'completed' | 'cancelled' | 'error'
      bytesDownloaded: 0,
      totalBytes: 0,
      abortController: new AbortController()
    };

    this.activeDownloads.set(id, downloadItem);
    this.notifyListeners({ type: 'started', item: downloadItem });

    // Jalankan download di latar belakang
    this.executeDownload(downloadItem, downloadUrl).catch(err => {
      console.warn(`[Download] Gagal [${id}]:`, err.message);
      downloadItem.status = 'error';
      downloadItem.error = err.message;
      downloadItem.speedText = 'Gagal';
      this.notifyListeners({ type: 'error', id, error: err.message, item: downloadItem });
    });

    return { downloadId: id, status: 'started' };
  }

  /**
   * Membatalkan download yang sedang berjalan
   */
  cancelDownload(downloadId) {
    const item = this.activeDownloads.get(downloadId);
    if (item) {
      item.status = 'cancelled';
      if (item.abortController) {
        item.abortController.abort();
      }
      this.activeDownloads.delete(downloadId);
      this.notifyListeners({ type: 'cancelled', id: downloadId });
      return true;
    }
    return false;
  }

  /**
   * Menyelesaikan link unduhan (misal link.desustream.com -> pixeldrain)
   */
  async resolveDirectDownloadUrl(url) {
    if (!url) throw new Error('URL download kosong');

    let currentUrl = url;

    // Jika berupa link redirect desustream
    if (currentUrl.includes('link.desustream.com') || currentUrl.includes('desustream.me') || currentUrl.includes('desu.stream')) {
      try {
        const headRes = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://otakudesu.blog/'
          }
        });

        const location = headRes.headers.get('location');
        if (location) {
          currentUrl = location;
        }
      } catch (err) {
        console.warn('Gagal resolve link redirect desustream:', err.message);
      }
    }

    // Jika redirect ke Pixeldrain: https://pixeldrain.com/u/ID -> https://pixeldrain.com/api/file/ID
    const pixelDrainMatch = currentUrl.match(/pixeldrain\.com\/u\/([a-zA-Z0-9_-]+)/i);
    if (pixelDrainMatch) {
      return `https://pixeldrain.com/api/file/${pixelDrainMatch[1]}`;
    }

    // Cek apakah tautan mengarah ke layanan file hosting eksternal yang memerlukan browser/captcha
    if (/mega\.nz|acefile\.co|gofile\.io|drive\.google\.com|mediafire\.com|vikingfile/i.test(currentUrl)) {
      let hostName = 'eksternal';
      try { hostName = new URL(currentUrl).hostname; } catch (e) {}
      throw new Error(`Mirror ${hostName} memerlukan browser atau login. Gunakan opsi 'Download Langsung (Cepat MP4)' untuk unduh otomatis.`);
    }

    return currentUrl;
  }

  /**
   * Eksekusi proses unduh file dan penulisan disk
   */
  async executeDownload(item, rawUrl) {
    item.status = 'resolving';
    this.notifyListeners({ type: 'update', item });

    const finalUrl = await this.resolveDirectDownloadUrl(rawUrl);

    // Tentukan folder penyimpanan (sesuai setting download folder pengguna)
    const downloadRootDir = libraryService.getDownloadPath();
    const cleanAnimeFolder = this.sanitizeFileName(item.animeTitle);
    const animeDir = path.join(downloadRootDir, cleanAnimeFolder);

    if (!fs.existsSync(animeDir)) {
      fs.mkdirSync(animeDir, { recursive: true });
    }

    const cleanEpName = this.sanitizeFileName(item.episodeTitle);
    const ext = path.extname(new URL(finalUrl, 'https://dummy.com').pathname) || '.mp4';
    const finalFileName = `${cleanEpName}_${item.quality}${ext.startsWith('.') ? ext : '.' + ext}`;
    const targetFilePath = path.join(animeDir, finalFileName);
    const tempFilePath = path.join(animeDir, `${finalFileName}.downloading`);

    item.status = 'downloading';
    item.filePath = targetFilePath;
    this.notifyListeners({ type: 'update', item });

    const fileStream = fs.createWriteStream(tempFilePath);

    const res = await fetch(finalUrl, {
      signal: item.abortController.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://otakudesu.blog/'
      }
    });

    if (!res.ok) {
      fileStream.close();
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw new Error(`Server unduhan merespons HTTP ${res.status}. Gunakan opsi 'Download Langsung (Cepat MP4)' atau mirror alternatif.`);
    }

    const contentLength = res.headers.get('content-length');
    item.totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = res.body.getReader();
    let bytesDownloaded = 0;
    let lastTime = Date.now();
    let bytesSinceLastTime = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bytesDownloaded += value.length;
        bytesSinceLastTime += value.length;
        fileStream.write(Buffer.from(value));

        const now = Date.now();
        if (now - lastTime >= 500) {
          const speedBytesPerSec = (bytesSinceLastTime / (now - lastTime)) * 1000;
          item.speedText = this.formatSpeed(speedBytesPerSec);
          item.bytesDownloaded = bytesDownloaded;

          if (item.totalBytes > 0) {
            item.percent = Math.min(100, Math.round((bytesDownloaded / item.totalBytes) * 100));
          }

          lastTime = now;
          bytesSinceLastTime = 0;
          this.notifyListeners({ type: 'progress', item });
        }
      }

      fileStream.end();
      await new Promise(resolve => fileStream.on('finish', resolve));

      // Selesai unduh -> ubah nama dari .downloading ke nama final
      if (fs.existsSync(tempFilePath)) {
        if (fs.existsSync(targetFilePath)) {
          fs.unlinkSync(targetFilePath);
        }
        fs.renameSync(tempFilePath, targetFilePath);
      }

      item.status = 'completed';
      item.percent = 100;
      item.speedText = 'Selesai';
      this.activeDownloads.delete(item.id);

      this.notifyListeners({ type: 'completed', item });

      // Otomatis refresh library scanner agar episode langsung muncul di player & Downloaded
      try {
        libraryService.scanLibrary();
      } catch (e) {
        console.warn('Error refreshing library after download:', e);
      }

    } catch (err) {
      fileStream.close();
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
      throw err;
    }
  }

  sanitizeFileName(name) {
    if (!name) return 'File';
    return name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec >= 1024 * 1024) {
      return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
    }
    return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
  }
}

module.exports = new DownloadManager();

