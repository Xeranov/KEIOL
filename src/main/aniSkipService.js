/**
 * AniSkipService
 * Fetches precise anime opening (OP) and ending (ED) skip timestamps using AniList and AniSkip APIs.
 * Supports continuous episode numbering offsets (e.g. Black Clover Season 2 where Ep 1 is Ep 52 on MAL/AniSkip).
 * Features robust episode number resolution and a redundant validation system to prevent invalid skips.
 */

const CONTINUOUS_ANIME_OFFSETS = {
  'black clover': {
    2: 51,   // Season 2 Ep 1 = Continuous Episode 52
    3: 102,  // Season 3 Ep 1 = Continuous Episode 103
    4: 154   // Season 4 Ep 1 = Continuous Episode 155
  },
  'fairy tail': {
    2: 175,  // Series 2 Ep 1 = Continuous Episode 176
    3: 277   // Final Season Ep 1 = Continuous Episode 278
  },
  'gintama': {
    2: 201,  // Gintama' Ep 1 = Continuous Episode 202
    3: 252,  // Gintama' Enchousen = Continuous Episode 253
    4: 316   // Gintama. = Continuous Episode 317
  },
  'world trigger': {
    2: 73,   // Season 2 Ep 1 = Continuous Episode 74
    3: 85    // Season 3 Ep 1 = Continuous Episode 86
  }
};

class AniSkipService {
  constructor() {
    this.malIdCache = new Map();
    this.skipTimesCache = new Map();
  }

  cleanHtmlEntities(str) {
    if (!str) return '';
    return str
      .replace(/&#8211;|&#8212;/g, '–')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  parseTitleAndSeason(rawTitle) {
    if (!rawTitle) return { baseTitle: '', titleWithSeason: '', normalizedSeasonTitle: '', season: 1 };

    let cleaned = this.cleanHtmlEntities(rawTitle);

    // Remove file extensions if present
    cleaned = cleaned.replace(/\.(mkv|mp4|avi|webm|flv|mov)$/i, '');

    // Extract season number if present
    let season = 1;
    const seasonMatch = cleaned.match(/(?:Season|S)\s*(\d+)/i) ||
                        cleaned.match(/(\d+)(?:st|nd|rd|th)\s+Season/i);
    if (seasonMatch) {
      season = parseInt(seasonMatch[1], 10);
    }

    // Strip out batch ranges like "(Episode 1 – 37)" or "(1-25)"
    cleaned = cleaned
      .replace(/\((?:Episode|Eps?\.?)\s*\d+\s*[–—\-]\s*\d+\)/gi, '')
      .replace(/\(\d+\s*[–—\-]\s*\d+\)/gi, '')
      .replace(/\((?:Episode|Eps?\.?)\s*\d+\)/gi, '')
      .replace(/\b(?:Episode|Eps?\.?|Ep\.?)\s*\d+\b/gi, '');

    // Strip out tags & brackets [1080p], [Judas], etc.
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

    // Strip out release metadata & common tags
    cleaned = cleaned
      .replace(/Subtitle\s+Indonesia/gi, '')
      .replace(/Sub\s+Indo/gi, '')
      .replace(/\b(?:BD|Batch|OVA|Movie|Special|TAMAT|Complete|End)\b/gi, '')
      .replace(/\+\s*OVA/gi, '')
      .replace(/1080p|720p|480p|x264|x265|hevc|web-dl|bdrip|bluray/gi, '')
      .replace(/[–—\-:]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[+\s]+$/, '')
      .trim();

    // Version that keeps season (e.g. "Jujutsu Kaisen Season 2")
    const titleWithSeason = cleaned;

    // Version that strips season (e.g. "Black Clover")
    const baseTitle = titleWithSeason
      .replace(/Season\s+\d+/gi, '')
      .replace(/S\d+/gi, '')
      .replace(/\d+(?:st|nd|rd|th)\s+Season/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/[+\s]+$/, '')
      .trim();

    const normalizedSeasonTitle = season > 1 ? `${baseTitle} Season ${season}` : baseTitle;

    return { baseTitle, titleWithSeason, normalizedSeasonTitle, season };
  }

  cleanTitle(rawTitle) {
    return this.parseTitleAndSeason(rawTitle).baseTitle;
  }

  /**
   * Robust episode number resolution from a title or filename.
   * If animeTitle is passed, it is stripped first so that numbers in the title
   * (e.g. "Mob Psycho 100", "86", "Steins;Gate 0") are not confused with episode numbers.
   */
  extractEpisodeNumber(rawString, animeTitle = '') {
    if (!rawString) return 1;

    let target = this.cleanHtmlEntities(rawString);

    // If anime title is provided, remove it from the string first
    if (animeTitle) {
      const cleanAnime = this.parseTitleAndSeason(animeTitle).baseTitle;
      if (cleanAnime) {
        const escaped = cleanAnime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        target = target.replace(new RegExp(escaped, 'gi'), ' ');
      }
    }

    // Strip batch ranges first like "(Episode 1 – 37)"
    target = target.replace(/\((?:Episode|Eps?\.?)\s*\d+\s*[–—\-]\s*\d+\)/gi, '');

    // Strip resolutions and media codecs inside brackets or parentheses
    target = target.replace(/\[[^\]]*\]/g, ' ');
    target = target.replace(/\((?:1080p|720p|480p|360p|x264|x265|hevc|bdrip)[^)]*\)/gi, ' ');
    target = target.replace(/\b(?:1080p|720p|480p|360p|2160p|x264|x265|hevc|10bit|aac|flac)\b/gi, ' ');

    // 1. Explicit episode indicators: "Episode 05", "Eps 12", "Ep. 3"
    const explicitMatch = target.match(/(?:Episode|Eps?\.?|Ep\.?)\s*(\d{1,4})/i);
    if (explicitMatch) {
      return parseInt(explicitMatch[1], 10);
    }

    // 2. Standard S01E05 or S1E5 format
    const seMatch = target.match(/[sS]\d+[eE](\d{1,4})/i);
    if (seMatch) {
      return parseInt(seMatch[1], 10);
    }

    // 3. E05 format (isolated E followed by digits)
    const eMatch = target.match(/(?:^|[\s_–—\-])[eE](\d{1,4})(?:[\s_–—\.]|$)/i);
    if (eMatch) {
      return parseInt(eMatch[1], 10);
    }

    // 4. Dash-separated episode number: " - 05", " _ 05", " – 05"
    // Using last occurrence if multiple dashes exist
    const dashMatches = [...target.matchAll(/[-–—_]\s*(\d{1,4})(?:v\d)?(?=[\s_–—\.]|\.mkv|\.mp4|$)/gi)];
    if (dashMatches.length > 0) {
      const lastMatch = dashMatches[dashMatches.length - 1];
      const num = parseInt(lastMatch[1], 10);
      if (num >= 0 && num !== 1080 && num !== 720 && num !== 480 && num !== 360 && num !== 2160) {
        return num;
      }
    }

    // 5. Trailing digits before file extension
    const trailingMatch = target.match(/\s+(\d{1,4})\s*(?:\.[a-z0-9]+)?$/i);
    if (trailingMatch) {
      return parseInt(trailingMatch[1], 10);
    }

    // Fallback: search for any 1-3 digit number that isn't a known year or resolution
    const genericMatches = target.match(/\b(\d{1,4})\b/g);
    if (genericMatches) {
      for (let i = genericMatches.length - 1; i >= 0; i--) {
        const val = parseInt(genericMatches[i], 10);
        if (val >= 0 && val < 2000 && val !== 1080 && val !== 720 && val !== 480 && val !== 360) {
          return val;
        }
      }
    }

    return 1;
  }

  /**
   * Redundant Validation System for Anime Skip Intervals
   * Validates intervals against actual video duration, verifies sensible OP/ED durations (~80-100s),
   * start time bounds, non-overlap, and prevents skipping out-of-range.
   */
  validateSkipIntervals(intervals, videoDuration = null) {
    if (!intervals || typeof intervals !== 'object') return null;

    const validDuration = (typeof videoDuration === 'number' && !isNaN(videoDuration) && videoDuration > 0)
      ? videoDuration
      : null;

    let validOp = null;
    let validEd = null;

    // Validate Opening (OP)
    if (intervals.op && typeof intervals.op.startTime === 'number' && typeof intervals.op.endTime === 'number') {
      const start = Math.max(0, intervals.op.startTime);
      const end = intervals.op.endTime;
      const duration = end - start;

      // Sensible OP duration: typically 60-100s (standard 85-90s), acceptable bounds 30s - 130s
      const isSensibleDuration = duration >= 30 && duration <= 130;
      // Opening must start in early section of episode (within first 8 minutes = 480s)
      const isSensibleStart = start >= 0 && start <= 480;
      // Fits within video duration if known
      const fitsVideo = !validDuration || (end <= (validDuration - 5) && duration < (validDuration * 0.6));

      if (isSensibleDuration && isSensibleStart && fitsVideo) {
        const effectiveEnd = validDuration ? Math.min(end, validDuration - 2) : end;
        validOp = {
          startTime: Math.round(start * 10) / 10,
          endTime: Math.round(effectiveEnd * 10) / 10
        };
      } else {
        console.warn(`[AniSkipService] OP rejected by redundant validation: ${start} - ${end} (duration: ${duration}s, videoDuration: ${validDuration})`);
      }
    }

    // Validate Ending (ED)
    if (intervals.ed && typeof intervals.ed.startTime === 'number' && typeof intervals.ed.endTime === 'number') {
      const start = Math.max(0, intervals.ed.startTime);
      const end = intervals.ed.endTime;
      const duration = end - start;

      // Sensible ED duration: 30s - 130s
      const isSensibleDuration = duration >= 30 && duration <= 130;
      // Ending should be in the latter portion of episode if duration is known
      const fitsVideo = !validDuration || (start >= (validDuration * 0.35) && start < validDuration);

      if (isSensibleDuration && fitsVideo) {
        // Ensure OP and ED do not overlap
        if (!validOp || start >= validOp.endTime) {
          const effectiveEnd = validDuration ? Math.min(end, validDuration - 1) : end;
          if (effectiveEnd > start) {
            validEd = {
              startTime: Math.round(start * 10) / 10,
              endTime: Math.round(effectiveEnd * 10) / 10
            };
          }
        }
      } else {
        console.warn(`[AniSkipService] ED rejected by redundant validation: ${start} - ${end} (duration: ${duration}s, videoDuration: ${validDuration})`);
      }
    }

    if (!validOp && !validEd) return null;
    return { op: validOp, ed: validEd };
  }

  async getMalId(searchTitle) {
    if (!searchTitle) return null;
    const cacheKey = searchTitle.toLowerCase().trim();
    if (this.malIdCache.has(cacheKey)) {
      return this.malIdCache.get(cacheKey);
    }

    try {
      const query = `
        query ($search: String) {
          Media (search: $search, type: ANIME) {
            idMal
            episodes
            title { romaji english native }
          }
        }
      `;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: searchTitle } }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      const media = data?.data?.Media;
      const idMal = media?.idMal;
      if (idMal) {
        this.malIdCache.set(cacheKey, idMal);
        return idMal;
      }
    } catch (err) {
      console.warn(`[AniSkipService] AniList lookup failed for "${searchTitle}":`, err.message);
    }

    return null;
  }

  async fetchAniSkip(malId, episodeNum) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNum}?types[]=op&types[]=ed&episodeLength=1420`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        return { found: false };
      }

      const data = await res.json();
      if (!data || !data.found || !Array.isArray(data.results)) {
        return { found: false };
      }

      let op = null;
      let ed = null;

      for (const item of data.results) {
        if (item.skipType === 'op' && item.interval) {
          op = {
            startTime: Math.round(item.interval.startTime * 10) / 10,
            endTime: Math.round(item.interval.endTime * 10) / 10
          };
        } else if (item.skipType === 'ed' && item.interval) {
          ed = {
            startTime: Math.round(item.interval.startTime * 10) / 10,
            endTime: Math.round(item.interval.endTime * 10) / 10
          };
        }
      }

      // Redundant validation on the AniSkip data
      const validated = this.validateSkipIntervals({ op, ed });
      if (!validated) {
        return { found: false };
      }

      return {
        found: true,
        malId,
        episodeNum,
        op: validated.op,
        ed: validated.ed
      };
    } catch (err) {
      console.warn(`[AniSkipService] AniSkip fetch failed for MAL ID ${malId} Ep ${episodeNum}:`, err.message);
      return { found: false };
    }
  }

  async getSkipTimes(animeTitle, episodeNum = 1) {
    if (!animeTitle) return { found: false };

    const parsed = this.parseTitleAndSeason(animeTitle);
    const { baseTitle, titleWithSeason, normalizedSeasonTitle, season } = parsed;
    if (!baseTitle) return { found: false };

    const cacheKey = `${animeTitle.toLowerCase().trim()}_ep_${episodeNum}`;
    if (this.skipTimesCache.has(cacheKey)) {
      return this.skipTimesCache.get(cacheKey);
    }

    const baseLower = baseTitle.toLowerCase().trim();
    let effectiveEpisodeNum = episodeNum;
    let targetMalTitle = baseTitle;

    // 1. Cek apakah anime memiliki penomoran episode continuous di AniList/MAL
    if (CONTINUOUS_ANIME_OFFSETS[baseLower] && CONTINUOUS_ANIME_OFFSETS[baseLower][season]) {
      const offset = CONTINUOUS_ANIME_OFFSETS[baseLower][season];
      // Jika episodeNum masih relatif terhadap season (misal Season 2 Ep 1 bukan continuous Ep 52), tambahkan offset
      if (episodeNum <= offset) {
        effectiveEpisodeNum = episodeNum + offset;
      }
      targetMalTitle = baseTitle;
    } else if (season > 1) {
      // 2. Jika bukan continuous, coba cari season terpisah terlebih dahulu di AniList (misal Jujutsu Kaisen Season 2)
      let seasonMalId = await this.getMalId(normalizedSeasonTitle);
      if (!seasonMalId && titleWithSeason && titleWithSeason.toLowerCase() !== normalizedSeasonTitle.toLowerCase()) {
        seasonMalId = await this.getMalId(titleWithSeason);
      }
      if (seasonMalId) {
        const seasonSkip = await this.fetchAniSkip(seasonMalId, episodeNum);
        if (seasonSkip.found) {
          this.skipTimesCache.set(cacheKey, seasonSkip);
          return seasonSkip;
        }
      }
      // Fallback ke baseTitle jika season khusus tidak menghasilkan skip times
      targetMalTitle = baseTitle;
    }

    const malId = await this.getMalId(targetMalTitle);
    if (!malId) {
      const result = { found: false };
      this.skipTimesCache.set(cacheKey, result);
      return result;
    }

    const result = await this.fetchAniSkip(malId, effectiveEpisodeNum);
    this.skipTimesCache.set(cacheKey, result);
    return result;
  }
}

module.exports = new AniSkipService();
module.exports.CONTINUOUS_ANIME_OFFSETS = CONTINUOUS_ANIME_OFFSETS;
