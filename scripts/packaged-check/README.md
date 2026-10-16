# Packaged-app check (macOS or Windows, real input over the debugging port)

Runs against the **packaged** app (not the dev server), using a throw-away profile.

1. Build: `npm run build && npx electron-builder --mac --arm64 --dir --publish never -c.mac.identity=null`
   (Windows: `npx electron-builder --win --dir --publish never`).
2. Start it (unset ELECTRON_RUN_AS_NODE):
   `BORN_USER_DATA_DIR=/tmp/pkg-profile BORN_REMOTE_PORT=4317 "<app>" --remote-debugging-port=9921`
3. `PKG_IMAGES=<folder with Welcome.jpg, Offering.jpg, Church logo.jpg, Blue hour.jpg, Warm light.jpg, Phone photo.jpg> PKG_PROFILE=/tmp/pkg-profile PKG_OUT=/tmp/shots node scripts/packaged-check/run.cjs`
4. PDF: `node scripts/packaged-check/pdf-drop.cjs <file.pdf>` (drops the PDF on the Media panel).

The BORN_TEST_* hooks are ignored by a packaged app, so these scripts use only real UI and the public window API.
