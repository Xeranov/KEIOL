/**
 * Core Video Player Engine
 * Handles media loading, adaptive streaming (Direct / Transmux / Transcode),
 * speed control up to 4x, pitch preservation, and audio/subtitle tracks.
 */
class VidPlayerCore {
  constructor() {
    this.video = document.getElementById('mainVideo');
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
    this.normalPlaybackRate = 1.0;

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
    if (window.electronAPI) {
      this.serverPort = await window.electronAPI.getServerPort();
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
      } else {
        window.dispatchEvent(new CustomEvent('player:error', {
          detail: { message: 'Format atau codec media tidak dapat diputar langsung.' }
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

  setPlaybackMode(mode) {
    this.playbackMode = mode;
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
