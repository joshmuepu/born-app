import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './keepStatements'
import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync, appendFileSync, mkdirSync, truncateSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MediaLibrary, normalizeTags, type MediaDecoder, type DecodeResult } from '../../main/mediaLibrary'
import { MEDIA_MIGRATIONS, MEDIA_SCHEMA_VERSION, MediaDbTooNewError, migrateMediaDb } from '../../main/mediaSchema'
import { readImageHeader } from '../../main/imageHeader'
import type { MediaImportOk, MediaImportFail } from '../../shared/media'

const FX = join(__dirname, '../fixtures/media')
const fx = (n: string): string => join(FX, n)

/** A stand-in for the browser engine: judges a file by its header and its end marker,
 *  which is exactly the difference between a whole picture and a cut-off one. */
const decoder = (over: Partial<MediaDecoder> = {}): MediaDecoder & { decoded: string[] } => {
  const decoded: string[] = []
  return {
    decoded,
    async decode(path): Promise<DecodeResult> {
      decoded.push(path)
      const b = readFileSync(path)
      const h = readImageHeader(b)
      const whole =
        (h.format === 'jpeg' && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9) ||
        (h.format === 'png' && b.includes(Buffer.from('IEND'))) ||
        (h.format === 'gif' && b[b.length - 1] === 0x3b) ||
        h.format === 'webp' || h.format === 'bmp' || h.format === 'avif'
      if (!whole || !h.width) return { ok: false, reason: 'corrupt' }
      return { ok: true, width: h.width, height: h.height ?? 0, hasAlpha: !!h.hasAlpha, thumbs: [{ width: 320, height: 240, ext: 'jpg', data: Buffer.from('t1') }, { width: 960, height: 720, ext: 'jpg', data: Buffer.from('t2') }] }
    },
    ...over
  }
}

let dir: string
let lib: MediaLibrary
let dec: ReturnType<typeof decoder>
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-media-test-'))
  dec = decoder()
  lib = new MediaLibrary({ dir: join(dir, 'lib'), decoder: dec })
})
afterEach(() => {
  try { lib.close() } catch { /* closed by the test */ }
  rmSync(dir, { recursive: true, force: true })
})
const ok = (r: unknown): MediaImportOk => {
  const x = r as MediaImportOk
  expect(x.ok, JSON.stringify(r)).toBe(true)
  return x
}
const bad = (r: unknown): MediaImportFail => {
  const x = r as MediaImportFail
  expect(x.ok).toBe(false)
  return x
}
const stray = (): string[] => {
  const out: string[] = []
  const walk = (d: string): void => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /tmp-|\.convert-/.test(n) && out.push(p) } }
  walk(lib.dir)
  return out
}

describe('media library: importing', () => {
  it('copies a picture into the managed folder under a path built from its hash only', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg')))
    expect(r.duplicate).toBe(false)
    expect(r.item).toMatchObject({ type: 'image', name: 'tiny', origFilename: 'tiny.jpg', ext: 'jpg', mime: 'image/jpeg', width: 64, height: 48, storage: 'managed', animated: false })
    const p = lib.resolvePath(r.item)!
    expect(p).toBe(join(lib.dir, 'files', r.item.hash.slice(0, 2), `${r.item.hash}.jpg`))
    expect(existsSync(p)).toBe(true)
    expect(readFileSync(p).equals(readFileSync(fx('tiny.jpg')))).toBe(true)
    expect(r.item.id).toMatch(/^m_[0-9a-f]{12}$/)
    expect(stray()).toEqual([])
  })

  it('keeps the picture the right way up: oriented size, and thumbnails written to the cache', async () => {
    const r = ok(await lib.importFile(fx('exif6.jpg')))
    expect([r.item.width, r.item.height]).toEqual([48, 64])
    expect(existsSync(lib.thumbPath(r.item.hash, 320, 'jpg'))).toBe(true)
    expect(existsSync(lib.thumbPath(r.item.hash, 960, 'jpg'))).toBe(true)
  })

  it('detects the same picture by content, whatever its name or place', async () => {
    const first = ok(await lib.importFile(fx('tiny.jpg')))
    const copy = join(dir, 'Sunday photo (2).jpeg')
    copyFileSync(fx('tiny.jpg'), copy)
    const second = ok(await lib.importFile(copy))
    expect(second.duplicate).toBe(true)
    expect(second.item.id).toBe(first.item.id)
    expect(lib.count().items).toBe(1)
    expect(readdirSync(join(lib.dir, 'files', first.item.hash.slice(0, 2)))).toHaveLength(1)
  })

  it('judges a file by its bytes, not its extension', async () => {
    const r = ok(await lib.importFile(fx('fake-named.png')))
    expect(r.item.ext).toBe('jpg')
    expect(r.item.mime).toBe('image/jpeg')
  })

  it.each([
    ['doc.pdf', 'is-pdf'],
    ['clip.mp4', 'video-truncated'], // the old fixture is only a stub (no whole file): now refused as incomplete
    ['song.mp3', 'unsupported-audio'],
    ['drawing.svg', 'unsupported'],
    ['not-an-image.jpg', 'corrupt'],
    ['empty.jpg', 'empty']
  ])('refuses %s with the code %s and a plain message', async (file, code) => {
    const r = bad(await lib.importFile(fx(file)))
    expect(r.code).toBe(code)
    expect(r.message.length).toBeGreaterThan(10)
    expect(lib.count().items).toBe(0)
    expect(stray()).toEqual([])
  })

  it('a cut-off GIF is refused as truncated (browsers show the frames that arrived, so the ending is checked)', async () => {
    const r = bad(await lib.importFile(fx('truncated.gif')))
    expect(r.code).toBe('truncated')
    expect(lib.count().items).toBe(0)
    expect(stray()).toEqual([])
    expect(ok(await lib.importFile(fx('anim.gif'))).item.animated).toBe(true) // the whole one is fine
  })

  it('preflight catches a file that was cut short after it was added (size changed, or ending missing)', async () => {
    const copy = join(dir, 'cut.gif')
    copyFileSync(fx('anim.gif'), copy)
    const r = ok(await lib.importFile(copy, { linkInPlace: true }))
    const g = readFileSync(copy)
    writeFileSync(copy, g.subarray(0, g.length - 20)) // an unfinished sync replaced it
    const p = await lib.preflight(r.item.id)
    expect(p.status).toBe('changed') // length check: no longer the size it was
    // same length but ending lost (overwritten with zeros): the ending check catches it
    writeFileSync(copy, Buffer.concat([g.subarray(0, g.length - 20), Buffer.alloc(20)]))
    utimesSync(copy, new Date(r.item.addedAt), new Date(r.item.addedAt))
    const rec = lib.get(r.item.id)!
    const st = statSync(copy)
    lib.db.prepare('UPDATE media_items SET link_mtime_ms = ? WHERE id = ?').run(Math.round(st.mtimeMs), rec.id)
    const p2 = await lib.preflight(r.item.id)
    expect(p2.deep).toBe('damaged')
    expect(p2.notes.join(' ')).toMatch(/cut short/)
  })

  // A USB stick is simulated with a path under /Volumes (or /media/...) that does not exist: the whole "drive" is absent.
  describe.skipIf(process.platform === 'win32')('linked pictures on a drive that is unplugged', () => {
    const gone = process.platform === 'darwin' ? '/Volumes/BORN_TEST_NOT_PLUGGED' : '/mnt/born-test-not-plugged'
    async function linkedOnGoneDrive(): Promise<{ id: string; file: string; hash: string }> {
      const file = join(dir, 'usb-file.jpg')
      copyFileSync(fx('tiny.jpg'), file)
      const r = ok(await lib.importFile(file, { linkInPlace: true }))
      lib.db.prepare('UPDATE media_items SET link_path = ? WHERE id = ?').run(`${gone}/Youth/usb-file.jpg`, r.item.id) // as if it had been imported from the stick
      return { id: r.item.id, file, hash: r.item.hash }
    }

    it('is "offline" (recoverable), not "missing"; preflight flags it; a file gone from a connected disk is still "missing"', async () => {
      const { id } = await linkedOnGoneDrive()
      expect(lib.check(id)).toBe('offline')
      expect(lib.checkAll()).toEqual([{ id, status: 'offline' }])
      expect((await lib.preflight(id)).status).toBe('offline')
      lib.db.prepare('UPDATE media_items SET link_path = ? WHERE id = ?').run(join(dir, 'deleted.jpg'), id)
      expect(lib.check(id)).toBe('missing')
    })

    it('Reconnect: finds the same pictures (by contents, whatever the name) in the folder the drive now has, and changes nothing else', async () => {
      const { id, hash } = await linkedOnGoneDrive()
      const other = ok(await lib.importFile(fx('tiny.png'))) // a normal copied picture is untouched
      const newHome = join(dir, 'F-drive', 'Slides')
      mkdirSync(newHome, { recursive: true })
      copyFileSync(fx('tiny.jpg'), join(newHome, 'renamed-after-the-move.jpg'))
      copyFileSync(fx('tiny.png'), join(newHome, 'decoy.png'))
      writeFileSync(join(newHome, 'same-size-different.jpg'), Buffer.alloc(statSync(fx('tiny.jpg')).size, 7))
      const r = await lib.reconnectLinked(join(dir, 'F-drive'))
      expect(r).toMatchObject({ relinked: 1, stillMissing: 0 })
      expect(lib.check(id)).toBe('ok')
      expect(lib.get(id)?.linkPath).toBe(join(newHome, 'renamed-after-the-move.jpg'))
      expect(lib.get(id)?.hash).toBe(hash)
      expect(lib.count().items).toBe(2) // nothing was added
      expect(lib.check(other.item.id)).toBe('ok')
    })

    it('Reconnect with the wrong folder finds nothing and says how many are still missing', async () => {
      await linkedOnGoneDrive()
      const empty = join(dir, 'empty-folder'); mkdirSync(empty)
      expect(await lib.reconnectLinked(empty)).toMatchObject({ relinked: 0, stillMissing: 1 })
    })

    it('Copy into library turns a linked picture into a normal one that no longer needs its drive', async () => {
      const file = join(dir, 'link-me.jpg'); copyFileSync(fx('tiny.jpg'), file)
      const r = ok(await lib.importFile(file, { linkInPlace: true }))
      expect(await lib.copyIntoLibrary(r.item.id)).toEqual({ ok: true })
      const rec = lib.get(r.item.id)!
      expect(rec).toMatchObject({ storage: 'managed', linkPath: null })
      rmSync(file) // the original can vanish now
      expect(lib.check(r.item.id)).toBe('ok')
      expect(await lib.copyIntoLibrary(r.item.id)).toMatchObject({ ok: false })
    })

    it('Copy into library refuses while the drive is unplugged, and changes nothing', async () => {
      const { id } = await linkedOnGoneDrive()
      expect(await lib.copyIntoLibrary(id)).toMatchObject({ ok: false })
      expect(lib.get(id)?.storage).toBe('linked')
    })
  })

  it('refuses a cut-off picture as truncated and leaves nothing behind', async () => {
    const r = bad(await lib.importFile(fx('truncated.jpg')))
    expect(r.code).toBe('truncated')
    expect(lib.count().items).toBe(0)
    expect(readdirSync(lib.filesDir)).toEqual([])
    expect(stray()).toEqual([])
  })

  it('reports a missing file and a folder clearly', async () => {
    expect(bad(await lib.importFile(join(dir, 'nope.jpg'))).code).toBe('not-found')
    expect(bad(await lib.importFile(dir)).code).toBe('not-a-file')
    expect(bad(await lib.importFile('relative/path.jpg')).code).toBe('not-found')
  })

  it('HEIC: refused with the iPhone instructions when the OS cannot convert it', async () => {
    const r = bad(await lib.importFile(fx('phone.heic')))
    expect(r.code).toBe('unsupported-heic')
    expect(r.message).toMatch(/Most Compatible/)
  })

  it('HEIC: stored as a JPEG, remembering where it came from, when the OS can convert it', async () => {
    lib.close()
    const withConvert = decoder({ async convertToJpeg(_src, out) { copyFileSync(fx('tiny.jpg'), out); return true } })
    lib = new MediaLibrary({ dir: join(dir, 'lib'), decoder: withConvert })
    const r = ok(await lib.importFile(fx('phone.heic')))
    expect(r.item).toMatchObject({ ext: 'jpg', convertedFrom: 'heic', origFilename: 'phone.heic' })
    expect(stray()).toEqual([])
    // importing the same HEIC again is a duplicate of the original bytes
    expect(ok(await lib.importFile(fx('phone.heic'))).duplicate).toBe(true)
  })

  it('HEIC/TIFF: real conversion — stored as JPEG, original kept beside it, a duplicate is spotted, purge removes both', async () => {
    // The converter itself is tested on real files in imageConvert.test.ts. Here a stand-in writes a JPEG of the right shape, because
    // running the WebAssembly decoder in the same process as better-sqlite3 makes Node crash while it cleans up (a test-process quirk;
    // in the app the decoder runs in its own worker thread).
    dec.convertToJpeg = async (_src, out) => { copyFileSync(fx('tiny.jpg'), out); return { ok: true, notes: ['Colours were converted to sRGB for the screen.'] } }
    const r = ok(await lib.importFile(fx('heic-rot6.heic')))
    expect(r.item).toMatchObject({ ext: 'jpg', convertedFrom: 'heic' })
    expect(r.warnings.join(' ')).toMatch(/sRGB/)
    const orig = lib.originalPath(r.item.hash, 'heic')
    expect(existsSync(orig)).toBe(true)
    expect(readFileSync(orig).equals(readFileSync(fx('heic-rot6.heic')))).toBe(true)
    expect(ok(await lib.importFile(fx('heic-rot6.heic'))).duplicate).toBe(true)
    const t = ok(await lib.importFile(fx('tiff-quad.tiff')))
    expect(t.item).toMatchObject({ ext: 'jpg', convertedFrom: 'tiff' })
    expect(stray()).toEqual([])
    lib.remove([r.item.id])
    lib.purge(0)
    expect(existsSync(orig)).toBe(false)
  })

  it('HEIC: a damaged file is reported as damaged (not "unsupported"), the batch is unharmed, nothing is left behind', async () => {
    dec.convertToJpeg = async (src) => (src.includes('corrupt') ? { ok: false, reason: 'corrupt' } : false)
    const out = await lib.importPaths([fx('heic-corrupt.heic'), fx('tiny.jpg')])
    expect(out.results.map((x) => x.ok)).toEqual([false, true])
    expect(out.results[0]).toMatchObject({ code: 'corrupt' })
    expect(stray()).toEqual([])
  })

  it('animated pictures are kept and flagged, with a warning', async () => {
    const r = ok(await lib.importFile(fx('anim.gif')))
    expect(r.item.animated).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/Animated/)
  })

  it('refuses to copy when there is not enough free disk space, and writes nothing', async () => {
    lib.close()
    lib = new MediaLibrary({ dir: join(dir, 'lib'), decoder: dec, freeBytes: () => 1000 })
    const r = bad(await lib.importFile(fx('tiny.jpg')))
    expect(r.code).toBe('no-space')
    expect(lib.count().items).toBe(0)
    expect(readdirSync(lib.filesDir)).toEqual([])
  })

  it('importPaths: walks folders, skips non-pictures, and one bad file never stops the rest', async () => {
    const src = join(dir, 'Church photos')
    mkdirSync(join(src, 'Easter'), { recursive: true })
    copyFileSync(fx('tiny.jpg'), join(src, 'a.jpg'))
    copyFileSync(fx('tiny.png'), join(src, 'Easter', 'b.png'))
    copyFileSync(fx('truncated.jpg'), join(src, 'broken.jpg'))
    writeFileSync(join(src, 'notes.txt'), 'hello')
    const seen: number[] = []
    const { results, skipped } = await lib.importPaths([src], {}, (p) => seen.push(p.done))
    expect(results.filter((r) => r.ok)).toHaveLength(2)
    expect(results.filter((r) => !r.ok)).toHaveLength(1)
    expect(skipped).toBe(1)
    expect(seen[seen.length - 1]).toBe(3)
  })
})

describe('media library: linking in place', () => {
  it('never copies, and never touches the original — not on remove, not on purge', async () => {
    const orig = join(dir, 'Big scan.png')
    copyFileSync(fx('tiny.png'), orig)
    const before = readFileSync(orig)
    const r = ok(await lib.importFile(orig, { linkInPlace: true }))
    expect(r.item.storage).toBe('linked')
    expect(r.item.linkPath).toBe(orig)
    expect(readdirSync(lib.filesDir)).toEqual([])
    lib.remove([r.item.id])
    expect(lib.purge(0)).toMatchObject({ purged: 1, filesDeleted: 0 })
    expect(existsSync(orig)).toBe(true)
    expect(readFileSync(orig).equals(before)).toBe(true)
  })

  it('notices a moved original (missing) and an edited one (changed)', async () => {
    const orig = join(dir, 'linked.jpg')
    copyFileSync(fx('tiny.jpg'), orig)
    const r = ok(await lib.importFile(orig, { linkInPlace: true }))
    expect(lib.check(r.item.id)).toBe('ok')
    appendFileSync(orig, 'x')
    expect(lib.check(r.item.id)).toBe('changed')
    rmSync(orig)
    expect(lib.check(r.item.id)).toBe('missing')
    expect(lib.checkAll()).toEqual([{ id: r.item.id, status: 'missing' }])
  })

  it('relink: accepts the same bytes in a new place, rejects a different picture', async () => {
    const orig = join(dir, 'a.png')
    copyFileSync(fx('tiny.png'), orig)
    const r = ok(await lib.importFile(orig, { linkInPlace: true }))
    rmSync(orig)
    expect(lib.check(r.item.id)).toBe('missing')
    const other = join(dir, 'other.png')
    copyFileSync(fx('alpha.png'), other)
    expect((await lib.relink(r.item.id, other)).ok).toBe(false)
    const moved = join(dir, 'moved.png')
    copyFileSync(fx('tiny.png'), moved)
    expect((await lib.relink(r.item.id, moved)).ok).toBe(true)
    expect(lib.check(r.item.id)).toBe('ok')
    expect(lib.get(r.item.id)!.linkPath).toBe(moved)
  })
})

describe('media library: health of managed copies', () => {
  it('a deleted or shortened managed file is flagged, not silently shown', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg')))
    const p = lib.resolvePath(r.item)!
    expect(lib.check(r.item.id)).toBe('ok')
    truncateSync(p, 100)
    expect(lib.check(r.item.id)).toBe('changed')
    rmSync(p)
    expect(lib.check(r.item.id)).toBe('missing')
  })
  it('verifyHash catches a same-size corruption that stat cannot', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg')))
    const p = lib.resolvePath(r.item)!
    expect(await lib.verifyHash(r.item.id)).toBe(true)
    const b = readFileSync(p)
    b[100] ^= 0xff
    writeFileSync(p, b)
    expect(lib.check(r.item.id)).toBe('ok')
    expect(await lib.verifyHash(r.item.id)).toBe(false)
  })
})

describe('media library: removing, undo and purge', () => {
  it('remove is undoable; the file is only erased by purge, and only after the undo window', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg')))
    const p = lib.resolvePath(r.item)!
    lib.remove([r.item.id])
    expect(lib.list()).toHaveLength(0)
    expect(lib.count().trashed).toBe(1)
    expect(existsSync(p)).toBe(true)
    expect(lib.purge()).toMatchObject({ purged: 0 }) // inside the window
    expect(lib.restore([r.item.id])).toHaveLength(1)
    expect(lib.list()).toHaveLength(1)
    lib.remove([r.item.id])
    expect(lib.purge(0)).toMatchObject({ purged: 1, filesDeleted: 1 })
    expect(existsSync(p)).toBe(false)
    expect(existsSync(lib.thumbPath(r.item.hash, 320, 'jpg'))).toBe(false)
  })

  it('importing a picture that is in the trash brings the old item back with its tags', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg'), { tags: ['Easter'] }))
    lib.remove([r.item.id])
    const again = ok(await lib.importFile(fx('tiny.jpg')))
    expect(again.restored).toBe(true)
    expect(again.item.id).toBe(r.item.id)
    expect(again.item.tags).toEqual(['easter'])
  })

  it('a picture shared by hash is not erased while another live item still uses it', async () => {
    const a = ok(await lib.importFile(fx('tiny.jpg')))
    lib.remove([a.item.id])
    const b = ok(await lib.importFile(fx('tiny.jpg'))) // restored same id
    expect(b.item.id).toBe(a.item.id)
    expect(existsSync(lib.resolvePath(b.item)!)).toBe(true)
  })
})

describe('media library: organising', () => {
  it('normalises tags, searches name/file/tag, filters favourites and folders', async () => {
    expect(normalizeTags(['  Easter ', 'EASTER', 'kids  club', '', 'x'.repeat(80)])).toEqual(['easter', 'kids club', 'x'.repeat(40)])
    const a = ok(await lib.importFile(fx('tiny.jpg'), { tags: ['easter'] }))
    const b = ok(await lib.importFile(fx('tiny.png')))
    lib.rename(b.item.id, 'Baptism banner')
    lib.setFavorite(b.item.id, true)
    const f = lib.createFolder('Sundays')
    lib.moveToFolder([a.item.id], f.id)
    expect(lib.list({ search: 'bapt' }).map((i) => i.id)).toEqual([b.item.id])
    expect(lib.list({ search: 'easter' }).map((i) => i.id)).toEqual([a.item.id])
    expect(lib.list({ search: 'tiny.jpg' }).map((i) => i.id)).toEqual([a.item.id])
    expect(lib.list({ favoritesOnly: true }).map((i) => i.id)).toEqual([b.item.id])
    expect(lib.list({ folderId: f.id }).map((i) => i.id)).toEqual([a.item.id])
    expect(lib.list({ folderId: null }).map((i) => i.id)).toEqual([b.item.id])
    expect(lib.list({ search: '%' })).toEqual([]) // wildcards are not special
    expect(lib.allTags()).toEqual([{ tag: 'easter', count: 1 }])
  })

  it('deleting a folder never deletes pictures: they move up', async () => {
    const parent = lib.createFolder('Events')
    const child = lib.createFolder('Easter', parent.id)
    const a = ok(await lib.importFile(fx('tiny.jpg')))
    lib.moveToFolder([a.item.id], child.id)
    lib.deleteFolder(child.id)
    expect(lib.get(a.item.id)!.folderId).toBe(parent.id)
    expect(lib.list()).toHaveLength(1)
  })

  it('stable ids survive a restart', async () => {
    const a = ok(await lib.importFile(fx('tiny.jpg')))
    lib.close()
    lib = new MediaLibrary({ dir: join(dir, 'lib'), decoder: dec })
    expect(lib.get(a.item.id)).toMatchObject({ id: a.item.id, hash: a.item.hash })
  })
})

describe('media library: path and name safety', () => {
  it('a hostile hash or extension never resolves to a path outside the library', () => {
    const base = { storage: 'managed' as const, linkPath: null }
    expect(lib.resolvePath({ ...base, hash: '../../etc/passwd', ext: 'jpg' })).toBeNull()
    expect(lib.resolvePath({ ...base, hash: 'a'.repeat(64), ext: '../x' })).toBeNull()
    expect(lib.resolvePath({ storage: 'linked', linkPath: 'relative.jpg', hash: 'a'.repeat(64), ext: 'jpg' })).toBeNull()
    expect(lib.resolvePath({ storage: 'linked', linkPath: '/a\0b.jpg', hash: 'a'.repeat(64), ext: 'jpg' })).toBeNull()
  })
  it('a file name never becomes a storage path; control characters are stripped from display names', async () => {
    const odd = join(dir, 'Sunday: "Welcome" <slide>?.jpg')
    copyFileSync(fx('tiny.jpg'), odd)
    const r = ok(await lib.importFile(odd))
    expect(lib.resolvePath(r.item)).toMatch(/files\/[0-9a-f]{2}\/[0-9a-f]{64}\.jpg$|files\\[0-9a-f]{2}\\[0-9a-f]{64}\.jpg$/)
    lib.rename(r.item.id, 'Line1\u0000\nLine2')
    expect(lib.get(r.item.id)!.name).toBe('Line1 Line2')
  })
  it('sweepTemp removes leftovers of an interrupted import', () => {
    mkdirSync(join(lib.filesDir, 'ab'), { recursive: true })
    writeFileSync(join(lib.filesDir, 'ab', 'x.jpg.tmp-1234'), 'half')
    writeFileSync(join(lib.dir, '.convert-ab12.jpg'), 'half')
    expect(lib.sweepTemp()).toBe(2)
    expect(stray()).toEqual([])
  })
})

describe('media.db migrations', () => {
  it('a new database is created at the current version, with the expected tables', () => {
    const v = lib.db.pragma('user_version', { simple: true })
    expect(v).toBe(MEDIA_SCHEMA_VERSION)
    const tables = (lib.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((t) => t.name)
    expect(tables).toEqual(expect.arrayContaining(['media_items', 'media_tags', 'media_folders']))
  })
  it('reopening is a no-op and keeps every row', async () => {
    ok(await lib.importFile(fx('tiny.jpg')))
    lib.close()
    lib = new MediaLibrary({ dir: join(dir, 'lib'), decoder: dec })
    expect(lib.count().items).toBe(1)
  })
  it('upgrades an existing database in place without touching unrelated tables', () => {
    const p = join(dir, 'old.db')
    const old = new Database(p)
    old.exec("CREATE TABLE something_else (x TEXT); INSERT INTO something_else VALUES ('keep me');")
    expect(migrateMediaDb(old)).toEqual({ from: 0, to: MEDIA_SCHEMA_VERSION })
    expect(old.prepare('SELECT x FROM something_else').get()).toEqual({ x: 'keep me' })
    expect(migrateMediaDb(old)).toEqual({ from: MEDIA_SCHEMA_VERSION, to: MEDIA_SCHEMA_VERSION })
    old.close()
  })
  it('refuses a database written by a newer BORN instead of damaging it', () => {
    const p = join(dir, 'new.db')
    const d = new Database(p)
    d.pragma(`user_version = ${MEDIA_MIGRATIONS.length + 5}`)
    expect(() => migrateMediaDb(d)).toThrow(MediaDbTooNewError)
    expect(d.pragma('user_version', { simple: true })).toBe(MEDIA_MIGRATIONS.length + 5)
    d.close()
  })
  it('a failing migration rolls back completely', () => {
    const d = new Database(join(dir, 'tx.db'))
    const spy = MEDIA_MIGRATIONS.slice()
    MEDIA_MIGRATIONS.length = 0
    MEDIA_MIGRATIONS.push((db) => { db.exec('CREATE TABLE a (x)'); throw new Error('boom') })
    try {
      expect(() => migrateMediaDb(d)).toThrow('boom')
      expect(d.prepare("SELECT name FROM sqlite_master WHERE name='a'").get()).toBeUndefined()
      expect(d.pragma('user_version', { simple: true })).toBe(0)
    } finally {
      MEDIA_MIGRATIONS.length = 0
      MEDIA_MIGRATIONS.push(...spy)
      d.close()
    }
  })
})

describe('media library: the pre-service check (preflight)', () => {
  it('a healthy picture passes and has its screen-sized copy ready', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg')))
    const pf = await lib.preflight(r.item.id)
    expect(pf).toMatchObject({ status: 'ok', deep: 'ok', width: 64, height: 48 })
    expect(pf.notes.join(' ')).toMatch(/Small/)
  })
  it('catches a same-size silently damaged managed file that stat alone cannot', async () => {
    const r = ok(await lib.importFile(fx('tiny.jpg')))
    const p = lib.resolvePath(r.item)!
    const b = readFileSync(p); b[200] ^= 0xff; writeFileSync(p, b)
    expect(lib.check(r.item.id)).toBe('ok')
    const pf = await lib.preflight(r.item.id)
    expect(pf.deep).toBe('damaged')
  })
  it('reports a missing file and a file that no longer decodes', async () => {
    const r = ok(await lib.importFile(fx('tiny.png')))
    rmSync(lib.resolvePath(r.item)!)
    expect((await lib.preflight(r.item.id)).status).toBe('missing')
    const orig = join(dir, 'x.jpg'); copyFileSync(fx('tiny.jpg'), orig)
    const l = ok(await lib.importFile(orig, { linkInPlace: true }))
    const st = statSync(orig)
    const b = readFileSync(orig); b[b.length - 1] = 0; b[b.length - 2] = 0; writeFileSync(orig, b) // same size, end marker gone
    const later = new Date(st.mtimeMs + 5000)
    utimesSync(orig, later, later)
    expect((await lib.preflight(l.item.id)).status).toBe('changed') // the edit is noticed by its modified time
    utimesSync(orig, st.atime, st.mtime) // …unless something put the time back: then only opening it can tell
    expect((await lib.preflight(l.item.id)).deep).toBe('undecodable')
  })
  it('an unknown id is reported, not thrown', async () => {
    expect((await lib.preflight('m_000000000000')).status).toBe('missing')
  })
})

describe('media library: sharing — find pictures by what they are', () => {
  it('findByHashes answers only for pictures it has (live ones)', async () => {
    const a = ok(await lib.importFile(fx('tiny.jpg')))
    const missing = 'c'.repeat(64)
    expect(lib.findByHashes([a.item.hash, missing, 'not-a-hash'])).toEqual({ [a.item.hash]: a.item.id })
    lib.remove([a.item.id])
    expect(lib.findByHashes([a.item.hash])).toEqual({})
  })
  it('locateInFolder finds matches by content in a messy folder tree and adds only those', async () => {
    const src = join(dir, 'USB stick')
    mkdirSync(join(src, 'Easter', 'deep'), { recursive: true })
    copyFileSync(fx('tiny.jpg'), join(src, 'Easter', 'deep', 'IMG_0042 final FINAL.jpeg'))
    copyFileSync(fx('tiny.png'), join(src, 'unrelated.png'))
    writeFileSync(join(src, 'notes.txt'), 'x')
    const jpg = readFileSync(fx('tiny.jpg'))
    const h = (await import('../../main/mediaLibrary')).hashFile
    const wanted = [{ hash: await h(fx('tiny.jpg')), bytes: jpg.length }, { hash: 'd'.repeat(64), bytes: 999999 }]
    const r = await lib.locateInFolder(src, wanted)
    expect(Object.keys(r.found)).toEqual([wanted[0].hash])
    expect(lib.count().items).toBe(1) // the unrelated picture was NOT added
    expect(r.scanned).toBe(3)
  })
})
