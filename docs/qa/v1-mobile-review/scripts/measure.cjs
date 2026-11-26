/* Sizes and reach on every phone screen: 360x640, 390x844 and 768x1024, at 100 % and at 150 % page zoom, in Chromium and WebKit, for each role.
 * Per screen: sideways scrolling, controls off the screen, controls under 44 CSS px, labels cut off, text under 12 px, where the most used
 * controls sit (Back, Next, Hide screen, Project), and the contrast of the words that say what is live.
 * The phone page has no Text size setting of its own; 150 % page zoom stands in for larger text (a phone's own Larger Text needs a real phone).
 * Usage: PW_DIR=/tmp/born-pw node docs/qa/v1-mobile-review/scripts/measure.cjs [outDir]   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const H = require('./harness.cjs')
const { V, sleep } = H
const out = process.argv[2] || path.join(__dirname, '..', 'evidence')
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',')
const SIZES = [[360, 640], [390, 844], [768, 1024]]
const ROLES = ['Operator', 'Song Leader', 'Preacher']

const MEASURE = () => {
  const W = innerWidth, Hh = innerHeight
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0 }
  const name = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase()) + ' "' + ((e.getAttribute('aria-label') || e.innerText || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 18)) + '"'
  const inScroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true } return false }
  const onTop = (e) => { const b = e.getBoundingClientRect(); const t = document.elementFromPoint(Math.min(W - 1, Math.max(0, b.left + b.width / 2)), Math.min(Hh - 1, Math.max(0, b.top + b.height / 2))); return !!t && (t === e || e.contains(t) || t.contains(e)) }
  const r = { hscroll: document.documentElement.scrollWidth > W + 1, offscreen: [], small: [], cut: [], tiny: [], reach: {}, contrast: [] }
  for (const e of [...document.querySelectorAll('button,a[href],input,select,textarea,[onclick]')].filter(vis)) {
    const b = e.getBoundingClientRect()
    if (!inScroller(e) && (b.right > W + 1 || b.left < -1)) r.offscreen.push(name(e))
    if (b.bottom <= 0 || b.top >= Hh || !onTop(e)) continue
    if (Math.min(b.width, b.height) < 43.5 && e.tagName !== 'INPUT' && !e.disabled) r.small.push(name(e).replace(/"[^"]*"$/, (m) => /azstrip|chapter-chip|book-chip|key-chip|jumpchips/.test(e.parentElement.className) ? '"…"' : m) + ` ${Math.round(b.width)}x${Math.round(b.height)}` + (e.parentElement.className ? ' in .' + String(e.parentElement.className).split(' ')[0] : ''))
    if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).textOverflow !== 'ellipsis') r.cut.push(name(e))
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const seen = new Set()
  for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || seen.has(el) || !n.textContent.trim() || !vis(el)) continue; seen.add(el); const b = el.getBoundingClientRect(); if (b.bottom <= 0 || b.top >= Hh) continue; const f = parseFloat(getComputedStyle(el).fontSize); if (f < 12) r.tiny.push(name(el) + ' ' + f + 'px') }
  // where the most used controls sit: 0 = top of the screen, 1 = bottom
  for (const [k, sel] of [['back', '#prev-p, .transport-inline .btn-prev'], ['next', '#next-p, .transport-inline .btn-next'], ['hide', '#blank-p, #blank-t'], ['project', '.btn-project']]) {
    const e = [...document.querySelectorAll(sel)].find(vis); if (!e) continue
    const b = e.getBoundingClientRect(); r.reach[k] = { y: +((b.top + b.height / 2) / Hh).toFixed(2), size: `${Math.round(b.width)}x${Math.round(b.height)}`, onTop: onTop(e) }
  }
  // contrast of the words that say what is live or queued
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
  const blend = (fg, bg) => { const a = fg.match(/[\d.]+/g).map(Number), b = bg.match(/[\d.]+/g).map(Number); const al = a.length > 3 ? a[3] : 1; return `rgb(${[0, 1, 2].map((i) => Math.round(a[i] * al + b[i] * (1 - al))).join(',')})` }
  const bgOf = (e) => { const stack = []; for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { stack.push(c); if (!/rgba\(/.test(c) || +c.match(/[\d.]+/g)[3] === 1) break } } let bg = 'rgb(13,17,23)'; for (const c of stack.reverse()) bg = blend(c, bg); return bg }
  for (const sel of ['.now-label', '.live-tag', '.qkind', '.livebar-ref', '.conn .connLabel', '.now-flag', '.qstrip-kind', '.next-label-lg', '.slide-label']) {
    const e = [...document.querySelectorAll(sel)].find((x) => vis(x) && x.getBoundingClientRect().top < Hh && onTop(x)); if (!e) continue
    const fg = getComputedStyle(e).color, bg = bgOf(e); const l1 = lum(blend(fg, bg)), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    r.contrast.push({ sel, text: e.innerText.trim().slice(0, 20), size: parseFloat(getComputedStyle(e).fontSize), ratio: +ratio.toFixed(2) })
  }
  for (const k of ['offscreen', 'small', 'cut', 'tiny']) r[k] = [...new Set(r[k])]
  return r
}

// each screen: [name, how to get there]
const SCREENS = [
  ['queue-live', async (p) => { await H.tapTab(p, 'queue') }],
  ['queue-full-page', async (p) => { await H.openSong(p, 'queue', 'Morning Song') }],
  ['queue-full-list', async (p) => { await p.evaluate(() => { closeSheet(); state.detailIndex = null; openViewAllQueueSheet() }) }],
  ['queue-edit', async (p, role) => { await p.evaluate(() => closeSheet()); if (role === 'Operator') await p.evaluate(() => { state.queueEditMode = true; renderQueueTab() }) }],
  ['my-list', async (p) => { await p.evaluate(() => { state.queueEditMode = false; renderQueueTab(); openDraftSheet() }) }],
  ['sermons', async (p) => { await p.evaluate(() => closeSheet()); await H.tapTab(p, 'sermons') }],
  ['bible-books', async (p) => { await H.tapTab(p, 'bible'); await p.evaluate(() => { state.bibleView = 'grid'; renderBibleTab() }) }],
  ['bible-chapters', async (p) => { await p.evaluate(() => pickBook(19)) }],
  ['bible-verses', async (p) => { await p.evaluate(() => pickChapter(23)); await sleep(900) }],
  ['bible-passage-page', async (p) => { await p.evaluate(() => selectVerse(1)); await sleep(900) }],
  ['songs', async (p) => { await p.evaluate(() => closeSheet()); await H.tapTab(p, 'songs'); await sleep(600) }],
  ['song-page', async (p) => { await p.evaluate((id) => selectSongById(id), p.ids['River Song']); await sleep(900) }],
  ['set-key', async (p) => { await p.evaluate(() => openKeyPickerSheet()); await sleep(900) }],
  ['long-song-page', async (p) => { await p.evaluate((id) => { closeSheet(); selectSongById(id) }, p.ids['The Long Road Song']); await sleep(900) }]
]

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const env = await H.start()
  const rows = []
  try {
    await H.reset()
    for (const t of ['Morning Song', 'Evening Song', 'River Song', 'The Long Road Song']) await H.cmd({ action: 'queue-song', songId: env.ids[t] })
    await H.cmd({ action: 'queue-bible', reference: 'John 3:16-17', translation: 'KJV' }); await sleep(1300)
    const s = await H.server(); await H.cmd({ action: 'project', id: s.ids[0] }); await sleep(1000)
    for (const eng of ENGINES) for (const [w, h] of SIZES) for (const zoom of [1, 1.5]) for (const role of ROLES) {
      if (role !== 'Operator' && (zoom !== 1 || eng !== ENGINES[0])) continue // the roles differ only in the queue header
      const page = await H.phone({ engine: eng, size: [Math.round(w / zoom), Math.round(h / zoom)], role }); page.ids = env.ids
      for (const [name, go] of SCREENS) {
        if (role !== 'Operator' && !/^queue/.test(name)) continue
        try { await go(page, role); await sleep(500); rows.push({ eng, size: `${w}x${h}`, zoom, role, screen: name, ...(await page.evaluate(MEASURE)) }) } catch (e) { rows.push({ eng, size: `${w}x${h}`, zoom, role, screen: name, error: String(e.message || e).split('\n')[0].slice(0, 120) }) }
        if (eng === ENGINES[0] && role === 'Operator' && zoom === 1 && w === 390 && process.env.SHOTS && process.env.SHOTS.split(',').includes(name)) await page.screenshot({ path: path.join(out, `screen-${name}.png`), scale: 'css' })
      }
      await page.context().close()
    }
  } finally {
    // one line per kind of problem, with where it was seen
    const tally = {}
    const add = (kind, what, r) => { const k = kind + ' | ' + what.replace(/ \d+x\d+/, '').replace(/chip "\d+"/, 'chip "n"'); (tally[k] = tally[k] || { sizes: new Set(), where: new Set(), n: 0 }); tally[k].n++; tally[k].where.add(`${r.size}@${r.zoom * 100}`); const m = / (\d+x\d+)/.exec(what); if (m) tally[k].sizes.add(m[1]) }
    for (const r of rows) { if (r.error) { add('error', r.screen + ': ' + r.error, r); continue } if (r.hscroll) add('sideways scroll', r.screen, r); for (const k of ['offscreen', 'small', 'cut', 'tiny']) for (const x of r[k]) add(k, r.screen.replace(/-.*/, '') + ': ' + x, r) }
    const summary = Object.entries(tally).map(([k, v]) => ({ problem: k, drawnAt: [...v.sizes].slice(0, 6).join(' '), seenAt: [...v.where].join(' '), times: v.n })).sort((a, b) => a.problem.localeCompare(b.problem))
    const reach = rows.filter((r) => !r.error && r.eng === ENGINES[0] && r.zoom === 1 && r.role === 'Operator' && ['queue-live', 'queue-full-page', 'song-page', 'songs'].includes(r.screen)).map((r) => ({ size: r.size, screen: r.screen, ...r.reach }))
    const contrast = {}; for (const r of rows) if (!r.error) for (const x of r.contrast) { const k = x.sel + ' "' + x.text.replace(/\d+/g, 'n') + '"'; if (!contrast[k] || x.ratio < contrast[k].ratio) contrast[k] = { ratio: x.ratio, size: x.size } }
    fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify({ screensMeasured: rows.length, summary, reach, contrast }, null, 1))
    console.log(`measure: ${rows.length} screens measured, ${summary.length} kinds of problem`)
    for (const srow of summary) console.log(`  ${srow.problem}  [${srow.drawnAt}]  at ${srow.seenAt}`)
    await H.closeBrowsers(); await env.kill()
  }
})()
