// Owner-run: Electron . ads   (see spikes/media/youtube/README.md). Uses a persistent partition so a sign-in survives restarts.
const { app, BrowserWindow, session, protocol, ipcMain } = require('electron'); const fs = require('fs'); const path = require('path')
protocol.registerSchemesAsPrivileged([{ scheme: 'bornapp', privileges: { standard: true, secure: true } }])
const page = fs.readFileSync(path.join(__dirname, 'ads.html'))
app.whenReady().then(() => {
  const ses = session.fromPartition('persist:born-yt-ads')
  ses.protocol.handle('bornapp', () => new Response(page, { headers: { 'content-type': 'text/html' } }))
  // YouTube asks desktop apps to identify themselves with a Referer; value = the app's reverse-DNS id (see 06-youtube.md).
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/embed/*', 'https://www.youtube.com/iframe_api*', 'https://www.youtube.com/s/player/*'] }, (d, cb) => { d.requestHeaders['Referer'] = 'https://com.joshmuepu.born.v2dev/'; cb({ requestHeaders: d.requestHeaders }) })
  const mode = process.argv.includes('--premium') ? 'B-signed-in' : 'A-signed-out'
  const w = new BrowserWindow({ width: 900, height: 900, webPreferences: { session: ses, preload: path.join(__dirname, 'ads-preload.js') } })
  w.loadURL('bornapp://born/?mode=' + mode)
  ipcMain.on('open-signin', () => { const s = new BrowserWindow({ width: 520, height: 760, webPreferences: { session: ses } }); s.loadURL('https://accounts.google.com/ServiceLogin?service=youtube') })
})
app.on('window-all-closed', () => app.quit())
