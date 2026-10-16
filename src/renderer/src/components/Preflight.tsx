import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, X, RefreshCw } from 'lucide-react'
import type { QueueItem } from '../../../shared/queueItem'
import { itemTitle, isProjectable } from '../../../shared/queueItem'
import type { MediaPreflightResult } from '../../../shared/media'
import type { OutputInfo } from '../types'
import { youtubeDisplayName } from '../../../shared/youtube'
import './Preflight.css'

type Level = 'pass' | 'warn' | 'fail'
interface Row {
  key: string
  level: Level
  title: string
  detail?: string
  /** Queue position, if this row is about one item. */
  index?: number
  mediaId?: string
  videoId?: string
  fix?: Array<'find' | 'reconnect' | 'remove' | 'test'>
}

const ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const
const rank: Record<Level, number> = { fail: 0, warn: 1, pass: 2 }

/** "Is tonight ready?" — checks every item in the queue (and the things around it) and says,
 *  per item, pass / warn / fail with the one thing to do about it. It changes nothing by itself. */
export default function Preflight({
  open,
  queue,
  onClose,
  onRemoveItem
}: {
  open: boolean
  queue: QueueItem[]
  onClose: () => void
  onRemoveItem: (index: number) => void
}): JSX.Element | null {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const seq = useRef(0)

  const run = useCallback(async () => {
    const mine = ++seq.current
    setBusy(true)
    const api = window.electronAPI
    const out: Row[] = []
    const mediaIds = [...new Set(queue.flatMap((it) => (it.kind === 'media' ? it.slides.map((s) => s.media?.mediaId).filter((x): x is string => !!x) : [])))]
    // YouTube items: the online check (internet, YouTube's player accepts the video, embedding allowed). Skipped when there are none.
    const ytItems = queue.filter((q): q is Extract<QueueItem, { kind: 'youtube' }> => q.kind === 'youtube')
    const ytP = ytItems.length ? api.youtubePreflight(ytItems.map((y) => ({ videoId: y.videoId, hasFallback: !!y.fallback }))).catch(() => []) : Promise.resolve([])
    const fbIds = [...new Set(ytItems.map((y) => y.fallback?.mediaId).filter((x): x is string => !!x))]
    const [ytRes, fbRes] = await Promise.all([ytP, fbIds.length ? api.mediaPreflight(fbIds).catch(() => [] as MediaPreflightResult[]) : Promise.resolve([] as MediaPreflightResult[])])
    const [pf, info, outs, bgs] = await Promise.all([
      mediaIds.length ? api.mediaPreflight(mediaIds).catch(() => [] as MediaPreflightResult[]) : Promise.resolve([] as MediaPreflightResult[]),
      api.mediaInfo().catch(() => null),
      api.listOutputs().catch(() => [] as OutputInfo[]),
      api.mediaBackgroundsGet().catch(() => null)
    ])
    if (mine !== seq.current) return
    const byId = new Map(pf.map((r) => [r.id, r]))

    if (queue.length === 0) out.push({ key: 'empty', level: 'warn', title: 'The queue is empty', detail: 'Add what you plan to show, then check again.' })
    queue.forEach((it, index) => {
      const title = itemTitle(it)
      if (it.kind === 'unknown') {
        out.push({ key: `u${index}`, level: 'fail', title: `“${title}” can't be shown`, detail: it.reason === 'newer' ? 'It was made by a newer version of BORN. It will be skipped; it stays in the file.' : 'This item is damaged. It will be skipped.', index, fix: ['remove'] })
        return
      }
      if (it.kind === 'youtube') {
        const v = ytRes.find((r) => r.videoId === it.videoId)
        const name = youtubeDisplayName(it)
        const fbMissing = !!it.fallback?.mediaId && !fbRes.some((r) => r.id === it.fallback?.mediaId && r.status === 'ok')
        if (!v) out.push({ key: `y${index}`, level: 'warn', title: `“${name}”: couldn't be checked`, detail: 'Press Check again.', index, videoId: it.videoId, fix: ['test', 'remove'] })
        else {
          out.push({
            key: `y${index}`,
            level: v.level,
            title: `“${name}” (YouTube, online): ${v.title}`,
            detail: `${v.detail}${fbMissing ? ' Its backup file is not in this computer’s library any more.' : ''}`,
            index,
            videoId: it.videoId,
            fix: ['test', ...(v.level === 'fail' ? (['remove'] as const) : [])]
          })
        }
        return
      }
      if (it.kind === 'media') {
        const ids = [...new Set(it.slides.map((s) => s.media?.mediaId).filter((x): x is string => !!x))]
        const results = ids.map((id) => byId.get(id)).filter((x): x is MediaPreflightResult => !!x)
        const bad = results.filter((r) => r.status !== 'ok' || r.deep === 'damaged' || r.deep === 'undecodable')
        if (results.length < ids.length || ids.length === 0) {
          out.push({ key: `m${index}`, level: 'fail', title: `“${title}”: a picture is no longer in the library`, detail: 'Remove it from the queue, or add the picture again.', index, fix: ['remove'] })
        } else if (bad.length > 0) {
          const r = bad[0]
          const why = r.status === 'offline' ? 'its drive is not connected' : r.status === 'missing' ? 'the file is missing' : r.status === 'changed' ? 'the file was changed' : r.status === 'unreadable' ? "BORN can't read the file" : r.deep === 'damaged' ? 'the file is damaged' : it.mediaKind === 'video' ? "it won't play on this computer" : "it won't open as a picture"
          out.push({
            key: `m${index}`,
            level: 'fail',
            title: `“${title}”: ${bad.length > 1 ? `${bad.length} pictures have problems` : why}`,
            detail: r.status === 'offline' ? `${r.name}: ${why}. Plug the drive in and press Check again — or choose the folder if it has a new letter.` : `${r.name}: ${why}. ${r.notes[0] ?? ''}`.trim(),
            index,
            mediaId: r.id,
            fix: r.status === 'offline' ? ['reconnect', 'remove'] : r.storage === 'linked' && r.status !== 'ok' ? ['find', 'remove'] : ['remove']
          })
        } else {
          const notes = results.flatMap((r) => r.notes)
          out.push({
            key: `m${index}`,
            level: notes.some((n) => /^(Very large|Small|Linked|4K|\d+ frames|Very high)/.test(n)) ? 'warn' : 'pass',
            title: `“${title}”`,
            detail: notes.length ? Array.from(new Set(notes)).slice(0, 3).join(' ') : ids.length > 1 ? `${ids.length} pictures, all present and readable.` : it.mediaKind === 'video' ? 'Present, whole, and a frame plays on this computer.' : 'Present, unchanged and readable.',
            index
          })
        }
        return
      }
      if (!isProjectable(it)) out.push({ key: `p${index}`, level: 'fail', title: `“${title}” has nothing to show`, index, fix: ['remove'] })
      else out.push({ key: `p${index}`, level: 'pass', title: `“${title}”`, detail: `${it.slides.length} slide${it.slides.length === 1 ? '' : 's'}`, index })
    })

    // Around the queue
    if (info && !info.available) out.push({ key: 'lib', level: queue.some((q) => q.kind === 'media') ? 'fail' : 'warn', title: "The media library isn't available", detail: info.message ?? undefined })
    if (info?.available && typeof info.freeBytes === 'number') {
      const gb = info.freeBytes / 1073741824
      if (gb < 1) out.push({ key: 'disk', level: 'fail', title: `Only ${gb.toFixed(1)} GB of disk space is free`, detail: 'Free some space before the service.' })
      else if (gb < 5) out.push({ key: 'disk', level: 'warn', title: `${gb.toFixed(1)} GB of disk space is free`, detail: 'Enough for tonight, but getting low.' })
    }
    if (queue.some((q) => q.kind === 'media')) {
      const lt = outs.filter((o) => o.kind === 'browser' && !(o.autoProfile) && o.profileId === 'lower-third')
      if (lt.length) out.push({ key: 'lt', level: 'warn', title: `${lt.length} Graphics output${lt.length === 1 ? ' is' : 's are'} set to Lower third`, detail: 'Pictures are not drawn on a lower-third output (so a picture never covers your camera). Use Full-screen there if you want pictures.' })
    }
    if (bgs) {
      const ids = [...Object.values(bgs.settings.destinations), ...Object.values(bgs.settings.channels)].map((b) => b.mediaId).filter((x): x is string => !!x)
      if (ids.length) {
        const r = await api.mediaPreflight([...new Set(ids)]).catch(() => [] as MediaPreflightResult[])
        const badBg = r.filter((x) => x.status !== 'ok' || x.deep !== 'ok')
        if (badBg.length) out.push({ key: 'bg', level: 'warn', title: 'A background picture has a problem', detail: `${badBg.map((x) => x.name).join(', ')} — text will still show, without that background.` })
      }
    }
    out.sort((a, b) => rank[a.level] - rank[b.level] || (a.index ?? 999) - (b.index ?? 999))
    setRows(out)
    setCheckedAt(new Date())
    setBusy(false)
  }, [queue])

  useEffect(() => {
    if (open) void run()
  }, [open, run])

  const counts = useMemo(() => ({ fail: rows.filter((r) => r.level === 'fail').length, warn: rows.filter((r) => r.level === 'warn').length, pass: rows.filter((r) => r.level === 'pass').length }), [rows])
  if (!open) return null
  const ready = !busy && counts.fail === 0
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal preflight" role="dialog" aria-modal="true" aria-label="Is tonight ready?" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
        <div className="modal-title-row">
          <h3 className="modal-title">Is tonight ready?</h3>
          <button className="btn-icon btn-sm" onClick={onClose} aria-label="Close"><X width={15} height={15} strokeWidth={2.2} /></button>
        </div>
        <div className={`preflight-summary preflight-summary--${busy ? 'busy' : counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass'}`} role="status" aria-live="polite">
          {busy ? 'Checking every item…' : ready ? (counts.warn ? `Ready — ${counts.warn} thing${counts.warn === 1 ? '' : 's'} worth a look.` : `Ready — all ${counts.pass} checks passed.`) : `${counts.fail} problem${counts.fail === 1 ? '' : 's'} to fix${counts.warn ? `, ${counts.warn} to look at` : ''}.`}
        </div>
        <ul className="preflight-list">
          {rows.map((r) => {
            const Icon = ICON[r.level]
            return (
              <li key={r.key} className={`preflight-row preflight-row--${r.level}`}>
                <Icon width={18} height={18} aria-hidden="true" />
                <div className="preflight-text">
                  <div className="preflight-title">{r.title}</div>
                  {r.detail && <div className="preflight-detail">{r.detail}</div>}
                </div>
                <div className="preflight-fix">
                  {r.fix?.includes('find') && r.mediaId && (
                    <button className="btn-quiet btn-sm" onClick={async () => { const x = await window.electronAPI.mediaRelinkPick(r.mediaId as string); if (x.ok) void run() }}>Find the file…</button>
                  )}
                  {r.fix?.includes('reconnect') && (
                    <button className="btn-quiet btn-sm" onClick={async () => { const x = await window.electronAPI.mediaReconnectLinked(); if (!x.canceled) void run() }}>Find the folder…</button>
                  )}
                  {r.fix?.includes('test') && r.videoId && (
                    <button className="btn-quiet btn-sm" onClick={() => { void window.electronAPI.youtubeTestPlay(r.videoId as string) }} title="Opens a small muted player for a few seconds">Test play</button>
                  )}
                  {r.fix?.includes('remove') && r.index !== undefined && (
                    <button className="btn-quiet btn-sm" onClick={() => { onRemoveItem(r.index as number) }}>Remove from queue</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="preflight-foot">
          <span>{checkedAt ? `Checked ${checkedAt.toLocaleTimeString()}` : ''}</span>
          <button className="btn-quiet btn-sm" onClick={() => void run()} disabled={busy}><RefreshCw width={13} height={13} /> Check again</button>
        </div>
      </div>
    </div>
  )
}
