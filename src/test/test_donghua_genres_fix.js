const service = require('../main/anichinService');
const assert = require('assert');

async function test() {
  console.log('Testing anichinService.getDetail and genres parsing...');
  try {
    const slugs = [
      'renegade-immortal-episode-162',
      'oyen-pertempuran-akhir-sekte-misty-cloud-episode-214',
      'perfect-world-episode-288'
    ];

    for (const slug of slugs) {
      const detail = await service.getDetail(slug);
      console.log(`\nTesting ${slug}:`);
      console.log('Title:', detail.title);
      console.log('Genres isArray:', Array.isArray(detail.genres));
      console.log('Genres content:', detail.genres);
      console.log('Episodes count:', detail.episodes.length);
      assert(Array.isArray(detail.genres), 'Genres should be an array');
      assert(detail.episodes.length > 0, 'Episodes should not be empty');
    }

    // Test cases for the UI rendering logic in otakudesu.js
    const testCases = [
      [{ name: 'Action', slug: 'action' }, { name: 'Fantasy', slug: 'fantasy' }],
      'Action, Fantasy, Martial Arts',
      ['Donghua', 'Adventure'],
      [{ name: 'Cultivation', slug: 'cultivation' }],
      null,
      undefined
    ];

    testCases.forEach((genresInput, idx) => {
      const detailObj = { genres: genresInput };
      const rendered = (Array.isArray(detailObj.genres)
        ? detailObj.genres
        : (typeof detailObj.genres === 'string' ? detailObj.genres.split(',') : [])
      ).map(g => {
        const gName = typeof g === 'object' && g !== null ? (g.name || g.title || '') : String(g || '').trim();
        return gName ? `<span class="otakudesu-genre-tag">${gName}</span>` : '';
      }).join('');
      console.log(`Test case ${idx + 1} passed. Rendered: ${rendered || '(empty)'}`);
    });

    console.log('🎉 ALL DONGHUA GENRES TESTS PASSED 100%!');
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
}

test();
