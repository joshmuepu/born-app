# BORN v1 release 1.13.11: report

Released from branch `v1-fixes-1.13.11` (the fix and its proof are in `docs/qa/v1-fixes-1.13.11/report.md`).

## What the release contains

One fix (`90570b2`): the first slide shown after the congregation screen or stage monitor opens is fitted again once the screen font has
loaded. Before, it was fitted with the system font, and the wider screen font then wrapped long lines onto an extra line and cut the slide
at the top and bottom. The owner saw this on verse 1 of "All That Thrills My Soul".

The branch also holds the real-app check `scripts/qa/font-late.cjs` and its options (`5c75ccd`, `2b8e268`, `baa6c2d`); scripts never ship.

## Prechecks

- `main` was at the 1.13.10 release report (`2e1b45d`) and the branch was cut from it; no rebase or merge was needed.
- The working tree was clean. The owner's running instance (ports 9346 and 4316) was left alone; every check used its own profile, remote port
  14316 and CDP 9376, and stopped the apps it started. Nothing was installed on this computer.
- Public files: the branch's diff and every commit message were searched for any other product line, licensing, finding or decision IDs and
  folders on this computer; none was found.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite, with its native rebuild) | 138 files, 1112/1112 passed |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| `font-late.cjs` | 10 checks, 0 failed (fails without the fix: 943 px of text in an 815 px box) |
| `operator-zoom.cjs` | 46 checks, 0 failed |
| `slide-fit.cjs` | 15 checks, 0 failed |
| `operator-sizes.cjs` | 72 checks, 0 failed |
| `stage-room.cjs` | 43 checks, 0 failed |
| `output-probe.cjs` | 6 checks, 0 failed |

The late-font check was also run once with the screens visible, for the owner to watch: 10 checks, 0 failed.

**Identity, unchanged:** product name "Branham or Nothing"; app ID `com.joshmuepu.born`; remote port 4316. Icons: SHA-256 `a9dd996d` (png),
`805174be` (icns), `4f3e98c7` (ico). No icon file and no workflow file was changed. The only change to `package.json` is the version.

## Release

- **Version:** 1.13.11 in `package.json` and `package-lock.json` (`f8eabcd`).
- **Help pictures:** the six whose footer shows the version were retaken with `scripts/qa/manual-screenshots.cjs` on an isolated profile.
  They read v1.13.11, show placeholders, invented songs and KJV text only, are each under 300 KB, and were each looked at before committing.
  Apart from the footer they are the same as 1.13.10's. No Help text changed: the fix changes no control or wording.
- **Changelog:** `CHANGELOG.md` entry (`4a562f3`).
- **Merge commit:** `8ea68db` "Release v1.13.11" (`--no-ff`).
- **Tag:** `v1.13.11`, annotated, "Branham or Nothing 1.13.11".
- **Release workflow:** https://github.com/joshmuepu/born-app/actions/runs/44973309232 succeeded on the first run (guard, build-db, macOS
  build, Windows build, release).
- **Release page:** https://github.com/joshmuepu/born-app/releases/tag/v1.13.11, published, not a draft and not a pre-release.

| Asset | 1.13.11 | 1.13.10 | Difference |
|---|---|---|---|
| `BORN-1.13.11-macOS-arm64.dmg` | 211,716,815 bytes | 211,718,096 | −1.3 KB |
| `BORN-1.13.11-macOS-x64.dmg` | 216,395,778 bytes | 216,390,153 | +5.5 KB |
| `BORN-1.13.11-Windows-Setup.exe` | 185,397,794 bytes | 185,399,309 | −1.5 KB |

All three are within 8 KB of 1.13.10; the same three platforms as before.

**Update feed:** `api.github.com/repos/joshmuepu/born-app/releases/latest` reports `v1.13.11` with these three installers, and each
`releases/latest/download/` link answers. 1.13.10 compares versions as numbers (`cmpVersion` in `src/main/updateCheck.ts`), so it offers
1.13.11.

**Release notes:** set to the changelog entry with `gh release edit --notes-file` and read back: the same, word for word.

**Website:** `joshmuepu-site` commit `f82df13` "BORN 1.13.11: version, changelog entry and download links", committed only after the
installers were published. It changes `born.html`, `changelog.html`, `index.html` and `netlify.toml`. The release date is the same day as
1.13.10, so the dates and `sitemap.xml` needed no change. It was live within a minute: born.html and the home page show 1.13.11, the
changelog lists v1.13.11 first, and `/download/mac-arm`, `/download/mac-intel` and `/download/windows` redirect to the 1.13.11 installers.
The word-count figure, born.html's `datePublished` (2026-03-11) and the site's untracked `CLAUDE.md` are unchanged.

## Readings taken and deviations

- **Release asked for without a brief:** the owner said "release now". The release followed the 1.13.10 procedure step for step.
- **Existing Help pictures:** the remote and screen-setup pictures show this computer's network address and monitor names, as they already
  did in 1.13.10. They were retaken the same way and not otherwise changed.

## Taking the release out later

`git revert 90570b2` on a branch from `main`, then release a new version. Revert the check script commits (`baa6c2d`, `2b8e268`, `5c75ccd`)
with it, before it, if wanted; they never ship.

## The owner's checklist

1. **Update from 1.13.10 with the in-app update:** settings, the Service Queue and recent services survive, and BORN reopens normally.
2. **Open the congregation screen and put "All That Thrills My Soul" verse 1 up as the first slide** (also at a raised text size): nothing is
   cut at the top or bottom.
3. **The same on the stage monitor:** the first slide after opening it fits.
4. **In 1.13.10, the update check offers 1.13.11.**
