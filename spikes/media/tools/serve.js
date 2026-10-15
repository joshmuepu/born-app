// Tiny static server WITH HTTP Range support (needed for video seeking). Works with plain Node or Electron-as-node.
//   node tools/serve.js [port]      -> http://<this-computer-ip>:<port>/obs-test/index.html
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os')
const root = path.resolve(__dirname, '..'), port = +(process.argv[2] || 4399)
const types = { '.html': 'text/html', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.flac': 'audio/flac', '.js': 'text/javascript', '.json': 'application/json' }
let hits = 0
http.createServer((req, res) => {
  const p = path.normalize(path.join(root, decodeURIComponent(req.url.split('?')[0])))
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('not found') }
  const st = fs.statSync(p), type = types[path.extname(p)] || 'application/octet-stream', r = req.headers.range; hits++
  const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
  if (r) { const m = /bytes=(\d*)-(\d*)/.exec(r); let s = m[1] === '' ? st.size - +m[2] : +m[1], e = m[1] !== '' && m[2] ? +m[2] : st.size - 1
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 }); fs.createReadStream(p, { start: s, end: e }).pipe(res) }
  else { res.writeHead(200, { ...h, 'Content-Length': st.size }); fs.createReadStream(p).pipe(res) }
}).listen(port, '0.0.0.0', () => {
  console.log('Serving', root)
  for (const [n, a] of Object.entries(os.networkInterfaces())) for (const i of a) if (i.family === 'IPv4' && !i.internal) console.log(`  http://${i.address}:${port}/obs-test/index.html   (${n})`)
})
