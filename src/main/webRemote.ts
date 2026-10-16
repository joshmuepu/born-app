import { createServer, IncomingMessage, ServerResponse } from 'http'
import { networkInterfaces } from 'os'
import { get as httpGet } from 'http'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { APP_CSS, APP_JS, MANIFEST_JSON, SW_JS, buildAppBody } from './remoteAssets'
import { log } from './logger'
import {
  chooseDefault,
  isLoopbackAddress,
  listNetworks,
  looksVirtual,
  normalizeIp,
  subnetOf,
  type RememberedNetwork
} from './networks'

/** Dev-only escape hatch, same purpose as BORN_USER_DATA_DIR in main/index.ts
 *  — lets a second local checkout bind a different port instead of colliding
 *  with this one. Never set for a real install. */
/** Every IPv4 interface. Exported so tests assert the real bind address. */
export const REMOTE_BIND_HOST = '0.0.0.0'

export const REMOTE_PORT = Number(process.env.BORN_REMOTE_PORT) || 4316

export interface WebRemoteSlide {
  text: string
  label?: string
  marker?: string
  reference?: string
}

export interface WebRemoteState {
  queue: Array<{
    /** Stable row id — commands address a queue row by this, never by its
     *  array position, so a tap that lands after the queue has changed
     *  underneath it (another contributor added/removed something) still
     *  hits the row the operator actually meant, or harmlessly misses
     *  instead of hitting the wrong one. */
    id: string
    title: string
    kind: string
    subtitle: string
    slideCount: number
    /** Actually projected at least once this run — App.tsx's playedIds,
     *  passed straight through so the remote can dim/checkmark it too. */
    played: boolean
    /** Every slide's full content — lets the remote show "the whole song /
     *  passage / quote, tap any part to project it" without a round trip. */
    slides: WebRemoteSlide[]
    /** Which contributor added this item, if any — a phone signed in as
     *  "Operator" groups the queue by this the same way the desktop does;
     *  every other role's phone just ignores the field. */
    source?: { label: string }
  }>
  activeIndex: number | null
  activeSlide: number
  blanked: boolean
  /** Whatever translation the desktop app currently has selected for Bible —
   *  the remote has no translation picker of its own, it just reflects this,
   *  so it never shows different wording than what's actually on screen. */
  bibleTranslation: string
  onScreen: {
    kind: string
    text: string
    reference?: string
    label?: string
    marker?: string
    nextText?: string
    /** Next/Prev flow-through has carried the live slide past what was
     *  actually queued — see App.tsx's `readingAhead`. */
    readingAhead?: boolean
  } | null
}

type CommandCallback = (cmd: {
  action: string
  /** Target row id — 'project', 'project-at', 'remove', and 'reorder'
   *  (the item being moved) all address a queue row by its stable id,
   *  resolved against the live queue at the moment the command actually
   *  runs, never by an array index a phone captured possibly-stale. */
  id?: string
  /** Reorder target row id — only set for action 'reorder'. */
  toId?: string
  slide?: number
  quote?: unknown
  reference?: string
  translation?: string
  query?: string
  songId?: number
  name?: string
  path?: string
  key?: string | null
  /** 'queue-batch' only — a contributor's whole prepared list, sent in one
   *  round trip instead of one command per item. */
  items?: unknown[]
  contributor?: { deviceId: string; label: string }
}) => void

/** Everything the remote's HTTP server needs from the rest of the app, all
 *  injected from index.ts — this module never imports db/bible/songs modules
 *  directly, so the exact same functions the desktop's own IPC handlers call
 *  are what the remote calls too. Results never drift between the two. */
export interface WebRemoteSearchHandlers {
  sermons: (query: string, dateCode?: string) => Promise<unknown[]>
  bible: (query: string, scope?: string) => Promise<unknown>
  songs: (query: string) => Promise<unknown[]>
  song: (id: number) => Promise<unknown>
  bibleBooks: () => Promise<unknown>
  bibleChapter: (bookNum: number, chapter: number) => Promise<unknown>
  recentSongs: () => Promise<unknown[]>
  recentServices: () => Promise<unknown[]>
  sermonSeries: () => Promise<unknown[]>
  sermonsByIds: (ids: number[]) => Promise<unknown[]>
  sermonParagraphs: (sermonId: number) => Promise<unknown[]>
  recentSermons: () => Promise<unknown[]>
  onThisDay: () => Promise<unknown[]>
  recentKeys: () => Promise<string[]>
}

let currentState: WebRemoteState = {
  queue: [],
  activeIndex: null,
  activeSlide: 0,
  blanked: false,
  bibleTranslation: 'KJV',
  onScreen: null
}
let commandCallback: CommandCallback | null = null
let searchHandlers: WebRemoteSearchHandlers | null = null

/** The address the remote advertises by default. Delegates to networks.ts —
 *  the old "first private, non-virtual address in OS enumeration order" rule
 *  is what put the unreachable Ethernet address on the QR at church. */
export function getLocalIP(remembered: RememberedNetwork | null = null): string {
  const { network } = chooseDefault(listNetworks(networkInterfaces()), remembered)
  return network?.address ?? 'localhost'
}

export interface AdapterInfo {
  name: string
  address: string
  /** Matched one of the known VPN/virtual-switch naming patterns. */
  virtual: boolean
  /** This is the address getLocalIP() actually picked. */
  chosen: boolean
}

/** Every non-loopback IPv4 adapter on this machine (kept for the plain
 *  adapter dump; the richer per-network view lives in networks.ts). */
export function listAdapters(): AdapterInfo[] {
  const chosenIp = getLocalIP()
  const out: AdapterInfo[] = []
  for (const [name, ifaces] of Object.entries(networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue
      out.push({ name, address: net.address, virtual: looksVirtual(name), chosen: net.address === chosenIp })
    }
  }
  return out
}

export interface RemoteConnectionInfo {
  available: boolean
  url: string
  ipUrl: string
  hostnameUrl: string | null
}

/** IP is primary: `.local` resolution depends on mDNS actually working on
 *  the phone and the network (some guest/isolated networks and some Android
 *  builds don't resolve it at all), while a bare IP works whenever the phone
 *  can reach the port at all — the exact thing a QR scan needs to get right
 *  on the first try. `.local` is still offered as a secondary address since
 *  it survives a DHCP lease change that would break a bookmarked IP. */
export function buildRemoteConnectionInfo(
  ip: string,
  hostname: string | null,
  port: number
): RemoteConnectionInfo {
  const ipUrl = `http://${ip}:${port}`
  const hostnameUrl = hostname ? `http://${hostname}:${port}` : null
  return { available: true, url: ipUrl, ipUrl, hostnameUrl }
}

function buildHTML(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#0d1117"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="BORN"/>
<link rel="manifest" href="/manifest.json"/>
<link rel="apple-touch-icon" href="/icon-180.png"/>
<link rel="icon" href="/icon-192.png"/>
<title>BORN Remote</title>
<link rel="stylesheet" href="/app.css"/>
</head>
<body>
${buildAppBody()}
<script src="/app.js"></script>
<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}</script>
</body>
</html>`
}

// Icon files are shipped as an extraResource (see package.json) so they
// survive packaging the same way the prebuilt DBs do — same 3-candidate
// lookup pattern the rest of the app already uses for bundled assets.
const iconCache = new Map<number, Buffer | null>()
function loadIcon(size: number): Buffer | null {
  if (iconCache.has(size)) return iconCache.get(size) ?? null
  const name = `icon-${size}.png`
  const candidates = [
    join(process.resourcesPath ?? '', 'remote-icons', name),
    join(app.getAppPath(), 'resources', 'remote-icons', name),
    join(app.getAppPath(), '..', 'resources', 'remote-icons', name)
  ]
  const found = candidates.find((p) => p && existsSync(p))
  const buf = found ? readFileSync(found) : null
  iconCache.set(size, buf)
  return buf
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
  res.end(JSON.stringify(body))
}

function sendText(res: ServerResponse, status: number, contentType: string, body: string): void {
  // No caching: the client (CSS/JS/HTML) is a plain string rebuilt into the
  // app on every release, and a phone/tablet that cached last month's copy
  // would silently run stale UI against this app's current command set.
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
  })
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const url = new URL(req.url ?? '/', 'http://internal')
  const path = url.pathname

  if (path === '/app.css' && req.method === 'GET') {
    sendText(res, 200, 'text/css; charset=utf-8', APP_CSS)
    return
  }
  if (path === '/app.js' && req.method === 'GET') {
    sendText(res, 200, 'application/javascript; charset=utf-8', APP_JS)
    return
  }
  if (path === '/manifest.json' && req.method === 'GET') {
    sendText(res, 200, 'application/manifest+json', MANIFEST_JSON)
    return
  }
  if (path === '/sw.js' && req.method === 'GET') {
    sendText(res, 200, 'application/javascript; charset=utf-8', SW_JS)
    return
  }
  const iconMatch = /^\/icon-(180|192|512)\.png$/.exec(path)
  if (iconMatch && req.method === 'GET') {
    const buf = loadIcon(Number(iconMatch[1]))
    if (buf) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' })
      res.end(buf)
    } else {
      res.writeHead(404)
      res.end()
    }
    return
  }

  if (path === '/state' && req.method === 'GET') {
    // The remote polls this endpoint every second while connected — the most
    // reliable heartbeat already available, so it doubles as the "how many
    // phones are actually connected right now" signal for diagnostics,
    // without adding a second mechanism.
    noteClient(req)
    sendJSON(res, 200, currentState)
    return
  }

  // Reachability self-test for the connection check: answers without touching
  // phone tracking, so testing an address can never look like a phone.
  if (path === '/ping' && req.method === 'GET') {
    sendText(res, 200, 'text/plain; charset=utf-8', 'ok')
    return
  }

  if (path === '/api/search/sermons' && req.method === 'GET') {
    const q = url.searchParams.get('q') ?? ''
    const dateCode = url.searchParams.get('date') ?? undefined
    try {
      sendJSON(res, 200, await searchHandlers!.sermons(q, dateCode))
    } catch {
      sendJSON(res, 200, [])
    }
    return
  }
  if (path === '/api/search/bible' && req.method === 'GET') {
    const q = url.searchParams.get('q') ?? ''
    const scope = url.searchParams.get('scope') ?? undefined
    try {
      sendJSON(res, 200, await searchHandlers!.bible(q, scope))
    } catch {
      sendJSON(res, 200, { kind: 'error', message: 'Search failed.' })
    }
    return
  }
  if (path === '/api/search/songs' && req.method === 'GET') {
    const q = url.searchParams.get('q') ?? ''
    try {
      sendJSON(res, 200, await searchHandlers!.songs(q))
    } catch {
      sendJSON(res, 200, [])
    }
    return
  }
  const songMatch = /^\/api\/song\/(\d+)$/.exec(path)
  if (songMatch && req.method === 'GET') {
    try {
      sendJSON(res, 200, await searchHandlers!.song(Number(songMatch[1])))
    } catch {
      sendJSON(res, 200, null)
    }
    return
  }
  if (path === '/api/bible/books' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.bibleBooks())
    return
  }
  if (path === '/api/bible/chapter' && req.method === 'GET') {
    const book = Number(url.searchParams.get('book') ?? '0')
    const chapter = Number(url.searchParams.get('chapter') ?? '0')
    try {
      sendJSON(res, 200, await searchHandlers!.bibleChapter(book, chapter))
    } catch {
      sendJSON(res, 200, { error: 'Lookup failed.' })
    }
    return
  }
  if (path === '/api/songs/recent' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.recentSongs())
    return
  }
  if (path === '/api/songs/recent-keys' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.recentKeys())
    return
  }
  if (path === '/api/services/recent' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.recentServices())
    return
  }
  if (path === '/api/sermons/series' && req.method === 'GET') {
    try {
      sendJSON(res, 200, await searchHandlers!.sermonSeries())
    } catch {
      sendJSON(res, 200, [])
    }
    return
  }
  if (path === '/api/sermons/by-ids' && req.method === 'GET') {
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n))
    try {
      sendJSON(res, 200, await searchHandlers!.sermonsByIds(ids))
    } catch {
      sendJSON(res, 200, [])
    }
    return
  }
  const sermonParasMatch = /^\/api\/sermons\/(\d+)\/paragraphs$/.exec(path)
  if (sermonParasMatch && req.method === 'GET') {
    try {
      sendJSON(res, 200, await searchHandlers!.sermonParagraphs(Number(sermonParasMatch[1])))
    } catch {
      sendJSON(res, 200, [])
    }
    return
  }
  if (path === '/api/sermons/recent' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.recentSermons())
    return
  }
  if (path === '/api/sermons/on-this-day' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.onThisDay())
    return
  }

  if (path === '/command' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      commandCallback?.(JSON.parse(body))
    } catch {
      /* malformed body — ignore, the remote will just not see an effect */
    }
    res.writeHead(204)
    res.end()
    return
  }

  if (path === '/' && req.method === 'GET') {
    sendText(res, 200, 'text/html; charset=utf-8', buildHTML())
    return
  }

  res.writeHead(404)
  res.end()
}

let remoteAvailable = false
let server: ReturnType<typeof createServer> | null = null

// Client IP -> last time it polled /state, and which of THIS computer's
// addresses it connected to. A phone that stops polling (app closed, screen
// locked, Wi-Fi dropped) ages out of the "connected" count instead of
// counting forever; the entry itself stays for the rest of the run so the
// connection check can say which subnet a phone *has* connected from.
interface ClientSeen {
  at: number
  /** The server-side address the phone actually reached (socket.localAddress). */
  via: string
}
const lastSeenByClient = new Map<string, ClientSeen>()
const CONNECTED_WINDOW_MS = 5000
const MAX_TRACKED_CLIENTS = 50

let phoneViaListener: ((viaAddress: string) => void) | null = null
let lastNotifiedVia: string | null = null

/** Called when a phone first reaches the remote through a given local
 *  address (and again only if that address changes) — index.ts uses it to
 *  remember which network phones really connect from. */
export function setPhoneViaListener(cb: ((viaAddress: string) => void) | null): void {
  phoneViaListener = cb
  lastNotifiedVia = null
}

function noteClient(req: IncomingMessage): void {
  const raw = req.socket.remoteAddress
  if (!raw) return
  const clientIp = normalizeIp(raw)
  const via = normalizeIp(req.socket.localAddress ?? '')
  lastSeenByClient.set(clientIp, { at: Date.now(), via })
  if (lastSeenByClient.size > MAX_TRACKED_CLIENTS) {
    const oldest = [...lastSeenByClient.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) lastSeenByClient.delete(oldest[0])
  }
  // This computer talking to itself over loopback (a browser on the operator
  // PC) still counts as connected, but says nothing about which network a
  // phone is on, so it never feeds the remembered-network logic.
  if (via && !isLoopbackAddress(clientIp) && !isLoopbackAddress(via) && via !== lastNotifiedVia) {
    lastNotifiedVia = via
    try {
      phoneViaListener?.(via)
    } catch (e) {
      log.warn('webRemote: phone-network listener failed', e)
    }
  }
}

/** How many distinct phones have polled /state in the last few seconds —
 *  the operator-visible "N connected" count. Approximate by design: a NAT'd
 *  network could put two phones behind one IP, and a phone that just closed
 *  its tab still counts until it ages out. */
export function getConnectedPhoneCount(): number {
  const now = Date.now()
  let n = 0
  for (const seen of lastSeenByClient.values()) {
    if (now - seen.at <= CONNECTED_WINDOW_MS) n++
  }
  return n
}

export interface PhoneConnection {
  clientIp: string
  subnet: string
  /** The address of this computer the phone connected to. */
  viaAddress: string
  active: boolean
}

/** Every phone that has polled /state since BORN started, newest first. */
export function getPhoneConnections(): PhoneConnection[] {
  const now = Date.now()
  return [...lastSeenByClient.entries()]
    .filter(([clientIp]) => !isLoopbackAddress(clientIp))
    .sort((a, b) => b[1].at - a[1].at)
    .map(([clientIp, seen]) => ({
      clientIp,
      subnet: subnetOf(clientIp),
      viaAddress: seen.via,
      active: now - seen.at <= CONNECTED_WINDOW_MS
    }))
}

export interface AddressProbe {
  address: string
  ok: boolean
  /** Short plain reason when not ok. */
  error: string | null
  ms: number | null
}

/** Self-connect to address:port (an HTTP GET /ping) for each address, in
 *  parallel. Proves the server answers on that address *from this computer*;
 *  it cannot prove a firewall allows a phone in (a machine reaching its own
 *  LAN address is usually let through regardless), which is why the check
 *  also shows the firewall hint. */
export function probeAddresses(addresses: string[], port: number, timeoutMs = 1500): Promise<AddressProbe[]> {
  return Promise.all(
    addresses.map(
      (address) =>
        new Promise<AddressProbe>((resolve) => {
          const started = Date.now()
          let done = false
          const finish = (r: Omit<AddressProbe, 'address'>): void => {
            if (done) return
            done = true
            resolve({ address, ...r })
          }
          try {
            const req = httpGet({ host: address, port, path: '/ping', timeout: timeoutMs, agent: false }, (res) => {
              res.resume()
              finish(
                res.statusCode === 200
                  ? { ok: true, error: null, ms: Date.now() - started }
                  : { ok: false, error: `unexpected reply (${res.statusCode})`, ms: null }
              )
            })
            req.on('timeout', () => {
              req.destroy()
              finish({ ok: false, error: 'no answer (timed out)', ms: null })
            })
            req.on('error', (e: NodeJS.ErrnoException) =>
              finish({ ok: false, error: e.code === 'ECONNREFUSED' ? 'connection refused' : (e.code ?? e.message), ms: null })
            )
          } catch (e) {
            finish({ ok: false, error: e instanceof Error ? e.message : 'failed', ms: null })
          }
        })
    )
  )
}

export function isWebRemoteAvailable(): boolean {
  return remoteAvailable
}

/** Releases the port. Only used by tests today (the app itself just exits
 *  the process instead of shutting this down), but a clean stop is needed to
 *  test the bind-failure path without leaking a held port across test files. */
export function stopWebRemote(): void {
  server?.close()
  server = null
  remoteAvailable = false
  lastSeenByClient.clear()
  lastNotifiedVia = null
}

export function startWebRemote(
  onCommand: CommandCallback,
  search: WebRemoteSearchHandlers,
  // Fires only once the HTTP server has actually bound — the caller starts
  // mDNS advertising from here, never unconditionally after this function
  // returns, since listen() is async and a bind failure (EADDRINUSE or
  // otherwise) must not leave BORN advertising a name/port nothing is
  // listening on (a phone would resolve the name fine and then hang or get
  // refused, with the operator's panel showing nothing wrong).
  onListening?: () => void,
  // Overridable only so tests can bind an ephemeral port instead of the
  // real REMOTE_PORT, which may legitimately already be held by another
  // BORN instance on the same dev machine. Production always uses the
  // default.
  port: number = REMOTE_PORT
): void {
  commandCallback = onCommand
  searchHandlers = search
  server = createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      try {
        res.writeHead(500)
        res.end()
      } catch {
        /* response already sent */
      }
    })
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    remoteAvailable = false
    if (err.code === 'EADDRINUSE') {
      log.error(`webRemote: port ${port} is already in use — remote disabled`)
    } else {
      log.error('webRemote: server error', err)
    }
  })
  // 0.0.0.0 = every network adapter, always. The advertised address is chosen
  // separately (networks.ts); binding to just the advertised one would make
  // every other network on this computer unreachable.
  server.listen(port, REMOTE_BIND_HOST, () => {
    remoteAvailable = true
    log.info(`webRemote: listening on ${REMOTE_BIND_HOST}:${port} (advertising http://${getLocalIP()}:${port})`)
    onListening?.()
  })
}

/** The translation the desktop app currently has selected — always read this
 *  instead of trusting anything a remote request itself claims, so the two
 *  can never drift apart. */
export function getWebRemoteTranslation(): string {
  return currentState.bibleTranslation || 'KJV'
}

export function updateWebRemoteState(state: WebRemoteState): void {
  currentState = state
}
