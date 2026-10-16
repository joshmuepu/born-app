import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { ZipReader, ZipWriter, ZipError, crc32 } from '../../main/zipStore'

const LIMITS = { maxEntries: 100, maxTotalBytes: 1 << 30, maxEntryBytes: 1 << 30 }
let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'born-zip-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

async function make(files: Record<string, Buffer>): Promise<string> {
  const p = join(dir, 'a.zip')
  const w = await ZipWriter.create(p)
  for (const [n, d] of Object.entries(files)) await w.addBuffer(n, d)
  await w.finish()
  return p
}
const code = async (p: string): Promise<string> => {
  try { const r = await ZipReader.open(p, LIMITS); await r.close(); return 'ok' } catch (e) { return e instanceof ZipError ? e.code : 'other:' + (e as Error).message }
}

/** A hand-built zip, so hostile shapes can be tested that our own writer would never make. */
function raw(entries: Array<{ name: string; data: Buffer; method?: number; flags?: number; localName?: string; csize?: number; usize?: number }>, tweak: (cd: Buffer, eocd: Buffer) => void = () => undefined): Buffer {
  const parts: Buffer[] = []
  const cds: Buffer[] = []
  let off = 0
  for (const e of entries) {
    const n = Buffer.from(e.localName ?? e.name)
    const lh = Buffer.alloc(30 + n.length)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.flags ?? 0, 6); lh.writeUInt16LE(e.method ?? 0, 8)
    lh.writeUInt32LE(crc32(e.data), 14); lh.writeUInt32LE(e.csize ?? e.data.length, 18); lh.writeUInt32LE(e.usize ?? e.data.length, 22); lh.writeUInt16LE(n.length, 26); n.copy(lh, 30)
    const cn = Buffer.from(e.name)
    const cd = Buffer.alloc(46 + cn.length)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(e.flags ?? 0, 8); cd.writeUInt16LE(e.method ?? 0, 10)
    cd.writeUInt32LE(crc32(e.data), 16); cd.writeUInt32LE(e.csize ?? e.data.length, 20); cd.writeUInt32LE(e.usize ?? e.data.length, 24); cd.writeUInt16LE(cn.length, 28); cd.writeUInt32LE(off, 42); cn.copy(cd, 46)
    parts.push(lh, e.data); cds.push(cd); off += lh.length + e.data.length
  }
  const cd = Buffer.concat(cds)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16)
  tweak(cd, eocd)
  return Buffer.concat([...parts, cd, eocd])
}

describe('zip store: round trip', () => {
  it('writes entries that read back byte-for-byte, with CRCs checked', async () => {
    const big = Buffer.alloc(3 * 1024 * 1024 + 17, 7)
    const p = await make({ 'manifest.json': Buffer.from('{"a":1}'), 'media/x.bin': big, 'empty': Buffer.alloc(0) })
    const r = await ZipReader.open(p, LIMITS)
    expect(r.entries.map((e) => e.name)).toEqual(['manifest.json', 'media/x.bin', 'empty'])
    expect((await r.readBuffer(r.entries[0], 100)).toString()).toBe('{"a":1}')
    const h = createHash('sha256')
    await r.stream(r.entries[1], (c) => { h.update(c) })
    expect(h.digest('hex')).toBe(createHash('sha256').update(big).digest('hex'))
    await r.close()
  })
  it('addFile streams a file and returns its SHA-256; a standard unzip tool agrees', async () => {
    const src = join(dir, 'src.bin')
    const data = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251))
    writeFileSync(src, data)
    const p = join(dir, 'f.zip')
    const w = await ZipWriter.create(p)
    const out = await w.addFile('media/f.bin', src)
    await w.finish()
    expect(out).toEqual({ sha256: createHash('sha256').update(data).digest('hex'), bytes: 5000 })
    try {
      execFileSync('unzip', ['-t', p], { stdio: 'pipe' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e // no unzip on this machine: fine
    }
  })
  it('a file that changes size while being read is refused', async () => {
    const src = join(dir, 'src.bin'); writeFileSync(src, Buffer.alloc(100))
    const w = await ZipWriter.create(join(dir, 'g.zip'))
    await expect(w.addFile('x', src, { expectedBytes: 99 })).rejects.toMatchObject({ code: 'damaged' })
    await w.close()
  })
  it('cancel stops the write', async () => {
    const src = join(dir, 'src.bin'); writeFileSync(src, Buffer.alloc(5 * 1024 * 1024))
    const w = await ZipWriter.create(join(dir, 'g.zip'))
    const ac = new AbortController(); ac.abort()
    await expect(w.addFile('x', src, { signal: ac.signal })).rejects.toMatchObject({ code: 'cancelled' })
    await w.close()
  })
})

describe('zip store: hostile files', () => {
  it('flipped data byte → CRC mismatch', async () => {
    const p = await make({ a: Buffer.from('hello world, this is data') })
    const b = readFileSync(p); b[40] ^= 0xff; writeFileSync(p, b)
    const r = await ZipReader.open(p, LIMITS)
    await expect(r.readBuffer(r.entries[0], 1000)).rejects.toMatchObject({ code: 'damaged' })
    await r.close()
  })
  it('truncated file, empty file, and non-zip are told apart', async () => {
    const p = await make({ a: Buffer.alloc(5000, 1) })
    const b = readFileSync(p)
    writeFileSync(join(dir, 't.zip'), b.subarray(0, b.length - 40))
    expect(await code(join(dir, 't.zip'))).toBe('truncated')
    writeFileSync(join(dir, 'e.zip'), Buffer.alloc(0))
    expect(await code(join(dir, 'e.zip'))).toBe('not-zip')
    writeFileSync(join(dir, 'n.zip'), Buffer.from('{"this":"is json, not a zip file at all, nope"}'))
    expect(await code(join(dir, 'n.zip'))).toBe('not-zip')
  })
  for (const bad of ['../evil.txt', '/etc/passwd', 'C:/Windows/x', 'a/../../b', 'a\\b', 'a/./b', 'dir/', 'x\0y']) {
    it(`rejects the name ${JSON.stringify(bad)} (zip-slip)`, async () => {
      writeFileSync(join(dir, 's.zip'), raw([{ name: bad, data: Buffer.from('x') }]))
      expect(await code(join(dir, 's.zip'))).toBe('bad-name')
    })
  }
  it('rejects duplicate names (also case-only duplicates)', async () => {
    writeFileSync(join(dir, 'd.zip'), raw([{ name: 'media/a.jpg', data: Buffer.from('1') }, { name: 'MEDIA/A.jpg', data: Buffer.from('2') }]))
    expect(await code(join(dir, 'd.zip'))).toBe('bad-name')
  })
  it('rejects compressed entries (no zip bombs), encrypted entries, and zip64', async () => {
    writeFileSync(join(dir, 'c.zip'), raw([{ name: 'a', data: Buffer.from('x'), method: 8, csize: 1, usize: 1000000 }]))
    expect(await code(join(dir, 'c.zip'))).toBe('unsupported')
    writeFileSync(join(dir, 'enc.zip'), raw([{ name: 'a', data: Buffer.from('x'), flags: 1 }]))
    expect(await code(join(dir, 'enc.zip'))).toBe('unsupported')
    writeFileSync(join(dir, 'z64.zip'), raw([{ name: 'a', data: Buffer.from('x') }], (_cd, eocd) => eocd.writeUInt16LE(0xffff, 10)))
    expect(await code(join(dir, 'z64.zip'))).toBe('unsupported')
  })
  it('rejects a local header that disagrees with the index', async () => {
    writeFileSync(join(dir, 'l.zip'), raw([{ name: 'a.txt', data: Buffer.from('x'), localName: 'b.txt' }]))
    expect(await code(join(dir, 'l.zip'))).toBe('damaged')
  })
  it('rejects entries whose data would run into the index or overlap another entry', async () => {
    writeFileSync(join(dir, 'o.zip'), raw([{ name: 'a', data: Buffer.from('xxxx'), usize: 5000, csize: 5000 }]))
    expect(await code(join(dir, 'o.zip'))).toBe('truncated')
    const two = raw([{ name: 'a', data: Buffer.from('1234567890') }, { name: 'b', data: Buffer.from('1234567890') }], (cd) => { cd.writeUInt32LE(0, 46 + 1 + 42 + 0) })
    writeFileSync(join(dir, 'ov.zip'), two)
    expect(['damaged', 'truncated']).toContain(await code(join(dir, 'ov.zip')))
  })
  it('enforces entry-count and size limits', async () => {
    const p = await make({ a: Buffer.alloc(10), b: Buffer.alloc(10), c: Buffer.alloc(10) })
    const lim = async (l: Partial<typeof LIMITS>) => { try { await (await ZipReader.open(p, { ...LIMITS, ...l })).close(); return 'ok' } catch (e) { return (e as ZipError).code } }
    expect(await lim({ maxEntries: 2 })).toBe('too-many')
    expect(await lim({ maxTotalBytes: 25 })).toBe('too-big')
    expect(await lim({ maxEntryBytes: 5 })).toBe('too-big')
  })
})

describe('zip store: a gigabyte without a gigabyte of memory', () => {
  it('writes and verifies a 1 GB entry by streaming; memory stays flat', async () => {
    const src = join(dir, 'big.bin')
    const { open } = await import('fs/promises')
    const fh = await open(src, 'w')
    const chunk = Buffer.alloc(16 * 1024 * 1024)
    for (let i = 0; i < chunk.length; i += 4) chunk.writeUInt32LE((i * 2654435761) >>> 0, i)
    for (let i = 0; i < 64; i++) await fh.write(chunk, 0, chunk.length, i * chunk.length)
    await fh.close()
    expect(statSync(src).size).toBe(1024 * 1024 * 1024)
    const rssBefore = process.memoryUsage().rss
    let peak = 0
    const iv = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss) }, 25)
    const p = join(dir, 'big.zip')
    const w = await ZipWriter.create(p)
    const added = await w.addFile('media/big.bin', src)
    await w.finish()
    const r = await ZipReader.open(p, LIMITS)
    const h = createHash('sha256')
    await r.stream(r.entries[0], (c) => { h.update(c) })
    await r.close()
    clearInterval(iv)
    expect(h.digest('hex')).toBe(added.sha256)
    expect(peak - rssBefore).toBeLessThan(250 * 1024 * 1024)
    console.log(`1 GB pack write+verify: rss growth ${Math.round((peak - rssBefore) / 1048576)} MB`)
  }, 180_000)
})
