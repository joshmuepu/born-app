#!/usr/bin/env node
/* Scenario: the output surfaces — projector, stage monitor, Graphics page (all three profiles) — fed slides of every kind, long/RTL/CJK/emoji text, blank, alert, and the phone remote at three sizes.
 *   node scripts/qa/scenarios/outputs.cjs <profileDir> [port]      (writes qa-out/census-runtime-scenarios-outputs.json; findings come from checks.js on each output page) */
const { launch, sleep } = require('../lib.cjs'); const { recorder } = require('../scenario-lib.cjs'); const { launchChrome } = require('../chrome.cjs')
const [profile = '/tmp/qa-pop-out', port = '9990'] = process.argv.slice(2)
const rec = recorder('outputs')
const LONG = 'And I am so happy to be here this morning to talk about the wonderful grace of God that was extended to us all, and how we may stand together with one heart and one mind in the presence of the Lord, singing and praising and waiting upon Him for the great things He has promised to those who love Him and keep His commandments, even until the end. '.repeat(2)
const SLIDES = [
  { kind: 'quote', text: 'The shortest slide.', reference: 'A Sample Message · 99-0101M', marker: '1' },
  { kind: 'quote', text: LONG, reference: 'A Sample Message · 99-0101M', marker: '2' },
  { kind: 'bible', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', reference: 'John 3:16 · KJV', marker: '16' },
  { kind: 'song', text: 'Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.', label: 'Verse 1', reference: 'Amazing Grace' },
  { kind: 'song', text: 'الرب راعيّ فلا يعوزني شيء\nفي مراعٍ خضر يربضني', label: 'Verse 1', reference: 'ترنيمة الرب راعيّ' },
  { kind: 'song', text: '主啊，我们赞美你\n荣耀归于你的名', label: 'Verse 1', reference: '主啊，我们赞美你' },
  { kind: 'song', text: 'Gloria in excelsis Deo 🙌\nGloria in excelsis Deo 🎶', label: 'Chorus', reference: 'Gloria 🎶' },
  { kind: 'song', text: 'Thisisonelinewithnospacesatallthatgoesonandonandonandonandonandonandonandonandonandonandonandonandonandonandonandonandonandonandon', label: 'Verse 1', reference: 'Unbreakable line' }
]
;(async () => {
  const app = await launch({ profile, port: +port, remotePort: 4450 + (+port % 40), mdns: 'born-qa-out', settle: 7000 })
  const main = await app.page()
  await main.viewport(1366, 768)
  try {
    await main.ev('window.electronAPI.openProjection()'); await sleep(2500)
    await main.ev('window.electronAPI.openStage()'); await sleep(2000)
    const targets = await app.targets(); rec.note('windows: ' + targets.map((t) => t.type + ':' + t.title).join(' | '))
    const proj = targets.find((t) => /Output/.test(t.title)), stage = targets.find((t) => /Stage/.test(t.title))
    const { Page } = require('../lib.cjs')
    const P = proj ? await new Page(proj).connect() : null, S = stage ? await new Page(stage).connect() : null
    if (P) await P.viewport(1920, 1080)
    if (S) await S.viewport(1920, 1080)
    let i = 0
    if (P) await rec.capture(P, 'projection-idle', 'projector, nothing shown yet')
    if (S) await rec.capture(S, 'stage-idle', 'stage monitor, nothing shown yet')
    for (const sl of SLIDES) {
      i++
      await main.ev(`window.electronAPI.showSlide(${JSON.stringify(sl)})`); await sleep(900)
      await main.ev(`window.electronAPI.updateStage(${JSON.stringify(sl)}, ${JSON.stringify(SLIDES[i % SLIDES.length])})`); await sleep(500)
      if (P) await rec.capture(P, `projection-${i}`, `projector: ${sl.kind} slide ${i}`)
      if (S) await rec.capture(S, `stage-${i}`, `stage: ${sl.kind} slide ${i}`)
    }
    await main.ev(`window.electronAPI.sendAlert('Please move your car — lights are on in the parking lot', 'both')`); await sleep(1200)
    if (P) await rec.capture(P, 'projection-alert', 'projector with an alert'); if (S) await rec.capture(S, 'stage-alert', 'stage with an alert')
    await main.ev('window.electronAPI.setBlankScreen(true)'); await sleep(800)
    if (P) await rec.capture(P, 'projection-blank', 'projector hidden (blank)'); if (S) await rec.capture(S, 'stage-blank', 'stage while hidden')
    await main.ev('window.electronAPI.setBlankScreen(false)')
    // Graphics page, every profile
    const outs = await main.ev('window.electronAPI.listOutputs()'); rec.note('outputs: ' + JSON.stringify(outs).slice(0, 300))
    const g = (outs || []).find((o) => o.localUrl)
    const chrome = await launchChrome(9897)
    if (g && g.localUrl) {
      for (const prof of ['', '?profile=lower-third', '?profile=fullscreen']) {
        const G = await chrome.open(g.localUrl + prof); await G.viewport(1920, 1080); await sleep(1500)
        await main.ev(`window.electronAPI.showSlide(${JSON.stringify(SLIDES[2])})`); await sleep(1200)
        await rec.capture(G, 'graphics' + (prof || '-auto') .replace(/\W+/g, '-'), 'graphics page ' + (prof || 'auto') + ' with a Bible slide')
        await main.ev(`window.electronAPI.showSlide(${JSON.stringify(SLIDES[1])})`); await sleep(1200)
        await rec.capture(G, 'graphics' + (prof || '-auto').replace(/\W+/g, '-') + '-long', 'graphics page ' + (prof || 'auto') + ' with a long paragraph')
        G.close()
      }
    } else rec.note('no Graphics output with a url in the seeded profile')
    // the phone remote
    const info = await main.ev('window.electronAPI.getWebRemoteURL()'); rec.note('remote url: ' + JSON.stringify(info).slice(0, 200))
    const url = (info && (info.url || info.ipUrl || info.hostnameUrl)) || `http://127.0.0.1:${4450 + (+port % 40)}/`
    for (const [w, h, name] of [[360, 640, 'phone-small'], [390, 844, 'phone'], [820, 1180, 'tablet']]) {
      const R = await chrome.open(url.replace(/^http:\/\/[^/]+/, `http://127.0.0.1:${4450 + (+port % 40)}`))
      await R.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await R.send('Page.reload'); await sleep(2500)
      await rec.capture(R, `remote-${name}-home`, `phone remote ${w}x${h}: first screen`)
      const tabs = await R.ev(`[...document.querySelectorAll('button,[role=tab],a.tab,nav a')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,30)).filter(Boolean)`)
      let k = 0
      for (const t of [...new Set(tabs)].slice(0, 14)) { if (/project|show|clear|blank|hide|remove|delete|new service|import|save/i.test(t)) continue; k++; await R.click(t.split(' ').slice(0, 4).join(' ')); await sleep(700); await rec.capture(R, `remote-${name}-${k}`, `phone remote ${w}x${h}: after "${t}"`) }
      R.close()
    }
    P && P.close(); S && S.close(); chrome.kill()
  } catch (e) { rec.note('SCENARIO ERROR ' + String(e).slice(0, 300)) }
  rec.save(); main.close(); await app.kill()
  console.log('outputs scenario done')
})()
