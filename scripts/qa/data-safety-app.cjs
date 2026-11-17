/* Data safety in the real app (scripts only, never shipped):
 *  - with no projector (the app is shown only the main display), the congregation screen opens as a normal window in a corner, not full screen
 *    over the operator window; choosing this computer's own screen under Screens still puts it full screen;
 *  - quitting while something is on the screen asks first, the safe answer is the default, "Keep BORN open" keeps every window, and quitting with
 *    nothing on the screen (or the screen hidden) asks nothing; a quit sent by signal (a script, `kill`) quits without asking, as before;
 *  - after the operator window is started again (as it is after it stops), the phone still says what is on the congregation screen.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/data-safety-app.cjs <profileDir>   (needs `npm run build`; the profile is made from scratch) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const CDP = Number(process.env.CDP_PORT || 9376), MDNS = process.env.BORN_MDNS_NAME || 'born-remote-v1-safety'
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const state = async () => (await fetch(B + '/state')).json()
const evFile = path.join(profile, 'qa-main-events.json')
const events = () => { try { return JSON.parse(fs.readFileSync(evFile, 'utf8')) } catch { return [] } }
const clearEvents = () => fs.rmSync(evFile, { force: true })
const answer = (n) => fs.writeFileSync(path.join(profile, 'qa-dialog-answer'), String(n))
const quit = () => fs.writeFileSync(path.join(profile, 'qa-quit'), '')
const hooks = ['--require', path.join(__dirname, 'hide-outputs.cjs'), '--require', path.join(__dirname, 'record-main.cjs'), '--require', path.join(__dirname, 'fault-hooks.cjs')]
const start = () => launch({ profile, remotePort: PORT, port: CDP, mdns: MDNS, settle: 9000, extraArgs: hooks, env: { QA_ONE_DISPLAY: '1', QA_QUIT_TRIGGER: '1' } })
const appPid = () => Number(require('child_process').execFileSync('lsof', ['-ti', `tcp:${CDP}`, '-sTCP:LISTEN']).toString().trim().split('\n')[0])
const alive = (app) => app.proc.exitCode === null && app.proc.signalCode === null
async function goLive(ref = 'John 3:16-18') {
  await cmd({ action: 'queue-bible', reference: ref, translation: 'KJV' }); await sleep(1200)
  const q = await state(); await cmd({ action: 'project', id: q.queue[q.queue.length - 1].id }); await sleep(3000)
}

;(async () => {
  const c = checks('data-safety-app')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  let app = await start()
  let p = await app.page()
  const pages = async () => (await app.targets()).filter((t) => t.type === 'page')
  const congregation = async () => { const t = (await pages()).find((x) => /Congregation screen/.test(x.title)); if (!t) return ''; const o = await new Page(t).connect(); const txt = await o.ev('document.body.innerText'); o.close(); return txt }

  // ── no projector: a normal window in a corner ──
  clearEvents()
  await goLive()
  const ev1 = events().filter((e) => e.output === 'congregation')
  const placed = ev1.find((e) => e.bounds)
  const wentFull = ev1.some((e) => e.fullscreen === true) || (placed && placed.fullscreenOption)
  c.ok('no projector: the congregation screen is not put full screen', !wentFull, JSON.stringify(ev1))
  const wa = placed && placed.workArea, b = placed && placed.bounds
  const smaller = !!(b && wa && b.width < wa.width && b.height < wa.height)
  const corner = !!(b && wa && (b.x + b.width === wa.x + wa.width || b.x === wa.x) && (b.y + b.height === wa.y + wa.height || b.y === wa.y))
  c.ok('no projector: it is a smaller window in a corner of the screen', smaller && corner, JSON.stringify({ bounds: b, workArea: wa }))
  c.ok('no projector: the verse is on the congregation screen', /God so loved/.test(await congregation()))
  const info = await p.ev('window.electronAPI.listDisplays()')
  c.ok('the app was shown one display (no projector)', info.displays.length === 1 && info.isFallback === true, `${info.displays.length} display(s), fallback ${info.isFallback}`)

  // choosing this computer's own screen under Screens still puts it full screen
  clearEvents()
  await p.ev(`window.electronAPI.setProjectionDisplay(${info.displays[0].id})`); await sleep(1500)
  c.ok('choosing this computer\'s own screen under Screens still puts it full screen', events().some((e) => e.output === 'congregation' && e.fullscreen === true), JSON.stringify(events()))
  await p.ev('window.electronAPI.setProjectionDisplay(null)'); await sleep(1500)

  // ── the phone after the operator window is started again ──
  await cmd({ action: 'next' }); await sleep(1500)
  const before = await state()
  await p.send('Page.reload', {}); p.close(); await sleep(7000)
  p = await app.page()
  const after = await state()
  const onCong = await congregation()
  c.ok('after the operator window is started again, the phone still says what is on the screen',
    !!after.onScreen && !!before.onScreen && onCong.includes(after.onScreen.text.slice(0, 20)),
    `before: ${before.onScreen && before.onScreen.reference} / after: ${after.onScreen ? after.onScreen.reference : 'nothing'} / screen: ${onCong.slice(0, 40).replace(/\n/g, ' ')}`)

  // ── quitting while something is live ──
  clearEvents(); answer(0); quit(); await sleep(2500)
  let asked = events().filter((e) => 'dialog' in e)
  c.ok('quitting while something is on the screen asks first', asked.length === 1 && /on the screen/i.test(asked[0].dialog), JSON.stringify(asked))
  c.ok('the safe answer is the default and the Esc answer', asked[0] && asked[0].defaultId === 0 && asked[0].cancelId === 0 && /keep/i.test((asked[0].buttons || [])[0] || ''), JSON.stringify(asked[0] && asked[0].buttons))
  c.ok('"Keep BORN open" keeps the app and the congregation screen', alive(app) && /God sent not/.test(await congregation()))
  clearEvents(); answer(1); quit(); await sleep(4000)
  asked = events().filter((e) => 'dialog' in e)
  c.ok('the other answer quits', !alive(app) && asked.length === 1, `asked ${asked.length}, running ${alive(app)}`)
  await app.kill()

  // nothing live: no question
  app = await start(); p = await app.page()
  clearEvents(); answer(0); quit(); await sleep(4000)
  c.ok('quitting with nothing on the screen asks nothing and quits', !alive(app) && events().filter((e) => 'dialog' in e).length === 0, JSON.stringify(events()))
  await app.kill()

  // a quit sent by signal while live: no question, it quits as it always has
  app = await start(); p = await app.page()
  await goLive('Psalm 23:2')
  clearEvents(); answer(0); process.kill(appPid(), 'SIGTERM'); await sleep(4000)
  c.ok('a quit sent by signal while something is on the screen quits without asking', !alive(app) && events().filter((e) => 'dialog' in e).length === 0, JSON.stringify(events()))
  await app.kill()

  // the screen hidden: no question
  app = await start(); p = await app.page()
  await goLive('Psalm 23:1')
  await cmd({ action: 'blank' }); await sleep(1200)
  clearEvents(); answer(0); quit(); await sleep(4000)
  c.ok('quitting with the screen hidden asks nothing and quits', !alive(app) && events().filter((e) => 'dialog' in e).length === 0, JSON.stringify(events()))
  await app.kill()

  const r = c.done(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
