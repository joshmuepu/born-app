# BORN v1 release 1.13.8: report

Released from branch `v1-fixes-1138` (the round's fixes are described in `docs/qa/v1-fixes-1.13.8/report.md`).

## Gates (each once, on the branch, at `e11b6a6`)

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 127 files, 1056/1056 passed |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| Real-app checks | not re-run: no code changed after the fixes round, which ran them (`phone-recent-songs.cjs` 27/27, remote checks 49/49, 23/23, 8/8, phone sweep 384 screens with no page errors) |
| Identity | appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316, icon SHA-256 a9dd996d / 805174be / 4f3e98c7, tag gate `^v1\.[0-9]+\.[0-9]+$`; no workflow file added or changed |

Nothing was wrong with the branch; no fix was needed.

## Release

- **Base:** `main` was still at the 1.13.7 release report (`f5fe82f`) and the branch was based on it; no rebase was needed.
- **Version and changelog:**
  - Version 1.13.8 in `package.json` and `package-lock.json`.
  - The six Help pictures whose footer shows the version were retaken with `scripts/qa/manual-screenshots.cjs` on an isolated profile, so they now read v1.13.8. They are the same pictures as 1.13.7: placeholders and invented songs only, each under 300 KB, and each was looked at before committing.
  - `CHANGELOG.md` entry from the round's report, written in the changelog's own headings.
  - Help: no change at release. The phone page (`operators/mobile-remote.md`) was already updated in the round, and the Windows fix changes nothing a person is asked to do.
- **Merge commit:** `b482f9e` "Release v1.13.8" (`--no-ff`, as 1.13.7).
- **Tag:** `v1.13.8`, annotated, "Branham or Nothing 1.13.8".
- **Release workflow:** https://github.com/joshmuepu/born-app/actions/runs/44413428540 succeeded on the first run (guard, build-db, macOS build, Windows build, release).
- **Release page:** https://github.com/joshmuepu/born-app/releases/tag/v1.13.8, published, not a draft and not a pre-release.

| Asset | 1.13.8 | 1.13.7 |
|---|---|---|
| `BORN-1.13.8-macOS-arm64.dmg` | 211,698,814 bytes (201.9 MB) | 211,695,492 |
| `BORN-1.13.8-macOS-x64.dmg` | 216,385,569 bytes (206.4 MB) | 216,369,084 |
| `BORN-1.13.8-Windows-Setup.exe` | 185,393,630 bytes (176.8 MB) | 185,382,429 |

- The same three platforms as 1.13.7, each within 17 KB of its size. As with 1.13.7, there are no checksum or update metadata files.
- The update check reads `api.github.com/repos/joshmuepu/born-app/releases/latest`, which now reports `v1.13.8` with these three installers. Each `releases/latest/download/` link answers 200.
- Nothing was installed on this computer.

- **Release notes:** the workflow writes only a "Full Changelog" link, so the notes were set to the changelog entry, as for 1.13.7.
  - The entry was extracted to a file first and checked to be non-empty and to start with the 1.13.8 entry.
  - It was then applied with `gh release edit --notes-file`.
  - The page was re-read afterwards: its notes are the changelog entry, word for word.

- **Website:** `joshmuepu-site` commit `ddf8819` "BORN 1.13.8: version, changelog entry, download links and dates". It changes the same files as for 1.13.7: `born.html`, `changelog.html`, `index.html`, `netlify.toml` and `sitemap.xml`.
  - It was committed only after the installers were published.
  - Live on joshmuepu.com within a minute:
    - born.html shows v1.13.8 and November 18, 2026;
    - the home page shows BORN 1.13.8;
    - the changelog lists v1.13.8 first.
  - `/download/mac-arm`, `/download/mac-intel` and `/download/windows` redirect to the 1.13.8 installers.
  - The homepage intro, the word-count figure and born.html's `datePublished` (2026-03-11) are unchanged, and the site's untracked `CLAUDE.md` was left alone.

## Judgement calls

- **Changelog headings:** the round's proposed entry used a "Fixed" heading. The changelog's own headings ("On Windows", "On the phone and iPad") were used instead, with the same content.
- **Windows note in the changelog:** the Windows line says that the update to 1.13.8 itself still runs 1.13.7's updater. Without that note, a church that sees the window once more on this update would think the fix failed.
- **No real-app re-runs:** none were run, because nothing that a real-app check covers changed after the fixes round.

## The owner's checklist (church PC, phone and iPad)

1. Install 1.13.8 over 1.13.7 on the church PC: settings, the Service Queue and the recent services are all still there.
2. The update from 1.13.7 to 1.13.8 still uses 1.13.7's own updater, so a console window may still flash on that first update. The fix applies to updates that start from 1.13.8 or later. On the next update after this one, check that no black window appears and that BORN reopens by itself in a normal window.
3. On a phone and an iPad:
   - With Wi-Fi off, tap **Change key**: it should say it couldn't load from BORN.
   - With Wi-Fi off, search songs: it should say it couldn't reach BORN.
   - With Wi-Fi back on, **Try again** works.
   - Recently Played still appears on the Songs tab as usual.
4. In BORN 1.13.7, the in-app update check offers 1.13.8.
