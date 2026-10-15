import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, CornerDownLeft } from 'lucide-react'
import type { Quote, SongSummary, BibleSearchHit, ResolvedPassage } from '../types'
import './CommandPalette.css'

export interface PaletteCommand {
  id: string
  label: string
  /** Extra words that should also match (e.g. "dark mode" for the theme toggle). */
  keywords?: string
  hint?: string
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  commands: PaletteCommand[]
  translation: string
  /** Navigation only — the palette never projects or queues anything, so a
   *  stray Enter can't put the wrong thing on the wall. */
  onOpenSermon: (quote: Quote) => void
  onOpenSong: (songId: number) => void
  onOpenVerse: (v: { bookNum: number; chapter: number; verse: number }) => void
}

type Group = 'Actions' | 'Verse' | 'Sermons' | 'Songs' | 'Bible text'
interface Item {
  id: string
  group: Group
  title: string
  sub?: string
  hint?: string
  run: () => void
}

const GROUP_ORDER: Group[] = ['Verse', 'Actions', 'Sermons', 'Songs', 'Bible text']

function matches(c: PaletteCommand, q: string): boolean {
  const hay = `${c.label} ${c.keywords ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}

export default function CommandPalette({
  open,
  onClose,
  commands,
  translation,
  onOpenSermon,
  onOpenSong,
  onOpenVerse
}: Props): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [verse, setVerse] = useState<ResolvedPassage | null>(null)
  const [sermons, setSermons] = useState<Quote[]>([])
  const [songs, setSongs] = useState<SongSummary[]>([])
  const [bibleHits, setBibleHits] = useState<BibleSearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      inputRef.current?.focus()
    }
  }, [open])

  // One global search across the verse reference, sermons, songs and Bible text.
  useEffect(() => {
    const q = query.trim()
    const mine = ++seq.current
    if (!open || q.length < 2) {
      setVerse(null)
      setSermons([])
      setSongs([])
      setBibleHits([])
      setBusy(false)
      return
    }
    setBusy(true)
    const t = window.setTimeout(async () => {
      const api = window.electronAPI
      const [v, sm, sg, bb] = await Promise.all([
        api
          .lookupPassage(q, translation)
          .then((r) => (r && !(r as { error?: string }).error ? (r as ResolvedPassage) : null))
          .catch(() => null),
        q.length >= 3 ? api.searchSermons(q).catch(() => [] as Quote[]) : Promise.resolve([] as Quote[]),
        api.searchSongs(q).catch(() => [] as SongSummary[]),
        q.length >= 4 ? api.searchBible(q, translation, 'phrase').catch(() => [] as BibleSearchHit[]) : Promise.resolve([] as BibleSearchHit[])
      ])
      if (mine !== seq.current) return
      setVerse(v)
      setSermons(sm.slice(0, 6))
      setSongs(sg.slice(0, 6))
      setBibleHits(bb.slice(0, 5))
      setBusy(false)
    }, 200)
    return () => window.clearTimeout(t)
  }, [query, open, translation])

  const items: Item[] = useMemo(() => {
    const out: Item[] = []
    const q = query.trim()
    if (verse) {
      out.push({
        id: 'verse',
        group: 'Verse',
        title: `${verse.reference} · ${verse.translation}`,
        sub: verse.verses
          .map((v) => v.text)
          .join(' ')
          .slice(0, 140),
        hint: 'Open',
        run: () => onOpenVerse({ bookNum: verse.bookNum, chapter: verse.chapter, verse: verse.verseStart })
      })
    }
    for (const c of commands) {
      if (!q || matches(c, q)) {
        out.push({ id: 'cmd:' + c.id, group: 'Actions', title: c.label, hint: c.hint, run: c.run })
      }
    }
    sermons.forEach((s, i) =>
      out.push({
        id: `sermon:${i}`,
        group: 'Sermons',
        title: s.sermonTitle,
        sub: `${s.dateCode} · ¶${s.paragraphRef} — ${s.text.slice(0, 110)}`,
        hint: 'Open',
        run: () => onOpenSermon(s)
      })
    )
    songs.forEach((s) =>
      out.push({
        id: `song:${s.id}`,
        group: 'Songs',
        title: s.title,
        hint: 'Open',
        run: () => onOpenSong(s.id)
      })
    )
    bibleHits.forEach((h) =>
      out.push({
        id: `bible:${h.reference}`,
        group: 'Bible text',
        title: `${h.reference} · ${h.translation}`,
        sub: h.text.slice(0, 120),
        hint: 'Open',
        run: () => onOpenVerse({ bookNum: h.bookNum, chapter: h.chapter, verse: h.verse })
      })
    )
    // Stable group order.
    return GROUP_ORDER.flatMap((g) => out.filter((i) => i.group === g))
  }, [query, verse, commands, sermons, songs, bibleHits, onOpenSermon, onOpenSong, onOpenVerse])

  useEffect(() => {
    setCursor(0)
  }, [items.length, query])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const choose = (item: Item | undefined): void => {
    if (!item) return
    onClose()
    item.run()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(items[cursor])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  let lastGroup: Group | null = null
  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-input-row">
          <Search width={16} height={16} strokeWidth={2} aria-hidden="true" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search sermons, Bible, songs — or type an action, or John 3:16"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[cursor] ? `pal-${items[cursor].id}` : undefined}
            spellCheck={false}
          />
          {busy && <span className="palette-busy" aria-hidden="true" />}
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && (
            <div className="palette-empty">
              {query.trim().length < 2 ? 'Start typing to search everything.' : busy ? 'Searching…' : 'Nothing found.'}
            </div>
          )}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <div key={it.id}>
                {head && <div className="palette-group">{head}</div>}
                <div
                  id={`pal-${it.id}`}
                  role="option"
                  aria-selected={i === cursor}
                  data-active={i === cursor}
                  className={`palette-item palette-item--${it.group === 'Bible text' || it.group === 'Verse' ? 'bible' : it.group.toLowerCase()}`}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => choose(it)}
                >
                  <span className="palette-item-main">
                    <span className="palette-item-title">{it.title}</span>
                    {it.sub && <span className="palette-item-sub">{it.sub}</span>}
                  </span>
                  {i === cursor && (
                    <span className="palette-item-hint">
                      {it.hint ?? 'Run'} <CornerDownLeft width={12} height={12} aria-hidden="true" />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
          <span className="palette-foot-note">Opens only — never projects</span>
        </div>
      </div>
    </div>
  )
}
