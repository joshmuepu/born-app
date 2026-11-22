/* Late font (scripts only, never shipped): the screens' font is only loaded once text first uses it, so the first slide was fitted with the
 * system font and, once the wider screen font arrived, was cut at both ends. In the real app on an isolated profile, with the text size
 * raised (6.5) and the congregation screen (kept hidden) at 1728x1117, the screen font's download is held back while the first page of
 * "All That Thrills My Soul" goes live, then let through: the page must still fit, on the congregation screen and on the stage monitor.
 * Usage: node scripts/qa/font-late.cjs <profileDir>   (needs `npm run build`; SHOW=1 leaves the screens visible at their real size and slows down to watch) */
const SHOW = process.env.SHOW === '1'
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile] = process.argv.slice(2)
const SONG = 'All That Thrills My Soul'

// holds every request for the screen font in this window until release() is called
async function holdFont(page) {
  const held = []
  page.ws.addEventListener('message', (m) => {
    const j = JSON.parse(m.data)
    if (j.method === 'Fetch.requestPaused') held.push(j.params.requestId)
  })
  await page.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*Inter*' }] })
  // the window may already have the font: start it again with the font held back
  await page.send('Page.reload', { ignoreCache: true }); await sleep(2500)
  return {
    held: () => held.length,
    release: async () => { for (const id of held.splice(0)) await page.send('Fetch.continueRequest', { requestId: id }); await page.send('Fetch.disable') }
  }
}
const fitOf = (sel) => `(()=>{const t=document.querySelector(${JSON.stringify(sel)});if(!t)return null;const i=t.firstElementChild;return {px:parseFloat(getComputedStyle(t).fontSize),box:t.clientHeight,text:i.scrollHeight,inter:document.fonts.check('16px Inter')}})()`

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ theme: 'dark', fontSize: 6.5 }))
  const c = checks('font-late')
  const app = await launch({ profile, remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-font', settle: 8000, extraArgs: SHOW ? [] : ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  try {
    const p = await app.page()
    const clickIn = (sel, text) => p.ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent&&x.textContent.trim().startsWith(${JSON.stringify(text)}));if(b){b.click();return true}return false})()`)
    c.ok('the congregation screen opened', await clickIn('button', 'Open projection')); await sleep(2500)
    await p.ev('window.electronAPI.openStage()'); await sleep(2500)
    const find = async (re) => new Page((await app.targets()).find((x) => x.type === 'page' && re.test(x.title))).connect()
    const cong = await find(/Congregation screen/), stage = await find(/Stage monitor|Stage View/)
    // hidden runs pretend to be a 1728x1117 laptop screen; a visible run keeps each window's real size, so what is seen is what is measured
    if (!SHOW) for (const s of [cong, stage]) await s.viewport(1728, 1117, 2)
    const holds = [await holdFont(cong), await holdFont(stage)]
    const status = async (s) => s.ev(`[...document.fonts].filter(f=>f.family.includes('Inter')).map(f=>f.status).join(',')`)
    c.ok('the screen font is not loaded yet on either screen', !/(^|,)loaded/.test((await status(cong)) + ',' + (await status(stage))), (await status(cong)) + ' / ' + (await status(stage)))

    await clickIn('.panel-tab, button', 'Songs'); await sleep(800)
    await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.offsetParent&&/titles/i.test(x.placeholder||''));i.focus();i.select()})()`)
    await p.insertText(SONG); await sleep(1500)
    c.ok(`"${SONG}" queued`, await p.ev(`(()=>{const row=[...document.querySelectorAll('*')].filter(e=>e.offsetParent&&e.children.length&&e.textContent.includes(${JSON.stringify(SONG)})&&[...e.querySelectorAll('button')].some(b=>b.textContent.trim()==='+ Queue')).sort((a,b)=>a.textContent.length-b.textContent.length)[0];if(!row)return false;[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='+ Queue').click();return true})()`))
    await sleep(1500)
    await p.ev(`(()=>{const r=[...document.querySelectorAll('.queue-row')].find(e=>e.textContent.includes(${JSON.stringify(SONG)}));[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Project').click()})()`); await sleep(1500)
    const before = { cong: await cong.ev(fitOf('.projection-text')), stage: await stage.ev(fitOf('.stage-current')) }
    c.ok('the first page is live, sized with the system font', before.cong && !before.cong.inter && before.stage && !before.stage.inter, JSON.stringify(before))
    c.ok('the font download was held back', holds.every((h) => h.held() > 0), holds.map((h) => h.held()).join(','))

    if (SHOW) await sleep(5000)
    for (const h of holds) await h.release()
    await cong.waitFor(`document.fonts.check('16px Inter')`); await stage.waitFor(`document.fonts.check('16px Inter')`); await sleep(1200)
    const after = { cong: await cong.ev(fitOf('.projection-text')), stage: await stage.ev(fitOf('.stage-current')) }
    c.ok('the screen font has loaded', after.cong.inter && after.stage.inter)
    c.ok('congregation screen: the page still fits with the screen font', after.cong.text <= after.cong.box + 1, `text ${after.cong.text} px in a ${after.cong.box} px box at ${after.cong.px.toFixed(1)} px (was ${before.cong.px.toFixed(1)} px)`)
    c.ok('stage monitor: the page still fits with the screen font', after.stage.text <= after.stage.box + 1, `text ${after.stage.text} px in a ${after.stage.box} px box at ${after.stage.px.toFixed(1)} px (was ${before.stage.px.toFixed(1)} px)`)
    if (SHOW) await sleep(6000)
    const mark = await p.ev(`[...document.querySelectorAll('.queue-row-tag--warn, .live-now-hidden-badge--warn')].map(e=>e.textContent).filter(t=>/^Text is/.test(t)).join('; ')`)
    c.ok('no "Text is cut" mark in the operator window', !/cut/.test(mark), mark)
    const errs = [...p.takeLogs(), ...cong.takeLogs(), ...stage.takeLogs()].filter((l) => l.kind === 'exception')
    c.ok('no page errors', !errs.length, JSON.stringify(errs.slice(0, 2)))
    cong.close(); stage.close(); p.close()
  } finally {
    await app.kill()
  }
  process.exit(c.done().failed ? 1 : 0)
})()
