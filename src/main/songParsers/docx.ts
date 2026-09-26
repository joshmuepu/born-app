/**
 * docx.ts — pull raw text out of a Word document so it can flow through the
 * same blank-line/label auto-detection parsePlainText already does for a
 * .txt file. mammoth's own HTML conversion is intentionally not used here —
 * a hymn typed in Word carries no structure mammoth could recover beyond
 * paragraph breaks anyway, so plain text plus a blank line between
 * paragraphs (which mammoth's extractRawText already inserts) is exactly
 * the shape parsePlainText expects.
 */
import mammoth from 'mammoth'

/** Empty string means "no extractable text" — same signal an image-only
 *  page in a PDF gives, so callers can show one shared "nothing to import,
 *  try pasting instead" message for either case. */
export async function extractDocxText(data: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: data })
  return result.value.trim()
}
