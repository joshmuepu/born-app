/**
 * Main-process side of the HEIC/TIFF conversion: runs it in a worker thread with a time limit, and falls back
 * to doing it in-process only if the worker file is not there (unit tests).
 */
import { existsSync } from 'fs'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { convertToJpegFile, type ConvertOutcome } from './imageConvert'

const TIMEOUT_MS = 120_000

export function convertInWorker(src: string, out: string, workerPath = join(__dirname, 'heicWorker.js')): Promise<ConvertOutcome> {
  if (!existsSync(workerPath)) return convertToJpegFile(src, out)
  return new Promise((resolve) => {
    let done = false
    const finish = (r: ConvertOutcome): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      void w.terminate()
      resolve(r)
    }
    const w = new Worker(workerPath, { workerData: { src, out }, resourceLimits: { maxOldGenerationSizeMb: 2048 } })
    const timer = setTimeout(() => finish({ ok: false, reason: 'io', detail: 'timed out' }), TIMEOUT_MS)
    w.once('message', (m: ConvertOutcome) => finish(m))
    w.once('error', (e) => finish({ ok: false, reason: /memory/i.test(String(e?.message)) ? 'memory' : 'io', detail: String(e?.message ?? e) }))
    w.once('exit', () => finish({ ok: false, reason: 'io', detail: 'worker ended without an answer' }))
  })
}
