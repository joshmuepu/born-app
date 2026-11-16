/* Crash recovery (scripts only, never shipped): stops the congregation screen's page (CDP Page.crash) five times while a verse is live and
 * checks, after every stop, what the screen shows, what the header says and what the operator is told.
 * Crashes 1-3 in a minute: the screen comes back by itself with the verse. Crash 4: it is left off, the header shows the projection as closed
 * (never live over a dead screen) and a notice offers Open projection, which brings the verse back. Crash 5 (after that reopen): back again.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/crash-recovery.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const state = async () => (await fetch(B + '/state')).json()

;(async () => {
  const c = checks('crash-recovery')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-parity', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const p = await app.page(); await p.viewport(1366, 768, 1)
  const congregation = async () => (await app.targets()).find((t) => t.type === 'page' && /Congregation screen/.test(t.title))
  // a dead page never answers, so every read gives up after 3 s
  const screenText = async () => {
    const t = await congregation(); if (!t) return '(no window)'
    let o = null
    const txt = await Promise.race([(async () => { o = await new Page(t).connect(); return o.ev('document.body.innerText') })().catch(() => '(dead)'), sleep(3000).then(() => '(dead)')])
    if (o) o.close()
    return txt
  }
  const header = () => p.ev(`(()=>{const b=[...document.querySelectorAll('header button')].find(x=>/projection$/.test(x.textContent.trim()));const dot=document.querySelector('.screens-dot');return {button:b&&b.textContent.trim(),live:!!dot&&dot.classList.contains('is-live'),hide:[...document.querySelectorAll('header button')].some(x=>/^(Hide|Show) screen$/.test(x.textContent.trim()))}})()`)
  const notice = () => p.ev(`(()=>{const n=document.querySelector('.operator-notice');return n?n.textContent.trim():''})()`)
  const crash = async () => { const t = await congregation(); if (!t) return; const o = await Promise.race([new Page(t).connect(), sleep(3000).then(() => null)]); if (!o) return; o.send('Page.crash'); await sleep(400); o.close() }

  await cmd({ action: 'queue-bible', reference: 'John 3:16', translation: 'KJV' }); await sleep(1200)
  const st = await state()
  await cmd({ action: 'project', id: st.queue[0].id }); await sleep(3000)
  c.ok('John 3:16 is live before any crash', /God so loved/.test(await screenText()))

  for (let n = 1; n <= 5; n++) {
    await crash(); await sleep(3500)
    const h = await header(), txt = await screenText(), note = await notice()
    if (n <= 3) {
      c.ok(`crash ${n}: the screen came back with the verse`, /God so loved/.test(txt), txt.slice(0, 50))
      c.ok(`crash ${n}: the header still shows the projection as open`, h.button === 'Close projection' && h.live, JSON.stringify(h))
      c.ok(`crash ${n}: the operator is told`, /congregation screen stopped/i.test(note), note)
    } else if (n === 4) {
      c.ok('crash 4: the header shows the projection as closed, not live', h.button === 'Open projection' && !h.live && !h.hide, JSON.stringify(h))
      c.ok('crash 4: the notice says it failed and offers Open projection', /keeps stopping|stopped several times/i.test(note) && /Open projection/.test(note), note)
      const clicked = await p.ev(`(()=>{const b=document.querySelector('.operator-notice button');if(!b)return false;b.click();return true})()`); await sleep(4000)
      const h2 = await header(), txt2 = await screenText()
      c.ok('crash 4: Open projection in the notice brings the verse back', clicked && /God so loved/.test(txt2), txt2.slice(0, 50))
      c.ok('crash 4: after reopening the header shows it as open', h2.button === 'Close projection' && h2.live, JSON.stringify(h2))
      c.ok('crash 4: the notice is gone once it is open again', !(await notice()))
    } else {
      c.ok('crash 5 (after reopening): the screen came back by itself', /God so loved/.test(txt), txt.slice(0, 50))
      c.ok('crash 5: the header still shows it as open', h.button === 'Close projection' && h.live, JSON.stringify(h))
    }
  }
  // the operator window itself: stopped and started again, it knows the projection is still open
  const main = (await app.targets()).find((t) => t.type === 'page' && /Branham or Nothing/.test(t.title))
  const m = await new Page(main).connect(); m.send('Page.crash'); await sleep(400); m.close(); await sleep(6000)
  const p2 = await app.page()
  const h3 = await p2.ev(`(()=>{const b=[...document.querySelectorAll('header button')].find(x=>/projection$/.test(x.textContent.trim()));return b&&b.textContent.trim()})()`)
  const note3 = await p2.ev(`(()=>{const n=document.querySelector('.operator-notice');return n?n.textContent.trim():''})()`)
  c.ok('operator window crash: it comes back and still shows the projection as open', h3 === 'Close projection', String(h3))
  c.ok('operator window crash: it says what happened', /operator window stopped/i.test(note3), note3)
  c.ok('operator window crash: the verse stayed on the screen', /God so loved/.test(await screenText()))
  const r = c.done(); p2.close(); await app.kill(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
