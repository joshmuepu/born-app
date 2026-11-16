/* Bundles a runtime check and runs it with the Electron binary as Node (ELECTRON_RUN_AS_NODE for that one command only), so text decoding, Intl and
 * the like are proven on the runtime the packaged app uses, not the developer's newer Node. Usage: node scripts/runtime-check/run.cjs [name ...] */
const { execFileSync } = require('child_process')
const path = require('path'), fs = require('fs')
const ROOT = path.join(__dirname, '..', '..')
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(__dirname).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''))
// next to the checks, never in out/ (packaged with the app); git-ignored
const out = path.join(__dirname, '.out')
fs.mkdirSync(out, { recursive: true })
const bin = (n) => path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? n + '.cmd' : n)
let failed = 0
for (const n of names) {
  const file = path.join(out, n + '.cjs')
  execFileSync(bin('esbuild'), [path.join(__dirname, n + '.ts'), '--bundle', '--platform=node', '--format=cjs', '--packages=external', '--log-level=warning', '--outfile=' + file], { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' })
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  try {
    execFileSync(bin('electron'), [file], { stdio: 'inherit', cwd: ROOT, env, shell: process.platform === 'win32' })
  } catch {
    failed++
  }
}
process.exit(failed ? 1 : 0)
