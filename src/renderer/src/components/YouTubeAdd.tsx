import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Globe, Play } from 'lucide-react'
import { parseYouTubeInput, youtubeErrorInfo } from '../../../shared/youtube'
import type { YouTubeFallback } from '../../../shared/queueItem'
import type { MediaRecord } from '../../../shared/media'
import './Preflight.css'
import './MediaPanel.css'

export interface YouTubeChoice {
  videoId: string
  title: string
  label?: string
  titleAt?: number
  fallback?: YouTubeFallback
}

type Recent = { videoId: string; title: string; label?: string; at: number }

/**
 * "Add a YouTube video": paste a link, see what YouTube says it is, give it a name and a backup, and add it to the queue.
 * Nothing starts playing, ever — adding is only adding. The picture shown is YouTube's own preview image and is not saved.
 */
export default function YouTubeAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (c: YouTubeChoice) => void }): JSX.Element {
  const [text, setText] = useState('')
  const [info, setInfo] = useState<{ title: string; author: string } | null | 'loading'>(null)
  const [label, setLabel] = useState('')
  const [backup, setBackup] = useState('')
  const [library, setLibrary] = useState<MediaRecord[]>([])
  const [recents, setRecents] = useState<Recent[]>([])
  const [test, setTest] = useState<string | null>(null)
  const seq = useRef(0)
  const parsed = useMemo(() => parseYouTubeInput(text), [text])
  const videoId = parsed.ok ? parsed.videoId : null

  useEffect(() => {
    void window.electronAPI.mediaList({}).then((l) => setLibrary((l ?? []).slice(0, 60))).catch(() => {})
    void window.electronAPI.youtubeRecentsGet().then(setRecents).catch(() => {})
  }, [])

  // read the title (public oEmbed, no sign-in); if it fails the operator just names it themselves
  useEffect(() => {
    setTest(null)
    if (!videoId) { setInfo(null); return }
    const mine = ++seq.current
    setInfo('loading')
    void window.electronAPI.youtubeLookup(videoId).then((r) => { if (mine === seq.current) setInfo(r) })
  }, [videoId])

  const fallback = (): YouTubeFallback | undefined => {
    if (backup === 'blank') return { blank: true }
    const rec = library.find((r) => r.id === backup)
    return rec ? { mediaId: rec.id, name: rec.name } : undefined
  }

  const add = (id: string, title: string): void => {
    const fb = fallback()
    const name = label.trim()
    void window.electronAPI.youtubeRecentsAdd({ videoId: id, title, label: name || undefined })
    onAdd({ videoId: id, title, ...(name ? { label: name } : {}), ...(title ? { titleAt: Date.now() } : {}), ...(fb ? { fallback: fb } : {}) })
  }

  const runTest = async (): Promise<void> => {
    if (!videoId) return
    setTest('Testing — a small window opens, muted, for a few seconds…')
    const r = await window.electronAPI.youtubeTestPlay(videoId)
    if (!r) { setTest('The test could not run.'); return }
    if (r.ok) setTest(`It played (${r.seconds}s). Ads may appear in the real show; BORN cannot remove them.`)
    else if (r.code !== null) setTest(`${youtubeErrorInfo(r.code).short} ${youtubeErrorInfo(r.code).fix}`)
    else setTest('It did not start playing. Check this computer is online, then try again.')
  }

  const title = info && info !== 'loading' ? info.title : ''
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal preflight" role="dialog" aria-modal="true" aria-label="Add a YouTube video" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
        <div className="modal-title-row">
          <h3 className="modal-title"><Globe width={15} height={15} aria-hidden="true" /> Add a YouTube video</h3>
          <button className="btn-icon btn-sm" onClick={onClose} aria-label="Close"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>
        <p className="modal-hint">
          YouTube videos play <b>online</b>, in YouTube’s own player. They need the internet during the service, and <b>ads may appear</b> — BORN cannot remove them. Give each one a backup.
        </p>
        <label className="modal-label" htmlFor="yt-link">YouTube link</label>
        <input id="yt-link" className="modal-input" autoFocus value={text} placeholder="Paste a link, e.g. https://youtu.be/…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && videoId) { e.preventDefault(); add(videoId, title) } }} />
        {text.trim() && !parsed.ok && <div className="preflight-detail" role="status">{parsed.message}</div>}
        {videoId && (
          <div className="preflight-summary" role="status">
            {info === 'loading' ? 'Looking it up…' : info ? <><b>{info.title}</b>{info.author ? ` · ${info.author}` : ''}</> : <>Couldn’t read the title (you may be offline). It can still be added — give it a name below.</>}
          </div>
        )}
        {videoId && (
          <>
            <label className="modal-label" htmlFor="yt-name">Name in the queue <span className="preflight-detail">(optional)</span></label>
            <input id="yt-name" className="modal-input" value={label} placeholder={title || `YouTube video ${videoId}`} onChange={(e) => setLabel(e.target.value)} />
            <label className="modal-label" htmlFor="yt-backup">If YouTube doesn’t work on the day, offer…</label>
            <select id="yt-backup" className="modal-input" value={backup} onChange={(e) => setBackup(e.target.value)}>
              <option value="">Nothing (I will press Clear)</option>
              <option value="blank">A black screen</option>
              {library.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {test && <div className="preflight-detail" role="status">{test}</div>}
          </>
        )}
        {recents.length > 0 && !videoId && (
          <>
            <div className="modal-label">Recent</div>
            <ul className="yt-recents">
              {recents.slice(0, 8).map((r) => (
                <li key={r.videoId}>
                  <button className="btn-quiet btn-sm" onClick={() => setText(`https://youtu.be/${r.videoId}`)}>{r.label || r.title || `YouTube video ${r.videoId}`}</button>
                  <button className="btn-icon btn-sm" aria-label={`Forget ${r.label || r.title || r.videoId}`} onClick={() => void window.electronAPI.youtubeRecentsRemove(r.videoId).then(setRecents)}><X width={12} height={12} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="modal-actions">
          <button className="btn-secondary btn-sm" onClick={() => void runTest()} disabled={!videoId}><Play width={12} height={12} aria-hidden="true" /> Test play</button>
          <span style={{ flex: 1 }} />
          <button className="btn-quiet btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" disabled={!videoId} onClick={() => videoId && add(videoId, title)}>Add to queue</button>
        </div>
      </div>
    </div>
  )
}
