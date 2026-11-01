// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js/dist/wavesurfer.esm.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';
import { debugLog } from '../utils/debug';
import { colors, WAVEFORM_HEIGHT_PX, SPECTROGRAM_HEIGHT_PX, SPECTROGRAM_CONTAINER_HEIGHT_PX, WAVEFORM_PANEL_DEFAULT_EMIT_INTERVAL_MS } from '../config/uiConfig';
import { SAMPLE_RATE, FRAME_HOP_SEC, SESSION_DURATION_SEC } from '../config/processingConfig';
import { strings } from '../config/strings';

interface WaveformProps {
  audioUrl?: string;
  waveform?: Float32Array | null;
  showNeedle?: boolean;
  showControls?: boolean;
  playbackFrame?: number;
  onPlaybackFrame?: (frame: number) => void;
  emitIntervalMs?: number; // throttle interval for onPlaybackFrame in ms
  onReady?: (ws: any) => void;
  onNeedleFrac?: (frac: number, timeSec:number) => void;
  displayMode?: 'wave' | 'spec';
  setDisplayMode?: (m:  'wave' | 'spec') => void;
}

function floatToWavBlob(channelData: Float32Array, sampleRate = SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + channelData.length * 2);
  const view = new DataView(buffer);
  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + channelData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, channelData.length * 2, true);
  let offset = 44;
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, channelData[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

const WaveformPanel: React.FC<WaveformProps> = ({ audioUrl, waveform = null, showNeedle = true, showControls = false, playbackFrame = -1, onPlaybackFrame, emitIntervalMs = WAVEFORM_PANEL_DEFAULT_EMIT_INTERVAL_MS, onReady, onNeedleFrac, displayMode = 'wave', setDisplayMode }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spectRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<any | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const frameDuration = FRAME_HOP_SEC; // one "frame" = one analysis hop (see config/processingConfig.ts)
  const lastEmitRef = useRef<number>(0);
  const DISPLAY_SECONDS = SESSION_DURATION_SEC;

  function trimOrPadFloat32(input: Float32Array, sampleRate: number, targetSeconds: number) {
    const targetLen = Math.round(sampleRate * targetSeconds);
    if (input.length === targetLen) return input;
    const out = new Float32Array(targetLen);
    if (input.length >= targetLen) {
      // truncate
      out.set(input.subarray(0, targetLen));
    } else {
      // copy and leave rest zeros (pad)
      out.set(input);
      // zeros already
    }
    return out;
  }

  useEffect(() => {
    if (!containerRef.current) return;
    debugLog('[WaveformPanel] create WaveSurfer');
    // create plugin list conditionally so spectrogram container is only created when needed
    const plugins: any[] = [];
    if (displayMode === 'spec') {
      plugins.push(SpectrogramPlugin.create({
        container: spectRef.current || document.createElement('div'),
        labels: true,
        height: SPECTROGRAM_HEIGHT_PX,
      }));
    }
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: colors.waveColor,
      progressColor: colors.waveProgressColor,
      cursorColor: colors.waveCursorColor,
      height: WAVEFORM_HEIGHT_PX,
      responsive: true,
      normalize: true,
      interact: true,
      plugins,
    });

    wsRef.current = ws;
    ws.on('ready', () => {
      debugLog('[WaveformPanel] wavesurfer ready, duration:', ws.getDuration());
      setReady(true);
      if (onReady) onReady(ws);
    });

    ws.on('destroy', () => {
      wsRef.current = null;
    });

    return () => {
      try {
        ws.destroy();
      } catch {}
      wsRef.current = null;
    };
  // re-create WaveSurfer when the displayMode changes so plugins list updates
  }, [displayMode]);

  // overlay needle drawing: driven by `playbackFrame` (RecordButton/audio element is single source)
    useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;

    const cEl = canvas as HTMLCanvasElement;
    let raf = 0;

    function setCanvasHiDPI(c: HTMLCanvasElement) {
      const dpr = window.devicePixelRatio || 1;
      // medir desde el contenedor de WaveSurfer para que overlay coincida exactamente
      const measureEl = containerRef.current ?? c;
      const rect = measureEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        debugLog('[WaveformPanel] setCanvasHiDPI: zero-size parent', { rect });
        return;
      }
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
    }

    function drawNeedleAtTime(timeSec: number) {
      // medir desde el contenedor y usar la duración real del audio
      const measureEl = containerRef.current ?? cEl;
      const rect = measureEl.getBoundingClientRect();
      const ctx = cEl.getContext('2d');
      if (!ctx || rect.width === 0 || rect.height === 0) return;
      const ws = wsRef.current;
      // preferir duración de WaveSurfer; fallback a 6 si no disponible
      const duration = ws && typeof ws.getDuration === 'function' ? ws.getDuration() || 6 : 6;
      const frac = duration > 0 ? Math.max(0, Math.min(1, timeSec / duration)) : 0;
      const x = Math.round(frac * rect.width);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.beginPath();
      ctx.strokeStyle = colors.playbackNeedle;
      ctx.lineWidth = 2;
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, rect.height);
      ctx.stroke();
      try { onNeedleFrac?.(frac, timeSec); } catch (e) { /* ignore */ }
      debugLog('[WaveformPanel] drawNeedle', { timeSec, duration, frac, x, cssW: rect.width });
    }

    function render() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (typeof playbackFrame === 'number' && playbackFrame >= 0) {
          drawNeedleAtTime(playbackFrame * frameDuration);
        } else {
          // clear if no playback
          const measureEl = containerRef.current ?? cEl;
          const rect = measureEl.getBoundingClientRect();
          const ctx = cEl.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, rect.width, rect.height);
        }
      });
    }

    setCanvasHiDPI(cEl);
    render();

    const ro = new ResizeObserver(() => {
      setCanvasHiDPI(cEl);
      render();
    });
    resizeObserverRef.current = ro;
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (resizeObserverRef.current && containerRef.current) {
        try { resizeObserverRef.current.unobserve(containerRef.current); } catch {}
      }
      resizeObserverRef.current = null;
    };
  }, [playbackFrame, showNeedle, ready]);


  // load audio when audioUrl or waveform changes; enforce fixed DISPLAY_SECONDS duration
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    let mounted = true;

    async function loadFixedLengthFromUrl(url: string) {
      try {
        debugLog('[WaveformPanel] fetching audioUrl for fixed-length load', url);
        const resp = await fetch(url);
        const ab = await resp.arrayBuffer();
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ac = new AC();
        const decoded = await ac.decodeAudioData(ab);
        // convert to mono by averaging channels
        const nch = decoded.numberOfChannels;
        const len = Math.round(decoded.sampleRate * DISPLAY_SECONDS);
        const out = new Float32Array(len);
        for (let c = 0; c < nch; c++) {
          const data = decoded.getChannelData(c);
          // copy/truncate/pad per channel into temp then accumulate
          const tmp = trimOrPadFloat32(data, decoded.sampleRate, DISPLAY_SECONDS);
          for (let i = 0; i < len; i++) out[i] += tmp[i] / nch;
        }
        // if sampleRate differs from target SAMPLE_RATE, resampling could be needed
        if (decoded.sampleRate !== SAMPLE_RATE) {
          debugLog('[WaveformPanel] resampling audio from', decoded.sampleRate, 'to', SAMPLE_RATE, '— simple nearest');
          // simple nearest-neighbor resample (cheap, acceptable for visualization)
          const resLen = Math.round(SAMPLE_RATE * DISPLAY_SECONDS);
          const res = new Float32Array(resLen);
          for (let i = 0; i < resLen; i++) {
            const srcIndex = Math.floor(i * (out.length / resLen));
            res[i] = out[Math.min(srcIndex, out.length - 1)];
          }
          return res;
        }
        return out;
      } catch (e) {
        debugLog('[WaveformPanel] loadFixedLengthFromUrl error', e);
        return null;
      }
    }

    async function doLoad() {
      if (audioUrl) {
        const fixed = await loadFixedLengthFromUrl(audioUrl);
        if (!mounted) return;
        if (fixed) {
          const blob = floatToWavBlob(fixed, SAMPLE_RATE);
          // @ts-ignore
          ws.loadBlob(blob);
          return;
        }
        // fallback to normal load
        ws.load(audioUrl);
        return;
      }

      if (waveform && waveform.length > 0) {
        debugLog('[WaveformPanel] loading waveform blob (trim/pad to 6s)');
        const fixed = trimOrPadFloat32(waveform, SAMPLE_RATE, DISPLAY_SECONDS);
        const blob = floatToWavBlob(fixed, SAMPLE_RATE);
        // @ts-ignore
        ws.loadBlob(blob);
        return;
      }

      ws.empty();
      setReady(false);
    }

    doLoad();

    return () => { mounted = false; };
  }, [audioUrl, waveform]);

  return (
    <div style={{ border: '2px solid ' + colors.panelBorder, borderRadius: 10, margin: '16px 0', padding: 16, background: colors.panelBackground, position: 'relative' }}>
      <div style={{ fontWeight: 'bold', fontSize: 22, marginBottom: 8 }}>{strings.waveformPanel.heading}</div>

      <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', display: displayMode === 'wave' ? 'block' : 'none' }}>
        <div ref={containerRef} />
        {/* overlay canvas positioned on top of WaveSurfer container */}
        <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>

      <div 
        ref={spectRef}
        style={{ marginTop: 8, background: colors.spectrogramBackground, height: SPECTROGRAM_CONTAINER_HEIGHT_PX, display: displayMode === 'spec' ? 'block' : 'none' }}
      />
      
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <label style={{ marginRight: 8 }}>
          <input type="radio" name="display-mode" checked={displayMode === 'wave'} onChange={() => setDisplayMode && setDisplayMode('wave')} /> {strings.waveformPanel.modeWaveform}
        </label>
        <label style={{ marginRight: 8 }}>
          <input type="radio" name="display-mode" checked={displayMode === 'spec'} onChange={() => setDisplayMode && setDisplayMode('spec')} /> {strings.waveformPanel.modeSpectrogram}
        </label>
      </div>
    </div>
  );
};

export default WaveformPanel;