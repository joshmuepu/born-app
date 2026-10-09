# BORN v1 — QA Pass 2 Report

*Version tested: v1.11.0, branch `v1-qa-pass-2`, created off `v1-qa-pass`
(which itself carries the four fixes from Pass 1). Same isolation discipline
as Pass 1 — separate worktree, userData directory, port, and mDNS name; no
real settings, saved services, or church data were touched. No
security-sensitive detail in this file — reported separately in chat.*

This pass covered the eight areas Pass 1 didn't: Settings/Outputs/Displays,
Saved Services & Queue, Keyboard-only operation, Failure & Recovery, Stress &
Edge Cases, the Mobile Remote as a real phone, a broader Accuracy spot-check,
and closing out Pass 1's two open items (F4, F6).

---

## 1. What was tested, and how

**Settings, Outputs, Displays** — every control in the Screens popover: text
size +/− while a quote was live (confirmed the projection window updates in
real time, both directions), display rename (typed a name, saved, confirmed
it stuck), Identify, Test Pattern (confirmed the real overlay window content:
sample text + the display's own name, click-to-dismiss), Congregation
screen/Stage monitor Turn On/Off independently (confirmed turning off one
doesn't touch the other), and the About/update area's "check for updates"
link and sermon-index status line.

**Saved Services & Queue** — saved a service via the direct API (bypasses
the native file dialog, which CDP automation can't drive), opened it back,
opened a damaged (garbage-byte) and a zero-byte `.born` file from the Recent
list, tested "New service"'s confirmation while the queue had items and
something was live, removed a queue row, and stress-tested the list at ~95
items (queued via the remote's HTTP API). **Not done**: real native
drag-and-drop reordering — see "What could not be tested," below.

**Keyboard-only** — the Shortcuts modal's full list visually verified; `Esc`
to blank/unblank tested both directions; the `/` shortcut tested from every
tab, including the specific broken case (open sermon + different tab) fixed
below. **Not done**: an exhaustive Tab-order/focus-ring audit across every
control — see below.

**Failure & Recovery** — closed the projection window directly (bypassing
the UI) while something was live; killed the whole app with `SIGKILL`
(simulating a crash) and relaunched mid-service; corrupted `sermons.db` with
random bytes and relaunched; corrupted `settings.json` with invalid JSON and
relaunched; ran the app with a new dev-only `BORN_OFFLINE` escape hatch
(routes this session's network through a dead proxy — doesn't touch the host
machine) and tested the update check, sermon search, Browse, and the online
hymn-import flow while genuinely offline.

**Stress & Edge Cases** — ~95 queued items (no breakage, scrolled normally);
unusual characters (accented Latin, Japanese, Arabic, curly quotes) in
search — handled cleanly, no crash or mangling; window sizes down to
800×500 — layout held up, nothing clipped or overlapping. **Not done**:
systematic rapid-repeated-click fuzzing, mid-load interruption, or a
300+-item queue (Pass 1 covered ~95-110; genuinely pushing past 300 wasn't
repeated here) — see below.

**Mobile remote as a real phone** — opened the actual remote page in a
390×844 touch-emulated viewport (not just its HTTP API), skipped the role
picker, searched Sermons/Songs and confirmed highlighting renders correctly
there (this closes out F6 — see §4). **Not done**: a literal second
device, true Wi-Fi-loss/sleep simulation, or the reconnect UX after a real
network drop — see below.

**Accuracy spot-check** — 10 Bible references including the two classic
boundary cases (Psalm 119, the Bible's longest chapter at 176 verses;
Revelation 22, the last chapter, verified to end on the correct final verse)
and the shortest single-chapter books (3 John, 2 John, Obadiah, Jude,
Philemon) — all verse counts and spot-checked text matched the real KJV
exactly. 4 songs checked for lyric accuracy and section completeness — see
**F7** below, a real defect found here.

## What could not be tested here, and why

- **Real native drag-and-drop queue reordering.** CDP doesn't reliably
  synthesize the full native HTML5 drag event sequence this app's queue
  list uses; Playwright wasn't available in this environment either. The
  underlying index math (`reorder`, `remapActiveIndexAfterReorder/Remove`)
  already has passing unit tests, which is partial confidence, not the same
  as watching a real drag happen.
- **A full keyboard-only, mouse-never-touches-it pass.** Shortcuts and Esc/
  Enter were spot-checked, not exhaustively walked control-by-control.
- **A literal second phone**, true Wi-Fi loss, or device sleep — the remote
  was driven via CDP against the same machine, not a genuinely separate
  device on the network.
- **300+ queued items** specifically (Pass 1 and this pass both stopped
  around ~95-110) — no reason to expect a cliff, but not directly observed.
- **Rapid-repeated-click fuzzing** and **interrupting a search mid-load** —
  not systematically attempted.
- **Windows, a real second monitor, OBS** — same as Pass 1, out of scope for
  this machine.

---

## 2. Findings

| ID | Severity | Area | Expected vs. actual | Evidence | Status |
|----|----------|------|----------------------|----------|--------|
| F5 | BLOCKER | Queue / projection | Clearing the queue ("New service"), or opening a different saved service, while something is live should leave the congregation screen matching what the operator is told. Instead the operator's status bar said **"Nothing on screen yet"** / **"Screen is hidden"** while the congregation was still looking at the previous, now-irrelevant quote at full size — indefinitely, until the operator happened to notice and manually blank it. | `new-service-stale-projection-before.png` → `new-service-blanked-after.png`, `new-service-honest-status-after.png` | **Fixed**, commit `70fa884` |
| F11 | MAJOR | Saved services | Opening a damaged or empty `.born` file (from the Recent list, or via Open/Import) gave **zero feedback** — no error, no dialog, nothing. Import was worse: one bad file in a multi-file selection silently dropped the *entire* selection, including files that were fine. | `open-service-error-after.png` | **Fixed**, commit `844609f` |
| F8 | MAJOR | Update check | The user-initiated "check for updates" link reported **"You're on the latest version"** when the check had actually failed outright (reproduced genuinely offline) — a confident false positive, not a missing feature. | `update-check-offline-before.png` → `update-check-offline-after.png` | **Fixed**, commit `7d8c124` |
| F7 | MAJOR | Songs | Long songs (verse/chorus split across multiple slides for projector-sized text) get **wrong, colliding verse/chorus labels** on the jump-chip row and slide headers — e.g. "How Great Thou Art" shows two different chips both labeled "Verse 2." The lyric *text* itself is complete and correctly ordered; only the *labels* are wrong, which still risks an operator clicking the wrong chip live. Confirmed on 3 of 4 songs checked (not universal — data-dependent on how the source file was authored). Root cause identified precisely (`src/main/songParsers/proPresenter7.ts:116-133`) but a safe fix would need to touch parser logic shared by all 1,163 bundled songs and wasn't attempted here. | `song-label-bug-how-great-thou-art.png` | **Not fixed** — reported for owner decision, root cause documented |
| F9 | MAJOR | Local database | A corrupted `sermons.db` produces a genuinely **misleading** status message: *"Preparing sermon database — search needs an internet connection the first time"* with a Retry button — even with real internet access, Retry can never succeed, because the actual problem (a damaged local file) has nothing to do with connectivity. No path to self-recovery is offered; the only fix is a human manually deleting the file. | `corrupt-sermons-db-misleading-message.png` | **Not fixed** — reported for owner decision (matches a gap already flagged in the companion ops-readiness audit: no `PRAGMA integrity_check`, no corrupted-file recovery path) |
| F4 | MINOR | Sermons search | *(Pass 1 leftover)* Pressing `/` while a sermon is open in the follow view switched tabs but focused nothing, since the follow view replaces the search box entirely. | `f4-slash-shortcut-after.png` | **Fixed**, commit `b359d57` |
| F6 | — | Mobile remote | *(Pass 1 leftover, re-investigated)* Pass 1 reported the remote never highlights search matches. **This was incorrect** — live-tested in a touch-emulated phone viewport: Sermons, Bible, and Songs search results on the remote all highlight matched terms correctly. The original finding traced to checking the raw JSON API response (which is intentionally plain) without checking what the client-side JS does with it afterward. | `remote-highlight-sermons-works.png`, `remote-highlight-songs-works.png` | **No fix needed** — Pass 1 finding retracted |
| F10 | MINOR / unresolved | Songs — online import | While genuinely offline, "Check online for…" eventually settles on **"No matches found online either"** — indistinguishable from a real "this hymn doesn't exist anywhere" result. The code *does* have a dedicated, well-commented offline-vs-no-results distinction (`src/main/hymnary.ts:97-103`, `cyberHymnal.ts:60-68`, both correctly re-throw on a real network failure) — but one of the two sources (Hymnary.org) is fetched via a separate `BrowserWindow` navigation rather than a plain `fetch()`, and this pass's offline simulation (a dead-proxy session override) may not reliably block that secondary window the same way it blocks everything else. Genuinely uncertain whether this is a real gap in that one path or an artifact of the test method — **recommend verifying with a real network-cable-pull test** rather than trusting this pass's result either way. | `offline-hymnary-ambiguous-no-matches.png` | **Not fixed** — inconclusive, flagged for direct verification |
| — | — | Settings/Outputs/Displays | Text size, display rename, Identify, Test Pattern, Congregation/Stage independent on-off — all worked correctly, including while something was live. | `display-rename-works.png` | No defect |
| — | — | Failure/Recovery | Closing the projection window directly, and a simulated crash-and-relaunch mid-service, both behaved safely: queue and recent-searches state correctly persisted, and the projector correctly came back *closed* rather than silently resuming (the safer default). | `crash-relaunch-recovery.png` | No defect |
| — | — | Failure/Recovery | A corrupted `settings.json` is already handled gracefully — the app falls back to defaults silently and launches normally. Only the *database* corruption path (F9) lacks this. | — | No defect |
| — | — | Offline | Sermon search and Browse both work correctly fully offline (local index) — confirmed no network dependency leaks into these paths. | `offline-sermon-search-works.png` | No defect |

No findings from the keyboard spot-check, unusual-character test, or the
800×500 window-size test — all behaved correctly.

---

## 3. Closing out Pass 1's leftover findings

**F4 (fixed):** the `/` shortcut now also backs out of an open sermon follow
view before focusing the search box, matching what it already did correctly
from every other tab. Verified live: open a sermon via search, switch to
Bible, press `/` — lands on a focused, empty search box instead of doing
nothing.

**F6 (retracted, not a defect):** re-investigated properly this time by
actually loading the remote's page in a touch-emulated browser viewport and
searching, rather than just inspecting the raw API response. Sermons, Bible,
and Songs all correctly highlight matched terms on the remote. Pass 1's
finding was a false positive — noted here so the record is accurate, not
silently dropped.

---

## 4. Ideas (not built), ranked

1. **Give the local database the same corruption-recovery treatment
   `settings.json` already has (F9).** High value (this is the one area in
   this whole pass where the operator is left genuinely stuck with no
   self-service path), medium effort (`PRAGMA integrity_check` on open +
   reseed-from-bundle on failure, plus a correct, specific error message).
2. **Fix the ProPresenter verse/chorus labeling (F7) as its own dedicated
   pass**, not folded into a QA fix — it touches shared parsing logic for
   all 1,163 bundled songs and deserves its own test sweep across a sample
   of the library before shipping, not a one-song patch.
3. **A dedicated keyboard-only accessibility audit.** Not exercised
   exhaustively here; worth a focused pass given how much of a live service
   an experienced operator may want to run hands-on-keyboard.
4. **Real native drag-and-drop verification**, either with Playwright wired
   into this project's dev tooling or by hand on a real machine — this pass
   couldn't exercise it at all.
5. **Resolve F10 definitively** with a real offline test (unplug the
   network cable) rather than a proxy-based simulation, since the two
   methods may not be equivalent for every network code path in this app.

---

## 5. Security-sensitive findings

None in this file, per the audit's instructions. Reported separately in
chat.
