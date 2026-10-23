/* Esc / hide-screen matrix on the REAL app. Screens "on" = projection + stage windows exist but are hidden (hide-outputs.cjs), so nothing covers a monitor.
 * Each scenario is a fresh launch: the operator is somewhere (sermon reader, Bible chapter, song, queue, search results), something is live, the operator has
 * scrolled to a place of their own, then Esc / Esc / the phone remote's Hide screen / Shift+Esc are pressed. After every action the matrix compares:
 * every scrollable region's position, the visible views, focus, text selection, and which paragraphs/verses/slides are marked. Esc must only hide or show the
 * screens: the operator's place stays exactly where it was.
 * Usage: node scripts/qa/esc-matrix.cjs <profileDir> [outJson] [WxH@scale]    (runtime library data only; nothing real is written to the repo) */
const fs = require('fs'), path = require('path')
const { launch, sleep } = require('./lib.cjs')
const { DatabaseSync } = require('node:sqlite')
const base = process.argv[2], outJson = process.argv[3], size = (process.argv[4] || '1366x768@1').match(/(\d+)x(\d+)@([\d.]+)/)
const REMOTE = 14343
let failed = 0, total = 0; const results = []
const rec = (scenario, what, before, after) => {
  const same = JSON.stringify(before) === JSON.stringify(after); total++; if (!same) failed++
  results.push({ scenario, what, before, after, same })
  const diff = same ? '' : '  <- ' + (typeof before === 'object' && before && !Array.isArray(before) ? Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((k) => `${k}: ${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}`).join(' | ') : `${JSON.stringify(before)} -> ${JSON.stringify(after)}`)
  if (!same || process.env.VERBOSE) console.log(`${same ? 'PASS' : 'FAIL'}  [${scenario}] ${what}${diff}`)
}
const srcDb = (f) => new DatabaseSync(path.join(base, f), { readOnly: true })

async function scenario(name, setup, scrollSel, frac) {
  const profile = path.join(base, 'run-' + name.replace(/\W+/g, '-'))
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  for (const f of ['sermons.db', 'library.db']) fs.copyFileSync(path.join(base, f), path.join(profile, f))
  const db = srcDb('sermons.db'), lib = srcDb('library.db')
  const rowOf = (sid, ref) => db.prepare('select p.text,p.paragraph_ref ref,s.title,s.date_code dc from paragraphs p join sermons s on s.id=p.sermon_id where p.sermon_id=? and p.paragraph_ref=?').get(sid, ref)
  const songs = lib.prepare('select id,title from songs where id in (select song_id from song_slides group by song_id having count(*)>=4) order by id limit 2').all()
  const songItem = (s, n) => ({ kind: 'song', id: 's-' + n, songId: s.id, title: s.title, slides: lib.prepare('select label,text from song_slides where song_id=? order by slide_index').all(s.id).map((x) => ({ label: x.label || undefined, text: x.text })) })
  const r1 = rowOf(711, '396-399')
  const queue = [songItem(songs[0], 1), { kind: 'quote', id: 'q-1', quote: { text: r1.text, sermonTitle: r1.title, dateCode: r1.dc, sermonId: 711, paragraphIndex: 0, paragraphRef: r1.ref }, slides: [{ text: r1.text.slice(0, 500), marker: r1.ref, reference: `${r1.title} · ${r1.dc} · ${r1.ref}` }] }]
  for (let i = 0; i < 20; i++) queue.push({ kind: 'quote', id: 'f-' + i, quote: { text: 'Placeholder filler paragraph ' + i, sermonTitle: 'Placeholder Sermon ' + i, dateCode: '00-0101', sermonId: 1, paragraphIndex: 0, paragraphRef: String(i + 1) }, slides: [{ text: 'Placeholder filler paragraph ' + i, marker: String(i + 1) }] })
  queue.push(songItem(songs[1], 99))
  fs.writeFileSync(path.join(profile, 'queue.json'), JSON.stringify(queue))
  const report = path.join(profile, 'hide-report.json')
  const app = await launch({ profile, remotePort: REMOTE, mdns: 'born-remote-v1em', port: 9373, settle: 8000, env: { HIDE_REPORT: report }, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  try {
    const p = await app.page(); await p.viewport(Math.round(+size[1] / +size[3]), Math.round(+size[2] / +size[3]), 1); await sleep(600)
    await p.ev('window.electronAPI.openStage()'); await sleep(700)
    const vis = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')).filter((w) => w.output && w.visible) : []
    if (vis.length) throw new Error('an output window is visible: ' + JSON.stringify(vis))
    const snap = () => p.ev(`(()=>{
      const sc={};for(const e of document.querySelectorAll('*')){const s=getComputedStyle(e);if(/(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+2&&e.getClientRects().length){sc[(e.className||e.tagName).toString().split(' ')[0]]=Math.round(e.scrollTop)}}
      const a=document.activeElement
      const view=['.follow-view','.song-detail','.service-queue','.results-panel','.bible-panel'].filter(s=>{const e=document.querySelector(s);return e&&e.getClientRects().length})
      const marked=[...document.querySelectorAll('.follow-para--focus,.follow-para--on-screen,.bible-verse.live,.bible-verse--on-screen,.song-slide--on-screen')].filter(e=>e.getClientRects().length).map(e=>(e.querySelector('.follow-para-ref,.bible-verse-num,.song-slide-label')||e).textContent.trim().slice(0,10)).sort()
      return {scroll:sc,view,focus:a?(a.tagName+'.'+String(a.className).split(' ')[0]).slice(0,40):null,sel:String(getSelection()).slice(0,20),marked}})()`)
    const blank = () => p.ev(`!!document.querySelector('.btn-toggle-on')`)
    const remoteBlank = async (action = 'blank') => { await fetch(`http://127.0.0.1:${REMOTE}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); await sleep(1600) }
    await setup(p, sleep)
    await p.ev(`(()=>{const f=document.activeElement;if(f&&f!==document.body)f.blur()})()`)
    await p.ev(`(()=>{let n=document.querySelector(${JSON.stringify(scrollSel)});while(n&&!(n.scrollHeight>n.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(n).overflowY)))n=n.parentElement;if(n)n.scrollTop=n.scrollHeight*${frac}})()`); await sleep(800)
    const b0 = await snap()
    const same = (a, b) => ({ ...a, marked: undefined }) && [{ ...a, marked: undefined }, { ...b, marked: undefined }]
    const step = async (label, act) => {
      await act(); await sleep(1200)
      const b = await snap()
      rec(name, `${label}: scroll, view, focus and selection unchanged`, { ...b0, marked: undefined }, { ...b, marked: undefined })
      // the Bible and song lists only ever mark the live verse/slide, so while hidden their mark is legitimately gone (the place is kept: see scroll above)
      const hiddenNow = !/again|show/i.test(label) || /Esc \(hide/.test(label)
      if (process.env.DBG) console.log('DBG', label, JSON.stringify(b.marked))
      if (!(hiddenNow && /bible|song/.test(name))) rec(name, `${label}: same paragraph/verse/slide still marked (the "On screen" tag may drop while hidden)`, b0.marked, b.marked)
    }
    await step('Esc (hide screens)', async () => { await p.key('Escape') })
    const hid = await blank()
    if (!hid) { console.log('  note: screens were not hidden by Esc'); total++; failed++ }
    await step('Esc again (show screens)', async () => { await p.key('Escape') })
    await step('phone remote Hide screen', async () => { await remoteBlank() })
    await step('phone remote Show screen (show)', async () => { await remoteBlank('unblank') })
    await step('Shift+Esc', async () => { await p.key('Escape', { shift: true }) })
    await step('Shift+Esc again', async () => { await p.key('Escape', { shift: true }) })
    // the output pages themselves: they must not scroll or move when hidden/shown
    const outs = (await app.targets()).filter((t) => /Output|Stage View/.test(t.title))
    for (const t of outs) {
      const op = await app.page((x) => x.id === t.id)
      const m = () => op.ev(`({y:Math.round(scrollY),x:Math.round(scrollX),sh:document.documentElement.scrollHeight<=innerHeight+1,sc:[...document.querySelectorAll('*')].filter(e=>/(auto|scroll)/.test(getComputedStyle(e).overflowY)&&e.scrollTop>0).length})`)
      const m0 = await m(); await p.key('Escape'); await sleep(1200); const m1 = await m(); await p.key('Escape'); await sleep(1200); const m2 = await m()
      rec(name, `${/Stage/.test(t.title) ? 'stage' : 'projection'} page does not scroll or move on hide/show`, m0, m1); rec(name, `${/Stage/.test(t.title) ? 'stage' : 'projection'} page after show`, m0, m2)
      op.close()
    }
    p.close()
  } finally { await app.kill() }
}
const projectQueueRow = (i) => `(()=>{const rows=[...document.querySelectorAll('.queue-row')];rows[${i}].querySelector('.queue-row-actions .btn-quiet').click()})()`
;(async () => {
  const only = process.env.ONLY
  const S = {
    // the operator opens the long sermon from a search result, projects a paragraph inside the clicked row and steps Next twice, then reads ahead at 25%
    'sermon reader': [async (p, sleep) => {
      const db = srcDb('sermons.db'); const row = db.prepare("select text from paragraphs where sermon_id=711 and paragraph_ref='396-399'").get()
      await p.click('Sermons', '.panel-tab'); await p.click('Search', '.panel-subtab'); await sleep(300)
      await p.ev("(()=>{const i=[...document.querySelectorAll('input.search-input')].find(e=>e.getClientRects().length);i.focus()})()")
      await p.insertText('"' + row.text.split(/\s+/).slice(0, 6).join(' ').replace(/[^\w ]/g, '') + '"'); await p.key('Enter'); await sleep(2500)
      await p.clickSel('.result-item .result-body'); await sleep(2500)
      await p.ev(`(()=>{const c=[...document.querySelectorAll('.follow-para')].find(e=>e.querySelector('.follow-para-ref').textContent==='¶398a');c.querySelector('.btn-primary').click()})()`); await sleep(2000)
      await p.key('ArrowRight'); await sleep(900); await p.key('ArrowRight'); await sleep(900)
    }, '.follow-para', 0.25],
    'bible chapter': [async (p, sleep) => {
      await p.click('Bible', '.panel-tab'); await sleep(500)
      await p.ev("(()=>{const i=[...document.querySelectorAll('input.search-input')].find(e=>e.getClientRects().length);i.focus()})()"); await p.insertText('Psalm 119:100'); await p.key('Enter'); await sleep(1500)
      await p.ev("[...document.querySelectorAll('.bible-passage .btn-primary')].find(b=>/Project/.test(b.textContent)).click()"); await sleep(2500)
      await p.key('ArrowRight'); await sleep(900)
    }, '.bible-verse', 0.12],
    'song detail': [async (p, sleep) => { await p.ev(projectQueueRow(0)); await sleep(2500); await p.key('ArrowRight'); await sleep(900) }, '.song-slide', 0.5],
    'service queue': [async (p, sleep) => { await p.ev(projectQueueRow(8)); await sleep(2500) }, '.queue-row', 1],
    'search results': [async (p, sleep) => {
      await p.ev(projectQueueRow(0)); await sleep(2000); await p.click('Sermons', '.panel-tab'); await p.click('Search', '.panel-subtab'); await sleep(300)
      await p.ev("(()=>{const i=[...document.querySelectorAll('input.search-input')].find(e=>e.getClientRects().length);i.focus()})()"); await p.insertText('faith'); await p.key('Enter'); await sleep(2500)
    }, '.result-item', 0.4]
  }
  for (const [n, [setup, sel, frac]] of Object.entries(S)) { if (only && !only.split(',').includes(n)) continue; console.log('\n=== ' + n); await scenario(n, setup, sel, frac) }
  console.log(`\nesc-matrix (${size[0]}): ${total} checks, ${failed} failed`)
  if (outJson) fs.writeFileSync(outJson, JSON.stringify(results, null, 1))
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
