// Reports the macOS/Windows privacy state for camera/screen and what Electron can enumerate, WITHOUT prompting.
const { app, BrowserWindow, systemPreferences, desktopCapturer } = require('electron')
app.whenReady().then(async () => {
  const out = { platform: process.platform, electron: process.versions.electron }
  try { out.cameraAccess = systemPreferences.getMediaAccessStatus('camera'); out.micAccess = systemPreferences.getMediaAccessStatus('microphone'); out.screenAccess = systemPreferences.getMediaAccessStatus('screen') } catch (e) { out.accessErr = e.message }
  const w = new BrowserWindow({ show: false }); await w.loadFile(require('path').join(__dirname, '../capture/index.html'))
  out.devices = await w.webContents.executeJavaScript(`navigator.mediaDevices.enumerateDevices().then(d=>d.map(x=>x.kind+':'+(x.label||'(label hidden until permission)')))`)
  try { const s = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 0, height: 0 } }); out.captureSources = s.length + ' sources (' + s.slice(0, 5).map(x => x.name).join(' | ') + ')' } catch (e) { out.captureErr = e.message }
  console.log('R' + JSON.stringify(out, null, 1)); app.exit(0)
})
