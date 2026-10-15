const assert = require('assert');
const path = require('path');
const fs = require('fs');
const extractorService = require('../main/extractorService');
const libraryService = require('../main/libraryService');

async function runTests() {
  console.log('=== TEST SUITE: EXTRACTOR SERVICE & FOLDER SEPARATION ===\n');

  // Test 1: isArchive detection
  console.log('[1/4] Verifikasi deteksi format arsip...');
  assert.strictEqual(extractorService.isArchive('anime.rar'), true);
  assert.strictEqual(extractorService.isArchive('anime.zip'), true);
  assert.strictEqual(extractorService.isArchive('anime.7z'), true);
  assert.strictEqual(extractorService.isArchive('anime.tar'), true);
  assert.strictEqual(extractorService.isArchive('anime.mp4'), false);
  assert.strictEqual(extractorService.isArchive('anime.mkv'), false);
  console.log('  ✓ Ekstensi .rar, .zip, .7z, .tar terdeteksi sebagai arsip; .mp4/.mkv tidak.\n');

  // Test 2: Folder Separation
  console.log('[2/4] Verifikasi pemisahan folder Beranda (Library) dan Web (Downloads)...');
  const libPath = libraryService.getLibraryPath();
  const dlPath = libraryService.getDownloadPath();
  console.log(`  Library Path (Beranda): ${libPath}`);
  console.log(`  Download Path (Web Downloads): ${dlPath}`);
  assert.notStrictEqual(libPath, dlPath, 'Folder Beranda dan Folder Download harus terpisah secara default');
  console.log('  ✓ Folder unduhan web terpisah dari folder lokal Beranda.\n');

  // Test 3: scanLibrary vs scanDownloads
  console.log('[3/4] Verifikasi scanLibrary vs scanDownloads...');
  const libScan = libraryService.scanLibrary();
  const dlScan = libraryService.scanDownloads();
  console.log(`  Beranda library path: ${libScan.libraryPath}`);
  console.log(`  Web downloads path: ${dlScan.libraryPath}`);
  assert.strictEqual(libScan.libraryPath, libPath);
  assert.strictEqual(dlScan.libraryPath, dlPath);
  console.log('  ✓ scanLibrary memindai folder lokal; scanDownloads memindai folder download.\n');

  // Test 4: ExtractorService findVideoFiles
  console.log('[4/4] Verifikasi findVideoFiles pada ExtractorService...');
  const sampleDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
  fs.writeFileSync(path.join(sampleDir, 'ep02.mkv'), 'dummy');
  fs.writeFileSync(path.join(sampleDir, 'ep01.mp4'), 'dummy');
  fs.writeFileSync(path.join(sampleDir, 'readme.txt'), 'dummy');

  const found = extractorService.findVideoFiles(sampleDir);
  console.log('  Found files:', found.map(f => path.basename(f)));
  assert.strictEqual(found.length, 2);
  assert.strictEqual(path.basename(found[0]), 'ep01.mp4');
  assert.strictEqual(path.basename(found[1]), 'ep02.mkv');

  // Cleanup fixture
  fs.unlinkSync(path.join(sampleDir, 'ep02.mkv'));
  fs.unlinkSync(path.join(sampleDir, 'ep01.mp4'));
  fs.unlinkSync(path.join(sampleDir, 'readme.txt'));
  fs.rmdirSync(sampleDir);
  console.log('  ✓ findVideoFiles berhasil mendeteksi dan mengurutkan file video secara natural.\n');

  console.log('=== SEMUA 4 PENGUJIAN EXTRACTOR & FOLDER SEPARATION LULUS! ===');
}

runTests().catch(err => {
  console.error('❌ Test gagal:', err);
  process.exit(1);
});

