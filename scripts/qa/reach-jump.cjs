/* The reader is already open at the top of a long sermon; the operator clicks a queued row far down the SAME sermon, then Projects it. How long does the reader take to get
 * there, and is the queued / live paragraph in view when it settles? Real app, screens on but hidden.   Usage: node scripts/qa/reach-jump.cjs <profileDir> [WxH@scale] */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process')
const { launch, sleep } = require('./lib.cjs')
const { DatabaseSync } = require('node:sqlite')
const base = process.argv[2], size = (process.argv[3] || '1366x768@1').match(/(\d+)x(\d+)@([\d.]+)/)
const ROOT = path.join(__dirname, '..', '..')
execSync(`npx esbuild ${path.join(ROOT, 'src/shared/queueItem.ts')} --bundle --platform=node --format=cjs --outfile=${path.join(base, 'queueItem.cjs')} --log-level=error`, { cwd: ROOT })
const { quoteToItem } = require(path.join(base, 'queueItem.cjs'))
const sdb = new DatabaseSync(path.join(base, 'sermons.db'), { readOnly: true })
const rows = sdb.prepare('select p.id,p.paragraph_ref ref,p.text,s.title,s.date_code dc from paragraphs p join sermons s on s.id=p.sermon_id where p.sermon_id=711 order by p.id').all()
const mk = (r) => quoteToItem({ text: r.text, sermonTitle: r.title, dateCode: r.dc, sermonId: 711, paragraphIndex: 0, paragraphRef: r.ref, matchType: 'phrase' })
;(async () => {
  const profile = path.join(base, 'run-jump'); fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  for (const f of ['sermons.db', 'library.db']) fs.copyFileSync(path.join(base, f), path.join(profile, f))
  fs.writeFileSync(path.join(profile, 'queue.json'), JSON.stringify([mk(rows[3]), mk(rows.find((r) => r.ref === '396-399'))]))
  const app = await launch({ profile, remotePort: 14345, mdns: 'born-remote-v1rj', port: 9375, settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  try {
    const p = await app.page(); await p.viewport(Math.round(+size[1] / +size[3]), Math.round(+size[2] / +size[3]), 1); await sleep(500)
    const st = () => p.ev(`(()=>{const vh=innerHeight,L=document.querySelector('.follow-list'),cards=[...document.querySelectorAll('.follow-para')],vis=c=>{const r=c.getBoundingClientRect();return r.bottom>70&&r.top<vh-10};return {top:L?Math.round(L.scrollTop):null,marked:cards.filter(c=>/focus|on-screen/.test(c.className)).map(c=>c.querySelector('.follow-para-ref').textContent+(/on-screen/.test(c.className)?'*':'')),markedInView:cards.filter(c=>/focus|on-screen/.test(c.className)&&vis(c)).map(c=>c.querySelector('.follow-para-ref').textContent)}})()`)
    const track = async (label, act, ms = 6000) => { const t0 = Date.now(); await act(); let last = -1, stable = 0, firstMove = null, s; while (Date.now() - t0 < ms) { s = await st(); if (firstMove === null && s.top !== null && s.top !== last && last !== -1) firstMove = Date.now() - t0; if (s.top === last) { if (++stable >= 6) break } else stable = 0; last = s.top; await sleep(100) } console.log(`${label}: settled after ${Date.now() - t0 - 600}ms at scrollTop=${s.top}; marked=[${s.marked}] markedInView=[${s.markedInView}]`); return s }
    await track('click the FIRST queued row (opens the reader at the top of the sermon)', () => p.ev(`document.querySelectorAll('.queue-row')[0].click()`))
    await track('click the far-down queued row (¶396-399) while the reader is open', () => p.ev(`document.querySelectorAll('.queue-row')[1].click()`), 20000)
    await track('Project the far-down row (screens open for the first time)', () => p.ev(`document.querySelectorAll('.queue-row')[1].querySelector('.queue-row-actions .btn-quiet').click()`), 12000)
    await sleep(3000); const s = await st(); console.log('3s later: scrollTop=' + s.top + '; marked=[' + s.marked + '] markedInView=[' + s.markedInView + ']')
    await track('Next', async () => { await p.ev(`(()=>{const f=document.activeElement;if(f&&f!==document.body)f.blur()})()`); await p.key('ArrowRight') }, 6000)
    p.close()
  } finally { await app.kill() }
})().catch((e) => { console.error(e); process.exit(2) })
