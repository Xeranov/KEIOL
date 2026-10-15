const otakudesu = require('../main/otakudesuService');

async function runTest() {
  console.log('Testing OtakudesuService...');

  // 1. Ongoing
  const ongoing = await otakudesu.getOngoing(1);
  console.log(`✓ Ongoing: ${ongoing.animeList.length} anime ditemukan.`);
  if (ongoing.animeList.length > 0) {
    console.log(`  Contoh: "${ongoing.animeList[0].title}" (${ongoing.animeList[0].episode})`);
  }

  // 2. Schedule
  const schedule = await otakudesu.getSchedule();
  console.log(`✓ Jadwal Rilis: ${schedule.length} hari ditemukan.`);

  // 3. Genres
  const genres = await otakudesu.getGenres();
  console.log(`✓ Genres: ${genres.length} genre ditemukan.`);

  // 4. Search
  const searchResults = await otakudesu.search('Boruto');
  console.log(`✓ Search: ${searchResults.length} hasil untuk "Boruto".`);

  // 5. Anime Detail
  if (ongoing.animeList.length > 0) {
    const detail = await otakudesu.getAnimeDetail(ongoing.animeList[0].url);
    console.log(`✓ Detail Anime: "${detail.title}" (${detail.status}, ${detail.episodes.length} episodes).`);

    // 6. Episode Stream & Download
    if (detail.episodes.length > 0) {
      const epStream = await otakudesu.getEpisodeStream(detail.episodes[0].url);
      console.log(`✓ Episode Stream: "${epStream.title}"`);
      console.log(`  Stream URL: ${epStream.streamUrl ? epStream.streamUrl.slice(0, 60) + '...' : 'none'}`);
      console.log(`  Download options: ${epStream.downloadOptions.length} format/kualitas.`);
    }
  }

  console.log('Semua pengujian OtakudesuService berhasil!');
}

runTest().catch(err => {
  console.error('Error saat testing:', err);
  process.exit(1);
});

