/**
 * zipStore.ts — a deliberately tiny ZIP writer and reader for service packs.
 *
 * Only "stored" (uncompressed) entries, no encryption, no ZIP64, no data descriptors. That is all a pack needs
 * (pictures are already compressed), and it makes a pack impossible to turn into a zip bomb: every entry's real size
 * is its stored size. Standard unzip tools can still open the result. Everything is streamed in 1 MB pieces, so a
 * 1 GB pack costs about 1 MB of memory. The reader treats the file as hostile: every offset and length is checked
 * against the file, names are restricted, and CRCs are verified as the bytes stream past.
 */
import { open, type FileHandle } from 'fs/promises'
import { createHash, type Hash } from 'crypto'
import * as zlib from 'zlib'

const CHUNK = 1024 * 1024
const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const U32 = 0xffffffff

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf: Uint8Array, prev = 0): number {
  const native = (zlib as unknown as { crc32?: (d: Uint8Array, v?: number) => number }).crc32
  if (native) return native(buf, prev) >>> 0
  let c = ~prev >>> 0
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

export type ZipErrorCode = 'not-zip' | 'truncated' | 'damaged' | 'unsupported' | 'too-many' | 'too-big' | 'bad-name' | 'cancelled'
export class ZipError extends Error {
  constructor(public code: ZipErrorCode, message?: string) {
    super(message ?? code)
  }
}

function dosDateTime(d = new Date()): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  }
}

interface WrittenEntry { name: Buffer; crc: number; size: number; offset: number }

export class ZipWriter {
  private entries: WrittenEntry[] = []
  private pos = 0
  private closed = false
  private constructor(private fh: FileHandle, readonly path: string) {}

  static async create(path: string): Promise<ZipWriter> {
    return new ZipWriter(await open(path, 'w'), path)
  }

  get bytesWritten(): number {
    return this.pos
  }

  private async put(buf: Buffer, at = this.pos): Promise<void> {
    let off = 0
    while (off < buf.length) {
      const { bytesWritten } = await this.fh.write(buf, off, buf.length - off, at + off)
      off += bytesWritten
    }
  }

  private localHeader(name: Buffer, crc: number, size: number): Buffer {
    const h = Buffer.alloc(30 + name.length)
    const { time, date } = dosDateTime()
    h.writeUInt32LE(SIG_LOCAL, 0)
    h.writeUInt16LE(20, 4)
    h.writeUInt16LE(0x0800, 6) // UTF-8 names
    h.writeUInt16LE(0, 8) // stored
    h.writeUInt16LE(time, 10)
    h.writeUInt16LE(date, 12)
    h.writeUInt32LE(crc, 14)
    h.writeUInt32LE(size, 18)
    h.writeUInt32LE(size, 22)
    h.writeUInt16LE(name.length, 26)
    h.writeUInt16LE(0, 28)
    name.copy(h, 30)
    return h
  }

  async addBuffer(name: string, data: Buffer): Promise<void> {
    if (data.length > U32) throw new ZipError('too-big')
    const n = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const offset = this.pos
    await this.put(this.localHeader(n, crc, data.length))
    await this.put(data, offset + 30 + n.length)
    this.pos = offset + 30 + n.length + data.length
    this.entries.push({ name: n, crc, size: data.length, offset })
    this.guard()
  }

  /** Stream a file in. Returns the SHA-256 of what was written. Throws if the file changes size while being read. */
  async addFile(name: string, srcPath: string, opts: { signal?: AbortSignal; onBytes?: (n: number) => void; expectedBytes?: number } = {}): Promise<{ sha256: string; bytes: number }> {
    const n = Buffer.from(name, 'utf8')
    const src = await open(srcPath, 'r')
    try {
      const size = (await src.stat()).size
      if (size > U32) throw new ZipError('too-big')
      if (opts.expectedBytes !== undefined && size !== opts.expectedBytes) throw new ZipError('damaged', 'the file changed')
      const offset = this.pos
      const dataStart = offset + 30 + n.length
      await this.put(this.localHeader(n, 0, 0)) // sizes and CRC are patched in below
      const sha: Hash = createHash('sha256')
      const buf = Buffer.allocUnsafe(CHUNK)
      let crc = 0
      let done = 0
      for (;;) {
        if (opts.signal?.aborted) throw new ZipError('cancelled')
        const { bytesRead } = await src.read(buf, 0, CHUNK, done)
        if (bytesRead === 0) break
        const piece = buf.subarray(0, bytesRead)
        sha.update(piece)
        crc = crc32(piece, crc)
        await this.put(piece, dataStart + done)
        done += bytesRead
        opts.onBytes?.(bytesRead)
        if (done > U32) throw new ZipError('too-big')
      }
      if (done !== size) throw new ZipError('damaged', 'the file changed while it was being read')
      const patch = Buffer.alloc(12)
      patch.writeUInt32LE(crc, 0)
      patch.writeUInt32LE(done, 4)
      patch.writeUInt32LE(done, 8)
      await this.put(patch, offset + 14)
      this.pos = dataStart + done
      this.entries.push({ name: n, crc, size: done, offset })
      this.guard()
      return { sha256: sha.digest('hex'), bytes: done }
    } finally {
      await src.close()
    }
  }

  private guard(): void {
    if (this.pos > U32 - 1024 * 1024 || this.entries.length >= 0xfff0) throw new ZipError('too-big')
  }

  async finish(): Promise<void> {
    const cdStart = this.pos
    const parts: Buffer[] = []
    const { time, date } = dosDateTime()
    for (const e of this.entries) {
      const h = Buffer.alloc(46 + e.name.length)
      h.writeUInt32LE(SIG_CENTRAL, 0)
      h.writeUInt16LE(20, 4)
      h.writeUInt16LE(20, 6)
      h.writeUInt16LE(0x0800, 8)
      h.writeUInt16LE(0, 10)
      h.writeUInt16LE(time, 12)
      h.writeUInt16LE(date, 14)
      h.writeUInt32LE(e.crc, 16)
      h.writeUInt32LE(e.size, 20)
      h.writeUInt32LE(e.size, 24)
      h.writeUInt16LE(e.name.length, 28)
      h.writeUInt32LE(e.offset, 42)
      e.name.copy(h, 46)
      parts.push(h)
    }
    const cd = Buffer.concat(parts)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(SIG_EOCD, 0)
    end.writeUInt16LE(this.entries.length, 8)
    end.writeUInt16LE(this.entries.length, 10)
    end.writeUInt32LE(cd.length, 12)
    end.writeUInt32LE(cdStart, 16)
    await this.put(Buffer.concat([cd, end]), cdStart)
    this.pos = cdStart + cd.length + 22
    await this.fh.sync()
    await this.close()
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.fh.close()
  }
}

export interface ZipEntry {
  name: string
  size: number
  crc: number
  /** absolute offset of the first data byte */
  dataStart: number
}

export interface ZipLimits {
  maxEntries: number
  maxTotalBytes: number
  maxEntryBytes: number
}

export class ZipReader {
  entries: ZipEntry[] = []
  private constructor(private fh: FileHandle, readonly fileSize: number) {}

  static async open(path: string, limits: ZipLimits): Promise<ZipReader> {
    const fh = await open(path, 'r')
    try {
      const size = (await fh.stat()).size
      const r = new ZipReader(fh, size)
      await r.parse(limits)
      return r
    } catch (e) {
      await fh.close()
      throw e
    }
  }

  private async readAt(pos: number, len: number): Promise<Buffer> {
    const b = Buffer.alloc(len)
    let off = 0
    while (off < len) {
      const { bytesRead } = await this.fh.read(b, off, len - off, pos + off)
      if (bytesRead === 0) throw new ZipError('truncated')
      off += bytesRead
    }
    return b
  }

  private async parse(limits: ZipLimits): Promise<void> {
    if (this.fileSize < 4) throw new ZipError('not-zip')
    const head = await this.readAt(0, 4)
    if (head.readUInt32LE(0) !== SIG_LOCAL && head.readUInt32LE(0) !== SIG_EOCD) throw new ZipError('not-zip')
    if (this.fileSize < 22) throw new ZipError('truncated')
    const tailLen = Math.min(this.fileSize, 22 + 0xffff)
    const tail = await this.readAt(this.fileSize - tailLen, tailLen)
    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === SIG_EOCD && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { eocd = i; break }
    }
    if (eocd < 0) throw new ZipError(head.readUInt32LE(0) === SIG_LOCAL ? 'truncated' : 'not-zip')
    const eocdAbs = this.fileSize - tailLen + eocd
    const disk = tail.readUInt16LE(eocd + 4), cdDisk = tail.readUInt16LE(eocd + 6)
    const nHere = tail.readUInt16LE(eocd + 8), n = tail.readUInt16LE(eocd + 10)
    const cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16)
    if (disk !== 0 || cdDisk !== 0 || nHere !== n) throw new ZipError('unsupported')
    if (n === 0xffff || cdSize === U32 || cdOff === U32) throw new ZipError('unsupported', 'zip64')
    if (n > limits.maxEntries) throw new ZipError('too-many')
    if (cdSize > 16 * 1024 * 1024 || cdOff + cdSize > eocdAbs) throw new ZipError('truncated')
    const cd = await this.readAt(cdOff, cdSize)
    let p = 0
    let total = 0
    const seen = new Set<string>()
    for (let i = 0; i < n; i++) {
      if (p + 46 > cd.length || cd.readUInt32LE(p) !== SIG_CENTRAL) throw new ZipError('damaged')
      const flags = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10)
      const crc = cd.readUInt32LE(p + 16), csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24)
      const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32)
      const diskNo = cd.readUInt16LE(p + 34), lho = cd.readUInt32LE(p + 42)
      if (p + 46 + nl + el + cl > cd.length) throw new ZipError('damaged')
      if (flags & 1) throw new ZipError('unsupported', 'encrypted')
      if (method !== 0 || csize !== usize) throw new ZipError('unsupported', 'compressed')
      if (csize === U32 || lho === U32 || diskNo !== 0) throw new ZipError('unsupported', 'zip64')
      if (usize > limits.maxEntryBytes) throw new ZipError('too-big')
      total += usize
      if (total > limits.maxTotalBytes) throw new ZipError('too-big')
      const nameBytes = cd.subarray(p + 46, p + 46 + nl)
      const name = nameBytes.toString('utf8')
      if (!name || nl > 300 || name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some((s) => s === '..' || s === '.') || name.endsWith('/')) {
        throw new ZipError('bad-name', name.slice(0, 80))
      }
      const key = name.toLowerCase()
      if (seen.has(key)) throw new ZipError('bad-name', 'duplicate')
      seen.add(key)
      // the local header must agree with the index, and the data must sit inside the file, before the index
      if (lho + 30 > cdOff) throw new ZipError('damaged')
      const lh = await this.readAt(lho, 30)
      if (lh.readUInt32LE(0) !== SIG_LOCAL) throw new ZipError('damaged')
      const lnl = lh.readUInt16LE(26), lel = lh.readUInt16LE(28)
      if (lnl !== nl) throw new ZipError('damaged')
      if (!(await this.readAt(lho + 30, lnl)).equals(nameBytes)) throw new ZipError('damaged')
      const dataStart = lho + 30 + lnl + lel
      if (dataStart + usize > cdOff) throw new ZipError('truncated')
      this.entries.push({ name, size: usize, crc, dataStart })
      p += 46 + nl + el + cl
    }
    // entries must not overlap each other (a crafted pack could point two names at the same bytes to fool the totals)
    const sorted = [...this.entries].sort((a, b) => a.dataStart - b.dataStart)
    for (let i = 1; i < sorted.length; i++) if (sorted[i].dataStart < sorted[i - 1].dataStart + sorted[i - 1].size) throw new ZipError('damaged', 'overlap')
  }

  /** Stream an entry in pieces. Verifies the CRC at the end; throws 'damaged' on a mismatch. */
  async stream(entry: ZipEntry, onChunk: (chunk: Buffer) => void | Promise<void>, signal?: AbortSignal): Promise<void> {
    const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(1, entry.size)))
    let done = 0
    let crc = 0
    while (done < entry.size) {
      if (signal?.aborted) throw new ZipError('cancelled')
      const want = Math.min(buf.length, entry.size - done)
      const { bytesRead } = await this.fh.read(buf, 0, want, entry.dataStart + done)
      if (bytesRead === 0) throw new ZipError('truncated')
      const piece = buf.subarray(0, bytesRead)
      crc = crc32(piece, crc)
      await onChunk(piece)
      done += bytesRead
    }
    if (crc >>> 0 !== entry.crc >>> 0) throw new ZipError('damaged', `crc mismatch in ${entry.name}`)
  }

  async readBuffer(entry: ZipEntry, maxBytes: number): Promise<Buffer> {
    if (entry.size > maxBytes) throw new ZipError('too-big')
    const out: Buffer[] = []
    await this.stream(entry, (c) => { out.push(Buffer.from(c)) })
    return Buffer.concat(out)
  }

  async close(): Promise<void> {
    await this.fh.close()
  }
}
