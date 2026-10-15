// usage: Electron tools/run-page.js <url> <selector> <timeoutSec>  -> prints text of selector once it contains "RESULTS"
const { app, BrowserWindow } = require('electron')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const [url, sel = '#out', t = '60'] = process.argv.slice(2).filter(a => !a.startsWith('-') && !a.includes('Electron'))
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { backgroundThrottling: false } })
  w.loadURL(url)
  const end = Date.now() + t * 1000
  for (;;) { await new Promise(r => setTimeout(r, 1000)); const s = await w.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(sel)})?.textContent||''`).catch(() => '')
    if (s.includes('RESULTS') || Date.now() > end) { console.log('PAGE>>' + s); app.exit(0) } }
})
