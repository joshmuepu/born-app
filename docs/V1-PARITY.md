# v1 → v2 parity tracker

Every v1 fix v2 needs, and every v1 feature the owner hasn't decided on yet,
from v1.11.0 through v1.13.0. Each "ported" row below was checked directly
against this folder's actual code, not assumed from the commit message.

See `CLAUDE.md`'s "v1 parity" section for the rules this file supports.

> **UI conventions:** since the Born Again redesign landed in v2, v1 UI changes
> are ported by intent into the shared components and tokens described in
> `docs/design/born-again-ui-direction.md` (and `CLAUDE.md`'s "UI conventions"),
> not by applying v1 diffs.

## v1.11.0 → v1.12.0 (QA passes 1–3, remote connectivity)

Every fix in this range reached v2 the same way: a direct
`git merge main` at v1.12.0 (`5bfb7c5`, before the UI redesign diverged
v2's code from v1's), not an individual port. Confirmed: `595a728`
(the v1.12.0 tag) is a real ancestor of `v2-channels`.

| v1 commit | What it changed | Type | v2 status | Notes |
|---|---|---|---|---|
| `d015966` | Sermon-highlight carried over to an unrelated sermon opened via Browse/queue | fix | **ported** | via `5bfb7c5` |
| `bae5ccf` | Projecting a sermon's header slide marked hundreds of unrelated paragraphs "on screen" at once | fix | **ported** | via `5bfb7c5` |
| `e9671b7` | Hide/Show screen button didn't actually turn amber while hidden | fix | **ported** | via `5bfb7c5` |
| `70fa884` | New/Open left the congregation screen showing stale content | fix | **ported** | via `5bfb7c5` |
| `844609f` | Opening/importing a damaged or empty saved-service file failed silently | fix | **ported** | via `5bfb7c5` |
| `b359d57` | `/` inside an open sermon didn't return to the search box | fix | **ported** | via `5bfb7c5` |
| `7d8c124` | "Check for updates" falsely claimed "latest version" when the check itself had failed (e.g. offline) | fix | **ported** | via `5bfb7c5` |
| `dff5539` | F9 — a corrupted local database recovered with a misleading message instead of a clear one | fix | **ported** | via `5bfb7c5` |
| `a660937` | F7 — a named section's 2nd+ slide could collide with a different section's label | fix | **ported** | via `5bfb7c5` |
| `1cafe83` | Built-in "Remote connection check" diagnostic panel | feature | **ported** | via `5bfb7c5` |
| `4f4eb4a` | Remote's address could silently pick a VPN/virtual adapter instead of the real LAN one | fix | **ported** | via `5bfb7c5` |
| `76ee981` | mDNS advertised the remote before the HTTP server had actually bound | fix | **ported** | via `5bfb7c5` |
| `b38245b` | Remote shows the plain LAN IP as the primary address, `.local` as backup | fix | **ported** | via `5bfb7c5` |

## v1.12.1 (UI audit Pass 1 + Pass 2, in-app Help, remote reliability)

| v1 ID / commit | What it changed | Type | v2 status | Notes |
|---|---|---|---|---|
| U1 / `479e162` | Songs → Browse A-Z jump scrolled one row too far, hiding the target letter's first title | fix | **ported** | `b3d6140` |
| U2 / `b1baf61` | Esc didn't close the "Show a message on screen" dialog | fix | **ported** | `15d5f19` |
| U3 / `1cb616b` | Missing `modal-title-row` CSS (title + X button laid out wrong) | fix | **N/A** | v2 already had this CSS — it's v1 that was missing it, since the Help viewer (and this layout) originated in v2 |
| U4 / `e2386f1` | Remote commands failed silently on a dropped connection, with no banner | fix | **ported** | `46422c7` |
| U5 / `349d5af` | Remote showed stale state for up to a minute after a backgrounded tab resumed | fix | **ported** | `74bc8bd` |
| U6 / `ee1bf47` | Two rapid Next/Prev taps raced and only advanced once | fix | **ported** | `8e3dbf6`, via the framework-agnostic `serialize.ts` |
| E1 / `1cb616b` | Message dialog always defaulted to Stage monitor even when none was on | fix | **ported** | `1a4e08e` — only the safe fallback-when-off part; v2's own intentional "default to Stage when on" behavior was kept as-is |
| E2 / `1cb616b` | Message dialog had no X close button | fix | **ported** | `15d5f19` |
| `9e270b3` | In-app Help viewer (`F1`) | feature | **N/A** | originated in v2, ported *into* v1 — not a v1→v2 gap |
| `d0435ba` | Remote's everyday "+ Queue" button never tagged who added the item (only the separate "My list → Send" did) | fix | **ported** | `dae3d75` |

**Not carried into this table:** `v1-e2e-report.md`'s SEC-01 (the remote's `open-service`/`import-service` commands don't sandbox the file path) was reported as a suggestion, not fixed, in v1 itself — per that pass's own instructions not to change the remote's access model. It applies equally to v2 (same pattern exists in `webRemote.ts`/`index.ts`), with nothing to port since v1 never fixed it either. Worth the owner's attention in both products at once, whenever that's prioritized.

## v1.13.0 (Stage/Projection fixes, end-to-end hardening, queue song-import)

| v1 ID / commit | What it changed | Type | v2 status | Notes |
|---|---|---|---|---|
| `91378e1` | Stage/Projection could auto-pick a display that only mirrors the primary (Windows Duplicate mode), fullscreening over the operator's own screen | fix | **ported** | `4229054` |
| `dc2606c` | Ctrl/Cmd+Shift+W could only ever close Projection, never Stage; no escape hatch if a screen got stuck | fix | **ported** | `c86a1f0` — includes the new global `Ctrl/Cmd+Alt+Shift+W` force-close shortcut |
| `e867367` | Stage's own screen picker was hidden until Stage was already turned on | fix | **ported** | `a91a0c1` |
| DEF-01 / `980a5f5` | Sermons search results' queue button read "Add to Queue" instead of "+ Queue" | fix | **ported** | `e8e3b86` |
| DEF-02 / `84afc39` | A legacy `fontSize: 3` got realigned to the honest 4.5 in memory but never written back to disk | fix | **ported** | `c08577a` |
| DEF-03 / `96e7048` | "Check for updates" had no timeout — a slow/stalled connection could hang "Checking…" forever | fix | **ported** | `7e9bb6d` |
| Queue song-import (`ba5d893`…`79bdafb`) | Offers to add a shared queue's songs that aren't yet in the local library, with a review step for new/conflicting songs | feature | **not ported** | see `docs/notes/v2-queue-song-import.md` — v2's songbooks (per-Channel) and its still-single shared queue raise real design questions this wasn't built to answer |

## v2-only (nothing to port from v1): the `.born` compat shell (Media 1a, Step 1)

| Item | Detail |
|---|---|
| What | v2 now keeps unknown/newer/damaged queue items (never drops or crashes), and writes new item kinds (media) as a quote-shaped "compat shell" carrying the real data under `ext`. |
| Why it matters to v1 | v1.13.0 (`main`, identical `migrateQueue`) opens such a file **without crashing** — verified in the real app — showing the shell as a quote row; its autosave preserves `ext`. v1 would still **crash its queue screen** on an *unknown top-level kind with slides* (`KIND_ICON[item.kind]` undefined, `ServiceQueue.tsx`); v2 never writes those. |
| Optional v1 hotfix | Two lines in v1 (`KIND_ICON[item.kind] ?? FallbackIcon` and a default `itemTitle` branch) would make v1 safe against any future kind. Owner's decision; v1 was not touched. |
| v2 status | **intentionally different** (v2-only feature) |

## v2-only: Media (Phase 1a) — `docs/qa/v2-media-1a-report.md`

| Item | v2 status | Notes |
|---|---|---|
| Media library, pictures, slideshows, still backgrounds, PDF import, preflight, logo key, sharing by content hash | **intentionally different** (v2-only feature) | v1 has no media area. v1 opens a v2 file with pictures safely (verified with real v1.13.0; see the compat-shell note above) |
| `Esc` also cancels a take still in flight | **intentionally different** | v1's Esc is unchanged |
| Optional two-line v1 hotfix so v1 never crashes on an unknown queue item kind | **not started** (owner's decision) | Not required for v2 files, which never write such kinds |

## v1.13.1 (Remote network picker) — ported by intent into `v2-media-1b` (2026-10-16); v1 side is RELEASED (v1.13.1 on `origin/main`)

Ported by cherry-picking the three code commits and resolving them into v2's model (Born Again `RemotePanel`, automation section, `Born Again` wording, v2's `startWebRemote` signature); nothing merged from v1, v1 untouched. The branch `v2-media-1b` starts with these as separate commits so they can be cherry-picked onto `v2-channels`.

| v1 ID / commit | What it changed | Type | v2 status | Notes |
|---|---|---|---|---|
| `8e13590` | Rank networks by kind (Wi-Fi first), bind `0.0.0.0` explicitly, mDNS per adapter, richer diagnostics backend (`networks.ts`, `networkMeta.ts`) | **fix** | **ported** | v2 keeps its own port (`BORN_REMOTE_PORT`/4316) and mDNS name (`BORN_MDNS_NAME`, default `born-remote`); webRemote tests adapted to v2's `startWebRemote(…, automation, …)` signature |
| `a75a9fb`, `e468018` | Remote panel: network selector with reason line, "Show all", per-address connection check; network name shown with one network | feature (UI) | **ported** | Re-fitted into v2's panel (popover row + automation API section kept); verified in the real app |
| `da15388` | v1 manual pages | docs | **ported** (text) | `docs/manual/v2/operators/mobile-remote.md`, `troubleshooting/service-day.md`; no multi-network screenshot (needs two networks) |
| `19d4c37` / `1c39202` | Release and merge commits for v1.13.1 | release | **do not port** | v2 keeps `2.0.0-dev.N` |

## v1 unknown-queue-item safety — v1 side NOT built

There is no v1 branch for it. v2 already has the behaviour (Media 1a Step 1). Hand-off note for v1: `docs/notes/v1-needs-unknown-item-safety.md` (the optional two-line hotfix). v1 not touched.

## v2-only: Media follow-up (`v2-media-1a-followup`) — `docs/qa/v2-media-1a-followup-report.md`

| Item | v2 status | Notes |
|---|---|---|
| HEIC/TIFF on Windows and Mac by a bundled decoder (colour-corrected, rotated, original kept); Windows-safe file handling | **intentionally different** (v2-only media area) | `docs/design/media/spikes/10-heic-windows.md` |
| Service packs (`.bornpack`): a queue with its pictures, review-then-atomic open | **intentionally different** (v2-only) | `docs/design/media/07-service-pack.md`. v1 and old v2 never see the format; the `.born` inside is unchanged |
| "Drive not connected" state, Reconnect-by-folder, Copy into library for linked pictures | **intentionally different** (v2-only) | |
| Manual-only Windows build workflow `.github/workflows/v2-dev-build.yml` (read-only, no release) | **intentionally different** | `release.yml` and its v1.x.x tag gate untouched |

## v2-only: Media Phase 1b (`v2-media-1b`) — video and moving backgrounds

| Item | v2 status | Notes |
|---|---|---|
| Video items (MP4, H.264 + AAC), playback bar, follower screens, Graphics follower, stage time-left, phone Play/Pause of the live video, panic keys, motion backgrounds, video preflight | **intentionally different** (v2-only media area) | `docs/design/media/08-phase-1b-build-plan.md`. v1.13.0's own queue reader opens a v2 file with video items without crashing (tested against the real v1 file in `src/test/shared/v1Compat.test.ts`) |
| `smoke-macos.sh` now isolates its profile and ports | intentionally different | CI script only; the v1 release workflow is untouched |

