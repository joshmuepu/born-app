// Spike 3/4: same video in three windows (main output, stage monitor, Graphics page over HTTP).
// usage: Electron tools/sync-test.js <free|corrected> <seconds>
const { app, BrowserWindow, ipcMain, screen } = require('electron'); const http = require('http'); const fs = require('fs'); const path = require('path')
const mode = process.argv[2] || 'free', secs = +(process.argv[3] || 120)
const hidden = process.argv.includes('--hidden')
const clipArg = (process.argv.find(a => a.startsWith('--clip=')) || '').slice(7)
const clip = clipArg || path.resolve(__dirname, '../assets/h264-1080p30-30s.mp4')
const results = process.env.SPIKE_RESULTS || path.resolve(__dirname, '../results')
let DUR = 30
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// local HTTP server with Range support (what the Graphics page would use)
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/clip.mp4')) {
    const st = fs.statSync(clip); const r = req.headers.range
    if (r) { const m = /bytes=(\d*)-(\d*)/.exec(r); const s = +m[1] || 0, e = m[2] ? +m[2] : st.size - 1
      res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 }); fs.createReadStream(clip, { start: s, end: e }).pipe(res) }
    else { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': st.size }); fs.createReadStream(clip).pipe(res) }
  } else if (req.url.startsWith('/page')) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(path.join(__dirname, 'sync-page.html'))) }
  else { res.writeHead(404); res.end() }
})
const samples = { main: [], stage: [], graphics: [] }, stats = {}, ready = new Set()
ipcMain.on('sample', (_e, role, wall, pos) => { samples[role].push([wall, pos]); if (role === 'main') for (const w of wins) w.webContents.send('master', { wall, pos }) })
ipcMain.on('stats', (_e, role, s) => { stats[role] = s })
let wins = []
app.whenReady().then(async () => {
  require('electron').powerSaveBlocker.start('prevent-display-sleep')
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port
  const ds = screen.getAllDisplays(); const pick = i => ds[i % ds.length].bounds
  const mk = (role, i, w, h, url) => {
    const b = pick(i); const win = new BrowserWindow({ show: !hidden, x: b.x + 40, y: b.y + 40, width: w, height: h, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } })
    win.loadURL(url); return win
  }
  const fileUrl = role => 'file://' + path.join(__dirname, 'sync-page.html') + `?role=${role}&mode=${mode}&src=${encodeURIComponent('file://' + clip)}`
  wins = [
    mk('main', 1, 1280, 720, fileUrl('main')),
    mk('stage', 2, 640, 360, fileUrl('stage')),
    mk('graphics', 0, 960, 540, `http://127.0.0.1:${port}/page?role=graphics&mode=${mode}&src=${encodeURIComponent(`http://127.0.0.1:${port}/clip.mp4`)}`)
  ]
  ipcMain.on('ready', (_e, role, d) => { if (d && isFinite(d)) DUR = d; ready.add(role); if (ready.size === 3) setTimeout(() => { wins.forEach(w => w.webContents.send('go')); console.log('GO', mode); setTimeout(finish, secs * 1000) }, 1500) })
})
function interp(arr, t) { // main's position at wall time t (loop-aware)
  let lo = 0, hi = arr.length - 1; if (t < arr[0][0] || t > arr[hi][0]) return null
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m][0] <= t) lo = m; else hi = m }
  let d = arr[hi][1] - arr[lo][1]; if (d < -DUR / 2) d += DUR; const f = (t - arr[lo][0]) / (arr[hi][0] - arr[lo][0] || 1); return ((arr[lo][1] + d * f) % DUR + DUR) % DUR
}
function finish() {
  const out = { mode, seconds: secs, clipSeconds: DUR, hidden, platform: process.platform, electron: process.versions.electron, stats, drift: {} }
  const warm = Math.min(10, secs / 4) // seconds ignored while playback settles
  for (const role of ['stage', 'graphics']) {
    const m = samples.main; const ds = []
    const t0 = m[0][0] + warm * 1000
    for (const [w, p] of samples[role]) { if (w < t0) continue; const mp = interp(m, w); if (mp == null) continue; let d = p - mp; d = ((d + DUR / 2) % DUR + DUR) % DUR - DUR / 2; ds.push(d * 1000) }
    ds.sort((a, b) => Math.abs(a) - Math.abs(b)); const abs = ds.map(Math.abs).sort((a, b) => a - b)
    const mean = abs.reduce((a, b) => a + b, 0) / abs.length
    out.drift[role] = { samples: ds.length, meanAbsMs: +mean.toFixed(1), p95AbsMs: +abs[Math.floor(abs.length * 0.95)].toFixed(1), maxAbsMs: +abs[abs.length - 1].toFixed(1),
      firstMs: +(ds.length ? (() => { const f = samples[role].find(s => s[0] >= t0); const mp = interp(m, f[0]); let d = f[1] - mp; return (((d + DUR / 2) % DUR + DUR) % DUR - DUR / 2) * 1000 })() : 0).toFixed(1) }
  }
  const trend = role => { const a = samples[role].filter(s => s[0] > samples.main[0][0] + 10000); if (a.length < 20) return null
    const head = a.slice(0, 20).map(([w, p]) => { let d = p - interp(samples.main, w); return (((d + DUR / 2) % DUR + DUR) % DUR - DUR / 2) * 1000 }).filter(Number.isFinite); const tail = a.slice(-20).map(([w, p]) => { let d = p - interp(samples.main, w); return (((d + DUR / 2) % DUR + DUR) % DUR - DUR / 2) * 1000 }).filter(Number.isFinite)
    const avg = x => x.reduce((s, y) => s + y, 0) / x.length; return { startMs: +avg(head).toFixed(1), endMs: +avg(tail).toFixed(1) } }
  out.trend = { stage: trend('stage'), graphics: trend('graphics') }
  fs.mkdirSync(results, { recursive: true }); fs.writeFileSync(path.join(results, `sync-${mode}-${secs}s.json`), JSON.stringify(out, null, 1)); console.log('RESULT', JSON.stringify(out)); app.exit(0)
}
