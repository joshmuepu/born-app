/* Stage pages (scripts only, never shipped): every bundled song page and the 3,000 longest Bible pages, each sent to the real stage monitor as a
 * real slide, with the following page as Next (and, separately, with no Next), at screen heights from 720 to 2160 lines; records what the stage
 * drew: the current text's size and whether it is cut, the Next band's height, and the Next text's size and whether it is cut. Run on two
 * builds and compare the files (`compare`) to see every page that changed. Runs in the real app on an isolated profile with the output windows
 * kept hidden. Needs the sqlite3 command and `npm run build`.
 * Usage: node scripts/qa/stage-pages.cjs <profileDir> <outJson> [sizes like 1280x720,1920x1080]
 *        node scripts/qa/stage-pages.cjs compare <before.json> <after.json> */
const fs = require('fs'), path = require('path')
const { launch, sleep, Page } = require('./lib.cjs')
const { content } = require('./library-content.cjs')
const ALL = [[1280, 720], [1024, 768], [1600, 900], [1920, 1080], [1920, 1200], [2560, 1440], [3840, 2160]]

const MEASURE = `(async (want) => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
  const t0 = performance.now()
  for (;;) {
    const t = document.querySelector('.stage-current-text'), n = document.querySelector('.stage-next-text')
    if (t && t.textContent.endsWith(want.cur) && (!want.next || !document.querySelector('.stage-next') || (n && n.textContent === want.next))) break
    if (performance.now() - t0 > 3000) return null
    await frame()
  }
  await frame()
  const box = document.querySelector('.stage-current'), band = document.querySelector('.stage-next'), fit = document.querySelector('.stage-next-fit')
  const over = (el) => !!el && el.firstElementChild.scrollHeight > el.clientHeight + 1
  const px = (sel) => { const e = document.querySelector(sel); return e ? +parseFloat(getComputedStyle(e).fontSize).toFixed(2) : null }
  return [px('.stage-current-text'), over(box) ? 1 : 0, band ? +band.getBoundingClientRect().height.toFixed(1) : 0, px('.stage-next-text'), fit && over(fit) ? 1 : 0]
})`

async function measure(profile, outJson, sizes) {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const { songs, bible } = content(profile)
  const app = await launch({ profile: path.join(profile, 'app'), remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-stagepages', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const out = { sizes: sizes.map(([w, h]) => `${w}x${h}`), rows: {} }
  try {
    const op = await app.page()
    await op.ev('window.electronAPI.openStage()'); await sleep(2500)
    const st = await new Page((await app.targets()).find((x) => x.type === 'page' && /Stage monitor|Stage View/.test(x.title))).connect()
    // the text as the stage draws it: the verse number is drawn before it, and the same cleaning is applied (none for this content)
    for (const [w, h] of sizes) {
      await st.viewport(w, h, 1); await sleep(600)
      for (const withNext of [true, false]) {
        for (const [kind, list] of [['song', songs], ['bible', bible]]) {
          const key = `${w}x${h} ${withNext ? 'next' : 'last'} ${kind}`
          const rows = []
          const t0 = Date.now()
          for (let i = 0; i < list.length; i++) {
            const cur = list[i], next = withNext ? list[(i + 1) % list.length] : null
            await op.ev(`window.electronAPI.updateStage(${JSON.stringify(cur)}, ${JSON.stringify(next)})`)
            rows.push(await st.ev(`${MEASURE}(${JSON.stringify({ cur: cur.text, next: next ? next.text : null })})`))
          }
          out.rows[key] = rows
          const cut = rows.filter((r) => r && r[1]).length, missing = rows.filter((r) => !r).length
          console.log(JSON.stringify({ key, pages: rows.length, currentCut: cut, nextCut: rows.filter((r) => r && r[4]).length, nextHidden: withNext ? rows.filter((r) => r && !r[2]).length : null, missing, seconds: Math.round((Date.now() - t0) / 1000) }))
        }
      }
    }
    st.close(); op.close()
  } finally {
    fs.writeFileSync(outJson, JSON.stringify(out))
    await app.kill()
  }
}

function compare(beforeFile, afterFile) {
  const a = JSON.parse(fs.readFileSync(beforeFile, 'utf8')).rows, b = JSON.parse(fs.readFileSync(afterFile, 'utf8')).rows
  let failed = 0
  for (const key of Object.keys(a)) {
    let same = 0, changedCut = 0, changedOther = 0, cutBefore = 0, cutAfter = 0
    const other = []
    a[key].forEach((r, i) => {
      const s = b[key][i]
      if (r[1]) cutBefore++
      if (s[1]) cutAfter++
      if (JSON.stringify(r) === JSON.stringify(s)) same++
      else if (r[1]) changedCut++
      else { changedOther++; if (other.length < 3) other.push({ page: i, before: r, after: s }) }
    })
    if (changedOther) failed++
    console.log(JSON.stringify({ key, pages: a[key].length, cutBefore, cutAfter, unchanged: same, changedCutPages: changedCut, changedOtherPages: changedOther, other }))
  }
  console.log(failed ? `stage-pages compare: ${failed} groups changed a page that was not cut` : 'stage-pages compare: every page that was not cut is drawn exactly as before')
  process.exit(failed ? 1 : 0)
}

if (process.argv[2] === 'compare') compare(process.argv[3], process.argv[4])
else {
  const [profile, outJson, only] = process.argv.slice(2)
  const sizes = only ? only.split(',').map((s) => s.split('x').map(Number)) : ALL
  measure(profile, outJson, sizes).catch((e) => { console.error(e); process.exit(1) })
}
