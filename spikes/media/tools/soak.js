// Spike 1: long-run playback soak. usage: Electron tools/soak.js <minutes> <1080|4k> [windows=2]
// Samples per-process CPU / memory (app.getAppMetrics), JS heap, dropped frames and playback progress every 10 s.
const { app, BrowserWindow, ipcMain } = require('electron'); const fs = require('fs'); const path = require('path')
const minutes = +(process.argv[2] || 10), kind = process.argv[3] || '1080', nwin = +(process.argv[4] || 2)
const hidden = process.argv.includes('--hidden')
const clipArg = (process.argv.find(a => a.startsWith('--clip=')) || '').slice(7)
const clip = clipArg || path.resolve(__dirname, '../assets', kind === '4k' ? 'h264-4k30-10s.mp4' : 'h264-1080p30-30s.mp4')
const resDir = process.env.SPIKE_RESULTS || path.resolve(__dirname, '../results')
const outFile = path.resolve(resDir, `soak-${kind}-${minutes}min-${nwin}w.jsonl`); fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, '')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const os = require('os')
const page = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#000}video{width:100vw;height:100vh;object-fit:contain}</style>
<video id=v loop playsinline></video><script>
const {ipcRenderer}=require('electron'); const v=document.getElementById('v'); const id=location.hash.slice(1); v.src=${JSON.stringify('file://' + clip)}; v.muted=(id!=='0'); v.volume=0.02
let last=-1,still=0,stalls=0,loops=0,prev=0; v.addEventListener('timeupdate',()=>{ if(v.currentTime<prev-1)loops++; prev=v.currentTime })
v.play(); setInterval(()=>{ const q=v.getVideoPlaybackQuality(); const t=v.currentTime; if(Math.abs(t-last)<0.01&&!v.paused){still++; if(still===2)stalls++}else still=0; last=t
 ipcRenderer.send('v',{id,dropped:q.droppedVideoFrames,total:q.totalVideoFrames,stalls,loops,heap:performance.memory?performance.memory.usedJSHeapSize:0,paused:v.paused,err:v.error&&v.error.code}) },10000)
</script>`
const pageFile = path.join(os.tmpdir(), 'born-soak-page-' + process.pid + '.html'); fs.writeFileSync(pageFile, page)
const vs = {}; ipcMain.on('v', (_e, s) => { vs[s.id] = s })
app.whenReady().then(() => {
  require('electron').powerSaveBlocker.start('prevent-display-sleep')
  for (let i = 0; i < nwin; i++) { const w = new BrowserWindow({ show: !hidden, x: 60 + i * 40, y: 60 + i * 40, width: 960, height: 540, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } }); w.loadFile(pageFile, { hash: String(i) }) }
  const t0 = Date.now()
  const iv = setInterval(() => {
    const m = app.getAppMetrics(); const sum = t => m.filter(p => p.type === t).reduce((a, p) => ({ cpu: a.cpu + p.cpu.percentCPUUsage, ws: a.ws + p.memory.workingSetSize, priv: a.priv + (p.memory.privateBytes || 0) }), { cpu: 0, ws: 0, priv: 0 })
    const rec = { t: Math.round((Date.now() - t0) / 1000), gpu: sum('GPU'), renderer: sum('Tab'), browser: sum('Browser'), other: sum('Utility'), vids: vs }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n')
    if (Date.now() - t0 > minutes * 60000) { clearInterval(iv); fs.appendFileSync(outFile, JSON.stringify({ done: true, platform: process.platform, electron: process.versions.electron, clip: path.basename(clip), minutes, windows: nwin }) + '\n'); console.log('SOAK-DONE', outFile); try { fs.unlinkSync(pageFile) } catch {} app.exit(0) }
  }, +(process.env.SOAK_SAMPLE_MS || 10000))
})
app.on('window-all-closed', () => {})
