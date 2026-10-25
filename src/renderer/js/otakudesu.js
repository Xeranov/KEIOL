/**
 * OtakudesuManager: Netflix-Style Anime Integration Controller
 * Manages scraping views (Ongoing, Schedule, Genres, Anime List A-Z),
 * search, online streaming playback, background downloads, and watch history.
 */

class OtakudesuManager {
  constructor(player, library) {
    this.player = player;
    this.library = library;

    // State
    this.activeSub = 'ongoing'; // 'ongoing' | 'schedule' | 'genres' | 'animelist' | 'downloaded'
    this.activeGenre = 'action';
    this.activeLetter = 'A';
    this.searchQuery = '';
    this.searchDebounceTimer = null;
    this.onlineHistory = {};
    this.downloadPath = '';

    // Data Cache
    this.cache = {
      ongoing: null,
      anichinOngoing: null,
      schedule: null,
      anichinSchedule: null,
      genres: null,
      genreAnime: {},
      animeList: null,
      anichinAnimeList: null,
      search: {}
    };

    this.searchSourceFilter = 'all'; // 'all' | 'otakudesu' | 'kusonime' | 'anichin'
    this.lastSearchResults = { otakudesu: [], kusonime: [], anichin: [], query: '' };
    this.animeListTypeFilter = 'all'; // 'all' | 'anime' | 'donghua'

    this.selectedAnime = null;
    this.activeDownloads = new Map();

    // Elements
    this.webSection = document.getElementById('webSection');
    this.webDynamicContainer = document.getElementById('webDynamicContainer');
    this.webDetailContainer = document.getElementById('webDetailContainer');
    this.webBillboard = document.getElementById('webBillboard');
    this.webBillboardBackdrop = document.getElementById('webBillboardBackdrop');
    this.webBillboardTitle = document.getElementById('webBillboardTitle');
    this.webBillboardDesc = document.getElementById('webBillboardDesc');
    this.btnWebBillboardStream = document.getElementById('btnWebBillboardStream');
    this.btnWebBillboardDetail = document.getElementById('btnWebBillboardDetail');

    // Sub-nav pills & tab management
    this.webSubnavBar = document.querySelector('.web-subnav-bar');
    this.webSubnavPills = document.querySelector('.web-subnav-pills');
    this.netflixTabs = document.querySelector('.netflix-tabs');
    this.tabHome = document.getElementById('tabHome');
    this.tabWeb = document.getElementById('tabWeb');
    this.tabDownloads = document.getElementById('tabDownloads');
    this.tabSettings = document.getElementById('tabSettings');
    this.openDetailTabs = {};
    this.activeDetailTabSlug = null;
    this.previousCatalogSubTab = 'ongoing';
    this.catalogScrollTop = 0;

    this.pillOngoing = document.getElementById('pillOngoing');
    this.pillSchedule = document.getElementById('pillSchedule');
    this.pillGenres = document.getElementById('pillGenres');
    this.pillAnimeList = document.getElementById('pillAnimeList');
    this.pillDownloaded = document.getElementById('pillDownloaded');
    this.downloadedBadge = document.getElementById('downloadedBadge');

    // Download Folder Setting
    this.btnDownloadFolderSetting = document.getElementById('btnDownloadFolderSetting');
    this.downloadFolderLabel = document.getElementById('downloadFolderLabel');

    // Modals
    this.otakudesuDetailModal = document.getElementById('otakudesuDetailModal');
    this.btnCloseOtakudesuModal = document.getElementById('btnCloseOtakudesuModal');
    this.otakudesuHeroBackdrop = document.getElementById('otakudesuHeroBackdrop');
    this.otakudesuModalTitle = document.getElementById('otakudesuModalTitle');
    this.otakudesuJapaneseTitle = document.getElementById('otakudesuJapaneseTitle');
    this.otakudesuStatusBadge = document.getElementById('otakudesuStatusBadge');
    this.otakudesuScoreBadge = document.getElementById('otakudesuScoreBadge');
    this.otakudesuTypeBadge = document.getElementById('otakudesuTypeBadge');
    this.otakudesuStudio = document.getElementById('otakudesuStudio');
    this.otakudesuDuration = document.getElementById('otakudesuDuration');
    this.otakudesuTotalEps = document.getElementById('otakudesuTotalEps');
    this.otakudesuGenresWrap = document.getElementById('otakudesuGenresWrap');
    this.otakudesuSynopsis = document.getElementById('otakudesuSynopsis');
    this.btnOtakudesuStreamFirst = document.getElementById('btnOtakudesuStreamFirst');
    this.txtOtakudesuStreamFirst = document.getElementById('txtOtakudesuStreamFirst');
    this.btnOtakudesuDownloadAll = document.getElementById('btnOtakudesuDownloadAll');
    this.btnOtakudesuDeleteAnime = document.getElementById('btnOtakudesuDeleteAnime');
    this.btnOtakudesuBatch = document.getElementById('btnOtakudesuBatch');
    this.otakudesuEpisodesGrid = document.getElementById('otakudesuEpisodesGrid');

    // Resolution Modal
    this.resolutionPickerModal = document.getElementById('resolutionPickerModal');
    this.btnCloseResolutionPicker = document.getElementById('btnCloseResolutionPicker');
    this.resolutionModalTitle = document.getElementById('resolutionModalTitle');
    this.resolutionModalDesc = document.getElementById('resolutionModalDesc');
    this.resolutionOptionsList = document.getElementById('resolutionOptionsList');

    // Stream Loading Overlay & Status Indicator
    this.streamLoadingOverlay = document.getElementById('streamLoadingOverlay');
    this.streamLoadingTitle = document.getElementById('streamLoadingTitle');
    this.streamLoadingSubtitle = document.getElementById('streamLoadingSubtitle');
    this.streamLoadingStatusText = document.getElementById('streamLoadingStatusText');
    this.streamLoadingPoster = document.getElementById('streamLoadingPoster');
    this.btnCancelStreamLoading = document.getElementById('btnCancelStreamLoading');
    this.streamLoadingTimers = [];
    this.isStreamLoadingCancelled = false;

    // Download Toast & Status
    this.downloadManagerToast = document.getElementById('downloadManagerToast');
    this.downloadToastMainTitle = document.getElementById('downloadToastMainTitle');
    this.downloadToastBody = document.getElementById('downloadToastBody');
    this.btnOpenDownloadsFolder = document.getElementById('btnOpenDownloadsFolder');
    this.btnMinimizeDownloadsToast = document.getElementById('btnMinimizeDownloadsToast');
    this.btnCloseDownloadsToast = document.getElementById('btnCloseDownloadsToast');

    // Dedicated Downloads Tab Elements
    this.downloadsTabBody = document.getElementById('downloadsTabBody');
    this.btnDedicatedOpenFolder = document.getElementById('btnDedicatedOpenFolder');
    this.btnDedicatedChangeFolder = document.getElementById('btnDedicatedChangeFolder');

    // Top navbar download button & badge
    this.btnDownloadStatusNav = document.getElementById('btnDownloadStatusNav');
    this.navDownloadBadge = document.getElementById('navDownloadBadge');
    this.tabDownloadsBadge = document.getElementById('tabDownloadsBadge');

    // View state
    this.ongoingViewMode = 'slider'; // 'slider' | 'grid'

    // Toolbar search input
    this.inputSearchAnime = document.getElementById('inputSearchAnime');

    this.initEvents();
  }

  async init() {
    await this.refreshOnlineHistory();
    await this.refreshDownloadPath();

    if (window.electronAPI && typeof window.electronAPI.onDownloadProgress === 'function') {
      window.electronAPI.onDownloadProgress((data) => {
        this.handleDownloadEvent(data);
      });
    }

    // Jika tidak ada startup loading screen, muat ongoing view langsung
    const startupEl = document.getElementById('appStartupLoading');
    if (!startupEl) {
      await this.loadOngoing();
    }
  }

  /**
   * Preload katalog web (anime & donghua ongoing) saat startup loading screen aplikasi.
   * Merender webDynamicContainer dan billboard di latar belakang sehingga saat user
   * membuka tab Web, konten sudah langsung siap saji tanpa loading lagi (kecuali klik refresh).
   */
  async preloadWebCatalog(onProgress) {
    if (!navigator.onLine) {
      console.log('App is offline, skipping web catalog preload.');
      this.renderOfflineNotice();
      return;
    }

    try {
      if (typeof onProgress === 'function') onProgress('Memuat server anime & donghua...');

      // Pemuatan asinkronus instan: jalankan preloading tab web lainnya (jadwal, genre, daftar anime) di latar belakang secara paralel
      this.preloadBackgroundTabs();

      const promises = [];
      if (!this.cache.ongoing && window.electronAPI && typeof window.electronAPI.otakudesuGetOngoing === 'function') {
        promises.push(
          window.electronAPI.otakudesuGetOngoing(1)
            .then(res => { this.cache.ongoing = res; })
            .catch(err => console.warn('Otakudesu preload error:', err))
        );
      }
      if (!this.cache.anichinOngoing && window.electronAPI && typeof window.electronAPI.anichinGetOngoing === 'function') {
        promises.push(
          window.electronAPI.anichinGetOngoing(1)
            .then(res => { this.cache.anichinOngoing = res; })
            .catch(err => console.warn('Anichin preload error:', err))
        );
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      if (typeof onProgress === 'function') onProgress('Menyiapkan katalog anime...');
      await this.loadOngoing(true);
    } catch (e) {
      console.warn('Preload web catalog error:', e);
    }
  }

  preloadBackgroundTabs() {
    if (!navigator.onLine) return;

    // 1. Asynchronously load Schedule in background
    if (!this.cache.schedule && window.electronAPI && typeof window.electronAPI.otakudesuGetSchedule === 'function') {
      window.electronAPI.otakudesuGetSchedule()
        .then(res => { if (res) this.cache.schedule = res; })
        .catch(() => {});
    }
    if (!this.cache.anichinSchedule && window.electronAPI && typeof window.electronAPI.anichinGetSchedule === 'function') {
      window.electronAPI.anichinGetSchedule()
        .then(res => { if (res) this.cache.anichinSchedule = res; })
        .catch(() => {});
    }

    // 2. Asynchronously load Genres in background
    if (!this.cache.genres && window.electronAPI && typeof window.electronAPI.otakudesuGetGenres === 'function') {
      window.electronAPI.otakudesuGetGenres()
        .then(res => { if (res) this.cache.genres = res; })
        .catch(() => {});
    }

    // 3. Asynchronously load all sources for Anime List (Otakudesu, Kusonime, Ani-Chin Donghua) in background
    if (!this.cache.animeList) {
      this.fetchAndMergeAnimeList().catch(() => {});
    }
  }

  prefetchEpisodeStream(epUrl, isDonghua = false) {
    if (!epUrl || !window.electronAPI || !navigator.onLine) return;
    if (!this.streamCache) this.streamCache = new Map();
    if (this.streamCache.has(epUrl)) return;

    if (isDonghua && typeof window.electronAPI.anichinGetEpisodeStream === 'function') {
      window.electronAPI.anichinGetEpisodeStream(epUrl)
        .then(stream => { if (stream) this.streamCache.set(epUrl, stream); })
        .catch(() => {});
    } else if (typeof window.electronAPI.otakudesuGetEpisodeStream === 'function') {
      window.electronAPI.otakudesuGetEpisodeStream(epUrl)
        .then(stream => { if (stream) this.streamCache.set(epUrl, stream); })
        .catch(() => {});
    }
  }

  renderOfflineNotice() {
    if (!this.webDynamicContainer) return;
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.webDynamicContainer.innerHTML = `
      <div class="web-offline-container">
        <div class="offline-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="#888890">
            <path d="M23.64 7c-.45-.34-4.93-3.66-11.64-3.66-6.72 0-11.2 3.32-11.64 3.66L12 21.5 23.64 7zM3.42 7.74C4.88 6.7 8.32 4.99 12 4.99c3.69 0 7.12 1.71 8.58 2.75L12 18.25 3.42 7.74zM1 1l22 22-1.41 1.41-2.9-2.9C16.34 22.47 14.28 23 12 23 5.28 23 .8 19.68.36 19.34l10.23-12.7L1.41 2.41 1 1z"/>
          </svg>
        </div>
        <h2 class="offline-title">Anda Sedang Offline</h2>
        <p class="offline-desc">Koneksi internet tidak terdeteksi. Hubungkan ke jaringan untuk streaming anime atau nikmati koleksi video lokal di tab Beranda.</p>
        <button id="btnRetryOnline" class="btn-primary" style="padding: 8px 20px; font-size: 13px;">Coba Muat Ulang</button>
      </div>
    `;
    const btnRetry = document.getElementById('btnRetryOnline');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        if (navigator.onLine) {
          this.loadOngoing(true);
          this.preloadBackgroundTabs();
        } else {
          alert('Anda masih offline. Periksa koneksi internet Anda.');
        }
      });
    }
  }

  async refreshOnlineHistory() {
    if (window.electronAPI && typeof window.electronAPI.getOnlineHistory === 'function') {
      try {
        const rawHistory = await window.electronAPI.getOnlineHistory() || {};
        // Strictly filter for anime history only: exclude idlix movies and series
        const animeHistory = {};
        for (const [k, v] of Object.entries(rawHistory)) {
          if (!v) continue;
          if (v.source === 'idlix') continue;
          if (v.lastEpisodeUrl && v.lastEpisodeUrl.startsWith('idlix://')) continue;
          if (v.episodes && Object.keys(v.episodes).some(u => u.startsWith('idlix://'))) continue;
          animeHistory[k] = v;
        }
        this.onlineHistory = animeHistory;
      } catch (e) {
        console.warn('Gagal memuat online history:', e);
      }
    }
  }

  async refreshDownloadPath() {
    if (window.electronAPI && typeof window.electronAPI.getDownloadPath === 'function') {
      try {
        this.downloadPath = await window.electronAPI.getDownloadPath();
        if (this.downloadFolderLabel) {
          const folderName = this.downloadPath ? this.downloadPath.split(/[\\/]/).pop() || this.downloadPath : 'Folder Media';
          this.downloadFolderLabel.textContent = `Folder: ${folderName}`;
        }
        if (this.btnDownloadFolderSetting) {
          this.btnDownloadFolderSetting.title = `Lokasi Download: ${this.downloadPath} (Klik untuk ubah)`;
        }
      } catch (e) {
        console.warn('Gagal memuat download path:', e);
      }
    }
  }

  initEvents() {
    // Sub-navigation pills
    const pills = [
      { el: this.pillOngoing, sub: 'ongoing' },
      { el: this.pillSchedule, sub: 'schedule' },
      { el: this.pillGenres, sub: 'genres' },
      { el: this.pillAnimeList, sub: 'animelist' },
      { el: this.pillDownloaded, sub: 'downloaded' }
    ];

    pills.forEach(({ el, sub }) => {
      if (el) {
        el.addEventListener('click', () => {
          this.switchSubTab(sub);
        });
      }
    });

    // Download Folder Setting Button
    if (this.btnDownloadFolderSetting) {
      this.btnDownloadFolderSetting.addEventListener('click', async () => {
        if (window.electronAPI && typeof window.electronAPI.chooseDownloadFolder === 'function') {
          const chosen = await window.electronAPI.chooseDownloadFolder();
          if (chosen) {
            await this.refreshDownloadPath();
            if (this.activeSub === 'downloaded') {
              this.renderDownloadedView();
            }
          }
        }
      });
    }

    // Modal Close
    if (this.btnCloseOtakudesuModal) {
      this.btnCloseOtakudesuModal.addEventListener('click', () => {
        this.closeDetailModal();
      });
    }

    if (this.otakudesuDetailModal) {
      this.otakudesuDetailModal.addEventListener('click', (e) => {
        if (e.target === this.otakudesuDetailModal) {
          this.closeDetailModal();
        }
      });
    }

    // Resolution Picker Close
    if (this.btnCloseResolutionPicker) {
      this.btnCloseResolutionPicker.addEventListener('click', () => {
        this.closeResolutionPicker();
      });
    }

    if (this.resolutionPickerModal) {
      this.resolutionPickerModal.addEventListener('click', (e) => {
        if (e.target === this.resolutionPickerModal) {
          this.closeResolutionPicker();
        }
      });
    }

    // Download Toast controls
    if (this.btnOpenDownloadsFolder) {
      this.btnOpenDownloadsFolder.addEventListener('click', () => {
        if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === 'function') {
          window.electronAPI.openDownloadFolder();
        }
      });
    }

    if (this.btnMinimizeDownloadsToast) {
      this.btnMinimizeDownloadsToast.addEventListener('click', () => {
        if (this.downloadToastBody) {
          this.downloadToastBody.classList.toggle('hidden');
        }
      });
    }

    if (this.btnCloseDownloadsToast) {
      this.btnCloseDownloadsToast.addEventListener('click', () => {
        if (this.downloadManagerToast) {
          this.downloadManagerToast.classList.add('hidden');
        }
      });
    }

    if (this.btnDedicatedOpenFolder) {
      this.btnDedicatedOpenFolder.addEventListener('click', () => {
        if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === 'function') {
          window.electronAPI.openDownloadFolder();
        }
      });
    }

    if (this.btnDedicatedChangeFolder) {
      this.btnDedicatedChangeFolder.addEventListener('click', async () => {
        if (window.electronAPI && typeof window.electronAPI.chooseDownloadFolder === 'function') {
          const chosen = await window.electronAPI.chooseDownloadFolder();
          if (chosen) {
            await this.refreshDownloadPath();
            this.renderDedicatedDownloadsTab();
          }
        }
      });
    }

    if (this.btnDownloadStatusNav) {
      this.btnDownloadStatusNav.addEventListener('click', () => {
        this.toggleDownloadManagerPanel();
      });
    }

    // Search input dynamic hook
    if (this.inputSearchAnime) {
      this.inputSearchAnime.addEventListener('input', (e) => {
        if (this.library && this.library.activeNav === 'web') {
          const q = (e.target.value || '').trim();
          this.searchQuery = q;
          clearTimeout(this.searchDebounceTimer);
          this.searchDebounceTimer = setTimeout(() => {
            if (q.length >= 2) {
              this.executeSearch(q);
            } else if (q.length === 0) {
              this.switchSubTab(this.activeSub);
            }
          }, 350);
        }
      });
    }

    // Cancel stream loading button
    if (this.btnCancelStreamLoading) {
      this.btnCancelStreamLoading.addEventListener('click', () => {
        this.cancelStreamLoading();
      });
    }

    // ESC to close modals or active series detail tab
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.streamLoadingOverlay && !this.streamLoadingOverlay.classList.contains('hidden')) {
          this.cancelStreamLoading();
          e.stopPropagation();
        } else if (this.resolutionPickerModal && !this.resolutionPickerModal.classList.contains('hidden')) {
          this.closeResolutionPicker();
          e.stopPropagation();
        } else if (this.activeDetailTabSlug) {
          this.closeDetailTab(this.activeDetailTabSlug);
          e.stopPropagation();
        } else if (this.otakudesuDetailModal && !this.otakudesuDetailModal.classList.contains('hidden')) {
          this.closeDetailModal();
          e.stopPropagation();
        }
      }
    });

    // Online & Offline Network State Handlers
    window.addEventListener('online', () => {
      if (this.webDynamicContainer && this.webDynamicContainer.querySelector('.web-offline-container')) {
        this.loadOngoing(true);
        this.preloadBackgroundTabs();
      }
    });

    window.addEventListener('offline', () => {
      if (!this.cache.ongoing && this.activeSub !== 'downloaded') {
        this.renderOfflineNotice();
      }
    });
  }

  onTabActivated() {
    this.refreshOnlineHistory();
    this.refreshDownloadPath();

    if (this.inputSearchAnime) {
      this.inputSearchAnime.placeholder = 'Cari anime & donghua (cth: Solo Leveling, BTTH)...';
    }

    // Pastikan subnav bar sedang tayang / catalog muncul kembali
    if (this.webSubnavBar) this.webSubnavBar.classList.remove('hidden');
    if (this.netflixTabs) {
      this.netflixTabs.querySelectorAll('.netflix-series-tab').forEach(t => t.classList.remove('active'));
    }
    if (this.tabWeb) this.tabWeb.classList.add('active');

    if (this.searchQuery && this.searchQuery.length >= 2) {
      this.executeSearch(this.searchQuery);
    } else {
      this.switchSubTab(this.previousCatalogSubTab || this.activeSub || 'ongoing');
    }
  }

  onTabDeactivated() {
    if (this.inputSearchAnime) {
      this.inputSearchAnime.placeholder = 'Cari koleksi video, anime, atau film...';
    }
  }

  switchSubTab(sub) {
    this.activeSub = sub;
    this.previousCatalogSubTab = sub;

    // Pastikan subnav bar terlihat saat berada di katalog web
    if (this.webSubnavBar) {
      this.webSubnavBar.classList.remove('hidden');
    }

    // Hide series detail container and restore catalog container
    if (this.webDetailContainer) {
      this.webDetailContainer.classList.add('hidden');
    }
    if (this.webDynamicContainer) {
      this.webDynamicContainer.classList.remove('hidden');
    }
    this.activeDetailTabSlug = null;

    // Deactivate dynamic detail tabs
    if (this.netflixTabs) {
      this.netflixTabs.querySelectorAll('.netflix-series-tab').forEach(t => t.classList.remove('active'));
    }
    if (this.webSubnavPills) {
      this.webSubnavPills.querySelectorAll('.web-detail-tab').forEach(t => t.classList.remove('active'));
    }
    if (this.tabWeb) {
      this.tabWeb.classList.add('active');
    }

    // Update subnav pills
    [this.pillOngoing, this.pillSchedule, this.pillGenres, this.pillAnimeList, this.pillDownloaded].forEach(p => {
      if (p) p.classList.toggle('active', p.dataset.sub === sub);
    });

    if (sub === 'ongoing') {
      this.loadOngoing();
    } else if (sub === 'schedule') {
      this.loadSchedule();
    } else if (sub === 'genres') {
      this.loadGenres();
    } else if (sub === 'animelist') {
      this.loadAnimeList();
    } else if (sub === 'downloaded') {
      this.renderDownloadedView();
    }
  }

  async refreshCurrentSubTab() {
    if (this.activeSub === 'ongoing') {
      this.cache.ongoing = null;
      this.cache.anichinOngoing = null;
    } else if (this.activeSub === 'schedule') {
      this.cache.schedule = null;
      this.cache.anichinSchedule = null;
    } else if (this.activeSub === 'genres') {
      this.cache.genres = null;
      this.cache.genreAnime = {};
    } else if (this.activeSub === 'animelist') {
      this.cache.animeList = null;
      this.cache.anichinAnimeList = null;
    }
    await this.refreshOnlineHistory();
    this.switchSubTab(this.activeSub);
  }

  showLoading(text = 'Memuat konten...') {
    if (!this.webDynamicContainer) return;
    this.webDynamicContainer.innerHTML = `
      <div class="web-loading-spinner">
        <div class="yt-spinner"></div>
        <span>${text}</span>
      </div>
    `;
  }

  /**
   * 1. Sub-Tab: Ongoing (Sedang Tayang) with Horizontal Row Sliders & Lanjutkan Menonton
   */
  async loadOngoing(forceRefresh = false) {
    if (this.webBillboard) this.webBillboard.classList.remove('hidden');

    // Jika katalog sudah di-load di startup loading screen dan DOM sudah siap (dan bukan klik refresh), jangan tampilkan loading spinner lagi!
    const isAlreadyPreloaded = (this.cache.ongoing || this.cache.anichinOngoing) &&
      this.webDynamicContainer &&
      this.webDynamicContainer.children.length > 0 &&
      !this.webDynamicContainer.querySelector('.web-loading-spinner');

    if (!isAlreadyPreloaded || forceRefresh) {
      this.showLoading('Memuat anime & donghua sedang tayang...');
    } else {
      // Konten web sudah siap saji di DOM dari preloading screen
      return;
    }

    try {
      const promises = [];
      if (!this.cache.ongoing && window.electronAPI && typeof window.electronAPI.otakudesuGetOngoing === 'function') {
        promises.push(
          window.electronAPI.otakudesuGetOngoing(1)
            .then(res => { this.cache.ongoing = res; })
            .catch(err => console.warn('Otakudesu ongoing error:', err))
        );
      }
      if (!this.cache.anichinOngoing && window.electronAPI && typeof window.electronAPI.anichinGetOngoing === 'function') {
        promises.push(
          window.electronAPI.anichinGetOngoing(1)
            .then(res => { this.cache.anichinOngoing = res; })
            .catch(err => console.warn('Anichin ongoing error:', err))
        );
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      const data = this.cache.ongoing;
      const anichinData = this.cache.anichinOngoing;

      const hasOtaku = data && data.animeList && data.animeList.length > 0;
      const hasAnichin = anichinData && anichinData.animeList && anichinData.animeList.length > 0;

      if (!hasOtaku && !hasAnichin) {
        if (!navigator.onLine) {
          this.renderOfflineNotice();
        } else {
          this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Tidak dapat memuat anime ongoing. Periksa koneksi internet Anda.</div>';
        }
        return;
      }

      // Render Billboard with 1st anime
      const hero = (hasOtaku ? data.animeList[0] : anichinData.animeList[0]);
      this.renderBillboard(hero);

      let contentHtml = '';

      // 1. Row: Lanjutkan Menonton (Online Watch History Anime ONLY)
      const isAnimeItem = (h) => {
        if (!h || !h.animeTitle) return false;
        if (h.source === 'idlix') return false;
        if (h.lastEpisodeUrl && h.lastEpisodeUrl.startsWith('idlix://')) return false;
        if (h.episodes && Object.keys(h.episodes).some(u => u.startsWith('idlix://'))) return false;
        return true;
      };

      const historyList = Object.values(this.onlineHistory || {})
        .filter(isAnimeItem)
        .sort((a, b) => (b.lastWatched || b.updatedAt || 0) - (a.lastWatched || a.updatedAt || 0));

      if (historyList.length > 0) {
        contentHtml += `
          <div class="web-slider-section" id="webContinueWatchingSection">
            <div class="web-grid-header">
              <div>
                <h2 class="web-section-heading">Lanjutkan Menonton</h2>
                <span class="web-section-count">${historyList.length} Anime Terakhir Ditonton</span>
              </div>
            </div>
            <div class="web-slider-wrapper">
              <button class="btn-slider-arrow btn-slider-left" data-target="sliderWebContinue" aria-label="Geser ke Kiri">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              </button>
              <div class="web-horizontal-slider" id="sliderWebContinue">
        `;

        historyList.forEach(hist => {
          contentHtml += this.renderContinueCard(hist);
        });

        contentHtml += `
              </div>
              <button class="btn-slider-arrow btn-slider-right" data-target="sliderWebContinue" aria-label="Geser ke Kanan">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </button>
            </div>
          </div>
        `;
      }

      // 2. Row: Anime Sedang Tayang (Otakudesu)
      if (hasOtaku) {
        const isGrid = this.ongoingViewMode === 'grid';
        contentHtml += `
          <div class="web-slider-section" id="webOngoingSection" style="margin-top: ${historyList.length > 0 ? '16px' : '0'};">
            <div class="web-grid-header">
              <div>
                <h2 class="web-section-heading">Anime</h2>
                <span class="web-section-count">${data.animeList.length} Rilis Terkini</span>
              </div>
              <button class="btn-toggle-grid" id="btnToggleOngoingMode" title="Ubah format tampilan">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  ${isGrid ? 
                    '<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>' : 
                    '<path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>'
                  }
                </svg>
                <span>${isGrid ? 'Mode Slider Baris' : 'Lihat Semua (Grid)'}</span>
              </button>
            </div>
        `;

        if (isGrid) {
          contentHtml += `<div class="netflix-poster-grid">`;
          data.animeList.forEach(anime => {
            contentHtml += this.renderAnimeCard(anime);
          });
          contentHtml += `</div>`;
        } else {
          contentHtml += `
            <div class="web-slider-wrapper">
              <button class="btn-slider-arrow btn-slider-left" data-target="sliderWebOngoing" aria-label="Geser ke Kiri">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              </button>
              <div class="web-horizontal-slider" id="sliderWebOngoing">
          `;

          data.animeList.forEach(anime => {
            contentHtml += this.renderAnimeCard(anime);
          });

          contentHtml += `
                <div class="card-view-more" id="cardOngoingViewMore" title="Tampilkan semua anime ongoing dalam format grid">
                  <div class="card-view-more-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                  </div>
                  <div class="card-view-more-text">Lihat Semua<br>Anime (${data.animeList.length})</div>
                </div>
              </div>
              <button class="btn-slider-arrow btn-slider-right" data-target="sliderWebOngoing" aria-label="Geser ke Kanan">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </button>
            </div>
          `;
        }
        contentHtml += `</div>`;
      }

      // 3. Row: Donghua Sedang Tayang (Ani-Chin)
      if (hasAnichin) {
        const isDonghuaGrid = this.donghuaOngoingViewMode === 'grid';
        contentHtml += `
          <div class="web-slider-section" id="webAnichinSection" style="margin-top: 24px;">
            <div class="web-grid-header">
              <div>
                <h2 class="web-section-heading heading-donghua">Donghua</h2>
                <span class="web-section-count">${anichinData.animeList.length} Rilis Terkini</span>
              </div>
              <button class="btn-toggle-grid" id="btnToggleDonghuaOngoingMode" title="Ubah format tampilan">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  ${isDonghuaGrid ? 
                    '<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>' : 
                    '<path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>'
                  }
                </svg>
                <span>${isDonghuaGrid ? 'Mode Slider Baris' : 'Lihat Semua (Grid)'}</span>
              </button>
            </div>
        `;

        if (isDonghuaGrid) {
          contentHtml += `<div class="netflix-poster-grid">`;
          anichinData.animeList.forEach(anime => {
            contentHtml += this.renderAnimeCard(anime);
          });
          contentHtml += `</div>`;
        } else {
          contentHtml += `
            <div class="web-slider-wrapper">
              <button class="btn-slider-arrow btn-slider-left" data-target="sliderWebDonghua" aria-label="Geser ke Kiri">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              </button>
              <div class="web-horizontal-slider" id="sliderWebDonghua">
          `;

          anichinData.animeList.forEach(anime => {
            contentHtml += this.renderAnimeCard(anime);
          });

          contentHtml += `
                <div class="card-view-more" id="cardDonghuaViewMore" title="Tampilkan semua donghua ongoing dalam format grid">
                  <div class="card-view-more-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                  </div>
                  <div class="card-view-more-text">Lihat Semua<br>Donghua (${anichinData.animeList.length})</div>
                </div>
              </div>
              <button class="btn-slider-arrow btn-slider-right" data-target="sliderWebDonghua" aria-label="Geser ke Kanan">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </button>
            </div>
          `;
        }
        contentHtml += `</div>`;
      }

      this.webDynamicContainer.innerHTML = contentHtml;

      // Bind interactions
      this.bindCardClicks();
      this.bindSliderArrows();

      // Toggle grid / slider button Otakudesu
      const btnToggle = document.getElementById('btnToggleOngoingMode');
      if (btnToggle) {
        btnToggle.addEventListener('click', () => {
          this.ongoingViewMode = this.ongoingViewMode === 'grid' ? 'slider' : 'grid';
          this.loadOngoing();
        });
      }

      const cardViewMore = document.getElementById('cardOngoingViewMore');
      if (cardViewMore) {
        cardViewMore.addEventListener('click', () => {
          this.ongoingViewMode = 'grid';
          this.loadOngoing();
        });
      }

      // Toggle grid / slider button Donghua
      const btnToggleDonghua = document.getElementById('btnToggleDonghuaOngoingMode');
      if (btnToggleDonghua) {
        btnToggleDonghua.addEventListener('click', () => {
          this.donghuaOngoingViewMode = this.donghuaOngoingViewMode === 'grid' ? 'slider' : 'grid';
          this.loadOngoing();
        });
      }

      const cardDonghuaViewMore = document.getElementById('cardDonghuaViewMore');
      if (cardDonghuaViewMore) {
        cardDonghuaViewMore.addEventListener('click', () => {
          this.donghuaOngoingViewMode = 'grid';
          this.loadOngoing();
        });
      }

    } catch (err) {
      console.error('Error loading ongoing:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat anime: ${err.message}</div>`;
    }
  }

  renderBillboard(anime) {
    if (!this.webBillboard || !anime) return;
    this.webBillboard.classList.remove('hidden');

    if (this.webBillboardBackdrop) {
      this.webBillboardBackdrop.style.backgroundImage = `url("${anime.poster}")`;
    }

    if (this.webBillboardTitle) {
      this.webBillboardTitle.textContent = anime.title;
    }

    if (this.webBillboardDesc) {
      this.webBillboardDesc.textContent = `${anime.episode || anime.latestEpisode || 'Episode Terbaru'} • ${anime.source === 'anichin' ? 'Donghua' : (anime.day ? `Tayang setiap hari ${anime.day}` : 'Anime')}`;
    }

    if (this.btnWebBillboardStream) {
      this.btnWebBillboardStream.onclick = () => {
        if (anime.source === 'anichin') this.openAnichinDetail(anime.url || anime.slug);
        else this.openAnimeDetail(anime.url);
      };
    }

    if (this.btnWebBillboardDetail) {
      this.btnWebBillboardDetail.onclick = () => {
        if (anime.source === 'anichin') this.openAnichinDetail(anime.url || anime.slug);
        else this.openAnimeDetail(anime.url);
      };
    }
  }

  /**
   * 2. Sub-Tab: Jadwal Rilis
   */
  async loadSchedule() {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading('Memuat jadwal rilis mingguan (Anime & Donghua)...');

    try {
      const promises = [];
      if (!this.cache.schedule && window.electronAPI && typeof window.electronAPI.otakudesuGetSchedule === 'function') {
        promises.push(
          window.electronAPI.otakudesuGetSchedule()
            .then(res => { this.cache.schedule = res; })
            .catch(err => console.warn('Otakudesu schedule error:', err))
        );
      }
      if (!this.cache.anichinSchedule && window.electronAPI && typeof window.electronAPI.anichinGetSchedule === 'function') {
        promises.push(
          window.electronAPI.anichinGetSchedule()
            .then(res => { this.cache.anichinSchedule = res; })
            .catch(err => console.warn('Anichin schedule error:', err))
        );
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      const schedule = this.cache.schedule || [];
      const anichinSchedule = this.cache.anichinSchedule || [];

      if (schedule.length === 0 && anichinSchedule.length === 0) {
        if (!navigator.onLine) {
          this.renderOfflineNotice();
        } else {
          this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Jadwal rilis tidak tersedia. Periksa koneksi internet Anda.</div>';
        }
        return;
      }

      const dayMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayName = dayMap[new Date().getDay()];

      const allDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

      if (!this.selectedScheduleDay) {
        this.selectedScheduleDay = todayName;
      }

      let html = `
        <div class="schedule-container">
          <div class="web-grid-header">
            <div>
              <h2 class="web-section-heading">Jadwal Rilis Mingguan</h2>
              <span class="web-section-count">Pembaruan Episode Anime (Otakudesu) & Donghua (Ani-Chin)</span>
            </div>
          </div>
          <div class="schedule-day-tabs" role="tablist">
      `;

      allDays.forEach(day => {
        const isActive = day === this.selectedScheduleDay;
        const isToday = day.toLowerCase() === todayName.toLowerCase();
        const otakuCount = (schedule.find(g => g.day === day)?.animeList?.length) || 0;
        const anichinCount = (anichinSchedule.find(g => g.day === day)?.animeList?.length) || 0;
        const totalDayCount = otakuCount + anichinCount;

        html += `
          <button class="schedule-tab-btn ${isActive ? 'active' : ''}" data-day="${day}" role="tab" aria-selected="${isActive}">
            <span>${day}</span>
            ${isToday ? `<span class="schedule-today-pill">Hari Ini</span>` : ''}
            <span class="schedule-count-pill">${totalDayCount}</span>
          </button>
        `;
      });

      html += `
          </div>
          <div id="scheduleContentPanel" class="schedule-content-panel"></div>
        </div>
      `;

      this.webDynamicContainer.innerHTML = html;

      // Event listener for schedule day tabs
      this.webDynamicContainer.querySelectorAll('.schedule-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.webDynamicContainer.querySelectorAll('.schedule-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedScheduleDay = btn.dataset.day;
          this.renderScheduleDayContent(this.selectedScheduleDay, todayName);
        });
      });

      this.renderScheduleDayContent(this.selectedScheduleDay, todayName);

    } catch (err) {
      console.error('Error loading schedule:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat jadwal: ${err.message}</div>`;
    }
  }

  renderScheduleDayContent(dayName, todayName) {
    const panel = document.getElementById('scheduleContentPanel');
    if (!panel) return;

    const group = (this.cache.schedule || []).find(g => g.day === dayName);
    const anichinGroup = (this.cache.anichinSchedule || []).find(g => g.day === dayName);

    const otakuList = (group && group.animeList) || [];
    const anichinList = (anichinGroup && anichinGroup.animeList) || [];

    if (otakuList.length === 0 && anichinList.length === 0) {
      panel.innerHTML = '<div class="web-empty-notice">Tidak ada jadwal rilis anime atau donghua pada hari ini.</div>';
      return;
    }

    const isToday = dayName && dayName.toLowerCase().includes(todayName.toLowerCase());
    const totalCount = otakuList.length + anichinList.length;

    let html = `
      <div class="schedule-day-banner">
        <div class="schedule-day-title">
          <span>Hari ${dayName}</span>
          ${isToday ? `<span class="schedule-today-pill">Hari Ini</span>` : ''}
          <span class="web-section-count">${totalCount} Judul Tayang</span>
        </div>
      </div>
    `;

    // 1. Top Section: Anime
    if (otakuList.length > 0) {
      html += `
        <h3 class="web-subsection-heading">Anime (${otakuList.length})</h3>
        <div class="schedule-anime-grid">
      `;

      otakuList.forEach(anime => {
        const initial = (anime.title || 'A').charAt(0).toUpperCase();
        const posterImg = anime.poster
          ? `<img class="netflix-card-poster" src="${anime.poster}" alt="${anime.title}" loading="lazy">`
          : `<div class="poster-placeholder"><span>${initial}</span></div>`;

        html += `
          <div class="netflix-card otakudesu-card schedule-landscape-card" data-url="${anime.url}" data-slug="${anime.slug}" data-source="otakudesu" tabindex="0" role="article" aria-label="${anime.title}">
            <div class="netflix-card-poster-wrap">
              ${posterImg}
              <div class="poster-gradient-overlay"></div>
              <span class="card-badge-top">Total: ${anime.totalEpisodes || anime.episode || 'Episode Baru'}</span>
              <span class="card-badge-bottom">Tersedia</span>
            </div>
            <div class="netflix-card-info">
              <div class="netflix-card-title">${anime.title}</div>
              <div class="netflix-card-meta">Tayang setiap ${dayName}</div>
            </div>
            <div class="netflix-card-hover-panel">
              <div class="hover-action-row">
                <div class="hover-action-left">
                  <button class="btn-card-action btn-card-play btn-card-quick-stream" data-url="${anime.url}" data-slug="${anime.slug}" title="Buka Detail Episode" aria-label="Buka Detail Episode">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <button class="btn-card-action btn-card-secondary btn-card-quick-info" data-url="${anime.url}" data-slug="${anime.slug}" title="Lihat Informasi Anime" aria-label="Detail Anime">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  </button>
                </div>
              </div>
              <div class="hover-card-title">${anime.title}</div>
              <div class="hover-meta-row">
                <span class="hover-badge-outline">HD</span>
                <span class="hover-score-star">★ 8.5</span>
              </div>
              <div class="hover-tags-row">
                <span>Total: ${anime.totalEpisodes || anime.episode || 'Episode Baru'}</span>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // 2. Bottom Section: Donghua
    if (anichinList.length > 0) {
      html += `
        <h3 class="web-subsection-heading heading-donghua">Donghua (${anichinList.length})</h3>
        <div class="schedule-anime-grid">
      `;

      anichinList.forEach(anime => {
        const initial = (anime.title || 'D').charAt(0).toUpperCase();
        const posterImg = anime.poster
          ? `<img class="netflix-card-poster" src="${anime.poster}" alt="${anime.title}" loading="lazy">`
          : `<div class="poster-placeholder"><span>${initial}</span></div>`;

        html += `
          <div class="netflix-card otakudesu-card schedule-landscape-card" data-url="${anime.url}" data-slug="${anime.slug}" data-source="anichin" tabindex="0" role="article" aria-label="${anime.title}">
            <div class="netflix-card-poster-wrap">
              ${posterImg}
              <div class="poster-gradient-overlay"></div>
              <span class="card-badge-top">Total: ${anime.totalEpisodes || anime.episode || 'Episode Baru'}</span>
              <span class="card-badge-bottom">Tersedia</span>
            </div>
            <div class="netflix-card-info">
              <div class="netflix-card-title">${anime.title}</div>
              <div class="netflix-card-meta">Rilis Donghua ${dayName}</div>
            </div>
            <div class="netflix-card-hover-panel">
              <div class="hover-action-row">
                <div class="hover-action-left">
                  <button class="btn-card-action btn-card-play btn-card-quick-anichin" data-url="${anime.url}" data-slug="${anime.slug}" data-source="anichin" title="Buka Detail Episode Donghua" aria-label="Buka Detail Donghua">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <button class="btn-card-action btn-card-secondary btn-card-quick-info" data-url="${anime.url}" data-slug="${anime.slug}" data-source="anichin" title="Lihat Informasi Donghua" aria-label="Detail Donghua">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  </button>
                </div>
              </div>
              <div class="hover-card-title">${anime.title}</div>
              <div class="hover-meta-row">
                <span class="hover-score-star">★ 8.5</span>
                <span class="hover-badge-outline">HD</span>
              </div>
              <div class="hover-tags-row">
                <span>Total: ${anime.totalEpisodes || anime.episode || 'Episode Baru'}</span>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    panel.innerHTML = html;
    this.bindCardClicks(panel);
  }

  /**
   * 3. Sub-Tab: Genre
   */
  async loadGenres() {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading('Memuat daftar genre...');

    try {
      if (!this.cache.genres) {
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetGenres === 'function') {
          this.cache.genres = await window.electronAPI.otakudesuGetGenres();
        }
      }

      const genres = this.cache.genres || [];
      if (genres.length === 0) {
        if (!navigator.onLine) {
          this.renderOfflineNotice();
        } else {
          this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Daftar genre tidak ditemukan.</div>';
        }
        return;
      }

      let html = `
        <div class="web-grid-header">
          <h2 class="web-section-heading">Genre</h2>
          <span class="web-section-count">${genres.length + 1} Kategori Tersedia</span>
        </div>
        <div class="genres-pill-slider" id="genresPillSlider">
          <button class="genre-chip genre-chip-donghua ${this.activeGenre === 'donghua' ? 'active' : ''}" data-slug="donghua">Donghua</button>
      `;

      genres.forEach(g => {
        const isActive = g.slug === this.activeGenre;
        html += `<button class="genre-chip ${isActive ? 'active' : ''}" data-slug="${g.slug}">${g.name}</button>`;
      });

      html += `
        </div>
        <div id="genreAnimeGridContainer" class="genre-anime-grid-container">
          <div class="web-loading-spinner"><div class="yt-spinner"></div><span>Memuat anime genre...</span></div>
        </div>
      `;

      this.webDynamicContainer.innerHTML = html;

      // Event listener genre pills
      this.webDynamicContainer.querySelectorAll('.genre-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          this.webDynamicContainer.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeGenre = btn.dataset.slug;
          this.loadAnimeByGenre(this.activeGenre);
        });
      });

      // Load active genre
      await this.loadAnimeByGenre(this.activeGenre);

    } catch (err) {
      console.error('Error loading genres:', err);
      if (!navigator.onLine) {
        this.renderOfflineNotice();
      } else {
        this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat genre: ${err.message}</div>`;
      }
    }
  }

  async loadAnimeByGenre(slug, page = 1, append = false) {
    const container = document.getElementById('genreAnimeGridContainer');
    if (!container) return;

    if (!append) {
      this.currentGenreSlug = slug;
      this.genreCurrentPage = 1;
      this.genreHasNextPage = false;
      container.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil konten genre...</span></div>';
    } else {
      const btnShowMore = document.getElementById('btnGenreShowMore');
      if (btnShowMore) {
        btnShowMore.disabled = true;
        btnShowMore.innerHTML = '<div class="yt-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Memuat lebih banyak...';
      }
    }

    try {
      if (slug === 'donghua') {
        let res = null;
        if (window.electronAPI && typeof window.electronAPI.anichinGetOngoing === 'function') {
          res = await window.electronAPI.anichinGetOngoing(page);
        }
        if (!res || !res.animeList || res.animeList.length === 0) {
          if (!append) container.innerHTML = '<div class="web-empty-notice">Tidak ada donghua ditemukan.</div>';
          return;
        }
        this.genreCurrentPage = page;
        this.genreHasNextPage = res.animeList.length >= 10;

        if (!append) {
          let html = '<div class="netflix-poster-grid" id="genrePosterGrid">';
          res.animeList.forEach(anime => {
            html += this.renderAnimeCard(anime);
          });
          html += '</div>';

          if (this.genreHasNextPage) {
            html += `
              <div class="genre-show-more-wrap" id="genreShowMoreWrap">
                <button class="btn-genre-show-more" id="btnGenreShowMore" type="button">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                  Muat Lebih Banyak Donghua
                </button>
              </div>
            `;
          } else {
            html += '<div class="genre-end-notice">Semua donghua terkini telah ditampilkan.</div>';
          }

          container.innerHTML = html;
          this.bindCardClicks(container);

          const btnShowMore = document.getElementById('btnGenreShowMore');
          if (btnShowMore) {
            btnShowMore.addEventListener('click', () => {
              this.loadAnimeByGenre(slug, this.genreCurrentPage + 1, true);
            });
          }
        } else {
          const grid = document.getElementById('genrePosterGrid');
          if (grid) {
            let newCardsHtml = '';
            res.animeList.forEach(anime => {
              newCardsHtml += this.renderAnimeCard(anime);
            });
            grid.insertAdjacentHTML('beforeend', newCardsHtml);
            this.bindCardClicks(grid);
          }
        }
        return;
      }

      if (!this.cache.genreAnime) this.cache.genreAnime = {};
      if (!this.cache.genreAnime[slug]) {
        this.cache.genreAnime[slug] = {};
      }

      let res = this.cache.genreAnime[slug][page];
      if (!res) {
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetAnimeByGenre === 'function') {
          res = await window.electronAPI.otakudesuGetAnimeByGenre(slug, page);
          this.cache.genreAnime[slug][page] = res;
        }
      }

      if (!res || !res.animeList || res.animeList.length === 0) {
        if (!append) {
          container.innerHTML = '<div class="web-empty-notice">Tidak ada anime ditemukan untuk genre ini.</div>';
        } else {
          const wrap = document.getElementById('genreShowMoreWrap');
          if (wrap) wrap.innerHTML = '<div class="genre-end-notice">Semua anime dalam genre ini telah ditampilkan.</div>';
        }
        return;
      }

      this.genreCurrentPage = page;
      this.genreHasNextPage = Boolean(res.hasNextPage);

      if (!append) {
        let html = '<div class="netflix-poster-grid" id="genrePosterGrid">';
        res.animeList.forEach(anime => {
          html += this.renderAnimeCard(anime);
        });
        html += '</div>';

        if (this.genreHasNextPage) {
          html += `
            <div class="genre-show-more-wrap" id="genreShowMoreWrap">
              <button class="btn-genre-show-more" id="btnGenreShowMore" type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                Muat Lebih Banyak
              </button>
            </div>
          `;
        } else {
          html += '<div class="genre-end-notice">Semua anime dalam genre ini telah ditampilkan.</div>';
        }

        container.innerHTML = html;
        this.bindCardClicks(container);

        const btnShowMore = document.getElementById('btnGenreShowMore');
        if (btnShowMore) {
          btnShowMore.addEventListener('click', () => {
            this.loadAnimeByGenre(slug, this.genreCurrentPage + 1, true);
          });
        }
      } else {
        const grid = document.getElementById('genrePosterGrid');
        if (grid) {
          let newCardsHtml = '';
          res.animeList.forEach(anime => {
            newCardsHtml += this.renderAnimeCard(anime);
          });
          grid.insertAdjacentHTML('beforeend', newCardsHtml);
          this.bindCardClicks(grid);
        }

        const wrap = document.getElementById('genreShowMoreWrap');
        if (wrap) {
          if (this.genreHasNextPage) {
            wrap.innerHTML = `
              <button class="btn-genre-show-more" id="btnGenreShowMore" type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                Muat Lebih Banyak
              </button>
            `;
            const btnShowMore = document.getElementById('btnGenreShowMore');
            if (btnShowMore) {
              btnShowMore.addEventListener('click', () => {
                this.loadAnimeByGenre(slug, this.genreCurrentPage + 1, true);
              });
            }
          } else {
            wrap.innerHTML = '<div class="genre-end-notice">Semua anime dalam genre ini telah ditampilkan.</div>';
          }
        }
      }

    } catch (err) {
      console.error('Error loading anime by genre:', err);
      if (!append) {
        container.innerHTML = `<div class="web-empty-notice">Gagal memuat anime genre: ${err.message}</div>`;
      } else {
        const btnShowMore = document.getElementById('btnGenreShowMore');
        if (btnShowMore) {
          btnShowMore.disabled = false;
          btnShowMore.textContent = 'Coba Lagi Memuat';
        }
      }
    }
  }

  cleanDisplayTitle(t) {
    if (!t) return '';
    return t
      .replace(/\s*-\s*Batch\s+Subtitle\s+Indonesia/gi, '')
      .replace(/\s*Batch\s+Subtitle\s+Indonesia/gi, '')
      .replace(/\s*Subtitle\s+Indonesia/gi, '')
      .replace(/\s*\[Batch\]/gi, '')
      .replace(/\s*\(Batch\)/gi, '')
      .replace(/\s*Batch\s*$/gi, '')
      .replace(/\s*Sub\s*Indo\s*$/gi, '')
      .trim();
  }

  normalizeAnimeTitle(t) {
    return (t || '')
      .toLowerCase()
      .replace(/batch|subtitle|indonesia|sub\s*indo|bd|season|\(tv\)|\.hack/gi, (m) => m === '.hack' ? 'hack' : '')
      .replace(/[^a-z0-9]/g, '');
  }

  mergeAnimeLists(otakuGroups, kusoGroups, anichinGroups = []) {
    const otakuTitleSet = new Set();
    const mergedMap = new Map();

    // 1. Masukkan semua anime dari Otakudesu terlebih dahulu (Warna Biru)
    (otakuGroups || []).forEach(g => {
      let letter = (g.letter || '#').trim().toUpperCase();
      if (!/^[A-Z]$/.test(letter)) letter = '#';

      if (!mergedMap.has(letter)) {
        mergedMap.set(letter, []);
      }
      const groupItems = mergedMap.get(letter);

      (g.items || []).forEach(it => {
        const norm = this.normalizeAnimeTitle(it.title);
        if (norm) otakuTitleSet.add(norm);
        groupItems.push({
          title: this.cleanDisplayTitle(it.title),
          url: it.url,
          slug: it.slug,
          source: 'otakudesu',
          isDonghua: false
        });
      });
    });

    // 2. Tambahkan anime Kusonime HANYA jika belum ada di Otakudesu (Warna Hitam)
    (kusoGroups || []).forEach(g => {
      let letter = (g.letter || '#').trim().toUpperCase();
      if (!/^[A-Z]$/.test(letter)) letter = '#';

      if (!mergedMap.has(letter)) {
        mergedMap.set(letter, []);
      }
      const groupItems = mergedMap.get(letter);

      (g.items || []).forEach(it => {
        const norm = this.normalizeAnimeTitle(it.title);
        if (!norm || otakuTitleSet.has(norm)) {
          return; // Sudah ada di Otakudesu, lewati agar tidak dobel
        }
        otakuTitleSet.add(norm);
        groupItems.push({
          title: this.cleanDisplayTitle(it.title),
          url: it.url,
          slug: it.slug,
          source: 'kusonime',
          isDonghua: false
        });
      });
    });

    // 3. Tambahkan Donghua dari Ani-Chin (Warna Kuning)
    (anichinGroups || []).forEach(g => {
      let letter = (g.letter || '#').trim().toUpperCase();
      if (!/^[A-Z]$/.test(letter)) letter = '#';

      if (!mergedMap.has(letter)) {
        mergedMap.set(letter, []);
      }
      const groupItems = mergedMap.get(letter);

      (g.items || []).forEach(it => {
        groupItems.push({
          title: this.cleanDisplayTitle(it.title),
          url: it.url,
          slug: it.slug,
          source: 'anichin',
          isDonghua: true
        });
      });
    });

    const sortedLetters = Array.from(mergedMap.keys()).sort((a, b) => {
      if (a === '#') return -1;
      if (b === '#') return 1;
      return a.localeCompare(b);
    });

    const result = [];
    for (const letter of sortedLetters) {
      const items = mergedMap.get(letter).sort((a, b) => a.title.localeCompare(b.title));
      if (items.length > 0) {
        result.push({
          letter,
          items
        });
      }
    }

    return result;
  }

  /**
   * Mengambil dan menggabungkan direktori lengkap dari 3 sumber:
   * Otakudesu (Anime), Kusonime (Batch Anime), dan Ani-Chin (Donghua).
   * Menjamin semua sumber dimuat secara paralel dan tidak ada yang tertinggal.
   */
  async fetchAndMergeAnimeList() {
    // Jika sudah lengkap memuat ketiga sumber, gunakan cache
    if (this.cache.animeList && Array.isArray(this.cache.animeList) && this.cache.animeList.length > 0) {
      const hasAllSources = this.cache.animeList.some(g => g.items && g.items.some(i => i.source === 'otakudesu')) &&
                            this.cache.animeList.some(g => g.items && g.items.some(i => i.source === 'kusonime')) &&
                            this.cache.animeList.some(g => g.items && g.items.some(i => i.source === 'anichin' || i.isDonghua));
      if (hasAllSources) {
        return this.cache.animeList;
      }
    }

    // Jika proses fetch sedang berjalan di latar belakang, gunakan promise yang sama
    if (this.animeListFetchPromise) {
      return this.animeListFetchPromise;
    }

    this.animeListFetchPromise = (async () => {
      try {
        let otakuGroups = [];
        let kusoGroups = [];
        let anichinGroups = [];

        const fetchPromises = [];
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetAnimeList === 'function') {
          fetchPromises.push(
            window.electronAPI.otakudesuGetAnimeList()
              .then(res => { otakuGroups = res || []; })
              .catch(err => console.warn('Otakudesu anime list error:', err.message))
          );
        }

        if (window.electronAPI && typeof window.electronAPI.kusonimeGetAnimeList === 'function') {
          fetchPromises.push(
            window.electronAPI.kusonimeGetAnimeList()
              .then(res => { kusoGroups = res || []; })
              .catch(err => console.warn('Kusonime anime list error:', err.message))
          );
        }

        if (window.electronAPI && typeof window.electronAPI.anichinGetAnimeList === 'function') {
          fetchPromises.push(
            window.electronAPI.anichinGetAnimeList()
              .then(res => { anichinGroups = res || []; })
              .catch(err => console.warn('Ani-Chin anime list error:', err.message))
          );
        }

        await Promise.all(fetchPromises);

        // Gabungkan direktori tiga sumber
        const merged = this.mergeAnimeLists(otakuGroups, kusoGroups, anichinGroups);
        if (merged && merged.length > 0) {
          this.cache.animeList = merged;
        }
        return this.cache.animeList;
      } catch (err) {
        console.warn('Gagal memuat direktori anime gabungan:', err);
        return this.cache.animeList || [];
      } finally {
        this.animeListFetchPromise = null;
      }
    })();

    return this.animeListFetchPromise;
  }

  /**
   * 4. Sub-Tab: Daftar Anime A-Z
   * Menggabungkan direktori Otakudesu (Biru), Kusonime (Hitam), dan Ani-Chin Donghua (Kuning)
   */
  async loadAnimeList() {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');

    const isFullyCached = this.cache.animeList &&
      Array.isArray(this.cache.animeList) &&
      this.cache.animeList.length > 0 &&
      this.cache.animeList.some(g => g.items && g.items.some(i => i.source === 'otakudesu')) &&
      this.cache.animeList.some(g => g.items && g.items.some(i => i.source === 'kusonime')) &&
      this.cache.animeList.some(g => g.items && g.items.some(i => i.source === 'anichin' || i.isDonghua));

    if (!isFullyCached) {
      this.showLoading('Memuat direktori anime & donghua A-Z gabungan (Otakudesu, Kusonime, Ani-Chin)...');
      await this.fetchAndMergeAnimeList();
    }

    try {
      const groups = this.cache.animeList || [];
      if (groups.length === 0) {
        if (!navigator.onLine) {
          this.renderOfflineNotice();
        } else {
          this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Direktori anime tidak dapat dimuat.</div>';
        }
        return;
      }

      let totalCount = 0;
      groups.forEach(g => { totalCount += (g.items ? g.items.length : 0); });

      let html = `
        <div class="alphabet-nav-wrap">
          <div class="web-grid-header">
            <div>
              <h2 class="web-section-heading">Daftar Anime (A - Z)</h2>
              <span class="web-section-count">${groups.length} Grup Abjad • ${totalCount.toLocaleString('id-ID')} Judul</span>
            </div>
          </div>

          <!-- Category Filter Bar (Semua, Anime, Donghua) -->
          <div class="alphabet-category-filter" role="tablist">
            <button class="az-filter-btn ${this.animeListTypeFilter === 'all' ? 'active' : ''}" data-filter="all">Semua</button>
            <button class="az-filter-btn ${this.animeListTypeFilter === 'anime' ? 'active' : ''}" data-filter="anime">Anime</button>
            <button class="az-filter-btn ${this.animeListTypeFilter === 'donghua' ? 'active' : ''}" data-filter="donghua">Donghua</button>
          </div>

          <!-- Sticky Alphabet Quick Jump Bar -->
          <div class="az-sticky-bar" id="alphabetIndexBar" role="tablist">
      `;

      groups.forEach((g) => {
        html += `<button class="az-jump-btn" data-letter="${g.letter}">${g.letter}</button>`;
      });

      html += `
          </div>
          <div class="alphabet-search-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#888888">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input type="text" id="inputFilterAlphabet" placeholder="Filter judul anime & donghua..." aria-label="Filter judul">
          </div>
        </div>
        <div id="alphabetListContainer" class="alphabet-list-container"></div>
      `;

      this.webDynamicContainer.innerHTML = html;

      // Event listener for category filter buttons
      this.webDynamicContainer.querySelectorAll('.az-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.webDynamicContainer.querySelectorAll('.az-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.animeListTypeFilter = btn.dataset.filter;
          const searchInput = document.getElementById('inputFilterAlphabet');
          const q = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';
          this.renderFullAlphabetCatalog(q);
        });
      });

      // Event listener for sticky alphabet quick jump buttons
      this.webDynamicContainer.querySelectorAll('.az-jump-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const letter = btn.dataset.letter;
          const target = document.getElementById(`az-group-${letter}`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      const searchInput = document.getElementById('inputFilterAlphabet');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = (e.target.value || '').toLowerCase().trim();
          this.renderFullAlphabetCatalog(q);
        });
      }

      this.renderFullAlphabetCatalog();

    } catch (err) {
      console.error('Error loading anime list:', err);
      if (!navigator.onLine) {
        this.renderOfflineNotice();
      } else {
        this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat direktori: ${err.message}</div>`;
      }
    }
  }

  renderFullAlphabetCatalog(filterQuery = '') {
    const container = document.getElementById('alphabetListContainer');
    if (!container || !this.cache.animeList) return;

    const groups = this.cache.animeList;
    let html = '';
    let totalRendered = 0;

    groups.forEach(group => {
      let items = group.items || [];

      // Filter category
      if (this.animeListTypeFilter === 'anime') {
        items = items.filter(it => !it.isDonghua);
      } else if (this.animeListTypeFilter === 'donghua') {
        items = items.filter(it => it.isDonghua);
      }

      // Filter search query
      if (filterQuery) {
        items = items.filter(it => it.title.toLowerCase().includes(filterQuery));
      }

      if (items.length > 0) {
        totalRendered += items.length;
        html += `
          <div class="az-letter-banner" id="az-group-${group.letter}">
            <div class="az-letter-badge">${group.letter}</div>
            <div class="az-letter-line"></div>
            <div class="az-letter-count">${items.length} Judul</div>
          </div>
          <div class="alphabet-items-grid">
        `;

        items.forEach(item => {
          const src = item.source || 'otakudesu';
          const isKuso = src === 'kusonime';
          const isAnichin = src === 'anichin' || item.isDonghua;

          const cardSourceClass = isAnichin ? 'card-source-anichin' : (isKuso ? 'card-source-kusonime' : 'card-source-otakudesu');
          const monogramClass = isAnichin ? 'monogram-anichin' : (isKuso ? 'monogram-kuso' : 'monogram-otaku');
          const showDonghuaTag = this.animeListTypeFilter === 'all' && isAnichin;

          html += `
            <div class="alphabet-anime-card ${cardSourceClass}" data-url="${item.url}" data-slug="${item.slug}" data-source="${src}" tabindex="0" role="button" aria-label="${item.title}">
              <div class="alphabet-monogram ${monogramClass}">${group.letter}</div>
              <div class="alphabet-card-details">
                <div class="alphabet-card-title" title="${item.title}">
                  ${item.title}
                  ${showDonghuaTag ? '<span class="tag-donghua">Donghua</span>' : ''}
                </div>
              </div>
            </div>
          `;
        });

        html += `</div>`;
      }
    });

    if (totalRendered === 0) {
      container.innerHTML = `<div class="web-empty-notice">Tidak ada judul yang cocok dengan filter "${filterQuery || this.animeListTypeFilter}".</div>`;
      return;
    }

    container.innerHTML = html;

    container.querySelectorAll('.alphabet-anime-card').forEach(card => {
      const handleAction = () => {
        const url = card.dataset.url;
        const slug = card.dataset.slug;
        const source = card.dataset.source;
        if (source === 'kusonime') {
          this.openKusonimeDetail(url || slug);
        } else if (source === 'anichin') {
          this.openAnichinDetail(url || slug);
        } else {
          this.openAnimeDetail(url || slug);
        }
      };

      card.addEventListener('click', handleAction);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAction();
        }
      });
    });
  }

  /**
   * 5. Sub-Tab: Downloaded (Anime yang sudah diunduh ke folder khusus)
   */
  async renderDownloadedView() {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading('Memindai folder download...');

    try {
      let libraryResult = null;
      if (window.electronAPI && typeof window.electronAPI.scanDownloads === 'function') {
        libraryResult = await window.electronAPI.scanDownloads();
      } else if (window.electronAPI && typeof window.electronAPI.scanLibrary === 'function') {
        libraryResult = await window.electronAPI.scanLibrary();
      }

      const seriesList = (libraryResult && libraryResult.seriesList) || [];
      const movies = (libraryResult && libraryResult.movies) || [];
      const totalDownloaded = seriesList.length + movies.length;
      this.lastDownloadedSeriesList = seriesList;

      // Update badge
      if (this.downloadedBadge) {
        if (totalDownloaded > 0) {
          this.downloadedBadge.textContent = totalDownloaded;
          this.downloadedBadge.classList.remove('hidden');
        } else {
          this.downloadedBadge.classList.add('hidden');
        }
      }

      const currentPath = (libraryResult && libraryResult.libraryPath) || this.downloadPath || 'downloads';
      const totalFiles = seriesList.reduce((acc, s) => acc + (s.episodesCount || 0), 0) + movies.length;

      let html = `
        <div class="web-grid-header">
          <div>
            <h2 class="web-section-heading">Anime Hasil Unduhan Web (Downloaded)</h2>
            <div class="downloaded-folder-info">
              <span>Folder Khusus Unduhan Web: <code>${currentPath}</code></span>
            </div>
          </div>
          <div class="downloaded-header-actions">
            <button id="btnChangeDlFolderSub" class="btn-subnav-action" title="Ubah Lokasi Folder Unduhan">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              <span>Ubah Folder</span>
            </button>
            <button id="btnOpenDlFolderSub" class="btn-subnav-action" title="Buka Folder di Windows Explorer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
              <span>Buka Folder</span>
            </button>
            <button id="btnDeleteAllDownloadedSub" class="btn-subnav-action btn-danger-action" title="Hapus Semua Video Hasil Unduhan">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              <span>Hapus Semua</span>
            </button>
          </div>
        </div>

        <div class="downloaded-stats-bar">
          <div class="downloaded-stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
            </div>
            <div class="stat-meta">
              <span class="stat-label">Total Koleksi Unduhan</span>
              <span class="stat-value">${seriesList.length} Serial / Anime</span>
            </div>
          </div>
          <div class="downloaded-stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.89-2-2-2zm-7 11.5V8.5l5 3.5-5 3.5z"/></svg>
            </div>
            <div class="stat-meta">
              <span class="stat-label">Total File Video</span>
              <span class="stat-value">${totalFiles} Episode Offline</span>
            </div>
          </div>
          <div class="downloaded-stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            </div>
            <div class="stat-meta">
              <span class="stat-label">Folder Unduhan</span>
              <span class="stat-value" title="${currentPath}">${currentPath.split(/[\\/]/).pop() || currentPath}</span>
            </div>
          </div>
        </div>
      `;

      if (totalDownloaded === 0) {
        html += `
          <div class="downloaded-empty-state">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#e50914">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
            </svg>
            <h3 class="empty-title">Belum Ada Unduhan dari Web</h3>
            <p class="empty-subtitle">Koleksi anime lokal komputer Anda berada di tab <b>Beranda</b>. Tab ini khusus menampilkan anime yang diunduh langsung melalui pemutar ini.</p>
            <button class="btn-netflix-play" id="btnExploreFromDownloaded">Jelajahi Anime Sekarang</button>
          </div>
        `;
      } else {
        html += '<div class="netflix-poster-grid">';

        seriesList.forEach(series => {
          let poster = '';
          if (series.posterPath) {
            poster = `http://127.0.0.1:${this.player.serverPort}/file?path=${encodeURIComponent(series.posterPath)}`;
          } else if (series.episodes && series.episodes.length > 0) {
            poster = `http://127.0.0.1:${this.player.serverPort}/thumbnail?path=${encodeURIComponent(series.episodes[0].path)}`;
          }

          const lastWatchedText = series.lastWatched ? `Terakhir: ${series.lastWatched.episodeName}` : `${series.episodesCount} Episode`;
          const metaText = (Array.isArray(series.genres) && series.genres.length > 0)
            ? series.genres.join(', ')
            : lastWatchedText;

          html += `
            <div class="netflix-card local-downloaded-card" data-series-path="${series.path}" tabindex="0" role="article" aria-label="${series.title}">
              <div class="netflix-card-poster-wrap">
                ${poster ? `<img class="netflix-card-poster" src="${poster}" alt="${series.title}" loading="lazy">` : `<div class="poster-placeholder"><span>${series.title.charAt(0)}</span></div>`}
                <div class="poster-gradient-overlay"></div>
                <span class="card-badge-top badge-red">Lokal Offline</span>
                <span class="card-badge-bottom">${series.episodesCount} File</span>
              </div>
              <div class="netflix-card-info">
                <div class="netflix-card-title">${series.title}</div>
                <div class="netflix-card-meta">${metaText}</div>
              </div>
              <div class="netflix-card-hover-panel">
                <div class="hover-action-row">
                  <div class="hover-action-left">
                    <button class="btn-card-action btn-card-play btn-play-local" data-series-path="${series.path}" title="Putar Langsung" aria-label="Putar">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="btn-card-action btn-card-secondary btn-episodes-local" data-series-path="${series.path}" title="Daftar Episode & Sinopsis" aria-label="Detail Series">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </button>
                  </div>
                  <button class="btn-card-action btn-card-secondary btn-folder-local" data-series-path="${series.path}" title="Buka di Explorer" aria-label="Buka Folder">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                  </button>
                </div>
                <div class="hover-meta-row">
                  <span class="hover-match-score">${series.episodesCount} Episode</span>
                  <span class="hover-badge-outline">Offline</span>
                </div>
                <div class="hover-tags-row">
                  <span>${series.synopsis ? series.synopsis.slice(0, 75) + '...' : series.title}</span>
                </div>
              </div>
            </div>
          `;
        });

        html += '</div>';
      }

      this.webDynamicContainer.innerHTML = html;

      // Event listeners for empty state CTA
      const btnExplore = document.getElementById('btnExploreFromDownloaded');
      if (btnExplore) {
        btnExplore.addEventListener('click', () => {
          this.switchSubTab('ongoing');
        });
      }

      // Event Listeners for local cards
      this.webDynamicContainer.querySelectorAll('.local-downloaded-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-card-action')) return;
          const seriesPath = card.dataset.seriesPath;
          const found = seriesList.find(s => s.path === seriesPath);
          if (found && this.library) {
            this.library.openEpisodesModal(found);
          }
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const seriesPath = card.dataset.seriesPath;
            const found = seriesList.find(s => s.path === seriesPath);
            if (found && this.library) {
              this.library.openEpisodesModal(found);
            }
          }
        });
      });

      // Local Play buttons
      this.webDynamicContainer.querySelectorAll('.btn-play-local').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const seriesPath = btn.dataset.seriesPath;
          const found = seriesList.find(s => s.path === seriesPath);
          if (found) {
            if (found.lastWatched && found.lastWatched.filePath) {
              this.player.loadVideo(found.lastWatched.filePath, `${found.title} - ${found.lastWatched.episodeName}`);
            } else if (found.episodes && found.episodes.length > 0) {
              this.player.loadVideo(found.episodes[0].path, `${found.title} - ${found.episodes[0].name}`);
            }
          }
        });
      });

      // Local Episode modal buttons
      this.webDynamicContainer.querySelectorAll('.btn-episodes-local').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const seriesPath = btn.dataset.seriesPath;
          const found = seriesList.find(s => s.path === seriesPath);
          if (found && this.library) {
            this.library.openEpisodesModal(found);
          }
        });
      });

      // Local Open Folder buttons
      this.webDynamicContainer.querySelectorAll('.btn-folder-local').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const seriesPath = btn.dataset.seriesPath;
          if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === 'function') {
            window.electronAPI.openDownloadFolder(seriesPath);
          }
        });
      });

      const btnChange = document.getElementById('btnChangeDlFolderSub');
      if (btnChange) {
        btnChange.addEventListener('click', async () => {
          if (window.electronAPI && typeof window.electronAPI.chooseDownloadFolder === 'function') {
            const chosen = await window.electronAPI.chooseDownloadFolder();
            if (chosen) {
              await this.refreshDownloadPath();
              this.renderDownloadedView();
            }
          }
        });
      }

      const btnOpen = document.getElementById('btnOpenDlFolderSub');
      if (btnOpen) {
        btnOpen.addEventListener('click', () => {
          if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === 'function') {
            window.electronAPI.openDownloadFolder();
          }
        });
      }

      const btnDeleteAll = document.getElementById('btnDeleteAllDownloadedSub');
      if (btnDeleteAll) {
        btnDeleteAll.addEventListener('click', () => {
          window.showConfirmDialog({
            title: 'Hapus Semua Unduhan',
            message: 'Apakah Anda yakin ingin menghapus SELURUH video dan file di dalam folder unduhan? Tindakan ini tidak dapat dibatalkan.',
            confirmText: 'Ya, Hapus Semua',
            onConfirm: async () => {
              try {
                if (window.electronAPI && typeof window.electronAPI.deleteAllDownloads === 'function') {
                  await window.electronAPI.deleteAllDownloads();
                  await this.renderDownloadedView();
                  if (window.controlsManager && typeof window.controlsManager.showToast === 'function') {
                    window.controlsManager.showToast('Semua file unduhan berhasil dihapus.');
                  }
                }
              } catch (err) {
                alert('Gagal menghapus unduhan: ' + err.message);
              }
            }
          });
        });
      }

    } catch (err) {
      console.error('Error rendering downloaded view:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat unduhan: ${err.message}</div>`;
    }
  }

  /**
   * 6. Pencarian Anime & Donghua
   */
  async executeSearch(query, forceSource = null) {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading(`Mencari "${query}"...`);
    this.searchQuery = query;

    try {
      const promises = [];
      if (window.electronAPI && typeof window.electronAPI.otakudesuSearch === 'function') {
        promises.push(window.electronAPI.otakudesuSearch(query).catch(err => {
          console.warn('Otakudesu search failed:', err);
          return [];
        }));
      } else {
        promises.push(Promise.resolve([]));
      }

      if (window.electronAPI && typeof window.electronAPI.kusonimeSearch === 'function') {
        promises.push(window.electronAPI.kusonimeSearch(query).catch(err => {
          console.warn('Kusonime search failed:', err);
          return [];
        }));
      } else {
        promises.push(Promise.resolve([]));
      }

      if (window.electronAPI && typeof window.electronAPI.anichinSearch === 'function') {
        promises.push(window.electronAPI.anichinSearch(query).catch(err => {
          console.warn('Ani-Chin search failed:', err);
          return [];
        }));
      } else {
        promises.push(Promise.resolve([]));
      }

      const [otakuResults, kusoResults, anichinResults] = await Promise.all(promises);

      this.lastSearchResults = {
        otakudesu: otakuResults || [],
        kusonime: kusoResults || [],
        anichin: anichinResults || [],
        query
      };

      if (forceSource) {
        this.searchSourceFilter = forceSource;
      } else if (!this.searchSourceFilter) {
        this.searchSourceFilter = 'all';
      }

      this.renderSearchResults();

    } catch (err) {
      console.error('Error executing search:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal mencari anime & donghua: ${err.message}</div>`;
    }
  }

  renderSearchResults() {
    const { otakudesu, kusonime, anichin, query } = this.lastSearchResults || { otakudesu: [], kusonime: [], anichin: [], query: '' };
    const otakuCount = otakudesu ? otakudesu.length : 0;
    const kusoCount = kusonime ? kusonime.length : 0;
    const anichinCount = anichin ? anichin.length : 0;
    const totalCount = otakuCount + kusoCount + anichinCount;

    if (totalCount === 0) {
      this.webDynamicContainer.innerHTML = `
        <div class="web-empty-notice">
          Tidak ada anime atau donghua yang cocok dengan kata kunci "<b>${query}</b>". Silakan coba kata kunci lain.
        </div>
      `;
      return;
    }

    let html = `
      <div class="web-grid-header search-results-header">
        <div>
          <h2 class="web-section-heading">Hasil Pencarian: "${query}"</h2>
          <span class="web-section-count">${totalCount} Judul Ditemukan</span>
        </div>
        <div class="search-source-filter-tabs" role="tablist">
          <button class="source-filter-btn ${this.searchSourceFilter === 'all' ? 'active' : ''}" data-source="all">
            Semua (${totalCount})
          </button>
          <button class="source-filter-btn ${this.searchSourceFilter === 'otakudesu' ? 'active' : ''}" data-source="otakudesu">
            Anime (${otakuCount})
          </button>
          <button class="source-filter-btn ${this.searchSourceFilter === 'kusonime' ? 'active' : ''}" data-source="kusonime">
            Batch (${kusoCount})
          </button>
          <button class="source-filter-btn ${this.searchSourceFilter === 'anichin' ? 'active' : ''}" data-source="anichin" style="${this.searchSourceFilter === 'anichin' ? 'background:#eab308;color:#000;' : ''}">
            Donghua (${anichinCount})
          </button>
        </div>
      </div>
    `;

    let itemsToDisplay = [];
    if (this.searchSourceFilter === 'otakudesu') {
      itemsToDisplay = otakudesu || [];
    } else if (this.searchSourceFilter === 'kusonime') {
      itemsToDisplay = kusonime || [];
    } else if (this.searchSourceFilter === 'anichin') {
      itemsToDisplay = anichin || [];
    } else {
      // 'all': gabungkan semua
      itemsToDisplay = [...(otakudesu || []), ...(anichin || []), ...(kusonime || [])];
    }

    if (itemsToDisplay.length === 0) {
      html += `
        <div class="web-empty-notice">
          Tidak ada hasil untuk kategori filter "${this.searchSourceFilter}". Silakan pilih tab lainnya di atas.
        </div>
      `;
    } else {
      html += '<div class="netflix-poster-grid">';
      itemsToDisplay.forEach(anime => {
        html += this.renderAnimeCard(anime);
      });
      html += '</div>';
    }

    this.webDynamicContainer.innerHTML = html;

    // Pasang listener pada tombol filter tab sumber
    this.webDynamicContainer.querySelectorAll('.source-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.searchSourceFilter = btn.dataset.source;
        this.renderSearchResults();
      });
    });

    this.bindCardClicks();
  }

  /**
   * Helper: Merender satu kartu poster anime dengan 2:3 aspect ratio dan hover panel
   */
  renderAnimeCard(anime) {
    const slug = anime.slug;
    const isKusonime = anime.source === 'kusonime' || anime.isBatchOnly;
    const isAnichin = anime.source === 'anichin' || anime.isDonghua;
    const historyEntry = (!isKusonime && !isAnichin) ? this.onlineHistory[slug] : null;
    let progressPercent = 0;
    let watchedBadgeText = '';

    if (historyEntry) {
      if (historyEntry.lastEpisodeTitle) {
        watchedBadgeText = `Ditonton: ${historyEntry.lastEpisodeTitle}`;
      }
      if (historyEntry.duration > 0 && historyEntry.currentTime > 0) {
        progressPercent = Math.min(100, Math.round((historyEntry.currentTime / historyEntry.duration) * 100));
      }
    }

    let badgeTop = '';
    let badgeBottom = '';
    let sourceColorClass = '';

    if (isAnichin) {
      badgeTop = anime.latestEpisode || anime.episode || 'Donghua';
      badgeBottom = 'Donghua';
      sourceColorClass = 'card-source-anichin';
    } else if (isKusonime) {
      badgeTop = 'Batch';
      badgeBottom = 'Download Batch';
      sourceColorClass = 'card-source-kusonime';
    } else {
      badgeTop = (anime.episode || (anime.rating ? `★ ${anime.rating}` : '') || (anime.status ? `● ${anime.status}` : 'Ongoing'));
      badgeBottom = (anime.day ? `${anime.day} • ${anime.date || ''}` : (anime.genres || 'Tersedia'));
      sourceColorClass = 'card-source-otakudesu';
    }

    const scoreText = anime.score ? `★ ${anime.score}` : (anime.rating ? `★ ${anime.rating}` : (historyEntry ? 'Terakhir Ditonton' : '★ 8.5'));
    const statusText = isAnichin ? 'Donghua' : (isKusonime ? 'Batch Only' : (anime.status || 'Ongoing'));
    const resolvedSource = isAnichin ? 'anichin' : (isKusonime ? 'kusonime' : 'otakudesu');

    return `
      <div class="netflix-card otakudesu-card ${sourceColorClass} ${isKusonime ? 'kusonime-card' : ''}" data-url="${anime.url}" data-slug="${slug}" data-source="${resolvedSource}" tabindex="0" role="article" aria-label="${anime.title}">
        <div class="netflix-card-poster-wrap">
          ${anime.poster ? `<img class="netflix-card-poster" src="${anime.poster}" alt="${anime.title}" loading="lazy">` : `<div class="poster-placeholder"><span>${anime.title.charAt(0)}</span></div>`}
          <div class="poster-gradient-overlay"></div>
          ${badgeTop ? `<span class="card-badge-top ${isKusonime ? 'badge-kusonime' : ''}">${badgeTop}</span>` : ''}
          ${badgeBottom ? `<span class="card-badge-bottom ${isKusonime ? 'badge-kusonime-bottom' : ''}">${badgeBottom}</span>` : ''}
          ${progressPercent > 0 ? `
            <div class="card-progress-bar-bg">
              <div class="card-progress-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
          ` : ''}
        </div>
        <div class="netflix-card-info">
          <div class="netflix-card-title">${anime.title}</div>
          ${watchedBadgeText ? `<div class="netflix-card-meta card-watched-text">${watchedBadgeText}</div>` : (anime.studio ? `<div class="netflix-card-meta">${anime.studio}</div>` : `<div class="netflix-card-meta">${badgeBottom}</div>`)}
        </div>
        <div class="netflix-card-hover-panel">
          <div class="hover-action-row">
            <div class="hover-action-left">
              ${isAnichin ? `
                <button class="btn-card-action btn-card-play btn-card-quick-anichin" data-url="${anime.url}" data-slug="${slug}" data-source="anichin" title="Buka Detail Episode Donghua" aria-label="Buka Donghua">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
              ` : (isKusonime ? `
                <button class="btn-card-action btn-card-play btn-card-quick-batch" data-url="${anime.url}" data-slug="${slug}" data-source="kusonime" title="Lihat Paket Batch & Download" aria-label="Lihat Batch">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                </button>
              ` : `
                <button class="btn-card-action btn-card-play btn-card-quick-stream" data-url="${anime.url}" data-slug="${slug}" title="Putar Langsung" aria-label="Putar Langsung">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
              `)}
              <button class="btn-card-action btn-card-secondary btn-card-quick-info" data-url="${anime.url}" data-slug="${slug}" data-source="${resolvedSource}" title="Lihat Detail & Episode" aria-label="Detail Anime">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </button>
            </div>
          </div>
          <div class="hover-card-title">${anime.title}</div>
          <div class="hover-meta-row">
            <span class="hover-score-star" style="${isAnichin ? 'color:#facc15;' : ''}">${scoreText}</span>
            <span class="hover-badge-outline">${isKusonime ? 'BATCH' : 'HD'}</span>
            <span class="${isAnichin ? 'hover-badge-amber' : (isKusonime ? 'hover-badge-amber' : 'hover-badge-red')}">${statusText}</span>
          </div>
          <div class="hover-tags-row">
            <span>${anime.genres || (isAnichin ? 'Donghua' : (anime.day || anime.title))}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Helper: Merender kartu anime untuk baris Lanjutkan Menonton (16:9 thumbnail)
   */
  renderContinueCard(hist) {
    const slug = hist.animeSlug;
    const dur = hist.duration || 0;
    const cur = hist.currentTime || 0;
    const progressPercent = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0;
    const epTitle = hist.lastEpisodeTitle || 'Lanjutkan Episode';
    const animeUrl = slug ? `https://otakudesu.blog/anime/${slug}/` : (hist.lastEpisodeUrl || '');

    return `
      <div class="netflix-card otakudesu-card continue-watching-card" data-url="${animeUrl}" data-slug="${slug || ''}" tabindex="0" role="article" aria-label="${hist.animeTitle}">
        <button class="btn-remove-continue" data-slug="${slug || ''}" title="Hapus dari Lanjutkan Menonton" aria-label="Hapus">&times;</button>
        <div class="netflix-card-poster-wrap">
          ${hist.poster ? `<img class="netflix-card-poster" src="${hist.poster}" alt="${hist.animeTitle}" loading="lazy">` : `<div class="poster-placeholder"><span>${(hist.animeTitle || 'A').charAt(0)}</span></div>`}
          <div class="poster-gradient-overlay"></div>
          <span class="card-badge-top badge-red">▶ Lanjutkan</span>
          <span class="card-badge-bottom">${progressPercent}%</span>
          <div class="card-progress-bar-bg">
            <div class="card-progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
        <div class="netflix-card-info">
          <div class="netflix-card-title">${hist.animeTitle}</div>
          <div class="netflix-card-meta card-watched-text" title="${epTitle}">${epTitle}</div>
        </div>
        <div class="netflix-card-hover-panel">
          <div class="hover-action-row">
            <div class="hover-action-left">
              <button class="btn-card-action btn-card-play btn-continue-play" data-episode-url="${hist.lastEpisodeUrl || ''}" data-episode-title="${hist.lastEpisodeTitle || ''}" data-anime-title="${hist.animeTitle || ''}" data-anime-slug="${slug || ''}" data-poster="${hist.poster || ''}" title="Lanjutkan Pemutaran" aria-label="Lanjutkan">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="btn-card-action btn-card-secondary btn-card-quick-info" data-url="${animeUrl}" data-slug="${slug || ''}" title="Semua Episode" aria-label="Daftar Episode">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </button>
            </div>
          </div>
          <div class="hover-card-title">${hist.animeTitle}</div>
          <div class="hover-meta-row">
            <span class="hover-match-score">${progressPercent}% ditonton</span>
            <span class="hover-badge-outline">HD</span>
          </div>
          <div class="hover-tags-row">
            <span>${epTitle}</span>
          </div>
        </div>
      </div>
    `;
  }

  bindSliderArrows(container = this.webDynamicContainer) {
    if (!container) return;
    container.querySelectorAll('.btn-slider-arrow').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.target;
        const slider = document.getElementById(targetId);
        if (!slider) return;

        const isLeft = btn.classList.contains('btn-slider-left');
        const scrollAmount = Math.max(300, slider.clientWidth * 0.75);
        slider.scrollBy({
          left: isLeft ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
      });
    });

    // Support horizontal wheel scrolling
    container.querySelectorAll('.web-horizontal-slider').forEach(slider => {
      slider.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          slider.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    });
  }

  bindCardClicks(container = this.webDynamicContainer) {
    if (!container) return;

    // Remove from Continue Watching handler
    container.querySelectorAll('.btn-remove-continue').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const slug = btn.dataset.slug;
        if (slug && window.electronAPI?.deleteOnlineProgress) {
          await window.electronAPI.deleteOnlineProgress(slug);
          await this.refreshOnlineHistory();
          this.loadOngoing(true);
        }
      });
    });

    // Continue Watching direct play handler
    container.querySelectorAll('.btn-continue-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const epUrl = btn.dataset.episodeUrl;
        const epTitle = btn.dataset.episodeTitle;
        const animeTitle = btn.dataset.animeTitle;
        const animeSlug = btn.dataset.animeSlug;
        const poster = btn.dataset.poster;

        if (epUrl) {
          this.streamEpisode(
            { url: epUrl, title: epTitle || 'Lanjutkan Episode' },
            { title: animeTitle || 'Anime', slug: animeSlug, poster },
            btn
          );
        } else if (animeSlug) {
          this.openAnimeDetail(animeSlug);
        }
      });
    });

    // Quick Batch buttons for Kusonime inside hover panels
    container.querySelectorAll('.btn-card-quick-batch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const slug = btn.dataset.slug;
        if (url) {
          this.openKusonimeDetail(url);
        } else if (slug) {
          this.openKusonimeDetail(slug);
        }
      });
    });

    // Quick Play buttons for Ani-Chin Donghua inside hover panels
    container.querySelectorAll('.btn-card-quick-anichin').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const slug = btn.dataset.slug;
        if (url) {
          this.openAnichinDetail(url);
        } else if (slug) {
          this.openAnichinDetail(slug);
        }
      });
    });

    // Quick Play buttons inside hover panels
    container.querySelectorAll('.btn-card-quick-stream').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const slug = btn.dataset.slug;
        if (url) {
          this.openAnimeDetail(url);
        } else if (slug) {
          this.openAnimeDetail(slug);
        }
      });
    });

    // Quick Detail buttons inside hover panels
    container.querySelectorAll('.btn-card-quick-info').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const slug = btn.dataset.slug;
        const source = btn.dataset.source;
        if (source === 'kusonime') {
          if (url) this.openKusonimeDetail(url);
          else if (slug) this.openKusonimeDetail(slug);
          return;
        }
        if (source === 'anichin') {
          if (url) this.openAnichinDetail(url);
          else if (slug) this.openAnichinDetail(slug);
          return;
        }
        if (url) {
          this.openAnimeDetail(url);
        } else if (slug) {
          this.openAnimeDetail(slug);
        }
      });
    });

    // Entire card click
    container.querySelectorAll('.otakudesu-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-action')) return;
        const url = card.dataset.url;
        const slug = card.dataset.slug;
        const source = card.dataset.source;
        if (source === 'kusonime') {
          if (url) this.openKusonimeDetail(url);
          else if (slug) this.openKusonimeDetail(slug);
          return;
        }
        if (source === 'anichin') {
          if (url) this.openAnichinDetail(url);
          else if (slug) this.openAnichinDetail(slug);
          return;
        }
        if (url) {
          this.openAnimeDetail(url);
        } else if (slug) {
          this.openAnimeDetail(slug);
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = card.dataset.url;
          const slug = card.dataset.slug;
          const source = card.dataset.source;
          if (source === 'kusonime') {
            if (url) this.openKusonimeDetail(url);
            else if (slug) this.openKusonimeDetail(slug);
            return;
          }
          if (source === 'anichin') {
            if (url) this.openAnichinDetail(url);
            else if (slug) this.openAnichinDetail(slug);
            return;
          }
          if (url) {
            this.openAnimeDetail(url);
          } else if (slug) {
            this.openAnimeDetail(slug);
          }
        }
      });
    });
  }

  /**
   * 7. Idlix-Style Dynamic Series Detail Tab & Full-Page View
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async openSeriesDetail(source, urlOrSlug, initialData = null) {
    if (!urlOrSlug) return;

    // Extract slug
    let slug = '';
    if (typeof urlOrSlug === 'string') {
      const clean = urlOrSlug.replace(/\/+$/, '');
      const parts = clean.split('/');
      slug = parts[parts.length - 1] || 'series';
    } else if (initialData && initialData.slug) {
      slug = initialData.slug;
    } else {
      slug = 'series-' + Date.now();
    }

    // Save previous catalog tab and scroll position if we weren't already in a detail view
    if (!this.activeDetailTabSlug) {
      this.previousCatalogSubTab = this.activeSub || 'ongoing';
      this.catalogScrollTop = this.webSection ? this.webSection.scrollTop : 0;
    }

    this.activeDetailTabSlug = slug;

    // Sembunyikan web subnav bar sepenuhnya (hanya nav utama beranda web yang terlihat)
    if (this.webSubnavBar) {
      this.webSubnavBar.classList.add('hidden');
    }

    // Pastikan webSection ditampilkan dan section lain disembunyikan
    if (this.webSection) this.webSection.classList.remove('hidden');
    const netflixContent = document.getElementById('netflixContent');
    if (netflixContent) netflixContent.classList.add('hidden');
    const downloadsSection = document.getElementById('downloadsSection');
    if (downloadsSection) downloadsSection.classList.add('hidden');
    const settingsSection = document.getElementById('settingsSection');
    if (settingsSection) settingsSection.classList.add('hidden');

    // Pastikan tab Web di navbar utama tetap aktif dan tab lainnya tidak aktif
    if (this.tabWeb) this.tabWeb.classList.add('active');
    [this.tabHome, this.tabDownloads, this.tabSettings].forEach(t => {
      if (t) t.classList.remove('active');
    });

    // Sembunyikan billboard & container katalog
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    if (this.webDynamicContainer) this.webDynamicContainer.classList.add('hidden');

    // Tampilkan container series detail dengan spinner loading
    if (this.webDetailContainer) {
      this.webDetailContainer.classList.remove('hidden');
      if (this.webSection) this.webSection.scrollTop = 0;

      this.webDetailContainer.innerHTML = `
        <div class="idlix-detail-header-bar">
          <button class="btn-idlix-back" id="btnBackFromDetail-${slug}" data-slug="${slug}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            <span>Kembali ke Katalog</span>
          </button>
        </div>
        <div class="web-loading-spinner" style="margin-top: 60px;">
          <div class="yt-spinner"></div>
          <span>Memuat informasi ${source === 'anichin' ? 'donghua' : 'anime'}...</span>
        </div>
      `;
      const btnBackInit = document.getElementById(`btnBackFromDetail-${slug}`);
      if (btnBackInit) btnBackInit.addEventListener('click', () => this.closeSeriesDetail());
    }

    // Fetch detail data
    try {
      let detail = null;
      if (source === 'anichin') {
        if (window.electronAPI && typeof window.electronAPI.anichinGetDetail === 'function') {
          detail = await window.electronAPI.anichinGetDetail(urlOrSlug);
        } else if (window.electronAPI && typeof window.electronAPI.anichinGetAnimeDetail === 'function') {
          detail = await window.electronAPI.anichinGetAnimeDetail(urlOrSlug);
        }
      } else if (source === 'kusonime') {
        if (window.electronAPI && typeof window.electronAPI.kusonimeGetDetail === 'function') {
          detail = await window.electronAPI.kusonimeGetDetail(urlOrSlug);
        }
      } else {
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetDetail === 'function') {
          detail = await window.electronAPI.otakudesuGetDetail(urlOrSlug);
        }
      }

      if (!detail) throw new Error('Data series tidak ditemukan');

      // Pastikan urutan episode selalu mulai dari episode 1 (ascending)
      if (Array.isArray(detail.episodes)) {
        detail.episodes = this.sortEpisodesAscending(detail.episodes);
      }

      this.selectedAnime = detail;

      // Render detail view
      if (this.activeDetailTabSlug === slug) {
        this.renderFullPageSeriesDetail(detail, source, slug);
      }
    } catch (err) {
      console.error('Error fetching series detail:', err);
      if (this.activeDetailTabSlug === slug && this.webDetailContainer) {
        this.webDetailContainer.innerHTML = `
          <div class="idlix-detail-header-bar">
            <button class="btn-idlix-back" id="btnBackFromDetail-${slug}" data-slug="${slug}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              <span>Kembali ke Katalog</span>
            </button>
            <div class="idlix-breadcrumbs">
              <span>Katalog</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-current">Gagal Memuat</span>
            </div>
          </div>
          <div class="web-empty-notice" style="margin-top: 40px;">Gagal memuat detail series: ${this.escapeHtml(err.message)}</div>
        `;
        const btnBack = document.getElementById(`btnBackFromDetail-${slug}`);
        if (btnBack) btnBack.addEventListener('click', () => this.closeSeriesDetail());
      }
    }
  }

  closeSeriesDetail() {
    this.activeDetailTabSlug = null;
    if (this.webDetailContainer) this.webDetailContainer.classList.add('hidden');
    if (this.webDynamicContainer) this.webDynamicContainer.classList.remove('hidden');

    // Kembalikan subnav bar sedang tayang / jadwal rilis / genre / dll
    if (this.webSubnavBar) this.webSubnavBar.classList.remove('hidden');

    // Kembalikan active ke tabWeb di navbar utama
    if (this.tabWeb) this.tabWeb.classList.add('active');
    if (window.libraryManager && window.libraryManager.tabWeb) {
      window.libraryManager.activeNav = 'web';
      window.libraryManager.tabWeb.classList.add('active');
    }

    const prevSub = this.previousCatalogSubTab || 'ongoing';
    this.switchSubTab(prevSub);

    // Restore scroll position
    if (this.webSection && this.catalogScrollTop) {
      setTimeout(() => {
        if (this.webSection) this.webSection.scrollTop = this.catalogScrollTop;
      }, 30);
    }
  }

  openSeriesDetailTab(source, urlOrSlug, initialData = null) {
    return this.openSeriesDetail(source, urlOrSlug, initialData);
  }

  closeDetailTab(slug) {
    return this.closeSeriesDetail();
  }

  switchToDetailTab(slug) {
    // Single-page navigation, already transitioned
  }

  renderFullPageSeriesDetail(detail, source, slug) {
    if (!this.webDetailContainer) return;
    this.selectedAnime = detail;

    if (Array.isArray(detail.episodes)) {
      detail.episodes = this.sortEpisodesAscending(detail.episodes);
    }

    const isDonghua = source === 'anichin' || detail.isDonghua;
    const isKusonime = source === 'kusonime' || detail.isBatchOnly;
    const episodes = detail.episodes || [];
    const poster = detail.poster || '';
    const title = detail.title || 'Tanpa Judul';
    const altTitle = detail.japaneseTitle || detail.japanese || '';
    const status = isKusonime ? 'Batch Download' : (detail.status || 'Tersedia');
    const score = detail.score ? `★ ${detail.score}` : '★ -';
    const type = isDonghua ? 'Donghua' : (isKusonime ? 'Batch Series' : (detail.type || 'Anime'));
    const studio = detail.studio || (isDonghua ? 'Donghua Studio' : 'Studio Anime');
    const duration = detail.duration || (isKusonime ? 'Batch Lengkap' : '24 min/ep');
    const totalEpsText = isKusonime ? `${detail.batchPackages ? detail.batchPackages.length : 1} Paket Batch` : `${episodes.length} Episode`;
    const synopsis = detail.synopsis || 'Sinopsis belum tersedia untuk judul ini.';

    // Check if downloaded locally
    const localMatch = (this.lastDownloadedSeriesList || []).find(s => 
      (s.slug && s.slug === detail.slug) || 
      (s.title && detail.title && s.title.toLowerCase() === detail.title.toLowerCase())
    );

    let html = `
      <!-- Idlix Detail Header Bar with Breadcrumb and Back Button -->
      <div class="idlix-detail-header-bar">
        <button class="btn-idlix-back" id="btnBackFromDetail-${slug}" data-slug="${slug}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          <span>Kembali ke Katalog</span>
        </button>
        <div class="idlix-breadcrumbs">
          <span>Katalog</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">${this.escapeHtml(title)}</span>
        </div>
      </div>

      <!-- Idlix Series Hero Section -->
      <div class="idlix-series-hero">
        <div class="idlix-hero-backdrop" style="background-image: url('${this.escapeHtml(poster)}')"></div>
        <div class="idlix-hero-gradient"></div>
        <div class="idlix-hero-body">
          <div class="idlix-poster-box">
            <img class="idlix-poster-img" src="${this.escapeHtml(poster)}" alt="${this.escapeHtml(title)}" loading="eager" />
          </div>
          <div class="idlix-info-box">
            <div class="idlix-badges-row">
              <span class="series-badge">${this.escapeHtml(status)}</span>
              <span class="badge-score">${this.escapeHtml(score)}</span>
              <span class="badge-type">${this.escapeHtml(type)}</span>
            </div>
            <h1 class="idlix-series-title">${this.escapeHtml(title)}</h1>
            ${altTitle ? `<p class="idlix-alt-title">${this.escapeHtml(altTitle)}</p>` : ''}
            <div class="idlix-meta-row">
              <span>${this.escapeHtml(studio)}</span>
              <span class="meta-dot">•</span>
              <span>${this.escapeHtml(duration)}</span>
              <span class="meta-dot">•</span>
              <span>${totalEpsText}</span>
            </div>
            <div class="idlix-genres-row">
              ${(Array.isArray(detail.genres)
                ? detail.genres
                : (typeof detail.genres === 'string' ? detail.genres.split(',') : [])
              ).map(g => {
                const gName = typeof g === 'object' && g !== null ? (g.name || g.title || '') : String(g || '').trim();
                return gName ? `<span class="otakudesu-genre-tag">${this.escapeHtml(gName)}</span>` : '';
              }).join('')}
            </div>
            <p class="idlix-synopsis">${this.escapeHtml(synopsis)}</p>

            <div class="idlix-actions-row">
              ${!isKusonime && episodes.length > 0 ? `
                <button id="btnDetailPlayFirst-${slug}" class="btn-netflix-play">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span>Play</span>
                </button>
              ` : ''}

              ${!isKusonime ? `
                <button id="btnDetailDownloadAll-${slug}" class="btn-netflix-info">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                  <span>Download All Eps</span>
                </button>
              ` : ''}

              ${detail.batch ? `
                <button id="btnDetailBatch-${slug}" class="btn-netflix-info">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                  <span>Download Batch (Semua)</span>
                </button>
              ` : ''}

              ${localMatch ? `
                <button id="btnDetailDeleteAnime-${slug}" class="btn-netflix-action btn-danger-action" title="Hapus Anime Ini dari Komputer">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  <span>Hapus Anime Ini</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Idlix Episodes Section -->
      <div class="idlix-episodes-section">
        <div class="idlix-episodes-heading">
          <h2 class="episodes-section-title">${isKusonime ? 'Paket Unduhan Batch' : 'Daftar Episode'}</h2>
          <span class="episodes-section-subtitle">${isKusonime ? 'Pilih resolusi dan paket batch untuk diunduh' : 'Pilih episode untuk ditonton atau diunduh'}</span>
        </div>
        <div class="idlix-episodes-container" id="detailEpisodesContainer-${slug}"></div>
      </div>
    `;

    this.webDetailContainer.innerHTML = html;

    // Attach Back Button click
    const btnBack = document.getElementById(`btnBackFromDetail-${slug}`);
    if (btnBack) {
      btnBack.addEventListener('click', () => this.closeDetailTab(slug));
    }

    // Attach Play First Episode button
    const btnPlay = document.getElementById(`btnDetailPlayFirst-${slug}`);
    if (btnPlay && episodes.length > 0) {
      const firstEp = episodes[0];
      btnPlay.addEventListener('click', () => {
        if (isDonghua) {
          this.playAnichinEpisode(firstEp, detail, btnPlay);
        } else {
          this.streamEpisode(firstEp, detail, btnPlay);
        }
      });
    }

    // Attach Download All button
    const btnDlAll = document.getElementById(`btnDetailDownloadAll-${slug}`);
    if (btnDlAll) {
      btnDlAll.addEventListener('click', () => {
        if (detail.batch) {
          this.openBatchPicker(detail.batch);
        } else {
          this.downloadAllEpisodesPrompt(detail, false);
        }
      });
    }

    // Attach Batch button
    const btnBatch = document.getElementById(`btnDetailBatch-${slug}`);
    if (btnBatch && detail.batch) {
      btnBatch.addEventListener('click', () => {
        this.openBatchPicker(detail.batch);
      });
    }

    // Attach Delete Anime from PC button
    const btnDelete = document.getElementById(`btnDetailDeleteAnime-${slug}`);
    if (btnDelete && localMatch) {
      btnDelete.addEventListener('click', async () => {
        const confirmDelete = window.confirm(`Hapus folder unduhan untuk "${detail.title}" dari komputer Anda?`);
        if (confirmDelete && window.electronAPI && typeof window.electronAPI.deleteSeries === 'function') {
          await window.electronAPI.deleteSeries(localMatch.path);
          this.closeDetailTab(slug);
          if (this.activeSub === 'downloaded') {
            this.renderDownloadedView();
          }
        }
      });
    }

    // Render Episodes into container
    const epContainer = document.getElementById(`detailEpisodesContainer-${slug}`);
    if (epContainer) {
      if (isKusonime) {
        this.renderKusonimeBatchList(detail, epContainer);
      } else {
        this.renderUnifiedEpisodesGrid(detail, isDonghua, 1, epContainer);
      }
    }
  }

  async openAnimeDetail(urlOrSlug) {
    return this.openSeriesDetailTab('otakudesu', urlOrSlug);
  }

  extractEpisodeNumber(ep) {
    if (!ep) return 0;
    if (typeof ep.episodeNumber === 'number' && !isNaN(ep.episodeNumber)) {
      return ep.episodeNumber;
    }
    if (typeof ep.episodeNumber === 'string') {
      const parsed = parseFloat(ep.episodeNumber);
      if (!isNaN(parsed)) return parsed;
    }
    const str = `${ep.slug || ''} ${ep.title || ''} ${ep.url || ''}`;
    const match = str.match(/episode[-_\s]*([0-9]+(?:\.[0-9]+)?)/i) ||
                  str.match(/ep[-_\s]*([0-9]+(?:\.[0-9]+)?)/i) ||
                  (ep.title && ep.title.match(/(?:^|\s)([0-9]+)(?:\s|$)/));
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) return val;
    }
    return 0;
  }

  sortEpisodesAscending(episodes) {
    if (!Array.isArray(episodes) || episodes.length <= 1) return episodes || [];

    const withNumbers = episodes.map((ep, idx) => ({
      ep,
      idx,
      num: this.extractEpisodeNumber(ep)
    }));

    const hasExtractedNumbers = withNumbers.some(item => item.num > 0);

    if (hasExtractedNumbers) {
      withNumbers.sort((a, b) => {
        if (a.num > 0 && b.num > 0 && a.num !== b.num) {
          return a.num - b.num;
        }
        return a.idx - b.idx;
      });
      return withNumbers.map(item => item.ep);
    }

    return [...episodes].reverse();
  }

  formatCleanEpisodeTitle(ep, index = 0, totalEpisodes = 1, animeTitle = '') {
    const raw = typeof ep === 'object' && ep !== null ? (ep.title || '') : (ep || '');
    const fallbackNum = (typeof ep === 'object' && ep !== null && typeof this.extractEpisodeNumber === 'function' ? this.extractEpisodeNumber(ep) : 0) || (index + 1);
    if (!raw) return `Episode ${fallbackNum}`;
    let t = raw;
    if (animeTitle) {
      const escaped = animeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(escaped, 'gi'), '');
    }
    t = t.replace(/Subtitle\s+Indonesia/gi, '')
         .replace(/Sub\s+Indo/gi, '')
         .replace(/Episode\s+(\d+)\s+END/gi, 'Episode $1 (Tamat)')
         .replace(/END/gi, '(Tamat)')
         .replace(/^[-\s:|]+/, '')
         .replace(/[-\s:|]+$/, '')
         .trim();
    if (/^\d+$/.test(t)) {
      return `Episode ${t}`;
    }
    const numMatch = t.match(/^(\d+)(.*)/);
    if (numMatch && !t.toLowerCase().startsWith('episode')) {
      return `Episode ${numMatch[1]}${numMatch[2] ? ' - ' + numMatch[2].trim() : ''}`;
    }
    return t || `Episode ${fallbackNum}`;
  }

  cleanEpisodeTitle(epTitle, animeTitle) {
    return this.formatCleanEpisodeTitle(epTitle, 0, 1, animeTitle);
  }

  downloadAllEpisodesPrompt(animeDetail, isDonghua) {
    const episodes = animeDetail.episodes || [];
    if (episodes.length === 0) return;
    const count = episodes.length;
    const confirm = window.confirm(`Unduh episode dari "${animeDetail.title}"?\n\nKlik OK untuk membuka opsi download episode pertama dan memilih resolusi.`);
    if (!confirm) return;

    if (isDonghua) {
      this.openAnichinResolutionPicker(episodes[0], animeDetail);
    } else {
      this.openResolutionPicker(episodes[0], animeDetail);
    }
  }

  renderUnifiedEpisodesGrid(animeDetail, isDonghua = false, page = 1, targetContainer = null) {
    const gridContainer = targetContainer || this.otakudesuEpisodesGrid;
    if (!gridContainer) return;

    const episodes = animeDetail.episodes || [];
    if (episodes.length === 0) {
      gridContainer.innerHTML = '<div class="web-empty-notice">Belum ada episode tersedia untuk judul ini.</div>';
      return;
    }

    const historyForAnime = (this.onlineHistory && this.onlineHistory[animeDetail.slug]) || null;
    let html = '';

    if (episodes.length > 24) {
      // Mode B: Compact 5x10 Numbered Grid with Pagination (> 24 episodes)
      const pageSize = 50;
      const totalPages = Math.ceil(episodes.length / pageSize);
      const curPage = Math.max(1, Math.min(page, totalPages));
      const startIdx = (curPage - 1) * pageSize;
      const endIdx = Math.min(episodes.length, startIdx + pageSize);

      // 1. Grid of 50 episode boxes FIRST
      html += `<div class="episodes-numbered-grid otaku-episodes-5col-grid">`;

      for (let i = startIdx; i < endIdx; i++) {
        const ep = episodes[i];
        const cleanTitle = this.cleanEpisodeTitle(ep.title, animeDetail.title);
        const epHist = historyForAnime && historyForAnime.episodes && historyForAnime.episodes[ep.url];
        const isCompleted = epHist && epHist.completed;

        html += `
          <div class="ep-numbered-box ${isCompleted ? 'completed' : ''}" data-index="${i}" data-url="${ep.url}">
            <div class="ep-box-number-wrap">
              <div class="ep-box-num">${cleanTitle}</div>
              <div class="ep-box-tag">${ep.date || (isCompleted ? '✓ Selesai' : 'HD')}</div>
            </div>
            <div class="ep-box-actions">
              <button class="btn-box-circle btn-box-play" data-index="${i}" title="Putar ${cleanTitle}" aria-label="Putar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="btn-box-circle btn-box-download" data-index="${i}" title="Download ${cleanTitle}" aria-label="Download">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
              </button>
            </div>
          </div>
        `;
      }

      html += `</div>`;

      // 2. Pagination bar BELOW the grid
      html += `
        <div class="episodes-pagination-bar ep-pagination-bar">
          <span class="ep-pagination-label">Pilih Halaman:</span>
      `;

      for (let p = 1; p <= totalPages; p++) {
        const fromEp = (p - 1) * pageSize + 1;
        const toEp = Math.min(episodes.length, p * pageSize);
        html += `
          <button class="ep-page-btn ${p === curPage ? 'active' : ''}" data-page="${p}">
            ${fromEp} - ${toEp}
          </button>
        `;
      }

      html += `</div>`;

    } else {
      // Mode A: Landscape 16:9 Grid (<= 24 episodes - Jadwal Rilis / Idlix style)
      html += `<div class="episodes-landscape-grid">`;

      episodes.forEach((ep, index) => {
        const epHist = historyForAnime && historyForAnime.episodes && historyForAnime.episodes[ep.url];
        let progressPercent = 0;
        let isCompleted = false;

        if (epHist) {
          if (epHist.completed) {
            isCompleted = true;
            progressPercent = 100;
          } else if (epHist.currentTime > 0 && epHist.duration > 0) {
            progressPercent = Math.min(100, Math.round((epHist.currentTime / epHist.duration) * 100));
          }
        }

        const cleanTitle = this.cleanEpisodeTitle(ep.title, animeDetail.title);
        const epNum = ep.episodeNumber || this.extractEpisodeNumber(ep) || (index + 1);
        const posterImg = ep.poster || animeDetail.poster || '';

        html += `
          <div class="ep-landscape-card otaku-ep-card ${isCompleted ? 'completed' : ''}" data-index="${index}" data-url="${ep.url}">
            <div class="ep-landscape-poster-wrap otaku-ep-thumb">
              ${posterImg ? `<img class="ep-landscape-poster" src="${posterImg}" alt="${cleanTitle}" loading="lazy">` : `<div class="poster-placeholder"><span>${epNum}</span></div>`}
              <span class="ep-badge-epnum">Eps ${epNum}</span>
              ${progressPercent > 0 ? `
                <div class="ep-landscape-progress">
                  <div class="ep-landscape-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
              ` : ''}
              <div class="ep-landscape-overlay">
                <div class="ep-landscape-actions">
                  <button class="btn-ep-circle btn-ep-circle-play btn-ep-card-play" data-index="${index}" title="Putar ${cleanTitle}" aria-label="Putar">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <button class="btn-ep-circle btn-ep-circle-download btn-ep-card-download" data-index="${index}" title="Download ${cleanTitle}" aria-label="Download">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="ep-landscape-info">
              <div class="ep-landscape-title" title="${ep.title}">${cleanTitle}</div>
              <div class="ep-landscape-meta">
                <span>${ep.date || 'Tersedia'}</span>
                ${isCompleted ? `<span class="ep-status-pill">Selesai</span>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    gridContainer.innerHTML = html;

    // Attach Play Click (circular buttons)
    gridContainer.querySelectorAll('.btn-ep-circle-play, .btn-box-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const ep = episodes[idx];
        if (!ep) return;
        if (isDonghua) {
          this.playAnichinEpisode(ep, animeDetail, btn);
        } else {
          this.streamEpisode(ep, animeDetail, btn);
        }
      });
    });

    // Attach Download Click (circular buttons)
    gridContainer.querySelectorAll('.btn-ep-circle-download, .btn-box-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const ep = episodes[idx];
        if (!ep) return;
        if (isDonghua) {
          this.openAnichinResolutionPicker(ep, animeDetail);
        } else {
          this.openResolutionPicker(ep, animeDetail);
        }
      });
    });

    // Attach Card / Box Click (defaults to play) and Hover Prefetch
    gridContainer.querySelectorAll('.ep-landscape-card, .ep-numbered-box').forEach(card => {
      card.addEventListener('mouseenter', () => {
        const idx = parseInt(card.dataset.index, 10);
        const ep = episodes[idx];
        if (ep && ep.url) {
          this.prefetchEpisodeStream(ep.url, isDonghua);
        }
      }, { once: true });

      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const idx = parseInt(card.dataset.index, 10);
        const ep = episodes[idx];
        if (!ep) return;
        if (isDonghua) {
          this.playAnichinEpisode(ep, animeDetail, card);
        } else {
          this.streamEpisode(ep, animeDetail, card);
        }
      });
    });

    // Attach Pagination Button Click
    gridContainer.querySelectorAll('.ep-page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newPage = parseInt(btn.dataset.page, 10);
        this.renderUnifiedEpisodesGrid(animeDetail, isDonghua, newPage, gridContainer);
      });
    });
  }

  renderEpisodesList(animeDetail) {
    this.renderUnifiedEpisodesGrid(animeDetail, false);
  }

  renderModernEpisodesList(animeDetail) {
    this.renderUnifiedEpisodesGrid(animeDetail, false);
  }

  formatCleanEpisodeTitle(ep, index = 0, totalEpisodes = 1, animeTitle = '') {
    const raw = typeof ep === 'object' && ep !== null ? (ep.title || '') : (ep || '');
    if (!raw) return `Episode ${totalEpisodes - index}`;
    let t = raw;
    if (animeTitle) {
      const escaped = animeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(escaped, 'gi'), '');
    }
    t = t.replace(/Subtitle\s+Indonesia/gi, '')
         .replace(/Sub\s+Indo/gi, '')
         .replace(/Episode\s+(\d+)\s+END/gi, 'Episode $1 (Tamat)')
         .replace(/END/gi, '(Tamat)')
         .replace(/^[-\s:|]+/, '')
         .replace(/[-\s:|]+$/, '')
         .trim();
    if (/^\d+$/.test(t)) {
      return `Episode ${t}`;
    }
    const numMatch = t.match(/^(\d+)(.*)/);
    if (numMatch && !t.toLowerCase().startsWith('episode')) {
      return `Episode ${numMatch[1]}${numMatch[2] ? ' - ' + numMatch[2].trim() : ''}`;
    }
    return t || `Episode ${totalEpisodes - index}`;
  }

  downloadAllEpisodes(animeDetail) {
    this.downloadAllEpisodesPrompt(animeDetail, false);
  }

  setupDeleteAnimeButton(animeDetail) {
    if (!this.btnOtakudesuDeleteAnime) return;
    const localMatch = (this.lastDownloadedSeriesList || []).find(s => 
      (s.slug && s.slug === animeDetail.slug) || 
      (s.title && animeDetail.title && s.title.toLowerCase() === animeDetail.title.toLowerCase())
    );
    if (localMatch) {
      this.btnOtakudesuDeleteAnime.classList.remove('hidden');
    } else {
      this.btnOtakudesuDeleteAnime.classList.add('hidden');
    }
  }

  /**
   * 7b. Detail Series Khusus Batch (Delegates to dynamic series detail tab)
   */
  async openKusonimeDetail(urlOrSlug) {
    return this.openSeriesDetailTab('kusonime', urlOrSlug);
  }

  /**
   * 7c. Modal Detail Donghua Khusus Ani-Chin (Streaming & Download)
   */
  async openAnichinDetail(urlOrSlug) {
    return this.openSeriesDetailTab('anichin', urlOrSlug);
  }

  async _legacyOpenAnichinDetail(urlOrSlug) {
    if (!this.otakudesuDetailModal) return;

    this.otakudesuDetailModal.classList.remove('hidden', 'kusonime-modal-active');
    this.otakudesuDetailModal.scrollTop = 0;
    if (this.otakudesuModalTitle) this.otakudesuModalTitle.textContent = 'Memuat Detail Donghua...';
    if (this.otakudesuJapaneseTitle) this.otakudesuJapaneseTitle.textContent = 'Donghua (Chinese Animation)';
    if (this.otakudesuSynopsis) this.otakudesuSynopsis.textContent = 'Mengambil detail donghua dan daftar episode...';
    if (this.otakudesuEpisodesGrid) {
      this.otakudesuEpisodesGrid.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil episode donghua...</span></div>';
    }

    try {
      let detail = null;
      if (window.electronAPI && typeof window.electronAPI.anichinGetDetail === 'function') {
        detail = await window.electronAPI.anichinGetDetail(urlOrSlug);
      }

      if (!detail) throw new Error('Data Donghua tidak ditemukan');
      this.selectedAnime = detail;

      if (this.otakudesuHeroBackdrop) {
        this.otakudesuHeroBackdrop.style.backgroundImage = `url("${detail.poster}")`;
      }
      if (this.otakudesuModalTitle) this.otakudesuModalTitle.textContent = detail.title;
      if (this.otakudesuJapaneseTitle) this.otakudesuJapaneseTitle.textContent = detail.japanese || 'Donghua (Chinese Animation)';
      if (this.otakudesuStatusBadge) this.otakudesuStatusBadge.textContent = detail.status || 'Ongoing';
      if (this.otakudesuScoreBadge) this.otakudesuScoreBadge.textContent = detail.score ? `★ ${detail.score}` : '★ 8.5';
      if (this.otakudesuTypeBadge) this.otakudesuTypeBadge.textContent = 'Donghua';
      if (this.otakudesuStudio) this.otakudesuStudio.textContent = 'Donghua Animation';
      if (this.otakudesuDuration) this.otakudesuDuration.textContent = 'Donghua Series';
      if (this.otakudesuTotalEps) this.otakudesuTotalEps.textContent = `${detail.episodes.length} Episode`;
      if (this.otakudesuSynopsis) this.otakudesuSynopsis.textContent = detail.synopsis || 'Sinopsis tidak tersedia.';

      if (this.otakudesuGenresWrap) {
        const genreList = (typeof detail.genres === 'string' ? detail.genres.split(',') : (detail.genres || [])).map(s => s.trim()).filter(Boolean);
        this.otakudesuGenresWrap.innerHTML = genreList.map(g => `<span class="otakudesu-genre-tag">${g}</span>`).join('');
      }

      if (this.btnOtakudesuStreamFirst) {
        if (detail.episodes && detail.episodes.length > 0) {
          const firstEp = detail.episodes[0];
          if (this.txtOtakudesuStreamFirst) this.txtOtakudesuStreamFirst.textContent = 'Play';
          this.btnOtakudesuStreamFirst.onclick = () => {
            this.playAnichinEpisode(firstEp, detail, this.btnOtakudesuStreamFirst);
          };
          this.btnOtakudesuStreamFirst.classList.remove('hidden');
        } else {
          this.btnOtakudesuStreamFirst.classList.add('hidden');
        }
      }

      // Download All Eps button
      if (this.btnOtakudesuDownloadAll) {
        this.btnOtakudesuDownloadAll.onclick = () => {
          this.downloadAllEpisodesPrompt(detail, true);
        };
        this.btnOtakudesuDownloadAll.classList.remove('hidden');
      }

      if (this.btnOtakudesuBatch) {
        this.btnOtakudesuBatch.classList.add('hidden');
      }

      // Delete anime from PC button (if downloaded)
      if (this.btnOtakudesuDeleteAnime) {
        const localMatch = (this.lastDownloadedSeriesList || []).find(s => 
          (s.slug && s.slug === detail.slug) || 
          (s.title && detail.title && s.title.toLowerCase() === detail.title.toLowerCase())
        );
        if (localMatch) {
          this.btnOtakudesuDeleteAnime.classList.remove('hidden');
          this.btnOtakudesuDeleteAnime.onclick = async () => {
            const confirmDelete = window.confirm(`Hapus folder unduhan untuk "${detail.title}" dari komputer Anda?`);
            if (confirmDelete && window.electronAPI && typeof window.electronAPI.deleteSeries === 'function') {
              await window.electronAPI.deleteSeries(localMatch.path);
              this.closeDetailModal();
              if (this.activeSub === 'downloaded') {
                this.renderDownloadedView();
              }
            }
          };
        } else {
          this.btnOtakudesuDeleteAnime.classList.add('hidden');
        }
      }

      this.renderAnichinEpisodesList(detail);

    } catch (err) {
      console.error('Error opening anichin detail:', err);
      if (this.otakudesuSynopsis) {
        this.otakudesuSynopsis.textContent = `Gagal memuat detail Donghua: ${err.message}`;
      }
    }
  }

  renderAnichinEpisodesList(animeDetail) {
    this.renderUnifiedEpisodesGrid(animeDetail, true);
  }

  async playAnichinEpisode(ep, animeDetail, triggeringElement = null) {
    if (triggeringElement) {
      triggeringElement.classList.add('btn-loading-pulse', 'is-loading');
    }
    this.isStreamLoadingCancelled = false;
    this.showStreamLoadingOverlay(animeDetail.title, ep.title, animeDetail.poster);
    this.showDownloadToastNotification(`Menghubungkan stream Donghua ${ep.title}...`);

    try {
      let streamData = this.streamCache?.get(ep.url);
      if (!streamData && window.electronAPI && typeof window.electronAPI.anichinGetEpisodeStream === 'function') {
        streamData = await window.electronAPI.anichinGetEpisodeStream(ep.url);
        if (streamData) {
          if (!this.streamCache) this.streamCache = new Map();
          this.streamCache.set(ep.url, streamData);
        }
      }

      if (this.isStreamLoadingCancelled) return;

      if (!streamData || !streamData.streamUrl) {
        if (streamData && streamData.downloadOptions && streamData.downloadOptions.length > 0) {
          this.hideStreamLoadingOverlay();
          this.showDownloadToastNotification('Stream direct sedang offline. Membuka opsi server unduhan...');
          this.openAnichinResolutionPicker(ep, animeDetail);
          return;
        }
        throw new Error('Link streaming Donghua tidak dapat diekstrak.');
      }

      this.closeDetailModal();

      if (this.player && typeof this.player.loadRemoteStream === 'function') {
        if (this.library) {
          this.library.setOnlinePlaylist({
            animeDetail: animeDetail,
            currentEpisode: ep,
            onSelectEpisode: (selectedEp) => {
              this.playAnichinEpisode(selectedEp, animeDetail);
            }
          });
          this.library.currentOnlineAnime = {
            animeSlug: animeDetail.slug,
            animeTitle: animeDetail.title,
            episodeUrl: ep.url,
            episodeTitle: ep.title,
            poster: animeDetail.poster
          };
          this.library.showPlayerView();
        }

        await this.player.loadRemoteStream(streamData.streamUrl, {
          title: `${animeDetail.title} - ${ep.title}`,
          animeSlug: animeDetail.slug,
          animeTitle: animeDetail.title,
          episodeUrl: ep.url,
          episodeTitle: ep.title,
          poster: animeDetail.poster,
          startTime: 0,
          currentQuality: 'HD'
        });

        // Pemuatan asinkronus: prefetch episode berikutnya di latar belakang
        if (this.library && animeDetail.episodes) {
          const nextEp = this.library.findNextOnlineEpisode(animeDetail.episodes, ep);
          if (nextEp && nextEp.url) {
            this.prefetchEpisodeStream(nextEp.url, true);
          }
        }
      }

    } catch (err) {
      if (this.isStreamLoadingCancelled) return;
      console.error('Error streaming anichin episode:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: {
          message: `Gagal memutar streaming Donghua: ${err.message}`,
          codeName: 'DONGHUA_STREAM_FAILED'
        }
      }));
    } finally {
      this.hideStreamLoadingOverlay();
      if (triggeringElement) {
        triggeringElement.classList.remove('btn-loading-pulse', 'is-loading');
      }
      document.querySelectorAll('.btn-loading-pulse, .is-loading').forEach(el => {
        el.classList.remove('btn-loading-pulse', 'is-loading');
      });
    }
  }

  async openAnichinResolutionPicker(ep, animeDetail) {
    if (!this.resolutionPickerModal) return;

    this.resolutionPickerModal.classList.remove('hidden');
    if (this.resolutionModalTitle) this.resolutionModalTitle.textContent = `Download Donghua: ${ep.title}`;
    if (this.resolutionModalDesc) this.resolutionModalDesc.textContent = 'Memuat opsi unduhan...';
    if (this.resolutionOptionsList) {
      this.resolutionOptionsList.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil link unduhan...</span></div>';
    }

    try {
      let streamData = null;
      if (window.electronAPI && typeof window.electronAPI.anichinGetEpisodeStream === 'function') {
        streamData = await window.electronAPI.anichinGetEpisodeStream(ep.url);
      }

      const options = (streamData && streamData.downloadOptions) || [];

      if (streamData && streamData.streamUrl && streamData.streamType !== 'iframe') {
        options.unshift({
          quality: 'MP4 / HLS HD (Direct)',
          size: 'Rekomendasi Cepat & Stabil',
          isRecommended: true,
          mirrors: [
            { host: '⚡ Unduh Langsung (VidPlayer)', url: streamData.streamUrl, isDirect: true }
          ]
        });
      }

      if (options.length === 0) {
        this.resolutionOptionsList.innerHTML = '<div class="web-empty-notice">Tautan download tidak ditemukan pada episode ini.</div>';
        return;
      }

      if (this.resolutionModalDesc) {
        this.resolutionModalDesc.textContent = 'Pilih resolusi dan server untuk mengunduh episode donghua ini:';
      }

      let html = '';
      options.forEach(opt => {
        const isRec = opt.isRecommended;
        html += `
          <div class="resolution-group-card ${isRec ? 'recommended-group' : ''}">
            <div class="resolution-group-header">
              <span class="resolution-label">${isRec ? '⭐ ' : ''}${opt.quality}</span>
            </div>
            <div class="mirror-buttons-grid">
        `;

        (opt.mirrors || []).forEach(m => {
          const isDirect = m.isDirect || false;
          html += `
            <button class="btn-mirror-download ${isDirect ? 'btn-mirror-direct' : ''}" data-quality="${opt.quality}" data-host="${m.host}" data-url="${m.url}">
              <span>${isDirect ? '⚡' : '⬇'} ${m.host}</span>
            </button>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      this.resolutionOptionsList.innerHTML = html;

      this.resolutionOptionsList.querySelectorAll('.btn-mirror-download').forEach(btn => {
        btn.addEventListener('click', async () => {
          const downloadUrl = btn.dataset.url;
          const quality = btn.dataset.quality;
          const host = btn.dataset.host;

          this.closeResolutionPicker();

          const genresArr = (typeof animeDetail.genres === 'string'
            ? animeDetail.genres.split(',')
            : (animeDetail.genres || [])
          ).map(g => (typeof g === 'object' ? (g.name || '') : g).trim()).filter(Boolean);

          await this.triggerDownload({
            animeTitle: animeDetail.title,
            episodeTitle: ep.title,
            downloadUrl,
            quality,
            mirrorHost: host,
            posterUrl: animeDetail.poster,
            synopsis: animeDetail.synopsis,
            genres: genresArr
          });
        });
      });

    } catch (err) {
      console.error('Error fetching anichin download resolutions:', err);
      if (this.resolutionOptionsList) {
        this.resolutionOptionsList.innerHTML = `<div class="web-empty-notice">Gagal memuat link download: ${err.message}</div>`;
      }
    }
  }

  /**
   * Helper pengurutan mirror unduhan berdasarkan prioritas stabilitas & kecepatan
   */
  sortMirrorsByPriority(mirrors) {
    if (!Array.isArray(mirrors) || mirrors.length === 0) return [];
    return [...mirrors].sort((a, b) => {
      const getScore = (m) => {
        const url = (m.url || '').toLowerCase();
        const host = (m.host || '').toLowerCase();

        // 1. Google Drive Resmi (Direct UC & UUID Auto Confirmation)
        if (url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')) return 1000;
        if ((host.includes('google drive') || host.includes('gdrive')) && !url.includes('acefile') && !url.includes('mega')) return 900;

        // 2. Pixeldrain (Direct API)
        if (url.includes('pixeldrain.com') || host.includes('pixel') || host.includes('pdrain')) return 800;

        // 3. Direct / Media CDN
        if (url.endsWith('.mp4') || url.endsWith('.mkv') || url.endsWith('.zip') || url.endsWith('.rar')) return 700;
        if (url.includes('desustream') || host.includes('desu')) return 600;
        if (url.includes('kraken') || host.includes('kraken')) return 500;
        if (url.includes('hxfile') || host.includes('hxfile')) return 400;

        // 4. Acefile / Google Sharer
        if (url.includes('acefile') || host.includes('acefile') || host.includes('sharer')) return 300;

        // 5. Mega / Terabox / Lainnya
        if (url.includes('mega.nz') || host.includes('mega')) return 200;
        if (url.includes('terabox') || host.includes('terabox')) return 100;

        return 250;
      };
      return getScore(b) - getScore(a);
    });
  }

  selectBestMirror(mirrors) {
    const sorted = this.sortMirrorsByPriority(mirrors);
    return sorted[0] || null;
  }

  /**
   * Render Paket Batch Download Kusonime
   * Hanya menampilkan pilihan resolusi video (360p, 480p, 720p, 1080p).
   * Sistem otomatis menentukan mirror server terbaik (Google Drive / Pixeldrain / Fast Server)
   * dan langsung memulai unduhan latar belakang ke folder penyimpanan.
   */
  renderKusonimeBatchList(animeDetail, targetContainer = null) {
    const gridContainer = targetContainer || this.otakudesuEpisodesGrid;
    if (!gridContainer) return;

    const packages = animeDetail.batchPackages || [];
    if (packages.length === 0) {
      gridContainer.innerHTML = '<div class="web-empty-notice">Belum ada link unduhan batch yang tersedia untuk anime ini.</div>';
      return;
    }

    let html = `
      <div class="kusonime-batch-banner">
        <div class="kusonime-banner-icon">📦</div>
        <div class="kusonime-banner-content">
          <div class="kusonime-banner-title">Download Batch Lengkap (MKV/RAR/ZIP)</div>
          <div class="kusonime-banner-desc">
            Anime ini disediakan khusus dalam format arsip paket batch (MKV/RAR/ZIP). Pilih resolusi video yang Anda inginkan di bawah; sistem akan otomatis memilih server mirror tercepat dan langsung mengunduh ke komputer Anda.
          </div>
        </div>
      </div>
      <div class="kusonime-packages-container">
    `;

    packages.forEach((pkg, pkgIdx) => {
      html += `
        <div class="kusonime-package-card">
          <div class="kusonime-package-header">
            <span class="kusonime-package-tag">Paket ${pkgIdx + 1}</span>
            <h4 class="kusonime-package-title">${pkg.title}</h4>
          </div>
          <div class="kusonime-resolutions-list">
      `;

      (pkg.resolutions || []).forEach(res => {
        const bestMirror = this.selectBestMirror(res.mirrors);
        const serverHost = bestMirror ? bestMirror.host : 'Otomatis';

        html += `
          <div class="kusonime-res-row">
            <div class="kusonime-res-info">
              <span class="res-badge">${res.quality}</span>
              <span class="kusonime-auto-badge" title="Sistem otomatis memilih server terbaik: ${serverHost}">
                ⚡ Auto Mirror (${serverHost})
              </span>
            </div>
            <div class="kusonime-action-wrap">
              <button class="btn-download-resolution btn-kuso-download-res" data-package-index="${pkgIdx}" data-quality="${res.quality}" title="Unduh resolusi ${res.quality}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                <span>Unduh ${res.quality}</span>
              </button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += '</div>';
    gridContainer.innerHTML = html;

    // Pasang listener pada tombol unduh resolusi
    gridContainer.querySelectorAll('.btn-kuso-download-res').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pkgIdx = parseInt(btn.dataset.packageIndex, 10);
        const quality = btn.dataset.quality;
        const pkg = packages[pkgIdx];
        const resObj = pkg && (pkg.resolutions || []).find(r => r.quality === quality);

        if (!resObj || !resObj.mirrors || resObj.mirrors.length === 0) {
          alert('Link unduhan tidak tersedia untuk resolusi ini.');
          return;
        }

        const bestMirror = this.selectBestMirror(resObj.mirrors);
        const sortedMirrors = this.sortMirrorsByPriority(resObj.mirrors);

        await this.triggerDownload({
          animeTitle: animeDetail.title,
          episodeTitle: `${pkg.title || animeDetail.title}`,
          downloadUrl: bestMirror ? bestMirror.url : '',
          mirrors: sortedMirrors,
          quality: resObj.quality,
          mirrorHost: bestMirror ? bestMirror.host : 'Otomatis'
        });
      });
    });
  }

  closeDetailModal() {
    if (this.otakudesuDetailModal) {
      this.otakudesuDetailModal.classList.add('hidden');
    }
  }

  showStreamLoadingOverlay(title, epTitle, posterUrl = null) {
    document.body.classList.add('app-loading-state');
    if (!this.streamLoadingOverlay) {
      this.streamLoadingOverlay = document.getElementById('streamLoadingOverlay');
      this.streamLoadingTitle = document.getElementById('streamLoadingTitle');
      this.streamLoadingSubtitle = document.getElementById('streamLoadingSubtitle');
      this.streamLoadingStatusText = document.getElementById('streamLoadingStatusText');
      this.streamLoadingPoster = document.getElementById('streamLoadingPoster');
      this.btnCancelStreamLoading = document.getElementById('btnCancelStreamLoading');
    }

    if (this.streamLoadingTitle) this.streamLoadingTitle.textContent = title || 'Menghubungkan Stream...';
    if (this.streamLoadingSubtitle) this.streamLoadingSubtitle.textContent = epTitle || 'Menyiapkan pemutar video';
    if (this.streamLoadingStatusText) this.streamLoadingStatusText.textContent = 'Menghubungkan ke server stream...';

    if (this.streamLoadingPoster) {
      if (posterUrl) {
        this.streamLoadingPoster.src = posterUrl;
        this.streamLoadingPoster.classList.remove('hidden');
      } else {
        this.streamLoadingPoster.classList.add('hidden');
      }
    }

    if (this.streamLoadingOverlay) {
      this.streamLoadingOverlay.classList.remove('hidden');
    }

    this.clearStreamLoadingTimers();
    this.streamLoadingTimers = [
      setTimeout(() => {
        if (this.streamLoadingStatusText && !this.isStreamLoadingCancelled) {
          this.streamLoadingStatusText.textContent = 'Embed utama tidak aktif, mencari server mirror...';
        }
      }, 2000),
      setTimeout(() => {
        if (this.streamLoadingStatusText && !this.isStreamLoadingCancelled) {
          this.streamLoadingStatusText.textContent = 'Mendekripsi stream HLS & menghubungkan CDN...';
        }
      }, 4500),
      setTimeout(() => {
        if (this.streamLoadingStatusText && !this.isStreamLoadingCancelled) {
          this.streamLoadingStatusText.textContent = 'Menyiapkan transmuxing kualitas terbaik...';
        }
      }, 7500)
    ];
  }

  hideStreamLoadingOverlay() {
    document.body.classList.remove('app-loading-state');
    this.clearStreamLoadingTimers();
    if (this.streamLoadingOverlay) {
      this.streamLoadingOverlay.classList.add('hidden');
    }
  }

  clearStreamLoadingTimers() {
    if (Array.isArray(this.streamLoadingTimers)) {
      this.streamLoadingTimers.forEach(t => clearTimeout(t));
    }
    this.streamLoadingTimers = [];
  }

  cancelStreamLoading() {
    this.isStreamLoadingCancelled = true;
    this.hideStreamLoadingOverlay();
    document.querySelectorAll('.btn-loading-pulse, .is-loading').forEach(el => {
      el.classList.remove('btn-loading-pulse', 'is-loading');
    });
    this.showDownloadToastNotification('Pemuatan stream dibatalkan.');
  }

  /**
   * 8. Streaming Episode Langsung di YouTube-Style Player
   */
  async streamEpisode(ep, animeDetail, triggeringElement = null) {
    if (triggeringElement) {
      triggeringElement.classList.add('btn-loading-pulse', 'is-loading');
    }
    this.isStreamLoadingCancelled = false;
    this.showStreamLoadingOverlay(animeDetail.title, ep.title, animeDetail.poster);
    this.showDownloadToastNotification(`Menghubungkan stream untuk ${ep.title}...`);

    try {
      let streamData = this.streamCache?.get(ep.url);
      if (!streamData && window.electronAPI && typeof window.electronAPI.otakudesuGetEpisodeStream === 'function') {
        streamData = await window.electronAPI.otakudesuGetEpisodeStream(ep.url);
        if (streamData) {
          if (!this.streamCache) this.streamCache = new Map();
          this.streamCache.set(ep.url, streamData);
        }
      }

      if (this.isStreamLoadingCancelled) return;

      // Pastikan data episodes lengkap jika dipanggil dari kartu riwayat / quick stream
      if ((!animeDetail.episodes || animeDetail.episodes.length === 0) && (animeDetail.slug || animeDetail.url)) {
        try {
          const fullDetail = await window.electronAPI.otakudesuGetDetail(animeDetail.slug || animeDetail.url);
          if (fullDetail && Array.isArray(fullDetail.episodes)) {
            animeDetail = { ...fullDetail, ...animeDetail, episodes: fullDetail.episodes };
          }
        } catch (e) {
          console.warn('Gagal memuat detail episode anime:', e);
        }
      }

      if (this.isStreamLoadingCancelled) return;

      if (!streamData || (!streamData.streamUrl && !streamData.embedUrl)) {
        if (streamData && streamData.downloadOptions && streamData.downloadOptions.length > 0) {
          this.hideStreamLoadingOverlay();
          this.showDownloadToastNotification('Stream direct default offline. Membuka server alternatif...');
          this.openResolutionPicker(ep, animeDetail);
          if (this.resolutionModalDesc) {
            this.resolutionModalDesc.innerHTML = `
              <span style="color:#ffb74d;">⚠️ Server streaming default untuk episode ini sedang offline/kedaluwarsa.</span><br>
              Silakan pilih mirror unduhan cepat di bawah (atau unduh langsung):
              <div style="margin-top: 12px;">
                <button id="btnSearchKusonimeFallback" class="btn-fallback-kusonime">
                  📦 Cari Versi Download Batch Lengkap
                </button>
              </div>
            `;
            setTimeout(() => {
              const btnKuso = document.getElementById('btnSearchKusonimeFallback');
              if (btnKuso) {
                btnKuso.onclick = () => {
                  this.closeResolutionPicker();
                  this.closeDetailModal();
                  this.executeSearch(animeDetail.title, 'kusonime');
                };
              }
            }, 50);
          }
          return;
        }
        throw new Error('Link streaming langsung (MP4) tidak dapat diekstrak.');
      }

      // Check saved resume time
      let resumeTime = 0;
      const historyEntry = this.onlineHistory[animeDetail.slug];
      if (historyEntry && historyEntry.episodes && historyEntry.episodes[ep.url]) {
        const epHist = historyEntry.episodes[ep.url];
        if (!epHist.completed && epHist.currentTime > 5) {
          resumeTime = epHist.currentTime;
        }
      }

      // Close modal
      this.closeDetailModal();

      if (this.isStreamLoadingCancelled) return;

      // Extract episode number for background AniSkip
      let epNum = 1;
      if (this.player && typeof this.player.extractEpisodeNumber === 'function') {
        epNum = this.player.extractEpisodeNumber(ep.title || ep.url || '', animeDetail.title);
      } else {
        const epMatch = (ep.title || '').match(/(?:Episode|Eps?\.?)\s*(\d+)/i);
        epNum = epMatch ? parseInt(epMatch[1], 10) : 1;
      }

      // Launch player immediately for faster streaming startup
      if (this.player && typeof this.player.loadRemoteStream === 'function') {
        if (this.library) {
          this.library.setOnlinePlaylist({
            animeDetail: animeDetail,
            currentEpisode: ep,
            onSelectEpisode: (selectedEp) => {
              this.streamEpisode(selectedEp, animeDetail);
            }
          });
          this.library.currentOnlineAnime = {
            animeSlug: animeDetail.slug,
            animeTitle: animeDetail.title,
            episodeUrl: ep.url,
            episodeTitle: ep.title,
            poster: animeDetail.poster
          };
          this.library.showPlayerView();
        }

        const finalStreamUrl = streamData.streamUrl || streamData.embedUrl;
        const streamType = streamData.streamType || (streamData.streamUrl && !streamData.streamUrl.includes('/dstream/') ? 'direct' : 'iframe');

        await this.player.loadRemoteStream(finalStreamUrl, {
          title: `${animeDetail.title} - ${ep.title}`,
          animeSlug: animeDetail.slug,
          animeTitle: animeDetail.title,
          episodeUrl: ep.url,
          episodeTitle: ep.title,
          poster: animeDetail.poster,
          startTime: resumeTime,
          availableQualities: streamData.availableQualities || [],
          currentQuality: streamData.currentQuality || (streamType === 'iframe' ? 'Auto' : '720p'),
          skipIntervals: null,
          streamType: streamType,
          embedUrl: streamData.embedUrl
        });

        // Asynchronously fetch AniSkip in background without blocking video playback
        if (window.electronAPI && typeof window.electronAPI.getAnimeSkipTimes === 'function') {
          window.electronAPI.getAnimeSkipTimes(animeDetail.title, epNum)
            .then(skipRes => {
              if (skipRes && skipRes.found && this.player) {
                const validated = typeof this.player.validateSkipIntervals === 'function'
                  ? this.player.validateSkipIntervals({ op: skipRes.op, ed: skipRes.ed })
                  : { op: skipRes.op, ed: skipRes.ed };
                this.player.setSkipIntervals(validated);
              }
            })
            .catch(() => {});
        }

        // Pemuatan asinkronus: prefetch stream episode berikutnya di latar belakang
        if (this.library && animeDetail.episodes) {
          const nextEp = this.library.findNextOnlineEpisode(animeDetail.episodes, ep);
          if (nextEp && nextEp.url) {
            this.prefetchEpisodeStream(nextEp.url, false);
          }
        }
      }

    } catch (err) {
      if (this.isStreamLoadingCancelled) return;
      console.error('Error streaming episode:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: {
          message: `Gagal memutar streaming episode: ${err.message}`,
          codeName: 'STREAM_EXTRACTION_FAILED (HTTP 403 / Offline)'
        }
      }));
    } finally {
      this.hideStreamLoadingOverlay();
      if (triggeringElement) {
        triggeringElement.classList.remove('btn-loading-pulse', 'is-loading');
      }
      document.querySelectorAll('.btn-loading-pulse, .is-loading').forEach(el => {
        el.classList.remove('btn-loading-pulse', 'is-loading');
      });
    }
  }

  /**
   * 9. Download Episode & Resolution Picker
   */
  async openResolutionPicker(ep, animeDetail) {
    if (!this.resolutionPickerModal) return;

    this.resolutionPickerModal.classList.remove('hidden');
    if (this.resolutionModalTitle) this.resolutionModalTitle.textContent = `Download: ${ep.title}`;
    if (this.resolutionModalDesc) this.resolutionModalDesc.textContent = 'Memuat pilihan resolusi dan server unduhan...';
    if (this.resolutionOptionsList) {
      this.resolutionOptionsList.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil opsi unduhan...</span></div>';
    }

    try {
      let streamData = null;
      if (window.electronAPI && typeof window.electronAPI.otakudesuGetEpisodeStream === 'function') {
        streamData = await window.electronAPI.otakudesuGetEpisodeStream(ep.url);
      }

      const options = (streamData && streamData.downloadOptions) || [];
      
      // Selalu sertakan link direct CDN stream di urutan pertama sebagai opsi tercepat & stabil
      if (streamData && streamData.streamUrl) {
        options.unshift({
          quality: 'MP4 HD (Direct)',
          size: 'Rekomendasi Cepat & Stabil',
          isRecommended: true,
          mirrors: [
            { host: '⚡ Download Langsung (VidPlayer)', url: streamData.streamUrl, isDirect: true }
          ]
        });
      }

      if (options.length === 0) {
        this.resolutionOptionsList.innerHTML = '<div class="web-empty-notice">Tautan download tidak ditemukan pada episode ini.</div>';
        return;
      }

      if (this.resolutionModalDesc) {
        this.resolutionModalDesc.textContent = 'Pilih kualitas video yang diinginkan (file akan otomatis diunduh ke folder player):';
      }

      let html = '';
      options.forEach(opt => {
        const isRec = opt.isRecommended;
        html += `
          <div class="resolution-group-card ${isRec ? 'recommended-group' : ''}">
            <div class="resolution-group-header">
              <span class="resolution-label">${isRec ? '⭐ ' : ''}${opt.quality}</span>
              ${opt.size ? `<span class="resolution-size">${opt.size}</span>` : ''}
            </div>
            <div class="mirror-buttons-grid">
        `;

        opt.mirrors.forEach(m => {
          const isDirect = m.isDirect || false;
          html += `
            <button class="btn-mirror-download ${isDirect ? 'btn-mirror-direct' : ''}" data-quality="${opt.quality}" data-host="${m.host}" data-url="${m.url}">
              <span>${isDirect ? '⚡' : '⬇'} ${m.host}</span>
            </button>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      this.resolutionOptionsList.innerHTML = html;

      // Event listener for mirrors
      this.resolutionOptionsList.querySelectorAll('.btn-mirror-download').forEach(btn => {
        btn.addEventListener('click', async () => {
          const downloadUrl = btn.dataset.url;
          const quality = btn.dataset.quality;
          const host = btn.dataset.host;

          this.closeResolutionPicker();

          const genresArr = (typeof animeDetail.genres === 'string'
            ? animeDetail.genres.split(',')
            : (animeDetail.genres || [])
          ).map(g => (typeof g === 'object' ? (g.name || '') : g).trim()).filter(Boolean);

          await this.triggerDownload({
            animeTitle: animeDetail.title,
            episodeTitle: ep.title,
            downloadUrl,
            quality,
            mirrorHost: host,
            posterUrl: animeDetail.poster,
            synopsis: animeDetail.synopsis,
            genres: genresArr
          });
        });
      });

    } catch (err) {
      console.error('Error fetching download resolutions:', err);
      if (this.resolutionOptionsList) {
        this.resolutionOptionsList.innerHTML = `<div class="web-empty-notice">Gagal memuat link download: ${err.message}</div>`;
      }
    }
  }

  /**
   * 10. Batch Download Picker
   */
  async openBatchPicker(batchInfo) {
    if (!this.resolutionPickerModal) return;

    this.resolutionPickerModal.classList.remove('hidden');
    if (this.resolutionModalTitle) this.resolutionModalTitle.textContent = `Download Batch: ${batchInfo.title}`;
    if (this.resolutionModalDesc) this.resolutionModalDesc.textContent = 'Memuat opsi batch semua episode...';
    if (this.resolutionOptionsList) {
      this.resolutionOptionsList.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil link batch...</span></div>';
    }

    try {
      let batchData = null;
      if (window.electronAPI && typeof window.electronAPI.otakudesuGetBatchDetails === 'function') {
        batchData = await window.electronAPI.otakudesuGetBatchDetails(batchInfo.url);
      }

      const options = (batchData && batchData.batchOptions) || [];
      if (options.length === 0) {
        this.resolutionOptionsList.innerHTML = '<div class="web-empty-notice">Link download batch tidak ditemukan.</div>';
        return;
      }

      if (this.resolutionModalDesc) {
        this.resolutionModalDesc.textContent = 'Pilih resolusi paket batch lengkap (file arsip ZIP/RAR):';
      }

      let html = '';
      options.forEach(opt => {
        html += `
          <div class="resolution-group-card">
            <div class="resolution-group-header">
              <span class="resolution-label">${opt.quality}</span>
              ${opt.size ? `<span class="resolution-size">${opt.size}</span>` : ''}
            </div>
            <div class="mirror-buttons-grid">
        `;

        opt.mirrors.forEach(m => {
          html += `
            <button class="btn-mirror-download" data-quality="${opt.quality}" data-host="${m.host}" data-url="${m.url}">
              <span>⬇ ${m.host}</span>
            </button>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      this.resolutionOptionsList.innerHTML = html;

      this.resolutionOptionsList.querySelectorAll('.btn-mirror-download').forEach(btn => {
        btn.addEventListener('click', async () => {
          const downloadUrl = btn.dataset.url;
          const quality = btn.dataset.quality;
          const host = btn.dataset.host;

          this.closeResolutionPicker();

          const genresArr = this.selectedAnime
            ? (typeof this.selectedAnime.genres === 'string'
              ? this.selectedAnime.genres.split(',')
              : (this.selectedAnime.genres || [])
            ).map(g => (typeof g === 'object' ? (g.name || '') : g).trim()).filter(Boolean)
            : [];

          await this.triggerDownload({
            animeTitle: this.selectedAnime ? this.selectedAnime.title : 'Anime Batch',
            episodeTitle: `${this.selectedAnime ? this.selectedAnime.title : 'Anime'} [BATCH]`,
            downloadUrl,
            quality,
            mirrorHost: host,
            posterUrl: this.selectedAnime ? this.selectedAnime.poster : null,
            synopsis: this.selectedAnime ? this.selectedAnime.synopsis : null,
            genres: genresArr
          });
        });
      });

    } catch (err) {
      console.error('Error fetching batch resolutions:', err);
      if (this.resolutionOptionsList) {
        this.resolutionOptionsList.innerHTML = `<div class="web-empty-notice">Gagal memuat batch: ${err.message}</div>`;
      }
    }
  }

  closeResolutionPicker() {
    if (this.resolutionPickerModal) {
      this.resolutionPickerModal.classList.add('hidden');
    }
  }

  async triggerDownload(options) {
    if (!options) return;
    const downloadUrl = options.downloadUrl || options.url;
    options.downloadUrl = downloadUrl;
    this.showDownloadToastNotification(`Memulai unduhan: ${options.episodeTitle || 'Episode'} (${options.quality || '720p'})...`);

    if (window.electronAPI && typeof window.electronAPI.startDownload === 'function') {
      try {
        await window.electronAPI.startDownload(options);
      } catch (err) {
        console.error('Gagal memulai download:', err);
        alert(`Gagal mengunduh: ${err.message}`);
      }
    }
  }

  /**
   * 11. Download Events & Full Status Drawer
   */
  handleDownloadEvent(data) {
    if (!data) return;

    if (data.type === 'started' || data.type === 'progress' || data.type === 'update') {
      const item = data.item;
      if (item) {
        this.activeDownloads.set(item.id, item);
      }
      this.updateDownloadBadge();
      this.renderDownloadToast();
      if (this.library && this.library.activeNav === 'downloads') {
        this.renderDedicatedDownloadsTab();
      }
    } else if (data.type === 'completed') {
      const item = data.item;
      if (item) {
        item.status = 'completed';
        item.percent = 100;
        item.speedText = 'Selesai';
        this.activeDownloads.set(item.id, item);
        this.showDownloadToastNotification(`✓ Selesai mengunduh ${item.episodeTitle}!`);
      }
      this.updateDownloadBadge();
      this.renderDownloadToast();

      // Refresh downloaded tab if open
      if (this.activeSub === 'downloaded') {
        this.renderDownloadedView();
      }
      if (this.library && this.library.activeNav === 'downloads') {
        this.renderDedicatedDownloadsTab();
      }
    } else if (data.type === 'error') {
      const item = this.activeDownloads.get(data.id) || (data.item || { id: data.id, episodeTitle: 'Download' });
      item.status = 'error';
      item.error = data.error || (data.item && data.item.error) || 'Gagal mengunduh file';
      item.speedText = 'Gagal';
      if (data.item && data.item.fallbackUrl) {
        item.fallbackUrl = data.item.fallbackUrl;
      }
      this.activeDownloads.set(data.id, item);
      this.updateDownloadBadge();
      this.renderDownloadToast();
      if (this.library && this.library.activeNav === 'downloads') {
        this.renderDedicatedDownloadsTab();
      }
    } else if (data.type === 'cancelled') {
      this.activeDownloads.delete(data.id);
      this.updateDownloadBadge();
      this.renderDownloadToast();
      if (this.library && this.library.activeNav === 'downloads') {
        this.renderDedicatedDownloadsTab();
      }
    }
  }

  updateDownloadBadge() {
    let activeCount = 0;
    this.activeDownloads.forEach(item => {
      if (item.status === 'downloading' || item.status === 'resolving' || item.status === 'extracting') {
        activeCount++;
      }
    });

    if (this.navDownloadBadge) {
      if (activeCount > 0) {
        this.navDownloadBadge.textContent = activeCount.toString();
        this.navDownloadBadge.classList.remove('hidden');
        if (this.btnDownloadStatusNav) {
          this.btnDownloadStatusNav.classList.add('active-downloading');
        }
      } else {
        this.navDownloadBadge.classList.add('hidden');
        if (this.btnDownloadStatusNav) {
          this.btnDownloadStatusNav.classList.remove('active-downloading');
        }
      }
    }

    if (this.tabDownloadsBadge) {
      if (activeCount > 0) {
        this.tabDownloadsBadge.textContent = activeCount.toString();
        this.tabDownloadsBadge.classList.remove('hidden');
      } else {
        this.tabDownloadsBadge.classList.add('hidden');
      }
    }
  }

  toggleDownloadManagerPanel() {
    if (!this.downloadManagerToast) return;
    const isHidden = this.downloadManagerToast.classList.contains('hidden');
    if (isHidden) {
      this.downloadManagerToast.classList.remove('hidden');
      if (this.downloadToastBody) {
        this.downloadToastBody.classList.remove('hidden');
      }
      this.renderDownloadToast();
    } else {
      this.downloadManagerToast.classList.add('hidden');
    }
  }

  showDownloadToastNotification(msg) {
    if (!this.downloadManagerToast) return;
    this.downloadManagerToast.classList.remove('hidden');
    if (this.downloadToastMainTitle) {
      this.downloadToastMainTitle.textContent = msg;
    }
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  renderDownloadToast() {
    if (!this.downloadManagerToast || !this.downloadToastBody) return;

    let activeCount = 0;
    this.activeDownloads.forEach(item => {
      if (item.status === 'downloading' || item.status === 'resolving') activeCount++;
    });

    if (this.activeDownloads.size === 0) {
      if (this.downloadToastMainTitle) {
        this.downloadToastMainTitle.textContent = 'Tidak ada proses unduhan';
      }
      this.downloadToastBody.innerHTML = `
        <div style="text-align:center;padding:18px 12px;color:var(--text-muted);font-size:12px;">
          Belum ada file yang sedang atau baru diunduh.
        </div>
      `;
      return;
    }

    if (this.downloadToastMainTitle) {
      this.downloadToastMainTitle.textContent = activeCount > 0 ? 
        `Mengunduh (${activeCount} proses aktif)...` : 'Pengelola Unduhan VidPlayer';
    }

    let html = '';
    this.activeDownloads.forEach(item => {
      const percent = item.percent || 0;
      const speed = item.speedText || 'Menghubungkan...';
      const status = item.status;

      if (status === 'error') {
        html += `
          <div class="toast-download-item">
            <div class="toast-item-info">
              <span class="toast-item-title" title="${item.episodeTitle}">${item.episodeTitle}</span>
              <span class="toast-badge-error">⚠ Gagal</span>
            </div>
            <div class="toast-error-text">${item.error || 'Terjadi kesalahan saat mengunduh.'}</div>
            <div class="toast-item-footer">
              <span class="toast-item-anime">${item.animeTitle}</span>
              <div style="display:flex;gap:6px;">
                ${item.fallbackUrl ? `<button class="btn-cancel-dl btn-open-browser-dl" data-url="${item.fallbackUrl}" style="background:#262626;color:#4fc3f7;border:1px solid rgba(79,195,247,0.4);" title="Buka tautan mirror di browser">🌐 Browser</button>` : ''}
                <button class="btn-cancel-dl btn-dismiss-dl" data-id="${item.id}">Tutup</button>
              </div>
            </div>
          </div>
        `;
      } else if (status === 'extracting') {
        html += `
          <div class="toast-download-item">
            <div class="toast-item-info">
              <span class="toast-item-title" title="${item.episodeTitle}">${item.episodeTitle} (${item.quality})</span>
              <span class="toast-item-speed" style="color:#ffb300;font-weight:600;">📦 Mengekstrak...</span>
            </div>
            <div class="toast-progress-bar-bg">
              <div class="toast-progress-bar-fill" style="width: 100%; background: #ff9800;"></div>
            </div>
            <div class="toast-item-footer">
              <span class="toast-item-anime">${item.animeTitle} • Mengekstrak video batch</span>
            </div>
          </div>
        `;
      } else if (status === 'completed') {
        html += `
          <div class="toast-download-item">
            <div class="toast-item-info">
              <span class="toast-item-title" title="${item.episodeTitle}">${item.episodeTitle} (${item.quality})</span>
              <span class="toast-badge-success">✓ Selesai</span>
            </div>
            <div class="toast-progress-bar-bg">
              <div class="toast-progress-bar-fill" style="width: 100%; background: #4caf50;"></div>
            </div>
            <div class="toast-item-footer">
              <span class="toast-item-anime">${item.animeTitle}</span>
              <div style="display:flex;gap:6px;">
                ${item.filePath ? `<button class="btn-cancel-dl btn-play-dl" data-path="${item.filePath}" style="background:#E50914;color:#fff;border-color:#E50914;">▶ Putar</button>` : ''}
                <button class="btn-cancel-dl btn-dismiss-dl" data-id="${item.id}">Tutup</button>
              </div>
            </div>
          </div>
        `;
      } else {
        // Downloading / Resolving
        const sizeInfo = item.totalBytes > 0 ? 
          `(${this.formatBytes(item.bytesDownloaded)} / ${this.formatBytes(item.totalBytes)})` : '';
        html += `
          <div class="toast-download-item">
            <div class="toast-item-info">
              <span class="toast-item-title" title="${item.episodeTitle}">${item.episodeTitle} (${item.quality})</span>
              <span class="toast-item-speed">${speed} • ${percent}%</span>
            </div>
            <div class="toast-progress-bar-bg">
              <div class="toast-progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="toast-item-footer">
              <span class="toast-item-anime">${item.animeTitle} ${sizeInfo}</span>
              <button class="btn-cancel-dl" data-id="${item.id}">Batal</button>
            </div>
          </div>
        `;
      }
    });

    this.downloadToastBody.innerHTML = html;

    // Attach button events
    this.downloadToastBody.querySelectorAll('.btn-cancel-dl:not(.btn-dismiss-dl):not(.btn-play-dl)').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id && window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
          window.electronAPI.cancelDownload(id);
        }
      });
    });

    this.downloadToastBody.querySelectorAll('.btn-dismiss-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          this.activeDownloads.delete(id);
          this.updateDownloadBadge();
          this.renderDownloadToast();
        }
      });
    });

    this.downloadToastBody.querySelectorAll('.btn-play-dl').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filePath = btn.dataset.path;
        if (filePath && this.player) {
          if (this.library) {
            this.library.showPlayerView();
          }
          await this.player.loadFile(filePath);
        }
      });
    });

    this.downloadToastBody.querySelectorAll('.btn-open-browser-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        if (url && window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
          window.electronAPI.openExternal(url);
        }
      });
    });
  }

  /**
   * 12. Render Dedicated Downloads Tab
   */
  async renderDedicatedDownloadsTab() {
    if (!this.downloadsTabBody) return;

    if (!this.downloadPath) {
      await this.refreshDownloadPath();
    }

    const activeList = [];
    const completedList = [];
    const errorList = [];

    this.activeDownloads.forEach(item => {
      if (item.status === 'downloading' || item.status === 'resolving' || item.status === 'extracting') {
        activeList.push(item);
      } else if (item.status === 'completed') {
        completedList.push(item);
      } else if (item.status === 'error') {
        errorList.push(item);
      }
    });

    let html = `
      <!-- Location & Stats Card -->
      <div class="settings-card full-width" style="margin-bottom: 24px;">
        <div class="settings-card-header">
          <div class="settings-card-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#e50914">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
            </svg>
          </div>
          <div style="flex:1;">
            <h3 class="settings-card-title">Folder Penyimpanan Unduhan</h3>
            <p class="settings-card-desc">Lokasi file anime yang diunduh ke komputer Anda: <code style="color:#ffffff;">${this.downloadPath || 'Folder Media'}</code></p>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="btnDedicatedOpenFolderInCard" class="btn-secondary" style="padding: 7px 14px; font-size: 13px;">Buka Folder</button>
            <button id="btnDedicatedChangeFolderInCard" class="btn-primary" style="padding: 7px 14px; font-size: 13px;">Ganti Lokasi</button>
          </div>
        </div>
      </div>

      <!-- Active Downloads Section -->
      <div style="margin-bottom: 28px;">
        <h2 class="dedicated-downloads-section-title">
          <span>Sedang Mengunduh</span>
          <span style="font-size:13px;font-weight:normal;color:var(--text-muted);">(${activeList.length} proses aktif)</span>
        </h2>
    `;

    if (activeList.length === 0) {
      html += `
        <div style="background:#181818;border:1px dashed rgba(255,255,255,0.12);border-radius:8px;padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">
          Tidak ada unduhan yang sedang berjalan saat ini. Pilih anime di tab <b>Web</b> untuk mulai mengunduh episode atau batch.
        </div>
      `;
    } else {
      html += '<div class="active-download-cards-list">';
      activeList.forEach(item => {
        const percent = item.percent || 0;
        const speed = item.speedText || 'Menghubungkan...';
        const sizeInfo = item.totalBytes > 0 ? 
          `(${this.formatBytes(item.bytesDownloaded)} / ${this.formatBytes(item.totalBytes)})` : '';

        html += `
          <div class="dedicated-dl-card">
            <div class="dedicated-dl-header">
              <div>
                <span class="dedicated-dl-title">${item.episodeTitle}</span>
                <span style="font-size:12px;background:#E50914;color:#fff;padding:2px 8px;border-radius:4px;margin-left:8px;">${item.quality}</span>
              </div>
              <button class="btn-cancel-dl btn-secondary" data-id="${item.id}" style="padding:4px 12px;font-size:12px;border-color:rgba(255,255,255,0.2);">Batalkan</button>
            </div>
            <div class="toast-progress-bar-bg" style="height:8px;border-radius:4px;">
              <div class="toast-progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-muted);">
              <span>${item.animeTitle} ${sizeInfo}</span>
              <span style="color:#ffffff;font-weight:600;">⚡ ${speed} • ${percent}%</span>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    html += '</div>'; // end active section

    // Completed & Saved Section
    html += `
      <div style="margin-bottom: 28px;">
        <h2 class="dedicated-downloads-section-title">
          <span>Riwayat & File Tersimpan</span>
          <span style="font-size:13px;font-weight:normal;color:var(--text-muted);">(${completedList.length} selesai)</span>
        </h2>
    `;

    if (completedList.length === 0 && errorList.length === 0) {
      html += `
        <div style="background:#181818;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">
          Belum ada file unduhan yang selesai pada sesi ini. File yang tersimpan dapat diputar langsung kapan saja.
        </div>
      `;
    } else {
      html += '<div class="active-download-cards-list">';
      
      // Render Errors first if any
      errorList.forEach(item => {
        html += `
          <div class="dedicated-dl-card card-error">
            <div class="dedicated-dl-header">
              <div>
                <span class="dedicated-dl-title">${item.episodeTitle}</span>
                <span style="font-size:12px;background:#ff4444;color:#fff;padding:2px 8px;border-radius:4px;margin-left:8px;">Gagal</span>
              </div>
              <div style="display:flex;gap:8px;">
                ${item.fallbackUrl ? `<button class="btn-open-browser-dl btn-secondary" data-url="${item.fallbackUrl}" style="padding:4px 12px;font-size:12px;color:#4fc3f7;border-color:rgba(79,195,247,0.4);" title="Buka tautan mirror di browser">🌐 Buka di Browser</button>` : ''}
                <button class="btn-dismiss-dl btn-secondary" data-id="${item.id}" style="padding:4px 12px;font-size:12px;">Hapus</button>
              </div>
            </div>
            <div style="font-size:12px;color:#ff8a80;">${item.error || 'Terjadi kesalahan saat mengunduh.'}</div>
            <div style="font-size:12px;color:var(--text-muted);">${item.animeTitle}</div>
          </div>
        `;
      });

      // Render Completed
      completedList.forEach(item => {
        html += `
          <div class="dedicated-dl-card card-completed">
            <div class="dedicated-dl-header">
              <div>
                <span class="dedicated-dl-title">${item.episodeTitle}</span>
                <span style="font-size:12px;background:#4caf50;color:#fff;padding:2px 8px;border-radius:4px;margin-left:8px;">${item.quality}</span>
                <span style="font-size:12px;color:#81c784;margin-left:8px;">✓ Selesai</span>
              </div>
              <div style="display:flex;gap:8px;">
                ${item.filePath ? `<button class="btn-play-dl btn-primary" data-path="${item.filePath}" style="padding:5px 16px;font-size:12px;">▶ Putar Video</button>` : ''}
                <button class="btn-dismiss-dl btn-secondary" data-id="${item.id}" style="padding:5px 12px;font-size:12px;">Hapus</button>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);">${item.animeTitle} • Lokasi: ${item.filePath || this.downloadPath}</div>
          </div>
        `;
      });

      html += '</div>';
    }

    html += '</div>';

    this.downloadsTabBody.innerHTML = html;

    // Attach button listeners inside downloads tab
    const btnOpenInCard = document.getElementById('btnDedicatedOpenFolderInCard');
    if (btnOpenInCard) {
      btnOpenInCard.addEventListener('click', () => {
        if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === 'function') {
          window.electronAPI.openDownloadFolder();
        }
      });
    }

    const btnChangeInCard = document.getElementById('btnDedicatedChangeFolderInCard');
    if (btnChangeInCard) {
      btnChangeInCard.addEventListener('click', async () => {
        if (window.electronAPI && typeof window.electronAPI.chooseDownloadFolder === 'function') {
          const chosen = await window.electronAPI.chooseDownloadFolder();
          if (chosen) {
            await this.refreshDownloadPath();
            this.renderDedicatedDownloadsTab();
          }
        }
      });
    }

    this.downloadsTabBody.querySelectorAll('.btn-cancel-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id && window.electronAPI && typeof window.electronAPI.cancelDownload === 'function') {
          window.electronAPI.cancelDownload(id);
        }
      });
    });

    this.downloadsTabBody.querySelectorAll('.btn-dismiss-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) {
          this.activeDownloads.delete(id);
          this.updateDownloadBadge();
          this.renderDedicatedDownloadsTab();
          this.renderDownloadToast();
        }
      });
    });

    this.downloadsTabBody.querySelectorAll('.btn-play-dl').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filePath = btn.dataset.path;
        if (filePath && this.player) {
          if (this.library) {
            this.library.showPlayerView();
          }
          await this.player.loadFile(filePath);
        }
      });
    });

    this.downloadsTabBody.querySelectorAll('.btn-open-browser-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        if (url && window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
          window.electronAPI.openExternal(url);
        }
      });
    });
  }
}

// Global instantiation hook
window.initOtakudesu = (player, library) => {
  window.otakudesuManager = new OtakudesuManager(player, library);
  window.otakudesuManager.init();
};

