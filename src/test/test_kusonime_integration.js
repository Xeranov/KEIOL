/**
 * Automated Test: Kusonime Integration & Instant Autoplay Verification
 */

const assert = require('assert');
const kusonimeService = require('../main/kusonimeService');
const downloadManager = require('../main/downloadManager');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Kusonime & Instant Autoplay Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Kusonime Search
  try {
    process.stdout.write('Test 1: Kusonime search functionality... ');
    const results = await kusonimeService.search('vampire');
    assert(Array.isArray(results), 'Hasil pencarian harus berupa array');
    assert(results.length > 0, 'Harus menemukan minimal 1 hasil untuk kata kunci "vampire"');
    
    const first = results[0];
    assert(first.title && first.title.length > 0, 'Judul anime harus ada');
    assert(first.url && first.url.startsWith('http'), 'URL anime harus valid');
    assert(first.slug && first.slug.length > 0, 'Slug anime harus terdefinisi');
    assert.strictEqual(first.source, 'kusonime', 'Source harus kusonime');
    assert.strictEqual(first.isBatchOnly, true, 'isBatchOnly harus true');
    console.log(`✅ PASSED (${results.length} items found)`);
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  // Test 2: Kusonime Detail & Batch Packages Parsing
  try {
    process.stdout.write('Test 2: Kusonime detail & batch packages parsing... ');
    const detail = await kusonimeService.getAnimeDetail('vampire-in-garden-subtitle-indonesia');
    assert(detail, 'Detail anime harus berhasil diambil');
    assert(detail.title && detail.title.length > 0, 'Judul anime harus terisi');
    assert(detail.synopsis && detail.synopsis.length > 20, 'Sinopsis harus terisi');
    assert(Array.isArray(detail.genres) && detail.genres.length > 0, 'Genre harus berupa array berisi tag');
    assert.strictEqual(detail.isBatchOnly, true, 'isBatchOnly harus true');
    assert(Array.isArray(detail.batchPackages), 'batchPackages harus berupa array');
    assert(detail.batchPackages.length > 0, 'Minimal 1 paket batch harus ditemukan');

    const firstPkg = detail.batchPackages[0];
    assert(firstPkg.title && firstPkg.title.length > 0, 'Judul paket batch harus ada');
    assert(Array.isArray(firstPkg.resolutions) && firstPkg.resolutions.length > 0, 'Resolusi paket harus ada');

    const firstRes = firstPkg.resolutions[0];
    assert(firstRes.quality && firstRes.quality.length > 0, 'Label kualitas harus ada (e.g. 360P, 480P)');
    assert(Array.isArray(firstRes.mirrors) && firstRes.mirrors.length > 0, 'Daftar mirror harus ada');
    assert(firstRes.mirrors[0].host && firstRes.mirrors[0].url, 'Host dan URL mirror harus valid');

    console.log(`✅ PASSED (Title: "${detail.title.substring(0, 30)}...", ${detail.batchPackages.length} packages parsed)`);
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  // Test 3: DownloadManager Google Drive Auto-Resolver
  try {
    process.stdout.write('Test 3: DownloadManager Google Drive resolving... ');
    const testGdriveUrl = 'https://drive.google.com/uc?export=download&id=1G5xrXM8fJRKNn2baBRy9KjJPCIjOuEwl';
    const resolved = await downloadManager.resolveDirectDownloadUrl(testGdriveUrl);
    
    assert(resolved, 'Hasil resolving tidak boleh kosong');
    const finalUrl = resolved.url || resolved;
    assert(typeof finalUrl === 'string' && finalUrl.startsWith('http'), 'URL hasil resolve harus valid');
    assert(finalUrl.includes('drive.usercontent.google.com') || finalUrl.includes('drive.google.com'), 'Harus mengarah ke CDN Google Drive');
    console.log(`✅ PASSED (Resolved to: ${finalUrl.substring(0, 50)}...)`);
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  // Test 4: DownloadManager Content-Disposition and Archive Sanitization
  try {
    process.stdout.write('Test 4: DownloadManager filename and extension helper... ');
    const sanitizedTitle = downloadManager.sanitizeFileName('Naruto: Shippuuden [Batch] 720p / 1080p?');
    assert(!/[\\/:*?"<>|]/.test(sanitizedTitle), 'Karakter terlarang harus dibersihkan dari filename');
    assert(sanitizedTitle.includes('Naruto'), 'Judul dasar harus dipertahankan');
    console.log(`✅ PASSED (Sanitized: "${sanitizedTitle}")`);
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`📊 Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

