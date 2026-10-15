// Generates synthetic test clips with Chromium's own MediaRecorder (no ffmpeg needed).
const { app, BrowserWindow } = require('electron'); const fs = require('fs'); const path = require('path')
const COMPAT = process.argv.includes('--compat')
const out = path.resolve(__dirname, COMPAT ? '../compat/clips' : '../assets'); fs.mkdirSync(out, { recursive: true })
const COMPAT_JOBS = [
  { f: 'h264-1080p30.mp4', mime: 'video/mp4;codecs=avc1.640028,mp4a.40.2', w: 1920, h: 1080, fps: 30, s: 4, audio: true, br: 2e6 },
  { f: 'h264-720p30.mp4', mime: 'video/mp4;codecs=avc1.4d401f', w: 1280, h: 720, fps: 30, s: 4, br: 1e6 },
  { f: 'h264-1080p60.mp4', mime: 'video/mp4;codecs=avc1.640032', w: 1920, h: 1080, fps: 60, s: 4, br: 3e6 },
  { f: 'h264-4k30.mp4', mime: 'video/mp4;codecs=avc1.640033', w: 3840, h: 2160, fps: 30, s: 4, br: 6e6 },
  { f: 'vp9-1080p30.webm', mime: 'video/webm;codecs=vp9,opus', w: 1920, h: 1080, fps: 30, s: 4, audio: true, br: 2e6 },
  { f: 'vp8-720p30.webm', mime: 'video/webm;codecs=vp8', w: 1280, h: 720, fps: 30, s: 4, br: 1e6 },
  { f: 'av1-1080p30.webm', mime: 'video/webm;codecs=av1', w: 1920, h: 1080, fps: 30, s: 4, br: 2e6 },
  { f: 'h264-720p30.mkv', mime: 'video/x-matroska;codecs=avc1', w: 1280, h: 720, fps: 30, s: 4, br: 1e6 },
  { f: 'opus.webm', mime: 'audio/webm;codecs=opus', audioOnly: true, s: 4 },
  { f: 'portrait-1080x1920.mp4', mime: 'video/mp4;codecs=avc1.640028', w: 1080, h: 1920, fps: 30, s: 4, br: 2e6 },
]
const JOBS0 = [
  { f: 'h264-1080p30-30s.mp4', mime: 'video/mp4;codecs=avc1.640028,mp4a.40.2', w: 1920, h: 1080, fps: 30, s: 30, audio: true },
  { f: 'h264-720p30-10s.mp4', mime: 'video/mp4;codecs=avc1.4d401f,mp4a.40.2', w: 1280, h: 720, fps: 30, s: 10, audio: true },
  { f: 'h264-1080p60-10s.mp4', mime: 'video/mp4;codecs=avc1.640032', w: 1920, h: 1080, fps: 60, s: 10 },
  { f: 'h264-4k30-10s.mp4', mime: 'video/mp4;codecs=avc1.640033', w: 3840, h: 2160, fps: 30, s: 10 },
  { f: 'vp9-1080p30-10s.webm', mime: 'video/webm;codecs=vp9,opus', w: 1920, h: 1080, fps: 30, s: 10, audio: true },
  { f: 'vp8-720p30-6s.webm', mime: 'video/webm;codecs=vp8', w: 1280, h: 720, fps: 30, s: 6 },
  { f: 'av1-1080p30-6s.webm', mime: 'video/webm;codecs=av1', w: 1920, h: 1080, fps: 30, s: 6 },
  { f: 'h264-720p30-6s.mkv', mime: 'video/x-matroska;codecs=avc1', w: 1280, h: 720, fps: 30, s: 6 },
  { f: 'opus-10s.webm', mime: 'audio/webm;codecs=opus', audioOnly: true, s: 10 },
]
const JOBS = COMPAT ? COMPAT_JOBS : JOBS0
const only = process.argv.slice(2).filter(a => !a.startsWith('-') && !a.includes('/'))
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: 600 })
  await win.loadURL('data:text/html,<html><body></body></html>')
  for (const j of JOBS) {
    if (only.length && !only.some(o => j.f.includes(o))) continue
    const t0 = Date.now()
    const b64 = await win.webContents.executeJavaScript(`(async (j) => {
      let stream, stopAnim = () => {}
      const ac = new AudioContext(); const dest = ac.createMediaStreamDestination()
      if (j.audio || j.audioOnly) { const o = ac.createOscillator(); const g = ac.createGain(); g.gain.value = 0.05; o.frequency.value = 440; o.connect(g).connect(dest); o.start() }
      if (j.audioOnly) stream = dest.stream
      else {
        const c = document.createElement('canvas'); c.width = j.w; c.height = j.h; const x = c.getContext('2d')
        let n = 0, run = true; stopAnim = () => { run = false }
        const draw = () => { if (!run) return; n++
          const g = x.createLinearGradient(0, 0, j.w, j.h); g.addColorStop(0, 'hsl(' + (n * 2 % 360) + ',60%,25%)'); g.addColorStop(1, 'hsl(' + ((n * 2 + 140) % 360) + ',60%,40%)')
          x.fillStyle = g; x.fillRect(0, 0, j.w, j.h)
          for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 5) * 0.03) + ')'; x.beginPath(); x.arc((n * (3 + i % 7) + i * 97) % j.w, (i * 131 + n * (1 + i % 3)) % j.h, 20 + i * 4, 0, 7); x.fill() }
          x.fillStyle = '#fff'; x.font = 'bold ' + j.h / 6 + 'px sans-serif'; x.fillText(String(n).padStart(5, '0'), j.w / 20, j.h / 2)
          x.font = j.h / 20 + 'px sans-serif'; x.fillText(j.w + 'x' + j.h + ' @' + j.fps, j.w / 20, j.h * 0.7)
          requestAnimationFrame(draw) }
        draw(); stream = c.captureStream(j.fps)
        if (j.audio) dest.stream.getAudioTracks().forEach(t => stream.addTrack(t))
      }
      const rec = new MediaRecorder(stream, { mimeType: j.mime, videoBitsPerSecond: j.br || (j.w >= 3840 ? 20e6 : j.w >= 1920 ? 8e6 : 4e6) })
      const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data)
      const done = new Promise(r => rec.onstop = r); rec.start(1000)
      await new Promise(r => setTimeout(r, j.s * 1000)); rec.stop(); await done; stopAnim(); ac.close()
      const buf = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
      return btoa(s)
    })(${JSON.stringify(j)})`).catch(e => 'ERR ' + e.message)
    if (String(b64).startsWith('ERR')) { console.log('FAIL', j.f, b64); continue }
    fs.writeFileSync(path.join(out, j.f), Buffer.from(b64, 'base64')); console.log('OK', j.f, fs.statSync(path.join(out, j.f)).size, 'bytes', Math.round((Date.now() - t0) / 1000) + 's')
  }
  app.exit(0)
})
