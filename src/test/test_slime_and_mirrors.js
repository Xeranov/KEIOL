const assert = require('assert');
const fs = require('fs');
const path = require('path');
const otakudesu = require('../main/otakudesuService.js');

async function runTests() {
  console.log('=== TEST SUITE: Slime S4 Mirror Fallback & HLS Transmuxing ===\n');

  console.log('--- TEST 1: Extract Stream for Tensei shitara Slime Datta Ken S4 Ep 1 ---');
  const slimeUrl = 'https://otakudesu.blog/episode/tenslem-s4-episode-1-sub-indo/';
  const streamInfo = await otakudesu.getEpisodeStream(slimeUrl);

  assert.ok(streamInfo, 'Stream info should exist');
  assert.ok(streamInfo.streamUrl, 'Stream URL should be resolved via mirror fallback');
  assert.ok(
    streamInfo.streamUrl.includes('.m3u8') || streamInfo.streamUrl.includes('.mp4'),
    `Stream URL must be valid media stream: ${streamInfo.streamUrl}`
  );
  console.log('✓ PASS: Stream resolved:', streamInfo.streamUrl.slice(0, 80) + '...');
  console.log('✓ PASS: Active qualities:', streamInfo.availableQualities.map(q => q.quality).join(', '));
  assert.ok(streamInfo.availableQualities.length > 0, 'Available qualities must not be empty');

  console.log('\n--- TEST 2: Stream URL Connectivity Check ---');
  const isAlive = await otakudesu.isStreamAlive(streamInfo.streamUrl, 'https://odvidhide.com/');
  assert.ok(isAlive, 'Resolved HLS master playlist URL must return HTTP 200/206');
  console.log('✓ PASS: Stream URL is live and responsive with 200 OK');

  console.log('\n--- TEST 3: Media Server & FFmpeg HLS Transmux Configuration ---');
  const mediaServerJs = fs.readFileSync(path.join(__dirname, '../main/mediaServer.js'), 'utf8');
  assert.ok(mediaServerJs.includes("filePath.includes('vidhide')"), 'mediaServer must recognize VidHide domains');
  assert.ok(mediaServerJs.includes("filePath.includes('acek')"), 'mediaServer must recognize acek CDN domains');
  assert.ok(mediaServerJs.includes("Referer: https://odvidhide.com/"), 'mediaServer must forward VidHide referer header');
  assert.ok(mediaServerJs.includes("req.socket?.on('close'"), 'mediaServer must use socket close instead of premature req close');
  console.log('✓ PASS: MediaServer FFmpeg transmux options & header forwarding verified');

  console.log('\n--- TEST 4: Player.js HLS & Transmux Integration ---');
  const playerJs = fs.readFileSync(path.join(__dirname, '../renderer/js/player.js'), 'utf8');
  assert.ok(playerJs.includes("newStreamUrl.includes('.m3u8')"), 'player.js must detect .m3u8 streams');
  assert.ok(playerJs.includes("mode=transmux"), 'player.js must route .m3u8 streams through mediaServer transmuxing');
  console.log('✓ PASS: Player.js HLS detection and transmux routing verified');

  console.log('\n--- TEST 5: Older Anime (Spy x Family Ep 1) Backward Compatibility ---');
  const spyInfo = await otakudesu.getEpisodeStream('https://otakudesu.blog/episode/spxfm-episode-1-sub-indo/');
  assert.ok(spyInfo.streamUrl, 'Spy x Family Ep 1 stream must be resolved');
  assert.ok(!spyInfo.streamUrl.includes('googlevideo.com'), 'Spy x Family Ep 1 must not use dead Google Video');
  console.log('✓ PASS: Spy x Family Ep 1 stream:', spyInfo.streamUrl.slice(0, 70) + '...');

  console.log('\n==================================================');
  console.log('🎉 ALL SLIME S4 & MIRROR FALLBACK TESTS PASSED!');
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

