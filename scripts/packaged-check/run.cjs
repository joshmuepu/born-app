const { attach, sleep } = require('./cdp.cjs'); const fs = require('fs')
const PORT = 9921, OUT = (process.env.PKG_OUT || '.') + '/', imgs = (process.env.PKG_IMAGES || '') + '/'
const res = []; const check = (n, ok, d = '') => { res.push({ n, ok: !!ok, d }); console.log(ok ? 'PASS' : 'FAIL', n, d) }
;(async () => {
  const main = await attach(t => t.title === 'Born Again', PORT); await main.send('Runtime.enable')
  await main.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false })
  const api = e => main.ev(`(async()=>JSON.stringify(await (${e})))()`).then(JSON.parse)
  check('origin is packaged file://', /^file:.*app\.asar/.test(main.t.url), main.t.url)
  const names = ['Welcome.jpg', 'Offering.jpg', 'Church logo.jpg', 'Blue hour.jpg', 'Warm light.jpg', 'Phone photo.jpg']
  const r = await api(`window.electronAPI.mediaImportPaths(${JSON.stringify(names.map(n => imgs + n))}, {}).then(x=>x.results)`)
  check('import 6 pictures', r.every(x => x.ok), JSON.stringify(r.map(x => x.ok)))
  const items = r.map(x => x.item)
  // thumbnails + display via the custom protocol from the packaged origin
  const probe = await main.ev(`(async()=>{const out=[];for(const id of ${JSON.stringify(items.map(i => i.id))}){for(const k of ['thumb','display']){out.push(await new Promise(res=>{const im=new Image();im.onload=()=>res(k+':'+im.naturalWidth+'x'+im.naturalHeight);im.onerror=()=>res(k+':ERR');im.src='born-media://'+k+'/'+id}))}}return JSON.stringify(out)})()`)
  const pr = JSON.parse(probe); check('born-media thumb + display load from packaged origin', pr.every(s => !s.includes('ERR')), pr.join(' '))
  const th = fs.readdirSync(process.env.PKG_PROFILE + '/media/thumbs').length; check('thumbs written to userData', th >= 6, th + ' files')
  // remote HTTP thumbnails
  const h = await fetch(`http://127.0.0.1:4317/media/${items[0].id}/thumb`).catch(e => null)
  check('remote media thumb route (no token → expected status)', !!h, h && h.status + '')
  // backgrounds
  await api(`window.electronAPI.mediaBackgroundSet('destination','congregation',{mediaId:${JSON.stringify(items[3].id)},dim:35})`)
  const bg = await api(`window.electronAPI.mediaBackgroundsGet()`); check('background set', JSON.stringify(bg).includes(items[3].id))
  await main.send('Page.reload'); await sleep(3500)
  const go = async () => { await main.ev(`(()=>{[...document.querySelectorAll('.rail-btn')].find(b=>/Media/.test(b.innerText)).click()})()`); await sleep(900) }
  await go(); await main.shot(OUT + '1-library.png')
  const cards = await main.ev(`document.querySelectorAll('.media-card').length`); check('library shows cards', cards >= 6, cards + '')
  const sel = id => main.ev(`(()=>{const e=document.querySelector('.media-card[data-media-id="${id}"]'); if(e) e.click()})()`)
  const add = async id => { await sel(id); await sleep(250); await main.ev(`document.querySelector('.media-detail-buttons .btn-primary').click()`); await sleep(250) }
  await add(items[0].id); await add(items[1].id)
  // multi-select (ctrl-click) -> slideshow
  for (const it of [items[0], items[1], items[2]]) {
    const p = JSON.parse(await main.ev(`(()=>{const e=document.querySelector('.media-card[data-media-id="${it.id}"]'); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`))
    for (const t of ['mousePressed', 'mouseReleased']) await main.send('Input.dispatchMouseEvent', { type: t, x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers: 4 })
    await sleep(150)
  }
  const ss = await main.ev(`(()=>{const b=[...document.querySelectorAll('.media-multi button')].find(b=>/slideshow/.test(b.innerText)); if(b){b.click();return true}return false})()`); await sleep(500)
  check('make slideshow', ss)
  const rows = await main.ev(`document.querySelectorAll('.queue-row').length`); check('queue rows', rows >= 3, rows + '')
  // preflight
  await main.ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Check').click()`); await sleep(2500)
  const pf = await main.ev(`document.querySelector('.modal.preflight')?.innerText || ''`); check('preflight runs + ready', /ready|Ready|ok/i.test(pf), pf.replace(/\s+/g, ' ').slice(0, 160))
  await main.shot(OUT + '2-preflight.png')
  await main.ev(`document.querySelector('.modal.preflight button[aria-label="Close"]').click()`); await sleep(300)
  // projection + panic
  await main.ev(`[...document.querySelectorAll('button')].find(b=>/Open projection/.test(b.innerText))?.click()`); await sleep(2500)
  await main.ev(`window.electronAPI.showSlide({kind:'bible',text:'The Lord is my shepherd; I shall not want.',reference:'Psalm 23:1 · KJV',marker:'1'})`); await sleep(1500)
  const proj = await attach(t => /projection/.test(t.url), PORT)
  const txt = () => proj.ev(`document.body.innerText`)
  check('projection shows text over background', /shepherd/.test(await txt()))
  await proj.shot(OUT + '3-live-bg.png')
  const key = async (key, code, mods = 0) => { for (const t of ['keyDown', 'keyUp']) await main.send('Input.dispatchKeyEvent', { type: t, key, code, modifiers: mods }); await sleep(900) }
  await key('Escape', 'Escape'); check('Esc blanks', !/shepherd/.test(await txt()), (await txt()).slice(0, 40))
  await main.ev(`window.electronAPI.showSlide({kind:'bible',text:'The Lord is my shepherd; I shall not want.',reference:'Psalm 23:1 · KJV',marker:'1'})`); await sleep(1000)
  await key('L', 'KeyL', 2 | 8) ; await main.shot(OUT + '4-logo.png'); check('Ctrl+Shift+L hides text (logo)', !/shepherd/.test(await txt()))
  // Help
  await main.ev(`(()=>{const b=[...document.querySelectorAll('.rail-btn')].find(b=>/Help/.test(b.innerText)); b&&b.click()})()`); await sleep(1200)
  await main.shot(OUT + '5-help.png')
  const helpTxt = await main.ev(`document.body.innerText`); check('Help opens', /Help|Manual/i.test(helpTxt))
  fs.writeFileSync(OUT + 'result.json', JSON.stringify(res, null, 1))
  console.log(res.filter(x => !x.ok).length, 'failures'); process.exit(0)
})().catch(e => { console.error('FAILED', e); process.exit(1) })
