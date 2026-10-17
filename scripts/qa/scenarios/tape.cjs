#!/usr/bin/env node
/* Scenario: the Tape place end to end — list, tabs, Add menu, Download dialog with suggestions, row menu and remove confirmation, the watched folder strip, loading into the player, the follow list at a position,
 * the hand-timing editor, a different text language, Options. Captured and checked at every step.     node scripts/qa/scenarios/tape.cjs <profileDir> [port] */
const fs = require('fs')
const { launch, sleep } = require('../lib.cjs'); const { recorder } = require('../scenario-lib.cjs')
const [profile = '/tmp/qa-pop-tape', port = '9994'] = process.argv.slice(2)
const rec = recorder('tape')
const step = async (label, fn) => { try { await fn() } catch (e) { rec.note(`step failed: ${label}: ${String(e).slice(0, 160)}`) } }
;(async () => {
  fs.rmSync('/tmp/qa-tape-folder', { recursive: true, force: true }); fs.mkdirSync('/tmp/qa-tape-folder', { recursive: true })
  const app = await launch({ profile, port: +port, remotePort: 4492, mdns: 'born-qa-tape', settle: 9000, env: { BORN_TEST_TAPE_FOLDER: '/tmp/qa-tape-folder' } })
  const p = await app.page(); await p.viewport(1366, 768)
  const shot = (id, note) => rec.capture(p, id, note)
  const esc = async () => { await p.key('Escape'); await sleep(350) }
  try {
    await step('open tape', async () => { await p.click('Tape'); await sleep(1500); await shot('place', 'Tape place with a recording (timing starting)') })
    for (const t of ['Timing', 'Options', 'Follow']) await step(t, async () => { await p.click(t, '[role=tab]'); await sleep(900); await shot('tab-' + t.toLowerCase(), 'Tape › ' + t) })
    await step('add menu', async () => { await p.click('More ways to add'); await sleep(500); await shot('add-menu', 'Add ▾ menu'); await esc() })
    await step('download dialog', async () => { await p.click('More ways to add'); await sleep(300); await p.click('Download…'); await sleep(600); await shot('download-empty', 'Download dialog, empty'); await p.type('brass'); await sleep(500); await shot('download-suggest', 'Download dialog with suggestions'); await p.key('Enter'); await sleep(500); await shot('download-chosen', 'Download dialog, sermon chosen'); await esc() })
    await step('download no match', async () => { await p.click('More ways to add'); await sleep(300); await p.click('Download…'); await sleep(500); await p.type('zzzzqq'); await sleep(400); await shot('download-nomatch', 'Download dialog, no match'); await esc() })
    await step('row menu', async () => { await p.click('More for'); await sleep(500); await shot('row-menu', 'Recording row ⋯ menu'); await p.click('Remove this recording'); await sleep(500); await shot('remove-confirm', 'Remove confirmation'); await p.click('Keep it'); await sleep(300) })
    await step('options folder', async () => { await p.click('Options', '[role=tab]'); await sleep(700); await p.click('Change…'); await sleep(900); await shot('options-folder-set', 'Options after choosing the Tape audio folder'); })
    await step('strip', async () => {
      const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + 200000, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(8000, 24); hdr.writeUInt32LE(16000, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(200000, 40)
      fs.writeFileSync('/tmp/qa-tape-folder/99-0404E Evening Hymn Service.wav', Buffer.concat([hdr, Buffer.alloc(200000)])); fs.writeFileSync('/tmp/qa-tape-folder/mystery.wav', Buffer.concat([hdr, Buffer.alloc(200000)]))
      await sleep(4500); await shot('strip', 'two new files found in the folder'); await p.click('See them'); await sleep(500); await shot('strip-open', 'strip expanded'); await p.click('Choose sermon'); await sleep(900); await shot('pending-sheet', 'which sermon is this file for?'); await p.ev(`(()=>{const i=document.querySelector('[role=dialog] input');if(i)i.focus()})()`); await p.type('sermon'); await sleep(500); await shot('pending-typed', 'typed in the sermon box'); await esc()
    })
    await step('follow + load', async () => { await p.click('Follow', '[role=tab]'); await sleep(600); await p.click('Load it into the player'); await sleep(2500); await shot('loaded', 'tape loaded into the player (dock shows it)') })
    await step('seek', async () => { await p.ev(`window.electronAPI.tapeCommand({type:'seek', to: 1500})`); await sleep(1500); await shot('seeked', 'tape at 25:00, follow list') })
    await step('hand timing editor', async () => { await p.click('Timing', '[role=tab]'); await sleep(600); await p.click('Edit timing'); await sleep(1500); const ok = await p.click('Tap to sync'); await sleep(1500); await shot('sync-editor', 'hand-timing editor'); await esc(); await sleep(500) })
    await step('language', async () => { await p.click('Follow', '[role=tab]'); await sleep(500); await p.ev(`(()=>{const s=document.querySelector('select[aria-label="Text language"]');if(s){const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'es');s.dispatchEvent(new Event('change',{bubbles:true}))}})()`); await sleep(2500); await shot('language-es', 'Spanish text over an English tape') })
    await step('dock tape controls', async () => { await shot('dock-with-tape', 'Now dock with the tape'); await p.click('Run view'); await sleep(900); await shot('run-with-tape', 'Run view with the tape loaded') })
    await step('tape timing finished?', async () => { await sleep(60000); await shot('after-timing', 'a minute later (timing may have finished)') })
  } catch (e) { rec.note('SCENARIO ERROR ' + String(e).slice(0, 300)) }
  rec.save(); p.close(); await app.kill(); console.log('tape scenario done')
})()
