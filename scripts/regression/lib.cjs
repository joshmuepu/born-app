const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function app() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9920')
  const pages = browser.contexts().flatMap((c) => c.pages())
  for (let i = 0; i < 10; i++) {
    for (const p of pages) {
      try {
        const t = await p.evaluate(() => document.title)
        if (t === 'Born Again') return { browser, page: p, pages }
      } catch { /* mid-navigation, retry */ }
    }
    await sleep(1000)
  }
  throw new Error('could not attach to the Born Again window')
}
module.exports = { app }
