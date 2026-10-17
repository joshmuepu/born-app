#!/usr/bin/env node
/* Phase 2: the sweep. Re-opens every surface the crawl found (its click path) in every variant (theme × contrast × window size × interface scale) and runs scripts/qa/checks.js on it,
 * capturing a screenshot (local only, qa-out/). Findings are de-duplicated across variants.
 *   node scripts/qa/sweep.cjs <profileDir> <crawlName> [port] [shard/of] [variants]
 *   variants: "all" (default) or a comma list of names.   -> qa-out/sweep-<n>/<crawlName>-<shard>.json
 */
const fs = require('fs'), path = require('path')
const { launch, sleep, ROOT } = require('./lib.cjs')
const [profile = '/tmp/qa-populated', crawlName = 'qa-populated', port = '9970', shardArg = '1/1', variantArg = 'all', round = process.env.QA_ROUND || '1'] = process.argv.slice(2)
const VARIANTS = [
  { name: 'dark', theme: 'dark', hc: false, w: 1366, h: 768, scale: 1, dsf: 1 },
  { name: 'light', theme: 'light', hc: false, w: 1366, h: 768, scale: 1, dsf: 1 },
  { name: 'dark-hc', theme: 'dark', hc: true, w: 1366, h: 768, scale: 1, dsf: 1 },
  { name: 'light-hc', theme: 'light', hc: true, w: 1366, h: 768, scale: 1, dsf: 1 },
  { name: 'narrow', theme: 'dark', hc: false, w: 1040, h: 640, scale: 1, dsf: 1 },
  { name: 'full-hd', theme: 'dark', hc: false, w: 1920, h: 1080, scale: 1, dsf: 1 },
  { name: 'scale150', theme: 'dark', hc: false, w: 1366, h: 768, scale: 1.5, dsf: 1 },
  { name: 'narrow-scale175', theme: 'light', hc: false, w: 1040, h: 640, scale: 1.75, dsf: 1 },
  { name: '4k', theme: 'dark', hc: false, w: 3840, h: 2160, scale: 'auto', dsf: 1 },
  { name: 'dsf2', theme: 'dark', hc: false, w: 1366, h: 768, scale: 1, dsf: 2, optional: true }
]
const [shard, of] = shardArg.split('/').map(Number)
const wanted = variantArg === 'all' ? VARIANTS.filter((v) => !v.optional) : VARIANTS.filter((v) => variantArg.split(',').includes(v.name))
const checks = fs.readFileSync(path.join(__dirname, 'checks.js'), 'utf8')
const crawl = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa-out', `census-runtime-${crawlName}.json`), 'utf8'))
const states = crawl.states.filter((_, i) => i % of === shard - 1)
const outDir = path.join(ROOT, 'qa-out', 'sweep-' + round); fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true })

;(async () => {
  const app = await launch({ profile, port: +port, remotePort: 4400 + (+port % 50), mdns: 'born-qa-sweep' + shard })
  const page = await app.page()
  const found = new Map()
  let runs = 0
  for (const st of states) {
    for (const v of wanted) {
      try {
        await page.ev(`try { localStorage.setItem('born.uiScale', ${JSON.stringify(String(v.scale))}) } catch (e) {}`)
        await page.viewport(v.w, v.h, v.dsf)
        await page.send('Page.reload'); await sleep(2000)
        await page.ev(`(() => { document.documentElement.dataset.theme = ${JSON.stringify(v.theme)}; ${v.hc ? "document.documentElement.dataset.contrast = 'true'" : "delete document.documentElement.dataset.contrast"} })()`)
        let ok = true
        for (const label of st.path) { if (!(await page.click(label.split(' ').slice(0, 5).join(' ')))) { ok = false; break } await sleep(420) }
        if (!ok) { found.set('unreachable|' + st.id + '|' + v.name, { check: 'unreachable', sev: 'P2', sel: st.id, text: st.path.join(' > '), detail: v.name, variants: [v.name], states: [st.id] }); continue }
        await sleep(250)
        await page.key('Tab'); await page.key('Tab', { shift: true }) // keyboard modality, so :focus-visible rings can be measured
        const fs_ = await page.ev(checks)
        runs++
        for (const f of fs_) {
          const key = [f.check, f.sel, f.text].join('|')
          const e = found.get(key) || { ...f, variants: [], states: [] }
          if (!e.variants.includes(v.name)) e.variants.push(v.name)
          if (!e.states.includes(st.id)) e.states.push(st.id)
          found.set(key, e)
        }
        for (const l of page.takeLogs()) { const key = ['log', l.kind, l.text].join('|'); const e = found.get(key) || { check: 'console', sev: /exception|error/.test(l.kind) ? 'P1' : 'P2', sel: l.kind, text: l.text, detail: '', variants: [], states: [] }; if (!e.states.includes(st.id)) e.states.push(st.id); found.set(key, e) }
        if (v.name === 'dark' || v.name === 'narrow' || v.name === 'light') await page.shot(path.join(outDir, 'shots', `${crawlName}-${st.id}-${v.name}.png`), { format: 'jpeg', quality: 60 })
      } catch (e) { found.set('harness|' + st.id + '|' + v.name, { check: 'harness-error', sev: 'P2', sel: st.id, text: String(e).slice(0, 160), detail: v.name, variants: [v.name], states: [st.id] }) }
    }
    fs.writeFileSync(path.join(outDir, `${crawlName}-${shard}.json`), JSON.stringify({ shard, runs, findings: [...found.values()] }, null, 1))
  }
  console.log(`shard ${shard}/${of}: ${states.length} states × ${wanted.length} variants = ${runs} runs, ${found.size} distinct findings`)
  await page.ev(`try { localStorage.removeItem('born.uiScale') } catch (e) {}`)
  page.close(); await app.kill()
})().catch((e) => { console.error(e); process.exit(1) })
