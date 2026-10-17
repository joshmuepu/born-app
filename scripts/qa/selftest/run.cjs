#!/usr/bin/env node
/* Proves the sweep checks actually detect what they claim to: opens a page with known defects in headless Chrome and verifies every planted defect is reported (and the healthy button is not). */
const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs')
const { Page, sleep, getJson } = require('../lib.cjs')
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
;(async () => {
  const port = 9899
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/qa-selftest-chrome', 'file://' + path.join(__dirname, 'defects.html')], { stdio: 'ignore' })
  let t = null
  for (let i = 0; i < 40 && !t; i++) { await sleep(500); try { t = (await getJson(`http://127.0.0.1:${port}/json`)).find((x) => x.type === 'page') } catch { /* not up yet */ } }
  const page = await new Page(t).connect()
  await page.viewport(800, 600)
  await page.key('Tab'); await page.key('Tab', { shift: true })
  const f = await page.ev(fs.readFileSync(path.join(__dirname, '..', 'checks.js'), 'utf8'))
  const has = (check, text) => f.some((x) => x.check === check && (!text || (x.sel + ' ' + x.text).includes(text)))
  const want = [['contrast', 'lowc'], ['target-small', 'tiny'], ['no-accessible-name', 'noname'], ['text-clipped', 'clip'], ['truncated-no-tooltip', 'ell'], ['overlap', 'ov1'], ['raw-value-text', 'undefined'], ['page-h-scroll', ''], ['no-focus-indicator', 'nofocus'], ['dialog-no-name', 'dlg']]
  let bad = 0
  for (const [c, t2] of want) { const ok = has(c, t2); if (!ok) bad++; console.log((ok ? 'detected  ' : 'MISSED    ') + c + (t2 ? ' (' + t2 + ')' : '')) }
  const falsePos = f.some((x) => (x.sel + x.text).includes('Fine button') || x.sel.includes('#ok'))
  console.log(falsePos ? 'FALSE POSITIVE on the healthy button' : 'healthy button not flagged'); if (falsePos) bad++
  page.close(); proc.kill()
  process.exit(bad ? 1 : 0)
})()
