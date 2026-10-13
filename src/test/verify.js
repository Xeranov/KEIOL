const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const mediaServer = require('../main/mediaServer');
const { probeMedia } = require('../main/probeService');

async function runTests() {
  console.log('--- 1. Testing FFmpeg and FFprobe Binaries ---');
  if (!fs.existsSync(ffmpegStatic)) {
    throw new Error('ffmpeg-static binary not found at: ' + ffmpegStatic);
  }
  const ffmpegVersion = execFileSync(ffmpegStatic, ['-version']).toString().split('\n')[0];
  console.log('✓ FFmpeg binary ok:', ffmpegVersion);

  if (!fs.existsSync(ffprobeStatic.path)) {
    throw new Error('ffprobe-static binary not found at: ' + ffprobeStatic.path);
  }
  const ffprobeVersion = execFileSync(ffprobeStatic.path, ['-version']).toString().split('\n')[0];
  console.log('✓ FFprobe binary ok:', ffprobeVersion);

  console.log('\n--- 2. Generating Test Media Files (MP4 & MKV with AC3 Audio) ---');
  const tempDir = path.join(__dirname, '../../test-media');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const testMp4 = path.join(tempDir, 'test_sample.mp4');
  const testMkv = path.join(tempDir, 'test_sample.mkv');

  // Generate 3-second test MP4 (H.264 + AAC)
  execFileSync(ffmpegStatic, [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x240:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    testMp4
  ], { stdio: 'ignore' });
  console.log('✓ Generated test MP4:', testMp4);

  // Generate 3-second test MKV with AC3 audio (tests universal transmuxing!)
  execFileSync(ffmpegStatic, [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x240:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=3',
    '-c:v', 'libx264',
    '-c:a', 'ac3',
    testMkv
  ], { stdio: 'ignore' });
  console.log('✓ Generated test MKV with AC3 audio:', testMkv);

  console.log('\n--- 3. Testing Media Probe Service ---');
  const mp4Info = await probeMedia(testMp4);
  console.log('✓ MP4 Probe:', {
    duration: mp4Info.duration,
    playbackMode: mp4Info.playbackMode,
    videoCodec: mp4Info.video?.codec,
    audioCodec: mp4Info.audioStreams[0]?.codec
  });
  if (mp4Info.playbackMode !== 'direct') {
    throw new Error(`Expected MP4 to have 'direct' playbackMode, got: ${mp4Info.playbackMode}`);
  }

  const mkvInfo = await probeMedia(testMkv);
  console.log('✓ MKV Probe:', {
    duration: mkvInfo.duration,
    playbackMode: mkvInfo.playbackMode,
    videoCodec: mkvInfo.video?.codec,
    audioCodec: mkvInfo.audioStreams[0]?.codec
  });
  if (mkvInfo.playbackMode !== 'transmux') {
    throw new Error(`Expected MKV with AC3 to have 'transmux' playbackMode, got: ${mkvInfo.playbackMode}`);
  }

  console.log('\n--- 4. Testing Local Media Server & Streaming Endpoints ---');
  const port = await mediaServer.start();
  console.log(`✓ MediaServer listening on port ${port}`);

  // Test direct file serving (HTTP 200 / 206)
  await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/file?path=${encodeURIComponent(testMp4)}`, {
      headers: { Range: 'bytes=0-1023' }
    }, (res) => {
      console.log(`✓ /file HTTP Status: ${res.statusCode} (${res.headers['content-range']})`);
      if (res.statusCode !== 206) {
        return reject(new Error(`Expected status 206, got: ${res.statusCode}`));
      }
      resolve();
    }).on('error', reject);
  });

  // Test transmux streaming for MKV
  await new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/stream?path=${encodeURIComponent(testMkv)}&mode=transmux&seek=0`, (res) => {
      console.log(`✓ /stream Transmux Status: ${res.statusCode} (${res.headers['content-type']})`);
      if (res.statusCode !== 200) {
        return reject(new Error(`Expected status 200, got: ${res.statusCode}`));
      }
      res.once('data', (chunk) => {
        console.log(`✓ Received first streamed chunk: ${chunk.length} bytes`);
        req.destroy();
        resolve();
      });
    });
    req.on('error', reject);
  });

  mediaServer.stop();
  console.log('✓ MediaServer stopped cleanly');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

