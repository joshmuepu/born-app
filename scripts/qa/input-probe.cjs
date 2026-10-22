/* Unusual-input probe: pushes long text, emoji, right-to-left text and pasted HTML into every text entry point of the operator window and
 * reports exceptions, console errors, sideways page scroll and HTML that got interpreted. Usage: node scripts/qa/input-probe.cjs <profileDir>  (needs `npm run build`) */
const path = require('path')
const { launch, checks, sleep } = require('./lib.cjs')
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-input-profile')
const INPUTS = {
  long: 'word '.repeat(1500).trim(),
  unbroken: 'x'.repeat(4000),
  emoji: 'Praise 🙏🎶 👨‍👩‍👧 ❤️ amen',
  rtl: 'الله محبة שלום עליכם',
  html: '<img src=x onerror="window.__xss=1"><b>bold</b> &amp; <script>window.__xss=1</script>',
  quotes: `He said "faith" and 'hope' \\ back\\slash % _ * ( ) ^ :`
}
;(async () => {
  const c = checks('input-probe')
  const app = await launch({ profile, settle: 6000 })
  const p = await app.page()
  await p.viewport(1366, 768, 1)
  const sideways = () => p.ev(`document.documentElement.scrollWidth > innerWidth + 1`)
  const reset = async () => { await p.key('Escape'); await sleep(150) }
  const surfaces = {
    'sermon search': async () => { await p.click('Sermons', '.panel-tab'); await p.click('Search', '.panel-subtab'); return '#born-search-input' },
    'bible search': async () => { await p.click('Bible', '.panel-tab'); return 'input.search-input' },
    'songs search': async () => { await p.click('Songs', '.panel-tab'); return 'input.search-input' }
    // the Message dialog only exists while a projection window is open, which would go fullscreen on a real display — not driven here
  }
  for (const [sname, open] of Object.entries(surfaces)) {
    for (const [iname, text] of Object.entries(INPUTS)) {
      let sel
      try { await reset(); sel = await open(); await sleep(250) } catch (e) { c.ok(`${sname}: opens`, false, e.message); break }
      const found = await p.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.getClientRects().length);if(!e)return false;e.focus();e.select&&e.select();return true})()`)
      if (!found) { c.ok(`${sname}: finds its text box (${sel})`, false); break }
      p.takeLogs(); await p.insertText(text); await p.key('Enter'); await sleep(700)
      const logs = p.takeLogs().filter((l) => !/Electron Security Warning/.test(l.text))
      const xss = await p.ev('!!window.__xss')
      const side = await sideways()
      c.ok(`${sname} <- ${iname}: no errors, no sideways scroll, no HTML run`, logs.length === 0 && !xss && !side, JSON.stringify({ errors: logs.slice(0, 2), xss, side }))
      await p.ev(`(()=>{const e=document.activeElement; if(e&&'value' in e){e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))}})()`)
      await reset()
    }
  }
  // the paste-a-song screen, with an unbroken line and HTML
  try {
    await reset(); await p.click('Songs', '.panel-tab'); await sleep(300); await p.click('Import'); await sleep(200); await p.click('Paste text'); await sleep(400)
    for (const [iname, text] of Object.entries(INPUTS)) {
      p.takeLogs()
      await p.ev(`(()=>{const t=document.querySelector('.paste-song-textarea');t.focus();t.select()})()`)
      await p.insertText('Test Title\n\n' + text + '\n\nChorus:\n' + text)
      await sleep(600)
      const logs = p.takeLogs().filter((l) => !/Electron Security Warning/.test(l.text))
      const xss = await p.ev('!!window.__xss'), side = await sideways()
      c.ok(`paste a song <- ${iname}: no errors, no sideways scroll, no HTML run`, logs.length === 0 && !xss && !side, JSON.stringify({ errors: logs.slice(0, 2), xss, side }))
    }
  } catch (e) { c.ok('paste a song screen opens', false, e.message) }
  const res = c.done(); p.close(); await app.kill(); process.exit(res.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
