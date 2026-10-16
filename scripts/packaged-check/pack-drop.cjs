const { attach, sleep } = require('./cdp.cjs')
;(async () => {
  const m = await attach(t => t.title === 'Born Again', Number(process.env.PKG_PORT||9921)); await m.send('Runtime.enable')
  await m.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false })
  const f = process.argv[2]
  const drop = async () => { for (const type of ['dragEnter', 'dragOver', 'drop']) await m.send('Input.dispatchDragEvent', { type, x: 700, y: 400, data: { items: [], files: [f], dragOperationsMask: 1 } }); await sleep(2500) }
  await drop()
  console.log('review:', (await m.ev(`document.querySelector('.modal.preflight')?.innerText||''`)).replace(/\s+/g, ' ').slice(0, 420))
  await m.shot((process.env.PKG_OUT||'.') + '/10-pack-review.png')
  await m.ev(`[...document.querySelectorAll('.modal.preflight button')].find(b=>/Add \\d+ picture|Open service/.test(b.innerText)).click()`); await sleep(3500)
  console.log('toast:', (await m.ev(`document.body.innerText`)).match(/Service pack opened[^\n]*/)?.[0])
  console.log('queue rows', await m.ev(`document.querySelectorAll('.queue-row').length`), 'library', await m.ev(`window.electronAPI.mediaList({}).then(x=>(x.items||x).length)`))
  await m.shot((process.env.PKG_OUT||'.') + '/10b-pack-opened.png')
  await drop()
  console.log('review again:', (await m.ev(`document.querySelector('.modal.preflight')?.innerText||''`)).replace(/\s+/g, ' ').slice(0, 330))
  await m.ev(`[...document.querySelectorAll('.modal.preflight button')].find(b=>/Cancel/.test(b.innerText)).click()`); await sleep(500)
  console.log('preflight check:'); await m.ev(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Check').click()`); await sleep(3000)
  console.log((await m.ev(`document.querySelector('.modal.preflight')?.innerText||''`)).replace(/\s+/g, ' ').slice(0, 200)); process.exit(0)
})()
