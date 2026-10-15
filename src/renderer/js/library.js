/**
 * XPlayer: Netflix-Style Library & Gallery Controller
 * Manages movies and series detection, continue watching hero,
 * horizontal category rows, episode playlists, and view switching.
 */
class LibraryManager {
  constructor(player) {
    this.player = player;
    this.libraryData = { libraryPath: '', seriesList: [], movies: [], continueWatching: null };
    this.selectedAnime = null;
    this.activeTab = 'all'; // 'all' | 'series' | 'movies'
    this.searchQuery = '';
    this.autoplayCountdownTimer = null;
    this.autoplaySecondsLeft = 5;

    // View Containers
    this.galleryView = document.getElementById('galleryView');
    this.playerView = document.getElementById('playerView');

    // Titlebar back button
    this.btnBackToGallery = document.getElementById('btnBackToGallery');
    this.btnPlayerBack = document.getElementById('btnPlayerBack');

    // Netflix Toolbar
    this.btnChooseFolder = document.getElementById('btnChooseFolder');
    this.btnChangeFolder = document.getElementById('btnChangeFolder');
    this.libraryFolderText = document.getElementById('libraryFolderText');
    this.btnRefreshLibrary = document.getElementById('btnRefreshLibrary');
    this.inputSearchAnime = document.getElementById('inputSearchAnime');

    // Tabs & Navigation
    this.activeNav = 'home'; // 'home' | 'web' | 'downloads' | 'settings'
    this.tabHome = document.getElementById('tabHome');
    this.tabWeb = document.getElementById('tabWeb');
    this.tabDownloads = document.getElementById('tabDownloads');
    this.tabSettings = document.getElementById('tabSettings');
    this.tabDownloadsBadge = document.getElementById('tabDownloadsBadge');

    // Sections
    this.webSection = document.getElementById('webSection');
    this.downloadsSection = document.getElementById('downloadsSection');
    this.settingsSection = document.getElementById('settingsSection');
    this.inputWebUrl = document.getElementById('inputWebUrl');
    this.btnGoWeb = document.getElementById('btnGoWeb');
    this.webIframe = document.getElementById('webIframe');
    this.webPlaceholder = document.getElementById('webPlaceholder');
    this.netflixContent = document.querySelector('.netflix-content');
    this.folderActionGroup = document.querySelector('.folder-action-group');

    // Dedicated Settings Controls
    this.settingMediaFolderPath = document.getElementById('settingMediaFolderPath');
    this.btnSettingChooseMediaFolder = document.getElementById('btnSettingChooseMediaFolder');
    this.btnSettingOpenMediaFolder = document.getElementById('btnSettingOpenMediaFolder');
    this.settingDownloadFolderPath = document.getElementById('settingDownloadFolderPath');
    this.btnSettingChooseDlFolder = document.getElementById('btnSettingChooseDlFolder');
    this.btnSettingOpenDlFolder = document.getElementById('btnSettingOpenDlFolder');
    this.selectSettingSeek = document.getElementById('selectSettingSeek');
    this.selectSettingSpeed = document.getElementById('selectSettingSpeed');

    // Netflix Billboard / Hero
    this.billboardSection = document.getElementById('billboardSection');
    this.billboardBackdrop = document.getElementById('billboardBackdrop');
    this.billboardTitle = document.getElementById('billboardTitle');
    this.billboardDesc = document.getElementById('billboardDesc');
    this.billboardProgressFill = document.getElementById('billboardProgressFill');
    this.billboardProgressText = document.getElementById('billboardProgressText');
    this.btnBillboardPlay = document.getElementById('btnBillboardPlay');
    this.btnBillboardInfo = document.getElementById('btnBillboardInfo');

    // Netflix Rows Containers
    this.rowContinue = document.getElementById('rowContinue');
    this.sliderContinue = document.getElementById('sliderContinue');

    this.rowMedia = document.getElementById('rowMedia');
    this.sliderMedia = document.getElementById('sliderMedia');
    this.rowMediaTitle = document.getElementById('rowMediaTitle');

    // Fallbacks for compatibility
    this.rowSeries = this.rowMedia;
    this.sliderSeries = this.sliderMedia;
    this.rowMovies = this.rowMedia;
    this.sliderMovies = this.sliderMedia;

    this.galleryEmpty = document.getElementById('galleryEmpty');

    // Episodes Modal
    this.episodesModal = document.getElementById('episodesModal');
    this.episodesHeroBackdrop = document.getElementById('episodesHeroBackdrop');
    this.episodesAnimeTitle = document.getElementById('episodesAnimeTitle');
    this.episodesCountBadge = document.getElementById('episodesCountBadge');
    this.episodesWatchedStatus = document.getElementById('episodesWatchedStatus');
    this.episodesList = document.getElementById('episodesList');
    this.btnCloseEpisodes = document.getElementById('btnCloseEpisodes');
    this.btnPlayAllEpisodes = document.getElementById('btnPlayAllEpisodes');
    this.btnPlayAllText = document.getElementById('btnPlayAllText');

    // In-Player Playlist Drawer
    this.playlistDrawer = document.getElementById('playlistDrawer');
    this.playlistDrawerTitle = document.getElementById('playlistDrawerTitle');
    this.playlistDrawerBody = document.getElementById('playlistDrawerBody');
    this.btnClosePlaylistDrawer = document.getElementById('btnClosePlaylistDrawer');
    this.btnTogglePlaylist = document.getElementById('btnTogglePlaylist');

    // Next Episode Autoplay Toast
    this.nextAutoplayToast = document.getElementById('nextAutoplayToast');
    this.nextAutoplayTitle = document.getElementById('nextAutoplayTitle');
    this.btnCancelAutoplay = document.getElementById('btnCancelAutoplay');
    this.btnPlayNextNow = document.getElementById('btnPlayNextNow');

    // Online Streaming Playlist state
    this.currentOnlinePlaylist = null;
    this.isPendingNextEpisodeOnline = false;

    this.initEvents();
  }

  async init() {
    await this.scanAndRender();
  }

  initEvents() {
    // Back to Gallery button in titlebar
    if (this.btnBackToGallery) {
      this.btnBackToGallery.addEventListener('click', () => {
        this.showGalleryView();
      });
    }

    // In-Player Top Bar Back button
    if (this.btnPlayerBack) {
      this.btnPlayerBack.addEventListener('click', () => {
        this.showGalleryView();
      });
    }

    // Brand click returns to Gallery
    const brandEl = document.querySelector('.brand');
    if (brandEl) {
      brandEl.addEventListener('click', () => {
        this.showGalleryView();
      });
    }

    // Folder button: Opens Windows Explorer to player's media storage folder
    if (this.btnChooseFolder) {
      this.btnChooseFolder.addEventListener('click', async () => {
        if (window.electronAPI) {
          if (typeof window.electronAPI.openFolderInExplorer === 'function') {
            await window.electronAPI.openFolderInExplorer(this.libraryData.libraryPath);
          } else {
            const result = await window.electronAPI.chooseLibraryFolder();
            if (result) {
              this.libraryData = result;
              this.render();
            }
          }
        }
      });
    }

    // Change Folder button: Lets user choose a new master folder if desired
    if (this.btnChangeFolder) {
      this.btnChangeFolder.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.electronAPI) {
          const result = await window.electronAPI.chooseLibraryFolder();
          if (result) {
            this.libraryData = result;
            this.render();
          }
        }
      });
    }

    // Auto re-scan when window receives focus (after user drops folders in Explorer)
    window.addEventListener('focus', () => {
      if (!this.galleryView.classList.contains('hidden')) {
        this.scanAndRender();
      }
    });

    // Refresh Library
    if (this.btnRefreshLibrary) {
      this.btnRefreshLibrary.addEventListener('click', () => {
        this.scanAndRender();
      });
    }

    // Search (hanya aktif untuk filter lokal saat berada di tab Beranda)
    this.inputSearchAnime.addEventListener('input', (e) => {
      if (this.activeNav !== 'home') return;
      this.searchQuery = (e.target.value || '').toLowerCase().trim();
      this.renderRows();
    });

    // Navigation Tabs (Beranda, Web, Unduhan, Pengaturan)
    if (this.tabHome) {
      this.tabHome.addEventListener('click', () => this.switchNavTab('home'));
    }
    if (this.tabWeb) {
      this.tabWeb.addEventListener('click', () => this.switchNavTab('web'));
    }
    if (this.tabDownloads) {
      this.tabDownloads.addEventListener('click', () => this.switchNavTab('downloads'));
    }
    if (this.tabSettings) {
      this.tabSettings.addEventListener('click', () => this.switchNavTab('settings'));
    }

    // Settings actions
    if (this.btnSettingChooseMediaFolder) {
      this.btnSettingChooseMediaFolder.addEventListener('click', async () => {
        if (window.electronAPI) {
          const result = await window.electronAPI.chooseLibraryFolder();
          if (result) {
            this.libraryData = result;
            this.render();
            this.renderSettingsTab();
          }
        }
      });
    }

    if (this.btnSettingOpenMediaFolder) {
      this.btnSettingOpenMediaFolder.addEventListener('click', async () => {
        if (window.electronAPI && typeof window.electronAPI.openFolderInExplorer === 'function') {
          await window.electronAPI.openFolderInExplorer(this.libraryData.libraryPath);
        }
      });
    }

    if (this.btnSettingChooseDlFolder) {
      this.btnSettingChooseDlFolder.addEventListener('click', async () => {
        if (window.electronAPI && typeof window.electronAPI.chooseDownloadFolder === 'function') {
          const chosen = await window.electronAPI.chooseDownloadFolder();
          if (chosen) {
            this.renderSettingsTab();
            if (window.otakudesuManager) {
              await window.otakudesuManager.refreshDownloadPath();
            }
          }
        }
      });
    }

    if (this.btnSettingOpenDlFolder) {
      this.btnSettingOpenDlFolder.addEventListener('click', () => {
        if (window.electronAPI && typeof window.electronAPI.openDownloadFolder === 'function') {
          window.electronAPI.openDownloadFolder();
        }
      });
    }

    if (this.selectSettingSeek) {
      this.selectSettingSeek.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (window.controlsManager) {
          window.controlsManager.seekInterval = val;
        }
      });
    }

    if (this.selectSettingSpeed) {
      this.selectSettingSpeed.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (this.player && this.player.video) {
          this.player.setPlaybackRate(val);
        }
      });
    }

    // Web section controls
    if (this.btnGoWeb) {
      this.btnGoWeb.addEventListener('click', () => this.navigateWebUrl());
    }
    if (this.inputWebUrl) {
      this.inputWebUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.navigateWebUrl();
      });
    }
    document.querySelectorAll('.web-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        if (url && this.inputWebUrl) {
          this.inputWebUrl.value = url;
          this.navigateWebUrl();
        }
      });
    });

    // Billboard Play Button
    this.btnBillboardPlay.addEventListener('click', () => {
      const cw = this.libraryData.continueWatching;
      if (cw && cw.episodePath) {
        const series = (this.libraryData.seriesList || []).find(s => s.path === cw.seriesPath) || {
          title: cw.title,
          path: cw.seriesPath,
          episodes: [{ name: cw.episodeName, path: cw.episodePath }]
        };
        this.playEpisode(series, cw.episodePath, cw.currentTime);
      } else if (this.libraryData.seriesList && this.libraryData.seriesList.length > 0) {
        const first = this.libraryData.seriesList[0];
        if (first.episodes && first.episodes.length > 0) {
          this.playEpisode(first, first.episodes[0].path, 0);
        }
      } else if (this.libraryData.movies && this.libraryData.movies.length > 0) {
        this.playMovie(this.libraryData.movies[0]);
      }
    });

    // Billboard Info Button
    this.btnBillboardInfo.addEventListener('click', () => {
      const cw = this.libraryData.continueWatching;
      if (cw && cw.seriesPath) {
        const series = (this.libraryData.seriesList || []).find(s => s.path === cw.seriesPath);
        if (series) {
          this.openEpisodesModal(series);
          return;
        }
      }
      if (this.libraryData.seriesList && this.libraryData.seriesList.length > 0) {
        this.openEpisodesModal(this.libraryData.seriesList[0]);
      }
    });

    // Close Episodes Modal
    this.btnCloseEpisodes.addEventListener('click', () => {
      this.closeEpisodesModal();
    });

    this.episodesModal.addEventListener('click', (e) => {
      if (e.target === this.episodesModal) {
        this.closeEpisodesModal();
      }
    });

    // Play All Episodes in modal
    this.btnPlayAllEpisodes.addEventListener('click', () => {
      if (this.selectedAnime && this.selectedAnime.episodes.length > 0) {
        this.closeEpisodesModal();
        this.playEpisode(this.selectedAnime, this.selectedAnime.episodes[0].path, 0);
      }
    });

    // In-Player Playlist Drawer Toggle
    this.btnTogglePlaylist.addEventListener('click', () => {
      this.togglePlaylistDrawer();
      this.btnTogglePlaylist.blur();
    });

    this.btnClosePlaylistDrawer.addEventListener('click', () => {
      this.playlistDrawer.classList.add('hidden');
    });

    // Autoplay Controls
    this.btnCancelAutoplay.addEventListener('click', () => {
      this.cancelAutoplay();
    });

    this.btnPlayNextNow.addEventListener('click', () => {
      this.executeNextEpisode();
    });

    // Video end event for next episode countdown
    window.addEventListener('player:ended', () => {
      this.handleEpisodeEnded();
    });

    // Track watching progress periodically
    let lastSavedTime = 0;
    window.addEventListener('player:timeupdate', (e) => {
      const cur = e.detail.currentTime;
      if (Math.abs(cur - lastSavedTime) >= 2) {
        lastSavedTime = cur;
        if (this.currentEpisodePath) {
          const dur = e.detail.duration;
          const epName = this.currentEpisodeName;
          const seriesPath = this.currentSeries ? this.currentSeries.path : null;
          if (window.electronAPI) {
            window.electronAPI.saveWatchProgress(seriesPath, this.currentEpisodePath, epName, cur, dur);
          }
        } else if (this.currentOnlineAnime) {
          const dur = e.detail.duration;
          if (window.electronAPI && typeof window.electronAPI.saveOnlineProgress === 'function') {
            window.electronAPI.saveOnlineProgress(
              this.currentOnlineAnime.animeSlug,
              this.currentOnlineAnime.animeTitle,
              this.currentOnlineAnime.episodeUrl,
              this.currentOnlineAnime.episodeTitle,
              cur,
              dur,
              this.currentOnlineAnime.poster
            );
            if (window.otakudesuManager) {
              window.otakudesuManager.refreshOnlineHistory();
            }
          }
        }
      }
    });
  }

  async scanAndRender() {
    if (window.electronAPI) {
      window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: true } }));
      try {
        this.libraryData = await window.electronAPI.scanLibrary();
      } catch (e) {
        console.error('Failed to scan library:', e);
      } finally {
        window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: false } }));
      }
    }
    this.render();
  }

  render() {
    const rootPath = this.libraryData.libraryPath || 'Pilih Folder Film & Series';
    const folderShort = rootPath.split(/[\\/]/).pop() || rootPath;
    this.libraryFolderText.textContent = `Folder: ${folderShort}`;
    this.libraryFolderText.title = rootPath;

    this.renderBillboard();
    this.renderRows();
  }

  async switchNavTab(tabName) {
    this.activeNav = tabName;
    if (this.tabHome) this.tabHome.classList.toggle('active', tabName === 'home');
    if (this.tabWeb) this.tabWeb.classList.toggle('active', tabName === 'web');
    if (this.tabDownloads) this.tabDownloads.classList.toggle('active', tabName === 'downloads');
    if (this.tabSettings) this.tabSettings.classList.toggle('active', tabName === 'settings');

    // Sembunyikan semua section terlebih dahulu
    if (this.netflixContent) this.netflixContent.classList.add('hidden');
    if (this.webSection) this.webSection.classList.add('hidden');
    if (this.downloadsSection) this.downloadsSection.classList.add('hidden');
    if (this.settingsSection) this.settingsSection.classList.add('hidden');
    if (this.folderActionGroup) this.folderActionGroup.classList.add('hidden');

    if (tabName === 'home') {
      if (this.netflixContent) this.netflixContent.classList.remove('hidden');
      if (this.folderActionGroup) this.folderActionGroup.classList.remove('hidden');
      // Reset filter pencarian lokal jika sebelumnya user mengetik di tab web
      this.searchQuery = '';
      if (this.inputSearchAnime) this.inputSearchAnime.value = '';
      if (window.otakudesuManager) window.otakudesuManager.onTabDeactivated();
      await this.scanAndRender();
    } else if (tabName === 'web') {
      if (this.webSection) this.webSection.classList.remove('hidden');
      if (window.otakudesuManager) window.otakudesuManager.onTabActivated();
    } else if (tabName === 'downloads') {
      if (this.downloadsSection) this.downloadsSection.classList.remove('hidden');
      if (window.otakudesuManager) {
        window.otakudesuManager.onTabDeactivated();
        window.otakudesuManager.renderDedicatedDownloadsTab();
      }
    } else if (tabName === 'settings') {
      if (this.settingsSection) this.settingsSection.classList.remove('hidden');
      if (window.otakudesuManager) window.otakudesuManager.onTabDeactivated();
      await this.renderSettingsTab();
    }
  }

  async renderSettingsTab() {
    const curMedia = (this.libraryData && this.libraryData.libraryPath) || 'Belum dipilih';
    if (this.settingMediaFolderPath) {
      this.settingMediaFolderPath.textContent = curMedia;
      this.settingMediaFolderPath.title = curMedia;
    }

    if (window.electronAPI && typeof window.electronAPI.getDownloadPath === 'function') {
      try {
        const curDl = await window.electronAPI.getDownloadPath();
        if (this.settingDownloadFolderPath) {
          this.settingDownloadFolderPath.textContent = curDl || 'Folder Media Video Player';
          this.settingDownloadFolderPath.title = curDl || '';
        }
      } catch (e) {
        console.warn('Gagal memuat setting download path:', e);
      }
    }

    if (this.selectSettingSeek && window.controlsManager) {
      this.selectSettingSeek.value = (window.controlsManager.seekInterval || 10).toString();
    }
  }

  navigateWebUrl() {
    if (!this.inputWebUrl) return;
    let raw = this.inputWebUrl.value.trim();
    if (!raw) return;

    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
      this.inputWebUrl.value = raw;
    }

    if (this.webIframe) {
      this.webIframe.src = raw;
      if (this.webPlaceholder) this.webPlaceholder.classList.add('hidden');
    }
  }

  renderBillboard() {
    const cw = this.libraryData.continueWatching;

    if (cw && cw.episodePath) {
      this.billboardTitle.textContent = cw.title;
      this.billboardDesc.textContent = `${cw.episodeName} • Sedang Ditonton`;

      const dur = cw.duration || 0;
      const cur = cw.currentTime || 0;
      const pct = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0;

      this.billboardProgressFill.style.width = `${pct}%`;
      this.billboardProgressText.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)} (${pct}%)`;

      // Extract exact frame where the user left off for billboard backdrop
      const encodedEp = encodeURIComponent(cw.episodePath);
      const timeSec = Math.floor(cur);
      const heroThumb = `http://127.0.0.1:${this.player.serverPort}/thumbnail?path=${encodedEp}&time=${timeSec}&width=1280`;
      if (this.billboardBackdrop) {
        this.billboardBackdrop.style.backgroundImage = `url("${heroThumb}")`;
        this.billboardBackdrop.style.backgroundSize = 'cover';
        this.billboardBackdrop.style.backgroundPosition = 'center';
      }

      this.billboardSection.classList.remove('hidden');
    } else if (this.libraryData.seriesList && this.libraryData.seriesList.length > 0) {
      const first = this.libraryData.seriesList[0];
      this.billboardTitle.textContent = first.title;
      this.billboardDesc.textContent = `${first.episodesCount} Episode tersedia`;
      this.billboardProgressFill.style.width = '0%';
      this.billboardProgressText.textContent = 'Mulai Menonton';

      if (first.episodes && first.episodes.length > 0) {
        const encodedEp = encodeURIComponent(first.episodes[0].path);
        const heroThumb = `http://127.0.0.1:${this.player.serverPort}/thumbnail?path=${encodedEp}&width=1280`;
        if (this.billboardBackdrop) {
          this.billboardBackdrop.style.backgroundImage = `url("${heroThumb}")`;
          this.billboardBackdrop.style.backgroundSize = 'cover';
          this.billboardBackdrop.style.backgroundPosition = 'center';
        }
      }

      this.billboardSection.classList.remove('hidden');
    } else if (this.libraryData.movies && this.libraryData.movies.length > 0) {
      const first = this.libraryData.movies[0];
      this.billboardTitle.textContent = first.title;
      this.billboardDesc.textContent = 'Film Tunggal';
      this.billboardProgressFill.style.width = '0%';
      this.billboardProgressText.textContent = 'Mulai Menonton';
      this.billboardSection.classList.remove('hidden');
    } else {
      this.billboardSection.classList.add('hidden');
    }
  }

  renderRows() {
    const query = this.searchQuery;
    const seriesList = (this.libraryData.seriesList || []).filter(s => {
      if (!query) return true;
      return s.title.toLowerCase().includes(query);
    });

    const moviesList = (this.libraryData.movies || []).filter(m => {
      if (!query) return true;
      return m.title.toLowerCase().includes(query);
    });

    const cw = this.libraryData.continueWatching;
    const hasAnyContent = seriesList.length > 0 || moviesList.length > 0;

    if (!hasAnyContent) {
      this.galleryEmpty.classList.remove('hidden');
      this.rowContinue.classList.add('hidden');
      if (this.rowMedia) this.rowMedia.classList.add('hidden');
      return;
    }

    this.galleryEmpty.classList.add('hidden');

    // 1. Continue Watching Row (displays frame from last watched position)
    if (cw && cw.episodePath && !query) {
      this.rowContinue.classList.remove('hidden');
      this.sliderContinue.innerHTML = '';

      const encodedEp = encodeURIComponent(cw.episodePath);
      const timeSec = Math.floor(cw.currentTime || 0);
      const lastWatchedThumb = `http://127.0.0.1:${this.player.serverPort}/thumbnail?path=${encodedEp}&time=${timeSec}`;

      const card = this.createNetflixCard({
        title: cw.title,
        subtitle: cw.episodeName,
        badgeText: 'Lanjutkan',
        customThumb: lastWatchedThumb,
        progressPct: cw.duration > 0 ? (cw.currentTime / cw.duration) * 100 : 0,
        onClick: () => {
          const s = (this.libraryData.seriesList || []).find(item => item.path === cw.seriesPath);
          this.playEpisode(s, cw.episodePath, cw.currentTime);
        }
      });
      this.sliderContinue.appendChild(card);
    } else {
      this.rowContinue.classList.add('hidden');
    }

    // 2. Unified Media & Anime Collection
    const allMedia = [];
    seriesList.forEach(series => {
      allMedia.push({
        title: series.title,
        subtitle: `${series.episodesCount} Episode`,
        badgeText: `${series.episodesCount} Eps`,
        posterPath: series.posterPath,
        onClick: () => this.openEpisodesModal(series)
      });
    });

    moviesList.forEach(movie => {
      const progressPct = movie.duration > 0 ? (movie.currentTime / movie.duration) * 100 : 0;
      allMedia.push({
        title: movie.title,
        subtitle: 'Film',
        badgeText: 'Film',
        posterPath: movie.path,
        progressPct,
        onClick: () => this.playMovie(movie)
      });
    });

    if (allMedia.length > 0) {
      if (this.rowMedia) this.rowMedia.classList.remove('hidden');
      if (this.sliderMedia) {
        this.sliderMedia.innerHTML = '';
        allMedia.forEach(item => {
          const card = this.createNetflixCard(item);
          this.sliderMedia.appendChild(card);
        });
      }
      if (this.rowMediaTitle) {
        this.rowMediaTitle.textContent = query ? `Hasil Pencarian ("${query}")` : 'Koleksi Video & Anime';
      }
    } else {
      if (this.rowMedia) this.rowMedia.classList.add('hidden');
    }
  }

  createNetflixCard({ title, subtitle, badgeText, posterPath, customThumb, progressPct = 0, onClick }) {
    const card = document.createElement('div');
    card.className = 'netflix-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', title);

    let thumbHtml = '';
    if (customThumb) {
      thumbHtml = `<img class="netflix-card-poster" src="${customThumb}" alt="${title}" loading="lazy" onerror="this.style.opacity='0.4'">`;
    } else if (posterPath) {
      const ext = posterPath.split('.').pop().toLowerCase();
      const isImg = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext);
      const endpoint = isImg ? 'file' : 'thumbnail';
      const encodedPoster = encodeURIComponent(posterPath);
      thumbHtml = `<img class="netflix-card-poster" src="http://127.0.0.1:${this.player.serverPort}/${endpoint}?path=${encodedPoster}" alt="${title}" loading="lazy" onerror="this.style.opacity='0.4'">`;
    } else {
      const initials = title.slice(0, 2).toUpperCase();
      thumbHtml = `
        <div class="netflix-card-placeholder">
          <span class="netflix-card-initials">${initials}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="netflix-card-thumb">
        ${thumbHtml}
        <div class="netflix-play-hover">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff"><path d="M8 5v14l11-7z"/></svg>
        </div>
        ${badgeText ? `<span class="netflix-card-badge">${badgeText}</span>` : ''}
        ${progressPct > 0 ? `
          <div class="netflix-card-progress">
            <div class="netflix-card-progress-fill" style="width: ${Math.min(100, Math.round(progressPct))}%"></div>
          </div>
        ` : ''}
      </div>
      <div class="netflix-card-body">
        <div class="netflix-card-title">${title}</div>
        <div class="netflix-card-sub">${subtitle || ''}</div>
      </div>
    `;

    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    });

    return card;
  }

  openEpisodesModal(series) {
    this.selectedAnime = series;
    this.episodesAnimeTitle.textContent = series.title;

    if (this.episodesCountBadge) {
      this.episodesCountBadge.textContent = `${series.episodesCount} Episode`;
    }

    if (this.episodesWatchedStatus) {
      this.episodesWatchedStatus.textContent = series.lastWatched ? 'Sedang Ditonton' : 'Tersedia Lengkap';
    }

    // Set Hero Backdrop in modal from poster or episode 1 thumbnail
    if (this.episodesHeroBackdrop) {
      const backdropSrc = series.posterPath || (series.episodes[0] ? series.episodes[0].path : null);
      if (backdropSrc) {
        const ext = backdropSrc.split('.').pop().toLowerCase();
        const isImg = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext);
        const endpoint = isImg ? 'file' : 'thumbnail';
        const encoded = encodeURIComponent(backdropSrc);
        this.episodesHeroBackdrop.style.backgroundImage = `url('http://127.0.0.1:${this.player.serverPort}/${endpoint}?path=${encoded}')`;
      } else {
        this.episodesHeroBackdrop.style.backgroundImage = 'none';
      }
    }

    // Set Putar button text
    if (this.btnPlayAllText) {
      let label = 'Putar Episode 1';
      if (series.lastWatched && series.lastWatched.lastEpisodePath) {
        const lastEp = series.episodes.find(e => e.path === series.lastWatched.lastEpisodePath);
        if (lastEp) {
          label = `Lanjutkan: ${lastEp.name}`;
        }
      }
      this.btnPlayAllText.textContent = label;
    }

    this.episodesList.innerHTML = '';

    series.episodes.forEach((ep, idx) => {
      const card = document.createElement('div');
      card.className = 'episode-gallery-card episode-item';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', ep.name);

      const isCurrent = this.currentEpisodePath === ep.path;
      if (isCurrent) card.classList.add('playing');

      const progressPct = ep.duration > 0 ? Math.min(100, Math.round((ep.currentTime / ep.duration) * 100)) : 0;
      const encodedEp = encodeURIComponent(ep.path);
      const thumbUrl = `http://127.0.0.1:${this.player.serverPort}/thumbnail?path=${encodedEp}`;

      card.innerHTML = `
        <div class="ep-gallery-thumb-container">
          <img class="ep-gallery-thumb-img" src="${thumbUrl}" alt="${ep.name}" loading="lazy" onerror="this.style.display='none'">
          <div class="ep-gallery-overlay">
            <div class="ep-gallery-play-btn">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          ${ep.duration > 0 ? `<span class="ep-gallery-duration">${this.formatTime(ep.duration)}</span>` : ''}
          ${progressPct > 0 ? `
            <div class="ep-gallery-progress-bar">
              <div class="ep-gallery-progress-fill" style="width: ${progressPct}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="ep-gallery-info">
          <div class="ep-gallery-header-row">
            <span class="ep-gallery-number">${idx + 1}.</span>
            <span class="ep-gallery-title episode-title-text">${ep.name}</span>
          </div>
        </div>
      `;

      const onSelect = () => {
        this.closeEpisodesModal();
        const startSec = ep.completed ? 0 : (ep.currentTime || 0);
        this.playEpisode(series, ep.path, startSec);
      };

      card.addEventListener('click', onSelect);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      });

      this.episodesList.appendChild(card);
    });

    this.episodesModal.classList.remove('hidden');
  }

  closeEpisodesModal() {
    this.episodesModal.classList.add('hidden');
  }

  async playMovie(movie) {
    this.currentSeries = null;
    this.currentEpisodePath = movie.path;
    this.currentEpisodeName = movie.name;

    this.showPlayerView();
    if (window.controlsManager && typeof window.controlsManager.setTopBarInfo === 'function') {
      window.controlsManager.setTopBarInfo(movie.title || movie.name, '');
    }
    await this.player.loadFile(movie.path);

    if (movie.currentTime > 0 && !movie.completed) {
      setTimeout(() => {
        this.player.seek(movie.currentTime);
      }, 150);
    }
  }

  async playEpisode(series, episodePath, startSeconds = 0) {
    this.currentSeries = series;
    this.currentEpisodePath = episodePath;
    this.currentEpisodeName = episodePath.split(/[\\/]/).pop();

    this.showPlayerView();
    if (window.controlsManager && typeof window.controlsManager.setTopBarInfo === 'function') {
      window.controlsManager.setTopBarInfo(series ? series.title : '', this.currentEpisodeName);
    }
    await this.player.loadFile(episodePath);

    if (startSeconds > 0) {
      setTimeout(() => {
        this.player.seek(startSeconds);
      }, 150);
    }

    this.renderInPlayerPlaylist();
  }

  showGalleryView() {
    this.galleryView.classList.remove('hidden');
    this.playerView.classList.add('hidden');
    if (this.btnBackToGallery) this.btnBackToGallery.classList.add('hidden');

    const titleEl = document.getElementById('videoTitleDisplay');
    if (titleEl) titleEl.textContent = '';
    const badge = document.getElementById('codecBadge');
    if (badge) badge.classList.add('hidden');
    document.title = 'Player';

    // Unlock player if it was locked
    if (window.controlsManager && typeof window.controlsManager.setLock === 'function') {
      window.controlsManager.setLock(false);
    }

    // Cancel autoplay timer and stop playback completely
    this.cancelAutoplay();
    this.player.stop();

    if (this.currentOnlineAnime) {
      this.switchNavTab('web');
      this.currentOnlineAnime = null;
    } else {
      this.scanAndRender();
    }
  }

  showPlayerView() {
    this.galleryView.classList.add('hidden');
    this.playerView.classList.remove('hidden');
    if (this.btnBackToGallery) this.btnBackToGallery.classList.remove('hidden');
    if (this.btnPlayerBack) this.btnPlayerBack.classList.remove('hidden');
  }

  setOnlinePlaylist(data) {
    this.currentSeries = null;
    this.currentEpisodePath = null;
    this.currentOnlinePlaylist = data; // { animeDetail, currentEpisode, onSelectEpisode }
  }

  togglePlaylistDrawer() {
    this.playlistDrawer.classList.toggle('hidden');
    if (!this.playlistDrawer.classList.contains('hidden')) {
      this.renderInPlayerPlaylist();
    }
  }

  renderInPlayerPlaylist() {
    // 1. Jika sedang memutar Anime Online Streaming dari Web
    if (this.currentOnlinePlaylist && this.currentOnlinePlaylist.animeDetail) {
      const detail = this.currentOnlinePlaylist.animeDetail;
      const currentEp = this.currentOnlinePlaylist.currentEpisode;
      this.playlistDrawerTitle.textContent = detail.title;
      this.playlistDrawerBody.innerHTML = '';

      const episodes = detail.episodes || [];
      if (episodes.length === 0) {
        this.playlistDrawerBody.innerHTML = '<div style="padding: 12px; color: var(--text-muted);">Tidak ada daftar episode untuk anime ini.</div>';
        return;
      }

      episodes.forEach(ep => {
        const isCurrent = currentEp && (ep.url === currentEp.url || ep.slug === currentEp.slug);
        const item = document.createElement('div');
        item.className = `episode-item ${isCurrent ? 'playing' : ''}`;
        item.innerHTML = `
          <div class="episode-item-left">
            <div class="episode-icon">
              ${isCurrent 
                ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' 
                : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}
            </div>
            <div class="episode-item-info">
              <span class="episode-title-text">${ep.title}</span>
              ${ep.date ? `<span class="episode-date-text" style="font-size: 11px; color: var(--text-muted);">${ep.date}</span>` : ''}
            </div>
          </div>
          ${isCurrent ? '<span class="episode-badge-now" style="font-size: 10px; background: rgba(229, 9, 20, 0.2); color: var(--accent-red); padding: 2px 8px; border-radius: 10px; font-weight: 600;">Diputar</span>' : ''}
        `;

        item.addEventListener('click', () => {
          if (this.currentOnlinePlaylist && typeof this.currentOnlinePlaylist.onSelectEpisode === 'function') {
            this.currentOnlinePlaylist.currentEpisode = ep;
            this.currentOnlinePlaylist.onSelectEpisode(ep);
            this.renderInPlayerPlaylist();
          }
        });

        this.playlistDrawerBody.appendChild(item);
      });
      return;
    }

    // 2. Jika memutar Serial Lokal
    if (!this.currentSeries) {
      this.playlistDrawerBody.innerHTML = '<div style="padding: 12px; color: var(--text-muted);">Tidak ada daftar putar aktif.</div>';
      return;
    }

    this.playlistDrawerTitle.textContent = this.currentSeries.title;
    this.playlistDrawerBody.innerHTML = '';

    this.currentSeries.episodes.forEach(ep => {
      const isCurrent = ep.path === this.currentEpisodePath;
      const item = document.createElement('div');
      item.className = `episode-item ${isCurrent ? 'playing' : ''}`;
      item.innerHTML = `
        <div class="episode-item-left">
          <div class="episode-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span class="episode-title-text">${ep.name}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        this.playEpisode(this.currentSeries, ep.path, 0);
      });

      this.playlistDrawerBody.appendChild(item);
    });
  }

  handleEpisodeEnded() {
    const isAutoplayOn = localStorage.getItem('vidplayer_autoplay') !== 'false';
    if (!isAutoplayOn) return;

    // 1. Jika streaming anime online
    if (this.currentOnlinePlaylist && this.currentOnlinePlaylist.animeDetail) {
      const episodes = this.currentOnlinePlaylist.animeDetail.episodes || [];
      const currentEp = this.currentOnlinePlaylist.currentEpisode;
      const nextEpisode = this.findNextOnlineEpisode(episodes, currentEp);
      if (nextEpisode) {
        this.playInstantNextEpisode(nextEpisode, true);
      }
      return;
    }

    // 2. Jika serial lokal
    if (!this.currentSeries || !this.currentSeries.episodes) return;

    const episodes = this.currentSeries.episodes;
    const currentIndex = episodes.findIndex(ep => ep.path === this.currentEpisodePath);

    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      const nextEpisode = episodes[currentIndex + 1];
      this.playInstantNextEpisode(nextEpisode, false);
    }
  }

  playInstantNextEpisode(nextEpisode, isOnline = false) {
    if (!nextEpisode) return;
    this.cancelAutoplay();

    if (isOnline && this.currentOnlinePlaylist && typeof this.currentOnlinePlaylist.onSelectEpisode === 'function') {
      this.currentOnlinePlaylist.currentEpisode = nextEpisode;
      this.currentOnlinePlaylist.onSelectEpisode(nextEpisode);
      this.renderInPlayerPlaylist();
    } else if (this.currentSeries && nextEpisode.path) {
      this.playEpisode(this.currentSeries, nextEpisode.path, 0);
    }
  }

  startNextEpisodeCountdown(nextEpisode, isOnline = false) {
    // Backward compatibility: langsung eksekusi instan tanpa cooldown
    this.playInstantNextEpisode(nextEpisode, isOnline);
  }

  cancelAutoplay() {
    clearInterval(this.autoplayCountdownTimer);
    this.nextAutoplayToast.classList.add('hidden');
    this.pendingNextEpisode = null;
    this.isPendingNextEpisodeOnline = false;
  }

  executeNextEpisode() {
    if (this.pendingNextEpisode) {
      const next = this.pendingNextEpisode;
      const isOnline = this.isPendingNextEpisodeOnline;
      this.cancelAutoplay();

      if (isOnline && this.currentOnlinePlaylist && typeof this.currentOnlinePlaylist.onSelectEpisode === 'function') {
        this.currentOnlinePlaylist.currentEpisode = next;
        this.currentOnlinePlaylist.onSelectEpisode(next);
        this.renderInPlayerPlaylist();
      } else if (this.currentSeries) {
        this.playEpisode(this.currentSeries, next.path, 0);
      }
    }
  }

  formatTime(totalSec) {
    if (isNaN(totalSec) || totalSec <= 0) return '0:00';
    const secNum = Math.floor(totalSec);
    const hours = Math.floor(secNum / 3600);
    const minutes = Math.floor((secNum % 3600) / 60);
    const seconds = secNum % 60;
    const formattedSec = seconds < 10 ? `0${seconds}` : `${seconds}`;
    if (hours > 0) {
      const formattedMin = minutes < 10 ? `0${minutes}` : `${minutes}`;
      return `${hours}:${formattedMin}:${formattedSec}`;
    }
    return `${minutes}:${formattedSec}`;
  }
}

window.libraryManager = new LibraryManager(window.playerCore);
