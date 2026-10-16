import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Repeat } from 'lucide-react'
import { formatClock, wirePosition, type PlaybackWire } from '../../../shared/videoPlayback'
import './VideoBar.css'

/**
 * The operator's playback bar for the live video: play/pause, where it is, time left, seek, volume, loop. It shows what the
 * output REALLY reports (the playback record the main output keeps), never what was asked for. Taking a video shows it paused;
 * nothing plays until Play is pressed here.
 */
export default function VideoBar({ channelId, mediaId }: { channelId: string; mediaId: string }): JSX.Element {
  const [wire, setWire] = useState<PlaybackWire | null>(null)
  const receivedAt = useRef(performance.now())
  const [, force] = useState(0)
  const [seeking, setSeeking] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void window.electronAPI.mediaPlaybackGet(channelId).then((m) => { if (alive && m && m.mediaId === mediaId) { receivedAt.current = performance.now(); setWire(m) } })
    const off = window.electronAPI.onMediaPlayback((m) => {
      if (m.channelId !== channelId || m.mediaId !== mediaId) return
      receivedAt.current = performance.now()
      setWire(m)
    })
    const offStop = window.electronAPI.onMediaPlaybackStop((c) => { if (c === channelId) setWire(null) })
    // the clock between messages runs here
    const tick = window.setInterval(() => force((n) => n + 1), 250)
    return () => {
      alive = false
      off()
      offStop()
      window.clearInterval(tick)
    }
  }, [channelId, mediaId])

  const send = (action: Parameters<typeof window.electronAPI.mediaPlaybackCommand>[1]): void => { void window.electronAPI.mediaPlaybackCommand(channelId, action) }
  if (!wire) return <div className="vbar vbar--idle" role="group" aria-label="Video controls"><span className="vbar-note">Loading the video…</span></div>

  const pos = seeking ?? wirePosition(wire, performance.now() - receivedAt.current)
  const dur = wire.duration
  const left = dur !== null ? Math.max(0, dur - pos) : null
  const playing = wire.status === 'playing'
  const note =
    wire.status === 'error' ? `This video stopped: ${wire.error ?? 'it could not be played'}. Press Clear, or take it again.`
    : wire.stalled ? 'The picture has stopped moving. If it does not recover, press Pause, then Play — or Clear the screen.'
    : wire.status === 'ended' ? 'Finished. Press Play to start it again.'
    : !wire.hasPlayedOnce && wire.status === 'paused' ? 'Ready on its first frame. Nothing plays until you press Play.'
    : null

  return (
    <div className="vbar" role="group" aria-label="Video controls">
      <div className="vbar-row">
        <button className="btn-primary btn-sm vbar-play" onClick={() => send({ type: 'toggle' })} disabled={wire.status === 'error'} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause width={14} height={14} fill="currentColor" aria-hidden="true" /> : <Play width={14} height={14} fill="currentColor" aria-hidden="true" />}
          {playing ? 'Pause' : wire.status === 'ended' ? 'Play again' : 'Play'}
        </button>
        <span className="vbar-time" aria-live="off">{formatClock(pos)} <span className="vbar-of">/ {formatClock(dur)}</span></span>
        <span className="vbar-left" title="Time left">{left !== null ? `−${formatClock(left)}` : ''}</span>
      </div>
      <input
        className="vbar-seek"
        type="range"
        min={0}
        max={dur ?? 0}
        step={0.1}
        value={Math.min(pos, dur ?? 0)}
        disabled={dur === null || wire.status === 'error'}
        aria-label="Position in the video"
        onChange={(e) => setSeeking(Number(e.target.value))}
        onPointerUp={() => { if (seeking !== null) { send({ type: 'seek', to: seeking }); setSeeking(null) } }}
        onKeyUp={(e) => { if (seeking !== null && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page'))) { send({ type: 'seek', to: seeking }); setSeeking(null) } }}
        onBlur={() => { if (seeking !== null) { send({ type: 'seek', to: seeking }); setSeeking(null) } }}
      />
      <div className="vbar-row">
        <button className="btn-quiet btn-sm vbar-icon" onClick={() => send({ type: 'muted', value: !wire.muted })} aria-label={wire.muted ? 'Unmute' : 'Mute'} aria-pressed={wire.muted} title={wire.muted ? 'Sound is off — click to turn it on' : 'Mute'}>
          {wire.muted ? <VolumeX width={15} height={15} aria-hidden="true" /> : <Volume2 width={15} height={15} aria-hidden="true" />}
        </button>
        <input className="vbar-vol" type="range" min={0} max={100} value={Math.round(wire.volume * 100)} aria-label="Volume" onChange={(e) => send({ type: 'volume', value: Number(e.target.value) / 100 })} />
        <button className={`btn-quiet btn-sm vbar-icon${wire.loop ? ' is-on' : ''}`} onClick={() => send({ type: 'loop', value: !wire.loop })} aria-pressed={wire.loop} aria-label="Loop" title={wire.loop ? 'Loops — click to stop looping' : 'Loop (start over when it ends)'}>
          <Repeat width={15} height={15} aria-hidden="true" />
        </button>
      </div>
      {note && <div className={`vbar-note${wire.status === 'error' || wire.stalled ? ' is-warn' : ''}`} role="status">{note}</div>}
    </div>
  )
}
