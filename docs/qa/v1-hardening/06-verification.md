# 06 · Verification

All on isolated profiles (own data folder, remote port, mDNS name, debugging port). The owner's running v2 dev instance (debugging port 9346, `born-remote-v2.local`) and real v1 data were never touched.
Repeat everything with `bash scripts/qa/run-all.sh` (needs Playwright in `/tmp/born-pw` for the remote probes).

## Final pass on the last commit
| Check | Result |
|---|---|
| Typecheck (`npm run typecheck`) | clean |
| Unit tests (`npm test`) | **61 files, 745 tests, all pass** on the final commit (start of the round: 44 files, 665 tests; **+17 files, +80 tests**). The runner's own `npm test` step hit the known flake below (`732 passed (745)`); the next `npm test` and a JSON-reporter run were 745 / 745 |
| Production build (`npm run build`) | builds |
| `layout-probe.cjs` (dialogs at 4 sizes/scales, header, status popover, start screen) | 19 / 19 |
| `output-probe.cjs` (projector and stage, real layout in Chromium, 1366×768 and 1920×1080) | 6 / 6 |
| `remote-probe.cjs` (remote page, Chromium **and** WebKit) | 23 / 23 |
| `remote-reconnect.cjs` (offline and heal, Chromium and WebKit) | 8 / 8 |
| `input-probe.cjs` (long text, emoji, RTL, pasted HTML) | 24 / 24 |
| `flows.cjs` (600-item queue, restart, Tab focus) | 8 / 8 |
| `sweep.cjs` (10 surfaces × 3 sizes × 3 scales × 2 themes) | **0 findings** (56 + 30 before the popover fixes) |
| `verify-libraries.cjs resources` | 6 / 6 |
| v1 had no regression scripts of its own | the probes above are the new ones |

## Packaged macOS smoke (`smoke-macos-packaged.cjs`, arm64 `.app`, 11 / 11)
Bundled libraries present (6/6); bundle id `com.joshmuepu.born`, name "Branham or Nothing", version 1.13.1; **icon `805174be…` unchanged**; main window loads;
remote answers; frame protection header present; sermon search 200 results, song search 24, Bible lookup returns a passage; libraries as seeded 6/6; the log shows a normal start and no `[ERROR]` lines.
(The x64 build was not built here; the Windows and arm64 builds were.) *The `dist-installers/mac-arm64/` intermediate folder (git-ignored) was rebuilt by this check.*

## Old-file compatibility (`compat.cjs`)
Four formats were loaded into the real app (through the phone remote's `open-service`, the same renderer path as File → Open) and saved back (`save-queue`):
1. a v1.0-style bare list of quotes (before items and slides existed),
2. v1.6–v1.12 items (quote / Bible / song, no `source`, no `songKey`),
3. v1.13 items (contributor `source` and `songKey`),
4. a file from a newer BORN with fields v1 does not know (`ext`, `futureField`).
Result: **the output of this branch is identical to the output of `origin/main` for all four, and for the autosaved `queue.json`.** Formats 2, 3 and 4 come back **identical to the input file**; format 1 is converted to items exactly as `main` converts it. No file format or schema changed. (Fixtures use placeholder text; song items use songs that exist in the seeded library, read at run time, nothing stored.)
Fix 16 changes only what is drawn, so a saved file is never rewritten differently.

## Identity (unchanged)
Version **1.13.1** · `appId` `com.joshmuepu.born` · productName "Branham or Nothing" · remote default port **4316** · data folder unchanged ·
icons `icon.png` **a9dd996d** · `icon.icns` **805174be** · `icon.ico` **4f3e98c7** (checked in the repo, in the macOS bundle, and in the Windows exe).
`git diff origin/main` shows no change to `package.json`, `package-lock.json`, `build/`, `resources/`, `docs/manual/`, `electron.vite.config.ts` or any file under `.github/`.

## Windows
See `04-windows.md` (three runs; real path green; unit tests 0 failures after the test fixes).

## What could not be verified here
- **A real Ctrl/Cmd+R key press in the installed app.** The debugging port cannot inject a menu accelerator (an injected Cmd+R does not reload even the unpackaged app, so the check cannot tell a working guard from no reload at all). The key rule is unit-tested, the wiring is `before-input-event` + `preventDefault` (documented to also stop the menu shortcut), and Electron's default menu has the Reload roles. **Please press Ctrl/Cmd+R once in the installer build before releasing** (10 seconds: open BORN, press it; nothing should flash or reload).
- Projection / stage windows end to end, real drag-and-drop, the Windows console flash on update, a first phone run: see `03-fresh-hunt.md`.

## Known flake (not caused by this round)
`src/test/main/songs.test.ts` occasionally ends with "Worker exited unexpectedly" (a native crash in `better-sqlite3`'s `Statement` destructor at test-process teardown). When it happens the summary reads `60 passed (61)` / `732 passed (745)` and the 13 tests of that file are not counted; running again passes.
Measured over 30 isolated runs each: `origin/main` 2 crashes, this branch 1 (and 0 without the `Promise.withResolvers` shim, i.e. the same range). It was already visible in the very first baseline run. Left as is.
