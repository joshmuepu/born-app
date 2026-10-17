import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './keepStatements'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { TapeDb, TAPE_MIGRATIONS, TAPE_SCHEMA_VERSION, TapeDbTooNewError, migrateTapeDb } from '../../main/tapeDb'
import { TapeLibrary } from '../../main/tapeLibrary'

let dir: string, db: TapeDb, lib: TapeLibrary, raw: Database.Database
const box = (type: string, ...p: Buffer[]): Buffer => { const body = Buffer.concat(p); const h = Buffer.alloc(8); h.writeUInt32BE(8 + body.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, body]) }
const u32 = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }
/** a tiny valid-looking M4A of `seconds`, different bytes per `salt` */
function m4a(seconds: number, salt = 0, cut = 0): Buffer {
  const ts = 44100
  const mvhd = box('mvhd', Buffer.alloc(4), u32(0), u32(0), u32(ts), u32(seconds * ts), Buffer.alloc(80))
  const mdhd = box('mdhd', Buffer.alloc(4), u32(0), u32(0), u32(ts), u32(seconds * ts), Buffer.alloc(4))
  const hdlr = box('hdlr', Buffer.alloc(4), u32(0), Buffer.from('soun', 'latin1'), Buffer.alloc(13))
  const stsd = box('stsd', Buffer.alloc(4), u32(1), Buffer.concat([u32(28), Buffer.from('mp4a', 'latin1'), Buffer.alloc(24)]))
  const moov = box('moov', mvhd, box('trak', box('mdia', mdhd, hdlr, box('minf', box('stbl', stsd)))))
  const all = Buffer.concat([box('ftyp', Buffer.from('M4A ', 'latin1'), u32(0), Buffer.from('M4A isom', 'latin1')), moov, box('mdat', Buffer.alloc(100_000, salt))])
  return cut ? all.subarray(0, all.length - cut) : all
}
const put = (name: string, b: Buffer): string => { const p = join(dir, name); writeFileSync(p, b); return p }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-tape-'))
  raw = new Database(join(dir, 'tape.db'))
  db = new TapeDb(raw)
  lib = new TapeLibrary({ dir: join(dir, 'tapes'), db })
})
afterEach(() => { try { raw.close() } catch { /* */ } rmSync(dir, { recursive: true, force: true }) })

describe('importing a tape', () => {
  it('copies it into BORN\'s own folder under its hash, keeps the original untouched, and attaches it to the sermon', async () => {
    const src = put('65-0418M It Is The Rising Of The Sun VGR.m4a', m4a(8688))
    const before = readFileSync(src)
    const r = await lib.importFile(src, { sermonId: 1115 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.duplicate).toBe(false)
    expect(r.file).toMatchObject({ container: 'm4a', codec: 'mp4a', storage: 'managed', origFilename: '65-0418M It Is The Rising Of The Sun VGR.m4a' })
    expect(r.file.durationSec).toBeCloseTo(8688, 0)
    expect(existsSync(lib.resolvePath(r.file)!)).toBe(true)
    expect(readFileSync(lib.resolvePath(r.file)!).equals(before)).toBe(true) // a faithful copy
    expect(readFileSync(src).equals(before)).toBe(true) // the original is never changed
    expect(r.recording).toMatchObject({ sermonId: 1115, language: 'en' })
    expect(db.listRecordings(1115)).toHaveLength(1)
  })
  it('importing the same bytes again finds the same file (no second copy), and the same sermon gets one recording', async () => {
    const a = put('a.m4a', m4a(100, 1)), b = put('copy of a.m4a', m4a(100, 1))
    const r1 = await lib.importFile(a, { sermonId: 5 })
    const r2 = await lib.importFile(b, { sermonId: 5 })
    expect(r1.ok && r2.ok && r2.duplicate).toBe(true)
    expect(readdirSync(join(dir, 'tapes')).filter((n) => n.endsWith('.m4a'))).toHaveLength(1)
    expect(db.listRecordings(5)).toHaveLength(1)
    // the same file can also serve another sermon (a recording is a pairing)
    await lib.importFile(a, { sermonId: 6 })
    expect(db.listRecordings(6)).toHaveLength(1)
  })
  it('refuses a cut-short file? No: it imports (so the operator can see why), and the preflight says it is not whole', async () => {
    const r = await lib.importFile(put('cut.m4a', m4a(60, 2, 5000)), { sermonId: 7 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.join(' ')).toMatch(/cut short/)
    const rec = db.listRecordings(7)[0]
    const pf = await lib.preflight(rec.id)
    expect(pf.status).toBe('fail')
    expect(pf.checks.find((c) => c.id === 'whole')?.level).toBe('fail')
  })
  it('refuses things that are not audio, in plain words, and leaves nothing behind', async () => {
    const r = await lib.importFile(put('notes.m4a', Buffer.from('just some text, not a recording at all')), { sermonId: 1 })
    expect(r).toMatchObject({ ok: false, reason: 'not-audio' })
    expect(db.listFiles()).toHaveLength(0)
    expect(readdirSync(join(dir, 'tapes'))).toEqual([])
  })
  it('a file that is not enough free space says so and copies nothing', async () => {
    const small = new TapeLibrary({ dir: join(dir, 'tapes2'), db, freeBytes: () => 1000 })
    const r = await small.importFile(put('big.m4a', m4a(10, 3)), { sermonId: 1 })
    expect(r).toMatchObject({ ok: false, reason: 'no-space' })
  })
  it('a linked file stays where it is; if its folder disappears it is "offline", not lost', async () => {
    const sub = join(dir, 'usb'); require('fs').mkdirSync(sub)
    const src = join(sub, 'tape.m4a'); writeFileSync(src, m4a(30, 4))
    const r = await lib.importFile(src, { sermonId: 2, link: true })
    expect(r.ok && r.file.storage).toBe('linked')
    expect(readdirSync(join(dir, 'tapes'))).toEqual([])
    if (!r.ok) return
    expect(lib.status(r.file)).toBe('ok')
    rmSync(sub, { recursive: true, force: true })
    expect(lib.status(r.file)).toBe('offline')
  })
})

describe('the "Tape audio" folder', () => {
  it('finds the audio, matches each to a sermon by its date code, and marks what is already added', async () => {
    const folder = join(dir, 'Tape audio'); require('fs').mkdirSync(join(folder, 'more'), { recursive: true })
    writeFileSync(join(folder, '65-0418M It Is The Rising Of The Sun VGR.m4a'), m4a(100, 5))
    writeFileSync(join(folder, 'more', 'VGR_63-0901M_Seven_Seals.mp3'), m4a(100, 6))
    writeFileSync(join(folder, 'notes.txt'), 'x'.repeat(200_000))
    writeFileSync(join(folder, 'tiny.m4a'), Buffer.alloc(50))
    const sermons = [{ id: 1115, date_code: '65-0418M', title: 'It Is The Rising Of The Sun' }, { id: 900, date_code: '63-0901M', title: 'Seven Seals' }]
    let hits = lib.scanFolder(folder, sermons)
    expect(hits.map((h) => h.name)).toEqual(['VGR_63-0901M_Seven_Seals.mp3', '65-0418M It Is The Rising Of The Sun VGR.m4a'].sort())
    const a = hits.find((h) => h.name.startsWith('65-'))!
    expect(a).toMatchObject({ confidence: 'exact', match: { id: 1115 }, imported: false })
    await lib.importFile(a.path, { sermonId: 1115 })
    hits = lib.scanFolder(folder, sermons)
    expect(hits.find((h) => h.name.startsWith('65-'))!.imported).toBe(true)
  })
})

describe('tape.db', () => {
  it('migrates a new database, stamps its version, and refuses one written by a newer BORN', () => {
    expect(raw.pragma('user_version', { simple: true })).toBe(TAPE_SCHEMA_VERSION)
    const newer = new Database(':memory:')
    newer.pragma(`user_version = ${TAPE_SCHEMA_VERSION + 3}`)
    expect(() => migrateTapeDb(newer)).toThrow(TapeDbTooNewError)
    newer.close()
  })
  it('a version-1 database (before the language overrides) upgrades in place and keeps its rows', () => {
    const old = new Database(':memory:')
    TAPE_MIGRATIONS[0](old)
    old.pragma('user_version = 1')
    old.prepare("INSERT INTO tape_files (id, hash, name, orig_filename, ext, container, codec, bytes, duration_sec, bitrate, seek_ok, storage) VALUES ('t_1','h','n','o','m4a','m4a','c',1,10,1,1,'managed')").run()
    old.prepare("INSERT INTO recordings (id, sermon_id, file_id, language) VALUES ('r_1',1,'t_1','en')").run()
    expect(migrateTapeDb(old)).toEqual({ from: 1, to: TAPE_SCHEMA_VERSION })
    expect(old.prepare('SELECT COUNT(*) AS c FROM recordings').get()).toEqual({ c: 1 })
    expect(old.prepare('SELECT COUNT(*) AS c FROM map_overrides').get()).toEqual({ c: 0 })
    old.close()
  })
  it('language overrides are kept per recording and text language, replaced wholesale, and go when the recording does (never the sermon)', async () => {
    const r = await lib.importFile(put('ov.m4a', m4a(20, 8)), { sermonId: 5 })
    const rec = (r as { ok: true; recording: { id: string } }).recording
    db.setOverrides(rec.id, 'fr', [{ textN: 113, mapN: 115 }, { textN: 114, mapN: 116 }])
    db.setOverrides(rec.id, 'es', [{ textN: 3, mapN: 4 }])
    expect(db.getOverrides(rec.id, 'fr')).toEqual([{ textN: 113, mapN: 115 }, { textN: 114, mapN: 116 }])
    db.setOverrides(rec.id, 'fr', [{ textN: 9, mapN: 10 }])
    expect(db.getOverrides(rec.id, 'fr')).toEqual([{ textN: 9, mapN: 10 }])
    expect(db.getOverrides(rec.id, 'es')).toHaveLength(1)
    db.removeRecording(rec.id)
    expect(db.getOverrides(rec.id, 'es')).toEqual([])
  })
  it('opening it again keeps every row (migrations never rewrite data)', async () => {
    await lib.importFile(put('k.m4a', m4a(20, 7)), { sermonId: 3 })
    const again = new TapeDb(raw)
    expect(again.listRecordings(3)).toHaveLength(1)
  })
  it('REMOVING A RECORDING NEVER DELETES THE SERMON (it lives in another database) and never deletes the audio file', async () => {
    // the sermon database is a separate file BORN never writes to from here
    const sermons = new Database(join(dir, 'sermons.db'))
    sermons.exec("CREATE TABLE sermons (id INTEGER PRIMARY KEY, title TEXT); INSERT INTO sermons VALUES (1115, 'It Is The Rising Of The Sun');")
    const r = await lib.importFile(put('r.m4a', m4a(20, 8)), { sermonId: 1115 })
    if (!r.ok || !r.recording) throw new Error('import failed')
    db.saveMap(r.recording.id, null, 'tap', [{ n: 1, t: 12, kind: 'start' }], [])
    db.setPosition(r.recording.id, 99)
    db.removeRecording(r.recording.id)
    expect(db.listRecordings(1115)).toHaveLength(0)
    expect(db.getMap(r.recording.id)).toBeNull()
    expect(db.getPosition(r.recording.id)).toBeNull()
    expect(sermons.prepare('SELECT COUNT(*) AS n FROM sermons').get()).toEqual({ n: 1 })
    expect(existsSync(lib.resolvePath(r.file)!)).toBe(true)
    expect(db.orphanFiles().map((f) => f.id)).toEqual([r.file.id])
    sermons.close()
  })
  it('sync maps round-trip, are keyed by paragraph number, and a per-language override is separate from the recording\'s own', async () => {
    const r = await lib.importFile(put('m.m4a', m4a(20, 9)), { sermonId: 1 })
    if (!r.ok || !r.recording) throw new Error('x')
    const id = r.recording.id
    db.saveMap(id, null, 'tap', [{ n: 1, t: 26.5, kind: 'start' }, { n: 41, t: 90, kind: 'start' }, { n: 42, t: null, kind: 'skip' }], [{ kind: 'gap', start: 0, end: 26, note: 'intro' }])
    db.saveMap(id, 'fr', 'tap', [{ n: 1, t: 27, kind: 'start' }], [])
    const own = db.getMap(id, null)!
    expect(own.marks.map((m) => [m.n, m.t, m.kind])).toEqual([[1, 26.5, 'start'], [41, 90, 'start'], [42, null, 'skip']])
    expect(own.regions).toEqual([{ kind: 'gap', start: 0, end: 26, note: 'intro' }])
    expect(db.getMap(id, 'fr')!.marks).toHaveLength(1)
    expect(db.listMapLanguages(id).sort()).toEqual([null, 'fr'].sort())
    // saving again replaces
    db.saveMap(id, null, 'tap', [{ n: 1, t: 30, kind: 'start' }], [])
    expect(db.getMap(id, null)!.marks).toHaveLength(1)
    expect(db.listRecordings(1)[0].synced).toBe(true)
  })
  it('remembers where each recording stopped', async () => {
    const r = await lib.importFile(put('p.m4a', m4a(20, 10)), { sermonId: 1 })
    if (!r.ok || !r.recording) throw new Error('x')
    expect(db.getPosition(r.recording.id)).toBeNull()
    db.setPosition(r.recording.id, 4323.5)
    db.setPosition(r.recording.id, 4400)
    expect(db.getPosition(r.recording.id)).toBe(4400)
  })
})

describe('preflight ("Is tonight ready?" for a tape)', () => {
  it('a good, untimed tape: ready to play, but says the text cannot follow it yet, with the one button', async () => {
    const r = await lib.importFile(put('good.m4a', m4a(8688, 11)), { sermonId: 1115 })
    if (!r.ok || !r.recording) throw new Error('x')
    const pf = await lib.preflight(r.recording.id, { durationMin: 145 }, { browserDurationSec: 8688.0, outputDevice: { present: true, label: 'Sanctuary speakers' } })
    expect(pf.status).toBe('warn')
    const by = Object.fromEntries(pf.checks.map((c) => [c.id, c]))
    expect(by.file.level).toBe('ok'); expect(by.whole.level).toBe('ok'); expect(by.decode.level).toBe('ok'); expect(by.length.level).toBe('ok'); expect(by.output.level).toBe('ok')
    expect(by.sync).toMatchObject({ level: 'warn', fix: 'sync' })
  })
  it('with timing for ≥90 % of the paragraphs it is fully ready; with less it says how much is missing', async () => {
    const r = await lib.importFile(put('t.m4a', m4a(600, 12)), { sermonId: 1 })
    if (!r.ok || !r.recording) throw new Error('x')
    const nums = Array.from({ length: 20 }, (_, i) => i + 1)
    db.saveMap(r.recording.id, null, 'tap', nums.slice(0, 10).map((n) => ({ n, t: n * 10, kind: 'start' as const })), [])
    let pf = await lib.preflight(r.recording.id, {}, { paragraphNumbers: nums })
    expect(pf.checks.find((c) => c.id === 'sync')).toMatchObject({ level: 'warn', fix: 'open-sync' })
    db.saveMap(r.recording.id, null, 'tap', nums.map((n) => ({ n, t: n * 10, kind: 'start' as const })), [])
    pf = await lib.preflight(r.recording.id, {}, { paragraphNumbers: nums })
    expect(pf.checks.find((c) => c.id === 'sync')?.level).toBe('ok')
  })
  it('a wrong-length tape, a missing file and a missing output each fail or warn in plain words', async () => {
    const r = await lib.importFile(put('w.m4a', m4a(48 * 60, 13)), { sermonId: 1 })
    if (!r.ok || !r.recording) throw new Error('x')
    let pf = await lib.preflight(r.recording.id, { durationMin: 112 }, { outputDevice: { present: false, label: 'USB mixer' } })
    expect(pf.checks.find((c) => c.id === 'length')?.level).toBe('warn')
    expect(pf.checks.find((c) => c.id === 'output')).toMatchObject({ level: 'fail', fix: 'choose-output' })
    rmSync(lib.resolvePath(r.file)!)
    pf = await lib.preflight(r.recording.id)
    expect(pf.status).toBe('fail')
    expect(pf.checks[0]).toMatchObject({ id: 'file', level: 'fail', fix: 'find-file' })
  })
  it('a recording that was removed is reported, not thrown', async () => {
    expect((await lib.preflight('r_nope')).status).toBe('fail')
  })
})
