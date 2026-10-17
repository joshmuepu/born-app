#!/usr/bin/env node
/* Probe: run a few steps against a throw-away copy of a profile and print what is on screen. For writing scenarios.
 *   node scripts/qa/probe.cjs <srcProfile> <port> "click:Songs" "wait:600" "type:grace" "key:Enter" "labels" "text" "shot:/tmp/x.png"           */
const fs = require('fs'), { execSync } = require('child_process')
const { launch, sleep } = require('./lib.cjs')
const [src, port, ...steps] = process.argv.slice(2)
;(async () => {
  const dst = '/tmp/qa-probe-' + port; execSync(`rm -rf ${dst}; cp -R ${src} ${dst}`)
  const app = await launch({ profile: dst, port: +port, remotePort: 4480 + (+port % 10), mdns: 'born-qa-probe', settle: 5000 })
  const p = await app.page(); await p.viewport(1366, 768)
  for (const st of steps) {
    const [cmd, ...rest] = st.split(':'); const arg = rest.join(':')
    if (cmd === 'click') console.log('click', arg, await p.click(arg))
    else if (cmd === 'clicksel') console.log('clicksel', arg, await p.clickSel(arg))
    else if (cmd === 'mouse') { const [x, y] = arg.split(',').map(Number); await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
    else if (cmd === 'wait') await sleep(+arg)
    else if (cmd === 'type') await p.type(arg)
    else if (cmd === 'key') { const [k, ...m] = arg.split('+').reverse(); await p.key(k, { ctrl: m.includes('ctrl'), meta: m.includes('meta'), shift: m.includes('shift'), alt: m.includes('alt') }) }
    else if (cmd === 'ev') console.log('ev', String(JSON.stringify(await p.ev(arg))).slice(0, 1500))
    else if (cmd === 'shot') await p.shot(arg)
    else if (cmd === 'labels') console.log('controls:', JSON.stringify(await p.ev(`[...document.querySelectorAll('button,[role=tab],[role=menuitem],a,[role=switch],[role=radio],input,select,textarea,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight}).map(e=>(e.tagName[0]+':'+((e.getAttribute('aria-label')||e.placeholder||e.innerText||e.value||'').replace(/\\s+/g,' ').trim().slice(0,36))))`)))
    else if (cmd === 'text') console.log('text:', (await p.ev('document.body.innerText')).replace(/\n+/g, ' | ').slice(0, 1200))
    await sleep(250)
  }
  for (const l of p.takeLogs().filter((x) => !/Security Warning/.test(x.text))) console.log('LOG', l.kind, l.text.slice(0, 200))
  p.close(); await app.kill()
})()
