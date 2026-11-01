// Audio capture using MediaRecorder and Web Audio API
export async function getMicrophoneStream(): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({ audio: true });
}

export function startMediaRecorder(stream: MediaStream, onData: (chunk: Blob) => void): MediaRecorder {
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  recorder.ondataavailable = (e) => onData(e.data);
  recorder.start(100); // 100ms chunks
  return recorder;
}
