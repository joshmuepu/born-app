# BORN v1 release 1.13.7: report

Released from branch `v1-data-safety-fixes` (the round's fixes are described in `docs/qa/v1-data-safety-fixes/report.md`).

## Step 1: the Quit question on paths that are not the operator's own Quit

Something on the congregation screen, then the app asked to quit by each path. Tested in the real app (Electron 33.4.11, macOS) on an
isolated profile, remote port 14316, CDP 9376, with `scripts/qa/data-safety-app.cjs`; the question is recorded by `record-main.cjs`
instead of being shown.

| Path | How it quits | Before | After | How checked |
|---|---|---|---|---|
| The operator's own Quit (menu, Cmd+Q, Dock, taskbar) | `app.quit()` | asks (Keep BORN open is the default) | unchanged | tested here |
| Installing an update (Restart, and Quit BORN after a manual update) | the button calls `app:quit`, which marks the quit as not to be asked | no question | unchanged | tested here (the same call the button makes) |
| A quit by signal (a script, `kill`) | Electron's signal handling | no question (fixed in the round) | unchanged | tested here |
| macOS logout, restart, shutdown | the system announces it (`powerMonitor` 'shutdown') and then quits the app | **asked, and the system would wait on it** | no question | the announcement then the quit, simulated in the real app; a real logout was not done on this computer |
| Linux shutdown | as macOS (`powerMonitor` 'shutdown') | as macOS | no question | read only (BORN is shipped for macOS and Windows) |
| Windows logoff, restart, shutdown | each window is told the session is ending (`session-end`) | **asked, and Windows would wait on it** | no question | the event then the quit, simulated in the real app; not run on Windows |

**Fix** (commit "Quit while live: logging out, restarting or shutting down the computer quits without asking"): on `powerMonitor`
'shutdown' and on the main window's `session-end`, BORN marks the quit as not to be asked, for both the Quit question and the main
window's close question. Electron 33 has no earlier Windows "query" event; `session-end` is the documented Windows event.

**Tests:** `data-safety-app.cjs` gained three checks (update quit, shutdown, Windows session end). Before the fix two of them failed
(the question was asked); after it, 16/16.

**Judgement calls**
- The simulated paths emit the same events Electron emits, in the order the systems send them (the announcement before the quit). That
  macOS sends its logout announcement before the quit request is documented system behaviour and could not be shown here without logging
  out, which this round does not do.
- Help (`operators/blank-clear.md`) and the changelog say that an update, logging out, restarting or shutting down does not ask, so
  nobody expects the question there.

## Gates (each once, on the branch)

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 126 files, 1048/1048 passed |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| `data-safety-app.cjs` (touched by Step 1) | 16/16 |
| Identity | appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316, icon SHA-256 a9dd996d / 805174be / 4f3e98c7, tag gate `^v1\.[0-9]+\.[0-9]+$`; no workflow file added or changed in behaviour |

## Release

- **Base:** `main` was still at v1.13.6 (`64c7d8e`) and the branch was based on it; no rebase was needed.
- **Version and changelog:** version 1.13.7 in `package.json` and `package-lock.json`, with the Help pictures retaken so their footer
  reads v1.13.7 (same pictures as 1.13.6, all under 300 KB); `CHANGELOG.md` entry from the round's report, with one sentence added for
  Step 1; one sentence added to Help (`operators/blank-clear.md`) for Step 1.
- **Merge commit:** `f4256f2` "Release v1.13.7" (`--no-ff`, as 1.13.6).
- **Tag:** `v1.13.7`, annotated, "Branham or Nothing 1.13.7".
- **Release workflow:** https://github.com/joshmuepu/born-app/actions/runs/44235452285, succeeded on the first run (guard, build-db,
  Windows build, macOS build, release).
- **Release page:** https://github.com/joshmuepu/born-app/releases/tag/v1.13.7. Published, not a draft and not a pre-release. The notes
  were set to the changelog entry, as for 1.13.6 (the workflow writes only a "Full Changelog" link).

| Asset | 1.13.7 | 1.13.6 |
|---|---|---|
| `BORN-1.13.7-macOS-arm64.dmg` | 211,695,492 bytes (201.9 MB) | 211,700,897 |
| `BORN-1.13.7-macOS-x64.dmg` | 216,369,084 bytes (206.3 MB) | 216,376,629 |
| `BORN-1.13.7-Windows-Setup.exe` | 185,382,429 bytes (176.8 MB) | 185,390,889 |

The same three platforms as 1.13.6, each within 10 KB of its size. 1.13.6 had no checksum or update metadata files, and neither does
1.13.7. The update check reads `api.github.com/repos/joshmuepu/born-app/releases/latest`, which now reports `v1.13.7` with these three
installers. Nothing was installed on this computer.

- **Website:** `joshmuepu-site` commit `9c52a3c` "BORN 1.13.7: version, changelog entry, download links and dates" (the same files as
  for 1.13.6: `born.html`, `changelog.html`, `index.html`, `netlify.toml`, `sitemap.xml`). Live on joshmuepu.com within a minute:
  born.html shows v1.13.7 and November 17, 2026; the home page shows BORN 1.13.7; the changelog lists v1.13.7 first;
  `/download/mac-arm`, `/download/mac-intel` and `/download/windows` lead to the 1.13.7 installers, which answer 200. The homepage
  intro, the word-count figure and born.html's `datePublished` (2026-03-11) are unchanged, and the site's untracked `CLAUDE.md` was
  left alone.

## The owner's checklist (church PC, phone and iPad)

1. Install 1.13.7 over 1.13.6: settings, the Service Queue and the recent services are all still there.
2. Unplug the projector, open BORN, project a verse: the congregation screen is a window in the bottom-right corner. Plug the projector
   in: it goes full screen on the projector. Unplug it again: it comes back as a window.
3. With a verse up, Quit from the menu or with Cmd+Q (Mac), and close BORN from the taskbar and with Alt+F4 (Windows): it asks; Enter
   keeps BORN open. Hide the screen and quit: no question.
4. With a verse up, let the in-app update install (when the next version comes): no question, BORN restarts on the new version.
5. With a verse up, log off or restart Windows: no question holds it up.
6. On a phone and an iPad: Save this service twice under the same name (it asks: Cancel, Keep both, Replace it); turn Wi-Fi off during a
   Save (it says it was not saved); with BORN closed open Series or a Bible chapter (Couldn't load, with Try again; start BORN, Try again
   loads it); the status line shows what is on the screen.
7. In BORN 1.13.6, the update check offers 1.13.7.
