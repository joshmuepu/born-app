/* Content sizes (scripts only, never shipped): how small real content gets on the congregation screen and the stage monitor. Reads every song page
 * and every Bible verse in the bundled library (resources/library.db.gz), splits the verses into pages as the app does (shared/paginate.ts), and,
 * in the real app on an isolated profile with the output windows kept hidden, fits every song page and the 3,000 longest Bible pages in a hidden
 * copy of each screen's layout, exactly as the screen fits a slide: the congregation text at 1920x1080, 3840x2160 and 1280x720, and the stage's
 * current text (with a Next verse showing) and Next text at heights from 720 to 2160. The smallest cases are cross-checked with real slides.
 * Prints one JSON line per screen size and kind: smallest size, its share of the screen height, the share of pages under 3%, how many reach the
 * fit's smallest size and how many are cut. Needs the sqlite3 command and `npm run build`.
 * Usage: node scripts/qa/content-sizes.cjs <profileDir> [outJson] */
const fs = require('fs'), path = require('path')
const { launch, sleep, Page } = require('./lib.cjs')
const { content } = require('./library-content.cjs')
const [profile, outJson] = process.argv.slice(2)

// each fit runs in a hidden copy of the screen's own layout: root = the copy, box = the fitted element, set(item) fills it
const FIT = (prep) => `((items) => {
  const W = innerWidth, H = innerHeight, rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  ${prep}
  const copy = live.cloneNode(true); copy.style.cssText = 'position:fixed;inset:0;visibility:hidden;z-index:-1'; document.body.appendChild(copy)
  const q = (s) => copy.querySelector(s), box = q(BOX), out = []
  for (const it of items) {
    set(it)
    const inner = box.firstElementChild
    let size = base, g = 0
    box.style.fontSize = size / rootPx + 'rem'
    while (inner.scrollHeight > box.clientHeight + 1 && size > floor && g < 120) { size = Math.max(floor, size - base * 0.04); box.style.fontSize = size / rootPx + 'rem'; g++ }
    out.push([size, size <= floor + 0.01 ? 1 : 0, inner.scrollHeight > box.clientHeight + 1 ? 1 : 0])
  }
  copy.remove()
  return { H, base, floor, out }
})`
const fill = (textSel, markerCls, preCls, labelSel, refSel) => `
  const set = (it) => {
    const t = q('${textSel}'); t.textContent = ''
    ${markerCls ? `if (it.marker) { const m = document.createElement('span'); m.className = '${markerCls}'; m.textContent = it.marker; t.appendChild(m) }` : ''}
    t.appendChild(document.createTextNode(it.text))
    ${preCls ? `t.classList.toggle('is-song', it.kind === 'song')` : ''}
    ${labelSel ? `if (q('${labelSel}')) q('${labelSel}').textContent = it.label || ''` : ''}
    if (q('${refSel}')) q('${refSel}').textContent = it.reference || ''
  }`
const SCREENS = {
  congregation: { res: [[1920, 1080], [3840, 2160], [1280, 720]], prep: `const live = document.querySelector('.projection-active'), BOX = '.projection-text'
    const r = Math.max(12, H / 67.5), base = Math.min(Math.max(W * 0.042, 2 * r), 5 * r), floor = Math.max(0.9 * 16, base * 0.33)
    ${fill('.projection-text-inner', 'projection-marker', false, '.projection-label', '.projection-reference')}`, cls: '.projection-text' },
  'stage current': { res: [[1280, 720], [1024, 768], [1600, 900], [1920, 1080], [1920, 1200], [2560, 1440], [3840, 2160]], prep: `const live = document.querySelector('.stage'), BOX = '.stage-current'
    const base = Math.min(Math.max(W * 0.042, 2 * rootPx), 5 * rootPx), floor = Math.max(0.9 * rootPx, base * 0.55)
    ${fill('.stage-current-text', 'stage-marker', true, '.stage-current-label', '.stage-current-ref')}`, cls: '.stage-current-text' },
  'stage next': { res: [[1280, 720], [1024, 768], [1600, 900], [1920, 1080], [3840, 2160]], prep: `const live = document.querySelector('.stage'), BOX = '.stage-next-fit'
    const cur = parseFloat(getComputedStyle(document.querySelector('.stage-current')).fontSize)
    const base = Math.min(Math.min(Math.max(W * 0.024, 1.1 * rootPx), 2.6 * rootPx), cur), floor = Math.max(0.9 * rootPx, base * 0.3)
    ${fill('.stage-next-text', null, true, null, '.stage-next-ref')}`, cls: '.stage-next-text' }
}
const SHORT = { kind: 'bible', text: 'Jesus wept.', label: 'Bible', reference: 'John 11:35 KJV', marker: '35' }

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const { songs, bible } = content(profile)
  const app = await launch({ profile: path.join(profile, 'app'), remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-content', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const rows = []
  try {
    const op = await app.page()
    await op.ev('window.electronAPI.openProjection()'); await op.ev('window.electronAPI.openStage()'); await sleep(3000)
    const win = async (re) => new Page((await app.targets()).find((x) => x.type === 'page' && re.test(x.title))).connect()
    const pages = { congregation: await win(/Congregation screen/), stage: await win(/Stage monitor|Stage View/) }
    // what each screen shows while its copy is measured, and how a real slide is sent for the cross-check
    const show = {
      congregation: (it) => `window.electronAPI.showSlide(${JSON.stringify(it)})`,
      'stage current': (it, list) => `window.electronAPI.updateStage(${JSON.stringify({ ...it, label: it.label || 'Label', reference: it.reference || 'Ref' })}, ${JSON.stringify(list[1])})`,
      'stage next': (it) => `window.electronAPI.updateStage(${JSON.stringify(SHORT)}, ${JSON.stringify(it)})`
    }
    for (const [screen, cfg] of Object.entries(SCREENS)) {
      const page = screen === 'congregation' ? pages.congregation : pages.stage
      for (const [w, h] of cfg.res) {
        await page.viewport(w, h, 1); await sleep(500)
        for (const [kind, list] of [['song', songs], ['bible', bible]]) {
          await op.ev(show[screen](list[0], list)); await sleep(800)
          const sizes = [], floored = [], cut = []
          let meta
          for (let i = 0; i < list.length; i += 250) {
            meta = await page.ev(`${FIT(cfg.prep)}(${JSON.stringify(list.slice(i, i + 250))})`)
            for (const [s, f, c] of meta.out) { sizes.push(s); floored.push(f); cut.push(c) }
          }
          const order = sizes.map((s, i) => i).sort((a, b) => sizes[a] - sizes[b])
          await op.ev(show[screen](list[order[0]], list)); await sleep(900)
          const real = await page.ev(`parseFloat(getComputedStyle(document.querySelector('${cfg.cls}')).fontSize)`)
          const sum = (a) => a.reduce((x, y) => x + y, 0)
          const row = { screen, kind, res: `${w}x${h}`, pages: sizes.length, startPx: +meta.base.toFixed(1), smallestFitPx: +meta.floor.toFixed(1),
            smallestPx: +sizes[order[0]].toFixed(1), smallestShare: +(sizes[order[0]] / h * 100).toFixed(2), smallestRatio: +(sizes[order[0]] / meta.base).toFixed(2),
            under3pc: sum(sizes.map((s) => (s < h * 0.03 - 0.05 ? 1 : 0))), under12px: sum(sizes.map((s) => (s < 11.95 ? 1 : 0))), atSmallestFit: sum(floored), cut: sum(cut),
            smallest: list[order[0]].reference, realSlidePx: +real.toFixed(1) }
          rows.push(row); console.log(JSON.stringify(row))
        }
      }
    }
    Object.values(pages).forEach((p) => p.close()); op.close()
  } finally {
    if (outJson) fs.writeFileSync(outJson, JSON.stringify(rows, null, 1))
    await app.kill()
  }
})()
