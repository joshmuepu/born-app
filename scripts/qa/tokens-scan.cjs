#!/usr/bin/env node
/* Static design-token audit: colour literals, off-scale font sizes and radii in renderer CSS/TSX that are not tokens. Prints counts per file and writes qa-out/tokens-scan.json. */
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')
const walk = (d, o = []) => { for (const n of fs.readdirSync(path.join(ROOT, d))) { const p = path.join(d, n); const st = fs.statSync(path.join(ROOT, p)); if (st.isDirectory()) walk(p, o); else o.push(p) } return o }
const files = walk('src/renderer/src').filter((f) => /\.(css|tsx)$/.test(f))
const rows = []
for (const f of files) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')
  let inTokens = false
  lines.forEach((ln, i) => {
    if (/^\s*:root\b|^\s*html\[data-(theme|contrast)/.test(ln) && f.endsWith('App.css')) inTokens = true
    if (inTokens && /^\}/.test(ln)) { inTokens = false; return }
    if (inTokens) return
    if (/^\s*(\/\*|\*)/.test(ln)) return
    for (const m of ln.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) {
      if (/var\(--/.test(ln) && /rgba?\(0,\s*0,\s*0|rgba?\(255,\s*255,\s*255/.test(m[0])) continue
      rows.push({ file: f, line: i + 1, kind: 'colour', value: m[0], ctx: ln.trim().slice(0, 90) })
    }
    for (const m of ln.matchAll(/border-radius:\s*(\d+px)/g)) rows.push({ file: f, line: i + 1, kind: 'radius', value: m[1], ctx: ln.trim().slice(0, 90) })
    for (const m of ln.matchAll(/font-size:\s*(\d+(?:\.\d+)?px)/g)) rows.push({ file: f, line: i + 1, kind: 'font-size', value: m[1], ctx: ln.trim().slice(0, 90) })
  })
}
const by = {}; for (const r of rows) { const k = r.file + ' ' + r.kind; by[k] = (by[k] || 0) + 1 }
fs.mkdirSync(path.join(ROOT, 'qa-out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'qa-out', 'tokens-scan.json'), JSON.stringify(rows, null, 1))
const tot = {}; for (const r of rows) tot[r.kind] = (tot[r.kind] || 0) + 1
console.log('non-token literals:', JSON.stringify(tot)); console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => v + '  ' + k).join('\n'))
