/* Reaching a queued paragraph far down a long sermon, on the REAL app (screens "on" but hidden, see hide-outputs.cjs). For each case a queue item is made with the app's own
 * quoteToItem (bundled at run time) from a row of the seeded library, then: (a) click the queue row -> where does the sermon reader land and how long does it take,
 * (b) Project -> is the live paragraph in view, (c) Next / Previous -> still in the sermon, live paragraph in view, (d) back to the queue (it is always on the right).
 * Usage: node scripts/qa/reach-probe.cjs <profileDir> [outJson] [WxH@scale]   (runtime library data only) */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process')
const { launch, sleep } = require('./lib.cjs')
const { DatabaseSync } = require('node:sqlite')
const base = process.argv[2], outJson = process.argv[3], size = (process.argv[4] || '1366x768@1').match(/(\d+)x(\d+)@([\d.]+)/)
const ROOT = path.join(__dirname, '..', '..')
const bundle = path.join(base, 'queueItem.cjs')
execSync(`npx esbuild ${path.join(ROOT, 'src/shared/queueItem.ts')} --bundle --platform=node --format=cjs --outfile=${bundle} --log-level=error`, { cwd: ROOT })
const { quoteToItem } = require(bundle)
const sdb = new DatabaseSync(path.join(base, 'sermons.db'), { readOnly: true })
const rows = (sid) => sdb.prepare('select p.id,p.paragraph_ref ref,p.text,s.title,s.date_code dc from paragraphs p join sermons s on s.id=p.sermon_id where p.sermon_id=? order by p.id').all(sid)
const toQuote = (r, sid) => ({ text: r.text, sermonTitle: r.title, dateCode: r.dc, sermonId: sid, paragraphIndex: 0, paragraphRef: r.ref || '§' + r.id, matchType: 'phrase' })
const pick = (sid, frac) => { const rs = rows(sid); return rs[Math.min(rs.length - 1, Math.floor(rs.length * frac))] }
const CASES = [
  ['60-1204M Revelation, row ~65% (¶ 396)', 711, () => rows(711).find((r) => r.ref === '396' || r.ref === '396-399')],
  ['60-1204M Revelation, the very last paragraph', 711, () => rows(711).slice(-1)[0]],
  ['62-0318 longest sermon (389 rows), last row', 835, () => rows(835).slice(-1)[0]],
  ['"1 - The Revelation Of Jesus Christ" (book chapter, NO paragraph numbers), row ~80%', 1386, () => pick(1386, 0.8)],
  ['"5 - The Pergamean Church Age" (NO numbers, 167 rows), last row', 1390, () => rows(1390).slice(-1)[0]],
  ['one huge paragraph (6,276 characters)', 100, () => rows(100).find((r) => r.text.length > 6000)]
]
const lap = () => Date.now()
;(async () => {
  const results = []
  for (const [label, sid, getRow] of CASES) {
    const profile = path.join(base, 'run-' + sid + '-' + Math.abs(label.length))
    fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
    for (const f of ['sermons.db', 'library.db']) fs.copyFileSync(path.join(base, f), path.join(profile, f))
    const row = getRow(); const item = quoteToItem(toQuote(row, sid))
    const queue = [{ kind: 'quote', id: 'before', quote: { text: 'x', sermonTitle: 'Placeholder', dateCode: '00-0101', sermonId: 1, paragraphIndex: 0, paragraphRef: '1' }, slides: [{ text: 'Placeholder', marker: '1' }] }, item]
    fs.writeFileSync(path.join(profile, 'queue.json'), JSON.stringify(queue))
    const app = await launch({ profile, remotePort: 14344, mdns: 'born-remote-v1rp', port: 9374, settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
    const out = { label, slides: item.slides.length, firstMarker: item.slides[0].marker, ref: item.quote.paragraphRef }
    try {
      const p = await app.page(); await p.viewport(Math.round(+size[1] / +size[3]), Math.round(+size[2] / +size[3]), 1); await sleep(500)
      await p.ev('window.electronAPI.openStage()'); await sleep(500)
      const state = () => p.ev(`(()=>{const vh=innerHeight;const L=document.querySelector('.follow-list');const cards=[...document.querySelectorAll('.follow-para')];const vis=c=>{const r=c.getBoundingClientRect();return r.bottom>70&&r.top<vh-10};
        return {open:!!L,cards:cards.length,scrollTop:L?Math.round(L.scrollTop):null,scrollH:L?L.scrollHeight:null,
        marked:cards.filter(c=>/focus|on-screen/.test(c.className)).map(c=>c.querySelector('.follow-para-ref').textContent+(/on-screen/.test(c.className)?'*':'')),
        markedVisible:cards.filter(c=>/focus|on-screen/.test(c.className)&&vis(c)).map(c=>c.querySelector('.follow-para-ref').textContent),
        visibleRefs:cards.filter(vis).map(c=>c.querySelector('.follow-para-ref').textContent).slice(0,6)}})()`)
      const settle = async () => { let last = null, same = 0; const t0 = lap(); while (lap() - t0 < 15000) { const s = await state(); const key = s.open + ':' + s.scrollTop + ':' + s.cards; if (key === last) { if (++same >= 3) return { ms: lap() - t0 - 3 * 120, s } } else { same = 0; last = key } await sleep(120) } return { ms: 15000, s: await state() } }
      // (a) click the queued row (select, no projecting)
      const t0 = lap(); await p.ev(`document.querySelectorAll('.queue-row')[1].click()`); const a = await settle(); out.a_click_row = { ms: a.ms, ...a.s }
      // (b) show it
      const t1 = lap(); await p.ev(`document.querySelectorAll('.queue-row')[1].querySelector('.queue-row-actions .btn-quiet').click()`); await sleep(300); const b = await settle(); out.b_project = { ms: lap() - t1 - 360, ...b.s }
      // (c) Next, Next, Previous
      for (const [k, name] of [['ArrowRight', 'c_next'], ['ArrowRight', 'c_next2'], ['ArrowLeft', 'c_prev']]) { await p.ev(`(()=>{const f=document.activeElement;if(f&&f!==document.body)f.blur()})()`); await p.key(k); await sleep(400); const c = await settle(); out[name] = { ms: c.ms + 400, ...c.s } }
      // the queue is on the right the whole time: count of keystrokes/clicks
      out.actions = { toReach: 1, toShow: 1, nextPrev: 1, backToQueue: 0 }
    } catch (e) { out.error = String(e).slice(0, 200) }
    finally { await app.kill() }
    results.push(out)
    const fmt = (x) => x ? `${x.ms}ms lands scrollTop=${x.scrollTop}/${x.scrollH} marked=[${x.marked}] markedInView=[${x.markedVisible}] viewShows=[${x.visibleRefs}]` : 'n/a'
    console.log(`\n== ${label} (item has ${out.slides} slide(s), first marker ${out.firstMarker}, ref ${out.ref})`)
    console.log('  a click row  :', fmt(out.a_click_row)); console.log('  b Project    :', fmt(out.b_project)); console.log('  c Next       :', fmt(out.c_next)); console.log('  c Next again :', fmt(out.c_next2)); console.log('  c Previous   :', fmt(out.c_prev))
    if (out.error) console.log('  ERROR', out.error)
  }
  if (outJson) fs.writeFileSync(outJson, JSON.stringify(results, null, 1))
})().catch((e) => { console.error(e); process.exit(2) })
