(async () => {
  /* Injected into a page by sweep.cjs. Returns an array of findings: { check, sev, sel, text, detail }. P0 = breaks use, P1 = confusing/blocks/accessibility, P2 = polish. */
  const F = []
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.01 }
  const sel = (e) => { const p = []; let n = e; while (n && n.nodeType === 1 && p.length < 4) { let t = n.tagName.toLowerCase(); if (n.id) { t += '#' + n.id; p.unshift(t); break } const c = (n.className && n.className.toString().split(/\s+/).filter(Boolean)[0]) || ''; if (c) t += '.' + c; p.unshift(t); n = n.parentElement } return p.join(' > ') }
  const txt = (e) => ((e.getAttribute && e.getAttribute('aria-label')) || e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const add = (check, sev, e, detail) => F.push({ check, sev, sel: sel(e), text: txt(e), detail: detail || '' })
  const hiddenOnPurpose = (e) => { if (e.closest('.sr-only,.skip-links,.visually-hidden,[data-qa-ignore]')) return true; const r = e.getBoundingClientRect(); return r.width <= 2 || r.height <= 2 }
  const all = [...document.querySelectorAll('body *')].filter((e) => vis(e) && !hiddenOnPurpose(e))
  // a scroll container / clipped region ancestor
  const clipsAncestor = (e) => { let n = e.parentElement; while (n && n !== document.body) { const s = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) return n; n = n.parentElement } return null }

  // 1. page-level overflow
  const de = document.documentElement
  if (de.scrollWidth > innerWidth + 1) F.push({ check: 'page-h-scroll', sev: 'P1', sel: 'html', text: '', detail: `scrollWidth ${de.scrollWidth} > ${innerWidth}` })
  // 2. elements that run past the viewport and are not clipped by a scroller
  const vr0 = (e) => { const r = e.getBoundingClientRect(); let l = r.left, rr = r.right; let n = e.parentElement; while (n && n !== document.body) { const st = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(st.overflowX)) { const p = n.getBoundingClientRect(); l = Math.max(l, p.left); rr = Math.min(rr, p.right) } n = n.parentElement } return rr - l }
  for (const e of all) {
    if (vr0(e) <= 2) continue
    const r = e.getBoundingClientRect()
    if ((r.right > innerWidth + 2 || r.left < -2) && r.width < innerWidth * 1.2 && !clipsAncestor(e) && getComputedStyle(e).position !== 'fixed') add('outside-viewport', 'P1', e, `left ${Math.round(r.left)} right ${Math.round(r.right)} of ${innerWidth}`)
  }
  // 3. text that overflows its box without ellipsis, or is ellipsised with no tooltip; clipped content
  for (const e of all) {
    if (!e.childNodes.length || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue
    const s = getComputedStyle(e)
    const ov = e.scrollWidth - e.clientWidth
    if (ov > 2 && e.clientWidth > 0) {
      if (s.textOverflow === 'ellipsis' && s.overflowX !== 'visible') { if (!e.title && !e.getAttribute('aria-label') && !e.closest('[title]')) add('truncated-no-tooltip', 'P2', e, `hidden ${ov}px`) }
      else if (s.overflowX === 'hidden' || s.overflowX === 'clip') add('text-clipped', 'P1', e, `hidden ${ov}px, no ellipsis`)
      else if (s.overflowX === 'visible' && vr0(e) > 2 && e.getBoundingClientRect().right > (e.parentElement ? e.parentElement.getBoundingClientRect().right + 2 : 1e9) && s.whiteSpace !== 'normal') add('text-spills-out', 'P1', e, `by ${ov}px`)
    }
    const ovy = e.scrollHeight - e.clientHeight
    if (ovy > 3 && /(hidden|clip)/.test(s.overflowY) && s.textOverflow !== 'ellipsis' && !/-webkit-box/.test(s.display)) add('text-clipped-v', 'P1', e, `hidden ${ovy}px`)
  }
  // the part of an element that can really be seen: cut by every scrolling / clipping ancestor
  const vrect = (e) => { const r = e.getBoundingClientRect(); let l = r.left, t = r.top, rr = r.right, b = r.bottom; let n = e.parentElement; while (n && n !== document.body) { const st = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(st.overflowX + st.overflowY)) { const p = n.getBoundingClientRect(); l = Math.max(l, p.left); t = Math.max(t, p.top); rr = Math.min(rr, p.right); b = Math.min(b, p.bottom) } n = n.parentElement } return { left: l, top: t, right: rr, bottom: b } }
  // a floating layer (drawer, popover, dialog): something sitting on top of the page on purpose
  const floats = (e) => { let n = e; while (n && n !== document.body) { const st = getComputedStyle(n); if (st.position === 'fixed' || (st.position === 'absolute' && parseInt(st.zIndex || '0') >= 10)) return true; n = n.parentElement } return false }
  // 4. overlapping interactive elements (not nested)
  const inter = all.filter((e) => e.matches('button,a[href],input,select,textarea,[role=button],[role=tab],[role=switch],[role=menuitem]')).slice(0, 400)
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
    const a = inter[i], b = inter[j]; if (a.contains(b) || b.contains(a)) continue
    const ra = vrect(a), rb = vrect(b)
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
    const OV = '[role=dialog],[role=menu],[role=listbox],[role=tooltip],.modal,[class*=popover],[class*=menu],.toast,[class*=sheet]'
    if (w > 6 && h > 6 && !(!!a.closest(OV) !== !!b.closest(OV)) && !(floats(a) !== floats(b))) add('overlap', 'P1', a, `with "${txt(b)}" ${Math.round(w)}x${Math.round(h)}`)
  }
  // 5. targets
  for (const e of inter) {
    const r = e.getBoundingClientRect(); if (e.disabled) continue
    if (e.matches('a') && e.closest('p,li,td,th') && getComputedStyle(e).display !== 'block') continue
    if (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) { const lr = e.closest('label').getBoundingClientRect(); if (lr.height >= 24 && lr.width >= 24) continue }
    if (r.width < 24 || r.height < 24) add('target-small', 'P1', e, `${Math.round(r.width)}x${Math.round(r.height)} (<24)`)
    else if (r.height < 32 && !e.matches('input[type=checkbox],input[type=radio],input[type=range]')) add('target-below-32', 'P2', e, `${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  // 6. names
  for (const e of inter) {
    const hasName = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.innerText || '').trim() || e.title || (e.querySelector && e.querySelector('img[alt]')) || (e.labels && e.labels.length) || e.placeholder
    if (!hasName) add('no-accessible-name', 'P1', e, e.tagName)
  }
  for (const e of document.querySelectorAll('[role=dialog],[role=alertdialog]')) if (vis(e) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')) add('dialog-no-name', 'P1', e)
  if (!document.querySelector('main,[role=main]')) F.push({ check: 'no-main-landmark', sev: 'P2', sel: 'document', text: '', detail: '' })
  // 7. focus indicators (sample)
  const foc = inter.filter((e) => !e.disabled && e.tabIndex >= 0).slice(0, 40)
  const sig = (e) => { const s = getComputedStyle(e); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|') }
  const prev = document.activeElement
  for (const e of foc) { if (document.activeElement === e) e.blur(); await new Promise((r) => setTimeout(r, 20)); const w = e.parentElement; const wb = w ? sig(w) : ''; const before = sig(e); e.focus({ preventScroll: true }); await new Promise((r) => setTimeout(r, 40)); const after = sig(e); const wa = w ? sig(w) : ''; if (before === after && wb === wa) add('no-focus-indicator', 'P1', e) }
  if (prev && prev.focus) prev.focus({ preventScroll: true }); else if (document.activeElement) document.activeElement.blur()
  // 8. contrast (computed colours composited down the ancestors; skips background-images)
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const bgOf = (e) => { let layers = []; let n = e; let unknown = false; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.backgroundImage && s.backgroundImage !== 'none') unknown = true; const c = parse(s.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } n = n.parentElement } let base = { r: 255, g: 255, b: 255 }; if (!layers.length || layers[layers.length - 1].a < 1) base = parse(getComputedStyle(document.documentElement).backgroundColor) || base; for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) } } return { c: base, unknown } }
  let seenC = 0
  for (const e of all) {
    if (seenC > 400) break
    if (!([...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1))) continue
    if (e.closest('[disabled],[aria-disabled=true]') || e.matches(':disabled')) continue
    const s = getComputedStyle(e); const fg = parse(s.color); if (!fg) continue
    const { c: bg, unknown } = bgOf(e); if (unknown) continue
    const a = fg.a; const f = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }
    const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const size = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold)
    seenC++
    if (ratio < (large ? 3 : 4.5)) add('contrast', ratio < 3 ? 'P1' : 'P2', e, `${ratio.toFixed(2)}:1 at ${size}px`)
  }
  // 9. forbidden / technical text in chrome
  const chrome = [...document.querySelectorAll('button,label,h1,h2,h3,h4,[role=tab],[role=menuitem],th,legend,summary,[role=dialog] p,[role=status],[role=alert],.toast')].filter(vis)
  for (const e of chrome) {
    const t = (e.innerText || '').trim(); if (!t) continue
    if (/\bundefined\b|\[object Object\]|\bNaN\b|\bnull\b/.test(t)) add('raw-value-text', 'P0', e, t.slice(0, 80))
    if (/lorem ipsum|\bTODO\b|\bFIXME\b|\bXXX\b/i.test(t)) add('placeholder-text', 'P1', e, t.slice(0, 80))
    if (/^(Take|Project)\b|\b(Take it|Project it)\b/.test(t)) add('glossary', 'P2', e, t.slice(0, 60))
    if (/[A-Z]:\\|\/Users\/|ERR_[A-Z_]+|ECONN\w+|ENOENT|EACCES|SQLITE_|at \S+ \(.*:\d+:\d+\)|TypeError|ReferenceError/.test(t) && !e.closest('details,.advanced,[data-advanced]')) add('technical-text', 'P1', e, t.slice(0, 100))
  }
  // 10. more than one primary button in one view region
  const prim = [...document.querySelectorAll('.btn-primary,button.primary,[data-primary=true]')].filter((e) => vis(e) && !e.closest('[role=dialog],.modal,.tp-sheet,.app-header,#live-controls,.plp'))
  if (prim.length > 1) F.push({ check: 'many-primary-buttons', sev: 'P2', sel: 'document', text: prim.slice(0, 6).map(txt).join(' | '), detail: String(prim.length) })
  // 11. broken images / empty links
  for (const i of document.images) if (vis(i) && i.complete && i.naturalWidth === 0) add('broken-image', 'P1', i, i.src.slice(0, 80))
  for (const a of document.querySelectorAll('a[href]')) if (vis(a) && (a.getAttribute('href') === '' || a.getAttribute('href') === '#')) add('dead-link', 'P2', a)
  // 12. empty containers that look like missing content (a card/panel with no visible child text)
  for (const e of document.querySelectorAll('[class*=empty],[class*=placeholder]')) if (vis(e) && !(e.innerText || '').trim() && !e.querySelector('svg,img,canvas')) add('empty-box', 'P2', e)
  return F
})()
