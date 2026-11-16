/* Sermon library upgrade in the real app (scripts only, never shipped): a profile whose sermons.db is format 0, 1 or 2, with a sermon fetched after
 * install (invented, in a table whose columns are in another order), is started; the app must bring it to format 3, keep a dated backup of the old file,
 * keep the fetched sermon with its title and date in the right columns, and search must work. The old library is the bundled one marked older (the
 * rows do not matter to the upgrade; its version does).
 * Usage: node scripts/qa/library-upgrade.cjs <workDir>   (needs `npm run build`; better-sqlite3 built for Electron: profiles are made with
 * Electron's own Node) */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process')
const { launch, sleep, checks, ROOT } = require('./lib.cjs')
const [work] = process.argv.slice(2)
const electron = path.join(ROOT, 'node_modules', '.bin', 'electron')
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316)

// run a small better-sqlite3 job on Electron's Node (the native module is built for Electron)
const sql = (file, js) => execFileSync(electron, ['-e', `const D=require(${JSON.stringify(path.join(ROOT, 'node_modules', 'better-sqlite3'))});const d=new D(${JSON.stringify(file)});try{${js}}finally{d.close()}`], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' }).trim()

;(async () => {
  const c = checks('library-upgrade')
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true })
  const bundled = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'resources', 'sermons.db.gz')))
  const today = new Date().toISOString().slice(0, 10)
  for (const format of [0, 1, 2]) {
    const profile = path.join(work, 'p' + format); fs.mkdirSync(profile, { recursive: true })
    const db = path.join(profile, 'sermons.db')
    fs.writeFileSync(db, bundled)
    // an older profile: its version, and a sermon fetched after install in a sermons table whose columns are in another order
    sql(db, `d.pragma("foreign_keys = OFF"); d.pragma("legacy_alter_table = ON"); d.exec("ALTER TABLE sermons RENAME TO sermons_new; CREATE TABLE sermons (id INTEGER PRIMARY KEY, title TEXT NOT NULL, date_code TEXT NOT NULL, total_sections INTEGER NOT NULL DEFAULT 0); INSERT INTO sermons (id, title, date_code, total_sections) SELECT id, title, date_code, total_sections FROM sermons_new; DROP TABLE sermons_new;"); d.prepare("INSERT INTO sermons (id, title, date_code) VALUES (987654, 'Invented Fetched Sermon', '99-0101X')").run(); d.prepare("INSERT INTO paragraphs (sermon_id, paragraph_ref, paragraph_index, text) VALUES (987654, '1', 0, '1 Zephyrine placeholder words.')").run(); d.pragma('user_version = ${format}')`)
    const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-parity', settle: 12000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
    const hits = await (await fetch(`http://127.0.0.1:${PORT}/api/search/sermons?q=zephyrine`)).json().catch(() => [])
    const faith = await (await fetch(`http://127.0.0.1:${PORT}/api/search/sermons?q=faith`)).json().catch(() => [])
    await app.kill(); await sleep(500)
    const version = Number(sql(db, `process.stdout.write(String(d.pragma('user_version',{simple:true})))`))
    const kept = sql(db, `process.stdout.write(JSON.stringify(d.prepare('SELECT title, date_code FROM sermons WHERE id = 987654').get()||null))`)
    const name = format === 0 ? 'sections' : `format${format}`
    const backup = path.join(profile, `sermons.db.${name}-${today}.bak`)
    c.ok(`format ${format}: upgraded to format 3`, version === 3, String(version))
    c.ok(`format ${format}: the old file is kept as a dated backup (${path.basename(backup)})`, fs.existsSync(backup))
    c.ok(`format ${format}: the fetched sermon is kept, title and date in their own columns`, kept === JSON.stringify({ title: 'Invented Fetched Sermon', date_code: '99-0101X' }), kept)
    c.ok(`format ${format}: search finds it, and the library`, Array.isArray(hits) && hits.length >= 1 && Array.isArray(faith) && faith.length > 50, `${hits.length} / ${faith.length}`)
  }
  const r = c.done(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
