/**
 * VidPlayer Main Application Entry
 * Binds window controls, drag-and-drop file loading, empty state,
 * loading and error transitions, titlebar information, and anime library.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const player = window.playerCore;
  await player.init();

  if (window.libraryManager) {
    await window.libraryManager.init();
  }

  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const errorMessage = document.getElementById('errorMessage');

  const videoTitleDisplay = document.getElementById('videoTitleDisplay');
  const codecBadge = document.getElementById('codecBadge');

  const btnOpenFileTop = document.getElementById('btnOpenFileTop');
  const btnOpenSubTop = document.getElementById('btnOpenSubTop');
  const btnEmptyBrowse = document.getElementById('btnEmptyBrowse');
  const btnRetryTranscode = document.getElementById('btnRetryTranscode');
  const btnErrorBrowse = document.getElementById('btnErrorBrowse');

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

  btnOpenFileTop.addEventListener('click', promptOpenFile);
  btnEmptyBrowse.addEventListener('click', promptOpenFile);
  btnErrorBrowse.addEventListener('click', promptOpenFile);
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

    document.title = `${fileName} - VidPlayer`;
  });

  window.addEventListener('player:loading', (e) => {
    if (e.detail.isLoading) {
      loadingSpinner.classList.remove('hidden');
    } else {
      loadingSpinner.classList.add('hidden');
    }
  });

  window.addEventListener('player:buffering', (e) => {
    if (e.detail.isBuffering) {
      loadingSpinner.classList.remove('hidden');
    } else {
      loadingSpinner.classList.add('hidden');
    }
  });

  window.addEventListener('player:error', (e) => {
    loadingSpinner.classList.add('hidden');
    errorMessage.textContent = e.detail.message || 'Gagal memutar video.';
    errorState.classList.remove('hidden');
  });
});
