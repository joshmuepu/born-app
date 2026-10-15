// Launcher: opens index.html in Electron. `--auto` runs the tests immediately, writes ../results/compat-<platform>-<arch>.json and quits.
const { app, BrowserWindow } = require('electron'); const fs = require('fs'); const path = require('path')
const auto = process.argv.includes('--auto')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1200, height: 900, show: !auto, webPreferences: { backgroundThrottling: false } })
  await w.loadFile(path.join(__dirname, 'index.html'), { query: auto ? { auto: '1' } : {} })
  if (!auto) return
  for (;;) { await new Promise(r => setTimeout(r, 1000)); const r = await w.webContents.executeJavaScript('window.__RESULT || null'); if (r) {
      const dir = path.join(__dirname, '..', 'results'); fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `compat-${process.platform}-${process.arch}.json`), JSON.stringify(r, null, 1))
      console.log('WROTE'); app.exit(0) } }
})
