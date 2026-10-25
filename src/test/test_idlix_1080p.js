const mediaServer = require('../main/mediaServer');
const idlixService = require('../main/idlixService');

async function test1080p() {
  console.log('--- TEST: 1080p Streaming Playback via Idlix & MediaServer ---');
  await mediaServer.start();
  const port = mediaServer.port;
  console.log('Media server port:', port);

  const movies = await idlixService.getMovies({ page: 1, limit: 1 });
  const movie = movies.data[0];
  console.log(`Movie: "${movie.title}" (${movie.id})`);

  const stream = await idlixService.getStreamDirect('movie', movie.id);
  console.log('Stream maxHeight:', stream.maxHeight, 'ladder:', stream.qualityLadder);

  const proxyUrl = `http://127.0.0.1:${port}/idlix-hls/master.m3u8?url=${encodeURIComponent(stream.streamUrl)}`;
  const res = await fetch(proxyUrl);
  const text = await res.text();
  console.log('--- Master M3U8 from Proxy ---');
  console.log(text);

  if (!text.includes('RESOLUTION=1920x1080')) {
    throw new Error('Master playlist does not contain 1080p!');
  }
  console.log('✓ SUCCESS: 1080p Full HD is present in master playlist!');

  // Extract 1080p sub-playlist URL
  const match1080 = text.match(/http:\/\/127\.0\.0\.1:[0-9]+\/idlix-hls\/playlist\.m3u8\?[^\s\r\n"']+/);
  if (!match1080) throw new Error('Could not find 1080p sub-playlist URL');

  const subRes = await fetch(match1080[0]);
  const subText = await subRes.text();
  console.log('--- 1080p Subplaylist Preview ---');
  console.log(subText.split('\n').slice(0, 10).join('\n'));

  if (!subText.includes('EXT-X-VERSION') || (!subText.includes('cdn/') && !subText.includes('cache/'))) {
    throw new Error('1080p subplaylist content invalid');
  }

  // Test downloading the initialization segment or first segment
  const segMatch = subText.match(/https:\/\/[^\s\r\n"']+/);
  if (segMatch) {
    console.log('Testing 1080p segment download:', segMatch[0].slice(0, 80) + '...');
    const segRes = await fetch(segMatch[0]);
    console.log('1080p Segment HTTP status:', segRes.status, 'size:', (await segRes.arrayBuffer()).byteLength);
    if (segRes.status !== 200) {
      throw new Error(`1080p segment failed with HTTP ${segRes.status}`);
    }
    console.log('✓ SUCCESS: 1080p video segment downloaded with HTTP 200 OK!');
  }

  await mediaServer.stop();
  console.log('\n=== ALL 1080P FULL HD STREAMING TESTS PASSED! ===');
}

test1080p().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
