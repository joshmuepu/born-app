/**
 * Pure utility functions shared across main-process modules.
 * Kept here (no Electron deps) so they can be unit-tested in Node.js.
 */

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseParagraphIndex(ref: string): number {
  if (ref === 'header') return 0
  const m = ref.match(/^p(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}
