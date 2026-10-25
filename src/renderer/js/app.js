/**
 * VidPlayer Main Application Entry
 * Binds window controls, drag-and-drop file loading, empty state,
 * loading and error transitions, titlebar information, and anime library.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const startupLoadingEl = document.getElementById('appStartupLoading');
  const startupLoadingText = document.getElementById('startupLoadingText');

  const player = window.playerCore;
  await player.init();

  if (window.libraryManager) {
    await window.libraryManager.init();
  }

  if (typeof window.initOtakudesu === 'function') {
    window.initOtakudesu(player, window.libraryManager);
  }

  if (typeof window.initIdlix === 'function') {
    window.initIdlix(player, window.libraryManager);
  }

  // Preload web catalog saat startup loading screen aktif
  if (startupLoadingEl) {
    const btnSkipStartupLoading = document.getElementById('btnSkipStartupLoading');
    let isStartupDismissed = false;

    const dismissStartupLoading = () => {
      if (isStartupDismissed) return;
      isStartupDismissed = true;
      startupLoadingEl.classList.add('fade-out');
      setTimeout(() => {
        startupLoadingEl.classList.add('hidden');
      }, 450);
    };

    if (btnSkipStartupLoading) {
      btnSkipStartupLoading.addEventListener('click', () => {
        dismissStartupLoading();
      });
    }

    // Jika offline, tidak perlu menunggu loading web
    if (!navigator.onLine) {
      dismissStartupLoading();
    } else {
      // Jika loading screen lebih dari 10 detik, berikan tombol skip loading
      const skipTimer = setTimeout(() => {
        if (!isStartupDismissed && btnSkipStartupLoading) {
          btnSkipStartupLoading.classList.remove('hidden');
        }
      }, 10000);

      // Jalankan preloading web catalog di latar belakang
      const preloadPromise = (async () => {
        if (window.otakudesuManager && typeof window.otakudesuManager.preloadWebCatalog === 'function') {
          await window.otakudesuManager.preloadWebCatalog((msg) => {
            if (startupLoadingText) startupLoadingText.textContent = msg;
          });
        }
      })();

      // Batas waktu maksimal aman (15s) agar pengguna tidak terblokir permanen jika jaringan lambat
      const safetyTimeout = new Promise(resolve => setTimeout(resolve, 15000));
      await Promise.race([preloadPromise, safetyTimeout]);
      clearTimeout(skipTimer);
      dismissStartupLoading();
    }
  }

  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const loadingSpinnerText = document.getElementById('loadingSpinnerText');
  const errorMessage = document.getElementById('errorMessage');

  const videoTitleDisplay = document.getElementById('videoTitleDisplay');
  const codecBadge = document.getElementById('codecBadge');

  const btnOpenFileTop = document.getElementById('btnOpenFileTop');
  const btnOpenSubTop = document.getElementById('btnOpenSubTop');
  const btnEmptyBrowse = document.getElementById('btnEmptyBrowse');
  const btnRetryTranscode = document.getElementById('btnRetryTranscode');
  const btnErrorBackHome = document.getElementById('btnErrorBackHome') || document.getElementById('btnErrorBrowse');
  const errorCodeBadge = document.getElementById('errorCodeBadge');

  const btnWinMinimize = document.getElementById('btnWinMinimize');
  const btnWinMaximize = document.getElementById('btnWinMaximize');
  const btnWinClose = document.getElementById('btnWinClose');

  /* ==========================================================================
     Window Controls (Electron IPC)
     ========================================================================== */
  if (window.electronAPI) {
    btnWinMinimize.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    btnWinMaximize.addEventListener('click', () => {
      window.electronAPI.maximizeWindow();
    });

    btnWinClose.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });

    // Listen for file passed on launch via CLI
    window.electronAPI.onFileDropFromMain((filePath) => {
      if (filePath) {
        if (window.libraryManager) window.libraryManager.showPlayerView();
        player.loadFile(filePath);
      }
    });

    // Listen to Fullscreen changes
    window.electronAPI.onFullScreenChanged(({ isFullScreen }) => {
      document.body.classList.toggle('is-fullscreen', isFullScreen);
      if (window.controlsManager) {
        window.controlsManager.updateFullscreenIcon(isFullScreen);
      }
    });

    // Listen to Window Maximized state (prevents taskbar overlap)
    window.electronAPI.onWindowStateChanged(({ isMaximized }) => {
      document.body.classList.toggle('window-maximized', isMaximized);
    });
  }

  /* ==========================================================================
     File Loading (Dialog & Drag and Drop)
     ========================================================================== */
  async function promptOpenFile() {
    if (window.electronAPI) {
      const selectedPath = await window.electronAPI.openFileDialog();
      if (selectedPath) {
        if (window.libraryManager) window.libraryManager.showPlayerView();
        player.loadFile(selectedPath);
      }
    }
  }

  async function promptOpenSubtitle() {
    if (window.electronAPI) {
      const selectedPath = await window.electronAPI.openSubtitleDialog();
      if (selectedPath) {
        const subFileName = selectedPath.split(/[\\/]/).pop();
        window.controlsManager.showToast(`Subtitle dimuat: ${subFileName}`);
      }
    }
  }

  if (btnOpenFileTop) {
    btnOpenFileTop.addEventListener('click', promptOpenFile);
  }
  btnEmptyBrowse.addEventListener('click', promptOpenFile);
  if (btnErrorBackHome) {
    btnErrorBackHome.addEventListener('click', () => {
      errorState.classList.add('hidden');
      player.stop();
      if (window.libraryManager) {
        window.libraryManager.showGalleryView();
      }
    });
  }
  btnOpenSubTop.addEventListener('click', promptOpenSubtitle);

  window.addEventListener('app:promptopenfile', promptOpenFile);

  btnRetryTranscode.addEventListener('click', () => {
    errorState.classList.add('hidden');
    player.setPlaybackMode('transcode');
    player.reloadStreamAt(0);
  });

  // Drag and Drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    emptyState.classList.add('drag-over');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.clientX <= 0 || e.clientY <= 0) {
      emptyState.classList.remove('drag-over');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    emptyState.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const filePath = file.path;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const subExtensions = ['srt', 'vtt', 'ass', 'ssa'];

    if (subExtensions.includes(ext)) {
      // External subtitle dropped
      player.loadExternalSubtitle(file);
      window.controlsManager.showToast(`Subtitle dimuat: ${file.name}`);
      window.controlsManager.updateSubtitleUI(true, file.name);
    } else {
      // Video file dropped
      if (filePath) {
        if (window.libraryManager) window.libraryManager.showPlayerView();
        player.loadFile(filePath);
      }
    }
  });

  /* ==========================================================================
     UI State Synchronization
     ========================================================================== */
  window.addEventListener('player:medialoaded', (e) => {
    const { fileName, mediaInfo, playbackMode } = e.detail;

    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
    videoTitleDisplay.textContent = fileName;

    // Show codec badge (e.g. MKV • H.264 • AAC)
    const vCodec = (mediaInfo?.video?.codec || '').toUpperCase();
    const aCodec = (mediaInfo?.audioStreams?.[0]?.codec || '').toUpperCase();
    const modeLabel = playbackMode === 'direct' ? 'Direct' : (playbackMode === 'transmux' ? 'Transmux' : 'Transcode');

    codecBadge.textContent = `${modeLabel} ${vCodec ? '• ' + vCodec : ''} ${aCodec ? '• ' + aCodec : ''}`.trim();
    codecBadge.classList.remove('hidden');

    document.title = fileName || 'Player';
  });

  window.addEventListener('player:loading', (e) => {
    if (e.detail.isLoading) {
      loadingSpinner.classList.remove('hidden');
      document.body.classList.add('app-loading-state');
      if (loadingSpinnerText) {
        loadingSpinnerText.textContent = e.detail.message || 'Menghubungkan stream...';
      }
    } else {
      loadingSpinner.classList.add('hidden');
      document.body.classList.remove('app-loading-state');
    }
  });

  window.addEventListener('player:buffering', (e) => {
    if (e.detail.isBuffering) {
      loadingSpinner.classList.remove('hidden');
      document.body.classList.add('app-loading-state');
      if (loadingSpinnerText) {
        loadingSpinnerText.textContent = 'Memuat video...';
      }
    } else {
      loadingSpinner.classList.add('hidden');
      document.body.classList.remove('app-loading-state');
    }
  });

  window.addEventListener('player:error', (e) => {
    loadingSpinner.classList.add('hidden');
    document.body.classList.remove('app-loading-state');
    errorMessage.textContent = e.detail.message || 'Gagal memutar video.';
    if (errorCodeBadge) {
      if (e.detail.codeName) {
        errorCodeBadge.textContent = `Kode Error: ${e.detail.codeName}`;
        errorCodeBadge.classList.remove('hidden');
      } else {
        errorCodeBadge.classList.add('hidden');
      }
    }
    // Sembunyikan tombol transcode ulang untuk streaming web karena tidak relevan
    const btnFallbackKusonime = document.getElementById('btnFallbackKusonime');
    if (player.remoteStreamUrl && !player.currentFilePath) {
      btnRetryTranscode.classList.add('hidden');
      if (btnFallbackKusonime && window.libraryManager && window.libraryManager.currentOnlineAnime) {
        btnFallbackKusonime.classList.remove('hidden');
        btnFallbackKusonime.onclick = () => {
          errorState.classList.add('hidden');
          window.libraryManager.switchNavTab('web');
          if (window.otakudesuManager) {
            window.otakudesuManager.executeSearch(window.libraryManager.currentOnlineAnime.animeTitle, 'kusonime');
          }
        };
      }
    } else {
      btnRetryTranscode.classList.remove('hidden');
      if (btnFallbackKusonime) btnFallbackKusonime.classList.add('hidden');
    }
    errorState.classList.remove('hidden');
  });

  /* ==========================================================================
     KEIOL: System Tray & Settings Integration
     ========================================================================== */
  const toggleCloseToTray = document.getElementById('toggleCloseToTray');
  const btnCheckUpdateManual = document.getElementById('btnCheckUpdateManual');
  const settingsUpdateFeedback = document.getElementById('settingsUpdateFeedback');
  const lblSettingsAppVersion = document.getElementById('lblSettingsAppVersion');

  if (window.electronAPI) {
    // Dynamic App Version Display
    if (lblSettingsAppVersion && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(ver => {
        if (ver) lblSettingsAppVersion.textContent = `KEIOL v${ver}`;
      }).catch(err => console.warn('Gagal memuat app version:', err));
    }

    // Sync close to tray setting
    if (toggleCloseToTray && window.electronAPI.getCloseToTray) {
      try {
        const isEnabled = await window.electronAPI.getCloseToTray();
        toggleCloseToTray.checked = Boolean(isEnabled);
      } catch (err) {
        console.warn('Failed to load closeToTray setting:', err);
      }

      toggleCloseToTray.addEventListener('change', async (e) => {
        try {
          await window.electronAPI.setCloseToTray(e.target.checked);
        } catch (err) {
          console.warn('Failed to set closeToTray setting:', err);
        }
      });
    }

    // Main process tray menu triggers
    if (window.electronAPI.onTogglePlayFromMain) {
      window.electronAPI.onTogglePlayFromMain(() => {
        player.togglePlay();
      });
    }

    if (window.electronAPI.onOpenSettingsFromMain) {
      window.electronAPI.onOpenSettingsFromMain(() => {
        const tabSettings = document.getElementById('tabSettings');
        if (tabSettings) tabSettings.click();
      });
    }

    // Manual check for update button in settings
    if (btnCheckUpdateManual && window.electronAPI.checkForUpdates) {
      btnCheckUpdateManual.addEventListener('click', async () => {
        if (settingsUpdateFeedback) {
          settingsUpdateFeedback.textContent = 'Memeriksa pembaruan ke server GitHub...';
          settingsUpdateFeedback.className = 'update-feedback-msg';
          settingsUpdateFeedback.classList.remove('hidden');
        }
        btnCheckUpdateManual.disabled = true;
        try {
          await window.electronAPI.checkForUpdates(true);
        } catch (e) {
          if (settingsUpdateFeedback) {
            settingsUpdateFeedback.textContent = 'Gagal memeriksa update: ' + e.message;
            settingsUpdateFeedback.className = 'update-feedback-msg feedback-error';
          }
        } finally {
          btnCheckUpdateManual.disabled = false;
        }
      });
    }

    if (window.electronAPI.onUpdateCheckResult && settingsUpdateFeedback) {
      window.electronAPI.onUpdateCheckResult((res) => {
        settingsUpdateFeedback.textContent = res.message;
        settingsUpdateFeedback.className = res.status === 'up-to-date'
          ? 'update-feedback-msg feedback-success'
          : 'update-feedback-msg feedback-error';
        settingsUpdateFeedback.classList.remove('hidden');
      });
    }
  }

  /* ==========================================================================
     KEIOL: Update & Force Update Modal Logic
     ========================================================================== */
  const updateModal = document.getElementById('updateModal');
  const btnUpdateCloseX = document.getElementById('btnUpdateCloseX');
  const updateTypeBadge = document.getElementById('updateTypeBadge');
  const updateModalTitle = document.getElementById('updateModalTitle');
  const forceUpdateAlertBox = document.getElementById('forceUpdateAlertBox');
  const forceUpdateAlertText = document.getElementById('forceUpdateAlertText');
  const lblCurrentVer = document.getElementById('lblCurrentVer');
  const lblTargetVer = document.getElementById('lblTargetVer');
  const updateChangelogContent = document.getElementById('updateChangelogContent');
  const updateProgressContainer = document.getElementById('updateProgressContainer');
  const updateProgressStatusText = document.getElementById('updateProgressStatusText');
  const updateProgressPercent = document.getElementById('updateProgressPercent');
  const updateProgressBar = document.getElementById('updateProgressBar');
  const btnSkipVersion = document.getElementById('btnSkipVersion');
  const btnUpdateLater = document.getElementById('btnUpdateLater');
  const btnUpdateNow = document.getElementById('btnUpdateNow');

  let isForceUpdateActive = false;
  let targetUpdateVersion = null;
  let isDownloadFinished = false;

  function showUpdateModal(data, isForce = false) {
    if (!updateModal) return;
    isForceUpdateActive = isForce;
    targetUpdateVersion = data.newVersion || 'latest';
    isDownloadFinished = false;

    if (lblCurrentVer) lblCurrentVer.textContent = 'v' + (data.currentVersion || '1.0.0');
    if (lblTargetVer) lblTargetVer.textContent = 'v' + targetUpdateVersion;
    if (updateChangelogContent) {
      updateChangelogContent.textContent = data.changelog || 'Pembaruan keamanan & perbaikan performa.';
    }

    // Reset progress container
    if (updateProgressContainer) updateProgressContainer.classList.add('hidden');
    if (updateProgressBar) updateProgressBar.style.width = '0%';
    if (updateProgressPercent) updateProgressPercent.textContent = '0%';
    if (btnUpdateNow) {
      btnUpdateNow.disabled = false;
      btnUpdateNow.textContent = isForce ? 'Update Sekarang (Wajib)' : 'Update Sekarang';
    }

    if (isForce) {
      // Pause playback if running
      if (player && typeof player.pause === 'function') {
        player.pause();
      }
      if (updateTypeBadge) {
        updateTypeBadge.textContent = 'UPDATE WAJIB';
        updateTypeBadge.className = 'update-badge badge-force';
      }
      if (updateModalTitle) {
        updateModalTitle.textContent = `KEIOL v${targetUpdateVersion} (Wajib)`;
      }
      if (forceUpdateAlertBox) {
        forceUpdateAlertBox.classList.remove('hidden');
        if (forceUpdateAlertText) {
          forceUpdateAlertText.textContent = data.forceMessage || 'Pembaruan wajib diperlukan untuk memperbaiki bug fatal pada versi sebelumnya.';
        }
      }
      if (btnSkipVersion) btnSkipVersion.classList.add('hidden');
      if (btnUpdateLater) btnUpdateLater.classList.add('hidden');
      if (btnUpdateCloseX) btnUpdateCloseX.classList.add('hidden');
    } else {
      if (updateTypeBadge) {
        updateTypeBadge.textContent = 'Pembaruan Tersedia';
        updateTypeBadge.className = 'update-badge';
      }
      if (updateModalTitle) {
        updateModalTitle.textContent = `KEIOL v${targetUpdateVersion}`;
      }
      if (forceUpdateAlertBox) forceUpdateAlertBox.classList.add('hidden');
      if (btnSkipVersion) btnSkipVersion.classList.remove('hidden');
      if (btnUpdateLater) btnUpdateLater.classList.remove('hidden');
      if (btnUpdateCloseX) btnUpdateCloseX.classList.remove('hidden');
    }

    updateModal.classList.remove('hidden');
  }

  if (window.electronAPI) {
    // Normal update available event
    if (window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((data) => {
        const skippedVer = localStorage.getItem('keiol_skipped_version');
        if (!data.manual && skippedVer && skippedVer === data.newVersion) {
          return; // Skipped by user previously
        }
        showUpdateModal(data, false);
      });
    }

    // Force update required event
    if (window.electronAPI.onForceUpdate) {
      window.electronAPI.onForceUpdate((data) => {
        showUpdateModal(data, true);
      });
    }

    // Update progress
    if (window.electronAPI.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((prog) => {
        if (updateProgressContainer) updateProgressContainer.classList.remove('hidden');
        if (updateProgressBar) updateProgressBar.style.width = `${prog.percent}%`;
        if (updateProgressPercent) updateProgressPercent.textContent = `${prog.percent}%`;
        if (updateProgressStatusText) {
          if (prog.statusText) {
            updateProgressStatusText.textContent = prog.statusText;
          } else if (prog.percent >= 100) {
            updateProgressStatusText.textContent = 'Menyelesaikan unduhan...';
          } else if (prog.transferred && prog.total) {
            const mbTransferred = (prog.transferred / (1024 * 1024)).toFixed(1);
            const mbTotal = (prog.total / (1024 * 1024)).toFixed(1);
            const mbSpeed = prog.bytesPerSecond ? ` • ${(prog.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s` : '';
            updateProgressStatusText.textContent = `Mengunduh: ${mbTransferred} MB / ${mbTotal} MB (${prog.percent}%)${mbSpeed}`;
          } else {
            updateProgressStatusText.textContent = `Mengunduh pembaruan... (${prog.percent}%)`;
          }
        }
      });
    }

    // Update complete
    if (window.electronAPI.onUpdateComplete) {
      window.electronAPI.onUpdateComplete((info) => {
        isDownloadFinished = true;
        if (updateProgressContainer) updateProgressContainer.classList.remove('hidden');
        if (updateProgressBar) updateProgressBar.style.width = '100%';
        if (updateProgressPercent) updateProgressPercent.textContent = '100%';
        if (updateProgressStatusText) {
          updateProgressStatusText.textContent = info.external
            ? 'Unduhan rilis dibuka di browser Anda.'
            : 'Pembaruan berhasil diunduh dan siap dipasang!';
        }
        if (btnUpdateNow) {
          btnUpdateNow.disabled = false;
          btnUpdateNow.textContent = info.external ? 'Buka Folder Rilis' : 'Pasang Sekarang & Restart';
        }

        // Jika pembaruan wajib (force update), pasang otomatis setelah 3 detik
        if (isForceUpdateActive && !info.external) {
          let count = 3;
          const countTimer = setInterval(() => {
            if (updateProgressStatusText) {
              updateProgressStatusText.textContent = `Memasang otomatis dalam ${count} detik...`;
            }
            count--;
            if (count < 0) {
              clearInterval(countTimer);
              if (window.electronAPI && window.electronAPI.installUpdateAndRestart) {
                window.electronAPI.installUpdateAndRestart();
              }
            }
          }, 1000);
        }
      });
    }
  }

  // Modal Buttons Listeners
  if (btnSkipVersion) {
    btnSkipVersion.addEventListener('click', () => {
      if (targetUpdateVersion) {
        localStorage.setItem('keiol_skipped_version', targetUpdateVersion);
      }
      if (updateModal) updateModal.classList.add('hidden');
    });
  }

  if (btnUpdateLater) {
    btnUpdateLater.addEventListener('click', () => {
      if (updateModal) updateModal.classList.add('hidden');
    });
  }

  if (btnUpdateCloseX) {
    btnUpdateCloseX.addEventListener('click', () => {
      if (!isForceUpdateActive && updateModal) {
        updateModal.classList.add('hidden');
      }
    });
  }

  if (btnUpdateNow) {
    btnUpdateNow.addEventListener('click', async () => {
      if (isDownloadFinished) {
        btnUpdateNow.disabled = true;
        btnUpdateNow.textContent = 'Memasang...';
        if (updateProgressStatusText) {
          updateProgressStatusText.textContent = 'Memulai pemasangan otomatis & menutup aplikasi...';
        }
        if (window.electronAPI && window.electronAPI.installUpdateAndRestart) {
          window.electronAPI.installUpdateAndRestart();
        }
        return;
      }

      btnUpdateNow.disabled = true;
      btnUpdateNow.textContent = 'Mengunduh...';
      if (updateProgressContainer) updateProgressContainer.classList.remove('hidden');
      if (updateProgressStatusText) updateProgressStatusText.textContent = 'Menghubungkan ke GitHub...';

      if (window.electronAPI && window.electronAPI.startUpdateDownload) {
        try {
          await window.electronAPI.startUpdateDownload();
        } catch (err) {
          if (updateProgressStatusText) {
            updateProgressStatusText.textContent = 'Gagal mengunduh: ' + err.message;
          }
          btnUpdateNow.disabled = false;
          btnUpdateNow.textContent = 'Coba Lagi';
        }
      }
    });
  }

  // Prevent closing force update modal with ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && updateModal && !updateModal.classList.contains('hidden')) {
      if (isForceUpdateActive) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        updateModal.classList.add('hidden');
      }
    }
  }, true);
});
