import { useCallback, useEffect, useState } from 'react'
import { Monitor, Globe, Layers, X } from 'lucide-react'
import type { BackgroundSettings, MediaRecord } from '../../../shared/media'
import { DEFAULT_BACKGROUND_DIM } from '../../../shared/media'
import type { ChannelInfo, OutputInfo } from '../types'
import { mediaThumbUrl } from './MediaPanel'

export interface BgTarget {
  scope: 'destination' | 'channel'
  id: string
  label: string
  sub: string
  /** What this row falls back to when it has no setting of its own. */
  inheritsFrom?: string
}

/** A very large library would put thousands of <option>s in every picker (measured: 10,000 options → ~0.2 s of frozen window on
 *  a slow computer). Above this many, the pickers list the newest pictures plus the one in use; any other picture is set from
 *  its own panel ("Use as a background"). Small libraries see everything, as before. */
export const MAX_PICKER_OPTIONS = 300
export function pickable(items: MediaRecord[], selectedId?: string | null): MediaRecord[] {
  if (items.length <= MAX_PICKER_OPTIONS) return items
  const head = items.slice(0, MAX_PICKER_OPTIONS)
  if (selectedId && !head.some((i) => i.id === selectedId)) {
    const cur = items.find((i) => i.id === selectedId)
    if (cur) head.push(cur)
  }
  return head
}

/** The places a still background can be set: the congregation screen, each Graphics output, and
 *  each channel's default (which its screens and a following channel use unless they say otherwise). */
export function useBackgroundTargets(): { targets: BgTarget[]; settings: BackgroundSettings; reload: () => void } {
  const [targets, setTargets] = useState<BgTarget[]>([])
  const [settings, setSettings] = useState<BackgroundSettings>({ destinations: {}, channels: {} })
  const reload = useCallback(async () => {
    const api = window.electronAPI
    const [outs, chans, bg] = await Promise.all([
      api.listOutputs().catch(() => [] as OutputInfo[]),
      api.listChannels().catch(() => [] as ChannelInfo[]),
      api.mediaBackgroundsGet().catch(() => null)
    ])
    const label = (id: string): string => chans.find((c) => c.id === id)?.label ?? id
    const t: BgTarget[] = [{ scope: 'destination', id: 'congregation', label: 'Congregation screen', sub: `Channel: ${label('main')}` }]
    for (const o of outs.filter((x) => x.kind === 'browser')) {
      t.push({
        scope: 'destination',
        id: o.id,
        label: 'Graphics output (OBS / browser)',
        sub: `Channel: ${label(o.channelId)} · drawn only on a Full-screen profile`
      })
    }
    for (const c of chans) {
      t.push({
        scope: 'channel',
        id: c.id,
        label: `Channel default — ${c.label}`,
        sub: c.sync.syncMode !== 'independent' && c.sync.linkedTo ? `follows ${label(c.sync.linkedTo)} unless set here` : 'used by this channel’s screens unless they say otherwise',
        inheritsFrom: c.sync.syncMode !== 'independent' ? c.sync.linkedTo : undefined
      })
    }
    setTargets(t)
    if (bg) setSettings(bg.settings)
  }, [])
  useEffect(() => {
    void reload()
    return window.electronAPI.onMediaBackgroundsChanged(() => void reload())
  }, [reload])
  return { targets, settings, reload }
}

export default function MediaBackgrounds({ items }: { items: MediaRecord[] }): JSX.Element {
  const { targets, settings, reload } = useBackgroundTargets()
  const get = (t: BgTarget): { mediaId: string | null; dim: number } | undefined => (t.scope === 'destination' ? settings.destinations[t.id] : settings.channels[t.id])
  const set = async (t: BgTarget, mediaId: string | null | undefined, dim?: number): Promise<void> => {
    if (mediaId === undefined) await window.electronAPI.mediaBackgroundSet(t.scope, t.id, null)
    else await window.electronAPI.mediaBackgroundSet(t.scope, t.id, { mediaId, dim })
    void reload()
  }
  return (
    <div className="media-bgs">
      <p className="media-bgs-intro">
        A still picture can sit <b>behind</b> sermon, Bible and song text. Text always stays on top, and an alert always stays above
        everything. A picture shown as the content (not a background) covers the background.
      </p>
      <div className="media-bgs-layers" aria-label="Layer order">
        <span><Layers size={13} /> Layers, bottom to top:</span>
        <b>Background</b> › <b>Content</b> (text or picture) › <b>Overlay</b> (later) › <b>Alert</b>
      </div>
      {items.length > MAX_PICKER_OPTIONS && <p className="media-bg-sub">Your library is large, so each list shows the {MAX_PICKER_OPTIONS} newest pictures. To use any other picture, select it in the library and choose “Use as a background”.</p>}
      {targets.map((t) => {
        const cur = get(t)
        const rec = cur?.mediaId ? items.find((i) => i.id === cur.mediaId) : null
        return (
          <div className="media-bg-row" key={t.scope + t.id}>
            <div className="media-bg-thumb">
              {rec ? <img src={mediaThumbUrl(rec.id)} alt="" /> : <span>{cur && cur.mediaId === null ? 'None' : t.inheritsFrom ? 'Same as ' + t.inheritsFrom : 'None'}</span>}
            </div>
            <div className="media-bg-main">
              <div className="media-bg-title">{t.id === 'congregation' ? <Monitor size={14} /> : t.scope === 'destination' ? <Globe size={14} /> : <Layers size={14} />} {t.label}</div>
              <div className="media-bg-sub">{t.sub}</div>
              <div className="media-bg-controls">
                <select
                  aria-label={`Background for ${t.label}`}
                  value={cur ? (cur.mediaId ?? '__none') : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    void set(t, v === '' ? undefined : v === '__none' ? null : v, cur?.dim ?? DEFAULT_BACKGROUND_DIM)
                  }}
                >
                  <option value="">{t.scope === 'channel' ? '(no default)' : '(use the channel default)'}</option>
                  <option value="__none">No background here</option>
                  {pickable(items, cur?.mediaId).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <label className="media-bg-dim">
                  Dim {cur?.dim ?? DEFAULT_BACKGROUND_DIM}%
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={5}
                    value={cur?.dim ?? DEFAULT_BACKGROUND_DIM}
                    disabled={!cur || !cur.mediaId}
                    onChange={(e) => void set(t, cur?.mediaId ?? null, Number(e.target.value))}
                    aria-label={`Dimming for ${t.label}`}
                  />
                </label>
                {cur && <button className="btn-quiet btn-sm" onClick={() => void set(t, undefined)}><X size={13} /> Clear</button>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
