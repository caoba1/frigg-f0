# frigg
# Copyright (C) 2026 Carlos de Obaldia Pastor
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Audio-analysis / DSP tuning parameters — pitch detection thresholds and the
sliding-window framing used by /api/analyze_frame (audio_processor.py).

For server/API-facing settings (port, debug, request size limits) see
config_interface.py instead.

FRAME_WINDOW_MS / FRAME_HOP_MS are mirrored in
frontend/src/config/processingConfig.ts — keep both sides in sync if you
change these.
"""

import os


class ProcessingConfig:
    # RMS energy (0-1 normalized samples) required to attempt pitch detection.
    # 0.3 was effectively unreachable for normal-volume speech/music (typical
    # RMS is ~0.05-0.2), so detection silently never fired; 0.02 still filters
    # out near-silence while allowing real audio through.
    ENERGY_THRESHOLD = float(os.getenv('ENERGY_THRESHOLD', 0.02))
    MIN_PITCH_HZ = int(os.getenv('MIN_PITCH_HZ', 80))
    MAX_PITCH_HZ = int(os.getenv('MAX_PITCH_HZ', 1000))

    # Sliding-window pitch analysis framing. The frontend sends one overlapping
    # FRAME_WINDOW_MS-long WAV chunk per FRAME_HOP_MS step.
    FRAME_WINDOW_MS = int(os.getenv('FRAME_WINDOW_MS', 60))
    FRAME_HOP_MS = int(os.getenv('FRAME_HOP_MS', 40))

    @staticmethod
    def get_energy_threshold():
        return ProcessingConfig.ENERGY_THRESHOLD

    @staticmethod
    def get_pitch_range():
        return (ProcessingConfig.MIN_PITCH_HZ, ProcessingConfig.MAX_PITCH_HZ)
