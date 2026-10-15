#!/usr/bin/env node
/*
 * THROWAWAY. Unattended spike runner: multi-screen sync (free-running, then corrected), 2-hour 1080p soak, 20-minute 4K soak.
 *   npm run spike:overnight                     (needs Node)           from spikes/media/
 *   run-overnight.bat / run-overnight.command   (no Node needed; uses the repo's Electron)
 * Flags: --smoke (short, ~3 min total)  --hidden (no visible windows)  --keep-assets  --only=sync,soak1080,soak4k
 *        --soak-minutes=120  --soak4k-minutes=20  --sync-minutes=15
 * Survives a failed step and continues. Log is capped. Writes JSON + markdown under docs/design/media/spikes/results/.
 */
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const os = require('os')
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d }
const flag = n => process.argv.includes('--' + n)
const smoke = flag('smoke'), hidden = flag('hidden'), keepAssets = flag('keep-assets')
const only = (arg('only', 'sync,soak1080,soak4k')).split(',')
const syncMin = +arg('sync-minutes', smoke ? 0.4 : 15), soakMin = +arg('soak-minutes', smoke ? 0.4 : 120), soak4kMin = +arg('soak4k-minutes', smoke ? 0.4 : 20)
const here = __dirname, repo = path.resolve(here, '../..')
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const outDir = path.join(repo, 'docs/design/media/spikes/results'); fs.mkdirSync(outDir, { recursive: true })
const base = `OVERNIGHT-${process.platform}-${process.arch}-${stamp}${smoke ? '-SMOKE' : ''}`
const rawDir = path.join(outDir, base + '-raw'); fs.mkdirSync(rawDir, { recursive: true })
const logFile = path.join(outDir, base + '.log'); const LOG_CAP = 2 * 1024 * 1024; let logBytes = 0
function log(m) { const line = `[${new Date().toISOString()}] ${m}\n`; if (logBytes + line.length > LOG_CAP) return; logBytes += line.length; fs.appendFileSync(logFile, line); console.log(m) }

function electronExe() {
  const d = path.join(repo, 'node_modules/electron'); let p = ''
  try { p = fs.readFileSync(path.join(d, 'path.txt'), 'utf8').trim() } catch {}
  const cand = [p && path.join(d, 'dist', p), path.join(d, 'dist/Electron.app/Contents/MacOS/Electron'), path.join(d, 'dist/electron.exe'), path.join(d, 'dist/electron')]
  return cand.find(c => c && fs.existsSync(c))
}
const EXE = electronExe()
if (!EXE) { console.error('Electron not found in ' + repo + '/node_modules — run `npm install` in the repo first.'); process.exit(2) }
const childEnv = { ...process.env, SPIKE_RESULTS: rawDir, SOAK_SAMPLE_MS: smoke ? '2000' : '10000' }; delete childEnv.ELECTRON_RUN_AS_NODE

let current = null
function killTree(c) { try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F']); else { c.kill('SIGTERM'); setTimeout(() => { try { c.kill('SIGKILL') } catch {} }, 5000) } } catch {} }
process.on('SIGINT', () => { log('interrupted'); if (current) killTree(current); process.exit(130) })
process.on('SIGTERM', () => { if (current) killTree(current); process.exit(143) })

function run(name, script, args, expectedMin) {
  return new Promise(resolve => {
    const t0 = Date.now(); log(`▶ ${name}: ${path.basename(script)} ${args.join(' ')}  (expected ~${expectedMin.toFixed(1)} min)`)
    const c = spawn(EXE, [script, ...args], { cwd: here, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] }); current = c
    let tail = ''; const onData = d => { tail = (tail + d.toString()).slice(-4000); const m = /(RESULT|SOAK-DONE|WROTE|GO )[^\n]{0,160}/.exec(d.toString()); if (m) log('   ' + m[0].slice(0, 200)) }
    c.stdout.on('data', onData); c.stderr.on('data', onData)
    const hb = setInterval(() => { log(`   … ${name} running ${((Date.now() - t0) / 60000).toFixed(1)} min`); try { const f = fs.statfsSync(outDir); if (f.bavail * f.bsize < 1e9) { log('   LOW DISK (<1 GB) — stopping this step'); killTree(c) } } catch {} }, 5 * 60000)
    const limit = setTimeout(() => { log(`   TIMEOUT on ${name} — killing`); killTree(c) }, (expectedMin + 15) * 60000)
    c.on('error', e => { log('   spawn error ' + e.message) })
    c.on('close', code => { clearInterval(hb); clearTimeout(limit); current = null; const secs = Math.round((Date.now() - t0) / 1000); log(`■ ${name} finished: exit ${code} in ${secs}s`); resolve({ name, ok: code === 0, code, secs }) })
  })
}

// ---------------- verdict helpers ----------------
const T = { stallsWarn: 3, dropWarnPct: 0.1, dropFailPct: 0.5, memWarnMBh: 20, memFailMBh: 60, cpu1080: 100, cpu4k: 150, syncP95: 80, syncMax: 150, syncP95Warn: 150 }
const verdict = (v, pass, warn) => v <= pass ? 'PASS' : v <= warn ? 'WARN' : 'FAIL'
function slopePerHour(ts, ys) { const n = ts.length; if (n < 3) return 0; const mx = ts.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let num = 0, den = 0; ts.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2 }); return den ? num / den * 3600 : 0 }
function summarizeSoak(file, is4k) {
  if (!fs.existsSync(file)) return { status: 'NO DATA', verdict: 'FAIL' }
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); const done = rows.find(r => r.done); const data = rows.filter(r => !r.done)
  if (data.length < 2) return { status: 'TOO FEW SAMPLES', verdict: 'FAIL' }
  const ts = data.map(r => r.t), mb = k => data.map(r => r[k].ws / 1024) // Electron reports working set in KB
  // memory trend ignores the start-up ramp (first 5 min, or 25% of the run) and needs >= 10 min of data to mean anything
  const warm = Math.min(300, ts[ts.length - 1] * 0.25), idx = ts.map((t, i) => t >= warm ? i : -1).filter(i => i >= 0)
  const longEnough = ts[ts.length - 1] >= 600 && idx.length >= 5
  const sl = k => longEnough ? slopePerHour(idx.map(i => ts[i]), idx.map(i => mb(k)[i])) : 0
  const memRender = sl('renderer'), memGpu = sl('gpu'), memSum = memRender + memGpu
  const cpu = data.map(r => r.gpu.cpu + r.renderer.cpu + r.browser.cpu + r.other.cpu); const cpuMean = cpu.reduce((a, b) => a + b) / cpu.length
  const vids = Object.values(data[data.length - 1].vids || {}); const stalls = vids.reduce((a, v) => a + v.stalls, 0)
  const dropPct = Math.max(0, ...vids.map(v => 100 * v.dropped / Math.max(1, v.total))); const errs = vids.filter(v => v.err).length
  const vs = [verdict(stalls, 0, T.stallsWarn), verdict(dropPct, T.dropWarnPct, T.dropFailPct), longEnough ? verdict(memSum, T.memWarnMBh, T.memFailMBh) : 'N/A (run under 10 min)', cpuMean <= (is4k ? T.cpu4k : T.cpu1080) ? 'PASS' : 'WARN', errs ? 'FAIL' : 'PASS', done ? 'PASS' : 'FAIL']
  const overall = (smoke ? 'SMOKE-' : '') + (vs.includes('FAIL') ? 'FAIL' : vs.includes('WARN') ? 'WARN' : 'PASS')
  return { status: done ? 'complete' : 'INCOMPLETE (no completion marker)', verdict: overall, minutes: +(ts[ts.length - 1] / 60).toFixed(1), samples: data.length,
    stalls, droppedPctWorstWindow: +dropPct.toFixed(3), memSlopeMBperHour: { renderers: +memRender.toFixed(1), gpu: +memGpu.toFixed(1), total: +memSum.toFixed(1) },
    memStartEndMB: { renderers: [+mb('renderer')[0].toFixed(0), +mb('renderer').slice(-1)[0].toFixed(0)], gpu: [+mb('gpu')[0].toFixed(0), +mb('gpu').slice(-1)[0].toFixed(0)] },
    cpuMeanPctOfOneCore: +cpuMean.toFixed(1), cpuMaxPct: +Math.max(...cpu).toFixed(1), videoErrors: errs, perCheck: { stalls: vs[0], dropped: vs[1], memory: vs[2], cpu: vs[3], errors: vs[4], completed: vs[5] } }
}
function summarizeSync(file) {
  if (!fs.existsSync(file)) return { status: 'NO DATA', verdict: 'FAIL' }
  const d = JSON.parse(fs.readFileSync(file, 'utf8')); const w = ['stage', 'graphics'].map(r => d.drift[r]); const worstP95 = Math.max(...w.map(x => x.p95AbsMs)), worstMax = Math.max(...w.map(x => x.maxAbsMs))
  const growth = ['stage', 'graphics'].map(r => d.trend[r] ? (d.trend[r].endMs - d.trend[r].startMs) / (d.seconds / 60) : null)
  return { status: 'complete', mode: d.mode, minutes: +(d.seconds / 60).toFixed(1), clipSeconds: d.clipSeconds, p95AbsMs: worstP95, maxAbsMs: worstMax, meanAbsMs: Math.max(...w.map(x => x.meanAbsMs)),
    driftGrowthMsPerMin: growth.map(g => g == null ? null : +g.toFixed(1)), dropped: Object.fromEntries(Object.entries(d.stats).map(([k, s]) => [k, `${s.dropped}/${s.total}`])), seeks: d.stats.stage.seeks + d.stats.graphics.seeks,
    verdict: d.mode === 'corrected' ? (worstP95 <= T.syncP95 && worstMax <= T.syncMax ? 'PASS' : worstP95 <= T.syncP95Warn ? 'WARN' : 'FAIL') : 'INFO' }
}

// ---------------- main ----------------
;(async () => {
  const started = new Date(); const steps = []
  log(`Born Again media spikes — unattended run. platform=${process.platform}-${process.arch} node=${process.version} smoke=${smoke} hidden=${hidden}`)
  log(`Electron: ${EXE}`); log(`Results: ${outDir}  (${base}.*)`)
  const assets = path.join(here, 'assets'); const need = [['h264-1080p30-30s.mp4', 'h264-1080p30-30s'], ['h264-4k30-10s.mp4', 'h264-4k30-10s']]
  const made = []
  let clip1080 = path.join(assets, need[0][0]), clip4k = path.join(assets, need[1][0])
  for (const [file, key] of need) if (!fs.existsSync(path.join(assets, file))) { const r = await run('make ' + file, path.join(here, 'tools/make-assets.js'), [key], file.includes('30s') ? 1 : 0.5); steps.push(r); if (fs.existsSync(path.join(assets, file))) made.push(path.join(assets, file)) }
  const fallback = f => path.join(here, 'compat/clips', f)
  const assetNote = []
  if (!fs.existsSync(clip1080)) { clip1080 = fallback('h264-1080p30.mp4'); assetNote.push('1080p clip could not be generated; used the 4-second committed clip') }
  if (!fs.existsSync(clip4k)) { clip4k = fallback('h264-4k30.mp4'); assetNote.push('4K clip could not be generated; used the 4-second committed clip') }
  const hid = hidden ? ['--hidden'] : []
  const R = {}
  if (only.includes('sync')) {
    steps.push(await run('sync free-running', path.join(here, 'tools/sync-test.js'), ['free', String(Math.round(syncMin * 60)), '--clip=' + clip1080, ...hid], syncMin + 1))
    steps.push(await run('sync corrected', path.join(here, 'tools/sync-test.js'), ['corrected', String(Math.round(syncMin * 60)), '--clip=' + clip1080, ...hid], syncMin + 1))
  }
  if (only.includes('soak1080')) steps.push(await run('soak 1080p30', path.join(here, 'tools/soak.js'), [String(soakMin), '1080', '2', '--clip=' + clip1080, ...hid], soakMin + 1))
  if (only.includes('soak4k')) steps.push(await run('soak 4K30', path.join(here, 'tools/soak.js'), [String(soak4kMin), '4k', '1', '--clip=' + clip4k, ...hid], soak4kMin + 1))
  R.syncFree = summarizeSync(path.join(rawDir, `sync-free-${Math.round(syncMin * 60)}s.json`))
  R.syncCorrected = summarizeSync(path.join(rawDir, `sync-corrected-${Math.round(syncMin * 60)}s.json`))
  R.soak1080 = summarizeSoak(path.join(rawDir, `soak-1080-${soakMin}min-2w.jsonl`), false)
  R.soak4k = summarizeSoak(path.join(rawDir, `soak-4k-${soak4kMin}min-1w.jsonl`), true)
  const machine = { platform: process.platform, arch: process.arch, osRelease: os.release(), cpu: os.cpus()[0] && os.cpus()[0].model, cores: os.cpus().length, memGB: +(os.totalmem() / 2 ** 30).toFixed(1), electronExe: path.basename(EXE) }
  const out = { started: started.toISOString(), finished: new Date().toISOString(), smoke, hidden, thresholds: T, machine, assetNote, steps, results: R }
  fs.writeFileSync(path.join(outDir, base + '.json'), JSON.stringify(out, null, 2))
  const row = (k, v) => `| ${k} | ${v} |`
  const md = [`# Overnight media spikes — ${machine.platform}-${machine.arch}${smoke ? ' (SMOKE RUN — short, not valid for verdicts)' : ''}`, '',
    `Started ${out.started} · finished ${out.finished}`, `Machine: ${machine.cpu} · ${machine.cores} cores · ${machine.memGB} GB · OS ${machine.osRelease}`, assetNote.length ? `\n> ${assetNote.join('; ')}\n` : '', '',
    '## Verdicts', '', '| Test | Result | Key numbers |', '|---|---|---|',
    `| Sync, free-running (${R.syncFree.minutes ?? '?'} min) | ${R.syncFree.verdict} (info) | p95 ${R.syncFree.p95AbsMs} ms · max ${R.syncFree.maxAbsMs} ms · growth ${R.syncFree.driftGrowthMsPerMin} ms/min |`,
    `| Sync, corrected (${R.syncCorrected.minutes ?? '?'} min) | **${R.syncCorrected.verdict}** | p95 ${R.syncCorrected.p95AbsMs} ms (limit ${T.syncP95}) · max ${R.syncCorrected.maxAbsMs} ms (limit ${T.syncMax}) · seeks ${R.syncCorrected.seeks} |`,
    `| Soak 1080p30 (${R.soak1080.minutes ?? '?'} min, 2 windows) | **${R.soak1080.verdict}** | stalls ${R.soak1080.stalls} · worst dropped ${R.soak1080.droppedPctWorstWindow}% · memory slope ${R.soak1080.memSlopeMBperHour && R.soak1080.memSlopeMBperHour.total} MB/h · CPU ${R.soak1080.cpuMeanPctOfOneCore}% |`,
    `| Soak 4K30 (${R.soak4k.minutes ?? '?'} min) | **${R.soak4k.verdict}** | stalls ${R.soak4k.stalls} · worst dropped ${R.soak4k.droppedPctWorstWindow}% · memory slope ${R.soak4k.memSlopeMBperHour && R.soak4k.memSlopeMBperHour.total} MB/h · CPU ${R.soak4k.cpuMeanPctOfOneCore}% |`, '',
    '## Thresholds used', '', '| Measure | PASS | WARN | FAIL |', '|---|---|---|---|',
    `| Stalls (playback stopped ≥ 2 samples) | 0 | ≤ ${T.stallsWarn} | more |`, `| Dropped frames (worst window) | ≤ ${T.dropWarnPct}% | ≤ ${T.dropFailPct}% | more |`,
    `| Memory growth (renderers + GPU) | ≤ ${T.memWarnMBh} MB/h | ≤ ${T.memFailMBh} MB/h | more |`, `| CPU (all Born Again processes) | ≤ ${T.cpu1080}% of one core (1080p) / ${T.cpu4k}% (4K) | above | — |`,
    `| Sync corrected: p95 / max drift | ≤ ${T.syncP95} ms / ≤ ${T.syncMax} ms | p95 ≤ ${T.syncP95Warn} ms | more |`, '',
    '## Steps', '', '| Step | Exit | Seconds |', '|---|---|---|', ...steps.map(s => `| ${s.name} | ${s.ok ? 'ok' : 'FAILED (' + s.code + ')'} | ${s.secs} |`), '',
    `Full numbers: \`${base}.json\` and the \`${base}-raw/\` folder. Progress log: \`${base}.log\`.`].join('\n')
  fs.writeFileSync(path.join(outDir, base + '.md'), md)
  if (!keepAssets) for (const f of made) try { fs.unlinkSync(f) } catch {}
  log('ALL DONE. Send back: ' + path.join(outDir, base + '.md') + ' and ' + base + '.json (and the -raw folder if asked).')
})().catch(e => { log('FATAL ' + (e && e.stack || e)); process.exit(1) })
