const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

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
      req.on('close', () => {
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
      req.on('close', () => {
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

    if (!filePath || !fs.existsSync(filePath)) {
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

    const ffmpegProc = spawn(ffmpegStatic, args, {
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

    req.on('close', cleanup);
    res.on('finish', cleanup);
    ffmpegProc.on('exit', () => {
      this.activeProcesses.delete(reqId);
    });
    ffmpegProc.on('error', () => {
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

    const ffmpegProc = spawn(ffmpegStatic, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    res.writeHead(200, {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });

    ffmpegProc.stdout.pipe(res);

    req.on('close', () => {
      try {
        if (!ffmpegProc.killed) ffmpegProc.kill('SIGKILL');
      } catch (e) {}
    });
  }
}

module.exports = new MediaServer();
