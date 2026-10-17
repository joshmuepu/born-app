// Electron script: renders the placement-round mockups to PNG (scenes via ?scene=, themes via ?theme=).
// Run from this folder:  env -u ELECTRON_RUN_AS_NODE <electron binary> shoot_place.js   (package.json main points at shoot.js, so pass the file)
const { app, BrowserWindow } = require('electron'); const fs = require('fs'); const path = require('path')
const dir = path.resolve(__dirname, '..')
const OPTS = ['12-placement-today', '13-option-a-now-playing-bar', '14-option-b-tape-workspace', '15-option-c-docked-panel', '16-option-d-service-plan']
const jobs = []
for (const o of OPTS) {
  jobs.push([o, 'scene=songs', `${o}.dark.png`, 'dark', 945])
  jobs.push([o, 'scene=verse', `${o}.verse.dark.png`, 'dark', 945])
  jobs.push([o, 'scene=songs&narrow=1', `${o}.narrow.dark.png`, 'dark', 790])
}
for (const t of ['light', 'contrast']) jobs.push(['13-option-a-now-playing-bar', 'scene=songs', `13-option-a-now-playing-bar.${t}.png`, t, 945])
jobs.push(['13-option-a-now-playing-bar', 'scene=playing&view=tape&tab=follow', '13-option-a-now-playing-bar.tape-place.dark.png', 'dark', 945])
jobs.push(['13-option-a-now-playing-bar', 'view=tape&tab=timing', '13-option-a-now-playing-bar.timing.dark.png', 'dark', 945])
jobs.push(['14-option-b-tape-workspace', 'view=tape', '14-option-b-tape-workspace.workspace.dark.png', 'dark', 945])
jobs.push(['15-option-c-docked-panel', 'scene=songs&dock=1', '15-option-c-docked-panel.dock.dark.png', 'dark', 945])
jobs.push(['16-option-d-service-plan', 'scene=playing', '16-option-d-service-plan.plan.dark.png', 'dark', 945])
for (const t of ['dark', 'light', 'contrast']) {
  jobs.push(['17-compare-placement', `s=songs&theme=${t}`, `17-compare-placement.${t}.png`, t, 0])
  for (const n of ['18-rec-states', '19-rec-library', '20-rec-preview-live', '21-rec-phone-and-ready']) jobs.push([n, `theme=${t}`, `${n}.${t}.png`, t, 0])
}
app.whenReady().then(async () => {
  fs.mkdirSync(path.join(dir, 'png'), { recursive: true })
  const win = new BrowserWindow({ show: true, width: 1440, height: 1000, useContentSize: true, frame: false })
  for (const [f, q, out, theme, clipH] of jobs) {
    await win.loadURL('file://' + path.join(dir, f + '.html') + '?' + q + '&theme=' + theme)
    await new Promise(r => setTimeout(r, f.startsWith('17') ? 2500 : 1400))
    const hh = await win.webContents.executeJavaScript('document.documentElement.scrollHeight')
    const H = clipH || Math.min(hh, 2400)
    win.setContentSize(1440, H); await new Promise(r => setTimeout(r, 300))
    let img = await win.webContents.capturePage()
    const sz = img.getSize(); if (sz.width > 1440) img = img.resize({ width: 1440, quality: 'best' }) // 1x: keeps each PNG small
    fs.writeFileSync(path.join(dir, 'png', out), img.toPNG())
    console.log('shot', out, H)
  }
  app.exit(0)
})
