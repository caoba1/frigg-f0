"""
Canonical shape of the JSON returned by /api/analyze_frame.

Python and TypeScript can't literally share a type, so this dict is the
source of truth on the backend side. Mirror any change here in
frontend/src/types/analysis.ts (FrameAnalysisResult) so both sides agree
on field names/types.
"""

from typing import TypedDict, Optional


class FrameAnalysisResult(TypedDict, total=False):
    pitchHz: Optional[float]
    energy: float
    harmonicEnergy: float  # 0..1, fraction of spectral energy sitting at the harmonic series of pitchHz
    detected: bool
    error: str
