/* QA harness core: launches BORN on an isolated profile and drives it over the Chrome debugging port. Never touches real data or ports.
 * Usage: const { launch } = require('./lib.cjs'); const app = await launch({ profile: '/tmp/x', port: 9950 }); ... await app.kill()
 */
const { spawn, execSync } = require('child_process')
const fs = require('fs'), path = require('path'), http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', 'ws'))
const ROOT = path.join(__dirname, '..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (url) => new Promise((res, rej) => { http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) })

class Page {
  constructor(target) { this.target = target; this.id = 0; this.pend = new Map(); this.logs = []; this.listeners = [] }
  async connect() {
    this.ws = new WebSocket(this.target.webSocketDebuggerUrl)
    await new Promise((r, j) => { this.ws.on('open', r); this.ws.on('error', j) })
    this.ws.on('message', (m) => {
      const j = JSON.parse(m)
      if (j.id && this.pend.has(j.id)) { this.pend.get(j.id)(j); this.pend.delete(j.id); return }
      if (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type)) this.logs.push({ kind: 'console.' + j.params.type, text: j.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400) })
      else if (j.method === 'Runtime.exceptionThrown') this.logs.push({ kind: 'exception', text: (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text || '').slice(0, 500) })
      else if (j.method === 'Network.loadingFailed' && !j.params.canceled) this.logs.push({ kind: 'network', text: `${j.params.errorText} ${j.params.requestId}` })
      else if (j.method === 'Log.entryAdded' && ['error', 'warning'].includes(j.params.entry.level)) this.logs.push({ kind: 'log.' + j.params.entry.level, text: (j.params.entry.text + ' ' + (j.params.entry.url || '')).slice(0, 400) })
    })
    for (const d of ['Runtime', 'Page', 'Network', 'Log']) await this.send(d + '.enable')
    return this
  }
  send(method, params = {}) { return new Promise((res) => { const i = ++this.id; this.pend.set(i, res); this.ws.send(JSON.stringify({ id: i, method, params })) }) }
  async ev(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error('page error: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value }
  /** click the first visible element whose text starts with `text` (or matches the selector) */
  async click(text, sel = 'button,[role=button],[role=tab],[role=menuitem],a,summary,label') {
    return this.ev(`(()=>{const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>vis(x)&&((x.getAttribute('aria-label')||'')+' '+x.textContent).trim().toLowerCase().startsWith(${JSON.stringify(text.toLowerCase())}));if(b){b.click();return true}return false})()`)
  }
  async clickSel(sel) { return this.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e){e.click();return true}return false})()`) }
  async key(key, o = {}) {
    const code = o.code || (key.length === 1 ? 'Key' + key.toUpperCase() : key)
    const vk = { Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, ' ': 32, Backspace: 8, F6: 117 }[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0)
    const mods = (o.shift ? 8 : 0) | (o.ctrl ? 2 : 0) | (o.alt ? 1 : 0) | (o.meta ? 4 : 0)
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers: mods, text: key.length === 1 && !o.ctrl && !o.meta ? key : undefined })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers: mods })
  }
  async type(text) { for (const ch of text) await this.key(ch) }
  async shot(file, o = {}) { const r = await this.send('Page.captureScreenshot', { format: o.format || 'png', ...(o.quality ? { quality: o.quality } : {}) }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); return file }
  async viewport(w, h, scale = 1) { await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false }) }
  async clearViewport() { await this.send('Emulation.clearDeviceMetricsOverride') }
  async waitFor(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await this.ev(fn); if (v) return v } catch { /* retry */ } await sleep(150) } return null }
  takeLogs() { const l = this.logs; this.logs = []; return l }
  close() { try { this.ws.close() } catch { /* closed */ } }
}

async function launch(o) {
  const port = o.port || 9950
  fs.mkdirSync(o.profile, { recursive: true })
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) try { fs.rmSync(path.join(o.profile, f), { force: true }) } catch { /* none */ }
  const env = { ...process.env, BORN_USER_DATA_DIR: o.profile, BORN_REMOTE_PORT: String(o.remotePort || 4350), BORN_MDNS_NAME: o.mdns || 'born-qa', ...(o.env || {}) }
  delete env.ELECTRON_RUN_AS_NODE
  const bin = path.join(ROOT, 'node_modules', '.bin', 'electron')
  const proc = spawn(bin, [o.app || '.', `--remote-debugging-port=${port}`, ...(o.args || [])], { cwd: ROOT, env, stdio: ['ignore', fs.openSync(o.log || path.join(o.profile, 'qa-stdout.log'), 'a'), fs.openSync(o.log || path.join(o.profile, 'qa-stdout.log'), 'a')], detached: false })
  const t0 = Date.now()
  let targets = []
  while (Date.now() - t0 < (o.timeout || 40000)) {
    try { targets = await getJson(`http://127.0.0.1:${port}/json`); if (targets.some((t) => t.title === 'Born Again' || /index\.html/.test(t.url))) break } catch { /* not up */ }
    await sleep(500)
  }
  const app = {
    proc, port, profile: o.profile,
    targets: () => getJson(`http://127.0.0.1:${port}/json`),
    async page(match = (t) => t.type === 'page' && (t.title === 'Born Again')) { const ts = await this.targets(); const t = ts.find(match); if (!t) throw new Error('no such window'); return new Page(t).connect() },
    async kill() { try { proc.kill('SIGTERM') } catch { /* gone */ } await sleep(1500); try { proc.kill('SIGKILL') } catch { /* gone */ } }
  }
  await sleep(o.settle ?? 6000)
  return app
}
module.exports = { launch, Page, sleep, getJson, ROOT }
