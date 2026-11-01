# Audio Pitch Demonstrator — Developer Guide

This project is a full-stack, cloud-ready audio analysis demonstrator. It features a modern browser UI and a C backend for real-time pitch detection (YIN algorithm), designed for research, education, and reproducible experiments.

---

## Project Structure

```
frigg-f0/
├── backend/           # C server for analysis, REST & WebSocket endpoints
│   ├── src/           # C source files (server, routes, audio_io, yin, session, s3)
│   ├── include/       # C headers
│   ├── third_party/   # YIN library (or other pitch detectors)
│   ├── CMakeLists.txt # Build config
│   └── api_contract.md# API and message schema
├── frontend/          # React + TypeScript web app
│   ├── src/app/       # App entry and layout
│   ├── src/components/# UI panels (Waveform, Pitch, Config, Record)
│   ├── src/audio/     # Audio capture, WebSocket, file input, decode
│   ├── src/state/     # Session state
│   ├── src/utils/     # Formatting helpers
│   ├── package.json   # Frontend dependencies
│   ├── index.html     # App entry point
│   └── tsconfig.json  # TypeScript config
├── README-user.md     # End-user guide
├── README-dev.md      # This file
└── ...
```

---

## Common Endpoints

### REST
- `POST /api/session/start` — Create a session, get sessionId and settings
- `POST /api/session/{sessionId}/stop` — Finalize session, store metadata
- `POST /api/upload-url` — Get presigned S3 URL for audio upload

### WebSocket
- `WS /api/analyze/{sessionId}` — Stream audio chunks, receive pitch frames

See `backend/api_contract.md` for full message schemas.

---

## Frontend Structure
- **WaveformPanel**: Shows the audio waveform
- **PitchPanel**: Shows the pitch contour
- **ConfigPanel**: Advanced analysis settings
- **RecordButton**: Start/stop recording
- **audio/**: Handles mic capture, file input, and WebSocket streaming
- **state/**: Session and settings state
- **utils/**: Formatting helpers

---


## Running Locally for Development

### 1. Start the Backend
```bash
cd backend
mkdir -p build
cd build
cmake ..
make
./yin_server
```
The backend will listen on `localhost:8080` by default.

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will run at `http://localhost:5173` (or similar).

### 3. How the Backend is Accessed

- **REST API:**
  - `http://localhost:8080/api/session/start` (start a session)
  - `http://localhost:8080/api/session/{sessionId}/stop` (stop a session)
  - `http://localhost:8080/api/upload-url` (get upload URL)
- **WebSocket API:**
  - `ws://localhost:8080/api/analyze/{sessionId}` (stream audio and receive pitch)


The frontend is preconfigured to connect to these endpoints during development.

---

## Testing the Application

- **Test the backend:**
  1. Open a terminal and run:
    ```bash
    cd backend
    mkdir -p build && cd build
    cmake ..
    make
    ./yin_server
    ```
  2. Use a tool like `curl` or Postman to send requests to `http://localhost:8080/api/session/start` and other endpoints.

- **Test the frontend:**
  1. Open a new terminal and run:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
  2. Open the browser at the URL shown (usually http://localhost:5173).
  3. Interact with the app and verify that recording, uploading, and visualization work.

---

## Running the Server on AWS

### 1. Build the Backend
- SSH to your AWS EC2 instance (or use ECS/Fargate for containers)
- Install build tools: `sudo apt update && sudo apt install build-essential cmake`
- Clone the repo and build:
  ```sh
  git clone <repo-url>
  cd frigg-f0/backend
  mkdir build && cd build
  cmake ..
  make
  ./yin_server
  ```

### 2. Expose Endpoints
- Use Nginx or AWS Application Load Balancer to route HTTP/WS traffic to your server
- Open ports 80/443 (HTTP/HTTPS) and your WebSocket port (e.g., 8080)

### 3. S3 Setup
- Create an S3 bucket for audio uploads
- Use AWS SDK in `src/s3.c` to generate presigned URLs
- Store session audio and results in S3

### 4. Deploy the Frontend
- Build with Vite: `cd ../frontend && npm install && npm run build`
- Upload `frontend/dist/` to S3 (for static hosting) or serve with Nginx

---

## Contributing
- Fork, branch, and submit PRs for new features or bugfixes
- See `api_contract.md` for endpoint/message details

---

## Contact
For questions or collaboration, open an issue or contact the maintainers.
