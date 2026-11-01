// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useRef, useEffect, useState } from 'react';
import { debugLog } from '../utils/debug';
import { colors, PITCH_AXIS_MIN_HZ, PITCH_AXIS_MAX_HZ, PITCH_CANVAS_HEIGHT_PX, DEFAULT_PITCH_MODE } from '../config/uiConfig';
import { FRAME_HOP_SEC, SESSION_DURATION_SEC } from '../config/processingConfig';
import { strings } from '../config/strings';

type PitchResult = { pitchHz: number, energy: number } | null;

interface PitchPanelProps {
  pitchResults?: PitchResult[];
  pitches?: Array<{ time: number; pitchHz: number }>;
  lastAnalyzedFrame?: number;
  playbackFrame?: number;
  showNeedle?: boolean;
  needleFrac?: number | null;
  windowSeconds?: number;
  minFreq?: number;
  maxFreq?: number;
  pitchMode?: 'peak' | 'yin' | 'rnd';
  setPitchMode?: React.Dispatch<React.SetStateAction<'peak' | 'yin' | 'rnd'>>;
}

const PitchPanel: React.FC<PitchPanelProps> = ({
  pitchResults = [],
  pitches = [],
  lastAnalyzedFrame = -1,
  playbackFrame = -1,
  showNeedle = true,
  needleFrac = null,
  windowSeconds = SESSION_DURATION_SEC,
  minFreq = PITCH_AXIS_MIN_HZ,
  maxFreq = PITCH_AXIS_MAX_HZ,
  pitchMode = DEFAULT_PITCH_MODE,
  setPitchMode,
}) => {
  // pitchMode and setter can be provided by parent (CallManager via App)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameDuration = FRAME_HOP_SEC; // one "frame" = one analysis hop (see config/processingConfig.ts)
  const WINDOW_SECONDS = SESSION_DURATION_SEC;
  const freqToY = (freq: number, h: number) => {
    const f = Math.max(minFreq, Math.min(maxFreq, freq));
    const range = maxFreq - minFreq;
    const frac = range > 0 ? (f - minFreq) / range : 0;
    return Math.round((1 - frac) * h);
  };

  // Full redraw every time: the window scrolls with playback, so a point drawn once and
  // never revisited (the old incremental/accumulation approach) would be skipped forever
  // if it fell outside the window on the frame it first arrived.
  useEffect(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cnv.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    cnv.width = Math.round(w * dpr);
    cnv.height = Math.round(h * dpr);
    cnv.style.width = `${w}px`;
    cnv.style.height = `${h}px`;

    const vctx = cnv.getContext('2d');
    if (!vctx) return;
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // fixed window: always draw frequency vs the 0-6s range, no scrolling/accumulation
    const playbackSec = (typeof playbackFrame === 'number' && playbackFrame >= 0) ? playbackFrame * frameDuration : -1;
    const startSec = 0;
    const endSec = WINDOW_SECONDS;

    // background + grid
    vctx.clearRect(0, 0, w, h);
    vctx.fillStyle = colors.canvasBackground;
    vctx.fillRect(0, 0, w, h);
    vctx.strokeStyle = colors.gridLine;
    vctx.lineWidth = 1;
    const tickStep = Math.max(0.5, WINDOW_SECONDS / 12);
    vctx.font = '11px sans-serif';
    vctx.fillStyle = colors.tickText;
    for (let t = 0; t <= WINDOW_SECONDS; t += tickStep) {
      const xTick = (t / WINDOW_SECONDS) * w;
      vctx.beginPath();
      vctx.moveTo(xTick, h - 1);
      vctx.lineTo(xTick, h - 8);
      vctx.stroke();
      if (Math.abs(t - Math.round(t)) < 1e-6) vctx.fillText(`${Math.round(t)}s`, xTick + 4, h - 18);
    }

    // Hz ticks on the y-axis, evenly spaced from minFreq to maxFreq
    const yTickCount = 6;
    for (let i = 0; i <= yTickCount; i++) {
      const freq = minFreq + ((maxFreq - minFreq) * i) / yTickCount;
      const yTick = freqToY(freq, h);
      vctx.strokeStyle = colors.gridLine;
      vctx.beginPath();
      vctx.moveTo(0, yTick + 0.5);
      vctx.lineTo(w, yTick + 0.5);
      vctx.stroke();
      vctx.fillStyle = colors.tickText;
      vctx.fillText(`${Math.round(freq)} Hz`, 4, Math.max(10, yTick - 2));
    }

    // draw every point currently inside the window, not just newly-arrived ones
    let prev: { x: number; y: number } | null = null;
    for (const p of pitches) {
      if (!p || p.time < startSec || p.time > endSec) { prev = null; continue; }
      const x = ((p.time - startSec) / WINDOW_SECONDS) * w;
      const y = freqToY(p.pitchHz, h);
      if (prev) {
        vctx.strokeStyle = colors.pitchLine;
        vctx.lineWidth = 1.5;
        vctx.beginPath();
        vctx.moveTo(prev.x, prev.y);
        vctx.lineTo(x, y);
        vctx.stroke();
      }
      vctx.fillStyle = colors.pitchDot;
      vctx.beginPath();
      vctx.arc(x, y, 2, 0, Math.PI * 2);
      vctx.fill();
      debugLog(`[PitchPanel] added pitch ${p.pitchHz} at ${p.time}`);
      prev = { x, y };
    }

    // draw playback needle: prefer needleFrac if provided (global alignment)
    let pxMarker: number | null = null;
    if (typeof needleFrac === 'number' && isFinite(needleFrac)) {
      pxMarker = Math.round(needleFrac * w);
    } else if (playbackSec >= 0) {
      pxMarker = Math.round(((playbackSec - startSec) / WINDOW_SECONDS) * w);
    }
    if (pxMarker !== null && showNeedle) {
      vctx.strokeStyle = colors.playbackNeedle;
      vctx.lineWidth = 1;
      vctx.beginPath();
      vctx.moveTo(pxMarker + 0.5, 0);
      vctx.lineTo(pxMarker + 0.5, h);
      vctx.stroke();
    }
    debugLog('[PitchPanel] draw', { pitchesLen: pitches.length, startSec, endSec, pxMarker });
  }, [pitches, playbackFrame, needleFrac, minFreq, maxFreq, showNeedle]);

  return (
    <div style={{ border: `2px solid ${colors.panelBorder}`, borderRadius: 10, margin: '16px 0', padding: 16, background: colors.panelBackground, position: 'relative' }}>
      <div style={{ fontWeight: 'bold', fontSize: 22, marginBottom: 8 }}>{strings.pitchPanel.heading}</div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', borderRadius: 6, marginBottom: 8, width: '100%', height: PITCH_CANVAS_HEIGHT_PX }}
      />
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <label style={{ marginRight: 8 }}>
          <input type="radio" name="pitch-mode" checked={pitchMode === 'peak'} onChange={() => setPitchMode && setPitchMode('peak')} /> {strings.pitchPanel.modePeak}
        </label>
        <label style={{ marginRight: 8 }}>
          <input type="radio" name="pitch-mode" checked={pitchMode === 'yin'} onChange={() => setPitchMode && setPitchMode('yin')} /> {strings.pitchPanel.modeYin}
        </label>
        <label>
          <input type="radio" name="pitch-mode" checked={pitchMode === 'rnd'} onChange={() => setPitchMode && setPitchMode('rnd')} /> {strings.pitchPanel.modeOwn}
        </label>
      </div>
    </div>
  );
};

export default PitchPanel;
