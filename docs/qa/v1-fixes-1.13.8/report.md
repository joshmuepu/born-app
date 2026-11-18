# BORN v1 fixes for 1.13.8: report

Branch `v1-fixes-1138`, from `main` at the 1.13.7 release plus its report. Bug fixes only; nothing merged, tagged or released, and the
version number is unchanged (1.13.7). All live testing ran on an isolated profile (a temp folder, remote port 14316, CDP 9376, its own
mDNS name, `ELECTRON_RUN_AS_NODE` unset), with the app's outputs hidden by `hide-outputs.cjs`. No other BORN was started, stopped or
touched, and no display, appearance or sound setting was changed, so there was nothing to restore.

## Bug 1: a black window flashed on Windows while BORN updated

**Reproduction.** The Windows update install writes a small batch file and starts it with `spawn('cmd.exe', ['/c', script],
{ detached: true, stdio: 'ignore' })` (`src/main/updateCheck.ts`). On Windows a detached `cmd.exe` gets a console window of its own unless
`windowsHide` is set, so a black window opened while the installer ran. Windows cannot be run here, so the bug was reproduced with a
unit test that reads the exact options passed to `spawn`: before the fix it failed (`{ detached: true, stdio: 'ignore' }`, no
`windowsHide`).

**Fix.** The update's process is started with `windowsHide: true` as well (one line, in the helper both the Windows and the macOS update
use; the option is ignored off Windows). The installer itself is run by that hidden shell with `/S` (silent), so it shows no window, and the
shell then starts BORN again with `start`, which shows BORN normally.

**Tests.** `src/test/main/processWindowsHidden.test.ts`: the Windows update starts `cmd.exe /c` hidden, detached and with no output
attached; the macOS update passes the same options; the Wi-Fi name lookup runs `netsh` hidden, with a time limit and no shell. 2 of the 3
failed before the fix (the Wi-Fi lookup was already hidden).

**Every place a process or shell is started, checked:**

| Place | What it starts | On Windows | Change |
|---|---|---|---|
| `src/main/updateCheck.ts` `applyUpdate` (Windows) | `cmd.exe /c born-update-….bat` | **opened a console window** | `windowsHide: true` |
| the batch file it runs | the installer with `/S`, then `start "" BORN.exe` | the silent installer shows no window; BORN starts as normal | none needed |
| `src/main/updateCheck.ts` `applyUpdate` (macOS) | `/bin/bash` swap script | not used on Windows | gets `windowsHide` too (same helper, ignored) |
| `src/main/updateCheck.ts` `runInstaller` | `shell.openPath(installer)` (the manual install) | the installer's own window, which the operator needs | none (meant to be seen) |
| `src/main/updateCheck.ts` download page | `shell.openExternal` | the browser | none |
| `src/main/networkMeta.ts` | `execFile('netsh', …)` | already `windowsHide: true`, no shell, 3 s limit | none (now covered by the test) |
| `src/main/index.ts` Open data folder, Help links | `shell.openPath` / `shell.openExternal` | Explorer / the browser | none |
| `scripts/runtime-check/run.cjs` | `esbuild`, `electron` (developer check) | run from a terminal, shares its console | none |
| `scripts/data/fetch-library-snapshot.mjs` | `node` (developer script) | run from a terminal | none |
| `scripts/qa/*` (`lib.cjs`, `reload-guard.cjs`, `library-upgrade.cjs`, `queue-save-full-disk.cjs`, `reach-*.cjs`, `smoke-macos-packaged.cjs`, `data-safety-app.cjs`) | the test app, `lsof`, `hdiutil`, `esbuild` | macOS-only test scripts, never shipped | none |

No other `spawn`, `exec`, `execFile`, `fork` or `utilityProcess` exists in the app's code (`src/main`, `src/preload`, `src/renderer`).

## Bug 2: the phone's recent songs failed without a word

**Reproduction.** In the real app, with the phone's `/api/songs/recent` request failed before the page loaded (Playwright, Chromium and
WebKit): the Songs tab showed no Recently Played and no message. The request's failure was swallowed (`function(){}`).

**Fix.** A failed read of the recent songs now shows **Recently Played** with *"Couldn't load this from BORN."* and **Try again**, the same
wording and button as the other phone sheets; Try again reads them again.

**Every other request the phone page makes, checked:**

| Request | When | Before | Now |
|---|---|---|---|
| `/state` | on load, every second, when the phone wakes | the connection line says it is not connected | unchanged |
| `/api/bible/books`, `/api/search/songs?q=` (the lists) | on load, when the tab opens | "The list could not be read from BORN." with Try again | unchanged |
| **`/api/songs/recent`** | on load, with the songs list | **nothing at all** | **"Couldn't load this from BORN." with Try again** |
| **`/api/songs/recent-keys`** | **Change key** opens the Set key sheet | **nothing happened, and an unhandled error** | **the sheet opens with "Couldn't load this from BORN." and Try again** |
| **`/api/search/songs?q=…`** | a song search | **"SEARCHING…" for ever, and an unhandled error** | **"Couldn't reach BORN — check the connection and search again."**, as the sermon and Bible searches already said |
| **`/api/bible/chapter` (a passage)** | tapping a Bible search result, a passage or a verse | **nothing happened, and an unhandled error** | **"Couldn't load this from BORN. Try again."** (a message, as an unopenable song already gets) |
| `/api/services/recent` | Open a saved service | Couldn't load, with Try again | unchanged |
| `/api/sermons/on-this-day`, `/series`, `/by-ids`, `/:id/paragraphs`, `/recent` | their sheets | Couldn't load, with Try again | unchanged |
| `/api/bible/chapter` (a chapter) | choosing a chapter | Couldn't load, with Try again | unchanged |
| `/api/search/sermons`, `/api/search/bible` | a search | Couldn't reach BORN | unchanged |
| `/api/song/:id` | opening a song | Couldn't open that song | unchanged |
| `/command` (every tap, Save) | a tap | says it was not sent, refused or not saved | unchanged |
| `/api/song/:id` after a key is chosen | after Change key | the key is set on the computer; if this read then fails the sheet stays open | unchanged (the key was set; see Remaining risks) |

**Tests.**
- Unit (`src/test/main/phoneDataSafety.test.ts`, the real page script in jsdom): the recent songs (message, Try again, which loads them;
  an empty list still shows nothing extra), Set key, a song search and a Bible passage. 4 failed before the fix, all pass after.
- Real app (`scripts/qa/phone-recent-songs.cjs`, Chromium and WebKit, the failures made on the phone's side before the page loads, Try again
  pressed with a real tap): **16 of 27 failed on the old page, 27/27 pass after the fix.**

## Bug 3: a check that failed could leave its test app running

**Reproduction.** A check script that launched the app and then failed (`process.exit(2)` in its error handler): the app was still running
afterwards, the launcher and the real app both holding the test profile folder. The shared launcher (`scripts/qa/lib.cjs`) stopped only the
launcher process and only when a script reached its own `kill()`.

**Fix.** In `scripts/qa/lib.cjs`, every app a run starts is remembered and stopped when the run ends, also on a failure, an uncaught error,
an unhandled rejection or Ctrl+C: a signal first, then a forced stop after a short wait (4 s; 3 s at exit). The real app (found by its
debugging port) is stopped as well as its launcher. At exit the run lists any process still holding one of its own profile folders open.
`reload-guard.cjs`, which starts its app itself, registers it the same way (`adopt`) instead of `pkill`. Every app-starting check uses the
shared launcher, so all of them get this.

**Tests.**
- the old launcher, a check that fails after starting the app: the app was left running (5 processes holding the profile);
- the new launcher, the same check: exit 2 and nothing left;
- Ctrl+C while a check waits: the app stopped, exit 130, and a stray process left holding the profile was reported by pid and folder;
- a process that ignores the stop signal: force-stopped after the wait (SIGKILL after 4 s);
- an uncaught error: the app stopped;
- a real case during this round: the new phone check failed on its first run (the "Who's this?" prompt was in the way of a tap) and
  its app was stopped.

## Gates

Each run once, on the branch.

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 127 files, 1056/1056 passed (1048 before this round, +8 new) |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| `phone-recent-songs.cjs` (new, real app, Chromium and WebKit) | 27/27 (16 failed on the old page) |
| `remote-viewports.cjs` (phone and iPad sweep: WebKit and Chromium, 7 sizes, portrait and landscape, 100% and 150%, every phone role: Song Leader, Preacher, Operator and a name of its own) | ran to the end; 384 role screens, 0 page errors. Its notes are about the Queue screen, the Add to Home Screen prompt and the Close, File, Save and Edit buttons (small labels, 34–36 px buttons, the prompt covering the screen while it is open). None of these is on anything this round changed. No earlier report records these notes, so there was nothing to compare them with |
| `phone-data-safety.cjs` (remote regression) | 49/49 |
| `remote-probe.cjs` (remote regression) | 23/23 |
| `remote-reconnect.cjs` (remote regression) | 8/8 |
| Harness (bug 3) | a failed check, Ctrl+C, an uncaught error and an app ignoring the signal all end with nothing left running; a stray holder is reported |
| CI on a pushed branch | none configured (the Release workflow runs only on a `v*` tag or by hand) |
| Identity | version 1.13.7 (unchanged), appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316, icon SHA-256 a9dd996d / 805174be / 4f3e98c7, tag gate `^v1\.[0-9]+\.[0-9]+$`; no workflow, `package.json` or lock file changed |

The known `songs.test.ts` teardown crash did not happen, so nothing was rerun. After every app check, nothing was listening on the test
ports and no test app was left running.

## Judgement calls

- **Bug 1:** `windowsHide` goes on the hidden shell only, not on the installer or on BORN's relaunch: the shell runs both, the installer
  silently, and BORN must come back visible. Hiding a program with a window of its own can keep its first window hidden, so it is not added
  where a window is wanted (the manual install, Explorer, the browser, BORN itself).
- **Bug 2:** beyond the recent songs, three more requests failed without a word: Set key, a song search and opening a Bible passage. They
  are fixed with words v1 already uses. A sheet or list gets *"Couldn't load this from BORN."* with Try again. A search gets the message
  the sermon and Bible searches already show. A passage, like a song that cannot be opened, gets a message, since nothing is on the
  screen to put a button in.
- **Bug 2:** the recent songs' failure shows under the Recently Played heading, so the operator knows what is missing; the full A–Z
  list below it keeps working.
- **Bug 3:** the leftover report looks for processes holding files in the run's own profile folders open (`lsof +D`), which only ever finds
  this run's apps, never another BORN.
- No keychain prompt appeared in any test (the test app never asked for one), so no test step was skipped for it.

## Not verifiable here: the owner's checklist

1. **Windows, on the church PC:** with 1.13.7 installed, let the in-app update install the next version (Download, then Restart). No black
   window appears at any point. BORN comes back by itself, in a normal window, on the new version, with its settings and queue intact.
2. **A phone and an iPad:**
   1. Play a song on the computer, then open the Songs tab on the phone: Recently Played shows it as before. The failure itself (that one
      request failing while the rest load) cannot be made to happen by hand; it is covered by the real-browser check above.
   2. Open a song, turn Wi-Fi off, tap **Change key**: it says "Couldn't load this from BORN." with Try again. Turn Wi-Fi on, tap Try
      again: the keys appear.
   3. With Wi-Fi off, search songs: "Couldn't reach BORN — check the connection and search again."

## Remaining risks

- The Windows fix is proven only by the options passed to `spawn`. That a hidden `cmd.exe` relaunches BORN visibly with `start` is standard
  Windows behaviour, but it has not been run on Windows in this round (checklist item 1).
- After **Change key**, the key is set on the computer, and the phone then reads the song again. If that one read fails, the sheet stays
  open with the new key not shown. This was not changed: the key is set, and closing the sheet shows it.

## Not done

- No release, tag, merge or version change (by instruction).
- Nothing in CI runs on a pushed branch here (the Release workflow runs on a `v*` tag or by hand), so there was no branch CI to run.

## Proposed changelog entry (not committed to CHANGELOG.md)

```
## 1.13.8

### Fixed
- Windows: updating BORN no longer flashes a black window while the new version installs.
- Phone remote: when BORN can't be reached, the recent songs on the Songs tab now say "Couldn't load this from BORN." with Try again,
  instead of showing nothing. Change key does the same. A song search says it couldn't reach BORN instead of "Searching…" for ever, and
  a Bible passage that can't be opened says so.
```
