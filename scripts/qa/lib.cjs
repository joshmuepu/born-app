/* QA harness (scripts only, never shipped): launches BORN v1 on an isolated profile and drives it over the
 * Chrome debugging port. Adapted from v2's scripts/qa/lib.cjs. Never touches the real v1 data folder or ports:
 * every run gets BORN_USER_DATA_DIR, BORN_REMOTE_PORT and BORN_MDNS_NAME of its own.
 * Needs Node 22+ (built-in WebSocket) and `npm run build` first (it runs `electron .` against out/).
 * Usage: const { launch } = require('./lib.cjs'); const app = await launch({ profile: '/tmp/x' }); const p = await app.page(); ... await app.kill()
 */
const { spawn, spawnSync, execFileSync } = require('child_process')
const fs = require('fs'), path = require('path'), http = require('http')
const ROOT = path.join(__dirname, '..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (url) => new Promise((res, rej) => { http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) })
const MAIN_TITLE = /Branham or Nothing/

class Page {
  constructor(target) { this.target = target; this.id = 0; this.pend = new Map(); this.logs = [] }
  async connect() {
    this.ws = new WebSocket(this.target.webSocketDebuggerUrl)
    await new Promise((r, j) => { this.ws.addEventListener('open', r); this.ws.addEventListener('error', j) })
    this.ws.addEventListener('message', (m) => {
      const j = JSON.parse(m.data)
      if (j.id && this.pend.has(j.id)) { this.pend.get(j.id)(j); this.pend.delete(j.id); return }
      if (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type)) this.logs.push({ kind: 'console.' + j.params.type, text: j.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400) })
      else if (j.method === 'Runtime.exceptionThrown') this.logs.push({ kind: 'exception', text: (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text || '').slice(0, 500) })
    })
    for (const d of ['Runtime', 'Page']) await this.send(d + '.enable')
    return this
  }
  send(method, params = {}) { return new Promise((res) => { const i = ++this.id; this.pend.set(i, res); this.ws.send(JSON.stringify({ id: i, method, params })) }) }
  async ev(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error('page error: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value }
  /** click the first visible, on-top element whose text/aria-label starts with `text`, with real mouse events */
  async click(text, sel = 'button,[role=button],[role=tab],[role=menuitem],a,summary,label') {
    const pos = await this.ev(`(()=>{const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};const top=x=>{const r=x.getBoundingClientRect();const e=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)));return !!e&&(x===e||x.contains(e)||e.contains(x))};const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>vis(x)&&top(x)&&((x.getAttribute('aria-label')||'')+' '+x.textContent).trim().toLowerCase().startsWith(${JSON.stringify(text.toLowerCase())}));if(!b)return null;b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`)
    if (!pos) return false
    await this.mouse(pos[0], pos[1])
    return true
  }
  async mouse(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }
  async clickSel(sel) { const pos = await this.ev(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});if(!b)return null;b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (!pos) return false; await this.mouse(pos[0], pos[1]); return true }
  async key(key, o = {}) {
    const code = o.code || (key.length === 1 ? (/[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : '') : key)
    const vk = { Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, ' ': 32, Backspace: 8, F1: 112 }[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0)
    const mods = (o.shift ? 8 : 0) | (o.ctrl ? 2 : 0) | (o.alt ? 1 : 0) | (o.meta ? 4 : 0)
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers: mods, text: key.length === 1 && !o.ctrl && !o.meta ? key : undefined, ...(o.commands ? { commands: o.commands } : {}) })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers: mods })
  }
  async type(text) { for (const ch of text) await this.key(ch) }
  async insertText(text) { await this.send('Input.insertText', { text }) }
  async shot(file) { const r = await this.send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); return file }
  async viewport(w, h, scale = 1) { await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false }) }
  async clearViewport() { await this.send('Emulation.clearDeviceMetricsOverride') }
  async waitFor(expr, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await this.ev(expr); if (v) return v } catch { /* retry */ } await sleep(150) } return null }
  takeLogs() { const l = this.logs; this.logs = []; return l }
  close() { try { this.ws.close() } catch { /* closed */ } }
}

/* Every app this run starts is stopped when the run ends, also on a failure, an uncaught error or Ctrl+C: signal first, then force-stop after a short
   wait. At exit the run reports any process still holding one of its own profile folders open. */
const running = new Set()
const profilesUsed = new Set()
const alive = (pid) => { if (!pid) return false; try { process.kill(pid, 0); return true } catch { return false } }
const signal = (pid, sig) => { try { process.kill(pid, sig) } catch { /* gone */ } }
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
/** the real Electron process (the launcher is a node wrapper): the one listening on the debugging port */
function listenerPid(port) {
  if (process.platform === 'win32') return 0
  try { return Number(execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0]) || 0 } catch { return 0 }
}
/** processes holding files in a profile folder open (the app keeps its databases there open while it runs) */
function holders(dir) {
  if (process.platform === 'win32' || !fs.existsSync(dir)) return []
  // lsof exits 1 over a folder even when it lists processes, so its output is read whatever the exit code
  const r = spawnSync('lsof', ['-t', '+D', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  return String(r.stdout || '').trim().split('\n').filter(Boolean).map(Number)
}
async function stopApp(app, waitMs = 4000) {
  const pids = [app.proc.pid, app.pid].filter(Boolean)
  for (const pid of pids) signal(pid, 'SIGTERM')
  const t0 = Date.now()
  while (pids.some(alive) && Date.now() - t0 < waitMs) await sleep(200)
  for (const pid of pids) if (alive(pid)) signal(pid, 'SIGKILL')
  running.delete(app)
}
function stopAllSync() {
  const pids = [...running].flatMap((a) => [a.proc.pid, a.pid]).filter(alive)
  running.clear()
  for (const pid of pids) signal(pid, 'SIGTERM')
  const t0 = Date.now()
  while (pids.some(alive) && Date.now() - t0 < 3000) sleepSync(100)
  for (const pid of pids) if (alive(pid)) signal(pid, 'SIGKILL')
}
function reportLeftovers() {
  const left = [...profilesUsed].flatMap((dir) => holders(dir).filter((pid) => pid !== process.pid).map((pid) => `${pid} (${dir})`))
  if (left.length) console.error(`QA harness: still running from this run's profile folders: ${left.join(', ')}`)
}
process.on('exit', () => { stopAllSync(); reportLeftovers() })
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130))
process.on('uncaughtException', (e) => { console.error(e); process.exit(2) })
process.on('unhandledRejection', (e) => { console.error(e); process.exit(2) })

/** Launch on an isolated profile. o: { profile, port=9356, remotePort=14316, mdns='born-remote-v1qa', exe?, env?, settle? }
 *  `exe` runs a packaged app binary instead of `electron .` (the packaged smoke). */
async function launch(o) {
  const port = o.port || 9356
  fs.mkdirSync(o.profile, { recursive: true })
  profilesUsed.add(path.resolve(o.profile))
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) try { fs.rmSync(path.join(o.profile, f), { force: true }) } catch { /* none */ }
  const env = { ...process.env, BORN_USER_DATA_DIR: o.profile, BORN_REMOTE_PORT: String(o.remotePort || 14316), BORN_MDNS_NAME: o.mdns || 'born-remote-v1qa', ...(o.env || {}) }
  delete env.ELECTRON_RUN_AS_NODE
  const log = fs.openSync(path.join(o.profile, 'qa-stdout.log'), 'a')
  const bin = o.exe || path.join(ROOT, 'node_modules', '.bin', 'electron')
  const args = [...(o.extraArgs || []), ...(o.exe ? [`--remote-debugging-port=${port}`] : ['.', `--remote-debugging-port=${port}`])]
  const proc = spawn(bin, args, { cwd: o.cwd || ROOT, env, stdio: ['ignore', log, log] })
  const t0 = Date.now()
  while (Date.now() - t0 < (o.timeout || 60000)) {
    try { const ts = await getJson(`http://127.0.0.1:${port}/json`); if (ts.some((t) => t.type === 'page' && MAIN_TITLE.test(t.title))) break } catch { /* not up */ }
    await sleep(500)
  }
  const app = {
    proc, pid: listenerPid(port), port, profile: o.profile, remotePort: o.remotePort || 14316,
    targets: () => getJson(`http://127.0.0.1:${port}/json`),
    async page(match = (t) => t.type === 'page' && MAIN_TITLE.test(t.title)) { const ts = await this.targets(); const t = ts.find(match); if (!t) throw new Error('no such window'); return new Page(t).connect() },
    /** signal, then force-stop after a short wait (the launcher and the real app both) */
    async kill() { await stopApp(app) }
  }
  running.add(app)
  await sleep(o.settle ?? 4000)
  return app
}

/** For a script that starts the app itself: stopped like the others at the end of the run. `port` is one the app listens on, to find the real app. */
function adopt(proc, port, profile) {
  if (profile) profilesUsed.add(path.resolve(profile))
  const app = { proc, pid: 0, findPid() { app.pid = listenerPid(port) || app.pid; return app.pid }, async kill() { app.findPid(); await stopApp(app) } }
  running.add(app)
  return app
}

/** Tiny check recorder shared by the repro/regression scripts. */
function checks(name) {
  const rows = []
  return {
    ok(label, pass, detail = '') { rows.push({ label, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`) },
    done() { const failed = rows.filter((r) => !r.pass).length; console.log(`\n${name}: ${rows.length} checks, ${failed} failed`); return { rows, failed } }
  }
}
module.exports = { launch, adopt, Page, sleep, getJson, checks, ROOT }
