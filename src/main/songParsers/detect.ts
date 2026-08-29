/**
 * detect.ts — decide which song format a file is, from its name + first bytes.
 */
export type SongFormat = 'propresenter7' | 'openlyrics' | 'opensong' | 'chordpro' | 'plaintext'

export function detectFormat(filename: string, head: string): SongFormat {
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  const sample = head.slice(0, 4000)
  const trimmed = sample.trimStart()

  if (ext === 'pro' || ext === 'pro7') {
    if (trimmed.startsWith('{\\rtf') || /^\{(title|t|artist|c|sov|soc)[:}]/im.test(trimmed))
      return 'chordpro'
    return 'propresenter7'
  }

  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<song')) {
    if (/xmlns\s*=\s*["'][^"']*openlyrics/i.test(sample) || /<lyrics>\s*<verse\b/i.test(sample)) {
      return 'openlyrics'
    }
    return 'opensong'
  }

  if (['cho', 'crd', 'chopro', 'chordpro'].includes(ext)) return 'chordpro'
  if (/^\{(title|t|artist|key|c)\s*[:}]/im.test(trimmed) || /\{(start_of_verse|sov|soc)\}/i.test(sample))
    return 'chordpro'

  return 'plaintext'
}

const KEY_SUFFIX = /\s*[-–]\s*([A-G][#b]?m?)$/

/** Strip a trailing " - <key>" and the extension from a filename → a song title. */
export function titleFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/^.*[/\\]/, '')
  return stem.replace(KEY_SUFFIX, '').trim() || stem
}

/** A musical key encoded in the filename, e.g. "Marvelous Grace - Eb.pro" → "Eb". */
export function keyFromFilename(filename: string): string | undefined {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/^.*[/\\]/, '')
  return KEY_SUFFIX.exec(stem)?.[1]
}
