#!/usr/bin/env node
/* Phase 1, source A + C: the static census. Reads the source and the manual and writes qa-out/census-static.json:
 *  windows, renderer entries, rail sections, tabs, dialogs/popovers, settings keys, IPC channels, shortcuts, menu/palette entries, remote routes, manual pages,
 *  and UI "anchors" (labelled strings the user can see) that the runtime crawl must later find on screen. */
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
const walk = (d, out = []) => { for (const n of fs.readdirSync(path.join(ROOT, d))) { const p = path.join(d, n); const st = fs.statSync(path.join(ROOT, p)); if (st.isDirectory()) walk(p, out); else out.push(p) } return out }
const rendererFiles = walk('src/renderer/src').filter((f) => /\.tsx?$/.test(f) && !/env\.d\.ts$/.test(f))
const out = { generated: new Date().toISOString(), windows: [], entries: [], rail: [], tabs: [], dialogs: [], settingsKeys: [], ipc: { handle: 0, on: 0 }, menus: [], remote: [], manual: [], anchors: [] }

// windows + renderer entries
for (const f of walk('src/main').filter((x) => x.endsWith('.ts'))) { const s = rd(f); for (const m of s.matchAll(/new BrowserWindow\(/g)) out.windows.push({ file: f, line: s.slice(0, m.index).split('\n').length }) }
out.entries = fs.readdirSync(path.join(ROOT, 'src/renderer')).filter((n) => n.endsWith('.html'))
// IPC
for (const f of walk('src/main').filter((x) => x.endsWith('.ts'))) { const s = rd(f); out.ipc.handle += (s.match(/ipcMain\.handle\(/g) || []).length; out.ipc.on += (s.match(/ipcMain\.on\(/g) || []).length }
// settings keys
{ const s = rd('src/main/settings.ts'); const m = s.match(/export interface AppSettings \{([\s\S]*?)\n\}/); if (m) out.settingsKeys = [...m[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((x) => x[1]) }
// rail
{ const s = rd('src/renderer/src/App.tsx'); const m = s.match(/type TopTab = ([^\n]+)/); out.rail = m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]).concat(['saved', 'queue']) : [] }
// menus (application menu)
{ const s = rd('src/main/index.ts'); out.menus = [...s.matchAll(/label: '([^']+)'/g)].map((m) => m[1]).slice(0, 80) }
// remote routes
{ const s = rd('src/main/webRemote.ts'); out.remote = [...new Set([...s.matchAll(/path === '([^']+)' && req\.method === '(\w+)'/g)].map((m) => m[2] + ' ' + m[1]))] }
// manual pages
{ const man = JSON.parse(rd('docs/manual/v2/manifest.json')); for (const sct of man.sections) for (const p of sct.pages) out.manual.push({ section: sct.title, id: p.id, title: p.title, file: p.file }) }
// tabs / dialogs / anchors
for (const f of rendererFiles) {
  const s = rd(f)
  const tabs = [...s.matchAll(/role="tab"/g)].length
  if (tabs) out.tabs.push({ file: f, count: tabs })
  for (const m of s.matchAll(/role="(dialog|alertdialog|menu|listbox|tooltip|status|alert)"/g)) out.dialogs.push({ file: f, role: m[1], line: s.slice(0, m.index).split('\n').length })
  const add = (kind, text) => { text = text.replace(/\s+/g, ' ').trim(); if (text.length >= 3 && text.length <= 120 && !/[{}$=<>]/.test(text) && /[A-Za-z]/.test(text)) out.anchors.push({ file: f, kind, text }) }
  for (const m of s.matchAll(/aria-label="([^"]+)"/g)) add('aria-label', m[1])
  for (const m of s.matchAll(/placeholder="([^"]+)"/g)) add('placeholder', m[1])
  for (const m of s.matchAll(/title="([^"]+)"/g)) add('title', m[1])
  for (const m of s.matchAll(/<(h[1-4]|button|summary|label|legend|th)\b[^>]*>\s*([A-Z][^<{\n]{2,80}?)\s*</g)) add(m[1], m[2])
  for (const m of s.matchAll(/(?:message|text|label):\s*'([A-Z][^']{6,120})'/g)) add('string', m[1])
}
out.anchors = [...new Map(out.anchors.map((a) => [a.text.toLowerCase(), a])).values()]
fs.mkdirSync(path.join(ROOT, 'qa-out'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'qa-out', 'census-static.json'), JSON.stringify(out, null, 1))
console.log(`windows ${out.windows.length} · entries ${out.entries.length} · rail ${out.rail.length} · tab groups ${out.tabs.length} · dialog-ish ${out.dialogs.length} · settings keys ${out.settingsKeys.length} · ipc ${out.ipc.handle}+${out.ipc.on} · menus ${out.menus.length} · remote routes ${out.remote.length} · manual pages ${out.manual.length} · anchors ${out.anchors.length}`)
