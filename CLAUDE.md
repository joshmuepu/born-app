# This folder: BORN v2 ("Born Again")

Unreleased. Branch `v2-channels`. Never tag or release from here.
Internal identity stays `2.0.0-dev.N` / `com.joshmuepu.born.v2dev`
until the owner says otherwise. v1 fixes arrive via `git merge main`.
Nothing under `docs/commercial` is ever pushed.

## v1 parity

- At the start of every session in this folder: `git fetch`, then
  `git log v2-channels..origin/main --oneline`. If that shows anything,
  tell the owner what it is before doing other work. Never merge it in
  without being asked.
- v2 must always get every v1 fix. Port a bug fix by its intent into
  v2's current code (the UI is being redesigned, so a diff may not
  apply as-is), add or adapt a test for it, and record it in
  `docs/V1-PARITY.md`.
- v1 *features* are not merged automatically. Each gets its own entry
  in `docs/V1-PARITY.md` (not started / investigating / ported /
  intentionally different) and the owner decides if/when it's ported.
- Never overwrite v2's identity or the `v1.x.x`-only release tag gate
  when merging `main` in.
- The Born Again UI redesign has landed (see below), so most v1 UI diffs
  will not apply as-is: port the *intent* into the shared components, and
  record it in `docs/V1-PARITY.md`.

## UI conventions (Born Again)

The visual language, layout, drill-down pattern and component decisions
live in `docs/design/born-again-ui-direction.md`; follow it for any new
UI. In short:

- Colours, radii, motion and layers come from the tokens in
  `src/renderer/src/App.css` (mirrored, with the full set, in
  `docs/design/tokens.css`). Never hard-code a colour; use a token, and
  keep `src/test/shared/themeContrast.test.ts` green (it guards AA/AAA
  contrast for dark, light and high-contrast, and the remote's tokens).
- Reuse the shared components before writing a new one: `DrillShell`
  (columns left, content right), `VirtualList`, `PanelResizer`,
  `ContextMenu`, `Toasts` (undo), `SlideThumb`, `PreviewLivePair`,
  `CommandPalette`. Destructive queue actions get an Undo toast, not a
  confirm, unless something is live.
- Red is only for live/destructive; connected/ok is green. Nothing a
  user can do from a menu, drop or history may change what is live
  unless they take it.
- Interface scaling is CSS zoom on the app root, never browser zoom (it
  would also zoom the projection output). Pointer maths must use
  `currentUiZoom()`.
- Honour `prefers-reduced-motion`; keep everything keyboard-operable.
- **Words:** one word per job, from `src/shared/glossary.ts` (Show, Next/Back, Hide screen/Show screen, Clear, Projection). Never "Project" or "Take" in anything an operator reads; `src/test/repo/glossary.test.ts` enforces it.
- **Layout rules follow the interface scale:** use `html[data-cssw]` / `html[data-w~='…']` (set in `uiScale.ts`), never `@media (max-width)` — a media query sees the window, not the scaled page (`headerNarrow.test.ts` enforces it).
- **Sizes:** controls are at least `--target-min` (32 px), the live-critical ones `--target-live` (40 px), 44 px on touch.
- **Esc** closes whatever is open on top and does not also blank the screens; Shift+Esc always blanks (`escRule.ts`). Do not add shortcuts that the default Electron menu already owns (Ctrl/⌘+R, Ctrl/⌘+Shift+R, ⌘+Shift+V …).

## Running and testing safely (learned in the media work)

- **Never run a dev or test launch against real data or ports.** Every launch script and manual run must set
  `BORN_USER_DATA_DIR=<throw-away dir>`, `BORN_REMOTE_PORT=<not 4316>` and `BORN_MDNS_NAME=<name>` (all builds honour them). `ELECTRON_RUN_AS_NODE`
  must be unset when starting Electron (it makes it behave as plain Node). `BORN_TEST_*` hooks answer file pickers in dev/test only; a packaged app ignores them.
- **better-sqlite3 flips between two builds**: `npm rebuild better-sqlite3` for vitest (Node), `npm run rebuild:native` before launching the app (Electron).
  Tests that use sqlite import `src/test/main/keepStatements.ts` (a Node 24 test-runner crash workaround; not an app problem).
- Check `ps` and listening ports before launching: a stale instance on a debugging port answers instead of the new one.
- Media follow-ups: packaged-app checks are in `scripts/packaged-check/`; Windows is only ever built by the manual workflow
  `.github/workflows/v2-dev-build.yml` (never the release workflow).


## YouTube (official player only)

YouTube items play only in YouTube's own embedded player, on the main output only (`src/main/youtubeHost.ts`). Never download, cache, extract streams, block or skip ads,
scrape, or draw anything over the player. Alerts go to the stage monitor only while one is live (`YOUTUBE_ALERT_POLICY` in `src/shared/youtube.ts`). Open legal questions:
`docs/notes/youtube-needs-counsel.md`.

## Graphics / OBS

A Graphics page can be given its own layout with `?profile=lower-third|fullscreen` on its address (no ending = the output's own setting). The live feed pings every 15 s and the
page restarts itself after 45 s of silence. OBS on the same computer should use the `127.0.0.1` address (a `.local` name can take over a minute to recover after a BORN restart).
Launch OBS for tests with `open -a OBS --args …` (not its binary), with a separate profile/collection. Results: `docs/qa/v2-obs-live-report.md`.
