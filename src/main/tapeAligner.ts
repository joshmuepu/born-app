/**
 * tapeAligner.ts — runs the speech recogniser (whisper.cpp) that ships inside the app, and turns its words into a sync map.
 * M4A/AAC is decoded in-app first (tapeDecode.ts); WAV, MP3, FLAC and OGG go straight to the recogniser. No other program is needed.
 * It runs as a child process (never on the UI thread), reports progress, can be cancelled, and only ever RETURNS a proposal.
 */
import { spawn, type ChildProcess } from 'child_process'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync } from 'fs'
import { tmpdir, cpus } from 'os'
import { setPriority } from 'os'
import { join, dirname } from 'path'
import { alignParagraphs, heardFromWhisperJson, refineToSpeech, type AlignParagraph, type AlignResult, type Envelope, type RefineStats } from '../shared/tapeAlign'

export interface AlignTools { whisper: string; model: string }
export interface AlignProgress { phase: 'prepare' | 'listen' | 'match'; pct: number }
export type AlignOutcome = { ok: true; result: AlignResult; seconds: number; heardWords: number; refined: RefineStats | null } | { ok: false; message: string; canceled?: boolean }

export function checkTools(t: AlignTools): string | null {
  if (!t.whisper || !existsSync(t.whisper)) return 'The speech recogniser that comes with BORN is missing from this installation.'
  if (!t.model || !existsSync(t.model)) return 'The speech recogniser’s model file is missing from this installation.'
  return null
}

/** The loudness of a 16-bit PCM WAV, read in pieces (a 2½-hour mono 16 kHz file is ~280 MB; it is never held whole). null when it is not a plain 16-bit WAV. */
export function wavEnvelope(path: string, frameSec = 0.02): Envelope | null {
  let fd = -1
  try {
    fd = openSync(path, 'r')
    const head = Buffer.alloc(4096)
    const got = readSync(fd, head, 0, 4096, 0)
    if (got < 44 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') return null
    let off = 12, rate = 0, ch = 0, bits = 0, dataAt = -1, dataLen = 0
    while (off + 8 <= got) {
      const id = head.toString('ascii', off, off + 4)
      const len = head.readUInt32LE(off + 4)
      if (id === 'fmt ') {
        if (head.readUInt16LE(off + 8) !== 1) return null // not plain PCM
        ch = head.readUInt16LE(off + 10); rate = head.readUInt32LE(off + 12); bits = head.readUInt16LE(off + 22)
      } else if (id === 'data') { dataAt = off + 8; dataLen = len; break }
      off += 8 + len + (len % 2)
    }
    if (dataAt < 0 || bits !== 16 || ch < 1 || ch > 2 || rate < 8000) return null
    const size = statSync(path).size
    if (dataLen === 0 || dataLen > size - dataAt) dataLen = size - dataAt // a streamed WAV can claim 0 / too much
    const perFrame = Math.max(1, Math.round(rate * frameSec))
    const frames = Math.floor(dataLen / 2 / ch / perFrame)
    const rms = new Float32Array(frames)
    const chunkFrames = 4096
    const buf = Buffer.alloc(chunkFrames * perFrame * ch * 2)
    let f = 0
    while (f < frames) {
      const want = Math.min(chunkFrames, frames - f)
      const n = readSync(fd, buf, 0, want * perFrame * ch * 2, dataAt + f * perFrame * ch * 2)
      if (n < want * perFrame * ch * 2) break
      for (let k = 0; k < want; k++) {
        let sum = 0
        for (let i = 0; i < perFrame; i++) {
          let v = 0
          for (let c = 0; c < ch; c++) v += buf.readInt16LE(((k * perFrame + i) * ch + c) * 2)
          v /= ch
          sum += v * v
        }
        rms[f + k] = Math.sqrt(sum / perFrame) / 32768
      }
      f += want
    }
    return { frameSec: perFrame / rate, rms: f === frames ? rms : rms.slice(0, f) }
  } catch {
    return null
  } finally {
    if (fd >= 0) try { closeSync(fd) } catch { /* nothing to do */ }
  }
}

let current: { procs: ChildProcess[]; canceled: boolean } | null = null
export const alignBusy = (): boolean => current !== null
export function cancelAlign(): void {
  if (!current) return
  current.canceled = true
  for (const p of current.procs) p.kill()
}

function run(cmd: string, args: string[], job: { procs: ChildProcess[] }, onLine?: (s: string) => void, env?: NodeJS.ProcessEnv, lowPriority = false): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
    job.procs.push(p)
    if (lowPriority && p.pid) try { setPriority(p.pid, 10) } catch { /* the default priority is fine */ }
    const feed = (b: Buffer): void => { if (onLine) for (const l of b.toString('utf8').split(/\r?\n/)) if (l) onLine(l) }
    p.stdout.on('data', feed)
    p.stderr.on('data', feed)
    p.on('error', reject)
    p.on('exit', (code) => setTimeout(() => resolve(code ?? -1), 50)) // 'exit', not 'close': a killed program's helpers must not keep us waiting
  })
}

export async function alignRecording(audioPath: string, paragraphs: AlignParagraph[], tools: AlignTools, onProgress: (p: AlignProgress) => void, opts: { lowPriority?: boolean } = {}): Promise<AlignOutcome> {
  const bad = checkTools(tools)
  if (bad) return { ok: false, message: bad }
  if (current) return { ok: false, message: 'An alignment is already running.' }
  const job = { procs: [] as ChildProcess[], canceled: false }
  current = job
  const dir = mkdtempSync(join(tmpdir(), 'born-align-'))
  const t0 = Date.now()
  try {
    onProgress({ phase: 'prepare', pct: 0 })
    let wav = audioPath
    if (/\.(m4a|mp4|aac)$/i.test(audioPath)) {
      wav = join(dir, 'in.wav')
      const { decodeM4aToWav16k } = await import('./tapeDecode') // loaded when needed (it uses the app's windows)
      const d = await decodeM4aToWav16k(audioPath, wav, (pct) => onProgress({ phase: 'prepare', pct }), () => job.canceled)
      if (job.canceled) return { ok: false, message: 'Canceled.', canceled: true }
      if (!d.ok) return { ok: false, message: d.message }
    } else if (!/\.(wav|mp3|flac|ogg)$/i.test(audioPath)) {
      return { ok: false, message: 'This kind of audio file cannot be timed automatically (M4A, MP3, WAV, FLAC and OGG can).' }
    }
    const out = join(dir, 'out')
    const threads = Math.max(1, Math.min(opts.lowPriority ? 4 : 8, cpus().length - 1))
    const code = await run(tools.whisper, ['-m', tools.model, '-f', wav, '-ml', '1', '-sow', '-oj', '-of', out, '-t', String(threads), '-pp'], job, (l) => {
      const m = /progress\s*=\s*(\d+)%/.exec(l)
      if (m) onProgress({ phase: 'listen', pct: Number(m[1]) })
    }, { DYLD_LIBRARY_PATH: dirname(tools.whisper), LD_LIBRARY_PATH: dirname(tools.whisper) }, !!opts.lowPriority)
    if (job.canceled) return { ok: false, message: 'Canceled.', canceled: true }
    if (code !== 0 || !existsSync(out + '.json')) return { ok: false, message: 'The speech recogniser stopped with an error.' }
    onProgress({ phase: 'match', pct: 100 })
    const heard = heardFromWhisperJson(JSON.parse(readFileSync(out + '.json', 'utf8')))
    const result = alignParagraphs(heard, paragraphs)
    // a paragraph cannot start in silence: where the recogniser put a start in a pause, move it to where the speech begins
    const env = wav === audioPath && !/\.wav$/i.test(audioPath) ? null : wavEnvelope(wav)
    let refined: RefineStats | null = null
    if (env) {
      const r = refineToSpeech(result.marks, env)
      result.marks = r.marks
      refined = r.stats
    }
    return { ok: true, result, seconds: (Date.now() - t0) / 1000, heardWords: heard.length, refined }
  } catch (e) {
    return { ok: false, message: job.canceled ? 'Canceled.' : `Alignment failed: ${(e as Error).message}`, canceled: job.canceled }
  } finally {
    current = null
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* temp only */ }
  }
}
