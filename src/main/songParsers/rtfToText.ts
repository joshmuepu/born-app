/**
 * rtfToText.ts — minimal RTF → plain text, enough for the single-slide RTF blobs
 * ProPresenter stores per cue. Not a general RTF renderer.
 */

const CP1252_EXTRA: Record<number, string> = {
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”',
  0x95: '•', 0x96: '–', 0x97: '—', 0x85: '…'
}

export function rtfToText(rtf: string): string {
  if (!rtf || rtf.indexOf('\\rtf') === -1) return rtf.trim()

  let s = rtf

  // Drop whole ignorable / metadata groups: {\*\...}, {\fonttbl...}, {\colortbl...},
  // {\stylesheet...}, {\info...}, {\*\expandedcolortbl...}, {\pict...}
  s = dropGroups(s, /\{\\\*|\{\\fonttbl|\{\\colortbl|\{\\stylesheet|\{\\info|\{\\pict|\{\\\*\\expandedcolortbl/)

  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') {
      const next = s[i + 1]
      if (next === '\\' || next === '{' || next === '}') {
        out += next
        i += 1
      } else if (next === "'") {
        // \'xx hex byte
        const hex = s.slice(i + 2, i + 4)
        const code = parseInt(hex, 16)
        out += Number.isNaN(code) ? '' : CP1252_EXTRA[code] ?? String.fromCharCode(code)
        i += 3
      } else if (next === '\n' || next === '\r') {
        out += '\n'
        i += 1
      } else if (/[a-zA-Z]/.test(next ?? '')) {
        // control word: \word  optionally followed by a number, then one optional space
        const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1))
        if (m) {
          const word = m[1]
          if (word === 'par' || word === 'line') out += '\n'
          if (word === 'tab') out += '\t'
          i += m[0].length
        }
      } else {
        // control symbol like \* \~ — skip the symbol
        i += 1
      }
    } else if (ch === '{' || ch === '}') {
      // group delimiters — ignore
    } else {
      out += ch
    }
  }

  return out
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Remove every top-level `{...}` group whose opening matches `startRe`, with nesting. */
function dropGroups(input: string, startRe: RegExp): string {
  let s = input
  let guard = 0
  while (guard++ < 200) {
    const m = startRe.exec(s)
    if (!m) break
    const open = m.index
    let depth = 0
    let end = -1
    for (let i = open; i < s.length; i++) {
      if (s[i] === '{' && s[i - 1] !== '\\') depth++
      else if (s[i] === '}' && s[i - 1] !== '\\') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end === -1) break
    s = s.slice(0, open) + s.slice(end + 1)
  }
  return s
}
