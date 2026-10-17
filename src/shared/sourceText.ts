/**
 * sourceText.ts — the sermon text comes from a source whose paragraphs begin with a private-use symbol (U+F6E1 …): no font has a picture for it, so the reader, the projector, the
 * phone and OBS all showed an empty box ("▯ Let us bow our heads"). It is removed where the text is READ (the stored text is untouched), so every screen sees the same clean words.
 */
const PRIVATE_USE = /[-]/g
export function cleanSourceText(s: string): string {
  if (!s || !PRIVATE_USE.test(s)) return s
  PRIVATE_USE.lastIndex = 0
  return s.replace(/^[-]+\s*/, '').replace(PRIVATE_USE, '').replace(/ {2,}/g, ' ')
}
