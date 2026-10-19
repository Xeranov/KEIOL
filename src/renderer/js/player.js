/**
 * Core Video Player Engine
 * Handles media loading, adaptive streaming (Direct / Transmux / Transcode),
 * speed control up to 4x, pitch preservation, and audio/subtitle tracks.
 */
class VidPlayerCore {
  constructor() {
    this.video = document.getElementById('mainVideo');
    this.iframePlayer = document.getElementById('iframePlayer');
    this.serverPort = 0;
    this.currentFilePath = null;
    this.mediaInfo = null;

    // Playback state
    this.playbackMode = 'direct'; // 'direct' | 'transmux' | 'transcode'
    this.selectedAudioTrack = 0;
    this.selectedSubTrack = -1; // -1 = disabled
    this.isTransmuxSeeking = false;
    this.streamSeekOffset = 0; // Offset in seconds when streaming via FFmpeg
    this.originalSpeedBeforeBoost = 1.0;
    this.isBoostActive = false;
    const savedSpeed = parseFloat(localStorage.getItem('keiol_pref_speed') || '1.0');
    this.normalPlaybackRate = isNaN(savedSpeed) ? 1.0 : savedSpeed;
    this.availableQualities = [];
    this.currentQuality = null;
    this.currentSkipIntervals = null;

    // Ensure audio pitch is preserved when playing fast (up to 4x)
    if ('preservesPitch' in this.video) {
      this.video.preservesPitch = true;
    } else if ('mozPreservesPitch' in this.video) {
      this.video.mozPreservesPitch = true;
    } else if ('webkitPreservesPitch' in this.video) {
      this.video.webkitPreservesPitch = true;
    }

    this.initListeners();
  }

  async init() {
    if (!this.iframePlayer) {
      this.iframePlayer = document.getElementById('iframePlayer');
    }
    if (window.electronAPI && typeof window.electronAPI.getServerPort === 'function') {
      try {
        this.serverPort = await window.electronAPI.getServerPort();
      } catch (e) {
        // Fallback port if server not running yet
      }
    }
  }

  initListeners() {
    this.video.addEventListener('play', () => {
      window.dispatchEvent(new CustomEvent('player:statechange', { detail: { isPlaying: true } }));
    });

    this.video.addEventListener('pause', () => {
      window.dispatchEvent(new CustomEvent('player:statechange', { detail: { isPlaying: false } }));
    });

    this.video.addEventListener('timeupdate', () => {
      const currentTime = this.getCurrentTime();
      const duration = this.getDuration();
      window.dispatchEvent(new CustomEvent('player:timeupdate', {
        detail: { currentTime, duration, progress: duration > 0 ? (currentTime / duration) : 0 }
      }));
    });

    this.video.addEventListener('progress', () => {
      this.updateBufferedRanges();
    });

    this.video.addEventListener('waiting', () => {
      window.dispatchEvent(new CustomEvent('player:buffering', { detail: { isBuffering: true } }));
    });

    this.video.addEventListener('canplay', () => {
      window.dispatchEvent(new CustomEvent('player:buffering', { detail: { isBuffering: false } }));
    });

    this.video.addEventListener('loadedmetadata', () => {
      if (this.currentSkipIntervals && this.video.duration > 0) {
        const validated = this.validateSkipIntervals(this.currentSkipIntervals, this.video.duration);
        if (JSON.stringify(validated) !== JSON.stringify(this.currentSkipIntervals)) {
          this.currentSkipIntervals = validated;
          window.dispatchEvent(new CustomEvent('player:skipintervals', { detail: this.currentSkipIntervals }));
        }
      }
    });

    this.video.addEventListener('ratechange', () => {
      if (!this.isBoostActive) {
        this.normalPlaybackRate = this.video.playbackRate;
      }
      window.dispatchEvent(new CustomEvent('player:ratechange', {
        detail: { rate: this.video.playbackRate, isBoost: this.isBoostActive }
      }));
    });

    this.video.addEventListener('volumechange', () => {
      window.dispatchEvent(new CustomEvent('player:volumechange', {
        detail: { volume: this.video.volume, muted: this.video.muted }
      }));
    });

    this.video.addEventListener('ended', () => {
      window.dispatchEvent(new CustomEvent('player:ended'));
    });

    this.video.addEventListener('error', (e) => {
      console.error('Video error encountered:', e);
      // If direct play fails, automatically attempt fallback to fast transmux
      if (this.playbackMode === 'direct' && this.currentFilePath) {
        console.warn('Direct play failed, falling back to transmux stream...');
        this.setPlaybackMode('transmux');
        this.reloadStreamAt(this.getCurrentTime());
      } else if (this.playbackMode === 'transmux' && this.currentFilePath) {
        console.warn('Transmux failed, falling back to full transcode stream...');
        this.setPlaybackMode('transcode');
        this.reloadStreamAt(this.getCurrentTime());
      } else {
        const err = this.video.error;
        let codeName = 'MEDIA_ERR_UNKNOWN (0)';
        let codeNum = 0;
        let detailMsg = 'Format atau codec media tidak dapat diputar langsung.';
        if (err) {
          codeNum = err.code;
          switch (err.code) {
            case 1:
              codeName = 'MEDIA_ERR_ABORTED (1)';
              detailMsg = 'Pengambilan media dibatalkan oleh pengguna atau sistem.';
              break;
            case 2:
              codeName = 'MEDIA_ERR_NETWORK (2)';
              detailMsg = 'Terjadi kesalahan jaringan atau server streaming menolak akses (403/404).';
              break;
            case 3:
              codeName = 'MEDIA_ERR_DECODE (3)';
              detailMsg = 'Terjadi kesalahan decoding atau stream media korup.';
              break;
            case 4:
              codeName = 'MEDIA_ERR_SRC_NOT_SUPPORTED (4)';
              detailMsg = 'Format/sumber media tidak didukung, server menolak izin akses (403 Forbidden / Expired), atau codec tidak kompatibel.';
              break;
            default:
              codeName = `MEDIA_ERR_OTHER (${err.code})`;
              detailMsg = err.message || 'Terjadi kesalahan pada media player.';
          }
        }
        if (this.isSwitchingQuality) {
          console.warn('Mengabaikan modal error fatal saat proses rollback kualitas sedang berlangsung');
          return;
        }

        window.dispatchEvent(new CustomEvent('player:error', {
          detail: {
            message: detailMsg,
            code: codeNum,
            codeName: codeName,
            src: this.video.src
          }
        }));
      }
    });
  }

  /**
   * Load and probe media file
   */
  async loadFile(filePath) {
    this.currentFilePath = filePath;
    this.streamSeekOffset = 0;
    this.isTransmuxSeeking = false;

    window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: true } }));

    try {
      // Jika file berupa arsip (.rar, .zip, .7z), otomatis ekstrak dan putar video pertama
      if (window.electronAPI && typeof window.electronAPI.isArchive === 'function') {
        try {
          const isArc = await window.electronAPI.isArchive(filePath);
          if (isArc) {
            const rawName = filePath.split(/[\\/]/).pop();
            window.dispatchEvent(new CustomEvent('player:medialoaded', {
              detail: { fileName: `📦 Mengekstrak ${rawName}...`, mediaInfo: { duration: 0 }, playbackMode: 'direct' }
            }));

            const extractResult = await window.electronAPI.extractArchive(filePath, null, { deleteArchiveAfter: true });
            if (extractResult && extractResult.firstVideoPath) {
              filePath = extractResult.firstVideoPath;
              this.currentFilePath = filePath;
            } else {
              throw new Error('Tidak ditemukan file video (.mp4, .mkv) di dalam arsip batch.');
            }
          }
        } catch (arcErr) {
          console.warn('Gagal memeriksa/mengekstrak arsip:', arcErr);
        }
      }

      if (window.electronAPI) {
        this.mediaInfo = await window.electronAPI.probeFile(filePath);
        this.playbackMode = this.mediaInfo.playbackMode || 'direct';
      } else {
        this.mediaInfo = { duration: 0, playbackMode: 'direct', audioStreams: [], subtitleStreams: [] };
        this.playbackMode = 'direct';
      }

      this.selectedAudioTrack = 0;
      this.selectedSubTrack = -1;

      // Update UI title and badge
      const fileName = filePath.split(/[\\/]/).pop();
      window.dispatchEvent(new CustomEvent('player:medialoaded', {
        detail: { fileName, mediaInfo: this.mediaInfo, playbackMode: this.playbackMode }
      }));

      // Ensure iframe player is deactivated and main video is visible for local files
      if (this.iframePlayer) {
        this.iframePlayer.classList.add('hidden');
        this.iframePlayer.src = 'about:blank';
      }
      if (this.video) {
        this.video.classList.remove('hidden');
      }

      // Check chapter markers for Opening/Ending
      if (this.mediaInfo && Array.isArray(this.mediaInfo.chapters)) {
        const opChapter = this.mediaInfo.chapters.find(ch => /OP|Opening|Intro/i.test(ch.title));
        const edChapter = this.mediaInfo.chapters.find(ch => /ED|Ending/i.test(ch.title));
        if (opChapter || edChapter) {
          this.currentSkipIntervals = {
            op: opChapter ? { startTime: opChapter.startTime, endTime: opChapter.endTime } : null,
            ed: edChapter ? { startTime: edChapter.startTime, endTime: edChapter.endTime } : null
          };
        } else {
          this.currentSkipIntervals = null;
        }
      } else {
        this.currentSkipIntervals = null;
      }

      // Jika file lokal tidak memiliki chapter OP/ED, lookup ke AniSkip berdasarkan judul anime & episode
      if (!this.currentSkipIntervals && window.electronAPI && typeof window.electronAPI.getAnimeSkipTimes === 'function') {
        try {
          const rawBase = fileName.replace(/\.[^.]+$/, '');
          const stripped = rawBase
            .replace(/\[[^\]]+\]/g, ' ')
            .replace(/\([^\)]+\)/g, ' ')
            .replace(/\b(?:1080p|720p|480p|360p|2160p|x264|x265|hevc|web-dl|bdrip|bluray|10bit|aac|flac)\b/gi, ' ')
            .trim();

          const matchTitle = stripped.match(/^([^-–—_]+?)(?:\s*[-–—_]\s*|\s+[sS]\d+|\s+(?:Season|S)\s*\d+)/i);
          const cleanName = matchTitle ? matchTitle[1].trim() : stripped.replace(/[-–—_]\s*\d+.*$/, '').trim();

          let epNum = 1;
          if (typeof window.electronAPI.aniskipExtractEpisodeNumber === 'function') {
            epNum = await window.electronAPI.aniskipExtractEpisodeNumber(rawBase, cleanName);
          } else {
            epNum = this.extractEpisodeNumber(rawBase, cleanName);
          }

          if (cleanName) {
            const skipRes = await window.electronAPI.getAnimeSkipTimes(cleanName, epNum).catch(() => null);
            if (skipRes && skipRes.found) {
              const dur = this.mediaInfo?.duration || this.video?.duration || null;
              this.currentSkipIntervals = this.validateSkipIntervals({ op: skipRes.op, ed: skipRes.ed }, dur);
            }
          }
        } catch (e) {
          // Abaikan error AniSkip lookup untuk file lokal
        }
      }

      this.availableQualities = [];
      this.currentQuality = null;
      window.dispatchEvent(new CustomEvent('player:skipintervals', { detail: this.currentSkipIntervals }));

      // Set video source
      this.setupVideoSource(0);

      await this.video.play().catch(() => {
        // Autoplay policy or paused on start
      });

    } catch (err) {
      console.error('Failed to load file:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: { message: `Gagal membaca file video: ${err.message}` }
      }));
    } finally {
      window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: false } }));
    }
  }

  setupVideoSource(seekSec = 0) {
    const encodedPath = encodeURIComponent(this.currentFilePath);

    if (this.playbackMode === 'direct') {
      this.streamSeekOffset = 0;
      this.video.src = `http://127.0.0.1:${this.serverPort}/file?path=${encodedPath}`;
      if (seekSec > 0) {
        this.video.currentTime = seekSec;
      }
    } else {
      // Transmux or Transcode mode via FFmpeg stream
      this.streamSeekOffset = seekSec;
      const audioIdx = this.selectedAudioTrack;
      const mode = this.playbackMode;
      const url = `http://127.0.0.1:${this.serverPort}/stream?path=${encodedPath}&seek=${seekSec}&mode=${mode}&audio=${audioIdx}&t=${Date.now()}`;
      this.video.src = url;
    }

    this.video.playbackRate = this.normalPlaybackRate;
  }

  reloadStreamAt(seekSec) {
    const wasPlaying = !this.video.paused;
    this.setupVideoSource(seekSec);
    if (wasPlaying) {
      this.video.play().catch(() => {});
    }
  }

  getCurrentTime() {
    if (this.playbackMode === 'direct') {
      return this.video.currentTime;
    }
    return this.streamSeekOffset + this.video.currentTime;
  }

  getDuration() {
    if (this.mediaInfo && this.mediaInfo.duration > 0) {
      return this.mediaInfo.duration;
    }
    return this.video.duration || 0;
  }

  seek(targetSeconds) {
    const maxDur = this.getDuration();
    const clamped = Math.max(0, Math.min(targetSeconds, maxDur));

    if (this.playbackMode === 'direct') {
      this.video.currentTime = clamped;
    } else {
      // Transmux / Transcode stream: request new stream starting from clamped timestamp
      this.reloadStreamAt(clamped);
    }
  }

  seekRelative(deltaSeconds) {
    this.seek(this.getCurrentTime() + deltaSeconds);
  }

  seekPercent(fraction) {
    const dur = this.getDuration();
    if (dur > 0) {
      this.seek(dur * fraction);
    }
  }

  togglePlayPause() {
    if (this.video.paused || this.video.ended) {
      this.video.play().catch(() => {});
      return true;
    } else {
      this.video.pause();
      return false;
    }
  }

  /**
   * Set permanent playback speed (0.25x up to 4.0x)
   */
  setPlaybackRate(speed) {
    const clamped = Math.max(0.25, Math.min(4.0, speed));
    this.normalPlaybackRate = clamped;
    if (!this.isBoostActive) {
      this.video.playbackRate = clamped;
    }
    return clamped;
  }

  adjustPlaybackRate(delta) {
    const newSpeed = Math.round((this.normalPlaybackRate + delta) * 100) / 100;
    return this.setPlaybackRate(newSpeed);
  }

  /**
   * Activate / Deactivate 2x Speed Boost (Hold Space or Hold Left Click)
   */
  setBoost2x(active) {
    if (this.isBoostActive === active) return;

    if (active) {
      this.isBoostActive = true;
      this.originalSpeedBeforeBoost = this.video.playbackRate;
      this.video.playbackRate = 2.0;
      window.dispatchEvent(new CustomEvent('player:boost', { detail: { active: true, rate: 2.0 } }));
    } else {
      this.isBoostActive = false;
      this.video.playbackRate = this.originalSpeedBeforeBoost;
      window.dispatchEvent(new CustomEvent('player:boost', { detail: { active: false, rate: this.originalSpeedBeforeBoost } }));
    }
  }

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.video.volume = clamped;
    if (clamped > 0 && this.video.muted) {
      this.video.muted = false;
    }
    return clamped;
  }

  adjustVolume(delta) {
    return this.setVolume(this.video.volume + delta);
  }

  toggleMute() {
    this.video.muted = !this.video.muted;
    return this.video.muted;
  }

  stepFrame(direction) {
    // 1 frame forward or backward (assumes ~30fps, 1/30 = 0.033s)
    if (!this.video.paused) {
      this.video.pause();
    }
    const frameTime = 1 / (this.mediaInfo?.video?.fps || 30);
    this.seekRelative(direction * frameTime);
  }

  selectAudioTrack(trackIndex) {
    this.selectedAudioTrack = trackIndex;
    if (this.playbackMode !== 'direct') {
      this.reloadStreamAt(this.getCurrentTime());
    }
  }

  async selectSubtitleTrack(subIndex) {
    this.selectedSubTrack = subIndex;
    const subContainer = document.getElementById('subtitleDisplay');
    const existingTrack = this.video.querySelector('track');
    if (existingTrack) existingTrack.remove();

    if (subIndex < 0) {
      subContainer.classList.add('hidden');
      subContainer.textContent = '';
      return;
    }

    // Load extracted WebVTT track from localhost media server
    const encodedPath = encodeURIComponent(this.currentFilePath);
    const subUrl = `http://127.0.0.1:${this.serverPort}/subtitle?path=${encodedPath}&track=${subIndex}`;

    const trackEl = document.createElement('track');
    trackEl.kind = 'subtitles';
    trackEl.label = `Track ${subIndex + 1}`;
    trackEl.srclang = 'id';
    trackEl.src = subUrl;
    trackEl.default = true;

    trackEl.addEventListener('cuechange', () => {
      const cue = trackEl.track.activeCues && trackEl.track.activeCues[0];
      if (cue) {
        subContainer.textContent = cue.text;
        subContainer.classList.remove('hidden');
      } else {
        subContainer.classList.add('hidden');
      }
    });

    this.video.appendChild(trackEl);
    trackEl.track.mode = 'hidden'; // Custom rendering in subtitleDisplay overlay
  }

  loadExternalSubtitle(fileObj) {
    const url = URL.createObjectURL(fileObj);
    const subContainer = document.getElementById('subtitleDisplay');
    const existingTrack = this.video.querySelector('track');
    if (existingTrack) existingTrack.remove();

    const trackEl = document.createElement('track');
    trackEl.kind = 'subtitles';
    trackEl.label = fileObj.name;
    trackEl.src = url;
    trackEl.default = true;

    trackEl.addEventListener('cuechange', () => {
      const cue = trackEl.track.activeCues && trackEl.track.activeCues[0];
      if (cue) {
        subContainer.textContent = cue.text;
        subContainer.classList.remove('hidden');
      } else {
        subContainer.classList.add('hidden');
      }
    });

    this.video.appendChild(trackEl);
    trackEl.track.mode = 'hidden';
  }

  /**
   * Load and stream online video directly (e.g. Otakudesu direct MP4 stream)
   */
  async loadRemoteStream(streamUrl, options = {}) {
    this.currentFilePath = null;
    this.remoteStreamUrl = streamUrl;
    this.remoteStreamOptions = options;
    this.streamSeekOffset = 0;
    this.isTransmuxSeeking = false;
    this.playbackMode = 'direct';

    if (!this.serverPort && window.electronAPI && typeof window.electronAPI.getServerPort === 'function') {
      try {
        this.serverPort = await window.electronAPI.getServerPort();
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('player:loading', {
      detail: { isLoading: true, message: `Menghubungkan stream ${options.title || ''}...`.trim() }
    }));

    try {
      this.mediaInfo = {
        duration: 0,
        playbackMode: 'direct',
        audioStreams: [{ index: 0, title: 'Audio Stream', language: 'jpn' }],
        subtitleStreams: []
      };

      this.selectedAudioTrack = 0;
      this.selectedSubTrack = -1;

      const title = options.title || 'Online Stream';
      this.availableQualities = options.availableQualities || [];
      this.currentQuality = options.currentQuality || (this.availableQualities.find(q => q.isDefault)?.quality || '720p');

      // Redundant validation & non-blocking auto-fetch of skip intervals if animeTitle is provided
      if (options.skipIntervals) {
        this.currentSkipIntervals = this.validateSkipIntervals(options.skipIntervals);
      } else if (options.animeTitle && window.electronAPI && typeof window.electronAPI.getAnimeSkipTimes === 'function') {
        const epNum = this.extractEpisodeNumber(options.episodeTitle || options.title || '', options.animeTitle);
        window.electronAPI.getAnimeSkipTimes(options.animeTitle, epNum).then(skipRes => {
          if (skipRes && skipRes.found) {
            this.setSkipIntervals({ op: skipRes.op, ed: skipRes.ed });
          }
        }).catch(() => {});
        this.currentSkipIntervals = null;
      } else {
        this.currentSkipIntervals = null;
      }

      window.dispatchEvent(new CustomEvent('player:medialoaded', {
        detail: { fileName: title, mediaInfo: this.mediaInfo, playbackMode: 'direct' }
      }));

      window.dispatchEvent(new CustomEvent('player:skipintervals', { detail: this.currentSkipIntervals }));
      window.dispatchEvent(new CustomEvent('player:qualitiesupdated', {
        detail: {
          availableQualities: this.availableQualities,
          currentQuality: this.currentQuality
        }
      }));

      // Cek apakah mode streaming adalah iframe embed (anime lawas seperti Death Note, Toradora, Clannad, dll.)
      let effectiveStreamUrl = streamUrl;
      let isIframeStream = options.streamType === 'iframe' ||
        (!streamUrl && options.embedUrl) ||
        (options.embedUrl && streamUrl === options.embedUrl);

      // Coba unwrap direct media (<video src> atau <source src>) dari embedUrl jika direct stream belum tersedia
      if (isIframeStream && (options.embedUrl || streamUrl)) {
        try {
          const unpacked = await this.resolveDirectMediaFromEmbed(options.embedUrl || streamUrl);
          if (unpacked) {
            effectiveStreamUrl = unpacked;
            isIframeStream = false;
          }
        } catch (e) {}
      }

      if (isIframeStream) {
        this.playbackMode = 'iframe';
        if (this.video) {
          this.video.pause();
          this.video.removeAttribute('src');
          this.video.load();
          this.video.classList.add('hidden');
        }
        if (this.iframePlayer) {
          this.iframePlayer.classList.remove('hidden');
          this.iframePlayer.src = options.embedUrl || streamUrl;
        }
        window.dispatchEvent(new CustomEvent('player:medialoaded', {
          detail: { fileName: title, mediaInfo: this.mediaInfo, playbackMode: 'iframe' }
        }));
        return;
      } else {
        if (this.iframePlayer) {
          this.iframePlayer.classList.add('hidden');
          this.iframePlayer.src = 'about:blank';
        }
        if (this.video) {
          this.video.classList.remove('hidden');
        }
      }

      // Cek apakah stream utama merupakan MKV, HLS (.m3u8), atau memerlukan remux
      const isMkv = options.isMkv || /\.mkv/i.test(effectiveStreamUrl);
      const isHls = effectiveStreamUrl.includes('.m3u8');
      const requiresRemux = isMkv || isHls;
      const initialSrc = requiresRemux
        ? `http://127.0.0.1:${this.serverPort}/stream?path=${encodeURIComponent(effectiveStreamUrl)}&mode=transmux&audio=0`
        : effectiveStreamUrl;

      this.video.src = initialSrc;
      this.video.playbackRate = this.normalPlaybackRate;

      if (options.startTime && options.startTime > 0) {
        this.video.currentTime = options.startTime;
      }

      await this.video.play().catch(() => {});
    } catch (err) {
      console.error('Failed to load remote stream:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: {
          message: `Gagal memuat streaming video: ${err.message}`,
          codeName: 'STREAM_LOAD_ERROR'
        }
      }));
    } finally {
      window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: false } }));
    }
  }

  setSkipIntervals(intervals) {
    this.currentSkipIntervals = this.validateSkipIntervals(intervals, this.video?.duration || null);
    window.dispatchEvent(new CustomEvent('player:skipintervals', { detail: this.currentSkipIntervals }));
  }

  getSkipIntervals() {
    if (!this.currentSkipIntervals) return null;
    return this.validateSkipIntervals(this.currentSkipIntervals, this.video?.duration || this.mediaInfo?.duration || null);
  }

  /**
   * Redundant Validation System for Anime Skip Intervals
   * Validates intervals against sensible OP/ED duration bounds (~80-100s, 30s-130s),
   * start time bounds, non-overlap, and actual video duration.
   */
  validateSkipIntervals(intervals, videoDuration = null) {
    if (!intervals || typeof intervals !== 'object') return null;

    const validDuration = (typeof videoDuration === 'number' && !isNaN(videoDuration) && videoDuration > 0)
      ? videoDuration
      : null;

    let validOp = null;
    let validEd = null;

    // Validate Opening (OP)
    if (intervals.op && typeof intervals.op.startTime === 'number' && typeof intervals.op.endTime === 'number') {
      const start = Math.max(0, intervals.op.startTime);
      const end = intervals.op.endTime;
      const duration = end - start;

      const isSensibleDuration = duration >= 30 && duration <= 130;
      const isSensibleStart = start >= 0 && start <= 480;
      const fitsVideo = !validDuration || (end <= (validDuration - 5) && duration < (validDuration * 0.6));

      if (isSensibleDuration && isSensibleStart && fitsVideo) {
        const effectiveEnd = validDuration ? Math.min(end, validDuration - 2) : end;
        validOp = {
          startTime: Math.round(start * 10) / 10,
          endTime: Math.round(effectiveEnd * 10) / 10
        };
      }
    }

    // Validate Ending (ED)
    if (intervals.ed && typeof intervals.ed.startTime === 'number' && typeof intervals.ed.endTime === 'number') {
      const start = Math.max(0, intervals.ed.startTime);
      const end = intervals.ed.endTime;
      const duration = end - start;

      const isSensibleDuration = duration >= 30 && duration <= 130;
      const fitsVideo = !validDuration || (start >= (validDuration * 0.35) && start < validDuration);

      if (isSensibleDuration && fitsVideo) {
        if (!validOp || start >= validOp.endTime) {
          const effectiveEnd = validDuration ? Math.min(end, validDuration - 1) : end;
          if (effectiveEnd > start) {
            validEd = {
              startTime: Math.round(start * 10) / 10,
              endTime: Math.round(effectiveEnd * 10) / 10
            };
          }
        }
      }
    }

    if (!validOp && !validEd) return null;
    return { op: validOp, ed: validEd };
  }

  /**
   * Resolves episode number from string, stripping known animeTitle first
   * so anime with numbers (e.g. Mob Psycho 100, 86, Steins;Gate 0) do not collide.
   */
  extractEpisodeNumber(rawString, animeTitle = '') {
    if (!rawString) return 1;

    let target = rawString;
    if (animeTitle) {
      const cleanAnime = animeTitle
        .replace(/\[[^\]]*\]/g, '')
        .replace(/Subtitle\s+Indonesia/gi, '')
        .replace(/Sub\s+Indo/gi, '')
        .replace(/\b(?:BD|Batch|OVA|Movie|Special|TAMAT|Complete|End)\b/gi, '')
        .replace(/Season\s+\d+/gi, '')
        .replace(/S\d+/gi, '')
        .trim();
      if (cleanAnime) {
        const escaped = cleanAnime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        target = target.replace(new RegExp(escaped, 'gi'), ' ');
      }
    }

    target = target.replace(/\((?:Episode|Eps?\.?)\s*\d+\s*[–—\-]\s*\d+\)/gi, '');
    target = target.replace(/\[[^\]]*\]/g, ' ');
    target = target.replace(/\((?:1080p|720p|480p|360p|x264|x265|hevc|bdrip)[^)]*\)/gi, ' ');
    target = target.replace(/\b(?:1080p|720p|480p|360p|2160p|x264|x265|hevc|10bit|aac|flac)\b/gi, ' ');

    const explicitMatch = target.match(/(?:Episode|Eps?\.?|Ep\.?)\s*(\d{1,4})/i);
    if (explicitMatch) return parseInt(explicitMatch[1], 10);

    const seMatch = target.match(/[sS]\d+[eE](\d{1,4})/i);
    if (seMatch) return parseInt(seMatch[1], 10);

    const eMatch = target.match(/(?:^|[\s_–—\-])[eE](\d{1,4})(?:[\s_–—\.]|$)/i);
    if (eMatch) return parseInt(eMatch[1], 10);

    const dashMatches = [...target.matchAll(/[-–—_]\s*(\d{1,4})(?:v\d)?(?=[\s_–—\.]|\.mkv|\.mp4|$)/gi)];
    if (dashMatches.length > 0) {
      const lastMatch = dashMatches[dashMatches.length - 1];
      const num = parseInt(lastMatch[1], 10);
      if (num >= 0 && num !== 1080 && num !== 720 && num !== 480 && num !== 360 && num !== 2160) {
        return num;
      }
    }

    const trailingMatch = target.match(/\s+(\d{1,4})\s*(?:\.[a-z0-9]+)?$/i);
    if (trailingMatch) return parseInt(trailingMatch[1], 10);

    const genericMatches = target.match(/\b(\d{1,4})\b/g);
    if (genericMatches) {
      for (let i = genericMatches.length - 1; i >= 0; i--) {
        const val = parseInt(genericMatches[i], 10);
        if (val >= 0 && val < 2000 && val !== 1080 && val !== 720 && val !== 480 && val !== 360) {
          return val;
        }
      }
    }

    return 1;
  }

  /**
   * Helper untuk meng-unwrap direct media URL (<video src> atau <source src>) dari embed iframe
   */
  async resolveDirectMediaFromEmbed(embedUrl) {
    if (!embedUrl) return null;
    if (window.electronAPI && typeof window.electronAPI.otakudesuResolveStreamUrl === 'function') {
      try {
        const resolved = await window.electronAPI.otakudesuResolveStreamUrl(embedUrl);
        if (resolved) return resolved;
      } catch (e) {}
    }
    return null;
  }

  async switchQuality(newStreamUrl, qualityLabel) {
    if (!newStreamUrl || newStreamUrl === this.remoteStreamUrl) return;

    const savedTime = this.video ? this.video.currentTime : 0;
    const wasPlaying = this.video ? !this.video.paused : false;
    const previousSrc = this.video ? this.video.src : null;
    const previousRemoteUrl = this.remoteStreamUrl;
    const previousQuality = this.currentQuality;

    if (!this.serverPort && window.electronAPI && typeof window.electronAPI.getServerPort === 'function') {
      try {
        this.serverPort = await window.electronAPI.getServerPort();
      } catch (e) {}
    }
    this.isSwitchingQuality = true;

    window.dispatchEvent(new CustomEvent('player:loading', {
      detail: { isLoading: true, message: `Beralih ke kualitas ${qualityLabel}...` }
    }));

    // Cek apakah resolusi yang dipilih berupa format iframe embed
    const qObj = this.availableQualities.find(q => q.quality === qualityLabel);
    if (qObj?.streamType === 'iframe' || newStreamUrl.includes('/dstream/') || newStreamUrl.includes('/embed/')) {
      return this.loadRemoteStream(newStreamUrl, {
        ...this.remoteStreamOptions,
        streamType: 'iframe',
        currentQuality: qualityLabel
      });
    }

    // Cek apakah resolusi yang dipilih berupa format MKV atau HLS (.m3u8) yang memerlukan remux FFmpeg
    const isMkv = qObj?.isMkv || /\.mkv/i.test(newStreamUrl);
    const isHls = newStreamUrl.includes('.m3u8');
    const requiresRemux = isMkv || isHls;
    const targetUrl = requiresRemux
      ? `http://127.0.0.1:${this.serverPort}/stream?path=${encodeURIComponent(newStreamUrl)}&mode=transmux&audio=0`
      : newStreamUrl;

    try {
      this.remoteStreamUrl = newStreamUrl;
      this.currentQuality = qualityLabel;
      if (this.remoteStreamOptions) {
        this.remoteStreamOptions.currentQuality = qualityLabel;
      }

      // Handler pembatalan/rollback aman jika stream kualitas baru gagal dimuat (misal 403 atau offline)
      const onSwitchError = (e) => {
        this.video.removeEventListener('loadedmetadata', restoreTimeHandler);
        console.warn(`Gagal memuat kualitas ${qualityLabel}, mengembalikan ke ${previousQuality}...`);
        if (previousSrc) {
          this.remoteStreamUrl = previousRemoteUrl;
          this.currentQuality = previousQuality;
          this.video.src = previousSrc;
          this.video.currentTime = savedTime;
          if (wasPlaying) this.video.play().catch(() => {});
        }
        setTimeout(() => {
          this.isSwitchingQuality = false;
        }, 300);
        window.dispatchEvent(new CustomEvent('player:toast', {
          detail: { message: `Kualitas ${qualityLabel} gagal dimuat. Mengembalikan ke kualitas sebelumnya.` }
        }));
      };

      this.video.addEventListener('error', onSwitchError, { once: true });

      const restoreTimeHandler = () => {
        this.video.removeEventListener('error', onSwitchError);
        this.isSwitchingQuality = false;
        if (savedTime > 0) {
          try {
            this.video.currentTime = Math.min(savedTime, this.video.duration || savedTime);
          } catch (e) {}
        }
        if (wasPlaying) {
          this.video.play().catch(() => {});
        }
      };

      this.video.addEventListener('loadedmetadata', restoreTimeHandler, { once: true });

      this.video.src = targetUrl;

      window.dispatchEvent(new CustomEvent('player:qualitychanged', {
        detail: { quality: qualityLabel, streamUrl: targetUrl }
      }));
    } catch (err) {
      console.error('Failed to switch quality:', err);
      window.dispatchEvent(new CustomEvent('player:error', {
        detail: {
          message: `Gagal mengubah kualitas: ${err.message}`,
          codeName: 'QUALITY_SWITCH_ERROR'
        }
      }));
    } finally {
      window.dispatchEvent(new CustomEvent('player:loading', { detail: { isLoading: false } }));
    }
  }

  hasMedia() {
    return Boolean(this.currentFilePath || this.remoteStreamUrl);
  }

  setPlaybackMode(mode) {
    this.playbackMode = mode;
    window.dispatchEvent(new CustomEvent('player:modechange', { detail: { mode } }));
  }

  /**
   * Stop video playback completely and unload source
   */
  stop() {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video.classList.remove('hidden');
    }
    if (this.iframePlayer) {
      this.iframePlayer.classList.add('hidden');
      this.iframePlayer.src = 'about:blank';
    }
    this.currentFilePath = null;
    this.remoteStreamUrl = null;
    this.mediaInfo = null;
    this.availableQualities = [];
    this.currentQuality = null;
    this.currentSkipIntervals = null;
    this.isBoostActive = false;
    this.streamSeekOffset = 0;
    this.playbackMode = 'direct';
    window.dispatchEvent(new CustomEvent('player:statechange', { detail: { isPlaying: false } }));
    window.dispatchEvent(new CustomEvent('player:buffering', { detail: { isBuffering: false } }));
  }

  updateBufferedRanges() {
    if (this.video.buffered.length > 0 && this.getDuration() > 0) {
      const bufferedEnd = this.streamSeekOffset + this.video.buffered.end(this.video.buffered.length - 1);
      const fraction = Math.min(1, bufferedEnd / this.getDuration());
      window.dispatchEvent(new CustomEvent('player:bufferupdate', { detail: { fraction } }));
    }
  }
}

window.playerCore = new VidPlayerCore();

