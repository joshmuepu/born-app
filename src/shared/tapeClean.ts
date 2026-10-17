/**
 * tapeClean.ts — what is allowed to cross from a window into the Tape service (IPC) or in from a file. Pure, so it can be tested hard: everything that
 * arrives is untrusted (a damaged timing file, a page script, a hand-edited settings file), and nothing here ever throws.
 */
import type { SyncMark, SyncRegion, TapeSettings } from './tape'
import { TAPE_DEFAULTS } from './tape'

const MAX_N = 100000
const MAX_SEC = 24 * 3600

/** Marks from outside: whole paragraph numbers in range, a start with a real finite time, a skip with none, confidence 0–1 or none. */
export function cleanSyncMarks(x: unknown): SyncMark[] {
  if (!Array.isArray(x)) return []
  const out: SyncMark[] = []
  for (const m of x) {
    if (!m || typeof m !== 'object') continue
    const r = m as Record<string, unknown>
    if (!Number.isInteger(r.n) || (r.n as number) < 1 || (r.n as number) >= MAX_N) continue
    if (r.kind !== 'start' && r.kind !== 'skip') continue
    const t = r.kind === 'skip' ? null : typeof r.t === 'number' && Number.isFinite(r.t) ? r.t : null
    const c = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? Math.min(1, Math.max(0, r.confidence)) : null
    out.push({ n: r.n as number, t, confidence: c, kind: r.kind })
  }
  return out
}

/** Regions from outside: a known kind, finite times, a short note. */
export function cleanSyncRegions(x: unknown): SyncRegion[] {
  if (!Array.isArray(x)) return []
  const out: SyncRegion[] = []
  for (const r of x) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (o.kind !== 'gap' && o.kind !== 'differs') continue
    if (typeof o.start !== 'number' || typeof o.end !== 'number' || !Number.isFinite(o.start) || !Number.isFinite(o.end)) continue
    out.push({ kind: o.kind, start: o.start, end: o.end, note: typeof o.note === 'string' ? o.note.slice(0, 200) : undefined })
  }
  return out
}

/** A text-language code ("es", "fra"), or null for "the recording's own". Anything else is null — never a path, never markup. */
export function cleanTextLanguage(x: unknown): string | null {
  return typeof x === 'string' && /^[a-z]{2,3}$/.test(x) ? x : null
}

/** A settings change from a window: only keys that exist, only values of the right type and, where the option has a fixed list, one of its values. */
export function cleanTapeSettingsPatch(patch: unknown): Partial<TapeSettings> {
  const out: Partial<TapeSettings> = {}
  if (!patch || typeof patch !== 'object') return out
  const p = patch as Record<string, unknown>
  const choices: Partial<Record<keyof TapeSettings, readonly string[]>> = {
    view: ['highlight', 'single', 'lower'],
    speedRange: ['wide', 'narrow', 'off'],
    deviceLoss: ['pause', 'default'],
    videoRule: ['pause', 'stop'],
    escRule: ['keep', 'pause'],
    mismatchPolicy: ['ask', 'never', 'matching']
  }
  for (const k of Object.keys(TAPE_DEFAULTS) as Array<keyof TapeSettings>) {
    if (!(k in p) || typeof p[k] !== typeof TAPE_DEFAULTS[k]) continue
    const v = p[k]
    const list = choices[k]
    if (list && !list.includes(v as string)) continue
    if (k === 'leadSec') { if (!Number.isFinite(v as number)) continue; (out as Record<string, unknown>)[k] = Math.min(10, Math.max(0, v as number)); continue }
    if (typeof v === 'string' && v.length > 1024) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

export { MAX_N as TAPE_MAX_PARAGRAPH, MAX_SEC as TAPE_MAX_SECONDS }
