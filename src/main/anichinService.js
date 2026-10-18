/**
 * Ani-Chin Integration Service
 * Scraper & API Client for https://ani-chin.id/
 * Handles Donghua ongoing releases, weekly schedule, A-Z directory,
 * series details, streaming extraction (OK.ru, VidHide, etc.), and download mirrors.
 */

const https = require('https');
const http = require('http');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

class AnichinService {
  constructor() {
    this.baseUrl = 'https://ani-chin.id';
    this.cache = {
      ongoing: null,
      ongoingTimestamp: 0,
      schedule: null,
      scheduleTimestamp: 0,
      animeList: null,
      animeListTimestamp: 0
    };
    this.CACHE_TTL = 10 * 60 * 1000; // 10 menit
  }

  cleanText(str) {
    if (!str) return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractSlug(url) {
    if (!url) return '';
    try {
      const u = new URL(url, this.baseUrl);
      const parts = u.pathname.replace(/\/$/, '').split('/');
      return parts.pop() || '';
    } catch (e) {
      const clean = url.replace(/\/$/, '');
      const parts = clean.split('/');
      return parts.pop() || '';
    }
  }

  unpackJs(packed) {
    try {
      const match = packed.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
      if (!match) return null;

      let code = match[0];
      code = code.replace(/^eval/, '');
      const unpacked = new Function('return ' + code)();
      return typeof unpacked === 'string' ? unpacked : null;
    } catch (e) {
      return null;
    }
  }

  async fetchHtml(url, customHeaders = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const res = await fetch(fullUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'Referer': this.baseUrl,
        ...customHeaders
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal memuat halaman Ani-Chin (${res.status}): ${fullUrl}`);
    }

    return await res.text();
  }

  /**
   * 1. Mengambil Donghua Sedang Tayang (Ongoing / Latest Updates)
   */
  async getOngoing(page = 1) {
    if (page === 1 && this.cache.ongoing && Date.now() - this.cache.ongoingTimestamp < this.CACHE_TTL) {
      return this.cache.ongoing;
    }

    const url = page > 1 ? `/anime?page=${page}` : '/';
    const html = await this.fetchHtml(url);

    const items = [];
    // Match articles in .listupd
    const articleRegex = /<article[^>]+class=['"]bs[^'"]*['"][\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]+title=['"]([^'"]+)['"][\s\S]*?<img[^>]+src=['"]([^'"]+)['"][\s\S]*?<\/article>/gi;
    let m;
    while ((m = articleRegex.exec(html)) !== null) {
      const rawUrl = m[1];
      const rawTitle = m[2];
      const rawPoster = m[3];

      // Extract episode string if available
      const epMatch = m[0].match(/<span[^>]*class=['"]epx['"][^>]*>([\s\S]*?)<\/span>/i);
      const typeMatch = m[0].match(/<div[^>]*class=['"]typez[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i);

      items.push({
        title: this.cleanText(rawTitle),
        url: rawUrl,
        slug: this.extractSlug(rawUrl),
        poster: rawPoster,
        latestEpisode: epMatch ? this.cleanText(epMatch[1]) : 'Donghua',
        type: typeMatch ? this.cleanText(typeMatch[1]) : 'Donghua',
        source: 'anichin',
        isDonghua: true
      });
    }

    const result = {
      page,
      animeList: items,
      source: 'anichin'
    };

    if (page === 1) {
      this.cache.ongoing = result;
      this.cache.ongoingTimestamp = Date.now();
    }

    return result;
  }

  /**
   * 2. Mengambil Jadwal Rilis Mingguan Donghua (Schedule)
   */
  async getSchedule() {
    if (this.cache.schedule && Date.now() - this.cache.scheduleTimestamp < this.CACHE_TTL) {
      return this.cache.schedule;
    }

    const html = await this.fetchHtml('/schedule');
    const schedule = [];

    const daySections = [
      { key: 'monday', label: 'Senin', en: 'Monday' },
      { key: 'tuesday', label: 'Selasa', en: 'Tuesday' },
      { key: 'wednesday', label: 'Rabu', en: 'Wednesday' },
      { key: 'thursday', label: 'Kamis', en: 'Thursday' },
      { key: 'friday', label: 'Jumat', en: 'Friday' },
      { key: 'saturday', label: 'Sabtu', en: 'Saturday' },
      { key: 'sunday', label: 'Minggu', en: 'Sunday' }
    ];

    daySections.forEach(({ key, label, en }) => {
      const regex = new RegExp(`class=['"]bixbox schedulepage sch_${key}['"][\\s\\S]*?class=['"]bixbox schedulepage|class=['"]bixbox schedulepage sch_${key}['"][\\s\\S]*?<div id=['"]footer['"]`, 'i');
      const blockMatch = html.match(regex);
      const blockHtml = blockMatch ? blockMatch[0] : '';

      const animeList = [];
      const itemRegex = /<div[^>]+class=['"]bsx['"][\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]+title=['"]([^'"]+)['"][\s\S]*?<img[^>]+src=['"]([^'"]+)['"][\s\S]*?<\/div>/gi;
      let m;
      while ((m = itemRegex.exec(blockHtml)) !== null) {
        const url = m[1];
        const title = this.cleanText(m[2]);
        const poster = m[3];
        const epMatch = m[0].match(/<span[^>]*class=['"]epx['"][^>]*>([\s\S]*?)<\/span>/i);

        animeList.push({
          title,
          url,
          slug: this.extractSlug(url),
          poster,
          episode: epMatch ? this.cleanText(epMatch[1]) : 'Donghua',
          source: 'anichin',
          isDonghua: true
        });
      }

      schedule.push({
        day: label,
        dayEn: en,
        animeList
      });
    });

    this.cache.schedule = schedule;
    this.cache.scheduleTimestamp = Date.now();
    return schedule;
  }

  /**
   * 3. Mengambil Direktori Abjad A-Z Ani-Chin
   */
  async getAnimeList() {
    if (this.cache.animeList && Date.now() - this.cache.animeListTimestamp < this.CACHE_TTL) {
      return this.cache.animeList;
    }

    const alphabetLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0-9', '.'];
    const groups = [];

    // Ambil data untuk setiap huruf yang memiliki entri
    // Batasi concurrent requests agar tidak membebani server
    for (const letter of alphabetLetters) {
      try {
        const url = `/az-list/${letter}`;
        const html = await this.fetchHtml(url);

        const items = [];
        const cardRegex = /<article[^>]+class=['"]bs[^'"]*['"][\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/article>/gi;
        let m;
        while ((m = cardRegex.exec(html)) !== null) {
          const rawUrl = m[1];
          if (!rawUrl.includes('/anime/')) continue;

          const titleMatch = m[0].match(/<div class=['"]tt['"][^>]*>([\s\S]*?)<\/div>/i) ||
                             m[0].match(/title=['"]([^'"]+)['"]/i);
          let rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
          rawTitle = rawTitle.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

          const posterMatch = m[0].match(/<img[^>]+src=['"]([^'"]+)['"]/i);

          if (rawTitle && rawUrl) {
            items.push({
              title: this.cleanText(rawTitle),
              url: rawUrl,
              slug: this.extractSlug(rawUrl),
              poster: posterMatch ? posterMatch[1] : '',
              source: 'anichin',
              isDonghua: true
            });
          }
        }

        const displayLetter = letter === '.' ? '#' : letter;
        if (items.length > 0) {
          groups.push({
            letter: displayLetter,
            items
          });
        }
      } catch (err) {
        console.warn(`[Ani-Chin] Gagal memuat az-list/${letter}:`, err.message);
      }
    }

    this.cache.animeList = groups;
    this.cache.animeListTimestamp = Date.now();
    return groups;
  }

  /**
   * 4. Mengambil Detail Donghua (Informasi & Daftar Episode)
   */
  async getDetail(urlOrSlug) {
    if (!urlOrSlug) throw new Error('Parameter urlOrSlug tidak boleh kosong');

    let html = null;
    let url = '';

    // 1. Jika sudah berupa full URL:
    if (typeof urlOrSlug === 'string' && urlOrSlug.startsWith('http')) {
      try {
        html = await this.fetchHtml(urlOrSlug);
        if (html) url = urlOrSlug;
      } catch (err) {
        console.warn(`[Ani-Chin] Gagal memuat URL langsung (${urlOrSlug}):`, err.message);
      }
    }

    // 2. Jika belum berupa full URL atau fetch awal gagal: coba kandidat URL
    if (!html) {
      const cleanSlug = typeof urlOrSlug === 'string'
        ? urlOrSlug.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/+$/, '')
        : String(urlOrSlug);

      const candidateUrls = [
        // a. Coba /anime/<slug>
        cleanSlug.startsWith('anime/') ? `${this.baseUrl}/${cleanSlug}` : `${this.baseUrl}/anime/${cleanSlug}`,
        // b. Jika slug mengandung -episode-, coba potong suffix episode untuk dapatkan parent series
        ...(cleanSlug.includes('-episode-') ? [
          `${this.baseUrl}/anime/${cleanSlug.replace(/-episode-\d+.*$/, '')}`,
          `${this.baseUrl}/${cleanSlug}`
        ] : []),
        // c. Coba langsung /<slug>
        `${this.baseUrl}/${cleanSlug}`
      ];

      for (const candUrl of candidateUrls) {
        try {
          html = await this.fetchHtml(candUrl);
          if (html) {
            url = candUrl;
            break;
          }
        } catch (e) {
          // lanjut ke kandidat berikutnya
        }
      }
    }

    // 3. Fallback: cari anime berdasarkan judul / slug jika semua kandidat 404
    if (!html) {
      const searchKeyword = String(urlOrSlug)
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/\/anime\//i, '')
        .replace(/-episode-\d+.*$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

      if (searchKeyword) {
        try {
          const searchResults = await this.search(searchKeyword);
          if (searchResults && searchResults.length > 0) {
            const firstMatch = searchResults[0];
            if (firstMatch && firstMatch.url && firstMatch.url !== urlOrSlug) {
              return await this.getDetail(firstMatch.url);
            }
          }
        } catch (searchErr) {
          console.warn('[Ani-Chin] Fallback search getDetail gagal:', searchErr.message);
        }
      }
    }

    if (!html) {
      throw new Error(`Data series donghua tidak ditemukan untuk: ${urlOrSlug}`);
    }

    // Jika URL adalah link episode atau tidak memiliki .eplister, cari link halaman series utamanya
    // agar seluruh episode lengkap (bisa ratusan episode) dari .eplister dapat dimuat
    if (!html.includes('class="eplister"') && !html.includes("class='eplister'")) {
      const seriesLinkMatch = html.match(/<a[^>]+href=['"](https:\/\/ani-chin\.id\/anime\/[^'"]+)['"][^>]*>/i) ||
                              html.match(/<a[^>]+href=['"](\/anime\/[^'"]+)['"][^>]*>/i) ||
                              html.match(/<div class=['"]allinfo['"][^>]*>[\s\S]*?<a[^>]+href=['"]([^'"]+)['"]/i);
      if (seriesLinkMatch) {
        const seriesUrl = seriesLinkMatch[1].startsWith('http') ? seriesLinkMatch[1] : `${this.baseUrl}${seriesLinkMatch[1]}`;
        try {
          const seriesHtml = await this.fetchHtml(seriesUrl);
          if (seriesHtml && (seriesHtml.includes('class="eplister"') || seriesHtml.includes("class='eplister'"))) {
            html = seriesHtml;
            url = seriesUrl;
          }
        } catch (err) {
          console.warn('[Ani-Chin] Gagal mengambil halaman utama series:', err.message);
        }
      }
    }

    // Judul
    const titleMatch = html.match(/<h1[^>]*class=['"]entry-title['"][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<meta property=['"]og:title['"] content=['"]([^'"]+)['"]/i);
    const title = titleMatch ? this.cleanText(titleMatch[1].replace(/Subtitle Indonesia.*$/i, '')) : 'Donghua Ani-Chin';

    // Poster
    const posterMatch = html.match(/<div[^>]*class=['"]thumb['"][^>]*>\s*<img[^>]+src=['"]([^'"]+)['"]/i) ||
                        html.match(/<meta property=['"]og:image['"] content=['"]([^'"]+)['"]/i);
    const poster = posterMatch ? posterMatch[1] : '';

    // Sinopsis
    const synMatch = html.match(/<div[^>]*class=['"]desc mindes['"][^>]*>([\s\S]*?)<\/div>/i) ||
                     html.match(/<div[^>]*class=['"]entry-content['"][^>]*>([\s\S]*?)<\/div>/i);
    const synopsis = synMatch ? this.cleanText(synMatch[1].replace(/<[^>]+>/g, '')) : 'Tidak ada sinopsis.';

    // Rating
    const rateMatch = html.match(/Rating\s*([0-9.]+)/i) || html.match(/<div class=['"]numscore['"][^>]*>([0-9.]+)<\/div>/i);
    const score = rateMatch ? rateMatch[1] : '8.5';

    // Status & Genres
    const statusMatch = html.match(/<b>Status:<\/b>\s*([^<]+)/i);
    const status = statusMatch ? this.cleanText(statusMatch[1]) : 'Ongoing';

    const genreMatches = [];
    const genxedMatch = html.match(/<div[^>]*class=['"][^'"]*genxed[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i);
    const genreHtmlScope = genxedMatch ? genxedMatch[1] : html;
    const genreRegex = /<a[^>]+href=['"]https:\/\/ani-chin\.id\/genres\/([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let gm;
    while ((gm = genreRegex.exec(genreHtmlScope)) !== null) {
      const gName = this.cleanText(gm[2]);
      if (gName) {
        genreMatches.push({
          name: gName,
          slug: this.extractSlug(gm[1]) || gName.toLowerCase()
        });
      }
    }
    const genres = genreMatches.length > 0 ? genreMatches : [
      { name: 'Donghua', slug: 'donghua' },
      { name: 'Action', slug: 'action' },
      { name: 'Fantasy', slug: 'fantasy' }
    ];

    // Daftar Episode dari .eplister
    const episodes = [];
    const eplisterMatch = html.match(/<div[^>]*class=['"]eplister['"][\s\S]*?<\/ul>/i);
    const searchScope = eplisterMatch ? eplisterMatch[0] : html;

    const epRegex = /<li[^>]*data-index=['"]([^'"]+)['"][^>]*>[\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]*>[\s\S]*?<div[^>]+class=['"]epl-num['"][^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]+class=['"]epl-title['"][^>]*>([\s\S]*?)<\/div>/gi;
    let em;
    while ((em = epRegex.exec(searchScope)) !== null) {
      episodes.push({
        index: em[1],
        url: em[2],
        slug: this.extractSlug(em[2]),
        episodeNumber: em[3].trim(),
        title: this.cleanText(em[4]) || `${title} Episode ${em[3].trim()}`,
        source: 'anichin'
      });
    }

    // Fallback jika tidak ada data-index: cari semua link episode
    if (episodes.length === 0) {
      const epFallbackRegex = /<a[^>]+href=['"](https:\/\/ani-chin\.id\/[a-z0-9-]+-episode-[0-9]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
      let efm;
      const seen = new Set();
      while ((efm = epFallbackRegex.exec(html)) !== null) {
        const epUrl = efm[1];
        if (!seen.has(epUrl)) {
          seen.add(epUrl);
          const epSlug = this.extractSlug(epUrl);
          const numMatch = epSlug.match(/episode-([0-9]+)/i);
          const num = numMatch ? numMatch[1] : (episodes.length + 1).toString();
          episodes.push({
            index: (episodes.length + 1).toString(),
            url: epUrl,
            slug: epSlug,
            episodeNumber: num,
            title: `${title} Episode ${num}`,
            source: 'anichin'
          });
        }
      }
    }

    // Urutkan episode mulai dari episode 1 (ascending)
    episodes.sort((a, b) => {
      const numA = parseFloat(a.episodeNumber) || 0;
      const numB = parseFloat(b.episodeNumber) || 0;
      return numA - numB;
    });

    return {
      title,
      japanese: 'Chinese Donghua',
      poster,
      score,
      status,
      type: 'Donghua',
      genres,
      synopsis,
      episodes,
      source: 'anichin',
      isDonghua: true
    };
  }

  /**
   * 5. Helper mengambil data server dan download dari API resmi Ani-Chin
   */
  async getEpisodeServers(episodeId, refererUrl = '') {
    if (!episodeId) return null;
    const apiUrl = `https://ani-chin.id/api/theme/episode/servers?episodeId=${encodeURIComponent(episodeId)}`;
    const res = await fetch(apiUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'Referer': refererUrl || this.baseUrl,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!res.ok) {
      throw new Error(`API servers Ani-Chin merespons HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * 6. Helper menyelesaikan hash server menjadi URL embed / stream
   */
  async resolveServerHash(hash, refererUrl = '') {
    if (!hash) return null;
    const apiUrl = `https://ani-chin.id/api/theme/episode/source?get=${encodeURIComponent(hash)}`;
    const res = await fetch(apiUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'Referer': refererUrl || this.baseUrl,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * 7. Ekstrak streaming langsung (OK.ru / VidHide) dan mirror unduhan dari episode Ani-Chin
   */
  async getEpisodeStream(urlOrSlug) {
    let url = urlOrSlug;
    if (!url.startsWith('http')) {
      url = `${this.baseUrl}/${urlOrSlug}`;
    }

    const html = await this.fetchHtml(url);

    // Ambil episodeId dari data-episode
    const epIdMatch = html.match(/id=['"]as-servers['"][^>]+data-episode=['"]([^'"]+)['"]/i) ||
                      html.match(/data-episode=['"]([^'"]+)['"]/i);
    const episodeId = epIdMatch ? epIdMatch[1] : null;

    if (!episodeId) {
      throw new Error('Episode ID tidak ditemukan di halaman Ani-Chin.');
    }

    const serverData = await this.getEpisodeServers(episodeId, url);
    const serverHtml = (serverData && serverData.html) || '';
    const downloadHtml = (serverData && serverData.downloads) || '';

    // Parse list server
    const serverRegex = /<div class=['"]server-item['"]>\s*<a[^>]+data-hash=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let sm;
    const availableServers = [];
    while ((sm = serverRegex.exec(serverHtml)) !== null) {
      availableServers.push({
        hash: sm[1],
        name: this.cleanText(sm[2])
      });
    }

    // Resolusi server utama (Prioritas: OK.ru, VidHide, Abyss, Rumble)
    let streamUrl = null;
    let streamType = 'hls';
    let chosenServerName = '';
    const resolvedMirrors = [];

    // Cari server prioritas terlebih dahulu
    const sortedServers = [...availableServers].sort((a, b) => {
      const getScore = (name) => {
        if (/ok\.ru/i.test(name)) return 1000;
        if (/vidhide/i.test(name)) return 900;
        if (/abyss/i.test(name)) return 800;
        if (/rumble/i.test(name)) return 700;
        return 500;
      };
      return getScore(b.name) - getScore(a.name);
    });

    for (const server of sortedServers) {
      try {
        const srcRes = await this.resolveServerHash(server.hash, url);
        if (srcRes && srcRes.url) {
          resolvedMirrors.push({
            name: server.name,
            embedUrl: srcRes.url,
            type: srcRes.type || 'iframe'
          });

          // Coba ekstrak direct stream jika belum dapat
          if (!streamUrl) {
            // A. OK.ru direct HLS / MP4
            if (/ok\.ru\/videoembed/i.test(srcRes.url)) {
              const okRes = await fetch(srcRes.url, { headers: { ...DEFAULT_HEADERS, 'Referer': this.baseUrl } });
              if (okRes.ok) {
                const okHtml = await okRes.text();
                const optMatch = okHtml.match(/data-options="([^"]+)"/);
                if (optMatch) {
                  const raw = optMatch[1].replace(/&quot;/g, '"');
                  const opt = JSON.parse(raw);
                  const meta = typeof opt.flashvars?.metadata === 'string' ? JSON.parse(opt.flashvars.metadata) : opt.flashvars?.metadata;
                  if (meta && meta.hlsManifestUrl) {
                    streamUrl = meta.hlsManifestUrl;
                    streamType = 'hls';
                    chosenServerName = server.name;
                  } else if (meta && Array.isArray(meta.videos) && meta.videos.length > 0) {
                    const best = meta.videos.find(v => v.name === 'full' || v.name === 'hd') || meta.videos[meta.videos.length - 1];
                    if (best && best.url) {
                      streamUrl = best.url;
                      streamType = 'direct';
                      chosenServerName = server.name;
                    }
                  }
                }
              }
            }

            // B. VidHide packed m3u8
            if (!streamUrl && (/morencius\.com|vidhide/i.test(srcRes.url))) {
              const vhRes = await fetch(srcRes.url, { headers: { ...DEFAULT_HEADERS, 'Referer': this.baseUrl } });
              if (vhRes.ok) {
                const vhHtml = await vhRes.text();
                const packedMatch = vhHtml.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
                if (packedMatch) {
                  const unpacked = this.unpackJs(packedMatch[0]);
                  if (unpacked) {
                    const m3u8Match = unpacked.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
                    if (m3u8Match) {
                      streamUrl = m3u8Match[0].replace(/&amp;/g, '&');
                      streamType = 'hls';
                      chosenServerName = server.name;
                    }
                  }
                }
              }
            }

            // C. Fallback iframe embed jika direct stream belum ditemukan
            if (!streamUrl && srcRes.url) {
              streamUrl = srcRes.url;
              streamType = 'iframe';
              chosenServerName = server.name;
            }
          }
        }
      } catch (err) {
        console.warn(`[Ani-Chin] Gagal menyelesaikan server ${server.name}:`, err.message);
      }
    }

    // Parse download packages dari downloadHtml
    const downloadOptions = [];
    const soraRegex = /<div class=['"]soraurlx['"]>[\s\S]*?<strong>([^<]+)<\/strong>([\s\S]*?)<\/div>/gi;
    let dm;
    while ((dm = soraRegex.exec(downloadHtml)) !== null) {
      const quality = this.cleanText(dm[1]);
      const linkBlock = dm[2];

      const linkRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
      let lm;
      const mirrors = [];
      while ((lm = linkRegex.exec(linkBlock)) !== null) {
        const linkUrl = lm[1];
        const host = this.cleanText(lm[2]);
        mirrors.push({ host, url: linkUrl });
      }

      if (mirrors.length > 0) {
        downloadOptions.push({
          quality,
          mirrors
        });
      }
    }

    return {
      streamUrl: streamUrl || (resolvedMirrors[0] ? resolvedMirrors[0].embedUrl : null),
      streamType: streamType || 'hls',
      chosenServer: chosenServerName,
      availableServers: resolvedMirrors,
      downloadOptions,
      source: 'anichin'
    };
  }

  /**
   * 8. Pencarian Donghua di Ani-Chin
   */
  async search(query) {
    if (!query) return [];
    const url = `/?s=${encodeURIComponent(query)}`;
    const html = await this.fetchHtml(url);

    const results = [];
    const articleRegex = /<article[^>]+class=['"]bs[^'"]*['"][\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]+title=['"]([^'"]+)['"][\s\S]*?<img[^>]+src=['"]([^'"]+)['"][\s\S]*?<\/article>/gi;
    let m;
    while ((m = articleRegex.exec(html)) !== null) {
      const rawUrl = m[1];
      const rawTitle = m[2];
      const rawPoster = m[3];

      const typeMatch = m[0].match(/<div[^>]+class=['"]typez[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i);
      const epMatch = m[0].match(/<span[^>]+class=['"]epx['"][^>]*>([\s\S]*?)<\/span>/i);

      results.push({
        title: this.cleanText(rawTitle),
        url: rawUrl,
        slug: this.extractSlug(rawUrl),
        poster: rawPoster,
        type: typeMatch ? this.cleanText(typeMatch[1]) : 'Donghua',
        latestEpisode: epMatch ? this.cleanText(epMatch[1]) : 'Donghua',
        source: 'anichin',
        isDonghua: true
      });
    }

    return results;
  }
}

module.exports = new AnichinService();

