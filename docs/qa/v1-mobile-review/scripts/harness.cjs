/* Phone review harness (scripts only, never shipped). Starts BORN on an isolated profile and its own ports, fills it with invented songs,
 * opens the congregation screen (kept hidden by scripts/qa/hide-outputs.cjs) and hands out phone pages in real browsers.
 * Needs `npm run build` and Playwright in PW_DIR (default /tmp/born-pw). Never uses the default ports or the real data folder. */
const fs = require('fs'), path = require('path'), os = require('os')
const QA = path.join(__dirname, '..', '..', '..', '..', 'scripts', 'qa')
const { launch, sleep, checks } = require(path.join(QA, 'lib.cjs'))
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), CDP = Number(process.env.CDP_PORT || 9376)
const BASE = `http://127.0.0.1:${PORT}`

// invented words only
const verse = (name, n) => `${name} verse ${n} line one of our own\nA second line we made up for ${name}\nA third line to fill the page\nAnd a last line for verse ${n}`
const song = (name, verses) => Array.from({ length: verses }, (_, i) => verse(name, i + 1)).join('\n\n')
const SONGS = [['Morning Song', 3], ['Evening Song', 4], ['River Song', 3], ['The Long Road Song', 30]]

// sermon words and titles never go into the evidence: a sermon page is recorded as a short mark that still lets two sides be compared
const MASK = `(kind, text) => { if (!text) return text; if (kind === 'song' || kind === 'bible') return text; const t = String(text).replace(/\\s+/g, ' ').trim().slice(0, 24); let h = 0; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return '(sermon paragraph ' + h.toString(36) + ')' }`
const mask = eval(MASK)
const j = (u) => fetch(BASE + u).then((r) => r.json())
const cmd = (b) => fetch(BASE + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.status)
/** what the computer reports as live and queued, in one short line's worth */
async function server() {
  const s = await j('/state')
  const a = s.activeIndex == null ? null : s.queue[s.activeIndex]
  return { queue: s.queue.map((q) => q.title), ids: s.queue.map((q) => q.id), activeIndex: s.activeIndex, activeTitle: a ? a.title : null, activeSlide: s.activeSlide, blanked: s.blanked, onScreen: s.onScreen ? mask(s.onScreen.kind, (s.onScreen.text || '').split('\n')[0]) : null, raw: s }
}
/** what the phone is showing and what its own script believes */
const PHONE_VIEW = (MASK) => {
  const mask = eval(MASK), liveKind = state.qs.onScreen ? state.qs.onScreen.kind : null
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' }
  const txt = (e) => (e ? (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ') : '')
  const ov = document.getElementById('sheetOverlay'), sheet = document.getElementById('sheetBody')
  const sheetOpen = ov.classList.contains('active')
  const tablet = isTabletLayout()
  const pane = document.getElementById('tabletPreview')
  const nowEl = [...document.querySelectorAll('.now-card.perf .now-text, .preview-now .now-text')].find(vis)
  const top = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.sheet') ? 'sheet' : e.closest('.sheet-overlay') ? 'overlay' : e.closest('.transport,.transport-inline') ? 'transport' : e.tagName.toLowerCase()) : null }
  const nextBtn = [...document.querySelectorAll('#next-p, .transport-inline .btn-next')].find(vis)
  const nb = nextBtn ? nextBtn.getBoundingClientRect() : null
  return {
    layout: tablet ? 'tablet' : 'phone', tab: state.tab,
    sheetOpen, sheetDetail: ov.classList.contains('detail-mode'), sheetTitle: sheetOpen ? (state.tab === 'sermons' || (state.selected && state.selected.kind === 'sermon') ? '(a sermon)' : txt(sheet.querySelector('.sheet-title'))) : null,
    sheetRows: sheetOpen ? sheet.querySelectorAll('.slide-row').length : 0,
    sheetLive: sheetOpen ? txt(sheet.querySelector('.slide-row.live .slide-text')).slice(0, 40) : null,
    paneKind: tablet ? (pane.querySelector('.preview-now') ? 'now-next' : pane.querySelector('.slide-list') ? 'full-item' : pane.querySelector('.preview-empty') ? 'empty' : 'other') : null,
    paneTitle: tablet ? txt(pane.querySelector('.sheet-title')) : null,
    paneLive: tablet ? txt(pane.querySelector('.slide-row.live .slide-text')).slice(0, 40) : null,
    nowText: nowEl ? (liveKind === 'song' || liveKind === 'bible' ? txt(nowEl).slice(0, 40) : mask(liveKind, txt(nowEl))) : null,
    nextReachable: nb ? top(nb.left + nb.width / 2, nb.top + nb.height / 2) === 'transport' : false,
    toast: vis(document.getElementById('toast')) ? txt(document.getElementById('toast')) : null,
    conn: state.connOk, own: { detailIndex: state.detailIndex, detailId: state.detailId || null, selected: state.selected ? (state.selected.kind === 'sermon' ? '(a sermon)' : state.selected.title) : null, activeIndex: state.qs.activeIndex, activeSlide: state.qs.activeSlide, onScreen: state.qs.onScreen ? mask(liveKind, state.qs.onScreen.text.split('\n')[0]) : null }
  }
}
const view = (page) => page.evaluate(PHONE_VIEW, MASK)

async function start(o = {}) {
  const profile = o.profile || path.join(os.tmpdir(), 'born-mobile-review-profile-' + PORT)
  if (!o.keepProfile) fs.rmSync(profile, { recursive: true, force: true })
  fs.mkdirSync(profile, { recursive: true })
  if (!fs.existsSync(path.join(profile, 'settings.json'))) fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ theme: 'dark' }))
  const app = await launch({ profile, remotePort: PORT, port: CDP, mdns: 'born-remote-mobile-review-' + PORT, settle: 8000, extraArgs: ['--require', path.join(QA, 'hide-outputs.cjs')] })
  const p = await app.page()
  const ids = {}
  if (!o.keepProfile) {
    for (const [name, n] of SONGS) {
      const parsed = await p.ev(`window.electronAPI.parsePastedText(${JSON.stringify(song(name, n))}, ${JSON.stringify(name)})`)
      const one = Array.isArray(parsed) ? parsed[0] : parsed && parsed.song ? parsed.song : parsed
      await p.ev(`window.electronAPI.commitReviewedSong(${JSON.stringify(one)})`)
    }
  }
  for (const [name] of SONGS) { const r = await j('/api/search/songs?q=' + encodeURIComponent(name)); const hit = r.find((s) => s.title === name); if (hit) ids[name] = hit.id }
  await p.ev('window.electronAPI.openProjection()'); await sleep(2500)
  return { app, p, ids, profile, kill: () => app.kill() }
}

const browsers = {}
async function phone(o = {}) {
  const eng = o.engine || 'chromium'
  browsers[eng] = browsers[eng] || await pw[eng].launch()
  const [w, h] = o.size || [390, 844]
  const ctx = await browsers[eng].newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: eng === 'chromium', hasTouch: true, serviceWorkers: 'block' })
  await ctx.addInitScript((role) => { try { localStorage.setItem('born-remote-a2hs-dismissed', '1'); if (role) localStorage.setItem('born-remote-contributor-label', role); else if (role === '') localStorage.setItem('born-remote-role-dismissed', '1') } catch (_) {} }, o.role === undefined ? 'Operator' : o.role)
  const page = await ctx.newPage()
  page.errs = []; page.on('pageerror', (e) => page.errs.push(String(e).slice(0, 200)))
  await page.goto(BASE + '/'); await page.waitForFunction(() => typeof setTab === 'function' && state.connOk === true, null, { timeout: 20000 })
  await sleep(600)
  return page
}
async function closeBrowsers() { for (const k of Object.keys(browsers)) { await browsers[k].close().catch(() => {}); delete browsers[k] } }
/** nothing queued, nothing live */
async function reset() { await cmd({ action: 'new-service' }); await cmd({ action: 'unblank' }); await sleep(700) }

const V = (sel) => `${sel} >> visible=true`
async function tapTab(page, tab) { await page.locator(V(`.tab[data-tab="${tab}"], .sidebar-tab[data-tab="${tab}"]`)).first().tap(); await sleep(500) }
/** open a song's full page the way a person does: 'search' (Songs, type, tap the result), 'recent' (Recently played) or 'queue' (its queue row) */
async function openSong(page, how, title) {
  const tablet = await page.evaluate(() => isTabletLayout())
  if (how === 'queue') {
    await tapTab(page, 'queue')
    await page.locator(V(tablet ? '#tabletList .qitem' : '.qstrip-card')).filter({ hasText: title }).first().tap()
  } else {
    await tapTab(page, 'songs')
    if (how === 'recent') await page.locator(V('.recent-item')).filter({ hasText: title }).first().tap()
    else { await page.locator(V('#songInput, #songInputT')).first().fill(title.replace(/ Song$/, '')); await sleep(900); await page.locator(V('.song-row')).filter({ hasText: title }).first().tap() }
  }
  await sleep(700)
}
/** the phone is on the live view: the Queue tab, nothing over it, now/next showing */
const onLiveView = (v) => v.tab === 'queue' && !v.sheetOpen && (v.layout === 'phone' ? !!v.nowText : v.paneKind === 'now-next')
const where = (v) => v.layout === 'phone' ? `tab ${v.tab}, ${v.sheetOpen ? 'full page open "' + v.sheetTitle + '"' : 'no page over it'}, Next ${v.nextReachable ? 'reachable' : 'covered'}` : `tab ${v.tab}, right pane ${v.paneKind}${v.paneTitle ? ' "' + v.paneTitle + '"' : ''}`
/** every message the phone shows from now until stop() is called */
function toasts(page) { const seen = []; const t = setInterval(() => page.evaluate(() => { const e = document.getElementById('toast'); return e && e.style.display === 'block' ? e.textContent : null }).then((x) => { if (x && !seen.includes(x)) seen.push(x) }).catch(() => {}), 200); return () => { clearInterval(t); return seen.join(' / ') } }
module.exports = { toasts, V, tapTab, openSong, onLiveView, where, start, phone, view, server, cmd, j, reset, closeBrowsers, sleep, checks, BASE, PORT, SONGS, pw }
