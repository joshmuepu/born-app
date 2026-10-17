import { Flame, CheckCircle2, Circle } from 'lucide-react'
import type { RecentService } from '../types'
import { SERVICE_TEMPLATES } from '../../../shared/serviceTemplates'

/** The first-run checklist (P-12). Absent = the plain start screen. */
export interface SetupSunday {
  projectionOpen: boolean
  /** a template's readings are already in the queue or its screens are chosen: the step shows done */
  screensChosen: boolean
  onScreens: () => void
  onTemplate: (id: string) => void
  onGo: (section: 'songs' | 'bible' | 'sermons') => void
  onDismiss: () => void
}

interface Props {
  recents: RecentService[]
  onOpen: () => void
  onOpenRecent: (path: string) => void
  setup?: SetupSunday | null
}

function whenLabel(mtimeMs: number): string {
  const d = new Date(mtimeMs)
  const days = Math.floor((Date.now() - mtimeMs) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The home screen — what you see before a service is built. Shown in the queue
 * column whenever the queue is empty and nothing is projected; the BORN
 * wordmark brings you back here.
 */
export default function StartScreen({ recents, onOpen, onOpenRecent, setup }: Props) {
  return (
    <div className="start-screen">
      <div className="start-inner">
        <div className="empty-state-icon start-icon">
          <Flame width={20} height={20} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h2 className="start-title">{setup ? 'Set up Sunday' : 'New service'}</h2>
        <p className="start-sub">
          {setup
            ? 'Three steps, in any order. This goes away once your queue has something in it.'
            : 'Add quotes, Bible passages and songs from the left — they line up here in order, ready to project.'}
        </p>

        {setup && (
          <ol className="setup-steps" aria-label="Set up Sunday">
            <li className={setup.screensChosen ? 'is-done' : ''}>
              {setup.screensChosen ? <CheckCircle2 width={18} height={18} aria-hidden="true" /> : <Circle width={18} height={18} aria-hidden="true" />}
              <div>
                <b>Choose your screens</b>
                <small>Pick which display the congregation sees, then press Open projection.</small>
                <button type="button" className="btn-secondary btn-sm" onClick={setup.onScreens}>Open the Screens menu</button>
              </div>
            </li>
            <li>
              <Circle width={18} height={18} aria-hidden="true" />
              <div>
                <b>Add tonight’s items</b>
                <small>Start from a plan, or add your own.</small>
                <div className="setup-templates" role="group" aria-label="Start from a plan">
                  {SERVICE_TEMPLATES.map((t) => (
                    <button key={t.id} type="button" className="setup-template" onClick={() => setup.onTemplate(t.id)} title={t.about}>
                      <span>{t.name}</span>
                      <small>{t.about}</small>
                    </button>
                  ))}
                </div>
                <div className="setup-go">
                  <span>or add your own:</span>
                  <button type="button" className="btn-quiet btn-sm" onClick={() => setup.onGo('songs')}>Songs</button>
                  <button type="button" className="btn-quiet btn-sm" onClick={() => setup.onGo('bible')}>Bible</button>
                  <button type="button" className="btn-quiet btn-sm" onClick={() => setup.onGo('sermons')}>Sermons</button>
                </div>
              </div>
            </li>
            <li>
              <Circle width={18} height={18} aria-hidden="true" />
              <div>
                <b>Check that it is ready</b>
                <small>When the queue has items, press <em>Is tonight ready?</em> at the top of this list.</small>
              </div>
            </li>
          </ol>
        )}

        <div className="start-actions">
          <button className="btn-secondary btn-lg" onClick={onOpen}>
            Open a saved service…
          </button>
        </div>

        {setup && <button type="button" className="btn-quiet btn-sm setup-dismiss" onClick={setup.onDismiss}>Hide this checklist</button>}

        {recents.length > 0 && (
          <div className="start-recents">
            <div className="start-recents-head">Recent</div>
            <ul className="start-recents-list">
              {recents.map((r) => (
                <li key={r.path}>
                  <button className="start-recent" onClick={() => onOpenRecent(r.path)} title={r.path}>
                    <span className="start-recent-name">{r.name}</span>
                    <span className="start-recent-when">{whenLabel(r.mtimeMs)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
