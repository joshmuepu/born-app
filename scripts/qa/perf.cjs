#!/usr/bin/env node
/* Performance numbers on a given profile: startup to a usable window, section switch latency, sermon search latency, idle CPU, memory now and after a navigation soak (growth).
 *   node scripts/qa/perf.cjs <profileDir> <label> [port] [soakRounds]   -> prints JSON and appends to qa-out/perf.jsonl     Don't run anything heavy at the same time.   */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process')
const { launch, sleep, ROOT } = require('./lib.cjs')
const [profile = '/tmp/qa-populated', label = 'run', port = '9996', soak = '30'] = process.argv.slice(2)
const rss = (pid) => { try { const kids = execSync(`pgrep -P ${pid} || true`).toString().split('\n').filter(Boolean); let t = 0; for (const p of [pid, ...kids, ...kids.flatMap((k) => execSync(`pgrep -P ${k} || true`).toString().split('\n').filter(Boolean))]) t += +execSync(`ps -o rss= -p ${p} 2>/dev/null || echo 0`).toString().trim() || 0; return Math.round(t / 1024) } catch { return 0 } }
const cpu = (pid) => { try { const all = [pid, ...execSync(`pgrep -P ${pid} || true`).toString().split('\n').filter(Boolean)]; let t = 0; for (const p of all) t += parseFloat(execSync(`ps -o %cpu= -p ${p} 2>/dev/null || echo 0`).toString().trim()) || 0; return t } catch { return 0 } }
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
;(async () => {
  const t0 = Date.now()
  const app = await launch({ profile, port: +port, remotePort: 4470 + (+port % 20), mdns: 'born-qa-perf', settle: 800, timeout: 60000, env: { BORN_TEST_NO_AUTO_TIMING: '1' } })
  const page = await app.page(); await page.viewport(1366, 768)
  await page.waitFor(`!!document.querySelector('nav.app-rail button') && document.readyState==='complete'`, 30000)
  const startupMs = Date.now() - t0
  await sleep(8000) // let first-start work (indexer, auto-timing delay) settle before measuring
  const pid = app.proc.pid
  const switches = []
  for (const sec of ['Bible', 'Songs', 'Media', 'Tape', 'Sermons', 'Bible', 'Songs', 'Media', 'Tape', 'Sermons']) {
    const t = await page.ev(`new Promise((res) => { const t0 = performance.now(); const b = [...document.querySelectorAll('nav button')].find(x => (x.getAttribute('aria-label') || x.innerText).trim().startsWith(${JSON.stringify(sec)})); b.click(); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0))) })`)
    switches.push(t); await sleep(400)
  }
  // search latency: type into the sermon search and wait for results
  await page.click('Sermons'); await sleep(600)
  const sLat = []
  for (const q of ['holy spirit', 'faith', 'the lord']) {
    await page.ev(`(() => { const i = document.querySelector('input[placeholder^="Search for a word"]'); i.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    const t = await page.ev(`new Promise((res) => { const i = document.querySelector('input[placeholder^="Search for a word"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const t0 = performance.now(); set.call(i, ${JSON.stringify(q)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); const iv = setInterval(() => { const r = document.querySelectorAll('[class*=result], [role=listitem], li').length; if (r > 3 || performance.now() - t0 > 8000) { clearInterval(iv); res(performance.now() - t0) } }, 20) })`)
    sLat.push(t); await sleep(600)
  }
  // idle CPU over 20 s
  const cpuSamples = []; for (let i = 0; i < 10; i++) { cpuSamples.push(cpu(pid)); await sleep(2000) }
  const memStart = rss(pid), nodes0 = await page.ev('document.getElementsByTagName("*").length')
  for (let i = 0; i < +soak; i++) for (const sec of ['Bible', 'Songs', 'Media', 'Tape', 'Sermons']) { await page.click(sec); await sleep(120) }
  await sleep(3000)
  const memEnd = rss(pid), nodes1 = await page.ev('document.getElementsByTagName("*").length')
  await page.click('Songs'); await sleep(500)
  const songs = await page.ev(`new Promise((res) => { const t0 = performance.now(); const b = [...document.querySelectorAll('button,a')].find((x) => /browse all songs/i.test(x.innerText)); b.click(); const iv = setInterval(() => { if (/All Songs/.test(document.body.innerText) || performance.now() - t0 > 8000) { clearInterval(iv); res(Math.round(performance.now() - t0)) } }, 10) })`)
  const out = { label, songsBrowseMs: songs, profile: path.basename(profile), startupMs, switchMsMedian: Math.round(median(switches) * 10) / 10, switchMsMax: Math.round(Math.max(...switches)), searchMsMedian: Math.round(median(sLat)), searchMs: sLat.map(Math.round), idleCpuPctOfOneCore: Math.round(median(cpuSamples) * 10) / 10, rssMB: memStart, rssAfterSoakMB: memEnd, soakRounds: +soak, domNodes: nodes0, domNodesAfter: nodes1 }
  console.log(JSON.stringify(out)); fs.appendFileSync(path.join(ROOT, 'qa-out', 'perf.jsonl'), JSON.stringify(out) + '\n')
  page.close(); await app.kill()
})().catch((e) => { console.error(e); process.exit(1) })
