const assert = require('assert');
const aniSkipService = require('../main/aniSkipService');

async function testAniSkipValidation() {
  console.log('Testing AniSkipService Episode Parsing & Redundant Validation...');

  // Test 1: Title parsing on real Otakudesu & batch titles
  const t1 = aniSkipService.parseTitleAndSeason('Death Note BD (Episode 1 &#8211; 37) Subtitle Indonesia');
  console.log('T1 (Death Note):', t1);
  assert.strictEqual(t1.baseTitle.toLowerCase().includes('death note'), true);
  assert.strictEqual(t1.baseTitle.includes('8211'), false, 'Should not contain HTML entity 8211');
  assert.strictEqual(t1.baseTitle.includes('37'), false, 'Should strip batch episode range');

  const t2 = aniSkipService.parseTitleAndSeason('Toradora! BD (Episode 1 &#8211; 25) Subtitle Indonesia + OVA');
  console.log('T2 (Toradora):', t2);
  assert.strictEqual(t2.baseTitle.toLowerCase().includes('toradora'), true);
  assert.strictEqual(t2.baseTitle.includes('25'), false, 'Should strip batch episode range');
  assert.strictEqual(t2.baseTitle.includes('OVA'), false, 'Should strip OVA label from series title');

  const t3 = aniSkipService.parseTitleAndSeason('Jujutsu Kaisen 2nd Season Subtitle Indonesia');
  console.log('T3 (Jujutsu Kaisen 2nd Season):', t3);
  assert.strictEqual(t3.season, 2);
  assert.strictEqual(t3.normalizedSeasonTitle, 'Jujutsu Kaisen Season 2');

  const t4 = aniSkipService.parseTitleAndSeason('Bleach: Sennen Kessen-hen - Ketsubetsu-tan Episode 14 Subtitle Indonesia');
  console.log('T4 (Bleach TYBW):', t4);
  assert.strictEqual(t4.baseTitle.toLowerCase().includes('bleach'), true);
  assert.strictEqual(t4.baseTitle.includes('14'), false, 'Should strip episode 14 from anime title');

  // Test 2: Episode extraction from titles and filenames
  const epCases = [
    { input: '[Judas] Mob Psycho 100 - 03 [1080p][HEVC].mkv', expectedEp: 3 },
    { input: '86 - Eighty Six - 04 [1080p].mkv', expectedEp: 4 },
    { input: 'Steins;Gate 0 - 05.mkv', expectedEp: 5 },
    { input: 'Cyberpunk Edgerunners - 01.mkv', expectedEp: 1 },
    { input: 'Death Note Episode 1 Subtitle Indonesia', expectedEp: 1 },
    { input: 'Toradora! Episode 25 Subtitle Indonesia', expectedEp: 25 },
    { input: '[Erai-raws] One Piece - 1089 [1080p].mkv', expectedEp: 1089 },
    { input: 'Shingeki no Kyojin S03E05 - The Town Where Everything Began.mkv', expectedEp: 5 },
    { input: 'Bleach - S01E02.mkv', expectedEp: 2 },
    { input: 'Fate Stay Night UBW - 00 Subtitle Indonesia', expectedEp: 0 },
    { input: 'Fate/stay night UBW Episode 0 Sub Indo', expectedEp: 0 }
  ];

  for (const c of epCases) {
    const epNum = aniSkipService.extractEpisodeNumber(c.input);
    console.log(`Episode parse for "${c.input}" -> ${epNum} (expected ${c.expectedEp})`);
    assert.strictEqual(epNum, c.expectedEp, `Failed for ${c.input}`);
  }

  // Test 3: Redundant Validation of Skip Intervals
  // 3a: Valid 85s OP within bounds of 24min video
  const validOP = aniSkipService.validateSkipIntervals({
    op: { startTime: 90, endTime: 175 }
  }, 1420);
  assert.notStrictEqual(validOP, null);
  assert.strictEqual(validOP.op.startTime, 90);
  assert.strictEqual(validOP.op.endTime, 175);

  // 3b: Bogus duration too short (<30s) or too long (>130s)
  const tooShort = aniSkipService.validateSkipIntervals({
    op: { startTime: 10, endTime: 25 }
  }, 1420);
  assert.strictEqual(tooShort, null, 'Should reject OP < 30s');

  const tooLong = aniSkipService.validateSkipIntervals({
    op: { startTime: 10, endTime: 300 }
  }, 1420);
  assert.strictEqual(tooLong, null, 'Should reject OP > 130s');

  // 3c: Out of bounds (starts after minute 8 for OP)
  const lateOp = aniSkipService.validateSkipIntervals({
    op: { startTime: 800, endTime: 890 }
  }, 1420);
  assert.strictEqual(lateOp, null, 'Should reject OP starting too late in episode');

  // 3d: Exceeds video duration
  const exceedsDuration = aniSkipService.validateSkipIntervals({
    op: { startTime: 100, endTime: 190 }
  }, 150); // video only 150s
  assert.strictEqual(exceedsDuration, null, 'Should reject interval exceeding video duration');

  // 3e: Valid OP and ED non-overlapping with clamping
  const fullSensible = aniSkipService.validateSkipIntervals({
    op: { startTime: 60, endTime: 150 },
    ed: { startTime: 1335, endTime: 1425 }
  }, 1420);
  assert.notStrictEqual(fullSensible, null);
  assert.notStrictEqual(fullSensible.op, null);
  assert.notStrictEqual(fullSensible.ed, null);
  assert.strictEqual(fullSensible.ed.endTime, 1419, 'ED endTime should clamp to videoDuration - 1');

  console.log('✓ All AniSkipService tests passed!');
}

testAniSkipValidation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
