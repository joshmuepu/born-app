import { useState, useEffect, useCallback, useRef } from 'react'
import type { BibleTranslation, ResolvedPassage, BibleSearchHit } from '../types'
import { parseReference, isRefError } from '../../../shared/bibleRef'
import './BiblePanel.css'

interface Props {
  visible: boolean
  onAddPassage: (p: ResolvedPassage) => void
  onProjectPassage: (p: ResolvedPassage, slide?: number) => void
}

type Mode = 'reference' | 'keyword'

export default function BiblePanel({ visible, onAddPassage, onProjectPassage }: Props) {
  const [translations, setTranslations] = useState<BibleTranslation[]>([])
  const [translation, setTranslation] = useState(
    () => localStorage.getItem('born.bibleTranslation') || 'KJV'
  )
  const [mode, setMode] = useState<Mode>('reference')

  const [refInput, setRefInput] = useState('')
  const [passage, setPassage] = useState<ResolvedPassage | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState('')
  const [hits, setHits] = useState<BibleSearchHit[]>([])
  const keywordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loaded = useRef(false)
  useEffect(() => {
    if (!visible || loaded.current) return
    loaded.current = true
    window.electronAPI.getBibleTranslations().then((t) => {
      setTranslations(t)
      if (t.length && !t.some((x) => x.code === translation)) setTranslation(t[0].code)
    })
  }, [visible, translation])

  const parsePreview = refInput.trim() ? parseReference(refInput) : null
  const parseHint =
    parsePreview && isRefError(parsePreview) && refInput.trim().length > 2 ? parsePreview.error : null

  const doLookup = useCallback(
    async (ref: string, trans: string) => {
      const r = ref.trim()
      if (!r) return
      const res = await window.electronAPI.lookupPassage(r, trans)
      if ((res as { error?: string }).error) {
        setPassage(null)
        setLookupError((res as { error: string }).error)
      } else {
        setPassage(res as ResolvedPassage)
        setLookupError(null)
        setRefInput((res as ResolvedPassage).reference)
      }
    },
    []
  )

  const changeTranslation = (code: string): void => {
    setTranslation(code)
    try {
      localStorage.setItem('born.bibleTranslation', code)
    } catch {
      /* ignore */
    }
    if (passage) doLookup(passage.reference, code)
  }

  // keyword search (debounced)
  useEffect(() => {
    if (keywordTimer.current) clearTimeout(keywordTimer.current)
    if (mode !== 'keyword' || keyword.trim().length < 2) {
      setHits([])
      return
    }
    keywordTimer.current = setTimeout(() => {
      window.electronAPI.searchBible(keyword.trim(), translation).then(setHits)
    }, 250)
    return () => {
      if (keywordTimer.current) clearTimeout(keywordTimer.current)
    }
  }, [keyword, translation, mode])

  return (
    <div className="bible-panel">
      <div className="bible-controls">
        <div className="bible-mode">
          <button className={`filter-mode-btn${mode === 'reference' ? ' active' : ''}`} onClick={() => setMode('reference')}>Reference</button>
          <button className={`filter-mode-btn${mode === 'keyword' ? ' active' : ''}`} onClick={() => setMode('keyword')}>Keyword</button>
        </div>
        <select
          className="language-select"
          value={translation}
          onChange={(e) => changeTranslation(e.target.value)}
          title="Translation"
        >
          {translations.length === 0 && <option value={translation}>{translation}</option>}
          {translations.map((t) => (
            <option key={t.code} value={t.code}>{t.code}</option>
          ))}
        </select>
      </div>

      {mode === 'reference' ? (
        <>
          <div className="bible-ref-row">
            <input
              className="search-input"
              placeholder="Reference — e.g. John 3:16, Psalm 23, 1 Cor 13:4-7"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doLookup(refInput, translation) }}
              autoFocus
            />
            <button className="btn-primary" onClick={() => doLookup(refInput, translation)} disabled={!refInput.trim()}>
              Look up
            </button>
          </div>
          {parseHint && <div className="bible-hint">{parseHint}</div>}
          {lookupError && <div className="bible-hint bible-hint--error">{lookupError}</div>}

          {passage && (
            <div className="bible-passage">
              <div className="bible-passage-head">
                <span className="bible-passage-ref">{passage.reference} · {passage.translation}</span>
                <div className="result-actions">
                  <button className="btn-secondary btn-sm" onClick={() => onAddPassage(passage)}>+ Queue</button>
                  <button className="btn-primary btn-sm" onClick={() => onProjectPassage(passage, 0)}>Project</button>
                </div>
              </div>
              <div className="bible-verses">
                {passage.verses.map((v, i) => (
                  <div key={v.verse} className="bible-verse">
                    <span className="bible-verse-num">{v.verse}</span>
                    <span className="bible-verse-text">{v.text}</span>
                    <button
                      className="btn-secondary btn-sm bible-verse-project"
                      title={`Project verse ${v.verse}`}
                      onClick={() => onProjectPassage(passage, passage.slideStarts[i] ?? 0)}
                    >
                      Project
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="bible-ref-row">
            <input
              className="search-input"
              placeholder="Search the Bible for a word or phrase…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="bible-verses">
            {hits.length === 0 && keyword.trim().length >= 2 && (
              <div className="bible-hint">No verses found.</div>
            )}
            {hits.map((h) => (
              <div
                key={`${h.bookNum}-${h.chapter}-${h.verse}`}
                className="bible-verse bible-verse--hit"
                onClick={() => { setMode('reference'); setRefInput(h.reference); doLookup(h.reference, translation) }}
              >
                <span className="bible-verse-ref">{h.reference}</span>
                <span className="bible-verse-text">{h.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
