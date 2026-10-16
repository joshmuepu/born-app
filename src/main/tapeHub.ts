/**
 * tapeHub.ts — the one record of the tape that is playing (main process, Electron-free so it is tested directly).
 *
 * It applies the operator's commands with the pure reducers in shared/tapePlayback.ts, takes the hidden audio window's reports as the clock,
 * keeps the resume position, enforces "one sound source at a time", and tells everyone who needs to know through `emit`. It never plays
 * anything itself: it tells the engine what the record says, and believes what the engine reports back.
 */
import { initialTape, tapeReduce, toTapeWire, tapePositionNow, type PausedBy, type TapeAction, type TapeRecord, type TapeWire, type TapeErrorKind } from '../shared/tapePlayback'
import type { TapeRecording } from '../shared/tape'

/** What the engine window is told. It applies the whole record each time; it seeks only when `epoch` changes. */
export interface EngineApply {
  type: 'apply'
  fileId: string
  status: TapeRecord['status']
  position: number
  epoch: number
  speed: number
  volume: number
  muted: boolean
  deviceId: string
}
export type EngineMessage = EngineApply | { type: 'unload' }

export interface TapeHubDeps {
  now: () => number
  emit: (w: TapeWire | null) => void
  engine: (m: EngineMessage) => void
  savePosition: (recordingId: string, sec: number) => void
  /** the recording (with its file) and where it stopped last time */
  loadRecording: (recordingId: string) => { recording: TapeRecording; resume: number | null } | null
  settings: () => { outputDeviceId: string; outputDeviceLabel: string; volume?: number }
  /** one sound source at a time */
  videoPlaying: () => boolean
  pauseVideo: () => void
  notice?: (message: string) => void
}

export class TapeHub {
  private rec: TapeRecord | null = null
  private ticks = 0
  private lastSaved = -1
  constructor(private d: TapeHubDeps) {}

  get record(): TapeRecord | null {
    return this.rec
  }
  get(): TapeWire | null {
    return this.rec ? toTapeWire(this.rec, this.d.now()) : null
  }

  private put(next: TapeRecord): void {
    const prev = this.rec
    this.rec = next
    const e = this.d
    e.engine({ type: 'apply', fileId: next.fileId, status: next.status, position: next.position, epoch: next.epoch, speed: next.speed, volume: next.volume, muted: next.muted, deviceId: next.deviceId })
    e.emit(toTapeWire(next, e.now()))
    // remember where it stopped whenever it stops or jumps
    if (prev && (next.status !== 'playing' || next.epoch !== prev.epoch)) this.save()
  }

  private save(): void {
    if (!this.rec) return
    const pos = tapePositionNow(this.rec, this.d.now())
    if (Math.abs(pos - this.lastSaved) < 1) return
    this.lastSaved = pos
    this.d.savePosition(this.rec.recordingId, pos)
  }

  /** Load a recording (paused, at its resume position). Nothing plays: no sound starts on load. */
  load(recordingId: string, o: { play?: boolean; position?: number } = {}): TapeRecord | null {
    if (this.rec && this.rec.recordingId === recordingId && this.rec.status !== 'error') {
      if (o.position !== undefined) this.command({ type: 'seek', to: o.position })
      if (o.play) this.command({ type: 'play' })
      return this.rec
    }
    const found = this.d.loadRecording(recordingId)
    if (!found) return null
    if (this.rec) {
      this.save()
      this.rec = null // the new record is not a "stop" of the old one (put() would otherwise save its position 0 over nothing)
      this.d.engine({ type: 'unload' })
    }
    const s = this.d.settings()
    this.lastSaved = -1
    const start = o.position ?? found.resume ?? 0
    const base = initialTape(
      { recordingId, fileId: found.recording.file.id, sermonId: found.recording.sermonId, position: start, duration: found.recording.file.durationSec, volume: s.volume ?? 1, deviceId: s.outputDeviceId, deviceLabel: s.outputDeviceLabel },
      this.d.now()
    )
    this.put(base)
    // the engine tells us when the file is ready (`report … ready`); `play` waits for it
    this.wantPlay = !!o.play
    return this.rec
  }
  private wantPlay = false

  /** The operator's commands (also the keyboard and the panic key). Returns the new record, or null when no tape is loaded. */
  command(a: TapeAction): TapeRecord | null {
    if (!this.rec) return null
    if (a.type === 'play' || a.type === 'toggle') {
      const willPlay = a.type === 'play' || this.rec.status !== 'playing'
      if (willPlay && this.d.videoPlaying()) {
        this.d.pauseVideo()
        this.d.notice?.('The video was paused so the tape can play — only one sound at a time.')
      }
    }
    const next = tapeReduce(this.rec, a, this.d.now())
    if (next !== this.rec) this.put(next)
    return this.rec
  }

  /** The phone: Play/Pause of the loaded tape only, within the video rules. Play is refused until the operator has started the tape once. */
  phone(cmd: 'play' | 'pause' | 'back' | 'fwd'): { ok: true } | { ok: false; reason: 'nothing-loaded' | 'not-started' } {
    if (!this.rec) return { ok: false, reason: 'nothing-loaded' }
    if (cmd === 'play') {
      if (!this.rec.hasPlayedOnce) return { ok: false, reason: 'not-started' }
      this.command({ type: 'play' })
    } else if (cmd === 'pause') this.command({ type: 'pause', by: 'phone' })
    else this.command({ type: 'skip', by: cmd === 'back' ? -10 : 10 })
    return { ok: true }
  }

  /** The engine says where it really is (about 4 times a second and on every event). It is the clock. */
  report(r: { position: number; playing: boolean; duration?: number | null; ended?: boolean; stalled?: boolean; error?: string | null; errorKind?: TapeErrorKind; ready?: boolean }): void {
    if (!this.rec) return
    const before = this.rec
    const next = tapeReduce(before, { type: 'report', ...r }, this.d.now())
    this.rec = next
    const becameReady = before.status === 'loading' && next.status === 'paused'
    // broadcast changes besides the clock; the clock itself goes out from tick()
    if (next.status !== before.status || next.stalled !== before.stalled || next.error !== before.error || next.duration !== before.duration) {
      this.d.emit(toTapeWire(next, this.d.now()))
      if (next.status === 'ended' || next.status === 'error') this.save()
    }
    if (becameReady) {
      // the file is ready: now the record's wish (play, or an earlier resume position) is applied
      this.d.engine({ type: 'apply', fileId: next.fileId, status: next.status, position: next.position, epoch: next.epoch, speed: next.speed, volume: next.volume, muted: next.muted, deviceId: next.deviceId })
      if (this.wantPlay) { this.wantPlay = false; this.command({ type: 'play' }) }
    }
  }

  /** Something else needs the sound or the screen: a video, sleep, Shift+Esc. */
  pauseFor(by: PausedBy): void {
    if (this.rec && this.rec.status === 'playing') this.command({ type: 'pause', by })
  }
  deviceLost(): void {
    if (!this.rec) return
    const s = tapeReduce(this.rec, { type: 'device-lost' }, this.d.now())
    if (s !== this.rec) this.put(s)
  }
  setDevice(id: string, label: string): void {
    if (this.rec) this.command({ type: 'device', id, label })
  }
  /** Send the record again (a window was just opened or re-created). */
  resend(): void {
    if (this.rec) this.d.emit(toTapeWire(this.rec, this.d.now()))
  }
  /** What was loaded is gone (the operator closed the tape). */
  unload(): void {
    if (!this.rec) return
    this.save()
    this.rec = null
    this.d.engine({ type: 'unload' })
    this.d.emit(null)
  }

  /** Once a second: followers get a fresh position; every 5 s the resume position is saved. */
  tick(): void {
    if (!this.rec) return
    if (this.rec.status === 'playing') {
      this.d.emit(toTapeWire(this.rec, this.d.now()))
      if (++this.ticks % 5 === 0) this.save()
    }
  }
}
