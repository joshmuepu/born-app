/**
 * audio.ts — the Tape service's audio engine: a hidden window whose only job is to PLAY the tape and say, truthfully, where it is.
 * It is the clock owner (docs/design/sermon-audio/01-investigation.md §3): it keeps playing when the projector is blanked, closed or
 * moved, and every screen follows the record the main process keeps from its reports. It never decides anything: it applies what the
 * record says (play/pause, speed, volume, output device) and seeks only when the record's `epoch` changes, so its own position reports can
 * never make it jump. Reports go out about 4 times a second while playing, and at once on every event that matters.
 */
import { plainPlayError } from '../../shared/playError'

type Apply = {
  type: 'apply'
  fileId: string
  status: 'loading' | 'paused' | 'playing' | 'ended' | 'error'
  position: number
  epoch: number
  speed: number
  volume: number
  muted: boolean
  deviceId: string
}
type Msg = Apply | { type: 'unload' }

import { plainPlayError } from '../../shared/playError'
const api = window.electronAPI
const audio = new Audio()
audio.preload = 'auto'

let fileId = ''
let lastEpoch = -1
let wantPlaying = false
let sink = ''
let lastPos = -1
let still = 0
let ready = false
let reportedReady = false

function report(extra: { ended?: boolean; error?: string | null; errorKind?: 'file' | 'decode' | 'device' | null; ready?: boolean } = {}): void {
  api.tapeEngineReport({
    position: audio.currentTime,
    playing: !audio.paused && !audio.ended && audio.readyState >= 3,
    duration: Number.isFinite(audio.duration) ? audio.duration : null,
    ended: extra.ended ?? false,
    stalled: still >= 3,
    error: extra.error ?? null,
    errorKind: extra.errorKind ?? null,
    ready: extra.ready ?? false
  })
}

async function applySink(id: string): Promise<void> {
  if (id === sink) return
  const el = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
  if (!el.setSinkId) return
  try {
    await el.setSinkId(id)
    sink = id
  } catch (e) {
    // a device that is not there: say so, do not play into another room
    report({ error: 'The chosen sound output is not available. Choose another output.', errorKind: 'device' })
  }
}

async function apply(m: Apply): Promise<void> {
  if (m.fileId !== fileId) {
    fileId = m.fileId
    lastEpoch = -1
    ready = false
    reportedReady = false
    still = 0
    lastPos = -1
    audio.src = `born-tape://file/${m.fileId}`
    audio.load()
  }
  audio.volume = Math.min(1, Math.max(0, m.volume))
  audio.muted = m.muted
  audio.playbackRate = m.speed
  audio.preservesPitch = true
  await applySink(m.deviceId)
  const seek = (): void => {
    try {
      audio.currentTime = m.position
    } catch {
      /* not seekable yet: retried when the metadata arrives */
    }
  }
  if (m.epoch !== lastEpoch) {
    lastEpoch = m.epoch
    still = 0
    lastPos = -1
    if (audio.readyState >= 1) seek()
    else audio.addEventListener('loadedmetadata', seek, { once: true })
  }
  wantPlaying = m.status === 'playing'
  if (wantPlaying) {
    if (audio.paused && ready) audio.play().catch((e) => { console.warn('tape play() failed', e); report({ error: `The tape could not start: ${plainPlayError(e)}.`, errorKind: 'decode' }) })
  } else if (!audio.paused) audio.pause()
}

audio.addEventListener('loadedmetadata', () => {
  ready = true
  if (!reportedReady) {
    reportedReady = true
    report({ ready: true })
  }
  if (wantPlaying && audio.paused) audio.play().catch(() => {})
})
audio.addEventListener('error', () => {
  const code = audio.error?.code
  report({
    error: code === 4 ? 'This computer cannot play this recording. Convert it to M4A (AAC) and add that file.' : code === 2 ? 'The recording could not be read (the file or drive may be gone).' : 'The recording stopped unexpectedly.',
    errorKind: code === 2 ? 'file' : 'decode'
  })
})
audio.addEventListener('ended', () => report({ ended: true }))
audio.addEventListener('pause', () => report())
audio.addEventListener('playing', () => report())
audio.addEventListener('seeked', () => report())
audio.addEventListener('waiting', () => report())

// ~4 times a second: where the sound really is (and whether it has stopped moving while it should be playing)
setInterval(() => {
  if (!fileId) return
  if (wantPlaying && !audio.paused && Math.abs(audio.currentTime - lastPos) < 0.01) still++
  else still = 0
  lastPos = audio.currentTime
  report()
}, 250)

// the output devices: the list for the operator's picker, and "the one in use was unplugged"
async function devices(): Promise<void> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    const outs = all.filter((d) => d.kind === 'audiooutput').map((d) => ({ id: d.deviceId, label: d.label || '' }))
    api.tapeEngineDevices(outs)
    if (sink && sink !== 'default' && !outs.some((d) => d.id === sink)) api.tapeEngineDeviceLost()
  } catch {
    /* no device list on this computer: the default output is used */
  }
}
navigator.mediaDevices?.addEventListener?.('devicechange', () => void devices())
void devices()

api.onTapeEngine((m: Msg) => {
  if (m.type === 'unload') {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    fileId = ''
    wantPlaying = false
    return
  }
  void apply(m)
})
api.tapeEngineReady()
