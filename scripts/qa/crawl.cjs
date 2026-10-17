#!/usr/bin/env node
/* Phase 1, source B: the runtime crawl. Opens everything reachable in a running BORN (rail sections, tabs, menus, popovers, dialogs) by breadth-first clicking from a fresh page load,
 * skipping anything that would open a native picker, delete data, or put something on a screen. Records each distinct surface (signature + path), its visible texts and (locally) a screenshot.
 *   node scripts/qa/crawl.cjs <profileDir> [port] [maxStates] [depth]      -> qa-out/census-runtime-<name>.json
 */
const fs = require('fs'), path = require('path')
const { launch, sleep, ROOT } = require('./lib.cjs')
const [profile = '/tmp/qa-populated', port = '9961', maxStates = '260', maxDepth = '3', start = ''] = process.argv.slice(2)
const name = path.basename(profile) + (start ? '-' + start.toLowerCase().replace(/\W+/g, '') : '')
const RAIL = ['Sermons', 'Bible', 'Songs', 'Media', 'Saved', 'Tape', 'Queue']
const GLOBAL = /^(born again|back|forward|search everything|screens|open projection|remote|settings and help|app info|file|run view|is tonight ready)/i // header/rail/dock: explored once, by the HOME crawl
const SKIP = /(^|\s)(remove|delete|clear|forget|reset|quit|exit|close projection|open projection|show|hide screen|blackout|unlink|purge|empty|discard|restore defaults|new service|uninstall|restart|relaunch|install|update now)\b|open [a-z ]*folder|reveal|show in finder|show in folder|go live|take\b|project\b|stop indexing|re-?index/i // native dialogs answer 'cancel' by themselves in a QA launch (BORN_TEST_AUTO_CANCEL_DIALOGS)
const CANDS = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth }
  const out = []
  document.querySelectorAll('button,[role=tab],[role=menuitem],summary,[role=button],[aria-haspopup],[role=switch],[role=radio],[role=option]').forEach((e) => {
    if (!vis(e) || e.disabled || e.getAttribute('aria-disabled') === 'true') return
    const label = ((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || e.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 60)
    if (!label) return
    const inDialog = !!e.closest('[role=dialog],[role=menu],.modal,.popover,[class*=popover]')
    out.push({ label, role: e.getAttribute('role') || e.tagName.toLowerCase(), inDialog })
  })
  const seen = new Set(); return out.filter((c) => { const k = c.role + '|' + c.label; if (seen.has(k)) return false; seen.add(k); return true })
})()`
const SIG = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const q = (s) => [...document.querySelectorAll(s)].filter(vis)
  const heads = q('h1,h2,h3,h4,[role=dialog] [role=heading]').map((h) => h.innerText.trim().slice(0, 40)).slice(0, 14)
  const tabs = q('[role=tab][aria-selected=true]').map((t) => t.innerText.trim())
  const rail = q('[aria-current=page],[aria-current=true]').map((t) => (t.getAttribute('aria-label') || t.innerText).trim().slice(0, 20)).slice(0, 4)
  const pop = q('[role=dialog],[role=menu],[role=listbox],.modal,[class*=popover]').map((d) => (d.getAttribute('aria-label') || d.className.toString().slice(0, 30) || d.tagName))
  const ctl = [...new Set(q('button,[role=tab],[role=menuitem],input,select,textarea,summary').map((c) => ((c.getAttribute('aria-label') || c.innerText || c.placeholder || '') + '').replace(/[0-9]+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 28)).filter(Boolean))].sort().join('|')
  let h = 0; for (const ch of ctl) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return JSON.stringify({ heads, tabs, rail, pop, ctl: h })
})()`
const DOMHASH = `(() => { const t = document.body.innerText + '|' + document.getElementsByTagName('*').length + '|' + [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-selected],[aria-checked]')].map((e) => e.getAttribute('aria-pressed') + e.getAttribute('aria-expanded') + e.getAttribute('aria-selected') + e.getAttribute('aria-checked')).join(''); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h })()`
const TEXTS = `(() => { const t = new Set(); const add = (s) => { s = (s || '').replace(/\\s+/g, ' ').trim().toLowerCase(); if (s && s.length < 160) t.add(s) }
  document.querySelectorAll('*').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; ['aria-label', 'title', 'placeholder'].forEach((a) => add(e.getAttribute(a))); if (e.children.length === 0) add(e.textContent) })
  return [...t] })()`

;(async () => {
  const app = await launch({ profile, port: +port, remotePort: 4370 + (+port % 30), mdns: 'born-qa-crawl' })
  const page = await app.page()
  await page.viewport(1366, 768)
  const shotDir = path.join(ROOT, 'qa-out', 'crawl-' + name); fs.mkdirSync(shotDir, { recursive: true })
  const dead = [] // clicks after which nothing on the page changed (candidates for "dead button", reviewed by hand)
  const states = new Map() // sig -> {id, path, texts, depth}
  const allTexts = new Set(); const skipped = new Set(); const errors = []
  const reset = async () => { await page.send('Page.reload'); await sleep(1300) }
  const replay = async (p) => { for (const c of p) { const ok = await page.click(c.label.split(' ').slice(0, 5).join(' ')); if (!ok) return false; await sleep(450) } return true }
  const record = async (pth, depth) => {
    const sig = await page.ev(SIG)
    if (states.has(sig)) return { sig, isNew: false }
    const texts = await page.ev(TEXTS); texts.forEach((t) => allTexts.add(t))
    const id = 'S' + String(states.size + 1).padStart(3, '0')
    states.set(sig, { id, sig: JSON.parse(sig), path: pth.map((c) => c.label), depth, texts: texts.length })
    try { await page.shot(path.join(shotDir, id + '.png')) } catch { /* ok */ }
    return { sig, isNew: true }
  }
  await reset(); await record([], 0)
  const first = start && start !== 'HOME' ? [{ label: start, role: 'button' }] : []
  if (first.length) { await page.click(start); await sleep(500); await record(first, 1) }
  const queue = [first]
  let n = 0
  while (queue.length && states.size < +maxStates) {
    const pth = queue.shift(); const depth = pth.length
    await reset(); if (!(await replay(pth))) continue
    const cands = JSON.parse(JSON.stringify(await page.ev(CANDS))).slice(0, 45)
    const parentSig = await page.ev(SIG)
    let dirty = false
    for (const c of cands) {
      if (states.size >= +maxStates) break
      const key = c.role + '|' + c.label
      if (SKIP.test(c.label.toLowerCase())) { skipped.add(c.label); continue }
      if (start && (depth === 0 || (depth === 1 && !first.length)) && RAIL.some((r) => c.label.startsWith(r)) && start !== 'HOME' ) continue
      if (start === 'HOME' && RAIL.some((r) => c.label.startsWith(r)) ) continue
      if (start && start !== 'HOME' && GLOBAL.test(c.label)) continue
      if (start === 'HOME' && depth >= 1 && !c.inDialog) continue // HOME: the global controls and what they open
      if (dirty) { await reset(); if (!(await replay(pth))) break; dirty = false }
      const before = await page.ev(DOMHASH)
      const ok = await page.click(c.label.split(' ').slice(0, 5).join(' '))
      if (!ok) continue
      await sleep(450); n++
      if ((await page.ev(DOMHASH)) === before && !/^(Search|Hide browse columns)/.test(c.label)) dead.push([...pth, c].map((x) => x.label).join(' > '))
      const r = await record([...pth, c], depth + 1)
      if ((await page.ev(SIG)) !== parentSig) dirty = true
      for (const l of page.takeLogs()) errors.push({ at: [...pth, c].map((x) => x.label).join(' > '), ...l })
      if (r.isNew && depth + 1 < +maxDepth) queue.push([...pth, c])
    }
  }
  const out = { profile: name, states: [...states.values()], texts: [...allTexts], skipped: [...skipped].sort(), errors, clicks: n, noEffect: dead }
  fs.writeFileSync(path.join(ROOT, 'qa-out', `census-runtime-${name}.json`), JSON.stringify(out, null, 1))
  console.log(`states ${states.size} · clicks ${n} · texts ${allTexts.size} · skipped labels ${skipped.size} · logged issues ${errors.length}`)
  page.close(); await app.kill()
})().catch((e) => { console.error(e); process.exit(1) })
