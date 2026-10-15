const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ffmpegPath } = require('./binHelper');
let electronApp = null;
try {
  electronApp = require('electron').app;
} catch (e) {}

class MediaServer {
  constructor() {
    this.server = null;
    this.port = 0;
    this.activeProcesses = new Map(); // reqId -> ChildProcess
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Listen on localhost with random free port (0)
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    // Kill any remaining ffmpeg processes
    for (const [id, proc] of this.activeProcesses.entries()) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {}
    }
    this.activeProcesses.clear();

    if (this.server) {
      this.server.close();
    }
  }

  handleRequest(req, res) {
    // Enable CORS for localhost renderer
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.port}`);
      const pathname = parsedUrl.pathname;

      if (pathname === '/file') {
        this.handleDirectFile(parsedUrl, req, res);
      } else if (pathname === '/stream') {
        this.handleFfmpegStream(parsedUrl, req, res);
      } else if (pathname === '/subtitle') {
        this.handleSubtitleExtract(parsedUrl, req, res);
      } else if (pathname === '/thumbnail') {
        this.handleThumbnail(parsedUrl, req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end(`Internal Server Error: ${err.message}`);
    }
  }

  /**
   * Serves local video files directly with full HTTP 206 Partial Content (range requests)
   */
  handleDirectFile(url, req, res) {
    const filePath = url.searchParams.get('path');
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'video/mp4';
    if (ext === '.webm') mimeType = 'video/webm';
    else if (ext === '.ogg' || ext === '.ogv') mimeType = 'video/ogg';
    else if (ext === '.mkv') mimeType = 'video/x-matroska';
    else if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.svg') mimeType = 'image/svg+xml';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`
        });
        res.end();
        return;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType
      });

      file.pipe(res);
      req.socket?.on('close', () => {
        file.destroy();
      });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType
      });

      const file = fs.createReadStream(filePath);
      file.pipe(res);
      req.socket?.on('close', () => {
        file.destroy();
      });
    }
  }

  /**
   * Streams media via FFmpeg (transmux or full transcode to fragmented MP4)
   */
  handleFfmpegStream(url, req, res) {
    const filePath = url.searchParams.get('path');
    const seekStr = url.searchParams.get('seek') || '0';
    const mode = url.searchParams.get('mode') || 'transmux';
    const audioIndex = url.searchParams.get('audio') || '0';

    const isRemote = filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'));

    if (!filePath || (!isRemote && !fs.existsSync(filePath))) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const seekSec = Math.max(0, parseFloat(seekStr) || 0);

    const args = [];

    // Seeking before input for fast keyframe seek
    if (seekSec > 0) {
      args.push('-ss', seekSec.toString());
    }

    if (isRemote) {
      if (filePath.includes('vidcache.net') || filePath.includes('yourupload.com')) {
        args.push(
          '-referer', 'https://www.yourupload.com/',
          '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          '-headers', 'Referer: https://www.yourupload.com/\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n'
        );
      } else if (filePath.includes('vidhide') || filePath.includes('dramiyos') || filePath.includes('acek')) {
        args.push(
          '-referer', 'https://odvidhide.com/',
          '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          '-headers', 'Referer: https://odvidhide.com/\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n'
        );
      } else {
        args.push(
          '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        );
      }
      args.push('-reconnect', '1', '-reconnect_at_eof', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '2');
    }

    args.push('-i', filePath);

    // Map primary video and chosen audio track
    args.push('-map', '0:v:0');
    args.push('-map', `0:a:${audioIndex}?`);

    if (mode === 'transmux') {
      // Copy video without re-encoding, transcode audio to standard AAC
      args.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ac', '2'
      );
    } else {
      // Full transcode with ultrafast preset
      args.push(
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ac', '2'
      );
    }

    // Output fragmented MP4 over stdout pipe
    args.push(
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    );

    const ffmpegProc = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const reqId = `${Date.now()}-${Math.random()}`;
    this.activeProcesses.set(reqId, ffmpegProc);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Transfer-Encoding': 'chunked',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff'
    });

    ffmpegProc.stdout.pipe(res);

    // Clean up when client disconnects or process ends
    const cleanup = () => {
      this.activeProcesses.delete(reqId);
      try {
        if (!ffmpegProc.killed) {
          ffmpegProc.kill('SIGKILL');
        }
      } catch (e) {}
    };

    req.socket?.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('close', cleanup);
    ffmpegProc.on('exit', () => {
      this.activeProcesses.delete(reqId);
    });
    ffmpegProc.on('error', (err) => {
      console.error('[MediaServer FFmpeg error]:', err);
      cleanup();
    });
  }

  /**
   * Extracts embedded subtitle track and converts on the fly to WebVTT
   */
  handleSubtitleExtract(url, req, res) {
    const filePath = url.searchParams.get('path');
    const trackIndex = url.searchParams.get('track') || '0';

    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const args = [
      '-i', filePath,
      '-map', `0:s:${trackIndex}`,
      '-f', 'webvtt',
      'pipe:1'
    ];

    const ffmpegProc = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    res.writeHead(200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });

    ffmpegProc.stdout.pipe(res);

    ffmpegProc.on('error', (err) => {
      console.error('[MediaServer Subtitle FFmpeg error]:', err);
    });

    const killSub = () => {
      try {
        if (!ffmpegProc.killed) ffmpegProc.kill('SIGKILL');
      } catch (e) {}
    };
    req.socket?.on('close', killSub);
    res.on('close', killSub);
    res.on('finish', killSub);
  }

  getCacheDir() {
    if (electronApp && typeof electronApp.getPath === 'function') {
      try {
        return electronApp.getPath('userData');
      } catch (e) {}
    }
    return path.join(process.cwd(), '.cache');
  }

  /**
   * Generates or serves cached video thumbnail (16:9 frame)
   */
  handleThumbnail(url, req, res) {
    const filePath = url.searchParams.get('path');
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    // If it's already an image file (e.g. poster.jpg), serve directly
    if (['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext)) {
      const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : (ext === '.svg' ? 'image/svg+xml' : 'image/jpeg'));
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const cacheDir = path.join(this.getCacheDir(), 'thumbnails');
    if (!fs.existsSync(cacheDir)) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
      } catch (e) {}
    }

    const stat = fs.statSync(filePath);
    const rawTime = url.searchParams.get('time');
    let timePos = '00:00:03';
    let timeKey = 'default';

    if (rawTime) {
      const parsedNum = parseFloat(rawTime);
      if (!isNaN(parsedNum) && parsedNum >= 0) {
        timeKey = String(Math.floor(parsedNum));
        timePos = parsedNum.toFixed(2);
      } else {
        timeKey = rawTime;
        timePos = rawTime;
      }
    }

    const width = url.searchParams.get('width') || '480';
    const hash = crypto.createHash('md5').update(`${filePath}:${stat.size}:${stat.mtimeMs}:${timeKey}:${width}`).digest('hex');
    const thumbPath = path.join(cacheDir, `${hash}.jpg`);

    if (fs.existsSync(thumbPath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(thumbPath).pipe(res);
      return;
    }

    // Extract frame with ffmpeg-static at specified timestamp or 00:00:03
    const ffmpegProc = spawn(ffmpegPath, [
      '-ss', timePos,
      '-i', filePath,
      '-vframes', '1',
      '-q:v', '3',
      '-vf', `scale=${width}:-1`,
      thumbPath,
      '-y'
    ], {
      windowsHide: true
    });

    ffmpegProc.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbPath)) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
        fs.createReadStream(thumbPath).pipe(res);
      } else {
        // Fallback: try early frame 00:00:00.500
        const fallbackProc = spawn(ffmpegPath, [
          '-ss', '00:00:00.500',
          '-i', filePath,
          '-vframes', '1',
          '-q:v', '3',
          '-vf', `scale=${width}:-1`,
          thumbPath,
          '-y'
        ], {
          windowsHide: true
        });

        fallbackProc.on('error', (fErr) => {
          console.error('[MediaServer Fallback Thumbnail error]:', fErr);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to generate thumbnail');
          }
        });

        fallbackProc.on('close', (fCode) => {
          if (fCode === 0 && fs.existsSync(thumbPath)) {
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
            fs.createReadStream(thumbPath).pipe(res);
          } else {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Failed to generate thumbnail');
            }
          }
        });
      }
    });

    ffmpegProc.on('error', (err) => {
      console.error('Thumbnail generation error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Thumbnail error');
      }
    });
  }
}

module.exports = new MediaServer();

