// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

// Decode audio file to PCM using Web Audio API
export async function decodeAudioToPCM(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}
