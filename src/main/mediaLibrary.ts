/**
 * mediaLibrary.ts — the Media library's core: importing files into a managed
 * folder (or linking them in place), de-duplicating by content hash,
 * thumbnails, tags/favourites/folders, soft delete with undo, and health
 * checks. Electron-free: the one thing that needs a browser engine (decoding
 * a picture and making thumbnails) is injected as a `MediaDecoder`, so the
 * rules here are tested against real files on disk with a stand-in decoder.
 *
 * Safety rules this file enforces:
 *  - BORN never modifies or deletes a `linked` original, ever.
 *  - A managed copy's path is built only from the content hash and a
 *    whitelisted extension — an operator's file name never becomes a path.
 *  - Copies are written to a temp name and renamed into place, so a crash or a
 *    full disk never leaves a half-written file looking like a good one.
 *  - Pictures are judged by their bytes, not their file extension.
 */
import Database from 'better-sqlite3'
import { createHash, randomBytes } from 'crypto'
import {
  closeSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  statfsSync,
  unlinkSync,
  rmSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'path'
import { pipeline } from 'stream/promises'
import { driveRootOf, longPath, renameRetry, unlinkRetry } from './winFs'
import { migrateMediaDb } from './mediaSchema'
import { probeMp4 } from './mp4'
import { judgeVideo } from '../shared/videoPlayback'
import { looksComplete, orientedSize, readImageHeader, type SniffedFormat } from './imageHeader'
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  MEDIA_LIMITS,
  MEDIA_MESSAGES,
  type MediaErrorCode,
  type MediaFolder,
  type MediaImportResult,
  type MediaPreflightResult,
  type MediaRecord,
  type MediaStatus,
  type MediaStorage
} from '../shared/media'

export interface DecodedThumb {
  width: number
  height: number
  ext: 'jpg' | 'png'
  data: Buffer
}

export type DecodeResult =
  | { ok: true; width: number; height: number; hasAlpha: boolean; thumbs: DecodedThumb[] }
  | { ok: false; reason: 'corrupt' | 'unsupported' | 'io'; detail?: string }

/** The only browser-engine dependency. Real one: mediaDecoder.ts (Electron). */
export interface MediaDecoder {
  /** Fully decode the picture (this is the validity test), and make one thumbnail per width. */
  decode(path: string, thumbWidths: readonly number[], opts?: { needNatural?: boolean }): Promise<DecodeResult>
  /** Convert a picture Chromium cannot show (HEIC, TIFF) to a JPEG. Optional — absent = unsupported. */
  /** Decode one frame of a video (proof it plays here) and make poster thumbnails from it. Optional — absent = no video support. */
  decodeVideo?(path: string, thumbWidths: readonly number[]): Promise<
    | { ok: true; width: number; height: number; duration: number; hasAudio: boolean | null; thumbs: DecodedThumb[] }
    | { ok: false; reason: 'undecodable' | 'io'; detail?: string }
  >
  convertToJpeg?(path: string, outPath: string): Promise<boolean | { ok: true; notes?: string[] } | { ok: false; reason: 'corrupt' | 'too-large' | 'unsupported' | 'io' | 'memory' }>
}

export interface ImportOptions {
  /** Keep the original where it is instead of copying (very large files). */
  linkInPlace?: boolean
  folderId?: string | null
  tags?: string[]
}

export interface ListQuery {
  folderId?: string | null | 'any'
  tag?: string
  search?: string
  favoritesOnly?: boolean
  /** Only pictures or only videos. */
  type?: 'image' | 'video'
  sort?: 'added' | 'name' | 'recent' | 'used'
  limit?: number
  offset?: number
}

interface Row {
  id: string
  hash: string
  type: string
  name: string
  orig_filename: string
  ext: string
  mime: string
  bytes: number
  width: number
  height: number
  animated: number
  has_alpha: number
  storage: string
  link_path: string | null
  link_mtime_ms: number | null
  converted_from: string | null
  folder_id: string | null
  favorite: number
  added_at: string
  last_used_at: string | null
  deleted_at: string | null
  duration_ms: number | null
  fps: number | null
  bitrate: number | null
  video_codec: string | null
  audio_codec: string | null
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif' }
const EXT_FOR: Partial<Record<SniffedFormat, string>> = { jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', bmp: 'bmp', avif: 'avif' }

const newId = (): string => 'm_' + randomBytes(6).toString('hex')
const nowIso = (): string => new Date().toISOString()

export function failure(code: MediaErrorCode, path: string, messageOverride?: string): MediaImportResult {
  return { ok: false, code, message: messageOverride ?? MEDIA_MESSAGES[code], path }
}

/** Tags are lower-case, trimmed, single-spaced, ≤ 40 chars, and de-duplicated. */
export function normalizeTags(tags: string[] | undefined): string[] {
  const out = new Set<string>()
  for (const t of tags ?? []) {
    const n = t.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
    if (n) out.add(n)
  }
  return [...out]
}

/** A name safe to show and to store: no control characters, bounded length. */
export function cleanDisplayName(s: string): string {
  // eslint-disable-next-line no-control-regex
  const n = s.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return n.slice(0, 200) || 'Untitled'
}

export class MediaLibrary {
  readonly dir: string
  readonly filesDir: string
  readonly thumbsDir: string
  readonly db: Database.Database
  private readonly decoder: MediaDecoder

  private readonly freeProbe: ((dir: string) => number | null) | null

  constructor(opts: { dir: string; decoder: MediaDecoder; freeBytes?: (dir: string) => number | null }) {
    this.freeProbe = opts.freeBytes ?? null
    this.dir = resolve(opts.dir)
    this.filesDir = join(this.dir, 'files')
    this.thumbsDir = join(this.dir, 'thumbs')
    mkdirSync(this.filesDir, { recursive: true })
    mkdirSync(this.thumbsDir, { recursive: true })
    this.decoder = opts.decoder
    this.db = new Database(join(this.dir, 'media.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('foreign_keys = ON')
    migrateMediaDb(this.db)
  }

  close(): void {
    this.db.close()
  }

  // ── paths ──────────────────────────────────────────────────────────────────

  /** Absolute path of an item's bytes, or null if it cannot be resolved safely. */
  resolvePath(r: Pick<MediaRecord, 'storage' | 'linkPath' | 'hash' | 'ext'>): string | null {
    if (r.storage === 'linked') return r.linkPath && isAbsolute(r.linkPath) && !r.linkPath.includes('\0') ? r.linkPath : null
    if (!/^[0-9a-f]{64}$/.test(r.hash) || !/^[a-z0-9]{1,5}$/.test(r.ext)) return null
    const p = join(this.filesDir, r.hash.slice(0, 2), `${r.hash}.${r.ext}`)
    return p.startsWith(this.filesDir + sep) ? p : null
  }

  thumbPath(hash: string, width: number, ext: 'jpg' | 'png'): string {
    return join(this.thumbsDir, `${hash}-${width}.${ext}`)
  }

  // ── import ─────────────────────────────────────────────────────────────────

  async importFile(srcPath: string, opts: ImportOptions = {}): Promise<MediaImportResult> {
    const warnings: string[] = []
    let src = srcPath
    if (!isAbsolute(src) || src.includes('\0')) return failure('not-found', srcPath)
    src = resolve(src)
    const fsSrc = longPath(src) // a >260-character Windows path needs the extended (\\?\) form for file APIs

    // 1. what is it?
    let st
    try {
      st = statSync(fsSrc)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'not-found', src)
    }
    if (st.isDirectory()) return failure('not-a-file', src)
    if (!st.isFile()) return failure('not-a-file', src)
    if (st.size === 0) return failure('empty', src)

    let head: Buffer
    try {
      head = readHead(fsSrc, 64 * 1024)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
    }
    const header = readImageHeader(head)
    const fmt = header.format
    if (fmt === 'pdf') return failure('is-pdf', src)
    if (fmt === 'video') return this.importVideoFile(src, fsSrc, st, opts)
    if (fmt === 'audio') return failure('unsupported-audio', src)
    const needsConversion = fmt === 'heic' || fmt === 'tiff'
    if (!EXT_FOR[fmt] && !needsConversion) {
      // Looks like a picture by name but is not one by content: say it is damaged, not "unsupported".
      const looksLikePicture = IMAGE_EXTENSIONS.includes(extname(src).slice(1).toLowerCase())
      return failure(looksLikePicture && fmt === 'unknown' ? 'corrupt' : 'unsupported', src)
    }

    if (!needsConversion && !fileLooksComplete(fsSrc)) return failure('truncated', src)

    // 2. identity (streamed, so a 2 GB file costs no memory)
    let hash: string
    try {
      hash = await hashFile(fsSrc)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
    }

    const existing = this.rowByHash(hash)
    if (existing) {
      return { ok: true, item: this.hydrate(existing), duplicate: true, warnings }
    }
    const trashed = this.db.prepare('SELECT * FROM media_items WHERE hash = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1').get(hash) as Row | undefined
    if (trashed && this.resolvePath(this.rowToRecord(trashed)) && existsSync(this.resolvePath(this.rowToRecord(trashed)) as string)) {
      this.db.prepare('UPDATE media_items SET deleted_at = NULL WHERE id = ?').run(trashed.id)
      return { ok: true, item: this.hydrate(this.rowById(trashed.id) as Row), duplicate: true, restored: true, warnings }
    }

    // 3. size sanity (header only — no decode yet)
    const sized = orientedSize(header)
    if (sized && sized.width * sized.height > MEDIA_LIMITS.maxPixels) return failure('too-large-pixels', src)
    if (sized && sized.width * sized.height > MEDIA_LIMITS.warnPixels) {
      warnings.push(`Very large picture (${(sized.width * sized.height / 1e6).toFixed(0)} megapixels). It will be reduced for the screen, but may load slowly.`)
    }
    if (st.size >= MEDIA_LIMITS.warnBytes) {
      warnings.push(`Large file (${(st.size / 1048576).toFixed(0)} MB).`)
    }

    // 4. HEIC / TIFF → JPEG, only where the OS can do it
    let storeFrom = fsSrc
    let convertedFrom: string | null = null
    let tmpConverted: string | null = null
    let ext = EXT_FOR[fmt] ?? 'jpg'
    if (!needsConversion && fsSrc !== src) {
      // Too-long Windows path: the decoder loads by file URL, which cannot carry the extended form, so work from a short-path copy.
      tmpConverted = join(this.dir, `.convert-${randomBytes(4).toString('hex')}.${ext}`)
      try {
        copyFileSync(fsSrc, tmpConverted)
      } catch (e) {
        try { unlinkSync(tmpConverted) } catch { /* nothing to clean */ }
        const code = (e as NodeJS.ErrnoException).code
        return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
      }
      storeFrom = tmpConverted
    }
    if (needsConversion) {
      if (!this.decoder.convertToJpeg) return failure(fmt === 'heic' ? 'unsupported-heic' : 'unsupported', src)
      tmpConverted = join(this.dir, `.convert-${randomBytes(4).toString('hex')}.jpg`)
      let res: Awaited<ReturnType<NonNullable<MediaDecoder['convertToJpeg']>>> = false
      try {
        res = await this.decoder.convertToJpeg(fsSrc, tmpConverted)
      } catch {
        res = false
      }
      const converted = res === true || (typeof res === 'object' && res.ok)
      if (typeof res === 'object' && res.ok && res.notes) warnings.push(...res.notes)
      if (!converted || !existsSync(tmpConverted)) {
        const why = typeof res === 'object' && !res.ok ? res.reason : 'unsupported'
        try { unlinkSync(tmpConverted) } catch { /* nothing was written */ }
        if (why === 'corrupt') return failure('corrupt', src)
        if (why === 'too-large') return failure('too-large-pixels', src, 'This picture is enormous (over 64 megapixels) and cannot be converted safely. Resize it and add it again.')
        if (why === 'memory') return failure('io', src, 'This picture is too big to open on this computer.')
        return failure(fmt === 'heic' ? 'unsupported-heic' : 'unsupported', src)
      }
      storeFrom = tmpConverted
      convertedFrom = fmt === 'heic' ? 'heic' : 'tiff'
      ext = 'jpg'
    }

    try {
      // 5. full decode = the validity test; thumbnails come out of the same pass
      const knownSize = needsConversion ? null : sized
      const dec = await this.decoder.decode(storeFrom, MEDIA_LIMITS.thumbWidths, { needNatural: !knownSize })
      if (!dec.ok) {
        if (dec.reason === 'unsupported') return failure(fmt === 'heic' ? 'unsupported-heic' : 'unsupported', src)
        if (dec.reason === 'io') return failure('io', src)
        // Header read fine but the pixels would not decode: a cut-off file.
        return failure(header.width ? 'truncated' : 'corrupt', src)
      }
      const finalW = knownSize?.width ?? dec.width
      const finalH = knownSize?.height ?? dec.height
      if (finalW * finalH > MEDIA_LIMITS.maxPixels) return failure('too-large-pixels', src)

      // 6. keep it
      const longSource = fsSrc !== src // a >260-character Windows path is copied in rather than linked (links to such paths are unreliable)
      const storage: MediaStorage = opts.linkInPlace && !needsConversion && !longSource ? 'linked' : 'managed'
      if (opts.linkInPlace && longSource) warnings.push('This file has a very long path, so it was copied into the library instead of linked.')
      let bytes = statSync(storeFrom).size
      let linkMtime: number | null = null
      if (storage === 'managed') {
        const space = this.checkSpace(bytes)
        if (!space.ok) return failure('no-space', src)
        const dest = this.managedPath(hash, ext)
        mkdirSync(dirname(dest), { recursive: true })
        if (!existsSync(dest)) {
          const tmp = `${dest}.tmp-${randomBytes(4).toString('hex')}`
          try {
            copyFileSync(storeFrom, tmp)
            if (statSync(tmp).size !== bytes) throw new Error('copy size mismatch')
            renameRetry(tmp, dest)
          } catch (e) {
            try { unlinkSync(tmp) } catch { /* nothing to clean */ }
            const code = (e as NodeJS.ErrnoException).code
            return failure(code === 'ENOSPC' ? 'no-space' : code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
          }
        }
        bytes = statSync(dest).size
        if (convertedFrom) {
          // Keep the original next to the converted copy, so a better conversion can be made later. Best effort.
          const keep = this.originalPath(hash, convertedFrom === 'heic' ? 'heic' : 'tiff')
          try { if (!existsSync(keep) && this.checkSpace(st.size * 2).ok) copyFileSync(fsSrc, keep) } catch { /* the converted picture is what matters */ }
        }
      } else {
        linkMtime = Math.round(st.mtimeMs)
        if (st.size >= MEDIA_LIMITS.suggestLinkBytes) warnings.push('Linked in place: if this file is moved or its drive is unplugged, the picture will show as missing.')
      }

      dec.thumbs.forEach((t, i) => {
        try {
          // thumbnails are cheap to regenerate; a failed write never fails the import
          writeBuffer(this.thumbPath(hash, MEDIA_LIMITS.thumbWidths[i], t.ext), t.data)
        } catch { /* regenerated on demand */ }
      })

      const id = newId()
      const display = cleanDisplayName(basename(src, extname(src)))
      this.db
        .prepare(
          `INSERT INTO media_items (id, hash, type, name, orig_filename, ext, mime, bytes, width, height, animated, has_alpha,
             storage, link_path, link_mtime_ms, converted_from, folder_id, added_at)
           VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, hash, display, cleanDisplayName(basename(src)), ext, MIME[ext] ?? 'application/octet-stream', bytes, finalW, finalH,
          header.animated ? 1 : 0, (header.hasAlpha ?? dec.hasAlpha) ? 1 : 0, storage, storage === 'linked' ? src : null, linkMtime, convertedFrom,
          opts.folderId ?? null, nowIso())
      if (opts.tags?.length) this.setTags(id, opts.tags)
      if (header.animated) warnings.push('Animated picture: it will play and loop on screen.')
      return { ok: true, item: this.get(id) as MediaRecord, duplicate: false, warnings }
    } finally {
      if (tmpConverted) {
        try { unlinkSync(tmpConverted) } catch { /* already gone */ }
      }
    }
  }

  /**
   * A video: MP4 with H.264 video and AAC audio only (the resolved Phase 1b limits). The file's own boxes say what it is and whether it
   * is whole (src/main/mp4.ts); the browser engine then decodes a real frame — that frame is the poster — so "it plays here" is
   * never guessed from `canPlayType`. A refusal always says what is wrong and how to fix it.
   */
  private async importVideoFile(src: string, fsSrc: string, st: { size: number; mtimeMs: number }, opts: ImportOptions): Promise<MediaImportResult> {
    const warnings: string[] = []
    const probe = probeMp4(fsSrc)
    if (!probe.ok) {
      if (probe.reason === 'truncated') return failure('video-truncated', src)
      if (probe.reason === 'corrupt') return failure('video-damaged', src)
      // Not an MP4 at all: MKV/WebM/AVI/… get the "export as MP4" advice; anything else is simply not a video we can use.
      const head = readHead(fsSrc, 16)
      const other = (head[0] === 0x1a && head[1] === 0x45) || head.toString('latin1', 0, 4) === 'RIFF'
      return failure(other ? 'video-container' : probe.reason === 'no-video' ? 'unsupported-video' : 'video-damaged', src)
    }
    const verdict = judgeVideo({ brand: probe.brand, videoCodec: probe.videoCodec, audioCodec: probe.audioCodec, width: probe.width, height: probe.height, fps: probe.fps, bitrate: probe.bitrate })
    if (!verdict.ok) return failure(verdict.code, src, `${MEDIA_MESSAGES[verdict.code]} (This file: ${verdict.detail}.)`)
    warnings.push(...verdict.warnings)

    let hash: string
    try {
      hash = await hashFile(fsSrc)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
    }
    const existing = this.rowByHash(hash)
    if (existing) return { ok: true, item: this.hydrate(existing), duplicate: true, warnings }
    const trashed = this.db.prepare('SELECT * FROM media_items WHERE hash = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1').get(hash) as Row | undefined
    if (trashed && this.resolvePath(this.rowToRecord(trashed)) && existsSync(this.resolvePath(this.rowToRecord(trashed)) as string)) {
      this.db.prepare('UPDATE media_items SET deleted_at = NULL WHERE id = ?').run(trashed.id)
      return { ok: true, item: this.hydrate(this.rowById(trashed.id) as Row), duplicate: true, restored: true, warnings }
    }

    if (!this.decoder.decodeVideo) return failure('unsupported-video', src)
    const dec = await this.decoder.decodeVideo(fsSrc, MEDIA_LIMITS.thumbWidths)
    if (!dec.ok) return failure(dec.reason === 'io' ? 'io' : 'video-damaged', src)
    const duration = probe.durationSec !== null && Math.abs(probe.durationSec - dec.duration) <= 1.5 ? probe.durationSec : dec.duration
    const bitrate = duration > 0 ? Math.round((st.size * 8) / duration) : probe.bitrate
    // the bit-rate warning for a file whose own index had no duration
    if (probe.bitrate === null && bitrate) {
      const again = judgeVideo({ brand: probe.brand, videoCodec: probe.videoCodec, audioCodec: probe.audioCodec, width: probe.width, height: probe.height, fps: probe.fps, bitrate })
      if (again.ok) for (const w of again.warnings) if (!warnings.includes(w)) warnings.push(w)
    }

    const storage: MediaStorage = opts.linkInPlace ? 'linked' : 'managed'
    const dest = this.managedPath(hash, 'mp4')
    let linkMtime: number | null = null
    if (storage === 'managed') {
      const space = this.checkSpace(st.size)
      if (!space.ok) return failure('no-space', src)
      mkdirSync(dirname(dest), { recursive: true })
      if (!existsSync(dest)) {
        const tmp = `${dest}.tmp-${randomBytes(4).toString('hex')}`
        try {
          await pipeline(createReadStream(fsSrc), createWriteStream(tmp))
          if (statSync(tmp).size !== st.size) throw new Error('copy size mismatch')
          renameRetry(tmp, dest)
        } catch (e) {
          try { unlinkSync(tmp) } catch { /* nothing to clean */ }
          const code = (e as NodeJS.ErrnoException).code
          return failure(code === 'ENOSPC' ? 'no-space' : code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
        }
      }
    } else {
      linkMtime = Math.round(st.mtimeMs)
      warnings.push('Linked in place: if this file is moved or its drive is unplugged, the video will show as missing.')
    }
    dec.thumbs.forEach((t, i) => {
      try { writeBuffer(this.thumbPath(hash, MEDIA_LIMITS.thumbWidths[i], t.ext), t.data) } catch { /* regenerated on demand */ }
    })
    const id = newId()
    this.db
      .prepare(
        `INSERT INTO media_items (id, hash, type, name, orig_filename, ext, mime, bytes, width, height, animated, has_alpha,
           storage, link_path, link_mtime_ms, converted_from, folder_id, added_at, duration_ms, fps, bitrate, video_codec, audio_codec)
         VALUES (?, ?, 'video', ?, ?, 'mp4', 'video/mp4', ?, ?, ?, 0, 0, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, hash, cleanDisplayName(basename(src, extname(src))), cleanDisplayName(basename(src)), st.size, dec.width || probe.width, dec.height || probe.height,
        storage, storage === 'linked' ? src : null, linkMtime, opts.folderId ?? null, nowIso(), Math.round(duration * 1000), probe.fps, bitrate, probe.videoCodec, probe.audioCodec)
    if (opts.tags?.length) this.setTags(id, opts.tags)
    return { ok: true, item: this.get(id) as MediaRecord, duplicate: false, warnings }
  }

  /** Import a mix of files and folders (folders recursively). One failure never stops the rest. */
  async importPaths(
    paths: string[],
    opts: ImportOptions = {},
    onProgress?: (p: { done: number; total: number; current: string }) => void
  ): Promise<{ results: MediaImportResult[]; skipped: number }> {
    const files: string[] = []
    let skipped = 0
    const walk = (p: string, depth: number): void => {
      let st
      try {
        st = statSync(p)
      } catch {
        files.push(p) // reported as not-found by importFile
        return
      }
      if (st.isDirectory()) {
        if (depth > 6) return
        let names: string[] = []
        try {
          names = readdirSync(p)
        } catch {
          return
        }
        for (const n of names.sort()) {
          if (n.startsWith('.')) continue
          walk(join(p, n), depth + 1)
        }
      } else if (depth === 0 || IMAGE_EXTENSIONS.includes(extname(p).slice(1).toLowerCase()) || VIDEO_EXTENSIONS.includes(extname(p).slice(1).toLowerCase())) {
        files.push(p)
      } else {
        skipped++
      }
    }
    for (const p of paths) walk(resolve(p), 0)
    const results: MediaImportResult[] = []
    for (let i = 0; i < files.length; i++) {
      onProgress?.({ done: i, total: files.length, current: files[i] })
      try {
        results.push(await this.importFile(files[i], opts))
      } catch (e) {
        results.push(failure('io', files[i], (e as Error).message))
      }
    }
    onProgress?.({ done: files.length, total: files.length, current: '' })
    return { results, skipped }
  }

  // ── service packs ──────────────────────────────────────────────────────────

  /** A fresh hidden folder inside the library's own drive for unpacking (so moving a file into place is a rename). */
  newStagingDir(): string {
    const d = join(this.dir, `.pack-${randomBytes(6).toString('hex')}`)
    mkdirSync(d, { recursive: true })
    return d
  }

  /** Does this library already hold the picture with this identity (alive and with its bytes on disk)? */
  hasPicture(libraryHash: string): boolean {
    const r = this.rowByHash(libraryHash)
    if (!r) return false
    const rec = this.rowToRecord(r)
    return this.checkRecord(rec, r.link_mtime_ms) === 'ok'
  }

  /** What the pack writer needs for one picture: the record and, if it can be read right now, its path. */
  packSource(id: string): { rec: MediaRecord; path: string | null; status: MediaStatus } | null {
    const rec = this.get(id)
    if (!rec) return null
    const status = this.check(id)
    return { rec, path: status === 'ok' ? this.resolvePath(rec) : null, status }
  }

  /**
   * Add pictures that came out of a service pack, ALL OR NOTHING. Each staged file is checked to be a whole, supported
   * picture (the same test as any import), moved into the library and recorded in one database transaction. If anything
   * fails or is cancelled, every file this call created is removed and the library is exactly as before.
   */
  async importPackFiles(
    entries: Array<{ stagedPath: string; libraryHash: string; ext: string; name: string; origFilename: string; bytes: number; convertedFrom: string | null; folderId?: string | null }>,
    opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}
  ): Promise<{ added: MediaRecord[]; already: number }> {
    const created: string[] = []
    const rows: Array<{ id: string; e: (typeof entries)[number]; width: number; height: number; animated: boolean; alpha: boolean }> = []
    let already = 0
    const todo = entries.filter((e) => {
      if (this.hasPicture(e.libraryHash)) { already++; return false }
      return true
    })
    const need = todo.reduce((n, e) => n + e.bytes, 0)
    if (todo.length > 0 && !this.checkSpace(need).ok) throw Object.assign(new Error('no-space'), { code: 'no-space' })
    const rollback = (): void => {
      for (const f of created) { try { unlinkSync(f) } catch { /* already gone */ } }
    }
    try {
      for (let i = 0; i < todo.length; i++) {
        const e = todo[i]
        if (opts.signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' })
        opts.onProgress?.(i, todo.length)
        if (!/^[0-9a-f]{64}$/.test(e.libraryHash) || !/^(jpg|png|gif|webp|bmp|avif)$/.test(e.ext)) throw Object.assign(new Error('bad entry'), { code: 'bad-entry' })
        const header = readImageHeader(readHead(e.stagedPath, 64 * 1024))
        if (EXT_FOR[header.format] !== e.ext) throw Object.assign(new Error(`${e.name} is not a ${e.ext} picture`), { code: 'bad-type' })
        const sized = orientedSize(header)
        if (sized && sized.width * sized.height > MEDIA_LIMITS.maxPixels) throw Object.assign(new Error('too large'), { code: 'bad-type' })
        const dec = await this.decoder.decode(e.stagedPath, MEDIA_LIMITS.thumbWidths, { needNatural: !sized })
        if (!dec.ok) throw Object.assign(new Error(`${e.name} would not open as a picture`), { code: 'bad-type' })
        const dest = this.managedPath(e.libraryHash, e.ext)
        mkdirSync(dirname(dest), { recursive: true })
        if (!existsSync(dest)) {
          renameRetry(e.stagedPath, dest)
          created.push(dest)
        }
        dec.thumbs.forEach((t, k) => {
          try {
            const tp = this.thumbPath(e.libraryHash, MEDIA_LIMITS.thumbWidths[k], t.ext)
            if (!existsSync(tp)) { writeBuffer(tp, t.data); created.push(tp) }
          } catch { /* thumbnails are regenerated on demand */ }
        })
        rows.push({ id: newId(), e, width: sized?.width ?? dec.width, height: sized?.height ?? dec.height, animated: !!header.animated, alpha: !!(header.hasAlpha ?? dec.hasAlpha) })
      }
      if (opts.signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' })
      const insert = this.db.prepare(
        `INSERT INTO media_items (id, hash, type, name, orig_filename, ext, mime, bytes, width, height, animated, has_alpha,
           storage, link_path, link_mtime_ms, converted_from, folder_id, added_at)
         VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'managed', NULL, NULL, ?, ?, ?)`
      )
      const restore = this.db.prepare('UPDATE media_items SET deleted_at = NULL WHERE id = ?')
      const now = nowIso()
      this.db.transaction(() => {
        for (const r of rows) {
          const trashed = this.db.prepare('SELECT id FROM media_items WHERE hash = ? AND deleted_at IS NOT NULL LIMIT 1').get(r.e.libraryHash) as { id: string } | undefined
          if (trashed) {
            restore.run(trashed.id)
            r.id = trashed.id
            continue
          }
          insert.run(r.id, r.e.libraryHash, r.e.name, r.e.origFilename || r.e.name, r.e.ext, MIME[r.e.ext] ?? 'application/octet-stream', r.e.bytes, r.width, r.height, r.animated ? 1 : 0, r.alpha ? 1 : 0, r.e.convertedFrom, r.e.folderId ?? null, now)
        }
      })()
    } catch (e) {
      rollback()
      throw e
    }
    opts.onProgress?.(todo.length, todo.length)
    return { added: rows.map((r) => this.get(r.id) as MediaRecord), already }
  }

  /** Where the untouched HEIC/TIFF is kept when a picture was converted on import. */
  originalPath(hash: string, ext: 'heic' | 'tiff'): string {
    return join(this.filesDir, hash.slice(0, 2), `${hash}.orig.${ext}`)
  }

  private managedPath(hash: string, ext: string): string {
    return join(this.filesDir, hash.slice(0, 2), `${hash}.${ext}`)
  }

  private checkSpace(bytes: number): { ok: boolean; free?: number } {
    try {
      const probed = this.freeProbe ? this.freeProbe(this.dir) : null
      const s = probed == null ? statfsSync(this.dir) : null
      const free = probed ?? Number(s!.bavail) * Number(s!.bsize)
      return { ok: free >= bytes + MEDIA_LIMITS.freeSpaceMarginBytes, free }
    } catch {
      return { ok: true } // cannot tell — let the copy itself report ENOSPC
    }
  }

  // ── reading ────────────────────────────────────────────────────────────────

  private rowById(id: string): Row | undefined {
    return this.db.prepare('SELECT * FROM media_items WHERE id = ?').get(id) as Row | undefined
  }
  private rowByHash(hash: string): Row | undefined {
    return this.db.prepare('SELECT * FROM media_items WHERE hash = ? AND deleted_at IS NULL').get(hash) as Row | undefined
  }

  private rowToRecord(r: Row, tags: string[] = []): MediaRecord {
    return {
      id: r.id,
      hash: r.hash,
      type: r.type === 'video' ? 'video' : 'image',
      name: r.name,
      origFilename: r.orig_filename,
      ext: r.ext,
      mime: r.mime,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      animated: !!r.animated,
      hasAlpha: !!r.has_alpha,
      storage: r.storage === 'linked' ? 'linked' : 'managed',
      linkPath: r.link_path,
      convertedFrom: r.converted_from,
      folderId: r.folder_id,
      tags,
      favorite: !!r.favorite,
      addedAt: r.added_at,
      lastUsedAt: r.last_used_at,
      deletedAt: r.deleted_at,
      durationSec: r.duration_ms != null ? r.duration_ms / 1000 : null,
      fps: r.fps,
      bitrate: r.bitrate,
      videoCodec: r.video_codec,
      audioCodec: r.audio_codec
    }
  }

  private tagsFor(ids: string[]): Map<string, string[]> {
    const m = new Map<string, string[]>()
    if (ids.length === 0) return m
    const q = this.db.prepare(`SELECT item_id, tag FROM media_tags WHERE item_id IN (${ids.map(() => '?').join(',')}) ORDER BY tag`)
    for (const row of q.all(...ids) as Array<{ item_id: string; tag: string }>) {
      const a = m.get(row.item_id) ?? []
      a.push(row.tag)
      m.set(row.item_id, a)
    }
    return m
  }

  private hydrate(r: Row): MediaRecord {
    return this.rowToRecord(r, this.tagsFor([r.id]).get(r.id) ?? [])
  }

  get(id: string): MediaRecord | null {
    const r = this.rowById(id)
    return r ? this.hydrate(r) : null
  }

  list(q: ListQuery = {}): MediaRecord[] {
    const where: string[] = ['i.deleted_at IS NULL']
    const args: unknown[] = []
    if (q.folderId !== undefined && q.folderId !== 'any') {
      if (q.folderId === null) where.push('i.folder_id IS NULL')
      else {
        where.push('i.folder_id = ?')
        args.push(q.folderId)
      }
    }
    if (q.favoritesOnly) where.push('i.favorite = 1')
    if (q.type === 'video') where.push("i.type = 'video'")
    else if (q.type === 'image') where.push("i.type = 'image'")
    if (q.tag) {
      where.push('EXISTS (SELECT 1 FROM media_tags t WHERE t.item_id = i.id AND t.tag = ?)')
      args.push(q.tag.trim().toLowerCase())
    }
    if (q.search?.trim()) {
      const like = `%${q.search.trim().toLowerCase().replace(/[%_\\]/g, (c) => '\\' + c)}%`
      where.push(`(LOWER(i.name) LIKE ? ESCAPE '\\' OR LOWER(i.orig_filename) LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM media_tags t WHERE t.item_id = i.id AND t.tag LIKE ? ESCAPE '\\'))`)
      args.push(like, like, like)
    }
    const order =
      q.sort === 'name' ? 'LOWER(i.name) ASC, i.added_at DESC'
      : q.sort === 'recent' || q.sort === 'used' ? 'i.last_used_at IS NULL, i.last_used_at DESC, i.added_at DESC'
      : 'i.added_at DESC, i.id'
    const limit = Math.max(1, Math.min(q.limit ?? 5000, 20000))
    const rows = this.db
      .prepare(`SELECT i.* FROM media_items i WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...args, limit, Math.max(0, q.offset ?? 0)) as Row[]
    const tags = this.tagsFor(rows.map((r) => r.id))
    return rows.map((r) => this.rowToRecord(r, tags.get(r.id) ?? []))
  }

  count(): { items: number; bytesManaged: number; trashed: number } {
    const a = this.db.prepare("SELECT COUNT(*) c, COALESCE(SUM(CASE WHEN storage='managed' THEN bytes ELSE 0 END),0) b FROM media_items WHERE deleted_at IS NULL").get() as { c: number; b: number }
    const t = this.db.prepare('SELECT COUNT(*) c FROM media_items WHERE deleted_at IS NOT NULL').get() as { c: number }
    return { items: a.c, bytesManaged: a.b, trashed: t.c }
  }

  allTags(): Array<{ tag: string; count: number }> {
    return this.db
      .prepare('SELECT t.tag tag, COUNT(*) count FROM media_tags t JOIN media_items i ON i.id = t.item_id WHERE i.deleted_at IS NULL GROUP BY t.tag ORDER BY t.tag')
      .all() as Array<{ tag: string; count: number }>
  }

  // ── editing ────────────────────────────────────────────────────────────────

  rename(id: string, name: string): void {
    this.db.prepare('UPDATE media_items SET name = ? WHERE id = ?').run(cleanDisplayName(name), id)
  }
  setFavorite(id: string, fav: boolean): void {
    this.db.prepare('UPDATE media_items SET favorite = ? WHERE id = ?').run(fav ? 1 : 0, id)
  }
  setTags(id: string, tags: string[]): void {
    const norm = normalizeTags(tags)
    const run = this.db.transaction(() => {
      this.db.prepare('DELETE FROM media_tags WHERE item_id = ?').run(id)
      const ins = this.db.prepare('INSERT OR IGNORE INTO media_tags (item_id, tag) VALUES (?, ?)')
      for (const t of norm) ins.run(id, t)
    })
    run()
  }
  moveToFolder(ids: string[], folderId: string | null): void {
    const st = this.db.prepare('UPDATE media_items SET folder_id = ? WHERE id = ?')
    this.db.transaction(() => ids.forEach((id) => st.run(folderId, id)))()
  }
  markUsed(id: string): void {
    this.db.prepare('UPDATE media_items SET last_used_at = ? WHERE id = ?').run(nowIso(), id)
  }

  // ── folders ────────────────────────────────────────────────────────────────

  listFolders(): MediaFolder[] {
    return (this.db.prepare('SELECT id, name, parent_id FROM media_folders ORDER BY LOWER(name)').all() as Array<{ id: string; name: string; parent_id: string | null }>).map((r) => ({
      id: r.id,
      name: r.name,
      parentId: r.parent_id
    }))
  }
  createFolder(name: string, parentId: string | null = null): MediaFolder {
    const id = 'f_' + randomBytes(5).toString('hex')
    const n = cleanDisplayName(name)
    this.db.prepare('INSERT INTO media_folders (id, name, parent_id) VALUES (?, ?, ?)').run(id, n, parentId)
    return { id, name: n, parentId }
  }
  renameFolder(id: string, name: string): void {
    this.db.prepare('UPDATE media_folders SET name = ? WHERE id = ?').run(cleanDisplayName(name), id)
  }
  /** Deleting a folder never deletes pictures: they move up to the parent (or the top). */
  deleteFolder(id: string): void {
    const f = this.db.prepare('SELECT parent_id FROM media_folders WHERE id = ?').get(id) as { parent_id: string | null } | undefined
    if (!f) return
    this.db.transaction(() => {
      this.db.prepare('UPDATE media_items SET folder_id = ? WHERE folder_id = ?').run(f.parent_id, id)
      this.db.prepare('UPDATE media_folders SET parent_id = ? WHERE parent_id = ?').run(f.parent_id, id)
      this.db.prepare('DELETE FROM media_folders WHERE id = ?').run(id)
    })()
  }

  // ── removing (always undoable until purged) ───────────────────────────────

  /** Take items out of the library. Nothing is erased yet: Undo = `restore`. */
  remove(ids: string[]): void {
    const st = this.db.prepare('UPDATE media_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
    const t = nowIso()
    this.db.transaction(() => ids.forEach((id) => st.run(t, id)))()
  }
  restore(ids: string[]): MediaRecord[] {
    const out: MediaRecord[] = []
    const tx = this.db.transaction(() => {
      for (const id of ids) {
        const r = this.rowById(id)
        if (!r || !r.deleted_at) continue
        // a same-hash live row may have appeared since (re-imported): keep that one
        if (this.rowByHash(r.hash)) continue
        this.db.prepare('UPDATE media_items SET deleted_at = NULL WHERE id = ?').run(id)
        out.push(this.get(id) as MediaRecord)
      }
    })
    tx()
    return out
  }
  /**
   * Erase removed items for good. Managed copies are deleted from BORN's own
   * folder; a linked original is NEVER touched, only forgotten.
   * `olderThanMs: 0` purges everything removed so far.
   */
  purge(olderThanMs: number = MEDIA_LIMITS.purgeAfterMs): { purged: number; filesDeleted: number } {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString()
    const rows = this.db.prepare('SELECT * FROM media_items WHERE deleted_at IS NOT NULL AND deleted_at <= ?').all(cutoff) as Row[]
    let filesDeleted = 0
    for (const r of rows) {
      const rec = this.rowToRecord(r)
      if (rec.storage === 'managed') {
        const p = this.resolvePath(rec)
        const stillUsed = this.db.prepare('SELECT 1 FROM media_items WHERE hash = ? AND id <> ? AND deleted_at IS NULL').get(r.hash, r.id)
        if (p && !stillUsed) {
          try {
            unlinkRetry(p)
            filesDeleted++
          } catch { /* already gone */ }
          for (const oe of ['heic', 'tiff'] as const) {
            try { unlinkSync(this.originalPath(r.hash, oe)) } catch { /* none kept */ }
          }
        }
      }
      if (!this.db.prepare('SELECT 1 FROM media_items WHERE hash = ? AND id <> ? AND deleted_at IS NULL').get(r.hash, r.id)) {
        for (const w of [...MEDIA_LIMITS.thumbWidths, 'display' as const]) {
          for (const e of ['jpg', 'png'] as const) {
            try { unlinkSync(typeof w === 'number' ? this.thumbPath(r.hash, w, e) : join(this.thumbsDir, `${r.hash}-display.${e}`)) } catch { /* not there */ }
          }
        }
      }
      this.db.prepare('DELETE FROM media_items WHERE id = ?').run(r.id)
    }
    return { purged: rows.length, filesDeleted }
  }

  // ── health ─────────────────────────────────────────────────────────────────

  /** Cheap health check (stat only). `changed` = the file's size no longer matches what BORN recorded. */
  check(id: string): MediaStatus {
    const r = this.rowById(id)
    if (!r) return 'missing'
    return this.checkRecord(this.rowToRecord(r), r.link_mtime_ms)
  }
  private checkRecord(rec: MediaRecord, linkMtime: number | null): MediaStatus {
    const p = this.resolvePath(rec)
    if (!p) return 'unreadable'
    try {
      const st = statSync(p)
      if (!st.isFile()) return 'missing'
      if (st.size !== rec.bytes) return 'changed'
      if (rec.storage === 'linked' && linkMtime != null && Math.round(st.mtimeMs) !== linkMtime) return 'changed'
      return 'ok'
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'EACCES' || code === 'EPERM') return 'unreadable'
      // A linked picture on a USB stick or network share whose whole drive is gone is "offline" (plug it in), not "missing".
      if (rec.storage === 'linked' && rec.linkPath) {
        const root = driveRootOf(rec.linkPath)
        if (root && !this.rootOnline(root)) return 'offline'
      }
      return 'missing'
    }
  }

  private rootProbe = new Map<string, { at: number; online: boolean }>()
  /** Is this drive root reachable? Cached for 2 s so checking 5,000 pictures asks the (possibly slow, network) drive once. */
  private rootOnline(root: string): boolean {
    const hit = this.rootProbe.get(root)
    const now = Date.now()
    if (hit && now - hit.at < 2000) return hit.online
    let online = false
    try { online = existsSync(root) } catch { online = false }
    this.rootProbe.set(root, { at: now, online })
    return online
  }

  /**
   * "Reconnect this drive": the drive now has another letter, or the folder moved. Look through `folder` for the files
   * every offline/missing linked picture needs (by contents, not name) and point those pictures at them. Only changes where
   * a linked picture is read from; nothing is copied and nothing is added.
   */
  async reconnectLinked(folder: string, opts: { maxFiles?: number } = {}): Promise<{ relinked: number; stillMissing: number; scanned: number }> {
    const rows = this.db.prepare("SELECT * FROM media_items WHERE storage = 'linked' AND deleted_at IS NULL").all() as Row[]
    const need = rows.filter((r) => this.checkRecord(this.rowToRecord(r), r.link_mtime_ms) !== 'ok')
    const byKey = new Map<string, Row[]>()
    for (const r of need) (byKey.get(`${r.bytes}`) ?? byKey.set(`${r.bytes}`, []).get(`${r.bytes}`)!).push(r)
    let relinked = 0
    let scanned = 0
    const done = new Set<string>()
    const max = opts.maxFiles ?? 50000
    const stack: Array<[string, number]> = [[resolve(folder), 0]]
    while (stack.length && scanned < max && done.size < need.length) {
      const [d, depth] = stack.pop()!
      let names: string[] = []
      try { names = readdirSync(d) } catch { continue }
      for (const n of names) {
        if (n.startsWith('.')) continue
        const p = join(d, n)
        let st
        try { st = statSync(p) } catch { continue }
        if (st.isDirectory()) { if (depth < 10) stack.push([p, depth + 1]); continue }
        if (!st.isFile()) continue
        scanned++
        const cands = (byKey.get(`${st.size}`) ?? []).filter((r) => !done.has(r.id))
        if (!cands.length) continue
        let h: string
        try { h = await hashFile(p) } catch { continue }
        for (const r of cands) {
          // (a converted picture's identity is its original's hash, which cannot be re-checked from the JPEG: size only)
          if (r.converted_from == null && r.hash !== h) continue
          this.db.prepare('UPDATE media_items SET link_path = ?, link_mtime_ms = ?, bytes = ? WHERE id = ?').run(resolve(p), Math.round(st.mtimeMs), st.size, r.id)
          done.add(r.id)
          relinked++
        }
      }
    }
    this.rootProbe.clear()
    return { relinked, stillMissing: need.length - relinked, scanned }
  }

  /** Turn a linked picture into a normal copied one (its bytes go into the library), so it no longer depends on its drive. */
  async copyIntoLibrary(id: string): Promise<{ ok: boolean; message?: string }> {
    const rec = this.get(id)
    if (!rec || rec.storage !== 'linked') return { ok: false, message: 'That picture is already in the library.' }
    const src = this.resolvePath(rec)
    if (!src || this.check(id) !== 'ok') return { ok: false, message: "The picture can't be read right now. Plug the drive in first." }
    try {
      if (rec.convertedFrom == null && (await hashFile(src)) !== rec.hash) return { ok: false, message: 'The file has changed since it was added, so it was not copied.' }
      if (!this.checkSpace(rec.bytes).ok) return { ok: false, message: 'There is not enough free disk space to copy it.' }
      const dest = this.managedPath(rec.hash, rec.ext)
      mkdirSync(dirname(dest), { recursive: true })
      if (!existsSync(dest)) {
        const tmp = `${dest}.tmp-${randomBytes(4).toString('hex')}`
        try {
          copyFileSync(src, tmp)
          if (statSync(tmp).size !== rec.bytes) throw new Error('copy size mismatch')
          renameRetry(tmp, dest)
        } catch (e) {
          try { unlinkSync(tmp) } catch { /* nothing to clean */ }
          throw e
        }
      }
      this.db.prepare("UPDATE media_items SET storage = 'managed', link_path = NULL, link_mtime_ms = NULL WHERE id = ?").run(id)
      return { ok: true }
    } catch (e) {
      return { ok: false, message: (e as NodeJS.ErrnoException).code === 'ENOSPC' ? 'There is not enough free disk space to copy it.' : 'Something went wrong copying it. Nothing was changed.' }
    }
  }

  /** Everything that is not OK right now (for the "Needs attention" view and preflight). */
  checkAll(): Array<{ id: string; status: MediaStatus }> {
    const rows = this.db.prepare('SELECT * FROM media_items WHERE deleted_at IS NULL').all() as Row[]
    const out: Array<{ id: string; status: MediaStatus }> = []
    for (const r of rows) {
      const s = this.checkRecord(this.rowToRecord(r), r.link_mtime_ms)
      if (s !== 'ok') out.push({ id: r.id, status: s })
    }
    return out
  }
  /** Deep check: re-hash a managed file. Slow (reads the whole file); used by preflight on request. */
  async verifyHash(id: string): Promise<boolean> {
    const rec = this.get(id)
    if (!rec || rec.storage !== 'managed' || rec.convertedFrom) return rec != null
    const p = this.resolvePath(rec)
    if (!p || !existsSync(p)) return false
    return (await hashFile(p)) === rec.hash
  }
  /**
   * The full "will this show tonight?" check for one picture: is the file there, is it still
   * byte-for-byte what was imported, does it decode as a picture, and is it a sensible size for
   * a screen. Builds the screen-sized copy of a large picture as part of the check.
   */
  async preflight(id: string): Promise<MediaPreflightResult> {
    const rec = this.get(id)
    const base: MediaPreflightResult = { id, name: rec?.name ?? 'Missing picture', status: 'missing', deep: 'skipped', width: rec?.width ?? 0, height: rec?.height ?? 0, bytes: rec?.bytes ?? 0, storage: rec?.storage ?? null, notes: [] }
    if (!rec) return { ...base, notes: ['This picture is no longer in the library.'] }
    const status = this.check(id)
    if (status !== 'ok') return { ...base, status }
    const path = this.resolvePath(rec)
    if (!path) return { ...base, status: 'unreadable' }
    const out: MediaPreflightResult = { ...base, status: 'ok', deep: 'ok' }
    // 1. still the same bytes? (catches a half-copied or silently damaged file that is the right size)
    if (rec.storage === 'managed' && !rec.convertedFrom) {
      try {
        if ((await hashFile(path)) !== rec.hash) {
          out.deep = 'damaged'
          out.notes.push('The file no longer matches what was added (it may be damaged). Add the picture again from the original.')
          return out
        }
      } catch {
        return { ...out, status: 'unreadable', deep: 'skipped' }
      }
    }
    if (!fileLooksComplete(path)) {
      out.deep = 'damaged'
      out.notes.push('The file looks cut short (an unfinished copy or download). Copy the picture again from the original.')
      return out
    }
    // 2. does it really open?
    const dec = await this.decoder.decode(path, [64])
    if (!dec.ok) {
      out.deep = 'undecodable'
      out.notes.push('This file will not open as a picture.')
      return out
    }
    // 3. sensible for a screen?
    const px = rec.width * rec.height
    if (px > MEDIA_LIMITS.warnPixels) out.notes.push(`Very large (${(px / 1e6).toFixed(0)} megapixels): a screen-sized copy is used.`)
    if (rec.width < 960 && rec.height < 540) out.notes.push(`Small (${rec.width}×${rec.height}): it will look soft on a full-screen projector. Consider "Original size, centred".`)
    if (rec.animated) out.notes.push('Animated: it plays and loops on screen.')
    if (rec.storage === 'linked') out.notes.push('Linked in place: the original must stay where it is (and its drive plugged in).')
    // 4. make sure the screen-sized copy exists now, not at the moment of Take
    const d = await this.display(id)
    if (!d) {
      out.deep = 'undecodable'
      out.notes.push('A screen-sized copy could not be made.')
    }
    return out
  }

  /** Which of these content hashes this library already has (live items only): hash → local id. */
  findByHashes(hashes: string[]): Record<string, string> {
    const out: Record<string, string> = {}
    const st = this.db.prepare('SELECT id FROM media_items WHERE hash = ? AND deleted_at IS NULL')
    for (const h of hashes) {
      if (!/^[0-9a-f]{64}$/.test(h)) continue
      const r = st.get(h) as { id: string } | undefined
      if (r) out[h] = r.id
    }
    return out
  }

  /**
   * Look through a folder (recursively) for pictures whose contents match the wanted hashes, and add
   * the matches to the library. Only files of the wanted size are ever hashed, so a big folder is cheap.
   */
  async locateInFolder(root: string, wanted: Array<{ hash: string; bytes: number }>, opts: { maxFiles?: number } = {}): Promise<{ found: Record<string, string>; scanned: number }> {
    const bySize = new Map<number, Set<string>>()
    for (const w of wanted) (bySize.get(w.bytes) ?? bySize.set(w.bytes, new Set()).get(w.bytes)!).add(w.hash)
    const found: Record<string, string> = {}
    let scanned = 0
    const max = opts.maxFiles ?? 20000
    const stack: Array<[string, number]> = [[resolve(root), 0]]
    while (stack.length && scanned < max) {
      const [d, depth] = stack.pop()!
      let names: string[] = []
      try { names = readdirSync(d) } catch { continue }
      for (const n of names) {
        if (n.startsWith('.')) continue
        const p = join(d, n)
        let st
        try { st = statSync(p) } catch { continue }
        if (st.isDirectory()) { if (depth < 8) stack.push([p, depth + 1]); continue }
        if (!st.isFile()) continue
        scanned++
        const hashes = bySize.get(st.size)
        if (!hashes) continue
        let h: string
        try { h = await hashFile(p) } catch { continue }
        if (hashes.has(h) && !found[h]) {
          const r = await this.importFile(p)
          if (r.ok) found[h] = r.item.id
        }
      }
    }
    return { found, scanned }
  }

  /** Re-point a missing linked item at a file that has the same bytes (a "relink"). */
  async relink(id: string, newPath: string): Promise<{ ok: boolean; message?: string }> {
    const rec = this.get(id)
    if (!rec || rec.storage !== 'linked') return { ok: false, message: 'Only linked pictures can be relinked.' }
    if (!isAbsolute(newPath) || newPath.includes('\0') || !existsSync(newPath)) return { ok: false, message: "That file couldn't be found." }
    const st = statSync(newPath)
    if (!st.isFile()) return { ok: false, message: "That's not a file." }
    if (rec.convertedFrom == null && (await hashFile(newPath)) !== rec.hash) {
      return { ok: false, message: "That isn't the same picture (its contents are different)." }
    }
    this.db.prepare('UPDATE media_items SET link_path = ?, link_mtime_ms = ?, bytes = ? WHERE id = ?').run(resolve(newPath), Math.round(st.mtimeMs), st.size, id)
    return { ok: true }
  }

  // ── thumbnails ─────────────────────────────────────────────────────────────

  /** Path of a cached thumbnail, generating it if missing. Null if the source cannot be decoded. */
  async thumbnail(id: string, width: 320 | 960 = 320): Promise<string | null> {
    const rec = this.get(id)
    if (!rec) return null
    for (const e of ['jpg', 'png'] as const) {
      const p = this.thumbPath(rec.hash, width, e)
      if (existsSync(p)) return p
    }
    const src = this.resolvePath(rec)
    if (!src || !existsSync(src)) return null
    let result: string | null = null
    if (rec.type === 'video') {
      // a video's thumbnails are posters: one decoded frame
      const v = this.decoder.decodeVideo ? await this.decoder.decodeVideo(src, MEDIA_LIMITS.thumbWidths) : null
      if (!v || !v.ok) return null
      v.thumbs.forEach((t, i) => {
        const w = MEDIA_LIMITS.thumbWidths[i] ?? width
        const p = this.thumbPath(rec.hash, w, t.ext)
        try {
          writeBuffer(p, t.data)
          if (w === width) result = p
        } catch { /* not cacheable */ }
      })
      return result
    }
    const dec = await this.decoder.decode(src, MEDIA_LIMITS.thumbWidths)
    if (!dec.ok) return null
    dec.thumbs.forEach((t, i) => {
      const w = MEDIA_LIMITS.thumbWidths[i] ?? width
      const p = this.thumbPath(rec.hash, w, t.ext)
      try {
        writeBuffer(p, t.data)
        if (w === width) result = p
      } catch { /* not cacheable */ }
    })
    return result
  }

  /**
   * The file to put on a screen. Small pictures are shown from the original;
   * anything over ~10 megapixels (or an animated picture's first frame? no — animated
   * pictures are always shown from the original so they play) is shown from a cached
   * screen-sized copy, so a 50-megapixel photo never has to be decoded on the projector.
   * Returns null if the file cannot be shown.
   */
  async display(id: string): Promise<{ path: string; type: string } | null> {
    const rec = this.get(id)
    if (!rec) return null
    // For a video the "picture" to show is its poster frame (the video itself plays through the playback path).
    if (rec.type === 'video') {
      const poster = await this.thumbnail(id, 960)
      return poster ? { path: poster, type: poster.endsWith('.png') ? 'image/png' : 'image/jpeg' } : null
    }
    const src = this.resolvePath(rec)
    if (!src || !existsSync(src)) return null
    const type = MIME[rec.ext] ?? 'application/octet-stream'
    if (rec.animated || rec.width * rec.height <= MEDIA_LIMITS.displayMaxPixels) return { path: src, type }
    for (const e of ['jpg', 'png'] as const) {
      const p = join(this.thumbsDir, `${rec.hash}-display.${e}`)
      if (existsSync(p)) return { path: p, type: e === 'png' ? 'image/png' : 'image/jpeg' }
    }
    const dec = await this.decoder.decode(src, [MEDIA_LIMITS.displayLongEdge])
    if (!dec.ok || dec.thumbs.length === 0) return null
    const t = dec.thumbs[0]
    const p = join(this.thumbsDir, `${rec.hash}-display.${t.ext}`)
    try {
      writeBuffer(p, t.data)
    } catch {
      return null
    }
    return { path: p, type: t.ext === 'png' ? 'image/png' : 'image/jpeg' }
  }

  /** Remove temp files left by a crash mid-import. Safe to call at startup. */
  sweepTemp(): number {
    let n = 0
    try {
      for (const f of readdirSync(this.dir)) if (f.startsWith('.convert-') || f.startsWith('.pack-')) { rmSync(join(this.dir, f), { recursive: true, force: true }); n++ }
    } catch { /* ignore */ }
    const walk = (d: string): void => {
      let names: string[] = []
      try { names = readdirSync(d) } catch { return }
      for (const nme of names) {
        const p = join(d, nme)
        let st
        try { st = statSync(p) } catch { continue }
        if (st.isDirectory()) walk(p)
        else if (/\.tmp-[0-9a-f]+$/.test(nme)) { try { unlinkSync(p); n++ } catch { /* ignore */ } }
      }
    }
    walk(this.filesDir)
    return n
  }
}

// ── small fs helpers ───────────────────────────────────────────────────────────

function readHead(path: string, n: number): Buffer {
  const fd = openSync(path, 'r')
  try {
    const b = Buffer.alloc(n)
    const got = readSync(fd, b, 0, n, 0)
    return b.subarray(0, got)
  } finally {
    closeSync(fd)
  }
}

export function hashFile(path: string): Promise<string> {
  return new Promise((res, rej) => {
    const h = createHash('sha256')
    const s = createReadStream(path)
    s.on('error', rej)
    s.on('data', (c) => h.update(c))
    s.on('end', () => res(h.digest('hex')))
  })
}

function writeBuffer(path: string, data: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${randomBytes(3).toString('hex')}`
  writeFileSync(tmp, data)
  renameRetry(tmp, path)
}

/** Reads only the start and end of a file to see whether it is all there (see looksComplete). */
export function fileLooksComplete(path: string): boolean {
  let fd: number | null = null
  try {
    fd = openSync(path, 'r')
    const size = fstatSync(fd).size
    const read = (pos: number, len: number): Buffer => {
      const b = Buffer.alloc(Math.max(0, Math.min(len, size - pos)))
      if (b.length) readSync(fd as number, b, 0, b.length, pos)
      return b
    }
    const head = read(0, 64 * 1024)
    const format = readImageHeader(head).format
    // Measured against the real browser engine (see docs/qa follow-up report): it already REJECTS a cut-off JPEG, PNG, WebP, BMP
    // and AVIF, but it happily ACCEPTS a cut-off GIF (shows the frames that arrived). So the ending is checked for GIF; the rules
    // for the others stay available in looksComplete but are not applied, to avoid false alarms (e.g. a phone "motion photo" is a
    // JPEG with a video glued on, so a JPEG's last bytes are not the end-of-image marker).
    if (format !== 'gif') return true
    return looksComplete(format, head, read(Math.max(0, size - 64), 64), size)
  } catch {
    return true // cannot tell: the decode below decides
  } finally {
    if (fd !== null) { try { closeSync(fd) } catch { /* ignore */ } }
  }
}
