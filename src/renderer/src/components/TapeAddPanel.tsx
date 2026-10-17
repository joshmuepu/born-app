import TapeDownload from './TapeDownload'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Headphones, FolderOpen, Globe, RefreshCw, Check } from 'lucide-react'
import type { TapeFolderHit, TapeImportResult } from '../../../shared/tape'
import { emitTape } from '../tapeBus'
import TapeAttach from './TapeAttach'

interface SermonRef { id: number; dateCode: string; title: string }
const mb = (n: number): string => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1048576))} MB`)

/**
 * Add a recording from the Tape place: say which sermon it is for, then use the same "Add the tape" dialog as before (file, drag-drop, Get audio, the checks),
 * or add what the "Tape audio" folder scan found. Nothing is downloaded, and the original file is never changed.
 */
export default function TapeAddPanel({ preferredSermonId, onChanged }: { preferredSermonId?: number | null; onChanged: () => void }): JSX.Element {
  const [sermons, setSermons] = useState<SermonRef[]>([])
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<SermonRef | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [folder, setFolder] = useState<string | null>(null)
  const [hits, setHits] = useState<TapeFolderHit[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { void Promise.resolve(window.electronAPI.tapeSermonList?.()).then((l) => setSermons(l ?? [])) }, [])
  useEffect(() => { if (preferredSermonId != null && !chosen) { const s = sermons.find((x) => x.id === preferredSermonId); if (s) setChosen(s) } }, [preferredSermonId, sermons, chosen])
  const scan = useCallback(async () => {
    const info = await window.electronAPI.tapeInfo()
    setFolder(info.folder)
    setHits(info.folder ? ((await window.electronAPI.tapeScanFolder()) as TapeFolderHit[]) : [])
  }, [])
  useEffect(() => { void scan() }, [scan])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return sermons.filter((s) => s.title.toLowerCase().includes(q) || s.dateCode.toLowerCase().includes(q.replace(/\s+/g, ''))).slice(0, 8)
  }, [query, sermons])

  const addHit = async (h: TapeFolderHit, sermonId: number): Promise<void> => {
    const r = (await window.electronAPI.tapeImportConfirmed([{ path: h.path, sermonId }])) as TapeImportResult[]
    const ok = r.find((x) => x.ok)
    const bad = r.find((x): x is Extract<TapeImportResult, { ok: false }> => !x.ok)
    setMessage(ok ? `Added “${h.name}”.` : bad ? bad.message : 'It could not be added.')
    if (ok) { onChanged(); emitTape('recordings-changed'); void scan() }
  }
  const pickFolder = async (): Promise<void> => {
    const f = await window.electronAPI.tapePickFolder()
    if (f) { await scan(); setMessage(`Your “Tape audio” folder is now ${f}.`) }
  }

  return (
    <div className="tpa">
      <section className="tp-card">
        <h4><Headphones width={15} height={15} aria-hidden="true" /> Which sermon is the recording for?</h4>
        <div className="tpa-pick">
          <input className="tp-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a title or a date code, e.g. 65-0418M" aria-label="Find the sermon" />
          {chosen && <span className="tp-chip tp-chip--ok"><Check width={12} height={12} aria-hidden="true" /> {chosen.dateCode} · {chosen.title}</span>}
        </div>
        {matches.length > 0 && (
          <ul className="tpa-list" aria-label="Matching sermons">
            {matches.map((s) => (
              <li key={s.id}><button onClick={() => { setChosen(s); setQuery('') }}><b>{s.dateCode}</b> {s.title}</button></li>
            ))}
          </ul>
        )}
        <div className="tpa-actions">
          <button className="btn-primary btn-sm" disabled={!chosen} onClick={() => setAttachOpen(true)}>Add a recording{chosen ? ` for “${chosen.title}”` : ''}…</button>
        </div>
        <h4 className="tpa-get"><Globe width={15} height={15} aria-hidden="true" /> Get audio</h4>
        <TapeDownload sermon={chosen ? { id: chosen.id, dateCode: chosen.dateCode, title: chosen.title } : null} onDone={() => { onChanged(); emitTape('recordings-changed'); void scan() }} />
      </section>

      <section className="tp-card">
        <h4><FolderOpen width={15} height={15} aria-hidden="true" /> Your “Tape audio” folder</h4>
        <div className="tpa-actions">
          <span className="tp-faint tpa-folder">{folder ?? 'Not chosen yet — keep your recordings in one folder and BORN will find them.'}</span>
          <button className="btn-secondary btn-sm" onClick={() => void pickFolder()}>{folder ? 'Change…' : 'Choose a folder…'}</button>
          {folder && <button className="btn-quiet btn-sm" onClick={() => void scan()}><RefreshCw width={12} height={12} aria-hidden="true" /> Look again</button>}
        </div>
        {message && <p className="tp-faint" role="status">{message}</p>}
        {folder && hits.length === 0 && <p className="tp-faint">No audio files found in that folder yet.</p>}
        {hits.length > 0 && (
          <table className="tp-table">
            <thead><tr><th>File</th><th>Size</th><th>Looks like</th><th /></tr></thead>
            <tbody>
              {hits.map((h) => (
                <tr key={h.path}>
                  <td title={h.path}>{h.name}</td>
                  <td>{mb(h.bytes)}</td>
                  <td>{h.match ? <span className={h.confidence === 'exact' ? 'tp-ok' : 'tp-warn'}>{h.match.dateCode} {h.match.title}{h.confidence === 'exact' ? '' : ' (please check)'}</span> : <span className="tp-faint">no sermon recognised</span>}</td>
                  <td>
                    {h.imported ? <span className="tp-faint">Already added</span>
                      : h.match ? <button className="btn-primary btn-sm" onClick={() => void addHit(h, h.match!.id)}>Add to that sermon</button>
                      : chosen ? <button className="btn-quiet btn-sm" onClick={() => void addHit(h, chosen.id)}>Add to “{chosen.title}”</button>
                      : <span className="tp-faint">choose a sermon above</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {attachOpen && chosen && (
        <TapeAttach sermonId={chosen.id} sermonTitle={chosen.title} dateCode={chosen.dateCode} onClose={() => { setAttachOpen(false); onChanged(); emitTape('recordings-changed') }} onChanged={() => { onChanged(); emitTape('recordings-changed') }} />
      )}
    </div>
  )
}
