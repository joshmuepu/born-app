/* Retakes the Help pages' screenshots from the real app (scripts only, never shipped). Content rules for committed pictures: the app's
 * own UI, invented songs and the KJV only; never sermon text. Sermon titles and paragraph text that a screen happens to show are
 * replaced with placeholders in the page before the picture is taken, and so are this test run's own address and name (the pictures
 * show the defaults: port 4316, born-remote.local).
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/manual-screenshots.cjs <profileDir> <outDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep } = require('./lib.cjs')
const pw = require(path.join(process.env.PW_DIR || '/tmp/born-pw', 'node_modules', 'playwright'))
const [profile, out] = process.argv.slice(2)
const PORT = 14316, B = `http://127.0.0.1:${PORT}`
const W = 1280, H = 772, SCALE = 1.5

const song = (id, title, lines) => ({ kind: 'song', id, songId: 0, title, slides: lines.map((l) => ({ text: l })) })
const SONGS = [
  song('s-morning', 'Morning Song', ['Placeholder lyric for the first verse\nA second placeholder line', 'Placeholder chorus line\nAnother placeholder line']),
  song('s-evening', 'Evening Song', ['A different placeholder verse\nFor the shared copy of this song'])
]

;(async () => {
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true }); fs.mkdirSync(out, { recursive: true })
  // a saved service the start screen lists under Recent, and one with songs this library does not have yet
  const sunday = path.join(profile, 'Sunday morning.born'); fs.writeFileSync(sunday, JSON.stringify([]))
  const shared = path.join(profile, 'From the song leader.born'); fs.writeFileSync(shared, JSON.stringify(SONGS))
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ recentServices: [shared, sunday], theme: 'dark' }))
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-e2e', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const p = await app.page()
  await p.viewport(W, H, SCALE); await sleep(800)
  const shot = async (name) => { await sleep(500); await p.shot(path.join(out, name)) }
  const blur = () => p.ev('document.activeElement && document.activeElement.blur()')
  // sermon titles / text on screen → placeholders (keeps the highlight markup)
  const placeholders = () => p.ev(`(()=>{
    document.querySelectorAll('.result-title').forEach((e,i)=>e.textContent='Placeholder Sermon Title '+(i+1))
    document.querySelectorAll('.result-text').forEach((e)=>{e.innerHTML='Placeholder words stand in for the sermon paragraph here, with the word <mark class="hl">faith</mark> highlighted where it matches, and more placeholder words after it.'})
    document.querySelectorAll('.on-this-day-title').forEach((e,i)=>e.textContent='Placeholder Sermon Title '+(i+1))
  })()`)
  // this run's address and test name → the defaults a church sees
  const defaults = () => p.ev(`(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){n.textContent=n.textContent.replace(/born-remote-v1-e2e/g,'born-remote').replace(/\\b\\d{1,3}(\\.\\d{1,3}){3}:${PORT}\\b/g,'10.0.0.124:4316').replace(/:${PORT}\\b/g,':4316').replace(/port ${PORT}\\b/g,'port 4316')}})()`)

  // 1. idle
  await blur(); await placeholders(); await shot('operator-idle.png')
  // 2. Screens panel over the idle screen
  await p.click('Screens'); await sleep(700); await placeholders(); await shot('operator-screens-popover.png'); await p.key('Escape'); await sleep(300)
  // 3. Remote panel
  await p.click('Remote'); await sleep(2500); await defaults(); await shot('operator-remote-popover.png'); await p.key('Escape'); await sleep(300)
  // 4. search results
  await p.ev(`(()=>{const i=document.getElementById('born-search-input');i.focus()})()`); await p.insertText('faith'); await p.key('Enter'); await sleep(2500)
  await placeholders(); await blur(); await shot('operator-search-results.png')
  await p.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Clear search'||x.title==='Clear');if(b)b.click()})()`); await sleep(300)
  // 5. song import review: "Evening Song" is already in the library with other words, "Morning Song" is new; opened from Recent
  const parsed = await p.ev(`window.electronAPI.parsePastedText('Placeholder words of our own Evening Song\\nA second line of ours', 'Evening Song')`)
  const one = Array.isArray(parsed) ? parsed[0] : parsed && parsed.song ? parsed.song : parsed
  await p.ev(`window.electronAPI.commitReviewedSong(${JSON.stringify(one)})`)
  await p.click('From the song leader'); await sleep(1500)
  console.log('song review dialog shown:', await p.ev('!!document.querySelector("[role=dialog]")'))
  await shot('operator-song-import-review.png')
  await p.click('Add all'); await sleep(1200)
  // 6. Bible > Browse > John 3 (KJV)
  await p.click('Bible'); await sleep(400); await p.click('Browse'); await sleep(500); await p.click('All Books'); await sleep(500); await p.click('John'); await sleep(500); await p.click('3', 'button'); await sleep(900)
  await blur(); await shot('operator-bible-browse.png')

  // 7. the phone remote's Queue tab: the two invented songs (just imported) and two KJV passages, the first song on screen
  const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  await cmd({ action: 'queue-bible', reference: 'John 3:16', translation: 'KJV' }); await cmd({ action: 'queue-bible', reference: 'Psalm 23:1', translation: 'KJV' })
  await sleep(1200)
  const st = await (await fetch(B + '/state')).json()
  console.log('queue for the phone picture:', st.queue.map((q) => q.kind).join(','))
  if (st.queue[0]) await cmd({ action: 'project', id: st.queue[0].id })
  await sleep(1200)
  const browser = await pw.webkit.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })
  await ctx.addInitScript(() => { try { localStorage.setItem('born-remote-role-dismissed', '1'); localStorage.setItem('born-remote-a2hs-dismissed', '1') } catch (_) {} })
  const phone = await ctx.newPage(); await phone.goto(B + '/'); await phone.waitForFunction(() => typeof setTab === 'function'); await sleep(2000)
  await phone.screenshot({ path: path.join(out, 'mobile-remote-queue.png') })
  await browser.close()
  for (const f of fs.readdirSync(out)) console.log(f, Math.round(fs.statSync(path.join(out, f)).size / 1024) + ' KB')
  await app.kill(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(2) })
