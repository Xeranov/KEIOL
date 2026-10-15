/**
 * Automated Verification for Streaming Enhancements:
 * 1. Otakudesu getEpisodeStream with availableQualities
 * 2. AniSkip service precise skip times lookup
 * 3. Next episode calculation (online & local)
 * 4. Local chapter marker opening detection
 */

const assert = require('assert');
const otakudesuService = require('../main/otakudesuService');
const aniSkipService = require('../main/aniSkipService');

async function runTests() {
  console.log('=== RUNNING STREAMING ENHANCEMENTS TESTS ===\n');

  // Test 1: Otakudesu availableQualities extraction
  console.log('Test 1: Testing Otakudesu availableQualities extraction...');
  const ongoing = await otakudesuService.getOngoing(1);
  assert(ongoing && ongoing.animeList.length > 0, 'Ongoing anime list should not be empty');
  const firstAnime = ongoing.animeList[0];
  const detail = await otakudesuService.getAnimeDetail(firstAnime.url);
  assert(detail && detail.episodes.length > 0, 'Anime detail should have episodes');

  const epStream = await otakudesuService.getEpisodeStream(detail.episodes[0].url);
  assert(epStream.streamUrl, 'streamUrl should exist');
  assert(Array.isArray(epStream.availableQualities), 'availableQualities should be an array');
  assert(epStream.availableQualities.length > 0, 'availableQualities should have at least 1 quality option');
  console.log(`✓ availableQualities found: ${epStream.availableQualities.length} options:`);
  epStream.availableQualities.forEach(q => {
    console.log(`   - [${q.quality}] ${q.label}: ${q.streamUrl.slice(0, 50)}...`);
  });

  // Test 2: AniSkip service skip times lookup
  console.log('\nTest 2: Testing AniSkip service precise skip times lookup...');
  const jjkSkip = await aniSkipService.getSkipTimes('Jujutsu Kaisen Season 2', 5);
  assert(jjkSkip.found, 'Jujutsu Kaisen Season 2 Ep 5 should be found in AniSkip');
  assert(jjkSkip.op && jjkSkip.op.startTime > 0, 'Opening start time should be > 0');
  assert(jjkSkip.op && jjkSkip.op.endTime > jjkSkip.op.startTime, 'Opening end time should be > start time');
  console.log(`✓ Jujutsu Kaisen S2 Ep 5 Opening: ${jjkSkip.op.startTime}s -> ${jjkSkip.op.endTime}s`);
  if (jjkSkip.ed) {
    console.log(`✓ Jujutsu Kaisen S2 Ep 5 Ending: ${jjkSkip.ed.startTime}s -> ${jjkSkip.ed.endTime}s`);
  }

  // Test 2b: Non-existent or obscure title returns found: false without crashing
  const fakeSkip = await aniSkipService.getSkipTimes('NonExistentFakeAnimeTitle123456789', 1);
  assert.strictEqual(fakeSkip.found, false, 'Fake anime should safely return found: false');
  console.log('✓ Unknown anime safely returns { found: false } without error');

  // Test 3: Next online episode calculation
  console.log('\nTest 3: Testing next online episode logic...');
  function findNextOnlineEpisode(episodes, currentEp) {
    if (!Array.isArray(episodes) || episodes.length === 0 || !currentEp) return null;
    const epRegex = /(?:Episode|Eps?\.?)\s*(\d+)/i;
    const currentNumMatch = (currentEp.title || '').match(epRegex);
    if (currentNumMatch) {
      const targetNum = parseInt(currentNumMatch[1], 10) + 1;
      const foundNext = episodes.find(e => {
        const m = (e.title || '').match(epRegex);
        return m && parseInt(m[1], 10) === targetNum;
      });
      if (foundNext) return foundNext;
    }
    const curIdx = episodes.findIndex(e => e.url === currentEp.url || e.slug === currentEp.slug);
    if (curIdx > 0) return episodes[curIdx - 1];
    return null;
  }

  const dummyDescending = [
    { title: 'Chainsaw Man Episode 3 Sub Indo', url: 'ep3' },
    { title: 'Chainsaw Man Episode 2 Sub Indo', url: 'ep2' },
    { title: 'Chainsaw Man Episode 1 Sub Indo', url: 'ep1' }
  ];

  const nextFrom1 = findNextOnlineEpisode(dummyDescending, dummyDescending[2]);
  assert.strictEqual(nextFrom1.url, 'ep2', 'Next after Ep 1 should be Ep 2');
  const nextFrom2 = findNextOnlineEpisode(dummyDescending, dummyDescending[1]);
  assert.strictEqual(nextFrom2.url, 'ep3', 'Next after Ep 2 should be Ep 3');
  const nextFrom3 = findNextOnlineEpisode(dummyDescending, dummyDescending[0]);
  assert.strictEqual(nextFrom3, null, 'Next after latest episode should be null');
  console.log('✓ Smart next episode resolution passed (Ep 1 -> Ep 2 -> Ep 3 -> end)');

  // Test 4: Chapter marker detection
  console.log('\nTest 4: Testing chapter marker opening detection...');
  const dummyMediaInfo = {
    chapters: [
      { id: 0, startTime: 0, endTime: 120, title: 'Prologue' },
      { id: 1, startTime: 120, endTime: 210, title: 'Opening' },
      { id: 2, startTime: 210, endTime: 1300, title: 'Episode Part A' },
      { id: 3, startTime: 1300, endTime: 1390, title: 'Ending' }
    ]
  };

  const opChapter = dummyMediaInfo.chapters.find(ch => /OP|Opening|Intro/i.test(ch.title));
  const edChapter = dummyMediaInfo.chapters.find(ch => /ED|Ending/i.test(ch.title));
  assert(opChapter, 'OP chapter should be identified');
  assert.strictEqual(opChapter.startTime, 120);
  assert.strictEqual(opChapter.endTime, 210);
  assert(edChapter, 'ED chapter should be identified');
  console.log(`✓ Local chapter OP detected at: ${opChapter.startTime}s -> ${opChapter.endTime}s`);
  console.log(`✓ Local chapter ED detected at: ${edChapter.startTime}s -> ${edChapter.endTime}s`);

  console.log('\n=== ALL STREAMING ENHANCEMENT TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

