/* Keys and Esc in the real app (scripts only, never shipped): John 3:16-18 is live; Alt+arrows, a held arrow (key repeat), Ctrl+Space, Ctrl/Cmd+B and
 * Shift+B must not change the congregation screen, Ctrl/Cmd+Enter away from the Sermons search must not put a sermon up, and Esc with the Bible scope
 * or status popover open closes it without hiding the screens. Plain → and B still work.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/live-keys.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const state = async () => (await fetch(B + '/state')).json()

;(async () => {
  const c = checks('live-keys')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-parity', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const p = await app.page(); await p.viewport(1366, 768, 1)
  const screenText = async () => { const t = (await app.targets()).find((x) => x.type === 'page' && /Congregation screen/.test(x.title)); if (!t) return ''; const o = await new Page(t).connect(); const s = await o.ev('document.body.innerText'); o.close(); return s }
  const verse = async () => { const s = await screenText(); return /sent not his Son/.test(s) ? 17 : /believeth on him is not condemned/.test(s) ? 18 : /God so loved/.test(s) ? 16 : /faith/i.test(s) ? 'sermon' : '?' }
  const raw = (key, o = {}) => p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: o.code || key, windowsVirtualKeyCode: o.vk || 0, modifiers: o.mods || 0, autoRepeat: !!o.repeat })
  const up = (key, o = {}) => p.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: o.code || key, windowsVirtualKeyCode: o.vk || 0, modifiers: o.mods || 0 })
  const blur = () => p.ev('document.activeElement && document.activeElement.blur()')
  const MOD = process.platform === 'darwin' ? { meta: true } : { ctrl: true }

  await cmd({ action: 'queue-bible', reference: 'John 3:16-18', translation: 'KJV' }); await sleep(1200)
  await cmd({ action: 'project', id: (await state()).queue[0].id }); await sleep(3000)
  await blur()
  c.ok('verse 16 is live', (await verse()) === 16)
  await p.key('ArrowRight', { alt: true }); await p.key('ArrowLeft', { alt: true }); await sleep(800)
  c.ok('Alt+→ / Alt+← do not step the live slide', (await verse()) === 16)
  await raw('ArrowRight', { vk: 39 }); for (let i = 0; i < 6; i++) await raw('ArrowRight', { vk: 39, repeat: true }); await up('ArrowRight', { vk: 39 }); await sleep(900)
  c.ok('a held → steps once', (await verse()) === 17, String(await verse()))
  await p.key(' ', { ctrl: true, code: 'Space' }); await sleep(700)
  c.ok('Ctrl+Space is not Next', (await verse()) === 17)
  await p.key('b', { ctrl: true }); await p.key('b', { meta: true }); await p.key('B', { shift: true }); await sleep(700)
  c.ok('Ctrl+B, Cmd+B and Shift+B do not hide the screen', (await state()).blanked === false)
  await p.key('b'); await sleep(700)
  c.ok('plain B still hides it', (await state()).blanked === true)
  await p.key('b'); await sleep(700)

  // a sermon search, then the Bible panel: Ctrl/Cmd+Enter there must not put the sermon up
  await p.ev(`(()=>{const b=document.getElementById('born-search-input');b.focus();return true})()`)
  await p.insertText('faith'); await p.key('Enter'); await sleep(2500)
  await p.clickSel('.panel-tab--bible'); await sleep(600); await blur()
  await p.key('Enter', MOD); await sleep(1000)
  c.ok('Cmd/Ctrl+Enter in the Bible panel does not put the last sermon result up', (await verse()) === 17, String(await verse()))

  // Esc with the Bible scope popover, then the status popover (a live verse opens the Bible panel on its chapter: back to its Search first)
  await p.ev(`(()=>{const b=[...document.querySelectorAll('.panel-subtab')].find(x=>x.offsetParent&&x.textContent.trim()==='Search');b&&b.click();return !!b})()`); await sleep(500)
  if (!(await p.ev(`!!document.querySelector('.bible-scope-btn')`))) await p.ev(`(()=>{const b=[...document.querySelectorAll('.browse-back')].find(x=>x.offsetParent);b&&b.click();return !!b})()`); await sleep(500)
  await p.clickSel('.bible-scope-btn'); await sleep(400)
  const scopeOpen = await p.ev(`!!document.querySelector('.bible-scope-popover')`)
  await p.key('Escape'); await sleep(600)
  c.ok('Esc closes the Bible scope popover', scopeOpen && !(await p.ev(`!!document.querySelector('.bible-scope-popover')`)))
  c.ok('... and does not hide the screens', (await state()).blanked === false)
  await p.clickSel('.status-trigger'); await sleep(400)
  const statusOpen = await p.ev(`!!document.querySelector('.status-popover')`)
  await p.key('Escape'); await sleep(600)
  c.ok('Esc closes the status popover', statusOpen && !(await p.ev(`!!document.querySelector('.status-popover')`)))
  c.ok('... and does not hide the screens', (await state()).blanked === false)
  await blur(); await p.key('Escape'); await sleep(700)
  c.ok('plain Esc with nothing open still hides the screens', (await state()).blanked === true)
  const logs = p.takeLogs().filter((l) => !/Electron Security Warning/.test(l.text))
  c.ok('no console errors', logs.length === 0, JSON.stringify(logs.slice(0, 2)))
  const r = c.done(); p.close(); await app.kill(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
