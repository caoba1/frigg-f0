
# Frontend workflow & file map

This document summarizes the main frontend files, exported components and the important functions/blocks with approximate line ranges. I scanned the codebase twice to collect the mappings.

Notes:

- FRAME_SIZE = 480 samples, SAMPLE_RATE = 48000, display window = 6 seconds.
- The recording flow is implemented in `RecordButton.tsx`. Waveform and pitch panels are rendered by `App.tsx`.

## frontend/src/app/App.tsx

- Export: `default App` (React.FC)

- Key elements (approx. lines):

  - state: `waveform`, `pitches`, `playbackFrame` — top of component

  - handlers: `handleSetWaveform(w)` — sets waveform and resets pitches

  - handlers: `handlePitch(frame)` — appends a pitch frame to `pitches`

  - JSX: renders `WaveformPanel`, `PitchPanel`, `ConfigPanel`, and `RecordButton` (lines ~20–40)

## frontend/src/main.tsx

- App bootstrap (ReactDOM.createRoot → render `<App />`) (small file)

## frontend/src/components/RecordButton.tsx

- Export: `default RecordButton` (React.FC)

- Purpose: capture audio via WebAudio API, buffer samples, slice frames, upload frames to `/api/analyze_frame`, create a full WAV blob for playback, expose `setWaveform` and `onPitch` callbacks and `onPlaybackFrame` callback.

- Important symbols & blocks (approx. lines):

  - `encodeWav(samples, sampleRate)` — line ~5

  - constants: `SAMPLE_RATE`, `FRAME_SIZE`, `MAX_RECORDING_TIME` — top

  - props: `setWaveform`, `onPitch`, `onPlaybackFrame` — interface

  - `handleClick()` — starts/stops recording, sets up AudioContext and ScriptProcessorNode — main capture logic

  - `handleStop()` — concatenates buffers, slices frames, uploads frames sequentially, builds full WAV blob & sets `playbackUrl`

  - audio `timeupdate` handler — computes playback frame and calls `onPlaybackFrame`

  - `handlePlay()` — sets audio.src, load, and awaits play()

  - small overlay with playback diagnostics (playbackFrame, playbackTime, audio.currentTime)

## frontend/src/components/WaveformPanel.tsx

- Export: `default WaveformPanel`

- Purpose: Draw the full 6s waveform, time ticks, optional pitch overlay, and playback needle.

- Key blocks:

  - drawing useEffect: canvas setup, tick drawing, waveform sampling & drawing, playback needle mapping from `playbackFrame` and `FRAME_SIZE`, pitch overlay plotting.

## frontend/src/components/PitchPanel.tsx

- Export: `default PitchPanel`

- Purpose: Draw pitch contour and the two needles (analysis and playback).

- Key blocks:

  - Accepts `pitches` (time-based) or `pitchResults` (per-frame) and prefers `pitches`.

  - Draw curve using time->x mapping (assumes 6s) or index->x mapping for per-frame data.

  - Draws analysis needle (lastAnalyzedFrame) and playback needle (playbackFrame -> time -> x).

## frontend/src/components/ConfigPanel.tsx

- Export: `default ConfigPanel`

- Purpose: device selectors (input/output) and placeholder for advanced settings. Uses `navigator.mediaDevices.enumerateDevices()`.

## audio helpers (under `frontend/src/audio/`)

- `capture.ts`: helpers for microphone stream / MediaRecorder (getMicrophoneStream, startMediaRecorder).

- `streamer.ts`: `Streamer` class — WebSocket-based streamer that can send PCM frames to a WS analyzer; emits `onPitch` callbacks.

- `fileInput.ts`: `readAudioFile(file)` utility for test file input.

- `decode.ts`: `decodeAudioToPCM(arrayBuffer)` to decode audio into PCM via WebAudio.

- `websocket.ts`: simple WS client helper `connectWS(sessionId, onPitch)`.

## frontend/src/state/sessionStore.ts

- A small React hook `useSession()` for sessionId and settings state.

## frontend/src/utils/debug.ts

- Exports: `DEBUG` flag, `setDebug(val)`, `debugLog(...args)` which logs when `DEBUG` is true; also implements an in-memory buffer, `getLogs()`, `subscribeLogs()` and `clearLogs()` used by the optional debug panel.

## frontend/src/utils/formatPitch.ts, time.ts

- Small format helpers: `formatPitch(pitchHz)` and `formatTime(sec)`.

---

If you want, I can add exact line numbers (automatically) for these files and append them to this document. I can also add a brief flow diagram (sequence) that shows data flow for Record → Upload frames → Backend → Visualize. Which exact addition do you want next?
