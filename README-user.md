# Audio Pitch Demonstrator — User Guide

Welcome! This web app lets you record or upload audio, then see real-time pitch analysis using a state-of-the-art algorithm. It’s designed for musicians, researchers, and anyone curious about sound.

## What You Can Do
- **Record** your voice or instrument and see the pitch contour live.
- **Upload** a test file and analyze its pitch.
- **Visualize** the waveform and pitch track instantly.
- **Configure** advanced analysis settings for experiments or reproducibility.

## How It Works
1. **Browser UI**: Capture audio, show waveform and pitch, and let you control recording and settings.
2. **Backend Analysis**: The browser sends audio frames to the local Flask backend for pitch analysis.
3. **Results**: The analyzed pitch is returned to the browser and shown with the waveform.


## Quick Start
1. Open the website in your browser.
2. Click **Record** to start, **Stop** to finish.
3. See the pitch and waveform panels update live.
4. Use the **Advanced Configuration** panel to adjust analysis settings.
5. Optionally, upload a WAV file for analysis instead of using the microphone.

## How the Backend is Accessed (Development)

The backend runs locally and exposes one HTTP endpoint used by the frontend:

- `POST http://localhost:8080/api/analyze_frame` — submit a base64-encoded audio frame and receive its pitch analysis as JSON.

The current implementation uses HTTP requests; it does not use a WebSocket API.

## Testing the Application

You can test the backend and frontend locally:

### Quick Local Start (Recommended)

Just run this script from the project root:

```bash
./run_local.sh
```

This starts the backend and frontend development server. Install frontend dependencies first with `cd frontend && npm install`.

Then open your browser at the URL shown (usually http://localhost:5173).

---

### Manual Steps (Advanced)

- **Test the backend:**
	1. Open a terminal and run:
			```bash
			cd backend
			python3 -m pip install -r requirements.txt
			python3 app.py
			```
	2. Run the frontend to send audio frames to `http://localhost:8080/api/analyze_frame`.

- **Test the frontend:**
	1. Open a new terminal and run:
			```bash
			cd frontend
			npm install
			npm run dev
			```
	2. Open the browser at the URL shown (usually http://localhost:5173).
	3. Interact with the app and verify that recording, uploading, and visualization work.

## Privacy & Security
- In local development, audio is sent to the local backend for processing.
- This implementation does not upload audio to cloud storage.

## Support
For help or feedback, contact the project maintainers via the repository or website.
