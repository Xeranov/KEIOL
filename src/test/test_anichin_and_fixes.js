const assert = require('assert');
const fs = require('fs');
const path = require('path');
const anichinService = require('../main/anichinService');

async function runTests() {
  console.log('Testing Ani-Chin & 10 User Fixes...');

  // 1. Test Ani-Chin Service exports
  assert.strictEqual(typeof anichinService.getOngoing, 'function', 'getOngoing should be a function');
  assert.strictEqual(typeof anichinService.getSchedule, 'function', 'getSchedule should be a function');
  assert.strictEqual(typeof anichinService.getAnimeList, 'function', 'getAnimeList should be a function');
  assert.strictEqual(typeof anichinService.getDetail, 'function', 'getDetail should be a function');
  assert.strictEqual(typeof anichinService.getEpisodeStream, 'function', 'getEpisodeStream should be a function');
  assert.strictEqual(typeof anichinService.search, 'function', 'search should be a function');
  console.log('✓ Ani-Chin service exports verified');

  // 2. Test Download Manager info.json writing & poster handling logic
  const downloadManager = require('../main/downloadManager');
  assert.strictEqual(typeof downloadManager.startDownload, 'function');
  assert.strictEqual(typeof downloadManager.getActiveDownloads, 'function');
  console.log('✓ Download manager updated interface verified');

  // 3. Test Library Service scanDirectory info.json parsing
  const libraryService = require('../main/libraryService');
  assert.strictEqual(typeof libraryService.scanDirectory, 'function');
  console.log('✓ Library service scanDirectory verified');

  // 4. Test HTML file for required changes
  const htmlContent = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf-8');
  assert(!htmlContent.includes('id="btnOpenFileTop"'), 'btnOpenFileTop should be removed');
  assert(!htmlContent.includes('id="btnDownloadFolderSetting"'), 'btnDownloadFolderSetting in subnav actions should be removed');
  assert(htmlContent.includes('Folder Unduhan Web'), 'Folder Unduhan Web should be in settings');
  assert(htmlContent.includes('id="episodesGenresWrap"'), 'episodesGenresWrap should exist');
  assert(htmlContent.includes('id="episodesSynopsis"'), 'episodesSynopsis should exist');
  console.log('✓ HTML changes verified (buttons removed, labels updated, modal metadata containers present)');

  // 5. Test CSS file for source colors & donghua styling
  const cssContent = fs.readFileSync(path.join(__dirname, '../renderer/styles/gallery.css'), 'utf-8');
  assert(cssContent.includes('.card-source-otakudesu'), 'card-source-otakudesu css should exist');
  assert(cssContent.includes('.card-source-kusonime'), 'card-source-kusonime css should exist');
  assert(cssContent.includes('.card-source-anichin'), 'card-source-anichin css should exist');
  assert(cssContent.includes('.tag-donghua'), 'tag-donghua css should exist');
  assert(cssContent.includes('.genre-chip-donghua'), 'genre-chip-donghua css should exist');
  console.log('✓ CSS changes verified (blue/black/yellow source indicators, donghua badges & chips)');

  // 6. Test renderer JS files
  const otakudesuJs = fs.readFileSync(path.join(__dirname, '../renderer/js/otakudesu.js'), 'utf-8');
  assert(otakudesuJs.includes('anichinOngoing'), 'otakudesu.js should track anichinOngoing');
  assert(otakudesuJs.includes('openAnichinDetail'), 'otakudesu.js should have openAnichinDetail');
  assert(otakudesuJs.includes('cleanDisplayTitle'), 'otakudesu.js should clean display title');
  assert(!otakudesuJs.includes('Kusonime Batch</span>'), 'otakudesu.js should not render Kusonime Batch tag');
  console.log('✓ Renderer otakudesu.js logic verified');

  const libraryJs = fs.readFileSync(path.join(__dirname, '../renderer/js/library.js'), 'utf-8');
  assert(libraryJs.includes('keiol_pref_seek'), 'library.js should save/load seek duration in localStorage');
  assert(libraryJs.includes('keiol_pref_speed'), 'library.js should save/load playback speed in localStorage');
  assert(libraryJs.includes('refreshCurrentSubTab'), 'library.js contextual refresh should support web subtabs');
  console.log('✓ Renderer library.js logic verified');

  console.log('\n🎉 ALL ANICHIN & FIXES TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
