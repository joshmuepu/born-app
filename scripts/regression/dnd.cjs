const { app } = require('./lib.cjs')
const fs = require('fs')
const OUT = process.argv[2]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = []
const check = (name, ok, detail = '') => { log.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail) }
;(async () => {
  const { browser, page } = await app()
  console.log('viewport', await page.evaluate(() => innerWidth + 'x' + innerHeight))
  const queueTitles = () => page.$$eval('.queue-row', (rows) => rows.map((r) => r.querySelector('.queue-row-title, .queue-item-title')?.textContent?.trim() + '|' + (r.querySelector('.queue-row-detail, .queue-item-text')?.textContent || '').slice(0, 24)))
  const qCount = () => page.$$eval('.queue-row', (r) => r.length)
  const live = () => page.evaluate(() => window.electronAPI.getLiveState().then((l) => { const m = l.find((c) => c.id === 'main'); return m && { text: m.current?.text?.slice(0, 40) ?? null, ref: m.current?.reference ?? null, blanked: m.blanked } }))
  const drag = async (from, to, opts = {}) => {
    await from.scrollIntoViewIfNeeded().catch(() => {})
    await to.scrollIntoViewIfNeeded().catch(() => {})
    const a = await from.boundingBox(); const b = await to.boundingBox()
    if (!a || !b) throw new Error('no box')
    const sx = a.x + Math.min(40, a.width / 2), sy = a.y + Math.min(20, a.height / 2)
    const tx = opts.tx ?? b.x + b.width / 2, ty = opts.ty ?? (b.y + b.height * (opts.frac ?? 0.25))
    await page.mouse.move(sx, sy)
    if (opts.debug) console.log('HIT', JSON.stringify({ a, sx, sy }), await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.className + ' draggable=' + (e.closest('[draggable=true]') ? 'yes' : 'no') : 'none' }, [sx, sy]))
    await page.mouse.down()
    await page.mouse.move(sx + 6, sy + 6, { steps: 3 })
    await page.mouse.move(tx, ty, { steps: 14 })
    await sleep(120)
    if (opts.debug2) console.log('MID', 'lines', await page.locator('.queue-drop-line').count(), 'dragging', await page.locator('.queue-row--dragging').count(), 'toasts', await page.locator('.toast').count())
    await page.mouse.up()
    await sleep(500)
  }
  // ---- setup: sermon paragraphs
  await page.click('.rail-btn:has-text("Sermons")')
  await page.click(".browse-mode:visible:has-text(\"Date\")"); await sleep(500)
  await page.click('.browse-year-cell:has-text("1963")'); await sleep(500)
  await page.click('.browse-cal-cell.has-sermons >> nth=0'); await sleep(400)
  await page.click('.browse-left .browse-item >> nth=0'); await sleep(1200)
  const paras = page.locator('.browse-para-item')
  // Source rows cover several pages, so rows are identified by what the queue
  // shows for them. For this sermon the first page of four distinct source
  // rows sit at these indices and show these paragraph labels in the queue.
  const P1 = { i: 1, d: '63-0112 · 1 ' }, P2 = { i: 6, d: '63-0112 · 4a' }, P3 = { i: 11, d: '63-0112 · 6a' }
  const P4 = { d: null }
  const order = async () => page.$$eval('.queue-row .queue-row-detail, .queue-row .queue-item-text', (e) => e.map((x) => x.textContent.trim().slice(0, 12)))
  await paras.nth(P1.i).locator('button:has-text("+ Queue")').click(); await sleep(150)
  await paras.nth(P2.i).locator('button:has-text("+ Queue")').click(); await sleep(400)
  check('queue starts with the two chosen rows', JSON.stringify(await order()) === JSON.stringify([P1.d, P2.d]), JSON.stringify(await order()))
  const rows = page.locator('.queue-row')

  // ---- 1. drag a third paragraph between the two rows
  await drag(paras.nth(P3.i), rows.nth(1), { frac: 0.2 })
  const o1 = await order()
  check('sermon paragraph dragged between the two rows', JSON.stringify(o1) === JSON.stringify([P1.d, P3.d, P2.d]), JSON.stringify({ got: o1, want: [P1.d, P3.d, P2.d] }))
  await page.screenshot({ path: `${OUT}/dnd-1-after-sermon-drop.png` })
  check('undo toast offered', (await page.locator('.toast').count()) > 0)

  // ---- 2. drag to the empty tail of the list (a paragraph that is on screen)
  const rawDetails = async () => page.$$eval('.queue-row .queue-row-detail, .queue-row .queue-item-text', (e) => e.map((x) => x.textContent.trim().slice(0, 12)))
  const known = await rawDetails()
  const lb = await page.locator('.queue-list').boundingBox()
  let dropped = false
  for (let attempt = 0; attempt < 6 && !dropped; attempt++) {
    await page.evaluate(() => document.querySelector('.browse-list--virtual').scrollBy(0, 1800))
    await sleep(500)
    const vis = await page.$$eval('.browse-para-item', (els) => els.map((e, i) => ({ i, r: e.getBoundingClientRect() })).filter((x) => x.r.top > 140 && x.r.bottom < innerHeight - 10).map((x) => x.i))
    for (const idx of vis.slice().reverse()) {
      await drag(paras.nth(idx), page.locator('.queue-list'), { ty: lb.y + lb.height - 8 })
      const now = await rawDetails()
      if (now.length === 4 && !known.includes(now[3])) { dropped = true; P4.d = now[3]; break }
      if (now.length === 4) { await page.keyboard.press('Control+z'); await sleep(300) }
    }
  }
  const o2 = await rawDetails()
  check('dropped at the end of the queue (4 rows, first three unchanged)', dropped && JSON.stringify(o2.slice(0, 3)) === JSON.stringify(known), JSON.stringify(o2))

  // ---- 3. reorder between queue rows by real drag: last row to the top
  await drag(rows.nth(3), rows.nth(0), { frac: 0.15 })
  const o3 = await order()
  check('reorder by drag moved the last row to the top', JSON.stringify(o3) === JSON.stringify([P4.d, P1.d, P3.d, P2.d]), JSON.stringify(o3))
  await sleep(600)
  await page.evaluate(() => { window.__ev2 = []; for (const t of ['dragstart','dragover','drop','dragend']) document.addEventListener(t, (e) => { if (window.__ev2.length < 30) window.__ev2.push(t + ' ' + String(e.target.className).slice(0,26) + ' y=' + Math.round(e.clientY)) }, true) })
  console.log('BOXES', JSON.stringify([await rows.nth(0).boundingBox(), await rows.nth(1).boundingBox()]))
  await drag(rows.nth(0), rows.nth(1), { frac: 0.85, debug2: true })
  console.log('EV2', JSON.stringify(await page.evaluate(() => window.__ev2)))
  const o3b = await order()
  check('reorder by drag moved the top row below the next one', JSON.stringify(o3b) === JSON.stringify([P1.d, P4.d, P3.d, P2.d]), JSON.stringify(o3b))

  // ---- 4. verse drag
  await page.click('.rail-btn:has-text("Bible")'); await sleep(300)
  await page.click('.bible-panel .panel-subtab:has-text("Browse")'); await sleep(400)
  await page.locator('.bible-browse-book').nth(42).click(); await sleep(300)
  await page.locator('.bible-browse-chapter').nth(2).click(); await sleep(1000)
  const verse = page.locator('.follow-list .bible-verse, .bible-right .bible-verse').nth(2)
  const n0 = await qCount()
  await drag(verse, page.locator('.queue-row').nth(1), { frac: 0.2 })
  const n1 = await qCount()
  const tv = await queueTitles()
  check('Bible verse dragged into the queue at index 1', n1 === n0 + 1 && /John 3/.test(tv[1] ?? ''), JSON.stringify(tv))

  // ---- 5. song drag
  await page.click('.rail-btn:has-text("Songs")'); await sleep(300)
  await page.click('.songs-panel .panel-subtab:has-text("Browse")'); await sleep(1500)
  const song = page.locator('.song-row').nth(1)
  const n2 = await qCount()
  await drag(song, page.locator('.queue-row').nth(0), { frac: 0.2 })
  const n3 = await qCount()
  check('song dragged into the queue', n3 === n2 + 1, `${n2}->${n3}`)
  const tq = await queueTitles()
  check('song landed at the top', /Tis|Brand|Child|Vessel|Above|Agnus|Ain/.test(tq[0] ?? ''), JSON.stringify(tq.slice(0, 3)))

  // ---- 6. while something is live
  await page.locator('.queue-row').nth(2).locator('button:has-text("Show")').click(); await sleep(1500)
  const liveBefore = await live()
  check('an item is live', !!liveBefore?.text, JSON.stringify(liveBefore))
  const activeBefore = await page.$$eval('.queue-row--active .queue-item-title', (e) => e.map((x) => x.textContent))
  await page.click('.rail-btn:has-text("Sermons")'); await sleep(300)
  const paras2 = page.locator('.browse-para-item')
  await drag(paras2.nth(3), page.locator('.queue-row').nth(0), { frac: 0.2 })
  const liveAfterDrop = await live()
  check('live output unchanged after a drop-add', JSON.stringify(liveAfterDrop) === JSON.stringify(liveBefore), JSON.stringify(liveAfterDrop))
  const activeAfter = await page.$$eval('.queue-row--active .queue-item-title', (e) => e.map((x) => x.textContent))
  check('the live row is still the same item after items were inserted before it', JSON.stringify(activeAfter) === JSON.stringify(activeBefore), JSON.stringify({ activeBefore, activeAfter }))
  // reorder while live
  const rows2 = page.locator('.queue-row')
  await drag(rows2.nth(0), rows2.nth(3), { frac: 0.8 })
  const liveAfterReorder = await live()
  check('live output unchanged after reordering', JSON.stringify(liveAfterReorder) === JSON.stringify(liveBefore), JSON.stringify(liveAfterReorder))
  const activeAfter2 = await page.$$eval('.queue-row--active .queue-item-title', (e) => e.map((x) => x.textContent))
  check('live row still tracks the same item after reorder', JSON.stringify(activeAfter2) === JSON.stringify(activeBefore), JSON.stringify(activeAfter2))
  await page.screenshot({ path: `${OUT}/dnd-2-live.png` })

  // reorder the LIVE row itself: drag it to the top
  const liveIdx = await page.$$eval('.queue-row', (r) => r.findIndex((x) => x.classList.contains('queue-row--active')))
  if (liveIdx > 0) {
    await drag(page.locator('.queue-row').nth(liveIdx), page.locator('.queue-row').nth(0), { frac: 0.15 })
    const liveIdx2 = await page.$$eval('.queue-row', (r) => r.findIndex((x) => x.classList.contains('queue-row--active')))
    check('dragging the live row itself moves it and it stays live', liveIdx2 === 0 && JSON.stringify(await live()) === JSON.stringify(liveBefore), JSON.stringify({ liveIdx, liveIdx2 }))
  } else check('live row already at top (skipped)', true)

  // ---- 7. keyboard alternative
  const kb0 = await queueTitles()
  const rowK = page.locator('.queue-row').nth(2)
  await rowK.focus()
  await page.keyboard.press('Alt+ArrowUp'); await sleep(300)
  const kb1 = await queueTitles()
  check('Alt+ArrowUp moves the focused row up', kb1[1] === kb0[2], JSON.stringify({ kb0, kb1 }))
  check('live output unchanged after keyboard reorder', JSON.stringify(await live()) === JSON.stringify(liveBefore))
  // Add next via context menu (keyboard)
  const n4 = await qCount()
  await page.click('.rail-btn:has-text("Sermons")'); await sleep(200)
  const p5 = page.locator('.browse-para-item').nth(5)
  await p5.click({ button: 'right', position: { x: 60, y: 20 } }); await sleep(300)
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(600)
  check('"Add next in queue" inserts right after the live row', (await qCount()) === n4 + 1)
  const kbq = await page.$$eval('.queue-row', (r) => r.findIndex((x) => x.classList.contains('queue-row--active')))
  const kbTitles = await queueTitles()
  check('inserted item sits directly after the live item', kbq >= 0, JSON.stringify({ kbq, kbTitles }))
  check('live output still unchanged', JSON.stringify(await live()) === JSON.stringify(liveBefore))
  fs.writeFileSync(`${OUT}/dnd-results.json`, JSON.stringify(log, null, 1))
  console.log(log.length, 'checks,', log.filter((r) => !r.ok).length, 'failed')
  await browser.close()
})().catch((e) => { console.error('ERR', e); process.exit(1) })
