const WebSocket = require('ws'); const fs = require('fs')
const sleep = ms => new Promise(r => setTimeout(r, ms))
let nid = 1
async function attach(titleMatch, port = 9920) {
  const list = await (await fetch(`http://localhost:${port}/json`)).json()
  const t = list.find(x => x.type === 'page' && titleMatch(x))
  if (!t) return null
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.once('open', r))
  const send = (method, params = {}) => new Promise((res, rej) => { const i = nid++; const h = d => { const m = JSON.parse(d); if (m.id !== i) return; ws.off('message', h); m.error ? rej(new Error(m.error.message)) : res(m.result) }; ws.on('message', h); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? 'EXC ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) : r.result?.value }
  const shot = async f => { await sleep(400); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(f, Buffer.from(r.data, 'base64')) }
  return { ws, send, ev, shot, t }
}
module.exports = { attach, sleep }
