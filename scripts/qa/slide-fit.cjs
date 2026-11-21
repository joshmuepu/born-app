/* Slide fit (scripts only, never shipped): in the real app on an isolated profile, with the congregation screen open (kept hidden) at 1920x1080,
 * 3840x2160 and 1280x720, queues the bundled song with the longest page (15 lines, shrunk to 2.96% of the screen height) and checks that the
 * queue row says "Text is very small" before it is live, that the live preview says so only while that page is on screen, and that the mark
 * clears when the item is removed. A short song is checked to have no mark.
 * Usage: node scripts/qa/slide-fit.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile] = process.argv.slice(2)
const LONG = 'More Than Anything', SHORT = 'Change My Heart Oh God'

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ theme: 'dark' }))
  const c = checks('slide-fit')
  const app = await launch({ profile, remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-fit', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  try {
    const p = await app.page()
    const clickIn = (sel, text) => p.ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent&&x.textContent.trim().startsWith(${JSON.stringify(text)}));if(b){b.click();return true}return false})()`)
    c.ok('the congregation screen opened with Open projection', await clickIn('button', 'Open projection')); await sleep(2500)
    const t = (await app.targets()).find((x) => x.type === 'page' && /Congregation screen/.test(x.title))
    const cong = await new Page(t).connect()
    await cong.viewport(1920, 1080, 1); await sleep(800)
    const queueSong = async (title) => {
      await clickIn('.panel-tab, button', 'Songs'); await sleep(800)
      await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.offsetParent&&/titles/i.test(x.placeholder||''));i.focus();i.select()})()`)
      await p.insertText(title); await sleep(1500)
      return p.ev(`(()=>{const row=[...document.querySelectorAll('*')].filter(e=>e.offsetParent&&e.children.length&&e.textContent.includes(${JSON.stringify(title)})&&[...e.querySelectorAll('button')].some(b=>b.textContent.trim()==='+ Queue')).sort((a,b)=>a.textContent.length-b.textContent.length)[0];if(!row)return false;[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='+ Queue').click();return true})()`)
    }
    const rowMark = (title) => p.ev(`(()=>{const r=[...document.querySelectorAll('.queue-row')].find(e=>e.textContent.includes(${JSON.stringify(title)}));return r?(r.querySelector('.queue-row-tag--warn')||{}).textContent||'':null})()`)
    const liveMark = () => p.ev(`(document.querySelector('.live-now-hidden-badge--warn')||{}).textContent||''`)

    c.ok(`"${LONG}" queued`, await queueSong(LONG)); await sleep(1500)
    c.ok(`"${SHORT}" queued`, await queueSong(SHORT)); await sleep(1500)
    for (const [w, h] of [[1920, 1080], [3840, 2160], [1280, 720]]) {
      await cong.viewport(w, h, 1); await sleep(1500)
      c.ok(`${w}x${h}: the long song's row says "Text is very small" before it is live`, (await rowMark(LONG)) === 'Text is very small', JSON.stringify(await rowMark(LONG)))
      c.ok(`${w}x${h}: the short song's row has no mark`, (await rowMark(SHORT)) === '', JSON.stringify(await rowMark(SHORT)))
    }
    await cong.viewport(1920, 1080, 1); await sleep(1200)
    // put the long song live, first its opening page, then its 15-line page (the tenth)
    await p.ev(`(()=>{const r=[...document.querySelectorAll('.queue-row')].find(e=>e.textContent.includes(${JSON.stringify(LONG)}));[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Project').click()})()`); await sleep(1500)
    c.ok('the opening page live: no mark on the live preview', (await liveMark()) === '', JSON.stringify(await liveMark()))
    c.ok('the 15-line page jumped to', await p.clickSel('.live-slide-jump-chip:nth-child(10)')); await sleep(1500)
    const px = await cong.ev(`parseFloat(getComputedStyle(document.querySelector('.projection-text')).fontSize)`)
    c.ok('that page live: the live preview says "Text is very small"', (await liveMark()) === 'Text is very small', `congregation text ${px.toFixed(1)} px of 1080 (${(px / 10.8).toFixed(2)}%)`)
    await p.clickSel('.live-slide-jump-chip:nth-child(1)'); await sleep(1500)
    c.ok('back to the opening page: the live mark clears', (await liveMark()) === '', JSON.stringify(await liveMark()))
    await p.ev(`(()=>{const r=[...document.querySelectorAll('.queue-row')].find(e=>e.textContent.includes(${JSON.stringify(LONG)}));[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Remove').click()})()`); await sleep(1500)
    const left = await p.ev(`[...document.querySelectorAll('.queue-row-tag--warn, .live-now-hidden-badge--warn')].map(e=>e.textContent).filter(t=>/^Text is/.test(t)).join('; ')`)
    c.ok('the long song removed (still live, so marked "Not in your queue"): no slide-fit mark is left', !left, left)
    const errs = [...p.takeLogs(), ...cong.takeLogs()].filter((l) => l.kind === 'exception')
    c.ok('no page errors', !errs.length, JSON.stringify(errs.slice(0, 2)))
    cong.close(); p.close()
  } finally {
    await app.kill()
  }
  process.exit(c.done().failed ? 1 : 0)
})()
