/* Headless Google Chrome for pages served BY the app (the phone remote, the Graphics page): Electron cannot open new tabs, Chrome can. Used with the same Page helper and checks as the app window. */
const { spawn } = require('child_process'); const http = require('http'); const fs = require('fs')
const { Page, sleep, getJson } = require('./lib.cjs')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
exports.launchChrome = async (port = 9897) => {
  const dir = `/tmp/qa-chrome-${port}`; fs.rmSync(dir, { recursive: true, force: true })
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { await getJson(`http://127.0.0.1:${port}/json/version`); break } catch { await sleep(300) } }
  return {
    async open(url) {
      const t = await new Promise((res, rej) => { const req = http.request(`http://127.0.0.1:${port}/json/new?${encodeURI(url)}`, { method: 'PUT' }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(new Error(d.slice(0, 120))) } }) }); req.on('error', rej); req.end() })
      return new Page(t).connect()
    },
    kill() { try { proc.kill() } catch { /* gone */ } }
  }
}
