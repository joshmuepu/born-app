// Key service flows, driven through the real UI, with the number of actions each takes (a click, a key chord, or a typed string = 1).
const { targets, attach, sleep } = require('./cdp.cjs')
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail) }
;(async () => {
  const c = await attach((await targets(9920)).find((x) => x.type === 'page' && x.title === 'Born Again'))
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false })
  let n = 0
  const key = async (k, code, vk, mods = 0) => { n++; for (const t of ['rawKeyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type: t, key: k, code, windowsVirtualKeyCode: vk, modifiers: mods }) }
  const type = async (s) => { n++; for (const ch of s) await c.send('Input.dispatchKeyEvent', { type: 'char', text: ch }); await sleep(400) }
  const click = async (sel, t) => { n++; return c.eval(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>(b.getAttribute('aria-label')||b.textContent).trim().startsWith(${JSON.stringify(t)}));b&&b.click();return !!b})()`) }
  const main = () => c.eval(`window.electronAPI.getLiveState().then(l=>({ref:(l[0].current||{}).reference||null,blanked:l[0].blanked}))`)
  await c.eval(`[...document.querySelectorAll('button')].find(b=>/^Open projection/.test(b.textContent.trim()))?.click()`); await sleep(2500)
  await c.eval(`window.electronAPI.clearChannel('main')`); await sleep(600)
  n = 0; await key('k', 'KeyK', 75, 4); await sleep(500); await type('John 3:16'); await key('Enter', 'Enter', 13); await sleep(1500)
  check('⌘K → type → Enter opens the verse and leaves the keyboard on it; nothing is live yet', (await main()).ref === null && (await c.eval(`document.activeElement.classList.contains('bible-verse')`)), `${n} actions`)
  await key('Enter', 'Enter', 13); await sleep(1200)
  check('one more Enter shows it (keyboard only)', (await main()).ref === 'John 3:16 · KJV', `${n} actions in all`)
  n = 0; await key('Escape', 'Escape', 27); await sleep(500); const hid = (await main()).blanked; await key('Escape', 'Escape', 27); await sleep(500)
  check('Esc hides the screens and Esc brings them back', hid && !(await main()).blanked, `${n} actions`)
  n = 0; await click('button', 'Settings and help'); await sleep(400); await key('Escape', 'Escape', 27); await sleep(500)
  check('Esc that closes the ⚙ menu does NOT hide the screens', !(await main()).blanked, `${n} actions`)
  n = 0; await key('u', 'KeyU', 85, 12); await sleep(500)
  check('Ctrl/⌘+Shift+U switches to Run view', await c.eval(`document.querySelector('.app-main').classList.contains('is-run')`), `${n} action`)
  await key('u', 'KeyU', 85, 12); await sleep(300)
  n = 0; await c.eval(`document.activeElement.blur();document.body.focus()`); await c.eval(`document.querySelector('.skip-links a').focus()`); await key('Enter', 'Enter', 13); await sleep(300)
  check('Skip to content lands in the content in 2 stops (Tab to the link, Enter)', await c.eval(`!!document.activeElement.closest('#main-content')`))
  console.log(results.length, 'checks,', results.filter((r) => !r).length, 'failed')
  await c.send('Emulation.clearDeviceMetricsOverride'); c.close()
  process.exitCode = results.every(Boolean) ? 0 : 1
})().catch((e) => { console.error('ERR', e); process.exit(1) })
