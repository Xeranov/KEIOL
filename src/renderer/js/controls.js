/**
 * YouTube Controls UI Manager
 * Handles Scrubber with hover preview, Volume slider, Autohide timers,
 * Fullscreen, PiP, Theater mode, Settings popovers, and Speed selection up to 4x.
 */
class ControlsManager {
  constructor(player) {
    this.player = player;

    // DOM Elements
    this.controlsBar = document.getElementById('controlsBar');
    this.playerTopBar = document.getElementById('playerTopBar');
    this.playerTopTitle = document.getElementById('playerTopTitle');
    this.playerTopEpisode = document.getElementById('playerTopEpisode');
    this.btnPlayerBack = document.getElementById('btnPlayerBack');
    this.videoWrapper = document.getElementById('videoWrapper');
    this.progressBarContainer = document.getElementById('progressBarContainer');
    this.progressPlayed = document.getElementById('progressPlayed');
    this.progressBuffer = document.getElementById('progressBuffer');
    this.progressHover = document.getElementById('progressHover');
    this.scrubKnob = document.getElementById('scrubKnob');
    this.scrubberTooltip = document.getElementById('scrubberTooltip');

    this.timeDisplay = document.getElementById('timeDisplay');
    this.currentTimeDisplay = document.getElementById('currentTime');
    this.totalDurationDisplay = document.getElementById('totalDuration');
    this.showRemainingTime = false;

    // Transport buttons
    this.btnPlayPause = document.getElementById('btnPlayPause');
    this.iconPlay = document.getElementById('iconPlay');
    this.iconPause = document.getElementById('iconPause');
    this.iconReplay = document.getElementById('iconReplay');

    this.btnRewind10 = document.getElementById('btnRewind10');
    this.btnForward10 = document.getElementById('btnForward10');

    // Volume
    this.btnVolume = document.getElementById('btnVolume');
    this.iconVolumeHigh = document.getElementById('iconVolumeHigh');
    this.iconVolumeLow = document.getElementById('iconVolumeLow');
    this.iconVolumeMute = document.getElementById('iconVolumeMute');
    this.volumeSlider = document.getElementById('volumeSlider');

    // Action buttons
    this.btnSpeedQuick = document.getElementById('btnSpeedQuick');
    this.speedBadgeText = document.getElementById('speedBadgeText');
    this.btnSubtitles = document.getElementById('btnSubtitles');
    this.subtitlesActiveBar = document.getElementById('subtitlesActiveBar');
    this.btnSettings = document.getElementById('btnSettings');
    this.btnMiniplayer = document.getElementById('btnMiniplayer');
    this.btnFullscreen = document.getElementById('btnFullscreen');
    this.iconEnterFullscreen = document.getElementById('iconEnterFullscreen');
    this.iconExitFullscreen = document.getElementById('iconExitFullscreen');

    // Settings popover
    this.settingsMenu = document.getElementById('settingsMenu');
    this.settingsMainView = document.getElementById('settingsMainView');
    this.settingsSpeedView = document.getElementById('settingsSpeedView');
    this.settingsAudioView = document.getElementById('settingsAudioView');
    this.settingsSubView = document.getElementById('settingsSubView');
    this.settingsSeekView = document.getElementById('settingsSeekView');

    this.btnSettingsSpeed = document.getElementById('btnSettingsSpeed');
    this.settingsCurrentSpeedText = document.getElementById('settingsCurrentSpeedText');
    this.btnBackFromSpeed = document.getElementById('btnBackFromSpeed');
    this.speedOptionsList = document.getElementById('speedOptionsList');
    this.customSpeedSlider = document.getElementById('customSpeedSlider');
    this.customSpeedVal = document.getElementById('customSpeedVal');

    this.btnSettingsSeek = document.getElementById('btnSettingsSeek');
    this.settingsCurrentSeekText = document.getElementById('settingsCurrentSeekText');
    this.btnBackFromSeek = document.getElementById('btnBackFromSeek');
    this.seekOptionsList = document.getElementById('seekOptionsList');

    // Seek interval configuration (default 10s, options: 5, 10, 15, 20, 25, 30s)
    this.seekInterval = parseInt(localStorage.getItem('xplayer_seek_interval'), 10) || 10;

    this.btnSettingsAudio = document.getElementById('btnSettingsAudio');
    this.settingsCurrentAudioText = document.getElementById('settingsCurrentAudioText');
    this.btnBackFromAudio = document.getElementById('btnBackFromAudio');
    this.audioOptionsList = document.getElementById('audioOptionsList');

    this.btnSettingsSubs = document.getElementById('btnSettingsSubs');
    this.settingsCurrentSubText = document.getElementById('settingsCurrentSubText');
    this.btnBackFromSub = document.getElementById('btnBackFromSub');
    this.subOptionsList = document.getElementById('subOptionsList');

    this.btnSettingsStats = document.getElementById('btnSettingsStats');
    this.statsPanel = document.getElementById('statsPanel');
    this.statsBody = document.getElementById('statsBody');
    this.btnCloseStats = document.getElementById('btnCloseStats');

    // Toast & HUD
    this.toastMessage = document.getElementById('toastMessage');
    this.volumeHud = document.getElementById('volumeHud');
    this.volumeHudFill = document.getElementById('volumeHudFill');
    this.volumeHudText = document.getElementById('volumeHudText');
    this.volumeHudIcon = document.getElementById('volumeHudIcon');

    // Lock Feature
    this.btnLockPlayer = document.getElementById('btnLockPlayer');
    this.iconLockOpen = document.getElementById('iconLockOpen');
    this.iconLockClosed = document.getElementById('iconLockClosed');
    this.floatingLockBadge = document.getElementById('floatingLockBadge');
    this.btnFloatingUnlock = document.getElementById('btnFloatingUnlock');
    this.isLocked = false;
    this.floatingLockTimer = null;

    // Autoplay, Quality, and Skip Intro Elements
    this.btnAutoplayToggle = document.getElementById('btnAutoplayToggle');
    this.isAutoplayEnabled = localStorage.getItem('vidplayer_autoplay') !== 'false';

    this.btnSettingsQuality = document.getElementById('btnSettingsQuality');
    this.settingsCurrentQualityText = document.getElementById('settingsCurrentQualityText');
    this.btnBackFromQuality = document.getElementById('btnBackFromQuality');
    this.settingsQualityView = document.getElementById('settingsQualityView');
    this.qualityOptionsList = document.getElementById('qualityOptionsList');

    this.btnSettingsAutoSkip = document.getElementById('btnSettingsAutoSkip');
    this.settingsAutoSkipStatus = document.getElementById('settingsAutoSkipStatus');
    this.btnSkipIntroOverlay = document.getElementById('btnSkipIntroOverlay');
    this.txtSkipIntroLabel = document.getElementById('txtSkipIntroLabel');
    this.isAutoSkipIntro = localStorage.getItem('vidplayer_autoskip_intro') !== 'false';
    this.hasAutoSkippedCurrentMedia = false;

    // Autohide state
    this.autohideTimer = null;
    this.isControlsFaded = false;
    this.isDraggingScrubber = false;

    this.initScrubber();
    this.initTransport();
    this.initVolume();
    this.initLock();
    this.initSettingsMenu();
    this.initSpeedOptions();
    this.initSeekOptions();
    this.initAutoplayToggle();
    this.initAutoSkipIntro();
    this.initQualityControls();
    this.initAutohide();
    this.initPlayerEvents();
    this.initStats();
  }

  /* ==========================================================================
     Scrubber / Progress Bar
     ========================================================================== */
  initScrubber() {
    const handleMove = (clientX) => {
      const rect = this.progressBarContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const fraction = rect.width > 0 ? (pos / rect.width) : 0;
      const duration = this.player.getDuration();
      const hoverTime = duration * fraction;

      // Update hover line
      this.progressHover.style.width = `${fraction * 100}%`;

      // Position tooltip
      this.scrubberTooltip.textContent = this.formatTime(hoverTime);
      this.scrubberTooltip.style.left = `${pos}px`;
      this.scrubberTooltip.classList.remove('hidden');

      return fraction;
    };

    this.progressBarContainer.addEventListener('mousemove', (e) => {
      handleMove(e.clientX);
    });

    this.progressBarContainer.addEventListener('mouseleave', () => {
      if (!this.isDraggingScrubber) {
        this.progressHover.style.width = '0%';
        this.scrubberTooltip.classList.add('hidden');
      }
    });

    this.progressBarContainer.addEventListener('mousedown', (e) => {
      this.isDraggingScrubber = true;
      this.progressBarContainer.classList.add('dragging');
      const fraction = handleMove(e.clientX);
      this.player.seekPercent(fraction);

      const onMouseMove = (moveEvent) => {
        if (this.isDraggingScrubber) {
          const moveFrac = handleMove(moveEvent.clientX);
          this.progressPlayed.style.width = `${moveFrac * 100}%`;
          this.scrubKnob.style.left = `${moveFrac * 100}%`;
          this.currentTimeDisplay.textContent = this.formatTime(this.player.getDuration() * moveFrac);
        }
      };

      const onMouseUp = (upEvent) => {
        if (this.isDraggingScrubber) {
          this.isDraggingScrubber = false;
          this.progressBarContainer.classList.remove('dragging');
          const finalFrac = handleMove(upEvent.clientX);
          this.player.seekPercent(finalFrac);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Keyboard accessibility for scrubber (Arrow Left / Right seeks)
    this.progressBarContainer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.player.seekRelative(-5);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        this.player.seekRelative(5);
        e.preventDefault();
      }
    });
  }

  /* ==========================================================================
     Transport Controls (Play, Pause, Replay, 10s Seek)
     ========================================================================== */
  initTransport() {
    this.btnPlayPause.addEventListener('click', () => {
      this.player.togglePlayPause();
      this.btnPlayPause.blur();
    });

    this.btnRewind10.addEventListener('click', () => {
      this.player.seekRelative(-this.seekInterval);
      window.gesturesEngine.showSeekRipple('left', this.seekInterval);
      this.btnRewind10.blur();
    });

    this.btnForward10.addEventListener('click', () => {
      this.player.seekRelative(this.seekInterval);
      window.gesturesEngine.showSeekRipple('right', this.seekInterval);
      this.btnForward10.blur();
    });

    this.btnMiniplayer.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          await this.player.video.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error:', err);
      }
      this.btnMiniplayer.blur();
    });

    this.btnFullscreen.addEventListener('click', () => {
      this.toggleFullscreen();
      this.btnFullscreen.blur();
    });

    window.addEventListener('controls:togglefullscreen', () => {
      this.toggleFullscreen();
    });

    if (this.timeDisplay) {
      this.timeDisplay.addEventListener('click', () => {
        this.showRemainingTime = !this.showRemainingTime;
        this.updateTimeDisplay();
      });
    }
  }

  async toggleFullscreen() {
    if (window.electronAPI) {
      const isFull = await window.electronAPI.isFullScreen();
      await window.electronAPI.setFullScreen(!isFull);
      this.updateFullscreenIcon(!isFull);
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        this.updateFullscreenIcon(true);
      } else {
        document.exitFullscreen().catch(() => {});
        this.updateFullscreenIcon(false);
      }
    }
  }

  updateFullscreenIcon(isFull) {
    if (isFull) {
      this.iconEnterFullscreen.classList.add('hidden');
      this.iconExitFullscreen.classList.remove('hidden');
    } else {
      this.iconEnterFullscreen.classList.remove('hidden');
      this.iconExitFullscreen.classList.add('hidden');
    }
  }

  /* ==========================================================================
     Volume Control
     ========================================================================== */
  initVolume() {
    this.btnVolume.addEventListener('click', () => {
      this.player.toggleMute();
      this.btnVolume.blur();
    });

    this.volumeSlider.addEventListener('input', (e) => {
      this.player.setVolume(parseFloat(e.target.value));
    });

    // Scroll wheel on volume container or video adjusts volume
    this.videoWrapper.addEventListener('wheel', (e) => {
      if (this.isLocked) return;
      if (e.target.closest('#settingsMenu') || e.target.closest('#shortcutsModal')) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const newVol = this.player.adjustVolume(delta);
      this.showVolumeHud(newVol);
    }, { passive: false });
  }

  updateVolumeUI(vol, muted) {
    this.volumeSlider.value = muted ? 0 : vol;

    if (muted || vol === 0) {
      this.iconVolumeHigh.classList.add('hidden');
      this.iconVolumeLow.classList.add('hidden');
      this.iconVolumeMute.classList.remove('hidden');
    } else if (vol < 0.5) {
      this.iconVolumeHigh.classList.add('hidden');
      this.iconVolumeLow.classList.remove('hidden');
      this.iconVolumeMute.classList.add('hidden');
    } else {
      this.iconVolumeHigh.classList.remove('hidden');
      this.iconVolumeLow.classList.add('hidden');
      this.iconVolumeMute.classList.add('hidden');
    }
  }

  showVolumeHud(vol) {
    const pct = Math.round(vol * 100);
    this.volumeHudText.textContent = `${pct}%`;
    this.volumeHudFill.style.width = `${pct}%`;

    const iconSvg = vol === 0
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm4.13-9L19.36 4.27l-9 9L4.27 3 3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

    this.volumeHudIcon.innerHTML = iconSvg;
    this.volumeHud.classList.remove('hidden');

    clearTimeout(this.volumeHudTimer);
    this.volumeHudTimer = setTimeout(() => {
      this.volumeHud.classList.add('hidden');
    }, 1200);
  }

  showToast(text) {
    this.toastMessage.textContent = text;
    this.toastMessage.classList.remove('hidden');

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.classList.add('hidden');
    }, 1200);
  }

  /* ==========================================================================
     Lock Player Feature
     ========================================================================== */
  initLock() {
    if (this.btnLockPlayer) {
      this.btnLockPlayer.addEventListener('click', () => {
        this.toggleLock();
        this.btnLockPlayer.blur();
      });
    }

    if (this.btnFloatingUnlock) {
      this.btnFloatingUnlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setLock(false);
      });
    }
  }

  toggleLock() {
    this.setLock(!this.isLocked);
  }

  setLock(locked) {
    this.isLocked = !!locked;
    if (this.isLocked) {
      this.closeSettings();
      clearTimeout(this.autohideTimer);
      if (this.videoWrapper) {
        this.videoWrapper.classList.add('is-player-locked');
        this.videoWrapper.classList.remove('cursor-hidden');
      }
      if (this.controlsBar) this.controlsBar.classList.add('faded', 'locked');
      if (this.iconLockOpen) this.iconLockOpen.classList.add('hidden');
      if (this.iconLockClosed) this.iconLockClosed.classList.remove('hidden');
      if (this.btnLockPlayer) this.btnLockPlayer.title = 'Buka Kunci Player';
      if (this.floatingLockBadge) this.floatingLockBadge.classList.add('hidden');

      this.showToast('Player Terkunci (Klik layar untuk membuka)');
    } else {
      if (this.videoWrapper) this.videoWrapper.classList.remove('is-player-locked');
      if (this.controlsBar) this.controlsBar.classList.remove('locked', 'faded');
      if (this.iconLockOpen) this.iconLockOpen.classList.remove('hidden');
      if (this.iconLockClosed) this.iconLockClosed.classList.add('hidden');
      if (this.btnLockPlayer) this.btnLockPlayer.title = 'Kunci Kontrol Player';
      if (this.floatingLockBadge) this.floatingLockBadge.classList.add('hidden');
      this.isControlsFaded = false;
      this.showToast('Kunci Player Dibuka');
    }
  }

  showUnlockButtonBriefly() {
    if (!this.isLocked || !this.floatingLockBadge) return;
    this.floatingLockBadge.classList.remove('hidden');
    clearTimeout(this.floatingLockTimer);
    this.floatingLockTimer = setTimeout(() => {
      if (this.isLocked && this.floatingLockBadge) {
        this.floatingLockBadge.classList.add('hidden');
      }
    }, 3000);
  }

  /* ==========================================================================
     Speed Controls (up to 4.0x) & Settings Menu
     ========================================================================== */
  initSpeedOptions() {
    // YouTube standard presets extended up to 4.0x
    const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0];
    this.speedOptionsList.innerHTML = '';

    speedPresets.forEach(speed => {
      const btn = document.createElement('button');
      btn.className = 'speed-option-btn';
      btn.dataset.speed = speed;
      btn.innerHTML = `
        <span>${speed === 1.0 ? 'Normal' : speed + 'x'}</span>
        <span class="speed-check-icon ${speed === 1.0 ? '' : 'hidden'}">✓</span>
      `;

      btn.addEventListener('click', () => {
        this.player.setPlaybackRate(speed);
        this.updateSpeedUI(speed);
        this.showToast(`Kecepatan: ${speed}x`);
      });

      this.speedOptionsList.appendChild(btn);
    });

    // Custom speed slider
    this.customSpeedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      this.customSpeedVal.textContent = `${speed.toFixed(2)}x`;
      this.player.setPlaybackRate(speed);
      this.updateSpeedUI(speed);
    });
  }

  updateSpeedUI(speed) {
    const isNormal = speed === 1.0;
    const speedStr = isNormal ? '1x' : `${speed}x`;

    this.speedBadgeText.textContent = speedStr;
    this.settingsCurrentSpeedText.textContent = isNormal ? 'Normal' : `${speed}x`;
    this.customSpeedVal.textContent = `${speed.toFixed(2)}x`;
    this.customSpeedSlider.value = speed;

    // Highlight matching button in list
    const buttons = this.speedOptionsList.querySelectorAll('.speed-option-btn');
    buttons.forEach(btn => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      const isMatch = Math.abs(btnSpeed - speed) < 0.01;
      btn.classList.toggle('active', isMatch);
      const check = btn.querySelector('.speed-check-icon');
      if (check) check.classList.toggle('hidden', !isMatch);
    });
  }

  initSettingsMenu() {
    this.btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSettings();
    });

    this.btnSpeedQuick.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openSpeedSubmenu();
    });

    // Submenu navigations
    this.btnSettingsSpeed.addEventListener('click', () => {
      this.showSubView(this.settingsSpeedView);
    });

    this.btnBackFromSpeed.addEventListener('click', () => {
      this.showSubView(this.settingsMainView);
    });

    this.btnSettingsAudio.addEventListener('click', () => {
      this.renderAudioTracks();
      this.showSubView(this.settingsAudioView);
    });

    this.btnBackFromAudio.addEventListener('click', () => {
      this.showSubView(this.settingsMainView);
    });

    this.btnSettingsSubs.addEventListener('click', () => {
      this.renderSubtitleTracks();
      this.showSubView(this.settingsSubView);
    });

    this.btnBackFromSub.addEventListener('click', () => {
      this.showSubView(this.settingsMainView);
    });

    this.btnSettingsSeek.addEventListener('click', () => {
      this.showSubView(this.settingsSeekView);
    });

    this.btnBackFromSeek.addEventListener('click', () => {
      this.showSubView(this.settingsMainView);
    });

    this.btnSettingsStats.addEventListener('click', () => {
      this.toggleStats();
    });

    if (this.btnSettingsQuality) {
      this.btnSettingsQuality.addEventListener('click', () => {
        this.renderQualityOptions();
        this.showSubView(this.settingsQualityView);
      });
    }

    if (this.btnBackFromQuality) {
      this.btnBackFromQuality.addEventListener('click', () => {
        this.showSubView(this.settingsMainView);
      });
    }

    if (this.btnSettingsAutoSkip) {
      this.btnSettingsAutoSkip.addEventListener('click', () => {
        this.toggleAutoSkipIntro();
      });
    }

    // Close settings when clicking outside
    window.addEventListener('click', (e) => {
      if (!this.settingsMenu.contains(e.target) && e.target !== this.btnSettings && e.target !== this.btnSpeedQuick) {
        this.closeSettings();
      }
    });

    // Subtitle CC button
    this.btnSubtitles.addEventListener('click', () => {
      this.toggleSubtitlesCC();
      this.btnSubtitles.blur();
    });
  }

  initSeekOptions() {
    const intervals = [5, 10, 15, 20, 25, 30];
    if (!this.seekOptionsList) return;
    this.seekOptionsList.innerHTML = '';

    intervals.forEach(sec => {
      const btn = document.createElement('button');
      btn.className = 'seek-option-btn';
      btn.dataset.sec = sec;
      const isSelected = sec === this.seekInterval;
      btn.innerHTML = `
        <span>${sec} detik</span>
        <span class="seek-check-icon ${isSelected ? '' : 'hidden'}">✓</span>
      `;

      btn.addEventListener('click', () => {
        this.setSeekInterval(sec);
        this.showToast(`Durasi lompat: ${sec} detik`);
      });

      this.seekOptionsList.appendChild(btn);
    });

    this.updateSeekUI(this.seekInterval);
  }

  setSeekInterval(sec) {
    this.seekInterval = sec;
    localStorage.setItem('xplayer_seek_interval', sec);
    this.updateSeekUI(sec);
  }

  updateSeekUI(sec) {
    if (this.settingsCurrentSeekText) {
      this.settingsCurrentSeekText.textContent = `${sec}s`;
    }

    const rewindText = this.btnRewind10 ? this.btnRewind10.querySelector('text') : null;
    const forwardText = this.btnForward10 ? this.btnForward10.querySelector('text') : null;
    if (rewindText) rewindText.textContent = sec;
    if (forwardText) forwardText.textContent = sec;

    if (this.btnRewind10) this.btnRewind10.title = `Mundur ${sec} detik (j)`;
    if (this.btnForward10) this.btnForward10.title = `Maju ${sec} detik (l)`;

    if (this.seekOptionsList) {
      const buttons = this.seekOptionsList.querySelectorAll('.seek-option-btn');
      buttons.forEach(btn => {
        const val = parseInt(btn.dataset.sec, 10);
        const match = val === sec;
        btn.classList.toggle('active', match);
        const icon = btn.querySelector('.seek-check-icon');
        if (icon) icon.classList.toggle('hidden', !match);
      });
    }
  }

  toggleSettings() {
    if (this.settingsMenu.classList.contains('hidden')) {
      this.showSubView(this.settingsMainView);
      this.settingsMenu.classList.remove('hidden');
    } else {
      this.closeSettings();
    }
  }

  openSpeedSubmenu() {
    this.showSubView(this.settingsSpeedView);
    this.settingsMenu.classList.remove('hidden');
  }

  closeSettings() {
    this.settingsMenu.classList.add('hidden');
  }

  showSubView(viewEl) {
    [
      this.settingsMainView,
      this.settingsSpeedView,
      this.settingsAudioView,
      this.settingsSubView,
      this.settingsSeekView,
      this.settingsQualityView
    ].forEach(v => {
      if (v) v.classList.add('hidden');
    });
    if (viewEl) viewEl.classList.remove('hidden');
  }

  initQualityControls() {
    window.addEventListener('player:qualitiesupdated', (e) => {
      const { availableQualities, currentQuality } = e.detail;
      if (this.settingsCurrentQualityText) {
        this.settingsCurrentQualityText.textContent = currentQuality || '720p HD';
      }
      if (this.btnSettingsQuality) {
        if (Array.isArray(availableQualities) && availableQualities.length > 0) {
          this.btnSettingsQuality.classList.remove('hidden');
        } else {
          this.btnSettingsQuality.classList.add('hidden');
        }
      }
    });

    window.addEventListener('player:qualitychanged', (e) => {
      const { quality } = e.detail;
      if (this.settingsCurrentQualityText) {
        this.settingsCurrentQualityText.textContent = quality || '720p HD';
      }
      this.showToast(`Kualitas video: ${quality}`);
    });

    window.addEventListener('player:toast', (e) => {
      if (e.detail && e.detail.message) {
        this.showToast(e.detail.message);
      }
    });
  }

  renderQualityOptions() {
    if (!this.qualityOptionsList) return;
    this.qualityOptionsList.innerHTML = '';
    const qualities = this.player.availableQualities || [];

    if (qualities.length === 0) {
      this.qualityOptionsList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">Hanya resolusi default / lokal</div>';
      return;
    }

    qualities.forEach(q => {
      const isCurrent = (this.player.currentQuality === q.quality) || (!this.player.currentQuality && q.isDefault);
      const btn = document.createElement('button');
      btn.className = `quality-option-btn ${isCurrent ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${q.label || q.quality}</span>
        ${isCurrent ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
      `;

      btn.addEventListener('click', async () => {
        this.closeSettings();
        this.showToast(`Mengubah kualitas ke ${q.quality}...`);
        await this.player.switchQuality(q.streamUrl, q.quality);
      });

      this.qualityOptionsList.appendChild(btn);
    });
  }

  /* ==========================================================================
     YouTube-Style Autoplay Toggle
     ========================================================================== */
  initAutoplayToggle() {
    this.updateAutoplayUI();
    if (this.btnAutoplayToggle) {
      this.btnAutoplayToggle.addEventListener('click', () => {
        this.toggleAutoplay();
        this.btnAutoplayToggle.blur();
      });
    }
  }

  toggleAutoplay() {
    this.isAutoplayEnabled = !this.isAutoplayEnabled;
    localStorage.setItem('vidplayer_autoplay', this.isAutoplayEnabled ? 'true' : 'false');
    this.updateAutoplayUI();
    this.showToast(`Putar otomatis: ${this.isAutoplayEnabled ? 'Aktif' : 'Nonaktif'}`);
    window.dispatchEvent(new CustomEvent('player:autoplaytoggle', { detail: { enabled: this.isAutoplayEnabled } }));
  }

  updateAutoplayUI() {
    if (!this.btnAutoplayToggle) return;
    const playIcon = this.btnAutoplayToggle.querySelector('.yt-switch-play-icon');
    const pauseIcon = this.btnAutoplayToggle.querySelector('.yt-switch-pause-icon');

    if (this.isAutoplayEnabled) {
      this.btnAutoplayToggle.classList.add('active');
      this.btnAutoplayToggle.title = 'Putar otomatis episode berikutnya aktif';
      if (playIcon) playIcon.classList.remove('hidden');
      if (pauseIcon) pauseIcon.classList.add('hidden');
    } else {
      this.btnAutoplayToggle.classList.remove('active');
      this.btnAutoplayToggle.title = 'Putar otomatis episode berikutnya nonaktif';
      if (playIcon) playIcon.classList.add('hidden');
      if (pauseIcon) pauseIcon.classList.remove('hidden');
    }
  }

  /* ==========================================================================
     Auto-Skip Intro & Floating Skip Button
     ========================================================================== */
  initAutoSkipIntro() {
    this.updateAutoSkipUI();
    if (this.btnSettingsAutoSkip) {
      this.btnSettingsAutoSkip.addEventListener('click', () => {
        this.toggleAutoSkipIntro();
      });
    }

    if (this.btnSkipIntroOverlay) {
      this.btnSkipIntroOverlay.addEventListener('click', () => {
        this.triggerSkipIntro();
      });
    }

    window.addEventListener('player:medialoaded', () => {
      this.hasAutoSkippedCurrentMedia = false;
      if (this.btnSkipIntroOverlay) this.btnSkipIntroOverlay.classList.add('hidden');
    });
  }

  toggleAutoSkipIntro() {
    this.isAutoSkipIntro = !this.isAutoSkipIntro;
    localStorage.setItem('vidplayer_autoskip_intro', this.isAutoSkipIntro ? 'true' : 'false');
    this.updateAutoSkipUI();
    this.showToast(`Auto-Skip Intro: ${this.isAutoSkipIntro ? 'Aktif' : 'Nonaktif'}`);
  }

  updateAutoSkipUI() {
    if (this.settingsAutoSkipStatus) {
      this.settingsAutoSkipStatus.textContent = this.isAutoSkipIntro ? 'Aktif' : 'Nonaktif';
    }
  }

  triggerSkipIntro() {
    const intervals = this.player.getSkipIntervals();
    if (intervals && intervals.op && intervals.op.endTime) {
      this.player.seek(intervals.op.endTime);
    } else {
      this.player.seekRelative(85);
    }
    if (this.btnSkipIntroOverlay) this.btnSkipIntroOverlay.classList.add('hidden');
    this.showToast('Intro anime dilewati');
  }

  handleTimeUpdateForSkip(currentTime) {
    const intervals = this.player.getSkipIntervals();

    if (intervals && intervals.op) {
      const { startTime, endTime } = intervals.op;
      if (currentTime >= startTime && currentTime < endTime) {
        if (this.isAutoSkipIntro && !this.hasAutoSkippedCurrentMedia) {
          this.hasAutoSkippedCurrentMedia = true;
          this.player.seek(endTime);
          this.showToast('Intro anime dilewati (Auto-Skip)');
          if (this.btnSkipIntroOverlay) this.btnSkipIntroOverlay.classList.add('hidden');
        } else {
          if (this.btnSkipIntroOverlay) this.btnSkipIntroOverlay.classList.remove('hidden');
        }
        return;
      }
    }

    if (this.btnSkipIntroOverlay && !this.btnSkipIntroOverlay.classList.contains('hidden')) {
      this.btnSkipIntroOverlay.classList.add('hidden');
    }
  }

  renderAudioTracks() {
    this.audioOptionsList.innerHTML = '';
    const audioStreams = this.player.mediaInfo?.audioStreams || [];

    if (audioStreams.length === 0) {
      this.audioOptionsList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">Hanya trek audio default</div>';
      return;
    }

    audioStreams.forEach((stream, idx) => {
      const btn = document.createElement('button');
      btn.className = `audio-option-btn ${this.player.selectedAudioTrack === idx ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${stream.title || stream.language || `Track ${idx + 1}`}</span>
        <span class="${this.player.selectedAudioTrack === idx ? '' : 'hidden'}">✓</span>
      `;
      btn.addEventListener('click', () => {
        this.player.selectAudioTrack(idx);
        this.settingsCurrentAudioText.textContent = stream.language || `Track ${idx + 1}`;
        this.renderAudioTracks();
      });
      this.audioOptionsList.appendChild(btn);
    });
  }

  renderSubtitleTracks() {
    this.subOptionsList.innerHTML = '';
    const subStreams = this.player.mediaInfo?.subtitleStreams || [];

    // Off button
    const btnOff = document.createElement('button');
    btnOff.className = `sub-option-btn ${this.player.selectedSubTrack === -1 ? 'active' : ''}`;
    btnOff.innerHTML = `
      <span>Nonaktif</span>
      <span class="${this.player.selectedSubTrack === -1 ? '' : 'hidden'}">✓</span>
    `;
    btnOff.addEventListener('click', () => {
      this.player.selectSubtitleTrack(-1);
      this.updateSubtitleUI(false);
      this.renderSubtitleTracks();
    });
    this.subOptionsList.appendChild(btnOff);

    // Embedded subtitle tracks
    subStreams.forEach((sub, idx) => {
      const btn = document.createElement('button');
      btn.className = `sub-option-btn ${this.player.selectedSubTrack === idx ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${sub.title || sub.language || `Subtitle ${idx + 1}`}</span>
        <span class="${this.player.selectedSubTrack === idx ? '' : 'hidden'}">✓</span>
      `;
      btn.addEventListener('click', () => {
        this.player.selectSubtitleTrack(idx);
        this.updateSubtitleUI(true, sub.language || `Sub ${idx + 1}`);
        this.renderSubtitleTracks();
      });
      this.subOptionsList.appendChild(btn);
    });
  }

  toggleSubtitlesCC() {
    const subStreams = this.player.mediaInfo?.subtitleStreams || [];
    if (this.player.selectedSubTrack === -1) {
      if (subStreams.length > 0) {
        this.player.selectSubtitleTrack(0);
        this.updateSubtitleUI(true, subStreams[0].language || 'Track 1');
      } else {
        this.showToast('Tidak ada track subtitle');
      }
    } else {
      this.player.selectSubtitleTrack(-1);
      this.updateSubtitleUI(false);
    }
  }

  updateSubtitleUI(active, label = '') {
    if (active) {
      this.subtitlesActiveBar.classList.remove('hidden');
      this.settingsCurrentSubText.textContent = label || 'Aktif';
      this.showToast(`Subtitle: ${label || 'Aktif'}`);
    } else {
      this.subtitlesActiveBar.classList.add('hidden');
      this.settingsCurrentSubText.textContent = 'Nonaktif';
      this.showToast('Subtitle: Nonaktif');
    }
  }

  /* ==========================================================================
     Autohide Controls on Inactivity
     ========================================================================== */
  initAutohide() {
    const resetTimer = () => {
      if (this.isLocked) {
        if (this.videoWrapper) {
          this.videoWrapper.classList.remove('cursor-hidden');
        }
        return;
      }

      if (this.isControlsFaded) {
        this.controlsBar.classList.remove('faded');
        if (this.playerTopBar) this.playerTopBar.classList.remove('faded');
        this.videoWrapper.classList.remove('cursor-hidden');
        this.isControlsFaded = false;
      }

      clearTimeout(this.autohideTimer);

      // Only autohide when video is playing and not hovering on controls
      if (!this.player.video.paused && !this.isDraggingScrubber) {
        this.autohideTimer = setTimeout(() => {
          if (!this.player.video.paused && !this.isDraggingScrubber && this.settingsMenu.classList.contains('hidden')) {
            this.controlsBar.classList.add('faded');
            if (this.playerTopBar) this.playerTopBar.classList.add('faded');
            this.videoWrapper.classList.add('cursor-hidden');
            this.isControlsFaded = true;
          }
        }, 2500);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('player:statechange', resetTimer);
  }

  setTopBarInfo(title, episode = '') {
    const titleEl = document.getElementById('videoTitleDisplay');
    if (titleEl) {
      titleEl.textContent = title ? (episode ? `${title} • ${episode}` : title) : '';
    }
    if (this.playerTopTitle) this.playerTopTitle.textContent = title || '';
    if (this.playerTopEpisode) {
      this.playerTopEpisode.textContent = episode ? `• ${episode}` : '';
    }
  }

  /* ==========================================================================
     Stats for Nerds
     ========================================================================== */
  initStats() {
    this.btnCloseStats.addEventListener('click', () => {
      this.statsPanel.classList.add('hidden');
    });

    setInterval(() => {
      if (!this.statsPanel.classList.contains('hidden')) {
        this.updateStatsContent();
      }
    }, 1000);
  }

  toggleStats() {
    this.statsPanel.classList.toggle('hidden');
    const isShown = !this.statsPanel.classList.contains('hidden');
    document.getElementById('settingsStatsStatus').textContent = isShown ? 'Aktif' : 'Nonaktif';
    if (isShown) {
      this.updateStatsContent();
      this.closeSettings();
    }
  }

  updateStatsContent() {
    const info = this.player.mediaInfo;
    const v = this.player.video;
    const dur = this.player.getDuration();
    const cur = this.player.getCurrentTime();

    let bufferedEnd = 0;
    if (v.buffered.length > 0) {
      bufferedEnd = v.buffered.end(v.buffered.length - 1);
    }

    this.statsBody.innerHTML = `
      <div class="stats-row"><span class="stats-label">Mode Playback:</span><span class="stats-val">${this.player.playbackMode.toUpperCase()}</span></div>
      <div class="stats-row"><span class="stats-label">Resolusi:</span><span class="stats-val">${info?.video ? `${info.video.width}x${info.video.height}` : 'N/A'}</span></div>
      <div class="stats-row"><span class="stats-label">Video Codec:</span><span class="stats-val">${info?.video?.codec || 'N/A'}</span></div>
      <div class="stats-row"><span class="stats-label">FPS:</span><span class="stats-val">${info?.video?.fps || 'N/A'}</span></div>
      <div class="stats-row"><span class="stats-label">Audio Codec:</span><span class="stats-val">${info?.audioStreams?.[this.player.selectedAudioTrack]?.codec || 'N/A'}</span></div>
      <div class="stats-row"><span class="stats-label">Kecepatan:</span><span class="stats-val">${v.playbackRate}x</span></div>
      <div class="stats-row"><span class="stats-label">Buffer Health:</span><span class="stats-val">${Math.max(0, bufferedEnd - v.currentTime).toFixed(1)}s</span></div>
      <div class="stats-row"><span class="stats-label">Dropped Frames:</span><span class="stats-val">${v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().droppedVideoFrames : 0}</span></div>
    `;
  }

  /* ==========================================================================
     Player Events Sync
     ========================================================================== */
  initPlayerEvents() {
    window.addEventListener('player:statechange', (e) => {
      const isPlaying = e.detail.isPlaying;
      if (isPlaying) {
        this.iconPlay.classList.add('hidden');
        this.iconPause.classList.remove('hidden');
        this.iconReplay.classList.add('hidden');
        this.btnPlayPause.title = 'Jeda (k / Spasi)';
        this.btnPlayPause.setAttribute('aria-label', 'Jeda');
      } else {
        this.iconPlay.classList.remove('hidden');
        this.iconPause.classList.add('hidden');
        this.iconReplay.classList.add('hidden');
        this.btnPlayPause.title = 'Putar (k / Spasi)';
        this.btnPlayPause.setAttribute('aria-label', 'Putar');
      }
    });

    window.addEventListener('player:timeupdate', (e) => {
      const { currentTime, duration, progress } = e.detail;
      if (!this.isDraggingScrubber) {
        this.progressPlayed.style.width = `${progress * 100}%`;
        this.scrubKnob.style.left = `${progress * 100}%`;
        this.updateTimeDisplay(currentTime, duration);
        this.progressBarContainer.setAttribute('aria-valuenow', Math.round(progress * 100));
      }
      this.handleTimeUpdateForSkip(currentTime);
    });

    window.addEventListener('player:bufferupdate', (e) => {
      this.progressBuffer.style.width = `${e.detail.fraction * 100}%`;
    });

    window.addEventListener('player:volumechange', (e) => {
      this.updateVolumeUI(e.detail.volume, e.detail.muted);
    });

    window.addEventListener('player:ratechange', (e) => {
      this.updateSpeedUI(e.detail.rate);
    });

    window.addEventListener('player:ended', () => {
      this.iconPlay.classList.add('hidden');
      this.iconPause.classList.add('hidden');
      this.iconReplay.classList.remove('hidden');
      this.btnPlayPause.title = 'Putar Ulang';
      this.btnPlayPause.setAttribute('aria-label', 'Putar Ulang');
    });
  }

  updateTimeDisplay(curTime, durTime) {
    if (curTime !== undefined) this.lastCurrentTime = curTime;
    if (durTime !== undefined) this.lastDuration = durTime;

    const cur = curTime !== undefined ? curTime : (this.lastCurrentTime !== undefined ? this.lastCurrentTime : this.player.getCurrentTime());
    const dur = durTime !== undefined ? durTime : (this.lastDuration !== undefined ? this.lastDuration : this.player.getDuration());
    this.currentTimeDisplay.textContent = this.formatTime(cur);

    if (this.showRemainingTime) {
      const remaining = Math.max(0, dur - cur);
      this.totalDurationDisplay.textContent = `-${this.formatTime(remaining)}`;
      if (this.timeDisplay) this.timeDisplay.title = 'Waktu tersisa (klik untuk beralih ke total durasi)';
    } else {
      this.totalDurationDisplay.textContent = this.formatTime(dur);
      if (this.timeDisplay) this.timeDisplay.title = 'Total durasi (klik untuk beralih ke sisa waktu)';
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

window.controlsManager = new ControlsManager(window.playerCore);

