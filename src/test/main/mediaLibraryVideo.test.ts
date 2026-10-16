import './keepStatements'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync, readFileSync, statSync, utimesSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MediaLibrary, type MediaDecoder } from '../../main/mediaLibrary'
import { MEDIA_MIGRATIONS, MEDIA_SCHEMA_VERSION, migrateMediaDb } from '../../main/mediaSchema'
import { buildMp4, type Mp4Spec } from '../helpers/mp4Builder'
import type { MediaImportOk, MediaImportFail } from '../../shared/media'

let dir: string
let lib: MediaLibrary
let decodeCalls = 0
let failDecode = false
const decoder: MediaDecoder = {
  async decode() { return { ok: false, reason: 'corrupt' } },
  async decodeVideo() {
    decodeCalls++
    if (failDecode) return { ok: false, reason: 'undecodable', detail: 'media error 4' }
    return { ok: true, width: 1920, height: 1080, duration: 10, hasAudio: true, thumbs: [{ width: 320, height: 180, ext: 'jpg', data: Buffer.from('poster-320') }, { width: 960, height: 540, ext: 'jpg', data: Buffer.from('poster-960') }] }
  }
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-vid-'))
  lib = new MediaLibrary({ dir: join(dir, 'lib'), decoder })
  decodeCalls = 0
  failDecode = false
})
afterEach(() => { try { lib.close() } catch { /* */ } rmSync(dir, { recursive: true, force: true }) })

let n = 0
const file = (spec: Mp4Spec | Buffer, name = `clip${n++}.mp4`): string => {
  const p = join(dir, name)
  writeFileSync(p, Buffer.isBuffer(spec) ? spec : buildMp4({ mdatBytes: 5000 + n, ...spec }))
  return p
}
const ok = (r: unknown): MediaImportOk => { const x = r as MediaImportOk; expect(x.ok, JSON.stringify(r)).toBe(true); return x }
const bad = (r: unknown): MediaImportFail => { const x = r as MediaImportFail; expect(x.ok, JSON.stringify(r)).toBe(false); return x }
const stray = (): string[] => {
  const out: string[] = []
  const walk = (d: string): void => { for (const f of readdirSync(d)) { const p = join(d, f); try { readdirSync(p); walk(p) } catch { /\.tmp-|\.convert-/.test(f) && out.push(p) } } }
  walk(lib.dir)
  return out
}

describe('video import', () => {
  it('accepts an H.264/AAC MP4: stored, probed, poster thumbnails written', async () => {
    const r = ok(await lib.importFile(file({ seconds: 10, fps: 30 })))
    expect(r.item).toMatchObject({ type: 'video', ext: 'mp4', mime: 'video/mp4', width: 1920, height: 1080, videoCodec: 'avc1', audioCodec: 'mp4a', storage: 'managed' })
    expect(r.item.durationSec).toBeCloseTo(10)
    expect(r.item.fps).toBe(30)
    expect(r.item.bitrate).toBeGreaterThan(0)
    expect(existsSync(lib.resolvePath(r.item)!)).toBe(true)
    expect(await lib.thumbnail(r.item.id, 320)).toMatch(/\.jpg$/)
    expect(stray()).toEqual([])
  })

  it('the same video twice is a duplicate and is decoded once', async () => {
    const p = file({})
    const a = ok(await lib.importFile(p))
    const b = ok(await lib.importFile(p))
    expect(b.duplicate).toBe(true)
    expect(b.item.id).toBe(a.item.id)
    expect(decodeCalls).toBe(1)
  })

  it('HEVC is refused with a plain message that says what to do', async () => {
    const r = bad(await lib.importFile(file({ video: 'hvc1' })))
    expect(r.code).toBe('video-codec')
    expect(r.message).toMatch(/HEVC/)
    expect(r.message).toMatch(/H\.264/)
    expect(lib.count().items).toBe(0)
    expect(decodeCalls).toBe(0) // refused from the file's own index, before any decoding
  })

  it('MOV, MKV/WebM and AVI are refused as the wrong container, with the export advice', async () => {
    expect(bad(await lib.importFile(file({ brand: 'qt  ' }, 'a.mov'))).code).toBe('video-container')
    expect(bad(await lib.importFile(file(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 1)]), 'a.mkv'))).code).toBe('video-container')
    const avi = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 1, 0, 0]), Buffer.from('AVI '), Buffer.alloc(200, 1)])
    expect(bad(await lib.importFile(file(avi, 'a.avi'))).code).toBe('video-container')
  })

  it('a non-H.264/AAC audio track is refused too', async () => {
    expect(bad(await lib.importFile(file({ audio: 'ac-3' }))).code).toBe('video-codec')
  })

  it('a cut-off file is "incomplete", not trusted — and never decoded', async () => {
    const r = bad(await lib.importFile(file({ truncateBy: 200 })))
    expect(r.code).toBe('video-truncated')
    expect(r.message).toMatch(/incomplete|cut short/)
    expect(bad(await lib.importFile(file({ noMoov: true }))).code).toBe('video-truncated')
    expect(decodeCalls).toBe(0)
    expect(stray()).toEqual([])
  })

  it('bigger than 4K is refused; 4K and high bit rate/frame rate are accepted with warnings', async () => {
    expect(bad(await lib.importFile(file({ width: 7680, height: 4320 }))).code).toBe('video-too-large')
    const k = ok(await lib.importFile(file({ width: 3840, height: 2160, fps: 60, mdatBytes: 200_000_000 / 8 * 3 })))
    expect(k.warnings.join(' ')).toMatch(/4K/)
    expect(k.warnings.join(' ')).toMatch(/60 frames/)
  })

  it('a file that the browser cannot decode is reported as damaged and leaves nothing behind', async () => {
    failDecode = true
    const r = bad(await lib.importFile(file({})))
    expect(r.code).toBe('video-damaged')
    expect(lib.count().items).toBe(0)
    expect(readdirSync(lib.filesDir)).toEqual([])
    expect(stray()).toEqual([])
  })

  it('a folder import picks up videos and pictures and skips the rest', async () => {
    const d = join(dir, 'drop')
    mkdirSync(d)
    writeFileSync(join(d, 'a.mp4'), buildMp4({ mdatBytes: 7777 }))
    writeFileSync(join(d, 'notes.txt'), 'hello')
    const out = await lib.importPaths([d])
    expect(out.results.filter((x) => x.ok)).toHaveLength(1)
    expect(out.skipped).toBe(1)
  })

  it('can link a video in place instead of copying it', async () => {
    const r = ok(await lib.importFile(file({}), { linkInPlace: true }))
    expect(r.item.storage).toBe('linked')
    expect(readdirSync(lib.filesDir)).toEqual([])
    expect(r.warnings.join(' ')).toMatch(/Linked in place/)
  })

  it('lists only videos or only pictures on request, and the poster is the "display" picture', async () => {
    const v = ok(await lib.importFile(file({})))
    expect(lib.list({ type: 'video' }).map((x) => x.id)).toEqual([v.item.id])
    expect(lib.list({ type: 'image' })).toEqual([])
    const d = await lib.display(v.item.id)
    expect(d?.type).toBe('image/jpeg')
  })
})

describe('"Is tonight ready?" for a video', () => {
  const mtimeFix = (p: string, id: string): void => {
    const st = statSync(p)
    lib.db.prepare('UPDATE media_items SET link_mtime_ms = ? WHERE id = ?').run(Math.round(st.mtimeMs), id)
  }
  it('a good video passes: whole, allowed, and a frame decodes here', async () => {
    const r = ok(await lib.importFile(file({})))
    const p = await lib.preflight(r.item.id)
    expect(p).toMatchObject({ status: 'ok', deep: 'ok' })
    expect(p.notes).toEqual([])
  })

  it('4K, high frame rate and bit rate are warnings, never failures', async () => {
    const r = ok(await lib.importFile(file({ width: 3840, height: 2160, fps: 60, mdatBytes: 200_000_000 / 8 * 3 })))
    const p = await lib.preflight(r.item.id)
    expect(p.deep).toBe('ok')
    expect(p.notes.join(' ')).toMatch(/4K/)
    expect(p.notes.join(' ')).toMatch(/60 frames/)
  })

  it('catches a managed copy whose bytes changed (hash) and a linked file that was cut short or lost its index', async () => {
    const m = ok(await lib.importFile(file({})))
    const mp = lib.resolvePath(m.item)!
    const b = readFileSync(mp)
    b[b.length - 5] ^= 0xff
    writeFileSync(mp, b)
    expect((await lib.preflight(m.item.id)).deep).toBe('damaged')

    const src = file({ mdatBytes: 9999 }, 'linked.mp4')
    const l = ok(await lib.importFile(src, { linkInPlace: true }))
    // same size, but the index box is now called something else: the file no longer says it is a whole video
    const bytes = readFileSync(src)
    bytes.write('free', bytes.indexOf('moov'), 'latin1')
    writeFileSync(src, bytes)
    utimesSync(src, new Date(l.item.addedAt), new Date(l.item.addedAt))
    mtimeFix(src, l.item.id)
    const p = await lib.preflight(l.item.id)
    expect(p.deep).toBe('damaged')
    expect(p.notes.join(' ')).toMatch(/incomplete|cut short/)
  })

  it('a video the engine cannot decode on this computer is flagged with the fix', async () => {
    const r = ok(await lib.importFile(file({})))
    failDecode = true
    const p = await lib.preflight(r.item.id)
    expect(p.deep).toBe('undecodable')
    expect(p.notes.join(' ')).toMatch(/H\.264/)
  })

  it('a length that no longer agrees with what was added is a warning sign', async () => {
    const r = ok(await lib.importFile(file({ seconds: 10 })))
    lib.db.prepare('UPDATE media_items SET duration_ms = 60000 WHERE id = ?').run(r.item.id)
    const p = await lib.preflight(r.item.id)
    expect(p.deep).toBe('damaged')
    expect(p.notes.join(' ')).toMatch(/length/)
  })

  it('a linked video on an unplugged drive is "drive not connected", not damaged', async () => {
    const r = ok(await lib.importFile(file({}), { linkInPlace: true }))
    lib.db.prepare('UPDATE media_items SET link_path = ? WHERE id = ?').run('/Volumes/BORN_TEST_NOT_PLUGGED/clip.mp4', r.item.id)
    expect((await lib.preflight(r.item.id)).status).toBe(process.platform === 'win32' ? 'missing' : 'offline')
  })
})

describe('schema 1 → 2 (video columns)', () => {
  it('adds the video columns and keeps every existing picture', () => {
    const db = new Database(':memory:')
    db.exec('PRAGMA foreign_keys=ON')
    MEDIA_MIGRATIONS[0](db)
    db.pragma('user_version = 1')
    db.prepare("INSERT INTO media_items (id, hash, name, orig_filename, ext, mime, bytes, width, height) VALUES ('m_1','h1','Pic','pic.jpg','jpg','image/jpeg',10,100,50)").run()
    const r = migrateMediaDb(db)
    expect(r).toEqual({ from: 1, to: MEDIA_SCHEMA_VERSION })
    expect(MEDIA_SCHEMA_VERSION).toBeGreaterThanOrEqual(2)
    const row = db.prepare('SELECT * FROM media_items WHERE id = ?').get('m_1') as Record<string, unknown>
    expect(row).toMatchObject({ name: 'Pic', type: 'image', duration_ms: null, video_codec: null, audio_codec: null })
    db.close()
  })
})
