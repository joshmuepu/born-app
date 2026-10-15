// Spike 9 runner. usage: Electron . <set> [--policy=default|nogesture]
//   sets: embed (origin/Referer matrix) | features (invalid id, start/end, two windows, offline, oEmbed, sign-in page)
const { app, BrowserWindow, session, protocol, net } = require('electron'); const http = require('http'); const fs = require('fs'); const path = require('path')
const set = process.argv.find(a => ['embed', 'features', 'extra'].includes(a)) || 'embed'
const policy = (process.argv.find(a => a.startsWith('--policy=')) || '--policy=nogesture').split('=')[1]
if (policy === 'nogesture') app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
protocol.registerSchemesAsPrivileged([{ scheme: 'bornapp', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])
const page = fs.readFileSync(path.join(__dirname, 'player.html'))
const results = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
let httpPort
async function runScenario(name, urlFor, { inject, secs = 9, extra, webPrefs = {}, block } = {}) {
  const ses = session.fromPartition('yt-' + name + '-' + Date.now())
  if (inject) ses.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/*', 'https://*.youtube.com/*', 'https://www.youtube-nocookie.com/*'] }, (d, cb) => { d.requestHeaders['Referer'] = inject; cb({ requestHeaders: d.requestHeaders }) })
  ses.protocol.handle('bornapp', req => new Response(page, { headers: { 'content-type': 'text/html' } }))
  if (block) ses.webRequest.onBeforeRequest({ urls: block }, (d, cb) => cb({ cancel: true }))
  const seen = []
  ses.webRequest.onSendHeaders({ urls: ['https://www.youtube.com/embed/*'] }, d => seen.push({ url: d.url.slice(0, 90), referer: d.requestHeaders['Referer'] || '(none)' }))
  const w = new BrowserWindow({ x: 40, y: 40, width: 640, height: 400, show: true, webPreferences: { session: ses, backgroundThrottling: false, ...webPrefs } })
  await w.loadURL(urlFor(secs)).catch(e => results.push({ name, loadError: e.message }))
  let R = null
  for (let i = 0; i < (secs + 8) * 2; i++) { await sleep(500); R = await w.webContents.executeJavaScript('window.__R && window.__R.done ? window.__R : null').catch(() => null); if (R) break }
  if (!R) R = await w.webContents.executeJavaScript('window.__R').catch(() => null)
  const out = { name, referersSeenByYouTube: seen.slice(0, 2), r: R && { origin: R.origin, scriptLoaded: R.scriptLoaded, events: R.events.map(e => `${e.t}ms ${e.n}${e.d !== undefined ? ' ' + e.d : ''}`), final: R.final, lastSample: R.samples && R.samples[R.samples.length - 1] } }
  if (extra) out.extra = await extra(w)
  results.push(out); console.log('DONE', name); w.destroy(); return out
}
const bits = o => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&')
async function main() {
  const srv = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page) })
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); httpPort = srv.address().port
  const file = o => s => 'file://' + path.join(__dirname, 'player.html') + '?' + bits({ ...o, secs: s })
  const httpU = (host, o) => s => `http://${host}:${httpPort}/?` + bits({ ...o, secs: s })
  const app_ = o => s => 'bornapp://born/?' + bits({ ...o, secs: s })
  if (set === 'embed') {
    await runScenario('S1 file:// default', file({ mute: 1 }))
    await runScenario('S2 file:// + referrerpolicy=strict-origin-when-cross-origin', file({ refpol: 'strict-origin-when-cross-origin' }))
    await runScenario('S3 http://127.0.0.1 + origin param', httpU('127.0.0.1', { origin: 1 }))
    await runScenario('S4 http://localhost + origin param', httpU('localhost', { origin: 1 }))
    await runScenario('S5 http://127.0.0.1 + no-referrer policy', httpU('127.0.0.1', { origin: 1, refpol: 'no-referrer' }))
    await runScenario('S6 file:// + injected Referer https://com.joshmuepu.born.v2dev/', file({}), { inject: 'https://com.joshmuepu.born.v2dev/' })
    await runScenario('S7 bornapp:// custom scheme (standard+secure) default', app_({ origin: 0 }))
    await runScenario('S8 bornapp:// + injected Referer', app_({}), { inject: 'https://com.joshmuepu.born.v2dev/' })
  } else if (set === 'extra') {
    const strict = { autoplayPolicy: 'document-user-activation-required' }
    await runScenario('X1 strict autoplay policy, autoplay=1 UNMUTED', httpU('localhost', { origin: 1, autoplay: 1, mute: 0 }), { secs: 8, webPrefs: strict })
    await runScenario('X2 strict autoplay policy, autoplay=1 muted', httpU('localhost', { origin: 1, autoplay: 1, mute: 1 }), { secs: 8, webPrefs: strict })
    await runScenario('X3 strict policy, API playVideo() with no user gesture (unmuted)', httpU('localhost', { origin: 1, mute: 0 }), { secs: 8, webPrefs: strict })
    await runScenario('X4 all YouTube/Google hosts blocked (simulated offline / DNS failure)', httpU('localhost', { origin: 1 }), { secs: 8, block: ['https://*.youtube.com/*', 'https://*.ytimg.com/*', 'https://*.googlevideo.com/*', 'https://*.google.com/*', 'https://*.gstatic.com/*'] })
    await runScenario('X5 only the embed page blocked (API script loads, iframe does not)', httpU('localhost', { origin: 1 }), { secs: 8, block: ['https://www.youtube.com/embed/*'] })
    await runScenario('X6 video stream hosts blocked (player loads, media bytes do not)', httpU('localhost', { origin: 1 }), { secs: 10, block: ['https://*.googlevideo.com/*'] })
  } else {
    const good = httpU('localhost', { origin: 1 })
    await runScenario('F1 invalid id (not found)', httpU('localhost', { origin: 1, id: 'aaaaaaaaaaa' }), { secs: 6 })
    await runScenario('F2 malformed id', httpU('localhost', { origin: 1, id: 'x' }), { secs: 6 })
    await runScenario('F3 start=20 end=26 (should stop ~26s)', httpU('localhost', { origin: 1, start: 20, end: 26 }), { secs: 14 })
    await runScenario('F4 24/7 live stream id (duration semantics)', httpU('localhost', { origin: 1, id: 'jfKfPfyJRdk' }), { secs: 8 })
    await runScenario('F5 autoplay=1 muted', httpU('localhost', { origin: 1, autoplay: 1 }), { secs: 8 })
    await runScenario('F6 autoplay=1 UNMUTED (mute=0)', httpU('localhost', { origin: 1, autoplay: 1, mute: 0 }), { secs: 8 })
    // offline emulation
    const sesOff = session.fromPartition('yt-offline'); await sesOff.enableNetworkEmulation({ offline: true })
    const wOff = new BrowserWindow({ show: true, width: 640, height: 400, webPreferences: { session: sesOff } })
    await wOff.loadURL(httpU('localhost', { origin: 1 })(8)).catch(() => {}); await sleep(10000)
    results.push({ name: 'F7 offline (network emulation)', r: await wOff.webContents.executeJavaScript('window.__R').then(R => ({ events: R.events.map(e => `${e.t}ms ${e.n}${e.d !== undefined ? ' ' + e.d : ''}`), scriptLoaded: R.scriptLoaded, final: R.final })).catch(e => ({ err: e.message })) }); wOff.destroy()
    // two windows: drift
    const mk = async (x) => { const w = new BrowserWindow({ x, y: 60, width: 480, height: 300, show: true }); await w.loadURL(httpU('localhost', { origin: 1, secs: 70 })(70)); return w }
    const a = await mk(40), b = await mk(540); const diffs = []
    await sleep(15000)
    for (let i = 0; i < 40; i++) { const [pa, pb] = await Promise.all([a, b].map(w => w.webContents.executeJavaScript('(()=>{try{return window.__cmd("getCurrentTime")}catch(e){return null}})()'))); const t = Date.now(); if (typeof pa === 'number' && typeof pb === 'number') diffs.push(+(pa - pb).toFixed(2)); await sleep(1000) }
    results.push({ name: 'F8 two independent embeds, same video, 55 s', diffsSeconds: diffs, note: 'positive = window A ahead of B; each window started ~1 s apart' }); a.destroy(); b.destroy()
    // oEmbed from the main process (no sign-in)
    const fetchStatus = async u => { try { const r = await net.fetch(u); const t = await r.text(); return { status: r.status, body: t.slice(0, 200) } } catch (e) { return { err: e.message } } }
    const oe = id => 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)
    results.push({ name: 'F9 oEmbed', valid: await fetchStatus(oe('dQw4w9WgXcQ')), notFound: await fetchStatus(oe('aaaaaaaaaaa')), liveStream: await fetchStatus(oe('jfKfPfyJRdk')), malformed: await fetchStatus(oe('x')) })
    // Google sign-in page inside Electron
    const g = new BrowserWindow({ show: false, width: 800, height: 700 })
    await g.loadURL('https://accounts.google.com/ServiceLogin?service=youtube').catch(() => {}); await sleep(4000)
    const txt = await g.webContents.executeJavaScript('document.body.innerText.slice(0,500)').catch(e => 'ERR ' + e.message)
    results.push({ name: 'F10 Google sign-in page in default Electron window', url: g.webContents.getURL().slice(0, 100), text: txt }); g.destroy()
  }
  srv.close()
  fs.mkdirSync(path.join(__dirname, '../results'), { recursive: true })
  const outFile = path.join(__dirname, '../results', `youtube-${set}-${policy}-${process.platform}.json`)
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), electron: process.versions.electron, chrome: process.versions.chrome, policy, results }, null, 1))
  console.log('WROTE', outFile); app.exit(0)
}
app.on('window-all-closed', () => {})
app.whenReady().then(main)
