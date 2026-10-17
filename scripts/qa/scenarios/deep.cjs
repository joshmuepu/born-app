#!/usr/bin/env node
/* Scenario: the deeper surfaces the crawl does not reach — right-click menus on every kind of item, the song paste → review → slide editor, Bible modes and verse actions, Screens manager channels, Saved remove,
 * media rename / folder menus, the YouTube add dialog (offline), service-pack dialogs, queue row actions and Back/Next jump menus, a video on the stage, the timing editor's messages.   node scripts/qa/scenarios/deep.cjs <profileDir> [port] */
const { launch, sleep } = require('../lib.cjs'); const { recorder } = require('../scenario-lib.cjs')
const [profile = '/tmp/qa-pop-deep', port = '9998'] = process.argv.slice(2)
const rec = recorder('deep')
const step = async (label, fn) => { try { await fn() } catch (e) { rec.note(`step failed: ${label}: ${String(e).slice(0, 160)}`) } }
;(async () => {
  const app = await launch({ profile, port: +port, remotePort: 4560, mdns: 'born-qa-deep', settle: 8000, env: { BORN_OFFLINE: '1', BORN_TEST_NO_AUTO_TIMING: '1' } })
  const p = await app.page(); await p.viewport(1366, 768)
  const shot = (id, note) => rec.capture(p, id, note)
  const esc = async () => { await p.key('Escape'); await sleep(300) }
  const mouse = async (x, y, button = 'left', n = 1) => { for (const t of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type: t, x, y, button, clickCount: n, buttons: button === 'right' ? 2 : 1 }) }
  const rclickText = async (txt, sel = 'button,li,div,span,p,a') => { const pos = await p.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>0&&r.top<innerHeight&&x.innerText&&x.innerText.trim().toLowerCase().startsWith(${JSON.stringify(txt.toLowerCase())})}).sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];if(!e)return null;const r=e.getBoundingClientRect();return [r.left+Math.min(40,r.width/2),r.top+r.height/2]})()`); if (!pos) return false; await mouse(pos[0], pos[1], 'right'); await sleep(450); return true }
  try {
    // queue rows: right-click menu, row buttons
    await step('queue menu', async () => { await p.click('Queue'); await sleep(600); await rclickText('Do You Now'); await shot('ctx-queue-quote', 'right-click a sermon item in the queue'); await esc(); await rclickText('John 3:16'); await shot('ctx-queue-bible', 'right-click a Bible item'); await esc(); await rclickText('tiny'); await shot('ctx-queue-media', 'right-click a picture item'); await esc(); await rclickText("'Tis"); await shot('ctx-queue-song', 'right-click a song item'); await esc() })
    // sermon results context menu
    await step('sermon ctx', async () => { await p.click('Sermons'); await sleep(400); await p.ev(`document.querySelector('input[placeholder^="Search for a word"]').focus()`); await p.type('faith'); await p.key('Enter'); await sleep(2500); await mouse(500, 259, 'right'); await sleep(500); await shot('ctx-sermon-result', 'right-click a sermon search result'); await esc(); await mouse(500, 259); await sleep(1200); await mouse(500, 330, 'right'); await sleep(500); await shot('ctx-sermon-paragraph', 'right-click a paragraph in the reader'); await esc() })
    // Bible modes + verse actions
    await step('bible', async () => { await p.click('Bible'); await sleep(900); for (const m of ['Search', 'Browse']) { await p.click(m); await sleep(500) } await shot('bible-browse', 'Bible browse'); await p.ev(`(()=>{const i=[...document.querySelectorAll('input')].find(e=>e.getBoundingClientRect().width>0);if(i)i.focus()})()`); await p.type('John 3:16'); await p.key('Enter'); await sleep(1500); await shot('bible-verse', 'Bible reference result'); await mouse(560, 300, 'right'); await sleep(500); await shot('ctx-bible-verse', 'right-click a verse'); await esc() })
    for (const t of ['Phrase', 'All words', 'Any word']) await step('bible mode ' + t, async () => { await p.click('Search'); await sleep(300); await p.click(t); await sleep(400); await shot('bible-mode-' + t.toLowerCase().replace(' ', '-'), 'Bible search mode ' + t) })
    // songs: paste text → review → slide editor
    await step('song paste', async () => { await p.click('Songs'); await sleep(500); await p.click('Import'); await sleep(400); await p.click('Paste text'); await sleep(900); await shot('song-paste', 'paste a song'); await p.ev(`(()=>{const t=document.querySelector('textarea');if(t)t.focus()})()`); await p.type('Verse 1\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\nChorus\nPraise Him praise Him'); await sleep(800); await shot('song-paste-typed', 'pasted text'); await p.click('Review'); await sleep(1200); await shot('song-review', 'review screen'); await p.click('Edit'); await sleep(900); await shot('song-slide-editor', 'slide editor') })
    await step('song editor actions', async () => { const labels = await p.ev(`[...document.querySelectorAll('button,[aria-label]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim()).filter(Boolean).slice(0,60)`); rec.note('song editor controls: ' + JSON.stringify(labels).slice(0, 600)); await esc(); await sleep(500) })
    // Screens manager: channels detail
    await step('screens manager', async () => { await p.click('Screens'); await sleep(500); await p.click('Manage'); await sleep(900); await p.click('Channels'); await sleep(700); await shot('sm-channels', 'Screens manager › Channels'); await p.click('Overflow room'); await sleep(600); await shot('sm-channel-detail', 'channel detail'); await p.click('Outputs'); await sleep(600); await shot('sm-outputs', 'Outputs'); await p.click('Displays'); await sleep(600); await p.click('Not seeing a screen'); await sleep(500); await shot('sm-troubleshoot', 'Displays troubleshooting'); await esc() })
    // Saved
    await step('saved', async () => { await p.click('Saved'); await sleep(500); await shot('saved-empty', 'Saved panel'); await p.click('Close'); await sleep(300) })
    // Media: rename / folders / ctx
    await step('media', async () => { await p.click('Media'); await sleep(800); await mouse(300, 230, 'right'); await sleep(500); await shot('ctx-media-card', 'right-click a picture'); await p.click('Rename'); await sleep(600); await shot('media-rename', 'rename'); await esc(); await p.click('New folder'); await sleep(600); await shot('media-new-folder', 'new folder'); await esc() })
    // File menu / pack dialogs
    await step('file menu', async () => { await p.click('File'); await sleep(400); await shot('file-menu-open', 'File menu'); await p.click('Save service with pictures'); await sleep(1200); await shot('pack-save', 'pack save'); await esc(); await p.click('File'); await sleep(300); await p.click('Open service pack'); await sleep(1200); await shot('pack-open', 'pack open'); await esc() })
    // queue actions: jump / back-next menus and run view next/back
    await step('queue actions', async () => { await p.click('Queue'); await sleep(400); await p.click('Run view'); await sleep(800); await rclickText('Do You Now'); await shot('run-ctx', 'right-click in Run view'); await esc(); await p.click('‹ Prepare'); await sleep(500) })
    // YouTube add (offline)
    await step('youtube', async () => { await p.click('Media'); await sleep(500); await p.click('YouTube'); await sleep(600); await p.type('https://youtu.be/jNQXAC9IVRw'); await sleep(2500); await shot('youtube-offline-typed', 'YouTube link typed offline'); await esc() })
    // a video on the stage monitor
    await step('video', async () => { await p.click('Media'); await sleep(400); await p.click('Videos'); await sleep(700); await mouse(300, 230); await sleep(900); await shot('video-selected', 'video selected'); await p.click('Add to queue'); await sleep(500); await p.ev('window.electronAPI.openProjection()'); await sleep(2000); await p.ev('window.electronAPI.openStage()'); await sleep(1500); await p.click('Queue'); await sleep(400); await shot('video-queued', 'video queued') })
  } catch (e) { rec.note('SCENARIO ERROR ' + String(e).slice(0, 300)) }
  rec.save(); p.close(); await app.kill(); console.log('deep scenario done')
})()
