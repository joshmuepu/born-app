import { useCallback, useEffect, useRef } from 'react'
import type { PlaybackWire } from '../../../shared/videoPlayback'

/**
 * The video on the main output (the congregation window). This window is the LEADER: it really plays (with sound), applies the
 * play/pause/seek/volume commands in the playback record, and reports where it truly is about once a second — that report is the
 * clock every other screen follows (see shared/videoPlayback.ts). Nothing here ever starts by itself: a taken video waits
 * paused on its first frame until the operator (or, after that, the phone) presses Play.
 */
export default function ProjectionVideo({ mediaId, fit, playback }: { mediaId: string; fit?: string; playback: PlaybackWire | null }): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null)
  const lastEpoch = useRef<number | null>(null)
  const lastPos = useRef(-1)
  const stillFor = useRef(0)
  const error = useRef<string | null>(null)

  const report = useCallback((extra: { ended?: boolean; error?: string | null } = {}): void => {
    const v = ref.current
    if (!v) return
    const playing = !v.paused && !v.ended
    // frames stopped advancing while it should be playing: two checks in a row = stalled
    if (playing && Math.abs(v.currentTime - lastPos.current) < 0.01) stillFor.current++
    else stillFor.current = 0
    lastPos.current = v.currentTime
    window.electronAPI.mediaPlaybackReport({
      position: v.currentTime,
      playing,
      duration: Number.isFinite(v.duration) ? v.duration : null,
      ended: extra.ended ?? false,
      stalled: stillFor.current >= 2,
      error: extra.error ?? error.current
    })
  }, [])

  // apply the record to the element
  useEffect(() => {
    const v = ref.current
    const m = playback
    if (!v || !m || m.mediaId !== mediaId) return
    v.loop = m.loop
    v.volume = m.volume
    v.muted = m.muted
    if (m.epoch !== lastEpoch.current) {
      lastEpoch.current = m.epoch
      lastPos.current = -1
      const seek = (): void => {
        try { v.currentTime = m.position } catch { /* not seekable yet; retried on loadedmetadata */ }
      }
      if (v.readyState >= 1) seek()
      else v.addEventListener('loadedmetadata', seek, { once: true })
    }
    if (m.status === 'playing') {
      if (v.paused) {
        v.play().catch((e) => { error.current = String(e && (e as Error).message ? (e as Error).message : e); report({ error: error.current }) })
      }
    } else if (!v.paused) {
      v.pause()
    }
  }, [playback, mediaId, report])

  // report ~once a second, and on the events that matter
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const tick = window.setInterval(() => report(), 1000)
    const onEnded = (): void => report({ ended: !v.loop })
    const onError = (): void => {
      error.current = `media error ${v.error ? v.error.code : ''}`.trim()
      report({ error: error.current })
    }
    const onMeta = (): void => report()
    v.addEventListener('ended', onEnded)
    v.addEventListener('error', onError)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('pause', onMeta)
    v.addEventListener('playing', onMeta)
    return () => {
      window.clearInterval(tick)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('error', onError)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('pause', onMeta)
      v.removeEventListener('playing', onMeta)
    }
  }, [mediaId, report])

  return (
    <video
      key={mediaId}
      ref={ref}
      className={`projection-pic projection-pic--${fit ?? 'fit'}`}
      src={`born-media://file/${mediaId}`}
      poster={`born-media://display/${mediaId}`}
      preload="auto"
      playsInline
      controls={false}
      disablePictureInPicture
    />
  )
}
