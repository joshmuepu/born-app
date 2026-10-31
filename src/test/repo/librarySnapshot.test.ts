/**
 * Release builds take the bundled libraries from the library snapshot (scripts/data/library-snapshot.json, a pre-release of this repo made
 * by the "refresh libraries (manual)" workflow), never from the outside sites. These guard that design: release.yml never rebuilds the
 * libraries or contacts the sources, snapshot tags can never look like release tags, the manifest's format is the app's own, and the fetch
 * script stops on a wrong checksum, a wrong count or a missing file.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs'
import { createServer, type Server } from 'http'
import { createHash, randomBytes } from 'crypto'
import { gzipSync } from 'zlib'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRequire } from 'module'

// Node's own SQLite builds the sample libraries (the native module can crash a test worker at teardown on newer Node)
type Db = { exec(sql: string): void; prepare(sql: string): { run(...a: unknown[]): void }; close(): void }
const { DatabaseSync } = createRequire(__filename)('node:sqlite') as { DatabaseSync: new (path: string) => Db }

const root = join(__dirname, '../../..')
const read = (p: string): string => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n')
const release = read('.github/workflows/release.yml')
const refresh = read('.github/workflows/refresh-libraries.yml')
const manifest = JSON.parse(read('scripts/data/library-snapshot.json'))
const SERMON_DB_FORMAT = Number(read('src/main/sermonDbUpgrade.ts').match(/export const SERMON_DB_FORMAT = (\d+)/)![1])

describe('release.yml uses the library snapshot', () => {
  it('never rebuilds the libraries and never contacts the sermon or Bible sources', () => {
    for (const s of ['build:db', 'build:library', 'bolls.life', 'table.branham.org', 'bible-cache', 'BORN_REUSE_BIBLE']) expect(release).not.toContain(s)
    expect(release).toContain('node scripts/data/fetch-library-snapshot.mjs scripts/data/library-snapshot.json resources')
    expect(release).toContain('node scripts/qa/verify-libraries.cjs resources') // the library guard stays
  })
  it('still builds and publishes only v1.MINOR.PATCH tags', () => {
    expect(release).toContain('=~ ^v1\\.[0-9]+\\.[0-9]+$ ]]')
    expect(release).toMatch(/push:\n {4}tags:\n {6}- 'v\*'/)
  })
})

describe('snapshot tags never look like release tags', () => {
  it('the refresh workflow names them libraries-v1-YYYYMMDD and refuses one starting with v', () => {
    expect(refresh).toContain('tag="libraries-v1-$(date -u +%Y%m%d)"')
    expect(refresh).toContain('case "$tag" in v*)')
    expect('libraries-v1-20261031').not.toMatch(/^v1\.[0-9]+\.[0-9]+$/)
  })
  it('the manifest names no snapshot yet, or one that does not start with v', () => {
    if (manifest.snapshot !== null) {
      expect(manifest.snapshot).toMatch(/^libraries-v1-\d{8}(-\d+)?$/)
      expect(manifest.snapshot).not.toMatch(/^v/i)
    }
  })
})

describe('the manifest', () => {
  it('records the sermon library in the format the app expects', () => {
    for (const f of manifest.files.filter((x: { name: string }) => x.name === 'sermons.db.gz')) expect(f.format).toBe(SERMON_DB_FORMAT)
    expect(read('scripts/data/write-library-manifest.mjs')).toContain('export const SERMON_DB_FORMAT = (\\d+)')
  })
  it('holds no text: names, sizes, checksums, formats, dates and counts only', () => {
    expect(JSON.stringify(manifest).length).toBeLessThan(8000)
  })
})

describe('the refresh workflow', () => {
  it('runs only when started by hand', () => {
    const on = refresh.slice(refresh.indexOf('\non:'), refresh.indexOf('\npermissions:'))
    expect(on).toContain('workflow_dispatch:')
    for (const t of ['push:', 'pull_request', 'schedule:', 'tags:', 'workflow_run']) expect(on).not.toContain(t)
  })
  it('compares before it publishes, publishes a plain pre-release, and deletes nothing', () => {
    expect(refresh.indexOf('check-library-refresh.py')).toBeLessThan(refresh.indexOf('gh release create'))
    expect(refresh).toContain('--prerelease --latest=false')
    expect(refresh).toContain('--notes "Library snapshot used by release builds"')
    expect(refresh).not.toMatch(/gh release delete|git push --force|git push -f/)
  })
  it('hands the publish job the libraries and the comparison side by side (one folder, so the artifact has no sub-folder)', () => {
    const upload = refresh.slice(refresh.indexOf('name: checked-libraries'), refresh.indexOf('retention-days: 3'))
    const paths = upload.split('\n').map((l) => l.trim()).filter((l) => /\.(gz|json)$/.test(l))
    expect(paths).toEqual(['resources/sermons.db.gz', 'resources/library.db.gz', 'resources/refresh-check.json'])
    expect(refresh).toContain('write-library-manifest.mjs snapshot "$tag" snapshot/refresh-check.json')
  })
})

/* ── the fetch script against a local stand-in for the GitHub API ───────────────────────────────────────────────────────────────── */
const TAG = 'libraries-v1-20990101'
let dir: string, server: Server, base: string
const files: Record<string, Buffer> = {}
let served: Record<string, Buffer> = {}
let counts: Record<string, number>

function sermonsDb(path: string): void {
  const d = new DatabaseSync(path)
  d.exec('CREATE TABLE sermons (id INTEGER PRIMARY KEY, date_code TEXT, title TEXT); CREATE TABLE paragraphs (id INTEGER PRIMARY KEY, sermon_id INTEGER, paragraph_ref TEXT, text TEXT)')
  d.exec(`PRAGMA user_version = ${SERMON_DB_FORMAT}`)
  const s = d.prepare('INSERT INTO sermons (id, date_code, title) VALUES (?, ?, ?)'), p = d.prepare('INSERT INTO paragraphs (sermon_id, paragraph_ref, text) VALUES (?, ?, ?)')
  d.exec('BEGIN')
  for (let i = 1; i <= 1001; i++) s.run(i, `00-${i}`, `Placeholder ${i}`)
  for (let i = 0; i < 100_010; i++) p.run((i % 1001) + 1, String(i), randomBytes(18).toString('base64'))
  d.exec('COMMIT')
  d.close()
}
function libraryDb(path: string): void {
  const d = new DatabaseSync(path)
  d.exec('CREATE TABLE bible_translations (code TEXT PRIMARY KEY, name TEXT); CREATE TABLE bible_verses (id INTEGER PRIMARY KEY, translation TEXT, text TEXT); CREATE TABLE songs (id INTEGER PRIMARY KEY, title TEXT); CREATE TABLE song_slides (id INTEGER PRIMARY KEY, song_id INTEGER, text TEXT)')
  const t = d.prepare('INSERT INTO bible_translations VALUES (?, ?)'), v = d.prepare('INSERT INTO bible_verses (translation, text) VALUES (?, ?)')
  const so = d.prepare('INSERT INTO songs (title) VALUES (?)'), sl = d.prepare('INSERT INTO song_slides (song_id, text) VALUES (?, ?)')
  d.exec('BEGIN')
  for (const c of ['KJV', 'WEB', 'ASV']) t.run(c, c)
  for (let i = 0; i < 90_003; i++) v.run('KJV', randomBytes(18).toString('base64'))
  for (let i = 1; i <= 1002; i++) so.run(`Placeholder song ${i}`)
  for (let i = 0; i < 5004; i++) sl.run((i % 1002) + 1, 'placeholder')
  d.exec('COMMIT')
  d.close()
}
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')
const goodManifest = (): Record<string, unknown> => ({
  snapshot: TAG,
  files: ['sermons.db.gz', 'library.db.gz'].map((name) => ({ name, sha256: sha(files[name]), size: files[name].length, format: name === 'sermons.db.gz' ? SERMON_DB_FORMAT : 0 })),
  counts: { ...counts }
})
function run(m: Record<string, unknown>): Promise<{ code: number; out: string; dir: string }> {
  const mp = join(dir, `manifest-${Math.random()}.json`), out = mkdtempSync(join(dir, 'out-'))
  writeFileSync(mp, JSON.stringify(m))
  return new Promise((resolve) => {
    execFile(process.execPath, [join(root, 'scripts/data/fetch-library-snapshot.mjs'), mp, out], { env: { ...process.env, BORN_GITHUB_API: base, GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: '' }, timeout: 60_000 },
      (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: stdout + stderr, dir: out }))
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'born-snapshot-'))
  sermonsDb(join(dir, 'sermons.db')); libraryDb(join(dir, 'library.db'))
  for (const n of ['sermons', 'library']) files[`${n}.db.gz`] = gzipSync(readFileSync(join(dir, `${n}.db`)))
  counts = { sermons: 1001, paragraphRows: 100_010, translations: 3, verses: 90_003, songs: 1002, slides: 5004 }
  server = createServer((req, res) => {
    const url = req.url || ''
    if (url === `/repos/owner/repo/releases/tags/${TAG}`) {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ tag_name: TAG, assets: Object.keys(served).map((name) => ({ name, url: `${base}/asset/${name}` })) }))
    } else if (url.startsWith('/asset/') && served[url.slice(7)]) res.end(served[url.slice(7)])
    else { res.statusCode = 404; res.end('{}') }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
}, 60_000)
afterAll(() => { server?.close(); rmSync(dir, { recursive: true, force: true }) })

describe('fetch-library-snapshot.mjs', () => {
  it('puts both files in place when the checksums and the exact counts match', async () => {
    served = { ...files }
    const r = await run(goodManifest())
    expect(r.out).toContain(`library snapshot ${TAG}: checksums and exact counts match`)
    expect(r.code).toBe(0)
    expect(existsSync(join(r.dir, 'sermons.db.gz')) && existsSync(join(r.dir, 'library.db.gz'))).toBe(true)
  }, 60_000)

  it('stops on a wrong checksum, naming the snapshot', async () => {
    served = { ...files }
    const m = goodManifest() as { files: Array<{ sha256: string }> }
    m.files[1].sha256 = '0'.repeat(64)
    const r = await run(m)
    expect(r.code).toBe(1)
    expect(r.out).toContain(`Library snapshot ${TAG}: library.db.gz has SHA-256`)
  }, 60_000)

  it('stops on a count that differs from the manifest, and leaves no library behind', async () => {
    served = { ...files }
    const m = goodManifest() as { counts: Record<string, number> }
    m.counts.verses += 1
    const r = await run(m)
    expect(r.code).toBe(1)
    expect(r.out).toContain('Bible verses: 90003 differs from the snapshot manifest (90004)')
    expect(r.out).toContain('do not match the counts in the manifest')
    expect(existsSync(join(r.dir, 'library.db.gz'))).toBe(false)
  }, 60_000)

  it('stops when a file is missing from the snapshot release', async () => {
    served = { 'sermons.db.gz': files['sermons.db.gz'] }
    const r = await run(goodManifest())
    expect(r.code).toBe(1)
    expect(r.out).toContain('library.db.gz is missing from the snapshot release')
  }, 60_000)

  it('stops when the manifest names no snapshot, and never goes to the sources instead', async () => {
    const r = await run({ snapshot: null, files: [], counts: {} })
    expect(r.code).toBe(1)
    expect(r.out).toContain('names no snapshot yet')
    const src = read('scripts/data/fetch-library-snapshot.mjs')
    for (const s of ['bolls.life', 'table.branham.org', 'build:db', 'build:library']) expect(src).not.toContain(s)
  }, 60_000)
})
