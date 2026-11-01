"""
Audio Processor - Pure Python Implementation
Replaces the C++ binary with efficient NumPy operations
"""

import numpy as np
from typing import Optional, Tuple
import wave
import io
import struct
import logging

try:
    import aubio
except ImportError:
    aubio = None

from config_processing import ProcessingConfig
from schemas import FrameAnalysisResult

logger = logging.getLogger(__name__)

# Umbral global (override via environment) — kept as a fallback default only;
# real callers should pass ProcessingConfig.get_energy_threshold() instead.
DEFAULT_THRESHOLD = 0.3

if aubio is None:
    logger.warning("aubio not installed — YIN pitch detection disabled, falling back to autocorrelation")


def calculate_energy(samples: np.ndarray) -> float:
    """
    Calcula RMS energy de las muestras de audio.

    Args:
        samples: Array NumPy de samples normalizados (-1 a 1)

    Returns:
        RMS energy value (0.0 a 1.0 aproximadamente)
    """
    if len(samples) == 0:
        return 0.0
    return float(np.sqrt(np.mean(samples ** 2)))


def calculate_harmonic_energy(pitch_hz: Optional[float]) -> float:
    """
    DUMMY placeholder field — use this as the template for adding new response
    fields later (real computation, wired into FrameAnalysisResult + frontend types).
    """
    if not pitch_hz or pitch_hz <= 0:
        return 0.0
    return 0.5  # TODO: replace with a real measurement


def detect_pitch_yin(
    samples: np.ndarray,
    sample_rate: int,
    min_freq: int = 80,
    max_freq: int = 1000,
    win_size: int = 2048,
    hop_size: int = 512,
) -> Optional[float]:
    """
    Detecta pitch usando el algoritmo YIN (via aubio).

    Más preciso que autocorrelación/zero-crossing para voz e instrumentos
    monofónicos. Procesa la señal en bloques de `hop_size` y se queda con
    la estimación de mayor confianza reportada por aubio.

    Args:
        samples: Array de muestras normalizadas (-1 a 1)
        sample_rate: Frecuencia de muestreo (Hz)
        min_freq: Frecuencia mínima aceptada (Hz)
        max_freq: Frecuencia máxima aceptada (Hz)
        win_size: Tamaño de ventana de análisis interno de aubio
        hop_size: Tamaño de bloque procesado por llamada

    Returns:
        Pitch detectado en Hz, o None si aubio no está disponible o no hay
        una estimación con suficiente confianza.
    """
    if aubio is None or len(samples) < hop_size:
        return None

    pitch_o = aubio.pitch("yin", win_size, hop_size, sample_rate)
    pitch_o.set_unit("Hz")
    pitch_o.set_tolerance(0.8)

    data = samples.astype(np.float32)
    pad = (-len(data)) % hop_size
    if pad:
        data = np.pad(data, (0, pad))

    best_freq = None
    best_confidence = 0.0
    for i in range(0, len(data), hop_size):
        block = data[i:i + hop_size]
        freq = float(pitch_o(block)[0])
        confidence = float(pitch_o.get_confidence())
        if freq > 0 and confidence > best_confidence:
            best_freq = freq
            best_confidence = confidence

    if best_freq is None:
        return None

    if min_freq <= best_freq <= max_freq:
        return round(best_freq, 2)

    return None


def detect_pitch_autocorrelation(
    samples: np.ndarray,
    sample_rate: int,
    min_freq: int = 80,
    max_freq: int = 1000
) -> Optional[float]:
    """
    Detecta pitch usando autocorrelación (algoritmo clásico robusto).

    Args:
        samples: Array de muestras normalizadas
        sample_rate: Frecuencia de muestreo (Hz)
        min_freq: Frecuencia mínima humana audible (Hz)
        max_freq: Frecuencia máxima razonable para voz/música (Hz)

    Returns:
        Pitch detectado en Hz, o None si no hay señal clara
    """
    if len(samples) < 2048:
        return None

    # Extraer ventana de análisis (último segundo aprox)
    window_size = min(len(samples), sample_rate)
    window = samples[-window_size:]

    # Normalizar
    window = window - np.mean(window)

    # Autocorrelación
    autocorr = np.correlate(window, window, mode='full')
    autocorr = autocorr[len(autocorr)//2:]

    # Buscar picos (excluir el pico DC en posición 0)
    min_lag = int(sample_rate / max_freq)  # Lag mínimo
    max_lag = int(sample_rate / min_freq)  # Lag máximo

    search_region = autocorr[min_lag:max(min_lag + 100, max_lag)]

    if len(search_region) < 2:
        return None

    # Encontrar primer pico significativo
    peaks = []
    for i in range(1, len(search_region) - 1):
        if search_region[i] > search_region[i-1] and search_region[i] > search_region[i+1]:
            if search_region[i] > 0.3 * np.max(search_region):
                peaks.append(i + min_lag)

    if not peaks:
        return None

    # Tomar el primer pico (periodo fundamental)
    period = peaks[0]

    if period == 0:
        return None

    # Calcular frecuencia
    frequency = sample_rate / period

    # Validar rango humano
    if min_freq <= frequency <= max_freq:
        return round(frequency, 2)

    return None


def detect_pitch_zero_crossing(samples: np.ndarray, sample_rate: int) -> Optional[float]:
    """
    Método alternativo más rápido (menos preciso) basado en cruces por cero.

    Útil para frames muy pequeños donde autocorrelación falla.
    """
    if len(samples) < 1000:
        return None

    # Contar cruces por cero
    sign_change = np.diff(np.signbit(samples))
    crossings = np.where(sign_change)[0]

    if len(crossings) < 4:
        return None

    # Periodo promedio entre cruces
    periods = np.diff(crossings[:10])  # Usar primeros 10 cruces
    avg_period = np.median(periods)

    if avg_period == 0 or avg_period < 10:
        return None

    frequency = sample_rate / avg_period

    # Validar rango
    if 80 <= frequency <= 1000:
        return round(frequency, 2)

    return None


def decode_wav_from_bytes(audio_bytes: bytes) -> Tuple[np.ndarray, int]:
    """
    Decodifica WAV desde bytes y retorna samples + sample_rate.

    Args:
        audio_bytes: Datos crudos del archivo WAV

    Returns:
        Tuple de (samples_normalized, sample_rate)

    Raises:
        ValueError: Si el formato no es WAV válido
    """
    buffer = io.BytesIO(audio_bytes)

    try:
        with wave.open(buffer, 'rb') as wav_file:
            n_channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            n_frames = wav_file.getnframes()

            raw_data = wav_file.readframes(n_frames)

    except Exception as e:
        raise ValueError(f"Failed to parse WAV: {str(e)}")

    # Determinar dtype según sample_width
    if sample_width == 1:
        dtype = np.int8
    elif sample_width == 2:
        dtype = np.int16
    elif sample_width == 4:
        dtype = np.int32
    else:
        raise ValueError(f"Unsupported sample width: {sample_width}")

    # Convertir a NumPy
    samples = np.frombuffer(raw_data, dtype=dtype).astype(np.float32)

    # Normalizar a [-1, 1]
    max_val = np.iinfo(dtype).max
    samples = samples / max_val

    # Si stereo, convertir a mono
    if n_channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)

    return samples, sample_rate


def analyze_audio_frame(
    audio_bytes: bytes,
    filetype: str = 'audio/wav',
    threshold: Optional[float] = None
) -> FrameAnalysisResult:
    """
    Analiza un frame de audio y retorna resultados JSON.

    Esta es tu función principal — reemplaza completamente al binario C++.

    Args:
        audio_bytes: Bytes decodificados en base64 (WAV raw)
        filetype: Tipo MIME del audio ('audio/wav', 'audio/webm', etc.)
        threshold: Umbral de energía para considerar detección válida;
            por defecto usa ProcessingConfig.get_energy_threshold()

    Returns:
        FrameAnalysisResult — ver schemas.py para el contrato completo.
    """
    if threshold is None:
        threshold = ProcessingConfig.get_energy_threshold()
    min_freq, max_freq = ProcessingConfig.get_pitch_range()

    result: FrameAnalysisResult = {
        'pitchHz': None,
        'energy': 0.0,
        'harmonicEnergy': 0.0,
        'detected': False
    }

    try:
        # Soporta solo WAV actualmente
        if 'wav' not in filetype.lower():
            # TODO: Agregar soporte para webm con ffmpeg/pydub
            raise ValueError("Only WAV format supported currently")

        # Decodificar
        samples, sample_rate = decode_wav_from_bytes(audio_bytes)

        if len(samples) == 0:
            result['error'] = 'Empty audio data'
            return result

        # Calcular energía
        energy = calculate_energy(samples)
        result['energy'] = round(energy, 6)

        # Solo buscar pitch si supera umbral
        if energy >= threshold:
            # YIN (aubio) primero — más preciso; cae a los métodos NumPy si
            # aubio no está instalado o no logra una estimación confiable.
            pitch = detect_pitch_yin(
                samples,
                sample_rate,
                min_freq=min_freq,
                max_freq=max_freq
            )

            if pitch is None:
                pitch = detect_pitch_autocorrelation(
                    samples,
                    sample_rate,
                    min_freq=min_freq,
                    max_freq=max_freq
                )

            # Fallback a zero-crossing si autocorr falla
            if pitch is None:
                pitch = detect_pitch_zero_crossing(samples, sample_rate)

            if pitch is not None:
                result['pitchHz'] = pitch
                result['detected'] = True
                result['harmonicEnergy'] = calculate_harmonic_energy(pitch)

        return result

    except Exception as e:
        result['error'] = f"Processing failed: {str(e)}"
        return result
