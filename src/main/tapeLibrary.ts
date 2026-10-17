/**
 * tapeLibrary.ts — importing and checking tapes (Electron-free; the folders and the database are passed in).
 *
 * Audio is copied into BORN's own folder by default (`<dir>/<sha256>.<ext>`), so a missing USB stick or a moved Downloads folder never breaks a
 * service — the same rule pictures and video follow. A file can instead be LINKED in place (very large files, or a church that keeps tapes on a
 * shared drive); a linked file whose drive is missing is reported as "offline", not "gone".
 */
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs'
import { basename, extname, join } from 'path'
import { createHash } from 'crypto'
import { AUDIO_EXTENSIONS, probeAudio } from './audioProbe'
import type { TapeDb } from './tapeDb'
import type { CheckLevel, TapeCheck, TapeFile, TapeFileStatus, TapeFolderHit, TapeImportResult, TapePreflight, TapeRecording } from '../shared/tape'
import { formatTapeTime } from '../shared/tape'
import { durationPlausible, matchSermon, parseTapeName, type SermonRef } from '../shared/tapeMatch'

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    const s = createReadStream(path)
    s.on('data', (c) => h.update(c))
    s.on('error', reject)
    s.on('end', () => resolve(h.digest('hex')))
  })
}

export interface TapeLibraryOptions {
  dir: string
  db: TapeDb
  /** free bytes on the drive holding `dir` (null = unknown) */
  freeBytes?: (dir: string) => number | null
}

export interface ImportOptions {
  sermonId?: number
  language?: string
  /** keep the file where it is instead of copying it */
  link?: boolean
}

export class TapeLibrary {
  constructor(private o: TapeLibraryOptions) {
    mkdirSync(o.dir, { recursive: true })
  }

  /** Where the bytes of a file are right now. */
  resolvePath(f: Pick<TapeFile, 'storage' | 'linkPath' | 'hash' | 'ext'>): string | null {
    if (f.storage === 'linked') return f.linkPath
    return join(this.o.dir, `${f.hash}.${f.ext}`)
  }

  status(f: TapeFile): TapeFileStatus {
    const p = this.resolvePath(f)
    if (!p) return 'missing'
    try {
      const st = statSync(p)
      if (st.size !== f.bytes) return 'changed'
      return 'ok'
    } catch {
      // a linked file on a drive that is not plugged in is "offline", a managed copy that vanished is "missing"
      if (f.storage === 'linked' && p && !existsSync(join(p, '..'))) return 'offline'
      return 'missing'
    }
  }

  async importFile(srcPath: string, opts: ImportOptions = {}): Promise<TapeImportResult> {
    const probe = probeAudio(srcPath)
    if (!probe.ok) return { ok: false, path: srcPath, reason: probe.reason, message: probe.message }
    const ext = (extname(srcPath).slice(1) || probe.container).toLowerCase()
    if (!AUDIO_EXTENSIONS.includes(ext)) {
      return { ok: false, path: srcPath, reason: 'unsupported', message: `Files ending in “.${ext}” are not supported. Use M4A, MP3, FLAC, OGG or WAV.` }
    }
    let hash: string
    try {
      hash = await sha256File(srcPath)
    } catch (e) {
      return { ok: false, path: srcPath, reason: 'unreadable', message: `This file could not be read (${(e as Error).message}).` }
    }
    let file = this.o.db.findFileByHash(hash)
    const duplicate = !!file
    if (!file) {
      let linkPath: string | null = null
      if (opts.link) linkPath = srcPath
      else {
        const free = this.o.freeBytes?.(this.o.dir)
        if (free !== null && free !== undefined && free < probe.bytes * 1.05 + 50 * 1024 * 1024) {
          return { ok: false, path: srcPath, reason: 'no-space', message: 'There is not enough free space on this computer to keep a copy of this recording. Free some space, or add it with “Link, don’t copy”.' }
        }
        const dest = join(this.o.dir, `${hash}.${ext}`)
        if (!existsSync(dest)) {
          const part = `${dest}.part-${process.pid}`
          try {
            copyFileSync(srcPath, part)
            if (statSync(part).size !== probe.bytes) throw new Error('the copy is not the same size as the original')
            renameSync(part, dest)
          } catch (e) {
            try { rmSync(part, { force: true }) } catch { /* nothing to clean */ }
            return { ok: false, path: srcPath, reason: 'copy-failed', message: `BORN could not copy this file (${(e as Error).message}). The original was not changed.` }
          }
        }
      }
      file = this.o.db.addFile({
        hash, name: cleanName(basename(srcPath, extname(srcPath))), origFilename: basename(srcPath), ext, container: probe.container, codec: probe.codec,
        bytes: probe.bytes, durationSec: probe.durationSec, bitrate: probe.bitrate, vbr: probe.vbr, seekTableOk: probe.seekTableOk,
        storage: opts.link ? 'linked' : 'managed', linkPath
      })
    }
    let recording: TapeRecording | null = null
    if (opts.sermonId !== undefined) {
      const id = this.o.db.addRecording(opts.sermonId, file.id, opts.language ?? 'en')
      recording = this.o.db.getRecording(id)
    }
    return { ok: true, file, recording, duplicate, warnings: probe.warnings }
  }

  async importPaths(paths: string[], opts: ImportOptions = {}): Promise<TapeImportResult[]> {
    const out: TapeImportResult[] = []
    for (const p of paths) out.push(await this.importFile(p, opts))
    return out
  }

  /** The audio files in the operator's "Tape audio" folder (two levels deep), each with the sermon it appears to be. Nothing is imported. */
  scanFolder(folder: string, sermons: SermonRef[]): TapeFolderHit[] {
    const hits: TapeFolderHit[] = []
    const walk = (dir: string, depth: number): void => {
      let names: string[]
      try { names = readdirSync(dir) } catch { return }
      for (const n of names.sort()) {
        if (n.startsWith('.')) continue
        const p = join(dir, n)
        let st
        try { st = statSync(p) } catch { continue }
        if (st.isDirectory()) { if (depth < 2) walk(p, depth + 1); continue }
        const ext = extname(n).slice(1).toLowerCase()
        if (!AUDIO_EXTENSIONS.includes(ext) || st.size < 100_000) continue
        const parsed = parseTapeName(n)
        const m = matchSermon(parsed, sermons)
        const slim = (s: SermonRef) => ({ id: s.id, dateCode: s.date_code, title: s.title })
        hits.push({
          path: p, name: n, bytes: st.size, parsedCode: parsed.dateCode, match: m.best ? slim(m.best) : null, candidates: m.candidates.map(slim),
          confidence: m.confidence, imported: !!this.o.db.findFileByNameAndSize(n, st.size)
        })
      }
    }
    walk(folder, 0)
    return hits
  }

  /** "Is tonight ready?" for one recording. `extra` carries what only the engine / the sermon text can know. */
  async preflight(
    recordingId: string,
    sermon: { durationMin?: number } = {},
    extra: { browserDurationSec?: number | null; paragraphNumbers?: number[]; outputDevice?: { present: boolean; label?: string } | null } = {}
  ): Promise<TapePreflight> {
    const rec = this.o.db.getRecording(recordingId)
    const checks: TapeCheck[] = []
    const add = (c: TapeCheck): void => { checks.push(c) }
    if (!rec) return { recordingId, status: 'fail', checks: [{ id: 'recording', level: 'fail', title: 'This recording is no longer attached to the sermon', fix: 'choose-another' }] }
    const st = this.status(rec.file)
    if (st !== 'ok') {
      add({
        id: 'file', level: 'fail', fix: 'find-file',
        title: st === 'offline' ? 'The drive with this recording is not connected' : st === 'changed' ? 'The recording file was changed' : 'The recording file is missing',
        detail: st === 'offline' ? 'Plug the drive in and press Check again, or find the file.' : st === 'changed' ? 'It is not the file BORN added. Add it again.' : 'BORN cannot find its copy. Find the file again.'
      })
      return { recordingId, status: 'fail', checks }
    }
    add({ id: 'file', level: 'ok', title: 'The recording is on this computer' })
    const p = probeAudio(this.resolvePath(rec.file)!)
    if (!p.ok) {
      add({ id: 'whole', level: 'fail', title: 'The recording cannot be read', detail: p.message, fix: 'choose-another' })
      return { recordingId, status: 'fail', checks }
    }
    add(p.whole ? { id: 'whole', level: 'ok', title: 'The whole file is there (not cut short)' } : { id: 'whole', level: 'fail', title: 'The file is cut short', detail: p.warnings[0] ?? 'Download or copy it again.', fix: 'choose-another' })
    if (extra.browserDurationSec !== undefined) {
      add(extra.browserDurationSec && extra.browserDurationSec > 0
        ? { id: 'decode', level: Math.abs(extra.browserDurationSec - p.durationSec) > 5 ? 'warn' : 'ok', title: Math.abs(extra.browserDurationSec - p.durationSec) > 5 ? 'This computer reads a different length than the file says' : 'It plays on this computer', detail: Math.abs(extra.browserDurationSec - p.durationSec) > 5 ? `The file says ${formatTapeTime(p.durationSec)}, this computer reads ${formatTapeTime(extra.browserDurationSec)}. Positions may be off. Convert it to M4A (AAC).` : undefined }
        : { id: 'decode', level: 'fail', title: 'This computer cannot play the recording', detail: 'Convert it to M4A (AAC) and add that file.', fix: 'choose-another' })
    }
    const pl = durationPlausible(p.durationSec, sermon.durationMin)
    add(pl.ok ? { id: 'length', level: 'ok', title: `Length ${formatTapeTime(p.durationSec)} fits the sermon` } : { id: 'length', level: 'warn', title: 'The length looks wrong for this sermon', detail: `${pl.note} Check it is the right recording.`, fix: 'choose-another' })
    for (const w of p.warnings.filter((w) => !/cut short/.test(w))) add({ id: 'format', level: 'warn', title: 'About this file’s format', detail: w })
    const map = this.o.db.getMap(recordingId, null)
    const timed = map ? map.marks.filter((m) => m.kind === 'start' && m.t !== null).length : 0
    if (!map || timed === 0) add({ id: 'sync', level: 'warn', title: 'No paragraph timing yet', detail: 'The tape plays, but the text cannot follow it until it is timed. BORN does that by itself in the background; nothing needs doing.', fix: 'sync' })
    else if (extra.paragraphNumbers && extra.paragraphNumbers.length) {
      const covered = extra.paragraphNumbers.filter((n) => map.marks.some((m) => m.n === n && (m.t !== null || m.kind === 'skip'))).length
      const pct = covered / extra.paragraphNumbers.length
      add(pct >= 0.9 ? { id: 'sync', level: 'ok', title: `Timing covers ${covered} of ${extra.paragraphNumbers.length} paragraphs` } : { id: 'sync', level: 'warn', title: `Timing covers only ${covered} of ${extra.paragraphNumbers.length} paragraphs`, detail: 'Open the sync editor to finish it.', fix: 'open-sync' })
    } else add({ id: 'sync', level: 'ok', title: `Timing for ${timed} paragraphs` })
    if (extra.outputDevice !== undefined) {
      add(extra.outputDevice === null || extra.outputDevice.present ? { id: 'output', level: 'ok', title: extra.outputDevice?.label ? `Sound will play on “${extra.outputDevice.label}”` : 'Sound will play on the default output' } : { id: 'output', level: 'fail', title: 'The chosen sound output is not connected', detail: 'Plug it in, or choose another output.', fix: 'choose-output' })
    }
    const status: CheckLevel = checks.some((c) => c.level === 'fail') ? 'fail' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok'
    return { recordingId, status, checks }
  }
}

/** "65-0418M It Is The Rising Of The Sun VGR" → shown as is, but with underscores/dashes read as spaces. */
function cleanName(s: string): string {
  return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}
