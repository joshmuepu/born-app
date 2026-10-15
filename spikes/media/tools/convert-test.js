// Spike 6: can Chromium itself transcode (decode anything it can play -> H.264/AAC MP4) with no FFmpeg? Hidden window, real-time speed.
const { app, BrowserWindow } = require('electron'); const fs = require('fs'); const path = require('path'); const os = require('os')
const clips = path.resolve(__dirname, '../compat/clips'); const outDir = path.join(os.tmpdir(), 'born-convert'); fs.mkdirSync(outDir, { recursive: true })
const SRC = process.argv.slice(2).filter(a => !a.startsWith('-') && !a.includes('Electron') && !a.endsWith('.js'))
const html = path.join(os.tmpdir(), 'born-convert.html'); fs.writeFileSync(html, '<!doctype html><video id=v muted playsinline></video>')
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } }); await w.loadFile(html)
  for (const f of SRC) {
    const t0 = Date.now()
    const r = await w.webContents.executeJavaScript(`(async()=>{
      const v=document.getElementById('v'); v.src=${JSON.stringify('file://' + path.join(clips, f))}; await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=()=>j(new Error('load'))})
      const dur=v.duration, w=v.videoWidth, h=v.videoHeight; const s=v.captureStream(); const mime=['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4;codecs=avc1.640028','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m))
      const rec=new MediaRecorder(s,{mimeType:mime,videoBitsPerSecond:6e6}); const ch=[]; rec.ondataavailable=e=>e.data.size&&ch.push(e.data); const done=new Promise(r=>rec.onstop=r)
      rec.start(500); await v.play(); await new Promise(r=>v.onended=r); rec.stop(); await done
      const b=new Uint8Array(await new Blob(ch).arrayBuffer()); let str=''; for(let i=0;i<b.length;i+=0x8000)str+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return {dur,w,h,mime,audio:s.getAudioTracks().length,b64:btoa(str)}})()`).catch(e => ({ err: e.message }))
    const wall = (Date.now() - t0) / 1000
    if (r.err) { console.log('CONV', f, 'FAILED', r.err); continue }
    const out = path.join(outDir, f.replace(/\.[^.]+$/, '') + '-converted.mp4'); fs.writeFileSync(out, Buffer.from(r.b64, 'base64'))
    console.log('CONV', f, JSON.stringify({ srcSeconds: +r.dur.toFixed(2), res: r.w + 'x' + r.h, wallSeconds: +wall.toFixed(1), speedX: +(r.dur / wall).toFixed(2), outBytes: fs.statSync(out).size, mime: r.mime, audioTracks: r.audio }))
  }
  app.exit(0)
})
app.on('window-all-closed', () => {})
