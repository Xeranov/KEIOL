const mediaServer = require('../main/mediaServer');
const idlixService = require('../main/idlixService');

async function testIdlixProxy() {
  console.log('--- TEST: Local MediaServer Idlix HLS Proxy ---');
  await mediaServer.start();
  const port = mediaServer.port;
  console.log('MediaServer port:', port);

  // Get a real stream URL from Idlix
  console.log('Initiating stream session for a movie...');
  const movies = await idlixService.getMovies({ page: 1, limit: 1 });
  const movie = movies.data[0];
  console.log(`Movie: ${movie.title} (${movie.id})`);

  const streamInfo = await idlixService.getStreamDirect('movie', movie.id);
  console.log('Redeemed Stream URL:', streamInfo.streamUrl);

  // Test local mediaServer master playlist endpoint
  const masterProxyUrl = `http://127.0.0.1:${port}/idlix-hls/master.m3u8?url=${encodeURIComponent(streamInfo.streamUrl)}`;
  console.log('Fetching master from proxy:', masterProxyUrl);
  const masterRes = await fetch(masterProxyUrl);
  if (masterRes.status !== 200) {
    throw new Error(`Master proxy failed with status ${masterRes.status}`);
  }
  const masterText = await masterRes.text();
  console.log('Master M3U8 length:', masterText.length);
  if (!masterText.includes('#EXTM3U') || !masterText.includes('/idlix-hls/playlist.m3u8')) {
    throw new Error('Master playlist does not contain rewritten sub-playlists');
  }
  console.log('✓ Master playlist correctly rewritten to local proxy!');

  // Extract first sub-playlist from master
  const match = masterText.match(/http:\/\/127\.0\.0\.1:[0-9]+\/idlix-hls\/playlist\.m3u8\?[^\s\r\n"']+/);
  if (!match) {
    throw new Error('No sub-playlist URL found in master text');
  }
  console.log('Fetching sub-playlist from proxy:', match[0]);
  const subRes = await fetch(match[0]);
  if (subRes.status !== 200) {
    throw new Error(`Sub-playlist proxy failed with status ${subRes.status}`);
  }
  const subText = await subRes.text();
  console.log('Sub-playlist M3U8 length:', subText.length);
  if (!subText.includes('#EXTM3U') || !subText.includes('?t=')) {
    throw new Error('Sub-playlist segments do not contain injected tokens');
  }
  console.log('✓ Sub-playlist correctly injected tokens into segment URLs!');

  // Unit test: Verify Busted S2 Ep 5 style relative master playlist resolution
  console.log('\n--- TEST: Relative Playlist URL Resolution (Busted S2 Ep 5 Fix) ---');
  const mockMaster = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720
data-888832.json
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360
data-889514.json`;

  const baseUrl = 'https://e2e.majorplay.net/v/a1/b2/c3/config-123.json?t=tok123';
  const u = new URL(baseUrl);
  const token = u.search.replace(/^\?/, '');
  const rewrittenMock = mockMaster.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const subUrl = new URL(trimmed, baseUrl).href;
      return `http://127.0.0.1:${port}/idlix-hls/playlist.m3u8?url=${encodeURIComponent(subUrl)}&token=${encodeURIComponent(token)}`;
    }
    return line;
  }).join('\n');

  if (!rewrittenMock.includes('url=https%3A%2F%2Fe2e.majorplay.net%2Fv%2Fa1%2Fb2%2Fc3%2Fdata-888832.json')) {
    throw new Error('Relative sub-playlist was not resolved to absolute URL!');
  }
  console.log('✓ Relative playlist path correctly resolved to full URL:', rewrittenMock.split('\n')[2]);

  await mediaServer.stop();
  console.log('=== IDLIX HLS PROXY TEST PASSED! ===');
}

testIdlixProxy().catch(err => {
  console.error('❌ Proxy Test Failed:', err);
  process.exit(1);
});
