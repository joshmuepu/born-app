import { createServer, IncomingMessage, ServerResponse } from 'http'
import { networkInterfaces } from 'os'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { WebSocketServer, WebSocket } from 'ws'
import { APP_CSS, APP_JS, MANIFEST_JSON, SW_JS, buildAppBody } from './remoteAssets'
// Unlike the small shape-only types duplicated across main/preload/renderer
// elsewhere in this file (WebRemoteSlide etc.), presentation profiles are
// real content/config data, not a trivial shape — they have to live in
// exactly one place to mean anything, so this one import is deliberate.
import {
  getPresentationProfile,
  PRESENTATION_PROFILES,
  DEFAULT_CONTENT_PROFILES,
  type PresentationProfileId
} from '../shared/presentationProfiles'
import { chunkLines } from '../shared/paginate'
import { automationRequestAuthorized } from '../shared/automationAuth'
import { resolveApiV1, AUTOMATION_WS_VERSION } from '../shared/apiVersioning'
import { log } from './logger'

/** Dev-only escape hatch, same purpose as BORN_USER_DATA_DIR in main/index.ts
 *  — lets a second local checkout bind a different port instead of colliding
 *  with this one. Never set for a real install. */
export const REMOTE_PORT = Number(process.env.BORN_REMOTE_PORT) || 4316

export interface WebRemoteSlide {
  text: string
  label?: string
  marker?: string
  reference?: string
  /** Drives a Graphics destination's auto-profile treatment — absent for a
   *  slide built before this existed, which just falls back to whatever
   *  profile the destination had fixed. */
  kind?: 'quote' | 'bible' | 'song'
  /** This channel follows another, had no translation for this content, and
   *  fell back to English — purely informational, carried through to the
   *  automation API's state endpoint so an external tool can show it too. */
  translationFallback?: boolean
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
  /** Which channel this state describes. Optional and unused today — the
   *  remote only ever drives 'main', implicitly, the same as everything
   *  else in this file. Reserved so reporting it later (once a second
   *  channel exists) isn't a breaking change to this type. */
  channelId?: string
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

/** One channel's state as the automation API reports it — deliberately just
 *  enough for a Stream Deck/Companion feedback to color a button by (is
 *  something live, is it blanked), not the full operator picture
 *  Observability's own IPC-only snapshot gives the desktop UI. */
export interface AutomationChannelState {
  id: string
  label: string
  current: WebRemoteSlide | null
  blanked: boolean
}

/** Thin wrappers over the exact same internal functions the operator
 *  console and the existing phone remote already call — see index.ts's
 *  "Channel control (internal command surface)" section, which this and
 *  CommandCallback both exist to expose, never to duplicate. goNext/
 *  goPrevious specifically only work while the Main window is open, same
 *  limitation the phone remote's own prev/next already has — queue
 *  navigation lives in that window's own renderer state, not in main. */
export interface AutomationHandlers {
  goNext: () => void
  goPrevious: () => void
  clear: (channelId: string) => void
  blank: (channelId: string) => void
  show: (channelId: string) => void
  getState: () => AutomationChannelState[]
}

let automationHandlers: AutomationHandlers | null = null
let automationToken: string | null = null
let wss: WebSocketServer | null = null

/** index.ts calls this once at startup and again any time the operator
 *  changes it in Settings — null/empty disables the check entirely, same
 *  zero-friction posture /command has always had. */
export function setAutomationToken(token: string | null): void {
  automationToken = token && token.trim() ? token.trim() : null
}

/** Reads the actual header/query param off a real request and hands them to
 *  the pure decision function — see shared/automationAuth.ts. */
function checkAutomationAuth(req: IncomingMessage, url: URL): boolean {
  const header = req.headers['x-born-token']
  const headerToken = Array.isArray(header) ? header[0] : header
  const queryToken = url.searchParams.get('token')
  return automationRequestAuthorized(automationToken, headerToken, queryToken)
}

/** Every WebSocket message on this connection is an envelope carrying this
 *  version, not a bare state array — so a future, shape-changing v2 can be
 *  introduced as a genuinely new message shape a client can branch on by
 *  `v`, instead of silently changing what today's clients already parse. */
function automationWsFrame(): string {
  return JSON.stringify({ v: AUTOMATION_WS_VERSION, state: automationHandlers?.getState() ?? [] })
}

function broadcastAutomationState(): void {
  if (!wss || !automationHandlers) return
  const data = automationWsFrame()
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  }
}

// Push-on-interval rather than wired to every mutation site that could
// change a channel's state (slide change, blank, destination suppress) —
// those live all over index.ts, and threading a broadcast call through
// each one is a lot of surface for what this adapter is supposed to be: a
// thin, low-risk exposure layer. A one-second granularity is plenty for a
// Stream Deck/Companion feedback light; nothing here is frame-accurate.
let automationBroadcastTimer: ReturnType<typeof setInterval> | null = null
function ensureAutomationBroadcastLoop(): void {
  if (automationBroadcastTimer) return
  automationBroadcastTimer = setInterval(broadcastAutomationState, 1000)
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

/** What a Graphics output (OBS Browser Source, a lobby display, etc.) shows —
 *  deliberately smaller than WebRemoteState: just enough to render a slide,
 *  nothing about the queue or controls. Reuses WebRemoteSlide rather than
 *  SlidePayload directly since this file already has no dependency on
 *  main/index.ts's types — same shape, kept decoupled. */
export interface GraphicsPayload {
  slide: WebRemoteSlide | null
  blanked: boolean
  /** The profile this exact frame was rendered for — resolved server-side
   *  (auto-by-kind or the destination's fixed choice, either way) so the
   *  page never has to duplicate that decision client-side. Optional only
   *  for backward shape-compatibility with a payload built before this
   *  existed; every payload pushGraphicsUpdate actually sends sets it. */
  profileId?: PresentationProfileId
}

/** One entry per Graphics-kind destination — keyed by destination id, not a
 *  single global, so two independent channels can each drive their own OBS
 *  Browser Source (or any other consumer) without seeing each other's
 *  updates. main/index.ts's destinations Map still owns *whether* one of
 *  these exists and which channel it's bound to; this map only tracks what
 *  this file itself needs to serve it over HTTP/SSE. */
interface GraphicsEntry {
  /** The fixed profile — always rendered when autoProfile is off, and the
   *  fallback for a content kind DEFAULT_CONTENT_PROFILES doesn't cover
   *  when it's on. */
  profileId: PresentationProfileId
  autoProfile: boolean
  clients: Set<ServerResponse>
  /** The actual last frame sent — already resolved to one profile and, for
   *  a paginated lyric slide, already sliced to whichever page is currently
   *  showing. A client connecting mid-cycle sees exactly what every other
   *  connected client sees right now, not a reset back to page one. */
  lastPayload: GraphicsPayload
  /** Broadcast-pagination cycling state for the slide currently live on
   *  this destination — see pushGraphicsUpdate. */
  cycleTimer: ReturnType<typeof setInterval> | null
  cyclePages: string[]
  cycleIndex: number
}
const graphicsDestinations = new Map<string, GraphicsEntry>()

/** main/index.ts calls this once, when a Graphics destination is added (or
 *  restored at boot) — creates the entry the routes below serve. */
export function registerGraphicsDestination(id: string, profileId: PresentationProfileId, autoProfile: boolean): void {
  graphicsDestinations.set(id, {
    profileId,
    autoProfile,
    clients: new Set(),
    lastPayload: { slide: null, blanked: true, profileId },
    cycleTimer: null,
    cyclePages: [],
    cycleIndex: 0
  })
}

/** Closes this destination's own SSE connections and drops its entry — the
 *  route then 404s instead of silently going stale, so a URL left open in
 *  OBS after someone removes the output says so, not sits there looking
 *  connected. Other destinations' entries are untouched. */
export function unregisterGraphicsDestination(id: string): void {
  const entry = graphicsDestinations.get(id)
  if (!entry) return
  if (entry.cycleTimer) clearInterval(entry.cycleTimer)
  for (const res of entry.clients) {
    try {
      res.end()
    } catch {
      /* already closing */
    }
  }
  graphicsDestinations.delete(id)
}

/** The fixed profile a manual (non-auto) destination always renders, and an
 *  auto one falls back to for a content kind DEFAULT_CONTENT_PROFILES
 *  doesn't cover. Takes effect on the next push — unlike the single-profile
 *  page this used to be, the live page now ships every profile's CSS and
 *  switches between them by attribute, so this is a live change, not
 *  something that waits for a reload. */
export function setGraphicsProfile(id: string, profileId: PresentationProfileId): void {
  const entry = graphicsDestinations.get(id)
  if (entry) entry.profileId = profileId
}

/** Toggles automatic, content-type-driven profile selection for one
 *  Graphics destination — see DEFAULT_CONTENT_PROFILES. */
export function setGraphicsAutoProfile(id: string, autoProfile: boolean): void {
  const entry = graphicsDestinations.get(id)
  if (entry) entry.autoProfile = autoProfile
}

export function isGraphicsActive(id: string): boolean {
  return graphicsDestinations.has(id)
}

/** Live SSE client count for one Graphics destination — the only real
 *  "is anything actually watching this" signal that exists for a Graphics
 *  output, since (unlike the window-kind destinations) it has no open/closed
 *  lifecycle of its own to report ready=false against. 0 for an unregistered
 *  id, same as a destination with no viewer connected — observability can't
 *  tell those apart and doesn't need to. */
export function graphicsClientCount(id: string): number {
  return graphicsDestinations.get(id)?.clients.size ?? 0
}

/** Writes one frame to every client currently connected to this one
 *  destination (SSE — push, not poll, since a lagging live-presentation feed
 *  is actively bad, unlike the phone remote's state which tolerates a second
 *  of staleness fine) and records it as `lastPayload` for the next client
 *  that connects. */
function sendGraphicsFrame(
  entry: GraphicsEntry,
  slide: WebRemoteSlide | null,
  blanked: boolean,
  profileId: PresentationProfileId
): void {
  entry.lastPayload = { slide, blanked, profileId }
  const data = `data: ${JSON.stringify(entry.lastPayload)}\n\n`
  for (const res of entry.clients) {
    try {
      res.write(data)
    } catch {
      entry.clients.delete(res)
    }
  }
}

/** Push a Graphics update for one destination — resolves which profile this
 *  slide actually renders with (auto-by-kind or the destination's fixed
 *  choice), and starts/stops that profile's own broadcast-pagination cycle
 *  for it. A no-op if `id` isn't a registered destination. */
export function pushGraphicsUpdate(id: string, payload: GraphicsPayload): void {
  const entry = graphicsDestinations.get(id)
  if (!entry) return

  if (entry.cycleTimer) {
    clearInterval(entry.cycleTimer)
    entry.cycleTimer = null
  }

  const slide = payload.slide
  if (!slide || payload.blanked) {
    entry.cyclePages = []
    entry.cycleIndex = 0
    sendGraphicsFrame(entry, slide, payload.blanked, entry.profileId)
    return
  }

  const activeProfileId =
    entry.autoProfile && slide.kind ? DEFAULT_CONTENT_PROFILES[slide.kind] ?? entry.profileId : entry.profileId
  const profile = getPresentationProfile(activeProfileId)
  const pages = chunkLines(slide.text, profile.broadcastPagination.linesPerPage)
  entry.cyclePages = pages
  entry.cycleIndex = 0
  sendGraphicsFrame(entry, { ...slide, text: pages[0] ?? slide.text }, false, activeProfileId)

  if (pages.length > 1) {
    entry.cycleTimer = setInterval(() => {
      entry.cycleIndex = (entry.cycleIndex + 1) % pages.length
      sendGraphicsFrame(entry, { ...slide, text: pages[entry.cycleIndex] }, false, activeProfileId)
    }, profile.broadcastPagination.intervalMs)
  }
}

function isPrivate(addr: string): boolean {
  return (
    addr.startsWith('192.168.') ||
    addr.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr)
  )
}

// Interface *names* that are almost never the LAN adapter a phone on the
// church Wi-Fi could actually reach — VPN tunnels and OS-level virtual
// switches. Matched against the interface name, not the address, since a VPN
// or virtual adapter can hand out a perfectly normal-looking private IP and
// os.networkInterfaces() enumeration order is OS-dependent, not a signal of
// which adapter is the real one.
// macOS/Linux: utun/tun/tap/ppp/wg/ipsec/awdl/bridge/vnic/vmnet. Windows:
// vEthernet, VMware, VirtualBox, Hyper-V, WSL, Docker, Tailscale, ZeroTier.
const VIRTUAL_ADAPTER_NAME =
  /utun|^tun|^tap|ppp|wireguard|^wg|ipsec|awdl|llw|bridge|vnic|vmnet|vethernet|vmware|virtualbox|hyper-v|wsl|docker|tailscale|zerotier|vpn/i

export function getLocalIP(): string {
  const nets = networkInterfaces()
  const real: string[] = []
  const virtual: string[] = []
  for (const [name, ifaces] of Object.entries(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue
      if (VIRTUAL_ADAPTER_NAME.test(name)) virtual.push(net.address)
      else real.push(net.address)
    }
  }
  const candidates = [...real, ...virtual]
  return real.find(isPrivate) ?? candidates.find(isPrivate) ?? candidates[0] ?? 'localhost'
}

export interface AdapterInfo {
  name: string
  address: string
  /** Matched one of the known VPN/virtual-switch naming patterns. */
  virtual: boolean
  /** This is the address getLocalIP() actually picked. */
  chosen: boolean
}

/** Every non-loopback IPv4 adapter on this machine, for the "Remote
 *  connection check" diagnostic — lets the operator (or support, reading a
 *  copied diagnostics dump) see every candidate address and which one BORN
 *  picked and why, instead of just trusting a single hidden choice. */
export function listAdapters(): AdapterInfo[] {
  const nets = networkInterfaces()
  const chosenIp = getLocalIP()
  const out: AdapterInfo[] = []
  for (const [name, ifaces] of Object.entries(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue
      out.push({ name, address: net.address, virtual: VIRTUAL_ADAPTER_NAME.test(name), chosen: net.address === chosenIp })
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

/** Turns a profile region's {property: value} record into a literal CSS
 *  declaration block. The only place that reads 'fullscreen'/'lower-third'
 *  as names is shared/presentationProfiles.ts — this function doesn't know
 *  or care which profile it was handed. */
function cssDecl(rec: Record<string, string>): string {
  return Object.entries(rec)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(';')
}

/** Takes the destination id so each rendered page's SSE connection points at
 *  its own events endpoint — two Graphics destinations open in two browser
 *  tabs (or two OBS sources) never read each other's feed. Which profile is
 *  actually showing is decided server-side (pushGraphicsUpdate resolves
 *  auto-by-kind or the fixed choice and stamps the result on every frame as
 *  `profileId`) — this script just applies whatever it's told, by setting
 *  that id as a `data-profile` attribute every profile's CSS is scoped
 *  under, so switching treatment is one attribute write, never a reload. */
function buildGraphicsScript(id: string): string {
  const eventsPath = `/output/graphics/${encodeURIComponent(id)}/events`
  const transitions = Object.fromEntries(
    Object.values(PRESENTATION_PROFILES).map((p) => [p.id, p.transition])
  )
  return `
(function(){
  var stageEl = document.getElementById('stage');
  var panelEl = document.getElementById('panel');
  var labelEl = document.getElementById('label');
  var textInnerEl = document.getElementById('text-inner');
  var refEl = document.getElementById('reference');
  var refDetailEl = document.getElementById('reference-detail');
  var discEl = document.getElementById('disconnected');
  var TRANSITIONS = ${JSON.stringify(transitions)};
  var DEFAULT_PROFILE = ${JSON.stringify(PRESENTATION_PROFILES.fullscreen.id)};

  function esc(s){
    return (s || '').replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; });
  }
  // The app-wide convention for a multi-part reference is "main · detail"
  // ("John 3:16 · KJV", "The Patmos Vision · 60-1204E · 15") — split on the
  // first one so each half can be styled independently instead of being
  // stuck inside one opaque string.
  function splitReference(ref){
    var i = (ref || '').indexOf(' · ');
    if (i < 0) return { main: ref || '', detail: '' };
    return { main: ref.slice(0, i), detail: ref.slice(i + 3) };
  }

  function applyFrame(payload){
    stageEl.dataset.profile = (payload && payload.profileId) || DEFAULT_PROFILE;
    if (!payload || !payload.slide || payload.blanked) {
      labelEl.textContent = ''; textInnerEl.textContent = ''; refEl.textContent = ''; refDetailEl.textContent = '';
      return;
    }
    var s = payload.slide;
    labelEl.textContent = s.label || '';
    textInnerEl.innerHTML = (s.marker ? '<span id="marker">' + esc(s.marker) + '</span>' : '') + esc(s.text);
    var ref = splitReference(s.reference);
    refEl.textContent = ref.main;
    refDetailEl.textContent = ref.detail;
  }

  function render(payload){
    var profileId = (payload && payload.profileId) || DEFAULT_PROFILE;
    var t = TRANSITIONS[profileId] || { type: 'cut', durationMs: 0 };
    if (t.type === 'fade' && t.durationMs > 0) {
      panelEl.style.transition = 'opacity ' + t.durationMs + 'ms ease';
      panelEl.style.opacity = '0';
      setTimeout(function(){
        applyFrame(payload);
        panelEl.style.opacity = '1';
      }, t.durationMs);
    } else {
      panelEl.style.transition = '';
      applyFrame(payload);
    }
  }

  function connect(){
    var es = new EventSource(${JSON.stringify(eventsPath)});
    es.onmessage = function(ev){
      discEl.style.display = 'none';
      try { render(JSON.parse(ev.data)); } catch (e) {}
    };
    es.onerror = function(){
      discEl.style.display = 'block';
    };
  }
  connect();
})();
`
}

/** The Graphics output page — a plain browser-servable page (OBS Browser
 *  Source, vMix, a lobby display, a second computer, etc.), not an Electron
 *  window. Vanilla HTML/CSS/JS since it's served over plain HTTP, not
 *  rendered by React in an Electron renderer process.
 *
 *  Ships EVERY profile's CSS at once, each scoped under
 *  `#stage[data-profile="<id>"]`, rather than baking one fixed profile into
 *  the page — that's what lets a destination switch treatment live as
 *  content moves from a song to a verse (data-profile is just an attribute
 *  write the SSE script does per frame) instead of needing a page reload
 *  the way a single-profile page would. This function still reads each
 *  profile's `regions` generically; it has no idea "lower-third" exists —
 *  adding a third profile to shared/presentationProfiles.ts is picked up
 *  here with no changes needed. `id` is this destination's own id, baked
 *  into its generated SSE script. */
function buildGraphicsHTML(id: string): string {
  const profileCSS = Object.values(PRESENTATION_PROFILES)
    .map(
      (profile) => `
  #stage[data-profile="${profile.id}"] #panel { ${cssDecl(profile.regions.panel)} }
  #stage[data-profile="${profile.id}"] #label { ${cssDecl(profile.regions.label)} }
  #stage[data-profile="${profile.id}"] #text { ${cssDecl(profile.regions.text)} }
  #stage[data-profile="${profile.id}"] #reference { ${cssDecl(profile.regions.reference)} }
  #stage[data-profile="${profile.id}"] #reference-detail { ${cssDecl(profile.regions.referenceDetail)} }
  #stage[data-profile="${profile.id}"] #marker { ${cssDecl(profile.regions.marker)} }`
    )
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>BORN — Graphics</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  /* Always transparent at the page level, even for a profile whose own
     panel supplies an opaque backdrop (Full-Screen) — see the note on
     PresentationProfile.pageBackground. A page that ships every profile at
     once can't pick a single page-level background up front. */
  html, body { background: transparent; color: #fff; height: 100%; overflow: hidden; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  #stage { position: relative; height: 100vh; }
  #text-inner { width: 100%; }
${profileCSS}
  #disconnected { position: fixed; top: 10px; right: 14px; font-size: 0.75rem; color: #a33;
    font-weight: 600; letter-spacing: 0.05em; display: none; }
</style>
</head>
<body>
<div id="stage">
  <div id="panel">
    <div id="label"></div>
    <div id="text"><div id="text-inner"></div></div>
    <div id="reference"></div>
    <div id="reference-detail"></div>
  </div>
</div>
<div id="disconnected">RECONNECTING…</div>
<script>${buildGraphicsScript(id)}</script>
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
  const path = resolveApiV1(url.pathname)

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
    const clientIp = req.socket.remoteAddress
    if (clientIp) lastSeenByClient.set(clientIp, Date.now())
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

  // ── Automation API (Stream Deck/Companion-style control) ───────────────────
  // Every route here is a thin wrapper over AutomationHandlers — no new
  // capability beyond what the operator console and the phone remote's own
  // /command already do, just exposed as individually addressable HTTP
  // actions a macro pad can bind one button each to.
  if (path.startsWith('/api/automation/')) {
    if (!checkAutomationAuth(req, url)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid or missing automation token.' }))
      return
    }
    if (path === '/api/automation/next' && req.method === 'POST') {
      automationHandlers?.goNext()
      res.writeHead(204)
      res.end()
      return
    }
    if (path === '/api/automation/prev' && req.method === 'POST') {
      automationHandlers?.goPrevious()
      res.writeHead(204)
      res.end()
      return
    }
    const channelActionMatch = /^\/api\/automation\/(clear|blank|show)\/([^/]+)$/.exec(path)
    if (channelActionMatch && req.method === 'POST') {
      const [, action, rawChannelId] = channelActionMatch
      const channelId = decodeURIComponent(rawChannelId)
      if (action === 'clear') automationHandlers?.clear(channelId)
      else if (action === 'blank') automationHandlers?.blank(channelId)
      else automationHandlers?.show(channelId)
      res.writeHead(204)
      res.end()
      return
    }
    if (path === '/api/automation/state' && req.method === 'GET') {
      sendJSON(res, 200, automationHandlers?.getState() ?? [])
      return
    }
    res.writeHead(404)
    res.end()
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

  const graphicsEventsMatch = /^\/output\/graphics\/([^/]+)\/events$/.exec(path)
  if (graphicsEventsMatch && req.method === 'GET') {
    const entry = graphicsDestinations.get(decodeURIComponent(graphicsEventsMatch[1]))
    if (!entry) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write(`data: ${JSON.stringify(entry.lastPayload)}\n\n`)
    entry.clients.add(res)
    req.on('close', () => entry.clients.delete(res))
    return
  }

  const graphicsPageMatch = /^\/output\/graphics\/([^/]+)$/.exec(path)
  if (graphicsPageMatch && req.method === 'GET') {
    const id = decodeURIComponent(graphicsPageMatch[1])
    const entry = graphicsDestinations.get(id)
    if (!entry) {
      res.writeHead(404)
      res.end()
      return
    }
    // Must never be cached — a stale copy would be missing whatever profile
    // CSS or marker/pagination data a newer release of this file added.
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(buildGraphicsHTML(id))
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

// Client IP -> last time it polled /state. A phone that stops polling (app
// closed, screen locked, Wi-Fi dropped) ages out instead of counting forever.
const lastSeenByClient = new Map<string, number>()
const CONNECTED_WINDOW_MS = 5000

/** How many distinct phones have polled /state in the last few seconds —
 *  the operator-visible "N connected" count. Approximate by design: a NAT'd
 *  network could put two phones behind one IP, and a phone that just closed
 *  its tab still counts until it ages out. */
export function getConnectedPhoneCount(): number {
  const now = Date.now()
  let n = 0
  for (const t of lastSeenByClient.values()) {
    if (now - t <= CONNECTED_WINDOW_MS) n++
  }
  return n
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
}

export function startWebRemote(
  onCommand: CommandCallback,
  search: WebRemoteSearchHandlers,
  automation: AutomationHandlers,
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
  automationHandlers = automation
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

  // Same server, same port — a macro pad's WebSocket feedback connection is
  // just another thing this one HTTP server upgrades, not a second port to
  // open, advertise, or fail independently of the remote it already runs.
  wss = new WebSocketServer({ noServer: true })
  wss.on('connection', (ws) => {
    ws.send(automationWsFrame())
  })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://internal')
    if (resolveApiV1(url.pathname) !== '/api/automation/ws') {
      socket.destroy()
      return
    }
    if (!checkAutomationAuth(req, url)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss!.handleUpgrade(req, socket, head, (ws) => wss!.emit('connection', ws))
  })
  ensureAutomationBroadcastLoop()

  server.listen(port, () => {
    remoteAvailable = true
    log.info(`webRemote: listening on http://${getLocalIP()}:${port}`)
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
