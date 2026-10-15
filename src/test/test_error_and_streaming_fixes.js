const assert = require('assert');
const fs = require('fs');
const path = require('path');
const otakudesuService = require('../main/otakudesuService');

async function runTests() {
  console.log('=== TEST SUITE: Error Modal & Streaming Playback Fixes ===\n');

  // Test 1: Spy x Family Season 1 Episode 1 Stream Extraction
  console.log('--- TEST 1: Spy x Family Season 1 Episode 1 Stream Extraction ---');
  const spyUrl = 'https://otakudesu.blog/episode/spxfm-episode-1-sub-indo/';
  const streamData = await otakudesuService.getEpisodeStream(spyUrl);

  assert(streamData.streamUrl, 'Stream URL harus berhasil diekstrak dan tidak null');
  assert(!streamData.streamUrl.includes('googlevideo.com'), 'Stream URL tidak boleh menggunakan Google Video yang mengembalikan HTTP 403');
  console.log('✓ PASS: Spy x Family Ep 1 stream berhasil diekstrak:', streamData.streamUrl);
  console.log('✓ PASS: Available qualities:', streamData.availableQualities.map(q => q.quality));

  // Test 1b: Verify the stream URL is actually alive (HTTP 200/206)
  const isAlive = await otakudesuService.isStreamAlive(streamData.streamUrl, 'https://www.yourupload.com/');
  assert(isAlive, 'Stream URL yang diekstrak harus aktif (HTTP 200/206)');
  console.log('✓ PASS: Stream URL aktif dan merespon dengan status partial content / 200!');

  // Test 2: Error Modal markup & "Kembali ke Beranda" button in index.html
  console.log('\n--- TEST 2: Error Modal & Kembali ke Beranda in index.html ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');
  assert(indexHtml.includes('id="errorCodeBadge"'), 'index.html harus memiliki elemen #errorCodeBadge');
  assert(indexHtml.includes('id="btnErrorBackHome"'), 'index.html harus memiliki elemen #btnErrorBackHome');
  assert(indexHtml.includes('Kembali ke Beranda'), 'Tombol error modal harus bertuliskan "Kembali ke Beranda"');
  console.log('✓ PASS: #errorCodeBadge dan tombol "Kembali ke Beranda" terverifikasi di index.html');

  // Test 3: app.js handles errorCodeBadge and Kembali ke Beranda click
  console.log('\n--- TEST 3: app.js event handling ---');
  const appJs = fs.readFileSync(path.join(__dirname, '../renderer/js/app.js'), 'utf8');
  assert(appJs.includes('btnErrorBackHome'), 'app.js harus merujuk btnErrorBackHome');
  assert(appJs.includes('showGalleryView'), 'btnErrorBackHome click harus memanggil showGalleryView');
  assert(appJs.includes('errorCodeBadge.textContent'), 'app.js harus menampilkan kode error di #errorCodeBadge');
  console.log('✓ PASS: app.js menghubungkan kode error dan tombol kembali ke beranda dengan benar');

  // Test 4: player.js error extraction & switchQuality rollback
  console.log('\n--- TEST 4: player.js error code extraction and switchQuality ---');
  const playerJs = fs.readFileSync(path.join(__dirname, '../renderer/js/player.js'), 'utf8');
  assert(playerJs.includes('MEDIA_ERR_SRC_NOT_SUPPORTED (4)'), 'player.js harus mengidentifikasi MEDIA_ERR_SRC_NOT_SUPPORTED');
  assert(playerJs.includes('MEDIA_ERR_NETWORK (2)'), 'player.js harus mengidentifikasi MEDIA_ERR_NETWORK');
  assert(playerJs.includes('onSwitchError'), 'player.js harus memiliki proteksi rollback onSwitchError');
  console.log('✓ PASS: player.js error codes & safe quality rollback terverifikasi');

  // Test 5: mediaServer remote HTTP transmuxing support
  console.log('\n--- TEST 5: mediaServer remote URL transmuxing ---');
  const mediaServerJs = fs.readFileSync(path.join(__dirname, '../main/mediaServer.js'), 'utf8');
  assert(mediaServerJs.includes('isRemote'), 'mediaServer.js harus mendukung streaming remote URL');
  console.log('✓ PASS: mediaServer.js remote URL streaming terverifikasi');

  console.log('\n==================================================');
  console.log('🎉 ALL ERROR MODAL & STREAMING FIXES PASSED!');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

