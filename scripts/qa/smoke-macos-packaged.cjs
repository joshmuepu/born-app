/* Packaged macOS smoke (scripts only): starts an unpacked .app on an isolated profile / remote port / mDNS name and checks that the window
 * loads, the libraries are bundled and seeded and answer through the phone remote, and the bundle carries the v1 icon.
 * Usage: node scripts/qa/smoke-macos-packaged.cjs "<path to Branham or Nothing.app>" <profileDir>
 * Build the .app first:  npm run build && npx electron-builder --mac --arm64 --dir --publish never */
const path = require('path'), fs = require('fs'), crypto = require('crypto'), { execFileSync } = require('child_process')
const { launch, checks, sleep } = require('./lib.cjs')
const [appArg, profile] = process.argv.slice(2)
const appPath = appArg && path.resolve(appArg)
if (!appPath || !profile) { console.error('usage: smoke-macos-packaged.cjs <app> <profileDir>'); process.exit(2) }
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const RES = path.join(appPath, 'Contents', 'Resources'), ROOT = path.join(__dirname, '..', '..')
const PORT = 14319

;(async () => {
  const c = checks('smoke-macos-packaged')
  // bundled libraries (before launch)
  let out = ''; let ok = true
  try { out = execFileSync('node', [path.join(__dirname, 'verify-libraries.cjs'), RES], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch (e) { out = (e.stdout || '') + (e.stderr || ''); ok = false }
  c.ok('libraries bundled in the app (verify-libraries)', ok, out.split('\n').filter((l) => /checks/.test(l)).join(''))
  // identity
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const plist = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents', 'Info.plist')], { encoding: 'utf8' })
  const info = JSON.parse(plist)
  c.ok('bundle id, name and version are v1', info.CFBundleIdentifier === 'com.joshmuepu.born' && info.CFBundleName === 'Branham or Nothing' && info.CFBundleShortVersionString === pkg.version, JSON.stringify({ id: info.CFBundleIdentifier, name: info.CFBundleName, version: info.CFBundleShortVersionString }))
  const icns = path.join(RES, 'icon.icns')
  c.ok('bundle icon is the v1 icon (sha256 starts 805174be)', fs.existsSync(icns) && sha(icns).startsWith('805174be') && sha(icns) === sha(path.join(ROOT, 'build', 'icons', 'icon.icns')), fs.existsSync(icns) ? sha(icns).slice(0, 8) : 'no icon.icns')
  // run it
  const bin = path.join(appPath, 'Contents', 'MacOS', info.CFBundleExecutable)
  const app = await launch({ profile, exe: bin, cwd: path.dirname(bin), remotePort: PORT, mdns: 'born-remote-v1smoke', port: 9359, settle: 8000, timeout: 90000 })
  let page; try { page = await app.page(); c.ok('main window loads', true, await page.ev('document.title')) } catch (e) { c.ok('main window loads', false, e.message) }
  const base = `http://127.0.0.1:${PORT}`
  const j = async (u) => (await fetch(base + u)).json()
  try { c.ok('remote answers /ping', (await fetch(base + '/ping')).status === 200) } catch (e) { c.ok('remote answers /ping', false, e.message) }
  try { const r = await fetch(base + '/'); c.ok('remote page has frame protection', r.headers.get('x-frame-options') === 'DENY') } catch (e) { c.ok('remote page', false, e.message) }
  for (let i = 0; i < 60 && !(fs.existsSync(path.join(profile, 'sermons.db')) && fs.existsSync(path.join(profile, 'library.db'))); i++) await sleep(1000)
  try { const n = (await j('/api/search/sermons?q=faith')).length; c.ok('sermon search returns results', n > 100, n + ' results') } catch (e) { c.ok('sermon search', false, e.message) }
  try { const n = (await j('/api/search/songs?q=amazing')).length; c.ok('song search returns results', n > 0, n + ' results') } catch (e) { c.ok('song search', false, e.message) }
  try { const r = await j('/api/search/bible?q=' + encodeURIComponent('John 3:16')); c.ok('Bible lookup returns a passage', r.kind === 'passage') } catch (e) { c.ok('Bible lookup', false, e.message) }
  // the seeded databases in the data folder hold the full libraries
  let seeded = ''; let sok = true
  try { seeded = execFileSync('node', [path.join(__dirname, 'verify-libraries.cjs'), profile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch (e) { seeded = (e.stdout || '') + (e.stderr || ''); sok = false }
  c.ok('libraries as seeded into the data folder', sok, seeded.split('\n').filter((l) => /checks/.test(l)).join(''))
  const log = fs.readFileSync(path.join(profile, 'born.log'), 'utf8')
  c.ok('log shows a normal start and no errors', /mainWindow did-finish-load/.test(log) && !/\[ERROR\]/.test(log), (log.match(/\[ERROR\].*/g) || []).slice(0, 2).join(' | '))
  const res = c.done(); if (page) page.close(); await app.kill(); process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
