/* Window safety (scripts only, never shipped): in the real app, no page opens a new window or navigates away, unused browser permissions are refused,
 * help links open only web and mail addresses, the update step never runs a file the window names, a bad Message or display name does not throw,
 * projection text size is kept in range, and closing the operator window while something is live asks first.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/window-safety.cjs <profileDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path')
const { launch, sleep, checks, Page } = require('./lib.cjs')
const [profile] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const events = () => { try { return JSON.parse(fs.readFileSync(path.join(profile, 'qa-main-events.json'), 'utf8')) } catch { return [] } }

;(async () => {
  const c = checks('window-safety')
  fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile, { recursive: true })
  const app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-parity', settle: 8000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs'), '--require', path.join(__dirname, 'record-main.cjs')] })
  const p = await app.page()
  const pages = async () => (await app.targets()).filter((t) => t.type === 'page')

  const before = (await pages()).length
  await p.ev(`window.open('https://example.com/', '_blank'); true`); await sleep(1500)
  c.ok('window.open makes no new window', (await pages()).length === before, String((await pages()).length))
  await p.ev(`(()=>{const a=document.createElement('a');a.href='https://example.com/';a.target='_blank';document.body.appendChild(a);a.click();a.remove();return true})()`); await sleep(1500)
  c.ok('a link with a target makes no new window', (await pages()).length === before)
  await p.ev(`location.href = 'file:///etc/hosts'; true`).catch(() => {}); await sleep(1500)
  const url = await p.ev('location.href').catch(() => '(gone)')
  c.ok('the operator window does not navigate away from the app', /index\.html/.test(url), url)
  const perm = await p.ev(`Notification.requestPermission()`).catch((e) => 'error ' + e.message)
  c.ok('an unused browser permission (notifications) is refused', perm === 'denied', String(perm))

  await p.ev(`window.electronAPI.openManualExternalLink('file:///etc/hosts')`)
  await p.ev(`window.electronAPI.openManualExternalLink('smb://server/share')`)
  await p.ev(`window.electronAPI.openManualExternalLink('https://example.com/manual')`); await sleep(500)
  const opened = events().filter((e) => e.openExternal).map((e) => e.openExternal)
  c.ok('help links: only the web address reaches the operating system', JSON.stringify(opened) === JSON.stringify(['https://example.com/manual']), JSON.stringify(opened))

  const inst = await p.ev(`window.electronAPI.runInstaller('/bin/ls')`)
  c.ok('the update step will not run a file the window names', inst && inst.ok === false && /Download the update first/.test(inst.error || ''), JSON.stringify(inst))

  await cmd({ action: 'queue-bible', reference: 'John 3:16', translation: 'KJV' }); await sleep(1200)
  const st = await (await fetch(B + '/state')).json()
  await cmd({ action: 'project', id: st.queue[0].id }); await sleep(3000)
  const congregation = async () => { const t = (await pages()).find((x) => /Congregation screen/.test(x.title)); const o = await new Page(t).connect(); const txt = await o.ev('document.body.innerText'); o.close(); return txt }
  await p.ev(`window.electronAPI.sendAlert(5, 'congregation'); window.electronAPI.sendAlert(null); true`); await sleep(800)
  const renamed = await p.ev(`window.electronAPI.renameDisplay(1, null).then(()=>'ok',(e)=>'threw '+e.message)`)
  c.ok('a display name that is not text does not throw', renamed === 'ok', String(renamed))
  const read = (f) => { try { return fs.readFileSync(path.join(profile, f), 'utf8') } catch { return '' } }
  const log = (read('born.log') + read('qa-stdout.log')).split('\n').filter((l) => /uncaughtException|Error occurred in handler|is not a function/.test(l))
  c.ok('a bad Message payload does not throw in the main process', log.length === 0, log.slice(0, 2).join(' / '))
  c.ok('the verse is still on the screen after both', /God so loved/.test(await congregation()))

  await p.ev(`window.electronAPI.setFontSize(999); true`); await sleep(600)
  const fsz = await p.ev(`window.electronAPI.getFontSize()`)
  c.ok('projection text size 999 is kept in range (8)', fsz === 8, String(fsz))
  await p.ev(`window.electronAPI.setFontSize(4.5); true`)

  fs.writeFileSync(path.join(profile, 'qa-dialog-answer'), '0')
  const openNow = (await pages()).length
  p.ev('window.close()').catch(() => {}); await sleep(2000)
  const asked = events().filter((e) => e.dialog)
  c.ok('closing the operator window while a verse is live asks first', asked.length === 1 && /on the screen/.test(asked[0].dialog), JSON.stringify(asked))
  c.ok('"Keep it open" keeps every window', (await pages()).length === openNow && openNow >= 2, `${(await pages()).length} of ${openNow}`)
  fs.writeFileSync(path.join(profile, 'qa-dialog-answer'), '1')
  const p2 = await app.page()
  p2.ev('window.close()').catch(() => {}); await sleep(3000)
  const left = await pages().catch(() => [])
  c.ok('"Close and take the screens down" closes them', left.length === 0, left.map((t) => t.title).join(' | '))
  const r = c.done(); await app.kill(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
