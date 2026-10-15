import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon } from 'lucide-react'
import './DrillShell.css'

/** Shared "Finder" drill-down frame for Sermons, Bible and Songs: browse
 *  columns on the left, the content (sermon text, chapter, lyrics) in a large
 *  pane on the right, and a handle that slides the columns away. Below
 *  ~760px of panel width it stacks into one column (see DrillShell.css). */
export type BrowseView = 'grid' | 'list'
const VIEW_KEY = 'born.browseView'

function readView(): BrowseView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

/** The operator's grid/list choice — one preference shared by every browser. */
export function useBrowseView(): [BrowseView, (v: BrowseView) => void] {
  const [view, setView] = useState<BrowseView>(readView)
  const choose = useCallback((v: BrowseView) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }, [])
  return [view, choose]
}

/** "\" slides the browse columns away / back while `active`. */
export function useBackslashToggle(active: boolean, toggle: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== '\\' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, toggle])
}

export function ViewToggle({
  view,
  onChange
}: {
  view: BrowseView
  onChange: (v: BrowseView) => void
}): JSX.Element {
  return (
    <div className="browse-view-toggle" role="group" aria-label="Browse view">
      <button
        className={view === 'grid' ? 'active' : ''}
        onClick={() => onChange('grid')}
        aria-pressed={view === 'grid'}
        title="Grid view"
        aria-label="Grid view"
      >
        <LayoutGrid width={15} height={15} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        className={view === 'list' ? 'active' : ''}
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        title="List view"
        aria-label="List view"
      >
        <ListIcon width={15} height={15} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}

interface Props {
  left: ReactNode
  right: ReactNode
  /** Something is open in the right pane (drives the narrow-window stack). */
  open: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  leftClassName?: string
  rightClassName?: string
}

export default function DrillShell({
  left,
  right,
  open,
  collapsed,
  onToggleCollapsed,
  leftClassName = '',
  rightClassName = ''
}: Props): JSX.Element {
  return (
    <div className="drill" data-open={open ? 'true' : 'false'} data-collapsed={collapsed}>
      <div className={`drill-left ${leftClassName}`.trim()}>{left}</div>
      <div className="drill-seam">
        <button
          className="drill-handle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Show browse columns' : 'Hide browse columns'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show browse columns ( \\ )' : 'Hide browse columns ( \\ )'}
        >
          {collapsed ? (
            <ChevronRight width={14} height={14} strokeWidth={2.4} />
          ) : (
            <ChevronLeft width={14} height={14} strokeWidth={2.4} />
          )}
        </button>
      </div>
      <div className={`drill-right ${rightClassName}`.trim()}>{right}</div>
    </div>
  )
}
