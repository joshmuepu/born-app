import { describe, it, expect } from 'vitest'
import { MonoResampler, wavHeader } from '../../shared/resample'

const tone = (rate: number, secs: number, hz: number): Float32Array => Float32Array.from({ length: Math.round(rate * secs) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / rate))

describe('sound to 16 kHz mono for the recogniser', () => {
  it('gives one second of output for one second of input, whatever the input rate', () => {
    for (const rate of [8000, 16000, 22050, 44100, 48000]) {
      const r = new MonoResampler(rate)
      const out = r.push([tone(rate, 1, 440)])
      expect(out.length).toBeGreaterThanOrEqual(15990)
      expect(out.length).toBeLessThanOrEqual(16000)
    }
  })
  it('is the same whether the sound arrives whole or in pieces of any size', () => {
    const x = tone(44100, 2, 300)
    const whole = new MonoResampler(44100).push([x])
    const r = new MonoResampler(44100)
    const parts: number[] = []
    for (let i = 0, step = 1; i < x.length; i += step, step = (step * 7) % 3000 + 1) parts.push(...r.push([x.subarray(i, i + step)]))
    expect(parts.length).toBe(whole.length)
    expect(parts.slice(0, 2000)).toEqual([...whole.subarray(0, 2000)])
  })
  it('keeps the level of a tone below the new Nyquist and averages two channels', () => {
    const a = tone(48000, 0.5, 300)
    const out = new MonoResampler(48000).push([a, a])
    const peak = Math.max(...out.map(Math.abs))
    expect(peak).toBeGreaterThan(0.45 * 32767 * 0.95)
    expect(peak).toBeLessThanOrEqual(0.5 * 32767 + 5)
    const silent = new MonoResampler(48000).push([a, a.map((v) => -v)])
    expect(Math.max(...silent.map(Math.abs))).toBeLessThan(5) // opposite channels cancel
  })
  it('writes a plain WAV header', () => {
    const h = wavHeader(16000)
    expect(new TextDecoder().decode(h.subarray(0, 4))).toBe('RIFF')
    const v = new DataView(h.buffer)
    expect(v.getUint32(24, true)).toBe(16000)
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(40, true)).toBe(32000)
  })
})
