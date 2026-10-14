# Born Again — UI direction (Phase 1, for owner review)

Status: **proposal, nothing in the shipping UI has changed.** The only code added is an isolated, read-only
prototype (`?proto=drilldown`) plus token/logo files under `docs/design/`. Typecheck is green.

## 0. Audit

Captured from the running v2 dev build (isolated profile, 1280×772 window on a Retina display).
Screens: `audit/`. **Not yet captured:** light theme, a 2560-wide window, v1 side-by-side, and the
populated states of Bible/Songs/queue/projection — I only walked the empty and browse states. Those
should be added before Phase 2 sign-off; nothing below depends on them.

**What works.** Three content colours (Stone/Sage/Amber) that make tabs instantly identifiable; one action colour
(Plum); a single "Open projection" primary; plain-language labels from the v1 UI review; the queue's empty state.

**What wastes space.**
- Sermons → Browse: the four mode cards (Date / Series / Location / Recently played) are ~280px tall and stay on screen
  *after* you pick one, so the year grid starts at mid-window and a sermon list ends up below the fold
  (`audit/02-browse-date.png`). Bottom-of-pane results is exactly the problem you described.
- Two tab rows (Sermons/Bible/Songs, then Search/Browse) before any content, ~100px.
- Header: Help, Shortcuts, Screens, Remote, Open projection all at the same level; the logo is the smallest thing in it.
- Queue column is 25% of the window even when empty.
- A status footer line carries only the version string.

**Inconsistent / cluttered.** Songs has a different sub-header (songbook + Import dropdowns) than Sermons (Search/Browse only);
Bible/Songs/Sermons each browse differently; "New / Open / Import / Save" are text links with no hierarchy.

**Journey cost** (from reading the code and walking the UI; counted as deliberate actions, not measured with timing):

| Journey | Today | Target |
|---|---|---|
| Sermon paragraph by search | type, Enter, Project = 3 | 3 (keep; add global search `/`) |
| Sermon paragraph by date | Browse, Date, year, month, sermon, paragraph, Project = 7 | 4 with arrow keys, 5 with mouse (sermon list stays beside text) |
| Verse | Bible tab, type "John 3:16", Project = 3 | 2 via palette (`Ctrl/Cmd+K`, type, Enter) |
| Song | Songs tab, type, click, Project slide = 4 | 3 |
| Run a queue | add each, then Next/Next… | unchanged, but Preview/Live pair shows what Next will do |

**v1 identity to keep.** Near-black canvas; Plum as the single action colour; Stone/Sage/Amber content colours;
Inter + JetBrains Mono for codes; the flame-for-O wordmark `B🔥RN`; plain-spoken labels. Carry all of it.

## 1. Principles (live operation, dim room)

1. **Live is sacred.** What is on the wall is always visible and unambiguous; anything that can change it is visually
   distinct from anything that can't. Red means *live or destructive* — nothing else.
2. **Never need a second look.** One primary action per context; state is shown by shape and label, not colour alone.
3. **Big where it counts, quiet elsewhere.** Reading text and the live area get the space; chrome recedes. Dim-room
   rule: no large bright surfaces in dark theme.
4. **Keyboard first, touch friendly.** Every action reachable without a mouse; targets ≥40px (48px in touch mode).
5. **Motion explains, never decorates.** 90–280ms, interruptible, off under reduced motion.
6. **Progressive disclosure.** Rare things (import, filters, profiles) live one step away, never in the way.
7. **Forgiving.** Undo toasts instead of confirm dialogs for non-destructive actions; nothing is lost by a mis-tap.

## 2. Visual language — `tokens.css`

Complete token set in [tokens.css](tokens.css): 5 surface steps + hairlines, 3 text tiers (all ≥ AA; the dimmest is 5.4:1 on
canvas), accent/content/live/status colours, type scale (+ a reading tier), 4px spacing, radii, elevation, motion
durations/easings, z-layers, density and touch switches. Themes: **dark (default), light, high-contrast**
(`data-theme="contrast"`, pure black/white, 2px lines, yellow focus). Namespaced `--ba-*` so it coexists with the
current variables until Phase 2 migrates and deletes the old ones.

Refinements over v2 today: surface *steps* instead of a flat panel colour (depth without glare); slightly rounder radii;
a dedicated **live red** (v2 uses green for live — green is also "OK" and Sage is Bible, so it was overloaded);
a reading-text tier for sermon paragraphs and lyrics.

## 3. Logo — `logo/` (open `logo/preview.html`, or `preview.png`)

All three derive from v1's `B·RN` flame-in-the-O and stay in Plum with Sage as the "new life" accent. Shown on dark and light
at 16/32/128/256px.

| | Concept | Idea | Reads at 16px? |
|---|---|---|---|
| **A — Ember** *(recommended)* | The flame alone, with an inner drop in cream | Direct descendant of v1's flame; "born again" = the same fire, renewed. One shape, works as app icon, favicon, loading mark | Yes — a clear silhouette even at 16px |
| B — Open ring | An O that isn't closed, flame inside | "Not finished — begun again"; echoes v1's O slot | Weak — ring and flame merge to a blob at 16px |
| C — Monogram | Bold B with the flame in its lower counter | Most "brand-like", fits a square | No — the counter detail disappears below ~32px |

**Why A:** it's the only one that survives 16px (favicon, tray, remote tab), it's visibly the v1 flame so existing users
recognise the family, and it needs no letters to be understood. Wordmark lockup: flame + "Born" (bold) / "Again" (light, Plum).
All shapes are original geometry I drew; no stock icon or third-party mark was used. **Caveat:** these are first-pass vector
sketches, not finished brand art — the flame curve in particular deserves a designer's pass, and the lockup's text is live
Inter, which must be converted to outlines before shipping.

Delivered: `concept-{a,b,c}-*.svg`, `app-icon-macos.svg`, `app-icon-windows.svg`, `mark-monochrome.svg`,
`favicon-remote.svg`, `wordmark-lockup.svg`. **Remains for Phase 2:** wire into header/About/Help/splash/remote; export
`.icns/.ico/.png` for the installer (`build/icons`) — left alone, since changing package identity is out of scope here.

## 4. App shell

Proposed (replaces today's header + 2 tab rows + footer):

```
┌─ rail ─┬──────────────────────────── top bar: [flame] Born Again   ⌘K search…   Screens ▾  Remote  ● LIVE ─┐
│ Sermons│  browse columns  ‹ │      reading / results pane (large)           │ Queue (slides in, 320px)   │
│ Bible  │  year │ month │ …  │                                               │  Preview ▢   Live ▣        │
│ Songs  │                    │                                               │  items…   [Back] [Next]    │
│ Queue  │                    │                                               │                            │
└────────┴────────────────────┴───────────────────────────────────────────────┴────────────────────────────┘
 status bar: displays · remote · channel · sync · now playing
```
- Left **icon rail** (56px, labels on hover/expanded) replaces the top tab row: reclaims ~50px of height and gives
  Sermons/Bible/Songs/Queue/Settings a stable home.
- **Queue becomes a collapsible right panel** that slides in (default open during a service, collapsed in Prep). Empty queue
  shows as a slim handle, not a 25% column.
- **Preview / Live pair** at the top of the queue: the staged slide vs the one on the wall, with the next-slide thumbnail.
- **Persistent status bar** replaces the version-only footer (displays, remote, channel, sync, now-playing).
- Window minimum stays; below ~900px the rail becomes a bottom bar and panes stack (see §5).

## 5. Drill-down ("Finder") pattern

**Prototype, real data, read-only:** run the dev build (isolated profile as in the audit) and press
`Ctrl+Alt+Shift+D`, or open the app URL with `?proto=drilldown`. Project/Queue buttons only show a toast.
Screens: `prototype/01-years.png … 05-reading-full.png`.

**Sermons** (real hierarchy from `getBrowseDateTree`: Year → Month → Day/Sermon; plus Series, Location, Recently played,
Favorites as *root choices*, not cards):
- Root list at 320px. Choosing an item pushes the next column; the finished column collapses to a **44px vertical rail**
  (shows its selection: `1962`, `Oct`). Clicking a rail jumps back to that level.
- The final level (sermon) opens **in the large pane on the right**; the last list (sermons of that month) stays beside it so
  you can flip between sermons without going back.
- **Slide away:** the handle on the pane edge, or `\`, animates the grid's width to 0 (280ms in-out) giving the text full
  width; same control slides it back. State is remembered per area.
- Search results, Recents and Favorites reuse the same two-pane shape (list ↔ reading pane).

**Bible:** Book (grouped OT/NT) → Chapter → verses are the *reading pane itself* (verse list with per-verse Project/Queue).
Typing in the jump box ("John 3:16") bypasses the columns and lands on the verse. Translation switcher in the pane header;
**compare** puts a second translation column beside the first (v2 has multiple translations via `getBibleTranslations`).
Hover a verse reference anywhere → inline preview card.

**Songs:** Songbook/Letter/Filter → Song list → **lyrics pane with section thumbnails** (Verse 1, Chorus…) that project on
click; a size slider scales thumbnails.

**Sizes & degradation.** Column 320px (min 260), rail 44px, reading pane min 420px. Under ~900px wide the grid and reading
pane never share the screen: it becomes a single-column stack with a "‹ Back" in the header (prototype implements
this: resize the window below 900px). **Keyboard:** ↑↓ move, → / Enter open, ← / Backspace / Esc back, `\` toggle
columns, `/` search, `Ctrl/Cmd+K` palette. **Queue:** hover/focus on a paragraph reveals Queue + Project; drag a row/paragraph
onto the queue handle (it expands as a drop target); `Q` queues the focused item, `P`/Enter+Shift projects it.

## 6. Ideas — decisions

**Build in Phase 2 (adopt):**
1. Command palette `Ctrl/Cmd+K` + one global search across sermons/Bible/songs — biggest journey-shortener.
2. Preview/Live pair with live thumbnail (projection only; the stage monitor stays a separate window).
3. Collapsible, remembered panes (rail, columns, queue) + status bar.
4. Density modes (comfortable/compact) and a touch mode (48px targets) — tokens already carry it.
5. Undo toasts for queue removal/reorder; skeletons + meaningful empty states.
6. Recents + Favorites (v2 already has recents) as drill-down roots; back/forward history in the columns.
7. Context menus and verse hover preview.
8. Virtualized lists (see below).

**Next (not this pass):** slide-thumbnail size slider for all slide grids; Operator vs Prep mode (needs product
decisions on what Operator hides); drag-and-drop everywhere beyond queue; guided first-run tour; gesture navigation.

**Declined:** decorative animation/parallax; auto-hiding the queue while projecting (an accidental swipe mid-service is too
costly).

## 7. Phone remote

Same tokens (the remote page gets a trimmed copy), larger targets (56px for Next/Back), a calm connection pill
(connected / reconnecting / offline, never a blocking error), a **Live / Preview** switch, safe-area insets, and a mini browse
reusing the drill-down as full-screen pushes with a back chevron. Light/dark follows the phone. Favicon from `favicon-remote.svg`.

## 8. Dependencies & performance

No new dependency is required for the prototype. For Phase 2 I'd propose **one**: `@tanstack/react-virtual` (~4kB gz) for
the 1,000+ song list, long sermons (119 paragraphs here, longer elsewhere) and 300+ queue items. The prototype currently uses
`content-visibility: auto` on paragraphs, which is adequate for a few hundred paragraphs but is not true virtualization —
I have **not** yet measured frame rate or memory; that's a Phase 3 item. Animation is plain CSS transitions (compositor-friendly
`width`/`opacity`; `width` triggers layout on a small subtree — acceptable, to be verified).

## 9. Decisions I need from you

1. **Logo:** A (recommended), B, or C — or a designer pass on A first?
2. **Live colour:** OK to move "live" from green to red (reserve green for OK)?
3. **Left icon rail** replacing the top tabs — or keep top tabs and only add the slide-away columns?
4. **Queue default:** open during a service / collapsed otherwise — or always open?
5. **Light + high-contrast themes:** both in this pass, or dark + light only?
6. **v1 parity:** `origin/main` is one commit ahead of this branch (`74ededf`, a docs-only `CLAUDE.md` for v1). I did not merge it.
