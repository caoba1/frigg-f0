// Decode audio file to PCM using Web Audio API
export async function decodeAudioToPCM(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}
