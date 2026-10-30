/* Regression flow: closing the operator window while the projection and the stage monitor are open closes them too (they could not be
 * controlled or closed without it). Usage: node scripts/qa/close-operator-window.cjs [profileDir]   (needs `npm run build`) */
const path = require('path')
const { launch, checks, sleep, getJson } = require('./lib.cjs')
const profile = process.argv[2] || path.join(require('os').tmpdir(), 'born-v1-close-main')
;(async () => {
  const c = checks('close-operator-window')
  const app = await launch({ profile, port: 9362, remotePort: 14322, mdns: 'born-remote-v1cm', settle: 6000, extraArgs: ['--require', path.join(__dirname, 'hide-outputs.cjs')] })
  const titles = async () => { try { return (await getJson(`http://127.0.0.1:${app.port}/json`)).filter((t) => t.type === 'page').map((t) => t.title) } catch { return [] } }
  const main = await app.page()
  await main.ev('window.electronAPI.openProjection()'); await main.ev('window.electronAPI.openStage()'); await sleep(2500)
  const before = await titles()
  c.ok('the projection and the stage are open', before.length === 3, before.join(' | '))
  main.ev('window.close()').catch(() => {}); await sleep(3000)
  const after = await titles()
  c.ok('closing the operator window closes them too', after.length === 0, after.join(' | ') || '(none)')
  await app.kill()
  process.exit(c.done().failed ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
