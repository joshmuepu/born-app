# Maintaining the v1 manual

This is the in-app manual (Help menu / <kbd>F1</kbd>), source of truth in
`docs/manual/v1/*.md` + `manifest.json`, rendered live by `HelpViewer.tsx` over
IPC (`src/main/manual.ts`) — not a separate static site, and not duplicated
anywhere else.

**Any user-facing change in v1 — a new feature, a renamed button, a changed
message, a moved control — must update the manual and its screenshots in the
same change.** There's no automated staleness check for this; verify every
"click X" against the real running app before committing.

## Adding or changing a page

1. Edit or add a `.md` file under `docs/manual/v1/`.
2. List it in `manifest.json` under the right section, in the order it should
   appear in the sidebar.
3. Images referenced from a page live in `docs/manual/v1/images/` and are
   referenced with a path relative to the page (e.g. `../images/foo.png` from
   a page one directory deep).

## Regenerating screenshots

Most desktop screenshots are scripted and reproducible:

1. In one terminal, start a throwaway dev instance (a scratch user-data-dir
   keeps this from touching your real settings/recent-services):
   ```
   BORN_USER_DATA_DIR=/tmp/born-docsshots ./node_modules/.bin/electron-vite dev --remoteDebuggingPort 9920
   ```
   (`ELECTRON_RUN_AS_NODE` must be unset in that terminal.) The real bundled
   `sermons.db.gz`/`library.db.gz` need to exist under `resources/` first —
   run `npm run build:db && npm run build:library` if they don't.
2. In another terminal: `node scripts/docs-screenshots.mjs --port=9920`
3. Review each changed image before committing — the script clicks through a
   fixed path and can silently land on the wrong screen if a button's text or
   a selector changed.

**Not covered by the script, captured by hand:**

- `mobile-remote-queue.png` — the phone remote has no desktop equivalent to
  screenshot from the main window. Point a browser (or a second Electron
  window, as a Chromium stand-in — see the git history of this script for the
  harness pattern used to generate the current shot) at the address shown in
  the desktop app's Remote popover, set its viewport to a phone size
  (390×844 was used for the current shot), and capture it the same way.
- A real external display, a real phone on real hardware, Windows, and
  high-DPI scaling — none of these can be faked from this script and must be
  checked by hand if a change touches them.
