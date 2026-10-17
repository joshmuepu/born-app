/**
 * Streaming sound conversion for the automatic timing: any number of channels at any sample rate in, mono 16 kHz 16-bit out, one piece at a time (a 2½-hour
 * recording is never held whole). Each output sample is the average of the input samples it covers (a box filter), which is all a speech recogniser needs.
 */
export class MonoResampler {
  private pos = 0 // position of the next output sample, in input samples (can be fractional)
  private readonly step: number
  private carry: number[] = [] // input samples not yet consumed
  private carryStart = 0 // index (in input samples since the start) of carry[0]

  constructor(private readonly inRate: number, private readonly outRate = 16000) {
    this.step = inRate / outRate
  }

  /** `planar`: one Float32Array per channel, same length. Returns 16-bit samples for every output sample that is now complete. */
  push(planar: Float32Array[]): Int16Array {
    const n = planar[0]?.length ?? 0
    const ch = planar.length
    for (let i = 0; i < n; i++) {
      let v = 0
      for (let c = 0; c < ch; c++) v += planar[c][i]
      this.carry.push(v / ch)
    }
    const out: number[] = []
    for (;;) {
      const a = this.pos
      const b = this.pos + this.step
      const need = Math.ceil(b) - this.carryStart
      if (need > this.carry.length) break
      // average over [a, b): whole samples plus fractional edges
      let sum = 0
      let w = 0
      for (let k = Math.floor(a); k < Math.ceil(b); k++) {
        const lo = Math.max(a, k), hi = Math.min(b, k + 1)
        const wt = hi - lo
        if (wt <= 0) continue
        sum += this.carry[k - this.carryStart] * wt
        w += wt
      }
      out.push(w > 0 ? sum / w : 0)
      this.pos = b
    }
    // drop what no later output sample needs
    const keepFrom = Math.floor(this.pos)
    if (keepFrom > this.carryStart) { this.carry.splice(0, keepFrom - this.carryStart); this.carryStart = keepFrom }
    const pcm = new Int16Array(out.length)
    for (let i = 0; i < out.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767)))
    return pcm
  }
}

/** The 44-byte header of a plain PCM WAV (mono, 16-bit) for `samples` samples. */
export function wavHeader(samples: number, rate = 16000): Uint8Array {
  const b = new DataView(new ArrayBuffer(44))
  const w = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); b.setUint32(4, 36 + samples * 2, true); w(8, 'WAVE'); w(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true)
  b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, samples * 2, true)
  return new Uint8Array(b.buffer)
}
