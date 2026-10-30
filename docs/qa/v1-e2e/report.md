# BORN v1 end-to-end hardening round: report

Round `v1-e2e-hardening`, 2026-10-30. A work branch for the owner to review: nothing merged, tagged, version-bumped or released.

- **Branch:** `v1-e2e-hardening`
- **Based on:** `295b907`, the head of `v1-sermon-fixes` (library format 3). That branch is not merged yet, so this one includes it.
- **Version:** unchanged at 1.13.3.
- **Identity:** unchanged (appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316).
- **Icon hashes:** unchanged (png `a9dd996d`, icns `805174be`, ico `4f3e98c7`).
- **Workflows:** no workflow file added or changed on this branch.

## How it was tested

Every live run used a throwaway profile (`BORN_USER_DATA_DIR` in a temp folder), remote port 14316, network name `born-remote-v1-e2e` and debugger port 9376. The projection and stage windows were real but kept hidden. Phones and tablets were the real remote page loaded in WebKit (iOS Safari's engine) and Chromium.

What v1 has, and how each part was tested, is in [inventory.md](inventory.md): 6 windows, 13 dialogs, 11 settings, 95 main-process channels, 21 remote routes and 22 remote commands.

**Not tested here, and why:**
- **Real projectors, a real unplug/replug, a display scaling change.** Three real screens were attached, but cables cannot be pulled from a script. The unplug logic has a unit test; the rest is on the owner's checklist.
- **Real phones on real Wi-Fi, and mDNS from a phone.** Browsers on this Mac stand in for phones. Owner's checklist.
- **Print to PDF and the system file dialogs.** Native dialogs cannot be driven. Code read only.
- **Songs > Check online.** It needs the outside song site; code read only.
- **Installing over an older version on Windows.** The Windows run builds and starts the app but does not upgrade an install. Owner's checklist.
- **The update download itself.** No newer release exists, so only "up to date" was seen live; the download path is covered by unit tests.

## Findings

Severity: **P0** stops a service, **P1** wrong thing on the projected screen or lost data, **P2** clearly broken but has a workaround, **P3** cosmetic.

How found: **R** code review, **L** live drive, **V** phone/tablet viewport sweep, **S** soak, **T** text-fit measurement.

| ID | Sev | Area | What happened | How found | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|
| E2E-01 | P1 | Keyboard | Shift+Esc (the panic key) did nothing while the Keyboard shortcuts list or the Message dialog was open | R, L | `612e8ef` | `panicKeyDialogs.test.tsx` | Fixed |
| E2E-02 | P2 | Keyboard | Typing `?` into a search box opened the shortcuts list | L | `fddd35e` | `questionMarkTyping.test.tsx` | Fixed |
| E2E-03 | P2 | Keyboard | B "hid" the screen with no projection open, so the next Open projection came up black | R | `bf97266` | `bKeyNeedsProjection.test.tsx` | Fixed |
| E2E-04 | P1 | Data | settings.json, queue.json and saved services were written in place: a crash or full disk mid-write lost the whole file | R | `e7f9200` | `savesWholeOrNotAtAll.test.ts` | Fixed |
| E2E-05 | P1 | Start-up | First start on a nearly full disk: the half-copied library threw before the window was made, leaving no window | R, L | `5aeedac` | `seedFullDisk.test.ts` | Fixed |
| E2E-06 | P1 | Search | Refresh sermons with no internet deleted the book chapters from search; an indexing error left it "running" for good | R | `d2ea332` | `indexerOfflineRefresh.test.ts` | Fixed |
| E2E-07 | P1 | Phone | On a 320–340 px phone at 150% text the Hide screen button was pushed off the right edge | V | `f3fc913` | `remoteSmallScreens.test.ts` | Fixed |
| E2E-08 | P2 | Phone | On a phone held sideways the Songs list was 15 px tall | V | `a7793b0` | `remoteSmallScreens.test.ts` | Fixed |
| E2E-09 | P2 | Phone | First open: the Add to Home Screen sheet covered the "Who's this?" buttons | V | `adb0d05` | `remoteFirstRunSheets.test.ts` | Fixed |
| E2E-10 | P3 | Phone | Notched iPhone held sideways: content under the notch | V | `20be298` | `remoteSmallScreens.test.ts` | Fixed |
| E2E-11 | P2 | Phone | Book chips, song rows, list items and skip buttons under 44 px (some 28 px) | V | `9585a77` | `remoteSmallScreens.test.ts` | Fixed |
| E2E-12 | P2 | Names | Phone said Blank / Restore, Prev and Add to Queue; desktop and Help say Hide screen / Show screen, Back and + Queue | R | `7ea6031` | `remoteNames.test.ts` | Fixed |
| E2E-13 | P3 | Names | "Main screen" in two places; everywhere else it is the Congregation screen | R | `9a568c0` | `screenNames.test.tsx` | Fixed |
| E2E-14 | P2 | Names | The in-app shortcuts list and the Help page listed different keys | R | `7b5e5b2` | `shortcutsListsMatch.test.ts` | Fixed |
| E2E-15 | P2 | Help | Help pages had sentences that no longer matched the app (internet needed at first start, a Help menu, button names, where things are) | R, L | `4107d0c` | `manualMatchesApp.test.ts` | Fixed |
| E2E-16 | P1 | Projection | Next/Back could project a paragraph from the other language's copy of the same sermon | R | `86ab43f` | `liveNavLanguage.test.ts` | Fixed |
| E2E-17 | P1 | Windows | Closing the operator window while projecting left the projection and stage up with nothing to control them; on Windows the app never quit, on macOS the Dock icon did not bring the window back | R, L | `0cbb989` | live: `scripts/qa/close-operator-window.cjs` (window lifecycle has no unit harness) | Fixed |
| E2E-18 | P1 | Remote | The phone's Open saved / Import saved would open any path it was sent, not only the files it is shown | R | `3ea5efa` | `remoteServicePath.test.ts` | Fixed |
| E2E-19 | P1 | Remote | Any web page open in a browser on the same network could send commands (a form post needs no permission) | R | `8348a36` | `remoteHttp.test.ts` | Fixed |
| E2E-20 | P1 | Projection | Each new slide drew for a frame at the old slide's size, then jumped; a size change made while hidden was not applied on Show screen | R, L | `9de43fb` | `autoFitTiming.test.tsx` | Fixed |
| E2E-21 | P1 | Stage | Stage monitor cut off long slides (35 of 130 measurements) | T | `920d00d` | `stageFit.test.tsx` | Fixed |
| E2E-22 | P2 | Data | A failed service save said nothing; a phone save named CON or NUL was lost on Windows | R | `03932cf` | `saveFailure.test.tsx`, `remoteServicePath.test.ts` | Fixed |
| E2E-23 | P2 | Network | Online sermon calls had no time limit; a network that never answers hung Refresh for minutes | R | `64096b5` | `tableTimeout.test.ts` | Fixed |
| E2E-24 | P2 | Browse | Clicking two sermons quickly could show the first one's paragraphs under the second's title | R | `bc0b450` | `browseStaleParagraphs.test.tsx` | Fixed |
| E2E-25 | P1 | Projection | Two Project clicks while the projection window was opening: the older item could end up on screen | R | `569c4aa` | `projectWhileOpening.test.tsx` | Fixed |
| E2E-26 | P1 | Displays | Projector unplugged mid-service: the full-screen projection jumped onto the operator's own screen and covered it | R | `94e0625` | `projectorUnplugged.test.ts` | Fixed |
| E2E-27 | P1 | Start-up | A settings.json holding the wrong kind of value (e.g. a text where a number belongs) stopped the window from appearing | L | `670e866` | `settings.test.ts` | Fixed |
| E2E-28 | P3 | Names | Output windows titled "Projection" / "Stage"; Help and the Screens panel call them Congregation screen / Stage monitor | R | `28d938f` | `outputWindowTitles.test.ts` | Fixed |
| E2E-29 | P3 | Names | Update banner's download button had two names | R | `c41dcb1` | `updateButtonName.test.ts` | Fixed |
| E2E-30 | P1 | Help | Four Help pictures showed real sermon text; all showed v1.12; the Remote picture showed an error | L | `c8de9b5` | `scripts/qa/manual-screenshots.cjs` (retakes them) | Fixed, see below |
| E2E-31 | P2 | Phone | Small phone held upright at 150% text: Songs tab off the right edge (it got the sideways layout); Go 37 px tall on a sideways phone | V (final sweep) | `238370f` | `remoteSmallScreens.test.ts` | Fixed |

QA scripts used here and kept for later rounds: `7749da1` (scripts only, never shipped).

**The sermon text in the old Help pictures.** It was first committed in `44c8199` (2026-10-09: search results, Screens panel, Remote panel) and `79bdafb` (2026-10-14: song import review, plus new copies of the other three). The current pictures are clean, but the old ones stay in the public git history. Removing them means rewriting history and force-pushing `main`, which this round may not do. **Owner decision.**

## Judgement calls

- **Base branch.** The round started from `v1-sermon-fixes` (`295b907`, library format 3), not `main`, because that work is what ships next. Merge `v1-sermon-fixes` first, or merge this branch alone: it already contains it.
- **E2E-19 (web pages sending commands).** The fix refuses any `/command` whose body is not sent as JSON. A browser cannot send JSON across sites without asking the remote's permission first, and the remote never grants it. The phone page already sends JSON, so nothing changes for it. A PIN would be stronger, but it is a feature (owner decision, below).
- **E2E-18.** The phone may open a file only if it is in the Recent list or the phone save folder. These are exactly the files the phone lists.
- **E2E-27.** Each settings value is kept only when it has the right kind and range; the rest fall back to defaults. Unknown keys are kept, so a file written by a newer v1 survives a round trip.
- **E2E-21.** Stage text now shrinks to fit, like the projector. Its starting size still does not follow Projected text size (it never did). The Help page was corrected rather than changing behaviour.
- **E2E-17** has no unit test because window lifecycle cannot be built in jsdom. The committed live script shows the failure before the fix and the pass after.
- **The three `remote-*.png` Help pictures** (Remote connection check, network list) were left as they are. They show invented test networks only, no sermon text. Two are over 300 KB (475 KB and 323 KB), but they were committed before this round.

## Suggestions, not built

These are new behaviour or design choices, so they are not built in a hardening round.

1. **Remote PIN** (and dropping `Access-Control-Allow-Origin: *`). Anyone on the church Wi-Fi with the address can still drive the screen. Recommended for the next minor release, opt-in.
2. **Phone save result.** The phone always shows "Saved", because the command channel has no way to answer. Needs a reply path.
3. **One update check at start.** Two run a few seconds apart; harmless, wasteful.
4. **Wording still to align:**
   - Restart vs Restart here;
   - the phone's "Recent";
   - Service Queue capitalisation;
   - "confidence monitor" in comments and the glossary;
   - HIDDEN vs HIDDEN FROM SCREEN;
   - lowercase update links;
   - the Linux AppImage line in Help.
5. **Small labels on the phone** (9–10.5 px tab labels and tags). Consider 11 px or more.
6. **Dead code** found by `tsc --noUnusedLocals`: `projectionReady`/`stageReady`, `SongMatchResult`, `loadServiceItems`, `ParsedSongSlide`. Remove in a tidy-up round.

## Gate results

Each run once on the final code. A check was run again only when code it covers changed after its first run.

| Gate | Result |
|---|---|
| Typecheck (`npm run typecheck`, main and renderer) | Clean. Run again after `238370f`: clean |
| Lint | The repo has no linter. A one-off `tsc --noUnusedLocals` found only dead code (Suggestions, item 5) |
| Unit tests (`vitest run`) | **896 passed, 0 failed, 98 files** (821 before this round) |
| Build (`npm run build`) | OK |
| QA probes, dev build | layout 19/0, output 6/0, remote 23/0, remote-reconnect 8/0, input 24/0, flows 8/0, sweep 0 findings, esc-matrix 74/0, verify-libraries 6/0, close-operator-window passes |
| Phone/tablet sweep | 336 screens; see (C) |
| macOS package (`npm run dist:mac -- --publish never`) | arm64 DMG 215.0 MB, x64 DMG 219.6 MB, unsigned, not published |
| macOS packaged smoke (`scripts/qa/smoke-macos-packaged.cjs`, arm64) | **11/11**: libraries bundled and seeded, bundle id / name / version v1, icon 805174be, window, remote, frame protection, sermon/song/Bible answers, clean log |
| Packaged reload guard (`scripts/qa/reload-guard.cjs`) | **16/16** (⌘/Ctrl+R blocked in the installed app; the presentation keys never are) |
| Packaged start with a v1.13.3-format profile | Old library backed up (`sermons.db.sections-<date>.bak`), moved to format 3 (224,938 rows with the fetched one), fetched sermon kept, 3 starts, 0 page errors, 0 leftover processes |
| Library format | Bundled `sermons.db.gz`: user_version **3**, 1,218 sermons, 224,937 paragraph rows |
| Identity | `com.joshmuepu.born`, "Branham or Nothing", 1.13.3, port 4316 |
| Icon hashes (sha256) | png a9dd996d, icns 805174be, ico 4f3e98c7: unchanged |
| Windows (temporary read-only branch, deleted afterwards) | **Passed.** Run https://github.com/joshmuepu/born-app/actions/runs/41140710059.
- **Libraries** (built on Ubuntu): 6/6 checks; format 3, 1,218 sermons, 224,937 paragraph rows, 0 ranges.
- **Windows unit tests:** 895 passed, 1 skipped (the read-only-folder test, which skips where a folder cannot be made read-only, as on the Windows runner), 98 files.
- **Packaged smoke:** 11/11, including the exe icon matching `build/icons/icon.ico` and not the Electron default.
- **Sermon search:** "faith" gave 200 single-paragraph results.
- **Installer:** `BORN-1.13.3-Windows-Setup.exe`, 176.8 MB, unsigned. The artifact expires 2026-11-06.
- **First attempt:** [run 41139800803](https://github.com/joshmuepu/born-app/actions/runs/41139800803) failed on a test-only timeout: this round's `seedFullDisk.test.ts` built its sample database too slowly on the Windows runner. It was fixed in `e6513cf` (test only) and run once more.
- **Temporary branch:** deleted. |

## Live drive results (B)

| Item | Result |
|---|---|
| 1. Start-up cases | Fresh profile; a profile in the v1.13.3 layout (old sermon file backed up, fetched sermon kept, moved to format 3); damaged settings/queue/library files (set aside, app opens); wrong-kind settings (E2E-27, fixed); odd queue items. All open a window; no leftover processes after quit. |
| 2. Content | Sermons / Bible / Songs search and browse, queue, import, save, open: probes `flows` 8/0, `input` 24/0, `layout` 19/0. |
| 3. Projection | Project, Next/Back, Hide/Show, Message, Esc matrix 74/0; `output` 6/0. |
| 4. Text at several resolutions | 130 measurements each for projector and stage at 1280×720, 1920×1080, 2560×1440, 3840×2160 and portrait 1080×1920, with the longest paragraph in the library (56-0611 ¶44, 21,859 characters). Projector 0 problems; stage 35 → 0 after E2E-21. |
| 5. Displays | Three real screens: listing, naming, Identify, Test pattern, choose and re-find. Unplug: unit test (E2E-26) plus the owner's checklist. |
| 6. Remote and network | `remote` 23/0, `remote-reconnect` 8/0 (server killed and restarted); viewport sweep below. |
| 7. Settings | Saved and read back across restarts; damaged and half-written files. |
| 8. Help | All 14 pages open; the 25 links inside the manual lead somewhere real; pictures retaken. |
| 9. Update check | Real feed: "up to date". |
| 10. Quit / close / soak | Quit with outputs open; operator window closed (E2E-17). **Soak (20 min):** 399 slide changes, 39 searches, 0 slow or wrong answers; phone stayed Connected with 0 errors; memory 624 → 628 MB; CPU near idle; log 11 KB. |

## Phone and tablet sweep (C)

Seven devices: iPhone SE, iPhone, large iPhone, small Android, iPad mini, iPad, iPad Pro. Each in portrait and landscape, at 100% and 150% text, with the keyboard open, and as a Home Screen app, in WebKit and Chromium. 336 screens.

- **First run (on the code before `238370f`):**
  - The Songs tab was off the right edge on the iPhone SE and the small Android held upright at 150% (20 screens).
  - Go was 37 px tall on sideways phones (14 screens).
  - Fixed in `238370f` (E2E-31).
- **Final run:**
  - 0 sideways page scroll, 0 controls off screen, 0 tap targets under 44 px, 0 cut-off labels.
  - The keyboard never covered the field being typed in; 0 page errors.
  - "Covered" entries remain, and both kinds are expected:
    - controls under the first-run sheets, which are meant to cover the page until answered;
    - list content scrolled under the fixed tab bar.
- **Left as they are:** 26 labels are drawn at 9–10.5 px on 308 screens: tab labels, "ON SCREEN NOW", the kind tags. They are readable, uppercase or bold design choices, not breakage (Suggestions, not built).
- **Earlier in the round** the sweep found E2E-07 to E2E-11.

## Manual checklist for the owner

Before tagging a release from this branch, on real hardware:

1. **Projector unplug.** Project a slide, then pull the projector cable. The operator screen must stay usable, with the projection in a window. Plug it back in and choose it again in Screens.
2. **Real phone.**
   - Scan the QR code on the church Wi-Fi.
   - Press Next, Back and Hide screen.
   - Hold the phone sideways and use the Songs tab.
   - Add to Home Screen and open from there.
3. **iPad.** The same, in both orientations.
4. **Shift+Esc** with the Keyboard shortcuts list open: the screen hides.
5. **Windows install over the current v1.** Settings, the queue and recent services are still there afterwards; the library says format 3.
6. **Close the operator window while projecting (Windows):** everything closes and the app quits.
7. **Help pictures.** Open Help and look at the seven new pictures.
8. **Old pictures in git history.** Decide whether to leave them or rewrite history (see Findings).

## Remaining risks

- **Queue-batch race.** A phone "add" landing during an operator drag can be reordered (`protectedId`). It needs two people acting within a few milliseconds of each other; not reproduced live.
- **Queue-load race.** Opening a service while an autosave is writing can drop the autosave. The write is now whole-or-nothing (E2E-04), so no file is damaged.
- **A settings file that cannot be read** (permissions) is treated like a damaged one and set aside.
- **Display fingerprints** include resolution, so a projector changed to another resolution is seen as a new screen and falls back to Automatic.
- **Not seen on real hardware:** projector unplug and real phones (owner's checklist).
- **Old sermon-text pictures** remain in git history.

## Release recommendation

**Ready for the owner's review and checklist; then suitable for a v1.13.4 release.**
- Nothing in this round adds a feature or changes how the app is used. It fixes:
  - wrong things on the projected screen;
  - data that could be lost;
  - starts with no window;
  - a phone remote that was hard or impossible to use on small screens.
- All gates pass on macOS and Windows.
- **Before tagging:** run the manual checklist above on real hardware, especially the projector unplug and a real phone. Decide about the old pictures in git history.
- **Order:** merge `v1-sermon-fixes` first (library format 3), or merge this branch alone, since it contains it. Then bump the version and write the changelog in the usual release step.
