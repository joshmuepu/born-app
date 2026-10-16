/**
 * youtubeHost.ts — the small local web server that gives YouTube's embedded player a proper home (main process).
 *
 * WHY: YouTube's IFrame Player refuses ("Error 153") to run when it cannot tell which app is asking: it needs an HTTP Referer /
 * origin. BORN's windows load from file:// in a packaged build, which has neither. So the player lives in a tiny page served from
 * http://127.0.0.1:<port>/player.html — a real origin — and BORN's windows show that page in a frame. The same page is used for the
 * hidden "is this video OK?" check and for Test play.
 *
 * WHAT IT NEVER DOES: it does not fetch, store or rewrite any YouTube content. The page only loads YouTube's own player script and
 * iframe from youtube.com and talks to it with the documented IFrame Player API calls. Nothing covers, restyles or blocks the player.
 *
 * The server listens on 127.0.0.1 only (never the network), and every page is tied to a random session id.
 */
import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { isVideoId } from '../shared/youtube'

/** One message from a player page. `t` says what it is; the rest is the player's own numbers. */
export interface HostMessage {
  t: 'ready' | 'state' | 'tick' | 'error' | 'settled'
  state?: number
  time?: number
  duration?: number
  code?: number
}

export type HostMode = 'live' | 'probe' | 'test'

export class YouTubeHost {
  private server: Server | null = null
  private port = 0
  private listeners = new Map<string, (m: HostMessage) => void>()

  /** Start listening on a free loopback port. Safe to call twice. */
  async start(): Promise<number> {
    if (this.server) return this.port
    const srv = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      res.setHeader('Cache-Control', 'no-store')
      // The player is identified to YouTube by this page's origin: send it (never `no-referrer`).
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
      if (req.method === 'GET' && url.pathname === '/player.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(playerPage())
        return
      }
      if (req.method === 'POST' && url.pathname === '/report') {
        const sid = url.searchParams.get('sid') ?? ''
        let body = ''
        req.on('data', (c: Buffer) => {
          body += c.toString('utf8')
          if (body.length > 4096) req.destroy()
        })
        req.on('end', () => {
          try {
            const m = JSON.parse(body) as HostMessage
            this.listeners.get(sid)?.(m)
          } catch { /* a bad message is ignored */ }
          res.writeHead(204)
          res.end()
        })
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve, reject) => {
      srv.once('error', reject)
      srv.listen(0, '127.0.0.1', () => resolve())
    })
    this.server = srv
    this.port = (srv.address() as { port: number }).port
    srv.unref()
    return this.port
  }

  get origin(): string {
    return `http://127.0.0.1:${this.port}`
  }

  /** The address of a player page. `start` is where to cue it (seconds). */
  urlFor(videoId: string, o: { sid: string; mode: HostMode; start?: number }): string {
    if (!isVideoId(videoId)) throw new Error('not a YouTube video id')
    const q = new URLSearchParams({ v: videoId, sid: o.sid, mode: o.mode })
    if (o.start && o.start > 0) q.set('start', String(Math.floor(o.start)))
    return `${this.origin}/player.html?${q.toString()}`
  }

  newSession(): string {
    return randomBytes(9).toString('base64url')
  }

  /** Listen to a page's messages (probe/test windows). */
  listen(sid: string, cb: (m: HostMessage) => void): () => void {
    this.listeners.set(sid, cb)
    return () => this.listeners.delete(sid)
  }

  stop(): void {
    this.server?.close()
    this.server = null
    this.listeners.clear()
  }
}

/**
 * The player page. Kept deliberately dumb: it creates YouTube's player, forwards what the player says (state, time, duration,
 * error code) once a second and on every event, and does what the parent window asks (play, pause, seek, mute, volume).
 * All the judgement (stalled? finished? what does the error mean?) is made by the code in shared/youtube.ts, which is tested.
 */
export function playerPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>YouTube player</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
</head><body><div id="p"></div>
<script>
(function(){
  var q = new URLSearchParams(location.search);
  var videoId = q.get('v') || '', sid = q.get('sid') || '', mode = q.get('mode') || 'live';
  var start = parseInt(q.get('start') || '0', 10) || 0;
  var framed = window.parent !== window;
  var player = null, ready = false, settledTimer = null;
  function send(m){
    if (framed) { try { window.parent.postMessage(m, '*'); } catch (e) {} }
    else { try { fetch('/report?sid=' + encodeURIComponent(sid), { method: 'POST', body: JSON.stringify(m), keepalive: true }); } catch (e) {} }
  }
  function nums(){
    var o = { state: -1, time: 0, duration: 0 };
    try { o.state = player.getPlayerState(); o.time = player.getCurrentTime() || 0; o.duration = player.getDuration() || 0; } catch (e) {}
    return o;
  }
  function report(t, extra){ var o = nums(); o.t = t; if (extra) for (var k in extra) o[k] = extra[k]; send(o); }
  window.onYouTubeIframeAPIReady = function(){
    player = new YT.Player('p', {
      host: 'https://www.youtube.com',
      videoId: videoId,
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, enablejsapi: 1, origin: location.origin, disablekb: 1, fs: 0, autoplay: 0, start: start },
      events: {
        onReady: function(){
          ready = true;
          report('ready');
          // a probe has seen enough once the video is cued, an error arrives, or this long has passed
          if (mode !== 'live') settledTimer = setTimeout(function(){ report('settled'); }, mode === 'probe' ? 3500 : 1500);
          if (mode === 'test') { try { player.mute(); player.playVideo(); } catch (e) {} }
        },
        onStateChange: function(){ report('state'); },
        onError: function(e){ report('error', { code: e && e.data }); }
      }
    });
  };
  window.addEventListener('message', function(ev){
    if (ev.source !== window.parent || !player || !ready) return;
    var m = ev.data || {};
    try {
      if (m.cmd === 'play') player.playVideo();
      else if (m.cmd === 'pause') player.pauseVideo();
      else if (m.cmd === 'seek') player.seekTo(Number(m.to) || 0, true);
      else if (m.cmd === 'mute') { if (m.value) player.mute(); else player.unMute(); }
      else if (m.cmd === 'volume') player.setVolume(Math.max(0, Math.min(100, Math.round(Number(m.value) || 0))));
    } catch (e) {}
  });
  setInterval(function(){ if (ready) report('tick'); }, 1000);
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function(){ send({ t: 'error', code: -1 }); };
  document.head.appendChild(s);
})();
</script></body></html>`
}
