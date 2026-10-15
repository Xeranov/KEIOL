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
      schedule: null,
      genres: null,
      genreAnime: {},
      animeList: null,
      search: {}
    };

    this.selectedAnime = null;
    this.activeDownloads = new Map();

    // Elements
    this.webSection = document.getElementById('webSection');
    this.webDynamicContainer = document.getElementById('webDynamicContainer');
    this.webBillboard = document.getElementById('webBillboard');
    this.webBillboardBackdrop = document.getElementById('webBillboardBackdrop');
    this.webBillboardTitle = document.getElementById('webBillboardTitle');
    this.webBillboardDesc = document.getElementById('webBillboardDesc');
    this.btnWebBillboardStream = document.getElementById('btnWebBillboardStream');
    this.btnWebBillboardDetail = document.getElementById('btnWebBillboardDetail');

    // Sub-nav pills
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

    // Load ongoing view initially
    await this.loadOngoing();
  }

  async refreshOnlineHistory() {
    if (window.electronAPI && typeof window.electronAPI.getOnlineHistory === 'function') {
      try {
        this.onlineHistory = await window.electronAPI.getOnlineHistory() || {};
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

    // ESC to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.streamLoadingOverlay && !this.streamLoadingOverlay.classList.contains('hidden')) {
          this.cancelStreamLoading();
          e.stopPropagation();
        } else if (this.resolutionPickerModal && !this.resolutionPickerModal.classList.contains('hidden')) {
          this.closeResolutionPicker();
          e.stopPropagation();
        } else if (this.otakudesuDetailModal && !this.otakudesuDetailModal.classList.contains('hidden')) {
          this.closeDetailModal();
          e.stopPropagation();
        }
      }
    });
  }

  onTabActivated() {
    this.refreshOnlineHistory();
    this.refreshDownloadPath();

    if (this.inputSearchAnime) {
      this.inputSearchAnime.placeholder = 'Cari anime di Otakudesu (cth: Solo Leveling, Naruto)...';
    }

    if (this.searchQuery && this.searchQuery.length >= 2) {
      this.executeSearch(this.searchQuery);
    } else {
      this.switchSubTab(this.activeSub);
    }
  }

  onTabDeactivated() {
    if (this.inputSearchAnime) {
      this.inputSearchAnime.placeholder = 'Cari koleksi video, anime, atau film...';
    }
  }

  switchSubTab(sub) {
    this.activeSub = sub;

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

  showLoading(text = 'Memuat dari Otakudesu...') {
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
  async loadOngoing() {
    if (this.webBillboard) this.webBillboard.classList.remove('hidden');
    this.showLoading('Memuat anime sedang tayang...');

    try {
      if (!this.cache.ongoing) {
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetOngoing === 'function') {
          this.cache.ongoing = await window.electronAPI.otakudesuGetOngoing(1);
        }
      }

      const data = this.cache.ongoing;
      if (!data || !data.animeList || data.animeList.length === 0) {
        this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Tidak dapat memuat anime ongoing dari Otakudesu. Periksa koneksi internet Anda.</div>';
        return;
      }

      // Render Billboard with 1st anime
      const hero = data.animeList[0];
      this.renderBillboard(hero);

      let contentHtml = '';

      // 1. Row: Lanjutkan Menonton (Online Watch History)
      const historyList = Object.values(this.onlineHistory || {}).filter(h => h && h.animeTitle).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

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

      // 2. Row: Sedang Tayang (Ongoing)
      const isGrid = this.ongoingViewMode === 'grid';
      contentHtml += `
        <div class="web-slider-section" id="webOngoingSection" style="margin-top: ${historyList.length > 0 ? '16px' : '0'};">
          <div class="web-grid-header">
            <div>
              <h2 class="web-section-heading">Anime Sedang Tayang (Ongoing)</h2>
              <span class="web-section-count">${data.animeList.length} Judul Rilis Terkini</span>
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

        // "Lihat Semua" Card at the right end of the horizontal slider
        contentHtml += `
              <div class="card-view-more" id="cardOngoingViewMore" title="Tampilkan semua anime ongoing dalam format grid">
                <div class="card-view-more-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                </div>
                <div class="card-view-more-text">Lihat Semua<br>Ongoing (${data.animeList.length})</div>
              </div>
            </div>
            <button class="btn-slider-arrow btn-slider-right" data-target="sliderWebOngoing" aria-label="Geser ke Kanan">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        `;
      }

      contentHtml += `</div>`;

      this.webDynamicContainer.innerHTML = contentHtml;

      // Bind interactions
      this.bindCardClicks();
      this.bindSliderArrows();

      // Toggle grid / slider button
      const btnToggle = document.getElementById('btnToggleOngoingMode');
      if (btnToggle) {
        btnToggle.addEventListener('click', () => {
          this.ongoingViewMode = this.ongoingViewMode === 'grid' ? 'slider' : 'grid';
          this.loadOngoing();
        });
      }

      // Card view more click
      const cardViewMore = document.getElementById('cardOngoingViewMore');
      if (cardViewMore) {
        cardViewMore.addEventListener('click', () => {
          this.ongoingViewMode = 'grid';
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
      this.webBillboardDesc.textContent = `${anime.episode || 'Episode Terbaru'} • Tayang setiap hari ${anime.day || ''} ${anime.date ? `(${anime.date})` : ''}`;
    }

    if (this.btnWebBillboardStream) {
      this.btnWebBillboardStream.onclick = () => {
        this.openAnimeDetail(anime.url);
      };
    }

    if (this.btnWebBillboardDetail) {
      this.btnWebBillboardDetail.onclick = () => {
        this.openAnimeDetail(anime.url);
      };
    }
  }

  /**
   * 2. Sub-Tab: Jadwal Rilis
   */
  async loadSchedule() {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading('Memuat jadwal rilis mingguan...');

    try {
      if (!this.cache.schedule) {
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetSchedule === 'function') {
          this.cache.schedule = await window.electronAPI.otakudesuGetSchedule();
        }
      }

      const schedule = this.cache.schedule;
      if (!schedule || schedule.length === 0) {
        this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Jadwal rilis tidak tersedia. Periksa koneksi internet Anda.</div>';
        return;
      }

      const dayMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayName = dayMap[new Date().getDay()];

      if (!this.selectedScheduleDay) {
        const foundToday = schedule.find(g => g.day && g.day.toLowerCase().includes(todayName.toLowerCase()));
        this.selectedScheduleDay = foundToday ? foundToday.day : (schedule[0] ? schedule[0].day : 'Senin');
      }

      let html = `
        <div class="schedule-container">
          <div class="web-grid-header">
            <div>
              <h2 class="web-section-heading">Jadwal Rilis Anime Mingguan</h2>
              <span class="web-section-count">Pembaruan Episode Otakudesu</span>
            </div>
          </div>
          <div class="schedule-day-tabs" role="tablist">
      `;

      schedule.forEach(group => {
        const isActive = group.day === this.selectedScheduleDay;
        const isToday = group.day && group.day.toLowerCase().includes(todayName.toLowerCase());
        html += `
          <button class="schedule-tab-btn ${isActive ? 'active' : ''}" data-day="${group.day}" role="tab" aria-selected="${isActive}">
            <span>${group.day}</span>
            ${isToday ? `<span class="schedule-today-pill">Hari Ini</span>` : ''}
            <span class="schedule-count-pill">${group.animeList ? group.animeList.length : 0}</span>
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
    if (!panel || !this.cache.schedule) return;

    const group = this.cache.schedule.find(g => g.day === dayName);
    if (!group || !group.animeList || group.animeList.length === 0) {
      panel.innerHTML = '<div class="web-empty-notice">Tidak ada jadwal rilis anime pada hari ini.</div>';
      return;
    }

    const isToday = dayName && dayName.toLowerCase().includes(todayName.toLowerCase());

    let html = `
      <div class="schedule-day-banner">
        <div class="schedule-day-title">
          <span>Hari ${group.day}</span>
          ${isToday ? `<span class="schedule-today-pill">Hari Ini</span>` : ''}
          <span class="web-section-count">${group.animeList.length} Anime Tayang</span>
        </div>
      </div>
      <div class="schedule-anime-grid">
    `;

    group.animeList.forEach(anime => {
      const initial = (anime.title || 'A').charAt(0).toUpperCase();
      const posterImg = anime.poster
        ? `<img class="netflix-card-poster" src="${anime.poster}" alt="${anime.title}" loading="lazy">`
        : `<div class="poster-placeholder"><span>${initial}</span></div>`;

      html += `
        <div class="netflix-card otakudesu-card schedule-landscape-card" data-url="${anime.url}" data-slug="${anime.slug}" tabindex="0" role="article" aria-label="${anime.title}">
          <div class="netflix-card-poster-wrap">
            ${posterImg}
            <div class="poster-gradient-overlay"></div>
            <span class="card-badge-top badge-red">${group.day}</span>
            <span class="card-badge-bottom">Otakudesu</span>
          </div>
          <div class="netflix-card-info">
            <div class="netflix-card-title">${anime.title}</div>
            <div class="netflix-card-meta">Tayang setiap ${group.day}</div>
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
              <span class="hover-badge-red">Tayang ${group.day}</span>
              <span class="hover-badge-outline">HD</span>
              <span class="hover-score-star">★ Ongoing</span>
            </div>
            <div class="hover-tags-row">
              <span>Rilis di Otakudesu</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
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
        this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Daftar genre tidak ditemukan.</div>';
        return;
      }

      let html = `
        <div class="web-grid-header">
          <h2 class="web-section-heading">Kategori & Genre Anime</h2>
          <span class="web-section-count">${genres.length} Kategori Tersedia</span>
        </div>
        <div class="genres-pill-slider" id="genresPillSlider">
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
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat genre: ${err.message}</div>`;
    }
  }

  async loadAnimeByGenre(slug, page = 1, append = false) {
    const container = document.getElementById('genreAnimeGridContainer');
    if (!container) return;

    if (!append) {
      this.currentGenreSlug = slug;
      this.genreCurrentPage = 1;
      this.genreHasNextPage = false;
      container.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil anime genre...</span></div>';
    } else {
      const btnShowMore = document.getElementById('btnGenreShowMore');
      if (btnShowMore) {
        btnShowMore.disabled = true;
        btnShowMore.innerHTML = '<div class="yt-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Memuat lebih banyak anime...';
      }
    }

    try {
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

  /**
   * 4. Sub-Tab: Daftar Anime A-Z
   */
  async loadAnimeList() {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading('Memuat direktori anime A-Z...');

    try {
      if (!this.cache.animeList) {
        if (window.electronAPI && typeof window.electronAPI.otakudesuGetAnimeList === 'function') {
          this.cache.animeList = await window.electronAPI.otakudesuGetAnimeList();
        }
      }

      const groups = this.cache.animeList || [];
      if (groups.length === 0) {
        this.webDynamicContainer.innerHTML = '<div class="web-empty-notice">Direktori anime tidak dapat dimuat.</div>';
        return;
      }

      let html = `
        <div class="alphabet-nav-wrap">
          <div class="web-grid-header">
            <div>
              <h2 class="web-section-heading">Direktori Lengkap Anime (A - Z)</h2>
              <span class="web-section-count">${groups.length} Grup Abjad</span>
            </div>
          </div>
          <div class="alphabet-index-bar" id="alphabetIndexBar" role="tablist">
      `;

      groups.forEach((g, idx) => {
        const isCurrent = g.letter === this.activeLetter || (!this.activeLetter && idx === 0);
        html += `<button class="alphabet-btn ${isCurrent ? 'active' : ''}" data-letter="${g.letter}" role="tab" aria-selected="${isCurrent}">${g.letter}</button>`;
      });

      html += `
          </div>
          <div class="alphabet-search-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#888888">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input type="text" id="inputFilterAlphabet" placeholder="Filter anime di abjad terpilih..." aria-label="Filter judul anime">
          </div>
        </div>
        <div id="alphabetListContainer" class="alphabet-list-container"></div>
      `;

      this.webDynamicContainer.innerHTML = html;

      this.webDynamicContainer.querySelectorAll('.alphabet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.webDynamicContainer.querySelectorAll('.alphabet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeLetter = btn.dataset.letter;
          const searchInput = document.getElementById('inputFilterAlphabet');
          if (searchInput) searchInput.value = '';
          this.renderAlphabetGroup(this.activeLetter);
        });
      });

      const searchInput = document.getElementById('inputFilterAlphabet');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = (e.target.value || '').toLowerCase().trim();
          this.renderAlphabetGroup(this.activeLetter, q);
        });
      }

      const initialLetter = this.activeLetter || (groups[0] ? groups[0].letter : 'A');
      this.renderAlphabetGroup(initialLetter);

    } catch (err) {
      console.error('Error loading anime list:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat direktori: ${err.message}</div>`;
    }
  }

  renderAlphabetGroup(letter, filterQuery = '') {
    const container = document.getElementById('alphabetListContainer');
    if (!container || !this.cache.animeList) return;

    const group = this.cache.animeList.find(g => g.letter === letter);
    if (!group || !group.items || group.items.length === 0) {
      container.innerHTML = '<div class="web-empty-notice">Tidak ada anime pada abjad ini.</div>';
      return;
    }

    let items = group.items;
    if (filterQuery) {
      items = items.filter(it => it.title.toLowerCase().includes(filterQuery));
    }

    if (items.length === 0) {
      container.innerHTML = `<div class="web-empty-notice">Tidak ada judul anime yang cocok dengan "${filterQuery}" di abjad ${letter}.</div>`;
      return;
    }

    let html = `
      <div class="alphabet-group-header">
        <span>Abjad ${letter}</span>
        <span class="web-section-count">(${items.length} dari ${group.items.length} anime)</span>
      </div>
      <div class="alphabet-items-grid">
    `;

    items.forEach(item => {
      html += `
        <div class="alphabet-anime-card" data-url="${item.url}" data-slug="${item.slug}" tabindex="0" role="button" aria-label="${item.title}">
          <div class="alphabet-monogram">${letter}</div>
          <div class="alphabet-card-title" title="${item.title}">${item.title}</div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.alphabet-anime-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.dataset.url;
        if (url) this.openAnimeDetail(url);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = card.dataset.url;
          if (url) this.openAnimeDetail(url);
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
      if (window.electronAPI && typeof window.electronAPI.scanLibrary === 'function') {
        libraryResult = await window.electronAPI.scanLibrary();
      }

      const seriesList = (libraryResult && libraryResult.seriesList) || [];
      const movies = (libraryResult && libraryResult.movies) || [];
      const totalDownloaded = seriesList.length + movies.length;

      // Update badge
      if (this.downloadedBadge) {
        if (totalDownloaded > 0) {
          this.downloadedBadge.textContent = totalDownloaded;
          this.downloadedBadge.classList.remove('hidden');
        } else {
          this.downloadedBadge.classList.add('hidden');
        }
      }

      const currentPath = this.downloadPath || (libraryResult && libraryResult.libraryPath) || 'anime';
      const totalFiles = seriesList.reduce((acc, s) => acc + (s.episodesCount || 0), 0) + movies.length;

      let html = `
        <div class="web-grid-header">
          <div>
            <h2 class="web-section-heading">Anime Tersimpan (Downloaded)</h2>
            <div class="downloaded-folder-info">
              <span>Lokasi Penyimpanan: <code>${currentPath}</code></span>
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
          </div>
        </div>

        <div class="downloaded-stats-bar">
          <div class="downloaded-stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
            </div>
            <div class="stat-meta">
              <span class="stat-label">Total Koleksi Anime</span>
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
              <span class="stat-label">Folder Aktif</span>
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
            <h3 class="empty-title">Belum Ada Anime yang Diunduh</h3>
            <p class="empty-subtitle">Pilih episode anime dari tab Sedang Tayang, Jadwal, atau Genre, lalu klik tombol "Download" untuk menyimpannya ke folder player.</p>
            <button class="btn-netflix-play" id="btnExploreFromDownloaded">Jelajahi Anime Sekarang</button>
          </div>
        `;
      } else {
        html += '<div class="netflix-poster-grid">';

        seriesList.forEach(series => {
          const poster = series.posterPath ? `http://127.0.0.1:${this.player.serverPort}/file?path=${encodeURIComponent(series.posterPath)}` : '';
          const lastWatchedText = series.lastWatched ? `Terakhir: ${series.lastWatched.episodeName}` : `${series.episodesCount} Episode`;

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
                <div class="netflix-card-meta">${lastWatchedText}</div>
              </div>
              <div class="netflix-card-hover-panel">
                <div class="hover-action-row">
                  <div class="hover-action-left">
                    <button class="btn-card-action btn-card-play btn-play-local" data-series-path="${series.path}" title="Putar Langsung" aria-label="Putar">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="btn-card-action btn-card-secondary btn-episodes-local" data-series-path="${series.path}" title="Daftar Episode" aria-label="Daftar Episode">
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
                  <span>${series.title}</span>
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

    } catch (err) {
      console.error('Error rendering downloaded view:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal memuat unduhan: ${err.message}</div>`;
    }
  }

  /**
   * 6. Pencarian Anime Otakudesu
   */
  async executeSearch(query) {
    if (this.webBillboard) this.webBillboard.classList.add('hidden');
    this.showLoading(`Mencari "${query}" di Otakudesu...`);

    try {
      let results = [];
      if (window.electronAPI && typeof window.electronAPI.otakudesuSearch === 'function') {
        results = await window.electronAPI.otakudesuSearch(query);
      }

      if (!results || results.length === 0) {
        this.webDynamicContainer.innerHTML = `
          <div class="web-empty-notice">
            Tidak ada anime yang cocok dengan kata kunci "<b>${query}</b>". Silakan coba kata kunci lain.
          </div>
        `;
        return;
      }

      let html = `
        <div class="web-grid-header">
          <div>
            <h2 class="web-section-heading">Hasil Pencarian: "${query}"</h2>
            <span class="web-section-count">${results.length} Anime Ditemukan</span>
          </div>
        </div>
        <div class="netflix-poster-grid">
      `;

      results.forEach(anime => {
        html += this.renderAnimeCard(anime);
      });

      html += '</div>';
      this.webDynamicContainer.innerHTML = html;
      this.bindCardClicks();

    } catch (err) {
      console.error('Error executing search:', err);
      this.webDynamicContainer.innerHTML = `<div class="web-empty-notice">Gagal mencari anime: ${err.message}</div>`;
    }
  }

  /**
   * Helper: Merender satu kartu poster anime dengan 2:3 aspect ratio dan hover panel
   */
  renderAnimeCard(anime) {
    const slug = anime.slug;
    const historyEntry = this.onlineHistory[slug];
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

    const badgeTop = anime.episode || (anime.rating ? `★ ${anime.rating}` : '') || (anime.status ? `● ${anime.status}` : 'Ongoing');
    const badgeBottom = anime.day ? `${anime.day} • ${anime.date || ''}` : (anime.genres || 'Anime');
    const scoreText = anime.rating ? `★ ${anime.rating}` : (historyEntry ? 'Terakhir Ditonton' : '★ 8.5');
    const statusText = anime.status || 'Ongoing';

    return `
      <div class="netflix-card otakudesu-card" data-url="${anime.url}" data-slug="${slug}" tabindex="0" role="article" aria-label="${anime.title}">
        <div class="netflix-card-poster-wrap">
          ${anime.poster ? `<img class="netflix-card-poster" src="${anime.poster}" alt="${anime.title}" loading="lazy">` : `<div class="poster-placeholder"><span>${anime.title.charAt(0)}</span></div>`}
          <div class="poster-gradient-overlay"></div>
          ${badgeTop ? `<span class="card-badge-top">${badgeTop}</span>` : ''}
          ${badgeBottom ? `<span class="card-badge-bottom">${badgeBottom}</span>` : ''}
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
              <button class="btn-card-action btn-card-play btn-card-quick-stream" data-url="${anime.url}" data-slug="${slug}" title="Putar Langsung" aria-label="Putar Langsung">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <button class="btn-card-action btn-card-secondary btn-card-quick-info" data-url="${anime.url}" data-slug="${slug}" title="Lihat Detail & Episode" aria-label="Detail Anime">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </button>
            </div>
          </div>
          <div class="hover-card-title">${anime.title}</div>
          <div class="hover-meta-row">
            <span class="hover-score-star">${scoreText}</span>
            <span class="hover-badge-outline">HD</span>
            <span class="hover-badge-red">${statusText}</span>
          </div>
          <div class="hover-tags-row">
            <span>${anime.genres || anime.day || anime.title}</span>
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
   * 7. Modal Detail Anime & Daftar Episode
   */
  async openAnimeDetail(urlOrSlug) {
    if (!this.otakudesuDetailModal) return;

    this.otakudesuDetailModal.classList.remove('hidden');
    if (this.otakudesuModalTitle) this.otakudesuModalTitle.textContent = 'Memuat Informasi Anime...';
    if (this.otakudesuJapaneseTitle) this.otakudesuJapaneseTitle.textContent = '';
    if (this.otakudesuSynopsis) this.otakudesuSynopsis.textContent = 'Mengambil detail anime dan daftar episode dari Otakudesu...';
    if (this.otakudesuEpisodesGrid) {
      this.otakudesuEpisodesGrid.innerHTML = '<div class="web-loading-spinner"><div class="yt-spinner"></div><span>Mengambil episode...</span></div>';
    }

    try {
      let detail = null;
      if (window.electronAPI && typeof window.electronAPI.otakudesuGetDetail === 'function') {
        detail = await window.electronAPI.otakudesuGetDetail(urlOrSlug);
      }

      if (!detail) throw new Error('Data anime tidak ditemukan');
      this.selectedAnime = detail;

      // Update Modal Elements
      if (this.otakudesuHeroBackdrop) {
        this.otakudesuHeroBackdrop.style.backgroundImage = `url("${detail.poster}")`;
      }
      if (this.otakudesuModalTitle) this.otakudesuModalTitle.textContent = detail.title;
      if (this.otakudesuJapaneseTitle) this.otakudesuJapaneseTitle.textContent = detail.japaneseTitle || '';
      if (this.otakudesuStatusBadge) this.otakudesuStatusBadge.textContent = detail.status || 'Tersedia';
      if (this.otakudesuScoreBadge) this.otakudesuScoreBadge.textContent = detail.score ? `★ ${detail.score}` : '★ -';
      if (this.otakudesuTypeBadge) this.otakudesuTypeBadge.textContent = detail.type || 'Anime';
      if (this.otakudesuStudio) this.otakudesuStudio.textContent = detail.studio || 'Studio';
      if (this.otakudesuDuration) this.otakudesuDuration.textContent = detail.duration || 'Durasi per ep';
      if (this.otakudesuTotalEps) this.otakudesuTotalEps.textContent = `${detail.episodes.length} Episode`;
      if (this.otakudesuSynopsis) this.otakudesuSynopsis.textContent = detail.synopsis || 'Sinopsis tidak tersedia.';

      // Render Genres
      if (this.otakudesuGenresWrap) {
        let gHtml = '';
        (detail.genres || []).forEach(g => {
          gHtml += `<span class="otakudesu-genre-tag">${g.name}</span>`;
        });
        this.otakudesuGenresWrap.innerHTML = gHtml;
      }

      // Stream First Episode button
      if (this.btnOtakudesuStreamFirst) {
        if (detail.episodes && detail.episodes.length > 0) {
          const firstEp = detail.episodes[0];
          this.txtOtakudesuStreamFirst.textContent = `Streaming ${firstEp.title}`;
          this.btnOtakudesuStreamFirst.onclick = () => {
            this.streamEpisode(firstEp, detail, this.btnOtakudesuStreamFirst);
          };
          this.btnOtakudesuStreamFirst.classList.remove('hidden');
        } else {
          this.btnOtakudesuStreamFirst.classList.add('hidden');
        }
      }

      // Batch download button
      if (this.btnOtakudesuBatch) {
        if (detail.batch) {
          this.btnOtakudesuBatch.classList.remove('hidden');
          this.btnOtakudesuBatch.onclick = () => {
            this.openBatchPicker(detail.batch);
          };
        } else {
          this.btnOtakudesuBatch.classList.add('hidden');
        }
      }

      // Render Episode Cards List
      this.renderEpisodesList(detail);

    } catch (err) {
      console.error('Error opening anime detail:', err);
      if (this.otakudesuSynopsis) {
        this.otakudesuSynopsis.textContent = `Gagal memuat detail anime: ${err.message}`;
      }
    }
  }

  renderEpisodesList(animeDetail) {
    if (!this.otakudesuEpisodesGrid) return;

    const episodes = animeDetail.episodes || [];
    if (episodes.length === 0) {
      this.otakudesuEpisodesGrid.innerHTML = '<div class="web-empty-notice">Belum ada episode tersedia untuk anime ini.</div>';
      return;
    }

    const historyForAnime = (this.onlineHistory && this.onlineHistory[animeDetail.slug]) || null;
    let html = '';

    episodes.forEach((ep, index) => {
      const epHist = historyForAnime && historyForAnime.episodes && historyForAnime.episodes[ep.url];
      let statusBadge = '';
      let progressPercent = 0;
      let timeText = '';

      if (epHist) {
        if (epHist.completed) {
          statusBadge = '<span class="ep-badge-completed">✓ Selesai Ditonton</span>';
          progressPercent = 100;
        } else if (epHist.currentTime > 0 && epHist.duration > 0) {
          progressPercent = Math.min(100, Math.round((epHist.currentTime / epHist.duration) * 100));
          const curMin = Math.floor(epHist.currentTime / 60);
          const curSec = Math.floor(epHist.currentTime % 60).toString().padStart(2, '0');
          const durMin = Math.floor(epHist.duration / 60);
          const durSec = Math.floor(epHist.duration % 60).toString().padStart(2, '0');
          timeText = `${curMin}:${curSec} / ${durMin}:${durSec} (${progressPercent}%)`;
          statusBadge = `<span class="ep-badge-progress">${timeText}</span>`;
        }
      }

      html += `
        <div class="otakudesu-episode-card" data-url="${ep.url}">
          <div class="ep-card-main">
            <div class="ep-number-box">
              <span class="ep-num-label">${episodes.length - index}</span>
            </div>
            <div class="ep-info-box">
              <div class="ep-title-row">
                <h4 class="ep-title-text">${ep.title}</h4>
                ${statusBadge}
              </div>
              <div class="ep-date-row">
                <span>Rilis: ${ep.date || 'Tersedia'}</span>
              </div>
              ${progressPercent > 0 ? `
                <div class="ep-progress-bar-bg">
                  <div class="ep-progress-bar-fill" style="width: ${progressPercent}%;"></div>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="ep-actions-box">
            <button class="btn-ep-stream" data-index="${index}" title="Putar langsung di VidPlayer">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <span>Streaming</span>
            </button>
            <button class="btn-ep-download" data-index="${index}" title="Download ke folder komputer">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
              <span>Download</span>
            </button>
          </div>
        </div>
      `;
    });

    this.otakudesuEpisodesGrid.innerHTML = html;

    // Attach button click events
    this.otakudesuEpisodesGrid.querySelectorAll('.btn-ep-stream').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const ep = episodes[idx];
        if (ep) this.streamEpisode(ep, animeDetail, btn);
      });
    });

    this.otakudesuEpisodesGrid.querySelectorAll('.btn-ep-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const ep = episodes[idx];
        if (ep) this.openResolutionPicker(ep, animeDetail);
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
      let streamData = null;
      if (window.electronAPI && typeof window.electronAPI.otakudesuGetEpisodeStream === 'function') {
        streamData = await window.electronAPI.otakudesuGetEpisodeStream(ep.url);
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

      if (!streamData || !streamData.streamUrl) {
        if (streamData && streamData.downloadOptions && streamData.downloadOptions.length > 0) {
          this.hideStreamLoadingOverlay();
          this.showDownloadToastNotification('Stream direct default offline. Membuka server alternatif...');
          this.openResolutionPicker(ep, animeDetail);
          if (this.resolutionModalDesc) {
            this.resolutionModalDesc.innerHTML = '<span style="color:#ffb74d;">⚠️ Server streaming default untuk episode ini sedang offline/kedaluwarsa.</span><br>Silakan pilih mirror unduhan cepat di bawah (atau unduh langsung):';
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

      // Fetch precise skip times from AniSkip / AniList
      let skipIntervals = null;
      if (window.electronAPI && typeof window.electronAPI.getAnimeSkipTimes === 'function') {
        try {
          const epMatch = (ep.title || '').match(/(?:Episode|Eps?\.?)\s*(\d+)/i);
          const epNum = epMatch ? parseInt(epMatch[1], 10) : 1;
          const skipRes = await window.electronAPI.getAnimeSkipTimes(animeDetail.title, epNum);
          if (skipRes && skipRes.found) {
            skipIntervals = { op: skipRes.op, ed: skipRes.ed };
          }
        } catch (e) {
          console.warn('Gagal memuat AniSkip times:', e.message);
        }
      }

      if (this.isStreamLoadingCancelled) return;

      // Launch player
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

        await this.player.loadRemoteStream(streamData.streamUrl, {
          title: `${animeDetail.title} - ${ep.title}`,
          animeSlug: animeDetail.slug,
          animeTitle: animeDetail.title,
          episodeUrl: ep.url,
          episodeTitle: ep.title,
          poster: animeDetail.poster,
          startTime: resumeTime,
          availableQualities: streamData.availableQualities || [],
          currentQuality: streamData.currentQuality || '720p',
          skipIntervals: skipIntervals
        });
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

          await this.triggerDownload({
            animeTitle: animeDetail.title,
            episodeTitle: ep.title,
            downloadUrl,
            quality,
            mirrorHost: host
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

          await this.triggerDownload({
            animeTitle: this.selectedAnime ? this.selectedAnime.title : 'Anime Batch',
            episodeTitle: `${this.selectedAnime ? this.selectedAnime.title : 'Anime'} [BATCH]`,
            downloadUrl,
            quality,
            mirrorHost: host
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
    this.showDownloadToastNotification(`Memulai unduhan: ${options.episodeTitle} (${options.quality})...`);

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
      if (item.status === 'downloading' || item.status === 'resolving') {
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
              <button class="btn-cancel-dl btn-dismiss-dl" data-id="${item.id}">Tutup</button>
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
      if (item.status === 'downloading' || item.status === 'resolving') {
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
              <button class="btn-dismiss-dl btn-secondary" data-id="${item.id}" style="padding:4px 12px;font-size:12px;">Hapus</button>
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
  }
}

// Global instantiation hook
window.initOtakudesu = (player, library) => {
  window.otakudesuManager = new OtakudesuManager(player, library);
  window.otakudesuManager.init();
};

