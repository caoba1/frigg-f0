
# Architecture reference (frontend + backend)

This document maps the most important frontend and backend components to their file locations, exported function / symbol names and the key internal blocks (hooks, drawing loops, API entrypoints). Line ranges were captured from the repository at the time of writing — they may change as files evolve. I performed two sweeps over the codebase to make sure the listed files and functions are covered.

Notes:

- Time axis / frame sizing used throughout the project: FRAME_SIZE = 480 samples @ 48 kHz (10 ms frames), display window = 6 seconds.

- Backend strategy: a lightweight Python HTTP API (`audio_api.py`) receives small per-frame audio files and calls a compiled C++ analyzer (example: `returnPitchByFrame`) which prints JSON to stdout.

---

## Frontend

### frontend/src/components/WaveformPanel.tsx

- File: `frontend/src/components/WaveformPanel.tsx`
- Export: `default WaveformPanel` (React.FC)
- Important symbols & locations (approximate lines):
  - FRAME_SIZE constant — line ~11
  - useEffect (main drawing & rendering block) — lines ~15–91
    - debug logging / early guards — lines ~16–23
    - canvas setup (width/height, clear, background) — lines ~24–28
    - time tick drawing loop (0.5s ticks / 1s major ticks) — lines ~29–45
    - waveform drawing loop (per-pixel sampling from waveform buffer) — lines ~47–56
    - playback needle drawing (maps playbackFrame -> x) — lines ~58–69
    - pitch (f0) overlay plotting (min/max scaling) — lines ~70–90
  - JSX / return wrapper & canvas element — lines ~93–111

Purpose: draw the full 6s waveform, time ticks, an optional pitch overlay, and the synchronized playback needle (blue). The panel expects `waveform?: Float32Array | null`, `pitches?: Array<{time:number,pitchHz:number}>` and optional `playbackFrame?: number`.

### frontend/src/components/PitchPanel.tsx

- File: `frontend/src/components/PitchPanel.tsx`
- Export: `default PitchPanel` (React.FC)
- Important symbols & locations (approximate lines):
  - `type PitchResult` — line ~3
  - `PitchPanelProps` interface — lines ~5–9
  - useEffect (main draw loop) — lines ~16–67
    - canvas clearing and background — lines ~21–23
    - build filtered `valid` pitch list (non-null, >0) — line ~26
    - compute min/max Hz and draw pitch curve (blue) — lines ~28–39
    - analysis needle (red) drawing — lines ~42–52
    - playback needle (blue) drawing — lines ~55–65
  - JSX / return wrapper & canvas element — lines ~69–85

Purpose: render the pitch contour (per-frame pitch results) and two needles: the analysis needle (red) which marks the last analyzed frame, and the playback needle (blue) which follows audio playback. Props are optional to make the component resilient when no data is present.

---

## Backend

I found both a simple Python API and multiple C/C++ server sources. Below are the primary backend artifacts and the functions / entrypoints you’ll want to reference.

### backend/audio_api.py (Python Flask endpoint)

- File: `backend/audio_api.py`
- Entrypoints / functions:
  - `analyze_frame()` — defined as Flask route `@app.route('/api/analyze_frame', methods=['POST'])` (line ~6)
    - Responsibilities:
      - parse JSON request with keys: `frame_id`, `data` (base64), optional `filetype`
      - decode base64 to bytes, write to a temporary file
      - call the configured C++ analyzer executable (example `./my_cpp_frame_analyzer <tempfile>`)
      - remove the temporary file
      - return JSON { frame_id, result } where `result` is the analyzer stdout (JSON string)
    - Error modes: returns HTTP 500 and includes stderr when C++ returns non-zero
  - `if __name__ == '__main__': app.run(port=8080)` — starts dev server (line ~28)

Notes: this Python file is the HTTP shim that lets the frontend POST small WAV blobs per-frame. The C++ program is invoked via subprocess; it must be present and executable in the same directory (or with an absolute path). You can replace the analyzer command inside `analyze_frame()` to point to your production analyzer binary.

### backend/returnPitchByFrame.cpp (example/dummy analyzer)

- File: `backend/returnPitchByFrame.cpp`
- Main symbol(s):
  - `int main(int argc, char* argv[])` — command-line entry point (line ~1)
    - Expects one argument: path to audio file to analyze
    - Tries to open the file and returns a JSON object on stdout like `{ "pitchHz": 220.0, "energy": 0.5 }`
    - Exit code 1 for file errors; prints JSON-formatted error to stderr

Purpose: demo placeholder; replace with a real C++ analyzer that reads the WAV/PCM and computes F0 / energy per frame.

### backend/include/yin.h and backend/include/server.h (C headers)

- File: `backend/include/yin.h`
  - Prototype: `float yin_analyze_frame(const float* audio, size_t length, float sample_rate, float* confidence);` (line ~3)
- File: `backend/include/server.h`
  - Prototype: `void server_run();` (line ~1)

These headers indicate the intended C API for a native analyzer (`yin_analyze_frame`) and a server harness (`server_run`). The `yin_analyze_frame` function signature expects a buffer of floats and returns a pitch estimate and confidence via an out parameter.

### backend/src (C sources / placeholders)

Files found under `backend/src/` and their roles:

- `main.c` — contains `int main()` which calls `server_run()` (line ~1)
  - `main()` -> `server_run()` (server lifecycle)

- `server.c` — implements `server_run()` (line ~1)
  - Current implementation prints a mock message: `"[Mock] Server running. Implement HTTP/WS endpoints here."`

- `routes.c` — placeholder for routing logic (empty file in current tree)
  - Intended symbols: route handlers (not implemented in the stub)

- `audio_io.c` — placeholder for audio I/O and PCM decoding (stub)
  - Intended symbols: functions to read/write PCM/WAV and possibly convert formats

- `s3.c`, `session.c`, `yin.c` — stubs or skeletons
  - `yin.c` is expected to implement `yin_analyze_frame` per the header in `include/yin.h`.

These files show there was an earlier C-based server and audio pipeline in the project. The current hybrid approach uses the Python Flask shim (`audio_api.py`) for HTTP and calls a compiled C++ analyzer for per-frame processing.

### run_local.sh (orchestration script)

- File: `run_local.sh`
- Steps implemented (as of current script):
  1. compile `backend/returnPitchByFrame.cpp` with `g++ -o returnPitchByFrame returnPitchByFrame.cpp`
  2. start Python backend: `python3 audio_api.py &` (captures $BACKEND_PID)
  3. install frontend deps: `npm install` (in `frontend/`)
  4. start frontend dev server: `npm run dev &` (captures $FRONTEND_PID)
  5. trap cleanup on EXIT to kill started PIDs

Purpose: one-click local developer flow to build analyzer, start backend and run frontend dev server. You can modify steps to integrate a different build system (CMake, Makefile) or invoke a different analyzer binary.

---

## Quick follow-ups and suggestions

1. Replace the dummy C++ analyzer: implement `yin_analyze_frame` in `backend/yin.c` (or write a new C++ analyzer) and update `audio_api.py` to call the analyzer binary path you build.
2. Consider returning structured JSON from the analyzer (one object per frame) instead of a raw JSON string; the Python shim currently returns whatever the analyzer prints on stdout as `result`.
3. Add integration tests: a small test that posts a known frame to `/api/analyze_frame` and asserts the JSON shape.


### explicit backend function references (auto-generated)

This section was generated by `tools/gen_line_refs.py`. It lists detected function symbols with exact line numbers.

- File: `backend/audio_api.py`
  - `analyze_frame` — line 10

- File: `backend/returnPitchByFrame.cpp`
  - `main` — line 9
  - `file` — line 15

The auto-generated references are available in `docs/backend_refs.md` (up-to-date). Files removed during cleanup (legacy C server sources and headers) include:

- `backend/src/main.c`
- `backend/src/server.c`
- `backend/src/routes.c`
- `backend/src/audio_io.c`
- `backend/src/s3.c`
- `backend/src/session.c`
- `backend/src/yin.c`
- `backend/include/server.h`
- `backend/include/yin.h`

Only the Python API and the C++ analyzer remain as the active backend components; see `docs/backend_refs.md` for exact symbol line numbers.
