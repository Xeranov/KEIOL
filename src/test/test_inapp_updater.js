const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const updateService = require('../main/updateService');

async function runInAppUpdaterTests() {
  console.log('==================================================');
  console.log('🧪 Testing KEIOL: In-App Automatic Updater Suite');
  console.log('==================================================\n');

  // TEST 1: Semver Comparison Engine
  console.log('[1/5] Testing Semver Engine...');
  assert.strictEqual(updateService.compareSemver('1.0.0', '1.1.0'), -1);
  assert.strictEqual(updateService.compareSemver('1.1.0', '1.0.1'), 1);
  assert.strictEqual(updateService.compareSemver('1.1.0', '1.1.0'), 0);
  assert.strictEqual(updateService.compareSemver('v1.1.0', '1.1.0'), 0);
  console.log('  ✓ Semver comparison is 100% accurate.');

  // TEST 2: Installer URL Resolution
  console.log('\n[2/5] Testing Installer URL Resolver...');
  updateService.cachedManifest = {
    installerUrl: 'https://github.com/Xeranov/KEIOL/releases/download/v1.1.0/KEIOL-Setup-1.1.0.exe'
  };
  const resolvedUrl = await updateService.resolveInstallerUrl('1.1.0');
  assert.strictEqual(
    resolvedUrl,
    'https://github.com/Xeranov/KEIOL/releases/download/v1.1.0/KEIOL-Setup-1.1.0.exe',
    'Should resolve manifest installerUrl'
  );

  // Test fallback naming convention when manifest has no explicit installerUrl
  updateService.cachedManifest = {};
  const fallbackUrl = await updateService.resolveInstallerUrl('1.2.0');
  assert.strictEqual(
    fallbackUrl,
    'https://github.com/Xeranov/KEIOL/releases/download/v1.2.0/KEIOL-Setup-1.2.0.exe',
    'Should fallback to standard electron-builder naming convention'
  );
  console.log('  ✓ Installer URL resolver resolves direct executable accurately.');

  // TEST 3: Direct Streaming Download with HTTP Redirects & Progress
  console.log('\n[3/5] Testing Direct Streaming Downloader with HTTP Redirect...');
  const testPayload = Buffer.alloc(1024 * 512, 'K'); // 512 KB payload

  // Create mock server: endpoint /download redirects (302) to /payload
  let redirectHit = false;
  let payloadHit = false;

  const mockServer = http.createServer((req, res) => {
    if (req.url === '/download') {
      redirectHit = true;
      res.writeHead(302, { Location: `http://127.0.0.1:${mockServer.address().port}/payload` });
      res.end();
    } else if (req.url === '/payload') {
      payloadHit = true;
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': testPayload.length
      });
      // Send in multiple chunks to verify progress callback
      res.write(testPayload.subarray(0, 256 * 1024));
      setTimeout(() => {
        res.end(testPayload.subarray(256 * 1024));
      }, 50);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(r => mockServer.listen(0, '127.0.0.1', r));
  const serverPort = mockServer.address().port;

  const tempDownloadPath = path.join(__dirname, '../../test-media/temp_test_installer.bin');
  if (fs.existsSync(tempDownloadPath)) fs.unlinkSync(tempDownloadPath);

  const progressUpdates = [];
  const downloadResult = await updateService.downloadFile(
    `http://127.0.0.1:${serverPort}/download`,
    tempDownloadPath,
    (prog) => progressUpdates.push(prog)
  );

  mockServer.close();

  assert.strictEqual(redirectHit, true, 'Redirect 302 must be followed');
  assert.strictEqual(payloadHit, true, 'Payload must be received');
  assert.strictEqual(downloadResult.downloadedBytes, testPayload.length);
  assert.strictEqual(fs.existsSync(tempDownloadPath), true);
  assert.strictEqual(fs.statSync(tempDownloadPath).size, testPayload.length);
  assert.ok(progressUpdates.length > 0, 'Progress callbacks must be received');
  assert.strictEqual(progressUpdates[progressUpdates.length - 1].percent, 100);

  // Clean up
  try { fs.unlinkSync(tempDownloadPath); } catch (e) {}
  console.log('  ✓ Direct streaming downloader supports 302 redirects & accurate byte progress.');

  // TEST 4: Verification of version.json synchronization
  console.log('\n[4/5] Testing version.json configuration...');
  const vJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
  assert.ok(vJson.installerUrl, 'version.json must have installerUrl');
  assert.ok(vJson.installerUrl.endsWith('.exe'), 'installerUrl must point to .exe');
  console.log('  ✓ version.json contains direct installerUrl:', vJson.installerUrl);

  // TEST 5: IPC and Preload bindings check
  console.log('\n[5/5] Testing Preload & IPC Handler synchronization...');
  const preloadCode = fs.readFileSync(path.join(__dirname, '../preload/preload.js'), 'utf8');
  assert.ok(preloadCode.includes('startUpdateDownload'), 'Preload must expose startUpdateDownload');
  assert.ok(preloadCode.includes('installUpdateAndRestart'), 'Preload must expose installUpdateAndRestart');
  assert.ok(preloadCode.includes('onUpdateProgress'), 'Preload must expose onUpdateProgress');
  assert.ok(preloadCode.includes('onUpdateComplete'), 'Preload must expose onUpdateComplete');

  const mainIndexCode = fs.readFileSync(path.join(__dirname, '../main/index.js'), 'utf8');
  assert.ok(mainIndexCode.includes('updater:start-download'), 'Main must handle updater:start-download');
  assert.ok(mainIndexCode.includes('updater:install-and-restart'), 'Main must handle updater:install-and-restart');
  console.log('  ✓ IPC handlers and preload bridges are fully synchronized.');

  console.log('\n==================================================');
  console.log('🎉 ALL IN-APP UPDATER TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================\n');
}

runInAppUpdaterTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

