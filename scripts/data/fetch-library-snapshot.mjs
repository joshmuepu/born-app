#!/usr/bin/env node
/* Puts the bundled libraries in place for a release build from the library snapshot, instead of rebuilding them from the outside sites.
 *
 * The snapshot is a pre-release of this repo (tag libraries-v1-YYYYMMDD) holding sermons.db.gz and library.db.gz, made by the
 * "refresh libraries (manual)" workflow. scripts/data/library-snapshot.json names it and records each file's SHA-256, size and format and
 * the exact counts. This script downloads the two files, checks the size and SHA-256 of each, then runs verify-libraries.cjs with the exact
 * counts. Anything different stops the build with the snapshot's name. It never falls back to fetching from the sources.
 *
 * Usage: node scripts/data/fetch-library-snapshot.mjs <library-snapshot.json> <out dir, e.g. resources>
 * Env: GITHUB_TOKEN or GH_TOKEN (optional for a public repo), GITHUB_REPOSITORY (default joshmuepu/born-app),
 *      BORN_GITHUB_API (default https://api.github.com; the tests point it at a local server). */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [manifestPath, outDir] = process.argv.slice(2)
if (!manifestPath || !outDir) {
  console.error('usage: fetch-library-snapshot.mjs <library-snapshot.json> <out dir>')
  process.exit(2)
}
const API = (process.env.BORN_GITHUB_API || 'https://api.github.com').replace(/\/$/, '')
const REPO = process.env.GITHUB_REPOSITORY || 'joshmuepu/born-app'
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const name = manifest.snapshot || '(none)'

function stop(why) {
  console.error(`::error::Library snapshot ${name}: ${why}. The build stops here; it does not rebuild the libraries from the sources.`)
  process.exit(1)
}

const headers = (accept) => ({ Accept: accept, 'User-Agent': 'born-release-build', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) })

async function main() {
  if (!manifest.snapshot) stop('the manifest names no snapshot yet (run "refresh libraries (manual)" and merge its manifest change)')
  if (/^v/i.test(manifest.snapshot)) stop('a snapshot tag must not start with "v" (release tags do)')
  if (!Array.isArray(manifest.files) || manifest.files.length !== 2) stop('the manifest must list sermons.db.gz and library.db.gz')

  const res = await fetch(`${API}/repos/${REPO}/releases/tags/${encodeURIComponent(manifest.snapshot)}`, { headers: headers('application/vnd.github+json') })
  if (!res.ok) stop(`the snapshot release was not found (GitHub answered ${res.status})`)
  const release = await res.json()
  mkdirSync(outDir, { recursive: true })

  for (const f of manifest.files) {
    const asset = (release.assets || []).find((a) => a.name === f.name)
    if (!asset) stop(`${f.name} is missing from the snapshot release`)
    const dl = await fetch(asset.url, { headers: headers('application/octet-stream'), redirect: 'follow' })
    if (!dl.ok) stop(`${f.name} could not be downloaded (status ${dl.status})`)
    const buf = Buffer.from(await dl.arrayBuffer())
    if (buf.length !== f.size) stop(`${f.name} is ${buf.length} bytes, the manifest says ${f.size}`)
    const sha = createHash('sha256').update(buf).digest('hex')
    if (sha !== f.sha256) stop(`${f.name} has SHA-256 ${sha}, the manifest says ${f.sha256}`)
    const out = join(outDir, f.name)
    writeFileSync(out + '.tmp', buf)
    renameSync(out + '.tmp', out)
    console.log(`${f.name}: ${buf.length} bytes, SHA-256 matches the manifest (${sha})`)
  }

  const verify = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'verify-libraries.cjs')
  const r = spawnSync(process.execPath, [verify, outDir, '--exact', manifestPath], { stdio: 'inherit' })
  if (r.status !== 0) {
    for (const f of manifest.files) if (existsSync(join(outDir, f.name))) rmSync(join(outDir, f.name))
    stop('the libraries do not match the counts in the manifest (see the FAIL lines above)')
  }
  console.log(`library snapshot ${manifest.snapshot}: checksums and exact counts match`)
}

main().catch((e) => stop(String(e && e.message ? e.message : e)))
