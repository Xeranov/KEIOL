/**
 * Automated Test: Instant Autoplay Next Episode Verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function testAutoplayImplementation() {
  console.log('Testing Instant Autoplay Next Episode (No Cooldown)...');

  const libraryJsPath = path.join(__dirname, '../renderer/js/library.js');
  const libraryContent = fs.readFileSync(libraryJsPath, 'utf8');

  // 1. Verify playInstantNextEpisode method exists
  assert(libraryContent.includes('playInstantNextEpisode(nextEpisode'), 'playInstantNextEpisode method must be defined');

  // 2. Verify handleEpisodeEnded uses playInstantNextEpisode instead of starting 5s countdown
  assert(libraryContent.includes('this.playInstantNextEpisode(nextEpisode, true)'), 'Online autoplay must call playInstantNextEpisode');
  assert(libraryContent.includes('this.playInstantNextEpisode(nextEpisode, false)'), 'Local serial autoplay must call playInstantNextEpisode');

  // 3. Verify startNextEpisodeCountdown does not run a 5 second delay timer
  const startCountdownRegex = /startNextEpisodeCountdown\s*\([^\)]*\)\s*\{([\s\S]*?)\}/;
  const match = libraryContent.match(startCountdownRegex);
  assert(match, 'startNextEpisodeCountdown must exist');
  assert(!match[1].includes('setInterval'), 'startNextEpisodeCountdown must not contain setInterval');

  console.log('✓ PASS: Autoplay next episode transition is instant (0s cooldown) without blocking countdown timers.');
}

try {
  testAutoplayImplementation();
  console.log('🎉 All autoplay instant tests passed!\n');
} catch (err) {
  console.error('❌ Autoplay test failed:', err.message);
  process.exit(1);
}

