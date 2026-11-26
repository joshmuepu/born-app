# v1-mobile-fixes: the phone remote

Branch `v1-mobile-fixes`, cut from `main` at 1.13.11, with the review branch `v1-mobile-review` merged in first (its report, scripts and
evidence only). Not merged, not tagged, not released; the version and the changelog are unchanged. The review's findings are in
`docs/qa/v1-mobile-review/report.md`.

Each item is one commit and can be dropped on its own.

| Item | Commit | What changed |
|---|---|---|
| 0. Public files | `6b96022` | Removed every mention of another product line, its branch and developer folders; a repo test now guards it |
| 1. MR-01 | `5c89e6c` | A verse tapped on a queue item's page ends on the live view |
| 3. MR-03 | `70558c2` | A paragraph tapped on a sermon's page ends on the live view |
| 2. MR-02 | `0ca682c` | A tap that worked is not reported as failed; a retry or a quick second tap never skips a page |

## Item 0: public files name nothing outside this product

**Cause.** The header comment of `scripts/qa/lib.cjs` named the other product line. A search of every tracked file found more of the same
in code comments, two test names, a script header and several QA notes.

**What changed.**

- **Code and scripts.** Comments reworded:
  - `scripts/qa/lib.cjs` and `scripts/docs-screenshots.mjs`: where they were adapted from.
  - `src/renderer/src/App.css`: the Help viewer heading.
  - `src/renderer/src/components/HelpViewer.tsx` and `src/main/manual.ts`: they gave the wrong manual folder, now `docs/manual/v1`.
- **Tests.** Two test names reworded:
  - `src/test/main/updateCheck.test.ts`: "across a major version";
  - `src/test/main/sermonDbUpgrade.test.ts`: "format 3".
- **`CLAUDE.md`.** "Never touch [the other line's branch]" now reads: work only on `main` and branches cut from it, never any other
  long-lived branch.
- **`docs/VERSIONING.md`.** Rewritten to describe this line only. It keeps the version numbers, the app identity, the same-major update
  check and the `v1.x.x` tag guard. The release workflow still links to it.
- **QA notes removed.** `docs/qa/v1-hardening/00-candidates.md` and `08-v2-parity.md` were only about the other line. They stay in git
  history.
- **QA notes reworded.** Single lines or sections in:
  - `docs/qa/v1-hardening/README.md`, `01-classification.md`, `02-fixes.md`, `03-fresh-hunt.md`, `05-needs-owner-decision.md`,
    `06-verification.md`;
  - `docs/qa/v1-qa-report.md` (section 5, about porting, removed);
  - `docs/qa/v1-ui-audit-report.md` (the two "port" sections removed);
  - `docs/qa/remote-connectivity-report.md` and `docs/qa/v1-e2e-report.md`.
- **New test.** `src/test/repo/publicWords.test.ts` reads every tracked text file and fails on another major line's name, its branch,
  its product name or a developer folder. Its words are built from parts, so the test does not name them itself.

**Readings taken.**
- `README.md`'s "License: MIT" line is the code's own open-source notice, not licensing in the sense of the rule, so it stays.
- So does `--agree-to-license` in the release workflow, a command-line flag of Apple's installer.
- Song fixtures that name verses "v2", and the `@v2` version pin of a GitHub action, are not mentions; the test allows them.
- "BORN again" in a message ("open BORN again") is not the name; the test matches that name in its own capitals only.
- **Not changeable:** 19 old commit messages on `main` mention the other line. Rewriting published history would need a force push, which
  is never done.

**Evidence.** The repo test passes on this branch. It failed on the first full run, against its own comment, which was then reworded.

## Item 1 (MR-01): a song started from its queue row shows the live view

**Cause.** The queue item's full page (`queueDetailInnerHtml` in `src/main/remoteAssets.ts`) drew its verse rows and its **Project** button
as `cmd('project-at', …)` / `cmd('project', …)` with nothing after them. Every other way of projecting runs `afterProjectFromSheet` once
the tap is answered: close the page, then show the Queue tab when the new state is in. On a wide screen the full item stayed in the right
pane because nothing cleared `state.detailIndex`.

**What changed.**
- The verse rows and the Project button now call `projectQueueItem(id, slide)`. It sends the same command, then runs the same
  `afterProjectFromSheet` that Songs, Bible and Sermons use.
- `afterProjectFromSheet` now also lets go of the open queue item, so the right pane on a wide screen shows the live view again.
- The Project path in `sheetAction` had its own copy of those steps. It now calls `afterProjectFromSheet` too, so there is one copy.
- A tap that does not go through leaves the page open; the phone has already said why.

**Evidence.**
- **Unit tests:** `src/test/main/phoneAfterProject.test.ts`, which runs the page's own script with its real body against a faked computer
  (`src/test/main/phonePage.ts`).
  - Phone and wide screen, each with nothing live, another song live, the same song live, and a Bible verse live; plus verse 25 of a
    30-verse song.
  - All end with the page closed, the Queue tab showing, and the live text in the live view.
  - 9 of those 9 fail on the old code. A further check that a failed tap leaves the page open passes on both.
- **Real app:** `docs/qa/v1-mobile-review/scripts/repro-project-song.cjs`, real taps in Chromium and WebKit, at 390x844 and 768x1024,
  for Operator, Song Leader and Preacher. Ways in: song search with Project, song search with a verse, Recently played, and a queue row
  with a verse.
  - **144 checks, 0 failed.** The review's run had 18 failures, all of them this bug.
  - `evidence/repro-project-song.json`.
- **Real app, service conditions:** `repro-conditions.cjs`. From the queue row, it now ends on the live view with nothing live, the same
  song live, another song live, a Bible verse live, a very long song, a key just changed, a second phone, a slow network, and a page that
  was asleep. `evidence/repro-conditions.json`.

## Item 2 (MR-02): a tap that worked is not reported as failed, and a retry never skips a page

**Cause.**
- The phone gave up on a tap after 4 s and said *"Couldn't reach BORN"* without asking whether BORN had acted on it.
- A Next or Back carried no sense of where it was tapped, so tapping again after that message moved the screen a second page.

**What changed.** The change is kept small; the protocol is private to the phone page and the app, which ship together.
- **Each tap carries an id** (`tap`). `/state` now also lists the ids of the latest 20 taps acted on (`taps`). A tap id sent twice is acted
  on once.
- **When a tap's answer is late or lost,** the phone first reads `/state` (at most 2.5 s more).
  - If BORN acted on the tap, it counts as done, and the phone shows what is live.
  - If not, it says *"Couldn't reach BORN"*: Connected when BORN answered, Reconnecting when it did not.
  - Save is left out of this, because its answer carries the result.
- **Next and Back also carry `at`,** the place on screen the phone was showing (`pos`, now in `/state`).
  - BORN acts on them only from that place, and once per place and direction within 1.5 s.
  - Otherwise it answers `409` with where the screen really is. The phone then reads `/state` and shows it, with no error message.
  - After a Next or Back that worked, the phone reads `/state` 150 ms later, so a deliberate next tap starts from the new place.
- **Calls without `tap` or `at` work exactly as before.**
- **Files:** `src/main/webRemote.ts` (`livePosition`, `stateForPhone`, the checks in `/command`) and `src/main/remoteAssets.ts` (`cmd`,
  `poll(ms)`).
- **Two existing tests updated because the behavior changed on purpose:**
  - `phoneTruth.test.ts`: a tap with no answer now settles after the 4 s wait plus the state check;
  - `phoneRemoveUndo.test.ts`: the remove command now also carries a tap id.

**One visible change.** Two taps on Next in quick succession (before the phone has heard the screen move, about 150 ms) now move one
page, not two. That is what this item asked for. A tap made after that moves one more page, as before (checked).

**Evidence.**
- **Phone-side unit tests:** `src/test/main/phoneTapTruth.test.ts`, the page's own script against a faked computer.
  - A Next whose answer never comes but which BORN acted on: no error message, Connected, and the live view shows the new page.
  - One that never reached BORN: says so, and stays Connected.
  - BORN unreachable: says so, and shows Reconnecting.
  - An answer arriving after the phone gave up: one outcome only, no second command, no error.
  - Next and Back carry `at` and a fresh tap id; other taps carry no `at`.
  - A `409` answer shows the real page with no error.
- **Computer-side unit tests:** `src/test/main/remoteTapPosition.test.ts`, the real HTTP server with a faked operator window.
  - `/state` has `pos` and `taps`, and `pos` differs per page but not when the screen is hidden.
  - Next from the current place is acted on; two simultaneous Nexts from one place move one page.
  - A Next from a place the screen has left gets `409` with the real place.
  - A retry from the true place moves exactly one more page.
  - Back right after Next still works.
  - Calls without fields are acted on every time; the same tap id twice is acted on once.
- **On the old code:** 10 of the 16 new tests fail; the other 6 describe behavior that was already right.
- **Real app,** `repro-conditions.cjs` in Chromium and WebKit (`evidence/repro-conditions.json`, `evidence/repro-conditions-lost.json`):

  | Case (every answer to a tap delayed 5.5 s, past the phone's 4 s) | Chromium | WebKit |
  |---|---|---|
  | Next: the screen moves one page, the phone shows it, no "Couldn't reach" | verse 1 → 2 | verse 1 → 2 |
  | Next again: exactly one page from the true place | verse 3 | verse 3 |
  | Two quick taps | verse 3 → 4 | verse 3 → 4 |
  | Normal network, two quick taps, then one a second later | 4 → 5, then 6 | 4 → 5, then 6 |
  | Project from Songs or from a queue row, answer late: live view, no false failure | passed | passed |
  | A tap that never reaches BORN, no answer ever: says "Couldn't reach BORN", stays Connected, nothing goes live | passed | passed |
  | Network off at the tap: nothing goes live later, the phone says so | passed | passed |

- **Review's resilience check:** its "late answer" case now passes in both engines (`evidence/resilience-*.json`).

## Item 3 (MR-03): a paragraph tapped on a sermon's page

**Cause.** `projectSermonParagraph` (the paragraph rows of a sermon's full page, opened from **Series** or **Date**) sent
`cmd('project-sermon', …)` and nothing else.

**What changed.**
- It now runs the same `afterProjectFromSheet` after the answer, so the page closes and the live view shows the paragraph.
- Full pages with this fault, now all on the shared step: the queue item's page (verse rows and its Project button, item 1) and a sermon's
  page (item 3).
- Already on it: the song, Bible chapter and sermon result pages (Project and their verse rows).

**Evidence.**
- **Unit test:** `phoneAfterProject.test.ts`, "a paragraph tapped on a sermon's full page", phone and wide screen, with invented words.
  Fails on the old code, passes now.
- **Real app:** `flows.cjs`, "project: after that tap the phone moves to the live view", now passes in Chromium and WebKit
  (`evidence/flows-*.json`). The review's run failed it.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite, with its native rebuild) | 142 files, 1142 tests: 1141 passed, 1 failed. The failure was the new word test catching its own comment; reworded, it passes. The phone, remote and word tests rerun at the final commit: 131 of 131. |
| Review checks, `repro-project-song.cjs` | 144 checks, 0 failed |
| Review checks, `repro-conditions.cjs` | 110 checks, 4 failed in the first run: the new "lost tap" case was given too little time to see the message. Rerun with enough time: 18 of 18 passed. |
| Review checks, `flows.cjs` | Chromium 62 checks, 8 failed; WebKit 62, 10 failed. Every failure is another review finding left out of this round (listed below). |
| Review checks, `resilience.cjs` | Chromium 19 checks, 3 failed; WebKit 18, 3 failed. Every failure is another review finding (MR-05, MR-08, MR-09). |
| Existing phone checks | `remote-probe` 23/23, `remote-reconnect` 8/8, `phone-data-safety` 49/49, `phone-recent-songs` 27/27, `flows` 8/8 |
| Existing projector checks | `output-probe` 6/6, `slide-fit` 15/15, `stage-room` 43/43, `font-late` 10/10 |

All checks ran on isolated profiles with test ports 14316/9376 and 14336/9396. The congregation and stage screens were kept hidden for
these sweeps (hundreds of phone runs). Nothing was streamed and no release workflow was started.

`npm test` reports exit 0 even with a failing test, because its last step (`rebuild:native`) runs after vitest. The counts above are read
from its output.

## Noticed, not changed

Every other review finding, left for a later round:

- **MR-04:** BORN answers "OK" to commands it could not act on. The phone says *"Loaded"* for a saved service that could not be opened.
- **MR-05:** while the phone cannot reach BORN, the live card still reads ON SCREEN at full strength.
- **MR-06:** a song projected from Songs is not a queue row, so its live card cannot be opened to jump to another verse.
- **MR-07:** the open Full Queue list is not refreshed and goes on marking the old live item.
- **MR-08:** turning a phone on its side with a full page open covers Next.
- **MR-09:** the phone's back button leaves the page instead of closing the open page.
- **MR-10:** a fast double tap on **+ Queue** can add the item twice.
- **MR-11:** a key change does not update the copies of the song already in the queue.
- **MR-12:** after New service, one tap on Show screen puts the old service's last page back up.
- **MR-13:** several controls are under 44 px, including the Close (X) of every page.
- **MR-14:** the live card in the queue strip is marked only by a green outline.
- **MR-15:** Back, Next and Hide screen sit at the top of the screen, out of easy thumb reach. A layout decision, not a repair.
- **MR-16:** half-typed Bible or sermon search text is lost on a tab change.
- **MR-17:** right after a switch the Queue tab can show the old item for up to a second (WebKit).
- **MR-18:** two 12 px labels are under 4.5:1 contrast.
- **MR-19:** a Remove still inside its 5 s Undo time is never sent if the page closes.

Also noticed:

- `npm test` hides a failing suite from its exit code (above).
- The phone's own Help text about "Couldn't reach BORN" is now more accurate than before, and needed no change.

## For the owner, on a real phone

1. Start a song from its queue row (tap the song, then a verse), with the phone upright and then on its side. The live view comes back,
   and Next, Back and Hide screen work.
2. On weak Wi-Fi, tap a verse and Next a few times. There is no "Couldn't reach BORN" for taps that worked, and no page is skipped.
3. Open a sermon from Series or Date and tap a paragraph. The page closes and the live view shows it.
4. Lock the phone for a minute during a live song, then unlock. It shows the page that is really on screen.
