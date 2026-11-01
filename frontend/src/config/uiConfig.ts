// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * User-interface configuration — the single source of truth for colors, panel
 * layout sizes, animation/throttle timing, and default UI selections.
 *
 * For audio/DSP parameters (sample rate, analysis framing, timeouts) see
 * processingConfig.ts instead.
 */

// ---- Colors ----------------------------------------------------------------
// Shared color palette: grayscale for chrome/text, blue as the single accent.
const gray = {
  50: '#fafafa',
  100: '#f2f2f3',
  200: '#e4e4e7',
  300: '#d1d1d6',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
};

const blue = {
  100: '#dceeff',
  300: '#7cc0ff',
  500: '#0a84ff',
  700: '#0050f0',
};

export const colors = {
  white: '#ffffff',
  black: '#000000',
  gray,
  blue,

  // panel chrome
  panelBorder: gray[800],
  panelBackground: gray[50],
  border: gray[300],

  // text
  bodyText: gray[800],
  mutedText: gray[600],
  tickText: gray[500],

  // canvas drawing
  canvasBackground: '#ffffff',
  gridLine: gray[200],
  pitchLine: blue[500],
  pitchDot: blue[700],
  playbackNeedle: gray[900],
  waveColor: gray[700],
  waveProgressColor: blue[500],
  waveCursorColor: blue[500],
  spectrogramBackground: blue[100],

  // buttons
  buttonPrimaryBg: blue[500],
  buttonPrimaryText: '#ffffff',
  buttonActiveBg: gray[900],
  buttonSecondaryBg: gray[700],
  buttonMutedBg: gray[600],

  // config panel accent
  configBorder: blue[300],
  configBackground: blue[100],
  configText: blue[700],
};

// ---- Panel layout sizes (px) -------------------------------------------------
export const WAVEFORM_HEIGHT_PX = 120; // WaveSurfer's own waveform canvas
export const SPECTROGRAM_HEIGHT_PX = 80; // WaveSurfer spectrogram plugin canvas
export const SPECTROGRAM_CONTAINER_HEIGHT_PX = 100; // wrapper div around the spectrogram canvas
export const PITCH_CANVAS_HEIGHT_PX = 140; // PitchPanel's own canvas

// ---- Pitch display axis (Y axis bounds shown in PitchPanel) -----------------
// Purely cosmetic chart bounds — not the same as the backend's actual pitch
// detection range (see processingConfig.ts / backend/config_processing.py).
export const PITCH_AXIS_MIN_HZ = 0;
export const PITCH_AXIS_MAX_HZ = 1053;

// ---- Animation / throttle timing --------------------------------------------
export const NEEDLE_SMOOTHING_TAU_MS = 60; // exponential smoothing time-constant; lower = more responsive
export const WAVEFORM_EMIT_INTERVAL_MS = 16; // App -> WaveformPanel onNeedleFrac emit throttle
export const WAVEFORM_PANEL_DEFAULT_EMIT_INTERVAL_MS = 50; // WaveformPanel's own default emitIntervalMs prop

// ---- Default UI selections ---------------------------------------------------
export const DEFAULT_PITCH_MODE: 'peak' | 'yin' | 'rnd' = 'yin';
