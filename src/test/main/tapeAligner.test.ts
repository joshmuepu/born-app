import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { alignRecording, checkTools, cancelAlign, alignBusy, wavEnvelope } from '../../main/tapeAligner'

/** a stand-in for whisper-cli: prints progress and writes <of>.json with the words of a tiny fake sermon */
function fakeWhisper(dir: string, body?: string): string {
  const p = join(dir, 'fake-whisper.sh')
  writeFileSync(p, body ?? `#!/bin/bash
while [ $# -gt 0 ]; do case "$1" in -of) OF="$2"; shift;; esac; shift; done
echo "whisper_print_progress_callback: progress =  50%" >&2
echo "whisper_print_progress_callback: progress = 100%" >&2
cat > "$OF.json" <<'J'
{"transcription":[
{"offsets":{"from":10000,"to":10300},"text":" the"},{"offsets":{"from":10300,"to":10600},"text":" lord"},{"offsets":{"from":10600,"to":10900},"text":" is"},{"offsets":{"from":10900,"to":11200},"text":" my"},{"offsets":{"from":11200,"to":11500},"text":" shepherd"},
{"offsets":{"from":20000,"to":20300},"text":" he"},{"offsets":{"from":20300,"to":20600},"text":" maketh"},{"offsets":{"from":20600,"to":20900},"text":" me"},{"offsets":{"from":20900,"to":21200},"text":" to"},{"offsets":{"from":21200,"to":21500},"text":" lie"}
]}
J
`)
  chmodSync(p, 0o755)
  return p
}
const paras = [{ n: 1, text: 'The Lord is my shepherd' }, { n: 2, text: 'He maketh me to lie down' }]

describe('tape aligner runner', () => {
  it('asks for the tools before doing anything', () => {
    expect(checkTools({ whisper: '', model: '' })).toMatch(/recogniser/)
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    expect(checkTools({ whisper: fakeWhisper(d), model: '/nope' })).toMatch(/model/)
  })
  it('runs the recogniser on a WAV, reports progress, and returns a proposal', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const wav = join(d, 'a.wav'); writeFileSync(wav, 'x')
    const seen: number[] = []
    const r = await alignRecording(wav, paras, { whisper: fakeWhisper(d), model }, (p) => { if (p.phase === 'listen') seen.push(p.pct) })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.result.marks.map((m) => m.n)).toEqual([1, 2])
      expect(r.result.marks[1].t).toBeGreaterThan(19)
      expect(r.heardWords).toBe(10)
    }
    expect(seen).toContain(100)
    expect(alignBusy()).toBe(false)
  })
  it('says plainly when the audio is a kind it cannot read', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const odd = join(d, 'a.aiff'); writeFileSync(odd, 'x')
    const r = await alignRecording(odd, paras, { whisper: fakeWhisper(d), model }, () => {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/cannot be timed automatically/)
  })
  it('can be canceled while running, and cleans up', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const wav = join(d, 'a.wav'); writeFileSync(wav, 'x')
    const slow = fakeWhisper(d, '#!/bin/bash\nsleep 30\n')
    const pr = alignRecording(wav, paras, { whisper: slow, model }, () => {})
    await new Promise((r) => setTimeout(r, 300))
    expect(alignBusy()).toBe(true)
    cancelAlign()
    const r = await pr
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.canceled).toBe(true)
    expect(alignBusy()).toBe(false)
  })
  it('a recogniser that fails gives a plain message, not a stack trace', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const wav = join(d, 'a.wav'); writeFileSync(wav, 'x')
    const r = await alignRecording(wav, paras, { whisper: fakeWhisper(d, '#!/bin/bash\nexit 3\n'), model }, () => {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/stopped with an error/)
  })
})

/** a 16-bit mono PCM WAV: `quietSec` of near-silence, then `loudSec` of a tone, then quiet again */
function makeWav(path: string, plan: Array<[number, 'quiet' | 'loud']>, rate = 16000, claimedDataLen?: number): void {
  const samples: number[] = []
  let seed = 7
  const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 - 0.5 }
  for (const [sec, kind] of plan) for (let i = 0; i < sec * rate; i++) samples.push(kind === 'loud' ? Math.round(9000 * Math.sin((2 * Math.PI * 220 * i) / rate) + rnd() * 400) : Math.round(rnd() * 40))
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(v, i * 2))
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(claimedDataLen ?? data.length, 40)
  writeFileSync(path, Buffer.concat([h, data]))
}

describe('reading the loudness of a WAV', () => {
  it('finds loud and quiet stretches', () => {
    const d = mkdtempSync(join(tmpdir(), 'al-')); const w = join(d, 'e.wav')
    makeWav(w, [[2, 'quiet'], [2, 'loud'], [1, 'quiet']])
    const e = wavEnvelope(w)!
    expect(e.frameSec).toBeCloseTo(0.02)
    expect(e.rms.length).toBe(250)
    expect(e.rms[50]).toBeLessThan(0.01)
    expect(e.rms[150]).toBeGreaterThan(0.1)
  })
  it('a streamed WAV that claims a length of 0 (or too much) is still read to its real end', () => {
    const d = mkdtempSync(join(tmpdir(), 'al-')); const w = join(d, 's.wav')
    makeWav(w, [[1, 'quiet'], [1, 'loud']], 16000, 0)
    expect(wavEnvelope(w)!.rms.length).toBe(100)
    makeWav(w, [[1, 'quiet'], [1, 'loud']], 16000, 0x7fffffff)
    expect(wavEnvelope(w)!.rms.length).toBe(100)
  })
  it('anything that is not a plain 16-bit WAV gives nothing (so nothing is guessed)', () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const junk = join(d, 'j.wav'); writeFileSync(junk, Buffer.from('not a wav file at all, just text'))
    expect(wavEnvelope(junk)).toBeNull()
    expect(wavEnvelope(join(d, 'missing.wav'))).toBeNull()
  })
})

describe('a start the recogniser put into the silence before the speech', () => {
  it('is moved to where the speech begins, and the result says how many were moved', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const wav = join(d, 'a.wav')
    // 4 s of quiet, then 6 s of "speech", quiet 3 s, then 6 s of speech
    makeWav(wav, [[4, 'quiet'], [6, 'loud'], [3, 'quiet'], [6, 'loud']])
    // the fake recogniser says the first paragraph's words start at 0.3 s (inside the silence), the second's at 10.5 (inside the pause)
    const whisper = join(d, 'fw.sh')
    writeFileSync(whisper, `#!/bin/bash
while [ $# -gt 0 ]; do case "$1" in -of) OF="$2"; shift;; esac; shift; done
cat > "$OF.json" <<'J'
{"transcription":[
{"offsets":{"from":300,"to":700},"text":" the"},{"offsets":{"from":700,"to":1100},"text":" lord"},{"offsets":{"from":1100,"to":1500},"text":" is"},{"offsets":{"from":1500,"to":1900},"text":" my"},{"offsets":{"from":1900,"to":2300},"text":" shepherd"},
{"offsets":{"from":10500,"to":10900},"text":" he"},{"offsets":{"from":10900,"to":11300},"text":" maketh"},{"offsets":{"from":11300,"to":11700},"text":" me"},{"offsets":{"from":11700,"to":12100},"text":" to"},{"offsets":{"from":12100,"to":12500},"text":" lie"}
]}
J
`)
    chmodSync(whisper, 0o755)
    const r = await alignRecording(wav, [{ n: 1, text: 'The Lord is my shepherd' }, { n: 2, text: 'He maketh me to lie down' }], { whisper, model }, () => {})
    expect(r.ok).toBe(true)
    if (r.ok) {
      const t = (n: number): number => r.result.marks.find((m) => m.n === n)!.t as number
      expect(t(1)).toBeCloseTo(4, 1)
      expect(t(2)).toBeCloseTo(13, 1)
      expect(r.refined).toMatchObject({ moved: 2 })
    }
  })
})

