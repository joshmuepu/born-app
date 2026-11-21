/* Stage room (scripts only, never shipped): in the real app on an isolated profile, on a stage window at 1280x720, 1920x1080 and 3840x2160, sends
 * bundled song pages as real slides with a Next verse and checks that the current text is never cut: a long page gets room (a smaller Next band,
 * then no Next band, then smaller text, never under 16 px), a page that fits keeps the full Next band, and the Next text is never cut either.
 * Usage: node scripts/qa/stage-room.cjs <profileDir>   (needs the sqlite3 command and `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const { content } = require('./library-content.cjs')
const [profile] = process.argv.slice(2)
const LONG = ['Be Still And Know', 'Changing Dimensions', 'Chua Song Special', 'More Than Anything']

const STATE = `(()=>{
  const box = document.querySelector('.stage-current'), band = document.querySelector('.stage-next'), fit = document.querySelector('.stage-next-fit')
  const over = (el) => !!el && el.firstElementChild.scrollHeight > el.clientHeight + 1
  return { px: parseFloat(getComputedStyle(document.querySelector('.stage-current-text')).fontSize), cut: over(box), band: band ? band.getBoundingClientRect().height : 0,
    nextCut: !!fit && over(fit), bandInline: band ? band.getAttribute('style') : null }
})()`

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const { songs } = content(profile)
  const c = checks('stage-room')
  const app = await launch({ profile: path.join(profile, 'app'), remotePort: 14316, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-stageroom', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  try {
    const op = await app.page()
    await op.ev('window.electronAPI.openStage()'); await sleep(2500)
    const st = await new Page((await app.targets()).find((x) => x.type === 'page' && /Stage monitor|Stage View/.test(x.title))).connect()
    const pagesOf = (title) => songs.filter((s) => s.reference.startsWith(title))
    const longest = (title) => pagesOf(title).reduce((a, b) => (b.text.length > a.text.length ? b : a))
    const short = { kind: 'song', label: 'Verse 1', text: 'Placeholder words for a short verse\nA second placeholder line', reference: 'Invented Song' }
    const nextPage = { kind: 'song', label: 'Chorus', text: 'Placeholder chorus line one\nPlaceholder chorus line two\nPlaceholder chorus line three\nPlaceholder chorus line four', reference: 'Invented Song' }
    for (const [w, h] of [[1280, 720], [1920, 1080], [3840, 2160]]) {
      await st.viewport(w, h, 1); await sleep(700)
      const res = `${w}x${h}`
      await op.ev(`window.electronAPI.updateStage(${JSON.stringify(short)}, ${JSON.stringify(nextPage)})`); await sleep(800)
      let s = await st.ev(STATE)
      c.ok(`${res}: a page that fits keeps the full Next band (a fifth of the screen), unchanged`, !s.cut && Math.abs(s.band - h * 0.2) < 1.5 && s.bandInline === null && !s.nextCut, JSON.stringify(s))
      for (const title of LONG) {
        const page = longest(title)
        await op.ev(`window.electronAPI.updateStage(${JSON.stringify(page)}, ${JSON.stringify(nextPage)})`); await sleep(900)
        s = await st.ev(STATE)
        c.ok(`${res}: "${title}" (${page.text.split('\n').length} lines) with a Next verse: the current text is not cut, at 16 px or more`, !s.cut && s.px >= 15.95, `${s.px.toFixed(1)} px, Next band ${s.band.toFixed(0)} px${s.band ? '' : ' (hidden)'}`)
        c.ok(`${res}: "${title}": the Next text is not cut`, !s.nextCut, JSON.stringify(s))
        await op.ev(`window.electronAPI.updateStage(${JSON.stringify(page)}, null)`); await sleep(900)
        s = await st.ev(STATE)
        c.ok(`${res}: "${title}" as the last page: not cut, at 16 px or more`, !s.cut && s.px >= 15.95, `${s.px.toFixed(1)} px`)
      }
      // the next page after a long one starts again from the usual layout
      await op.ev(`window.electronAPI.updateStage(${JSON.stringify(short)}, ${JSON.stringify(nextPage)})`); await sleep(800)
      s = await st.ev(STATE)
      c.ok(`${res}: after a long page, a short one has the full Next band again`, !s.cut && Math.abs(s.band - h * 0.2) < 1.5 && s.bandInline === null, JSON.stringify(s))
    }
    const errs = st.takeLogs().filter((l) => l.kind === 'exception')
    c.ok('no page errors on the stage', !errs.length, JSON.stringify(errs.slice(0, 2)))
    st.close(); op.close()
  } finally {
    await app.kill()
  }
  process.exit(c.done().failed ? 1 : 0)
})()
