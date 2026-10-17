import { useEffect, useState } from 'react'
import { Download, Globe, X } from 'lucide-react'
import type { TapeImportResult } from '../../../shared/tape'

const mb = (n: number): string => `${Math.round(n / 1048576)} MB`

/** "Get audio": downloads the tape for one sermon from the publisher's own site (on the click, one file, English), then adds it. The publisher's page stays one click away. */
export default function TapeDownload({
  sermon,
  onDone,
  compact = false
}: {
  sermon: { id: number; dateCode: string; title: string } | null
  onDone: (results: TapeImportResult[]) => void
  compact?: boolean
}): JSX.Element {
  const [progress, setProgress] = useState<{ received: number; total: number | null } | null>(null)
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)

  useEffect(() => window.electronAPI.onTapeDownloadProgress?.((p) => { if (sermon && p.sermonId === sermon.id) setProgress({ received: p.received, total: p.total }) }), [sermon])

  const run = async (): Promise<void> => {
    if (!sermon) return
    setMessage(null)
    setProgress({ received: 0, total: null })
    const r = await window.electronAPI.tapeDownload(sermon.id)
    setProgress(null)
    if (!r.ok) { setMessage({ text: r.message, bad: !/cancelled/.test(r.message) }); return }
    const bad = r.results.find((x) => !x.ok)
    const ok = r.results.find((x) => x.ok)
    setMessage(ok ? { text: `Downloaded and added “${sermon.title}” (${mb(r.bytes)}).`, bad: false } : { text: bad && !bad.ok ? bad.message : 'It was downloaded but could not be added.', bad: true })
    onDone(r.results)
  }

  const pct = progress && progress.total ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : null
  return (
    <div className="tape-download">
      {!compact && <p>Downloads this recording from the publisher’s own site (English, usually 30–60 MB) into your “Tape audio” folder, then adds it. One recording, only when you press the button.</p>}
      <div className="tape-row">
        <button className="btn-primary btn-sm" onClick={() => void run()} disabled={!sermon || !!progress}>
          <Download width={13} height={13} aria-hidden="true" /> {sermon ? `Download the tape for ${sermon.dateCode}` : 'Download the tape'}
        </button>
        <button className="btn-quiet btn-sm" onClick={() => void window.electronAPI.tapeOpenAudioPage()} title="Opens the publisher’s own audio page in your browser (other languages, or to choose the file yourself)">
          <Globe width={13} height={13} aria-hidden="true" /> Open the publisher’s page
        </button>
      </div>
      {!sermon && <p className="tp-faint">Choose the sermon first.</p>}
      {progress && (
        <div className="tape-dl-progress" role="status" aria-live="polite">
          <div className="tape-dl-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label="Download progress"><i style={{ width: `${pct ?? 5}%` }} /></div>
          <span>{progress.total ? `Downloading… ${mb(progress.received)} of ${mb(progress.total)}` : 'Starting the download…'}</span>
          <button className="btn-quiet btn-sm" onClick={() => void window.electronAPI.tapeDownloadCancel()}><X width={12} height={12} aria-hidden="true" /> Cancel</button>
        </div>
      )}
      {message && <div className={`tape-note${message.bad ? ' tape-note--bad' : ''}`} role={message.bad ? 'alert' : 'status'}>{message.text}</div>}
      <p className="tp-faint tape-dl-credit">Recordings © Voice Of God Recordings, all rights reserved; BORN only fetches the file the publisher offers for download.</p>
    </div>
  )
}
