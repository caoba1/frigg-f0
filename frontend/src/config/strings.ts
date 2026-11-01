/**
 * Single source of truth for every piece of user-facing text in the frontend.
 * Centralized here so the whole app can be translated by editing this one file.
 *
 * This does not implement language switching — it's a single-language string
 * table. For config values (colors, sizes, timings) see uiConfig.ts; for
 * audio/DSP parameters see processingConfig.ts.
 */

export const strings = {
  // Used for both the <h1> heading (App.tsx) and the browser tab title
  // (kept in sync with index.html's static <title> at runtime).
  appTitle: 'Pitch Extraction Demo',

  waveformPanel: {
    heading: 'DISPLAY WAVEFORM',
    modeWaveform: 'WAVEFORM',
    modeSpectrogram: 'SPECTOGRAM',
  },

  pitchPanel: {
    heading: 'DISPLAY PITCH',
    modePeak: 'PEAK OF SP.',
    modeYin: 'YIN',
    modeOwn: 'OWN',
  },

  recordButton: {
    record: 'Record',
    stop: 'Stop',
    play: 'Play',
    loadFile: 'Load file',
    showAudioControls: 'Show audio controls',
    sendFramesDuringPlayback: 'Send frames during playback',
    loadedFilePrefix: 'Loaded: ',
    openInNewTab: 'Open in new tab',
    testPlay: 'Test Play (new Audio)',
  },

  configPanel: {
    collapseToggle: '>', // chevron shown before "heading" in the clickable header
    heading: 'Configuration',
    emptyNotice: '[This section intentionally left empty.]',
  },

  debugLog: {
    heading: 'Debug log',
  },
};
