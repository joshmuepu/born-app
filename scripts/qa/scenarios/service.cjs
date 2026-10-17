#!/usr/bin/env node
/* Scenario: running a service — prepare a queue from every source, then run it live in Prepare and Run view, with the outputs open; every popover/dialog/toast on the way is captured and checked.
 *   node scripts/qa/scenarios/service.cjs <profileDir> [port]     -> qa-out/census-runtime-scenarios-service.json */
const { launch, sleep } = require('../lib.cjs'); const { recorder } = require('../scenario-lib.cjs')
const [profile = '/tmp/qa-pop-svc', port = '9993'] = process.argv.slice(2)
const rec = recorder('service')
const step = async (label, fn) => { try { await fn() } catch (e) { rec.note(`step failed: ${label}: ${String(e).slice(0, 140)}`) } }
;(async () => {
  const app = await launch({ profile, port: +port, remotePort: 4460 + (+port % 30), mdns: 'born-qa-svc', settle: 8000 })
  const p = await app.page(); await p.viewport(1366, 768)
  const shot = (id, note) => rec.capture(p, id, note)
  const esc = async () => { await p.key('Escape'); await sleep(350) }
  try {
    await shot('home', 'populated profile, Sermons')
    // prepare: sermon search → reader → add paragraph
    await step('sermon search', async () => { await p.click('Sermons'); await sleep(400); await p.ev(`document.querySelector('input[placeholder^="Search for a word"]').focus()`); await p.type('holy spirit'); await p.key('Enter'); await sleep(2500); await shot('sermons-results', 'sermon search results') })
    await step('sermon reader', async () => { await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 500, y: 259, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 500, y: 259, button: 'left', clickCount: 1 }); await sleep(1500); await shot('sermon-reader', 'sermon reader opened from a result') })
    await step('add to queue', async () => { await p.click('+ Queue'); await sleep(600); await shot('queued-toast', 'after + Queue'); })
    for (const tab of ['Date', 'Series', 'Location', 'Recently Played']) await step(tab, async () => { await p.click(tab); await sleep(1200); await shot('sermons-' + tab.toLowerCase().replace(/\W+/g, '-'), 'Sermons › ' + tab) })
    // Bible
    await step('bible', async () => { await p.click('Bible'); await sleep(800); await shot('bible-home', 'Bible'); await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(e=>e.getBoundingClientRect().width>0);if(i)i.focus()})()`); await p.type('John 3:16'); await p.key('Enter'); await sleep(1500); await shot('bible-reference', 'Bible reference typed') })
    // Songs
    await step('songs', async () => { await p.click('Songs'); await sleep(600); await p.ev(`document.querySelector('input[placeholder^="Search titles"]').focus()`); await p.type('grace'); await sleep(1200); await shot('songs-results', 'song search'); await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 300, y: 215, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 300, y: 215, button: 'left', clickCount: 1 }); await sleep(1200); await shot('song-detail', 'a song opened') })
    await step('song import menu', async () => { await p.click('Import'); await sleep(500); await shot('song-import-menu', 'Songs › Import menu'); await esc(); await p.click('All songbooks'); await sleep(500); await shot('songbook-menu', 'songbook menu'); await esc() })
    // Media
    await step('media', async () => { await p.click('Media'); await sleep(900); await shot('media-home', 'Media'); await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 300, y: 230, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 300, y: 230, button: 'left', clickCount: 1 }); await sleep(900); await shot('media-detail', 'a picture selected') })
    for (const f of ['Favorites', 'Recently used', 'Needs attention', 'Videos', 'Backgrounds']) await step(f, async () => { await p.click(f); await sleep(700); await shot('media-' + f.toLowerCase().replace(/\W+/g, '-'), 'Media › ' + f) })
    await step('youtube dialog', async () => { await p.click('All media'); await p.click('YouTube'); await sleep(700); await shot('youtube-add', 'Media › YouTube dialog'); await esc() })
    // Saved, tape rail
    await step('saved', async () => { await p.click('Saved'); await sleep(700); await shot('saved-favorites', 'Saved › Favorites'); await p.click('Recent'); await sleep(500); await shot('saved-recent', 'Saved › Recent'); await p.click('Close'); await sleep(300) })
    // queue, readiness, file menu, run view
    await step('queue', async () => { await p.click('Queue'); await sleep(700); await shot('queue-open', 'Queue panel'); })
    await step('readiness', async () => { await p.click('Is tonight ready'); await sleep(1500); await shot('readiness', 'Is tonight ready? popover'); await esc() })
    await step('file menu', async () => { await p.click('File'); await sleep(500); await shot('file-menu', 'File menu'); await esc() })
    await step('run view', async () => { await p.click('Run view'); await sleep(900); await shot('run-view', 'Run view, projection closed'); })
    // live
    await step('open projection', async () => { await p.ev('window.electronAPI.openProjection()'); await sleep(2500); await p.ev('window.electronAPI.openStage()'); await sleep(1500); await shot('run-view-open', 'Run view with the screens open') })
    await step('message', async () => { const ok = await p.click('Message'); rec.note('Message button found: ' + ok); await sleep(600); await shot('message-dialog', 'Message dialog'); await p.ev(`(()=>{const t=document.querySelector('[role=dialog] textarea, [role=dialog] input[type=text], .modal textarea, .modal input');if(t)t.focus()})()`); await p.type('Please move your car'); await sleep(300); await shot('message-typed', 'Message dialog with text'); await esc() })
    await step('show next', async () => { await p.click('Show next'); await sleep(900); await shot('live-1', 'first item live'); await p.click('Show next'); await sleep(900); await shot('live-2', 'second item live'); await p.click('Back in the service'); await sleep(700); await shot('live-back', 'stepped back') })
    await step('hide/show screen', async () => { await p.click('Hide screen'); await sleep(700); await shot('screen-hidden', 'screens hidden'); await p.click('Show screen'); await sleep(700); await shot('screen-shown', 'screens shown again') })
    await step('esc rules', async () => { await p.key('Escape'); await sleep(600); await shot('esc-blank', 'Esc blanks'); await p.key('Escape', { shift: true }); await sleep(600); await shot('shift-esc', 'Shift+Esc blanks') ; await p.click('Show screen'); await sleep(500) })
    await step('prepare view', async () => { await p.click('‹ Prepare'); await sleep(800); await shot('prepare-live', 'back to Prepare with something live') })
    await step('screens menu', async () => { await p.click('Screens'); await sleep(700); await shot('screens-menu', 'Screens menu'); const tabs = await p.ev(`[...document.querySelectorAll('[role=tab],button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.innerText.trim()).filter(Boolean).slice(0,40)`); rec.note('screens menu controls: ' + JSON.stringify(tabs).slice(0, 400)); await esc() })
    await step('manage screens', async () => { await p.click('Screens'); await sleep(500); await p.click('Manage'); await sleep(900); await shot('screens-manager', 'Screens manager'); for (const t of ['Outputs', 'Displays', 'Status']) { await p.click(t); await sleep(600); await shot('screens-manager-' + t.toLowerCase(), 'Screens manager › ' + t) } await esc() })
    await step('command palette', async () => { await p.key('k', { meta: true }); await sleep(600); await p.type('john'); await sleep(900); await shot('command-palette', '⌘K palette with a query'); await esc() })
    await step('shortcuts', async () => { await p.key('?'); await sleep(600); await shot('shortcuts', 'shortcuts'); await esc() })
    await step('gear', async () => { await p.click('Settings and help'); await sleep(500); await shot('gear', '⚙ menu'); for (const label of ['Light', 'High', 'Dark', 'Normal']) { await p.click(label); await sleep(300) } await shot('gear-after', '⚙ menu after theme changes'); await esc() })
  } catch (e) { rec.note('SCENARIO ERROR ' + String(e).slice(0, 300)) }
  rec.save(); p.close(); await app.kill(); console.log('service scenario done')
})()
