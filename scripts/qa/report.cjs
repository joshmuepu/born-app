#!/usr/bin/env node
/* Merges qa-out/sweep-<round>/*.json (+ scenario findings) into docs/qa/final-qa/sweep-<round>.md and prints the summary.   node scripts/qa/report.cjs <round> */
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')
const round = process.argv[2] || '1'
const dir = path.join(ROOT, 'qa-out', 'sweep-' + round)
const all = new Map()
const take = (f, src) => { const key = [f.check, f.sel, f.text].join('|'); const e = all.get(key) || { ...f, variants: [], states: [], srcs: new Set() }; (f.variants || []).forEach((v) => !e.variants.includes(v) && e.variants.push(v)); (f.states || (f.state ? [f.state] : [])).forEach((s) => !e.states.includes(s) && e.states.push(s)); e.srcs.add(src); all.set(key, e) }
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'merged.json') : []) { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); for (const x of j.findings) take(x, f) }
for (const f of fs.readdirSync(path.join(ROOT, 'qa-out')).filter((x) => /^census-runtime-scenarios-.*\.json$/.test(x))) { const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa-out', f), 'utf8')); for (const x of j.findings || []) take(x, f) }
const arr = [...all.values()]
const sevRank = { P0: 0, P1: 1, P2: 2 }
arr.sort((a, b) => sevRank[a.sev] - sevRank[b.sev] || a.check.localeCompare(b.check))
const byCheck = {}; for (const e of arr) { const k = e.sev + ' ' + e.check; byCheck[k] = (byCheck[k] || 0) + 1 }
const lines = [`# Sweep ${round}`, '', `Distinct findings: **${arr.length}** (${['P0', 'P1', 'P2'].map((s) => s + ' ' + arr.filter((e) => e.sev === s).length).join(', ')})`, '', '| Sev | Check | Count |', '|---|---|---|', ...Object.entries(byCheck).sort().map(([k, v]) => { const [s, ...c] = k.split(' '); return `| ${s} | ${c.join(' ')} | ${v} |` }), '', '## Findings', '', '| Sev | Check | Where (selector) | Text | Detail | Variants | States |', '|---|---|---|---|---|---|---|']
for (const e of arr) lines.push(`| ${e.sev} | ${e.check} | \`${(e.sel || '').replace(/\|/g, '/')}\` | ${(e.text || '').replace(/\|/g, '/').slice(0, 50)} | ${(e.detail || '').replace(/\|/g, '/').slice(0, 60)} | ${(e.variants || []).slice(0, 4).join(',')}${(e.variants || []).length > 4 ? '…' : ''} | ${e.states.length} |`)
fs.mkdirSync(path.join(ROOT, 'docs/qa/final-qa'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'docs/qa/final-qa', `sweep-${round}.md`), lines.join('\n') + '\n')
fs.writeFileSync(path.join(dir, 'merged.json'), JSON.stringify(arr.map((e) => ({ ...e, srcs: [...e.srcs] })), null, 1))
console.log(lines.slice(0, 4 + Object.keys(byCheck).length + 4).join('\n'))
