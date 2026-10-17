# UX regression checklist (run on every UI round)

Use an isolated profile (`BORN_USER_DATA_DIR`, `BORN_REMOTE_PORT`, `BORN_MDNS_NAME`), unset `ELECTRON_RUN_AS_NODE`.

1. `npm run typecheck`, `npm test`, `npm run build`.
2. `bash scripts/regression/run-all.sh` — history, queue drag-and-drop, songs/A–Z, Channels/Destinations/Profiles, phone remote (Chromium + WebKit), Graphics. Every script prints `N checks, 0 failed`.
3. Contrast: `src/test/shared/themeContrast.test.ts` green; look at every changed screen in dark, light and high-contrast.
4. **Sizes:** 1040×640, 1366×768, 1920×1080, with the screens LIVE (Hide screen, Message, Close projection are in the header). The header does not overlap or wrap; the search button shows its icon; the rail reaches Queue.
5. **Interface scale:** 125 %, 150 %, 175 % on 1366×768 and 1040×640. Back, Search, every rail button reachable. (Media queries do not see the scale: use `html[data-cssw]` / `html[data-w~=…]`, never `@media (max-width)`; a repo test enforces it.)
6. **Esc:** with the manual, the Remote panel, the Screens menu and the Message dialog open, Esc closes them and does NOT blank the screens; with nothing open Esc blanks; Shift+Esc always blanks (and pauses the tape).
7. **Dialogs:** every dialog fits at 1040×640 (scrolls inside), has `role="dialog"`, a name, and closes with Esc.
8. **Keyboard only:** Tab through the header, rail and one section; every stop shows a focus ring; Enter and Space operate buttons; the tape bar is reachable and Play/Pause works.
9. **Words:** the same job has the same word in the app, the phone, Help and the manual (see the glossary in 03-proposals P-02 if approved).
10. **Errors:** no raw browser or exception text in any message the operator sees.
11. **Console:** a tour of every section and every popover logs no errors or warnings.
12. **Phone remote:** 360×640, 390×844, a tablet; Blank state obvious; no horizontal scroll.
13. **Tape:** seek from the bar, the Tape place, the reader's paragraph number and the phone in stopped (loaded, never played), paused and playing states.
