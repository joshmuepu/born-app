# BORN v1 — QA Pass Report

*Version tested: v1.11.0, commit `4917fdd` (the released `main` branch, tip as
of this pass). Testing happened on a new branch `v1-qa-pass` off `main`, in a
separate git worktree, with an isolated userData directory/port/mDNS name —
no real settings, saved services, or church data were touched. This document
has no security-sensitive detail in it; any such finding was reported
separately in chat only, per the audit's own instructions.*

---

## 1. What was tested, and how

Testing was live, against a running instance of the app (not just reading
code or unit tests), driven over the Chrome DevTools Protocol — real clicks,
real typed input, real keyboard events, real screenshots — plus direct HTTP
calls against the mobile remote's own API to verify it actually controls the
app end-to-end, not just that it responds.

**Covered, with live verification:**
- Sermons: Search (phrase/all/any matching, result cards, "+Queue"/"Project"),
  Browse (Date drilldown: year → month → day → sermon → paragraph; also
  checked Recently Played and the general Browse/Search tab switch), the
  whole-sermon follow/read-along view, queueing and projecting from every one
  of those entry points.
- Bible: reference lookup (`John 3:16-18`, verified against the real KJV
  text), keyword search in Phrase / All words modes (verified exact result
  sets against the real text), per-verse Queue/Project.
- Songs: search (title match and lyric match with "Matched in lyrics —
  Verse N"), song detail/slide view with real lyrics.
- Projection window, Stage monitor window — both opened and screenshotted
  live, confirmed to only ever render plain text (no highlighting mechanism
  of any kind reaches either).
- Mobile/web remote: fetched its real HTTP API (`/state`, `/command`) and
  confirmed a command sent to it actually changes what's on screen and what
  the operator sees — not just that the server responds.
- Blank/Hide/Show screen, via both the on-screen button and the `Esc`
  keyboard shortcut, in both directions.
- The Shortcuts modal (visual check of every listed shortcut).
- Queue persistence across a full app restart (queue, recent searches, and
  "On This Day" state all correctly restored; the projector correctly came
  back **closed** rather than silently resuming live — the safer default).
- Queue list rendering at ~95 items (queued via the remote API) — no visible
  breakage, scrolled normally.
- The sermon-highlighting investigation (§3 below) — the most thorough single
  piece of this pass.

**Could NOT be tested here, and the report doesn't claim otherwise:**
- Windows-specific behavior of any kind — this is a macOS dev machine; v1 has
  no Windows-only code paths that this pass could exercise.
- A real second physical monitor, a real phone browser for the remote (the
  remote was verified via its HTTP API and `curl`, not a literal phone), or
  OBS/graphics output.
- True offline/network-down behavior — simulating this safely without
  affecting other work on this machine wasn't attempted.
- Native drag-and-drop queue reordering as a literal mouse gesture (CDP
  doesn't simulate HTML5 DnD cleanly) — the underlying index math
  (`reorder`, `remapActiveIndexAfterReorder/Remove`) already has its own
  passing unit tests, which is partial confidence, not the same as watching
  a real drag happen.
- A full keyboard-only pass (Tab order across every control, visible focus
  ring everywhere) — only spot-checked, not exhaustively audited.
- Closing the projection window *while something is actively live*, a
  corrupted/missing local data file, rapid-repeated-click fuzzing, or an
  interrupted mid-load scenario.
- Every single button in the app — Sermons/Bible/Songs and the core queue
  flow got sustained attention; Settings/Outputs/display-naming screens were
  not separately walked.

---

## 2. Findings

| ID | Severity | Area | What happened vs. expected | Evidence | Status |
|----|----------|------|------------------------------|----------|--------|
| F1 | MAJOR | Sermons / operator follow view | A search term stayed highlighted (and the misleading "still searching '…'" badge stayed visible) in a **completely unrelated** sermon opened afterward via Browse or the queue — the operator's own named complaint. Never reached the congregation screen, Stage, or remote. | `sermon-highlight-before-unrelated-sermon.png` → `sermon-highlight-after-unrelated-sermon.png` | **Fixed**, commit `d015966` |
| F2 | MAJOR | Sermons / operator follow view & Browse | Projecting a sermon's **header** slide (no specific paragraph) caused **hundreds** of unrelated paragraphs — and, separately, every page of any paginated paragraph — to be marked "On screen" at once, in both the follow view and Browse. Never reached the congregation screen, Stage, or remote. | `onscreen-marker-before-mass-overlap.png` → `onscreen-marker-after-header.png`, `onscreen-marker-after-browsepanel.png` | **Fixed**, commit `bae5ccf` |
| F3 | MAJOR | Operator header bar | The "Hide/Show screen" button never actually turned amber while the screen was hidden — a CSS specificity bug (`.btn-toggle-on` and `.btn-secondary` both one-class-specific; the later rule silently won). The label text still correctly changed ("Hide screen" ↔ "Show screen"), so this wasn't a silent failure, but the strong visual cue was missing. | `amber-button-before.png` → `amber-button-after.png` | **Fixed**, commit `e9671b7` |
| F4 | MINOR | Sermons search | Pressing `/` (jump to search box) while a sermon is currently open in the follow view switches to the Sermons→Search tab but focuses nothing, since there's no search box visible until the operator backs out of the sermon. No error, just no visible effect. | — | Not fixed — narrow edge case, reported for owner decision |
| F5 | IDEA (perf) | BrowsePanel / ResultsList / SermonFollowView | Previously-viewed sermons and previous search results stay fully mounted in the DOM (just hidden), rather than unmounting, across an entire session. Not visible to an operator at normal scale; over a long service with lots of browsing, this grows unbounded. | — | Not fixed — reported as an idea, not a defect |
| F6 | MINOR | Mobile remote | The remote's own search results (sermons/Bible/songs) never highlight the matched term, unlike every equivalent view on the desktop app. Inconsistent, not incorrect. | — | Not fixed — cosmetic |

No BLOCKER-severity findings — nothing observed could lose data or take down
a live service outright, though F2 in particular was a serious, confusing
defect in what the operator sees about their own service.

---

## 3. Sermon-highlighting investigation — full result

The owner's report: paragraphs get highlighted when projecting sermons,
unclear where. Investigated by projecting sermon paragraphs via every entry
point named in the brief (search results, Browse, the queue, with and
without an active search term, with a paginated paragraph, using Next/
Previous, and via the remote's own command API) and screenshotting every
surface (operator panels, the projection window, the Stage monitor, and the
remote's HTTP state) after each.

**Every highlight type found, classified:**

1. **Search-term `<mark>` highlighting in the Sermons/Bible/Songs result
   lists.** INTENDED — shows why a result matched. Confirmed query-synced to
   each panel's own live search box in every case; never stale.
2. **Search-term highlighting in the sermon follow/read-along view
   (SermonFollowView).** INTENDED in concept (lets the operator see the
   searched word in context while picking a paragraph) but **UNINTENDED in
   implementation** — it used whatever was in the search box at the time,
   regardless of how the currently-open sermon actually got opened. This is
   **F1** above. Root cause: `App.tsx` passed the live `searchQuery`/
   `searchResults[0]?.matchType` into the follow view unconditionally.
   **Fixed** by attaching the query/matchType to the follow-session state
   itself, set only by handlers that genuinely come from a search, and
   cleared when a different sermon is opened from Browse or the queue —
   while still correctly preserving the highlight when paging within the
   *same* sermon via "Restart here". Regression-tested
   (`followSermon.test.ts`).
3. **"Current paragraph" / "On screen" marking** in both the follow view and
   Browse's own paragraph lists. INTENDED (shows the operator what's live
   right now) but **UNINTENDED spillover** — this is **F2** above, two
   compounding root causes:
   - `App.tsx`'s computation of "what's on screen" mis-parsed a header
     slide's reference string (no paragraph segment at all) and fell back to
     using the sermon's *date code* as if it were a paragraph number, which
     then numerically overlapped nearly the whole sermon.
   - Separately, both list views compare the live paragraph using a
     range-overlap function that strips page-letter suffixes (`1a`, `1b`,
     …), so every page of one long, paginated paragraph was marked live
     together.
   **Fixed** in both files; regression-tested (`SermonFollowView.test.tsx`,
   two cases: the header-overlap bug and the paginated-page bug).
4. **Merged-range quotes** (e.g. "173-174"-style rows) — checked
   specifically. These split correctly into one card per real paragraph
   number via the same `quoteToItem`/`splitSubParagraphs` logic used
   everywhere else in the app; no additional spillover beyond what's
   described in #3 above (which the fix also corrects for these rows, since
   it's the same code path).
5. **Hover/focus/selection styles.** Present (a `follow-para--focus` class
   for the paragraph the operator scrolled to without it being live) and
   behaved as expected — distinct visual treatment from "on screen", no
   confusion observed between the two once #3 was fixed.
6. **Stale highlight after blank/clear or switching content.** Not
   independently reproduced as a *separate* bug — the state in #2 and #3 is
   what was actually stale; once both are fixed, blanking/switching behaves
   correctly because the underlying source data (the live reference) is
   correct.
7. **The projection window and the Stage monitor.** Confirmed clean on every
   single test across this whole investigation — both render slide text as a
   plain React child with no `dangerouslySetInnerHTML` anywhere in either
   file, so a stray `<mark>`-wrapped string couldn't render as markup there
   even if one reached that layer. **The congregation never saw any of
   this**, at any point.
8. **The mobile remote.** Confirmed clean — its own server-rendered HTML uses
   a separate, simpler `<mark>` helper, applied only to the remote's own
   live search-box state, never to anything "on screen"/live. No overlap
   with the desktop bugs.

**Is this fully resolved?** Yes, for everything reproduced. Both root causes
are fixed, verified live (before/after screenshots above) and
regression-tested. If the owner saw something that doesn't match this
description, it wasn't reproduced here and would need a more specific
repro (which sermon, which screen, what was clicked beforehand) to chase
further.

**Idea, not a defect:** once F1/F2 are fixed, the remaining intended
highlighting (search-term in results, "On screen"/focus marking) reads
clearly in testing. No further UX change recommended here.

---

## 4. Feature and improvement ideas (not built)

Ranked by rough value-to-operators vs. effort; each is a one-line reason,
not a spec.

1. **Unmount stale Browse/search state instead of hiding it (F5).**
   Medium value (a long service session currently accumulates unbounded
   hidden DOM), medium effort (would touch the tab-switch logic in three
   components) — worth doing before leaning on long, heavy browsing
   sessions.
2. **Make `/` recoverable from inside an open follow view (F4).** Low
   effort, low-but-real value — currently a silent no-op for one specific
   keyboard path.
3. **Bring remote search-result highlighting to parity with desktop (F6).**
   Low effort, low value — a minor cross-surface consistency gap, not a
   correctness issue.
4. **A full keyboard-only operation audit.** Not exercised exhaustively in
   this pass; worth a dedicated pass given how much of a live service an
   experienced operator may want to run hands-on-keyboard.
5. **Queue list virtualization.** No problem observed at ~95 items; only
   worth doing if real usage routinely reaches the hundreds (e.g. an
   all-day multi-service event run from one saved queue).

---

## 5. Findings that likely also apply to v2-channels

**Not verified directly — v2-channels was not touched, per this task's own
setup rules — but flagged because the affected files
(`App.tsx`, `SermonFollowView.tsx`, `BrowsePanel.tsx`) are core
sermon-browsing code that predates the v2 multi-channel work and doesn't
appear related to it:**

- **F1 and F2** (the sermon-highlighting and on-screen-marker bugs) are very
  likely present in v2-channels too, since the same `onScreenLoc`
  computation, the same `SermonFollowView`/`BrowsePanel` on-screen matching,
  and the same `refsOverlap` helper are shared ancestry, not something the
  channels work would have had reason to touch. **Recommend porting both
  fixes to v2-channels** (commits `d015966` and `bae5ccf` on this branch) —
  they're small, self-contained, and each has a regression test that can
  port with them.
- **F3** (the amber button) does **not** need porting — v2-channels already
  fixed this exact CSS bug independently (confirmed from this session's own
  earlier work on that branch).
- **F4, F5, F6** are minor/cosmetic and lower priority to port, but the same
  reasoning applies if v2-channels shares the same code paths.

---

## 6. Security-sensitive findings

None in this file, per the audit's instructions. Reported separately in
chat.
