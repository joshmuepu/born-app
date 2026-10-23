# 12 · Release record: BORN v1.13.3 (2026-10-23)

## What was released
- **Version 1.13.3**, tag **`v1.13.3`** (annotated) on merge commit **`8de3178`** on `main` (merge of `release/v1.13.3`, no squash, no force push, no history rewrite).
- Release: https://github.com/joshmuepu/born-app/releases/tag/v1.13.3, published 2026-10-23 20:39 UTC, **marked Latest**, not a draft, not a pre-release. Release notes = the 1.13.3 changelog text (set after publishing, replacing the generated notes).
- Assets: `BORN-1.13.3-macOS-arm64.dmg` (209,936,292 bytes), `BORN-1.13.3-macOS-x64.dmg` (214,603,170), `BORN-1.13.3-Windows-Setup.exe` (183,612,417). All three download links return 200, directly and through `releases/latest/download/…`.
- Release workflow run: https://github.com/joshmuepu/born-app/actions/runs/40012643526 (guard, build-db, macOS and Windows builds with their smoke tests, publish: all green on **attempt 4**, see below).
- Branch kept: `release/v1.13.3`. The temporary Windows check branch `tmp-win-v1133` was deleted.

## What is in it
- The five service-notes fixes (`docs/qa/v1-service-notes/`): the sermon reader, the Bible chapter and the song slide list keep their place when the screen is hidden; Esc with the song key list closed leaves the cursor alone; a queued sermon range opens at its first paragraph; paragraphs with no number are marked one slide at a time ("Slide 1, 2, 3"); page labels past 26 pages.
- The update-download fix (`v1-update-fix`): a cut-short or stalled download is never treated as finished; retry, then the browser.
- Version bump, changelog, manual pages; one QA-script fix (`dc9d034`, Windows smoke reads a header the same way in pwsh 7 and PowerShell 5.1); the service-notes docs kept to v1.
- **Left out on purpose** (`docs/qa/v1-service-notes/02-needs-owner-decision.md`): a paragraph/slide-number jump box, a "back to the queued paragraph" button, a mini-map. They are new features; none was built.

## The Windows smoke blocker (before the tag)
`smoke-windows.ps1` failed on two runners (run 40006878176 and its re-run): no window, `sermons.db` written but `library.db` never, remote refused.
- **Cause: the temporary verification workflow, not the product.** It ran `npm rebuild better-sqlite3` (the Node build, for the unit tests) and then packaged straight away. electron-builder's own native step decided the module was already built ("finished" in 2 ms) and shipped the Node build. The packaged app's `born.log` shows it: `better_sqlite3.node was compiled against … NODE_MODULE_VERSION 115. This version … requires NODE_MODULE_VERSION 130`, thrown by `new Database` right after the sermon seed.
- **Proof (A/B in one run, https://github.com/joshmuepu/born-app/actions/runs/40010168185):** A, packaged right after the unit tests: the same failure and that log line. B, the same code after `npm run rebuild:native` (what `npm test` does locally) and packaging again: window loads, both libraries seed, remote and searches answer. `release.yml` never does the Node rebuild (it packages right after `npm ci`), so the real pipeline was never affected.
- B still showed one failure, also harness: in pwsh 7 a response header is a `string[]`, so `-eq 'DENY'` was not a boolean. Fixed in the script only (`dc9d034`).
- **Final Windows run, green:** https://github.com/joshmuepu/born-app/actions/runs/40011769632. Libraries built on Ubuntu: sermons 1,218, paragraphs 104,644, Bible translations 3, verses 93,285, songs 1,163, slides 5,219. Windows: typecheck; unit tests **764 passed, 1 skipped**; smoke **11 / 11** (window loads; `sermons.db` 152 MB and `library.db` 27 MB seeded; remote `/ping`; `X-Frame-Options: DENY`; sermon search 200 results, song search 24, Bible lookup); installer `BORN-1.13.3-Windows-Setup.exe` **175.1 MB** (183,612,448 bytes), real PE; all 7 icon images byte-identical to `icon.ico`; the update-download check against the real published installer: same bytes, nothing installed.
No product code changed because of the blocker.

## The release run needed four attempts (external, no code change)
The tag cannot read the Bible-text cache saved by branch runs (GitHub caches are scoped per branch; a tag only sees the default branch's), so `build-db` fetched the Bible text from bolls.life again and got **HTTP 429** (rate limited) on attempts 1–3; a plain request from another network got 429 at the same time. Attempt 4, started once the source answered normally three times in a row, passed. `release.yml` and the build script were not changed; a retry-on-429 in the build script is still the open item from the hardening round (G3).

## Checks before the tag
| Check | Result |
|---|---|
| Typecheck, production build | clean |
| Unit tests | 765 (macOS); Windows 764 passed, 1 skipped |
| Probes: layout, output, remote, reconnect, input, flows, sweep, verify-libraries | 0 failed; sweep 0 findings |
| Esc matrix (`esc-matrix.cjs`) | 74 checks, 0 failed |
| Far queued paragraph (`reach-probe`, `reach-jump`) | ¶396–399 of 749 cards opens at its first paragraph and stays in view after Project |
| Packaged macOS smoke | 11 / 11 at 1.13.3 |
| Old-file compatibility (`compat.cjs`) | output identical to `origin/main` |
| Identity | 1.13.3; `com.joshmuepu.born`; "Branham or Nothing"; port 4316; icons `a9dd996d` / `805174be` / `4f3e98c7` |

## After the tag
- Published `BORN-1.13.3-macOS-arm64.dmg` downloaded (209,936,292 bytes), mounted, and smoke-tested: **11 / 11** (version 1.13.3, bundle id, name, icon `805174be`, libraries, remote, searches, clean log).
- v1's own `checkForUpdate()` (bundled from `src/main/updateCheck.ts`, real HTTPS to the live GitHub feed):

| Client | Latest | Update offered | Installer |
|---|---|---|---|
| 1.13.1 macOS arm64 | 1.13.3 | yes | `BORN-1.13.3-macOS-arm64.dmg`, 209,936,292 |
| 1.13.2 macOS arm64 | 1.13.3 | yes | `BORN-1.13.3-macOS-arm64.dmg` |
| 1.13.2 macOS x64 | 1.13.3 | yes | `BORN-1.13.3-macOS-x64.dmg`, 214,603,170 |
| 1.13.1 / 1.13.2 Windows | 1.13.3 | yes | `BORN-1.13.3-Windows-Setup.exe`, 183,612,417 |
| 1.13.3 | 1.13.3 | no (up to date) | — |

## Website
Repo `joshmuepu/joshmuepu-site`, commit `8c44106`, deployed by Netlify from `main`: `born.html` (`softwareVersion` 1.13.3, the three version labels, date October 23, 2026), `changelog.html` (new v1.13.3 entry, same markup as v1.13.2), `netlify.toml` (the three download redirects now point at the 1.13.3 files). Verified live: https://joshmuepu.com/born.html and https://joshmuepu.com/changelog.html respond 200 with v1.13.3; `/download/mac-arm`, `/download/mac-intel`, `/download/windows` redirect (302) to the 1.13.3 assets, which answer 200.

## Rollback notes
- Hide the release from update checks without deleting anything: `gh release edit v1.13.3 --repo joshmuepu/born-app --prerelease`; `latest` falls back to v1.13.2 (its assets are untouched). Revert the site with `git revert 8c44106` in `joshmuepu-site` (its redirects then point at the 1.13.2 files, which still exist).
- Never delete or move the tag. A fix goes out forward as v1.13.4 with a new test.

## The two manual lines (after installing v1.13.3)
1. Press **Ctrl/Cmd+R once**: nothing should reload.
2. Scroll a long sermon, press **Esc twice**: the place must not move.
