# Media Phase 1a — QA report

Branch `v2-media-1a` (off `v2-channels` at `dbba350`; design package and spike docs brought in as documents only).
Tested on the dev Mac (Apple M4 Max, macOS 26, Electron 33.4.11) with the isolated dev profile (ports 4317–4319).
**Not merged, tagged or released. v1/`main` untouched. v2 identity unchanged (`2.0.0-dev.1`, appId, ports, data folder).**

## 1. What was built, against the roadmap

| Roadmap item (Phase 1a) | Built | Notes |
|---|---|---|
| `.born` type cleanup + compat shell | ✔ | Step 1. Unknown/newer/damaged items kept, labelled, never crash; media written as a quote-shaped shell |
| Media library (import, folders, tags, favorites, search, thumbnails, relink, duplicates) | ✔ | Copy by default; **link in place** for very large files; `media.db` (own database, versioned migrations) |
| Images, slideshows | ✔ | Fit/fill/stretch/centre; manual by default; optional auto-advance (3/5/8/15 s) + loop |
| Still backgrounds + layer order | ✔ | Per destination and per channel, with dim; Background → Content → Overlay → Alert |
| PDF import | ✔ | pdf.js **legacy** build (the current one needs newer JavaScript than this Electron) |
| Preflight | ✔ | Deep per-file checks, one-click fixes |
| Panic key | ✔ | Esc/B now also cancels a take still loading; **Ctrl/⌘+Shift+L** = church logo |
| Remote | ✔ | Thumbnails, slideshow stepping, Blank; no seek/sound. Read-only `/api/v1/automation/queue` |
| Sharing | ✔ (references) | By content hash, one review, cancel changes nothing, find-by-folder. **Bundling is Phase 3, per the roadmap** |
| Video, audio, motion backgrounds, alerts designer, timers, YouTube | ✘ | Not in 1a |

## 2. Tests

- Unit/component: **66 files, 986 tests, all passing** (870 before this phase; +116). New: queue compat matrix, picture items and
  slideshows, backgrounds resolution, media library (real files on disk: import, dedupe, linking, relink, soft delete/purge, health,
  preflight, sharing by hash, migrations incl. rollback and newer-version refusal), header parsing, PDF geometry and messages,
  Preflight and queue components.
- `npm run typecheck` clean; production `electron-vite build` succeeds.
- One existing test was **deliberately changed** (`migrateQueue` used to drop junk entries silently; it now keeps them as labelled items).
- Contrast: the automated WCAG test now includes the `--media` token in dark, light, high-contrast dark and light (passing). The
  runtime DOM audit over **7 Media states × 3 window sizes × 4 theme/contrast combinations = 84 checks found 0 issues**
  (`docs/qa/media-1a-contrast-report.json`).

## 3. Driven in the real running app (real mouse and keyboard through DevTools input events)

| Check | Result |
|---|---|
| Open Media, click a card, favorite with **F**, add with the real button, right-click menu, search | ✔ |
| Take a 50-megapixel photo while a smaller one is live | ✔ first picture on the output in ~55–100 ms (screen copy cached) |
| Take with the file **missing** | ✔ toast; the output still shows the previous picture |
| **Esc** during a take that has to build a screen copy (4 trials, Esc at different moments) | ✔ output blank every time; picture never appears afterwards |
| Esc, then Esc again | ✔ picture returns |
| **Ctrl+Shift+L** with no logo / with a logo | ✔ blanks + explains / shows the logo |
| Slideshow with **auto 3 s + loop**: sequence | ✔ 2→0→1→2 at ~3.0 s steps (`3079, 6148, 9061 ms`); **Esc stops it** |
| Background set on the Congregation screen; text over it; Live read-back; clear; channel default; explicit "none"; picture covers background | ✔ all |
| Graphics (OBS) page: SSE frame carries the picture/background; `/media/<id>/display` 200; bad id and `../` → 404 | ✔ (found and fixed: frame initially dropped `media`) |
| PDF: 12 pages, 100 pages, password-protected, truncated, not-a-PDF | ✔ messages as designed; 100 pages in **4.3 s**, memory flat (~50 MB heap) |
| Preflight: missing file + same-size damaged file + good file → "2 problems"; fix → "1 problem" | ✔ |
| Shared service: save → remove the pictures → open → review → **Cancel** (library and queue unchanged) → open → **Find the pictures** (21-file folder; only the 3 matches added, 114→117) → preflight green | ✔ |
| Phone remote in **WebKit (iPhone 14, iPad)** and **Chromium (Pixel 7)**: thumbnails load, no page errors | ✔ |
| Real v1 (1.13.0, from `born-v1`) opens a v2-saved file with media | ✔ no crash; shells readable; autosave keeps the data (Step 1 report) |

## 4. Performance (dev Mac; best-case hardware)

| Measure | Result |
|---|---|
| 5 × **50-megapixel** JPEGs import | 120–180 ms each |
| Screen-sized copy of a 50-MP photo (first Take) | ~135 ms each |
| **5,000 pictures** import (640–1280 px) | **47.4 s** total (**9.5 ms/picture**); memory flat (~1.22 GB across all app processes, which started at 0.68 GB) |
| Media tab with 5,005 pictures: first cards on screen | **127 ms** (355 ms at 6× CPU throttle) |
| Scroll of the 5,005-picture grid, 3 s end to end, 1× CPU | p50 9.3 ms, p95 18 ms, max 25 ms per frame (53 cards in the page) |
| Same at **6× CPU throttle** | p50 126 ms, p95 160 ms (≈ 8 fps) — a stress test: the whole 230,000 px list is crossed in 3 s |
| List view scroll | p50 8.7 ms / p95 24 ms (1×); p50 127 ms (6×) |
| Search over 5,005 (database) / UI settle | 2 ms / **215 ms** |
| `mediaList` of all 5,005 / `mediaCheckAll` | 96 ms / 26 ms |
| Preflight of 300 pictures (deep: re-hash + decode) | 735 ms |
| **300-slide slideshow**: take / 299 × Next | 45 ms / **7 ms per step** (p95 9 ms; 300 distinct pictures shown) |
| Same, operator window at 6× CPU | Back step p50 43 ms |
| Memory after 300 slides | +180 MB (Chromium's image cache; ~0.6 MB/picture) |
| Library on disk (5,005 pictures) | 91 MB files + 2.1 MB database |

Before/after: no existing screen got slower in the runs above (Sermons/Bible/Songs were not changed). The only shared-code
changes on hot paths are `migrateQueue` (a few extra checks per item) and the Live snapshot (one background lookup).

## 5. Failure matrix

| Case | Behaviour |
|---|---|
| Missing file at import / Take / preflight | Clear message; screen unchanged; listed in **Needs attention** and preflight |
| Moved folder / unplugged drive (linked) | *Missing*; **Find the file…** relinks by contents |
| Truncated JPEG | Refused as *incomplete* at import; caught by preflight if it happens later |
| Same-size silently damaged file | Not seen by a stat; **caught by preflight** (hash mismatch) |
| Corrupt / text file named `.jpg` / empty | *damaged* / *empty* messages; nothing added |
| HEIC / TIFF | Converted on macOS; clear iPhone instructions elsewhere |
| 50-megapixel photo | Imported, screen-sized copy used; > 200 MP refused |
| Disk full / < 500 MB margin | Import refused with a message; nothing half-written (temp-and-rename) |
| Library database newer than this build | Media area reports itself unavailable; the rest of BORN works |
| Permission error | *BORN isn't allowed to read that file* |
| Display unplugged while a picture is live | Handled by the existing display logic (the picture is ordinary window content) — **not re-tested physically** |
| Esc at any time | Always blanks; cancels loading takes |

## 6. Deviations from the design, and why

1. **PDF import uses pdf.js's legacy build** — the current build fails on this Chromium (`toHex is not a function`).
2. **Esc remains a toggle**, as documented in the manual; the new part is that it also cancels a take in flight.
3. **Backgrounds picker** is a view inside Media (and "Use as a background" in the picture's pane), not a separate screen.
4. **Bundles (`.bornpack`)**: not built — Phase 3 in the roadmap; references + relink + review were built instead.
5. **Alert designer / countdown / lower thirds**: not built — Phase 2 in the roadmap.
6. Two small **dev-only environment hooks** (`BORN_TEST_PICK_PDF`/`BORN_TEST_ALLOW_SET_PDF`, `BORN_TEST_LOCATE_DIR`) answer the file pickers
   without a dialog for automated runs; both are inert unless set.

## 7. Not tested

Real **Windows**; a real **touch** device; a **physical projector** or unplugging a display while a picture is live; a real **iOS**
phone (WebKit engine only); a **packaged installer** build (production bundle builds; the packaged app was not launched);
real iPhone HEIC / HDR photos; real PowerPoint-exported PDFs; very low-end hardware; a network share or OBS on another computer.

## 8. Check by hand (owner)

1. **Church Windows PC:** open Media, add 10 real photos (a few from phones), a 4K picture, a PDF made from a real PowerPoint.
   Take each; press **Check**; leave the app open an hour; confirm Esc and Ctrl+Shift+L.
2. **Real iPhone photos including HEIC** (Settings → Camera → Formats → High Efficiency) — expect the clear Windows message; on a Mac they convert.
3. **A real projector:** a picture, a slideshow on 5 s auto-advance, a background behind a verse; unplug the cable and plug it back in.
4. **A real phone** on the church Wi-Fi: thumbnails, Next/Back in a slideshow, Blank.
5. **OBS** on the streaming computer: a Full-screen Graphics output showing a picture and a background; confirm a Lower-third output stays clear.
6. **Sharing:** save a service with pictures, put the file and a folder of the pictures on a USB stick, open it on a second computer.
7. Pull the network cable / unplug a USB drive holding a *linked* picture mid-service: confirm the screen keeps showing it, and that **Check** names the problem afterwards.

## 9. Screenshots

`docs/qa/screenshots-media/` (and `docs/manual/v2/images/media-*.png`): library, detail, backgrounds, queue menu, preflight (problem and ready),
live background, live pair, PDF import. "Before" is any earlier `docs/qa/ui-after` capture — the rest of the UI is unchanged apart from the
new rail item and the **Check** button in the queue header.
