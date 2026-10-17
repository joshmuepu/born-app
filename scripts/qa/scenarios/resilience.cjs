#!/usr/bin/env node
/* Scenario: things going wrong — the app killed mid-service, damaged data files, a missing picture, a missing tape file, a read-only profile folder, no internet. Each case runs on a fresh copy of the populated profile and is
 * captured/checked; the notes say what the app did.      node scripts/qa/scenarios/resilience.cjs [basePort] */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process')
const { launch, sleep } = require('../lib.cjs'); const { recorder } = require('../scenario-lib.cjs')
const base = +(process.argv[2] || 9930)
const rec = recorder('resilience')
const copy = (n) => { const d = '/tmp/qa-res-' + n; execSync(`rm -rf ${d}; cp -R /tmp/qa-populated ${d}`); return d }
const open = async (n, port, env = {}) => { const prof = copy(n); const app = await launch({ profile: prof, port, remotePort: 4500 + (port % 40), mdns: 'born-qa-res' + n, settle: 8000, env }); const page = await app.page(); await page.viewport(1366, 768); return { app, page, prof } }
const reopen = async (prof, port, env = {}) => { const app = await launch({ profile: prof, port, remotePort: 4500 + (port % 40), mdns: 'born-qa-resb', settle: 8000, env }); const page = await app.page(); await page.viewport(1366, 768); return { app, page } }
const queueCount = (p) => p.ev(`document.body.innerText.match(/(\\d+) in queue/)?.[1] ?? 'none'`)
;(async () => {
  // R1: killed mid-service
  { const { app, page, prof } = await open('kill', base)
    await page.ev('window.electronAPI.openProjection()'); await sleep(2500)
    await page.click('Run view'); await sleep(800); await page.click('Show next'); await sleep(1200)
    rec.note('R1 before kill: queue ' + await queueCount(page)); await rec.capture(page, 'r1-before-kill', 'mid-service, something on screen')
    execSync(`kill -9 ${app.proc.pid}`); await sleep(2500); execSync('pkill -f "remote-debugging-port=' + base + '" || true'); await sleep(2000)
    const r = await reopen(prof, base)
    rec.note('R1 after relaunch: queue ' + await queueCount(r.page)); await rec.capture(r.page, 'r1-after-relaunch', 'relaunched after kill -9')
    const live = await r.page.ev('window.electronAPI.getLiveState()'); rec.note('R1 live state after relaunch: ' + JSON.stringify(live).slice(0, 200))
    r.page.close(); await r.app.kill(); page.close() }
  // R2: damaged data files
  for (const [name, file, junk] of [['queue', 'queue.json', '{ this is not json'], ['settings', 'settings.json', '\u0000\u0001garbage'], ['library', 'library.db', 'not a database at all'.repeat(100)]]) {
    const prof = copy('bad-' + name); fs.writeFileSync(path.join(prof, file), junk); for (const x of ['library.db-wal', 'library.db-shm']) if (file === 'library.db') try { fs.rmSync(path.join(prof, x)) } catch { /* none */ }
    try { const r = await reopen(prof, base + 1); rec.note(`R2 damaged ${file}: window up, queue ${await queueCount(r.page)}`); await rec.capture(r.page, 'r2-bad-' + name, `damaged ${file}`); const info = await r.page.ev('window.electronAPI.getDataRecoveryInfo()'); rec.note(`R2 ${file} recovery info: ` + JSON.stringify(info).slice(0, 300)); r.page.close(); await r.app.kill() } catch (e) { rec.note(`R2 damaged ${file}: APP DID NOT START (${String(e).slice(0, 100)})`) }
    execSync('pkill -f "remote-debugging-port=' + (base + 1) + '" || true'); await sleep(1500)
  }
  // R3: a picture file missing; R4: tape file missing
  { const { app, page, prof } = await open('missing', base + 2)
    const media = path.join(prof, 'media'); const files = execSync(`find ${media} -type f \\( -name "*.png" -o -name "*.jpg" \\) | head -3`).toString().split('\n').filter(Boolean)
    for (const f of files) fs.rmSync(f); rec.note('R3 removed ' + files.length + ' picture files')
    await page.send('Page.reload'); await sleep(3000); await page.click('Media'); await sleep(1500); await rec.capture(page, 'r3-media-missing', 'pictures missing from disk'); await page.click('Needs attention'); await sleep(1000); await rec.capture(page, 'r3-needs-attention', 'Media › Needs attention')
    await page.click('Is tonight ready'); await sleep(2000); await rec.capture(page, 'r3-readiness', 'readiness with missing pictures'); await page.key('Escape'); await sleep(300)
    const tape = '/tmp/born-tape-work/Tape audio/65-0418M It Is The Rising Of The Sun VGR.m4a'; const moved = tape + '.qa-moved'; fs.renameSync(tape, moved)
    try { await page.click('Tape'); await sleep(1500); await page.send('Page.reload'); await sleep(2500); await page.click('Tape'); await sleep(1500); await rec.capture(page, 'r4-tape-missing', 'tape file missing'); rec.note('R4 tape row text: ' + await page.ev(`(document.querySelector('.tp-lib')||{}).innerText`)) } finally { fs.renameSync(moved, tape) }
    page.close(); await app.kill() }
  // R5: read-only profile folder
  { const prof = copy('ro'); execSync(`chmod -R a-w ${prof}`)
    try { const r = await reopen(prof, base + 3); rec.note('R5 read-only profile: window up'); await rec.capture(r.page, 'r5-readonly', 'read-only data folder'); await r.page.click('Bible'); await sleep(500); r.page.close(); await r.app.kill() } catch (e) { rec.note('R5 read-only profile: APP DID NOT START ' + String(e).slice(0, 120)) } finally { execSync(`chmod -R u+w ${prof}`) }
    execSync('pkill -f "remote-debugging-port=' + (base + 3) + '" || true'); await sleep(1500) }
  // R6: offline
  { const { app, page } = await open('offline', base + 4, { BORN_OFFLINE: '1' })
    await page.click('Songs'); await sleep(700); await page.click('Import'); await sleep(500); await rec.capture(page, 'r6-import-menu', 'import menu offline')
    await page.click('Settings and help'); await sleep(400); await page.click('Check for updates'); await sleep(2500); await rec.capture(page, 'r6-update-check', 'update check offline')
    await page.click('Media'); await sleep(600); await page.click('YouTube'); await sleep(800); await page.type('https://youtu.be/jNQXAC9IVRw'); await page.key('Enter'); await sleep(3500); await rec.capture(page, 'r6-youtube-offline', 'YouTube link offline')
    await page.click('Tape'); await sleep(800); await page.click('More ways to add'); await sleep(300); await page.click('Download…'); await sleep(500); await page.type('brass'); await page.key('Enter'); await sleep(300); await page.click('Download 53'); await sleep(5000); await rec.capture(page, 'r6-tape-download-offline', 'tape download offline')
    page.close(); await app.kill() }
  rec.save(); console.log('resilience scenario done')
})().catch((e) => { console.error(e); rec.note('FATAL ' + String(e).slice(0, 200)); rec.save() })
