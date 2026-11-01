export function formatPitch(pitchHz: number): string {
  return pitchHz ? `${pitchHz.toFixed(2)} Hz` : '—';
}
