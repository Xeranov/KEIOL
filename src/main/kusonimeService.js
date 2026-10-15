/**
 * Kusonime Scraper & Batch Download Service
 * Fetches and parses anime data, search results, metadata,
 * and batch download packages/mirrors from kusonime.com.
 */

const BASE_URL = 'https://kusonime.com';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
  'Referer': BASE_URL
};

class KusonimeService {
  constructor() {
    this.baseUrl = BASE_URL;
    this.animeListCache = null;
  }

  async fetchHtml(url) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(fullUrl, {
      headers: DEFAULT_HEADERS
    });
    if (!res.ok) {
      throw new Error(`Gagal mengambil data dari Kusonime (HTTP ${res.status}): ${fullUrl}`);
    }
    return await res.text();
  }

  /**
   * Helper untuk membersihkan entitas HTML & tag
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#8211;/g, '–')
      .replace(/&#8212;/g, '—')
      .replace(/&#8216;/g, '‘')
      .replace(/&#8217;/g, '’')
      .replace(/&#8220;/g, '“')
      .replace(/&#8221;/g, '”')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Ekstrak slug anime dari URL
   */
  extractSlug(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url, this.baseUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts.pop() || '';
    } catch (e) {
      return url.replace(/^https?:\/\/[^\/]+\//, '').replace(/\/$/, '');
    }
  }

  /**
   * Pencarian Anime di Kusonime
   * Mengembalikan daftar anime dengan penanda khusus isBatchOnly: true
   */
  async search(query) {
    if (!query || typeof query !== 'string') return [];
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) return [];

    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(cleanQuery)}`;
    let html = '';
    try {
      html = await this.fetchHtml(searchUrl);
    } catch (err) {
      console.warn('Gagal mencari di Kusonime:', err.message);
      return [];
    }

    const results = [];
    const detpostRegex = /<div class=['"]detpost['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match;

    while ((match = detpostRegex.exec(html)) !== null) {
      const block = match[1];

      // Judul & Tautan
      const linkMatch = block.match(/<h2 class=['"]episodeye['"][^>]*>\s*<a href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i) ||
                        block.match(/<div class=['"]thumb['"]>\s*<a href=['"]([^'"]+)['"] title=['"]([^'"]+)['"]/i);
      
      // Poster Gambar
      const imgMatch = block.match(/<img[^>]+src=['"]([^'"]+)['"]/i);

      // Genre
      const genreMatches = [];
      const genreRegex = /<a href=['"][^'"]*\/genres\/[^'"]*['"][^>]*>([^<]+)<\/a>/gi;
      let gMatch;
      while ((gMatch = genreRegex.exec(block)) !== null) {
        genreMatches.push(this.cleanText(gMatch[1]));
      }

      // Released info
      const releaseMatch = block.match(/<i class=['"]fa fa-clock-o['"][^>]*><\/i>\s*([^<]+)/i);

      if (linkMatch) {
        const rawUrl = linkMatch[1];
        const rawTitle = linkMatch[2];
        const cleanTitle = this.cleanText(rawTitle);

        results.push({
          title: cleanTitle,
          url: rawUrl,
          slug: this.extractSlug(rawUrl),
          poster: imgMatch ? imgMatch[1] : '',
          genres: genreMatches.join(', ') || 'Anime Batch',
          status: 'Batch',
          episode: 'Download Batch',
          released: releaseMatch ? this.cleanText(releaseMatch[1]) : '',
          source: 'kusonime',
          isBatchOnly: true
        });
      }
    }

    return results;
  }

  /**
   * Mengambil halaman detail anime di Kusonime
   * Ekstraksi metadata, sinopsis, dan seluruh paket unduhan batch per resolusi & mirror
   */
  async getAnimeDetail(urlOrSlug) {
    if (!urlOrSlug) throw new Error('URL atau slug anime Kusonime tidak valid');

    let fullUrl = urlOrSlug;
    if (!urlOrSlug.startsWith('http')) {
      const cleanSlug = urlOrSlug.replace(/^\/+|\/+$/g, '');
      fullUrl = `${this.baseUrl}/${cleanSlug}/`;
    }

    const html = await this.fetchHtml(fullUrl);

    // Judul Anime
    const titleMatch = html.match(/<h1 class=['"]jdlpost['"][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<h1 class=['"]entry-title['"][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<meta property=['"]og:title['"] content=['"]([^'"]+)['"]/i);
    const title = titleMatch ? this.cleanText(titleMatch[1].replace(/\s*\|\s*Kusonime.*$/i, '')) : 'Anime Kusonime';

    // Poster
    const imgMatch = html.match(/<div class=['"]post-thumb['"][^>]*>\s*<img[^>]+src=['"]([^'"]+)['"]/i) ||
                     html.match(/<div class=['"]thumb['"][^>]*>\s*<img[^>]+src=['"]([^'"]+)['"]/i) ||
                     html.match(/<meta property=['"]og:image['"] content=['"]([^'"]+)['"]/i);
    const poster = imgMatch ? imgMatch[1] : '';

    // Metadata dari <div class="info">
    let japanese = '';
    let genreList = [];
    let seasons = '';
    let producers = '';
    let type = 'Batch Series';
    let status = 'Completed';
    let totalEpisodes = 'Batch';
    let score = '8.0';
    let duration = '24 min.';
    let released = '';

    const infoMatch = html.match(/<div class=['"]info['"][^>]*>([\s\S]*?)<\/div>/i);
    if (infoMatch) {
      const infoBlock = infoMatch[1];

      const jpMatch = infoBlock.match(/<p><b>Japanese\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (jpMatch) japanese = this.cleanText(jpMatch[1]);

      const genreRegex = /<a href=['"][^'"]*\/genres\/[^'"]*['"][^>]*>([^<]+)<\/a>/gi;
      let gm;
      while ((gm = genreRegex.exec(infoBlock)) !== null) {
        genreList.push(this.cleanText(gm[1]));
      }

      const seasonMatch = infoBlock.match(/<p><b>Seasons?\s*<\/b>\s*:\s*([\s\S]*?)<\/p>/i);
      if (seasonMatch) seasons = this.cleanText(seasonMatch[1]);

      const prodMatch = infoBlock.match(/<p><b>Producers?\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (prodMatch) producers = this.cleanText(prodMatch[1]);

      const typeMatch = infoBlock.match(/<p><b>Type\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (typeMatch) type = this.cleanText(typeMatch[1]);

      const statusMatch = infoBlock.match(/<p><b>Status\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (statusMatch) status = this.cleanText(statusMatch[1]);

      const epMatch = infoBlock.match(/<p><b>Total Episode\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (epMatch) totalEpisodes = this.cleanText(epMatch[1]);

      const scoreMatch = infoBlock.match(/<p><b>Score\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (scoreMatch) score = this.cleanText(scoreMatch[1]);

      const durMatch = infoBlock.match(/<p><b>Duration\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (durMatch) duration = this.cleanText(durMatch[1]);

      const relMatch = infoBlock.match(/<p><b>Released on\s*<\/b>\s*:\s*([^<]+)<\/p>/i);
      if (relMatch) released = this.cleanText(relMatch[1]);
    }

    // Sinopsis: ambil paragraf yang berada antara info dan area download
    let synopsis = '';
    const infoEnd = html.indexOf('class="info"');
    const ddlStart = html.indexOf('smokeddl');
    if (infoEnd !== -1 && ddlStart !== -1 && ddlStart > infoEnd) {
      const middlePart = html.substring(infoEnd, ddlStart);
      const paragraphs = [];
      const pRegex = /<p>([\s\S]*?)<\/p>/gi;
      let pm;
      while ((pm = pRegex.exec(middlePart)) !== null) {
        const cleaned = this.cleanText(pm[1]);
        if (cleaned &&
            !cleaned.startsWith('Japanese:') &&
            !cleaned.startsWith('Genre:') &&
            !cleaned.startsWith('Credit:') &&
            !cleaned.startsWith('Download') &&
            cleaned.length > 20) {
          paragraphs.push(cleaned);
        }
      }
      synopsis = paragraphs.join('\n\n');
    }
    if (!synopsis) {
      const descMatch = html.match(/<meta property=['"]og:description['"] content=['"]([^'"]+)['"]/i);
      synopsis = descMatch ? this.cleanText(descMatch[1]) : 'Tidak ada sinopsis tersedia.';
    }

    // Paket Batch & Mirror Download
    const batchPackages = this.parseBatchPackages(html);

    return {
      title,
      japanese,
      poster,
      score,
      type,
      status,
      totalEpisodes,
      duration,
      released,
      studio: producers,
      seasons,
      genres: genreList,
      synopsis,
      source: 'kusonime',
      isBatchOnly: true,
      url: fullUrl,
      slug: this.extractSlug(fullUrl),
      batchPackages
    };
  }

  /**
   * Parser Paket Batch & Opsi Resolusi Kusonime
   */
  parseBatchPackages(html) {
    const packages = [];

    // Kusonime biasanya memiliki satu atau lebih blok <div class="smokeddl...">
    // Di dalamnya terdapat smokettl (judul paket) dan smokeurl (per resolusi)
    const smokeddlRegex = /<div class=['"]smokeddl[a-z0-9_-]*['"][^>]*>([\s\S]*?)(?:<div class=['"]smokeddl|<div class=['"]clear['"]|<\/div>\s*<\/div>\s*<\/div>|$)/gi;
    let blockMatch;

    // Alternatif jika format smokeddlrh langsung berjejer
    const smokeddlrhBlocks = html.split(/<div class=['"]smokeddl[a-z0-9_-]*['"][^>]*>/i);
    if (smokeddlrhBlocks.length > 1) {
      smokeddlrhBlocks.shift(); // skip before first

      for (const section of smokeddlrhBlocks) {
        const ttlMatch = section.match(/<div class=['"]smokettl[a-z0-9_-]*['"][^>]*>([\s\S]*?)<\/div>/i);
        const packageTitle = ttlMatch ? this.cleanText(ttlMatch[1]) : 'Download Batch Lengkap';

        const resolutions = [];
        const smokeurlRegex = /<div class=['"]smokeurl[a-z0-9_-]*['"][^>]*>([\s\S]*?)<\/div>/gi;
        let urlMatch;

        while ((urlMatch = smokeurlRegex.exec(section)) !== null) {
          const row = urlMatch[1];
          const qualMatch = row.match(/<strong>([^<]+)<\/strong>/i);
          const quality = qualMatch ? this.cleanText(qualMatch[1]) : 'Batch';

          const mirrors = [];
          const aRegex = /<a href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
          let aMatch;

          while ((aMatch = aRegex.exec(row)) !== null) {
            const rawHref = aMatch[1].replace(/&amp;/g, '&');
            const hostName = this.cleanText(aMatch[2]);
            mirrors.push({
              host: hostName,
              url: rawHref
            });
          }

          if (mirrors.length > 0) {
            resolutions.push({
              quality,
              mirrors
            });
          }
        }

        if (resolutions.length > 0) {
          packages.push({
            title: packageTitle,
            resolutions
          });
        }
      }
    }

    return packages;
  }

  /**
   * Mengambil seluruh direktori anime Kusonime (A-Z)
   * Mengambil halaman daftar anime batch dan mengelompokkan berdasarkan abjad
   */
  async getAnimeList() {
    if (this.animeListCache && this.animeListCache.length > 0) {
      return this.animeListCache;
    }

    const pages = [1, 2, 3, 4];
    let pageHtmls = [];
    try {
      pageHtmls = await Promise.all(pages.map(p => {
        const url = p === 1 ? '/list-anime-batch-sub-indo/' : `/list-anime-batch-sub-indo/page/${p}/`;
        return this.fetchHtml(url);
      }));
    } catch (err) {
      console.warn('Gagal mengambil daftar anime Kusonime:', err.message);
      return [];
    }

    const groupsMap = new Map();

    for (const html of pageHtmls) {
      const blockRegex = /<div class=['"]bariskelom['"]>([\s\S]*?)(?=<div class=['"]bariskelom['"]|<div class=['"]navigation['"]|<div id=['"]footer['"]|$)/gi;
      let blockMatch;

      while ((blockMatch = blockRegex.exec(html)) !== null) {
        const block = blockMatch[1];
        const letterMatch = block.match(/<div class=['"]barispenz['"]>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
        if (!letterMatch) continue;

        let rawLetter = letterMatch[1].trim().toUpperCase();
        let letter = rawLetter;
        if (!/^[A-Z]$/.test(letter)) {
          letter = '#';
        }

        if (!groupsMap.has(letter)) {
          groupsMap.set(letter, []);
        }
        const targetGroup = groupsMap.get(letter);

        const linkRegex = /<a class=['"]kmz['"][^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
        let lMatch;
        while ((lMatch = linkRegex.exec(block)) !== null) {
          const url = lMatch[1];
          const rawTitle = this.cleanText(lMatch[2]);
          if (rawTitle && url) {
            targetGroup.push({
              title: rawTitle,
              url,
              slug: this.extractSlug(url),
              source: 'kusonime'
            });
          }
        }
      }
    }

    const sortedLetters = Array.from(groupsMap.keys()).sort((a, b) => {
      if (a === '#') return -1;
      if (b === '#') return 1;
      return a.localeCompare(b);
    });

    const groups = [];
    for (const letter of sortedLetters) {
      groups.push({
        letter,
        items: groupsMap.get(letter)
      });
    }

    this.animeListCache = groups;
    return groups;
  }
}

module.exports = new KusonimeService();

