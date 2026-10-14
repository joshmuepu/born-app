# v1 → v2 parity tracker

Every v1 fix v2 needs, and every v1 feature the owner hasn't decided on yet,
from v1.11.0 through v1.13.0. Each "ported" row below was checked directly
against this folder's actual code, not assumed from the commit message.

See `CLAUDE.md`'s "v1 parity" section for the rules this file supports.

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
