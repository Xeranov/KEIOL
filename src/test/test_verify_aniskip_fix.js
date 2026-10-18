const aniSkipService = require('../main/aniSkipService');

(async () => {
  console.log('Testing AniSkipService with Black Clover Season 2...');
  
  // Test 1: Black Clover Season 2 Ep 1 (should be continuous Ep 52 -> OP 5.2s - 95.2s)
  const res1 = await aniSkipService.getSkipTimes('Black Clover Season 2 Subtitle Indonesia', 1);
  console.log('Test 1 (Black Clover S2 Ep 1):', res1);
  if (!res1.found || !res1.op || res1.op.startTime < 4 || res1.op.startTime > 7) {
    console.error('FAIL: Test 1 failed!');
    process.exit(1);
  }
  console.log('PASS: Test 1 (Black Clover S2 Ep 1 has correct OP around 5.2s)!');

  // Test 2: Black Clover Season 2 Ep 2 (should be continuous Ep 53)
  const res2 = await aniSkipService.getSkipTimes('Black Clover Season 2', 2);
  console.log('Test 2 (Black Clover S2 Ep 2):', res2);
  if (!res2.found || !res2.op) {
    console.error('FAIL: Test 2 failed!');
    process.exit(1);
  }
  console.log('PASS: Test 2 passed!');

  // Test 3: Jujutsu Kaisen Season 2 Ep 1 (separate MAL ID 51009)
  const res3 = await aniSkipService.getSkipTimes('Jujutsu Kaisen Season 2', 1);
  console.log('Test 3 (JJK S2 Ep 1):', res3);
  if (!res3.found || res3.malId !== 51009) {
    console.error('FAIL: Test 3 failed!');
    process.exit(1);
  }
  console.log('PASS: Test 3 passed!');

  console.log('ALL ANISKIP UNIT TESTS PASSED!');
})();
