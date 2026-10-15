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

// 3. Run User Improvements Verification (Fullscreen, Taskbar, 2X Auto-hide, Anime Gallery, Resume)
console.log('\nSTEP 3: Testing User Improvements (Fullscreen, Auto-Hide 2X, Anime Gallery, Resume)...');
const step3 = spawnSync(electronBin, [path.join(__dirname, 'test_improvements.js')], {
  env,
  stdio: 'inherit'
});

if (step3.status !== 0) {
  console.error('\n❌ Step 3 failed with exit code:', step3.status);
  process.exit(step3.status || 1);
}

// 4. Run New Redesign & User Improvements Verification (Top Back button, Explorer folder, Netflix Episode Gallery, Logo, Hide Scrollbar)
console.log('\nSTEP 4: Testing Redesign & User Features (Back button, Explorer integration, Netflix Episode Gallery, YTMusic logo, Hide slider)...');
const step4 = spawnSync(electronBin, [path.join(__dirname, 'test_redesign_features.js')], {
  env,
  stdio: 'inherit'
});

if (step4.status !== 0) {
  console.error('\n❌ Step 4 failed with exit code:', step4.status);
  process.exit(step4.status || 1);
}

// 5. Run Otakudesu, Downloader, and Web Tab Integration Tests
console.log('\nSTEP 5: Testing Otakudesu Scraper & Service...');
const step5a = spawnSync(process.execPath, [path.join(__dirname, 'test_otakudesu_service.js')], {
  stdio: 'inherit'
});
if (step5a.status !== 0) {
  console.error('\n❌ Step 5 (Otakudesu Service) failed with exit code:', step5a.status);
  process.exit(step5a.status || 1);
}

console.log('\nSTEP 6: Testing Download Manager & Download Folder Settings...');
const step5b = spawnSync(process.execPath, [path.join(__dirname, 'test_download_manager.js')], {
  stdio: 'inherit'
});
if (step5b.status !== 0) {
  console.error('\n❌ Step 6 (Download Manager) failed with exit code:', step5b.status);
  process.exit(step5b.status || 1);
}

console.log('\nSTEP 7: Testing Web Tab & Otakudesu Netflix Showcase in Electron...');
const step5c = spawnSync(electronBin, [path.join(__dirname, 'test_web_integration.js')], {
  env,
  stdio: 'inherit'
});
if (step5c.status !== 0) {
  console.error('\n❌ Step 7 (Web Tab Integration) failed with exit code:', step5c.status);
  process.exit(step5c.status || 1);
}

console.log('\nSTEP 8: Testing 5 User Fixes & New Features (Shortcuts, Codecs, Status Drawer, Slider)...');
const step8 = spawnSync(process.execPath, [path.join(__dirname, 'test_new_fixes.js')], {
  stdio: 'inherit'
});
if (step8.status !== 0) {
  console.error('\n❌ Step 8 (New Fixes) failed with exit code:', step8.status);
  process.exit(step8.status || 1);
}

console.log('\nSTEP 9: Testing Error Modal, Debug Codes & Streaming Playback Fixes...');
const step9 = spawnSync(process.execPath, [path.join(__dirname, 'test_error_and_streaming_fixes.js')], {
  stdio: 'inherit'
});
if (step9.status !== 0) {
  console.error('\n❌ Step 9 (Error & Streaming Fixes) failed with exit code:', step9.status);
  process.exit(step9.status || 1);
}

console.log('\nSTEP 10: Testing Slime S4 Mirror Fallback & HLS Transmuxing...');
const step10 = spawnSync(process.execPath, [path.join(__dirname, 'test_slime_and_mirrors.js')], {
  stdio: 'inherit'
});
if (step10.status !== 0) {
  console.error('\n❌ Step 10 (Slime S4 & Mirror Fallback) failed with exit code:', step10.status);
  process.exit(step10.status || 1);
}

console.log('\nSTEP 11: Testing Stream Click Interaction & Loading Feedback...');
const step11 = spawnSync(process.execPath, [path.join(__dirname, 'test_loading_interaction.js')], {
  stdio: 'inherit'
});
if (step11.status !== 0) {
  console.error('\n❌ Step 11 (Loading Interaction) failed with exit code:', step11.status);
  process.exit(step11.status || 1);
}

console.log('\nSTEP 12: Testing KEIOL System Tray, Update Logic & Icon Assets...');
const step12 = spawnSync(process.execPath, [path.join(__dirname, 'test_tray_and_updater.js')], {
  stdio: 'inherit'
});
if (step12.status !== 0) {
  console.error('\n❌ Step 12 (KEIOL Tray & Updater) failed with exit code:', step12.status);
  process.exit(step12.status || 1);
}

console.log('\n==================================================');
console.log('🎉 ALL 12 TEST SUITES PASSED: READY FOR PRODUCTION USE!');
console.log('==================================================');

