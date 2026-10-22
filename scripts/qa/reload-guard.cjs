/* Ctrl/Cmd+R guard, checked in the real app's MAIN process through Node's inspector (not a physical key press, which cannot be injected).
 * Attaches to the app with --inspect, finds the main window and feeds its real `before-input-event` handler(s) synthetic key events:
 * reload chords must be blocked (preventDefault), every other key must not be. In a packaged app the handler must exist; unpackaged it must not.
 * Usage: node scripts/qa/reload-guard.cjs <profileDir> [<packaged app executable>]   (no executable = `electron .` from this checkout, i.e. development) */
const path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process')
const { checks, sleep } = require('./lib.cjs')
const [profile, exe] = process.argv.slice(2)
const ROOT = path.join(__dirname, '..', '..')
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej))
;(async () => {
  const c = checks('reload-guard')
  fs.mkdirSync(profile, { recursive: true })
  const env = { ...process.env, BORN_USER_DATA_DIR: profile, BORN_REMOTE_PORT: '14324', BORN_MDNS_NAME: 'born-remote-v1rg' }; delete env.ELECTRON_RUN_AS_NODE
  try { await getJson('http://127.0.0.1:9331/json'); console.error('port 9331 is already in use (a leftover app?) — stop it first'); process.exit(2) } catch { /* free */ }
  const bin = exe || path.join(ROOT, 'node_modules', '.bin', 'electron')
  const proc = spawn(bin, [...(exe ? [] : ['.']), '--inspect=9331'], { cwd: exe ? path.dirname(exe) : ROOT, env, stdio: 'ignore' })
  let target
  for (let i = 0; i < 60 && !target; i++) { await sleep(500); try { target = (await getJson('http://127.0.0.1:9331/json'))[0] } catch { /* not up */ } }
  if (!target) { c.ok('inspector attached', false); proc.kill(); process.exit(1) }
  await sleep(5000)
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pend = new Map(); ws.addEventListener('message', (m) => { const j = JSON.parse(m.data); if (pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id) } })
  const ev = (expression) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } })) }).then((r) => { if (r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || "").slice(0, 300)); return r.result.result.value })
  const PRE = `(async()=>{ let el; try { el = process.mainModule.require('electron') } catch (e) { const m = await import('electron'); el = m.default || m } const { BrowserWindow, app } = el; const wins = BrowserWindow.getAllWindows(); const main = wins.find(w => /Branham or Nothing/.test(w.getTitle())) || wins[0]; return { app, BrowserWindow, main, wc: main.webContents } })()`
  const info = await ev(`(async()=>{ const x = await ${PRE}; return { packaged: x.app.isPackaged, windows: x.BrowserWindow.getAllWindows().length, listeners: x.wc.listeners('before-input-event').length } })()`)
  const packaged = info.packaged
  console.log('app.isPackaged =', packaged, ' main-window before-input-event listeners =', info.listeners)
  c.ok(packaged ? 'packaged: the main window has the key guard' : 'development: the main window has NO key guard (reload keeps working for developers)', packaged ? info.listeners >= 1 : info.listeners === 0, JSON.stringify(info))
  const press = (input) => ev(`(async()=>{ const x = await ${PRE}; const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }; x.wc.emit('before-input-event', e, ${JSON.stringify(input)}); return e.defaultPrevented })()`)
  const kd = (key, mods = {}) => ({ type: 'keyDown', key, control: false, meta: false, alt: false, shift: false, ...mods })
  const blocks = [['Ctrl+R', kd('r', { control: true })], ['Cmd+R', kd('r', { meta: true })], ['Ctrl+Shift+R (force reload)', kd('R', { control: true, shift: true })], ['Cmd+Shift+R', kd('R', { meta: true, shift: true })]]
  const passes = [['R alone', kd('r')], ['Ctrl+F', kd('f', { control: true })], ['Ctrl+C', kd('c', { control: true })], ['Cmd+V', kd('v', { meta: true })], ['Esc', kd('Escape')], ['Space', kd(' ')], ['ArrowRight', kd('ArrowRight')], ['Ctrl+ArrowRight', kd('ArrowRight', { control: true })], ['Ctrl+Shift+W', kd('W', { control: true, shift: true })], ['Ctrl+Alt+R', kd('r', { control: true, alt: true })], ['Ctrl+R key-up', { type: 'keyUp', key: 'r', control: true, meta: false, alt: false, shift: false }]]
  for (const [n, i] of blocks) { const prevented = await press(i); c.ok(`${n} is ${packaged ? 'blocked' : 'left alone (development)'}`, packaged ? prevented === true : prevented === false, 'defaultPrevented=' + prevented) }
  for (const [n, i] of passes) { const prevented = await press(i); c.ok(`${n} is never blocked`, prevented === false, 'defaultPrevented=' + prevented) }
  const res = c.done(); ws.close(); proc.kill('SIGTERM'); await sleep(1500); try { proc.kill('SIGKILL') } catch {} ; process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); try { require('child_process').execSync('pkill -f inspect=9331') } catch {} process.exit(2) })
