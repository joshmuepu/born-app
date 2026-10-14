# v1 end-to-end hardening pass

Branch: `v1-e2e-hardening`, off `main` at `e867367` (3 commits ahead of the
released `v1.12.1` tag — see "Where things stand" below for exactly what
those are). v1 is in hardening-only mode for this pass: no new features, no
redesigns, no new settings. Driven live against real dev instances
(`BORN_USER_DATA_DIR`/`BORN_REMOTE_PORT`/`BORN_MDNS_NAME`, never the real
install or port), over Chrome DevTools Protocol — real clicks, real typed
input, real HTTP calls against the remote's own API, real headless-Chrome
phone simulators, and (where noted) real external monitors physically
connected to this machine. No security-sensitive detail is in this file
beyond the one finding Journey 10 explicitly asks to be reported as a
suggestion.

## Where things stand

- `v1-ui-audit-help` (Pass 1 + Pass 2, the Help section) is merged into
  `main` and released as **v1.12.1** — confirmed: `origin/main` is at
  `1d4eddd` ("Release: v1.12.1"), the GitHub release has all three installer
  assets, and `/releases/latest` resolves to it.
- Local `main` in this worktree carries **3 more commits beyond v1.12.1**,
  from a fix session earlier the same day as this pass, kept committed but
  intentionally **not yet pushed or released** at the owner's request:
  `91378e1` (Stage/Projection could auto-pick a mirrored display and
  fullscreen over the operator's own screen), `dc2606c` (Ctrl/Cmd+Shift+W
  couldn't close Stage, only Projection; added a global escape-hatch
  shortcut), `e867367` (Stage's screen picker was hidden until Stage was
  already on). These are real, already-fixed, already-tested defects from a
  direct owner report (a church-computer incident) — included here for
  completeness since this branch is built on top of them, but they are
  **not** re-litigated as new findings in this report; the table below only
  lists what this specific e2e pass found.
- This branch (`v1-e2e-hardening`) adds 3 new commits on top of that,
  detailed below. Nothing has been merged to `main`, nothing tagged,
  nothing released. v2 was not touched.

Earlier QA passes (`docs/qa/v1-qa-report.md`, `-2.md`, `-3.md`,
`v1-ui-audit-report.md`, `remote-connectivity-report.md`) were read in full
before starting. Their findings (sermon highlighting, on-screen-marker
spillover, the amber Hide/Show button, the Songs A-Z jump, corrupted-database
recovery, the ProPresenter verse/chorus label collision, Message dialog
Esc/X/default-target, remote silent-failure/background-resume/rapid-tap
races, adapter-selection/mDNS-ordering/IP-primary) are all confirmed already
fixed and released — not redone here. This pass targets whole journeys and
the gaps those passes explicitly flagged as untested.

## Journeys

### 1. Install and first run — DONE

Fresh profile, first launch: no first-run modal/tutorial at all — straight
into the normal UI with an empty queue, a helpful empty-state placeholder,
and a working "On This Day" card using real data immediately (the bundled
databases seed from local `.gz` files, no network needed). Opened Help (F1)
and followed **Quick start** literally, step by step, as a brand-new
volunteer would: search → queue/project → open projection → go live. Every
step worked exactly as written, with one exception — **DEF-01** below.
Cross-checked every other bolded UI label mentioned anywhere in the manual
(`**Button Label**` patterns, ~40 candidates after filtering prose) against
the real component source; everything else matched exactly, including labels
that visually look different from their literal DOM text because of a CSS
`text-transform: uppercase` rule (e.g. "Hidden from screen" rendering as
"HIDDEN FROM SCREEN", which the manual correctly describes as seen, not as
coded).

**Result: 1 defect found and fixed (DEF-01).**

### 2. Upgrade path — DONE

No v1.11.0 build was available to install directly, so this was tested by
constructing the exact on-disk shapes an upgrade would encounter and loading
them with the current build: a `settings.json` missing fields that exist
today (`recentKeys`, `recentBibleRefs`, etc.) and using the old `fontSize: 3`
default, plus a `queue.json` in the pre-`QueueItem` legacy bare-quote shape
(`{text, sermonId, ...}`, no `kind`/`slides`). Launched clean: `getSettings()`
backfilled every missing field from defaults correctly, `migrateQueue()`
converted the legacy quote into a real `QueueItem` and the UI rendered it
correctly, and the app re-wrote `queue.json` to disk in the new shape on its
own. Found one real gap in this exact path — **DEF-02** below. Also
confirmed (separately, not an upgrade-specific concern but adjacent):
queue and settings both survive a clean quit and a `SIGKILL`-simulated crash
identically, and the remote's own `/state` correctly reflects the real
(non-stale) state on both kinds of restart.

**Result: 1 defect found and fixed (DEF-02). No data loss or crash on any
simulated upgrade path.**

### 3. A full service, start to finish — DONE

Built a real mixed queue (a song, a Bible chapter, a sermon quote — one via
the remote's batch API for speed, two via the actual search UI). Went live,
advanced through multiple slides with rapid repeated taps (confirming the
earlier rapid-tap-race fix still holds — 3 taps moved exactly 3 slides),
jumped directly between queue items (skipping mid-song), blanked and
un-blanked, and started a **New service** while something was live and the
screen was showing. At every step, the operator's confidence monitor, the
real Projection output window, and the real Stage monitor window were
independently read and compared — all three agreed every time. New Service's
confirmation uses a genuine blocking `window.confirm()` (not a React modal),
which took some care to drive via CDP's `Page.handleJavaScriptDialog`, but
once that was sorted, the already-documented fix held: the queue cleared,
the congregation screen auto-blanked, and the operator's own status line
said so honestly (`"Screen is hidden"`), with nothing stale left showing.

**Result: no new defects. Everything agreed, every time.**

### 4. Content sources under failure — PARTIAL

Sermon search/Browse and Bible text are both fully local (no network at
all), already confirmed offline-safe in prior passes — not re-tested here.
The one genuinely network-dependent, user-visible path that hadn't been
stress-tested for a *slow* (not dead) connection is the update check — found
and fixed **DEF-03** below. The "arrives after the user moved on" race was
considered for the update check specifically: `handleCheckForUpdate` has no
staleness guard against two overlapping checks, but both query the exact
same no-parameter endpoint, so a stale second response can't actually show
a *wrong* answer, only a redundant one — not a real defect, not fixed.
Online song import (Hymnary/Cyber Hymnal) and its offline-vs-no-results
distinction were reviewed, not re-driven — Pass 2's F10 (flagged inconclusive
there) was not re-attempted; see "Not tested."

**Result: 1 defect found and fixed (DEF-03).**

### 5. Data lifecycle — PARTIAL (relied on existing coverage)

Song import across formats (ProPresenter, OpenLyrics, OpenSong, ChordPro,
plain text, `.docx`, `.pdf`, including a deliberately text-less "scanned"
PDF fixture) already has dedicated parser tests with real fixture files
(`src/test/main/songParsers.test.ts`), including the exact "damaged file"
case the brief asks for — a scanned PDF with no extractable text reports a
specific, clear `NO_TEXT_FOUND` error, not a crash or silent garbage output.
Read this coverage in full rather than re-driving every format live, given
budget — it's real, fixture-based, and already passing. Search/sort with
special characters (accented Latin, Japanese, Arabic, curly quotes) was
confirmed clean in Pass 2, not repeated. Clean quit vs. `SIGKILL`-simulated
crash: both tested fresh in this pass (see Journey 2) — identical, correct
recovery either way. **No backup/restore feature exists in v1** beyond
"Save/Open a service file" and the database's own corrupt-file quarantine
(`<name>.corrupt-<timestamp>`, Pass 3) — there's nothing else to test under
that name.

**Result: no new defects found; relied on existing fixture-based coverage
rather than re-driving every import format live.**

### 6. Long-running session — PARTIAL

A full 2-3 hour continuous run was not performed (same honest limitation
every prior pass hit). What this pass did instead: a code audit of every
`setInterval` in the whole codebase — there is exactly **one**, in the Stage
window's 15-second clock, and it's correctly cleared in its `useEffect`
cleanup. The remote's own 1-second poll (and the main process's
`lastSeenByClient` connection-tracking map) were reviewed: the map grows by
*distinct device count*, not by time or poll count, and is cleared on app
shutdown — realistic church usage (a handful of phones over a session) keeps
this at a handful of entries, not an unbounded growth pattern. As a partial
real check (not a substitute for the full duration), sampled the main
process's RSS every 30 seconds for 3 minutes with the remote actively
polling and projection live: **406.6 MB → 408.8 MB**, about 2.2 MB over 3
minutes — small enough to be ordinary heap fluctuation, not conclusive proof
either way over a real multi-hour span.

**Result: no defect found in the code that's there; the real multi-hour
duration itself was not exercised — see "Not tested."**

### 7. Displays — DONE (with real hardware this time)

This machine had 3 real displays connected for this entire pass (Built-in,
plus two external monitors) — a first for this app's QA history; prior
passes explicitly flagged real-hardware display testing as out of reach.
Tested live: renaming a real external display, assigning it as Stage's
explicit override, and confirming **both the custom name and the explicit
assignment survive a full app restart** — previously only unit-tested
against synthetic data, now confirmed against real hardware too. The
mirrored-display fix from the earlier same-day session (`91378e1`) could not
be reproduced with genuine OS-level Duplicate/Mirror mode here (would have
required changing this machine's actual display arrangement, which this pass
intentionally avoided doing without being asked) — it remains verified by
the unit tests added with that fix, not by a live mirror here. A display
being physically unplugged/replugged mid-session was not attempted (would
require physically disconnecting a monitor this agent has no way to do) —
see "Not tested."

**Result: no new defects; display rename/override persistence confirmed
live on real hardware for the first time.**

### 8. The remote, end to end — DONE

Drove the full flow with a real desktop service running and a headless-
Chrome phone simulator connected: searched, queued, and projected from the
phone; then specifically targeted the one scenario every prior pass flagged
as never tested — **restarting the desktop app while the phone stays
connected**. Both a `SIGKILL` (simulated crash) and a clean `SIGTERM` quit
were tested. In both cases: the phone's connection indicator correctly flips
to "Reconnecting…" within one poll cycle, and once the desktop relaunches,
it flips back to "Connected" automatically with **no stale data** — a fresh
instance correctly shows an empty queue and nothing on screen, never
whatever was showing before the restart. Separately confirmed the phone also
correctly reflects a queue that *did* persist (via a clean quit with real
content queued first) — both the desktop and the remote's `/state` agreed on
the restored content. The firewall-prompt-denied scenario and
multiple-network-adapter behavior were reviewed via code (already covered in
depth in `docs/qa/remote-connectivity-report.md` from an earlier pass, not
repeated here) rather than re-tested live.

**Result: no defects found in the one specific gap this pass targeted
(restart-with-phone-connected) — recovery is clean and honest in every case
tried.**

### 9. Windows and macOS differences — PARTIAL (review only, as before)

No Windows machine is available in this environment, same as every prior
pass. Re-reviewed the existing Windows-readiness analysis
(`v1-ui-audit-report.md` §D) and additionally reviewed the 3 commits this
branch is built on top of specifically for Windows correctness, since they
touch keyboard shortcuts and window management directly:
`CommandOrControl+Alt+Shift+W` (the new global escape-hatch shortcut) uses
Electron's cross-platform accelerator syntax correctly — `CommandOrControl`
maps to Ctrl on Windows, Cmd on Mac, with no hardcoded platform branch. The
per-window shortcut fix (`win.close()` instead of always
`projectionWindow?.close()`) has no platform-specific code at all. The
mirrored-display guard compares plain numeric `bounds` fields, nothing
OS-specific. Nothing new flagged. The church incident that motivated those 3
fixes (Windows Firewall likely blocking the remote, separately reported to
the owner in this same session) is a config/firewall issue, not something
this review found a code-level Windows defect for.

**Result: no new Windows-specific defects found in review; nothing run on
real Windows hardware.**

### 10. Security basics — DONE (review only, per instructions — no auth added)

Logging: searched every `log.*` call across the main process for anything
resembling a token/secret/credential — the only "token" hits are SQL
full-text-search query tokens, not credentials. The app does log its own
`userData` path (which includes the OS username, as every app's own data
path does) — reviewed and judged **not a finding**: it's the operator's own
username in their own log file, already used for the "Open data folder" and
"Copy diagnostics" support flows that exist specifically because this path
is useful to see, not a secret being leaked to anyone else.

Checked for SQL injection: the one place a query string is built with
`${...}` interpolation (`indexer.ts`'s dynamic `IN (...)` clause) interpolates
only a `?,?,?` placeholder string built from the app's own internal numeric
IDs, with every real value passed as a bound parameter — safe.

Checked whether the remote can do more than its intended commands: the
write side (`service:save-named`) is correctly sanitized and confined to the
app's own `saved-services` folder. The read side is not — see **SEC-01**
below, reported as a suggestion with severity, not fixed, per this
journey's own instruction not to change the remote's access model.

**Result: 1 finding, reported as a suggestion (SEC-01) — not fixed, per
instructions.**

## Defects

| ID | Journey | What the operator sees | Severity | Status | Commit |
|---|---|---|---|---|---|
| DEF-01 | 1 | The Sermons search results' queue button read **"Add to Queue"**, while every other panel (Bible, Songs, Browse, the sermon follow view) and the manual's own Quick start both say **"+ Queue"** — the very first button a new volunteer's own walkthrough points them at didn't match its own instructions or the rest of the app. | S3 (cosmetic — clicking either button does the same correct thing) | **Fixed** | `980a5f5` |
| DEF-02 | 2 | A legacy `fontSize: 3` on-disk value gets correctly realigned to the honest `4.5` (100%) in memory on every launch, but the correction was never written back — `settings.json` kept reading `3` forever, silently re-deriving the same fix on every single launch. No user-visible effect (the UI always showed the right 100%), but a confusing inconsistency for anyone who ever opens the file directly. | S3 (cosmetic/data-hygiene, zero visible impact) | **Fixed** | `84afc39` |
| DEF-03 | 4 | "Check for updates" already showed a clear error for a *dead* connection. A merely *slow or stalled* one (flaky WiFi, a captive portal) had no timeout at all — "Checking…" could sit there indefinitely with no way to tell it apart from still genuinely working. | S2 (confusing, stuck-looking state; no data loss) | **Fixed** | `96e7048` |
| SEC-01 | 10 | The remote's `open-service`/`import-service` commands pass a phone-supplied file path straight into a file read with no containment check — unlike the write side (`save-queue`), which is correctly sanitized and confined to the app's own folder. Anyone already able to reach `/command` (true for anyone on the LAN today, by this app's existing no-auth design) can point these at any file on the operator's computer. Actual impact is narrowed by `migrateQueue()`'s shape filter on the renderer side (only content that already looks like a real queue item gets absorbed; most arbitrary files just parse-and-drop to nothing) and by the fact that the most damaging primitive this enables — wiping the live queue — is already possible today via the intentional, no-prerequisite `new-service` command. Net new risk: reading the contents of any `.born`-shaped JSON file anywhere on disk (not just the intended `saved-services` folder), observable by polling `/state` afterward. | **S2** | **Suggestion only — not fixed, per this journey's explicit instruction not to change the remote's access model.** Recommended fix for later: resolve `cmd.path` and require it stay inside `app.getPath('userData')` (or specifically `saved-services/`), or validate against the known `recentServices` list, before calling `openServiceFile`. | — |

No S1 defects found in this pass. (The 3 carried-over commits this branch is
built on — see "Where things stand" — were S1: a church-computer incident
with Stage fullscreening over the operator's own screen and no shortcut able
to close it. Those are already fixed, already tested, and not re-counted
here as findings of this pass.)

## Regression tests added

- `src/test/renderer/ResultsList.test.tsx` (2 tests) — DEF-01.
- `src/test/main/settings.test.ts` (3 tests) — DEF-02, including a guard
  against a too-broad fix (a *deliberate* later `fontSize: 3` from the
  operator must stay, not get silently re-corrected).
- `src/test/main/updateCheck.test.ts` (+2 tests) — DEF-03. Also extended
  `src/test/__mocks__/electron.ts` with `net.fetch` and `app.getVersion`,
  needed to exercise `checkForUpdate()` directly for the first time in this
  codebase's tests.

## Typecheck and test suite

- `npm run typecheck`: clean (both `tsconfig.node.json` and
  `tsconfig.web.json`).
- Full suite: **40 test files, 603 tests, all passing.** (580 at the
  `v1.12.1` baseline this branch starts from, +6 from the 3 carried-over
  commits' own fixes, +7 from this pass's 3 new fixes above = 603.)

## Not tested

Honest list, this pass's additions on top of every prior pass's own list
(real phone/iOS hardware, true keyboard Enter on real hardware, Windows on
real hardware — all still open from before):

- **A full 2-3 hour (or longer) continuous session.** Code-reviewed (one
  `setInterval` in the whole codebase, correctly cleaned up; the remote's
  connection-tracking map grows by device count, not time) and sampled for
  3 real minutes (modest ~2 MB growth, inconclusive either way over that
  short a window) — not run for the real duration.
- **A display physically unplugged or replugged mid-session**, or a
  resolution change, on real hardware. This pass had real external monitors
  connected the whole time (a first), but nothing here can physically pull a
  cable.
- **Genuine OS-level Duplicate/Mirror display mode** on real hardware — the
  fix for this (from the same-day prior session) remains verified by unit
  test against synthetic data only; reproducing it live would have meant
  changing this machine's actual display arrangement, which wasn't
  something to do without being asked.
- **The online song-import offline-ambiguity question (Pass 2's F10)** —
  not re-attempted; still flagged inconclusive from before.
- **The "two overlapping update checks" race** — considered, judged not a
  real-world defect (both requests return identical data in practice), not
  separately fixed or tested.
- Everything already on every prior pass's own "not tested" list that this
  pass didn't specifically target: real phone/tablet hardware and iOS
  Safari, a literal <kbd>Enter</kbd> keypress on physical hardware, Windows
  on a real machine, drag-and-drop queue reordering as a literal gesture,
  systematic rapid-click fuzzing beyond the specific rapid-tap case already
  confirmed fixed.

## Check by hand at church, on Windows

1. **Open BORN, press F1, confirm Help opens and its images load** — this
   pass couldn't check image loading on a packaged Windows build.
2. **Click a Sermons search result's "+ Queue" button** — confirm it now
   reads "+ Queue" (not "Add to Queue") after this update installs.
3. **Click "Check for updates" with WiFi off, then with a genuinely slow
   connection if you can reproduce one** — confirm it says it couldn't check
   (not "you're up to date") in both cases, and that a slow one eventually
   gives up instead of spinning forever.
4. **Unplug the projector mid-service, then replug it** — confirm the
   Screens panel notices and lets you pick it again. Not tested at all in
   this pass (no way to unplug a cable remotely).
5. **If the computer is connected to a projector in "Duplicate" (not
   "Extend") display mode** — turn Stage on and confirm it does NOT
   fullscreen over your own operator screen. This is exactly the scenario
   the 3 carried-over fixes on this branch were built for; this pass could
   only verify it with synthetic test data, never real Windows Duplicate
   mode.

## Final summary

**Branch:** `v1-e2e-hardening`, off `main` (which itself carries 3
already-fixed, already-tested commits from the same day's earlier
church-incident fix session, committed but not yet released). This pass
added 3 more commits, one per defect, each with its own regression tests.

**Counts:** 3 defects found and fixed (all S2/S3), 1 security finding
reported as a suggestion per instructions (not fixed), 0 defects found that
weren't fixed, several journeys fully confirmed clean with no findings at
all (full-service run-through, remote restart-with-phone-connected, real
multi-display rename/persistence).

**The five things that matter most to a church operator**, from this pass
specifically:
1. The remote restarting-desktop-while-phone-connected scenario — the single
   biggest "is this remote actually reliable" question left over from
   earlier passes — is now confirmed clean: it recovers on its own, honestly,
   every time.
2. A slow/flaky WiFi connection no longer leaves "Checking for updates…"
   stuck forever with no way to tell it's stuck.
3. Display rename and explicit Stage/Congregation screen assignments are now
   confirmed, on real hardware, to survive a restart — set it up once,
   it stays set.
4. The Sermons search results' queue button now matches what the manual
   (and every other screen in the app) already told you to look for.
5. A full live run — build a mixed queue, go live, jump around, blank,
   start over — kept the operator's own screen, the real projector, and the
   real stage monitor in agreement at every single step, with no exceptions
   found.

**What this pass could not test**: a real multi-hour session, a physically
unplugged/replugged display, genuine OS-level display mirroring, real phone
hardware, and anything requiring a real Windows machine — all listed in
detail above, several carried over honestly from every prior pass.

**Confirmed:** nothing was merged, tagged, or released. No features or
redesigns were added — every change in this pass is a fix to something that
already existed and was supposed to work. v2-channels was not touched.

**Recommendation for the next v1 release: `v1.12.2`**, a patch release.
Reasons: every fix in this pass (and the 3 carried-over ones underneath it)
is a correctness fix to existing behavior, not a feature — exactly what a
patch version means. The carried-over 3 are a direct response to a real
reported incident and are worth shipping promptly; this pass's 3 are lower
urgency but equally safe to bundle into the same release rather than holding
them for a separate cycle.
