const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.webm', '.mov', '.ts', '.flv', '.wmv', '.m4v'
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp'
]);

class LibraryService {
  constructor() {
    this.userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../');
    this.configFile = path.join(this.userDataPath, 'library_config.json');
    this.historyFile = path.join(this.userDataPath, 'watch_history.json');

    this.libraryPath = this.loadLibraryPath();
    this.downloadPath = this.loadDownloadPath();
    this.history = this.loadHistory();
  }

  loadLibraryPath() {
    try {
      if (fs.existsSync(this.configFile)) {
        const text = fs.readFileSync(this.configFile, 'utf-8').trim();
        if (text) {
          const data = JSON.parse(text);
          if (data.libraryPath && fs.existsSync(data.libraryPath)) {
            return data.libraryPath;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading library config:', e.message);
    }

    const defaultAnime = path.join(process.cwd(), 'anime');
    if (!fs.existsSync(defaultAnime)) {
      try {
        fs.mkdirSync(defaultAnime, { recursive: true });
      } catch (err) {}
    }
    return defaultAnime;
  }

  setLibraryPath(newPath) {
    if (!newPath || !fs.existsSync(newPath)) {
      throw new Error('Folder library tidak ditemukan');
    }
    this.libraryPath = newPath;
    try {
      let config = {};
      if (fs.existsSync(this.configFile)) {
        try { config = JSON.parse(fs.readFileSync(this.configFile, 'utf-8')); } catch (e) {}
      }
      config.libraryPath = newPath;
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    } catch (e) {
      console.error('Error saving library config:', e);
    }
    return this.libraryPath;
  }

  getLibraryPath() {
    return this.libraryPath;
  }

  loadDownloadPath() {
    try {
      if (fs.existsSync(this.configFile)) {
        const text = fs.readFileSync(this.configFile, 'utf-8').trim();
        if (text) {
          const data = JSON.parse(text);
          if (data.downloadPath && fs.existsSync(data.downloadPath)) {
            return data.downloadPath;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading download config:', e.message);
    }
    return this.libraryPath;
  }

  setDownloadPath(newPath) {
    if (!newPath || !fs.existsSync(newPath)) {
      throw new Error('Folder download tidak ditemukan');
    }
    this.downloadPath = newPath;
    try {
      let config = {};
      if (fs.existsSync(this.configFile)) {
        try { config = JSON.parse(fs.readFileSync(this.configFile, 'utf-8')); } catch (e) {}
      }
      config.downloadPath = newPath;
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
    } catch (e) {
      console.error('Error saving download config:', e);
    }
    return this.downloadPath;
  }

  getDownloadPath() {
    return this.downloadPath || this.libraryPath;
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const text = fs.readFileSync(this.historyFile, 'utf-8').trim();
        if (text) {
          const parsed = JSON.parse(text);
          if (!parsed.onlineHistory) parsed.onlineHistory = {};
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading watch history:', e.message);
    }
    return {
      seriesList: {},
      episodes: {},
      onlineHistory: {}
    };
  }

  saveProgress(seriesPath, episodePath, episodeName, currentTime, duration) {
    if (!episodePath) return;

    const now = Date.now();
    const completed = duration > 0 ? (currentTime / duration >= 0.92) : false;

    if (!this.history.episodes) this.history.episodes = {};
    this.history.episodes[episodePath] = {
      currentTime,
      duration,
      completed,
      lastWatched: now
    };

    if (seriesPath) {
      if (!this.history.seriesList) this.history.seriesList = {};
      this.history.seriesList[seriesPath] = {
        lastEpisodePath: episodePath,
        episodeName: episodeName || path.basename(episodePath),
        currentTime,
        duration,
        lastWatched: now
      };
    }

    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('Error saving watch history:', e);
    }
  }

  saveOnlineProgress(animeSlug, animeTitle, episodeUrl, episodeTitle, currentTime, duration, poster = null) {
    if (!animeSlug || !episodeUrl) return;
    const now = Date.now();
    const completed = duration > 0 ? (currentTime / duration >= 0.90) : false;

    if (!this.history.onlineHistory) this.history.onlineHistory = {};
    if (!this.history.onlineHistory[animeSlug]) {
      this.history.onlineHistory[animeSlug] = {
        animeSlug,
        animeTitle: animeTitle || animeSlug,
        poster: poster || null,
        episodes: {}
      };
    }

    const animeEntry = this.history.onlineHistory[animeSlug];
    if (poster && !animeEntry.poster) animeEntry.poster = poster;
    if (animeTitle) animeEntry.animeTitle = animeTitle;
    if (!animeEntry.episodes) animeEntry.episodes = {};

    animeEntry.episodes[episodeUrl] = {
      episodeUrl,
      episodeTitle: episodeTitle || 'Episode',
      currentTime,
      duration,
      completed,
      lastWatched: now
    };

    animeEntry.lastEpisodeUrl = episodeUrl;
    animeEntry.lastEpisodeTitle = episodeTitle;
    animeEntry.currentTime = currentTime;
    animeEntry.duration = duration;
    animeEntry.lastWatched = now;

    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('Error saving online watch history:', e);
    }
  }

  getOnlineHistory() {
    return (this.history && this.history.onlineHistory) || {};
  }

  getContinueWatching() {
    if (!this.history.seriesList && !this.history.episodes) return null;

    let latest = null;
    let latestTime = 0;
    let latestSeriesPath = null;

    if (this.history.seriesList) {
      for (const [seriesPath, info] of Object.entries(this.history.seriesList)) {
        if (info && info.lastWatched > latestTime) {
          if (fs.existsSync(info.lastEpisodePath)) {
            latestTime = info.lastWatched;
            latest = info;
            latestSeriesPath = seriesPath;
          }
        }
      }
    }

    if (this.history.episodes) {
      for (const [epPath, epInfo] of Object.entries(this.history.episodes)) {
        if (epInfo && epInfo.lastWatched > latestTime) {
          if (fs.existsSync(epPath)) {
            latestTime = epInfo.lastWatched;
            latest = {
              lastEpisodePath: epPath,
              episodeName: path.basename(epPath),
              currentTime: epInfo.currentTime || 0,
              duration: epInfo.duration || 0,
              lastWatched: epInfo.lastWatched
            };
            latestSeriesPath = path.dirname(epPath);
          }
        }
      }
    }

    if (!latest) return null;

    return {
      seriesPath: latestSeriesPath,
      title: path.basename(latestSeriesPath),
      episodePath: latest.lastEpisodePath,
      episodeName: latest.episodeName,
      currentTime: latest.currentTime || 0,
      duration: latest.duration || 0,
      lastWatched: latest.lastWatched
    };
  }

  scanLibrary() {
    const rootDir = this.libraryPath;
    if (!fs.existsSync(rootDir)) {
      return { libraryPath: rootDir, seriesList: [], movies: [], animeList: [], continueWatching: null };
    }

    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    const seriesList = [];
    const movies = [];

    // 1. Detect standalone video files directly in root as Movies (Film)
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          const filePath = path.join(rootDir, entry.name);
          const stat = fs.statSync(filePath);
          const epHist = (this.history.episodes && this.history.episodes[filePath]) || null;

          movies.push({
            name: entry.name,
            title: path.parse(entry.name).name,
            path: filePath,
            size: stat.size,
            currentTime: epHist ? epHist.currentTime : 0,
            duration: epHist ? epHist.duration : 0,
            completed: epHist ? epHist.completed : false
          });
        }
      }
    }

    // 2. Detect subdirectories as Series / Anime
    const subfolders = entries.filter(e => e.isDirectory());

    for (const folder of subfolders) {
      const folderPath = path.join(rootDir, folder.name);
      const episodes = [];
      let posterPath = null;

      // Recursive scan of files within subfolder
      this.collectVideosAndPoster(folderPath, episodes, (img) => {
        if (!posterPath) posterPath = img;
      });

      // Natural alphanumeric sort for episodes
      episodes.sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      if (episodes.length > 0) {
        const seriesHist = (this.history.seriesList && this.history.seriesList[folderPath]) || null;
        seriesList.push({
          title: folder.name,
          path: folderPath,
          posterPath: posterPath ? posterPath.replace(/\\/g, '/') : (episodes[0] ? episodes[0].path.replace(/\\/g, '/') : null),
          episodesCount: episodes.length,
          episodes,
          lastWatched: seriesHist || null
        });
      }
    }

    // Natural sort series by title
    seriesList.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    movies.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      libraryPath: rootDir,
      seriesList,
      movies,
      animeList: seriesList, // Backwards compatibility alias
      continueWatching: this.getContinueWatching()
    };
  }

  collectVideosAndPoster(dir, episodes, onPosterFound) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          this.collectVideosAndPoster(fullPath, episodes, onPosterFound);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext)) {
            const stat = fs.statSync(fullPath);
            const epHist = (this.history.episodes && this.history.episodes[fullPath]) || null;
            episodes.push({
              name: item.name,
              title: path.parse(item.name).name,
              path: fullPath,
              size: stat.size,
              currentTime: epHist ? epHist.currentTime : 0,
              duration: epHist ? epHist.duration : 0,
              completed: epHist ? epHist.completed : false
            });
          } else if (IMAGE_EXTENSIONS.has(ext)) {
            onPosterFound(fullPath);
          }
        }
      }
    } catch (err) {
      console.warn(`Error reading dir ${dir}:`, err.message);
    }
  }
}

module.exports = new LibraryService();
