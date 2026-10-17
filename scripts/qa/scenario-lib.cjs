/* Scenario recorder: every state a live scenario passes through is captured (texts for the coverage census, a screenshot kept local, and the sweep checks run on it) so scenarios count toward coverage. */
const fs = require('fs'), path = require('path')
const { ROOT } = require('./lib.cjs')
const checks = fs.readFileSync(path.join(__dirname, 'checks.js'), 'utf8')
const TEXTS = `(() => { const t = new Set(); const add = (s) => { s = (s || '').replace(/\\s+/g, ' ').trim().toLowerCase(); if (s && s.length < 160) t.add(s) }
  document.querySelectorAll('*').forEach((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; ['aria-label', 'title', 'placeholder'].forEach((a) => add(e.getAttribute(a))); if (e.children.length === 0) add(e.textContent) })
  return [...t] })()`
exports.recorder = (name) => {
  const dir = path.join(ROOT, 'qa-out', 'scenarios', name); fs.mkdirSync(dir, { recursive: true })
  const file = path.join(ROOT, 'qa-out', `census-runtime-scenarios-${name}.json`)
  const R = { profile: 'scenario-' + name, states: [], texts: new Set(), findings: [], notes: [] }
  const save = () => fs.writeFileSync(file, JSON.stringify({ profile: R.profile, states: R.states, texts: [...R.texts], findings: R.findings, notes: R.notes }, null, 1))
  return {
    note: (m) => { R.notes.push(m); console.log('  •', m) },
    async capture(page, id, note, opts = {}) {
      const texts = await page.ev(TEXTS); texts.forEach((t) => R.texts.add(t))
      try { await page.key('Tab'); await page.key('Tab', { shift: true }) } catch { /* keyboard modality for :focus-visible */ }
      let f = []; try { f = await page.ev(checks) } catch (e) { f = [{ check: 'harness-error', sev: 'P2', sel: id, text: String(e).slice(0, 100), detail: '' }] }
      for (const x of f) R.findings.push({ ...x, state: name + ':' + id, note })
      for (const l of page.takeLogs()) R.findings.push({ check: 'console', sev: /exception|error/.test(l.kind) ? 'P1' : 'P2', sel: l.kind, text: l.text, detail: '', state: name + ':' + id, note })
      R.states.push({ id, sig: { heads: [], tabs: [], rail: [], pop: [] }, path: [note], depth: 0, texts: texts.length })
      if (opts.shot !== false) { try { await page.shot(path.join(dir, id + '.png')) } catch { /* ok */ } }
      save()
      return f
    },
    save
  }
}
