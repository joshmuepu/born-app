/* Service tour (scripts only, never shipped): a mock service with the stage monitor on, run from the queue with the keyboard, then saved
 * from the phone, cleared, and reopened from the start screen. Checks what reaches the congregation screen and the stage monitor at each
 * step (both kept hidden by hide-outputs.cjs) and saves pictures for a person to look at; they can show library text, so they stay local.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/service-tour.cjs <profileDir> <outDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile, out] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14353), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const state = async () => (await fetch(B + '/state')).json()

;(async () => {
  const c = checks('service-tour')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true }); fs.mkdirSync(out, { recursive: true })
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9383), mdns: 'born-remote-v1svc', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const p = await app.page(); await p.viewport(1366, 768, 1)
  let n = 0
  const outputText = async () => {
    const res = {}
    for (const t of await app.targets()) {
      if (t.type !== 'page' || !/Congregation screen|Stage monitor/.test(t.title)) continue
      const o = await new Page(t).connect()
      res[/Stage/.test(t.title) ? 'stage' : 'congregation'] = await o.ev('document.body.innerText')
      o.close()
    }
    return res
  }
  const shotAll = async (tag) => {
    n++
    await p.shot(path.join(out, `${String(n).padStart(2, '0')}-${tag}-operator.png`))
    for (const t of await app.targets()) {
      if (t.type !== 'page' || !/Congregation screen|Stage monitor/.test(t.title)) continue
      const o = await new Page(t).connect(); await o.viewport(1280, 720, 1); await sleep(500)
      await o.shot(path.join(out, `${String(n).padStart(2, '0')}-${tag}-${/Stage/.test(t.title) ? 'stage' : 'congregation'}.png`)); o.close()
    }
  }
  const blur = () => p.ev('document.activeElement && document.activeElement.blur()')

  // a queue of three kinds, built from the phone
  await cmd({ action: 'queue-bible', reference: 'John 3:16-18', translation: 'KJV' })
  const songs = await (await fetch(B + '/api/search/songs?q=amazing%20grace')).json()
  const song = (Array.isArray(songs) ? songs : songs.results || [])[0]
  if (song) await cmd({ action: 'queue-song', songId: song.id })
  const sermons = await (await fetch(B + '/api/search/sermons?q=faith')).json()
  const sq = (Array.isArray(sermons) ? sermons : sermons.results || [])[0]
  if (sq) await cmd({ action: 'queue-sermon', quote: sq })
  await sleep(1500)
  let st = await state()
  c.ok('three items queued from the phone', st.queue.length === 3, st.queue.map((q) => q.kind).join(','))

  // screens on: congregation and stage
  await p.click('Open projection'); await sleep(2500)
  await p.click('Screens'); await sleep(600)
  await p.ev(`(()=>{const g=[...document.querySelectorAll('.screens-group')].find(x=>/Stage/i.test(x.textContent));const b=g&&[...g.querySelectorAll('button')].find(x=>x.textContent.trim()==='Turn on');b&&b.click()})()`); await sleep(2500)
  await p.key('Escape'); await sleep(300)
  const titles = (await app.targets()).filter((t) => t.type === 'page').map((t) => t.title)
  c.ok('congregation screen and stage monitor are open', titles.some((t) => /Congregation/.test(t)) && titles.some((t) => /Stage/.test(t)), titles.join(' | '))

  // first item from the queue, then the keyboard
  await p.ev(`(()=>{const r=document.querySelector('.queue-row');r&&r.click()})()`); await sleep(600)
  await p.ev(`(()=>{const b=[...document.querySelectorAll('.queue-row button')].find(x=>x.textContent==='Project');b&&b.click()})()`); await sleep(1500)
  await blur()
  let o = await outputText()
  c.ok('John 3:16 on the congregation screen', /God so loved the world/.test(o.congregation || ''), (o.congregation || '').slice(0, 60))
  c.ok('the stage monitor shows it and what is next', /God so loved/.test(o.stage || '') && /17|condemn/i.test(o.stage || ''), (o.stage || '').replace(/\s+/g, ' ').slice(0, 120))
  await shotAll('john-3-16')
  await p.key('ArrowRight'); await sleep(900)
  o = await outputText()
  c.ok('→ moves to verse 17', /sent not his Son/.test(o.congregation || ''), (o.congregation || '').slice(0, 60))
  await p.key(' '); await sleep(900)
  o = await outputText()
  c.ok('Space moves to verse 18', /believeth on him is not condemned/.test(o.congregation || ''), (o.congregation || '').slice(0, 60))
  await p.key('ArrowLeft'); await sleep(900)
  o = await outputText()
  c.ok('← goes back to verse 17', /sent not his Son/.test(o.congregation || ''), (o.congregation || '').slice(0, 60))
  await p.key('ArrowRight', { [process.platform === 'darwin' ? 'meta' : 'ctrl']: true }); await sleep(1500)
  o = await outputText()
  c.ok('Cmd/Ctrl+→ goes to the next queue item (the song)', /grace/i.test(o.congregation || '') && !/sent not his Son/.test(o.congregation || ''), (o.congregation || '').replace(/\s+/g, ' ').slice(0, 80))
  await shotAll('song')
  await p.key('b'); await sleep(800)
  st = await state()
  o = await outputText()
  c.ok('B hides the screen', st.blanked === true || st.isBlanked === true || !/grace/i.test(o.congregation || ''), JSON.stringify({ blanked: st.blanked ?? st.isBlanked, text: (o.congregation || '').slice(0, 30) }))
  c.ok('the stage monitor follows it (by design it shows only the clock while the screen is hidden)', !/grace/i.test(o.stage || '') && /\d:\d\d/.test(o.stage || ''), (o.stage || '').replace(/\s+/g, ' ').slice(0, 80))
  await shotAll('hidden')
  await p.key('b'); await sleep(800)
  o = await outputText()
  c.ok('B shows it again', /grace/i.test(o.congregation || ''), (o.congregation || '').slice(0, 40))
  await p.key('ArrowRight', { [process.platform === 'darwin' ? 'meta' : 'ctrl']: true }); await sleep(1500)
  o = await outputText()
  c.ok('Cmd/Ctrl+→ goes to the sermon paragraph', /faith/i.test(o.congregation || ''), (o.congregation || '').replace(/\s+/g, ' ').slice(0, 80))
  await shotAll('sermon')
  // Shift+Esc with the shortcuts list open
  await p.click('Shortcuts'); await sleep(500)
  await p.key('Escape', { shift: true }); await sleep(800)
  st = await state()
  c.ok('Shift+Esc hides the screen with the shortcuts list open', st.blanked === true || st.isBlanked === true, JSON.stringify({ blanked: st.blanked ?? st.isBlanked }))
  await p.key('Escape'); await sleep(300)
  await p.key('Escape', { shift: true }); await sleep(800)

  // save from the phone, new service, reopen from the start screen
  const before = JSON.stringify((await state()).queue.map((q) => [q.kind, q.title || q.reference || '']))
  const saved = await (await cmd({ action: 'save-queue', name: 'Invented Service Two' })).json().catch(() => null)
  c.ok('the phone save reports success', saved && saved.ok === true, JSON.stringify(saved))
  const file = fs.readdirSync(profile, { recursive: true }).find((f) => String(f).endsWith('Invented Service Two.born'))
  c.ok('the saved file exists', !!file, String(file))
  await p.click('Close projection'); await sleep(1500)
  // the desktop's New asks with a native confirm box, which a script cannot answer; the phone's New service is the same clear without it
  await cmd({ action: 'new-service' }); await sleep(1000)
  st = await state()
  c.ok('New service empties the queue', st.queue.length === 0, String(st.queue.length))
  await p.clickSel('.app-logo, [title^="BORN — back to the start screen"]'); await sleep(1000)
  await shotAll('start-screen')
  const opened = await p.click('Invented Service Two'); await sleep(1500)
  st = await state()
  const after = JSON.stringify(st.queue.map((q) => [q.kind, q.title || q.reference || '']))
  c.ok('reopening it from the start screen brings back the same queue', opened && after === before, after)
  await shotAll('reopened')

  // paste a song (invented words), review, add
  await p.click('Songs', '.panel-tab'); await sleep(500)
  await p.click('Import'); await sleep(400); await p.click('Paste text'); await sleep(600)
  await p.ev(`(()=>{const t=document.querySelector('textarea');t.focus()})()`)
  await p.insertText('Invented Morning Song\n\nPlaceholder verse line one\nPlaceholder verse line two\n\nPlaceholder chorus line one\nPlaceholder chorus line two')
  await sleep(800); await shotAll('paste-song')
  const libBefore = (await (await fetch(B + '/api/search/songs?q=Invented%20Morning')).json())
  const added = await p.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(Add|Save|Import)( song| to library)?$/i.test(x.textContent.trim())&&x.offsetParent&&!x.disabled);if(b){b.click();return b.textContent}return null})()`); await sleep(1500)
  const libAfter = (await (await fetch(B + '/api/search/songs?q=Invented%20Morning')).json())
  const cnt = (x) => (Array.isArray(x) ? x : x.results || []).length
  c.ok('a pasted song is added to the library', added && cnt(libAfter) === cnt(libBefore) + 1, `button "${added}", ${cnt(libBefore)} → ${cnt(libAfter)}`)
  await shotAll('song-added')

  // Help: a link to a section of another page
  await p.key('F1'); await sleep(1000)
  await p.click('Service Day cheat sheet'); await sleep(1000)
  const link = await p.ev(`(()=>{const a=[...document.querySelectorAll('.help-modal a')].find(x=>/\\.md#/.test(x.getAttribute('href')||''));if(!a)return null;const h=a.getAttribute('href');a.click();return h})()`); await sleep(1200)
  const target = link && decodeURIComponent(link.split('#')[1])
  const landed = target ? await p.ev(`(()=>{const e=document.getElementById(${JSON.stringify(target)});if(!e)return 'missing';const r=e.getBoundingClientRect();return r.top>=0&&r.top<innerHeight?'in view':'out of view '+Math.round(r.top)})()`) : 'no link'
  c.ok('a Help link to another page opens it at that section', landed === 'in view', `${link} → ${landed}`)
  await shotAll('help-link')
  await p.key('Escape')

  const logs = p.takeLogs().filter((l) => !/Electron Security Warning/.test(l.text))
  c.ok('no console errors in the operator window', logs.length === 0, JSON.stringify(logs.slice(0, 3)))
  c.done(); p.close(); await app.kill(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(2) })
