const fs = require('fs');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

/**
 * Resolves binary executable path inside or outside of Electron asar archive
 * @param {string} rawPath
 * @returns {string}
 */
function resolveBinPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return rawPath;

  // 1. If running inside Electron packaged asar archive
  if (rawPath.includes('app.asar')) {
    const unpacked = rawPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpacked)) {
      return unpacked;
    }
  }

  // 2. Direct path check
  if (fs.existsSync(rawPath)) {
    return rawPath;
  }

  // 3. Fallback via process.resourcesPath in packaged app
  if (process.resourcesPath) {
    const baseName = path.basename(rawPath);
    if (baseName.toLowerCase().includes('ffmpeg')) {
      const p1 = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', baseName);
      if (fs.existsSync(p1)) return p1;
    } else if (baseName.toLowerCase().includes('ffprobe')) {
      const p2 = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'ffprobe-static',
        'bin',
        process.platform,
        process.arch,
        baseName
      );
      if (fs.existsSync(p2)) return p2;
    }
  }

  return rawPath;
}

const ffmpegPath = resolveBinPath(ffmpegStatic);
const ffprobePath = resolveBinPath(ffprobeStatic && ffprobeStatic.path ? ffprobeStatic.path : null);

module.exports = {
  resolveBinPath,
  ffmpegPath,
  ffprobePath
};
