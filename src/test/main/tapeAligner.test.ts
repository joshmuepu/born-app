import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { alignRecording, checkTools, cancelAlign, alignBusy } from '../../main/tapeAligner'

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
    expect(checkTools({ whisper: '', model: '', ffmpeg: '' })).toMatch(/whisper/)
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    expect(checkTools({ whisper: fakeWhisper(d), model: '/nope', ffmpeg: '' })).toMatch(/model/)
  })
  it('runs the recogniser on a WAV, reports progress, and returns a proposal', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const wav = join(d, 'a.wav'); writeFileSync(wav, 'x')
    const seen: number[] = []
    const r = await alignRecording(wav, paras, { whisper: fakeWhisper(d), model, ffmpeg: '' }, (p) => { if (p.phase === 'listen') seen.push(p.pct) })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.result.marks.map((m) => m.n)).toEqual([1, 2])
      expect(r.result.marks[1].t).toBeGreaterThan(19)
      expect(r.heardWords).toBe(10)
    }
    expect(seen).toContain(100)
    expect(alignBusy()).toBe(false)
  })
  it('needs ffmpeg for audio that is not WAV, and says so', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const m4a = join(d, 'a.m4a'); writeFileSync(m4a, 'x')
    const r = await alignRecording(m4a, paras, { whisper: fakeWhisper(d), model, ffmpeg: '' }, () => {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/ffmpeg/)
  })
  it('can be canceled while running, and cleans up', async () => {
    const d = mkdtempSync(join(tmpdir(), 'al-'))
    const model = join(d, 'm.bin'); writeFileSync(model, 'x')
    const wav = join(d, 'a.wav'); writeFileSync(wav, 'x')
    const slow = fakeWhisper(d, '#!/bin/bash\nsleep 30\n')
    const pr = alignRecording(wav, paras, { whisper: slow, model, ffmpeg: '' }, () => {})
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
    const r = await alignRecording(wav, paras, { whisper: fakeWhisper(d, '#!/bin/bash\nexit 3\n'), model, ffmpeg: '' }, () => {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Settings/)
  })
})
