/**
 * AniSkipService
 * Fetches precise anime opening (OP) and ending (ED) skip timestamps using AniList and AniSkip APIs.
 */

class AniSkipService {
  constructor() {
    this.malIdCache = new Map();
    this.skipTimesCache = new Map();
  }

  cleanTitle(rawTitle) {
    if (!rawTitle) return '';
    return rawTitle
      .replace(/Subtitle\s+Indonesia/gi, '')
      .replace(/Sub\s+Indo/gi, '')
      .replace(/Episode\s+\d+/gi, '')
      .replace(/Eps\.?\s*\d+/gi, '')
      .replace(/Season\s+\d+/gi, '')
      .replace(/S\d+/gi, '')
      .replace(/[–—\-:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getMalId(cleanTitle) {
    if (this.malIdCache.has(cleanTitle)) {
      return this.malIdCache.get(cleanTitle);
    }

    try {
      const query = `
        query ($search: String) {
          Media (search: $search, type: ANIME) {
            idMal
            title { romaji english native }
          }
        }
      `;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: cleanTitle } }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      const idMal = data?.data?.Media?.idMal;
      if (idMal) {
        this.malIdCache.set(cleanTitle, idMal);
        return idMal;
      }
    } catch (err) {
      console.warn(`[AniSkipService] AniList lookup failed for "${cleanTitle}":`, err.message);
    }

    return null;
  }

  async getSkipTimes(animeTitle, episodeNum = 1) {
    const cleaned = this.cleanTitle(animeTitle);
    if (!cleaned) return { found: false };

    const cacheKey = `${cleaned}_ep_${episodeNum}`;
    if (this.skipTimesCache.has(cacheKey)) {
      return this.skipTimesCache.get(cacheKey);
    }

    const malId = await this.getMalId(cleaned);
    if (!malId) {
      const result = { found: false };
      this.skipTimesCache.set(cacheKey, result);
      return result;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNum}?types[]=op&types[]=ed&episodeLength=1420`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const result = { found: false };
        this.skipTimesCache.set(cacheKey, result);
        return result;
      }

      const data = await res.json();
      if (!data || !data.found || !Array.isArray(data.results)) {
        const result = { found: false };
        this.skipTimesCache.set(cacheKey, result);
        return result;
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

      const result = {
        found: Boolean(op || ed),
        malId,
        op,
        ed
      };

      this.skipTimesCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn(`[AniSkipService] AniSkip fetch failed for MAL ID ${malId} Ep ${episodeNum}:`, err.message);
      return { found: false };
    }
  }
}

module.exports = new AniSkipService();

