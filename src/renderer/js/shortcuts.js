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
      // Ignore if user is currently typing inside an input element
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // Escape key closes modals, settings menu, stats panel
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
      }

      // Ctrl + O: Open file dialog
      if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:promptopenfile'));
        return;
      }

      // Help Modal: '?' or Shift + '/'
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this.toggleShortcutsModal();
        return;
      }

      // The following shortcuts require a video file loaded
      if (!this.player.currentFilePath) return;

      // k: Play / Pause
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const isPlaying = this.player.togglePlayPause();
        window.gesturesEngine.showCenterFeedback(isPlaying ? 'play' : 'pause');
        return;
      }

      // j: Seek -10 seconds
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        this.player.seekRelative(-10);
        window.gesturesEngine.showSeekRipple('left');
        return;
      }

      // l: Seek +10 seconds
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.player.seekRelative(10);
        window.gesturesEngine.showSeekRipple('right');
        return;
      }

      // Left Arrow: Seek -5 seconds
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.player.seekRelative(-5);
        this.controls.showToast('-5 detik');
        return;
      }

      // Right Arrow: Seek +5 seconds
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.player.seekRelative(5);
        this.controls.showToast('+5 detik');
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

      // t: Theater Mode toggle
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        document.body.classList.toggle('theater-mode');
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
  }
}

window.shortcutsEngine = new ShortcutsEngine(window.playerCore, window.controlsManager);
