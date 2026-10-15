# v2 UI pass — "Born Again" (QA report, in progress)

Branch `v2-ui-born-again`. v1 and `main` untouched; v2 identity (version `2.0.0-dev.1`, appId,
productName, ports, data dir, release-tag gate) unchanged; nothing merged, tagged or released.
`origin/main` is one docs-only commit ahead (`74ededf`); not merged.

## What changed

| Area | Change |
|---|---|
| Tokens | New palette/radii/motion on the existing variable names (`App.css`); full token set in `docs/design/tokens.css`. Live indicator is red. High-contrast overlay (header ◐ button) on top of dark or light. Reduced-motion honoured. |
| Brand | Flame mark + "Born Again" wordmark in header; status bar, window titles, Help viewer, update banner, remote page, manual text say Born Again. |
| Shell | Left icon rail (Sermons / Bible / Songs / Queue + badge) replaces the top tab row. Queue panel slides away; opens automatically when something is queued or projecting; choice is remembered. Status bar shows On air / Screen hidden, displays, queue count. |
| Sermons → Browse | Mode strip (Date / Series / Location / Recently Played) replaces four 280px cards. Browse columns on the left (grid or list, remembered), text always opens on the right, list stays beside it, slide-away handle or `\`. Stacks to one column with Back under ~760px. |
| Bible, Songs | Same frame (`DrillShell`): book/chapter or song list left, chapter / lyrics + section chips right. Bible books switch abbreviation grid ↔ full-name list; songs gain a card grid. |
| Command palette | Ctrl/Cmd+K and a header trigger: verse reference, sermons, songs, Bible text, and app actions in one box. Opens only — never projects or queues. While open, the global Esc→blackout handler is suspended. |
| Phone remote | Born Again palette, follows the phone's light/dark, red live, flame wordmark, new home-screen icons, name in manifest/title. |
| Manual | Name replaced throughout `docs/manual/v2`; quick-start, content-types and what's-new updated for the rail, drill-down, grid/list, palette; screenshots regenerated with `npm run docs:screenshots`. |

Screens: `docs/qa/ui-before/` (v2 before) and `docs/qa/ui-after/`.

## Before / after (honest numbers)

**Clicks.** My Phase 1 table over-counted: *Date* was already the default Browse tab, so the date journey
was Browse → year → day → sermon → Project = 5 before and is 5 now. What changed is what happens next:
switching to another sermon in the same month is 1 click now (the list stays beside the text) instead of
Back + pick. The verse journey is unchanged (Bible, type, Project = 3); Ctrl+K adds a route from anywhere
(Ctrl+K, type, Enter, then Project from the opened chapter).

**Space (1280×772 window).** Sermons → Browse: the four hub cards (~180 css px tall) became a ~34px strip, so the
year grid / calendar starts about 150px higher. The top tab row (≈50px) became a 68px rail on the left, trading
height for width. With the columns slid away the sermon text uses the whole pane.

**Performance (this machine, 120 Hz display, dev build).** Songs → Browse → All songs, 1,163 rows /
13,032 DOM nodes, scripted scroll for 2.5 s: average frame 8.3 ms, p95 8.4 ms, max 16.8 ms, JS heap 59 MB.
`content-visibility: auto` made no measurable difference, so it was not kept. **Not measured:** a 300+ item
queue, a very long sermon, slow hardware. Lists are **not virtualized**; no new dependency was added.

## Tests

- `npm run typecheck` clean.
- `npm test`: 49 files, **677 tests passing** (was 666 at the start of this pass).
- New: BrowsePanel drill-down layout, grid/list persistence, collapse + `\`, keyboard open (4);
  CommandPalette (7).
- Existing tests unchanged; no assertions were edited to make them pass.
- Docs screenshot script run against the new UI; one step (`Add channel` button) could not be found, and
  `warn-english-fallback.png` was skipped, both as before this pass (data-dependent).

## What was NOT tested

- Real touch hardware, a physical projector/second display behaviour beyond what the screenshot script drives,
  real iOS Safari / Android Chrome, Windows, Linux. The remote was only viewed in desktop headless Chrome
  (light and dark); the phone-width screenshot there is clipped by headless's minimum window width.
- Screen-reader behaviour. Keyboard operation was checked by tests and by driving the UI, not with assistive tech.
- Contrast was judged by eye and from token values, not with a contrast tool, except where tokens were
  designed against the AA ratios noted in `docs/design/tokens.css`.

## Known issues / not done

- Some older components still use the legacy variable names (only their values changed), so spacing and
  type scale are not yet unified across every modal and popover. A few chips (e.g. the Channels "Following"
  chip in the light theme) have weak contrast.
- Not built: Bible translation compare, back/forward history, favorites/pins, context menus, verse hover
  preview, undo toasts, skeleton loaders in the real app, density and touch-mode switches (tokens exist),
  first-run tour, drag-to-queue drop target, installer icon files (`build/icons`), mDNS service name
  ("BORN Remote" on the network).
- The Preview/Live pair is the existing "on screen + next" block in the queue, restyled by the new tokens only.
- The Phase 1 prototype (`?proto=drilldown`, Ctrl+Alt+Shift+D) is still in the tree; delete
  `src/renderer/src/prototype/` and the hook in `main.tsx` when you no longer want it.


---

# Batch 2 (themes, Preview/Live, performance, safety, organization)

Same branch, `v2-ui-born-again`. `origin/main` (docs-only commit `74ededf`) was merged in at the start
(v2's `CLAUDE.md` kept). Nothing was merged to `v2-channels`, tagged or released; v1/`main` untouched; v2's
internal identity unchanged.

## 1. Themes and contrast

- **Automated token check:** `src/test/shared/themeContrast.test.ts` (126 checks) covers every text/surface pair,
  content colours, status colours, filled-button text, control boundaries (>= 3:1) and the focus ring for
  dark, light, high-contrast dark and high-contrast light, plus the phone remote's dark and light tokens
  (AA everywhere; AAA for high-contrast text).
- **Runtime audit** (a script that walks the live DOM, composites real backgrounds and checks every
  visible text node and every bordered control): 13 screens/states x 3 window sizes (1040x640, 1440x900,
  2560x1440) x 4 themes = **156 audits, 0 findings** after fixes. States: sermon search, sermon text +
  queue, sermon browse, Bible, Songs, context menu, undo toast, Saved panel, command palette, shortcuts,
  Help, Screens popover, Manage modal. (Not covered: the projection output and stage monitor, which are
  always black/white by design; the Preview/Live pair with projection open was checked by eye only.)
- **Found and fixed:** `--border-strong` was ~1.8:1 (now >= 3:1); light-theme sermons colour and live red
  were just under AA on hover surfaces; high-contrast status colours were not AAA; dimming text with
  `opacity` pushed several labels under AA; control boundaries (secondary buttons, selects, chips, month
  pills, chapter numbers) were hairlines; "Connected" and the played-item check turned red when live became
  red — connected/played are now OK-green and red is only live.
- **Live is unmistakable:** a red frame, red dot and the word LIVE in the pair, red "On air" in the status
  bar, red edge on the active queue row; token test asserts live is red-dominant in all four themes.
- **Not done:** a 4K/large-monitor scale-up of the control UI (it is the same pixel size at 2560 wide;
  Electron's zoom shortcuts still work).

## 2. Preview / Live pair

- Source of truth is the main process: it pushes `live:changed` on every slide/blank/clear and serves
  `live:snapshot`; the pair re-reads on a 2.5 s timer and on window focus, so a missed event cannot leave
  a stale thumbnail. The renderer's own idea of "what's projected" is not consulted for LIVE.
- Thumbnails are a 1920x1080 miniature using the output's own geometry and the same auto-fit hook.
- Clicking a queue row stages it in PREVIEW; **Take** projects it (or does **Next** with nothing staged);
  **Clear** is a blackout that keeps your place. Channel tabs appear when more than one channel exists
  and show that channel's own output, sync mode and destination health.
- 7 tests (output wins over UI, recovery on timer, staged never changes live, channel switch, hidden).

## 3. Long lists - measured (clean profile, dev build, Apple-silicon laptop, 120 Hz)

"6x" = Chrome DevTools CPU throttling x6 to approximate a slow booth laptop.

| What | Before | After | Notes |
|---|---|---|---|
| Search "God" (25,000 hits) first paint | 4,435 ms, 25,000 rows | **293 ms**, 12 rows | 6x: 25,156 ms -> **937 ms** |
| Longest sermon (389 paragraphs = 1,680 rows) first paint | 261 ms | **66 ms** | 6x: 957 ms -> **165 ms** |
| Sermon text DOM nodes | ~11,000 | ~1,100 | |
| Scroll frame time (sermon, songs, queue) | 8.3 ms avg, p95 ~9, max 16.7 | 8.3 ms avg, p95 9.9, max 17 | 6x: p95 10.2 ms after |
| Songs (1,163) first paint | 143 ms | 143 ms (native) | windowing engages at 2,000+ |
| Songs windowed trial (not shipped at this size) | | DOM 11,083 -> 1,383, heap 170 -> 36 MB, but scroll p95 10 -> 18 ms at 6x | |
| Queue of 240-300 | 8.3 ms avg | unchanged (not windowed) | 4,580 rows still scrolled at ~28 ms |

- **Where windowing is on:** search results (>= 200 rows), sermon text (>= 400 rows), songs (>= 2,000).
  Below those thresholds native scrolling measured smoother, so lists stay fully mounted.
- **Where it is not:** the queue — drag reorder, the keyboard model and undo need every row, and 300 rows
  already scroll at one frame per refresh. Songs at 1,163: native scroll was measurably smoother (see trial).
- **Honesty note:** my first throttled "after" numbers were far worse because the app auto-restores the
  last queue and each measurement run had added 240 more rows (up to 4,580). Numbers above are from fresh
  profiles. The A-Z sticky letter header does not exist in windowed mode (a letter pill is shown instead).
- Dependency added: `@tanstack/react-virtual` 3.13.12 (~4 kB gz, MIT).
- 5 tests for `VirtualList` (window size, full scroll height, scroll-to-row, empty, first-visible).

## 4. Safety and speed

- **Undo toasts** (visible countdown, pause on hover/focus, `Ctrl/Cmd+Z`, never take focus, never bind
  Esc): remove, reorder, new service, open a service, drop-add. **New** still confirms when something is on
  the screen; otherwise it just happens and can be undone (and un-hides the screen if it hid it).
- **Not given an undo:** deleting a song from the library and "clear recents" — there is no restore API,
  so the existing confirmation stays. Listed as a gap.
- **Drag-to-queue** from sermon paragraphs, search results, Bible verses/hits and songs, with an insertion
  line, an empty-queue drop zone, and hover-the-Queue-button to open a collapsed panel. Reorder by drag or
  by **Alt+Up/Down** on a focused row; "Add next in queue" (menu) is the no-mouse insert. Dropping only
  inserts; a live item that shifts is re-linked by id. 6 + 5 tests.

## 5. Organization

- Context menus (right-click, Menu key, Shift+F10) on paragraphs, results, verses, songs, sermons in the
  list and queue rows; nothing is highlighted on open, Esc is swallowed.
- Favorites (local), a **Saved** slide-over with Favorites and Recent, back/forward history across opened
  sermons/chapters/songs (Alt+Left/Right, mouse buttons, header chevrons). 10 + 5 tests.
- **History scope:** it tracks places you *opened* (a sermon, a chapter, a song). It does not step back
  through intermediate columns (year, month, book) — those are one click on the breadcrumb or the strip.

## 6. Open questions from batch 1

- **"Open a saved service":** an **Open** button now sits on the rail, always visible.
- **Search/Browse sub-tabs:** Sermons' Search is now the first chip of the mode strip (one row less).
  Bible and Songs keep their Search/Browse switch on purpose: it is already a single row and also carries
  their tools (grid/list, songbook, import), so folding it would only move those tools.

## 7. Cleanup

Removed the Phase 1 prototype and its entry hook, the old tab-bar and monitor-switch CSS, and 16 other
unused rules (found by a script that compares every CSS class with the source; dynamically-built class
names were kept). No unused components were found.

## Verification

- `npm run typecheck` clean. `npm test`: **56 files, 842 tests passing** (677 at the end of batch 1).
- Existing tests changed (legitimately): the Songs A-Z test (jump is now a virtualizer scroll, not a sticky
  header measurement); `ServiceQueue` props became optional with defaults; `setup.ts` gained mocks for the
  three new IPC calls. No assertions were loosened to pass.
- **Phone remote**, Playwright WebKit 18.2 (the Safari engine, not real iOS Safari) and desktop Chrome at
  390x844, dark and light: loads, no console errors, no horizontal overflow, brand/title/theme correct.
  Screens in `docs/qa/ui-batch2/`. The remote's diagnostics live in the desktop popover, covered by the
  existing RemotePanel tests; not re-driven by hand.
- Help manual: screenshots regenerated with `npm run docs:screenshots` (two data-dependent shots skipped as
  before); new page "Preview, Live, and saving time", plus updates to the cheat sheet, Hide/Clear page
  and What's new.
- Screens: `docs/qa/ui-batch2/` (light/dark/high-contrast at min, laptop and large).

## Not tested

Real touch hardware; real iOS/Android browsers; Windows and Linux; a screen reader; a physical projector
beyond the screenshot script opening the projection window on this machine's displays; the
Channels/Destinations/Outputs flows were exercised only by the existing tests and the screenshot script
(no new manual pass); automation API panel unchanged and not re-driven; the drag-and-drop was tested with
synthetic events (the browser's real drag gesture was not scripted); performance on a real slow machine
(only CPU throttling).

## Identity pass (deliberately NOT done in this batch)

Installer icons (`build/icons`), the Bonjour/mDNS service name "BORN Remote", `productName`/`appId`,
the macOS app bundle name, update-check wording that names the v1 product, and `app.setName`.
