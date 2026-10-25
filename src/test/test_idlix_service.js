const idlixService = require('../main/idlixService');

async function runTests() {
  console.log('--- TEST 1: Get Movies Catalog ---');
  const movies = await idlixService.getMovies({ page: 1, limit: 4 });
  if (!movies || !Array.isArray(movies.data) || movies.data.length === 0) {
    throw new Error('Test 1 Failed: movies.data is empty');
  }
  console.log(`Success! Fetched ${movies.data.length} movies. First: "${movies.data[0].title}" (${movies.data[0].slug})`);

  console.log('\n--- TEST 2: Get TV Series Catalog ---');
  const series = await idlixService.getSeries({ page: 1, limit: 4 });
  if (!series || !Array.isArray(series.data) || series.data.length === 0) {
    throw new Error('Test 2 Failed: series.data is empty');
  }
  console.log(`Success! Fetched ${series.data.length} series. First: "${series.data[0].title}" (${series.data[0].slug})`);

  console.log('\n--- TEST 3: Search Functionality ---');
  const searchResults = await idlixService.search('Wednesday');
  if (!searchResults || !Array.isArray(searchResults.results) || searchResults.results.length === 0) {
    throw new Error('Test 3 Failed: search results empty for "Wednesday"');
  }
  console.log(`Success! Found ${searchResults.results.length} results. First: "${searchResults.results[0].title}"`);

  console.log('\n--- TEST 4: Series Detail & Season Episodes ---');
  const seriesDetail = await idlixService.getSeriesDetail('wednesday-2022');
  if (!seriesDetail || seriesDetail.slug !== 'wednesday-2022') {
    throw new Error('Test 4 Failed: series detail slug mismatch');
  }
  console.log(`Success! Series "${seriesDetail.title}" has ${seriesDetail.seasons.length} seasons.`);

  const season1 = await idlixService.getSeasonEpisodes('wednesday-2022', 1);
  if (!season1 || !season1.season || !Array.isArray(season1.season.episodes) || season1.season.episodes.length === 0) {
    throw new Error('Test 4 Failed: season 1 episodes empty');
  }
  console.log(`Success! Season 1 has ${season1.season.episodes.length} episodes. Ep 1: "${season1.season.episodes[0].name}"`);

  console.log('\n--- TEST 5: Stream Session Initiation (Pre-unlock) ---');
  const firstEp = season1.season.episodes[0];
  const session = await idlixService.initiateStreamSession('episode', firstEp.id);
  if (!session || !session.gateToken || !session.unlockAt) {
    throw new Error('Test 5 Failed: invalid session initiation');
  }
  console.log(`Success! Sesi unlock dimulai untuk Ep 1. Wait ms: ${session.waitMs}, maxHeight: ${session.maxHeight}p`);

  console.log('\n--- TEST 6: Get Trending / Popular Catalog ---');
  const trending = await idlixService.getTrending();
  if (!trending || !Array.isArray(trending.data) || trending.data.length === 0) {
    throw new Error('Test 6 Failed: trending.data is empty');
  }
  console.log(`Success! Fetched ${trending.data.length} trending items. First: "${trending.data[0].title}" (${trending.data[0].contentType || 'mixed'})`);

  console.log('\n=== ALL IDLIX SERVICE UNIT TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

