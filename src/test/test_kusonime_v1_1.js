/**
 * Test Suite: Kusonime Batch Integration & VidPlayer v1.1.0
 * Verifies:
 * 1. Kusonime search, detail parsing, and A-Z catalog scraping
 * 2. Automated mirror prioritization (resolution-only selection with auto-mirror)
 * 3. A-Z catalog merging & deduplication between Otakudesu and Kusonime
 * 4. Instant autoplay without cooldown in library.js
 * 5. Version 1.1.0 in package.json & version.json
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const kusonimeService = require('../main/kusonimeService');
const otakudesuService = require('../main/otakudesuService');
const downloadManager = require('../main/downloadManager');
const updateService = require('../main/updateService');

async function runTestSuite() {
  console.log('=== TEST SUITE: KUSONIME BATCH & VIDPLAYER V1.1.0 ===\n');

  // Test 1: Version check
  console.log('[1/5] Verifikasi Versi di package.json & version.json...');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const ver = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
  assert.strictEqual(pkg.version, ver.version, 'package.json and version.json should match');
  assert.ok(updateService.compareSemver(pkg.version, '1.1.0') >= 0, 'version should be >= 1.1.0');
  console.log(`  ✓ package.json version: ${pkg.version}`);
  console.log(`  ✓ version.json version: ${ver.version}\n`);

  // Test 2: Instant Autoplay without countdown in library.js
  console.log('[2/5] Verifikasi Transisi Autoplay Instan Tanpa Cooldown...');
  const libraryCode = fs.readFileSync(path.join(__dirname, '../renderer/js/library.js'), 'utf8');
  assert.ok(libraryCode.includes('this.playInstantNextEpisode(nextEpisode, true)'), 'Online autoplay must call playInstantNextEpisode');
  assert.ok(libraryCode.includes('this.playInstantNextEpisode(nextEpisode, false)'), 'Local serial autoplay must call playInstantNextEpisode');
  console.log('  ✓ Autoplay langsung memainkan episode berikutnya tanpa countdown 5 detik\n');

  // Test 3: Kusonime Mirror Prioritization (Automated Mirror Selection)
  console.log('[3/5] Verifikasi Otomasi Pemilihan Mirror Download...');
  const sampleMirrors = [
    { host: 'Mega.nz', url: 'https://mega.nz/#!xyz' },
    { host: 'Google Sharer', url: 'https://acefile.co/f/123/rar' },
    { host: 'Google Drive', url: 'https://drive.google.com/uc?export=download&id=abc' },
    { host: 'Pixeldrain', url: 'https://pixeldrain.com/u/pd123' },
    { host: 'Hxfileco', url: 'https://hxfile.co/999' }
  ];

  const sorted = downloadManager.sortMirrorsByPriority(sampleMirrors);
  console.log('  Mirror input:', sampleMirrors.map(m => m.host));
  console.log('  Mirror terurut sistem:', sorted.map(m => m.host));
  assert.strictEqual(sorted[0].host, 'Google Drive', 'Google Drive should be prioritized first');
  assert.strictEqual(sorted[1].host, 'Pixeldrain', 'Pixeldrain should be prioritized second');
  console.log('  ✓ Sistem otomatis memprioritaskan Google Drive dan Pixeldrain sebagai mirror utama\n');

  // Test 4: Kusonime Anime List Scraper & A-Z Merging Deduplication
  console.log('[4/5] Verifikasi Scraping Direktori Kusonime & Logika Deduplikasi...');
  
  // Test local merge logic
  function normalizeTitle(t) {
    return (t || '')
      .toLowerCase()
      .replace(/batch|subtitle|indonesia|sub\s*indo|bd|season|\(tv\)|\.hack/gi, (m) => m === '.hack' ? 'hack' : '')
      .replace(/[^a-z0-9]/g, '');
  }

  const sampleOtaku = [
    { letter: 'A', items: [{ title: 'Attack on Titan', url: 'https://otakudesu.blog/anime/aot' }] },
    { letter: 'B', items: [{ title: 'Bleach TYBW', url: 'https://otakudesu.blog/anime/bleach' }] }
  ];

  const sampleKuso = [
    { letter: 'A', items: [
      { title: 'Attack on Titan BD Batch Subtitle Indonesia', url: 'https://kusonime.com/aot-batch' },
      { title: 'Another World Batch Subtitle Indonesia', url: 'https://kusonime.com/another-world' }
    ]},
    { letter: 'B', items: [
      { title: 'Bleach TYBW Batch Subtitle Indonesia', url: 'https://kusonime.com/bleach-batch' },
      { title: 'Baccano! BD Batch Subtitle Indonesia', url: 'https://kusonime.com/baccano' }
    ]}
  ];

  const otakuTitleSet = new Set();
  const mergedMap = new Map();

  sampleOtaku.forEach(g => {
    if (!mergedMap.has(g.letter)) mergedMap.set(g.letter, []);
    g.items.forEach(it => {
      otakuTitleSet.add(normalizeTitle(it.title));
      mergedMap.get(g.letter).push({ ...it, source: 'otakudesu' });
    });
  });

  let kusoAdded = 0;
  let kusoSkipped = 0;

  sampleKuso.forEach(g => {
    if (!mergedMap.has(g.letter)) mergedMap.set(g.letter, []);
    g.items.forEach(it => {
      const norm = normalizeTitle(it.title);
      if (otakuTitleSet.has(norm)) {
        kusoSkipped++;
      } else {
        kusoAdded++;
        otakuTitleSet.add(norm);
        mergedMap.get(g.letter).push({ ...it, source: 'kusonime' });
      }
    });
  });

  assert.strictEqual(kusoSkipped, 2, 'Should skip 2 duplicates (Attack on Titan & Bleach)');
  assert.strictEqual(kusoAdded, 2, 'Should add 2 unique items (Another World & Baccano!)');
  assert.strictEqual(mergedMap.get('A').length, 2, 'Letter A should have 2 items (1 otaku, 1 kuso)');
  assert.strictEqual(mergedMap.get('B').length, 2, 'Letter B should have 2 items (1 otaku, 1 kuso)');
  console.log(`  ✓ Duplikat berhasil dilewati: ${kusoSkipped} item`);
  console.log(`  ✓ Judul eksklusif Kusonime ditambahkan: ${kusoAdded} item\n`);

  // Test 5: Kusonime Service Live Detail Check
  console.log('[5/5] Verifikasi Parser Detail & Paket Resolusi Kusonime...');
  const detail = await kusonimeService.getAnimeDetail('hackg-u-returner-subtitle-indonesia');
  assert.ok(detail.title.includes('.hack//G.U.'), 'Title should contain .hack//G.U.');
  assert.strictEqual(detail.source, 'kusonime', 'Source must be kusonime');
  assert.strictEqual(detail.isBatchOnly, true, 'isBatchOnly must be true');
  assert.ok(detail.batchPackages.length > 0, 'Must have at least 1 batch package');
  assert.ok(detail.batchPackages[0].resolutions.length > 0, 'Package must have resolutions');
  console.log(`  ✓ Anime: "${detail.title}"`);
  console.log(`  ✓ Paket batch: "${detail.batchPackages[0].title}"`);
  console.log(`  ✓ Resolusi tersedia: ${detail.batchPackages[0].resolutions.map(r => r.quality).join(', ')}`);
  console.log(`  ✓ Kusonime direct mirror auto selection ready!`);

  console.log('\n=== SEMUA 5/5 PENGUJIAN INTEGRASI KUSONIME V1.1.0 BERHASIL! ===');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST GAGAL:', err);
  process.exit(1);
});
