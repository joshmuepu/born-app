# Media Phase 1a — follow-up hardening report

Branch `v2-media-1a-followup` (off `v2-media-1a` at `99323ec`). Written for the owner. Nothing merged, tagged or released; v1 and `main` untouched;
v2's internal identity (`2.0.0-dev.N`, appId `com.joshmuepu.born.v2dev`, ports, data folder) and `release.yml`'s v1.x.x-only tag gate are unchanged
(`git diff 99323ec -- .github/workflows/release.yml` is empty).

## Parity check (CLAUDE.md, start of work)

`origin/main` has six commits `v2-channels` doesn't: the v1.13.1 **remote network picker** (a fix: the phone remote's QR/address could point at the wrong one of two
networks; plus a UI and manual changes) and its release commit. **Not merged.** Recorded in `docs/V1-PARITY.md` as *not started*; the fix almost certainly applies to v2 too. **Your decision.**

## Part A — packaged build and Windows readiness

### A1. Real packaged build (macOS arm64, `electron-builder --dir`, unsigned, not published), run from the package

Run with an isolated profile (port 4317, remote-debugging 9921), real mouse/keyboard/drag input over the debugging port. All pass (scripts in `scripts/packaged-check/`):

| Check | Result |
|---|---|
| Runs from `…app/Contents/Resources/app.asar` (a `file://` origin); no dev server | ✓ |
| Media folder and `media.db` in the user-data folder (`<userData>/media/{files,thumbs,media.db,media.db.bak}`) | ✓ |
| Import, thumbnails, screen-sized copies (`born-media://thumb` and `display` load from the packaged origin) | ✓ |
| Slideshow, still backgrounds behind Bible text on the projection window, preflight "Ready", **Esc** blanks, **Ctrl+Shift+L** logo | ✓ |
| PDF import — pdf.js legacy build **and its worker load from inside the package**; 6 pages → slideshow | ✓ (new: dropping a PDF onto Media works, which is what made this testable without a native dialog) |
| Help: opens offline; media pages and their images load (`naturalWidth` > 0 on all) | ✓ |
| Remote: `/media/<id>/thumb` served; phone remote in **WebKit (iPhone, iPad) and Chromium (Pixel)** shows thumbnails, no page errors | ✓ (this part against the dev app) |
| asar: `better_sqlite3.node` and `libheif-js` are in `app.asar.unpacked`; the manual is in `Resources/manual/v2` | ✓ |
| Quit and reopen: 12 pictures and 4 queue items still there | ✓ |
| **`BORN_TEST_*` ignored when packaged**: started the packaged app with all four set; `mediaTestSetPdf` → `false`, the pack-save hook wrote nothing | ✓ + unit test `testHooks.test.ts` (also fails if main-process code reads `BORN_TEST_*` directly) |

**Windows:** a Windows installer cannot be built or run on this Mac. Instead:

- **`.github/workflows/v2-dev-build.yml`** — a separate workflow; `workflow_dispatch` only; `permissions: contents: read`; builds the **unsigned Windows installer** from the branch you choose, runs `scripts/smoke-windows-packaged.ps1` against the unpacked app (starts it with a throw-away profile; checks the window loads, `media.db` is created, the native module is unpacked, the manual is present), and uploads the installer as a workflow artifact kept **3 days**. No release, no tag, no release permission; `release.yml` untouched.
- **How you run it:** GitHub → Actions → *v2 dev build (manual, no release)* → Run workflow → pick the branch → when green, download **v2-dev-windows** from the bottom of the run. Details and the church-PC steps: [windows-church-pc-checklist.md](windows-church-pc-checklist.md).
- **Not verified:** that workflow has never run (YAML parsed and checked; its steps copy `release.yml`'s database steps, which are known to work).

### A2. Windows code review — [windows-code-review.md](windows-code-review.md)

Found and fixed: scanner-held files (retry on rename/delete), >260-character paths, reserved/odd file names, a path-prefix check in the Help viewer, removable-drive handling, test switches in an installed app, pack file names. Unverified list included (needs a Windows PC).

## Part B — HEIC/TIFF on Windows ([spike 10](../design/media/spikes/10-heic-windows.md)) — **implemented**

A bundled WebAssembly decoder (libheif) and UTIF, in a worker thread, is now the **single conversion path on Windows and macOS**; macOS `sips` is kept only as a fallback for a HEIC libheif cannot read.

| | |
|---|---|
| 12 MP HEIC | **0.97 s**, peak 424 MB (whole process) |
| 48 MP HEIC | **3.6 s**, peak **1.4 GB** → pictures over 64 MP are refused with a plain message |
| 12 MP TIFF (LZW) | 0.5 s |
| In the **packaged** app: 12 MP + 48 MP + P3 + TIFF + a damaged file | 7.5 s total, **longest UI stall 2 ms** |
| Correctness | rotation applied; Display P3 → sRGB via the embedded ICC profile (and CICP); original kept beside the converted JPEG; damaged file reported plainly, batch continues; several pictures in a file → the largest; HDR not tone-mapped (stated) |
| Installed size | +≈3.2 MB |
| Tests | 14 on real HEIC/TIFF files (`heic-quad`, `heic-rot6`, `heic-p3-green`, `heic-corrupt`, `tiff-quad`) incl. the worker thread, 3 on colour, 2 library tests |
| For counsel | **libheif-js is LGPL-3.0** (shipped as its own replaceable file) and **HEVC is patent-encumbered** (software decoder in a commercial product) — open question for January, in the spike and `dependency-notes.md` |
| If a photo still can't be opened | friendly message with **Copy instructions**; the rest of a batch continues |

Not tested: real iPhone files from several iOS versions (only Apple's encoder via macOS was available), Live Photo/burst files as separate samples (they're ordinary HEICs; multi-picture selection is unit-tested), HDR, and speed/memory on Windows.

## Part C — Service pack ([design](../design/media/07-service-pack.md), 3 mockups, moved from Phase 3 to the 1a follow-up in the roadmap)

**Save + pictures** writes `Sunday.bornpack` (queue + manifest + the pictures: items, slideshow pages, backgrounds, logo). **Open pack** (or drop it on the window) shows a review, then an all-or-nothing copy.

| Requirement | How it is met / tested |
|---|---|
| Plain `.born` unchanged; v1.11–v1.13/v2 open it as before | `service.born` inside the pack is byte-identical to a plain Save (test); an old app reading a pack just fails to parse it |
| Size estimate, big-pack warning (>1 GB), progress, Cancel | dialog (mockup 17); estimate and limits tested |
| Verify every file against the manifest hash | SHA-256 + CRC per file; for ordinary pictures identity = fingerprint, so a pack can't claim another identity |
| Atomic import; cancel/failure leaves library and queue exactly as before | tests: cancel mid-copy, failure on the 4th picture, database failure at the last step, no space — file tree and rows compared before/after; staging folders swept at start |
| Zip-slip, zip bombs, duplicates, reserved names, disallowed types, truncation | custom stored-zip reader: only `manifest.json`, `service.born`, `media/<64 hex>.<allowed ext>`; stored entries only (no bombs); counts and sizes capped; overlaps refused; picture must match its extension and fully decode; 9 hostile-name cases, truncated/empty/random/JSON files, flipped bytes, lying manifests, HTML named `.jpg`, a PNG named `.jpg`, >5,000 pictures |
| Two isolated profiles round trip; duplicates | two separate libraries; second open adds nothing; only missing pictures copied; HEIC identity kept; linked pictures arrive as copies |
| 1 GB with streaming | 1 GB entry written, read back and hashed: **+5 MB** memory, 1.2 s. Opt-in benchmark: 300 pictures / 1.01 GB: export 1.0 s (includes read-back check), open+verify+copy 1.1 s, +95 MB (decoding for thumbnails not included; ≈12 ms per 1080p picture in practice) |
| Phone | may list/open saved services as today; **no** pack import or export from the phone |
| Real app | exported from the dev app (profile A), `unzip -t` (the real tool) accepts it, opened in the **packaged** app (profile B): review → "5 new" → added → queue and Check correct; opened again → "5 already here" |

**Try it:** add some pictures, put them in the queue, **Save + pictures**, then on another profile/computer **Open pack**.

## Part D

1. **Library scrolling at 6× CPU throttle, 5,000 pictures** (imported through the app in 60 s). The ~8 fps figure was **not reproducible**: the grid is already windowed (≈90 cards in the DOM of 5,000). Measured — cold, 6× throttle: **35 fps** programmatic scroll (p95 frame 44 ms), **52–59 fps** with real wheel events (p95 29–35 ms), no frame over 100 ms; thumbnails regenerating on demand didn't change that; at 1× it holds 120 fps. What *was* slow: the **Backgrounds view** put 10,000 `<option>`s on the page (two long tasks, 89 + 122 ms at 6×); it now lists the 300 newest plus the one in use (**0 long tasks**), with a note. Small libraries are unchanged. If you still see ~8 fps, I need to know which view/machine.
2. **Linked pictures on removable drives:** a picture whose whole drive is gone is now **Drive not connected** (not "missing"), shown on the card, in the detail pane, in a library banner and in Check, with **Check again**, **Find the folder…** (reconnects by contents — a new drive letter just works; nothing copied or added) and **Copy into library**. Tested with simulated unplugged roots and the Windows/UNC/Mac/Linux root rules.
3. **Truncated/corrupt images:** measured the real browser engine — it already rejects cut-off JPEG, PNG, WebP, BMP and AVIF but **accepts a cut-off GIF**. Now refused at import and flagged in Check ("looks cut short"); Check already caught size changes and re-hashed managed files. Tests included.
4. **Bugs found and fixed:** Help-viewer path prefix check; pasted-picture reserved names; cut-off GIFs accepted; Backgrounds picker 10,000 options; queue toolbar clipped "Check" once two buttons were added (now wraps); long-text banners squeezed to one character per line (fixed); a vitest crash on garbage collection with better-sqlite3 + Node 24 (test-only workaround `keepStatements.ts`; not an app bug); the full suite's pre-existing songs-teardown flake got worse with a 1 GB test (teardown limit 30 → 60 s; 5/5 clean runs).

## Verification

| | |
|---|---|
| Typecheck | clean |
| Full suite | **1072 passed**, 1 skipped (the opt-in benchmark) in 72 files (was 986) |
| Production build | clean; worker bundled as its own file |
| Contrast audit (real app, every new screen: drive banner, offline detail, Save + pictures, Open pack, Check with an offline drive) × 3 sizes (1040×640, 1440×900, 2560×1440) × dark, light, both high-contrast | 60 combinations, **0 issues** (`media-followup-contrast-report.json`); `themeContrast.test.ts` green |
| Regression pass on fresh profiles | queue drag/drop 20/20, navigation history 10/10, Channels/Destinations/Profiles/automation script **656/656**, Graphics (OBS) output profile/blank/suppress behaves, a following Channel's Graphics frames (media + background) correct, remote WebKit+Chromium thumbnails and no errors; Help and palette exercised by the packaged run |
| Help manual | HEIC/TIFF, service packs (new page), drive reconnect, GIF/cut-short, troubleshooting; screenshots regenerated from the current app (+3 new) |

## Not tested / limits

Windows (no PC); the new workflow never run; real iPhone files and HDR; a real projector; very large real packs over a slow USB stick (the 1 GB numbers are from an SSD); the network-share timeout case; Playwright was not used inside the packaged app (the debugging-port script drives real mouse, keyboard and drag events instead).

## Decisions needed

1. **v1.13.1 network-picker fix** — port it into v2 (and when)?
2. **HEVC patent / LGPL** — counsel questions in spike 10 (the January list).
3. Is the **64-megapixel** conversion limit right, or should big churches get a higher one (needs more memory)?
4. Pack size: **1 GB warning, 4 GB limit, 5,000 pictures** — fine for you?
5. Are you seeing ~8 fps anywhere real? Which view and machine?

## Recommendation

**`v2-media-1a` + this follow-up is ready to merge into `v2-channels`** on the strength of the macOS packaged run, 1072 tests, the audits and the regression pass — **with one condition:** run the manual Windows build and the 30-minute [church-PC checklist](windows-church-pc-checklist.md) first, because everything Windows-specific here is reviewed and unit-tested but has never been run on Windows. Merging itself is yours to do; nothing was merged.
