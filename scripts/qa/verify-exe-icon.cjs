/* Checks that a Windows .exe carries the icon in an .ico file: every image stored in the .ico must also be stored, byte for byte, among the
 * exe's icon resources (RT_ICON). Reads the PE file directly, so it runs anywhere (no Windows APIs).
 * Usage: node scripts/qa/verify-exe-icon.cjs <app.exe> <icon.ico> [<other.exe-to-differ-from>]
 * Exit 1 when an image of the .ico is missing from the exe (or, when a third file is given, when that exe has an identical icon). */
const fs = require('fs')

function rtIcons(file) {
  const b = fs.readFileSync(file)
  const pe = b.readUInt32LE(0x3c)
  if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error(file + ' is not a PE file')
  const nSec = b.readUInt16LE(pe + 6), optSize = b.readUInt16LE(pe + 20), opt = pe + 24
  const magic = b.readUInt16LE(opt)
  const dirBase = opt + (magic === 0x20b ? 112 : 96)
  const resRva = b.readUInt32LE(dirBase + 2 * 8)
  if (!resRva) return []
  const sec = []
  for (let i = 0; i < nSec; i++) { const o = opt + optSize + i * 40; sec.push({ va: b.readUInt32LE(o + 12), vs: b.readUInt32LE(o + 8), raw: b.readUInt32LE(o + 20), rawSize: b.readUInt32LE(o + 16) }) }
  const off = (rva) => { for (const s of sec) if (rva >= s.va && rva < s.va + Math.max(s.vs, s.rawSize)) return rva - s.va + s.raw; throw new Error('bad RVA') }
  const base = off(resRva)
  const entries = (dirOff) => { const n = b.readUInt16LE(dirOff + 12) + b.readUInt16LE(dirOff + 14); const out = []; for (let i = 0; i < n; i++) { const e = dirOff + 16 + i * 8; const id = b.readUInt32LE(e), to = b.readUInt32LE(e + 4); out.push({ id, sub: !!(to & 0x80000000), off: to & 0x7fffffff }) } return out }
  const icons = []
  const walk = (dirOff, depth) => {
    for (const e of entries(dirOff)) {
      if (depth === 0 && e.id !== 3) continue // RT_ICON only
      if (e.sub) walk(base + e.off, depth + 1)
      else { const d = base + e.off; const rva = b.readUInt32LE(d), size = b.readUInt32LE(d + 4); const fo = off(rva); icons.push(b.subarray(fo, fo + size)) }
    }
  }
  walk(base, 0)
  return icons
}
function icoImages(file) {
  const b = fs.readFileSync(file)
  const n = b.readUInt16LE(4), out = []
  for (let i = 0; i < n; i++) { const e = 6 + i * 16; const w = b[e] || 256, size = b.readUInt32LE(e + 8), o = b.readUInt32LE(e + 12); out.push({ w, data: b.subarray(o, o + size) }) }
  return out
}
const same = (a, list) => list.some((x) => x.length === a.length && x.equals(a))

const [exe, ico, other] = process.argv.slice(2)
if (!exe || !ico) { console.error('usage: verify-exe-icon.cjs <app.exe> <icon.ico> [<other.exe>]'); process.exit(2) }
const have = rtIcons(exe), want = icoImages(ico)
let failed = 0
console.log(`${exe}: ${have.length} icon image(s) embedded; ${ico}: ${want.length} image(s)`)
for (const w of want) { const ok = same(w.data, have); if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${w.w}px image from the .ico ${ok ? 'is' : 'is NOT'} in the exe`) }
if (other) { const o = rtIcons(other); const shared = want.filter((w) => same(w.data, o)).length; console.log(`${shared === 0 ? 'PASS' : 'FAIL'}  ${other} shares ${shared} image(s) with the .ico`); if (shared) failed++ }
console.log(`\nverify-exe-icon: ${failed ? failed + ' failed' : 'ok'}`)
process.exit(failed ? 1 : 0)
