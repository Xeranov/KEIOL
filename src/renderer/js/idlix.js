/**
 * Idlix Module for VidPlayer
 * Manages Movie and TV Series streaming catalogs, details, search,
 * season/episode selectors, and background smart pre-unlocking.
 */

class IdlixManager {
  constructor() {
    this.player = null;
    this.library = null;
    this.serverPort = 9876;

    // Active navigation state
    this.currentSubTab = 'all'; // 'all' | 'movies' | 'series' | 'trending'
    this.currentGenre = '';
    this.searchQuery = '';
    this.activeDetailContent = null;
    this.activeSeasonNumber = 1;

    // Carousel state
    this.billboardItems = [];
    this.billboardIndex = 0;
    this.billboardTimer = null;
    this.billboardContent = null;

    // Playback and progress tracking
    this.currentPlaying = null;
    this.lastSavedProgressTime = 0;

    // Cache and pre-unlocking store
    this.preUnlockedSessions = new Map();
    this.activeUnlockInterval = null;
    this.searchDebounceTimer = null;
    this.rowTracks = [];

    // Bookmarks store (persisted in localStorage)
    this.bookmarks = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem('vidplayer_idlix_bookmarks') || '[]');
      if (Array.isArray(saved)) this.bookmarks = new Set(saved);
    } catch (e) {}

    // DOM Elements
    this.tabIdlix = null;
    this.idlixSection = null;
    this.billboardEl = null;
    this.dynamicContainer = null;
    this.detailContainer = null;
    this.genreSelect = null;
    this.searchStatus = null;
    this.searchText = null;
    this.unlockOverlay = null;
    this.quickSpinner = null;
    this.btnBillboardPrev = null;
    this.btnBillboardNext = null;
    this.billboardDotsEl = null;

    // Bindings
    this.handleSearch = this.handleSearch.bind(this);
    this.nextBillboard = this.nextBillboard.bind(this);
    this.prevBillboard = this.prevBillboard.bind(this);
  }

  async init(playerCore, libraryManager) {
    this.player = playerCore;
    this.library = libraryManager;

    if (window.electronAPI?.getServerPort) {
      try {
        this.serverPort = await window.electronAPI.getServerPort();
      } catch (e) {
        console.warn('Could not retrieve media server port:', e);
      }
    }

    this.cacheDomElements();
    this.bindEvents();
    this.loadGenreOptions();

    // Load initial all-in-one Netflix multi-row catalog
    await this.loadCatalog(this.currentSubTab);
  }

  cacheDomElements() {
    this.tabIdlix = document.getElementById('tabIdlix');
    this.idlixSection = document.getElementById('idlixSection');
    this.billboardEl = document.getElementById('idlixBillboard');
    this.dynamicContainer = document.getElementById('idlixDynamicContainer');
    this.detailContainer = document.getElementById('idlixDetailContainer');
    this.genreSelect = document.getElementById('selectIdlixGenre');
    this.searchStatus = document.getElementById('idlixSearchStatus');
    this.searchText = document.getElementById('idlixSearchText');
    this.unlockOverlay = document.getElementById('idlixUnlockOverlay');
    this.quickSpinner = document.getElementById('idlixQuickSpinner');
    this.btnBillboardPrev = document.getElementById('btnIdlixBillboardPrev');
    this.btnBillboardNext = document.getElementById('btnIdlixBillboardNext');
    this.billboardDotsEl = document.getElementById('idlixBillboardDots');
  }

  bindEvents() {
    // Sub-navigation pills
    const pills = this.idlixSection?.querySelectorAll('.web-pill-btn[data-sub]');
    pills?.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const sub = e.currentTarget.getAttribute('data-sub');
        this.switchSubTab(sub);
      });
    });

    // Genre filter dropdown
    if (this.genreSelect) {
      this.genreSelect.addEventListener('change', () => {
        this.currentGenre = this.genreSelect.value;
        this.loadCatalog(this.currentSubTab, { genre: this.currentGenre });
      });
    }

    // Clear search button
    const btnClearSearch = document.getElementById('btnClearIdlixSearch');
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        this.clearSearch();
      });
    }

    // Billboard carousel navigation arrows
    if (this.btnBillboardPrev) {
      this.btnBillboardPrev.addEventListener('click', () => {
        this.prevBillboard();
      });
    }
    if (this.btnBillboardNext) {
      this.btnBillboardNext.addEventListener('click', () => {
        this.nextBillboard();
      });
    }

    // Billboard action buttons
    const btnPlayBillboard = document.getElementById('btnIdlixBillboardPlay');
    const btnInfoBillboard = document.getElementById('btnIdlixBillboardDetail');

    if (btnPlayBillboard) {
      btnPlayBillboard.addEventListener('click', () => {
        if (this.billboardContent) {
          this.playContent(this.billboardContent);
        }
      });
    }

    if (btnInfoBillboard) {
      btnInfoBillboard.addEventListener('click', () => {
        if (this.billboardContent) {
          this.openDetail(this.billboardContent);
        }
      });
    }

    // Pause billboard auto-advance on mouse hover
    if (this.billboardEl) {
      this.billboardEl.addEventListener('mouseenter', () => this.pauseBillboard());
      this.billboardEl.addEventListener('mouseleave', () => this.resumeBillboard());
    }

    // Cancel unlock button
    const btnCancelUnlock = document.getElementById('btnCancelIdlixUnlock');
    if (btnCancelUnlock) {
      btnCancelUnlock.addEventListener('click', () => {
        this.cancelUnlock();
      });
    }

    // Context-Aware Toolbar Search
    const searchInput = document.getElementById('inputSearchAnime');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (this.library && this.library.activeNav === 'idlix') {
          const q = (e.target.value || '').trim();
          clearTimeout(this.searchDebounceTimer);
          this.searchDebounceTimer = setTimeout(() => {
            if (q.length >= 2) {
              this.handleSearch(q);
            } else if (q.length === 0) {
              this.clearSearch();
            }
          }, 350);
        }
      });
    }

    // Keyboard ESC to close detail
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.detailContainer && !this.detailContainer.classList.contains('hidden')) {
        this.closeDetail();
      }
    });

    // Real-time watch progress tracking for continue watching
    window.addEventListener('player:timeupdate', (e) => {
      if (!this.currentPlaying) return;
      const { currentTime, duration } = e.detail || {};
      if (typeof currentTime !== 'number' || currentTime <= 0) return;
      const now = Date.now();
      if (now - this.lastSavedProgressTime >= 3000) {
        this.lastSavedProgressTime = now;
        const dur = (typeof duration === 'number' && duration > 0)
          ? duration
          : (this.currentPlaying.estDuration || 0);
        this.saveHistoryProgress(
          this.currentPlaying.mediaObj,
          this.currentPlaying.episodeObj,
          this.currentPlaying.title,
          currentTime,
          dur
        );
      }
    });

    window.addEventListener('player:stopped', () => {
      this.currentPlaying = null;
    });
  }

  showQuickSpinner() {
    if (this.quickSpinner) {
      this.quickSpinner.classList.remove('hidden');
    }
  }

  hideQuickSpinner() {
    if (this.quickSpinner) {
      this.quickSpinner.classList.add('hidden');
    }
  }

  async loadGenreOptions() {
    if (!this.genreSelect || !window.electronAPI?.idlixGetFilterOptions) return;
    try {
      const filters = await window.electronAPI.idlixGetFilterOptions('movies');
      if (filters?.genres && Array.isArray(filters.genres)) {
        this.genreSelect.innerHTML = '<option value="">Semua Genre</option>';
        filters.genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.slug;
          opt.textContent = g.name;
          this.genreSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Failed to load Idlix genres:', err);
    }
  }

  switchSubTab(subTab) {
    this.currentSubTab = subTab;
    this.searchQuery = '';
    if (this.searchStatus) this.searchStatus.classList.add('hidden');

    const pills = this.idlixSection?.querySelectorAll('.web-pill-btn[data-sub]');
    pills?.forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-sub') === subTab);
    });

    this.closeDetail();
    this.loadCatalog(subTab, { genre: this.currentGenre });
  }

  clearSearch() {
    this.searchQuery = '';
    const searchInput = document.getElementById('inputSearchAnime');
    if (searchInput) searchInput.value = '';
    if (this.searchStatus) this.searchStatus.classList.add('hidden');
    this.loadCatalog(this.currentSubTab, { genre: this.currentGenre });
  }

  /**
   * Context-Aware Search handler triggered from toolbar input
   */
  async handleSearch(query) {
    this.searchQuery = (query || '').trim();
    if (!this.searchQuery) {
      this.clearSearch();
      return;
    }

    if (this.searchStatus && this.searchText) {
      this.searchText.textContent = `Pencarian: "${this.searchQuery}"`;
      this.searchStatus.classList.remove('hidden');
    }

    this.renderLoading('Mencari film dan serial TV...');
    try {
      const res = await window.electronAPI.idlixSearch(this.searchQuery);
      const items = res?.results || [];
      this.renderMediaGrid(items, `Hasil Pencarian: "${this.searchQuery}" (${items.length})`);
    } catch (err) {
      this.renderError(`Gagal melakukan pencarian: ${err.message}`, () => this.handleSearch(this.searchQuery));
    }
  }

  /**
   * Load Movies, Series, Trending, or Unified Multi-Row Catalog
   */
  async loadCatalog(type, filters = {}) {
    // If active search query exists, route to search
    if (this.searchQuery) {
      await this.handleSearch(this.searchQuery);
      return;
    }

    // If specific genre filter is selected, render full responsive grid
    if (filters.genre) {
      if (this.billboardEl) this.billboardEl.classList.add('hidden');
      this.pauseBillboard();
      this.renderLoading(`Memuat koleksi genre ${filters.genre.toUpperCase()}...`);
      try {
        const isSeries = type === 'series';
        let items = [];
        if (isSeries) {
          const res = await window.electronAPI.idlixGetSeries({ page: 1, limit: 36, genre: filters.genre });
          items = res?.data || [];
        } else {
          const res = await window.electronAPI.idlixGetMovies({ page: 1, limit: 36, genre: filters.genre });
          items = res?.data || [];
        }
        this.renderMediaGrid(items, `Genre: ${filters.genre.toUpperCase()} (${items.length})`);
      } catch (err) {
        this.renderError(`Gagal memuat genre: ${err.message}`, () => this.loadCatalog(type, filters));
      }
      return;
    }

    this.renderLoading(
      type === 'series' ? 'Memuat serial TV Netflix...' :
      type === 'movies' ? 'Memuat film Netflix...' :
      type === 'trending' ? 'Memuat judul populer...' : 'Menyiapkan beranda Film & Series...'
    );

    try {
      // Fetch online history for Idlix items (Continue Watching)
      let idlixHistory = [];
      if (window.electronAPI?.getOnlineHistory && !filters.genre && !this.searchQuery) {
        try {
          const allHist = await window.electronAPI.getOnlineHistory();
          idlixHistory = Object.values(allHist || {})
            .filter(h => {
              if (!h) return false;
              if (h.source === 'idlix') return true;
              if (h.lastEpisodeUrl && h.lastEpisodeUrl.startsWith('idlix://')) return true;
              if (h.animeSlug && h.animeSlug.startsWith('idlix:')) return true;
              return false;
            })
            .sort((a, b) => (b.lastWatched || b.updatedAt || 0) - (a.lastWatched || a.updatedAt || 0));
        } catch (err) {
          console.warn('Failed to fetch Idlix history:', err);
        }
      }

      if (type === 'all') {
        // Multi-Row Home View: Parallel lazy batching
        const [trendingRes, moviesRes, seriesRes] = await Promise.allSettled([
          window.electronAPI.idlixGetTrending({ page: 1, limit: 20 }),
          window.electronAPI.idlixGetMovies({ page: 1, limit: 18 }),
          window.electronAPI.idlixGetSeries({ page: 1, limit: 18 })
        ]);

        const trendingData = trendingRes.status === 'fulfilled' ? (trendingRes.value?.data || trendingRes.value?.results || []) : [];
        const moviesData = moviesRes.status === 'fulfilled' ? (moviesRes.value?.data || []) : [];
        const seriesData = seriesRes.status === 'fulfilled' ? (seriesRes.value?.data || []) : [];

        // Start Rotating Hero Billboard with top trending items
        if (trendingData.length > 0) {
          this.startBillboardCarousel(trendingData);
        } else if (moviesData.length > 0) {
          this.startBillboardCarousel(moviesData);
        }

        // Build Multi-Row sections
        const sections = [];
        if (idlixHistory.length > 0) {
          sections.push({
            title: 'Lanjutkan Menonton',
            icon: '▶',
            isContinueWatching: true,
            items: idlixHistory
          });
        }
        sections.push(
          { title: 'Sedang Tren Minggu Ini', icon: '🔥', items: trendingData },
          { title: 'Film Populer Pilihan', icon: '🎬', items: moviesData },
          { title: 'Serial TV Teratas', icon: '📺', items: seriesData }
        );

        // Fetch additional genre rows in background
        this.renderMultiRows(sections);

        // Fetch genre rows lazily to enrich browsing
        this.appendLazyGenreRows();

      } else if (type === 'movies') {
        const [popRes, actRes, comRes] = await Promise.allSettled([
          window.electronAPI.idlixGetMovies({ page: 1, limit: 20 }),
          window.electronAPI.idlixGetMovies({ page: 1, limit: 18, genre: 'action' }),
          window.electronAPI.idlixGetMovies({ page: 1, limit: 18, genre: 'comedy' })
        ]);

        const popMovies = popRes.status === 'fulfilled' ? (popRes.value?.data || []) : [];
        const actMovies = actRes.status === 'fulfilled' ? (actRes.value?.data || []) : [];
        const comMovies = comRes.status === 'fulfilled' ? (comRes.value?.data || []) : [];

        if (popMovies.length > 0) this.startBillboardCarousel(popMovies);

        const movieHistory = idlixHistory.filter(h => !h.episodeObj && !h.seasonNumber);
        const sections = [];
        if (movieHistory.length > 0) {
          sections.push({
            title: 'Lanjutkan Menonton Film',
            icon: '▶',
            isContinueWatching: true,
            items: movieHistory
          });
        }
        sections.push(
          { title: 'Film Terbaru & Terpopuler', icon: '🎬', items: popMovies },
          { title: 'Sensasi Aksi & Petualangan', icon: '💥', items: actMovies },
          { title: 'Komedi & Hiburan Ringan', icon: '🍿', items: comMovies }
        );

        this.renderMultiRows(sections);

      } else if (type === 'series') {
        const [popRes, dramaRes, actRes] = await Promise.allSettled([
          window.electronAPI.idlixGetSeries({ page: 1, limit: 20 }),
          window.electronAPI.idlixGetSeries({ page: 1, limit: 18, genre: 'drama' }),
          window.electronAPI.idlixGetSeries({ page: 1, limit: 18, genre: 'action' })
        ]);

        const popSeries = popRes.status === 'fulfilled' ? (popRes.value?.data || []) : [];
        const dramaSeries = dramaRes.status === 'fulfilled' ? (dramaRes.value?.data || []) : [];
        const actSeries = actRes.status === 'fulfilled' ? (actRes.value?.data || []) : [];

        if (popSeries.length > 0) this.startBillboardCarousel(popSeries);

        const seriesHistory = idlixHistory.filter(h => !!h.episodeObj || !!h.seasonNumber);
        const sections = [];
        if (seriesHistory.length > 0) {
          sections.push({
            title: 'Lanjutkan Menonton Serial TV',
            icon: '▶',
            isContinueWatching: true,
            items: seriesHistory
          });
        }
        sections.push(
          { title: 'Serial TV Paling Populer', icon: '📺', items: popSeries },
          { title: 'Drama Penuh Emosi', icon: '🎭', items: dramaSeries },
          { title: 'Serial Aksi & Ketegangan', icon: '⚡', items: actSeries }
        );

        this.renderMultiRows(sections);

      } else if (type === 'trending') {
        const trendingRes = await window.electronAPI.idlixGetTrending({ page: 1, limit: 30 });
        const trendingData = trendingRes?.data || trendingRes?.results || [];

        if (trendingData.length > 0) this.startBillboardCarousel(trendingData);

        const moviesOnly = trendingData.filter(i => i.contentType !== 'tv_series' && i.numberOfSeasons === undefined);
        const seriesOnly = trendingData.filter(i => i.contentType === 'tv_series' || i.numberOfSeasons !== undefined);

        const sections = [];
        if (idlixHistory.length > 0) {
          sections.push({
            title: 'Lanjutkan Menonton',
            icon: '▶',
            isContinueWatching: true,
            items: idlixHistory
          });
        }
        sections.push(
          { title: 'Film & Serial Populer Hari Ini', icon: '🔥', items: trendingData },
          { title: 'Film Populer Paling Dicari', icon: '🌟', items: moviesOnly },
          { title: 'Serial TV Populer Paling Hangat', icon: '✨', items: seriesOnly }
        );

        this.renderMultiRows(sections);
      }
    } catch (err) {
      this.renderError(`Gagal memuat katalog: ${err.message}`, () => this.loadCatalog(type, filters));
    }
  }

  /**
   * Lazily fetch and append genre carousel rows to keep initial load rapid
   */
  async appendLazyGenreRows() {
    try {
      const [horrorRes, dramaRes] = await Promise.allSettled([
        window.electronAPI.idlixGetMovies({ page: 1, limit: 16, genre: 'horror' }),
        window.electronAPI.idlixGetMovies({ page: 1, limit: 16, genre: 'drama' })
      ]);

      const horrorMovies = horrorRes.status === 'fulfilled' ? (horrorRes.value?.data || []) : [];
      const dramaMovies = dramaRes.status === 'fulfilled' ? (dramaRes.value?.data || []) : [];

      if (horrorMovies.length > 0 && this.currentSubTab === 'all' && !this.searchQuery && !this.currentGenre) {
        this.appendRowSection({ title: 'Dunia Horor & Cerita Misteri', icon: '👻', items: horrorMovies });
      }
      if (dramaMovies.length > 0 && this.currentSubTab === 'all' && !this.searchQuery && !this.currentGenre) {
        this.appendRowSection({ title: 'Kisah Drama & Romansa', icon: '🎭', items: dramaMovies });
      }
    } catch (e) {
      console.warn('Lazy genre row load notice:', e.message);
    }
  }

  /**
   * Rotating Hero Billboard Carousel Engine
   */
  startBillboardCarousel(items) {
    if (!this.billboardEl || !items || items.length === 0) return;

    // Filter items with backdrops for cinematic presentation
    const valid = items.filter(i => i.backdropPath || i.posterPath).slice(0, 5);
    this.billboardItems = valid.length > 0 ? valid : items.slice(0, 5);
    this.billboardIndex = 0;

    // Render dot indicators
    if (this.billboardDotsEl) {
      this.billboardDotsEl.innerHTML = '';
      this.billboardItems.forEach((item, idx) => {
        const dot = document.createElement('button');
        dot.className = `billboard-dot ${idx === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Slide ${idx + 1}: ${item.title}`);
        dot.setAttribute('role', 'tab');
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.renderBillboardSlide(idx);
          this.resumeBillboard();
        });
        this.billboardDotsEl.appendChild(dot);
      });
    }

    this.renderBillboardSlide(0);
    this.resumeBillboard();
  }

  renderBillboardSlide(index) {
    if (!this.billboardItems || this.billboardItems.length === 0) return;
    this.billboardIndex = (index + this.billboardItems.length) % this.billboardItems.length;
    const item = this.billboardItems[this.billboardIndex];
    this.billboardContent = item;

    const backdropEl = document.getElementById('idlixBillboardBackdrop');
    const titleEl = document.getElementById('idlixBillboardTitle');
    const descEl = document.getElementById('idlixBillboardDesc');
    const tagEl = document.getElementById('idlixBillboardTag');

    const backdropUrl = item.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${item.backdropPath}`
      : (item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : '');

    if (backdropEl) {
      backdropEl.style.backgroundImage = backdropUrl ? `url('${backdropUrl}')` : 'none';
    }
    if (titleEl) titleEl.textContent = item.title || 'Judul Film';
    if (descEl) descEl.textContent = item.overview || 'Tonton sekarang dalam kualitas definisi tinggi dengan subtitle Bahasa Indonesia.';
    if (tagEl) {
      const isSeries = item.contentType === 'tv_series' || item.numberOfSeasons !== undefined;
      tagEl.textContent = isSeries ? 'Serial TV Unggulan' : 'Film Pilihan';
    }

    // Update active dot indicator
    if (this.billboardDotsEl) {
      const dots = this.billboardDotsEl.querySelectorAll('.billboard-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === this.billboardIndex);
        dot.setAttribute('aria-selected', idx === this.billboardIndex ? 'true' : 'false');
      });
    }

    this.billboardEl.classList.remove('hidden');
    this.preUnlock(item);
  }

  nextBillboard() {
    if (this.billboardItems.length <= 1) return;
    this.renderBillboardSlide(this.billboardIndex + 1);
  }

  prevBillboard() {
    if (this.billboardItems.length <= 1) return;
    this.renderBillboardSlide(this.billboardIndex - 1);
  }

  pauseBillboard() {
    if (this.billboardTimer) {
      clearInterval(this.billboardTimer);
      this.billboardTimer = null;
    }
  }

  resumeBillboard() {
    this.pauseBillboard();
    if (this.billboardItems && this.billboardItems.length > 1) {
      this.billboardTimer = setInterval(() => this.nextBillboard(), 7000);
    }
  }

  /**
   * Render Multi-Row Netflix Carousels
   */
  renderMultiRows(sections) {
    if (!this.dynamicContainer) return;
    this.dynamicContainer.innerHTML = '';
    this.rowTracks = [];

    sections.forEach(sec => {
      if (sec.items && sec.items.length > 0) {
        this.appendRowSection(sec);
      }
    });
  }

  appendRowSection(sec) {
    if (!this.dynamicContainer || !sec.items || sec.items.length === 0) return;

    const rowSection = document.createElement('div');
    rowSection.className = 'netflix-row-section';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'netflix-row-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'netflix-row-title-wrap';

    const heading = document.createElement('h2');
    heading.className = 'netflix-row-heading netflix-row-title';
    heading.innerHTML = `<span>${sec.icon || '🎬'}</span> <span>${sec.title}</span>`;
    titleWrap.appendChild(heading);

    const exploreLink = document.createElement('span');
    exploreLink.className = 'netflix-row-explore';
    if (sec.isContinueWatching) {
      exploreLink.textContent = `${sec.items.length} Judul`;
    } else {
      exploreLink.textContent = 'Jelajahi Semua ›';
      exploreLink.title = `Tampilkan semua ${sec.title}`;
      exploreLink.addEventListener('click', () => {
        this.renderMediaGrid(sec.items, sec.title);
      });
    }
    titleWrap.appendChild(exploreLink);

    headerEl.appendChild(titleWrap);
    rowSection.appendChild(headerEl);

    // Slider wrap
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'netflix-slider-wrap';

    const track = document.createElement('div');
    track.className = 'netflix-slider-track';

    sec.items.forEach(item => {
      if (sec.isContinueWatching) {
        const card = this.createContinueWatchingCard(item);
        track.appendChild(card);
      } else {
        const isSeries = item.contentType === 'tv_series' || item.numberOfSeasons !== undefined;
        const card = this.createMediaCard(item, isSeries);
        track.appendChild(card);
      }
    });

    // Navigation arrows
    const btnLeft = document.createElement('button');
    btnLeft.className = 'netflix-slider-arrow left hidden';
    btnLeft.setAttribute('aria-label', `Geser ${sec.title} ke kiri`);
    btnLeft.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';

    const btnRight = document.createElement('button');
    btnRight.className = 'netflix-slider-arrow right';
    btnRight.setAttribute('aria-label', `Geser ${sec.title} ke kanan`);
    btnRight.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';

    // Arrow click handlers with smooth scrolling
    const scrollStep = 720;
    btnLeft.addEventListener('click', () => {
      track.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    });
    btnRight.addEventListener('click', () => {
      track.scrollBy({ left: scrollStep, behavior: 'smooth' });
    });

    // Edge detection for arrow visibility
    const updateArrows = () => {
      btnLeft.classList.toggle('hidden', track.scrollLeft <= 10);
      const isEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 15;
      btnRight.classList.toggle('hidden', isEnd);
    };

    track.addEventListener('scroll', updateArrows, { passive: true });
    setTimeout(updateArrows, 150);

    sliderWrap.appendChild(btnLeft);
    sliderWrap.appendChild(track);
    sliderWrap.appendChild(btnRight);
    rowSection.appendChild(sliderWrap);

    this.dynamicContainer.appendChild(rowSection);
  }

  renderLoading(message = 'Memuat konten...') {
    if (!this.dynamicContainer) return;
    this.dynamicContainer.innerHTML = `
      <div class="web-loading-spinner">
        <div class="yt-spinner"></div>
        <span>${message}</span>
      </div>
    `;
  }

  renderError(message, retryCallback) {
    if (!this.dynamicContainer) return;
    this.dynamicContainer.innerHTML = `
      <div class="web-empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Gagal Memuat Konten</h3>
        <p>${message}</p>
        <button id="btnIdlixRetry" class="btn-primary" style="margin-top: 16px;">Coba Lagi</button>
      </div>
    `;
    const btnRetry = document.getElementById('btnIdlixRetry');
    if (btnRetry && typeof retryCallback === 'function') {
      btnRetry.addEventListener('click', retryCallback);
    }
  }

  /**
   * Render Media Grid conforming to DESIGN.md
   */
  renderMediaGrid(items, sectionTitle = '') {
    if (!this.dynamicContainer) return;

    if (!items || items.length === 0) {
      this.dynamicContainer.innerHTML = `
        <div class="web-empty-state">
          <div class="empty-icon">🎬</div>
          <h3>Tidak Ada Konten Ditemukan</h3>
          <p>Coba kata kunci pencarian lain atau pilih filter kategori yang berbeda.</p>
        </div>
      `;
      return;
    }

    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'netflix-row-section';

    if (sectionTitle) {
      const headerEl = document.createElement('div');
      headerEl.className = 'netflix-row-header';
      const titleEl = document.createElement('h2');
      titleEl.className = 'netflix-row-heading netflix-row-title';
      titleEl.textContent = sectionTitle;
      headerEl.appendChild(titleEl);
      gridWrapper.appendChild(headerEl);
    }

    const cardGrid = document.createElement('div');
    cardGrid.className = 'idlix-media-grid netflix-card-grid';

    items.forEach(item => {
      const isSeries = item.contentType === 'tv_series' || item.numberOfSeasons !== undefined;
      const card = this.createMediaCard(item, isSeries);
      cardGrid.appendChild(card);
    });

    gridWrapper.appendChild(cardGrid);
    this.dynamicContainer.innerHTML = '';
    this.dynamicContainer.appendChild(gridWrapper);
  }

  /**
   * Create Netflix Expanding Pop-Out Media Card
   */
  createMediaCard(item, isSeries) {
    const card = document.createElement('div');
    card.className = 'idlix-card netflix-card netflix-popout-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${item.title} (${isSeries ? 'Serial TV' : 'Film'})`);

    const posterUrl = item.posterPath
      ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
      : 'styles/placeholder-poster.png';

    const ratingNum = item.voteAverage ? parseFloat(item.voteAverage).toFixed(1) : '-';
    const rating = item.voteAverage ? `★ ${ratingNum}` : '★ -';
    const matchPct = item.voteAverage ? Math.min(99, Math.round(parseFloat(item.voteAverage) * 10 + 10)) : 92;
    const quality = item.quality || 'HD';
    const year = (item.releaseDate || item.firstAirDate || '').slice(0, 4);
    const metaText = isSeries
      ? `${year ? year + ' • ' : ''}${item.numberOfSeasons ? item.numberOfSeasons + ' Season' : 'Serial'}`
      : `${year ? year + ' • ' : ''}${item.runtime ? item.runtime + ' mnt' : 'Film'}`;
    const epBadge = isSeries && item.episodeCount ? `<div class="idlix-badge-ep">Ep ${item.episodeCount}</div>` : '';
    const isBookmarked = this.bookmarks.has(String(item.id));

    // Extract genres list
    let genresText = '';
    if (Array.isArray(item.genres) && item.genres.length > 0) {
      genresText = item.genres.map(g => g.name || g).slice(0, 3).join(' <span class="popout-dot">•</span> ');
    } else if (item.genreNames && Array.isArray(item.genreNames)) {
      genresText = item.genreNames.slice(0, 3).join(' <span class="popout-dot">•</span> ');
    }

    card.innerHTML = `
      <div class="idlix-poster-wrap">
        <img src="${posterUrl}" alt="${item.title}" class="idlix-poster-img" loading="lazy">
        <div class="idlix-badge-rating">${rating}</div>
        <div class="idlix-badge-quality">${quality}</div>
        ${epBadge}
        <div class="idlix-poster-hover-overlay">
          <div class="idlix-hover-play-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
      <!-- Default Base Info -->
      <div class="idlix-card-info">
        <h4 class="idlix-card-title card-title-text" title="${item.title}">${item.title}</h4>
        <div class="idlix-card-meta">
          <span>${metaText}</span>
        </div>
      </div>
      <!-- Netflix Expanding Pop-Out Panel -->
      <div class="netflix-card-popout-panel">
        <div class="popout-actions-row">
          <div class="popout-actions-left">
            <button class="btn-popout-play" title="Putar Sekarang" aria-label="Putar sekarang">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="btn-popout-action btn-popout-bookmark ${isBookmarked ? 'bookmarked' : ''}" title="${isBookmarked ? 'Hapus dari Daftar Saya' : 'Tambah ke Daftar Saya'}" aria-label="Daftar Saya">
              ${isBookmarked
                ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
                : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>'
              }
            </button>
          </div>
          <button class="btn-popout-action btn-popout-info" title="Detail & Info Lengkap" aria-label="Detail dan info lengkap">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
          </button>
        </div>
        <h4 class="popout-title" title="${item.title}">${item.title}</h4>
        <div class="popout-meta-row">
          <span class="popout-match">${matchPct}% Cocok</span>
          <span class="popout-badge">${quality}</span>
          <span class="popout-year">${metaText}</span>
        </div>
        ${genresText ? `<div class="popout-genres-row">${genresText}</div>` : ''}
      </div>
    `;

    // Smart pre-unlock on hover or focus
    card.addEventListener('mouseenter', () => this.preUnlock(item));
    card.addEventListener('focus', () => this.preUnlock(item));

    // Actions inside popout
    const btnPlay = card.querySelector('.btn-popout-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playContent(item);
      });
    }

    const btnBookmark = card.querySelector('.btn-popout-bookmark');
    if (btnBookmark) {
      btnBookmark.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleBookmark(item, btnBookmark);
      });
    }

    const btnInfo = card.querySelector('.btn-popout-info');
    if (btnInfo) {
      btnInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showQuickSpinner();
        this.openDetail(item);
      });
    }

    // Click on entire card opens detail
    card.addEventListener('click', () => {
      this.showQuickSpinner();
      this.openDetail(item);
    });

    // Keyboard navigation
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.showQuickSpinner();
        this.openDetail(item);
      }
    });

    return card;
  }

  /**
   * Create Continue Watching Card for Film & Series (16:9 thumbnail with progress bar and remove button)
   */
  createContinueWatchingCard(hist) {
    const card = document.createElement('div');
    card.className = 'idlix-card netflix-card continue-watching-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    const title = hist.animeTitle || 'Film/Serial';
    const epTitle = hist.lastEpisodeTitle || '';
    card.setAttribute('aria-label', `Lanjutkan ${title} - ${epTitle}`);

    const cur = hist.currentTime || 0;
    const dur = hist.duration || 0;
    const progressPercent = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0;
    const remainingSec = Math.max(0, dur - cur);
    const remainingText = remainingSec > 0
      ? (remainingSec >= 3600
        ? `Sisa ${Math.floor(remainingSec / 3600)}j ${Math.floor((remainingSec % 3600) / 60)}m`
        : `Sisa ${Math.floor(remainingSec / 60)} mnt`)
      : `${progressPercent}% ditonton`;

    const posterUrl = hist.poster ||
      (hist.mediaObj?.backdropPath ? `https://image.tmdb.org/t/p/w500${hist.mediaObj.backdropPath}` :
      (hist.mediaObj?.posterPath ? `https://image.tmdb.org/t/p/w500${hist.mediaObj.posterPath}` : 'styles/placeholder-poster.png'));

    card.innerHTML = `
      <button class="btn-remove-continue" title="Hapus dari Lanjutkan Menonton" aria-label="Hapus">&times;</button>
      <div class="idlix-poster-wrap">
        <img src="${posterUrl}" alt="${title}" class="idlix-poster-img" loading="lazy">
        <div class="idlix-badge-rating">▶ Lanjutkan</div>
        <div class="card-progress-bar-bg">
          <div class="card-progress-bar-fill" style="width: ${progressPercent}%;"></div>
        </div>
        <div class="idlix-poster-hover-overlay">
          <div class="idlix-hover-play-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
      <div class="idlix-card-info">
        <h4 class="idlix-card-title card-title-text" title="${title}">${title}</h4>
        <div class="idlix-card-meta">
          <span class="continue-ep-title">${epTitle}</span>
          <span class="continue-remaining">${remainingText}</span>
        </div>
      </div>
    `;

    // Remove button handler
    const btnRemove = card.querySelector('.btn-remove-continue');
    if (btnRemove) {
      btnRemove.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (hist.animeSlug && window.electronAPI?.deleteOnlineProgress) {
          await window.electronAPI.deleteOnlineProgress(hist.animeSlug);
          this.loadCatalog(this.currentSubTab);
        }
      });
    }

    // Click card to resume playback
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-continue')) return;
      this.resumePlayback(hist);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.resumePlayback(hist);
      }
    });

    return card;
  }

  /**
   * Resume playback from Continue Watching card
   */
  async resumePlayback(hist) {
    if (!hist) return;
    this.showQuickSpinner();
    try {
      const isSeries = !!hist.episodeObj || !!hist.seasonNumber;
      const startTime = hist.currentTime || 0;

      if (isSeries && hist.mediaObj && hist.episodeObj) {
        this.activeSeasonNumber = hist.seasonNumber || hist.episodeObj.seasonNumber || 1;
        await this.playEpisode(hist.episodeObj, hist.mediaObj, startTime);
      } else if (!isSeries && hist.mediaObj) {
        await this.playContent(hist.mediaObj, startTime);
      } else if (hist.animeSlug) {
        const match = hist.animeSlug.match(/^(.+)-s(\d+)e(\d+)$/i);
        if (match) {
          const seriesSlug = match[1];
          const seasonNum = parseInt(match[2], 10);
          const epNum = parseInt(match[3], 10);
          const seriesDetail = await window.electronAPI.idlixGetSeriesDetail(seriesSlug);
          const seasonData = await window.electronAPI.idlixGetSeasonEpisodes(seriesSlug, seasonNum);
          const ep = seasonData?.season?.episodes?.find(e => e.episodeNumber === epNum) || {
            id: epNum,
            episodeNumber: epNum,
            name: hist.lastEpisodeTitle || `Episode ${epNum}`
          };
          this.activeSeasonNumber = seasonNum;
          await this.playEpisode(ep, seriesDetail || { slug: seriesSlug, title: hist.animeTitle }, startTime);
        } else {
          const movieDetail = await window.electronAPI.idlixGetMovieDetail(hist.animeSlug);
          await this.playContent(movieDetail || { slug: hist.animeSlug, title: hist.animeTitle, id: hist.animeSlug }, startTime);
        }
      }
    } catch (err) {
      this.hideQuickSpinner();
      console.error('Failed to resume playback:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: {
          message: `Gagal melanjutkan pemutaran: ${err.message}`,
          codeName: 'RESUME_PLAYBACK_ERROR'
        }
      }));
    }
  }

  /**
   * Toggle Bookmark / My List
   */
  toggleBookmark(item, btnElement) {
    if (!item?.id) return;
    const id = String(item.id);
    const willBookmark = !this.bookmarks.has(id);

    if (willBookmark) {
      this.bookmarks.add(id);
      if (btnElement) {
        btnElement.classList.add('bookmarked');
        btnElement.title = 'Hapus dari Daftar Saya';
        btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
      }
      if (window.controlsManager) {
        window.controlsManager.showToast(`Ditambahkan ke Daftar Saya: ${item.title}`);
      }
    } else {
      this.bookmarks.delete(id);
      if (btnElement) {
        btnElement.classList.remove('bookmarked');
        btnElement.title = 'Tambah ke Daftar Saya';
        btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
      }
      if (window.controlsManager) {
        window.controlsManager.showToast(`Dihapus dari Daftar Saya: ${item.title}`);
      }
    }

    try {
      localStorage.setItem('vidplayer_idlix_bookmarks', JSON.stringify([...this.bookmarks]));
    } catch (e) {}
  }

  /**
   * Smart Pre-unlocking in background: Begins 15s session unlock early
   */
  async preUnlock(item) {
    if (!item?.id) return;
    const isSeries = item.contentType === 'tv_series' || item.numberOfSeasons !== undefined;

    // For movies, pre-unlock movie stream directly
    if (!isSeries) {
      const cacheKey = `movie:${item.id}`;
      if (this.preUnlockedSessions.has(cacheKey)) return;

      try {
        const sessionPromise = window.electronAPI.idlixInitiateStreamSession('movie', item.id);
        this.preUnlockedSessions.set(cacheKey, sessionPromise);
        await sessionPromise;
      } catch (err) {
        console.warn('[Idlix] Pre-unlock failed:', err.message);
      }
    }
  }

  /**
   * Clean Detail View for Movies and Series
   */
  async openDetail(item) {
    if (!this.detailContainer) return;
    this.activeDetailContent = item;
    if (this.billboardEl) this.billboardEl.classList.add('hidden');
    if (this.dynamicContainer) this.dynamicContainer.classList.add('hidden');
    this.detailContainer.classList.remove('hidden');
    if (this.section) this.section.scrollTop = 0;

    const isSeries = item.contentType === 'tv_series' || item.numberOfSeasons !== undefined;
    const slug = item.slug;

    this.detailContainer.innerHTML = `
      <div class="detail-loading-box">
        <div class="yt-spinner"></div>
        <span>Memuat detail ${item.title}...</span>
      </div>
    `;

    try {
      let detailData = item;
      if (isSeries && window.electronAPI?.idlixGetSeriesDetail) {
        detailData = await window.electronAPI.idlixGetSeriesDetail(slug);
      } else if (!isSeries && window.electronAPI?.idlixGetMovieDetail) {
        detailData = await window.electronAPI.idlixGetMovieDetail(slug);
      }

      this.activeDetailContent = detailData;
      this.renderDetailView(detailData, isSeries);
    } catch (err) {
      this.detailContainer.innerHTML = `
        <div class="detail-error-box">
          <button class="btn-close-detail" id="btnCloseDetailErr">&times;</button>
          <h3>Gagal Memuat Detail</h3>
          <p>${err.message}</p>
        </div>
      `;
      document.getElementById('btnCloseDetailErr')?.addEventListener('click', () => this.closeDetail());
    } finally {
      this.hideQuickSpinner();
    }
  }

  closeDetail() {
    if (this.detailContainer) {
      this.detailContainer.classList.add('hidden');
      this.detailContainer.innerHTML = '';
    }
    if (this.dynamicContainer) {
      this.dynamicContainer.classList.remove('hidden');
    }
    if (this.billboardEl && this.billboardContent && !this.searchQuery) {
      this.billboardEl.classList.remove('hidden');
    }
    this.activeDetailContent = null;
  }

  renderDetailView(detail, isSeries) {
    if (!this.detailContainer) return;

    const backdropUrl = detail.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${detail.backdropPath}`
      : (detail.posterPath ? `https://image.tmdb.org/t/p/w500${detail.posterPath}` : '');

    const posterUrl = detail.posterPath
      ? `https://image.tmdb.org/t/p/w500${detail.posterPath}`
      : 'styles/placeholder-poster.png';

    const year = (detail.releaseDate || detail.firstAirDate || '').slice(0, 4);
    const rating = detail.voteAverage ? `★ ${parseFloat(detail.voteAverage).toFixed(1)}` : 'N/A';
    const genres = (detail.genres || []).map(g => g.name).join(' • ');
    const metaLine = [year, detail.quality || 'HD', rating, genres].filter(Boolean).join('  |  ');
    const isBookmarked = this.bookmarks.has(String(detail.id));

    const castList = (detail.cast || []).slice(0, 8);
    const castHtml = castList.length > 0 ? `
      <div class="detail-cast-section">
        <h3 class="detail-subheading">Pemeran Utama</h3>
        <div class="detail-cast-grid">
          ${castList.map(c => `
            <div class="cast-card">
              <img src="${c.profilePath ? 'https://image.tmdb.org/t/p/w185' + c.profilePath : 'styles/placeholder-poster.png'}" alt="${c.name}" class="cast-img" loading="lazy">
              <div class="cast-name">${c.name}</div>
              <div class="cast-character">${c.character || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    this.detailContainer.innerHTML = `
      <div class="idlix-detail-header-bar">
        <button class="btn-idlix-back" id="btnBackToCatalog">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          <span>Kembali ke Katalog</span>
        </button>
        <div class="idlix-breadcrumbs">
          <span>Film &amp; Series</span>
          <span class="crumb-sep">›</span>
          <span>${isSeries ? 'Serial TV' : 'Film'}</span>
          <span class="crumb-sep">›</span>
          <span class="crumb-current">${detail.title}</span>
        </div>
      </div>

      <div class="detail-backdrop-header" style="background-image: url('${backdropUrl}')">
        <div class="detail-backdrop-overlay"></div>
        <button class="btn-close-detail" id="btnCloseDetail" title="Tutup Detail" aria-label="Tutup Detail">&times;</button>
        
        <div class="detail-hero-content">
          <div class="detail-poster-col">
            <img src="${posterUrl}" alt="${detail.title}" class="detail-poster-img">
          </div>
          <div class="detail-info-col">
            <div class="detail-badge-type">${isSeries ? 'SERIAL TV' : 'FILM'}</div>
            <h1 class="detail-title">${detail.title}</h1>
            <div class="detail-meta-line">${metaLine}</div>
            <p class="detail-synopsis">${detail.overview || 'Sinopsis belum tersedia untuk judul ini.'}</p>
            
            <div class="detail-actions">
              ${!isSeries ? `
                <button id="btnDetailPlayMovie" class="btn-netflix-play">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span>Putar Film Sekarang</span>
                </button>
              ` : `
                <button id="btnDetailScrollEpisodes" class="btn-netflix-play">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                  <span>Pilih Episode</span>
                </button>
              `}
              <button id="btnDetailBookmark" class="btn-netflix-info ${isBookmarked ? 'bookmarked' : ''}" title="${isBookmarked ? 'Hapus dari Daftar Saya' : 'Tambah ke Daftar Saya'}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="${isBookmarked ? 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z' : 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'}"/>
                </svg>
                <span>${isBookmarked ? 'Tersimpan di Daftar' : 'Daftar Saya'}</span>
              </button>
              ${detail.trailerUrl ? `
                <a href="${detail.trailerUrl}" target="_blank" class="btn-netflix-info btn-trailer" title="Tonton Trailer di YouTube">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>
                  <span>Trailer</span>
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-body-container">
        ${castHtml}

        <!-- Series Seasons and Episodes Selector -->
        ${isSeries ? `
          <div class="detail-episodes-section" id="detailEpisodesSection">
            <div class="episodes-header-bar">
              <h3 class="detail-subheading">Daftar Episode</h3>
              <div class="season-pills-bar" id="seasonPillsBar">
                <!-- Populated dynamically -->
              </div>
            </div>
            <div class="episodes-grid" id="episodesGrid">
              <div class="web-loading-spinner"><div class="yt-spinner"></div><span>Memuat episode...</span></div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Bind navigation buttons
    document.getElementById('btnCloseDetail')?.addEventListener('click', () => this.closeDetail());
    document.getElementById('btnBackToCatalog')?.addEventListener('click', () => this.closeDetail());

    const btnBookmark = document.getElementById('btnDetailBookmark');
    if (btnBookmark) {
      btnBookmark.addEventListener('click', () => {
        this.toggleBookmark(detail, btnBookmark);
        const nowBookmarked = this.bookmarks.has(String(detail.id));
        const spanText = btnBookmark.querySelector('span');
        if (spanText) spanText.textContent = nowBookmarked ? 'Tersimpan di Daftar' : 'Daftar Saya';
      });
    }

    if (!isSeries) {
      document.getElementById('btnDetailPlayMovie')?.addEventListener('click', () => {
        this.playContent(detail);
      });
      // Pre-unlock movie immediately upon opening detail
      this.preUnlock(detail);
    } else {
      document.getElementById('btnDetailScrollEpisodes')?.addEventListener('click', () => {
        document.getElementById('detailEpisodesSection')?.scrollIntoView({ behavior: 'smooth' });
      });
      this.renderSeasonPills(detail);
    }
  }

  /**
   * Render Season tabs for TV Series and load season 1 episodes
   */
  async renderSeasonPills(seriesDetail) {
    const pillsBar = document.getElementById('seasonPillsBar');
    const episodesGrid = document.getElementById('episodesGrid');
    if (!pillsBar || !episodesGrid) return;

    const seasons = seriesDetail.seasons || [];
    if (seasons.length === 0) {
      episodesGrid.innerHTML = '<div class="empty-text">Episode belum tersedia untuk serial ini.</div>';
      return;
    }

    pillsBar.innerHTML = '';
    seasons.forEach((season, idx) => {
      const btn = document.createElement('button');
      btn.className = `season-pill-btn ${idx === 0 ? 'active' : ''}`;
      btn.textContent = season.name || `Season ${season.seasonNumber || idx + 1}`;
      btn.addEventListener('click', () => {
        pillsBar.querySelectorAll('.season-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSeasonNumber = season.seasonNumber || idx + 1;
        this.loadSeasonEpisodes(seriesDetail.slug, this.activeSeasonNumber);
      });
      pillsBar.appendChild(btn);
    });

    // Load initial season
    this.activeSeasonNumber = seasons[0].seasonNumber || 1;
    await this.loadSeasonEpisodes(seriesDetail.slug, this.activeSeasonNumber);
  }

  async loadSeasonEpisodes(slug, seasonNumber) {
    const episodesGrid = document.getElementById('episodesGrid');
    if (!episodesGrid) return;

    episodesGrid.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Memuat episode...</span></div>';

    try {
      const data = await window.electronAPI.idlixGetSeasonEpisodes(slug, seasonNumber);
      const episodes = data?.season?.episodes || [];

      if (episodes.length === 0) {
        episodesGrid.innerHTML = '<div class="empty-text">Belum ada episode di season ini.</div>';
        return;
      }

      episodesGrid.innerHTML = '';
      episodes.forEach(ep => {
        const epCard = document.createElement('div');
        epCard.className = 'episode-card';
        epCard.setAttribute('tabindex', '0');
        epCard.setAttribute('role', 'button');
        epCard.setAttribute('aria-label', `Putar Episode ${ep.episodeNumber}: ${ep.name}`);

        const stillUrl = ep.stillPath
          ? `https://image.tmdb.org/t/p/w300${ep.stillPath}`
          : 'styles/placeholder-poster.png';

        epCard.innerHTML = `
          <div class="episode-thumbnail-wrapper">
            <img src="${stillUrl}" alt="${ep.name}" class="episode-thumbnail-img" loading="lazy">
            <div class="episode-play-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div class="episode-number-badge">Ep ${ep.episodeNumber}</div>
          </div>
          <div class="episode-info">
            <div class="episode-title-row">
              <h4 class="episode-title">${ep.name || `Episode ${ep.episodeNumber}`}</h4>
              <span class="episode-runtime">${ep.runtime ? ep.runtime + ' mnt' : ''}</span>
            </div>
            <p class="episode-overview">${ep.overview || 'Tonton episode ini sekarang.'}</p>
          </div>
        `;

        // Pre-unlock episode on hover
        epCard.addEventListener('mouseenter', () => {
          if (ep.id) {
            const cacheKey = `episode:${ep.id}`;
            if (!this.preUnlockedSessions.has(cacheKey)) {
              this.preUnlockedSessions.set(cacheKey, window.electronAPI.idlixInitiateStreamSession('episode', ep.id));
            }
          }
        });

        // Click to play episode
        epCard.addEventListener('click', () => {
          this.showQuickSpinner();
          this.playEpisode(ep, this.activeDetailContent);
        });

        epCard.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            this.showQuickSpinner();
            this.playEpisode(ep, this.activeDetailContent);
          }
        });

        episodesGrid.appendChild(epCard);
      });

      // Pre-unlock first episode immediately
      if (episodes[0]?.id) {
        const cacheKey = `episode:${episodes[0].id}`;
        if (!this.preUnlockedSessions.has(cacheKey)) {
          this.preUnlockedSessions.set(cacheKey, window.electronAPI.idlixInitiateStreamSession('episode', episodes[0].id));
        }
      }
    } catch (err) {
      episodesGrid.innerHTML = `<div class="detail-error-box"><p>Gagal memuat episode: ${err.message}</p></div>`;
    }
  }

  /**
   * Play Movie
   */
  async playContent(item, startTime = 0) {
    if (!item?.id) return;
    this.showQuickSpinner();
    const mediaTitle = `${item.title} (${(item.releaseDate || '').slice(0, 4) || 'Film'})`;
    await this.startStreamPlayback('movie', item.id, mediaTitle, item, null, startTime);
  }

  /**
   * Play Episode
   */
  async playEpisode(episode, series, startTime = 0) {
    if (!episode?.id) return;
    this.showQuickSpinner();
    const seriesTitle = series?.title || 'Serial TV';
    const seasonNum = this.activeSeasonNumber || (episode.seasonNumber || 1);
    const mediaTitle = `${seriesTitle} - S${seasonNum}E${episode.episodeNumber} : ${episode.name || 'Episode'}`;
    await this.startStreamPlayback('episode', episode.id, mediaTitle, series, episode, startTime);
  }

  /**
   * Core playback executor with Smart Pre-unlocking and countdown overlay
   */
  async startStreamPlayback(contentType, contentId, title, mediaObj, episodeObj = null, startTime = 0) {
    const cacheKey = `${contentType}:${contentId}`;
    let session = null;

    try {
      this.showQuickSpinner();

      // Check if session was already initiated in background
      if (this.preUnlockedSessions.has(cacheKey)) {
        session = await this.preUnlockedSessions.get(cacheKey);
      } else {
        session = await window.electronAPI.idlixInitiateStreamSession(contentType, contentId);
        this.preUnlockedSessions.set(cacheKey, Promise.resolve(session));
      }

      const targetUnlock = session.unlockAt;
      const now = Date.now();

      // If unlock time is still in the future, display smooth countdown overlay
      if (now < targetUnlock) {
        this.hideQuickSpinner();
        this.showUnlockOverlay(title, targetUnlock);
        const waitTime = targetUnlock - now + 350;
        await new Promise(r => setTimeout(r, waitTime));
      }

      this.updateUnlockStatus('Membuka stream HLS...');

      // Claim and redeem stream
      const streamResult = await window.electronAPI.idlixClaimAndRedeemStream(session.gateToken, targetUnlock);
      this.hideUnlockOverlay();
      this.showQuickSpinner();

      if (!streamResult?.streamUrl) {
        throw new Error('Tautan streaming tidak valid.');
      }

      // Hide gallery & detail, show player view
      if (this.library) {
        this.library.showPlayerView();
      }

      // Construct master HLS proxy URL via local media server
      const proxyUrl = `http://127.0.0.1:${this.serverPort}/idlix-hls/master.m3u8?url=${encodeURIComponent(streamResult.streamUrl)}`;

      const estDuration = (mediaObj.runtime && typeof mediaObj.runtime === 'number')
        ? mediaObj.runtime * 60
        : (episodeObj?.runtime && typeof episodeObj.runtime === 'number' ? episodeObj.runtime * 60 : 0);

      // Track active playback session for live progress saving
      this.currentPlaying = {
        mediaObj,
        episodeObj,
        title,
        contentType,
        contentId,
        estDuration
      };

      // Load remote stream into player with initial estimated duration and startTime
      await this.player.loadRemoteStream(proxyUrl, {
        title,
        isHls: true,
        startTime: startTime || 0,
        duration: estDuration,
        runtime: mediaObj.runtime || episodeObj?.runtime
      });

      this.hideQuickSpinner();

      // Automatically load and activate Indonesian subtitle if present
      if (streamResult.subtitles && streamResult.subtitles.length > 0) {
        const idSub = streamResult.subtitles.find(s => s.lang === 'id') || streamResult.subtitles[0];
        if (idSub?.path) {
          try {
            await this.player.loadExternalSubtitleFromUrl(idSub.path);
            if (window.controlsManager) {
              window.controlsManager.showToast(`Subtitle otomatis aktif: ${idSub.label || 'Bahasa Indonesia'}`);
              window.controlsManager.updateSubtitleUI(true, idSub.label || 'Bahasa Indonesia');
            }
          } catch (subErr) {
            console.warn('[Idlix] Subtitle load failed:', subErr);
          }
        }
      }

      // Persist to local Watch History for Continue Watching
      this.saveHistoryProgress(mediaObj, episodeObj, title, startTime, estDuration);

    } catch (err) {
      this.hideQuickSpinner();
      this.hideUnlockOverlay();
      console.error('[Idlix] Playback error:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: {
          message: `Gagal memutar streaming Idlix: ${err.message}`,
          codeName: 'IDLIX_STREAM_ERROR'
        }
      }));
    }
  }

  showUnlockOverlay(title, targetUnlock) {
    if (!this.unlockOverlay) return;
    const titleEl = document.getElementById('idlixUnlockTitle');
    const subEl = document.getElementById('idlixUnlockSub');
    const secEl = document.getElementById('idlixCountdownSec');
    const ringEl = document.getElementById('idlixRingProgress');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = 'Menyiapkan sesi streaming aman dari Idlix...';

    this.unlockOverlay.classList.remove('hidden');

    const totalDuration = 15;
    const updateCountdown = () => {
      const remainingSec = Math.max(0, Math.ceil((targetUnlock - Date.now()) / 1000));
      if (secEl) secEl.textContent = remainingSec;

      if (ringEl) {
        const strokeDasharray = 175.9; // 2 * pi * 28
        const progress = Math.min(1, Math.max(0, 1 - (remainingSec / totalDuration)));
        ringEl.style.strokeDashoffset = strokeDasharray * (1 - progress);
      }

      if (remainingSec <= 0) {
        clearInterval(this.activeUnlockInterval);
      }
    };

    updateCountdown();
    clearInterval(this.activeUnlockInterval);
    this.activeUnlockInterval = setInterval(updateCountdown, 250);
  }

  updateUnlockStatus(text) {
    const subEl = document.getElementById('idlixUnlockSub');
    if (subEl) subEl.textContent = text;
  }

  hideUnlockOverlay() {
    if (this.unlockOverlay) {
      this.unlockOverlay.classList.add('hidden');
    }
    clearInterval(this.activeUnlockInterval);
  }

  cancelUnlock() {
    this.hideQuickSpinner();
    this.hideUnlockOverlay();
    window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: false } }));
  }

  onTabActivated() {
    const searchInput = document.getElementById('inputSearchAnime');
    if (searchInput) {
      searchInput.placeholder = 'Cari Film & Serial TV (cth: Wednesday, Avatar)...';
      searchInput.value = this.searchQuery || '';
    }
    this.resumeBillboard();

    // Auto-refresh catalog to update Continue Watching row when returning to Film & Series tab
    if (!this.searchQuery && !this.currentGenre && (!this.detailContainer || this.detailContainer.classList.contains('hidden'))) {
      this.loadCatalog(this.currentSubTab);
    }
  }

  onTabDeactivated() {
    const searchInput = document.getElementById('inputSearchAnime');
    if (searchInput) {
      searchInput.placeholder = 'Cari koleksi video, anime, atau film...';
    }
    this.pauseBillboard();
  }

  saveHistoryProgress(mediaObj, episodeObj, displayTitle, currentTime = 0, duration = 0) {
    if (!window.electronAPI?.saveOnlineProgress || !mediaObj) return;
    const isSeries = !!episodeObj;
    const seasonNum = this.activeSeasonNumber || (episodeObj?.seasonNumber || 1);
    const slug = isSeries ? `${mediaObj.slug}-s${seasonNum}e${episodeObj.episodeNumber}` : mediaObj.slug;
    const title = mediaObj.title || displayTitle;
    const episodeTitle = isSeries ? `S${seasonNum} Ep ${episodeObj.episodeNumber}: ${episodeObj.name}` : 'Film';
    const streamUrl = `idlix://${slug}`;
    const poster = mediaObj.posterPath ? `https://image.tmdb.org/t/p/w500${mediaObj.posterPath}` : (mediaObj.poster || '');
    const finalDur = duration > 0 ? duration : (mediaObj.runtime ? mediaObj.runtime * 60 : 5400);

    const extra = {
      source: 'idlix',
      mediaObj: {
        id: mediaObj.id,
        title: mediaObj.title,
        slug: mediaObj.slug,
        posterPath: mediaObj.posterPath,
        backdropPath: mediaObj.backdropPath,
        contentType: mediaObj.contentType || (isSeries ? 'tv_series' : 'movie'),
        runtime: mediaObj.runtime,
        voteAverage: mediaObj.voteAverage,
        releaseDate: mediaObj.releaseDate,
        firstAirDate: mediaObj.firstAirDate,
        numberOfSeasons: mediaObj.numberOfSeasons
      },
      episodeObj: episodeObj ? {
        id: episodeObj.id,
        episodeNumber: episodeObj.episodeNumber,
        seasonNumber: seasonNum,
        name: episodeObj.name,
        stillPath: episodeObj.stillPath,
        runtime: episodeObj.runtime
      } : null,
      seasonNumber: seasonNum
    };

    window.electronAPI.saveOnlineProgress(
      slug,
      title,
      streamUrl,
      episodeTitle,
      currentTime,
      finalDur,
      poster,
      extra
    ).catch(e => console.warn('Failed to save idlix online history:', e));
  }
}

// Global initialization hook
window.initIdlix = function(player, library) {
  const manager = new IdlixManager();
  window.idlixManager = manager;
  manager.init(player, library);
};
