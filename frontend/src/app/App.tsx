import React, { useState, useRef, useEffect } from 'react';
import WaveformPanel from '../components/WaveformPanel';
import PitchPanel from '../components/PitchPanel';
import RecordButton from '../components/RecordButton';
import ConfigPanel from '../components/ConfigPanel';
import DebugLog from '../components/DebugLog';
import {debugLog} from '../utils/debug';
import { traceEvent } from '../utils/debug';
import useCallManager from '../components/CallManager';
import { NEEDLE_SMOOTHING_TAU_MS, WAVEFORM_EMIT_INTERVAL_MS } from '../config/uiConfig';
import { strings } from '../config/strings';


// Fallback pitch/rate config now lives solely in CallManager.tsx (useCallManager defaults).
// Pass an `opts` object here only if you need to override those defaults for this app instance.

const App: React.FC = () => {
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [displayMode, setDisplayMode] = useState<'wave' | 'spec'>('wave');
  
  // managed by call manager
  
  const [playbackFrame, setPlaybackFrame] = useState<number>(-1);
  const [needleFrac, setNeedleFrac] = useState<number | null>(null);
  const rawNeedleRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number | null>(null);
  const wsRef = React.useRef<any | null>(null);

  const { pitches, registerRequest, resolveRequest, reset, mode: pitchMode, setMode: setPitchMode } = useCallManager();

  // smoothing loop for needle fraction (exponential smoothing)
  useEffect(() => {
    const TAU_MS = NEEDLE_SMOOTHING_TAU_MS;
    let raf = 0;
    let last = performance.now();
    function step(now: number) {
      const dt = Math.max(0, now - last);
      last = now;
      const raw = rawNeedleRef.current;
      if (typeof raw === 'number' && isFinite(raw)) {
        if (smoothedRef.current == null) smoothedRef.current = raw;
        else {
          const alpha = 1 - Math.exp(-dt / TAU_MS);
          smoothedRef.current = smoothedRef.current + alpha * (raw - smoothedRef.current);
        }
        const cur = smoothedRef.current;
        const prev = lastEmitRef.current;
        if (prev == null || Math.abs(prev - cur) > 1e-4) {
          lastEmitRef.current = cur;
          setNeedleFrac(cur);
        }
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  
  const handleSetWaveform = (w: Float32Array | null) => {
    debugLog('[App]', 'setWaveform called with', w ? w.length : null);
    setWaveform(w);
    // reset pitches for a fresh recording
    reset();
  };

  // Force the needle to snap to a value instantly, bypassing the smoothing loop.
  // Use this for hard resets (e.g. auto-stop at 6s) so the needle doesn't glide back.
  const forceNeedleReset = React.useCallback((frac: number = 0) => {
    rawNeedleRef.current = frac;
    smoothedRef.current = frac;
    lastEmitRef.current = frac;
    setNeedleFrac(frac);
  }, []);

  // log playbackFrame changes for debugging
  React.useEffect(() => {
    debugLog('[App] playbackFrame', playbackFrame);
  }, [playbackFrame]);

  // keep the browser tab title in sync with strings.ts (index.html has a static
  // placeholder title that's only visible before JS loads)
  useEffect(() => {
    document.title = strings.appTitle;
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>{strings.appTitle}</h1>
      <WaveformPanel 
        waveform={waveform}
  displayMode={displayMode}
  setDisplayMode={setDisplayMode}
        playbackFrame={playbackFrame}
        onReady={(ws) => { wsRef.current = ws; debugLog('[App] WaveSurfer ready stored'); }}
        onNeedleFrac={(frac) => { rawNeedleRef.current = frac; }}   // raw emitter
        emitIntervalMs={WAVEFORM_EMIT_INTERVAL_MS}
        showNeedle={true} />
      <PitchPanel 
        pitches={pitches} 
        playbackFrame={playbackFrame} 
        needleFrac={needleFrac}    // <-- new
        pitchMode={pitchMode}
        setPitchMode={setPitchMode}
        showNeedle={true} />
      <RecordButton 
        setWaveform={handleSetWaveform} 
        registerRequest={registerRequest}
        resolveRequest={resolveRequest}
        onPlaybackFrame={setPlaybackFrame} // updates 
        onForceNeedleReset={forceNeedleReset}
        onPlay={reset} // clear the pitch panel each time playback (re)starts
        // sync at "timeupdate" WaveSurfer's own cursor
        // playbackFrame (App state) is then passed down to both panels:
        onSyncTime={(t: number) => {
          const ws = wsRef.current;
          try {
            if (ws && typeof ws.getDuration === 'function') {
              const dur = ws.getDuration();
              if (dur && dur > 0) {
                const frac = Math.max(0, Math.min(1, t / dur));
                try { 
                  ws.seekTo(frac);

                 } catch (e) { debugLog('[App] ws.seekTo failed', e); }
              }
            }
          } catch (e) {
            debugLog('[App] onSyncTime handler error', e);
          }
        }} />
      <ConfigPanel />
      <DebugLog />
    </div>
  );
};

export default App;
