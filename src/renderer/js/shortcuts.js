/**
 * Complete YouTube Shortcuts Mapping
 * Maps:
 * - k: Play / Pause
 * - j / l: Seek -10s / +10s
 * - Left / Right Arrow: Seek -5s / +5s
 * - Up / Down Arrow: Volume +5% / -5%
 * - m: Mute / Unmute
 * - f: Fullscreen toggle
 * - t: Theater mode toggle
 * - i: Miniplayer (PiP) toggle
 * - c: Subtitle toggle
 * - 0 - 9: Jump to 0% - 90%
 * - > / <: Playback rate +0.25x / -0.25x (up to 4x)
 * - , / .: Frame step backward / forward (while paused)
 * - Home / End: Beginning / End
 * - Ctrl + O: Open video file
 * - ?: Shortcuts modal toggle
 * - Esc: Close dialogs
 */
class ShortcutsEngine {
  constructor(player, controls) {
    this.player = player;
    this.controls = controls;
    this.shortcutsModal = document.getElementById('shortcutsModal');
    this.btnCloseShortcuts = document.getElementById('btnCloseShortcuts');
    this.btnShortcutsHelp = document.getElementById('btnShortcutsHelp');

    this.initListeners();
    this.initModal();
  }

  initModal() {
    this.btnShortcutsHelp.addEventListener('click', () => {
      this.toggleShortcutsModal();
    });

    this.btnCloseShortcuts.addEventListener('click', () => {
      this.closeShortcutsModal();
    });

    this.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === this.shortcutsModal) {
        this.closeShortcutsModal();
      }
    });
  }

  toggleShortcutsModal() {
    this.shortcutsModal.classList.toggle('hidden');
  }

  closeShortcutsModal() {
    this.shortcutsModal.classList.add('hidden');
  }

  initListeners() {
    window.addEventListener('keydown', (e) => {
      // Never capture or prevent default on Alt keys (e.g. Alt+Tab, Alt+F4)
      if (e.altKey) return;

      // When player is locked, suppress all shortcuts except unlock keys (L / Escape)
      if (this.controls && this.controls.isLocked) {
        if (e.key === 'l' || e.key === 'L' || e.key === 'Escape') {
          e.preventDefault();
          this.controls.setLock(false);
        }
        return;
      }

      // Toggle lock with Ctrl+L or Shift+L
      if ((e.ctrlKey && (e.key === 'l' || e.key === 'L')) || (e.shiftKey && (e.key === 'L' || e.key === 'l'))) {
        e.preventDefault();
        this.controls.toggleLock();
        return;
      }

      // Ignore if user is currently typing inside an input element
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // Escape key closes modals, settings menu, stats panel, or exits fullscreen
      if (e.key === 'Escape') {
        if (!this.shortcutsModal.classList.contains('hidden')) {
          this.closeShortcutsModal();
          e.preventDefault();
          return;
        }
        if (!this.controls.settingsMenu.classList.contains('hidden')) {
          this.controls.closeSettings();
          e.preventDefault();
          return;
        }
        if (!this.controls.statsPanel.classList.contains('hidden')) {
          this.controls.statsPanel.classList.add('hidden');
          e.preventDefault();
          return;
        }
        if (window.electronAPI && typeof window.electronAPI.isFullScreen === 'function') {
          window.electronAPI.isFullScreen().then(isFull => {
            if (isFull && this.controls && typeof this.controls.toggleFullscreen === 'function') {
              this.controls.toggleFullscreen();
            }
          }).catch(() => {});
        }
      }

      // Ctrl + O: Open file dialog
      if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:promptopenfile'));
        return;
      }

      // Zoom In: Ctrl + Plus, Ctrl + =, Ctrl + NumpadAdd
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.zoomIn) {
          const factor = window.electronAPI.zoomIn();
          if (this.controls && this.controls.showToast) {
            this.controls.showToast(`Zoom: ${Math.round(factor * 100)}%`);
          }
        }
        return;
      }

      // Zoom Out: Ctrl + Minus, Ctrl + _, Ctrl + NumpadSubtract
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.zoomOut) {
          const factor = window.electronAPI.zoomOut();
          if (this.controls && this.controls.showToast) {
            this.controls.showToast(`Zoom: ${Math.round(factor * 100)}%`);
          }
        }
        return;
      }

      // Reset Zoom: Ctrl + 0, Ctrl + Numpad0
      if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.resetZoom) {
          window.electronAPI.resetZoom();
          if (this.controls && this.controls.showToast) {
            this.controls.showToast('Zoom: 100% (Normal)');
          }
        }
        return;
      }

      // Help Modal: '?' or Shift + '/'
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this.toggleShortcutsModal();
        return;
      }

      // The following shortcuts require a video file loaded
      if (!this.player.hasMedia()) return;

      // k: Play / Pause
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const isPlaying = this.player.togglePlayPause();
        window.gesturesEngine.showCenterFeedback(isPlaying ? 'play' : 'pause');
        return;
      }

      // j: Seek backward by configured seconds
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const sec = this.controls.seekInterval;
        this.player.seekRelative(-sec);
        window.gesturesEngine.showSeekRipple('left', sec);
        return;
      }

      // l: Seek forward by configured seconds
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const sec = this.controls.seekInterval;
        this.player.seekRelative(sec);
        window.gesturesEngine.showSeekRipple('right', sec);
        return;
      }

      // Shift + N: Next Episode (YouTube style)
      if (e.shiftKey && (e.key === 'N' || e.key === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('player:playnextepisode'));
        return;
      }

      // s: Skip Intro
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (this.controls && typeof this.controls.triggerSkipIntro === 'function') {
          e.preventDefault();
          this.controls.triggerSkipIntro(true);
          return;
        }
      }

      // Left Arrow: Seek backward by configured seconds
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const sec = this.controls.seekInterval;
        this.player.seekRelative(-sec);
        this.controls.showToast(`-${sec} detik`);
        return;
      }

      // Right Arrow: Seek forward by configured seconds
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const sec = this.controls.seekInterval;
        this.player.seekRelative(sec);
        this.controls.showToast(`+${sec} detik`);
        return;
      }

      // Up Arrow: Volume +5%
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newVol = this.player.adjustVolume(0.05);
        this.controls.showVolumeHud(newVol);
        return;
      }

      // Down Arrow: Volume -5%
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newVol = this.player.adjustVolume(-0.05);
        this.controls.showVolumeHud(newVol);
        return;
      }

      // m: Toggle Mute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const isMuted = this.player.toggleMute();
        this.controls.showVolumeHud(isMuted ? 0 : this.player.video.volume);
        return;
      }

      // f: Fullscreen toggle
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.controls.toggleFullscreen();
        return;
      }

      // i: Miniplayer (Picture-in-Picture)
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        this.controls.btnMiniplayer.click();
        return;
      }

      // c: Captions / Subtitles toggle
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.controls.toggleSubtitlesCC();
        return;
      }

      // Number keys 0 - 9: Jump to 0% - 90%
      if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const fraction = parseInt(e.key, 10) / 10;
        this.player.seekPercent(fraction);
        this.controls.showToast(`Lompat: ${parseInt(e.key, 10) * 10}%`);
        return;
      }

      // Shift + > or . (faster speed up to 4x)
      if (e.key === '>' || (e.shiftKey && e.key === '.')) {
        e.preventDefault();
        const newRate = this.player.adjustPlaybackRate(0.25);
        this.controls.showToast(`Kecepatan: ${newRate}x`);
        return;
      }

      // Shift + < or , (slower speed down to 0.25x)
      if (e.key === '<' || (e.shiftKey && e.key === ',')) {
        e.preventDefault();
        const newRate = this.player.adjustPlaybackRate(-0.25);
        this.controls.showToast(`Kecepatan: ${newRate}x`);
        return;
      }

      // Frame stepping while paused: , (previous frame) and . (next frame)
      if (this.player.video.paused) {
        if (e.key === ',' && !e.shiftKey) {
          e.preventDefault();
          this.player.stepFrame(-1);
          return;
        }
        if (e.key === '.' && !e.shiftKey) {
          e.preventDefault();
          this.player.stepFrame(1);
          return;
        }
      }

      // Home: Jump to start (0s)
      if (e.key === 'Home') {
        e.preventDefault();
        this.player.seek(0);
        return;
      }

      // End: Jump to end
      if (e.key === 'End') {
        e.preventDefault();
        this.player.seek(this.player.getDuration());
        return;
      }
    });

    // Ctrl + Mouse Wheel: Smooth Zoom In / Out
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (window.electronAPI) {
          if (e.deltaY < 0 && window.electronAPI.zoomIn) {
            const factor = window.electronAPI.zoomIn();
            if (this.controls && this.controls.showToast) {
              this.controls.showToast(`Zoom: ${Math.round(factor * 100)}%`);
            }
          } else if (e.deltaY > 0 && window.electronAPI.zoomOut) {
            const factor = window.electronAPI.zoomOut();
            if (this.controls && this.controls.showToast) {
              this.controls.showToast(`Zoom: ${Math.round(factor * 100)}%`);
            }
          }
        }
      }
    }, { passive: false });
  }
}

window.shortcutsEngine = new ShortcutsEngine(window.playerCore, window.controlsManager);

