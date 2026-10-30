/* Test-only Electron preload (run with `electron --require scripts/qa/hide-outputs.cjs .`): keeps the projection and stage windows from ever becoming
 * visible or fullscreen, so a real run of the app can "open the screens" without covering the operator's monitors. The windows still exist, load and
 * receive everything (slides, blank, stage updates), so the app behaves as with the screens on. Never ships; scripts only. */
const { BrowserWindow } = require('electron')
const isOutput = (w) => { try { return /Output|Stage View|Congregation screen|Stage monitor/.test(w.getTitle()) } catch { return false } }
const P = BrowserWindow.prototype
for (const m of ['show', 'showInactive', 'focus', 'setSimpleFullScreen', 'setFullScreen', 'moveTop', 'maximize', 'restore']) {
  const orig = P[m]
  if (typeof orig !== 'function') continue
  P[m] = function (...a) { if (isOutput(this)) return undefined; return orig.apply(this, a) }
}
// optional self-report for the harness: HIDE_REPORT=<file> writes whether any projection/stage window is visible
if (process.env.HIDE_REPORT) {
  const fs = require('fs')
  setInterval(() => {
    try { fs.writeFileSync(process.env.HIDE_REPORT, JSON.stringify(BrowserWindow.getAllWindows().map((w) => ({ output: isOutput(w), title: w.getTitle(), visible: w.isVisible(), fullscreen: w.isFullScreen() || (w.isSimpleFullScreen && w.isSimpleFullScreen()) })))) } catch { /* closing */ }
  }, 700)
}
