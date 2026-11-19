/* Screen sizes (scripts only, never shipped): measures the real stage monitor and congregation screen at the resolutions churches use,
 * with invented songs, KJV text and placeholder quotes. Runs the real app on an isolated profile with the output windows kept hidden
 * (hide-outputs.cjs), sets each window's size with the DevTools protocol (no display is touched), and measures the drawn text:
 * size as a share of the screen height, the current text against the Next text, what is cut, the side margins, and the contrast of
 * every stage colour from sampled screenshot pixels. Prints the numbers as JSON lines and a check per rule.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/screen-sizes.cjs <profileDir> [outJson]   (needs `npm run build`)
 * ONLY=stage|congregation-size|congregation-ref|congregation-margins limits the checks (the numbers are always measured). */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const { PNG } = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright-core', 'lib', 'utilsBundle'))
const [profile, outJson] = process.argv.slice(2)
const ONLY = process.env.ONLY || ''
const want = (k) => !ONLY || ONLY.split(',').includes(k)

// physical width, height, Windows-style display scaling
const RES = [[1280, 720, 1], [1920, 1080, 1], [1024, 768, 1], [1920, 1200, 1], [3840, 2160, 1], [3840, 2160, 1.25], [3840, 2160, 1.5], [1920, 1080, 1.25], [1920, 1080, 1.5]]
const resName = ([w, h, s]) => `${w}x${h}@${Math.round(s * 100)}%`

const SONG8 = ['Morning light is breaking over every hill', 'Placeholder words to sing the second line', 'Here the third line of the invented song', 'And a fourth that leads into the chorus', 'Sing it out, the chorus of this song', 'Another line that stands in for the words', 'The seventh line of this invented verse', 'And the last line brings the verse home'].join('\n')
const SONG4 = ['Evening falls and still the song goes on', 'A second line for the verse that comes next', 'Placeholder words for the third line here', 'And the fourth line ends the verse'].join('\n')
const SHORT = { kind: 'bible', text: 'Jesus wept.', label: 'Bible', reference: 'John 11:35 KJV', marker: '35' }
const LONG = { kind: 'bible', label: 'Bible', reference: '1 Corinthians 13:4-7 KJV', marker: '4', text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil; Rejoiceth not in iniquity, but rejoiceth in the truth; Beareth all things, believeth all things, hopeth all things, endureth all things.' }
const QUOTE = { kind: 'quote', label: 'Placeholder Sermon Title', reference: '00-0000 ¶12', marker: '12', text: 'Placeholder words stand in for a sermon paragraph here, long enough to wrap over several lines on the screen, the way a real quotation would, and then a few more placeholder words so that the paragraph reaches a realistic length for the platform to read.' }
const SONG = { kind: 'song', text: SONG8, label: 'Verse 1', reference: 'Morning Song' }
const NEXT_SONG = { kind: 'song', text: SONG4, label: 'Verse 2', reference: 'Morning Song' }
const STAGE_CASES = [['song-8-lines', SONG, NEXT_SONG], ['short-verse', SHORT, { ...LONG }], ['long-passage', LONG, SHORT], ['sermon-quote', QUOTE, { ...QUOTE, marker: '13' }], ['last-slide', SHORT, null]]
const LONG_REF = { ...QUOTE, reference: 'Placeholder Sermon Title That Runs Long Enough To Wrap On A Small Projector · 00-0000 ¶12' }
const CONG_CASES = [['verse', SHORT], ['long-passage', LONG], ['song', SONG], ['quote', QUOTE], ['long-reference', LONG_REF]]
// the stage case showing the same slide as the current text, to compare sizes
const SAME_ON_STAGE = { verse: 'short-verse', 'long-passage': 'long-passage', song: 'song-8-lines', quote: 'sermon-quote' }

const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
/** In a screenshot, inside a box: the background is the commonest colour, the text colour the pixel that differs most from it. */
function sample(png, box, scale) {
  const counts = new Map(), px = []
  const x0 = Math.max(0, Math.floor(box.x * scale)), y0 = Math.max(0, Math.floor(box.y * scale))
  const x1 = Math.min(png.width, Math.ceil((box.x + box.w) * scale)), y1 = Math.min(png.height, Math.ceil((box.y + box.h) * scale))
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4, c = [png.data[i], png.data[i + 1], png.data[i + 2]]
    px.push(c); const k = c.join(','); counts.set(k, (counts.get(k) || 0) + 1)
  }
  if (!px.length) return null
  const bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
  let fg = bg, best = 1
  for (const c of px) { const r = ratio(c, bg); if (r > best) { best = r; fg = c } }
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  return { fg: hex(fg), bg: hex(bg), ratio: +best.toFixed(2) }
}

const STAGE_MEASURE = `(()=>{
  const H = innerHeight, q = (s) => document.querySelector(s), fs = (e) => e ? parseFloat(getComputedStyle(e).fontSize) : null
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }
  const cur = q('.stage-current-text'), next = q('.stage-next-text'), band = q('.stage-next'), curBox = q('.stage-current')
  const lines = (e) => e ? Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) : null
  return {
    vw: innerWidth, vh: H,
    rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    currentPx: fs(cur), nextPx: fs(next), clockPx: fs(q('.stage-clock')), bigClockPx: fs(q('.stage-bigclock-time')),
    currentLabelPx: fs(q('.stage-current-label')), nextLabelPx: fs(q('.stage-next-label')), currentRefPx: fs(q('.stage-current-ref')), nextRefPx: fs(q('.stage-next-ref')),
    currentLines: lines(cur), nextLines: lines(next),
    currentTextHeight: cur ? cur.getBoundingClientRect().height : null,
    currentCut: curBox ? curBox.scrollHeight > curBox.clientHeight + 1 : null,
    nextBandHeight: band ? band.getBoundingClientRect().height : null,
    nextCut: band ? band.scrollHeight > band.clientHeight + 1 || [...band.querySelectorAll('.stage-next-fit')].some((f) => f.scrollHeight > f.clientHeight + 1) : null,
    heights: { topbar: q('.stage-topbar')?.getBoundingClientRect().height, currentBox: curBox?.clientHeight, currentNeeds: curBox?.firstElementChild?.scrollHeight, band: band?.getBoundingClientRect().height, bandNeeds: band ? (q('.stage-next-fit')?.firstElementChild?.scrollHeight ?? null) : null, fitBox: q('.stage-next-fit')?.clientHeight },
    sideways: document.documentElement.scrollWidth > innerWidth + 1,
    boxes: { 'current label': box(q('.stage-current-label')), 'verse marker': box(q('.stage-marker')), 'current reference': box(q('.stage-current-ref')), 'Next label': box(q('.stage-next-label')), 'Next text': box(next), 'Next reference': box(q('.stage-next-ref')), clock: box(q('.stage-clock')) }
  }
})()`
const CONG_MEASURE = `(()=>{
  const H = innerHeight, W = innerWidth, q = (s) => document.querySelector(s), fs = (e) => e ? parseFloat(getComputedStyle(e).fontSize) : null
  const t = q('.projection-text'), inner = q('.projection-text-inner'), ref = q('.projection-reference'), lab = q('.projection-label')
  const r = inner && inner.getBoundingClientRect(), rr = ref && ref.getBoundingClientRect(), tr = t && t.getBoundingClientRect(), lr = lab && lab.getBoundingClientRect()
  return {
    vw: W, vh: H, textPx: fs(t), referencePx: fs(ref), labelPx: fs(lab),
    leftMargin: r ? r.left : null, rightMargin: r ? W - r.right : null,
    textCut: t ? t.scrollHeight > t.clientHeight + 1 : null,
    sideways: inner ? inner.scrollWidth > inner.clientWidth + 1 || document.documentElement.scrollWidth > W + 1 : null,
    referenceOnScreen: rr ? rr.left >= -1 && rr.right <= W + 1 && rr.bottom <= H + 1 && rr.top >= 0 : null,
    referenceOneLine: rr ? rr.height < fs(ref) * 2 : null,
    referenceClearOfText: rr && tr ? rr.top >= tr.bottom - 1 : null,
    labelClearOfText: lr && tr ? lr.bottom <= tr.top + 1 : null,
    textCentreShare: r ? (r.top + r.height / 2) / H : null
  }
})()`

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const c = checks('screen-sizes')
  const app = await launch({ profile, remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-sizes', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const rows = []
  try {
    const op = await app.page()
    await op.ev('window.electronAPI.openProjection()'); await op.ev('window.electronAPI.openStage()'); await sleep(3000)
    const win = async (re) => { const t = (await app.targets()).find((x) => x.type === 'page' && re.test(x.title)); if (!t) throw new Error('no window ' + re); return new Page(t).connect() }
    const stage = await win(/Stage monitor|Stage View/), cong = await win(/Congregation screen|Output/)
    const setSize = async (p, [w, h, s]) => { await p.viewport(Math.round(w / s), Math.round(h / s), s); await sleep(700) }

    // ── stage monitor
    for (const [name, current, next] of STAGE_CASES) {
      await op.ev(`window.electronAPI.updateStage(${JSON.stringify(current)}, ${JSON.stringify(next)})`); await sleep(600)
      for (const res of RES) {
        await setSize(stage, res)
        const m = await stage.ev(STAGE_MEASURE)
        const shot = await stage.send('Page.captureScreenshot', { format: 'png' })
        const png = PNG.sync.read(Buffer.from(shot.result.data, 'base64'))
        const contrast = {}
        for (const [k, b] of Object.entries(m.boxes)) if (b && b.w > 1 && b.h > 1) contrast[k] = sample(png, b, png.height / m.vh)
        delete m.boxes
        const row = { screen: 'stage', case: name, res: resName(res), ...m, currentShare: m.currentPx / m.vh, nextShare: m.nextPx ? m.nextPx / m.vh : null, contrast }
        rows.push(row)
        console.log(JSON.stringify(row))
        if (want('stage')) {
          if (m.nextPx) c.ok(`stage ${name} ${row.res}: the current text is not smaller than the Next text`, m.currentPx >= m.nextPx - 0.5, `${m.currentPx.toFixed(1)} px vs ${m.nextPx.toFixed(1)} px`)
          if (name === 'song-8-lines' && res[1] === 1080 && res[2] === 1) c.ok(`stage ${name} ${row.res}: the current text is at least 4% of the screen height`, row.currentShare >= 0.04, (row.currentShare * 100).toFixed(2) + '%')
          c.ok(`stage ${name} ${row.res}: nothing is cut`, !m.currentCut && !m.nextCut && !m.sideways, JSON.stringify({ currentCut: m.currentCut, nextCut: m.nextCut, sideways: m.sideways }))
          if (m.nextBandHeight) c.ok(`stage ${name} ${row.res}: the Next band is at most about a fifth of the screen height`, m.nextBandHeight <= m.vh * 0.205, (m.nextBandHeight / m.vh * 100).toFixed(1) + '%')
          for (const [k, v] of Object.entries(contrast)) if (v) c.ok(`stage ${name} ${row.res}: ${k} contrast at least 4.5:1`, v.ratio >= 4.5, `${v.fg} on ${v.bg} ${v.ratio}:1`)
        }
      }
    }
    // the idle clock
    await op.ev('window.electronAPI.updateStage(null, null)'); await sleep(500)
    for (const res of RES) { await setSize(stage, res); const m = await stage.ev(STAGE_MEASURE); const row = { screen: 'stage', case: 'idle-clock', res: resName(res), vh: m.vh, bigClockPx: m.bigClockPx, bigClockShare: m.bigClockPx / m.vh }; rows.push(row); console.log(JSON.stringify(row)) }

    // ── congregation screen
    for (const [name, slide] of CONG_CASES) {
      await op.ev(`window.electronAPI.showSlide(${JSON.stringify(slide)})`); await sleep(600)
      for (const res of RES) {
        await setSize(cong, res)
        const m = await cong.ev(CONG_MEASURE)
        const row = { screen: 'congregation', case: name, res: resName(res), ...m, textShare: m.textPx / m.vh, referenceShare: m.referencePx / m.vh, labelShare: m.labelPx / m.vh, marginShare: m.leftMargin / m.vw }
        rows.push(row)
        console.log(JSON.stringify(row))
        c.ok(`congregation ${name} ${row.res}: nothing is cut or runs off the side`, !m.textCut && !m.sideways && m.referenceOnScreen && m.referenceClearOfText && m.labelClearOfText, JSON.stringify({ textCut: m.textCut, sideways: m.sideways, referenceOnScreen: m.referenceOnScreen, referenceClearOfText: m.referenceClearOfText, labelClearOfText: m.labelClearOfText }))
        const onStage = rows.find((x) => x.screen === 'stage' && x.case === SAME_ON_STAGE[name] && x.res === row.res)
        if (onStage) row.stagePx = onStage.currentPx
        if (want('congregation-size') && onStage) c.ok(`congregation ${name} ${row.res}: the text is at least the size of the stage monitor's current text`, m.textPx >= onStage.currentPx - 0.5, `${m.textPx.toFixed(1)} px vs stage ${onStage.currentPx.toFixed(1)} px`)
        if (want('congregation-ref')) {
          c.ok(`congregation ${name} ${row.res}: the reference line is 5% of the screen height`, row.referenceShare >= 0.049, (row.referenceShare * 100).toFixed(2) + '%')
          c.ok(`congregation ${name} ${row.res}: the label is 3.2% of the screen height`, row.labelShare >= 0.031, (row.labelShare * 100).toFixed(2) + '%')
        }
        if (want('congregation-margins')) c.ok(`congregation ${name} ${row.res}: side margins are 5% of the width`, Math.abs(row.marginShare - 0.05) < 0.003 && Math.abs(m.rightMargin / m.vw - 0.05) < 0.003, `${m.leftMargin.toFixed(0)} / ${m.rightMargin.toFixed(0)} px of ${m.vw}`)
      }
    }
    stage.close(); cong.close(); op.close()
  } finally {
    if (outJson) fs.writeFileSync(outJson, JSON.stringify(rows, null, 1))
    await app.kill()
  }
  process.exit(c.done().failed ? 1 : 0)
})()
