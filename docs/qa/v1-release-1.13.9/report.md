# BORN v1 release 1.13.9: report

Released from branch `v1-visual-fixes` (the round's changes and measurements are in `docs/qa/v1-visual-fixes/report.md`), including
the optional congregation-screen changes, as the owner agreed.

## Gates (each once, on the branch, at `0b6d8ef`)

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 133 files, 1083/1083 passed |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| Real-app checks | not re-run at release: no code changed after the round, which ran them on this code (screen sizes 613/613, output probe 6/6, operator sizes 72/72, layout sweep 0 findings, phone sweep 720 + 384 screens with no page errors, remote checks 49/49, 27/27, 23/23, 8/8) |
| Identity | appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316, icon SHA-256 a9dd996d / 805174be / 4f3e98c7, tag gate `^v1\.[0-9]+\.[0-9]+$`; no workflow file added or changed |

Nothing was wrong with the branch; no fix was needed.

## The optional congregation-screen commits

| Commit | What |
|---|---|
| `78a71bf` | The reference line and label keep their share of the screen height on tall screens |
| `6461af5` | The side margins are 5% of the width instead of a fixed 100 px |
| `805f6f2` | The text starts at the stage monitor's size; the reference line is 5% and the label 3.2% of the height. The owner asked for this while testing the branch; it rewrites the same rules as the two commits above |

To take all of them out later, on a branch from `main`:

```
git revert 805f6f2 6461af5 78a71bf
```

`805f6f2` must be reverted with the other two, because it changes the same lines. After the revert, run the screen-size check with
`ONLY=stage` (its congregation rules would fail by design) and the unit suite.

## Release

- **Base:** `main` was still at the 1.13.8 release report (`468c9df`) and the branch was based on it; no rebase was needed.
- **Version and changelog:**
  - Version 1.13.9 in `package.json` and `package-lock.json` (`a030789`).
  - The six Help pictures whose footer shows the version were retaken with `scripts/qa/manual-screenshots.cjs` on an isolated
    profile, so they read v1.13.9. Placeholders, invented songs and KJV text only, each under 300 KB, and each was looked at before
    committing. The first take of the search picture had a mistyped search with no results; it was retaken.
  - `CHANGELOG.md` entry (`a04f3d6`) from the round's report, in the changelog's own headings.
  - Help: no change at release. The round already retook the pictures whose controls changed size; the Projected text size page
    still describes what the control does.
- **Merge commit:** `3ab1c51` "Release v1.13.9" (`--no-ff`, as 1.13.8).
- **Tag:** `v1.13.9`, annotated, "Branham or Nothing 1.13.9".
- **Release workflow:** https://github.com/joshmuepu/born-app/actions/runs/44465581255 succeeded on the first run (guard,
  build-db, macOS build, Windows build, release).
- **Release page:** https://github.com/joshmuepu/born-app/releases/tag/v1.13.9, published, not a draft and not a pre-release.

| Asset | 1.13.9 | 1.13.8 |
|---|---|---|
| `BORN-1.13.9-macOS-arm64.dmg` | 211,693,080 bytes (201.9 MB) | 211,698,814 |
| `BORN-1.13.9-macOS-x64.dmg` | 216,377,750 bytes (206.4 MB) | 216,385,569 |
| `BORN-1.13.9-Windows-Setup.exe` | 185,387,745 bytes (176.8 MB) | 185,393,630 |

- The same three platforms as 1.13.8, each within 8 KB of its size. As before, there are no checksum or update metadata files.
- The update check reads `api.github.com/repos/joshmuepu/born-app/releases/latest`, which now reports `v1.13.9` with these three
  installers. Each `releases/latest/download/` link answers.
- Nothing was installed on this computer.

- **Release notes:** the workflow writes only a "Full Changelog" link, so the notes were set to the changelog entry.
  - The entry was extracted to a file first and checked to be non-empty, to start with the 1.13.9 entry's first heading and to be
    the same text as the changelog entry.
  - It was then applied with `gh release edit --notes-file`.
  - The page was re-read afterwards: its notes are the changelog entry, word for word.

- **Website:** `joshmuepu-site` commit `be86857` "BORN 1.13.9: version, changelog entry, download links and dates". It changes the
  same files as for 1.13.8: `born.html`, `changelog.html`, `index.html`, `netlify.toml` and `sitemap.xml`.
  - It was committed only after the installers were published.
  - Live on joshmuepu.com within a minute:
    - born.html shows v1.13.9 and November 19, 2026;
    - the home page shows BORN 1.13.9;
    - the changelog lists v1.13.9 first.
  - `/download/mac-arm`, `/download/mac-intel` and `/download/windows` redirect to the 1.13.9 installers, and each installer
    link answers.
  - The homepage intro, the word-count figure and born.html's `datePublished` (2026-03-11) are unchanged, and the site's untracked
    `CLAUDE.md` was left alone.

## Judgement calls

- **The owner's change made while testing (`805f6f2`):** the release round named the branch "at 0146269 or later". The owner asked
  for the congregation text to match the stage and for bigger references while testing the branch, so that commit is in the
  release and in the changelog under "On the congregation screen". Leaving it out of the changelog would have hidden a change
  everyone in the room sees.
- **Changelog headings:** the changelog's own style ("On the stage monitor", "On the congregation screen", "In the app", "On the
  phone and iPad") was used, with the content from the round's report.
- **No real-app re-runs:** none were run, because no code changed after the round's real-app checks.

## The owner's checklist (church PC, phone and iPad)

1. **Update 1.13.8 to 1.13.9 on the church PC with the in-app update.**
   - Settings, the Service Queue and the recent services are all still there.
   - This is the first update that starts from a version with the hidden-window fix: there should be **no black window**, and BORN
     should reopen by itself in a normal window.
2. **The stage monitor at the pulpit, with a real song of 6 to 8 lines.**
   - The current text fills the screen and is larger than the Next text.
   - Check whether the smaller Next text is still good enough for the preacher. If not, the Next band can be made a quarter of the
     screen height as a later small change.
   - On a 4K TV, if there is one, the text should keep the same share of the screen as on 1080p.
3. **The projector, from the back row, on a long verse and on a song.**
   - The reference line can be read and copied into notes, and the label above the text is easy to read.
   - The text is about as big as on the stage monitor, and a long passage is not cut.
   - The side margins are about a twentieth of the screen width each side.
4. **The operator window:** the buttons and sub-tabs are a little taller, and nothing overlaps at the church computer's screen size.
5. **A phone and an iPad:** the tab labels and the queue's SONG and BIBLE labels are a little larger and still fit.
6. **In BORN 1.13.8, the in-app update check offers 1.13.9.**
