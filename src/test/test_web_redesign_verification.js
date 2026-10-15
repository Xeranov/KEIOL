const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Verification for Web Tab Redesign & Netflix Card System ===\n');

// 1. Verify CSS Styling for Cards and Web Sub-Tabs in gallery.css
console.log('--- TEST 1: CSS Redesign Specifications (DESIGN.md Compliance) ---');
const cssContent = fs.readFileSync(path.join(__dirname, '../renderer/styles/gallery.css'), 'utf8');

// A. 2:3 Card Ratio and 16:9 Continue Watching Ratio
assert(cssContent.includes('.netflix-card-poster-wrap'), 'Must define .netflix-card-poster-wrap');
assert(cssContent.includes('aspect-ratio: 2 / 3;'), 'Standard poster wrap must use 2:3 aspect ratio');
assert(cssContent.includes('.continue-watching-card .netflix-card-poster-wrap'), 'Must have specific 16:9 rule for continue watching');
assert(cssContent.includes('aspect-ratio: 16 / 9;'), 'Continue watching must use 16:9 aspect ratio');

// B. Hover & Focus Preview Panel
assert(cssContent.includes('.netflix-card-hover-panel'), 'Must define .netflix-card-hover-panel for floating info');
assert(cssContent.includes('.btn-card-play'), 'Must define .btn-card-play circular action');
assert(cssContent.includes('background-color: #ffffff;'), 'Play button must be circular white');
assert(cssContent.includes('.hover-action-row'), 'Must define .hover-action-row');
assert(cssContent.includes('.hover-meta-row'), 'Must define .hover-meta-row');

// C. Schedule Day Tabs
assert(cssContent.includes('.schedule-day-tabs'), 'Must define .schedule-day-tabs');
assert(cssContent.includes('.schedule-tab-btn'), 'Must define .schedule-tab-btn');
assert(cssContent.includes('.schedule-today-pill'), 'Must define .schedule-today-pill for current day indicator');
assert(cssContent.includes('.schedule-anime-card'), 'Must define .schedule-anime-card');

// D. Alphabet Directory & Filter
assert(cssContent.includes('.alphabet-search-box'), 'Must define .alphabet-search-box for local search filter');
assert(cssContent.includes('.alphabet-monogram'), 'Must define .alphabet-monogram for letter avatar');

// E. Downloaded Stats Bar
assert(cssContent.includes('.downloaded-stats-bar'), 'Must define .downloaded-stats-bar');
assert(cssContent.includes('.downloaded-stat-card'), 'Must define .downloaded-stat-card');
assert(cssContent.includes('.downloaded-empty-state'), 'Must define .downloaded-empty-state');

console.log('✓ PASS: All CSS classes, 2:3 & 16:9 aspect ratios, hover previews, and schedule/downloaded styles are verified!\n');

// 2. Verify JavaScript Implementation in otakudesu.js
console.log('--- TEST 2: JavaScript Card & View Rendering Logic in otakudesu.js ---');
const jsContent = fs.readFileSync(path.join(__dirname, '../renderer/js/otakudesu.js'), 'utf8');

// A. renderAnimeCard & renderContinueCard
assert(jsContent.includes('btn-card-quick-stream'), 'renderAnimeCard must include btn-card-quick-stream button');
assert(jsContent.includes('btn-card-quick-info'), 'renderAnimeCard must include btn-card-quick-info button');
assert(jsContent.includes('netflix-card-hover-panel'), 'renderAnimeCard must include netflix-card-hover-panel');
assert(jsContent.includes('poster-gradient-overlay'), 'renderAnimeCard must include poster-gradient-overlay');

// B. Interactive Day Switcher in loadSchedule
assert(jsContent.includes('schedule-day-tabs'), 'loadSchedule must render schedule-day-tabs');
assert(jsContent.includes('renderScheduleDayContent'), 'otakudesu.js must implement renderScheduleDayContent');
assert(jsContent.includes('schedule-today-pill'), 'loadSchedule must highlight current day');

// C. Search Filter in Alphabet Directory
assert(jsContent.includes('inputFilterAlphabet'), 'loadAnimeList must include inputFilterAlphabet');
assert(jsContent.includes('alphabet-monogram'), 'renderAlphabetGroup must render alphabet-monogram');

// D. Downloaded View Stats & Series Cards
assert(jsContent.includes('downloaded-stats-bar'), 'renderDownloadedView must include downloaded-stats-bar');
assert(jsContent.includes('btn-play-local'), 'renderDownloadedView must include btn-play-local');
assert(jsContent.includes('btn-episodes-local'), 'renderDownloadedView must include btn-episodes-local');
assert(jsContent.includes('btn-folder-local'), 'renderDownloadedView must include btn-folder-local');

// E. Keyboard Navigation (Accessibility R-32)
assert(jsContent.includes("e.key === 'Enter' || e.key === ' '"), 'bindCardClicks must support Enter and Space for accessibility');

console.log('✓ PASS: JavaScript card generation, Day Switcher, Alphabet filtering, and Downloaded actions verified!\n');

// 3. Functional Simulation Test
console.log('--- TEST 3: Functional Unit Simulation of Card Generation ---');

// Mock OtakudesuManager instance methods to test HTML generation
const mockAnime = {
  title: 'Chainsaw Man',
  slug: 'chainsaw-man',
  url: 'https://otakudesu.blog/anime/chainsaw-man/',
  poster: 'https://otakudesu.blog/wp-content/uploads/csm.jpg',
  rating: '8.8',
  status: 'Completed',
  genres: 'Action, Supernatural',
  day: 'Rabu'
};

const mockHistory = {
  animeTitle: 'Frieren: Beyond Journey\'s End',
  animeSlug: 'frieren',
  lastEpisodeTitle: 'Episode 28',
  lastEpisodeUrl: 'https://otakudesu.blog/episode/frieren-ep-28/',
  poster: 'https://otakudesu.blog/wp-content/uploads/frieren.jpg',
  currentTime: 720,
  duration: 1440
};

// Check mock evaluation
const OtakudesuManager = class {
  constructor() {
    this.onlineHistory = { 'chainsaw-man': { lastEpisodeTitle: 'Episode 12', currentTime: 600, duration: 1200 } };
  }
};
// Attach render methods from file content
const renderAnimeCardMatch = jsContent.match(/renderAnimeCard\(anime\)\s*\{([\s\S]*?)\n  \}/);
const renderContinueCardMatch = jsContent.match(/renderContinueCard\(hist\)\s*\{([\s\S]*?)\n  \}/);

assert(renderAnimeCardMatch, 'renderAnimeCard function extracted successfully');
assert(renderContinueCardMatch, 'renderContinueCard function extracted successfully');

const fnAnimeCard = new Function('anime', renderAnimeCardMatch[1]);
const fnContinueCard = new Function('hist', renderContinueCardMatch[1]);

const dummyScope = { onlineHistory: { 'chainsaw-man': { lastEpisodeTitle: 'Episode 12', currentTime: 600, duration: 1200 } } };

const animeCardHtml = fnAnimeCard.call(dummyScope, mockAnime);
assert(animeCardHtml.includes('Chainsaw Man'), 'Generated card contains title');
assert(animeCardHtml.includes('btn-card-quick-stream'), 'Generated card contains quick stream button');
assert(animeCardHtml.includes('netflix-card-hover-panel'), 'Generated card contains hover panel');
assert(animeCardHtml.includes('★ 8.8'), 'Generated card contains rating');

const continueCardHtml = fnContinueCard.call(dummyScope, mockHistory);
assert(continueCardHtml.includes('continue-watching-card'), 'Generated continue card has continue-watching-card class');
assert(continueCardHtml.includes('50%'), 'Generated continue card computes 50% watch progress');
assert(continueCardHtml.includes('Episode 28'), 'Generated continue card includes last episode title');

console.log('✓ PASS: Functional card generation test passed with real data structures!\n');

console.log('==================================================');
console.log('🎉 ALL WEB TAB REDESIGN VERIFICATION TESTS PASSED!');
console.log('==================================================');

