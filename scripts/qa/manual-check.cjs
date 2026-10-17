#!/usr/bin/env node
/* Source C: manual ↔ app. Every **bold term** in the v2 manual that names a button/tab/menu must exist in the app's source strings; prints those that do not (stale Help text).
 * Also lists keyboard shortcuts named in the manual so they can be checked against the app. */
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')
const walk = (d, o = []) => { for (const n of fs.readdirSync(path.join(ROOT, d))) { const p = path.join(d, n); const st = fs.statSync(path.join(ROOT, p)); if (st.isDirectory()) walk(p, o); else o.push(p) } return o }
const src = walk('src').filter((f) => /\.(tsx?|css)$/.test(f) && !f.includes('src/test/')).map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
const norm = (t) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/…|\.\.\./g, '').replace(/\s+/g, ' ').trim()
const pages = walk('docs/manual/v2').filter((f) => f.endsWith('.md'))
const missing = []; const shortcuts = new Set(); let terms = 0
for (const f of pages) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8')
  for (const m of s.matchAll(/\*\*([^*\n]{3,48})\*\*/g)) {
    const t = m[1].trim(); terms++
    if (/^(ctrl|cmd|⌘|shift|alt|esc|f\d+)\b|[⌘⇧⌥]|^\w\s?$/.test(t) || /^[A-Z0-9+ /⌘⇧⌥↑↓←→.-]{1,18}$/.test(t)) { shortcuts.add(t); continue }
    if (/[:.!?]$/.test(t) || t.split(' ').length > 6) continue
    const parts = t.split(/ → | › |\/| or /).map(norm).filter((x) => x.length > 2)
    if (!parts.every((p) => src.includes(p))) missing.push({ page: f.replace('docs/manual/v2/', ''), term: t })
  }
}
fs.mkdirSync(path.join(ROOT, 'qa-out'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'qa-out', 'manual-check.json'), JSON.stringify({ terms, missing, shortcuts: [...shortcuts] }, null, 1))
console.log(`manual pages ${pages.length} · bold terms ${terms} · not found in the app source ${missing.length} · shortcuts named ${shortcuts.size}`)
for (const m of missing.slice(0, 80)) console.log(`  ${m.page}: ${m.term}`)
