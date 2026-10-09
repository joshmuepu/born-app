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
