const WebSocket = require('/Users/joshmuepu/MyProjects/born-again/node_modules/ws')
const http = require('http')
const get = (u) => new Promise((res, rej) => http.get(u, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => res(JSON.parse(b))) }).on('error', rej))
exports.sleep = (ms) => new Promise((r) => setTimeout(r, ms))
exports.targets = (port = 9344) => get(`http://127.0.0.1:${port}/json`)
exports.attach = async (t) => {
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.once('open', r))
  let id = 0
  const pend = new Map()
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  return {
    send,
    eval: async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value },
    shot: async (path) => { const r = await send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync(path, Buffer.from(r.result.data, 'base64')) },
    close: () => ws.close()
  }
}
