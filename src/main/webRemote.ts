import { createServer, IncomingMessage, ServerResponse } from 'http'
import { networkInterfaces } from 'os'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { APP_CSS, APP_JS, MANIFEST_JSON, SW_JS, buildAppBody } from './remoteAssets'

export const REMOTE_PORT = 4316

export interface WebRemoteSlide {
  text: string
  label?: string
  marker?: string
  reference?: string
}

export interface WebRemoteState {
  queue: Array<{
    title: string
    kind: string
    subtitle: string
    slideCount: number
    /** Every slide's full content — lets the remote show "the whole song /
     *  passage / quote, tap any part to project it" without a round trip. */
    slides: WebRemoteSlide[]
  }>
  activeIndex: number | null
  activeSlide: number
  blanked: boolean
  onScreen: {
    kind: string
    text: string
    reference?: string
    label?: string
    marker?: string
    nextText?: string
  } | null
}

type CommandCallback = (cmd: {
  action: string
  index?: number
  slide?: number
  quote?: unknown
  reference?: string
  translation?: string
  query?: string
  songId?: number
  name?: string
  path?: string
}) => void

/** Everything the remote's HTTP server needs from the rest of the app, all
 *  injected from index.ts — this module never imports db/bible/songs modules
 *  directly, so the exact same functions the desktop's own IPC handlers call
 *  are what the remote calls too. Results never drift between the two. */
export interface WebRemoteSearchHandlers {
  sermons: (query: string, dateCode?: string) => Promise<unknown[]>
  bible: (query: string) => Promise<unknown>
  songs: (query: string) => Promise<unknown[]>
  song: (id: number) => Promise<unknown>
  bibleBooks: () => Promise<unknown>
  bibleChapter: (bookNum: number, chapter: number, translation: string) => Promise<unknown>
  recentSongs: () => Promise<unknown[]>
  recentServices: () => Promise<unknown[]>
}

let currentState: WebRemoteState = {
  queue: [],
  activeIndex: null,
  activeSlide: 0,
  blanked: false,
  onScreen: null
}
let commandCallback: CommandCallback | null = null
let searchHandlers: WebRemoteSearchHandlers | null = null

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
  return candidates.find(isPrivate) ?? candidates[0] ?? 'localhost'
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
    sendJSON(res, 200, currentState)
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
    try {
      sendJSON(res, 200, await searchHandlers!.bible(q))
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
    const translation = url.searchParams.get('translation') ?? 'KJV'
    try {
      sendJSON(res, 200, await searchHandlers!.bibleChapter(book, chapter, translation))
    } catch {
      sendJSON(res, 200, { error: 'Lookup failed.' })
    }
    return
  }
  if (path === '/api/songs/recent' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.recentSongs())
    return
  }
  if (path === '/api/services/recent' && req.method === 'GET') {
    sendJSON(res, 200, await searchHandlers!.recentServices())
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

export function isWebRemoteAvailable(): boolean {
  return remoteAvailable
}

export function startWebRemote(onCommand: CommandCallback, search: WebRemoteSearchHandlers): void {
  commandCallback = onCommand
  searchHandlers = search
  const server = createServer((req, res) => {
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
      console.error(`Web remote: port ${REMOTE_PORT} is already in use — remote disabled`)
    } else {
      console.error('Web remote server error', err)
    }
  })
  server.listen(REMOTE_PORT, () => {
    remoteAvailable = true
    console.log(`Web remote available at http://${getLocalIP()}:${REMOTE_PORT}`)
  })
}

export function updateWebRemoteState(state: WebRemoteState): void {
  currentState = state
}
