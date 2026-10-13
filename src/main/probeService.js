const { execFile } = require('child_process');
const ffprobeStatic = require('ffprobe-static');

const FFPROBE_PATH = ffprobeStatic.path;

// Browser-native video & audio codecs in Chromium
const NATIVE_VIDEO_CODECS = new Set(['h264', 'av1', 'vp9', 'vp8']);
const NATIVE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'flac', 'vorbis']);
const NATIVE_CONTAINERS = new Set(['mov,mp4,m4a,3gp,3g2,mj2', 'mp4', 'webm', 'ogg']);

/**
 * Probes media file metadata and stream details using ffprobe
 * @param {string} filePath Absolute path to media file
 * @returns {Promise<Object>}
 */
function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-show_chapters',
      filePath
    ];

    execFile(FFPROBE_PATH, args, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Failed to probe media: ${stderr || err.message}`));
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];
        const chapters = data.chapters || [];

        const videoStreams = streams.filter(s => s.codec_type === 'video');
        const audioStreams = streams.filter(s => s.codec_type === 'audio');
        const subtitleStreams = streams.filter(s => s.codec_type === 'subtitle');

        const primaryVideo = videoStreams[0] || null;
        const primaryAudio = audioStreams[0] || null;

        const duration = parseFloat(format.duration) || 0;
        const formatName = (format.format_name || '').toLowerCase();
        const videoCodec = primaryVideo ? primaryVideo.codec_name.toLowerCase() : null;
        const audioCodec = primaryAudio ? primaryAudio.codec_name.toLowerCase() : null;

        // Determine if container is natively playable
        const isContainerNative = Array.from(NATIVE_CONTAINERS).some(c => formatName.includes(c));
        const isVideoNative = videoCodec ? NATIVE_VIDEO_CODECS.has(videoCodec) : true;
        const isAudioNative = audioCodec ? NATIVE_AUDIO_CODECS.has(audioCodec) : true;

        let playbackMode = 'direct';
        if (!isContainerNative || !isVideoNative || !isAudioNative) {
          if (isVideoNative) {
            // Video codec is native (e.g. H264 inside MKV or paired with AC3/DTS audio)
            // Can be remuxed instantly without re-encoding video
            playbackMode = 'transmux';
          } else {
            // Non-native video codec (e.g. MPEG-2, DivX, VC-1, HEVC) -> Full transcode
            playbackMode = 'transcode';
          }
        }

        resolve({
          filePath,
          duration,
          bitrate: parseInt(format.bit_rate, 10) || 0,
          formatName,
          playbackMode,
          video: primaryVideo ? {
            codec: videoCodec,
            profile: primaryVideo.profile,
            width: primaryVideo.width,
            height: primaryVideo.height,
            fps: calculateFps(primaryVideo.r_frame_rate || primaryVideo.avg_frame_rate),
            aspectRatio: primaryVideo.display_aspect_ratio || `${primaryVideo.width}:${primaryVideo.height}`
          } : null,
          audioStreams: audioStreams.map((a, idx) => ({
            index: a.index,
            streamIndex: idx,
            codec: a.codec_name,
            channels: a.channels,
            channelLayout: a.channel_layout,
            sampleRate: parseInt(a.sample_rate, 10) || 0,
            language: (a.tags && (a.tags.language || a.tags.LANGUAGE)) || `Track ${idx + 1}`,
            title: (a.tags && (a.tags.title || a.tags.TITLE)) || `${a.codec_name.toUpperCase()} (${a.channels} ch)`
          })),
          subtitleStreams: subtitleStreams.map((s, idx) => ({
            index: s.index,
            streamIndex: idx,
            codec: s.codec_name,
            language: (s.tags && (s.tags.language || s.tags.LANGUAGE)) || `Sub ${idx + 1}`,
            title: (s.tags && (s.tags.title || s.tags.TITLE)) || `${s.codec_name.toUpperCase()}`
          })),
          chapters: chapters.map(ch => ({
            id: ch.id,
            startTime: parseFloat(ch.start_time) || 0,
            endTime: parseFloat(ch.end_time) || 0,
            title: (ch.tags && (ch.tags.title || ch.tags.TITLE)) || 'Chapter'
          }))
        });
      } catch (parseError) {
        reject(new Error(`Error parsing ffprobe output: ${parseError.message}`));
      }
    });
  });
}

function calculateFps(rateStr) {
  if (!rateStr) return 30;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0) return Math.round((num / den) * 100) / 100;
  }
  return parseFloat(rateStr) || 30;
}

module.exports = {
  probeMedia
};

