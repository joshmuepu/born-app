/**
 * servicePack.ts — save a service together with its pictures (.bornpack) and open one safely.
 * Design and threat model: docs/design/media/07-service-pack.md. No Electron imports: dialogs live in the IPC layer,
 * so everything here is tested directly against real files.
 */
import { existsSync, mkdirSync, renameSync, rmSync, statSync, statfsSync } from 'fs'
import { basename, dirname, join } from 'path'
import { randomBytes, createHash } from 'crypto'
import { ZipError, ZipReader, ZipWriter, type ZipEntry } from './zipStore'
import { MediaLibrary } from './mediaLibrary'
import {
  PACK_FORMAT, PACK_LIMITS, PACK_MANIFEST_NAME, PACK_MEDIA_NAME, PACK_MESSAGES, PACK_QUEUE_NAME, PACK_VERSION, validateManifest,
  type PackErrorCode, type PackEstimate, type PackFileEntry, type PackImportSummary, type PackManifest, type PackResult, type PackReview, type PackReviewFile, type PackRole
} from '../shared/servicePack'
import { mediaIdsInQueue, type QueueItem } from '../shared/queueItem'
import type { MediaBackground } from '../shared/media'

const fail = (code: PackErrorCode, detail?: string, extra: object = {}): { ok: false; code: PackErrorCode; message: string; detail?: string } => ({ ok: false, code, message: PACK_MESSAGES[code], detail, ...extra })

function mapZip(e: unknown): { ok: false; code: PackErrorCode; message: string; detail?: string } {
  if (e instanceof ZipError) {
    const m: Record<string, PackErrorCode> = { 'not-zip': 'not-a-pack', truncated: 'truncated', damaged: 'damaged', unsupported: 'bad-entry', 'too-many': 'too-many', 'too-big': 'too-big', 'bad-name': 'bad-entry', cancelled: 'cancelled' }
    return fail(m[e.code] ?? 'damaged', e.message)
  }
  const code = (e as NodeJS.ErrnoException)?.code
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return fail('permission')
  if (code === 'ENOENT') return fail('io', 'not found')
  if (code === 'ENOSPC') return fail('no-space')
  return fail('io', (e as Error)?.message)
}

export interface PackSettings {
  backgrounds?: { destinations: Record<string, MediaBackground>; channels: Record<string, MediaBackground> }
  logoId?: string | null
}

/** The picture ids a service needs, with why: queue items, slideshow pages, backgrounds, logo. */
export function collectPackMedia(queue: QueueItem[], settings: PackSettings): Map<string, Set<PackRole>> {
  const out = new Map<string, Set<PackRole>>()
  const add = (id: string | null | undefined, role: PackRole): void => {
    if (!id) return
    if (!out.has(id)) out.set(id, new Set())
    out.get(id)!.add(role)
  }
  for (const it of queue) {
    if (it.kind !== 'media') continue
    const ids = it.mediaIds ?? [it.mediaId]
    ids.forEach((id) => add(id, ids.length > 1 ? 'slide' : 'item'))
  }
  for (const id of mediaIdsInQueue(queue)) if (!out.has(id)) add(id, 'item')
  for (const b of Object.values(settings.backgrounds?.destinations ?? {})) add(b?.mediaId, 'background')
  for (const b of Object.values(settings.backgrounds?.channels ?? {})) add(b?.mediaId, 'background')
  add(settings.logoId, 'logo')
  return out
}

export function estimatePack(lib: MediaLibrary, queue: QueueItem[], settings: PackSettings, freeBytes: number | null = null): PackEstimate {
  const media = collectPackMedia(queue, settings)
  const files: PackEstimate['files'] = []
  const missing: PackEstimate['missing'] = []
  for (const [id, roles] of media) {
    const src = lib.packSource(id)
    if (!src) { missing.push({ id, name: 'A picture', status: 'missing' }); continue }
    if (!src.path) { missing.push({ id, name: src.rec.name, status: src.status }); continue }
    files.push({ id, name: src.rec.name, bytes: src.rec.bytes, roles: [...roles] })
  }
  const totalBytes = files.reduce((n, f) => n + f.bytes, 0)
  const groups: PackEstimate['groups'] = []
  const byId = new Map(files.map((f) => [f.id, f]))
  for (const it of queue) {
    if (it.kind !== 'media') continue
    const ids = (it.mediaIds ?? [it.mediaId]).filter((i) => byId.has(i))
    if (ids.length === 0) continue
    groups.push({ label: it.name || 'Picture', sub: ids.length === 1 ? '1 picture' : `${ids.length} pictures · slideshow`, bytes: ids.reduce((n, i) => n + byId.get(i)!.bytes, 0), ids })
  }
  const bgIds = files.filter((f) => f.roles.includes('background') && !groups.some((g) => g.ids.includes(f.id))).map((f) => f.id)
  if (bgIds.length) groups.push({ label: 'Backgrounds used on screens', sub: `${bgIds.length} picture${bgIds.length === 1 ? '' : 's'}`, bytes: bgIds.reduce((n, i) => n + byId.get(i)!.bytes, 0), ids: bgIds })
  const logoIds = files.filter((f) => f.roles.includes('logo') && !groups.some((g) => g.ids.includes(f.id))).map((f) => f.id)
  if (logoIds.length) groups.push({ label: 'Church logo', sub: '1 picture', bytes: logoIds.reduce((n, i) => n + byId.get(i)!.bytes, 0), ids: logoIds })
  return {
    count: files.length,
    totalBytes,
    big: totalBytes >= PACK_LIMITS.bigPackBytes,
    tooBig: totalBytes + 1024 * 1024 > PACK_LIMITS.maxPackBytes,
    tooMany: files.length > PACK_LIMITS.maxPictures,
    freeBytes,
    files,
    missing,
    groups
  }
}

export interface ExportOptions {
  dest: string
  title: string
  appVersion: string
  settings: PackSettings
  signal?: AbortSignal
  onProgress?: (p: { doneBytes: number; totalBytes: number; done: number; total: number; current: string }) => void
}

/** Write the pack. The final file appears only when it is complete and has been read back successfully. */
export async function exportPack(lib: MediaLibrary, queue: QueueItem[], opts: ExportOptions): Promise<PackResult<{ bytes: number; count: number; path: string }>> {
  const est = estimatePack(lib, queue, opts.settings)
  if (est.missing.length) return fail('missing-pictures', undefined, { missing: est.missing })
  if (est.tooMany) return fail('too-many')
  if (est.tooBig) return fail('too-big')
  const media = collectPackMedia(queue, opts.settings)
  const partial = join(dirname(opts.dest), `.${basename(opts.dest)}.partial-${randomBytes(3).toString('hex')}`)
  let zip: ZipWriter | null = null
  const cleanup = async (): Promise<void> => {
    try { await zip?.close() } catch { /* already closed */ }
    try { rmSync(partial, { force: true }) } catch { /* nothing to clean */ }
  }
  try {
    mkdirSync(dirname(opts.dest), { recursive: true })
    zip = await ZipWriter.create(partial)
    const entries: PackFileEntry[] = []
    const order = [...media.keys()]
    let doneBytes = 0
    for (let i = 0; i < order.length; i++) {
      if (opts.signal?.aborted) { await cleanup(); return fail('cancelled') }
      const id = order[i]
      const src = lib.packSource(id)
      if (!src?.path) { await cleanup(); return fail('missing-pictures', undefined, { missing: [{ id, name: src?.rec.name ?? 'A picture', status: src?.status ?? 'missing' }] }) }
      const rec = src.rec
      if (!/^(jpg|png|gif|webp|bmp|avif)$/.test(rec.ext)) { await cleanup(); return fail('bad-type', rec.name) }
      const path = `media/${rec.hash}.${rec.ext}`
      const added = await zip.addFile(path, src.path, {
        signal: opts.signal,
        expectedBytes: rec.bytes,
        onBytes: (n) => { doneBytes += n; opts.onProgress?.({ doneBytes, totalBytes: est.totalBytes, done: i, total: order.length, current: rec.name }) }
      })
      entries.push({
        path, sha256: added.sha256, bytes: added.bytes, libraryHash: rec.hash, name: rec.name, origFilename: rec.origFilename, ext: rec.ext as PackFileEntry['ext'],
        width: rec.width, height: rec.height, convertedFrom: rec.convertedFrom, roles: [...(media.get(id) ?? [])]
      })
    }
    const hashOf = new Map(order.map((id) => [id, lib.get(id)?.hash ?? '']))
    const manifest: PackManifest = {
      format: PACK_FORMAT,
      packVersion: PACK_VERSION,
      createdAt: new Date().toISOString(),
      app: opts.appVersion,
      title: opts.title,
      items: queue.map((it) => ({
        title: itemTitleOf(it),
        kind: it.kind,
        libraryHashes: it.kind === 'media' ? (it.mediaIds ?? [it.mediaId]).map((m) => hashOf.get(m) ?? '').filter(Boolean) : []
      })),
      files: entries,
      backgrounds: [
        ...Object.entries(opts.settings.backgrounds?.destinations ?? {}).flatMap(([id, b]) => (b?.mediaId && hashOf.get(b.mediaId) ? [{ scope: 'destination' as const, id, libraryHash: hashOf.get(b.mediaId)!, dim: b.dim ?? 0 }] : [])),
        ...Object.entries(opts.settings.backgrounds?.channels ?? {}).flatMap(([id, b]) => (b?.mediaId && hashOf.get(b.mediaId) ? [{ scope: 'channel' as const, id, libraryHash: hashOf.get(b.mediaId)!, dim: b.dim ?? 0 }] : []))
      ]
    }
    await zip.addBuffer(PACK_MANIFEST_NAME, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
    await zip.addBuffer(PACK_QUEUE_NAME, Buffer.from(JSON.stringify(queue, null, 2), 'utf8'))
    await zip.finish()
    // read it back: the index must parse and every entry must match, before the real name appears
    const check = await readAndVerify(partial, opts.signal)
    if (!check.ok) { await cleanup(); return check }
    if (existsSync(opts.dest)) rmSync(opts.dest, { force: true })
    renameSync(partial, opts.dest)
    return { ok: true, bytes: statSync(opts.dest).size, count: entries.length, path: opts.dest }
  } catch (e) {
    await cleanup()
    return mapZip(e)
  }
}

const itemTitleOf = (it: QueueItem): string => {
  const t = (it as { title?: string; name?: string; label?: string }).title ?? (it as { name?: string }).name ?? (it as { label?: string }).label
  return typeof t === 'string' && t ? t : it.kind
}

interface Verified {
  ok: true
  manifest: PackManifest
  queue: unknown[]
  zip: ZipReader
  entries: Map<string, ZipEntry>
  /** per picture: did its bytes match the manifest */
  good: Map<string, boolean>
  packBytes: number
}

const READ_LIMITS = { maxEntries: PACK_LIMITS.maxPictures + 2, maxTotalBytes: PACK_LIMITS.maxPackBytes, maxEntryBytes: PACK_LIMITS.maxPictureBytes }

/** Open a pack, validate the index, manifest and queue, and fingerprint every picture. Reads only. */
async function openAndVerify(path: string, signal?: AbortSignal, onProgress?: (done: number, total: number) => void): Promise<Verified | { ok: false; code: PackErrorCode; message: string; detail?: string }> {
  let zip: ZipReader | null = null
  try {
    zip = await ZipReader.open(path, READ_LIMITS)
    const entries = new Map(zip.entries.map((e) => [e.name, e]))
    const mEntry = entries.get(PACK_MANIFEST_NAME)
    if (!mEntry) { await zip.close(); return fail('not-a-pack', 'no manifest') }
    // every entry name must be on the allowed list
    for (const name of entries.keys()) {
      if (name !== PACK_MANIFEST_NAME && name !== PACK_QUEUE_NAME && !PACK_MEDIA_NAME.test(name)) { await zip.close(); return fail('bad-entry', name.slice(0, 80)) }
    }
    if (mEntry.size > PACK_LIMITS.maxManifestBytes) { await zip.close(); return fail('too-big', 'manifest') }
    let rawManifest: unknown
    try { rawManifest = JSON.parse((await zip.readBuffer(mEntry, PACK_LIMITS.maxManifestBytes)).toString('utf8')) } catch (e) {
      if (e instanceof ZipError) throw e
      await zip.close(); return fail('not-a-pack', 'manifest is not JSON')
    }
    const v = validateManifest(rawManifest)
    if (!v.ok) { await zip.close(); return fail(v.code) }
    const qEntry = entries.get(PACK_QUEUE_NAME)
    if (!qEntry) { await zip.close(); return fail('not-a-pack', 'no service file') }
    let queue: unknown
    try { queue = JSON.parse((await zip.readBuffer(qEntry, PACK_LIMITS.maxQueueBytes)).toString('utf8')) } catch (e) {
      if (e instanceof ZipError) throw e
      await zip.close(); return fail('damaged', 'service file is not readable')
    }
    if (!Array.isArray(queue)) { await zip.close(); return fail('damaged', 'service file is not a queue') }
    // the manifest and the zip must agree exactly on which pictures exist
    const manifestPaths = new Set(v.manifest.files.map((f) => f.path))
    for (const name of entries.keys()) if (PACK_MEDIA_NAME.test(name) && !manifestPaths.has(name)) { await zip.close(); return fail('bad-entry', 'a picture the manifest does not list') }
    const good = new Map<string, boolean>()
    let i = 0
    for (const f of v.manifest.files) {
      if (signal?.aborted) { await zip.close(); return fail('cancelled') }
      onProgress?.(i++, v.manifest.files.length)
      const e = entries.get(f.path)
      if (!e || e.size !== f.bytes) { good.set(f.libraryHash, false); continue }
      const sha = createHash('sha256')
      try {
        await zip.stream(e, (c) => { sha.update(c) }, signal)
        const digest = sha.digest('hex')
        // for ordinary pictures the picture's identity IS its fingerprint; a pack cannot claim another identity
        good.set(f.libraryHash, digest === f.sha256 && (f.convertedFrom !== null || f.libraryHash === digest))
      } catch (err) {
        if (err instanceof ZipError && err.code === 'cancelled') throw err
        if (err instanceof ZipError && err.code === 'truncated') throw err
        good.set(f.libraryHash, false)
      }
    }
    onProgress?.(v.manifest.files.length, v.manifest.files.length)
    return { ok: true, manifest: v.manifest, queue, zip, entries, good, packBytes: zip.fileSize }
  } catch (e) {
    try { await zip?.close() } catch { /* ignore */ }
    return mapZip(e)
  }
}

async function readAndVerify(path: string, signal?: AbortSignal): Promise<{ ok: true } | { ok: false; code: PackErrorCode; message: string; detail?: string }> {
  const v = await openAndVerify(path, signal)
  if (!v.ok) return v
  const bad = [...v.good.values()].filter((g) => !g).length
  await v.zip.close()
  return bad ? fail('damaged', 'read-back check failed') : { ok: true }
}

/** Step 1 of opening: read-only. Says what is in the pack and what would change. Nothing is copied. */
export async function inspectPack(lib: MediaLibrary, path: string, opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<PackResult<{ review: PackReview }>> {
  const v = await openAndVerify(path, opts.signal, opts.onProgress)
  if (!v.ok) return v
  try {
    const files: PackReviewFile[] = v.manifest.files.map((f) => ({
      libraryHash: f.libraryHash, name: f.name, bytes: f.bytes, roles: f.roles, width: f.width, height: f.height,
      state: !v.good.get(f.libraryHash) ? 'damaged' : lib.hasPicture(f.libraryHash) ? 'have' : 'new'
    }))
    const state = new Map(files.map((f) => [f.libraryHash, f.state]))
    const items = v.manifest.items.map((it) => {
      const hs = it.libraryHashes
      return { title: it.title, kind: it.kind, new: hs.filter((h) => state.get(h) === 'new').length, have: hs.filter((h) => state.get(h) === 'have').length, damaged: hs.filter((h) => state.get(h) === 'damaged').length }
    })
    const counts = { new: files.filter((f) => f.state === 'new').length, have: files.filter((f) => f.state === 'have').length, damaged: files.filter((f) => f.state === 'damaged').length }
    return {
      ok: true,
      review: {
        ok: true, path, title: v.manifest.title, createdAt: v.manifest.createdAt, packBytes: v.packBytes, items, files, counts,
        newBytes: files.filter((f) => f.state === 'new').reduce((n, f) => n + f.bytes, 0), backgrounds: v.manifest.backgrounds.length
      }
    }
  } finally {
    await v.zip.close()
  }
}

/** Step 2: copy the new pictures in (all or nothing) and hand back the queue. The caller replaces the queue only on success. */
export async function importPack(lib: MediaLibrary, path: string, opts: { signal?: AbortSignal; onProgress?: (p: { done: number; total: number; phase: 'checking' | 'copying' }) => void } = {}): Promise<PackResult<{ summary: PackImportSummary }>> {
  const v = await openAndVerify(path, opts.signal, (done, total) => opts.onProgress?.({ done, total, phase: 'checking' }))
  if (!v.ok) return v
  let staging: string | null = null
  try {
    const wanted = v.manifest.files.filter((f) => v.good.get(f.libraryHash) && !lib.hasPicture(f.libraryHash))
    const need = wanted.reduce((n, f) => n + f.bytes, 0)
    try {
      const s = statfsSync(lib.dir)
      if (need > 0 && Number(s.bavail) * Number(s.bsize) < need + 500 * 1024 * 1024) { await v.zip.close(); return fail('no-space') }
    } catch { /* cannot tell: let the copy report it */ }
    staging = lib.newStagingDir()
    const staged: Array<{ stagedPath: string; libraryHash: string; ext: string; name: string; origFilename: string; bytes: number; convertedFrom: string | null }> = []
    const { open } = await import('fs/promises')
    let n = 0
    for (const f of wanted) {
      if (opts.signal?.aborted) throw new ZipError('cancelled')
      opts.onProgress?.({ done: n++, total: wanted.length, phase: 'copying' })
      const entry = v.entries.get(f.path)!
      const out = join(staging, `${staged.length}.bin`)
      const fh = await open(out, 'w')
      const sha = createHash('sha256')
      try {
        let pos = 0
        await v.zip.stream(entry, async (c) => {
          sha.update(c)
          await fh.write(c, 0, c.length, pos)
          pos += c.length
        }, opts.signal)
      } finally {
        await fh.close()
      }
      if (sha.digest('hex') !== f.sha256) throw new ZipError('damaged', `${f.name} changed while it was being copied`)
      staged.push({ stagedPath: out, libraryHash: f.libraryHash, ext: f.ext, name: f.name, origFilename: f.origFilename, bytes: f.bytes, convertedFrom: f.convertedFrom })
    }
    let result
    try {
      result = await lib.importPackFiles(staged, { signal: opts.signal })
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'cancelled') throw new ZipError('cancelled')
      if (code === 'no-space') { return fail('no-space') }
      if (code === 'bad-type') return fail('bad-type', (e as Error).message)
      if (code === 'bad-entry') return fail('bad-entry', (e as Error).message)
      throw e
    }
    const damaged = v.manifest.files.filter((f) => !v.good.get(f.libraryHash)).length
    return { ok: true, summary: { added: result.added.length, already: v.manifest.files.length - damaged - wanted.length + result.already, damaged, backgrounds: v.manifest.backgrounds.length, queue: v.queue } }
  } catch (e) {
    return mapZip(e)
  } finally {
    await v.zip.close()
    if (staging) { try { rmSync(staging, { recursive: true, force: true }) } catch { /* swept at the next start */ } }
  }
}
