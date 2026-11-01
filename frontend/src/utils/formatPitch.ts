// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

export function formatPitch(pitchHz: number): string {
  return pitchHz ? `${pitchHz.toFixed(2)} Hz` : '—';
}
