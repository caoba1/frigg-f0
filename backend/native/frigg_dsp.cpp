// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Native (C++) implementations of the DSP hot paths from audio_processor.py,
// exposed to Python via pybind11. These are drop-in equivalents of the
// pure-NumPy reference implementations (same inputs -> same outputs, see
// audio_processor.py for the fallback copies), but:
//
//   - calculate_energy avoids a Python-level call into NumPy for every frame.
//   - detect_pitch_autocorrelation only computes the autocorrelation lags
//     that are actually inspected, instead of np.correlate's full O(n^2)
//     'full'-mode convolution (which computes every lag from -(n-1) to
//     n-1 and then throws most of it away). For a ~1s window at 44.1kHz
//     this cuts the work from ~n^2 to ~n * (max_lag - min_lag).
//
// Build: see native/README.md.

#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <pybind11/stl.h>

#include <algorithm>
#include <cmath>
#include <optional>
#include <vector>

namespace py = pybind11;

namespace {

using Samples = py::array_t<double, py::array::c_style | py::array::forcecast>;

// RMS energy of normalized (-1..1) audio samples.
// Mirrors audio_processor.calculate_energy.
double calculate_energy(const Samples &samples) {
    auto buf = samples.unchecked<1>();
    const ssize_t n = buf.shape(0);
    if (n == 0) {
        return 0.0;
    }

    double sum_sq = 0.0;
    for (ssize_t i = 0; i < n; ++i) {
        const double s = buf(i);
        sum_sq += s * s;
    }
    return std::sqrt(sum_sq / static_cast<double>(n));
}

// Autocorrelation-based pitch detector.
// Mirrors audio_processor.detect_pitch_autocorrelation. Returns the detected
// pitch in Hz, or std::nullopt (-> None) if there is no clear periodic peak
// in range.
std::optional<double> detect_pitch_autocorrelation(
    const Samples &samples,
    int sample_rate,
    int min_freq = 80,
    int max_freq = 1000
) {
    auto buf = samples.unchecked<1>();
    const ssize_t total = buf.shape(0);
    if (total < 2048 || min_freq <= 0 || max_freq <= 0) {
        return std::nullopt;
    }

    // Last window_size samples, DC-removed (same as window = samples[-n:];
    // window -= mean(window) in the Python version).
    const ssize_t window_size = std::min<ssize_t>(total, sample_rate);
    const ssize_t offset = total - window_size;

    double mean = 0.0;
    for (ssize_t i = 0; i < window_size; ++i) {
        mean += buf(offset + i);
    }
    mean /= static_cast<double>(window_size);

    std::vector<double> window(static_cast<size_t>(window_size));
    for (ssize_t i = 0; i < window_size; ++i) {
        window[static_cast<size_t>(i)] = buf(offset + i) - mean;
    }

    ssize_t min_lag = sample_rate / max_freq;
    ssize_t max_lag = sample_rate / min_freq;
    ssize_t upper = std::max<ssize_t>(min_lag + 100, max_lag);

    min_lag = std::max<ssize_t>(min_lag, 0);
    upper = std::min<ssize_t>(upper, window_size);

    if (upper - min_lag < 2) {
        return std::nullopt;
    }

    // Direct (non-FFT) autocorrelation, but only for the lag range of
    // interest: R(lag) = sum_i window[i] * window[i + lag].
    std::vector<double> search_region(static_cast<size_t>(upper - min_lag));
    for (ssize_t lag = min_lag; lag < upper; ++lag) {
        double acc = 0.0;
        for (ssize_t i = 0; i < window_size - lag; ++i) {
            acc += window[static_cast<size_t>(i)] * window[static_cast<size_t>(i + lag)];
        }
        search_region[static_cast<size_t>(lag - min_lag)] = acc;
    }

    const double region_max = *std::max_element(search_region.begin(), search_region.end());

    std::optional<ssize_t> period;
    for (size_t i = 1; i + 1 < search_region.size(); ++i) {
        if (search_region[i] > search_region[i - 1] &&
            search_region[i] > search_region[i + 1] &&
            search_region[i] > 0.3 * region_max) {
            period = static_cast<ssize_t>(i) + min_lag;
            break;
        }
    }

    if (!period || *period == 0) {
        return std::nullopt;
    }

    const double frequency = static_cast<double>(sample_rate) / static_cast<double>(*period);
    if (frequency < min_freq || frequency > max_freq) {
        return std::nullopt;
    }

    // Matches Python's round(frequency, 2); negligible half-to-even vs
    // half-away-from-zero tie-breaking difference is not observable for
    // real-valued frequencies.
    return std::round(frequency * 100.0) / 100.0;
}

} // namespace

PYBIND11_MODULE(frigg_dsp, m) {
    m.doc() = "Native (C++) DSP hot paths for frigg's audio_processor.py";

    m.def("calculate_energy", &calculate_energy, py::arg("samples"),
          "RMS energy of normalized (-1..1) audio samples.");

    m.def("detect_pitch_autocorrelation", &detect_pitch_autocorrelation,
          py::arg("samples"), py::arg("sample_rate"),
          py::arg("min_freq") = 80, py::arg("max_freq") = 1000,
          "Autocorrelation-based pitch detector (Hz), or None if no clear "
          "periodic peak is found in range.");
}
