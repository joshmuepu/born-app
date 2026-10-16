/**
 * tapeAligner.ts — runs the OPTIONAL speech recogniser (whisper.cpp) the operator has installed, and turns its words into a proposed sync map.
 * Nothing is bundled: the operator points Settings at their own whisper-cli, model file and (for non-WAV audio) ffmpeg.
 * It runs as a child process (never on the UI thread), reports progress, can be cancelled, and only ever RETURNS a proposal.
 */
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir, cpus } from 'os'
import { join, dirname } from 'path'
import { alignParagraphs, heardFromWhisperJson, type AlignParagraph, type AlignResult } from '../shared/tapeAlign'

export interface AlignTools { whisper: string; model: string; ffmpeg: string }
export interface AlignProgress { phase: 'prepare' | 'listen' | 'match'; pct: number }
export type AlignOutcome = { ok: true; result: AlignResult; seconds: number; heardWords: number } | { ok: false; message: string; canceled?: boolean }

export function checkTools(t: AlignTools): string | null {
  if (!t.whisper || !existsSync(t.whisper)) return 'Choose the whisper.cpp program (whisper-cli) in Settings first.'
  if (!t.model || !existsSync(t.model)) return 'Choose a whisper.cpp model file in Settings first.'
  return null
}

let current: { procs: ChildProcess[]; canceled: boolean } | null = null
export const alignBusy = (): boolean => current !== null
export function cancelAlign(): void {
  if (!current) return
  current.canceled = true
  for (const p of current.procs) p.kill()
}

function run(cmd: string, args: string[], job: { procs: ChildProcess[] }, onLine?: (s: string) => void, env?: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
    job.procs.push(p)
    const feed = (b: Buffer): void => { if (onLine) for (const l of b.toString('utf8').split(/\r?\n/)) if (l) onLine(l) }
    p.stdout.on('data', feed)
    p.stderr.on('data', feed)
    p.on('error', reject)
    p.on('exit', (code) => setTimeout(() => resolve(code ?? -1), 50)) // 'exit', not 'close': a killed program's helpers must not keep us waiting
  })
}

export async function alignRecording(audioPath: string, paragraphs: AlignParagraph[], tools: AlignTools, onProgress: (p: AlignProgress) => void): Promise<AlignOutcome> {
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
    if (!/\.wav$/i.test(audioPath)) {
      if (!tools.ffmpeg || !existsSync(tools.ffmpeg)) return { ok: false, message: 'This audio needs ffmpeg to be read by the recogniser. Choose ffmpeg in Settings, or use a WAV file.' }
      wav = join(dir, 'in.wav')
      const code = await run(tools.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', audioPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], job)
      if (job.canceled) return { ok: false, message: 'Canceled.', canceled: true }
      if (code !== 0) return { ok: false, message: 'ffmpeg could not read the audio.' }
    }
    const out = join(dir, 'out')
    const threads = Math.max(1, Math.min(8, cpus().length - 1))
    const code = await run(tools.whisper, ['-m', tools.model, '-f', wav, '-ml', '1', '-sow', '-oj', '-of', out, '-t', String(threads), '-pp'], job, (l) => {
      const m = /progress\s*=\s*(\d+)%/.exec(l)
      if (m) onProgress({ phase: 'listen', pct: Number(m[1]) })
    }, { DYLD_LIBRARY_PATH: dirname(tools.whisper) })
    if (job.canceled) return { ok: false, message: 'Canceled.', canceled: true }
    if (code !== 0 || !existsSync(out + '.json')) return { ok: false, message: 'The recogniser stopped with an error. Check the program and model in Settings.' }
    onProgress({ phase: 'match', pct: 100 })
    const heard = heardFromWhisperJson(JSON.parse(readFileSync(out + '.json', 'utf8')))
    const result = alignParagraphs(heard, paragraphs)
    return { ok: true, result, seconds: (Date.now() - t0) / 1000, heardWords: heard.length }
  } catch (e) {
    return { ok: false, message: job.canceled ? 'Canceled.' : `Alignment failed: ${(e as Error).message}`, canceled: job.canceled }
  } finally {
    current = null
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* temp only */ }
  }
}
