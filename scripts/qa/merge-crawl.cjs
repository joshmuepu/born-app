#!/usr/bin/env node
/* Merges every qa-out/census-runtime-qa-pop-*.json crawl into census-runtime-merged.json, keeping ONE state per distinct surface (headings + selected tabs + open dialogs + current rail item),
 * the one with the shortest click path. The sweep then re-opens exactly these. */
const fs = require('fs'), path = require('path')
const dir = path.join(__dirname, '..', '..', 'qa-out')
const files = fs.readdirSync(dir).filter((f) => /^census-runtime-qa-pop-.*\.json$/.test(f))
const best = new Map(); const texts = new Set(); const errors = []; const noEffect = new Set(); const skipped = new Set()
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  j.texts.forEach((t) => texts.add(t)); (j.errors || []).forEach((e) => errors.push(e)); (j.noEffect || []).forEach((n) => noEffect.add(n)); (j.skipped || []).forEach((n) => skipped.add(n))
  for (const s of j.states) {
    const k = [(s.sig.heads || []).join('/'), (s.sig.tabs || []).join(','), (s.sig.pop || []).join(','), (s.sig.rail || []).join(',')].join('|')
    const cur = best.get(k)
    if (!cur || s.path.length < cur.path.length) best.set(k, { ...s, id: s.id, crawl: j.profile })
  }
}
const states = [...best.values()].map((s, i) => ({ ...s, id: 'M' + String(i + 1).padStart(3, '0'), from: s.crawl + ':' + s.id }))
fs.writeFileSync(path.join(dir, 'census-runtime-merged.json'), JSON.stringify({ profile: 'merged', states, texts: [...texts], errors, noEffect: [...noEffect], skipped: [...skipped] }, null, 1))
console.log(`crawls ${files.length} · distinct surfaces ${states.length} · texts ${texts.size} · no-effect clicks ${noEffect.size} · logged issues ${errors.length}`)
