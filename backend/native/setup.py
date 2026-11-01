# frigg
# Copyright (C) 2026 Carlos de Obaldia Pastor
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Build script for the frigg_dsp pybind11 extension (see frigg_dsp.cpp).

    pip install ./backend/native            # build + install into the active venv
    python setup.py build_ext --inplace     # or build a .so right here, for quick iteration

audio_processor.py imports frigg_dsp opportunistically and falls back to its
pure NumPy/Python implementations if it isn't installed/built, so this
extension is optional at runtime — only needed for the extra speed.
"""

from pybind11.setup_helpers import Pybind11Extension, build_ext
from setuptools import setup

ext_modules = [
    Pybind11Extension(
        "frigg_dsp",
        ["frigg_dsp.cpp"],
        cxx_std=17,
    ),
]

setup(
    name="frigg_dsp",
    version="0.1.0",
    description="Native C++ DSP hot paths for the frigg backend (pybind11)",
    ext_modules=ext_modules,
    cmdclass={"build_ext": build_ext},
    zip_safe=False,
)
