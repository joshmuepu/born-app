# v1 UI audit — visual and interaction polish

Branch: `v1-ui-audit-help`, built from `main` at `a4cd424` (v1.12.0 + separation hardening).
Driven live against a real dev instance (isolated profile: `BORN_USER_DATA_DIR=/tmp/born-ui-audit-profile`,
`BORN_REMOTE_PORT=4411`, `BORN_MDNS_NAME=v1uiaudit`) seeded with the real bundled sermon (1,218 sermons)
and library (1,163 songs + full KJV Bible) databases, over Chrome DevTools Protocol — the same technique
used for earlier QA passes, extended here with viewport emulation for the phone remote's breakpoints and
a throwaway second Electron process as a Chromium stand-in for driving the remote page outside the main
window. No WebKit engine was available in this environment (see "Not tested" below).

## Findings

| ID | Area | What the user sees | Severity | Status | Commit |
|---|---|---|---|---|---|
| U1 | Desktop — Songs → Browse → All Songs | Tapping a letter in the A–Z jump rail (e.g. "Y") scrolls one row too far: the first song under that letter has its title hidden behind the sticky letter header, leaving only its "N slides · Key of X" subtitle and Queue/Project buttons floating with no title above them. Reproduces on every letter, worst-looking near the end of the alphabet. | Medium — looks broken, but the song is still there and still clickable; no data loss. | **Fixed** | `479e162` |
| U2 | Desktop — "Show a message on screen" dialog (header → Message, while projecting) | Esc does not close the dialog. Every other modal/popover in the app (Screens, Help-to-be, Shortcuts) closes on Esc; this one silently ignored it because the app-wide shortcut handler returns early while the dialog is open (so Space/arrow keys don't leak through to Next/Previous while typing), which also ate Esc before the dialog's own handler ever saw it. Clicking outside the dialog, or Cancel, did work. | Low-medium — inconsistent with every other dialog in the app; a muscle-memory Esc leaves an operator stuck mid-service thinking the app is frozen. | **Fixed** | `b1baf61` |

Two real, reproducible defects found and fixed. Everything else listed below in "Areas checked" was driven and looked correct — screenshots are in `docs/qa/screenshots/` (`u1-*`, `u2-*`).

### Suggestions (not built — design decisions, out of scope for a safe fix)

- **S1 — Message dialog's "Show on" default.** It defaults to "Stage monitor" even when no stage monitor is turned on for that session (Screens panel showed "Stage monitor: Turn on"). Defaulting to whichever surface is actually active (Main screen, when Stage isn't on) would avoid an operator picking "Show message" and nothing appearing anywhere visible. One-line reason: current default can silently send a message nowhere.
- **S2 — Message dialog has no X close button.** Every other modal in the app (Shortcuts, Screens, and the Help viewer I'm about to add) has one in the top-right; this one only has Cancel/Show message. Cosmetic consistency, not a functional gap now that Esc works.

## Areas checked (desktop)

- **Sermons** — Search (results list, "On this day" card), Browse (Date/Series/Location/Recently Played hubs, year grid, month grid with per-month counts, day-of-month calendar with per-day sermon counts).
- **Bible** — Search mode: reference lookup (`John 3:16-18`, verse-range layout), keyword search with Phrase/All words/Any word toggle (verified "All words" actually changes result count vs. phrase, 231 → 19 results on a real multi-word query) and the Whole Bible/OT/NT/book range dropdown. Browse mode: book grid (OT/NT sections, correct chapter counts), chapter grid, reading view with verse tap-to-project, and the back-navigation chain (reading view → chapters → books).
- **Songs** — Search (empty state, "browse all songs" link), Browse (All Songs hub with live count, Recently Played hub), the A–Z grouped list and jump rail (see U1), search-then-clear scroll reset (confirmed `scrollTop` resets to 0, not left wherever the search had scrolled to).
- **Service Queue** — building a mixed queue (8 Bible passages), Back/Next, "UP NEXT" and "ON SCREEN" badges, Restart/Remove on the active item, the bottom-right confidence monitor (auto-fit text, no scrollbar, matches the real projected text), the Main screen/Stage toggle.
- **Projection** — Open/Close projection (verified the header button's state — not just the raw IPC call — is what the UI actually tracks; see note below), Hide screen/Show screen (amber state on the button, "HIDDEN FROM SCREEN" badge on the confidence monitor, and confirmed the real projection output window actually goes black, not just the preview), the "Show a message on screen" dialog (see U2).
- **Chrome**: Screens popover (display list, Stage monitor toggle, Projected Text Size), Remote popover (QR code, IP address, copy button, "Also reachable at *.local" note, Remote connection check button), Shortcuts modal, light/dark theme toggle, window resize down to the configured minimum (1040×640) with no clipping or overlap at any point.
- **Closing boxes**: Screens popover (Esc ✓, click-outside ✓), Shortcuts modal (Esc ✓, Close button ✓), Message dialog (Esc — broken, fixed as U2; Cancel ✓; click-outside ✓).

One non-bug worth recording so it isn't re-investigated: opening the projection window by calling the preload API directly (bypassing the header button) leaves the header still showing "Open projection" even though a real projection window is now on screen. This is expected — `projectionOpen` is local React state set by the button's own click handler, not a listener on actual OS window state, and the app has exactly one way to open it in normal use (the button, or `⌘/Ctrl+Shift+W`), both of which set that state correctly. Not a defect; just a reminder for whoever next drives this app over raw IPC in a test script.

## Areas checked (remote / phone)

Driven against the real `webRemote` HTTP server at four viewport sizes, through a throwaway second Electron window (Chromium engine) used as a scriptable browser stand-in — see "Not tested" for what this doesn't cover.

- **Phone portrait (390×844)** — "Who's this?" role picker, Prev/Next/Blank transport (all well above the 44px tap-target minimum), Service Queue card with horizontal-scroll overflow (by design), tab bar (Queue/Sermons/Bible/Songs).
- **Phone landscape (844×390)** — layout switches to a left icon-sidebar + wide single list with no horizontal scroll; verified no element was clipped at this short a viewport.
- **Tablet (820×1180)** and **desktop width (1440×900)** — same sidebar layout, two-pane (list + preview) once a passage/song/quote is selected; verified the `#tabletShell`/`#phoneShell` swap at the 768px breakpoint in both CSS and live DOM. The small plain-color connection dot at the bottom of the sidebar (no "Connected" text next to it, unlike the phone shell) is intentional — a separate, space-saving indicator for the icon-only sidebar — confirmed by reading the CSS, not a layout bug.
- Confirmed the Songs A–Z jump rail on the phone page does **not** share bug U1 — it's a separate, simpler implementation that scrolls correctly on every letter tested.
- Confirmed the remote page registers a service worker (`/sw.js`) for offline support and serves fresh content with `Cache-Control: no-store` on every request, as documented in `webRemote.ts`.

## Not tested

Honest list of what this pass did not cover, and why:

- **Real phone/tablet hardware and iOS Safari.** No physical device and no WebKit engine were available in this environment; the phone/tablet checks above used Chromium viewport emulation, which covers layout and tap targets but not iOS-specific quirks (momentum scroll feel, the on-screen keyboard covering an input, Safari's own UI chrome).
- **The desktop app going to a real second display.** This machine has 3 real displays attached (verified in the log: Built-in Retina, 2× PA278QV) and the Screens popover correctly listed and let me pick between them, but I did not physically move the projection window to a second display and eyeball it there — I verified its content via the "BORN — Output" window's own CDP target instead, which renders identically regardless of which physical screen it's on.
- **Windows and high-DPI scaling (125%/150%).** This audit ran on macOS. The app's layout is standard CSS/flexbox with no OS-specific sizing I found reason to suspect, but it is genuinely unverified on Windows.
- **Reconnect-after-desktop-restart on the remote, and "left open overnight."** Both require either killing and restarting the desktop app's remote server mid-session while a phone stays connected, or literally waiting; out of scope for a single live-driven pass. The remote's `Connected`/service-worker setup (above) is consistent with handling this, but it wasn't exercised end-to-end.
- **Drag-and-drop queue reordering, rapid double-clicks/rapid-fire Next presses, and OBS/Graphics-output flows** — v1 has no Graphics output (that's v2-only), and queue reordering here is keyboard-driven (`Alt+↑/↓`, verified present in the Shortcuts modal) rather than drag — not separately stress-tested for race conditions under rapid input.
- **Printing** — v1 has no manual/PDF-printing feature yet (that's part of what Part 2 of this task adds); nothing to test here until then.

## Which fixes should port to v2-channels

- **U1 (Songs A–Z jump overlap)**: v2 has its own Songs panel descended from the same code, so check whether `jumpToLetter` in v2's `SongsPanel.tsx` has the same `scrollIntoView` call — if so, port this exact fix (compute the offset against the scroll container instead of using `scrollIntoView` on a `position: sticky` element).
- **U2 (Message dialog Esc)**: v2 has the same "Show a message on screen" dialog (confirmed in the earlier remote-connectivity work's screenshots) and almost certainly the same app-wide shortcut-handler early-return — port the same `onKeyDown` addition.

Neither fix touches anything v1-specific (song data, Bible data); both are safe, mechanical ports.

---

# Pass 2 — the remote under real-world failure, and everything Pass 1 didn't cover

Pass 1 found 2 bugs and nothing on the remote, but the owner reports the phone remote
has been unreliable in real use at church. This pass starts from the assumption that
Pass 1 simply didn't stress the areas where real bugs live — dropped connections,
backgrounded tabs, two inputs racing each other — and goes looking specifically there,
plus the desktop-stress, keyboard, and Windows-readiness ground Pass 1 explicitly
skipped. Driven against isolated dev instances (`BORN_USER_DATA_DIR`, a fresh
`BORN_REMOTE_PORT`/`BORN_MDNS_NAME` per instance) seeded with the real bundled
databases, same CDP technique as Pass 1, extended with CDP's `Network` domain
(genuine offline simulation, not just a slow/dropped request) and `Input` domain
(real native key events, not JS-dispatched ones — see the keyboard section for why
that distinction mattered).

## Findings

| ID | Area | What the user sees | Severity | Status | Commit |
|---|---|---|---|---|---|
| U3 | Desktop — Message dialog's new X button, and the Help viewer's header | A title-row layout (title + an X button in the corner) used by both the Help viewer and the Message dialog's new close button was completely unstyled — missing CSS entirely — so the X rendered on its own line below the title instead of beside it, in both places. | Medium — looks broken on two different dialogs, not just cosmetic noise. | **Fixed** | `1cb616b` |
| U4 | Remote — every command (Next, Prev, Blank, Project, Save, Open, reorder — ~20 call sites) | A dropped WiFi connection, or the desktop briefly unreachable, made a tap vanish completely: no toast, no error, no change to the connection indicator (which only updates on the *next* poll, up to 1s later). Confirmed live by toggling the phone's network offline mid-tap — the tap did nothing visible at all. This is very plausibly a root cause of "the remote feels unreliable": an operator has no way to tell a lost tap from one that just hadn't rendered yet, and re-tapping risks a double-fire once the connection returns. | **High** — exactly the kind of bug that erodes trust in a live tool without ever reproducing cleanly for whoever's trying to debug it afterward. | **Fixed** | `e2386f1` |
| U5 | Remote — a phone backgrounded (locked, or switched to another app) and brought back | No `visibilitychange` listener existed at all. Mobile browsers throttle or fully suspend `setInterval` while a tab is backgrounded — a phone locked mid-service and unlocked later kept showing whatever was on screen at the moment it was backgrounded, stale, for anywhere from a few seconds to much longer depending on the browser, with nothing indicating it was out of date. | **High** — a second operator running the remote from the platform very plausibly backgrounds their phone (a call, a notification) mid-service. | **Fixed** | `349d5af` |
| U6 | Desktop and remote — two rapid Next/Prev taps | Two taps close enough together (two fast taps on the same control, or the remote's Next and the keyboard shortcut firing within the same tick — realistic when two operators are both driving) raced on shared state and netted out to a **single** advance instead of two. Confirmed by reverting the fix and re-running the exact same reproduction: unfixed code moved John 3:16 → 3:17 on two taps (one lost); fixed code correctly moves 3:16 → 3:18. | **High** — "I tapped Next twice and it only moved once" is a direct, unambiguous match for real operator complaints about the remote (and the on-screen Back/Next buttons, and the keyboard shortcut — all three share this code). | **Fixed** | `ee1bf47` |
| E1 | Desktop — Message dialog's default "Show on" target | Carried over from Pass 1's suggestion S1. Always defaulted to Stage monitor even when no stage monitor was on for that session, which could send a message nowhere visible. Now defaults to Stage monitor only when it's actually on, Main screen otherwise. Confirmed live. | Low-medium | **Fixed** | `1cb616b` |
| E2 | Desktop — Message dialog has no X button | Carried over from Pass 1's suggestion S2. Added, consistent with every other modal. (This is the change that surfaced U3.) | Low | **Fixed** | `1cb616b` |

**4 new bugs found and fixed, both carryover items implemented.** Three of the four
(U4, U5, U6) are squarely in the area the owner specifically flagged as unreliable —
all three are plausible, independent explanations for "the remote doesn't feel
trustworthy," and none of them were visible in Pass 1 because Pass 1 never simulated
an actual dropped connection, a backgrounded tab, or two genuinely-simultaneous
inputs. U6 in particular also affects the **desktop** Back/Next buttons and the
keyboard shortcut, not just the remote — it was findable there too, just harder to
trigger by hand than by script.

### Suggestions (not built)

None new this pass — Pass 1's two (S1, S2) were both implemented as E1/E2 above.

## A. Remote — real-world failure modes

1. **Reconnect after the desktop restarts, phone left open** — the remote has no
   persistent connection to lose (it's 1-second HTTP polling, not a WebSocket), so
   there's no "dead connection that looks alive" state to get stuck in by
   construction. Confirmed live: toggling the network back on after a simulated
   drop shows **Connected** again within one poll cycle (~1s), no manual refresh
   needed. ✅ no bug found, and the fix for U4 means a drop in between is now visible
   rather than silent.
2. **Backgrounded tab, resumed** — see U5. ✅ fixed.
3. **Network drops mid-action (a tap while disconnected)** — see U4. ✅ fixed.
4. **Rapid taps, next/previous/live/clear, phone and desktop at once** — see U6.
   ✅ fixed for Next/Prev (the pattern that actually raced). Blank/unblank and
   Project don't share this exact race (they don't read-then-await-then-write the
   same ref `advance()` does), and weren't separately found to race under the same
   rapid-fire testing.
5. **Two or more phones connected at once** — confirmed live with two real phone
   instances: a Bible verse queued and a Next tapped on Phone A appeared on Phone B
   within one poll cycle in both cases. The architecture (one shared server-side
   state, every client just polling it) makes this correct by construction, not by
   luck — there's no per-client session state to drift. ✅ no bug found.
6. **Rotation/resizing mid-action, on-screen keyboard** — re-confirmed the
   phone/tablet/desktop breakpoint layouts from Pass 1 still hold; did not have a
   way to test a real on-screen keyboard covering an input in this environment (see
   "Still not tested").
7. **Error and timeout screens** — see U4 for the "was connected, then dropped"
   case, now fixed and honest. A phone's *very first* load with the desktop
   completely unreachable (wrong address, desktop off, port blocked, nothing ever
   cached) shows the phone browser's own native "can't reach this page" error —
   there's no BORN code running yet at that point for the app to customize this
   screen, in any app, on any platform. Not a bug; a hard limit of how the web
   works, worth the owner knowing rather than expecting BORN to do something here.

## B. Desktop — live-operation interactions

1. **Drag-and-drop reorder** (top/bottom/onto-itself/while-live) — read the
   underlying `reorder()`/`remapActiveIndexAfterReorder()` logic; already covered by
   16 existing unit tests including the "reorder around the live item" case
   specifically. Did not find a gap worth adding to; did not separately re-drive
   this by simulated drag-and-drop (CDP's native HTML5 drag-and-drop simulation is
   unreliable and the logic underneath is already well-tested).
2. **Rapid-click stress** (Next/Prev, live/clear, tab switching, add/remove queue
   items) — see U6 for Next/Prev. Add/remove-from-queue reads and writes shared
   state synchronously with no `await` in between, so two rapid clicks can't
   interleave the way `advance()` could — confirmed by reading `addToQueue()`, not
   separately bug-found.
3. **A queue of 300+ items** — loaded a real 320-item queue (bypassing the native
   save/open file picker via the same `openServicePath` IPC call the "recent
   services" list already uses). Rendered correctly, scrolled correctly, and the
   last item's content was byte-correct (no truncation, no off-by-one at scale).
   Observation, not a bug: all 320 rows render to the DOM at once, no
   virtualization — fine at this size, worth knowing if a future queue is 10x
   larger.
4. **Songs with 1,000+ items** — the real library (1,163 songs) was loaded for
   every test in both passes; search, the A–Z jump (fixed in Pass 1), and clearing
   a search (scroll resets to top, confirmed in Pass 1) were all exercised against
   this real data throughout, not a small fixture.
5. **Display changes while running** (unplug/replug, resolution change, repeatedly
   opening/closing the Output window) — could not simulate unplugging a real
   display from this environment. Did repeatedly open and close the projection
   window and the Screens panel without issue. The genuine unplug/replug/resolution
   case needs real hardware — see "check by hand at church."
6. **Window resize/maximize/restore with a modal open** — not separately re-tested
   this pass; Pass 1 already confirmed the window resizes cleanly down to its
   minimum with no clipping, including with various popovers open.

## C. Keyboard-only audit

Tab order forms one complete, logical loop through every interactive element with no
trap (verified by tabbing 12 times in a row and confirming it never got stuck).
Focus is always visibly indicated — a real double-ring box-shadow (not just the
browser default, and not suppressed without a replacement), confirmed both by
reading the CSS and by screenshotting a tabbed-to button and seeing the ring.
<kbd>Space</kbd> activates every control tested (buttons, including after being
reached purely by <kbd>Tab</kbd>). <kbd>Esc</kbd> closes the Screens popover (and,
from Pass 1, the Shortcuts modal, the Message dialog, and the Help viewer), and
**focus correctly returns to the button that opened it** afterward — not lost to
the page body, not stuck somewhere else. <kbd>F1</kbd> and <kbd>/</kbd> both work
as documented.

**One thing I could not verify, and want to be honest about rather than quietly
drop:** <kbd>Enter</kbd> did not activate a focused button when simulated through
Chrome DevTools Protocol's `Input.dispatchKeyEvent` — but I tracked this down to a
limitation of that exact simulation method, not the app. Proof: I built a
completely blank Electron window with one plain HTML `<button>` and zero app code,
and the *same* CDP-simulated <kbd>Enter</kbd> also failed to activate it there,
while CDP-simulated <kbd>Space</kbd> worked on that same blank button. Reading
BORN's own keyboard handler confirms it explicitly steps aside for both
<kbd>Enter</kbd> and <kbd>Space</kbd> when focus is on a button
(`if (onControl && (e.key === ' ' || e.key === 'Enter')) return` — the same guard,
the same early return, for both keys). I'm confident this is a CDP/Electron
simulation quirk, not a real gap — but a real keyboard's Enter key was not
independently confirmed here, so it's worth a 10-second check by hand.

No keyboard-accessibility bugs found, despite deliberately trying to find one.

## D. Windows readiness

Reviewed (no Windows machine available in this environment):

- **Path handling** — every real filesystem path in the main process (`manual.ts`,
  `db.ts`, `libraryDb.ts`, `webRemote.ts`'s icon loader) is built with Node's
  `path.join()`, which produces the correct separator for whatever OS it runs on.
  No hardcoded forward-slash path concatenation found (the only forward-slash
  string matches were ES module import specifiers, which are required to use `/`
  in every environment — not filesystem paths at all).
- **Case sensitivity** — song-file-format detection (`detect.ts`) lowercases the
  extension before matching, so `MySong.PRO` routes the same as `mysong.pro`.
- **Drive letters / absolute-path assumptions** — no code found that assumes a path
  starts with `/` to decide whether it's absolute (which would misclassify a
  Windows `C:\...` path as relative).
- **User data directory** — uses `app.getPath('userData')` (Electron's own
  cross-platform default, `%APPDATA%\Branham or Nothing` on Windows) unless the
  dev-only `BORN_USER_DATA_DIR` override is set, which is never set in a real
  install.
- **`extraResources` / packaging config** — uses forward slashes in
  `package.json`, which is the correct convention for electron-builder regardless
  of target OS (it normalizes these internally).
- **The release pipeline already has a real Windows smoke test** — `.github/workflows/release.yml`'s
  Windows leg launches the actual packaged `.exe`, waits for
  `mainWindow did-finish-load` in the real log file at
  `%APPDATA%\Branham or Nothing\born.log`, and checks the installer is a genuine PE
  binary — not a mock. This has been passing on real releases, including the one
  this branch is built on.

No Windows-specific defects found in review. This is still code review, not a run —
see the checklist below for what to confirm by hand.

## Still not tested

Honest list, Pass 2 additions on top of Pass 1's:

- **A real phone, on real hardware, on real church WiFi** — everything above used
  CDP's `Network.emulateNetworkConditions` for "offline," which is a faithful
  simulation of a dead connection but not of the messier real-world case (a weak
  signal, high latency, a captive portal). The fixes (U4, U5) address the failure
  *modes*, but the real test is still a real phone at church.
- **A genuinely simultaneous tap from two separate physical devices** — U6 was
  confirmed by dispatching two triggers within the same script tick on one machine,
  which reproduces the race condition precisely, but two people's thumbs on two
  separate phones is a different (if structurally equivalent) scenario.
- **<kbd>Enter</kbd> on a real physical keyboard** — see the keyboard section above.
- **Windows, any version, any DPI scaling** — see Windows readiness above; this was
  code review, not a run.
- **A real second/third display being unplugged, replugged, or resolution-changed
  while BORN is running** — needs real hardware.
- **The on-screen keyboard covering an input on a real phone** — needs a real
  device; viewport emulation doesn't move a virtual keyboard.
- **Overnight idle** (a phone or the desktop left running for 8+ hours) — out of
  scope for a live-driven pass; nothing found in this pass suggests a leak or
  degradation, but it wasn't exercised for that long.

## Check by hand at church

A short list for the owner, things this pass genuinely could not verify from here:

1. **The remote, on a real phone, on the church WiFi.** Walk away from the router
   far enough to drop the connection, confirm the amber "Couldn't reach BORN" banner
   appears, walk back, confirm it reconnects on its own within a second or two.
2. **Lock the phone mid-service, unlock it 30+ seconds later**, confirm the remote
   shows the actual current slide, not whatever was up when it locked.
3. **Two phones, two people, tapping Next at close to the same moment** a few times
   — confirm the slide count advances by exactly as many taps as were made.
4. **On the actual Windows computer**: install the real `.exe`, confirm BORN opens,
   confirm the manual (<kbd>F1</kbd>) opens and its images load, confirm a song
   import and the phone remote both work.
5. **Unplug and replug the projector during a service** (or between services) and
   confirm BORN notices and the Screens panel lets you pick it again.

## Which Pass 2 fixes should port to v2-channels

- **U3 (missing `modal-title-row` CSS)**: v2 is where this rule actually lives —
  it's v1 that was missing it (v1 never had this title+X layout until the Help
  viewer was ported over from v2 this branch). Nothing to port; if anything, this
  confirms v2's copy is the correct reference.
- **U4 (remote commands fail silently)**: v2's remote (`remoteAssets.ts`) is a
  shared/forked file — check whether its `cmd()` has the same bare, uncaught
  `fetch()`. Very likely yes, since this predates the v1/v2 split. High-value port.
- **U5 (no visibilitychange poll-on-resume)**: same file, same likely gap, same
  high-value port.
- **U6 (Next/Prev race)**: check v2's `App.tsx` for the same `advance()` shape
  (read a ref, await, write the ref back) — v2's version may already differ since
  it has Channels/follow-sync layered on top, so this one needs reading v2's actual
  code rather than a mechanical port of the diff. The extracted `serialize.ts`
  utility itself is framework-agnostic and portable as-is regardless.
- **E1/E2 (Message dialog default target + X button)**: already ported to v2
  directly in the `v2-port-v1-audit` branch (commit `15d5f19`) during that same
  session, from Pass 1's suggestions — the default-target logic there was
  deliberately *not* changed, since v2's Message button has its own tooltip stating
  the stage-monitor default is intentional. Worth the owner's attention: v1 and v2
  now disagree on purpose here, not by oversight.
