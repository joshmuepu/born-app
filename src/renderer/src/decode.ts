/**
 * decode.ts — a hidden window whose only job is to turn the compressed frames of a recording into 16 kHz mono sound for the automatic timing.
 * The browser engine already inside BORN decodes AAC (it is what plays the tape), so no separate audio program is needed. The main process reads the
 * file and sends frames; this window decodes, converts and sends the sound back, one batch at a time.
 */
import { MonoResampler } from '../../shared/resample'

type Cfg = { codec: string; sampleRate: number; channels: number; description: Uint8Array }
const api = window.electronAPI as unknown as {
  onTapeDecode: (cb: (m: { type: 'begin' | 'frames' | 'end'; jobId: number; config?: Cfg; frames?: ArrayBuffer[]; first?: number }) => void) => () => void
  tapeDecodeReady: () => void
  tapeDecodeOut: (m: { jobId: number; pcm?: ArrayBuffer; error?: string }) => void
}

let jobId = 0
let decoder: AudioDecoder | null = null
let resampler: MonoResampler | null = null
let cfg: Cfg | null = null
let pending: Int16Array[] = []
let failed: string | null = null

function begin(id: number, c: Cfg): void {
  jobId = id
  cfg = c
  failed = null
  pending = []
  resampler = new MonoResampler(c.sampleRate)
  decoder?.close()
  decoder = new AudioDecoder({
    output: (data) => {
      try {
        const planar: Float32Array[] = []
        for (let ch = 0; ch < data.numberOfChannels; ch++) {
          const a = new Float32Array(data.numberOfFrames)
          data.copyTo(a, { planeIndex: ch, format: 'f32-planar' })
          planar.push(a)
        }
        pending.push(resampler!.push(planar))
      } catch (e) { failed = String((e as Error).message ?? e) }
      data.close()
    },
    error: (e) => { failed = String(e.message ?? e) }
  })
  const description = new Uint8Array(Array.from(c.description as ArrayLike<number>)) // a plain copy: whatever carried it here, it is bytes again
  const conf = { codec: c.codec, sampleRate: c.sampleRate, numberOfChannels: c.channels, description }
  void AudioDecoder.isConfigSupported(conf).then((r) => { if (!r.supported) failed = `this computer cannot decode ${c.codec} (${c.sampleRate} Hz, ${c.channels} ch, ${description.length}-byte header)` })
  decoder.configure(conf)
}

async function frames(id: number, list: ArrayBuffer[], first: number): Promise<void> {
  if (!decoder || !cfg || id !== jobId) return
  const per = 1024
  list.forEach((buf, i) => decoder!.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(((first + i) * per * 1e6) / cfg!.sampleRate), data: buf })))
  await decoder.flush()
  if (failed) { api.tapeDecodeOut({ jobId: id, error: failed }); return }
  const total = pending.reduce((n, p) => n + p.length, 0)
  const out = new Int16Array(total)
  let o = 0
  for (const p of pending) { out.set(p, o); o += p.length }
  pending = []
  api.tapeDecodeOut({ jobId: id, pcm: out.buffer })
}

api.onTapeDecode((m) => {
  if (m.type === 'begin' && m.config) {
    try { begin(m.jobId, m.config) } catch (e) { api.tapeDecodeOut({ jobId: m.jobId, error: String((e as Error).message ?? e) }) }
  } else if (m.type === 'frames' && m.frames) void frames(m.jobId, m.frames, m.first ?? 0).catch((e) => api.tapeDecodeOut({ jobId: m.jobId, error: String((e as Error).message ?? e) }))
  else if (m.type === 'end') { decoder?.close(); decoder = null }
})
api.tapeDecodeReady()
