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
