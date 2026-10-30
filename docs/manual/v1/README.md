# Maintaining the v1 manual

This is the in-app manual (the **Help** button / <kbd>F1</kbd>), source of truth in
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

The seven screenshots the Help pages use (the six `operator-*.png` and
`mobile-remote-queue.png`) are retaken in one go from the real app with a
throwaway profile:

```
npm run build
PW_DIR=/tmp/born-pw node scripts/qa/manual-screenshots.cjs /tmp/born-docsshots /tmp/born-docsshots-out
```

(`ELECTRON_RUN_AS_NODE` must be unset; Playwright is loaded from `PW_DIR`, it
is not a dependency.) Pictures may show only the app's own screens, invented
songs and the KJV — never sermon text: the script replaces any sermon titles
and paragraphs on screen with placeholders, and the test address with the
default `10.0.0.124:4316` / `born-remote.local`. Look at every picture before
committing it, and keep each file under 300 KB.

**Not covered by the script, captured by hand:**

- `remote-connection-check.png`, `remote-network-selector.png`,
  `remote-network-show-all.png`.
- A real external display, a real phone on real hardware, Windows, and
  high-DPI scaling — none of these can be faked from this script and must be
  checked by hand if a change touches them.
