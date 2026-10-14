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

    // Netflix Toolbar
    this.btnChooseFolder = document.getElementById('btnChooseFolder');
    this.libraryFolderText = document.getElementById('libraryFolderText');
    this.btnRefreshLibrary = document.getElementById('btnRefreshLibrary');
    this.inputSearchAnime = document.getElementById('inputSearchAnime');

    // Tabs
    this.tabAll = document.getElementById('tabAll');
    this.tabSeries = document.getElementById('tabSeries');
    this.tabMovies = document.getElementById('tabMovies');

    // Netflix Billboard / Hero
    this.billboardSection = document.getElementById('billboardSection');
    this.billboardTitle = document.getElementById('billboardTitle');
    this.billboardDesc = document.getElementById('billboardDesc');
    this.billboardProgressFill = document.getElementById('billboardProgressFill');
    this.billboardProgressText = document.getElementById('billboardProgressText');
    this.btnBillboardPlay = document.getElementById('btnBillboardPlay');
    this.btnBillboardInfo = document.getElementById('btnBillboardInfo');

    // Netflix Rows Containers
    this.rowContinue = document.getElementById('rowContinue');
    this.sliderContinue = document.getElementById('sliderContinue');

    this.rowSeries = document.getElementById('rowSeries');
    this.sliderSeries = document.getElementById('sliderSeries');

    this.rowMovies = document.getElementById('rowMovies');
    this.sliderMovies = document.getElementById('sliderMovies');

    this.galleryEmpty = document.getElementById('galleryEmpty');

    // Episodes Modal
    this.episodesModal = document.getElementById('episodesModal');
    this.episodesAnimeTitle = document.getElementById('episodesAnimeTitle');
    this.episodesList = document.getElementById('episodesList');
    this.btnCloseEpisodes = document.getElementById('btnCloseEpisodes');
    this.btnPlayAllEpisodes = document.getElementById('btnPlayAllEpisodes');

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

    this.initEvents();
  }

  async init() {
    await this.scanAndRender();
  }

  initEvents() {
    // Back to Gallery button in titlebar
    this.btnBackToGallery.addEventListener('click', () => {
      this.showGalleryView();
    });

    // Brand click returns to Gallery
    const brandEl = document.querySelector('.brand');
    if (brandEl) {
      brandEl.addEventListener('click', () => {
        this.showGalleryView();
      });
    }

    // Choose Library Folder
    this.btnChooseFolder.addEventListener('click', async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.chooseLibraryFolder();
        if (result) {
          this.libraryData = result;
          this.render();
        }
      }
    });

    // Refresh Library
    this.btnRefreshLibrary.addEventListener('click', () => {
      this.scanAndRender();
    });

    // Search
    this.inputSearchAnime.addEventListener('input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase().trim();
      this.renderRows();
    });

    // Category Tabs
    const setTab = (tabName) => {
      this.activeTab = tabName;
      [this.tabAll, this.tabSeries, this.tabMovies].forEach(btn => {
        if (btn) btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      this.renderRows();
    };

    if (this.tabAll) this.tabAll.addEventListener('click', () => setTab('all'));
    if (this.tabSeries) this.tabSeries.addEventListener('click', () => setTab('series'));
    if (this.tabMovies) this.tabMovies.addEventListener('click', () => setTab('movies'));

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

      this.billboardSection.classList.remove('hidden');
    } else if (this.libraryData.seriesList && this.libraryData.seriesList.length > 0) {
      const first = this.libraryData.seriesList[0];
      this.billboardTitle.textContent = first.title;
      this.billboardDesc.textContent = `${first.episodesCount} Episode tersedia`;
      this.billboardProgressFill.style.width = '0%';
      this.billboardProgressText.textContent = 'Mulai Menonton';
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
      this.rowSeries.classList.add('hidden');
      this.rowMovies.classList.add('hidden');
      return;
    }

    this.galleryEmpty.classList.add('hidden');

    // 1. Continue Watching Row
    if (cw && cw.episodePath && this.activeTab === 'all' && !query) {
      this.rowContinue.classList.remove('hidden');
      this.sliderContinue.innerHTML = '';

      const card = this.createNetflixCard({
        title: cw.title,
        subtitle: cw.episodeName,
        badgeText: 'Lanjutkan',
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

    // 2. Series & Anime Row
    if ((this.activeTab === 'all' || this.activeTab === 'series') && seriesList.length > 0) {
      this.rowSeries.classList.remove('hidden');
      this.sliderSeries.innerHTML = '';

      seriesList.forEach(series => {
        const card = this.createNetflixCard({
          title: series.title,
          subtitle: `${series.episodesCount} Episode`,
          badgeText: `${series.episodesCount} Eps`,
          posterPath: series.posterPath,
          onClick: () => this.openEpisodesModal(series)
        });
        this.sliderSeries.appendChild(card);
      });
    } else {
      this.rowSeries.classList.add('hidden');
    }

    // 3. Movies (Film Tunggal) Row
    if ((this.activeTab === 'all' || this.activeTab === 'movies') && moviesList.length > 0) {
      this.rowMovies.classList.remove('hidden');
      this.sliderMovies.innerHTML = '';

      moviesList.forEach(movie => {
        const progressPct = movie.duration > 0 ? (movie.currentTime / movie.duration) * 100 : 0;
        const card = this.createNetflixCard({
          title: movie.title,
          subtitle: 'Film',
          badgeText: 'Film',
          progressPct,
          onClick: () => this.playMovie(movie)
        });
        this.sliderMovies.appendChild(card);
      });
    } else {
      this.rowMovies.classList.add('hidden');
    }
  }

  createNetflixCard({ title, subtitle, badgeText, posterPath, progressPct = 0, onClick }) {
    const card = document.createElement('div');
    card.className = 'netflix-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', title);

    let thumbHtml = '';
    if (posterPath) {
      const encodedPoster = encodeURIComponent(posterPath);
      thumbHtml = `<img class="netflix-card-poster" src="http://127.0.0.1:${this.player.serverPort}/file?path=${encodedPoster}" alt="${title}">`;
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
    this.episodesList.innerHTML = '';

    series.episodes.forEach(ep => {
      const item = document.createElement('div');
      item.className = 'episode-item';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');

      const isCurrent = this.currentEpisodePath === ep.path;
      if (isCurrent) item.classList.add('playing');

      const progressPct = ep.duration > 0 ? Math.min(100, Math.round((ep.currentTime / ep.duration) * 100)) : 0;

      item.innerHTML = `
        <div class="episode-item-left">
          <div class="episode-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <span class="episode-title-text">${ep.name}</span>
        </div>
        <div class="episode-item-right">
          ${progressPct > 0 ? `
            <div class="episode-watched-bar" title="${progressPct}% ditonton">
              <div class="episode-watched-fill" style="width: ${progressPct}%"></div>
            </div>
          ` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        this.closeEpisodesModal();
        const startSec = ep.completed ? 0 : (ep.currentTime || 0);
        this.playEpisode(series, ep.path, startSec);
      });

      this.episodesList.appendChild(item);
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
    this.btnBackToGallery.classList.add('hidden');
    document.getElementById('videoTitleDisplay').textContent = 'XPlayer';

    if (!this.player.video.paused) {
      this.player.video.pause();
    }

    this.scanAndRender();
  }

  showPlayerView() {
    this.galleryView.classList.add('hidden');
    this.playerView.classList.remove('hidden');
    this.btnBackToGallery.classList.remove('hidden');
  }

  togglePlaylistDrawer() {
    this.playlistDrawer.classList.toggle('hidden');
    if (!this.playlistDrawer.classList.contains('hidden')) {
      this.renderInPlayerPlaylist();
    }
  }

  renderInPlayerPlaylist() {
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
    if (!this.currentSeries || !this.currentSeries.episodes) return;

    const episodes = this.currentSeries.episodes;
    const currentIndex = episodes.findIndex(ep => ep.path === this.currentEpisodePath);

    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      const nextEpisode = episodes[currentIndex + 1];
      this.startNextEpisodeCountdown(nextEpisode);
    }
  }

  startNextEpisodeCountdown(nextEpisode) {
    this.pendingNextEpisode = nextEpisode;
    this.autoplaySecondsLeft = 5;
    this.nextAutoplayTitle.textContent = nextEpisode.name;
    this.nextAutoplayToast.classList.remove('hidden');

    clearInterval(this.autoplayCountdownTimer);
    this.autoplayCountdownTimer = setInterval(() => {
      this.autoplaySecondsLeft--;
      if (this.autoplaySecondsLeft <= 0) {
        clearInterval(this.autoplayCountdownTimer);
        this.executeNextEpisode();
      }
    }, 1000);
  }

  cancelAutoplay() {
    clearInterval(this.autoplayCountdownTimer);
    this.nextAutoplayToast.classList.add('hidden');
    this.pendingNextEpisode = null;
  }

  executeNextEpisode() {
    if (this.pendingNextEpisode) {
      const next = this.pendingNextEpisode;
      this.cancelAutoplay();
      this.playEpisode(this.currentSeries, next.path, 0);
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
