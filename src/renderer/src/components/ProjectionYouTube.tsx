import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaybackWire } from '../../../shared/videoPlayback'
import { ytToReport, type YtRaw } from '../../../shared/youtube'

/**
 * The YouTube video on the main output (the congregation window). Like a local video, this window is the LEADER: it applies the
 * play/pause/seek/volume commands in the playback record and reports what YouTube's player REALLY says about once a second.
 * The player lives in a small page served from 127.0.0.1 (see main/youtubeHost.ts) so YouTube can identify BORN (no "Error 153").
 *
 * Rules kept here: nothing starts by itself (the player is created cued, never autoplaying); the frame is never covered or
 * restyled; blank/Esc simply stop rendering this component, which destroys the player — it comes back cued and paused.
 */
export default function ProjectionYouTube({ videoId, mediaId, playback }: { videoId: string; mediaId: string; playback: PlaybackWire | null }): JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const lastEpoch = useRef<number | null>(null)
  const prev = useRef({ time: -1, stillTicks: 0 })
  const lastMsg = useRef(0)
  // where the player starts when it is (re)created: the record's position, so a blank/unblank resumes in place, paused
  const startAt = useRef(Math.floor(playback?.position ?? 0))

  useEffect(() => {
    let alive = true
    void window.electronAPI.youtubeHostUrl(videoId, startAt.current).then((u) => { if (alive) setSrc(u) })
    return () => { alive = false }
  }, [videoId])

  const post = useCallback((m: Record<string, unknown>): void => {
    const w = frame.current?.contentWindow
    if (w) w.postMessage(m, '*')
  }, [])

  // what the player says
  useEffect(() => {
    const onMsg = (e: MessageEvent): void => {
      if (!frame.current || e.source !== frame.current.contentWindow) return
      const m = e.data as { t?: string; state?: number; time?: number; duration?: number; code?: number } | null
      if (!m || typeof m !== 'object') return
      lastMsg.current = performance.now()
      if (m.t === 'ready') { setReady(true); return }
      if (m.t !== 'tick' && m.t !== 'state' && m.t !== 'error') return
      const raw: YtRaw = { state: Number(m.state ?? -1), time: Number(m.time ?? 0), duration: Number(m.duration ?? 0), error: m.t === 'error' ? Number(m.code ?? -1) : null }
      const { report, stillTicks } = ytToReport(raw, prev.current)
      prev.current = { time: raw.time, stillTicks }
      window.electronAPI.mediaPlaybackReport(report)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // if the player stops answering, say so (the bar shows "The picture has stopped moving")
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!ready || performance.now() - lastMsg.current < 6000) return
      window.electronAPI.mediaPlaybackReport({ position: Math.max(0, prev.current.time), playing: true, stalled: true })
    }, 2000)
    return () => window.clearInterval(t)
  }, [ready])

  // apply the record to the player
  useEffect(() => {
    const m = playback
    if (!ready || !m || m.mediaId !== mediaId) return
    post({ cmd: 'volume', value: Math.round(m.volume * 100) })
    post({ cmd: 'mute', value: m.muted })
    if (m.epoch !== lastEpoch.current) {
      if (lastEpoch.current !== null) post({ cmd: 'seek', to: m.position })
      lastEpoch.current = m.epoch
    }
    post({ cmd: m.status === 'playing' ? 'play' : 'pause' })
  }, [playback, ready, mediaId, post])

  useEffect(() => { window.focus() }, [ready])

  if (!src) return <div className="projection-yt" aria-hidden="true" />
  return (
    <iframe
      key={mediaId}
      ref={frame}
      className="projection-yt"
      src={src}
      title="YouTube video"
      tabIndex={-1}
      allow="autoplay; encrypted-media; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
