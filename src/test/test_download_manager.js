const downloadManager = require('../main/downloadManager');
const libraryService = require('../main/libraryService');
const fs = require('fs');
const path = require('path');

async function testDownloadManager() {
  console.log('Testing DownloadManager & Download Path settings...');

  // 1. Check download path settings
  const currentPath = libraryService.getDownloadPath();
  console.log(`✓ Current download path: "${currentPath}"`);
  if (!currentPath) {
    throw new Error('Download path is undefined or empty');
  }

  // 2. Test sanitize file name
  const safeName = downloadManager.sanitizeFileName('Naruto: Shippuuden [Eps 01/24] *HD*?');
  console.log(`✓ Sanitized name: "${safeName}"`);
  if (/[\\/:*?"<>|]/.test(safeName)) {
    throw new Error('SanitizeFileName did not remove invalid path characters');
  }

  // 3. Test resolve direct URL
  const testPixelUrl = 'https://pixeldrain.com/u/abc123xy';
  const resolved = await downloadManager.resolveDirectDownloadUrl(testPixelUrl);
  console.log(`✓ Resolved Pixeldrain API: "${resolved}"`);
  if (resolved !== 'https://pixeldrain.com/api/file/abc123xy') {
    throw new Error(`Expected direct pixeldrain API url, got: ${resolved}`);
  }

  // 4. Test speed formatting
  const speed = downloadManager.formatSpeed(2.5 * 1024 * 1024);
  console.log(`✓ Formatted speed (2.5MB/s): "${speed}"`);
  if (speed !== '2.5 MB/s') {
    throw new Error(`Expected '2.5 MB/s', got: ${speed}`);
  }

  // 5. Test online history save & load
  libraryService.saveOnlineProgress(
    'test-anime-slug',
    'Test Anime',
    'https://otakudesu.blog/episode/test-ep-1',
    'Episode 1',
    420,
    1400,
    'https://example.com/poster.jpg'
  );

  const history = libraryService.getOnlineHistory();
  console.log('✓ Online history recorded:', Boolean(history['test-anime-slug']));
  const ep = history['test-anime-slug'] && history['test-anime-slug'].episodes['https://otakudesu.blog/episode/test-ep-1'];
  if (!ep || ep.currentTime !== 420) {
    throw new Error('Online history progress was not saved accurately');
  }
  console.log(`  Episode 1 progress: ${ep.currentTime}/${ep.duration}s (${Math.round((ep.currentTime/ep.duration)*100)}%)`);

  console.log('Semua pengujian DownloadManager & Settings berhasil!');
}

testDownloadManager().catch(err => {
  console.error('Error saat testing download manager:', err);
  process.exit(1);
});

