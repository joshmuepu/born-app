/**
 * songMatch.ts — normalizing and comparing songs for duplicate detection
 * when importing a shared queue file. Pure functions, no Electron/DB
 * dependency, so the matching logic itself is testable without mocking
 * better-sqlite3 — the actual library lookups live in main/songs.ts.
 */

/** Lowercase, strip accents, drop punctuation, collapse whitespace — so
 *  "Amazing Grace!", "amazing  grace", and "Amázing Gráce" all compare
 *  equal. Keeps letters and digits from any script (not just ASCII), since
 *  this app's content isn't English-only. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining accents, after NFD decomposition
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeSongTitle(title: string): string {
  return normalize(title)
}

/** All slide text concatenated, normalized the same way as a title — the
 *  exact wording of verse/chorus labels isn't part of "the same lyrics,"
 *  only the words sung. */
export function normalizeLyrics(slides: Array<{ text: string }>): string {
  return normalize(slides.map((s) => s.text).join(' '))
}

function bigramCounts(s: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    counts.set(bg, (counts.get(bg) ?? 0) + 1)
  }
  return counts
}

/** Dice's coefficient over character bigrams — 1.0 for identical text, 0
 *  for completely disjoint text, robust to small edits (a changed word, a
 *  reflowed line break) without the O(n·m) cost of a real edit distance,
 *  which matters when a large shared library means many candidate
 *  comparisons. Normalized text in, so case/accent/punctuation differences
 *  never affect the score at all — only genuine wording differences do. */
export function lyricsSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigramsA = bigramCounts(a)
  const bigramsB = bigramCounts(b)
  let intersection = 0
  for (const [bg, countA] of bigramsA) {
    const countB = bigramsB.get(bg)
    if (countB) intersection += Math.min(countA, countB)
  }
  const totalA = a.length - 1
  const totalB = b.length - 1
  return (2 * intersection) / (totalA + totalB)
}

/** Above this, two songs with the same normalized title are treated as
 *  "the same song" (link, don't add a copy) rather than a conflict. Picked
 *  to tolerate a reflowed line break or one or two words changed by a
 *  transcription difference, while still flagging a genuinely rewritten
 *  verse or a different song that happens to share a title. A judgment
 *  call — if real use shows it's too strict or too loose, this is the one
 *  number to tune. */
export const SAME_SONG_THRESHOLD = 0.9

export type SongMatchStatus = 'new' | 'matched' | 'conflict'

export interface LibrarySongForMatch {
  id: number
  title: string
  normalizedTitle: string
  normalizedLyrics: string
}

export interface SongToMatch {
  /** Caller's own correlation id (e.g. the queue item's id) — matchSongs
   *  doesn't need to know what a "queue item" is. */
  key: string
  title: string
  author?: string
  songKey?: string
  slides: Array<{ text: string; label?: string }>
}

export type SongMatchResult =
  | { key: string; status: 'matched'; songId: number }
  | { key: string; status: 'new'; groupId: string }
  | { key: string; status: 'conflict'; groupId: string; existingSongId: number; existingTitle: string }

/** One group of (possibly several, deduped-within-the-file) incoming songs
 *  the operator chose to add as a real library song — sent to
 *  commitSongImportDecisions, which inserts exactly one song per group. */
export interface SongGroupToAdd {
  groupId: string
  title: string
  author?: string
  songKey?: string
  slides: Array<{ text: string; label?: string }>
}

export type CommitSongImportResult =
  | { ok: true; added: Array<{ groupId: string; songId: number }> }
  | { ok: false; error: string }

/** Resolves each incoming song against the existing library, AND against
 *  the other incoming songs in the same batch — two queue items for "the
 *  same" song (duplicated within one shared file) must resolve to the one
 *  `groupId`, so they add as a single new library song, not two.
 *
 *  Building one title→candidates index up front (O(library size) once,
 *  not once per incoming song) is what keeps this fast against a large
 *  library: the expensive bigram comparison only ever runs against
 *  candidates that already share a normalized title, which in practice is
 *  a small number even in a library with thousands of songs. */
export function matchSongs(
  incoming: SongToMatch[],
  library: LibrarySongForMatch[]
): SongMatchResult[] {
  const byTitle = new Map<string, LibrarySongForMatch[]>()
  for (const song of library) {
    const list = byTitle.get(song.normalizedTitle)
    if (list) list.push(song)
    else byTitle.set(song.normalizedTitle, [song])
  }

  // Groups of incoming songs resolved as "new," keyed by normalized title —
  // so a second occurrence of the same new song within this one file joins
  // the first's group instead of becoming its own separate addition.
  const newGroupsByTitle = new Map<string, { groupId: string; normalizedLyrics: string }[]>()
  let groupCounter = 0

  const results: SongMatchResult[] = []
  for (const song of incoming) {
    const normalizedTitle = normalizeSongTitle(song.title)
    const normalizedLyrics = normalizeLyrics(song.slides)
    const candidates = byTitle.get(normalizedTitle) ?? []

    let best: { candidate: LibrarySongForMatch; score: number } | null = null
    for (const candidate of candidates) {
      const score = lyricsSimilarity(normalizedLyrics, candidate.normalizedLyrics)
      if (!best || score > best.score) best = { candidate, score }
    }

    if (best && best.score >= SAME_SONG_THRESHOLD) {
      results.push({ key: song.key, status: 'matched', songId: best.candidate.id })
      continue
    }

    if (best) {
      // Same title, different enough lyrics — a real conflict. Still check
      // whether an earlier incoming song already opened a "new" group for
      // this exact title+lyrics (two copies of the leader's own rewritten
      // version inside one file) before minting a fresh group.
      const existingGroup = (newGroupsByTitle.get(normalizedTitle) ?? []).find(
        (g) => lyricsSimilarity(g.normalizedLyrics, normalizedLyrics) >= SAME_SONG_THRESHOLD
      )
      if (existingGroup) {
        results.push({
          key: song.key,
          status: 'conflict',
          groupId: existingGroup.groupId,
          existingSongId: best.candidate.id,
          existingTitle: best.candidate.title
        })
        continue
      }
      const groupId = `g${++groupCounter}`
      const list = newGroupsByTitle.get(normalizedTitle) ?? []
      list.push({ groupId, normalizedLyrics })
      newGroupsByTitle.set(normalizedTitle, list)
      results.push({
        key: song.key,
        status: 'conflict',
        groupId,
        existingSongId: best.candidate.id,
        existingTitle: best.candidate.title
      })
      continue
    }

    // No title match in the library at all — new, but still dedupe against
    // other new songs already seen in this same file.
    const existingGroup = (newGroupsByTitle.get(normalizedTitle) ?? []).find(
      (g) => lyricsSimilarity(g.normalizedLyrics, normalizedLyrics) >= SAME_SONG_THRESHOLD
    )
    if (existingGroup) {
      results.push({ key: song.key, status: 'new', groupId: existingGroup.groupId })
      continue
    }
    const groupId = `g${++groupCounter}`
    const list = newGroupsByTitle.get(normalizedTitle) ?? []
    list.push({ groupId, normalizedLyrics })
    newGroupsByTitle.set(normalizedTitle, list)
    results.push({ key: song.key, status: 'new', groupId })
  }
  return results
}
