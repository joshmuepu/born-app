import type { MenuItem } from './components/ContextMenu'
import type { Quote } from './types'
import type { AppActions } from './AppActions'
import { copyText } from './AppActions'
import { favId, toggleFavorite, loadFavorites, type Favorite } from './favorites'

/** Menu items shared by every place a sermon paragraph, verse or song shows up
 *  — the same words and order everywhere, so the menu is learned once. */

const isFav = (id: string): boolean => loadFavorites().some((f) => f.id === id)

async function copy(text: string, what: string, a: AppActions): Promise<void> {
  a.notify((await copyText(text)) ? `Copied ${what}` : `Couldn't copy ${what}`)
}

function favItem(fav: Favorite, label: string, a: AppActions): MenuItem {
  const on = isFav(fav.id)
  return {
    id: 'favorite',
    label: on ? `Remove ${label} from favorites` : `Favorite ${label}`,
    onSelect: () => {
      const nowOn = toggleFavorite(fav)
      a.notify(nowOn ? 'Added to favorites' : 'Removed from favorites')
    }
  }
}

export function quoteMenu(
  q: Quote,
  h: {
    actions: AppActions
    project?: () => void
    addToQueue?: () => void
    openSermon?: boolean
  }
): MenuItem[] {
  const ref = `${q.sermonTitle} ${q.dateCode} ¶${q.paragraphRef}`
  const items: MenuItem[] = []
  if (h.project) items.push({ id: 'project', label: 'Show now', onSelect: h.project })
  if (h.addToQueue) items.push({ id: 'queue', label: 'Add to queue', onSelect: h.addToQueue })
  items.push({
    id: 'next',
    label: 'Add next in queue',
    hint: 'after what is live',
    onSelect: () => h.actions.addNext({ type: 'quote', quote: q })
  })
  if (h.openSermon !== false) {
    items.push({
      id: 'open',
      label: 'Open the whole sermon here',
      separatorBefore: true,
      onSelect: () => h.actions.openSermon(q.sermonId, q.paragraphRef)
    })
  }
  items.push(
    favItem(
      {
        id: favId.sermon(q.sermonId, q.paragraphRef),
        kind: 'sermon',
        title: q.sermonTitle,
        subtitle: `${q.dateCode} · ¶${q.paragraphRef}`,
        quote: q
      },
      'this paragraph',
      h.actions
    )
  )
  items.push({ id: 'copy', label: 'Copy reference', onSelect: () => void copy(ref, 'the reference', h.actions) })
  items.push({
    id: 'copytext',
    label: 'Copy the text',
    onSelect: () => void copy(q.text.replace(/^\s*\d+(?:[-–]\d+)?\s+/, ''), 'the text', h.actions)
  })
  return items
}

export function verseMenu(
  v: { reference: string; bookNum: number; chapter: number; verse: number; text?: string },
  h: { actions: AppActions; project?: () => void; addToQueue?: () => void; openChapter?: boolean }
): MenuItem[] {
  const items: MenuItem[] = []
  if (h.project) items.push({ id: 'project', label: 'Show now', onSelect: h.project })
  if (h.addToQueue) items.push({ id: 'queue', label: 'Add to queue', onSelect: h.addToQueue })
  items.push({
    id: 'next',
    label: 'Add next in queue',
    hint: 'after what is live',
    onSelect: () => h.actions.addNext({ type: 'bible', reference: v.reference })
  })
  if (h.openChapter !== false) {
    items.push({
      id: 'open',
      label: 'Open the chapter here',
      separatorBefore: true,
      onSelect: () => h.actions.openVerse({ bookNum: v.bookNum, chapter: v.chapter, verse: v.verse })
    })
  }
  items.push(
    favItem(
      {
        id: favId.verse(v.bookNum, v.chapter, v.verse),
        kind: 'verse',
        title: v.reference,
        subtitle: v.text ? v.text.slice(0, 80) : 'Bible',
        reference: v.reference,
        bookNum: v.bookNum,
        chapter: v.chapter,
        verse: v.verse
      },
      'this verse',
      h.actions
    )
  )
  items.push({ id: 'copy', label: 'Copy reference', onSelect: () => void copy(v.reference, 'the reference', h.actions) })
  if (v.text) {
    items.push({
      id: 'copytext',
      label: 'Copy the text',
      onSelect: () => void copy(`${v.text} — ${v.reference}`, 'the verse', h.actions)
    })
  }
  return items
}

export function songMenu(
  s: { id: number; title: string },
  h: { actions: AppActions; project?: () => void; addToQueue?: () => void }
): MenuItem[] {
  const items: MenuItem[] = []
  if (h.project) items.push({ id: 'project', label: 'Show now', onSelect: h.project })
  if (h.addToQueue) items.push({ id: 'queue', label: 'Add to queue', onSelect: h.addToQueue })
  items.push({
    id: 'next',
    label: 'Add next in queue',
    hint: 'after what is live',
    onSelect: () => h.actions.addNext({ type: 'song', songId: s.id })
  })
  items.push(
    favItem(
      { id: favId.song(s.id), kind: 'song', title: s.title, subtitle: 'Song', songId: s.id },
      'this song',
      h.actions
    )
  )
  items.push({ id: 'copy', label: 'Copy title', onSelect: () => void copy(s.title, 'the title', h.actions) })
  return items
}
