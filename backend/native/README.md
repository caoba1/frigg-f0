# frigg_dsp — native DSP extension

Optional pybind11/C++ extension that reimplements two hot paths from
[`audio_processor.py`](../audio_processor.py):

| Python function                     | Native function (module `frigg_dsp`) |
| ------------------------------------ | ------------------------------------- |
| `calculate_energy`                   | `calculate_energy`                    |
| `detect_pitch_autocorrelation`       | `detect_pitch_autocorrelation`        |

Both are byte-for-byte behavioral mirrors of the NumPy/Python versions (same
inputs -> same outputs, within floating-point rounding). The autocorrelation
detector is the main motivation: `np.correlate(..., mode='full')` computes
*every* lag (`O(n^2)`) and then slices out the handful it needs, whereas the
native version only computes the lag range actually inspected.

This extension is **optional**. [`audio_processor.py`](../audio_processor.py)
tries to `import frigg_dsp` and falls back to its pure NumPy/Python
implementations if it isn't built — the app works either way, just slower
without it.

## Building

Requires a C++17 compiler (g++/clang) and Python headers for your
interpreter (e.g. `python3-dev` on Debian/Ubuntu).

```bash
# From the repo root, with your backend venv active:
pip install pybind11 setuptools
pip install ./backend/native
```

This compiles and installs the `frigg_dsp` module straight into your active
virtualenv's site-packages, so `import frigg_dsp` from anywhere in
`backend/` (e.g. `audio_processor.py`) picks it up automatically.

### Quick local iteration

To rebuild a `.so` in-place next to the source instead of reinstalling:

```bash
cd backend/native
python setup.py build_ext --inplace
```

Copy the resulting `frigg_dsp*.so` into `backend/` (or add `backend/native`
to `PYTHONPATH`) so `audio_processor.py` can import it without a full
`pip install`.

## Verifying it's active

```python
>>> import audio_processor
>>> audio_processor._native_dsp is not None
True
```

If this is `False`, the app is silently using the NumPy/Python fallback —
check the backend logs for a "frigg_dsp native extension not found" message.
