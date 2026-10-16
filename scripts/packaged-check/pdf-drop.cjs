const { attach, sleep } = require('./cdp.cjs')
;(async () => {
  const main = await attach(t => t.title === 'Born Again', 9921); await main.send('Runtime.enable')
  await main.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false })
  await main.ev(`[...document.querySelectorAll('.rail-btn')].find(b=>/Media/.test(b.innerText)).click()`); await sleep(800)
  const f = [process.argv[2]]
  const pt = { x: 450, y: 450 }
  for (const type of ['dragEnter', 'dragOver', 'drop']) await main.send('Input.dispatchDragEvent', { type, x: pt.x, y: pt.y, data: { items: [], files: f, dragOperationsMask: 1 } })
  for (let i = 0; i < 20; i++) { await sleep(1000); const t = await main.ev(`document.querySelector('.media-report, .media-progress')?.innerText||''`); if (/slideshow|couldn|password|damaged/i.test(t)) { console.log(t.replace(/\s+/g,' ')); break } }
  await main.shot((process.env.PKG_OUT||'.') + '/pdf.png'); process.exit(0)
})()
