# BORN v1 round `v1-parity-fixes`: report

Bug fixes only. Nothing merged, tagged, version-bumped or released. No new features.

- **Base:** `v1-e2e-nov` at `48f1eb3` (unreleased v1 fixes from the November round; not merged into `main`, which is at `f67b1f4`, v1.13.5).
- **Branch:** `v1-parity-fixes`.
- **Version:** unchanged at 1.13.5.
- **Identity:** unchanged (`com.joshmuepu.born`, "Branham or Nothing", port 4316).
- **Icon hashes:** unchanged (png `a9dd996d`, icns `805174be`, ico `4f3e98c7`).
- **Workflows:** none added to `main` or to this branch. The Windows check used a temporary branch that has since been deleted.
- **package.json:** one new script, `test:runtime`.

## How it was tested

Every fix was reproduced on v1 first, by one of:
- a unit test that failed before the fix;
- a real-app check that failed before the fix;
- for the text-decoding fix, a check on the app's own runtime that failed before the fix.

Every fix then got a regression test.

Live checks used an isolated profile:
- a throwaway `BORN_USER_DATA_DIR`;
- `BORN_REMOTE_PORT=14316`, `BORN_MDNS_NAME=born-remote-v1-parity`, CDP 9376;
- `ELECTRON_RUN_AS_NODE` unset;
- the congregation screen and the stage monitor kept hidden.

The owner's copies (ports 4316 and 9346) were not running and were not touched. Songs, sermons and screens in tests are invented, apart from KJV verses.

**Runtime rule.** The packaged app runs on Electron 33's built-in Node 20.18, not the developer's Node 24. On that runtime, `TextDecoder('windows-1252')` decodes the euro sign and curly quotes as invisible control characters. So every fix that touches decoding is also checked on that runtime:
- `npm run test:runtime` bundles `scripts/runtime-check/*.ts` and runs them with the Electron binary as Node (`ELECTRON_RUN_AS_NODE` set for that one command only).
- `scripts/qa/song-import-app.cjs` imports through Songs > Import in the real app.

## Findings

| V | Area | What happened in v1 | Result | Commit | Test |
|---|---|---|---|---|---|
| V-001 | Congregation screen, stage monitor, operator window | A page that stopped (crashed) was only logged. The congregation screen stayed black while the header still showed it open, and nobody was told. A restarted operator window did not know a projection was open. | Fixed. Restarted with what is live, at most three times a minute, and the operator is told. After that: shown as closed, plus a notice that stays, with Open projection. | `ba524d4` | `crashGuard.test.ts`; `scripts/qa/crash-recovery.cjs` (5 crashes plus an operator-window crash; before: dead from crash 1; after: 20/20) |
| V-002 | Keys | Alt+←/→ stepped the live slide. A held arrow skipped several slides. Ctrl+Space was Next, and Ctrl/Cmd+B and Shift+B hid the screen. Ctrl/Cmd+Enter put the last sermon result up from any panel, and after a list had used the key. | Fixed | `ac82b2a` | `liveKeys.test.tsx` (8 of 9 fail before); `scripts/qa/live-keys.cjs` |
| V-003 | Esc | Esc with the Bible scope or status popover open hid the screens and left the popover open. | Fixed | `ac82b2a` | the same |
| V-004 | Libraries | A failed first copy of the Bible and song library (a full disk) left an empty library.db that was never copied again. | Fixed | `50ffb52` | `libraryRecopy.test.ts` |
| V-005 | Libraries | A database another program held locked at start was set aside and replaced as if it were damaged. | Fixed | `50ffb52` | `dbIntegrity.test.ts` |
| V-006 | Saved queue, settings | A damaged queue.json or settings.json was set aside silently, and the app started empty or on defaults. A queue the window could not ask for stopped all saving for the run. | Fixed. Said, with Open data folder; saving carries on. | `5f31c42` | `dataNotices.test.tsx`, `corruptFile.test.ts` |
| V-007 | Settings | A settings save that failed was only logged, so the change looked kept. | Fixed (said once a run) | `5f31c42` | `settings.test.ts` |
| V-008 | Songs | A song library that could not be read showed "Loading…" for ever in All Songs, and "No songs found." for a search. | Fixed (said, with Try again) | `5f31c42` | `dataNotices.test.tsx` |
| V-009 | Saved files | The safe file write did not flush to disk before replacing the old file. | Fixed | `a9c636e` | `corruptFile.test.ts` |
| V-010 | Sermon library upgrade | The new library was not flushed before the swap. Fetched sermons were copied by column position: a table in another column order swapped titles and dates, and an extra column stopped the upgrade. | Fixed. Formats 0/1/2 and format 3 unchanged. | `a9c636e` | `sermonDbUpgrade.test.ts` (+3); `scripts/qa/library-upgrade.cjs` |
| V-011 | Songs | No copy of the song library was taken before an import. | Fixed. Dated copy in `backups/`; the last three kept; the import says where. | `4377e75` | `songBackup.test.ts`; `song-import-app.cjs` |
| V-012 | Windows | Any page could open a new window or navigate away, and every browser permission was granted. | Fixed | `aa5eac4` | `windowGuard.test.ts`; `scripts/qa/window-safety.cjs` |
| V-013 | Help links | `file:`, `smb:` and custom-scheme links were handed to the system. | Fixed (web and mail only) | `aa5eac4` | the same |
| V-014 | Update | The update step ran whatever path the window passed (it "ran" `/bin/ls`). | Fixed (only the installer this run downloaded) | `aa5eac4` | the same |
| V-015 | Hymnary reader | The hidden reader loaded any address it was given. | Fixed (hymnary.org over https only) | `aa5eac4` | `windowGuard.test.ts` |
| V-016 | Operator window | Closing it while something was live took the screens down without asking. | Fixed (asks first) | `aa5eac4` | `window-safety.cjs` |
| V-017 | Text size | Any number reached the screen and settings.json. | Fixed (1.5 to 8) | `aa5eac4` | `windowGuard.test.ts`; `window-safety.cjs` |
| V-018 | Main process | A Message that was not text threw. A display name that was not text threw. Unexpected errors were only logged. | Fixed. Dropped; errors said to the operator, at most once a minute. | `aa5eac4` | the same |
| V-019 | Phone | A tap had no time limit and was sent while the phone knew it was offline. | Fixed. 4 s limit; not sent while offline, except Hide screen. | `092cbd6` | `phoneTruth.test.ts` |
| V-020 | Phone | Every refusal said "Couldn't reach BORN" and flipped to Reconnecting. | Fixed | `092cbd6` | the same |
| V-021 | Phone | The item sheet followed a position, so it became another item when the queue changed. | Fixed (follows the item; closes with a note when the item is taken out) | `092cbd6` | the same |
| V-022 | Phone | A sheet whose read failed said "Loading…" for ever. | Fixed | `092cbd6` | the same |
| V-023 | Phone | The Bible book list and song list never said they had failed (the computer answered an unreadable library with an empty list) and were not read again. | Fixed (said, Try again, read again on opening the tab) | `092cbd6` | the same |
| V-024 | Song file encoding | Song text files were read as UTF-8 only: Windows-1252 files lost their quotes, apostrophes, dashes, € and accents ("�"), and UTF-16 files were unreadable. ProPresenter RTF lost € and the rest of 0x80–0x9F, and turned `\uN` characters into "?". | Fixed. UTF-8 and BOM-marked UTF-16 detected, otherwise a fixed Windows-1252 table; RTF uses the same table and reads `\uN`. | `d55c7a8` | `npm run test:runtime` (7 of 9 failed before on Electron's Node); `songEncodings.test.ts`; `song-import-app.cjs` |
| V-025 | OpenLyrics | Single-quoted verse names lost the verse; `<line>` elements ran together; numeric entities were left as they were. | Fixed | `d5fda21` | `songParserFixes.test.ts` |
| V-026 | ProPresenter | A damaged section failed the whole import. | Fixed (falls back to the text in the file) | `d5fda21` | the same |
| V-027 | Plain-text songs | A one-line first verse was taken as the title and lost. | Fixed | `d5fda21` | the same |
| V-028 | Hymn site text | Entities were decoded in several passes ("&amp;#39;" became an apostrophe). | Fixed (one pass) | `d5fda21` | the same |
| V-029 | Pages | Chinese and Japanese text was cut mid-sentence, and a page could split a character. | Fixed. No dependence on the runtime's Intl. | `a7d3e93` | `paginateCjk.test.ts` |
| V-030 | Song import | Duplicates were judged by file name, so a different song with the same name was never imported. | Fixed (name plus content hash; older imports still recognised) | `39d9c75` | `songImportDedupe.test.ts`; `song-import-app.cjs` (hash computed in the app) |
| V-031 | Song import | A rolled-back import listed songs as added. | Fixed | `39d9c75` | the same |
| V-032 | Songs > Import | On Windows the dialog was a folder chooser only. | Fixed (asks files or folder on Windows/Linux; macOS unchanged) | `df26767` | `songScreens.test.tsx` |
| V-033 | Songs > Import | A failed import stayed on "Importing…". | Fixed | `df26767` | the same |
| V-034 | Songs | A slower, earlier song could replace the one just opened. | Fixed | `df26767` | the same |
| V-035 | Song editor | Fields had no accessible names, and a removed slide could not be undone. | Fixed | `df26767` | the same |
| V-036 | Review screen | Without a source note, the confirm box was missing, so Save stayed off for good. | Fixed | `df26767` | the same |
| V-037 | Online import | A refused save threw the operator's edits away. | Fixed | `df26767` | the same |
| V-038 | Cyber Hymnal | A redirect to another host, or a page of any size, was read. | Fixed (site host only; under 3 MB) | `7ac8e5a` | `cyberHymnalSite.test.ts` |
| V-039 | Operator window | Closing the Message dialog left the keyboard on the page. | Fixed (back to what opened it) | `ca4ea60` | `operatorWindowKeyboard.test.tsx` |
| V-040 | Bible panel | The scope clear button had no name, and the mode switch claimed to be tabs. | Fixed | `ca4ea60` | the same |
| V-041 | Source panels | Show, + Queue and the other panel buttons dropped the keyboard after a keyboard press. | Fixed (still let go after a mouse click) | `ca4ea60` | the same |
| V-042 | Storage | Blocked browser storage made the Bible and Browse panels throw. | Fixed | `ca4ea60` | the same |
| V-043 | Browse | Location, series and sermon-list rows were mouse-only. | Fixed | `ca4ea60` | the same |
| V-044 | Song key picker | Not announced as a popover, and the keyboard did not move into it. | Fixed | `ca4ea60` | the same |
| V-045 | Phone | Remove had no Undo and sat next to Move down. | Fixed | `67603dd` | `phoneRemoveUndo.test.ts` |
| V-046 | Phone | Toasts never wrapped (they ran off narrow phones) and used a hard-coded colour. | Fixed | `67603dd` | the same |
| V-047 | Operator window | Its fixed 1040x640 minimum ran off a 960x600 display. | Fixed (fits the work area) | `2563dc5` | `windowFit.test.ts` (injected work areas) |
| V-048 | Phone wording | Checked for a hard-coded capitals label among sentence-case ones. | Not a bug in v1: v1's phone writes every section label in capitals, consistently. | — | — |
| V-049 | Outputs | Opening, re-opening or moving an output window took the keyboard from the operator window, and the floating stage monitor was focused as it was made. | Fixed | `56d0a1d` | `outputsKeepKeyboard.test.ts` |
| V-050 | Stage monitor | Named onto the congregation screen's display, it covered what the room sees. | Fixed. Refused; goes to a spare display or a window. The Screens note stays. | `56d0a1d` | `displays.test.ts` |
| V-051 | Logo button | Checked its tooltip, "BORN — back to the start screen". | Not wrong in v1: it returns to the start screen and asks before clearing a queue. Left as it is. | — | — |

QA scripts and harness: `87c88b2`, plus the scripts committed with each fix (`crash-recovery.cjs`, `window-safety.cjs`, `record-main.cjs`).

## Judgement calls

- **"OFF AIR".** v1 has no ON AIR / OFF AIR label. Its header shows a live projection as **Close projection**, the Hide screen and Message buttons, and a lit Screens dot. "Off" in v1's own words is **Open projection**, no Hide screen or Message buttons, and an unlit dot. That is what a failed screen shows.
- **Retry limit.** Three restarts a minute; the fourth stop in a minute leaves the screen off. Open projection (in the notice or the header) gives the retries back.
- **Ctrl/Cmd+Enter.** Works while the Sermons search is the view showing: from its box or its results. It does nothing in another panel, in a dialog, or when a list already used the key. The shortcuts list still says "Project the top search result".
- **Sermon library after a failed first copy.** Not changed. The format upgrade already replaces an empty, out-of-date sermon library at the next start. Only the Bible and song library stayed empty for good.
- **Song backups.** No new copy is taken within ten minutes of the last one; that copy is from before the import too. This stops a review saving songs one by one from pushing the useful older copies out of the last three.
- **Encodings.** BOM-less UTF-16 is not guessed (outside the brief). RTF `\'xx` bytes are always Windows-1252: other code pages (`\ansicpg932` and so on) would need the runtime's tables.
- **Pages.** No `Intl.Segmenter`, so the result does not depend on the runtime: plain checks for surrogate pairs and combining marks.
- **Hymnary reader.** Keeps the app's default session, so the site's challenge cookie still carries over between searches; it gets no session of its own.
- **Browse rows.** The keyboard fix covers every Browse row (series, Location, sermon lists), not only Location: it is the same defect in the same component.
- **Phone toast colour.** Now a page token, with the same green, because v1's phone has one theme.
- **Phone offline taps.** Hide screen still tries while offline. Show screen does not: it would land later, unasked.
- **Changed tests.** One existing test asserted the bug: `displays.test.ts` expected the stage monitor on the congregation screen's display; it now names a third display. `scripts/qa/remote-reconnect.cjs` now accepts "Not connected to BORN" for a tap the phone does not send.
- **Display size.** The 960x600 case was tested with injected work areas. The display was not switched.

## Noticed, not fixed

- The logo button's spoken name is its letters ("BRN"); its tooltip is right.
- RTF song text in a code page other than Windows-1252 (Japanese, Chinese, Korean ProPresenter files).
- Song files in BOM-less UTF-16.
- In a few rarely used places the phone still rejects a failed read without a catch (an unhandled rejection in the page's console when offline). This is unchanged from before.
- Out of this round's scope (display edge cases, reduced motion, text direction, the print helper window, Electron advisories): nothing new seen beyond what is already known.

## Gate results

| Gate | Result |
|---|---|
| Typecheck (and `--noUnusedLocals`) | Clean |
| Build | OK |
| Unit tests | **1024 passed, 0 failed, 124 files** (938 / 107 at the base) |
| App-runtime tests (`npm run test:runtime`, Electron 33.4.11 / Node 20.18.3) | **9/9** |
| Crash recovery (real app) | **20/20** |
| Window safety (real app) | **13/13** |
| Keys and Esc (real app) | **13/13** |
| Song import encodings (real app) | **8/8** |
| Library upgrade from formats 0, 1, 2 (real app) | **12/12**: format 3, dated `.bak` kept, the fetched sermon in place, search works |
| macOS package (`dist:mac`, unsigned, not published) and packaged smoke | **11/11**. arm64 DMG 215.0 MB, x64 219.6 MB; 1.13.5; icon `805174be` |
| Phone and iPad sweep (`remote-viewports.cjs`: 7 devices, portrait and landscape, 100% and 150%, keyboard open, Home Screen app, WebKit and Chromium) | **336 screens**. No page errors; the keyboard never covers the focused field. As last round: the same 26 small labels (9–10.5 px, by design), and controls under the first-run Add to Home Screen sheet, which sits on top by design (194 screens, the same as last round) |
| Esc matrix, remote probe, remote reconnect (regression) | **74/74**, **23/23**, **8/8** |
| Windows (temporary read-only branch `tmp-win-parity-fixes`, deleted afterwards) | **Passed**, [run 43820341826](https://github.com/joshmuepu/born-app/actions/runs/43820341826). Libraries from the checked snapshot: 1,218 sermons, 224,937 paragraphs, 93,285 Bible verses, 1,163 songs (12/12 and 6/6). Unit tests **1022 passed, 2 skipped** (the read-only-folder test and the read-only settings-save test, both skipped on Windows by design), 124 files. App-runtime tests **9/9** on Electron 33.4.11 / Node 20.18.3. Packaged smoke **11/11**: icon images byte-identical to `icon.ico` and not the Electron default; `icon.ico` `4f3e98c7`. "faith": 200 single-paragraph results. Installer `BORN-1.13.5-Windows-Setup.exe`, 176.8 MB (185,379,551 bytes), unsigned; artifact `BORN-v1-parity-fixes-Windows-installer`, available until 2026-11-23 (`gh run download 43820341826 -R joshmuepu/born-app -n BORN-v1-parity-fixes-Windows-installer`) |

## Not verifiable here: for the owner, on real hardware

1. Projector plugged in: Open projection and a verse. Typing in the search box still works straight away, without clicking back into BORN.
2. With a verse up, click the operator window's close button: BORN asks first. Choose Keep it open.
3. Screens: name the projector, and try to set the stage monitor to that same name. The stage monitor stays off the projector, and the Screens panel says the two were set to the same display.
4. On a phone: turn Wi-Fi off and tap Next. It says "Not connected to BORN", and nothing jumps when Wi-Fi comes back.
5. On a phone, in queue Edit: tap Remove, then Undo within 5 seconds. The item stays.
6. Import a song text file saved by a Windows program with curly quotes and an accent (for example from Notepad as "ANSI"). The quotes and the accent show correctly.
7. Windows only: Songs > Import asks "files or a folder" and can pick a single file.

## Remaining risks

- Crash restarts were tested with forced page crashes. A page that hangs without crashing is unchanged (it is only logged).
- Output focus was tested by source inspection and unit tests, not on real external displays. macOS full screen hands focus back with a short delay (250 ms and 900 ms).
- The phone's 4-second limit could give up on a very slow but working network. Before, such a tap simply waited.
- The content-hash duplicate key means a file whose bytes changed (re-saved with no visible change) is imported again as a new song.

## Recommendation

Ready to become the next v1 release (1.13.6), after the owner's checklist above, items 1 to 3 at least, on the church's real projector.

Every gate passed, on macOS and on Windows. The fixes are small, each one is behind a test that failed before it, and none adds a feature. Three changes are the ones an operator will notice:
- the question when closing the operator window while something is live;
- the "Not connected to BORN" phone message;
- the Undo bar on the phone.

This branch also carries the three unreleased fixes from `v1-e2e-nov`.
