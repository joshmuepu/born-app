/* End-to-end phone flows against the real app: the queue, projecting and switching what is live, searching while live, songs, the Bible,
 * roles, and a second phone. Every check compares what the phone shows with what the computer reports. A FAIL here is a finding of the review,
 * not a broken script: each one is explained in ../report.md.
 * Usage: PW_DIR=/tmp/born-pw node docs/qa/v1-mobile-review/scripts/flows.cjs [outDir]   (needs `npm run build`; ONLY=queue,project,… runs some) */
const fs = require('fs'), path = require('path')
const H = require('./harness.cjs')
const { V, sleep } = H
const out = process.argv[2] || path.join(__dirname, '..', 'evidence')
const ENG = process.env.ENGINE || 'chromium'
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean)
const c = H.checks('flows')
const notes = []
const note = (flow, what) => { notes.push({ flow, what }); console.log(`NOTE  ${flow}: ${what}`) }
let env

const seed = async (titles = ['Morning Song', 'Evening Song', 'River Song']) => {
  await H.reset()
  for (const t of titles) await H.cmd({ action: 'queue-song', songId: env.ids[t] })
  await H.cmd({ action: 'queue-bible', reference: 'John 3:16-17', translation: 'KJV' }); await sleep(1300)
}
const projectQueued = async (title, slide) => { const s = await H.server(); const i = s.queue.indexOf(title); await H.cmd(slide == null ? { action: 'project', id: s.ids[i] } : { action: 'project-at', id: s.ids[i], slide }); await sleep(1000) }
const same = (v, srv) => (v.nowText || '').slice(0, 24) === (srv.onScreen || '').slice(0, 24)
const text = (page, sel) => page.locator(V(sel)).first().innerText().catch(() => '')

const FLOWS = {
  /* ── the queue ─────────────────────────────────────────────── */
  async queue() {
    await seed(); await projectQueued('Morning Song')
    const page = await H.phone({ engine: ENG, role: 'Operator' })
    let v = await H.view(page), srv = await H.server()
    c.ok('queue: opens showing what is live', same(v, srv), `phone "${v.nowText}" / computer "${srv.onScreen}"`)
    // the live row in the strip: is it marked by more than colour?
    const strip = await page.evaluate(() => [...document.querySelectorAll('.qstrip-card')].map((e) => ({ t: e.innerText.replace(/\s+/g, ' ').trim(), outlined: !!e.style.outline })))
    const liveCard = strip.find((s) => s.outlined)
    c.ok('queue: the live item in the strip is marked by more than a coloured outline', !!liveCard && /ON SCREEN|LIVE/i.test(liveCard.t), `live card reads "${liveCard ? liveCard.t : 'none'}"; the others read "${(strip.find((s) => !s.outlined) || {}).t}"`)
    // Edit: reorder and remove with Undo
    await page.locator(V('.filebtn')).filter({ hasText: 'Edit' }).tap(); await sleep(400)
    const before = (await H.server()).queue
    await page.locator(V('.qitem--editable')).nth(1).locator('[aria-label="Move down"]').tap(); await sleep(1500)
    srv = await H.server()
    c.ok('queue: Move down reorders on the computer', srv.queue[2] === before[1] && srv.queue[1] === before[2], `${before.join(' | ')} → ${srv.queue.join(' | ')}`)
    c.ok('queue: the live row is still the same item after a reorder', srv.activeTitle === 'Morning Song', `live: ${srv.activeTitle}`)
    await page.locator(V('.qitem--editable')).nth(3).locator('[aria-label="Remove"]').tap(); await sleep(500)
    const undoShown = await page.locator('#undoBar').isVisible()
    await page.locator('#undoBtn').tap(); await sleep(1500)
    c.ok('queue: Remove offers Undo, and Undo keeps the item', undoShown && (await H.server()).queue.length === 4, `undo bar ${undoShown}, queue ${(await H.server()).queue.length}`)
    await page.locator(V('.qitem--editable')).nth(3).locator('[aria-label="Remove"]').tap(); await sleep(6500)
    c.ok('queue: Remove without Undo removes it on the computer after 5 s', (await H.server()).queue.length === 3, `queue ${(await H.server()).queue.join(' | ')}`)
    // remove the live item
    const liveAt = (await H.server()).activeIndex
    await page.locator(V('.qitem--editable')).nth(liveAt).locator('[aria-label="Remove"]').tap(); await sleep(6800)
    srv = await H.server(); await page.locator(V('.filebtn')).filter({ hasText: 'Done' }).tap(); await sleep(1300); v = await H.view(page)
    const head = await text(page, '.now-head')
    c.ok('queue: removing the live item leaves the phone saying what is still on the screen', same(v, srv) && (srv.onScreen ? /Not in your queue/i.test(head) : true), `computer on screen "${srv.onScreen}", live row ${srv.activeIndex}; phone "${v.nowText}" head "${head.replace(/\s+/g, ' ')}"`)
    const nextBefore = srv.onScreen
    await page.locator('#next-p').tap(); await sleep(1500); srv = await H.server()
    note('queue', `Next after the live item was removed: screen went from "${nextBefore}" to "${srv.onScreen}" (live row ${srv.activeIndex == null ? 'none' : srv.queue[srv.activeIndex]})`)
    await page.context().close()

    // + Queue from Songs, tagged with the role; and a fast double tap
    await seed([])
    const sl = await H.phone({ engine: ENG, role: 'Song Leader' })
    await H.openSong(sl, 'search', 'River Song')
    await sl.locator(V('.btn-queue')).first().tap(); await sleep(1500)
    srv = await H.server()
    const row = srv.raw.queue.find((q) => q.title === 'River Song')
    c.ok('queue: + Queue from a phone adds the song, tagged with the role', !!row && row.source && row.source.label === 'Song Leader', `row ${row ? JSON.stringify(row.source) : 'missing'}`)
    await H.openSong(sl, 'search', 'Evening Song')
    const b = await sl.locator(V('.btn-queue')).first().boundingBox()
    await sl.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sl.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(1800)
    srv = await H.server()
    const n = srv.queue.filter((t) => t === 'Evening Song').length
    c.ok('queue: a double tap on + Queue adds the song once', n === 1, `"Evening Song" is in the queue ${n} time(s)`)
    await sl.context().close()

    // two phones: one has the full queue list open while the other changes what is live, then removes the item the first has open
    await seed(); await projectQueued('Morning Song')
    const a = await H.phone({ engine: ENG, role: 'Operator' }), b2 = await H.phone({ engine: ENG, role: 'Preacher' })
    await b2.locator(V('.viewall')).tap(); await sleep(500)
    await projectQueued('Evening Song'); await sleep(1500)
    const marked = await b2.evaluate(() => [...document.querySelectorAll('#sheetBody .qitem')].filter((e) => /ON SCREEN/.test(e.innerText)).map((e) => e.querySelector('.qtitle').innerText))
    c.ok('queue: the open "Full Queue" list follows a change of the live item', marked.length === 1 && marked[0] === 'Evening Song', `list marks ${JSON.stringify(marked)} as ON SCREEN; the computer has Evening Song live`)
    await b2.evaluate(() => closeSheet())
    await H.openSong(b2, 'queue', 'River Song')
    const s0 = await H.server(); await H.cmd({ action: 'remove', id: s0.ids[s0.queue.indexOf('River Song')] }); await sleep(1800)
    const vb = await H.view(b2)
    c.ok('queue: a full page whose item another phone removed closes with a note', !vb.sheetOpen && /taken out/.test(vb.toast || ''), `${H.where(vb)}; says "${vb.toast}"`)
    await a.context().close(); await b2.context().close()
  },

  /* ── projecting and switching what is live ─────────────────── */
  async project() {
    await seed(); await projectQueued('Morning Song')
    const page = await H.phone({ engine: ENG, role: 'Operator' }), other = await H.phone({ engine: ENG, role: 'Song Leader' })
    // Bible: book, chapter, verse, Project
    await H.tapTab(page, 'bible')
    await page.locator(V('.book-chip')).filter({ hasText: /^John$|^Jn$|^Joh$/ }).first().tap().catch(async () => { await page.evaluate(() => pickBook(43)) }); await sleep(400)
    await page.locator(V('.chapter-chip')).nth(2).tap(); await sleep(900)
    await page.locator(V('.verse-row')).nth(15).tap(); await sleep(900)
    let v = await H.view(page), srv = await H.server()
    c.ok('project: opening a verse puts nothing on the screen yet', srv.activeTitle === 'Morning Song', `still live: ${srv.activeTitle}`)
    await page.locator(V('.btn-project')).first().tap(); await sleep(2600)
    v = await H.view(page); srv = await H.server()
    c.ok('project: a Bible verse from Browse goes live and the phone moves to the live view', H.onLiveView(v) && same(v, srv) && /God so loved/.test(srv.onScreen || ''), `${H.where(v)}; phone "${v.nowText}" / computer "${srv.onScreen}"`)
    let vSecond = await H.view(other)
    c.ok('project: the second phone shows the new live item within a second or two', same(vSecond, srv), `second phone "${vSecond.nowText}"`)
    // a sermon paragraph from the search
    await H.tapTab(page, 'sermons')
    await page.locator(V('#sermonInput, #sermonInputT')).first().fill('faith'); await page.locator(V('.gobtn')).first().tap(); await sleep(3500)
    const hits = await page.locator(V('.ritem')).count()
    if (hits) {
      await page.locator(V('.ritem')).first().tap(); await sleep(700); await page.locator(V('.btn-project')).first().tap(); await sleep(2800)
      v = await H.view(page); srv = await H.server()
      c.ok('project: a sermon paragraph from the search goes live and the phone moves to the live view', H.onLiveView(v) && same(v, srv), `${H.where(v)}; matches the computer: ${same(v, srv)}`)
    } else note('project', 'the sermon search returned nothing on this profile, so the sermon checks were skipped')
    // a sermon's full page, opened from Series: tap a paragraph
    await H.tapTab(page, 'sermons'); await page.evaluate(() => { state.sermonQuery = ''; renderSermonsTab() })
    await page.locator(V('.browse-chip')).filter({ hasText: 'Series' }).tap(); await sleep(2500)
    if (await page.locator(V('#seriesListBody .qitem')).count()) {
      await page.locator(V('#seriesListBody .qitem')).first().tap(); await sleep(1800)
      await page.locator(V('#seriesSermonsBody .qitem')).first().tap(); await sleep(2500)
      const before = (await H.server()).onScreen
      await page.locator(V('#sermonDetailBody .slide-row')).nth(2).tap(); await sleep(2600)
      v = await H.view(page); srv = await H.server()
      c.ok('project: tapping a paragraph on a sermon\'s full page goes live', srv.onScreen !== before, `screen changed: ${srv.onScreen !== before}`)
      c.ok('project: after that tap the phone moves to the live view', H.onLiveView(v), H.where(v))
      const anyLive = await page.locator('#sermonDetailBody .slide-row.live').count()
      c.ok('project: if it stays, the sermon\'s full page marks the paragraph that is live', H.onLiveView(v) || anyLive > 0, `rows marked LIVE on the page: ${anyLive}`)
      await page.evaluate(() => closeSheet())
    } else note('project', 'no series list on this profile, so the sermon full-page check was skipped')
    // switch live to a song from Songs while something else is live; look at the very first moment on the Queue tab
    await H.openSong(page, 'search', 'River Song')
    const prev = (await H.server()).onScreen
    await page.locator(V('.btn-project')).first().tap()
    await page.waitForFunction(() => state.tab === 'queue', null, { timeout: 5000 }).catch(() => {})
    const first = await H.view(page); await sleep(2200); v = await H.view(page); srv = await H.server()
    c.ok('project: switching from one live item to a song ends on the live view with the song', H.onLiveView(v) && same(v, srv) && /^River Song/.test(srv.onScreen), `phone "${v.nowText}"`)
    c.ok('project: the Queue tab never shows the old item as ON SCREEN after the switch', !(first.nowText || '').startsWith((prev || '').slice(0, 20)), `first moment on the Queue tab: "${first.nowText}" (before the tap the screen had "${prev}")`)
    const head = await text(page, '.now-head')
    note('project', `a song projected from Songs is live but not a queue row: the phone's head line reads "${head.replace(/\s+/g, ' ')}"; computer live row: ${srv.activeIndex}`)
    const canOpenLive = await page.evaluate(() => { const card = document.querySelector('.now-card.perf'); return !!(card && card.getAttribute('onclick')) })
    c.ok('project: the live song can be opened from the live view to jump to a verse', canOpenLive, `the live card ${canOpenLive ? 'opens' : 'does not open'} the song when it was projected from Songs`)
    // Next / Back
    const s1 = (await H.server()).onScreen
    await page.locator('#next-p').tap(); await sleep(1600); v = await H.view(page); srv = await H.server()
    c.ok('project: Next moves the screen one page and the phone shows it', srv.onScreen !== s1 && /verse 2/.test(srv.onScreen) && same(v, srv), `"${s1}" → "${srv.onScreen}"; phone "${v.nowText}"`)
    await page.locator('#prev-p').tap(); await sleep(1600); v = await H.view(page); srv = await H.server()
    c.ok('project: Back moves the screen one page back and the phone shows it', /verse 1/.test(srv.onScreen) && same(v, srv), `"${srv.onScreen}"; phone "${v.nowText}"`)
    const nb = await page.locator('#next-p').boundingBox()
    await page.touchscreen.tap(nb.x + 20, nb.y + 20); await page.touchscreen.tap(nb.x + 20, nb.y + 20); await sleep(1600); srv = await H.server()
    note('project', `a double tap on Next from verse 1 lands on "${srv.onScreen}"`)
    // Hide screen
    await page.locator('#blank-p').tap(); await sleep(1600); v = await H.view(page); srv = await H.server(); vSecond = await H.view(other)
    const lab = await text(page, '#blank-p'), st = await text(page, '.now-head'), st2 = await text(other, '.now-head')
    c.ok('project: Hide screen hides it on the computer and both phones say so', srv.blanked && /Show screen/.test(lab) && /HIDDEN FROM SCREEN/.test(st) && /HIDDEN FROM SCREEN/.test(st2), `computer hidden ${srv.blanked}; button "${lab}"; phone "${st.replace(/\s+/g, ' ')}"; second phone "${st2.replace(/\s+/g, ' ')}"`)
    await page.locator('#blank-p').tap(); await sleep(1500)
    c.ok('project: Show screen brings it back', !(await H.server()).blanked, '')
    // the congregation screen is closed on the computer, then a phone projects
    await env.p.ev('window.electronAPI.closeProjection()'); await sleep(1500)
    const closed = await H.server()
    await H.openSong(page, 'search', 'Evening Song'); await page.locator(V('.btn-project')).first().tap(); await sleep(4500)
    v = await H.view(page); srv = await H.server()
    c.ok('project: with the congregation screen closed on the computer, projecting from the phone opens it and goes live', /^Evening Song/.test(srv.onScreen || '') && same(v, srv), `before: on screen "${closed.onScreen}"; after: computer "${srv.onScreen}", phone "${v.nowText}" ${v.toast ? '(says "' + v.toast + '")' : ''}`)
    await env.p.ev('window.electronAPI.openProjection()'); await sleep(2000)
    await page.context().close(); await other.context().close()
  },

  /* ── searching while something is live ─────────────────────── */
  async search() {
    await seed(); await projectQueued('Morning Song')
    const page = await H.phone({ engine: ENG, role: 'Preacher' })
    const live0 = (await H.server()).onScreen
    await H.tapTab(page, 'songs')
    const input = page.locator(V('#songInput, #songInputT')).first()
    await input.tap(); await page.keyboard.type('Riv', { delay: 60 }); await sleep(3300) // three polls pass
    let st = await page.evaluate(() => ({ focused: document.activeElement && document.activeElement.id, value: (document.activeElement || {}).value }))
    c.ok('search: typing in the song search is not disturbed by the live updates', /songInput/.test(st.focused || '') && st.value === 'Riv', `focus ${st.focused}, text "${st.value}"`)
    let v = await H.view(page)
    const bar = await text(page, '.livebar')
    c.ok('search: the live item stays visible and Next stays reachable while searching', /Morning Song/.test(bar) && v.nextReachable, `live bar "${bar.replace(/\s+/g, ' ').slice(0, 50)}", Next ${v.nextReachable ? 'reachable' : 'covered'}`)
    c.ok('search: typing puts nothing on the screen', (await H.server()).onScreen === live0, '')
    await page.locator('#next-p').tap(); await sleep(1500)
    const bar2 = await text(page, '.livebar')
    c.ok('search: Next from the search view moves the screen and the live bar follows', /verse 2/.test((await H.server()).onScreen) && /verse 2/.test(bar2), `live bar "${bar2.replace(/\s+/g, ' ').slice(0, 50)}"`)
    // fast typing: the last word wins
    await input.fill(''); await page.keyboard.type('Evening', { delay: 15 }); await sleep(1500)
    const rows = await page.locator(V('.song-row')).allInnerTexts()
    c.ok('search: fast typing ends on the results for the whole word', rows.length > 0 && rows.every((r) => /Evening/i.test(r) || /Matched in lyrics/.test(r)), `${rows.length} result(s), first "${(rows[0] || '').split('\n')[0]}"`)
    await input.fill('zzqqxv'); await sleep(1200)
    c.ok('search: no song found says so', /No songs found/.test(await text(page, '#songsBody, #songsBodyT')), '')
    await page.route('**/api/search/songs?q=R*', (r) => r.abort()); await input.fill('River'); await sleep(1500)
    const lost = await text(page, '#songsBody, #songsBodyT')
    c.ok('search: a song search that cannot reach the computer says so', /Couldn.t reach BORN/.test(lost), `"${lost.slice(0, 70)}"`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }); await input.fill(''); await sleep(300); await input.fill('River'); await sleep(1200)
    await page.locator(V('.song-row')).filter({ hasText: 'River Song' }).first().tap(); await sleep(800)
    v = await H.view(page)
    c.ok('search: tapping a result opens the song without projecting it', v.sheetOpen && /verse 2/.test((await H.server()).onScreen), `${H.where(v)}`)
    await page.evaluate(() => closeSheet())
    // Bible: half-typed text survives the polls; what a tab switch does to it
    await H.tapTab(page, 'bible')
    const bi = page.locator(V('#bibleInput, #bibleInputT')).first()
    await bi.tap(); await page.keyboard.type('John 3', { delay: 50 }); await sleep(2500)
    st = await page.evaluate(() => ({ focused: document.activeElement && document.activeElement.id, value: (document.activeElement || {}).value }))
    c.ok('search: half-typed Bible text is not disturbed by the live updates', /bibleInput/.test(st.focused || '') && st.value === 'John 3', `focus ${st.focused}, text "${st.value}"`)
    await H.tapTab(page, 'queue'); await H.tapTab(page, 'bible')
    const kept = await bi.inputValue()
    c.ok('search: half-typed Bible text is still there after a look at the Queue', kept === 'John 3', `text after coming back: "${kept}"`)
    await bi.fill('John 3:16'); await page.keyboard.press('Enter'); await sleep(1800)
    c.ok('search: a Bible reference finds the passage', /John 3:16/.test(await text(page, '.ritem .rtitle')), '')
    await bi.fill('qqzzxv'); await page.keyboard.press('Enter'); await sleep(1800)
    c.ok('search: no Bible match says so', /No matches/.test(await text(page, '#bibleBody, #bibleBodyT')), `"${(await text(page, '#bibleBody, #bibleBodyT')).slice(0, 60)}"`)
    await H.tapTab(page, 'sermons')
    await page.locator(V('#sermonInput, #sermonInputT')).first().fill('qqzzxv'); await page.keyboard.press('Enter'); await sleep(2500)
    c.ok('search: no sermon match says so', /No results/.test(await text(page, '#sermonResultsBox, #sermonResultsBoxT')), '')
    await page.context().close()
  },

  /* ── songs ─────────────────────────────────────────────────── */
  async songs() {
    await seed(); await H.cmd({ action: 'update-song-key', songId: env.ids['River Song'], key: null })
    const page = await H.phone({ engine: ENG, role: 'Song Leader' })
    await H.openSong(page, 'search', 'River Song'); await page.locator(V('.btn-project')).first().tap(); await sleep(2600)
    await H.tapTab(page, 'songs'); await page.locator(V('#songInput, #songInputT')).first().fill(''); await sleep(1500)
    let recent = await page.locator(V('.recent-item')).allInnerTexts()
    c.ok('songs: a song just projected is in Recently played when Songs is opened next', recent.some((r) => /River Song/.test(r)), `Recently played: ${JSON.stringify(recent.slice(0, 4))}`)
    const srvRecent = (await H.j('/api/songs/recent')).map((r) => r.title)
    note('songs', `the computer's recent list: ${JSON.stringify(srvRecent.slice(0, 4))}`)
    // Change key on a queued song
    await H.openSong(page, 'search', 'River Song')
    await page.locator(V('.key-edit-btn')).first().tap(); await sleep(900)
    const title = await text(page, '#sheetBody .sheet-title')
    await page.locator(V('.key-chip')).filter({ hasText: /^D$/ }).first().tap(); await sleep(1800)
    const meta = await text(page, '.sheet-meta.song')
    c.ok('songs: Change key opens "Set key", and the key chosen shows on the song', /Set key/.test(title) && /Key of D/.test(meta), `sheet "${title}", song line "${meta}"`)
    await page.evaluate(() => closeSheet()); await sleep(1200)
    const srv = await H.server()
    const qrow = srv.raw.queue.find((q) => q.title === 'River Song')
    c.ok('songs: the same song already in the queue shows the new key', !!qrow && /D/.test(qrow.subtitle || ''), `queue row subtitle: "${qrow ? qrow.subtitle : 'missing'}"`)
    await H.cmd({ action: 'queue-song', songId: env.ids['River Song'] }); await sleep(1000)
    const again = (await H.server()).raw.queue.filter((q) => q.title === 'River Song').map((q) => q.subtitle)
    note('songs', `the same song queued again after the change: its two rows read ${JSON.stringify(again)}`)
    // a very long song: the buttons stay in reach, every page can be jumped to
    await H.openSong(page, 'search', 'The Long Road Song')
    const long = await page.evaluate(() => { const s = document.getElementById('sheetBody'); const b = s.querySelector('.btn-project').getBoundingClientRect(); return { rows: s.querySelectorAll('.slide-row').length, chips: s.querySelectorAll('.jumpchips button').length, projectInView: b.top >= 0 && b.bottom <= innerHeight, scrolls: s.scrollHeight > s.clientHeight } })
    c.ok('songs: a 30-verse song lists every verse and keeps Project in view', long.rows === 30 && long.projectInView, JSON.stringify(long))
    await page.locator(V('.slide-row')).nth(24).scrollIntoViewIfNeeded(); await page.locator(V('.slide-row')).nth(24).tap(); await sleep(2600)
    const v = await H.view(page), s2 = await H.server()
    c.ok('songs: tapping verse 25 of the long song puts verse 25 on the screen and the phone on the live view', /verse 25/.test(s2.onScreen || '') && H.onLiveView(v), `computer "${s2.onScreen}"; ${H.where(v)}`)
    // stepping page by page to the end, and one more
    for (let i = 0; i < 6; i++) { await page.locator('#next-p').tap(); await sleep(450) }
    await sleep(1200)
    const s3 = await H.server(), v3 = await H.view(page)
    c.ok('songs: Next past the last verse leaves the screen and the phone agreeing', (v3.nowText || '').slice(0, 24) === (s3.onScreen || '').slice(0, 24), `computer "${s3.onScreen}", phone "${v3.nowText}", next card "${(await text(page, '.next-card')).replace(/\s+/g, ' ').slice(0, 60)}"`)
    await page.context().close()
  },

  /* ── Bible ─────────────────────────────────────────────────── */
  async bible() {
    await seed()
    const page = await H.phone({ engine: ENG, role: 'Preacher' })
    await H.tapTab(page, 'bible')
    const books = await page.locator(V('.book-chip')).count()
    c.ok('bible: all 66 books are listed', books === 66, `${books} books`)
    await page.evaluate(() => pickBook(19)); await sleep(400)
    const chapters = await page.locator(V('.chapter-chip')).count()
    c.ok('bible: Psalms lists 150 chapters', chapters === 150, `${chapters}`)
    await page.route('**/api/bible/chapter*', (r) => r.abort())
    await page.locator(V('.chapter-chip')).nth(22).tap(); await sleep(1500)
    const failed = await text(page, '#bibleBody, #bibleBodyT')
    c.ok('bible: a chapter that cannot load says so with Try again', /Couldn.t load this from BORN/.test(failed) && /Try again/.test(failed), `"${failed.replace(/\s+/g, ' ').slice(0, 70)}"`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.locator(V('.retrybtn')).first().tap(); await sleep(1500)
    const verses = await page.locator(V('.verse-row')).count()
    c.ok('bible: Try again loads the chapter', verses === 6, `${verses} verses in Psalm 23`)
    await page.locator(V('.backbtn')).first().tap(); await sleep(300)
    c.ok('bible: the back arrow returns to the chapters', await page.locator(V('.chapter-chip')).count() === 150, '')
    const controls = await page.evaluate(() => ({ read: [...document.querySelectorAll('button')].filter((b) => /^Read$/i.test(b.innerText.trim())).length, textSize: [...document.querySelectorAll('button,[role=slider],input[type=range]')].filter((b) => /text size|A\+|A-/i.test((b.innerText || '') + (b.getAttribute('aria-label') || '') + (b.title || ''))).length }))
    note('bible', `controls named Read: ${controls.read}; Text size controls: ${controls.textSize} (the phone page has neither)`)
    await page.context().close()
  },

  /* ── File: Save, New service, Open (Operator) ──────────────── */
  async file() {
    await seed(); await projectQueued('Morning Song')
    const page = await H.phone({ engine: ENG, role: 'Operator' })
    page.on('dialog', (d) => d.accept())
    await page.locator(V('.filebtn')).filter({ hasText: 'Save' }).tap(); await sleep(400)
    await page.locator('#saveNameInput').fill('Review service'); await page.locator(V('#sheetBody .btn-project')).tap(); await sleep(1500)
    let v = await H.view(page)
    c.ok('file: Save says Saved once the computer has saved it', /Saved .Review service/.test(v.toast || '') && !v.sheetOpen, `says "${v.toast}"`)
    await page.locator(V('.filebtn')).filter({ hasText: 'Save' }).tap(); await sleep(400)
    await page.locator('#saveNameInput').fill('Review service'); await page.locator(V('#sheetBody .btn-project')).tap(); await sleep(1500)
    c.ok('file: saving under a name already used asks first', /already exists/.test(await text(page, '#sheetBody')), '')
    await page.locator('#saveAskCancel').tap(); await sleep(300)
    await page.locator(V('.filebtn')).filter({ hasText: 'File' }).tap(); await sleep(300)
    await page.locator(V('#sheetBody .role-chip')).filter({ hasText: 'New service' }).tap(); await sleep(1800)
    let srv = await H.server(); v = await H.view(page)
    const head = await text(page, '.now-head')
    const nowBox = (await text(page, '#queuePerfNow')).replace(/\s+/g, ' ').slice(0, 40), btn = await text(page, '#blank-p')
    c.ok('file: New service empties the queue and hides the screen', srv.queue.length === 0 && srv.blanked, `queue ${srv.queue.length}, hidden ${srv.blanked}; the phone reads "${head.replace(/\s+/g, ' ') || nowBox}" and its button "${btn}"`)
    await page.locator('#blank-p').tap(); await sleep(1600); srv = await H.server()
    c.ok('file: after New service, Show screen does not put the old service\'s last page back up', !srv.onScreen, `after one tap on "${btn}" the computer reports on screen: "${srv.onScreen}"; the phone reads "${(await text(page, '.now-head')).replace(/\s+/g, ' ')}"`)
    await H.cmd({ action: 'blank' }); await sleep(600)
    await page.locator(V('.filebtn')).filter({ hasText: 'File' }).tap(); await sleep(300)
    await page.locator(V('#sheetBody .role-chip')).filter({ hasText: 'Open a saved service' }).tap(); await sleep(1200)
    const saved = await H.j('/api/services/recent')
    c.ok('file: Open lists the saved service', /Review service/.test(await text(page, '#savedListBody')), `${saved.length} saved`)
    // the file goes away on the computer between the list and the tap
    const f = saved.find((x) => x.name === 'Review service')
    if (f) fs.renameSync(f.path, f.path + '.moved')
    const stop = H.toasts(page)
    await page.locator(V('.saved-item')).filter({ hasText: 'Review service' }).tap(); await sleep(1800)
    const said = stop(); srv = await H.server()
    c.ok('file: opening a saved service that cannot be opened does not say Loaded', srv.queue.length > 0 || !/Loaded/.test(said), `the phone says "${said}"; the queue on the computer has ${srv.queue.length} items`)
    if (f) fs.renameSync(f.path + '.moved', f.path)
    await page.evaluate(() => { closeSheet(); openSavedSheet() }); await sleep(1200)
    await page.locator(V('.saved-item')).filter({ hasText: 'Review service' }).tap(); await sleep(2000)
    srv = await H.server()
    c.ok('file: opening the saved service brings its items back', srv.queue.length === 4, `queue: ${srv.queue.join(' | ')}`)
    // Remove's five seconds: the phone is closed before they are up
    await page.locator(V('.filebtn')).filter({ hasText: 'Edit' }).tap(); await sleep(400)
    await page.locator(V('.qitem--editable')).nth(1).locator('[aria-label="Remove"]').tap(); await sleep(1500)
    await page.context().close(); await sleep(5500)
    srv = await H.server()
    note('file', `Remove, then the phone's page closed inside its 5 s Undo time: the queue on the computer still has ${srv.queue.length} items (the removal was never sent)`)
  },

  /* ── roles ─────────────────────────────────────────────────── */
  async roles() {
    await seed(); await projectQueued('Morning Song')
    const seen = {}
    for (const role of ['Operator', 'Song Leader', 'Preacher', '']) {
      const page = await H.phone({ engine: ENG, role })
      seen[role || 'skipped'] = await page.evaluate(() => ({ header: [...document.querySelectorAll('#view-queue .filebtn')].map((b) => b.innerText.trim()), transport: ['prev-p', 'next-p', 'blank-p'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 }), tabs: [...document.querySelectorAll('.tab')].map((t) => t.innerText.trim()) }))
      await page.context().close()
    }
    c.ok('roles: only the Operator sees File, Save and Edit on the queue', seen.Operator.header.length === 3 && seen['Song Leader'].header.length === 0 && seen.Preacher.header.length === 0 && seen.skipped.header.length === 0, JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.header]))))
    c.ok('roles: every role has Back, Next, Hide screen and all four tabs', Object.values(seen).every((s) => s.transport && s.tabs.length === 4), '')
    // the first-run question, and what it covers
    const fresh = await H.phone({ engine: ENG, role: null })
    const ov = await fresh.evaluate(() => ({ role: document.getElementById('roleOverlay').classList.contains('active'), chips: [...document.querySelectorAll('#roleGrid .role-chip')].map((b) => b.innerText.trim()) }))
    c.ok('roles: a first visit asks "Who\'s this?" with the three roles and Other', ov.role && ov.chips.join() === 'Song Leader,Preacher,Operator,Other…', JSON.stringify(ov))
    await fresh.locator(V('.role-chip')).filter({ hasText: 'Preacher' }).tap(); await sleep(600)
    c.ok('roles: choosing a role is confirmed', /Contributing as Preacher/.test((await H.view(fresh)).toast || ''), '')
    await fresh.context().close()
    // a role is a label: what the computer does with a queue change sent by a phone that is not the Operator
    const s0 = await H.server()
    const status = await H.cmd({ action: 'remove', id: s0.ids[s0.queue.indexOf('River Song')], contributor: { deviceId: 'dev-x', label: 'Preacher' } }); await sleep(900)
    const s1 = await H.server()
    note('roles', `a remove sent as "Preacher" was answered ${status} and the row is ${s1.queue.includes('River Song') ? 'still there' : 'gone'}: roles change what a phone shows, the computer does not check them`)
    // a tap the computer cannot act on: project a row that no longer exists
    const gone = await H.cmd({ action: 'project', id: 'no-such-row' })
    note('roles', `a Project for a row that is not in the queue was answered ${gone}: the phone cannot tell it from a tap that worked`)
    c.ok('roles: a tap the computer cannot act on is answered as a failure', gone >= 400, `answered ${gone}`)
  }
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  env = await H.start()
  try {
    for (const [name, fn] of Object.entries(FLOWS)) {
      if (ONLY.length && !ONLY.includes(name)) continue
      try { await fn() } catch (e) { c.ok(`${name}: the flow ran to its end`, false, String(e && e.message || e).split('\n')[0].slice(0, 200)) }
    }
  } finally {
    const r = c.done()
    fs.writeFileSync(path.join(out, `flows-${ENG}.json`), JSON.stringify({ engine: ENG, failed: r.failed, checks: r.rows, notes }, null, 1))
    await H.closeBrowsers(); await env.kill()
  }
})()
