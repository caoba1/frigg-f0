"""
Flask HTTP shim: receives per-frame base64 WAV blobs from the frontend and
returns a FrameAnalysisResult (see schemas.py) computed by audio_processor.
"""

import base64
import logging

from flask import Flask, request, jsonify

from config_interface import InterfaceConfig
from audio_processor import analyze_audio_frame

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.route('/api/analyze_frame', methods=['POST'])
def analyze_frame():
    payload = request.get_json(silent=True) or {}
    frame_id = payload.get('frame_id')
    data_b64 = payload.get('data')
    filetype = payload.get('filetype', 'audio/wav')

    if not frame_id or not data_b64:
        return jsonify({'error': 'Missing frame_id or data'}), 400

    max_bytes = InterfaceConfig.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(data_b64) > max_bytes * 2:  # base64 overhead, cheap guard before decoding
        return jsonify({'error': 'Audio payload too large'}), 413

    try:
        audio_bytes = base64.b64decode(data_b64)
    except Exception:
        return jsonify({'error': 'Invalid base64 audio data'}), 400

    if len(audio_bytes) > max_bytes:
        return jsonify({'error': 'Audio payload too large'}), 413

    result = analyze_audio_frame(audio_bytes, filetype=filetype)
    return jsonify({'frame_id': frame_id, 'result': result})


if __name__ == '__main__':
    app.run(port=InterfaceConfig.FLASK_PORT, debug=InterfaceConfig.DEBUG)
