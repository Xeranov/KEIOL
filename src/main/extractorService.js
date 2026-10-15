/**
 * Extractor Service for VidPlayer
 * Automatically extracts batch archive files (.rar, .zip, .7z, .tar) downloaded from Kusonime / Otakudesu
 * using Windows native bsdtar (tar.exe) and PowerShell Expand-Archive fallback,
 * flattens nested directories, cleans up junk shortcuts (.url), and guarantees ready-to-play video files.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ARCHIVE_EXTENSIONS = new Set(['.rar', '.zip', '.7z', '.tar', '.gz', '.tgz']);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.webm', '.mov', '.ts', '.flv', '.wmv', '.m4v'
]);

const JUNK_EXTENSIONS = new Set([
  '.url', '.lnk', '.txt', '.nfo', '.html', '.htm', '.website'
]);

class ExtractorService {
  /**
   * Cek apakah file adalah arsip yang perlu diekstrak
   */
  isArchive(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const ext = path.extname(filePath).toLowerCase();
    return ARCHIVE_EXTENSIONS.has(ext);
  }

  /**
   * Cari semua file arsip di dalam direktori
   */
  findArchives(dir) {
    const archives = [];
    if (!fs.existsSync(dir)) return archives;

    const scan = (currentDir) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ARCHIVE_EXTENSIONS.has(ext)) {
              archives.push(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`[Extractor] Gagal memindai arsip di ${currentDir}:`, err.message);
      }
    };

    scan(dir);
    return archives;
  }

  /**
   * Cari semua file video di dalam folder secara rekursif
   */
  findVideoFiles(dir) {
    const videoFiles = [];
    if (!fs.existsSync(dir)) return videoFiles;

    const scan = (currentDir) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (VIDEO_EXTENSIONS.has(ext)) {
              videoFiles.push(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`[Extractor] Gagal membaca direktori ${currentDir}:`, err.message);
      }
    };

    scan(dir);

    // Urutkan episode secara natural alphanumeric (Episode 01, Episode 02, ...)
    videoFiles.sort((a, b) => {
      const nameA = path.basename(a);
      const nameB = path.basename(b);
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return videoFiles;
  }

  /**
   * Merapikan folder hasil ekstraksi:
   * 1. Pindahkan semua file video dari subfolder ke root direktori anime (flatten)
   * 2. Bersihkan file sampah seperti .url Kusonime, shortcut, .txt
   * 3. Hapus subfolder kosong
   */
  flattenAndClean(destDir) {
    if (!fs.existsSync(destDir)) return;

    try {
      const entries = fs.readdirSync(destDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
          // Cari file di dalam subdirektori ini
          this.flattenSubdirectory(fullPath, destDir);

          // Hapus subfolder jika sudah kosong
          try {
            const remaining = fs.readdirSync(fullPath);
            if (remaining.length === 0) {
              fs.rmdirSync(fullPath);
            }
          } catch (e) {}
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (JUNK_EXTENSIONS.has(ext)) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`[Extractor] Menghapus file non-video: ${entry.name}`);
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn('[Extractor] Gagal merapikan folder:', err.message);
    }
  }

  flattenSubdirectory(subDir, targetRoot) {
    try {
      const items = fs.readdirSync(subDir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(subDir, item.name);

        if (item.isDirectory()) {
          this.flattenSubdirectory(itemPath, targetRoot);
          try { fs.rmdirSync(itemPath); } catch (e) {}
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext)) {
            let destFilePath = path.join(targetRoot, item.name);
            // Hindari tabrakan nama file jika sudah ada
            if (fs.existsSync(destFilePath) && destFilePath !== itemPath) {
              const baseName = path.parse(item.name).name;
              destFilePath = path.join(targetRoot, `${baseName}_${Date.now()}${ext}`);
            }
            fs.renameSync(itemPath, destFilePath);
            console.log(`[Extractor] Memindahkan video ke root folder: ${path.basename(destFilePath)}`);
          } else if (JUNK_EXTENSIONS.has(ext) || ARCHIVE_EXTENSIONS.has(ext)) {
            try { fs.unlinkSync(itemPath); } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn(`[Extractor] Gagal flatten subfolder ${subDir}:`, err.message);
    }
  }

  /**
   * Ekstrak satu file arsip secara internal
   */
  async extractSingleArchive(archivePath, destDir) {
    const ext = path.extname(archivePath).toLowerCase();
    let extractError = null;
    let extractedSuccess = false;

    // 1. Coba gunakan Windows built-in tar.exe (bsdtar with libarchive supports rar, zip, 7z, tar)
    try {
      await new Promise((resolve, reject) => {
        execFile('tar.exe', ['-xf', archivePath, '-C', destDir], { windowsHide: true }, (err, stdout, stderr) => {
          if (err) {
            reject(new Error(stderr || err.message));
          } else {
            resolve();
          }
        });
      });
      extractedSuccess = true;
    } catch (tarErr) {
      extractError = tarErr;

      // 2. Fallback untuk file .zip menggunakan PowerShell Expand-Archive
      if (ext === '.zip') {
        try {
          await new Promise((resolve, reject) => {
            const psScript = `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
            execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], { windowsHide: true }, (err, stdout, stderr) => {
              if (err) {
                reject(new Error(stderr || err.message));
              } else {
                resolve();
              }
            });
          });
          extractedSuccess = true;
        } catch (psErr) {
          extractError = psErr;
        }
      }
    }

    if (!extractedSuccess) {
      throw new Error(`Gagal mengekstrak ${path.basename(archivePath)}: ${extractError ? extractError.message : 'Format arsip tidak didukung'}`);
    }
  }

  /**
   * Ekstraksi total dan tuntas di dalam sebuah direktori.
   * Memastikan SEMUA arsip di dalam folder diekstrak hingga 0 arsip tersisa,
   * file video dipindahkan langsung ke root folder anime, dan file arsip serta sampah dibersihkan.
   */
  async ensureDirectoryFullyExtracted(destDir) {
    if (!fs.existsSync(destDir)) return { videoFiles: [], firstVideoPath: null };

    let iterations = 0;
    while (iterations < 5) {
      iterations++;
      const archives = this.findArchives(destDir);
      if (archives.length === 0) break;

      console.log(`[Extractor] Ditemukan ${archives.length} arsip untuk diekstrak di ${destDir}...`);

      for (const arc of archives) {
        try {
          console.log(`[Extractor] Mengekstrak arsip: ${path.basename(arc)}`);
          await this.extractSingleArchive(arc, destDir);
          // Hapus arsip setelah berhasil diekstrak
          if (fs.existsSync(arc)) {
            fs.unlinkSync(arc);
            console.log(`[Extractor] Arsip berhasil dihapus setelah ekstraksi: ${path.basename(arc)}`);
          }
        } catch (err) {
          console.error(`[Extractor] Error saat mengekstrak ${arc}:`, err.message);
          // Jika gagal, hapus jika corrupt atau biarkan jika penting
          throw err;
        }
      }

      // Rapikan dan pindahkan video ke root folder
      this.flattenAndClean(destDir);
    }

    // Rapikan final
    this.flattenAndClean(destDir);

    const videoFiles = this.findVideoFiles(destDir);
    return {
      destDir,
      extractedCount: videoFiles.length,
      videoFiles,
      firstVideoPath: videoFiles[0] || null
    };
  }

  /**
   * Eksekusi ekstraksi arsip ke folder target (dipanggil oleh DownloadManager atau Player)
   */
  async extractArchive(archivePath, targetDir = null, options = {}) {
    const destDir = targetDir || path.dirname(archivePath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    console.log(`[Extractor] Mulai proses ekstraksi tuntas: "${archivePath}" ke "${destDir}"`);

    // Ekstrak arsip utama jika masih ada
    if (fs.existsSync(archivePath)) {
      await this.extractSingleArchive(archivePath, destDir);
      try {
        fs.unlinkSync(archivePath);
        console.log(`[Extractor] Arsip utama dihapus: ${path.basename(archivePath)}`);
      } catch (e) {}
    }

    // Pastikan seluruh isi folder benar-benar diekstrak hingga bersih
    const result = await this.ensureDirectoryFullyExtracted(destDir);

    console.log(`[Extractor] Selesai! Ditemukan ${result.videoFiles.length} file video siap diputar di "${destDir}".`);
    return {
      success: true,
      ...result
    };
  }
}

module.exports = new ExtractorService();
