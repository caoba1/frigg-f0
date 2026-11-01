"""
API / server-facing configuration — ports, debug mode, and request limits for
the Flask app (app.py).

For DSP/audio-analysis tuning (pitch thresholds, frame window/hop) see
config_processing.py instead.
"""

import os


class InterfaceConfig:
    # Servidor
    FLASK_PORT = int(os.getenv('FLASK_PORT', 8080))
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

    # Seguridad / límites de la API
    MAX_AUDIO_SIZE_MB = int(os.getenv('MAX_AUDIO_SIZE_MB', 10))
    AUDIO_TIMEOUT_SECONDS = int(os.getenv('AUDIO_TIMEOUT_SECONDS', 5))
