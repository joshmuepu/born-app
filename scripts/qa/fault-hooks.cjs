/* QA helper (scripts only, never shipped), loaded with --require after hide-outputs.cjs. Each part is switched on by an environment variable:
 *  QA_ONE_DISPLAY=1   the app sees only the main display (no projector), whatever is plugged in; nothing on the real displays is changed.
 *                     Full-screen requests and the size and place of the congregation screen and stage monitor are recorded in
 *                     <profile>/qa-main-events.json as { output, fullscreen } and { output, bounds, workArea }.
 *  QA_QUIT_TRIGGER=1  a file <profile>/qa-quit makes the app quit with app.quit(), the call the Quit menu item, Cmd+Q and the Dock's Quit make.
 *                     It is removed first; the outcome is { quitAsked: true } before the quit and the app either exits or stays.
 *                     If the file says "shutdown", the computer's logout, restart or shutdown notice (powerMonitor 'shutdown', macOS and
 *                     Linux) comes first, as the system sends it before it quits the app; if it says "session-end", Windows ending the
 *                     session (each window's 'session-end') comes first.
 *  QA_FAULT_SERIES=1  the sermon series cannot be read: the bundled series.json read fails and the online series request fails. */
const { app, screen, BrowserWindow, powerMonitor } = require('electron')
const fs = require('fs'), path = require('path')
const dir = process.env.BORN_USER_DATA_DIR
const file = path.join(dir, 'qa-main-events.json')
const rec = (e) => { let a = []; try { a = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* first */ } a.push(e); fs.writeFileSync(file, JSON.stringify(a)) }
const outputName = (w) => { try { const t = w.getTitle(); return /Congregation screen/.test(t) ? 'congregation' : /Stage monitor|Stage View/.test(t) ? 'stage' : null } catch { return null } }

if (process.env.QA_ONE_DISPLAY === '1') {
  app.whenReady().then(() => {
    const primary = screen.getPrimaryDisplay.bind(screen)
    screen.getAllDisplays = () => [primary()]
  })
  const P = BrowserWindow.prototype
  for (const m of ['setSimpleFullScreen', 'setFullScreen']) {
    const orig = P[m]
    P[m] = function (on, ...a) { const o = outputName(this); if (o) rec({ output: o, fullscreen: !!on }); return orig.call(this, on, ...a) }
  }
  app.on('browser-window-created', (_e, w) => {
    w.webContents.once('did-finish-load', () => {
      const o = outputName(w)
      if (o) rec({ output: o, bounds: w.getBounds(), workArea: screen.getPrimaryDisplay().workArea, fullscreenOption: w.isFullScreen() || (w.isSimpleFullScreen && w.isSimpleFullScreen()) })
    })
  })
}

if (process.env.QA_QUIT_TRIGGER === '1') {
  const trigger = path.join(dir, 'qa-quit')
  try { fs.rmSync(trigger, { force: true }) } catch { /* none */ }
  setInterval(() => {
    if (!fs.existsSync(trigger)) return
    const how = fs.readFileSync(trigger, 'utf8').trim()
    fs.rmSync(trigger, { force: true })
    rec({ quitAsked: true, how: how || 'quit' })
    if (how === 'shutdown') powerMonitor.emit('shutdown', { preventDefault() {} })
    if (how === 'session-end') for (const w of BrowserWindow.getAllWindows()) w.emit('session-end')
    app.quit()
  }, 300)
}

if (process.env.QA_FAULT_SERIES === '1') {
  const origRead = fs.readFileSync
  fs.readFileSync = function (p, ...a) {
    if (typeof p === 'string' && path.basename(p) === 'series.json') { const e = new Error('EACCES: permission denied, open ' + p); e.code = 'EACCES'; throw e }
    return origRead.call(this, p, ...a)
  }
  const origFetch = globalThis.fetch
  globalThis.fetch = (u, ...a) => /table\.branham\.org/.test(String(u && u.url ? u.url : u)) ? Promise.reject(new TypeError('fetch failed')) : origFetch(u, ...a)
}
