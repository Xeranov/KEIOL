/**
 * Otakudesu Scraper & Parser Service
 * Fetches and parses anime data, schedules, genres, search results,
 * episode stream links, and download mirrors from otakudesu.blog.
 */

const BASE_URL = 'https://otakudesu.blog';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
  'Referer': BASE_URL
};

class OtakudesuService {
  constructor() {
    this.baseUrl = BASE_URL;
  }

  async fetchHtml(url) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(fullUrl, {
      headers: DEFAULT_HEADERS
    });
    if (!res.ok) {
      throw new Error(`Gagal mengambil data dari Otakudesu (HTTP ${res.status}): ${fullUrl}`);
    }
    return await res.text();
  }

  /**
   * Mengambil anime ongoing (sedang tayang)
   */
  async getOngoing(page = 1) {
    const url = page > 1 ? `/ongoing-anime/page/${page}/` : '/ongoing-anime/';
    const html = await this.fetchHtml(url);

    const animeList = [];
    // Pattern: <div class='detpost'>...
    const itemRegex = /<div class=['"]detpost['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/li>/gi;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];

      const epMatch = block.match(/<div class=['"]epz['"][^>]*>([\s\S]*?)<\/div>/i);
      const dayMatch = block.match(/<div class=['"]epztipe['"][^>]*>([\s\S]*?)<\/div>/i);
      const dateMatch = block.match(/<div class=['"]newnime['"][^>]*>([\s\S]*?)<\/div>/i);
      const linkMatch = block.match(/<a href=['"]([^'"]+)['"][^>]*>/i);
      const imgMatch = block.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
      const titleMatch = block.match(/<h2 class=['"]jdlflm['"][^>]*>([^<]+)<\/h2>/i);

      if (linkMatch && (titleMatch || imgMatch)) {
        animeList.push({
          title: titleMatch ? titleMatch[1].trim() : '',
          url: linkMatch[1],
          slug: this.extractSlug(linkMatch[1]),
          poster: imgMatch ? imgMatch[1] : '',
          episode: epMatch ? this.cleanText(epMatch[1]) : '',
          day: dayMatch ? this.cleanText(dayMatch[1]) : '',
          date: dateMatch ? this.cleanText(dateMatch[1]) : ''
        });
      }
    }

    // Cek apakah ada halaman berikutnya (pagination)
    const hasNextPage = /class=['"]next page-numbers['"]/i.test(html) || /class=['"]pagenavix['"]/i.test(html);

    return {
      page,
      hasNextPage,
      animeList
    };
  }

  /**
   * Mengambil jadwal rilis mingguan per hari
   */
  async getSchedule() {
    const html = await this.fetchHtml('/jadwal-rilis/');
    const scheduleDays = [];

    // Build or use ongoing poster map so each schedule card has its thumbnail
    if (!this.ongoingPosterMap || this.ongoingPosterMap.size === 0) {
      this.ongoingPosterMap = new Map();
      try {
        for (let p = 1; p <= 4; p++) {
          const res = await this.getOngoing(p);
          (res.animeList || []).forEach(a => {
            if (a.slug && a.poster) this.ongoingPosterMap.set(a.slug, a.poster);
          });
          if (!res.hasNextPage) break;
        }
      } catch (e) {
        console.warn('Gagal memuat ongoing poster map untuk jadwal:', e);
      }
    }

    const dayRegex = /<div class=['"]kglist321['"][^>]*>[\s\S]*?<h2>([^<]+)<\/h2>([\s\S]*?)<\/div>/gi;
    let match;

    while ((match = dayRegex.exec(html)) !== null) {
      const dayName = match[1].trim();
      const content = match[2];

      const animeItems = [];
      const linkRegex = /<a href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
      let linkMatch;

      while ((linkMatch = linkRegex.exec(content)) !== null) {
        const title = linkMatch[2].trim();
        const url = linkMatch[1];
        const slug = this.extractSlug(url);
        const poster = this.ongoingPosterMap ? (this.ongoingPosterMap.get(slug) || '') : '';

        animeItems.push({
          title,
          url,
          slug,
          poster
        });
      }

      scheduleDays.push({
        day: dayName,
        animeList: animeItems
      });
    }

    return scheduleDays;
  }

  /**
   * Mengambil daftar genre
   */
  async getGenres() {
    const html = await this.fetchHtml('/genre-list/');
    const genres = [];

    const genreRegex = /<a href=['"](\/genres\/[^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = genreRegex.exec(html)) !== null) {
      const path = match[1];
      const name = match[2].trim();
      const slug = path.replace(/\/genres\//i, '').replace(/\//g, '');

      genres.push({
        name,
        slug,
        url: `${this.baseUrl}${path}`
      });
    }

    return genres;
  }

  /**
   * Mengambil daftar anime berdasarkan genre
   */
  async getAnimeByGenre(genreSlug, page = 1) {
    const cleanSlug = genreSlug.replace(/^\/genres\//, '').replace(/\//g, '');
    const url = page > 1 ? `/genres/${cleanSlug}/page/${page}/` : `/genres/${cleanSlug}/`;
    const html = await this.fetchHtml(url);

    const animeList = [];
    const itemRegex = /<div class=['"]col-anime['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];

      const titleMatch = block.match(/<div class=['"]col-anime-title['"][^>]*><a href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/i);
      const imgMatch = block.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
      const studioMatch = block.match(/<div class=['"]col-anime-studio['"][^>]*>([^<]+)<\/div>/i);
      const epsMatch = block.match(/<div class=['"]col-anime-eps['"][^>]*>([^<]+)<\/div>/i);
      const ratingMatch = block.match(/<div class=['"]col-anime-rating['"][^>]*>([^<]+)<\/div>/i);
      const synopsisMatch = block.match(/<div class=['"]col-synopsis['"][^>]*>([\s\S]*?)<\/div>/i);

      if (titleMatch) {
        animeList.push({
          title: titleMatch[2].trim(),
          url: titleMatch[1],
          slug: this.extractSlug(titleMatch[1]),
          poster: imgMatch ? imgMatch[1] : '',
          studio: studioMatch ? studioMatch[1].trim() : '',
          episodes: epsMatch ? epsMatch[1].trim() : '',
          rating: ratingMatch ? ratingMatch[1].trim() : '',
          synopsis: synopsisMatch ? this.cleanText(synopsisMatch[1]) : ''
        });
      }
    }

    const hasNextPage = /class=['"]next page-numbers['"]/i.test(html);

    return {
      genre: cleanSlug,
      page,
      hasNextPage,
      animeList
    };
  }

  /**
   * Mengambil daftar seluruh anime (Anime List A-Z)
   */
  async getAnimeList() {
    const html = await this.fetchHtml('/anime-list/');
    const groups = [];

    const blockRegex = /<div class=['"]bariskelom['"]>([\s\S]*?)(?=<div class=['"]bariskelom['"]|<div id=['"]footer['"]|$)/gi;
    let match;

    while ((match = blockRegex.exec(html)) !== null) {
      const block = match[1];
      const letterMatch = block.match(/<div class=['"]barispenz['"]>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
      if (!letterMatch) continue;
      const letter = letterMatch[1].trim();

      const items = [];
      const linkRegex = /<a class=['"]hodebgst['"][^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
      let lMatch;

      while ((lMatch = linkRegex.exec(block)) !== null) {
        const url = lMatch[1];
        const rawTitle = lMatch[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').trim();
        if (rawTitle) {
          items.push({
            title: rawTitle,
            url,
            slug: this.extractSlug(url)
          });
        }
      }

      if (items.length > 0) {
        groups.push({
          letter,
          items
        });
      }
    }

    return groups;
  }

  /**
   * Mencari anime berdasarkan kata kunci
   */
  async search(query) {
    if (!query || !query.trim()) return [];
    const encoded = encodeURIComponent(query.trim());
    const html = await this.fetchHtml(`/?s=${encoded}&post_type=anime`);

    const results = [];
    const liRegex = /<ul class=['"]chivsrc['"][^>]*>([\s\S]*?)<\/ul>/i;
    const containerMatch = html.match(liRegex);

    if (containerMatch) {
      const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let match;

      while ((match = itemRegex.exec(containerMatch[1])) !== null) {
        const block = match[1];

        const imgMatch = block.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
        const titleMatch = block.match(/<h2><a href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a><\/h2>/i);

        // Metadata dalam <div class="set">...
        const genresMatch = block.match(/<b>Genres<\/b>\s*:\s*([\s\S]*?)<\/div>/i);
        const statusMatch = block.match(/<b>Status<\/b>\s*:\s*([^<]+)/i);
        const ratingMatch = block.match(/<b>Rating<\/b>\s*:\s*([^<]+)/i);

        if (titleMatch) {
          results.push({
            title: titleMatch[2].trim(),
            url: titleMatch[1],
            slug: this.extractSlug(titleMatch[1]),
            poster: imgMatch ? imgMatch[1] : '',
            genres: genresMatch ? this.cleanText(genresMatch[1]) : '',
            status: statusMatch ? statusMatch[1].trim() : '',
            rating: ratingMatch ? ratingMatch[1].trim() : ''
          });
        }
      }
    }

    return results;
  }

  /**
   * Mengambil detail lengkap anime beserta daftar episode dan link batch
   */
  async getAnimeDetail(urlOrSlug) {
    let url = urlOrSlug.startsWith('http') ? urlOrSlug : `/anime/${urlOrSlug.replace(/^\/anime\//, '')}/`;

    // If an episode URL was passed, resolve its parent anime page so all episodes are available
    if (url.includes('/episode/')) {
      try {
        const epHtml = await this.fetchHtml(url);
        const parentMatch = epHtml.match(/<a[^>]+href=['"]([^'"]*\/anime\/[^'"]*)['"][^>]*>/i);
        if (parentMatch && parentMatch[1]) {
          url = parentMatch[1];
        } else {
          const epSlug = this.extractSlug(url);
          const deducedSlug = epSlug.replace(/-episode-\d+.*$/, '');
          url = `/anime/${deducedSlug}/`;
        }
      } catch (e) {
        console.warn('Gagal meresolusi parent anime dari episode URL:', e);
      }
    }

    const html = await this.fetchHtml(url);

    // Judul & Poster
    const posterMatch = html.match(/<div class=['"]fotoanime['"][^>]*>[\s\S]*?<img[^>]+src=['"]([^'"]+)['"]/i);

    // Info metadata
    const infoBlock = html.match(/<div class=['"]infozin['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    const infoText = infoBlock ? infoBlock[1] : html;

    const extractMeta = (field) => {
      const reg = new RegExp(`<b>${field}<\\/b>\\s*:\\s*([^<\\n\\r]+)`, 'i');
      const m = infoText.match(reg);
      return m ? m[1].replace(/<\/span>|<\/p>/g, '').trim() : '';
    };

    const parsedTitle = extractMeta('Judul') || (html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ? html.match(/<h1[^>]*>([^<]+)<\/h1>/i)[1] : '');
    const japaneseTitle = extractMeta('Japanese');
    const score = extractMeta('Skor');
    const producer = extractMeta('Produser');
    const type = extractMeta('Tipe');
    const status = extractMeta('Status');
    const totalEpisodes = extractMeta('Total Episode');
    const duration = extractMeta('Durasi');
    const releaseDate = extractMeta('Tanggal Rilis');
    const studio = extractMeta('Studio');

    // Genre list
    const genres = [];
    const genreBlock = infoText.match(/<b>Genre<\/b>\s*:\s*([\s\S]*?)<\/span>/i) || infoText.match(/<b>Genre<\/b>\s*:\s*([\s\S]*?)<\/p>/i);
    if (genreBlock) {
      const gRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
      let gm;
      while ((gm = gRegex.exec(genreBlock[1])) !== null) {
        genres.push({
          name: gm[2].trim(),
          slug: this.extractSlug(gm[1])
        });
      }
    }

    // Sinopsis
    const synBlock = html.match(/<div class=['"]sinopc['"][^>]*>([\s\S]*?)<\/div>/i);
    const synopsis = synBlock ? this.cleanText(synBlock[1]) : '';

    // Episode List
    const episodes = [];
    const epRegex = /<li>[\s\S]*?<span><a href=['"](https?:\/\/otakudesu\.blog\/episode\/[^'"]+)['"][^>]*>([^<]+)<\/a><\/span>(?:[\s\S]*?<span class=['"]zeebr['"][^>]*>([^<]+)<\/span>)?[\s\S]*?<\/li>/gi;
    let em;
    while ((em = epRegex.exec(html)) !== null) {
      episodes.push({
        title: em[2].trim(),
        url: em[1],
        slug: this.extractSlug(em[1]),
        date: em[3] ? em[3].trim() : ''
      });
    }

    // Cek jika ada Batch download
    let batch = null;
    const batchMatch = html.match(/<a href=['"]([^'"]*\/batch\/[^'"]+)['"][^>]*>([^<]+)<\/a>/i);
    if (batchMatch) {
      batch = {
        title: batchMatch[2].trim(),
        url: batchMatch[1],
        slug: this.extractSlug(batchMatch[1])
      };
    }

    return {
      title: parsedTitle ? parsedTitle.replace('Subtitle Indonesia', '').trim() : '',
      url,
      slug: this.extractSlug(url),
      poster: posterMatch ? posterMatch[1] : '',
      japaneseTitle,
      score,
      producer,
      type,
      status,
      totalEpisodes,
      duration,
      releaseDate,
      studio,
      genres,
      synopsis,
      episodes,
      batch
    };
  }

  /**
   * Dean Edwards p.a.c.k.e.r unpacker murni tanpa eval
   */
  unpackJs(packed) {
    if (!packed) return null;
    const match = packed.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/);
    if (!match) return null;
    let [_, p, a, c, kStr] = match;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    const k = kStr.split('|');

    const baseDecode = (val, radix) => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (radix <= 36) return val.toString(radix);
      let res = '';
      while (val > 0) {
        res = chars[val % radix] + res;
        val = Math.floor(val / radix);
      }
      return res || '0';
    };

    while (c--) {
      const token = baseDecode(c, a);
      if (k[c]) {
        p = p.replace(new RegExp('\\b' + token + '\\b', 'g'), k[c]);
      }
    }
    return p;
  }

  /**
   * Cek apakah URL streaming aktif dan merespon dengan status 200/206
   */
  async isStreamAlive(url, referer = null) {
    if (!url) return false;
    const clean = url.replace(/&amp;/g, '&');
    // Google Video blogger URLs from Otakudesu are signed with server IP and return 403 on client IP
    if (clean.includes('googlevideo.com') || clean.includes('videoplayback')) {
      return false;
    }
    let ref = referer;
    if (!ref) {
      if (clean.includes('dramiyos') || clean.includes('acek') || clean.includes('vidhide') || clean.includes('fitnessequipmentpro')) {
        ref = 'https://odvidhide.com/';
      } else if (clean.includes('vidcache') || clean.includes('yourupload')) {
        ref = 'https://www.yourupload.com/';
      }
    }
    try {
      const headers = {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        ...(ref ? { 'Referer': ref } : {})
      };
      const res = await fetch(clean, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(3500)
      });
      if (res.status === 405) {
        const getRes = await fetch(clean, {
          method: 'GET',
          headers: { ...headers, 'Range': 'bytes=0-100' },
          signal: AbortSignal.timeout(3500)
        });
        return getRes.status === 200 || getRes.status === 206;
      }
      return res.status >= 200 && res.status < 400;
    } catch (e) {
      return false;
    }
  }

  /**
   * Mengambil URL streaming langsung (MP4) dan daftar download per resolusi pada halaman episode
   */
  async getEpisodeStream(urlOrSlug) {
    const url = urlOrSlug.startsWith('http') ? urlOrSlug : `/episode/${urlOrSlug.replace(/^\/episode\//, '')}/`;
    const html = await this.fetchHtml(url);

    // 1. Ekstrak judul episode
    const titleMatch = html.match(/<h1 class=['"]posttl['"][^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1 class=['"]entry-title['"][^>]*>([^<]+)<\/h1>/i);
    const episodeTitle = titleMatch ? titleMatch[1].trim() : '';

    // 2. Ekstrak iframe embed desustream
    const iframeMatch = html.match(/<div class=['"]responsive-embed-stream['"][^>]*>[\s\S]*?<iframe[^>]+src=['"]([^'"]+)['"]/i) ||
                        html.match(/<iframe[^>]+src=['"](https?:\/\/desustream\.[^'"]+)['"]/i);

    let streamUrl = null;
    let embedUrl = iframeMatch ? iframeMatch[1] : null;

    if (embedUrl) {
      try {
        const resolved = await this.resolveStreamUrl(embedUrl);
        if (resolved && (await this.isStreamAlive(resolved))) {
          streamUrl = resolved;
        } else {
          console.warn('Embed utama tidak aktif atau mengembalikan 403, mencoba mirror...');
        }
      } catch (err) {
        console.warn('Gagal mengekstrak direct MP4 stream dari embed:', err.message);
      }
    }

    // 2b. Fallback: Ekstrak dari mirrorstream via AJAX jika embed utama gagal/kedaluwarsa
    if (!streamUrl) {
      try {
        streamUrl = await this.resolveMirrorStreamUrl(html, url);
      } catch (err) {
        console.warn('Gagal mengekstrak direct MP4 dari mirrorstream AJAX:', err.message);
      }
    }

    // 3. Ekstrak opsi download (360p, 480p, 720p, 1080p, MP4, MKV)
    const downloadOptions = [];
    const dlSection = html.match(/<div class=['"]download['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);

    if (dlSection) {
      const liRegex = /<li[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>([\s\S]*?)<\/li>/gi;
      let liMatch;

      while ((liMatch = liRegex.exec(dlSection[1])) !== null) {
        const formatQuality = liMatch[1].trim(); // contoh: "Mp4 720p", "MKV 1080p"
        const linksBlock = liMatch[2];

        // Ekstrak ukuran jika ada (contoh: 123.8 MB)
        const sizeMatch = linksBlock.match(/<i>([^<]+)<\/i>/i) || linksBlock.match(/([\d.]+\s*(?:MB|GB))/i);
        const size = sizeMatch ? sizeMatch[1].trim() : '';

        const mirrors = [];
        const aRegex = /<a href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
        let aMatch;

        while ((aMatch = aRegex.exec(linksBlock)) !== null) {
          mirrors.push({
            host: aMatch[2].trim(), // Pdrain, Acefile, GoFile, Mega, VikingFile
            url: aMatch[1]
          });
        }

        if (mirrors.length > 0) {
          downloadOptions.push({
            quality: formatQuality,
            size,
            mirrors
          });
        }
      }
    }

    // 2c. Fallback 2: Jika masih belum dapat streamUrl, coba cek mirror download Pixeldrain (direct HTTP API)
    if (!streamUrl && downloadOptions.length > 0) {
      try {
        streamUrl = await this.resolvePixeldrainStream(downloadOptions);
      } catch (err) {
        console.warn('Gagal mengekstrak stream dari mirror Pixeldrain:', err.message);
      }
    }

    // Navigasi Prev/Next
    const prevMatch = html.match(/<div class=['"]flir['"][^>]*>[\s\S]*?<a href=['"]([^'"]+)['"][^>]*>Previous Eps\.<\/a>/i);
    const nextMatch = html.match(/<div class=['"]flir['"][^>]*>[\s\S]*?<a href=['"]([^'"]+)['"][^>]*>Next Eps\.<\/a>/i);
    const allEpsMatch = html.match(/<div class=['"]flir['"][^>]*>[\s\S]*?<a href=['"]([^'"]+)['"][^>]*>See All Episodes<\/a>/i);

    // 4. Ekstrak seluruh pilihan kualitas video (1080p, 720p, 480p, 360p)
    const availableQualities = await this.extractAvailableQualities(streamUrl, downloadOptions, html, url);

    return {
      title: episodeTitle,
      url,
      streamUrl,
      embedUrl,
      availableQualities,
      currentQuality: availableQualities.length > 0 ? (availableQualities.find(q => q.isDefault)?.quality || availableQualities[0].quality) : '720p',
      downloadOptions,
      navigation: {
        prev: prevMatch ? prevMatch[1] : null,
        next: nextMatch ? nextMatch[1] : null,
        allEpisodes: allEpsMatch ? allEpsMatch[1] : null
      }
    };
  }

  /**
   * Mengambil direct MP4 stream dari server mirrorstream alternatif via Otakudesu WordPress AJAX
   */
  async resolveMirrorStreamUrl(html, pageUrl) {
    const mirrorRegex = /<li[^>]*><a[^>]+data-content=['"]([^'"]+)['"][^>]*>([^<]+)<\/a><\/li>/gi;
    let m;
    const mirrors = [];
    while ((m = mirrorRegex.exec(html)) !== null) {
      try {
        const raw = Buffer.from(m[1], 'base64').toString('utf8');
        const data = JSON.parse(raw);
        mirrors.push({
          server: m[2].trim(),
          data,
          rawContent: m[1]
        });
      } catch (e) {
        // Abaikan entri malformed
      }
    }

    if (mirrors.length === 0) return null;

    // Default action hashes untuk nonce & stream (dengan fallback ekstraksi regex dari script)
    let nonceAction = 'aa1208d27f29ca340c92c66d1926f13f';
    let streamAction = '2a3505c93b0035d3f455df82bf976b84';

    const nonceActionMatch = html.match(/data:\s*\{\s*action:\s*["']([a-f0-9]{32})["']\s*\}/i);
    if (nonceActionMatch) {
      nonceAction = nonceActionMatch[1];
    }
    const streamActionMatch = html.match(/nonce:[^,]+,\s*action:\s*["']([a-f0-9]{32})["']/i) ||
                              html.match(/action:\s*["']([a-f0-9]{32})["'],\s*nonce:/i);
    if (streamActionMatch) {
      streamAction = streamActionMatch[1];
    }

    // Ambil token nonce
    const ajaxEndpoint = `${this.baseUrl}/wp-admin/admin-ajax.php`;
    const nonceRes = await fetch(ajaxEndpoint, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': pageUrl
      },
      body: new URLSearchParams({ action: nonceAction })
    });

    if (!nonceRes.ok) return null;
    const nonceData = await nonceRes.json().catch(() => null);
    if (!nonceData || !nonceData.data) return null;
    const nonce = nonceData.data;

    // Prioritaskan mirror server berkualitas tinggi & cepat: yourupload, vidhide, odstream, arcg, ondesuvip, desu
    // Sort resolusi: 720p duluan, lalu 480p, lalu 360p
    const qualityPriority = { '720p': 3, '480p': 2, '360p': 1 };
    const preferredServers = ['yourupload', 'yuplod', 'vidhide', 'odvidhide', 'odstream', 'arcg', 'ondesuvip', 'desu'];

    const sortedMirrors = [...mirrors].sort((a, b) => {
      const qA = qualityPriority[a.data.q] || 0;
      const qB = qualityPriority[b.data.q] || 0;
      if (qB !== qA) return qB - qA;

      const sA = preferredServers.findIndex(s => a.server.toLowerCase().includes(s));
      const sB = preferredServers.findIndex(s => b.server.toLowerCase().includes(s));
      return (sA === -1 ? 99 : sA) - (sB === -1 ? 99 : sB);
    });

    // Coba sampai dapat stream yang valid dan aktif (MP4 / HLS m3u8)
    for (const mirror of sortedMirrors.slice(0, 12)) {
      try {
        const streamRes = await fetch(ajaxEndpoint, {
          method: 'POST',
          headers: {
            ...DEFAULT_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': pageUrl
          },
          body: new URLSearchParams({
            action: streamAction,
            id: mirror.data.id.toString(),
            i: mirror.data.i.toString(),
            q: mirror.data.q,
            nonce: nonce
          })
        });

        if (!streamRes.ok) continue;
        const streamJson = await streamRes.json().catch(() => null);
        if (!streamJson || !streamJson.data) continue;

        const decodedHtml = Buffer.from(streamJson.data, 'base64').toString('utf8');
        const iframeMatch = decodedHtml.match(/src=['"]([^'"]+)['"]/i);
        if (iframeMatch) {
          const directUrl = await this.resolveStreamUrl(iframeMatch[1]);
          if (directUrl) {
            let referer = null;
            if (/yourupload|yuplod/i.test(mirror.server)) referer = 'https://www.yourupload.com/';
            else if (/vidhide|odvidhide/i.test(mirror.server)) referer = 'https://odvidhide.com/';
            const alive = await this.isStreamAlive(directUrl, referer);
            if (alive) {
              return directUrl;
            }
          }
        }
      } catch (err) {
        // Coba mirror berikutnya
      }
    }

    return null;
  }

  /**
   * Helper mengekstrak direct URL file dari mirror Pixeldrain (termasuk desustream redirect)
   */
  async resolvePixeldrainUrl(mirrorUrl) {
    if (!mirrorUrl) return null;
    let directFileId = null;
    const directMatch = mirrorUrl.match(/pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9]+)/i);
    if (directMatch) {
      directFileId = directMatch[1];
    } else if (/link\.desustream\.com/i.test(mirrorUrl)) {
      try {
        const res = await fetch(mirrorUrl, { redirect: 'manual' });
        const loc = res.headers.get('location');
        if (loc) {
          const pdMatch = loc.match(/pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9]+)/i);
          if (pdMatch) directFileId = pdMatch[1];
        }
      } catch (e) {}
    }

    return directFileId ? `https://pixeldrain.com/api/file/${directFileId}` : null;
  }

  /**
   * Mengekstrak direct streaming link dari Pixeldrain download mirror (hanya jika file masih aktif/tidak 404)
   */
  async resolvePixeldrainStream(downloadOptions) {
    for (const group of downloadOptions) {
      for (const mirror of group.mirrors) {
        if (/pixeldrain|pdrain/i.test(mirror.host) || /pixeldrain\.com/i.test(mirror.url)) {
          const directUrl = await this.resolvePixeldrainUrl(mirror.url);
          if (directUrl) {
            const alive = await this.isStreamAlive(directUrl);
            if (alive) return directUrl;
          }
        }
      }
    }
    return null;
  }

  /**
   * Helper mengambil stream dari 1 mirror tertentu
   */
  async fetchSingleMirrorStream(mirror, html, pageUrl) {
    let nonceAction = 'aa1208d27f29ca340c92c66d1926f13f';
    let streamAction = '2a3505c93b0035d3f455df82bf976b84';
    const nonceActionMatch = html.match(/data:\s*\{\s*action:\s*["']([a-f0-9]{32})["']\s*\}/i);
    if (nonceActionMatch) nonceAction = nonceActionMatch[1];
    const streamActionMatch = html.match(/action:\s*["']([a-f0-9]{32})["']/i);
    if (streamActionMatch) streamAction = streamActionMatch[1];

    const ajaxEndpoint = `${this.baseUrl}/wp-admin/admin-ajax.php`;
    try {
      const nonceRes = await fetch(ajaxEndpoint, {
        method: 'POST',
        headers: {
          ...DEFAULT_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': pageUrl
        },
        body: new URLSearchParams({ action: nonceAction })
      });

      if (!nonceRes.ok) return null;
      const nonceData = await nonceRes.json().catch(() => null);
      if (!nonceData || !nonceData.data) return null;
      const nonce = nonceData.data;

      const streamRes = await fetch(ajaxEndpoint, {
        method: 'POST',
        headers: {
          ...DEFAULT_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': pageUrl
        },
        body: new URLSearchParams({
          action: streamAction,
          id: mirror.data.id.toString(),
          i: mirror.data.i.toString(),
          q: mirror.data.q,
          nonce: nonce
        })
      });

      if (!streamRes.ok) return null;
      const streamJson = await streamRes.json().catch(() => null);
      if (!streamJson || !streamJson.data) return null;

      const decodedHtml = Buffer.from(streamJson.data, 'base64').toString('utf8');
      const iframeMatch = decodedHtml.match(/src=['"]([^'"]+)['"]/i);
      if (iframeMatch) {
        const directUrl = await this.resolveStreamUrl(iframeMatch[1]);
        if (directUrl) {
          let referer = null;
          if (/yourupload|yuplod/i.test(mirror.server)) referer = 'https://www.yourupload.com/';
          else if (/vidhide|odvidhide/i.test(mirror.server)) referer = 'https://odvidhide.com/';
          const alive = await this.isStreamAlive(directUrl, referer);
          if (alive) return directUrl;
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Mengumpulkan seluruh variasi resolusi (1080p, 720p, 480p, 360p) yang dapat diputar langsung di player
   */
  async extractAvailableQualities(streamUrl, downloadOptions, html = null, pageUrl = null) {
    const qualities = [];
    const seenQualities = new Set();

    // 1. Tambahkan streamUrl utama (biasanya 720p HD direct CDN odcloud atau yourUpload atau vidhide)
    if (streamUrl) {
      const cleanStreamUrl = streamUrl.replace(/&amp;/g, '&');
      let mainLabel = '720p HD';
      let mainKey = '720p';
      if (/1080p/i.test(cleanStreamUrl)) { mainLabel = '1080p Full HD'; mainKey = '1080p'; }
      else if (/480p/i.test(cleanStreamUrl)) { mainLabel = '480p SD'; mainKey = '480p'; }
      else if (/360p/i.test(cleanStreamUrl)) { mainLabel = '360p Hemat Kuota'; mainKey = '360p'; }

      qualities.push({
        quality: mainKey,
        label: `${mainLabel} (Cepat & Stabil)`,
        streamUrl: cleanStreamUrl,
        isDefault: true,
        isMkv: /mkv/i.test(cleanStreamUrl)
      });
      seenQualities.add(mainKey);
    }

    // 2. Ekstrak variasi resolusi dari mirrorstream (misal vidhide 480p, 360p) jika belum ada
    if (html && pageUrl) {
      try {
        const mirrorRegex = /<li[^>]*><a[^>]+data-content=['"]([^'"]+)['"][^>]*>([^<]+)<\/a><\/li>/gi;
        let m;
        const mirrors = [];
        while ((m = mirrorRegex.exec(html)) !== null) {
          try {
            const data = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
            mirrors.push({ server: m[2].trim(), data, rawContent: m[1] });
          } catch(e) {}
        }

        const candidateQualities = ['720p', '480p', '360p'];
        for (const cQ of candidateQualities) {
          if (seenQualities.has(cQ)) continue;
          const matchMirror = mirrors.find(mr => mr.data.q === cQ && /vidhide|odvidhide|yourupload|yuplod|odstream/i.test(mr.server));
          if (matchMirror) {
            const directUrl = await this.fetchSingleMirrorStream(matchMirror, html, pageUrl);
            if (directUrl) {
              const labelMap = { '720p': '720p HD', '480p': '480p SD', '360p': '360p Hemat Kuota' };
              qualities.push({
                quality: cQ,
                label: `${labelMap[cQ] || cQ} (Mirror ${matchMirror.server})`,
                streamUrl: directUrl,
                isDefault: false,
                isMkv: /\.mkv/i.test(directUrl)
              });
              seenQualities.add(cQ);
            }
          }
        }
      } catch (err) {
        console.warn('Gagal mengekstrak opsi resolusi dari mirrorstream:', err.message);
      }
    }

    // 3. Ekstrak direct stream Pixeldrain untuk setiap resolusi (hanya jika link aktif/tidak 404)
    if (Array.isArray(downloadOptions)) {
      for (const group of downloadOptions) {
        let qKey = null;
        let qName = '';
        if (/1080p/i.test(group.quality)) { qKey = '1080p'; qName = '1080p Full HD'; }
        else if (/720p/i.test(group.quality)) { qKey = '720p'; qName = '720p HD'; }
        else if (/480p/i.test(group.quality)) { qKey = '480p'; qName = '480p SD'; }
        else if (/360p/i.test(group.quality)) { qKey = '360p'; qName = '360p Hemat Kuota'; }

        if (!qKey || seenQualities.has(qKey)) continue;

        for (const mirror of (group.mirrors || [])) {
          if (/pixeldrain|pdrain/i.test(mirror.host)) {
            const rawDirectUrl = await this.resolvePixeldrainUrl(mirror.url);
            if (rawDirectUrl) {
              const directUrl = rawDirectUrl.replace(/&amp;/g, '&');
              const alive = await this.isStreamAlive(directUrl);
              if (alive) {
                const isMkv = /mkv/i.test(group.quality) || /\.mkv/i.test(directUrl);
                qualities.push({
                  quality: qKey,
                  label: `${qName} (${group.size || 'Direct'})${isMkv ? ' (MKV Remux)' : ''}`,
                  streamUrl: directUrl,
                  isDefault: false,
                  isMkv
                });
                seenQualities.add(qKey);
                break;
              }
            }
          }
        }
      }
    }

    // Urutkan kualitas: 1080p paling atas, lalu 720p, 480p, 360p
    const order = { '1080p': 4, '720p': 3, '480p': 2, '360p': 1 };
    qualities.sort((a, b) => (order[b.quality] || 0) - (order[a.quality] || 0));

    return qualities;
  }

  /**
   * Mengekstrak direct MP4 URL dari desustream embed atau provider pihak ketiga
   */
  async resolveStreamUrl(embedUrl) {
    if (!embedUrl) return null;

    // Khusus host vidhide / odvidhide embed (HLS m3u8)
    if (embedUrl.includes('odvidhide.com') || embedUrl.includes('vidhide')) {
      try {
        const vhRes = await fetch(embedUrl, {
          headers: {
            ...DEFAULT_HEADERS,
            'Referer': this.baseUrl
          }
        });
        if (vhRes.ok) {
          const vhHtml = await vhRes.text();
          const packedMatch = vhHtml.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
          if (packedMatch) {
            const unpacked = this.unpackJs(packedMatch[0]);
            if (unpacked) {
              const m3u8Match = unpacked.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
              if (m3u8Match) {
                return m3u8Match[0].replace(/&amp;/g, '&');
              }
            }
          }
        }
      } catch (err) {
        console.warn('Gagal mengekstrak HLS stream dari vidhide:', err.message);
      }
    }

    // Khusus host yourupload & desudrive embed
    if (embedUrl.includes('desudrive.com') || embedUrl.includes('yourupload.com')) {
      try {
        let yuUrl = embedUrl;
        if (embedUrl.includes('desudrive.com')) {
          const yuRes = await fetch(embedUrl, {
            headers: { ...DEFAULT_HEADERS, 'Referer': this.baseUrl }
          });
          if (yuRes.ok) {
            const yuHtml = await yuRes.text();
            const ifm = yuHtml.match(/src=['"]([^'"]*yourupload\.com\/embed\/[^'"]+)['"]/i);
            if (ifm) yuUrl = ifm[1];
          }
        }
        if (yuUrl.includes('yourupload.com')) {
          const actualRes = await fetch(yuUrl, {
            headers: { ...DEFAULT_HEADERS, 'Referer': 'https://desudrive.com/' }
          });
          if (actualRes.ok) {
            const actualHtml = await actualRes.text();
            const vidMatch = actualHtml.match(/file\s*:\s*['"]([^'"]+\.mp4[^'"]*)['"]/i) ||
                             actualHtml.match(/<video[^>]+src=['"]([^'"]+)['"]/i) ||
                             actualHtml.match(/<source[^>]+src=['"]([^'"]+)['"]/i);
            if (vidMatch) {
              return vidMatch[1].replace(/&amp;/g, '&');
            }
          }
        }
      } catch (err) {
        console.warn('Gagal mengekstrak direct stream dari yourupload:', err.message);
      }
    }

    const res = await fetch(embedUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'Referer': this.baseUrl
      }
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Pola 1: const videoURL = "https://cdn.odcloud.net/anime/...mp4";
    const videoUrlMatch = html.match(/const\s+videoURL\s*=\s*["']([^"']+)["']/i);
    if (videoUrlMatch) {
      return videoUrlMatch[1].replace(/&amp;/g, '&');
    }

    // Pola 2: <source src="..." type="video/mp4">
    const sourceMatch = html.match(/<source[^>]+src=['"]([^'"]+)['"]/i);
    if (sourceMatch) {
      return sourceMatch[1].replace(/&amp;/g, '&');
    }

    // Pola 3: file: "..." atau sources: [{file: "..."}]
    const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i);
    if (fileMatch) {
      return fileMatch[1].replace(/&amp;/g, '&');
    }

    return null;
  }

  /**
   * Mengambil link download Batch untuk anime yang telah tamat
   */
  async getBatchDetails(urlOrSlug) {
    const url = urlOrSlug.startsWith('http') ? urlOrSlug : `/batch/${urlOrSlug.replace(/^\/batch\//, '')}/`;
    const html = await this.fetchHtml(url);

    const titleMatch = html.match(/<h1 class=['"]posttl['"][^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1 class=['"]entry-title['"][^>]*>([^<]+)<\/h1>/i);

    const batchOptions = [];
    const dlSection = html.match(/<div class=['"]download['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ||
                      html.match(/<div class=['"]batchlink['"][^>]*>([\s\S]*?)<\/div>/i);

    if (dlSection) {
      const liRegex = /<li[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>([\s\S]*?)<\/li>/gi;
      let liMatch;

      while ((liMatch = liRegex.exec(dlSection[1])) !== null) {
        const quality = liMatch[1].trim();
        const linksBlock = liMatch[2];

        const sizeMatch = linksBlock.match(/<i>([^<]+)<\/i>/i) || linksBlock.match(/([\d.]+\s*(?:MB|GB))/i);
        const size = sizeMatch ? sizeMatch[1].trim() : '';

        const mirrors = [];
        const aRegex = /<a href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
        let aMatch;

        while ((aMatch = aRegex.exec(linksBlock)) !== null) {
          mirrors.push({
            host: aMatch[2].trim(),
            url: aMatch[1]
          });
        }

        if (mirrors.length > 0) {
          batchOptions.push({
            quality,
            size,
            mirrors
          });
        }
      }
    }

    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      url,
      batchOptions
    };
  }

  /**
   * Helper mengekstrak slug dari URL
   */
  extractSlug(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url, this.baseUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch (e) {
      const cleaned = url.replace(/\/$/, '');
      const parts = cleaned.split('/');
      return parts[parts.length - 1] || '';
    }
  }

  cleanText(str) {
    if (!str) return '';
    return str
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  }
}

module.exports = new OtakudesuService();
