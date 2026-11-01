// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Audio processing / DSP configuration — the single source of truth for
 * sample rate, sliding-window pitch-analysis framing, session length, and
 * pitch-result fallback/timeout behavior.
 *
 * For presentation-only settings (colors, panel sizes, animation timing) see
 * uiConfig.ts instead.
 *
 * FRAME_WINDOW_MS / FRAME_HOP_MS are mirrored in
 * backend/config_processing.py — keep both sides in sync if you change these.
 */

export const SAMPLE_RATE = 48000;

// Length of each analysis window sent to the backend for a single pitch estimate.
export const FRAME_WINDOW_MS = 60;
// Step between the start of consecutive windows. Windows overlap (hop < window),
// and this is also the spacing between points plotted in the pitch display —
// one point per hop.
export const FRAME_HOP_MS = 40;
// Derived: how much consecutive windows overlap.
export const FRAME_OVERLAP_MS = FRAME_WINDOW_MS - FRAME_HOP_MS;

export const FRAME_WINDOW_SEC = FRAME_WINDOW_MS / 1000;
export const FRAME_HOP_SEC = FRAME_HOP_MS / 1000;

export const FRAME_WINDOW_SAMPLES = Math.round(SAMPLE_RATE * FRAME_WINDOW_SEC);
export const FRAME_HOP_SAMPLES = Math.round(SAMPLE_RATE * FRAME_HOP_SEC);

// Single enforced session length — recording auto-stops here, playback loops
// back to 0 here, and both panels render exactly this many seconds of
// timeline. Previously duplicated as MAX_RECORDING_TIME, MAX_PLAYBACK_SEC,
// DISPLAY_SECONDS and WINDOW_SECONDS across three different files.
export const SESSION_DURATION_SEC = 6;
export const SESSION_DURATION_MS = SESSION_DURATION_SEC * 1000;

// CallManager fallback/timeout behavior for pitch-analysis requests.
export const PITCH_FALLBACK_HZ = 0; // plotted value when a request fails or times out
export const REQUEST_TIMEOUT_MS = 1500; // how long to wait for an analyzer response before treating the frame as lost
