import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import fs, { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync, renameSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gzipSync } from 'zlib'
import { upgradeSermonDb, finishInterruptedUpgrade, SERMON_DB_FORMAT } from '../../main/sermonDbUpgrade'
import { initSchema } from '../../main/schema'

// synthetic libraries in the real schema: an old profile (sections, user_version 0) and a rebuilt bundled one (paragraph rows, user_version 3)
function make(path: string, version: number, rows: Array<[number, string, string]>, extra?: (d: Database.Database) => void, replace = false): void {
  if (replace) fs.rmSync(path, { force: true })
  const d = new Database(path)
  initSchema(d)
  d.prepare('INSERT INTO sermons (id, date_code, title) VALUES (1, ?, ?)').run('99-0101M', 'A Sample Message')
  rows.forEach(([sid, ref, text], i) => d.prepare('INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (?, ?, ?, ?)').run(sid, ref, i, text))
  extra?.(d)
  d.pragma(`user_version = ${version}`)
  d.close()
}

let dir: string, profile: string, gz: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'born-upgrade-'))
  profile = join(dir, 'sermons.db')
  make(profile, 0, [[1, '10-11', '10 Alpha. 11 Bravo.']], (d) => {
    // a sermon fetched online after install, and a downloaded translation: both only in the profile
    d.prepare("INSERT INTO sermons (id, date_code, title) VALUES (2, '99-0202E', 'Fetched Later')").run()
    d.prepare("INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (2, '1-2', 0, '1 Late. 2 Later.')").run()
    d.prepare("INSERT INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) VALUES (1, 'fr', '10-11', 0, '10 Alpha fr. 11 Bravo fr.')").run()
  })
  const bundled = join(dir, 'bundled.db')
  make(bundled, 3, [[1, '10', '10 Alpha.'], [1, '11', '11 Bravo.']])
  gz = join(dir, 'sermons.db.gz')
  writeFileSync(gz, gzipSync(readFileSync(bundled)))
})

describe('a profile made before the paragraph rebuild gets the new library, and loses nothing', () => {
  it('the profile now has one row per paragraph', () => {
    const r = upgradeSermonDb(profile, gz, new Date('2026-10-27T12:00:00Z'))
    expect(r.upgraded).toBe(true)
    const d = new Database(profile, { readonly: true })
    expect(d.prepare('SELECT paragraph_ref FROM paragraphs WHERE sermon_id = 1 ORDER BY paragraph_index').all().map((x) => (x as { paragraph_ref: string }).paragraph_ref)).toEqual(['10', '11'])
    expect(d.pragma('user_version', { simple: true })).toBe(3)
    d.close()
  })
  it('a sermon fetched after install and a downloaded translation are carried over', () => {
    const r = upgradeSermonDb(profile, gz)
    expect(r).toMatchObject({ keptSermons: 1, keptTranslations: 1 })
    const d = new Database(profile, { readonly: true })
    expect(d.prepare('SELECT title FROM sermons WHERE id = 2').get()).toEqual({ title: 'Fetched Later' })
    expect(d.prepare('SELECT COUNT(*) AS n FROM paragraphs WHERE sermon_id = 2').get()).toEqual({ n: 1 })
    expect(d.prepare("SELECT text FROM translated_paragraphs WHERE language = 'fr'").get()).toEqual({ text: '10 Alpha fr. 11 Bravo fr.' })
    // the search index of the new library finds the carried-over sermon too
    expect(d.prepare("SELECT COUNT(*) AS n FROM paragraphs_fts WHERE paragraphs_fts MATCH 'later'").get()).toEqual({ n: 1 })
    d.close()
  })
  it('the old file is kept as a dated backup', () => {
    const r = upgradeSermonDb(profile, gz, new Date('2026-10-27T12:00:00Z'))
    expect(r.backup).toBe(`${profile}.sections-2026-10-27.bak`)
    expect(existsSync(r.backup!)).toBe(true)
    const b = new Database(r.backup!, { readonly: true })
    expect(b.prepare('SELECT COUNT(*) AS n FROM paragraphs').get()).toEqual({ n: 2 })
    b.close()
  })
  it('nothing happens to a profile that is already current, or when there is no newer bundled library', () => {
    expect(upgradeSermonDb(profile, gz).upgraded).toBe(true)
    expect(upgradeSermonDb(profile, gz)).toMatchObject({ upgraded: false, reason: 'already current' })
    const fresh = join(dir, 'other.db'); make(fresh, 0, [[1, '1', '1 A.']])
    expect(upgradeSermonDb(fresh, undefined)).toMatchObject({ upgraded: false, reason: 'no bundled library' })
    expect(readdirSync(dir).some((f) => f.endsWith('.upgrade'))).toBe(false)
  })
})

describe('format 3 is the paragraph library (the same number means the same contents in v1 and v2)', () => {
  it('the app and the build both name format 3', () => {
    expect(SERMON_DB_FORMAT).toBe(3)
    expect(readFileSync(join(__dirname, '../../../scripts/build-sermon-db.ts'), 'utf8')).toMatch(/user_version = \$\{SERMON_DB_FORMAT\}|user_version = 3/)
  })
  for (const old of [0, 1, 2]) {
    it(`a format ${old} profile is brought to format 3: backup kept, fetched sermon and translation carried over, a second start does nothing`, () => {
      make(profile, old, [[1, '10-11', '10 Alpha. 11 Bravo.']], (d) => {
        d.prepare("INSERT INTO sermons (id, date_code, title) VALUES (2, '99-0202E', 'Fetched Later')").run()
        d.prepare("INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (2, '1', 0, '1 Late.')").run()
        d.prepare("INSERT INTO translated_paragraphs (sermon_id, language, paragraph_ref, paragraph_index, text) VALUES (1, 'fr', '10', 0, '10 Alpha fr.')").run()
      }, true)
      const r = upgradeSermonDb(profile, gz, new Date('2026-10-27T12:00:00Z'))
      expect(r).toMatchObject({ upgraded: true, keptSermons: 1, keptTranslations: 1 })
      // format 0 is the sections library; a later format is named by its number
      expect(r.backup).toBe(old === 0 ? `${profile}.sections-2026-10-27.bak` : `${profile}.format${old}-2026-10-27.bak`)
      const b = new Database(r.backup!, { readonly: true })
      expect(b.pragma('user_version', { simple: true })).toBe(old)
      b.close()
      const d = new Database(profile, { readonly: true })
      expect(d.pragma('user_version', { simple: true })).toBe(3)
      expect(d.prepare('SELECT title FROM sermons WHERE id = 2').get()).toEqual({ title: 'Fetched Later' })
      d.close()
      expect(upgradeSermonDb(profile, gz)).toMatchObject({ upgraded: false, reason: 'already current' })
    })
  }
})

describe('when the upgrade cannot be done, the profile keeps its library exactly as it was', () => {
  const snapshot = (): string => readFileSync(profile).toString('base64')
  afterEach(() => vi.restoreAllMocks())

  it('a read-only profile folder', () => {
    if (process.platform === 'win32') return // folder permissions work differently there
    const before = snapshot()
    chmodSync(dir, 0o555)
    try {
      expect(() => upgradeSermonDb(profile, gz)).toThrow()
    } finally {
      chmodSync(dir, 0o755)
    }
    expect(snapshot()).toBe(before)
    expect(readdirSync(dir).some((f) => f.endsWith('.upgrade') || f.endsWith('.bak'))).toBe(false)
  })
  it('too little disk space: nothing is written', () => {
    const before = snapshot()
    vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 10, bsize: 4096 } as unknown as fs.StatsFs)
    expect(upgradeSermonDb(profile, gz)).toMatchObject({ upgraded: false, reason: 'not enough disk space' })
    expect(snapshot()).toBe(before)
    expect(readdirSync(dir).some((f) => f.endsWith('.upgrade'))).toBe(false)
  })
  it('the disk fills up while the new file is written: the half-written file is removed', () => {
    const before = snapshot()
    const real = fs.writeFileSync
    vi.spyOn(fs, 'writeFileSync').mockImplementation((p, data, ...rest) => {
      if (String(p).endsWith('.upgrade')) { real(p as string, (data as Buffer).subarray(0, 1000)); throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }) }
      return real(p as string, data as Buffer, ...(rest as []))
    })
    expect(() => upgradeSermonDb(profile, gz)).toThrow(/ENOSPC/)
    expect(snapshot()).toBe(before)
    expect(readdirSync(dir).some((f) => f.endsWith('.upgrade'))).toBe(false)
  })
  it('a damaged bundled library', () => {
    const before = snapshot()
    writeFileSync(gz, Buffer.from('not a gzip file'))
    expect(() => upgradeSermonDb(profile, gz)).toThrow()
    expect(snapshot()).toBe(before)
  })
  it('a half-written file left by an earlier attempt is never used: it is replaced by a full one', () => {
    writeFileSync(`${profile}.upgrade`, Buffer.from('half'))
    expect(upgradeSermonDb(profile, gz).upgraded).toBe(true)
    const d = new Database(profile, { readonly: true })
    expect(d.pragma('user_version', { simple: true })).toBe(3)
    d.close()
  })
})

describe('a start cut off in the middle of the swap', () => {
  it('finds no sermons.db but a complete new one beside it, and puts that in place', () => {
    const next = `${profile}.upgrade`
    writeFileSync(next, readFileSync(join(dir, 'bundled.db')))
    renameSync(profile, `${profile}.sections-2026-10-27.bak`)
    expect(finishInterruptedUpgrade(profile)).toBe(true)
    expect(existsSync(profile)).toBe(true)
    expect(existsSync(next)).toBe(false)
  })
  it('does nothing when the profile has its library, or when what is beside it is not a complete new one', () => {
    writeFileSync(`${profile}.upgrade`, Buffer.from('half'))
    expect(finishInterruptedUpgrade(profile)).toBe(false)
    renameSync(profile, `${profile}.moved`)
    expect(finishInterruptedUpgrade(profile)).toBe(false)
  })
})
