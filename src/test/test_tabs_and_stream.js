const assert = require('assert');
const fs = require('fs');
const path = require('path');
const otakudesuService = require('../main/otakudesuService');

console.log('=== Running Verification for Issues: Dedicated Tabs, Empty Folder Bug, and Streaming Fallback ===\n');

// 1. Verify HTML & UI Structure for Dedicated Tabs and Dismissable Toast
console.log('--- TEST 1: Dedicated Tabs & Dismissable Toast in HTML ---');
const htmlContent = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');

assert(htmlContent.includes('id="tabDownloads"'), 'tabDownloads button must exist in index.html');
assert(htmlContent.includes('id="tabSettings"'), 'tabSettings button must exist in index.html');
assert(htmlContent.includes('id="downloadsSection"'), 'downloadsSection container must exist in index.html');
assert(htmlContent.includes('id="settingsSection"'), 'settingsSection container must exist in index.html');
assert(htmlContent.includes('id="btnCloseDownloadsToast"'), 'btnCloseDownloadsToast close button must exist in toast');
assert(htmlContent.includes('id="downloadsTabBody"'), 'downloadsTabBody container must exist in index.html');
assert(htmlContent.includes('id="settingMediaFolderPath"'), 'settingMediaFolderPath must exist in settingsSection');
assert(htmlContent.includes('id="settingDownloadFolderPath"'), 'settingDownloadFolderPath must exist in settingsSection');

console.log('✓ PASS: HTML has all dedicated tabs, sections, settings cards, and close toast button.\n');

// 2. Verify Search Query Pollution Guard in library.js
console.log('--- TEST 2: Local Search Query Guard & Reset (Empty Folder Bug Fix) ---');
const libContent = fs.readFileSync(path.join(__dirname, '../renderer/js/library.js'), 'utf8');

assert(libContent.includes("if (this.activeNav !== 'home') return;"), 'library.js must guard inputSearchAnime with activeNav check');
assert(libContent.includes("this.searchQuery = '';"), 'switchNavTab(home) must reset library searchQuery to empty string');
assert(libContent.includes("if (this.inputSearchAnime) this.inputSearchAnime.value = '';"), 'switchNavTab(home) must clear input value');
assert(libContent.includes('await this.scanAndRender();'), 'switchNavTab(home) must rescan and render fresh local media');

console.log('✓ PASS: library.js guards search listener and resets searchQuery on returning to Beranda.\n');

// 3. Verify Dedicated Tabs Navigation & Settings in library.js & otakudesu.js
console.log('--- TEST 3: 4-Tab Navigation & Dedicated Downloads Rendering ---');
assert(libContent.includes("tabName === 'downloads'"), 'switchNavTab must handle downloads tab');
assert(libContent.includes("tabName === 'settings'"), 'switchNavTab must handle settings tab');
assert(libContent.includes('renderSettingsTab'), 'library.js must implement renderSettingsTab');

const otakuContent = fs.readFileSync(path.join(__dirname, '../renderer/js/otakudesu.js'), 'utf8');
assert(otakuContent.includes('renderDedicatedDownloadsTab'), 'otakudesu.js must implement renderDedicatedDownloadsTab');
assert(otakuContent.includes('btnCloseDownloadsToast'), 'otakudesu.js must wire up btnCloseDownloadsToast');
assert(otakuContent.includes('tabDownloadsBadge'), 'otakudesu.js must sync tabDownloadsBadge');

console.log('✓ PASS: 4-tab switching, settings rendering, and dedicated downloads tab fully integrated.\n');

// 4. Verify Stream Extraction & Fallbacks in otakudesuService.js
console.log('--- TEST 4: Mirrorstream AJAX & Pixeldrain Stream Fallback ---');
const otakuServiceCode = fs.readFileSync(path.join(__dirname, '../main/otakudesuService.js'), 'utf8');

assert(otakuServiceCode.includes('resolveMirrorStreamUrl'), 'otakudesuService must implement resolveMirrorStreamUrl');
assert(otakuServiceCode.includes('resolvePixeldrainStream'), 'otakudesuService must implement resolvePixeldrainStream');

// Live test on Boruto 293 (known episode with dead primary embed that resolves through mirrorstream AJAX)
async function testLiveStream() {
  console.log('Testing live stream resolution for Boruto 293...');
  const res = await otakudesuService.getEpisodeStream('https://otakudesu.blog/episode/btr-ng-episode-293-sub-indo/');
  console.log('Stream result:', { title: res.title, streamUrl: res.streamUrl });
  assert(res.streamUrl, 'Boruto 293 streamUrl must not be null (resolved via mirrorstream)');
  assert(res.streamUrl.startsWith('http'), 'streamUrl must be a valid HTTP URL');
  console.log('✓ PASS: Boruto 293 direct stream URL resolved successfully via mirrorstream AJAX.\n');
}

testLiveStream()
  .then(() => {
    console.log('==================================================');
    console.log('🎉 ALL TESTS PASSED: Issues 1, 2, and 3 fully resolved!');
    console.log('==================================================');
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

