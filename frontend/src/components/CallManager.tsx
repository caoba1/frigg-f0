// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useRef, useState } from 'react';
import { debugLog, traceEvent } from '../utils/debug';
import { PITCH_FALLBACK_HZ, REQUEST_TIMEOUT_MS } from '../config/processingConfig';
import { DEFAULT_PITCH_MODE } from '../config/uiConfig';

export type PitchFrame = { time: number; pitchHz: number; harmonicEnergy?: number };

interface Options {
  fallbackHz?: number;
  requestTimeoutMs?: number; // how long to wait for an analyzer response before treating the frame as lost
}

export default function useCallManager(opts: Options = {}) {
  const {
    fallbackHz = PITCH_FALLBACK_HZ,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
  } = opts;

  const [pitches, setPitches] = useState<PitchFrame[]>([]);
  // frameId -> the timestamp that request represents, so a timeout can still place a fallback point correctly
  const pendingRef = useRef<Map<string, number>>(new Map());
  const timeoutHandlesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Adds a point to the timeline. Call this only once you have a value worth plotting
  // (a real detection, or a fallback you've decided to use) — no validation happens here.
  const updatePitch = useCallback((time: number, pitchHz: number, harmonicEnergy?: number) => {
    debugLog('[callmanager] updatePitch', { time, pitchHz, harmonicEnergy });
    traceEvent({ kind: 'update_pitch', time, pitchHz, harmonicEnergy });
    setPitches(prev => [...prev, { time, pitchHz, harmonicEnergy }]);
  }, []);

  const clearPending = useCallback((frameId: string) => {
    const handle = timeoutHandlesRef.current.get(frameId);
    if (handle !== undefined) {
      clearTimeout(handle);
      timeoutHandlesRef.current.delete(frameId);
    }
    pendingRef.current.delete(frameId);
  }, []);

  // Call right before sending a frame to the analyzer. Starts a per-request timeout so a
  // frame that never comes back still gets a fallback point instead of leaving a gap.
  const registerRequest = useCallback((frameId: string, time: number) => {
    pendingRef.current.set(frameId, time);
    const handle = setTimeout(() => {
      if (!pendingRef.current.has(frameId)) return; // already resolved
      debugLog('[callmanager] request timed out, using fallback', { frameId, time, fallbackHz });
      clearPending(frameId);
      updatePitch(time, fallbackHz);
    }, requestTimeoutMs);
    timeoutHandlesRef.current.set(frameId, handle);
  }, [requestTimeoutMs, fallbackHz, updatePitch, clearPending]);

  // Call when the analyzer responds for a previously registered frame, success or failure.
  // Pass pitchHz = null for an invalid/error response; the fallback value is used instead.
  // harmonicEnergy is opaque to CallManager — just carried through to the pitches array.
  const resolveRequest = useCallback((frameId: string, pitchHz: number | null, harmonicEnergy?: number) => {
    const time = pendingRef.current.get(frameId);
    if (time === undefined) {
      debugLog('[callmanager] resolveRequest: unknown or already-timed-out frameId', { frameId });
      return;
    }
    clearPending(frameId);
    const valid = typeof pitchHz === 'number' && isFinite(pitchHz) && pitchHz > 0;
    updatePitch(time, valid ? (pitchHz as number) : fallbackHz, harmonicEnergy);
  }, [fallbackHz, updatePitch, clearPending]);

  const reset = useCallback(() => {
    setPitches([]);
    timeoutHandlesRef.current.forEach(handle => clearTimeout(handle));
    timeoutHandlesRef.current.clear();
    pendingRef.current.clear();
  }, []);

  // pitch mode state (peak | yin | rnd)
  const [mode, setMode] = useState<'peak' | 'yin' | 'rnd'>(DEFAULT_PITCH_MODE);

  return { pitches, updatePitch, registerRequest, resolveRequest, reset, mode, setMode };
}