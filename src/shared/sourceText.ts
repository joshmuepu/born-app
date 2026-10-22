/**
 * sourceText.ts — the sermon text comes from a source whose paragraphs often begin with a private-use symbol (U+F6E1):
 * no font has a picture for it, so the reader, the projector and the phone all showed an empty box ("▯ Let us bow our
 * heads"). It is removed where the text is READ for display; the stored text and the search index are never changed.
 * Text that does not contain a private-use symbol comes back as the very same string.
 */
const HAS_PRIVATE_USE = /[-]/
const ALL_PRIVATE_USE = /[-]/g
const LEADING_PRIVATE_USE = /^[-]+\s*/

export function cleanSourceText(s: string): string {
  if (!s || !HAS_PRIVATE_USE.test(s)) return s
  return s.replace(LEADING_PRIVATE_USE, '').replace(ALL_PRIVATE_USE, '').replace(/ {2,}/g, ' ')
}
