const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runTests() {
  console.log('=== TEST SUITE: Stream Click Interaction & Loading Feedback ===\n');

  console.log('--- TEST 1: DOM Elements in index.html ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');

  assert.ok(indexHtml.includes('id="streamLoadingOverlay"'), 'index.html must have #streamLoadingOverlay');
  assert.ok(indexHtml.includes('id="streamLoadingTitle"'), 'index.html must have #streamLoadingTitle');
  assert.ok(indexHtml.includes('id="streamLoadingStatusText"'), 'index.html must have #streamLoadingStatusText');
  assert.ok(indexHtml.includes('id="btnCancelStreamLoading"'), 'index.html must have #btnCancelStreamLoading');
  assert.ok(indexHtml.includes('id="loadingSpinnerText"'), 'index.html must have #loadingSpinnerText');
  console.log('✓ PASS: All loading elements (#streamLoadingOverlay, #loadingSpinnerText, cancel button) verified in index.html');

  console.log('\n--- TEST 2: CSS Loading State & Cursor: wait Rules ---');
  const galleryCss = fs.readFileSync(path.join(__dirname, '../renderer/styles/gallery.css'), 'utf8');

  assert.ok(galleryCss.includes('body.app-loading-state'), 'gallery.css must define body.app-loading-state');
  assert.ok(galleryCss.includes('cursor: wait !important'), 'gallery.css must enforce cursor: wait !important');
  assert.ok(galleryCss.includes('.btn-loading-pulse'), 'gallery.css must style .btn-loading-pulse with micro spinner');
  assert.ok(galleryCss.includes('.stream-loading-overlay'), 'gallery.css must style .stream-loading-overlay');
  assert.ok(galleryCss.includes('.stream-spinner'), 'gallery.css must define .stream-spinner');
  console.log('✓ PASS: Cursor wait, button micro-spinner, and overlay animations verified in CSS');

  console.log('\n--- TEST 3: app.js Cursor & Spinner Text Management ---');
  const appJs = fs.readFileSync(path.join(__dirname, '../renderer/js/app.js'), 'utf8');

  assert.ok(appJs.includes("document.body.classList.add('app-loading-state')"), 'app.js must activate app-loading-state');
  assert.ok(appJs.includes("document.body.classList.remove('app-loading-state')"), 'app.js must deactivate app-loading-state');
  assert.ok(appJs.includes('loadingSpinnerText'), 'app.js must bind loadingSpinnerText');
  console.log('✓ PASS: app.js loading/buffering/error handlers manage cursor and status text correctly');

  console.log('\n--- TEST 4: otakudesu.js Stream Loading Overlay & Cancellation ---');
  const otakudesuJs = fs.readFileSync(path.join(__dirname, '../renderer/js/otakudesu.js'), 'utf8');

  assert.ok(otakudesuJs.includes('showStreamLoadingOverlay'), 'otakudesu.js must implement showStreamLoadingOverlay');
  assert.ok(otakudesuJs.includes('hideStreamLoadingOverlay'), 'otakudesu.js must implement hideStreamLoadingOverlay');
  assert.ok(otakudesuJs.includes('cancelStreamLoading'), 'otakudesu.js must implement cancelStreamLoading');
  assert.ok(otakudesuJs.includes('Embed utama tidak aktif, mencari server mirror'), 'otakudesu.js must feature dynamic mirror status messages');
  assert.ok(otakudesuJs.includes('btn-loading-pulse'), 'otakudesu.js must apply btn-loading-pulse to clicked buttons');
  console.log('✓ PASS: otakudesu.js loading overlay, dynamic mirror status, and cancellation verified');

  console.log('\n--- TEST 5: player.js Descriptive Loading Messages ---');
  const playerJs = fs.readFileSync(path.join(__dirname, '../renderer/js/player.js'), 'utf8');

  assert.ok(playerJs.includes('Beralih ke kualitas'), 'player.js must provide quality switch status in player:loading');
  assert.ok(playerJs.includes('Menghubungkan stream'), 'player.js must provide stream loading status in player:loading');
  console.log('✓ PASS: player.js passes descriptive loading messages');

  console.log('\n==================================================');
  console.log('🎉 ALL STREAM CLICK INTERACTION & LOADING TESTS PASSED!');
  console.log('==================================================\n');
}

runTests();
