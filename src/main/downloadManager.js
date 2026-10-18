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
const extractorService = require('./extractorService');

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
   * Mengurutkan daftar mirror berdasarkan prioritas kecepatan dan akses langsung
   * Prioritas:
   * 1. Google Drive resmi (drive.google.com / drive.usercontent.google.com)
   * 2. Pixeldrain (pixeldrain.com)
   * 3. Direct CDN / File arsip langsung (.mp4, .mkv, .zip, .rar)
   * 4. Layanan pihak ketiga lainnya (Hxfile, Acefile, Mega)
   */
  sortMirrorsByPriority(mirrors) {
    if (!Array.isArray(mirrors) || mirrors.length === 0) return [];
    return [...mirrors].sort((a, b) => {
      const getScore = (m) => {
        const url = (m.url || '').toLowerCase();
        const host = (m.host || '').toLowerCase();

        // 1. Google Drive Resmi
        if (url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')) return 1000;

        // 2. Pixeldrain (Single file maupun Album/List)
        if (url.includes('pixeldrain.com') || host.includes('pixel') || host.includes('pdrain')) return 950;

        // 3. Acefile / Google Sharer (Otomatis resolve ke Google Drive cadangan)
        if (url.includes('acefile.co') || host.includes('acefile') || host.includes('sharer')) return 900;

        // 4. File media langsung / Fast CDN
        if (url.endsWith('.mp4') || url.endsWith('.mkv') || url.endsWith('.zip') || url.endsWith('.rar')) return 800;
        if (url.includes('desustream') || host.includes('desu')) return 700;
        if (url.includes('kraken') || host.includes('kraken')) return 600;
        if (url.includes('hxfile') || host.includes('hxfile')) return 500;

        // 5. Shortlinks
        if (url.includes('s.id') || url.includes('bit.ly') || url.includes('tinyurl')) return 400;

        // 6. External yang memerlukan browser
        if (url.includes('mega.nz') || host.includes('mega')) return 200;
        if (url.includes('terabox') || host.includes('terabox')) return 100;

        return 300;
      };
      return getScore(b) - getScore(a);
    });
  }

  /**
   * Mulai mengunduh video anime
   */
  async startDownload({ animeTitle, episodeTitle, downloadUrl, quality = '720p', mirrorHost = '', mirrors = [], posterUrl = '', synopsis = '', genres = '' }) {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Urutkan mirror jika tersedia
    let candidateMirrors = Array.isArray(mirrors) ? this.sortMirrorsByPriority(mirrors) : [];
    let initialUrl = downloadUrl;
    let initialHost = mirrorHost;

    if (!initialUrl && candidateMirrors.length > 0) {
      initialUrl = candidateMirrors[0].url;
      initialHost = candidateMirrors[0].host;
    }

    const downloadItem = {
      id,
      animeTitle: animeTitle || 'Anime',
      episodeTitle: episodeTitle || 'Episode',
      quality,
      mirrorHost: initialHost || 'Otomatis',
      posterUrl: posterUrl || '',
      synopsis: synopsis || '',
      genres: genres || '',
      percent: 0,
      speedText: '0 KB/s',
      status: 'resolving', // 'resolving' | 'downloading' | 'completed' | 'cancelled' | 'error'
      bytesDownloaded: 0,
      totalBytes: 0,
      abortController: new AbortController()
    };

    this.activeDownloads.set(id, downloadItem);
    this.notifyListeners({ type: 'started', item: downloadItem });

    // Jalankan download di latar belakang dengan dukungan fallback mirror otomatis
    this.executeDownload(downloadItem, initialUrl, candidateMirrors).catch(err => {
      console.warn(`[Download] Gagal [${id}]:`, err.message);
      downloadItem.status = 'error';
      downloadItem.error = err.message;
      downloadItem.speedText = 'Gagal';
      if (!downloadItem.fallbackUrl && candidateMirrors.length > 0) {
        downloadItem.fallbackUrl = candidateMirrors[0].url;
      }
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
   * Helper menyelesaikan File ID Google Drive menjadi URL streaming langsung
   */
  async resolveGoogleDriveFileId(fileId) {
    if (!fileId) return null;
    try {
      const step1Url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const res1 = await fetch(step1Url, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (res1.status === 404) {
        throw new Error(`File Google Drive ${fileId} tidak ditemukan (404 Not Found)`);
      }

      const setCookie = res1.headers.get('set-cookie');
      const cookieHeader = setCookie ? setCookie.split(';')[0] : '';

      const step2Url = res1.headers.get('location') || step1Url;
      const res2 = await fetch(step2Url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        }
      });

      if (res2.status === 404) {
        throw new Error(`File Google Drive ${fileId} tidak ditemukan (404 Not Found)`);
      }

      const contentType = res2.headers.get('content-type') || '';

      if (!contentType.includes('text/html')) {
        return {
          url: step2Url,
          headers: cookieHeader ? { 'Cookie': cookieHeader } : {}
        };
      }

      const html = await res2.text();
      if (html.includes('Error 404') || html.includes('Not Found') || html.includes('tidak ada')) {
        throw new Error(`File Google Drive ${fileId} tidak ditemukan (404 Not Found)`);
      }

      const formActionMatch = html.match(/<form[^>]+action=['"]([^'"]+)['"]/i);
      const action = formActionMatch ? formActionMatch[1] : 'https://drive.usercontent.google.com/download';

      const inputs = {};
      const inputRegex = /<input[^>]+name=['"]([^'"]+)['"][^>]+value=['"]([^'"]*)['"]/gi;
      let m;
      while ((m = inputRegex.exec(html)) !== null) {
        inputs[m[1]] = m[2];
      }

      if (inputs.id || inputs.confirm) {
        const queryParams = new URLSearchParams(inputs).toString();
        const baseAction = action.startsWith('http') ? action : `https://drive.google.com${action}`;
        return {
          url: `${baseAction}?${queryParams}`,
          headers: cookieHeader ? { 'Cookie': cookieHeader } : {}
        };
      }

      throw new Error(`Google Drive ${fileId} mengembalikan halaman verifikasi HTML atau limit kuota`);
    } catch (err) {
      console.warn('Gagal otomatis resolve Google Drive ID:', err.message);
      throw err;
    }
  }

  /**
   * Menyelesaikan link unduhan (misal link.desustream.com, pixeldrain, Google Drive, Acefile, dll)
   */
  async resolveDirectDownloadUrl(url, itemQuality = '') {
    if (!url) throw new Error('URL download kosong');

    let currentUrl = url;

    // Jika berupa link redirect desustream atau shortlink
    if (/s\.id\/|bit\.ly\/|tinyurl\.com\/|link\.desustream\.|desustream\.me|desu\.stream/i.test(currentUrl)) {
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
        console.warn('Gagal resolve link redirect shortlink:', err.message);
      }
    }

    // Resolusi Otomatis Pixeldrain: single file (/u/ID)
    const pixelDrainMatch = currentUrl.match(/pixeldrain\.com\/u\/([a-zA-Z0-9_-]+)/i);
    if (pixelDrainMatch) {
      return `https://pixeldrain.com/api/file/${pixelDrainMatch[1]}`;
    }

    // Resolusi Otomatis Pixeldrain: album/list (/l/ID)
    const pixelDrainListMatch = currentUrl.match(/pixeldrain\.com\/l\/([a-zA-Z0-9_-]+)/i);
    if (pixelDrainListMatch) {
      const listId = pixelDrainListMatch[1];
      try {
        const listRes = await fetch(`https://pixeldrain.com/api/list/${listId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (listRes.ok) {
          const listData = await listRes.json().catch(() => null);
          if (listData && Array.isArray(listData.files) && listData.files.length > 0) {
            let targetFile = null;
            if (itemQuality) {
              const cleanQ = itemQuality.toLowerCase().replace(/[^0-9]/g, '');
              if (cleanQ) {
                targetFile = listData.files.find(f => (f.name || '').toLowerCase().includes(cleanQ));
              }
            }
            if (!targetFile) {
              targetFile = listData.files[0];
            }
            if (targetFile && targetFile.id) {
              return `https://pixeldrain.com/api/file/${targetFile.id}`;
            }
          }
        }
      } catch (err) {
        console.warn('Gagal resolve Pixeldrain list:', err.message);
      }
    }

    // Resolusi Otomatis Acefile / Google Sharer (acefile.co)
    const acefileMatch = currentUrl.match(/acefile\.co\/(?:f|player)\/([0-9]+)/i);
    if (acefileMatch) {
      const fileId = acefileMatch[1];
      try {
        const aceApiRes = await fetch(`https://acefile.co/service/mirror_download/${fileId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': currentUrl
          }
        });
        if (aceApiRes.ok) {
          const aceData = await aceApiRes.json().catch(() => null);
          if (aceData && aceData.AceFile && Array.isArray(aceData.AceFile)) {
            for (const aceItem of aceData.AceFile) {
              if (aceItem.direct && typeof aceItem.direct === 'string' && aceItem.direct.startsWith('http')) {
                return aceItem.direct;
              }
              if (aceItem.code && typeof aceItem.code === 'string') {
                const decodedGdriveId = Buffer.from(aceItem.code, 'base64').toString('utf8');
                if (decodedGdriveId && decodedGdriveId.length > 10) {
                  try {
                    const gdriveDirect = await this.resolveGoogleDriveFileId(decodedGdriveId);
                    if (gdriveDirect) return gdriveDirect;
                  } catch (e) {
                    console.warn(`[Acefile] Mirror Google Drive ID ${decodedGdriveId} gagal:`, e.message);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Gagal resolve Acefile mirror:', err.message);
      }
    }

    // Resolusi Otomatis Google Drive (drive.google.com)
    if (/drive\.google\.com|drive\.usercontent\.google\.com/i.test(currentUrl)) {
      let fileId = '';
      const idParamMatch = currentUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
      const pathIdMatch = currentUrl.match(/\/d\/([a-zA-Z0-9_-]+)/i);
      if (idParamMatch) fileId = idParamMatch[1];
      else if (pathIdMatch) fileId = pathIdMatch[1];

      if (fileId) {
        return await this.resolveGoogleDriveFileId(fileId);
      }
    }

    // Cek apakah tautan mengarah ke layanan file hosting eksternal yang memerlukan browser/captcha
    if (/mega\.nz|gofile\.io|mediafire\.com|vikingfile|terabox/i.test(currentUrl)) {
      let hostName = 'eksternal';
      try { hostName = new URL(currentUrl).hostname; } catch (e) {}
      throw new Error(`Mirror ${hostName} memerlukan browser atau verifikasi captcha. Silakan buka tautan di browser.`);
    }

    return currentUrl;
  }

  /**
   * Eksekusi proses unduh file dan penulisan disk dengan dukungan mirror fallback otomatis
   */
  async executeDownload(item, rawUrl, candidateMirrors = []) {
    item.status = 'resolving';
    this.notifyListeners({ type: 'update', item });

    // Siapkan daftar kandidat mirror berurutan
    const candidates = [];
    if (rawUrl) {
      candidates.push({ host: item.mirrorHost || 'Default', url: rawUrl });
    }
    if (Array.isArray(candidateMirrors) && candidateMirrors.length > 0) {
      candidateMirrors.forEach(m => {
        if (m.url && !candidates.some(c => c.url === m.url)) {
          candidates.push(m);
        }
      });
    }

    if (candidates.length === 0) {
      throw new Error('Tidak ada tautan mirror unduhan yang tersedia.');
    }

    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (item.abortController.signal.aborted) {
        throw new Error('Unduhan dibatalkan');
      }

      let tempFilePath = null;
      let targetFilePath = null;
      let fileStream = null;

      try {
        item.mirrorHost = candidate.host || item.mirrorHost;
        const resolved = await this.resolveDirectDownloadUrl(candidate.url, item.quality);
        const finalUrl = (typeof resolved === 'object' && resolved && resolved.url) ? resolved.url : (typeof resolved === 'string' ? resolved : candidate.url);
        const customHeaders = (typeof resolved === 'object' && resolved && resolved.headers) ? resolved.headers : {};

        // Tentukan folder penyimpanan (sesuai setting download folder pengguna)
        const downloadRootDir = libraryService.getDownloadPath();
        const cleanAnimeFolder = this.sanitizeFileName(item.animeTitle);
        const animeDir = path.join(downloadRootDir, cleanAnimeFolder);

        if (!fs.existsSync(animeDir)) {
          fs.mkdirSync(animeDir, { recursive: true });
        }

        // Simpan cover poster dan info.json metadata jika belum ada
        if (item.posterUrl) {
          const posterTarget = path.join(animeDir, 'poster.jpg');
          if (!fs.existsSync(posterTarget)) {
            fetch(item.posterUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
              .then(r => r.arrayBuffer())
              .then(buf => fs.writeFileSync(posterTarget, Buffer.from(buf)))
              .catch(err => console.warn('[Download] Gagal mengunduh cover serial:', err.message));
          }
        }

        const infoJsonPath = path.join(animeDir, 'info.json');
        if (!fs.existsSync(infoJsonPath) && (item.synopsis || item.genres)) {
          try {
            const infoData = {
              title: item.animeTitle,
              synopsis: item.synopsis || '',
              genres: item.genres || '',
              poster: 'poster.jpg',
              createdAt: Date.now()
            };
            fs.writeFileSync(infoJsonPath, JSON.stringify(infoData, null, 2), 'utf8');
          } catch (e) {}
        }

        const cleanEpName = this.sanitizeFileName(item.episodeTitle);
        let ext = path.extname(new URL(finalUrl, 'https://dummy.com').pathname) || '.mp4';
        if (!ext || ext.length > 5 || ext === '.') ext = '.mp4';

        let finalFileName = `${cleanEpName}_${item.quality}${ext.startsWith('.') ? ext : '.' + ext}`;
        targetFilePath = path.join(animeDir, finalFileName);
        tempFilePath = path.join(animeDir, `${finalFileName}.downloading`);

        item.status = 'downloading';
        item.filePath = targetFilePath;
        this.notifyListeners({ type: 'update', item });

        const reqHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...customHeaders
        };
        if (/otakudesu|odcloud|desustream/i.test(finalUrl)) {
          reqHeaders['Referer'] = 'https://otakudesu.blog/';
        }

        const res = await fetch(finalUrl, {
          signal: item.abortController.signal,
          headers: reqHeaders
        });

        if (!res.ok) {
          if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          throw new Error(`Server unduhan (${candidate.host}) merespons HTTP ${res.status}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          throw new Error(`Server (${candidate.host}) mengembalikan halaman web HTML/verifikasi`);
        }

        // Periksa Content-Disposition untuk ekstensi file sebenarnya (.rar, .zip, .mkv)
        const contentDisposition = res.headers.get('content-disposition');
        if (contentDisposition) {
          const fnMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^'";\n]+)['"]?/i);
          if (fnMatch) {
            const rawFn = decodeURIComponent(fnMatch[1]);
            const realExt = path.extname(rawFn);
            if (realExt && realExt.length <= 5) {
              ext = realExt;
              finalFileName = `${cleanEpName}_${item.quality}${ext.startsWith('.') ? ext : '.' + ext}`;
              targetFilePath = path.join(animeDir, finalFileName);
              tempFilePath = path.join(animeDir, `${finalFileName}.downloading`);
              item.filePath = targetFilePath;
            }
          }
        }

        fileStream = fs.createWriteStream(tempFilePath);
        const contentLength = res.headers.get('content-length');
        item.totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

        const reader = res.body.getReader();
        let bytesDownloaded = 0;
        let lastTime = Date.now();
        let bytesSinceLastTime = 0;

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
        await new Promise((resolve, reject) => {
          fileStream.on('finish', resolve);
          fileStream.on('error', reject);
        });

        // Selesai unduh -> ubah nama dari .downloading ke nama final
        if (fs.existsSync(tempFilePath)) {
          if (fs.existsSync(targetFilePath)) {
            fs.unlinkSync(targetFilePath);
          }
          fs.renameSync(tempFilePath, targetFilePath);
        }

        // Cek apakah file yang diunduh adalah arsip (.rar, .zip, .7z) untuk otomatis diekstrak
        if (extractorService.isArchive(targetFilePath)) {
          item.status = 'extracting';
          item.speedText = 'Mengekstrak file video...';
          this.notifyListeners({ type: 'update', item });

          try {
            console.log(`[Download] Otomatis mengekstrak arsip batch: ${targetFilePath}`);
            const extractRes = await extractorService.extractArchive(targetFilePath, animeDir, { deleteArchiveAfter: true });
            if (extractRes.success && extractRes.firstVideoPath) {
              item.filePath = extractRes.firstVideoPath;
              item.extractedFiles = extractRes.videoFiles;
              item.extractedCount = extractRes.extractedCount;
              console.log(`[Download] Berhasil mengekstrak ${extractRes.extractedCount} video. File utama: ${extractRes.firstVideoPath}`);
            }
          } catch (extErr) {
            console.warn('[Download] Peringatan saat mengekstrak arsip:', extErr.message);
          }
        }

        item.status = 'completed';
        item.percent = 100;
        item.speedText = item.extractedCount ? `Selesai (${item.extractedCount} Episode)` : 'Selesai';
        this.activeDownloads.delete(item.id);

        this.notifyListeners({ type: 'completed', item });

        // Otomatis refresh library scanner agar episode langsung muncul di player & Downloaded
        try {
          libraryService.scanDownloads();
          libraryService.scanLibrary();
        } catch (e) {
          console.warn('Error refreshing library after download:', e);
        }

        return; // Berhasil! Keluar dari loop kandidat mirror

      } catch (err) {
        lastError = err;
        if (fileStream) {
          try { fileStream.close(); } catch (e) {}
        }
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        console.warn(`[Download] Mirror "${candidate.host}" tidak berhasil:`, err.message);
        if (i < candidates.length - 1) {
          console.log(`[Download] Beralih otomatis ke mirror alternatif berikutnya: "${candidates[i + 1].host}"...`);
        }
      }
    }

    // Jika seluruh kandidat mirror gagal, simpan link cadangan untuk dibuka di browser
    if (candidates.length > 0) {
      item.fallbackUrl = candidates[0].url;
    }
    throw lastError || new Error('Semua mirror unduhan gagal diproses.');
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

