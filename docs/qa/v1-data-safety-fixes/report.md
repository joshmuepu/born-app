# BORN v1 round `v1-data-safety-fixes`: report

Bug fixes only. Nothing merged, tagged, version-bumped or released. No new settings.

- **Base:** `main` at `64c7d8e` (v1.13.6). **Branch:** `v1-data-safety-fixes`.
- **Version:** unchanged at 1.13.6. **Identity:** unchanged (`com.joshmuepu.born`, "Branham or Nothing", port 4316).
- **Icon hashes:** unchanged (png `a9dd996d`, icns `805174be`, ico `4f3e98c7`). **Tag gate:** unchanged (`^v1\.[0-9]+\.[0-9]+$`).
- **Workflows:** none added. `release.yml` has a comment-only change (item 10); its steps are unchanged.

## How it was tested

Every bug was reproduced in the real app before it was fixed, with a script that failed then and passes now. Each fix also has unit
tests that fail on the code before the fix (18 of the 24 new tests fail there; the other 6 check behaviour that was already right and
must stay so).

Live runs used an isolated profile: a throwaway `BORN_USER_DATA_DIR`, `BORN_REMOTE_PORT=14316`, `BORN_MDNS_NAME=born-remote-v1-safety`,
CDP 9376, `ELECTRON_RUN_AS_NODE` unset, and the congregation screen and the stage monitor kept hidden (`hide-outputs.cjs`). No copy of
BORN was listening on 4316 or 9346 during the round, and none of the owner's apps, data or OBS settings were touched.

- **Displays.** This Mac has three displays (the built-in one and two PA278QV). They were only read, never changed: the no-projector
  case is made by `scripts/qa/fault-hooks.cjs`, which shows the app only the main display. So there were no display or appearance
  settings to put back.
- **Full disk.** `queue-save-full-disk.cjs` makes a 600 MB disk image, runs the app with its profile on it, fills only that image, and
  detaches and deletes it at the end (also on failure). The computer's own disk was never filled.
- **Quit.** `fault-hooks.cjs` quits the app with `app.quit()` when the test asks, which is the call the Quit menu item, Cmd+Q and the
  Dock's Quit make. The question itself is recorded by `record-main.cjs` instead of being shown.

## The bugs

### 1. With no projector, the congregation screen covered the operator window

- **Reproduced.** App shown one display; a verse projected from the phone. The congregation screen was asked to go full screen
  (`setSimpleFullScreen(true)`) at the whole work area, 1728×1013 at (0, 33): the operator window was covered.
- **Fix.** With no projector connected and none chosen, the congregation screen opens as a normal window, about a third of the screen
  wide at 16:9, in the bottom-right corner (622×350 here). It goes full screen on a projector as soon as one is connected, exactly as
  before. Choosing this computer's own screen under **Screens** still puts it full screen there, so no way of getting a full-screen
  congregation screen on one display was lost and no setting was needed. A projector unplugged mid-service behaves as before.
- **Tests.** `dataSafety.test.ts` (which choices open as a window; the corner bounds; a later screen change keeps it a window);
  `data-safety-app.cjs` (no full screen, a smaller window in a corner, the verse on it; choosing this computer's own screen still goes
  full screen).

### 2. Quitting while something was live closed everything with no question

- **Reproduced.** A verse live; quit as the Quit menu does: no question, the app and both screens gone.
- **Fix.** Quit (the menu, Cmd+Q, the Dock's or the taskbar's Quit) now asks while something is on the screen and not hidden,
  in the same way closing the operator window already does: "Something is on the screen." with **Keep BORN open** (the default and
  the Esc answer, so Enter alone never takes the screens down) and **Quit and take the screens down**. Nothing on the screen, or
  the screen hidden: no question. A quit sent by signal (a script, a service manager, `kill`) is not the operator at the window: it
  quits without asking, as it always has.
- **Found while testing.** The first version of this fix also asked when the app was sent a quit signal, so a script stopping BORN
  left it waiting on a question nobody could answer. Fixed in its own commit; the signal handler is set up once the app is ready,
  after Electron's own, which otherwise quits first and asks.
- **Tests.** `data-safety-app.cjs`: asks while live; the safe answer is the default and the Esc answer; Keep BORN open keeps the app and
  the screen; the other answer quits; nothing live, and screen hidden, quit without a question; a quit by signal while live quits
  without a question (this check failed before the follow-up fix).

### 3. A queue save that failed was only logged

- **Reproduced** on the full disk image: with the disk full, adding an item left `queue.json` at the last good save and the operator
  was told nothing.
- **Fix.** The first failed save says, in the operator window: "The Service Queue could not be saved (the data folder may be full or
  read-only). It stays here in the window, and BORN tries again with your next change." The queue stays in the window; every change
  tries again; once a save works, a later failure is said again. It is said once per failure, not for every change.
- **Tests.** `queue-save-full-disk.cjs` (said once; the queue stays; the file keeps the last good save; not repeated while it keeps
  failing; saved again with room; said again after it had recovered). The app's main process is not unit-testable here, so this one is
  covered by the real-app check only.

### 4. The phone's Save under a name that already exists replaced it silently

- **Reproduced.** Phone (Chromium and WebKit): Save this service as a new name, then a different service saved under the same name:
  the file was replaced with no question.
- **Fix.** The phone asks first: "A saved service called “Name” already exists." with **Cancel** (the default, and focused),
  **Keep both** (saved as "Name (2)", the next free number) and **Replace it**. Nothing is written while it asks. A save command that
  does not say what to do about a taken name (any other caller of the phone's `save-queue` command) replaces it, as before.
- **Tests.** `phoneDataSafety.test.ts`, `dataSafety.test.ts` (the next free name; the answer is passed back to the phone),
  `phone-data-safety.cjs` (the three choices, Cancel the default, each answer does what it says, on disk).

### 5. A Save whose connection dropped left an unhandled error

- **Reproduced.** The save request dropped mid-way: the page had an unhandled "Failed to fetch" (WebKit: "Load failed") and no message
  about the save, only the general "Couldn't reach BORN".
- **Fix.** It is caught and says "“Name” was not saved. Check the connection and try again." (or "Not connected to BORN." when the phone
  already knew). "Saved" is shown only when the computer said so.
- **Tests.** `phoneDataSafety.test.ts` (a dropped connection and a refusal), `phone-data-safety.cjs`.

### 6. Phone sheets that could not load

- **Reproduced.**
  - *Open a saved service*, On This Day, Series, a series' sermons, a sermon, Recently Played: these already said
    "Couldn't load this from BORN. Close it and try again." (fixed in 1.13.6), so "Loading… for ever" did **not** reproduce for them.
    They had no Try again.
  - **A Bible chapter** that failed said "Loading…" for ever (reproduced).
  - **Opening a song** that failed did nothing at all, with an unhandled error (reproduced).
- **Fix.** Each of those sheets now says "Couldn't load this from BORN." with **Try again**, which loads it again (the same button the
  phone's Bible and song lists already have). A Bible chapter that fails says the same with Try again. A song that cannot be opened says
  "Couldn't open that song from BORN. Try again."
- **Tests.** `phoneDataSafety.test.ts`, `phone-data-safety.cjs` (each sheet: the message and Try again, then Try again loads it).

### 7. The phone's sermon series showed as empty when the computer could not read them

- **Reproduced.** With the online series request failing and the bundled `series.json` unreadable, `/api/sermons/series` answered
  `200 []`, and the phone showed an empty Series sheet.
- **Fix.** When neither the online list nor the bundled one could be read, the answer is an error (500) and the phone says it could not
  load, with Try again. A list that is read and really is empty is still answered as `200 []`. The same was true of a series' sermons,
  a sermon's paragraphs, a Bible chapter and a song: these now answer an error when the computer cannot read them (a song that is not
  there is still `null`).
- **Tests.** `dataSafety.test.ts` (errors; an empty list unchanged; an unreadable `series.json` told apart from one that lists none),
  `phone-data-safety.cjs` (with the fault on in the real app: status 500, and the phone's Series sheet says so with Try again).

### 8. The phone said "Nothing on screen yet" while something was showing

- **Reproduced.** Every way of putting something up from the operator window or the phone already reported it to the phone. The case
  that did not: after the operator window is started again (it stopped and was restarted, or was reloaded) it no longer knows what is
  live. The congregation screen still showed John 3:17 while the phone's state said nothing was on screen. v1 has no other
  way of putting something on the congregation screen.
- **Fix.** While the congregation screen is open, the phone's status is filled in from what the congregation screen itself shows
  (held by BORN's main process), including whether it is hidden, whenever the operator window has nothing.
- **Tests.** `dataSafety.test.ts`, `data-safety-app.cjs` (before and after the restart: John 3:17 · KJV on both).

### 9. A long page can lose its end on the congregation screen — Not done

- **Reproduced.** A 60-line song slide needs 2,198 px in a 739 px text box even at the smallest size the screen shrinks to, so about two
  thirds is cut off with no sign.
- **Not done:** a truthful sign needs the congregation screen to tell the operator window that its text did not fit (a new message
  between the windows and a new mark in the operator window), and a sign on the congregation screen itself would be seen by the room.
  Neither is a small change.

### 10. Two comments reworded (comment-only commit)

The comment on the update check's same-major-version rule and the comment on the release workflow's tag rule now describe only what
the code does. No behaviour or workflow step changed.

## Gates

Each run once on macOS (Electron 33), isolated profile, remote port 14316, CDP 9376, mDNS name `born-remote-v1-safety`.

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 1047 of 1048 passed on the one run; the one failure was a source-text test counting the series fallback, which the bug 7 change rewrote. The test was updated to check both places still fall back (3/3); the songs teardown flake did not occur |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| `data-safety-app.cjs` (bugs 1, 2, 8) | 13/13 (7 of the first 12 failed before the fixes; the 13th, quit by signal, failed before its follow-up fix) |
| `queue-save-full-disk.cjs` (bug 3) | 7/7 |
| `phone-data-safety.cjs` (bugs 4–7, Chromium and WebKit) | 49/49 (45 failed before the fixes) |
| Phone/iPad sweep `remote-viewports.cjs` | 720 screens measured, 0 page errors, the on-screen keyboard covers no focused field. Role pass (Song Leader, Preacher, Operator, an invented role × iPhone and iPad × portrait and landscape × 100% and 150% text, every tab plus the Save question and Try again): 384 screens, 0 page errors. Every control reported as covered is under the first-run "Add this to your Home Screen" sheet, as in the last round; small targets and small text are the existing tab labels, kind tags and the sheet's Close (34 px), none new |
| `remote-probe.cjs` | 23/23 |
| `remote-reconnect.cjs` | 8/8 |
| Branch CI | none: the workflows run on a release tag or by hand |
| Identity | appId `com.joshmuepu.born`, productName "Branham or Nothing", version 1.13.6, port 4316, icon SHA-256 a9dd996d / 805174be / 4f3e98c7, tag gate `^v1\.[0-9]+\.[0-9]+$`; no workflow files added; `release.yml` change is comments only |

## Judgement calls

1. **Corner window size and place:** bottom-right, a third of the screen wide, 16:9: big enough to read, and the header, search and
   queue stay in view. It is a normal window, so it can be moved or resized.
2. **No setting for bug 1:** choosing this computer's own screen under Screens already puts the congregation screen full screen on one
   display, so removing the automatic full screen loses no function.
3. **The app's own Quit buttons are not asked about.** "Restart to update" and "Quit BORN" (after a manual update) quit on purpose; the
   update has already started, so a question there could leave the update half done.
4. **Queue save notice wording** follows the existing settings notice ("…could not be saved (the data folder may be full or
   read-only)…"), and uses the panel's name, Service Queue.
5. **The phone's Save question** only applies to the phone (it sends "ask"). The `save-queue` command without it keeps replacing, so
   any other caller keeps its behaviour.
6. **Bug 6:** the sheets that already said "Couldn't load" got the Try again button the brief asks for; the wording matches the phone's
   existing "The list could not be read from BORN" / Try again pattern.
7. **Bug 8:** the fix takes what is on the congregation screen from BORN's main process, which always knows it, so it covers any way of
   putting something there, including future ones.
8. **Bug 9:** not done (see above).
9. **Unit tests in jsdom** call the phone's button functions directly (jsdom does not run inline click handlers); the real clicks are
   checked in Chromium and WebKit by `phone-data-safety.cjs`.
10. **Remote regression scripts:** `remote-probe.cjs` and `remote-reconnect.cjs` now take their ports from the environment (defaults
    unchanged), so they ran on 14316 and 9376 like the rest.
11. **No branch CI to wait for:** the repo's workflows run on a release tag or by hand; none runs on a branch push. A manual release
    dry run was not started (the brief says not to start a release).

## Not verifiable here: the owner's checklist

On the church PC (Windows) with the real projector:
1. Unplug the projector, open BORN, project a verse: the congregation screen is a window in the bottom-right corner, and the main
   window works. Plug the projector in: it goes full screen on the projector.
2. Screens → choose the PC's own screen for the Congregation screen: it goes full screen there. Set it back to Automatic.
3. With a verse up, close BORN from the taskbar (right-click → Close window) and with Alt+F4: it asks; press Enter: BORN stays open.
   Hide the screen, close again: no question.

On a Mac:
4. With a verse up, Cmd+Q and Dock → Quit: it asks; Enter keeps BORN open.

On a real phone and an iPad:
5. Save this service as "Test", then again as "Test": it asks; Keep both makes "Test (2)"; Replace it replaces; Cancel does nothing.
6. Start a Save and turn Wi-Fi off straight away: it says it was not saved, never "Saved".
7. With BORN closed, open Series / a Bible chapter: "Couldn't load this from BORN." with Try again; start BORN, tap Try again: it loads.

## Remaining risks

- **Windows:** the Quit question was checked on macOS. On Windows the same `before-quit` question applies, but closing the window from
  the taskbar goes through the existing close question first; both were not run on Windows in this round.
- **Logging off or shutting down** the computer while something is live now meets the question too, and waits for an answer.
- **The corner window** can end up behind the operator window when the operator clicks the operator window; it is a normal window and
  can be brought forward or moved. The stage monitor already behaves this way with no spare screen.
- **Bug 9** stays: a very long page is still cut off without a sign.

## Not done

- Item 9 (a sign for text that does not fit): needs new messaging between the windows and a new mark in the operator window; a sign on
  the congregation screen would be seen by the room.

## Proposed changelog entry (not committed)

```
## 1.13.7

**On the projected screen**
- With no projector connected, the congregation screen opens as a window in the corner of your screen instead of covering BORN's main
  window. It goes full screen on the projector as soon as one is connected. To put it full screen on your own screen, choose your own
  screen under **Screens**.
- Quitting BORN (the menu, Cmd+Q, the Dock or the taskbar) while something is on the screen now asks first, as closing the main window
  already does. **Keep BORN open** is the default, so Enter alone never takes the screens down.

**In the app**
- If the Service Queue cannot be saved (a full disk or a read-only folder), BORN now says so once. The queue stays in the window and
  BORN tries again with your next change.

**On the phone and iPad**
- **Save this service** under a name that already exists asks first: **Cancel**, **Keep both** (saved as "Name (2)") or **Replace it**.
- If the connection drops during a Save, the phone says the service was not saved. It says **Saved** only once the computer has saved it.
- Lists that can't be read from BORN (a saved service, a series, a sermon, a Bible chapter, On This Day, Recently Played) say so, with
  **Try again**. A Bible chapter no longer shows "Loading…" for ever, and a song that can't be opened says so.
- After BORN's main window is restarted, the phone still shows what is on the screen instead of "Nothing on screen yet".

Nothing new was added beyond these questions and Try again buttons. Your saved services open and save exactly as before.
```
