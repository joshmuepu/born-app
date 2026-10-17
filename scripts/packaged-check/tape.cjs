/**
 * Packaged-app check for the Tape service (macOS or Windows): the audio engine window, the born-tape:// protocol, tape.db and the sound clock, from the
 * packaged origin, with a throw-away profile. Uses only the public window API (a packaged app ignores BORN_TEST_* hooks).
 *
 *   PKG_AUDIO=<a short audio file, e.g. generated at check time> PKG_SERMON=<a sermon id in the app's database> PKG_PROFILE=/tmp/pkg-profile node scripts/packaged-check/tape.cjs
 *
 * Start the app first, as in README.md (BORN_USER_DATA_DIR=/tmp/pkg-profile BORN_REMOTE_PORT=4317 … --remote-debugging-port=9921). The volume is set to 0:
 * nothing is heard. Nothing real is read or changed: the profile is throw-away.
 */
const { attach, sleep } = require('./cdp.cjs')
const fs = require('fs')
const PORT = 9921
const audio = process.env.PKG_AUDIO, sermon = Number(process.env.PKG_SERMON || 1115)
const res = []
const check = (n, ok, d = '') => { res.push({ n, ok: !!ok, d }); console.log(ok ? 'PASS' : 'FAIL', n, d) }
;(async () => {
  if (!audio || !fs.existsSync(audio)) { console.error('Set PKG_AUDIO to an audio file.'); process.exit(2) }
  const main = await attach((t) => t.title === 'Born Again', PORT)
  await main.send('Runtime.enable')
  const api = (e) => main.ev(`(async()=>JSON.stringify(await (${e})))()`).then((x) => (typeof x === 'string' && x.startsWith('EXC') ? { exc: x } : JSON.parse(x)))
  check('origin is the packaged app', /^file:.*app\.asar/.test(main.t.url), main.t.url)
  const info = await api(`window.electronAPI.tapeInfo()`)
  check('the tape library is available', info && info.available, JSON.stringify(info).slice(0, 120))
  const imp = await api(`window.electronAPI.tapeImportPaths([${JSON.stringify(audio)}], { sermonId: ${sermon} }).then(r => r.map(x => ({ ok: x.ok, dur: x.file && x.file.durationSec, warnings: x.warnings, msg: x.message })))`)
  check('import', imp[0] && imp[0].ok, JSON.stringify(imp[0]))
  const recs = await api(`window.electronAPI.tapeRecordings(${sermon})`)
  check('the recording is attached to the sermon, file status ok', recs.length >= 1 && recs[0].status === 'ok', JSON.stringify(recs.map((r) => r.status)))
  const id = recs[0].id
  const dir = process.env.PKG_PROFILE
  if (dir) check('tape.db and the managed copy are in the profile', fs.existsSync(dir + '/tape.db') && fs.readdirSync(dir + '/tapes').length >= 1, fs.readdirSync(dir + '/tapes').join(','))
  // the protocol answers byte ranges from the packaged origin
  const rng = await main.ev(`(async()=>{const r=await fetch('born-tape://file/${recs[0].file.id}',{headers:{Range:'bytes=0-15'}});return r.status+' '+r.headers.get('content-range')+' '+(await r.arrayBuffer()).byteLength})()`)
  check('born-tape:// serves a byte range (206)', /^206 bytes 0-15\/\d+ 16$/.test(rng), rng)
  const pf = await api(`window.electronAPI.tapePreflight(${JSON.stringify(id)})`)
  check('preflight runs', pf && Array.isArray(pf.checks), pf && pf.checks.map((c) => c.level + ':' + c.id).join(' '))
  // the sound engine: load paused, play at volume 0, the clock advances
  await main.ev(`window.electronAPI.tapeLoad(${JSON.stringify(id)}, { position: 0 })`); await sleep(2500)
  await main.ev(`window.electronAPI.tapeCommand({type:'volume', value:0})`)
  const w0 = await api(`window.electronAPI.tapeGet()`)
  check('loaded PAUSED and nothing plays by itself', w0 && w0.status === 'paused' && !w0.hasPlayedOnce, JSON.stringify(w0 && { s: w0.status, p: w0.position }))
  await main.ev(`window.electronAPI.tapeCommand({type:'play'})`); await sleep(3500)
  const w1 = await api(`window.electronAPI.tapeGet()`)
  check('the engine plays: position advanced about 3 s in about 3.5 s', w1 && w1.status === 'playing' && w1.position > 2 && w1.position < 5, JSON.stringify(w1 && { s: w1.status, p: +w1.position.toFixed(2), stalled: w1.stalled, err: w1.error }))
  await main.ev(`window.electronAPI.tapeCommand({type:'seek', to: 30})`); await sleep(1500)
  const w2 = await api(`window.electronAPI.tapeGet()`)
  check('seek lands where asked (±1 s)', w2 && Math.abs(w2.position - 31.5) < 2.5, JSON.stringify(w2 && +w2.position.toFixed(2)))
  await main.ev(`window.electronAPI.tapeCommand({type:'pause'})`); await sleep(700)
  const w3 = await api(`window.electronAPI.tapeGet()`)
  const p3 = w3.position; await sleep(1200); const w4 = await api(`window.electronAPI.tapeGet()`)
  check('pause holds the position', w3.status === 'paused' && Math.abs(w4.position - p3) < 0.05, `${p3.toFixed(2)} -> ${w4.position.toFixed(2)}`)
  // timing: save a map, read it back, loudness picture, export
  const save = await api(`window.electronAPI.tapeMapSave(${JSON.stringify(id)}, null, 'tap', [{n:1,t:2,kind:'start'},{n:2,t:20,kind:'start'}], [])`)
  check('a timing map saves and is marked timed', save && save.ok && save.map.marks.length === 2, JSON.stringify(save && save.ok))
  const got = await api(`window.electronAPI.tapeMapGet(${JSON.stringify(id)}, null).then(m => m && m.marks.length)`)
  check('and reads back', got === 2, String(got))
  const act = await api(`window.electronAPI.tapeActivity(${JSON.stringify(id)}, 64)`)
  check('the loudness picture is produced', act && act.values && act.values.length > 10, act && act.values && act.values.length + ' bars')
  const devs = await api(`window.electronAPI.tapeDevices()`)
  check('output devices can be listed', Array.isArray(devs), devs.length + ' devices')
  // the screen and the stage see the same tape state
  await main.ev(`window.electronAPI.tapeCommand({type:'seek', to: 5})`)
  // cleanup: remove the recording (never the sermon)
  await main.ev(`window.electronAPI.tapeCommand({type:'pause'})`)
  const rm = await api(`window.electronAPI.tapeRemove(${JSON.stringify(id)})`)
  check('removing the recording works and keeps the sermon', rm !== undefined)
  const left = await api(`window.electronAPI.tapeRecordings(${sermon})`)
  check('no recording left on the sermon', left.length === 0, String(left.length))
  const fails = res.filter((r) => !r.ok)
  console.log(`\n${res.length - fails.length}/${res.length} passed`)
  process.exit(fails.length ? 1 : 0)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
