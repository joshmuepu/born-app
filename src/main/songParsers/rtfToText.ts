/**
 * rtfToText.ts — minimal RTF → plain text, enough for the single-slide RTF blobs
 * ProPresenter stores per cue. Not a general RTF renderer.
 */

import { cp1252Char } from './decodeText'

export function rtfToText(rtf: string): string {
  if (!rtf || rtf.indexOf('\\rtf') === -1) return rtf.trim()

  let s = rtf

  // Drop whole ignorable / metadata groups: {\*\...}, {\fonttbl...}, {\colortbl...},
  // {\stylesheet...}, {\info...}, {\*\expandedcolortbl...}, {\pict...}
  s = dropGroups(s, /\{\\\*|\{\\fonttbl|\{\\colortbl|\{\\stylesheet|\{\\info|\{\\pict|\{\\\*\\expandedcolortbl/)

  let out = ''
  // \uN gives a character as its number, followed by \ucN fallback characters (usually one "?") for readers that do not know \u: those are skipped
  let uc = 1
  const ucStack: number[] = []
  let skip = 0
  const emit = (t: string): void => {
    if (skip > 0) skip--
    else out += t
  }
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') {
      const next = s[i + 1]
      if (next === '\\' || next === '{' || next === '}') {
        emit(next)
        i += 1
      } else if (next === "'") {
        // \'xx hex byte, Windows-1252 through the fixed table (the euro sign and the rest of 0x80–0x9F included)
        const hex = s.slice(i + 2, i + 4)
        const code = parseInt(hex, 16)
        if (!Number.isNaN(code)) emit(cp1252Char(code))
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
          if (word === 'uc' && m[2] !== undefined) uc = Math.max(0, Number(m[2]))
          if (word === 'u' && m[2] !== undefined) {
            let n = Number(m[2])
            if (n < 0) n += 65536
            out += String.fromCharCode(n & 0xffff)
            skip = uc
          }
          i += m[0].length
        }
      } else {
        // control symbol like \* \~ — skip the symbol
        i += 1
      }
    } else if (ch === '{') {
      ucStack.push(uc)
    } else if (ch === '}') {
      uc = ucStack.pop() ?? uc
      skip = 0
    } else {
      emit(ch)
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
