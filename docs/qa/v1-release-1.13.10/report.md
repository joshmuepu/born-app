# BORN v1 release 1.13.10: report

Released from branch `v1-fixes-1.13.10` at `482953b` (the round's changes and measurements are in `docs/qa/v1-fixes-1.13.10/report.md`).

## What the release contains

1. The operator window's View menu zoom is fitted to the window, never below 100%, with a one-line notice when it was reduced (`6245db4`, Help sentence `5c90238`).
2. **Text is very small** and **Text is cut** marks for the operator (`c566f02`).
3. The stage monitor never cuts the current text of a long song page (`9bdd048`).
4. A test that pins the stage's text floor, with no change in behavior (`c9d14ae`).

The branch also holds the round's measuring scripts (`1673282`, `03e4279`, `8d57c3e`, `224740f`) and its report; scripts never ship.

## Prechecks

- `main` was still at the 1.13.9 release report (`0cc1016`) and the branch was based on it; no rebase or merge was needed.
- The working tree was clean. The owner's running instance (ports 9346 and 4316) was left alone; every check used its own profile, remote port
  14316 and CDP 9376, and stopped the apps it started. Nothing was installed on this computer.
- Public files: the branch's diff and every commit message were searched for any other product line, a working name, licensing, finding or
  decision IDs and folders on this computer; none was found. The changelog, release notes, Help pictures and website were written in v1's
  words only.

## Gates (each once, on the branch at `482953b`)

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite, with its native rebuild) | 138 files, 1110/1110 passed |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| `operator-zoom.cjs` | 46 checks, 0 failed |
| `slide-fit.cjs` | 15 checks, 0 failed |
| `operator-sizes.cjs` | 72 checks, 0 failed |
| `stage-room.cjs` | 43 checks, 0 failed |
| `output-probe.cjs` | 6 checks, 0 failed |

**Identity, unchanged:**
- Product name "Branham or Nothing"; app ID `com.joshmuepu.born`; remote port 4316.
- BORN registers no protocol names, before or after.
- Icons: SHA-256 `a9dd996d` (png), `805174be` (icns), `4f3e98c7` (ico). No icon file and no workflow file was changed.
- The only change to `package.json` is the version.

## Release

- **Version:** 1.13.10 in `package.json` and `package-lock.json` (`c5d248f`), as for 1.13.9.
- **Help pictures:** the six whose footer shows the version were retaken with `scripts/qa/manual-screenshots.cjs` on an isolated profile.
  - They now read v1.13.10. They show placeholders, invented songs and KJV text only, each under 300 KB, and each was looked at before
    committing.
  - No Help picture shows the changed areas: the zoom notice and the slide-fit marks appear only on a small window or a very long slide, and
    the manual has no picture of the stage monitor. So no other picture was taken.
  - The only Help sentence is the one the branch already contains (`operators/shortcuts.md`).
- **Changelog:** the `CHANGELOG.md` entry (`174d85d`) is in the same plain style as 1.13.9, with no internal ids or measurements.
- **Merge commit:** `e9a899d` "Release v1.13.10" (`--no-ff`, as 1.13.8 and 1.13.9).
- **Tag:** `v1.13.10`, annotated, "Branham or Nothing 1.13.10".
- **Release workflow:** https://github.com/joshmuepu/born-app/actions/runs/44964949653 succeeded on the first run (guard, build-db, macOS
  build, Windows build, release).
- **Release page:** https://github.com/joshmuepu/born-app/releases/tag/v1.13.10, published, not a draft and not a pre-release.

| Asset | 1.13.10 | 1.13.9 | Difference |
|---|---|---|---|
| `BORN-1.13.10-macOS-arm64.dmg` | 211,718,096 bytes (201.9 MB) | 211,693,080 | +24.4 KB |
| `BORN-1.13.10-macOS-x64.dmg` | 216,390,153 bytes (206.4 MB) | 216,377,750 | +12.1 KB |
| `BORN-1.13.10-Windows-Setup.exe` | 185,399,309 bytes (176.8 MB) | 185,387,745 | +11.3 KB |

**Why the installers are larger than "about 8 KB":** this release adds code, which earlier patch releases mostly did not.
- The Help pictures ship inside the app, and the six retaken ones are 8,787 bytes larger together (PNG does not compress further).
- The new code (the zoom fit, the slide-fit marks, the stage room steps, about 600 lines) adds a little more.
- Together these account for the Windows (+11.3 KB) and macOS x64 (+12.1 KB) installers.
- The arm64 disk image grew 24.4 KB, which is within the disk images' usual variation (from 1.13.7 to 1.13.8 the x64 image moved 16.5 KB
  with smaller changes).
- The same three platforms as before; nothing is missing.

**Update feed:**
- `api.github.com/repos/joshmuepu/born-app/releases/latest` reports `v1.13.10` with these three installers, and each
  `releases/latest/download/` link answers.
- This is the first two-digit patch number. 1.13.9's update check compares versions as numbers part by part (`cmpVersion` in
  `src/main/updateCheck.ts`, unchanged since 1.13.9), so 1.13.9 sees 1.13.10 as newer and offers it. This was checked by running the same
  comparison.

**Release notes:** the workflow writes only a "Full Changelog" link, so the notes were set to the changelog entry.
- The entry was extracted to a file first and checked to be non-empty, to start with the entry's first heading and to equal the entry.
- It was applied with `gh release edit --notes-file`.
- The page was read back: the notes are the changelog entry, word for word.

**Website:** `joshmuepu-site` commit `76baa54` "BORN 1.13.10: version, changelog entry, download links and dates". It changes the same files
as for 1.13.9: `born.html`, `changelog.html`, `index.html`, `netlify.toml` and `sitemap.xml`.
- It was committed only after the installers were published.
- It was live within a minute:
  - born.html shows v1.13.10 and November 21, 2026;
  - the home page shows BORN 1.13.10;
  - the changelog lists v1.13.10 first.
- `/download/mac-arm`, `/download/mac-intel` and `/download/windows` redirect to the 1.13.10 installers.
- The homepage intro, the word-count figure and born.html's `datePublished` (2026-03-11) are unchanged, and the site's untracked `CLAUDE.md`
  was left alone.

## Readings taken and deviations

- **Where the slide-fit marks show:** the release brief describes them as "in the operator's live preview". The branch also marks the
  slide's row in the Service Queue before it goes live. The release ships exactly what is on the branch, so the changelog says both, under
  "In the live preview".
- **Installer sizes:** larger than "about 8 KB", for the reasons above. It is not a packaging problem, so the release went ahead.
- **`npm run test:runtime`:** added to the gates because 1.13.8 and 1.13.9 ran it.
- **Existing Help pictures over 300 KB:** three remote pictures (`remote-connection-check.png` 475 KB, `remote-network-show-all.png` 323 KB)
  were already over 300 KB before this round. They were not retaken or changed.

## Taking the release out later

Each change is its own commit. To take one out, revert it on a branch from `main`, newest first, then release a new version:

1. `git revert 9bdd048`: the stage room steps. This also restores the item 4 test as it was.
2. `git revert c9d14ae`: the stage text floor test (only if wanted; it changes no behavior).
3. `git revert c566f02`: the slide-fit marks.
4. `git revert 5c90238 6245db4`: the zoom fit and its Help sentence, in that order.

The scripts (`224740f`, `8d57c3e`, `03e4279`, `1673282`) never ship. Revert them only together with the change they check, and before it:
`224740f` with 1, `03e4279` with 3, `1673282` with 4. `git revert -m 1 e9a899d` would take out the whole round at once, but it would also
set the version back, so it is not recommended.

## The owner's checklist (church PC)

1. **Update from 1.13.9 with the in-app update:** settings, the Service Queue and the recent services survive, and BORN reopens normally.
2. **The operator window at the largest zoom on the church screen** (View → Zoom In until it stops):
   - nothing falls off the screen;
   - on a small window the line at the bottom says the zoom was reduced to fit.
3. **The stage monitor:** put up the 9-line page of "Be Still And Know" with the next verse queued.
   - The whole verse shows, with no Next band.
   - The next page shows the Next band again.
4. **The projector from the back row**, on a long verse and on a long song page: nothing is cut.
5. **In 1.13.9, the update check offers 1.13.10.**
