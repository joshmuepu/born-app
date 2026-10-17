import VirtualList from './VirtualList'
import type { ScreenItem } from '../../../shared/tapeParagraphs'

/**
 * The big follow-along view in the Tape place: every PAGE of every numbered paragraph, the one being spoken highlighted, the rest quiet.
 * Only the paragraph NUMBER moves the tape (a deliberate handle: reading ahead and clicking in the text never does).
 */
export default function TapeFollowList({ items, currentN, currentIndex, follow, canJump, onJump, onUserScroll }: {
  items: ScreenItem[]
  /** the paragraph number being spoken (null = none yet / not loaded) */
  currentN: number | null
  /** index in `items` of the page being spoken */
  currentIndex: number | null
  follow: boolean
  canJump: boolean
  onJump: (n: number) => void
  onUserScroll: () => void
}): JSX.Element {
  return (
    <VirtualList
      className="tfl"
      items={items}
      estimateSize={120}
      threshold={400}
      gap={4}
      paddingStart={8}
      paddingEnd={40}
      itemKey={(it, i) => `${it.marker}:${i}`}
      focusIndex={follow && currentIndex !== null && currentIndex >= 0 ? currentIndex : null}
      scrollerProps={{
        'aria-label': 'Sermon text, following the tape',
        onWheel: onUserScroll,
        onTouchMove: onUserScroll,
        onPointerDown: (e) => { if (e.target === e.currentTarget) onUserScroll() }
      }}
      renderItem={(it, i) => {
        const cur = currentN !== null && it.n === currentN
        const first = i === 0 || items[i - 1].n !== it.n
        return (
          <div className={`tfl-row${cur ? ' is-cur' : currentN !== null ? ' is-dim' : ''}`} aria-current={cur && i === currentIndex ? 'true' : undefined}>
            <span className="tfl-no">
              {first ? (
                <button className="tfl-jump" disabled={!canJump} onClick={() => onJump(it.n)} aria-label={`Move the tape to paragraph ${it.n}`} title={canJump ? `Move the tape to ¶${it.n}` : 'Load this recording into the player to move it'}>{it.n}</button>
              ) : null}
            </span>
            <p className="tfl-tx" dir="auto">{it.text}</p>
          </div>
        )
      }}
    />
  )
}
