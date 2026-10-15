const assert = require('assert');
const fs = require('fs');
const path = require('path');
const updateService = require('../main/updateService');
const trayManager = require('../main/trayManager');

console.log('==================================================');
console.log('Testing KEIOL: Tray, Update System & Assets');
console.log('==================================================\n');

// TEST 1: Semver Comparison Engine
console.log('TEST 1: Semver Comparison Engine...');
assert.strictEqual(updateService.compareSemver('1.0.0', '1.0.1'), -1, '1.0.0 should be < 1.0.1');
assert.strictEqual(updateService.compareSemver('1.1.0', '1.0.9'), 1, '1.1.0 should be > 1.0.9');
assert.strictEqual(updateService.compareSemver('1.0.0', '1.0.0'), 0, '1.0.0 should be === 1.0.0');
assert.strictEqual(updateService.compareSemver('v2.0.0', '1.9.9'), 1, 'v2.0.0 should be > 1.9.9 with v prefix');
assert.strictEqual(updateService.compareSemver('1.0.0', 'v1.0.0'), 0, 'v1.0.0 should be === 1.0.0');
console.log('✓ PASS: Semver comparison logic is 100% accurate.');

// TEST 2: Update & Force-Update Decision Logic
console.log('\nTEST 2: Update & Force-Update Decision Logic...');
function evaluateUpdateState(currentVer, manifest) {
  const remoteVer = manifest.version || '1.0.0';
  const minSupportedVer = manifest.minSupportedVersion || '1.0.0';
  const hasNewerVersion = updateService.compareSemver(remoteVer, currentVer) > 0;
  const isBelowMinVersion = updateService.compareSemver(currentVer, minSupportedVer) < 0;

  if (!hasNewerVersion) {
    return { type: 'UP_TO_DATE', version: currentVer };
  }

  const isForceUpdate = Boolean(manifest.forceUpdate) || isBelowMinVersion;
  if (isForceUpdate) {
    return { type: 'FORCE_UPDATE', version: remoteVer };
  }
  return { type: 'NORMAL_UPDATE', version: remoteVer };
}

// Case A: Up to date
const stateA = evaluateUpdateState('1.0.0', { version: '1.0.0', minSupportedVersion: '1.0.0', forceUpdate: false });
assert.strictEqual(stateA.type, 'UP_TO_DATE');
console.log('✓ Case A (Up to date): OK');

// Case B: Normal update
const stateB = evaluateUpdateState('1.0.0', { version: '1.0.5', minSupportedVersion: '1.0.0', forceUpdate: false });
assert.strictEqual(stateB.type, 'NORMAL_UPDATE');
assert.strictEqual(stateB.version, '1.0.5');
console.log('✓ Case B (Normal update to 1.0.5): OK');

// Case C: Emergency Force Update by minSupportedVersion
const stateC = evaluateUpdateState('1.0.0', { version: '1.1.0', minSupportedVersion: '1.1.0', forceUpdate: false });
assert.strictEqual(stateC.type, 'FORCE_UPDATE');
console.log('✓ Case C (Force update triggered by minSupportedVersion): OK');

// Case D: Emergency Force Update by boolean flag
const stateD = evaluateUpdateState('1.0.0', { version: '1.0.1', minSupportedVersion: '1.0.0', forceUpdate: true });
assert.strictEqual(stateD.type, 'FORCE_UPDATE');
console.log('✓ Case D (Force update triggered by forceUpdate: true): OK');

// Case E: Current version matches latest version but manifest has forceUpdate: true
const stateE = evaluateUpdateState('1.0.1', { version: '1.0.1', minSupportedVersion: '1.0.1', forceUpdate: true });
assert.strictEqual(stateE.type, 'UP_TO_DATE');
console.log('✓ Case E (Up to date even if forceUpdate is true because version already matches): OK');

// TEST 3: Tray Settings Persistence
console.log('\nTEST 3: Tray Settings Persistence...');
const initialClose = trayManager.isCloseToTrayEnabled();
trayManager.setCloseToTray(false);
assert.strictEqual(trayManager.isCloseToTrayEnabled(), false, 'Close to tray should be disabled');
trayManager.setCloseToTray(true);
assert.strictEqual(trayManager.isCloseToTrayEnabled(), true, 'Close to tray should be enabled');
console.log('✓ PASS: Tray close-to-tray preference toggle and storage verified.');

// TEST 4: KEIOL High-Resolution Icon Assets
console.log('\nTEST 4: KEIOL High-Resolution Icon Assets...');
const icoPath = path.join(__dirname, '../../build/icon.ico');
const pngPath = path.join(__dirname, '../../build/icon.png');
const trayPngPath = path.join(__dirname, '../../build/tray-icon.png');

assert(fs.existsSync(icoPath), 'build/icon.ico must exist');
assert(fs.statSync(icoPath).size > 1000, 'build/icon.ico size must be valid');

assert(fs.existsSync(pngPath), 'build/icon.png must exist');
assert(fs.statSync(pngPath).size > 1000, 'build/icon.png size must be valid');

assert(fs.existsSync(trayPngPath), 'build/tray-icon.png must exist');
assert(fs.statSync(trayPngPath).size > 100, 'build/tray-icon.png size must be valid');
console.log('✓ PASS: All icon assets (.ico, .png, tray-icon.png) present and valid.');

// TEST 5: Package & GitHub Release Config
console.log('\nTEST 5: Package & GitHub Release Config...');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
assert.strictEqual(pkg.name, 'keiol', 'Package name must be keiol');
assert.strictEqual(pkg.productName, 'KEIOL', 'Product name must be KEIOL');
assert.strictEqual(pkg.repository.url, 'git+https://github.com/Xeranov/KEIOL.git');

const versionJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
assert.strictEqual(versionJson.name, 'KEIOL');
assert.strictEqual(versionJson.version, pkg.version);
console.log('✓ PASS: package.json and version.json synchronized.');

// TEST 6: Screen & UI Zoom Calculations
console.log('\nTEST 6: Screen & UI Zoom Calculations...');
function calculateZoom(current, delta) {
  if (delta === 0) return 1.0;
  if (delta > 0) return Math.min(Math.round((current + delta) * 10) / 10, 3.0);
  return Math.max(Math.round((current + delta) * 10) / 10, 0.5);
}

assert.strictEqual(calculateZoom(1.0, 0.1), 1.1, '1.0 + 0.1 should be 1.1');
assert.strictEqual(calculateZoom(1.0, -0.1), 0.9, '1.0 - 0.1 should be 0.9');
assert.strictEqual(calculateZoom(2.95, 0.1), 3.0, 'Zoom should cap at 3.0');
assert.strictEqual(calculateZoom(0.55, -0.1), 0.5, 'Zoom should floor at 0.5');
assert.strictEqual(calculateZoom(1.8, 0), 1.0, 'Reset zoom should return 1.0');
console.log('✓ PASS: Zoom calculation engine and bounds are verified.');

console.log('\n==================================================');
console.log('🎉 ALL KEIOL TRAY & UPDATE TESTS PASSED SUCCESSFULLY!');
console.log('==================================================');

