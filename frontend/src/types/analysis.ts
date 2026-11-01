// Mirrors backend/schemas.py FrameAnalysisResult — keep both in sync manually
// whenever the backend response shape changes.
export interface FrameAnalysisResult {
  pitchHz: number | null;
  energy: number;
  harmonicEnergy: number;
  detected: boolean;
  error?: string;
}
