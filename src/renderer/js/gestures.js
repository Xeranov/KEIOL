/**
 * Gestures Engine
 * Manages:
 * 1. Hold Spacebar for 2X Speed Boost
 * 2. Hold Left Mouse Click on screen for 2X Speed Boost
 * 3. Double-click on left / right sides of video to seek 10 seconds
 */
class GesturesEngine {
  constructor(player) {
    this.player = player;
    this.videoWrapper = document.getElementById('videoWrapper');
    this.speedBoostPill = document.getElementById('speedBoostPill');
    this.seekRippleLeft = document.getElementById('seekRippleLeft');
    this.seekRippleRight = document.getElementById('seekRippleRight');
    this.centerFeedback = document.getElementById('centerFeedback');
    this.centerFeedbackIcon = document.getElementById('centerFeedbackIcon');

    // Mouse hold state
    this.mouseHoldTimer = null;
    this.isMouseHolding = false;
    this.mouseDownTime = 0;
    this.clickCount = 0;
    this.clickTimer = null;

    // Space hold state
    this.spaceHoldTimer = null;
    this.isSpaceHolding = false;
    this.spaceDownTime = 0;

    this.HOLD_THRESHOLD_MS = 200; // 200ms threshold for 2x speed boost

    this.initMouseGestures();
    this.initSpaceGestures();
    this.initBoostEvents();
  }

  initMouseGestures() {
    this.videoWrapper.addEventListener('mousedown', (e) => {
      // Only respond to primary left-click and ignore clicks on UI controls
      if (e.button !== 0 || e.target.closest('#controlsBar') || e.target.closest('#titleBar') || e.target.closest('#settingsMenu') || e.target.closest('#shortcutsModal')) {
        return;
      }

      this.mouseDownTime = Date.now();
      this.isMouseHolding = false;

      // Start hold timer
      clearTimeout(this.mouseHoldTimer);
      this.mouseHoldTimer = setTimeout(() => {
        // Only boost if video has a valid source and is playing/loaded
        if (this.player.currentFilePath) {
          this.isMouseHolding = true;
          this.player.setBoost2x(true);
        }
      }, this.HOLD_THRESHOLD_MS);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;

      clearTimeout(this.mouseHoldTimer);

      if (this.isMouseHolding) {
        // Released after holding: exit 2x boost
        this.isMouseHolding = false;
        this.player.setBoost2x(false);
        e.preventDefault();
        return;
      }

      // Check if mouse up was inside video wrapper
      if (!e.target.closest('#videoWrapper') || e.target.closest('#controlsBar') || e.target.closest('#titleBar')) {
        return;
      }

      const pressDuration = Date.now() - this.mouseDownTime;
      if (pressDuration < this.HOLD_THRESHOLD_MS) {
        this.handleClickOrDouble(e);
      }
    });

    // Handle mouse leaving window while holding
    window.addEventListener('blur', () => {
      if (this.isMouseHolding) {
        this.isMouseHolding = false;
        this.player.setBoost2x(false);
      }
      if (this.isSpaceHolding) {
        this.isSpaceHolding = false;
        this.player.setBoost2x(false);
      }
    });
  }

  handleClickOrDouble(e) {
    this.clickCount++;

    if (this.clickCount === 1) {
      this.clickTimer = setTimeout(() => {
        // Single Click: Toggle Play / Pause
        if (this.clickCount === 1 && this.player.currentFilePath) {
          const isPlaying = this.player.togglePlayPause();
          this.showCenterFeedback(isPlaying ? 'play' : 'pause');
        }
        this.clickCount = 0;
      }, 240);
    } else if (this.clickCount === 2) {
      // Double Click: Detect Left vs Right side for 10s seek
      clearTimeout(this.clickTimer);
      this.clickCount = 0;

      const rect = this.videoWrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;

      if (clickX < width * 0.35) {
        // Left side: Rewind 10s
        this.player.seekRelative(-10);
        this.showSeekRipple('left');
      } else if (clickX > width * 0.65) {
        // Right side: Fast-Forward 10s
        this.player.seekRelative(10);
        this.showSeekRipple('right');
      } else {
        // Center double click: Toggle fullscreen
        window.dispatchEvent(new CustomEvent('controls:togglefullscreen'));
      }
    }
  }

  initSpaceGestures() {
    window.addEventListener('keydown', (e) => {
      // Only capture Spacebar when not typing in an input
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();

        // First keydown event (not keyboard repeat)
        if (!e.repeat && this.spaceDownTime === 0) {
          this.spaceDownTime = Date.now();
          this.isSpaceHolding = false;

          clearTimeout(this.spaceHoldTimer);
          this.spaceHoldTimer = setTimeout(() => {
            if (this.player.currentFilePath) {
              this.isSpaceHolding = true;
              this.player.setBoost2x(true);
            }
          }, this.HOLD_THRESHOLD_MS);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        clearTimeout(this.spaceHoldTimer);

        if (this.isSpaceHolding) {
          // Exiting hold boost
          this.isSpaceHolding = false;
          this.player.setBoost2x(false);
          this.spaceDownTime = 0;
          return;
        }

        // Quick press (single tap) -> Toggle Play / Pause
        if (this.spaceDownTime > 0) {
          const pressDuration = Date.now() - this.spaceDownTime;
          if (pressDuration < this.HOLD_THRESHOLD_MS && this.player.currentFilePath) {
            const isPlaying = this.player.togglePlayPause();
            this.showCenterFeedback(isPlaying ? 'play' : 'pause');
          }
        }

        this.spaceDownTime = 0;
      }
    });
  }

  initBoostEvents() {
    window.addEventListener('player:boost', (e) => {
      if (e.detail.active) {
        this.speedBoostPill.classList.remove('hidden');
      } else {
        this.speedBoostPill.classList.add('hidden');
      }
    });
  }

  showSeekRipple(direction) {
    const el = direction === 'left' ? this.seekRippleLeft : this.seekRippleRight;
    el.classList.remove('hidden');
    // Force reflow for CSS animation restart
    void el.offsetWidth;
    setTimeout(() => {
      el.classList.add('hidden');
    }, 450);
  }

  showCenterFeedback(type) {
    const iconSvg = type === 'play'
      ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    this.centerFeedbackIcon.innerHTML = iconSvg;
    this.centerFeedback.classList.remove('hidden');
    void this.centerFeedback.offsetWidth;

    setTimeout(() => {
      this.centerFeedback.classList.add('hidden');
    }, 450);
  }
}

window.gesturesEngine = new GesturesEngine(window.playerCore);
