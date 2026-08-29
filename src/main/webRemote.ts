import { createServer, IncomingMessage, ServerResponse } from 'http'
import { networkInterfaces } from 'os'

export interface WebRemoteState {
  queue: Array<{ title: string; kind: string; subtitle: string; slideCount: number }>
  activeIndex: number | null
  activeSlide: number
  blanked: boolean
}

type CommandCallback = (cmd: { action: string; index?: number }) => void

const PORT = 4316
let currentState: WebRemoteState = {
  queue: [],
  activeIndex: null,
  activeSlide: 0,
  blanked: false
}
let commandCallback: CommandCallback | null = null

function isPrivate(addr: string): boolean {
  return (
    addr.startsWith('192.168.') ||
    addr.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr)
  )
}

export function getLocalIP(): string {
  const nets = networkInterfaces()
  const candidates: string[] = []
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address)
    }
  }
  // Prefer a real LAN address (192.168/10/172.16-31) over VPN / virtual adapters.
  return candidates.find(isPrivate) ?? candidates[0] ?? 'localhost'
}

// Inline mobile-friendly HTML (no template literals in the embedded JS to avoid escaping issues)
function buildHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BORN Remote</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;min-height:100vh}
h1{font-size:1rem;font-weight:600;color:#58a6ff;margin-bottom:16px;text-align:center}
.controls{display:flex;gap:8px;margin-bottom:16px}
button{flex:1;padding:14px 8px;border:1px solid #30363d;border-radius:8px;background:#161b22;color:#c9d1d9;font-size:0.9rem;font-weight:600;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
button:active{background:#21262d}
.btn-blank{background:#1a1200;border-color:#8b6914;color:#e3b341}
.btn-blank.active{background:#e3b341;color:#0d1117}
.section-label{font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#8b949e;margin-bottom:8px}
.queue{display:flex;flex-direction:column;gap:6px}
.q-item{background:#161b22;border:1px solid #30363d;border-left:3px solid transparent;border-radius:6px;padding:10px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.q-item.active{border-left-color:#58a6ff;background:rgba(88,166,255,0.08)}
.q-item:active{background:#21262d}
.q-meta{font-size:0.72rem;color:#58a6ff;font-family:monospace;margin-bottom:4px}
.q-text{font-size:0.9rem;font-weight:600;line-height:1.35;color:#c9d1d9}
.q-sub{font-size:0.75rem;color:#8b949e;margin-top:3px;font-family:monospace}
.status{text-align:center;font-size:0.72rem;color:#8b949e;margin-top:16px;padding:8px}
.empty{text-align:center;color:#8b949e;padding:24px;font-size:0.85rem}
</style>
</head>
<body>
<h1>BORN — Branham or Nothing</h1>
<div class="controls">
  <button onclick="cmd('prev')">&#8592; Prev</button>
  <button onclick="cmd('next')">Next &#8594;</button>
  <button id="blankBtn" class="btn-blank" onclick="toggleBlank()">Blank</button>
</div>
<div class="section-label">Queue</div>
<div class="queue" id="queue"></div>
<div class="status" id="status">Connecting&#8230;</div>
<script>
var state = {queue:[],activeIndex:null,activeSlide:0,blanked:false};
function cmd(action,index){
  var body = JSON.stringify({action:action,index:index});
  fetch('/command',{method:'POST',headers:{'Content-Type':'application/json'},body:body});
}
function esc(s){ return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toggleBlank(){ cmd(state.blanked ? 'unblank' : 'blank'); }
function render(){
  var blankBtn = document.getElementById('blankBtn');
  blankBtn.textContent = state.blanked ? 'Restore' : 'Blank';
  blankBtn.className = 'btn-blank' + (state.blanked ? ' active' : '');
  var qEl = document.getElementById('queue');
  if(!state.queue || state.queue.length === 0){
    qEl.innerHTML = '<div class="empty">Nothing in the service queue</div>';
    return;
  }
  var html = '';
  for(var i=0;i<state.queue.length;i++){
    var q = state.queue[i];
    var active = (i === state.activeIndex);
    var cls = 'q-item' + (active ? ' active' : '');
    var progress = '';
    if(q.slideCount > 1){
      progress = active ? (' &middot; ' + (state.activeSlide+1) + '/' + q.slideCount)
                        : (' &middot; ' + q.slideCount + ' slides');
    }
    html += '<div class="' + cls + '" onclick="cmd(\'project\',' + i + ')">';
    html += '<div class="q-meta">' + esc(q.kind).toUpperCase() + progress + '</div>';
    html += '<div class="q-text">' + esc(q.title) + '</div>';
    if(q.subtitle) html += '<div class="q-sub">' + esc(q.subtitle) + '</div>';
    html += '</div>';
  }
  qEl.innerHTML = html;
}
function poll(){
  fetch('/state')
    .then(function(r){ return r.json(); })
    .then(function(s){ state=s; render(); document.getElementById('status').textContent='Connected'; })
    .catch(function(){ document.getElementById('status').textContent='Reconnecting\u2026'; });
}
poll();
setInterval(poll, 1000);
</script>
</body>
</html>`
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.url === '/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(currentState))
    return
  }

  if (req.url === '/command' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { commandCallback?.(JSON.parse(body)) } catch {}
      res.writeHead(204)
      res.end()
    })
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(buildHTML())
}

let remoteAvailable = false

export function isWebRemoteAvailable(): boolean {
  return remoteAvailable
}

export function startWebRemote(onCommand: CommandCallback): void {
  commandCallback = onCommand
  const server = createServer(handleRequest)
  server.on('error', (err: NodeJS.ErrnoException) => {
    remoteAvailable = false
    if (err.code === 'EADDRINUSE') {
      console.error(`Web remote: port ${PORT} is already in use — remote disabled`)
    } else {
      console.error('Web remote server error', err)
    }
  })
  server.listen(PORT, () => {
    remoteAvailable = true
    console.log(`Web remote available at http://${getLocalIP()}:${PORT}`)
  })
}

export function updateWebRemoteState(state: WebRemoteState): void {
  currentState = state
}
