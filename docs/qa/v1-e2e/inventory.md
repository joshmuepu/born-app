# BORN v1 inventory (v1-e2e-hardening round)

What v1 really has, read from the code, the Help pages and the running app. Counts and names only. Each line is ticked with how it
was tested in this round: **U** unit test, **L** driven in the live app (isolated profile), **R** real remote page in WebKit and
Chromium, **P** packaged build, **W** Windows run, **M** manual check for the owner (cannot be driven here), **C** read in the code
only. Anything not tested says why.

## Windows (6)

| Window | Opened / closed by | Tested |
|---|---|---|
| Operator window ("BORN — Branham or Nothing"), 1280×800, min 1040×640 | start; Dock / second start brings it back | L P W |
| Projection ("BORN — Congregation screen"), full-screen on the chosen screen | header button, Screens panel, ⌘/Ctrl+Shift+W, global ⌘/Ctrl+Alt+Shift+W | L U |
| Stage monitor ("BORN — Stage monitor"), full-screen on a spare screen or a floating window | Screens panel, ⌘/Ctrl+Shift+W in it, global shortcut | L U |
| Print-to-PDF helper (off-screen) | Help > Print to PDF | C (opens a system save dialog) |
| Identify / Test pattern overlay | Screens panel | L |
| Online song lookup helper (hidden) | Songs > Check online | C (needs the internet site) |

## Operator window

- Header: logo (New service), theme switch, Help (F1), Shortcuts, Hide screen / Show screen and Message (while projecting), Screens,
  Remote, Open / Close projection — **L**
- Banners: projector not detected, update (idle / downloading / ready / installing / manual / error) — **L U**
- Tabs: Sermons (Search, Browse: Date, Series, Location, Recently Played), Bible (Search, Browse: All Books, Recently Looked Up;
  scope), Songs (Search, Browse: All, Recent; Paste a song; review; Check online; key picker) — **L U**
- Queue panel: New, Open, Import, Save; preview switch Congregation | Stage; start screen (New service, Recent) — **L U**
- Footer: BORN v…, popover (check for updates, Refresh sermons, data warning, Open data folder), indexer status (Stop / Retry /
  Resume) — **L U**
- Dialogs and popovers (13): Message, Keyboard shortcuts, BORN manual (with image view), song import review, Remote, Screen setup
  (with "Not seeing …?" and Projected text size), search Filters, Songs Import menu, Bible scope, song key, two confirms (New service,
  delete song), native file dialogs, the "can't save its data" error — **L U** (native dialogs **C**)

## Menus

- No application menu is built: Electron's default menu (File, Edit, View, Window, Help). ⌘/Ctrl+R is blocked in the installed app —
  **L C**. No context menus.

## Keyboard (operator window, output windows, global)

→ / Space / Page Down; ← / Shift+Space / Page Up; ⌘/Ctrl+→ / ←; Esc; Shift+Esc; B; ⌘/Ctrl+Shift+W; / and ⌘/Ctrl+F; ⌘/Ctrl+Enter;
Alt+↑ / ↓; ?; F1; output windows: Esc, B, ⌘/Ctrl+Shift+W, the arrows; global ⌘/Ctrl+Alt+Shift+W; Esc in every popover; search box
↑ / ↓ / Esc / Enter / Tab — **U L** (each one in the shortcuts list is checked against the code by a test)

## Settings (11, settings.json)

namedDisplays, projectionDisplayName, stageDisplayName, fontSize (1.5–8, 4.5 = 100%), recentServices (8), theme, recentSongIds (8),
recentQuotes (8), recentBibleRefs (8), recentKeys (4), remoteLastPhoneNetwork — **U L** (saved and read back across restarts; a
damaged file is set aside; a save that fails half way keeps the old file)

## Main-process channels

95 (81 handle, 14 on); 121 channel names in the preload, all matched — **C U** (the ones touched this round have tests)

## Phone remote

- 21 routes (/, app.css, app.js, manifest.json, sw.js, icons, /state, /ping, 12 /api/… reads, POST /command) — **U R**
- 22 command actions — **U R**
- Page: phone layout (top bar, Back / Next / Hide screen, tabs Queue / Sermons / Bible / Songs) and two-column tablet layout; bottom
  sheets; Home Screen sheet; "Who's this?" prompt; My list; Queue file sheet (New, Save, Open saved, Import saved); Sermons (search,
  On This Day, Series, Recent); Bible (books, chapters, verses, search, scope); Songs (A–Z, recent, key) — **R**
- No PIN or sign-in exists in v1 — nothing to test
- mDNS name (born-remote.local, one responder per network), QR code (IP address), network picker, connection check — **L U**, real
  phones **M**

## Background jobs

Sermon indexer, update check, mDNS refresh (30 s), remote server, display-change debounce, projection / stage open fallback (4 s),
network names refresh, update download stall timer; renderer: queue autosave, Remote panel refresh (4 s), status timers, stage clock,
message banners, search debounces; phone: /state poll (1 s) — **U L**, soak **L**

## Bundled libraries and profile files

- Bundled: sermons.db.gz, library.db.gz, locations.json, series.json, remote icons, the manual — **U P W**
- Profile: settings.json, queue.json, sermons.db, library.db, born.log (+ .old at 5 MB), saved-services/*.born, *.corrupt-*,
  sermons.db.sections-<date>.bak / .format<N>-<date>.bak — **U L**

## Displays

Listing, naming (fingerprint + left-to-right order), remembering, re-finding (chosen by name → automatic external → this computer's
screen), hot-plug events, Identify, Test pattern, diagnostics — **U L** (three real screens here); unplug / replug / scaling change
**M**

## Help

14 pages in 5 sections, 10 pictures, 25 links inside the manual (all lead somewhere real) — **U L**

## Update check

GitHub latest release, same-major rule, asset per platform, download with size check, stall and retry, fallback to the release page —
**U L** (real feed: up to date)

## Text fitting

Projection (size from screen height × Projected text size, fitted to the band between title and reference), operator preview, stage
monitor (now fitted too) — **U L** (1280×720, 1920×1080, 2560×1440, 3840×2160, portrait 1080×1920)
