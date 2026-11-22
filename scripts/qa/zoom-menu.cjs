/* Test-only Electron preload (run with `electron --require scripts/qa/zoom-menu.cjs .`): lets a check script use the operator window's real View menu
 * zoom items and resize the window, and reports each window's zoom and size. Commands are JSON files written to ZOOM_CMD ({ role: 'zoomin' | 'zoomout'
 * | 'resetzoom', n, size: [w, h] }); the report is written to ZOOM_REPORT. Never ships; scripts only. */
const { app, Menu, BrowserWindow } = require('electron')
const fs = require('fs')
const out = process.env.ZOOM_REPORT, cmd = process.env.ZOOM_CMD
const find = (items, role) => { for (const i of items) { if ((i.role || '').toLowerCase() === role) return i; if (i.submenu) { const f = find(i.submenu.items, role); if (f) return f } } return null }
const main = () => BrowserWindow.getAllWindows().find((w) => /Branham or Nothing/.test(w.getTitle()))
if (out && cmd) app.whenReady().then(() => setInterval(() => {
  try {
    const w = main()
    if (!w) return
    if (fs.existsSync(cmd)) {
      const c = JSON.parse(fs.readFileSync(cmd, 'utf8')); fs.unlinkSync(cmd)
      if (c.size) w.setContentSize(c.size[0], c.size[1])
      if (c.role) { const it = find(Menu.getApplicationMenu().items, c.role); for (let k = 0; k < (c.n || 1); k++) it.click(undefined, w, w.webContents) }
    }
    fs.writeFileSync(out, JSON.stringify({ zoom: w.webContents.getZoomFactor(), content: w.getContentSize(), min: w.getMinimumSize(), outputs: BrowserWindow.getAllWindows().filter((x) => x !== w).map((x) => x.webContents.getZoomFactor()) }))
  } catch (e) { fs.writeFileSync(out, JSON.stringify({ error: String(e) })) }
}, 250))
