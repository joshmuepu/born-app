import { createServer, IncomingMessage, ServerResponse } from 'http'
import { networkInterfaces } from 'os'

export interface WebRemoteState {
  queue: Array<{ text: string; sermonTitle: string; dateCode: string; paragraphRef: string }>
  activeIndex: number | null
  blanked: boolean
}

type CommandCallback = (cmd: { action: string; index?: number }) => void

const PORT = 4316
let currentState: WebRemoteState = { queue: [], activeIndex: null, blanked: false }
let commandCallback: CommandCallback | null = null

export function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
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
.q-text{font-size:0.85rem;line-height:1.4;color:#c9d1d9;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
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
var state = {queue:[],activeIndex:null,blanked:false};
function cmd(action,index){
  var body = JSON.stringify({action:action,index:index});
  fetch('/command',{method:'POST',headers:{'Content-Type':'application/json'},body:body});
}
function toggleBlank(){ cmd(state.blanked ? 'unblank' : 'blank'); }
function render(){
  var blankBtn = document.getElementById('blankBtn');
  blankBtn.textContent = state.blanked ? 'Restore' : 'Blank';
  blankBtn.className = 'btn-blank' + (state.blanked ? ' active' : '');
  var qEl = document.getElementById('queue');
  if(!state.queue || state.queue.length === 0){
    qEl.innerHTML = '<div class="empty">No quotes in queue</div>';
    return;
  }
  var html = '';
  for(var i=0;i<state.queue.length;i++){
    var q = state.queue[i];
    var cls = 'q-item' + (i === state.activeIndex ? ' active' : '');
    html += '<div class="' + cls + '" onclick="cmd(\'project\',' + i + ')">';
    html += '<div class="q-meta">' + q.dateCode + ' &middot; ' + q.paragraphRef + '</div>';
    html += '<div class="q-text">' + q.text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
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

export function startWebRemote(onCommand: CommandCallback): void {
  commandCallback = onCommand
  const server = createServer(handleRequest)
  server.listen(PORT, () => {
    console.log(`Web remote available at http://${getLocalIP()}:${PORT}`)
  })
}

export function updateWebRemoteState(state: WebRemoteState): void {
  currentState = state
}
