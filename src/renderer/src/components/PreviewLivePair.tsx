import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, EyeOff, Eye, X } from 'lucide-react'
import type {
  ChannelInfo,
  LiveChannel,
  ObservabilityChannel,
  OutputInfo,
  SlidePayload
} from '../types'
import SlideThumb from './SlideThumb'
import VideoBar from './VideoBar'
import './PreviewLivePair.css'

/** How often the pair re-reads the output state on its own. Pushes arrive on
 *  every change; this only exists so a missed event can never leave the
 *  thumbnails showing something the output isn't. */
const RECONCILE_MS = 2500

/** The authoritative per-channel output state, straight from the main
 *  process: pushed on change, re-read on a timer and when the window regains
 *  focus. The renderer's own idea of "what's projected" is never consulted. */
export function useLiveState(): LiveChannel[] {
  const [live, setLive] = useState<LiveChannel[]>([])
  const alive = useRef(true)
  const pull = useCallback(() => {
    window.electronAPI
      .getLiveState()
      .then((l) => {
        if (alive.current) setLive(l)
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    alive.current = true
    pull()
    const off = window.electronAPI.onLiveChanged((l) => {
      if (alive.current) setLive(l)
    })
    const t = window.setInterval(pull, RECONCILE_MS)
    window.addEventListener('focus', pull)
    return () => {
      alive.current = false
      off()
      window.clearInterval(t)
      window.removeEventListener('focus', pull)
    }
  }, [pull])
  return live
}

function useDestinations(channelId: string): ObservabilityChannel | null {
  const [snap, setSnap] = useState<ObservabilityChannel[]>([])
  useEffect(() => {
    let alive = true
    const pull = (): void => {
      window.electronAPI
        .getObservability()
        .then((s) => alive && setSnap(s))
        .catch(() => {})
    }
    pull()
    const t = window.setInterval(pull, 4000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])
  return snap.find((c) => c.id === channelId) ?? null
}

export interface PreviewLivePairProps {
  channels: ChannelInfo[]
  outputs: OutputInfo[]
  fontSize: number
  /** Main channel only. A queue item the operator has staged (clicked) but not
   *  taken — never changes what is live on its own. */
  stagedPayload: SlidePayload | null
  stagedTitle: string | null
  /** What Next will bring up on Main (flow-through included). */
  nextPayload: SlidePayload | null
  /** The main congregation output's still background (for the Preview thumbnail). */
  background?: import('../../../shared/media').SlideBackground | null
  projectionOpen: boolean
  canTake: boolean
  onTake: () => void
  onUnstage: () => void
  /** Black the main screen out / bring it back (position is kept). */
  onToggleBlank: () => void
  onClearChannel: (channelId: string) => void
}

function slideTitle(s: SlidePayload | null): string {
  if (!s) return ''
  const parts = [s.label, s.reference].filter(Boolean)
  return parts.join(' · ')
}

export default function PreviewLivePair({
  channels,
  outputs,
  fontSize,
  stagedPayload,
  stagedTitle,
  nextPayload,
  background,
  projectionOpen,
  canTake,
  onTake,
  onUnstage,
  onToggleBlank,
  onClearChannel
}: PreviewLivePairProps): JSX.Element {
  const live = useLiveState()
  const [channelId, setChannelId] = useState('main')
  // A channel that was removed falls back to Main instead of showing nothing.
  const selected = channels.find((c) => c.id === channelId) ?? channels.find((c) => c.id === 'main')
  const id = selected?.id ?? 'main'
  const isMain = id === 'main'
  const lc = live.find((c) => c.id === id) ?? null
  const dest = useDestinations(id)

  const liveSlide = lc?.current ?? null
  const blanked = lc?.blanked ?? false
  // What the congregation screen will draw behind text: Preview shows it too, so what you stage is what you get.
  const withBg = (s: SlidePayload | null): SlidePayload | null =>
    s && s.kind !== 'media' && isMain && background && !s.background ? { ...s, background } : s
  const previewSlide = withBg(isMain ? (stagedPayload ?? nextPayload ?? lc?.next ?? null) : (lc?.next ?? null))
  const staged = isMain && !!stagedPayload

  // Flash the LIVE frame when new content lands — the visual "it went out".
  const sig = liveSlide ? `${liveSlide.reference ?? ''}|${liveSlide.marker ?? ''}|${liveSlide.text}` : ''
  const [flash, setFlash] = useState(0)
  const lastSig = useRef(sig)
  useEffect(() => {
    if (sig && sig !== lastSig.current) setFlash((n) => n + 1)
    lastSig.current = sig
  }, [sig])

  const channelOutputs = outputs.filter((o) => o.channelId === id)
  const graphics = channelOutputs.filter((o) => o.kind === 'browser')
  const syncNote =
    !isMain && selected
      ? selected.sync.syncMode === 'follow'
        ? 'Follows Main automatically'
        : selected.sync.syncMode === 'linked'
          ? 'Linked to Main'
          : 'Independent of Main'
      : null

  return (
    <section className="plp" aria-label="Preview and Live">
      {channels.length > 1 && (
        <div className="plp-channels" role="tablist" aria-label="Channel">
          {channels.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === id}
              className={`plp-channel${c.id === id ? ' is-active' : ''}`}
              onClick={() => setChannelId(c.id)}
            >
              {c.id === 'main' ? 'Main' : c.label}
            </button>
          ))}
        </div>
      )}

      <div className="plp-pair">
        <div className="plp-cell plp-cell--preview">
          <div className="plp-head">
            <span className="plp-tag">Preview</span>
            {staged && (
              <button className="plp-unstage" onClick={onUnstage} title="Unstage — go back to what Next will bring up" aria-label="Unstage">
                <X width={11} height={11} strokeWidth={2.6} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className={`plp-frame plp-frame--preview${staged ? ' is-staged' : ''}`}>
            <SlideThumb slide={previewSlide} fontSize={fontSize} emptyLabel={isMain ? 'Nothing staged' : 'Nothing next'} />
          </div>
          <div className="plp-title" title={staged ? stagedTitle ?? undefined : slideTitle(previewSlide)}>
            {staged ? stagedTitle : previewSlide ? `Next · ${slideTitle(previewSlide)}` : 'Nothing queued next'}
          </div>
        </div>

        <div className="plp-arrow" aria-hidden="true">
          <ChevronRight width={18} height={18} strokeWidth={2.4} />
        </div>

        <div className="plp-cell plp-cell--live">
          <div className="plp-head">
            <span className={`plp-tag plp-tag--live${liveSlide && !blanked ? ' is-on' : ''}`}>
              <span className="plp-dot" aria-hidden="true" />
              Live
            </span>
            {blanked && <span className="plp-hidden">Hidden</span>}
          </div>
          <div
            key={flash}
            className={`plp-frame plp-frame--live${liveSlide && !blanked ? ' is-on' : ''}${flash > 0 ? ' just-went' : ''}`}
          >
            <SlideThumb
              slide={liveSlide}
              blanked={blanked}
              fontSize={fontSize}
              emptyLabel={projectionOpen || !isMain ? 'Nothing live' : 'Projection closed'}
            />
          </div>
          <div className="plp-title" title={slideTitle(liveSlide)}>
            {liveSlide ? slideTitle(liveSlide) || 'On screen' : 'Nothing on screen'}
          </div>
        </div>
      </div>

      {liveSlide?.kind === 'media' && (liveSlide.media?.type === 'video' || liveSlide.media?.type === 'youtube') && !blanked && <VideoBar key={liveSlide.media.mediaId} channelId={id} mediaId={liveSlide.media.mediaId} online={liveSlide.media.type === 'youtube'} />}

      <div className="plp-actions">
        {isMain ? (
          <>
            <button
              className="btn-primary btn-sm plp-take"
              onClick={onTake}
              disabled={!canTake}
              title={staged ? 'Show the staged item' : 'Show what Next will bring up'}
            >
              Show{staged ? '' : ' next'}
            </button>
            <button
              className={`btn-secondary btn-sm plp-clear${blanked ? ' is-hidden' : ''}`}
              onClick={onToggleBlank}
              disabled={!projectionOpen}
              title={blanked ? 'Bring the screen back' : 'Black out the screen — your place is kept'}
            >
              {blanked ? <Eye width={13} height={13} strokeWidth={2.2} aria-hidden="true" /> : <EyeOff width={13} height={13} strokeWidth={2.2} aria-hidden="true" />}
              {blanked ? 'Show screen' : 'Hide screen'}
            </button>
          </>
        ) : (
          <button
            className="btn-secondary btn-sm plp-clear"
            onClick={() => onClearChannel(id)}
            disabled={!liveSlide}
            title="Clear this channel's output (it refills from Main on the next slide if it follows)"
          >
            <EyeOff width={13} height={13} strokeWidth={2.2} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <div className="plp-dests" aria-label="Where this channel is showing">
        {(dest?.destinations ?? []).map((d) => (
          <span
            key={d.id}
            className={`plp-dest${d.connected ? ' is-up' : ''}${d.warning ? ' is-warn' : ''}`}
            title={d.warning ?? (d.connected ? 'Connected' : 'Not connected')}
          >
            <span className="plp-dest-dot" aria-hidden="true" />
            {d.label.replace('Congregation Screen', 'Congregation')}
          </span>
        ))}
        {!dest && graphics.length > 0 && <span className="plp-dest">Graphics</span>}
        {syncNote && <span className="plp-sync">{syncNote}</span>}
      </div>
    </section>
  )
}
