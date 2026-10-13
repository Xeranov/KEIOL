const { spawnSync } = require('child_process');
const path = require('path');

console.log('==================================================');
console.log('VidPlayer: Running Full Verification Test Suite');
console.log('==================================================\n');

// 1. Run Core Binaries, Probe, and Media Server tests
console.log('STEP 1: Testing Binaries, Probing, and Stream Server...');
const step1 = spawnSync(process.execPath, [path.join(__dirname, 'verify.js')], {
  stdio: 'inherit'
});

if (step1.status !== 0) {
  console.error('\n❌ Step 1 failed with exit code:', step1.status);
  process.exit(step1.status || 1);
}

// 2. Run Interactive Element Click-Through in Electron
console.log('\nSTEP 2: Testing Electron DOM, Components, and Click-Through...');
const electronBin = path.join(__dirname, '../../node_modules/electron/dist/electron.exe');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const step2 = spawnSync(electronBin, [path.join(__dirname, 'clickthrough_verify.js')], {
  env,
  stdio: 'inherit'
});

if (step2.status !== 0) {
  console.error('\n❌ Step 2 failed with exit code:', step2.status);
  process.exit(step2.status || 1);
}

console.log('\n==================================================');
console.log('🎉 ALL TESTS PASSED: READY FOR PRODUCTION USE!');
console.log('==================================================');
