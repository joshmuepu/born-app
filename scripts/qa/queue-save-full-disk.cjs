/* A queue save on a full disk, in the real app (scripts only, never shipped; macOS). The profile lives on a small temporary disk image made here
 * and removed at the end, so only that image is ever filled, never the computer's own disk. Checks: a save that fails is said to the operator once,
 * the queue stays in the window, the next change is saved once there is room again, and a failure after that is said again.
 * Usage: PW_DIR=/tmp/born-pw node scripts/qa/queue-save-full-disk.cjs <workDir>   (needs `npm run build`) */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const { launch, sleep, checks } = require('./lib.cjs')
const [work] = process.argv.slice(2)
const PORT = Number(process.env.BORN_REMOTE_PORT || 14316), B = `http://127.0.0.1:${PORT}`
const cmd = (b) => fetch(B + '/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const state = async () => (await fetch(B + '/state')).json()
const image = path.join(work, 'qa-disk.sparseimage'), mnt = path.join(work, 'qa-disk'), profile = path.join(mnt, 'profile')
const filler = path.join(mnt, 'filler.bin')

function fill() {
  const fd = fs.openSync(filler, 'a'), chunk = Buffer.alloc(1 << 20)
  try { for (;;) fs.writeSync(fd, chunk) } catch { /* full */ }
  const small = Buffer.alloc(4096)
  try { for (;;) fs.writeSync(fd, small) } catch { /* full to the last block */ }
  fs.closeSync(fd)
}
const savedCount = () => { try { return JSON.parse(fs.readFileSync(path.join(profile, 'queue.json'), 'utf8')).length } catch { return -1 } }

;(async () => {
  const c = checks('queue-save-full-disk')
  fs.mkdirSync(work, { recursive: true }); fs.rmSync(image, { force: true }); fs.mkdirSync(mnt, { recursive: true })
  execFileSync('hdiutil', ['create', '-size', '600m', '-fs', 'HFS+', '-volname', 'BORNQA', '-type', 'SPARSE', image], { stdio: 'ignore' })
  execFileSync('hdiutil', ['attach', '-nobrowse', '-mountpoint', mnt, image], { stdio: 'ignore' })
  let app
  try {
    app = await launch({ profile, remotePort: PORT, port: Number(process.env.CDP_PORT || 9376), mdns: process.env.BORN_MDNS_NAME || 'born-remote-v1-safety', settle: 12000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
    const p = await app.page()
    await p.ev(`(()=>{window.__notices=[];window.__last='';new MutationObserver(()=>{const n=document.querySelector('.operator-notice');const t=n?n.textContent:'';if(t!==window.__last){window.__last=t;if(t)window.__notices.push(t)}}).observe(document.body,{subtree:true,childList:true,characterData:true});return 1})()`)
    const notices = async () => { const n = await p.ev('window.__notices.splice(0)'); return n.filter((t) => /queue/i.test(t)) }
    const add = async (ref) => { await cmd({ action: 'queue-bible', reference: ref, translation: 'KJV' }); await sleep(2500) }

    await add('John 3:16')
    c.ok('with room on the disk the queue is saved', savedCount() === 1, `saved ${savedCount()}`)
    await notices()

    fill()
    await add('John 3:17')
    let said = await notices()
    c.ok('a save that fails on a full disk is said to the operator', said.length === 1 && /not be saved|couldn.t be saved|could not save/i.test(said[0]), JSON.stringify(said))
    c.ok('the queue stays in the window', (await state()).queue.length === 2, `${(await state()).queue.length} items`)
    c.ok('the file on disk is still the last good save', savedCount() === 1, `saved ${savedCount()}`)
    await add('John 3:18')
    said = await notices()
    c.ok('it keeps failing: said once, not again for every change', said.length === 0, JSON.stringify(said))

    fs.rmSync(filler, { force: true }); await sleep(500)
    await add('John 3:19')
    c.ok('with room again the next change saves the whole queue', savedCount() === 4, `saved ${savedCount()}`)
    said = await notices()

    fill()
    await add('John 3:20')
    said = await notices()
    c.ok('a failure after it had recovered is said again', said.length === 1, JSON.stringify(said))
    fs.rmSync(filler, { force: true })
  } finally {
    if (app) await app.kill()
    await sleep(1000)
    try { execFileSync('hdiutil', ['detach', mnt, '-force'], { stdio: 'ignore' }) } catch { /* already */ }
    fs.rmSync(image, { force: true }); fs.rmSync(mnt, { recursive: true, force: true })
  }
  const r = c.done(); process.exit(r.failed ? 1 : 0)
})().catch((e) => { console.error(e); try { execFileSync('hdiutil', ['detach', mnt, '-force'], { stdio: 'ignore' }) } catch { /* gone */ } process.exit(2) })
