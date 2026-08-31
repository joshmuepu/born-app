import type { RecentService } from '../types'

interface Props {
  recents: RecentService[]
  onNew: () => void
  onOpen: () => void
  onOpenRecent: (path: string) => void
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
export default function StartScreen({ recents, onNew, onOpen, onOpenRecent }: Props) {
  return (
    <div className="start-screen">
      <div className="start-inner">
        <h2 className="start-title">Start a service</h2>
        <p className="start-sub">Build a queue of quotes, Bible passages and songs, then project them.</p>

        <div className="start-actions">
          <button className="btn-primary btn-lg start-primary" onClick={onNew}>
            + New service
          </button>
          <button className="btn-secondary btn-lg" onClick={onOpen}>
            Open a saved service…
          </button>
        </div>

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
