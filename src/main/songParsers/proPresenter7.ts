/**
 * proPresenter7.ts — extract lyrics + section structure from a ProPresenter 7
 * (.pro) file.
 *
 * .pro files are protobuf. We decode the wire format schema-lessly (see
 * ./protobuf.ts) and pull out:
 *   Presentation.name          (field 3)
 *   Presentation.cue_groups    (field 12)  → Group.name (field 2) = "Verse 1", "Chorus"
 *   Presentation.cues          (field 13)  → each cue's RTF slide text
 *   Presentation.selected_arrangement / arrangements (10 / 11) → slide order
 * and fall back to a raw {\rtf …} scan if the structure can't be read.
 */
import type { ParsedSong, ParsedSongSlide } from '../../shared/song'
import { cleanLyricText } from '../../shared/song'
import { rtfToText } from './rtfToText'
import { decodeMessage, subs, str } from './protobuf'

/** Pull each top-level {\rtf …} block out of a byte range (brace-matched). */
function extractRtfBlocks(bin: string): string[] {
  const blocks: string[] = []
  let idx = 0
  while (true) {
    const start = bin.indexOf('{\\rtf', idx)
    if (start === -1) break
    let depth = 0
    let end = -1
    for (let i = start; i < bin.length; i++) {
      const c = bin[i]
      if (c === '\\') {
        i++
        continue
      }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end === -1) break
    blocks.push(bin.slice(start, end + 1))
    idx = end + 1
  }
  return blocks
}

/** A lone chord/key label like "G" or "Bbm" that ProPresenter stores as its own small RTF run. */
const KEY_ONLY = /^[A-G][#b♭♯]?m?$/

function rtfTextFrom(buf: Buffer): string {
  const bin = buf.toString('latin1')
  return extractRtfBlocks(bin)
    .map((b) => cleanLyricText(rtfToText(b)))
    .filter((t) => t.length > 0 && !KEY_ONLY.test(t))
    .join('\n\n')
}

/** UUID message: field 1 = the uuid string. */
function uuidString(buf: Buffer): string | undefined {
  return str(decodeMessage(buf), 1)
}

/** ProPresenter's default / placeholder group names carry no meaning. */
const GENERIC_GROUP = /^(group|default|untitled|section|slide|new group|blank)$/i

function titleCaseLabel(name: string): string | undefined {
  const t = name.trim()
  if (!t || GENERIC_GROUP.test(t) || /^\d+$/.test(t)) return undefined
  const m = /^([a-zA-Z][a-zA-Z ]*?)\s*(\d+)?$/.exec(t)
  if (!m) return t
  return m[2] ? `${cap(m[1].trim())} ${m[2]}` : cap(m[1].trim())
}
const cap = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase())

interface StructuredResult {
  name?: string
  songKey?: string
  slides: ParsedSongSlide[]
}

function parseStructured(buf: Buffer): StructuredResult | null {
  let pres: ReturnType<typeof decodeMessage>
  try {
    pres = decodeMessage(buf)
  } catch {
    return null
  }

  // cues: uuid → rtf text
  const cueText = new Map<string, string>()
  for (const cueBuf of subs(pres, 13)) {
    const cue = decodeMessage(cueBuf)
    const uuidBuf = subs(cue, 1)[0]
    const uuid = uuidBuf ? uuidString(uuidBuf) : undefined
    const text = rtfTextFrom(cueBuf)
    if (uuid && text) cueText.set(uuid, text)
  }
  if (cueText.size === 0) return null

  // cue groups in document order (= the default arrangement). A generic /
  // placeholder group name is treated as unnamed.
  const groups: Array<{ name?: string; cueIds: string[] }> = []
  for (const cgBuf of subs(pres, 12)) {
    const cg = decodeMessage(cgBuf)
    const groupBuf = subs(cg, 1)[0]
    const name = groupBuf ? titleCaseLabel(str(decodeMessage(groupBuf), 2) ?? '') : undefined
    const cueIds = subs(cg, 2)
      .map(uuidString)
      .filter((x): x is string => !!x)
    groups.push({ name, cueIds })
  }
  if (groups.length === 0) return null

  // A named group keeps its name (on the first slide of the section; the rest of
  // its cues are continuation slides). Unnamed groups are numbered "Verse N",
  // and each cue of an unnamed group is its own "Verse N".
  const slides: ParsedSongSlide[] = []
  let verseNo = 0
  for (const g of groups) {
    g.cueIds.forEach((cid, i) => {
      const text = cueText.get(cid)
      if (!text) return
      let label: string | undefined
      if (g.name) label = i === 0 ? g.name : undefined
      else {
        verseNo++
        label = `Verse ${verseNo}`
      }
      slides.push({ label, text })
    })
  }
  if (slides.length === 0) {
    for (const [, text] of cueText) slides.push({ text })
  }

  // Presentation.music_key (field 22) — often empty; fall back to any key-only RTF run.
  let songKey = str(pres, 22)?.trim()
  if (!songKey) {
    const bin = buf.toString('latin1')
    for (const b of extractRtfBlocks(bin)) {
      const t = cleanLyricText(rtfToText(b))
      if (KEY_ONLY.test(t)) {
        songKey = t
        break
      }
    }
  }

  return { name: str(pres, 3), songKey: songKey || undefined, slides }
}

export function parseProPresenter7(
  buf: Buffer,
  fallbackTitle = 'Untitled',
  fallbackKey?: string
): ParsedSong {
  const structured = parseStructured(buf)
  if (structured && structured.slides.length > 0) {
    return {
      title: fallbackTitle || structured.name || 'Untitled',
      songKey: structured.songKey ?? fallbackKey,
      slides: structured.slides
    }
  }

  // Last resort: unlabeled raw RTF-block scan.
  const bin = buf.toString('latin1')
  const slides = extractRtfBlocks(bin)
    .map((b) => cleanLyricText(rtfToText(b)))
    .filter((t) => t.length > 0 && !KEY_ONLY.test(t))
    .map((text) => ({ text }))
  return { title: fallbackTitle || 'Untitled', songKey: fallbackKey, slides }
}
