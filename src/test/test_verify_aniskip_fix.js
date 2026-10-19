const aniSkipService = require('../main/aniSkipService');

(async () => {
  console.log('Testing AniSkipService with Black Clover Season 2 & Multi-Season resolution...');
  
  // Test 1: Black Clover Season 2 (MAL ID 61967) has no AniSkip timestamps yet.
  // It must accurately return found: false without falling back to Season 1 / Ep 52 timestamps.
  const res1 = await aniSkipService.getSkipTimes('Black Clover Season 2 Subtitle Indonesia', 1);
  console.log('Test 1 (Black Clover S2 Ep 1):', res1);
  if (res1.found) {
    console.error('FAIL: Test 1 should not return bogus skip times for Black Clover Season 2!');
    process.exit(1);
  }
  if (res1.malId !== 61967) {
    console.error('FAIL: Test 1 should resolve to Black Clover Season 2 MAL ID 61967, got:', res1.malId);
    process.exit(1);
  }
  console.log('PASS: Test 1 (Black Clover Season 2 properly resolved to MAL 61967 and returns found: false without false OP skips)!');

  // Test 2: Jujutsu Kaisen Season 2 Ep 1 (separate MAL ID 51009 with valid AniSkip data)
  const res2 = await aniSkipService.getSkipTimes('Jujutsu Kaisen Season 2', 1);
  console.log('Test 2 (JJK S2 Ep 1):', res2);
  if (!res2.found || res2.malId !== 51009 || !res2.op) {
    console.error('FAIL: Test 2 failed!');
    process.exit(1);
  }
  console.log('PASS: Test 2 passed (JJK Season 2 has valid OP & ED)!');

  // Test 3: Original Black Clover Season 1 Episode 1
  const res3 = await aniSkipService.getSkipTimes('Black Clover', 1);
  console.log('Test 3 (Black Clover Ep 1):', res3);
  if (!res3.found || res3.malId !== 34572 || !res3.op) {
    console.error('FAIL: Test 3 failed!');
    process.exit(1);
  }
  console.log('PASS: Test 3 passed (Original Black Clover series has valid MAL 34572 skip)!');

  console.log('ALL ANISKIP UNIT TESTS PASSED!');
})();
