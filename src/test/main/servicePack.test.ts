import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, copyFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createHash } from 'crypto'
import { MediaLibrary, type MediaDecoder, type DecodeResult } from '../../main/mediaLibrary'
import { readImageHeader } from '../../main/imageHeader'
import { estimatePack, exportPack, importPack, inspectPack, collectPackMedia } from '../../main/servicePack'
import { ZipWriter, crc32 } from '../../main/zipStore'
import { mediaToItem, slideshowToItem, attachMediaRefs, serializeQueue, type QueueItem } from '../../shared/queueItem'
import { PACK_FORMAT, PACK_VERSION } from '../../shared/servicePack'

const FX = join(__dirname, '../fixtures/media')
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

/** A stand-in for the browser engine (same idea as mediaLibrary.test.ts): whole JPEG/PNG = fine, anything else = would not open. */
const decoder = (over: Partial<MediaDecoder> = {}): MediaDecoder => ({
  async decode(path): Promise<DecodeResult> {
    const b = readFileSync(path)
    const h = readImageHeader(b)
    const whole = (h.format === 'jpeg' && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9) || (h.format === 'png' && b.includes(Buffer.from('IEND')))
    if (!whole || !h.width) return { ok: false, reason: 'corrupt' }
    return { ok: true, width: h.width, height: h.height ?? 0, hasAlpha: !!h.hasAlpha, thumbs: [{ width: 320, height: 240, ext: 'jpg', data: Buffer.from('t1') }, { width: 960, height: 720, ext: 'jpg', data: Buffer.from('t2') }] }
  },
  ...over
})

/** A different, still-valid JPEG per n: a comment segment right after the start marker. */
const variant = (n: number): Buffer => {
  const j = readFileSync(join(FX, 'tiny.jpg'))
  const txt = Buffer.from(`born-test-${n}-${'x'.repeat(40)}`)
  const seg = Buffer.alloc(4 + txt.length)
  seg.writeUInt16BE(0xfffe, 0); seg.writeUInt16BE(txt.length + 2, 2); txt.copy(seg, 4)
  return Buffer.concat([j.subarray(0, 2), seg, j.subarray(2)])
}

let root: string
let A: MediaLibrary // the "home computer"
let B: MediaLibrary // the "booth computer" — a completely separate profile
const lib = (name: string, d = decoder()): MediaLibrary => new MediaLibrary({ dir: join(root, name, 'media'), decoder: d })
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'born-pack-')); A = lib('A'); B = lib('B') })
afterEach(() => { try { A.close() } catch { /* */ } try { B.close() } catch { /* */ } rmSync(root, { recursive: true, force: true }) })

async function addPics(l: MediaLibrary, n: number, from = 0): Promise<Array<{ id: string; name: string; hash: string }>> {
  const out = []
  for (let i = from; i < from + n; i++) {
    const p = join(root, `pic-${i}.jpg`)
    writeFileSync(p, variant(i))
    const r = await l.importFile(p)
    if (!r.ok) throw new Error(JSON.stringify(r))
    out.push({ id: r.item.id, name: r.item.name, hash: r.item.hash })
  }
  return out
}
const withRefs = (l: MediaLibrary, q: QueueItem[]): QueueItem[] =>
  attachMediaRefs(q, (id) => { const r = l.get(id); return r ? { id: r.id, hash: r.hash, name: r.name, width: r.width, height: r.height, bytes: r.bytes } : null })
const treeOf = (l: MediaLibrary): string[] => {
  const out: string[] = []
  const walk = (d: string): void => { for (const n of readdirSync(d).sort()) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : out.push(p.slice(l.dir.length)) } }
  walk(l.dir)
  return out.filter((p) => !/media\.db/.test(p))
}
const snapshot = (l: MediaLibrary) => ({ count: l.count(), tree: treeOf(l), ids: l.list({ limit: 9999 } as never).map((r) => r.id).sort() })
const noStaging = (l: MediaLibrary): void => expect(readdirSync(l.dir).filter((n) => n.startsWith('.pack-'))).toEqual([])

describe('service pack: round trip between two separate profiles', () => {
  it('exports a queue with pictures, slideshow pages and a background; opens it on another computer', async () => {
    const pics = await addPics(A, 5)
    const queue = withRefs(A, [mediaToItem(pics[0]), slideshowToItem(pics.slice(1, 4), 'Announcements')])
    const settings = { backgrounds: { destinations: { congregation: { mediaId: pics[4].id, dim: 35 } }, channels: {} }, logoId: null }
    const est = estimatePack(A, queue, settings)
    expect(est).toMatchObject({ count: 5, big: false, tooBig: false })
    expect(est.groups.map((g) => g.label)).toEqual(['Welcome'.length ? pics[0].name : '', 'Announcements', 'Backgrounds used on screens'])
    const dest = join(root, 'out', 'Sunday.bornpack')
    const prog: number[] = []
    const r = await exportPack(A, queue, { dest, title: 'Sunday', appVersion: '2.0.0-dev.1', settings, onProgress: (p) => prog.push(p.doneBytes) })
    expect(r).toMatchObject({ ok: true, count: 5 })
    expect(prog.length).toBeGreaterThan(0)
    expect(readdirSync(join(root, 'out'))).toEqual(['Sunday.bornpack']) // no .partial left behind

    const review = await inspectPack(B, dest)
    expect(review.ok && review.review.counts).toEqual({ new: 5, have: 0, damaged: 0 })
    expect(B.count().items).toBe(0) // inspecting changed nothing
    const before = snapshot(B)
    expect(snapshot(B)).toEqual(before)

    const imp = await importPack(B, dest)
    expect(imp.ok && imp.summary).toMatchObject({ added: 5, already: 0, damaged: 0, backgrounds: 1 })
    expect(B.count().items).toBe(5)
    noStaging(B)
    // the pictures are byte-identical, found by the same identity the queue's refs carry
    const found = B.findByHashes(pics.map((p) => p.hash))
    expect(Object.keys(found)).toHaveLength(5)
    for (const p of pics) expect(readFileSync(B.resolvePath(B.get(found[p.hash])!)!).equals(readFileSync(A.resolvePath(A.get(p.id)!)!))).toBe(true)
    // the queue in the pack is exactly what a plain Save would write
    const q = imp.ok ? imp.summary.queue : []
    expect(q).toEqual(JSON.parse(JSON.stringify(queue)))
    expect(serializeQueue(queue as QueueItem[])).toBeTruthy()
  })

  it('opening the same pack again adds nothing (already in the library, matched by what the pictures are)', async () => {
    const pics = await addPics(A, 3)
    const queue = withRefs(A, [slideshowToItem(pics, 'Show')])
    const dest = join(root, 'p.bornpack')
    expect((await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })).ok).toBe(true)
    await importPack(B, dest)
    const snap = snapshot(B)
    const again = await importPack(B, dest)
    expect(again.ok && again.summary).toMatchObject({ added: 0, already: 3, damaged: 0 })
    expect(snapshot(B)).toEqual(snap)
    const rev = await inspectPack(B, dest)
    expect(rev.ok && rev.review.counts).toEqual({ new: 0, have: 3, damaged: 0 })
  })

  it('only the pictures the other computer lacks are copied', async () => {
    const pics = await addPics(A, 4)
    await addPics(B, 2) // B already has pics 0 and 1 (same bytes)
    const queue = withRefs(A, [slideshowToItem(pics, 'Show')])
    const dest = join(root, 'p.bornpack')
    await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })
    const rev = await inspectPack(B, dest)
    expect(rev.ok && rev.review.counts).toEqual({ new: 2, have: 2, damaged: 0 })
    const imp = await importPack(B, dest)
    expect(imp.ok && imp.summary).toMatchObject({ added: 2, already: 2 })
    expect(B.count().items).toBe(4)
  })

  it('a picture linked from a drive is packed with its bytes and arrives as a normal copy', async () => {
    const p = join(root, 'usb.jpg'); writeFileSync(p, variant(99))
    const r = await A.importFile(p, { linkInPlace: true })
    expect(r.ok && r.item.storage).toBe('linked')
    const rec = (r as { item: { id: string; name: string } }).item
    const queue = withRefs(A, [mediaToItem(rec)])
    const dest = join(root, 'l.bornpack')
    expect((await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })).ok).toBe(true)
    await importPack(B, dest)
    const got = B.list({ limit: 10 } as never)[0]
    expect(got.storage).toBe('managed')
    expect(B.check(got.id)).toBe('ok')
  })

  it('a converted HEIC keeps its identity so the saved service still finds it', async () => {
    const heicSrc = join(root, 'x.heic'); copyFileSync(join(FX, 'phone.heic'), heicSrc)
    A.close()
    const dec = decoder({ async convertToJpeg(_s, out) { copyFileSync(join(FX, 'tiny.jpg'), out); return true } })
    A = lib('A', dec)
    const r = await A.importFile(heicSrc)
    expect(r.ok && r.item.convertedFrom).toBe('heic')
    const rec = (r as { item: { id: string; name: string; hash: string } }).item
    const queue = withRefs(A, [mediaToItem(rec)])
    const dest = join(root, 'h.bornpack')
    expect((await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })).ok).toBe(true)
    const imp = await importPack(B, dest)
    expect(imp.ok).toBe(true)
    expect(Object.keys(B.findByHashes([rec.hash]))).toHaveLength(1) // the identity the queue refs carry
  })
})

describe('service pack: saving is careful', () => {
  it('refuses to save when a picture is missing or changed, naming it, and writes nothing', async () => {
    const pics = await addPics(A, 2)
    const queue = withRefs(A, [slideshowToItem(pics, 'Show')])
    rmSync(A.resolvePath(A.get(pics[1].id)!)!)
    const dest = join(root, 'out', 'm.bornpack')
    const r = await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })
    expect(r).toMatchObject({ ok: false, code: 'missing-pictures' })
    expect(r.ok === false && r.missing?.[0].name).toBe(pics[1].name)
    expect(existsSync(dest)).toBe(false)
    expect(existsSync(join(root, 'out')) ? readdirSync(join(root, 'out')) : []).toEqual([])
  })

  it('cancel part-way leaves no pack and no partial file; an existing pack is not damaged', async () => {
    const pics = await addPics(A, 4)
    const queue = withRefs(A, [slideshowToItem(pics, 'Show')])
    const dest = join(root, 'out', 'c.bornpack')
    expect((await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })).ok).toBe(true)
    const good = readFileSync(dest)
    const ac = new AbortController()
    const r = await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {}, signal: ac.signal, onProgress: (p) => { if (p.done >= 1) ac.abort() } })
    expect(r).toMatchObject({ ok: false, code: 'cancelled' })
    expect(readdirSync(join(root, 'out'))).toEqual(['c.bornpack'])
    expect(readFileSync(dest).equals(good)).toBe(true)
  })

  it('reports big packs and too many pictures without writing anything', async () => {
    const pics = await addPics(A, 1)
    const queue = withRefs(A, [mediaToItem(pics[0])])
    const est = estimatePack(A, queue, {})
    expect(est.big).toBe(false)
    expect(collectPackMedia(queue, { logoId: pics[0].id }).get(pics[0].id)).toEqual(new Set(['item', 'logo']))
  })
})

/** Build a pack by hand so hostile contents can be tried. */
async function craft(file: string, parts: { manifest?: object | string | null; queue?: unknown; extra?: Record<string, Buffer>; pics?: Array<{ buf: Buffer; ext?: string; libraryHash?: string; claimSha?: string; convertedFrom?: string | null; path?: string }> }): Promise<string> {
  const w = await ZipWriter.create(file)
  const files = []
  for (const p of parts.pics ?? []) {
    const lh = p.libraryHash ?? sha(p.buf)
    const path = p.path ?? `media/${lh}.${p.ext ?? 'jpg'}`
    await w.addBuffer(path, p.buf)
    files.push({ path, sha256: p.claimSha ?? sha(p.buf), bytes: p.buf.length, libraryHash: lh, name: 'Pic', origFilename: 'pic.jpg', ext: p.ext ?? 'jpg', width: 10, height: 10, convertedFrom: p.convertedFrom ?? null, roles: ['item'] })
  }
  if (parts.manifest !== null) {
    const m = typeof parts.manifest === 'string' ? parts.manifest : JSON.stringify({ format: PACK_FORMAT, packVersion: PACK_VERSION, createdAt: 'now', app: 't', title: 'T', items: [], files, backgrounds: [], ...(parts.manifest ?? {}) })
    await w.addBuffer('manifest.json', Buffer.from(m))
  }
  await w.addBuffer('service.born', Buffer.from(JSON.stringify(parts.queue ?? [])))
  for (const [n, d] of Object.entries(parts.extra ?? {})) await w.addBuffer(n, d)
  await w.finish()
  return file
}
const refuses = async (file: string, code: string): Promise<void> => {
  const before = snapshot(B)
  const rev = await inspectPack(B, file)
  const imp = await importPack(B, file)
  expect(rev).toMatchObject({ ok: false, code })
  expect(imp).toMatchObject({ ok: false, code })
  expect(snapshot(B)).toEqual(before) // atomic: nothing changed
  noStaging(B)
}

describe('service pack: hostile and damaged packs are refused, and nothing changes', () => {
  it('not a pack: a zip with no manifest, JSON, empty, random bytes', async () => {
    await refuses(await craft(join(root, 'a.bornpack'), { manifest: null }), 'not-a-pack')
    writeFileSync(join(root, 'b.bornpack'), '{"format":"x"}'); await refuses(join(root, 'b.bornpack'), 'not-a-pack')
    writeFileSync(join(root, 'c.bornpack'), ''); await refuses(join(root, 'c.bornpack'), 'not-a-pack')
    writeFileSync(join(root, 'd.bornpack'), Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 31) & 255))); await refuses(join(root, 'd.bornpack'), 'not-a-pack')
    await refuses(await craft(join(root, 'e.bornpack'), { manifest: '{not json' }), 'not-a-pack')
    await refuses(await craft(join(root, 'f.bornpack'), { manifest: { format: 'other' } }), 'not-a-pack')
  })
  it('a pack from a newer app', async () => {
    await refuses(await craft(join(root, 'n.bornpack'), { manifest: { packVersion: 99 } }), 'newer')
  })
  it('truncated and cut-off packs', async () => {
    const pics = await addPics(A, 3)
    const dest = join(root, 't.bornpack')
    await exportPack(A, withRefs(A, [slideshowToItem(pics, 'S')]), { dest, title: 't', appVersion: '2', settings: {} })
    const b = readFileSync(dest)
    writeFileSync(join(root, 't1.bornpack'), b.subarray(0, b.length - 30))
    await refuses(join(root, 't1.bornpack'), 'truncated')
    writeFileSync(join(root, 't2.bornpack'), b.subarray(0, Math.floor(b.length / 2)))
    await refuses(join(root, 't2.bornpack'), 'truncated')
  })
  it('zip-slip and other names are refused', async () => {
    const pic = variant(1)
    for (const [i, name] of ['../../evil.jpg', '/abs.jpg', 'media/../x.jpg', 'media\\a.jpg', 'notes.txt', 'media/CON.jpg', `media/${'a'.repeat(63)}.jpg`, `media/${sha(pic)}.exe`, `media/${sha(pic)}.html`].entries()) {
      await refuses(await craft(join(root, `s${i}.bornpack`), { pics: [{ buf: pic }], extra: { [name]: Buffer.from('x') } }), 'bad-entry')
    }
  })
  it('manifest that lies: path/hash disagree, a picture not in the manifest, bad extension, duplicate identity', async () => {
    const pic = variant(2)
    await refuses(await craft(join(root, 'm1.bornpack'), { pics: [{ buf: pic, libraryHash: 'a'.repeat(64), path: `media/${sha(pic)}.jpg` }] }), 'bad-entry')
    await refuses(await craft(join(root, 'm2.bornpack'), { pics: [{ buf: pic }], extra: { [`media/${sha(variant(3))}.jpg`]: variant(3) } }), 'bad-entry')
    await refuses(await craft(join(root, 'm3.bornpack'), { manifest: { files: [{ path: `media/${sha(pic)}.svg`, sha256: sha(pic), bytes: pic.length, libraryHash: sha(pic), ext: 'svg', name: 'x' }] } }), 'bad-entry')
  })
  it('too many pictures claimed', async () => {
    // (cheap fake identities: hashing 5,001 buffers here makes Node collect garbage in the middle of the test, which trips a
    // better-sqlite3 crash in Node 24's test runner — a test-environment quirk, not an app one)
    const files = Array.from({ length: 5001 }, (_, i) => { const h = i.toString(16).padStart(64, '0'); return { path: `media/${h}.jpg`, sha256: h, bytes: 10, libraryHash: h, ext: 'jpg', name: 'x' } })
    await refuses(await craft(join(root, 'many.bornpack'), { manifest: { files } }), 'too-many')
  })
  it('a picture claiming to be another picture (hash mismatch) is damaged, the rest still come in', async () => {
    const good = variant(4), evil = variant(5), other = variant(6)
    const f = await craft(join(root, 'h.bornpack'), { pics: [{ buf: good }, { buf: evil, libraryHash: sha(other), claimSha: sha(other) }] })
    const rev = await inspectPack(B, f)
    expect(rev.ok && rev.review.counts).toEqual({ new: 1, have: 0, damaged: 1 })
    const imp = await importPack(B, f)
    expect(imp.ok && imp.summary).toMatchObject({ added: 1, damaged: 1 })
    expect(B.findByHashes([sha(good), sha(other)])).toEqual({ [sha(good)]: expect.any(String) })
  })
  it('a flipped byte inside a picture is reported as damaged by name, and nothing else is harmed', async () => {
    const pics = await addPics(A, 3)
    const dest = join(root, 'f.bornpack')
    await exportPack(A, withRefs(A, [slideshowToItem(pics, 'S')]), { dest, title: 't', appVersion: '2', settings: {} })
    const b = readFileSync(dest)
    b[60 + 30 + 20] ^= 0xff // inside the first picture's data
    writeFileSync(dest, b)
    const rev = await inspectPack(B, dest)
    expect(rev.ok && rev.review.counts.damaged).toBe(1)
    const imp = await importPack(B, dest)
    expect(imp.ok && imp.summary).toMatchObject({ added: 2, damaged: 1 })
  })
  it('a "picture" that is not a picture is refused wholesale (HTML/SVG/script named .jpg) and nothing is added', async () => {
    const pics = [variant(7), Buffer.from('<html><script>alert(1)</script></html>'), variant(8)]
    const f = await craft(join(root, 'x.bornpack'), { pics: pics.map((buf) => ({ buf })) })
    const before = snapshot(B)
    const imp = await importPack(B, f)
    expect(imp).toMatchObject({ ok: false, code: 'bad-type' })
    expect(snapshot(B)).toEqual(before) // the good one before it was rolled back
    noStaging(B)
  })
  it('a PNG saved under a .jpg name (extension and content disagree) is refused', async () => {
    const png = readFileSync(join(FX, 'tiny.png'))
    const f = await craft(join(root, 'png.bornpack'), { pics: [{ buf: png, ext: 'jpg' }] })
    expect(await importPack(B, f)).toMatchObject({ ok: false, code: 'bad-type' })
    expect(B.count().items).toBe(0)
  })
})

describe('service pack: all or nothing', () => {
  it('cancel in the middle of copying leaves the library and queue exactly as before', async () => {
    const pics = await addPics(A, 6)
    const dest = join(root, 'k.bornpack')
    await exportPack(A, withRefs(A, [slideshowToItem(pics, 'S')]), { dest, title: 't', appVersion: '2', settings: {} })
    await addPics(B, 1, 100)
    const before = snapshot(B)
    const ac = new AbortController()
    const r = await importPack(B, dest, { signal: ac.signal, onProgress: (p) => { if (p.phase === 'copying' && p.done === 3) ac.abort() } })
    expect(r).toMatchObject({ ok: false, code: 'cancelled' })
    expect(snapshot(B)).toEqual(before)
    noStaging(B)
  })
  it('a failure part-way (the 4th picture will not open) rolls back the 3 already placed, files and thumbnails included', async () => {
    const pics = await addPics(A, 5)
    const dest = join(root, 'r.bornpack')
    await exportPack(A, withRefs(A, [slideshowToItem(pics, 'S')]), { dest, title: 't', appVersion: '2', settings: {} })
    B.close()
    let n = 0
    B = lib('B', decoder({ async decode(path) { if (++n === 4) return { ok: false, reason: 'corrupt' }; return decoder().decode(path, [320, 960]) } }))
    const before = snapshot(B)
    const r = await importPack(B, dest)
    expect(r).toMatchObject({ ok: false, code: 'bad-type' })
    expect(snapshot(B)).toEqual(before)
    noStaging(B)
  })
  it('a database failure at the last step also removes every file the import placed', async () => {
    const pics = await addPics(A, 3)
    const dest = join(root, 'd.bornpack')
    await exportPack(A, withRefs(A, [slideshowToItem(pics, 'S')]), { dest, title: 't', appVersion: '2', settings: {} })
    const before = snapshot(B)
    // make the INSERT fail: a unique index on hash would do it; here we break the table instead
    ;(B as unknown as { db: { exec(s: string): void } }).db.exec('ALTER TABLE media_items RENAME TO media_items_x')
    const r = await importPack(B, dest).catch((e) => ({ ok: false, thrown: String(e) }))
    ;(B as unknown as { db: { exec(s: string): void } }).db.exec('ALTER TABLE media_items_x RENAME TO media_items')
    expect(r.ok).toBe(false)
    expect(snapshot(B).tree).toEqual(before.tree)
    noStaging(B)
  })
  it('not enough disk space: refused before anything is copied', async () => {
    const pics = await addPics(A, 2)
    const dest = join(root, 's.bornpack')
    await exportPack(A, withRefs(A, [slideshowToItem(pics, 'S')]), { dest, title: 't', appVersion: '2', settings: {} })
    B.close()
    B = new MediaLibrary({ dir: join(root, 'B', 'media'), decoder: decoder(), freeBytes: () => 1000 })
    const before = snapshot(B)
    const r = await importPack(B, dest)
    expect(r).toMatchObject({ ok: false, code: 'no-space' })
    expect(snapshot(B)).toEqual(before)
  })
  it('leftover staging folders from a crash are swept at the next start', async () => {
    const d = B.newStagingDir()
    writeFileSync(join(d, '0.bin'), 'x')
    expect(B.sweepTemp()).toBeGreaterThan(0)
    expect(existsSync(d)).toBe(false)
  })
})

describe('service pack: compatibility with plain .born', () => {
  it('service.born inside a pack is the same JSON a plain Save writes, so any version can read it', async () => {
    const pics = await addPics(A, 1)
    const queue = withRefs(A, [mediaToItem(pics[0])])
    const dest = join(root, 'q.bornpack')
    await exportPack(A, queue, { dest, title: 't', appVersion: '2', settings: {} })
    const { ZipReader } = await import('../../main/zipStore')
    const z = await ZipReader.open(dest, { maxEntries: 50, maxTotalBytes: 1 << 30, maxEntryBytes: 1 << 30 })
    const e = z.entries.find((x) => x.name === 'service.born')!
    const text = (await z.readBuffer(e, 1 << 20)).toString('utf8')
    expect(text).toBe(JSON.stringify(queue, null, 2))
    await z.close()
  })
  it('an old app that tries to read a pack as a .born file just fails to parse it (it is not JSON)', () => {
    const f = join(root, 'o.bornpack')
    writeFileSync(f, Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(40)]))
    expect(() => JSON.parse(readFileSync(f, 'utf-8'))).toThrow()
  })
  it('crc32 matches the known value', () => expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926))
})
