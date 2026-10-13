/**
 * Anime Library & Gallery Controller
 * Manages anime collections, episode playlists, continue watching resume,
 * folder scanning, and view switching between Gallery and Video Player.
 */
class LibraryManager {
  constructor(player) {
    this.player = player;
    this.libraryData = { libraryPath: '', animeList: [], continueWatching: null };
    this.selectedAnime = null;
    this.searchQuery = '';
    this.autoplayCountdownTimer = null;
    this.autoplaySecondsLeft = 5;

    // View Containers
    this.galleryView = document.getElementById('galleryView');
    this.playerView = document.getElementById('playerView');

    // Gallery Toolbar
    this.btnBackToGallery = document.getElementById('btnBackToGallery');
    this.btnChooseFolder = document.getElementById('btnChooseFolder');
    this.libraryFolderText = document.getElementById('libraryFolderText');
    this.btnRefreshLibrary = document.getElementById('btnRefreshLibrary');
    this.inputSearchAnime = document.getElementById('inputSearchAnime');

    // Hero Continue Watching
    this.continueHero = document.getElementById('continueHero');
    this.continueTitle = document.getElementById('continueTitle');
    this.continueEpisode = document.getElementById('continueEpisode');
    this.continueProgressFill = document.getElementById('continueProgressFill');
    this.continueTimeText = document.getElementById('continueTimeText');
    this.btnContinuePlay = document.getElementById('btnContinuePlay');

    // Anime Grid
    this.animeGrid = document.getElementById('animeGrid');
    this.galleryEmpty = document.getElementById('galleryEmpty');

    // Episodes Modal
    this.episodesModal = document.getElementById('episodesModal');
    this.episodesAnimeTitle = document.getElementById('episodesAnimeTitle');
    this.episodesList = document.getElementById('episodesList');
    this.btnCloseEpisodes = document.getElementById('btnCloseEpisodes');
    this.btnPlayAllEpisodes = document.getElementById('btnPlayAllEpisodes');

    // In-Player Playlist Drawer & Next Autoplay
    this.playlistDrawer = document.getElementById('playlistDrawer');
    this.playlistDrawerTitle = document.getElementById('playlistDrawerTitle');
    this.playlistDrawerBody = document.getElementById('playlistDrawerBody');
    this.btnClosePlaylistDrawer = document.getElementById('btnClosePlaylistDrawer');
    this.btnTogglePlaylist = document.getElementById('btnTogglePlaylist');

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

    // Search Anime
    this.inputSearchAnime.addEventListener('input', (e) => {
      this.searchQuery = (e.target.value || '').toLowerCase().trim();
      this.renderAnimeGrid();
    });

    // Continue Watching Play Button
    this.btnContinuePlay.addEventListener('click', () => {
      const cw = this.libraryData.continueWatching;
      if (cw && cw.episodePath) {
        // Find corresponding anime in libraryData
        const anime = this.libraryData.animeList.find(a => a.path === cw.animePath) || {
          title: cw.animeTitle,
          path: cw.animePath,
          episodes: [{ name: cw.episodeName, path: cw.episodePath }]
        };

        this.playEpisode(anime, cw.episodePath, cw.currentTime);
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

    // Play All in Episodes Modal
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

    // Listen to player video end for auto-advancing to next episode
    window.addEventListener('player:ended', () => {
      this.handleEpisodeEnded();
    });

    // Track watching progress periodically (every 2 seconds while playing)
    let lastSavedTime = 0;
    window.addEventListener('player:timeupdate', (e) => {
      const cur = e.detail.currentTime;
      if (Math.abs(cur - lastSavedTime) >= 2) {
        lastSavedTime = cur;
        if (this.currentAnime && this.currentEpisodePath) {
          const dur = e.detail.duration;
          const epName = this.currentEpisodeName;
          if (window.electronAPI) {
            window.electronAPI.saveWatchProgress(
              this.currentAnime.path,
              this.currentEpisodePath,
              epName,
              cur,
              dur
            );
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
        console.error('Failed to scan anime library:', e);
      } finally {
        window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: false } }));
      }
    }
    this.render();
  }

  render() {
    const rootPath = this.libraryData.libraryPath || 'Pilih Folder Anime';
    const folderShort = rootPath.split(/[\\/]/).pop() || rootPath;
    this.libraryFolderText.textContent = `Folder: ${folderShort}`;
    this.libraryFolderText.title = rootPath;

    this.renderContinueWatching();
    this.renderAnimeGrid();
  }

  renderContinueWatching() {
    const cw = this.libraryData.continueWatching;
    if (cw && cw.episodePath) {
      this.continueTitle.textContent = cw.animeTitle;
      this.continueEpisode.textContent = cw.episodeName;

      const dur = cw.duration || 0;
      const cur = cw.currentTime || 0;
      const pct = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0;

      this.continueProgressFill.style.width = `${pct}%`;
      this.continueTimeText.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)} (${pct}%)`;

      this.continueHero.classList.remove('hidden');
    } else {
      this.continueHero.classList.add('hidden');
    }
  }

  renderAnimeGrid() {
    this.animeGrid.innerHTML = '';
    const query = this.searchQuery;

    const filtered = (this.libraryData.animeList || []).filter(anime => {
      if (!query) return true;
      return anime.title.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      this.galleryEmpty.classList.remove('hidden');
      return;
    }

    this.galleryEmpty.classList.add('hidden');

    filtered.forEach(anime => {
      const card = document.createElement('div');
      card.className = 'anime-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Buka anime ${anime.title}`);

      // Poster or placeholder
      let thumbContent = '';
      if (anime.posterPath) {
        const encodedPoster = encodeURIComponent(anime.posterPath);
        thumbContent = `<img class="anime-card-poster" src="http://127.0.0.1:${this.player.serverPort}/file?path=${encodedPoster}" alt="${anime.title}">`;
      } else {
        const initials = anime.title.slice(0, 2).toUpperCase();
        thumbContent = `
          <div class="anime-card-placeholder">
            <span class="anime-card-initials">${initials}</span>
          </div>
        `;
      }

      const lastEpText = anime.lastWatched ? `Terakhir: ${anime.lastWatched.episodeName}` : `${anime.episodesCount} Episode`;

      card.innerHTML = `
        <div class="anime-card-thumb">
          ${thumbContent}
          <span class="anime-episodes-badge">${anime.episodesCount} Eps</span>
        </div>
        <div class="anime-card-body">
          <div class="anime-card-title">${anime.title}</div>
          <div class="anime-card-sub">${lastEpText}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.openEpisodesModal(anime);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openEpisodesModal(anime);
        }
      });

      this.animeGrid.appendChild(card);
    });
  }

  openEpisodesModal(anime) {
    this.selectedAnime = anime;
    this.episodesAnimeTitle.textContent = anime.title;
    this.episodesList.innerHTML = '';

    anime.episodes.forEach((ep, idx) => {
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
        this.playEpisode(anime, ep.path, startSec);
      });

      this.episodesList.appendChild(item);
    });

    this.episodesModal.classList.remove('hidden');
  }

  closeEpisodesModal() {
    this.episodesModal.classList.add('hidden');
  }

  async playEpisode(anime, episodePath, startSeconds = 0) {
    this.currentAnime = anime;
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
    document.getElementById('videoTitleDisplay').textContent = 'Galeri Anime';

    // Pause video when leaving player
    if (!this.player.video.paused) {
      this.player.video.pause();
    }

    // Refresh gallery and continue watching
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
    if (!this.currentAnime) {
      this.playlistDrawerBody.innerHTML = '<div style="padding: 12px; color: var(--text-muted);">Tidak ada daftar putar anime aktif.</div>';
      return;
    }

    this.playlistDrawerTitle.textContent = this.currentAnime.title;
    this.playlistDrawerBody.innerHTML = '';

    this.currentAnime.episodes.forEach(ep => {
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
        this.playEpisode(this.currentAnime, ep.path, 0);
      });

      this.playlistDrawerBody.appendChild(item);
    });
  }

  handleEpisodeEnded() {
    if (!this.currentAnime || !this.currentAnime.episodes) return;

    const episodes = this.currentAnime.episodes;
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
      this.playEpisode(this.currentAnime, next.path, 0);
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
