import { Search, CalendarDays, BookOpen, MapPin, Clock } from 'lucide-react'
import type { ReactNode } from 'react'

export type SermonMode = 'search' | 'date' | 'series' | 'location' | 'recent'

const MODES: Array<{ id: SermonMode; label: string; Icon: typeof Search }> = [
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'date', label: 'Date', Icon: CalendarDays },
  { id: 'series', label: 'Series', Icon: BookOpen },
  { id: 'location', label: 'Location', Icon: MapPin },
  { id: 'recent', label: 'Recently Played', Icon: Clock }
]

/** One row for every way into the sermons: type to search, or browse by date,
 *  series, location or what was used recently. Replaces the old separate
 *  Search/Browse sub-tab row (one fewer row above the content). */
export default function SermonModeStrip({
  active,
  onSelect,
  tools
}: {
  active: SermonMode
  onSelect: (m: SermonMode) => void
  tools?: ReactNode
}): JSX.Element {
  return (
    <div className="browse-modes">
      <div className="browse-mode-tabs" role="group" aria-label="Find a sermon by">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`browse-mode${active === id ? ' active' : ''}`}
            onClick={() => onSelect(id)}
            aria-pressed={active === id}
          >
            <Icon width={15} height={15} strokeWidth={2} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {tools && <div className="browse-mode-tools">{tools}</div>}
    </div>
  )
}
