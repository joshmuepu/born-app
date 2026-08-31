/**
 * bibleText.ts — strip the translators' marginal notes that ride along with the
 * bundled KJV text.
 *
 * bolls.life delivers KJV verses with the 1769 apparatus wrapped in
 * `<sup>…</sup>` — e.g. Genesis 3:8 arrives as
 *   "… amongst the trees of the garden. <sup>cool: Heb. wind</sup>"
 * The library build now drops those tags outright, but installs that already
 * seeded their `library.db` still carry the flattened notes appended to the
 * verse ("… trees of the garden. cool: Heb. wind"). This removes them at read
 * time so only scripture is ever shown or projected.
 *
 * A note always sits at the end of the verse, right after a sentence/clause mark
 * (". " / ": " / "; "), as "<lemma>: <marker> <gloss>" — possibly several in a
 * row. Markers:
 *   - scholarly ("Heb.", "Gr.", "Chald.", "Sept.", "Syriac", …): these never
 *     occur in scripture, so the note is cut with certainty;
 *   - a bare alternative reading ("or,", "That is,"): only cut when it is a
 *     short fragment, so a genuine "… vineyard than it; or, if it seem good to
 *     thee, I will give thee the worth of it in money." is left alone.
 */

const NOTE = new RegExp(
  // ". " / ": " / "; "  +  a short lemma  +  ":"  +  a recognised marker
  String.raw`[.:;]\s+([A-Z]?[a-z][A-Za-z'’-]*(?:\s+[a-z][A-Za-z'’-]*){0,3}):\s+` +
    String.raw`(Heb\.|Gr\.|Chald\.|Chaldee|Sept\.|Syr\.|Syriac|Arab\.|Arabic|Aramaic|Lat\.|or,|Or,|that is,|That is,)`,
  'g'
)

export function stripMarginalNotes(text: string): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  let cut = -1
  for (let m = NOTE.exec(s); m !== null; m = NOTE.exec(s)) {
    const lemmaAt = m.index + m[0].indexOf(m[1])
    const tail = s.slice(lemmaAt)
    const scholarly = /^(?:Heb|Gr|Chald|Chaldee|Sept|Syr|Syriac|Arab|Arabic|Aramaic|Lat)\b/.test(
      m[2]
    )
    // A scholarly marker is always a note. A bare "or,"/"That is," is only a
    // note when its first segment is a short fragment — not a continuing clause.
    const firstSeg = tail.split(/\s+(?=[A-Za-z][A-Za-z'’-]*(?:\s+[a-z'’-]+){0,3}:\s)/)[0]
    if (scholarly || (firstSeg.length <= 45 && !/[.!?]\s+[A-Z]/.test(firstSeg))) {
      cut = lemmaAt
      break
    }
  }
  NOTE.lastIndex = 0
  return (cut >= 0 ? s.slice(0, cut) : s).replace(/\s+([,.;:!?])/g, '$1').trim()
}
