
import React, { useState, useRef, useEffect } from 'react';
import { debugLog, traceEvent } from '../utils/debug';
import { colors } from '../config/uiConfig';
import type { FrameAnalysisResult } from '../types/analysis';
import { SAMPLE_RATE, FRAME_HOP_SEC, FRAME_HOP_SAMPLES, FRAME_WINDOW_SAMPLES, SESSION_DURATION_SEC, SESSION_DURATION_MS } from '../config/processingConfig';
import { strings } from '../config/strings';
// Panels are rendered by the top-level App to avoid duplication
// Utilidad para convertir Float32Array a WAV mono
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Uint8Array(buffer);
}


interface RecordButtonProps {
  setWaveform?: (w: Float32Array | null) => void;
  registerRequest?: (frameId: string, time: number) => void; // call right before sending a frame to the analyzer
  resolveRequest?: (frameId: string, pitchHz: number | null, harmonicEnergy?: number) => void; // call once the analyzer responds (or fails)
  onPlaybackFrame?: (frame: number) => void;
  onSyncTime?: (timeSec: number) => void; // notify external visualizer to seek/play
  onForceNeedleReset?: (frac?: number) => void; // hard-reset needle (bypass smoothing)
  onPlay?: () => void; // notify parent that playback is (re)starting, e.g. to clear the pitch panel
}

const RecordButton: React.FC<RecordButtonProps> = ({ setWaveform, registerRequest, resolveRequest, onPlaybackFrame, onSyncTime, onForceNeedleReset, onPlay }) => {
  const [recording, setRecording] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackFrame, setPlaybackFrame] = useState<number>(0);
  const [waveformFull, setWaveformFull] = useState<Float32Array | null>(null);
  const [showControls, setShowControls] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const recordTimeout = useRef<number | null>(null);

  const handleClick = async () => {
    if (!recording) {
  debugLog('[RecordButton] handleClick: start recording');
      setRecording(true);
      setPlaybackUrl(null);
      bufferRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          bufferRef.current.push(new Float32Array(input));
        };

        // Parar automáticamente después de SESSION_DURATION_MS
        recordTimeout.current = window.setTimeout(() => {
          handleStop();
        }, SESSION_DURATION_MS);
      } catch (err) {
  debugLog('[RecordButton] handleClick: getUserMedia error', err);
        setRecording(false);
      }
    } else {
  debugLog('[RecordButton] handleClick: user requested stop');
    handleStop();
    }
  };

  const handleStop = async () => {
    setRecording(false);
    if (recordTimeout.current) clearTimeout(recordTimeout.current);
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());

    // Concatenate Float32Array chunks correctly
    let all: Float32Array;
    if (!bufferRef.current || bufferRef.current.length === 0) {
      all = new Float32Array(0);
    } else {
      const totalLen = bufferRef.current.reduce((s, c) => s + c.length, 0);
      all = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of bufferRef.current) {
        all.set(chunk, offset);
        offset += chunk.length;
      }
    }
    debugLog('[RecordButton] handleStop: concatenated samples', { chunks: bufferRef.current.length, totalLen: all.length });

    if (all.length > 0) {
      setWaveformFull(all);
      if (setWaveform) {
        setWaveform(all);
      }
      // reset sent hops for this newly-recorded waveform
      sentHopsRef.current = new Set();
      lastSentHopRef.current = -1;
  const wavData = encodeWav(all, SAMPLE_RATE);
      // Use exact ArrayBuffer slice for the Uint8Array view
  // Use the Uint8Array returned by encodeWav directly to avoid ArrayBuffer/SharedArrayBuffer typing issues
  const wavCopy = wavData.slice();
  const blob = new Blob([wavCopy], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

      // quick WAV header validation using the Uint8Array copy
      try {
        const hdr = wavCopy.subarray(0, 44);
        const s = String.fromCharCode(...hdr.slice(0, 4));
        const s2 = String.fromCharCode(...hdr.slice(8, 12));
        const dataLen = new DataView(wavCopy.buffer, wavCopy.byteOffset + 40, 4).getUint32(0, true);
        const ok = s === 'RIFF' && s2 === 'WAVE' && dataLen > 0 && (dataLen + 44) === wavData.byteLength;
        const info = `hdr=${s}/${s2} dataLen=${dataLen} ok=${ok}`;
        if (ok) {
          setPlaybackUrl(url);
          debugLog('[RecordButton] handleStop: created playbackUrl', url, 'waveformLen', all.length);
        } else {
          debugLog('[RecordButton] handleStop: wav validation failed', info);
        }
      } catch (e) {
        debugLog('[RecordButton] handleStop: wav-validate-exception', e);
      }
    } else {
      setWaveformFull(null);
    }
  };

  // time monitor ... Update playbackFrame from audio element timeupdate
  // The <audio> element fires its native timeupdate event periodically (browser-driven, ~4-66ms depending on browser/OS).
 // This is the only clock — nothing else polls time independently. see App.tsx
  useEffect(() => {
  const audio = audioRef.current;
    if (!audio) return;
    const frameDuration = FRAME_HOP_SEC; // one "frame" = one analysis hop (see config/processingConfig.ts)
  const onTimeUpdate = () => {
    // Stop and reset once we hit the session duration limit
    if (audio.currentTime >= SESSION_DURATION_SEC) {
      audio.pause();               // 1. stop playback
      audio.currentTime = 0;
      setPlaybackFrame(0);

      if (onPlaybackFrame) {
        try { onPlaybackFrame(0); } catch (e) { debugLog('[RecordButton] onPlaybackFrame error', e); }
      }
      try { if (onSyncTime) onSyncTime(0); } catch (e) { debugLog('[RecordButton] onSyncTime error', e); } // 2. reset waveform display (WaveSurfer seekTo 0)
      try { if (onForceNeedleReset) onForceNeedleReset(0); } catch (e) { debugLog('[RecordButton] onForceNeedleReset error', e); } // 3+4. reset pitch display + snap needle to zero
      debugLog('[RecordButton] timeupdate: reached 6s limit, stopped and reset');
      return;
    }
    // Use fractional frame index for smooth needle movement
    const fracFrame = audio.currentTime / frameDuration;
    // debug timeupdate
  debugLog('[RecordButton] timeupdate', { currentTime: audio.currentTime, fracFrame });
    setPlaybackFrame(fracFrame);
    if (onPlaybackFrame) {
  try { onPlaybackFrame(fracFrame); } catch (e) { debugLog('[RecordButton] onPlaybackFrame error', e); }
    }
  // notify external visualizer (WaveSurfer) to sync
  try { if (onSyncTime) onSyncTime(audio.currentTime); } catch (e) { debugLog('[RecordButton] onSyncTime error', e); }
  };
    const onLoaded = () => {
      try {
        debugLog('[RecordButton] loadedmetadata', { duration: audio.duration, readyState: audio.readyState });
      } catch (e) { debugLog('[RecordButton] loadedmetadata error', e); }
    };
    const onError = () => {
      try { debugLog('[RecordButton] audio error', audio.error); } catch (e) { debugLog('[RecordButton] audio error handler failed', e); }
    };

    audio.addEventListener('timeupdate', onTimeUpdate); // add time monitor
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError as EventListener);
    debugLog('[RecordButton] attached audio listeners', { playbackUrl });
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError as EventListener);
    };
  }, [playbackUrl]);

  // subscribe to debug logs to show last messages in overlay

  const handlePlay = async () => {
    if (!audioRef.current) {
      debugLog('[RecordButton] handlePlay: audioRef missing');
      return;
    }
    if (!playbackUrl) {
      debugLog('[RecordButton] handlePlay: no playbackUrl');
      return;
    }
    try {
      debugLog('[RecordButton] handlePlay: starting play', { srcBefore: audioRef.current.src, playbackUrl });
      try { if (onPlay) onPlay(); } catch (e) { debugLog('[RecordButton] onPlay error', e); } // clear stale pitch points from a previous pass
      // Every replay must re-send all hops from the top, otherwise they're
      // already in sentHopsRef from the previous pass and sendFrame never
      // fires again — leaving the just-cleared pitch panel empty forever.
      sentHopsRef.current = new Set();
      lastSentHopRef.current = -1;

      audioRef.current.src = playbackUrl;
      audioRef.current.load(); // resets cursor to zero

      debugLog('[RecordButton] handlePlay: after load', { readyState: audioRef.current.readyState, duration: audioRef.current.duration });
      // load() already resets currentTime to 0 per spec; guard this in case
      // readyState hasn't settled yet (can throw InvalidStateError in some browsers/timings)
      try { audioRef.current.currentTime = 0; } catch (e) { debugLog('[RecordButton] handlePlay: currentTime reset skipped', e); }
  try { if (onSyncTime) onSyncTime(0); } catch (e) { debugLog('[RecordButton] onSyncTime(start) error', e); }
      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
      debugLog('[RecordButton] handlePlay: play started', { paused: audioRef.current.paused, currentTime: audioRef.current.currentTime });
    } catch (err) {
  debugLog('[RecordButton] handlePlay: play failed', err);
    }
  };

  // --- File load / decode helpers ---
  async function resampleToTarget(sampleBuffer: AudioBuffer, targetSampleRate: number) {
    if (sampleBuffer.sampleRate === targetSampleRate) return sampleBuffer;
    const numberOfChannels = sampleBuffer.numberOfChannels;
    const lengthInSec = sampleBuffer.duration;
    const offlineCtx = new OfflineAudioContext(numberOfChannels, Math.ceil(lengthInSec * targetSampleRate), targetSampleRate);
    const src = offlineCtx.createBufferSource();
    src.buffer = sampleBuffer;
    src.connect(offlineCtx.destination);
    src.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered;
  }

  async function decodeFileToMonoFloat32(arrayBuffer: ArrayBuffer) {
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decoded = await ac.decodeAudioData(arrayBuffer.slice(0));
    const resampled = await resampleToTarget(decoded, SAMPLE_RATE);
    try {
      // nothing
    } finally {
      try { ac.close(); } catch (e) { /* ignore */ }
    }
    // mixdown to mono
    const ch = resampled.numberOfChannels;
    const len = resampled.length;
    const out = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const data = resampled.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] = (out[i] || 0) + data[i] / ch;
    }
    return out;
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [sendDuringPlayback, setSendDuringPlayback] = useState<boolean>(true);
  // Which analysis hops (see config/processingConfig.ts) have already been sent for the
  // currently loaded waveform, so we don't resend the same window twice.
  const sentHopsRef = useRef<Set<number>>(new Set());
  const lastSentHopRef = useRef<number>(-1);

  const handleLoadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setLoadedFileName(f.name);
    try {
      const ab = await f.arrayBuffer();
      const mono = await decodeFileToMonoFloat32(ab);
      // set waveform and create playback blob
      setWaveformFull(mono);
      if (setWaveform) setWaveform(mono);
      const wavData = encodeWav(mono, SAMPLE_RATE);
      const wavCopy = wavData.slice();
      const blob = new Blob([wavCopy], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setPlaybackUrl(url);
      debugLog('[RecordButton] handleFileSelected: loaded', f.name, 'samples', mono.length);
      // reset sent hops for this newly-loaded waveform
      sentHopsRef.current = new Set();
      lastSentHopRef.current = -1;
    } catch (err) {
      debugLog('[RecordButton] handleFileSelected: decode failed', err);
    }
  };

  // Sends the FRAME_WINDOW_SAMPLES-long analysis window starting at hopIndex * FRAME_HOP_SAMPLES.
  // Consecutive windows overlap (hop < window, see config/processingConfig.ts), and each one produces
  // one point in the pitch display at time = hopIndex * FRAME_HOP_SEC.
  async function sendFrame(hopIndex: number) {
    if (!waveformFull) return;
    const start = Math.floor(hopIndex * FRAME_HOP_SAMPLES);
    const end = Math.min(start + FRAME_WINDOW_SAMPLES, waveformFull.length);
    if (start >= end) return;
    const samples = waveformFull.subarray(start, end);
    const wavData = encodeWav(samples, SAMPLE_RATE);
    // Safe chunked conversion to base64 to avoid call-stack limits
    function uint8ToBase64(u8: Uint8Array) {
      const CHUNK = 0x8000; // 32k
      let i = 0;
      const parts: string[] = [];
      while (i < u8.length) {
        const slice = u8.subarray(i, i + CHUNK);
        parts.push(String.fromCharCode.apply(null, Array.from(slice)));
        i += CHUNK;
      }
      return btoa(parts.join(''));
    }
    const base64 = uint8ToBase64(wavData);
    const frameId = `file_frame_${hopIndex}`;
    const timeSec = hopIndex * FRAME_HOP_SEC;
    try {
  traceEvent({ kind: 'post_frame_start', hopIndex, timeSec });
  if (registerRequest) registerRequest(frameId, timeSec); // start this frame's timeout clock before it leaves
  const res = await fetch('/api/analyze_frame', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_id: frameId, data: base64, filetype: 'audio/wav' })
      });
  const json = await res.json().catch(() => null);
  traceEvent({ kind: 'post_frame_result', hopIndex, timeSec, status: res.status, json });
  debugLog('[RecordButton] sendFrame: sent', hopIndex, 'resp', json || res.status);

  // app.py returns { frame_id, result: FrameAnalysisResult } (see backend/schemas.py /
  // frontend/src/types/analysis.ts for the shared contract).
  let pitchHz: number | null = null;
  let harmonicEnergy: number | undefined;
  if (json && !json.error && json.result) {
    const result: FrameAnalysisResult = json.result;
    if (typeof result.pitchHz === 'number' && isFinite(result.pitchHz) && result.pitchHz > 0) {
      pitchHz = result.pitchHz;
    }
    if (typeof result.harmonicEnergy === 'number' && isFinite(result.harmonicEnergy)) {
      harmonicEnergy = result.harmonicEnergy;
    }
  }
  if (resolveRequest) resolveRequest(frameId, pitchHz, harmonicEnergy);
    } catch (e) {
  traceEvent({ kind: 'post_frame_error', hopIndex, timeSec, error: String(e) });
  debugLog('[RecordButton] sendFrame: error', e);
  if (resolveRequest) resolveRequest(frameId, null); // request never completed; let CallManager fall back
    }
  }

  // Watch playback current time and send one overlapping analysis window per hop
  // (FRAME_HOP_SEC apart — see config/processingConfig.ts), so the pitch display gets a
  // point every hop instead of once per second.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (!sendDuringPlayback || !waveformFull) return;
      const hopIndex = Math.floor(audio.currentTime / FRAME_HOP_SEC);
      // Catch up on any hops skipped between two timeupdate ticks (timeupdate
      // fires irregularly and may jump past more than one hop at a time).
      for (let i = lastSentHopRef.current + 1; i <= hopIndex; i++) {
        if (i >= 0 && !sentHopsRef.current.has(i)) {
          sentHopsRef.current.add(i);
          void sendFrame(i);
        }
      }
      if (hopIndex > lastSentHopRef.current) lastSentHopRef.current = hopIndex;
    };
    audio.addEventListener('timeupdate', onTime);
    return () => audio.removeEventListener('timeupdate', onTime);
  }, [sendDuringPlayback, waveformFull]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 }}>
        <button
          style={{
            padding: '12px 32px',
            fontSize: 18,
            background: recording ? colors.buttonActiveBg : colors.buttonPrimaryBg,
            color: colors.buttonPrimaryText,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: recording ? ('0 0 8px 2px ' + colors.buttonActiveBg) : ('0 0 8px 2px ' + colors.buttonPrimaryBg),
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
          onClick={handleClick}
        >
          {recording ? strings.recordButton.stop : strings.recordButton.record}
        </button>
        <button
          style={{
            padding: '12px 32px',
            fontSize: 18,
            background: colors.buttonSecondaryBg,
            color: colors.buttonPrimaryText,
            border: 'none',
            borderRadius: 8,
            cursor: playbackUrl ? 'pointer' : 'not-allowed',
            opacity: playbackUrl ? 1 : 0.5,
          }}
          onClick={handlePlay}
          disabled={!playbackUrl}
        >
          {strings.recordButton.play}
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileSelected} />
        <button
          style={{ padding: '12px 20px', fontSize: 16, background: colors.buttonMutedBg, color: colors.buttonPrimaryText, border: 'none', borderRadius: 8, cursor: 'pointer' }}
          onClick={handleLoadClick}
        >
          {strings.recordButton.loadFile}
        </button>
        <audio ref={audioRef} src={playbackUrl || undefined} autoPlay={false} style={{ display: showControls ? 'block' : 'none' }} controls={showControls} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ color: colors.mutedText, fontSize: 13 }}>
            <input type="checkbox" checked={showControls} onChange={e => setShowControls(e.target.checked)} /> {strings.recordButton.showAudioControls}
          </label>
          <label style={{ color: colors.mutedText, fontSize: 13 }}>
            <input type="checkbox" checked={sendDuringPlayback} onChange={e => setSendDuringPlayback(e.target.checked)} /> {strings.recordButton.sendFramesDuringPlayback}
          </label>
          {loadedFileName ? <div style={{ fontSize: 12, color: colors.bodyText }}>{strings.recordButton.loadedFilePrefix}{loadedFileName}</div> : null}
          <button
            style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6 }}
            onClick={() => { if (playbackUrl) window.open(playbackUrl, '_blank'); }}
            disabled={!playbackUrl}
          >
            {strings.recordButton.openInNewTab}
          </button>
          <button
            style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6 }}
            onClick={async () => {
              if (!playbackUrl) return;
              try {
                debugLog('[RecordButton] testPlay: creating new Audio instance', { playbackUrl });
                const a = new Audio(playbackUrl);
                a.addEventListener('loadedmetadata', () => debugLog('[RecordButton] testPlay: loadedmetadata', { duration: a.duration }));
                a.addEventListener('play', () => debugLog('[RecordButton] testPlay: play event'));
                a.addEventListener('pause', () => debugLog('[RecordButton] testPlay: pause event'));
                a.addEventListener('error', () => debugLog('[RecordButton] testPlay: error', a.error));
                const p = a.play();
                if (p && typeof p.then === 'function') {
                  await p;
                  debugLog('[RecordButton] testPlay: play() resolved', { paused: a.paused, currentTime: a.currentTime });
                }
              } catch (e) {
                debugLog('[RecordButton] testPlay: play failed', e);
              }
            }}
            disabled={!playbackUrl}
          >
            {strings.recordButton.testPlay}
          </button>
        </div>
  {/* Debug overlay removed; use DebugLog component below ConfigPanel */}
      </div>
  {/* Panels moved to App.tsx to avoid duplicated UI; RecordButton exposes waveform/pitch via props */}
    </>
  );
};

export default RecordButton;
