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
    this.history = this.loadHistory();
  }

  loadLibraryPath() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
        if (data.libraryPath && fs.existsSync(data.libraryPath)) {
          return data.libraryPath;
        }
      }
    } catch (e) {
      console.warn('Error reading library config:', e.message);
    }

    // Default library path: ./anime in project directory or Videos/Anime
    const defaultLocal = path.join(process.cwd(), 'anime');
    if (!fs.existsSync(defaultLocal)) {
      try {
        fs.mkdirSync(defaultLocal, { recursive: true });
      } catch (err) {}
    }
    return defaultLocal;
  }

  setLibraryPath(newPath) {
    if (!newPath || !fs.existsSync(newPath)) {
      throw new Error('Folder library tidak ditemukan');
    }
    this.libraryPath = newPath;
    try {
      fs.writeFileSync(this.configFile, JSON.stringify({ libraryPath: newPath }, null, 2));
    } catch (e) {
      console.error('Error saving library config:', e);
    }
    return this.libraryPath;
  }

  getLibraryPath() {
    return this.libraryPath;
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf-8'));
      }
    } catch (e) {
      console.warn('Error reading watch history:', e.message);
    }
    return {
      animeList: {}, // animePath -> { lastEpisodePath, episodeName, currentTime, duration, lastWatched }
      episodes: {}   // episodePath -> { currentTime, duration, completed, lastWatched }
    };
  }

  saveProgress(animePath, episodePath, episodeName, currentTime, duration) {
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

    if (animePath) {
      if (!this.history.animeList) this.history.animeList = {};
      this.history.animeList[animePath] = {
        lastEpisodePath: episodePath,
        episodeName: episodeName || path.basename(episodePath),
        currentTime,
        duration,
        lastWatched: now
      };
    }

    // Save to disk asynchronously
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('Error saving watch history:', e);
    }
  }

  getContinueWatching() {
    if (!this.history.animeList) return null;

    let latest = null;
    let latestTime = 0;
    let latestAnimePath = null;

    for (const [animePath, info] of Object.entries(this.history.animeList)) {
      if (info && info.lastWatched > latestTime) {
        if (fs.existsSync(info.lastEpisodePath)) {
          latestTime = info.lastWatched;
          latest = info;
          latestAnimePath = animePath;
        }
      }
    }

    if (!latest) return null;

    return {
      animePath: latestAnimePath,
      animeTitle: path.basename(latestAnimePath),
      episodePath: latest.lastEpisodePath,
      episodeName: latest.episodeName,
      currentTime: latest.currentTime || 0,
      duration: latest.duration || 0,
      lastWatched: latest.lastWatched
    };
  }

  getHistory() {
    return this.history;
  }

  scanLibrary() {
    const rootDir = this.libraryPath;
    if (!fs.existsSync(rootDir)) {
      return { libraryPath: rootDir, animeList: [] };
    }

    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const animeFolders = entries.filter(e => e.isDirectory());

    const animeList = [];

    for (const folder of animeFolders) {
      const folderPath = path.join(rootDir, folder.name);
      const items = fs.readdirSync(folderPath);

      // Find all video episodes
      const episodes = [];
      let posterPath = null;

      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) continue;

        const ext = path.extname(item).toLowerCase();

        if (VIDEO_EXTENSIONS.has(ext)) {
          const epHistory = (this.history.episodes && this.history.episodes[itemPath]) || null;
          episodes.push({
            name: item,
            title: path.parse(item).name,
            path: itemPath,
            size: stat.size,
            currentTime: epHistory ? epHistory.currentTime : 0,
            duration: epHistory ? epHistory.duration : 0,
            completed: epHistory ? epHistory.completed : false
          });
        } else if (IMAGE_EXTENSIONS.has(ext) && !posterPath) {
          const base = path.parse(item).name.toLowerCase();
          if (['poster', 'cover', 'folder', 'thumb'].includes(base) || !posterPath) {
            posterPath = itemPath;
          }
        }
      }

      // Natural alphanumeric sort for episodes (e.g. Episode 2 before Episode 10)
      episodes.sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      const animeHist = (this.history.animeList && this.history.animeList[folderPath]) || null;

      animeList.push({
        title: folder.name,
        path: folderPath,
        posterPath: posterPath ? posterPath.replace(/\\/g, '/') : null,
        episodesCount: episodes.length,
        episodes,
        lastWatched: animeHist || null
      });
    }

    // Sort anime by title
    animeList.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      libraryPath: rootDir,
      animeList,
      continueWatching: this.getContinueWatching()
    };
  }
}

module.exports = new LibraryService();
