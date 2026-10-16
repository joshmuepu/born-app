// Electron script: renders every mockup page to PNG (dark for all; light + high-contrast for key pages).
// Run: env -u ELECTRON_RUN_AS_NODE <electron binary> .   (from this folder)
const { app, BrowserWindow } = require('electron'); const fs = require('fs'); const path = require('path')
const dir = path.resolve(__dirname, '..')
const KEY = ['01-reader-follow-along','03-projector-highlight','04-projector-one-at-a-time','09-errors-and-warnings']
let win = null, cur = ''
app.whenReady().then(async () => {
  fs.mkdirSync(path.join(dir, 'png'), { recursive: true })
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort()
  for (const f of files) {
    const base = f.replace('.html', '')
    const themes = KEY.includes(base) ? ['dark', 'light', 'contrast'] : ['dark']
    for (const t of themes) {
      if (!win) win = new BrowserWindow({ show: true, width: 1440, height: 900, useContentSize: true, frame: false })
      const w = win
      if (cur !== f) { await w.loadURL('file://' + path.join(dir, f)); cur = f }
      await w.webContents.executeJavaScript(`document.documentElement.dataset.theme='${t}'`)
      const hh = await w.webContents.executeJavaScript('document.body.offsetHeight'); w.setContentSize(1440, Math.max(900, hh)); await new Promise(r => setTimeout(r, 600))
      const img = await w.webContents.capturePage()
      fs.writeFileSync(path.join(dir, 'png', `${base}.${t}.png`), img.toPNG())
      console.log('shot', base, t)
    }
  }
  app.exit(0)
})
