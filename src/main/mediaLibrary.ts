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
  existsSync,
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
import { migrateMediaDb } from './mediaSchema'
import { orientedSize, readImageHeader, type SniffedFormat } from './imageHeader'
import {
  IMAGE_EXTENSIONS,
  MEDIA_LIMITS,
  MEDIA_MESSAGES,
  type MediaErrorCode,
  type MediaFolder,
  type MediaImportResult,
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
  convertToJpeg?(path: string, outPath: string): Promise<boolean>
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

    // 1. what is it?
    let st
    try {
      st = statSync(src)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'not-found', src)
    }
    if (st.isDirectory()) return failure('not-a-file', src)
    if (!st.isFile()) return failure('not-a-file', src)
    if (st.size === 0) return failure('empty', src)

    let head: Buffer
    try {
      head = readHead(src, 64 * 1024)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      return failure(code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
    }
    const header = readImageHeader(head)
    const fmt = header.format
    if (fmt === 'pdf') return failure('is-pdf', src)
    if (fmt === 'video') return failure('unsupported-video', src)
    if (fmt === 'audio') return failure('unsupported-audio', src)
    const needsConversion = fmt === 'heic' || fmt === 'tiff'
    if (!EXT_FOR[fmt] && !needsConversion) {
      // Looks like a picture by name but is not one by content: say it is damaged, not "unsupported".
      const looksLikePicture = IMAGE_EXTENSIONS.includes(extname(src).slice(1).toLowerCase())
      return failure(looksLikePicture && fmt === 'unknown' ? 'corrupt' : 'unsupported', src)
    }

    // 2. identity (streamed, so a 2 GB file costs no memory)
    let hash: string
    try {
      hash = await hashFile(src)
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
    let storeFrom = src
    let convertedFrom: string | null = null
    let tmpConverted: string | null = null
    let ext = EXT_FOR[fmt] ?? 'jpg'
    if (needsConversion) {
      if (!this.decoder.convertToJpeg) return failure(fmt === 'heic' ? 'unsupported-heic' : 'unsupported', src)
      tmpConverted = join(this.dir, `.convert-${randomBytes(4).toString('hex')}.jpg`)
      let ok = false
      try {
        ok = await this.decoder.convertToJpeg(src, tmpConverted)
      } catch {
        ok = false
      }
      if (!ok || !existsSync(tmpConverted)) return failure(fmt === 'heic' ? 'unsupported-heic' : 'unsupported', src)
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
      const storage: MediaStorage = opts.linkInPlace && !needsConversion ? 'linked' : 'managed'
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
            renameSync(tmp, dest)
          } catch (e) {
            try { unlinkSync(tmp) } catch { /* nothing to clean */ }
            const code = (e as NodeJS.ErrnoException).code
            return failure(code === 'ENOSPC' ? 'no-space' : code === 'EACCES' || code === 'EPERM' ? 'permission' : 'io', src)
          }
        }
        bytes = statSync(dest).size
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
      } else if (depth === 0 || IMAGE_EXTENSIONS.includes(extname(p).slice(1).toLowerCase())) {
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
      type: 'image',
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
      deletedAt: r.deleted_at
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
            unlinkSync(p)
            filesDeleted++
          } catch { /* already gone */ }
        }
      }
      if (!this.db.prepare('SELECT 1 FROM media_items WHERE hash = ? AND id <> ? AND deleted_at IS NULL').get(r.hash, r.id)) {
        for (const w of MEDIA_LIMITS.thumbWidths) {
          for (const e of ['jpg', 'png'] as const) {
            try { unlinkSync(this.thumbPath(r.hash, w, e)) } catch { /* not there */ }
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
      return code === 'EACCES' || code === 'EPERM' ? 'unreadable' : 'missing'
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
    const dec = await this.decoder.decode(src, MEDIA_LIMITS.thumbWidths)
    if (!dec.ok) return null
    let result: string | null = null
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

  /** Remove temp files left by a crash mid-import. Safe to call at startup. */
  sweepTemp(): number {
    let n = 0
    try {
      for (const f of readdirSync(this.dir)) if (f.startsWith('.convert-')) { rmSync(join(this.dir, f), { force: true }); n++ }
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
  renameSync(tmp, path)
}
