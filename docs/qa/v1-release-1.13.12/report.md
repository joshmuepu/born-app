# BORN v1 release 1.13.12: report

Released from branch `v1-mobile-fixes` (the round's changes and proof are in `docs/qa/v1-mobile-fixes/report.md`).

## What the release contains

1. Starting a song or a verse from a queue item's page on the phone closes that page and shows the live view (`5c89e6c`).
2. A phone tap that worked is not reported as "Couldn't reach BORN", and Next and Back move at most one page from the page the phone was
   showing (`0ca682c`, Help sentence `77e1af7`).
3. A paragraph tapped on a sermon's full page (from Series or Date) closes that page and shows the live view (`70558c2`).
4. Housekeeping with no user-visible change: notes and comments name nothing outside this product, and a test guards the wording
   (`6b96022`).

The branch also holds the phone review's report, scripts and evidence (`6f2820b`), the round's report (`60833ac`, `db822fb`), the version
and pictures (`f1aba2e`) and the changelog (`0df27b5`). Scripts and reports never ship.

## Prechecks

- `main` was still at the 1.13.11 release report (`b4a1361`), the commit the branch was cut from; no merge into the branch was needed.
- The working tree was clean. The owner's ports 9346 and 4316 were not used (nothing was listening on them). Every check used its own
  profile and test ports 14316/9376 and 14336/9396, and stopped the apps it started. Nothing was installed on this computer. OBS was not
  touched and nothing was streamed.
- Public files: the repo's word test passes on the released tree; the new commit messages, the changelog entry, the release notes and the
  website change were searched for every word the public-files rule forbids; none was found.

## Gates

Run on the branch in a separate checkout of it, with the main folder's `node_modules`.

| Gate | Result |
|---|---|
| `npm run typecheck` | passed (at `60833ac`, `db822fb` and the final `0df27b5`) |
| `npm test`, first run at `60833ac` | 142 files, 1142 tests: 1141 passed, **1 failed**: the word test found two lines of the round's own report (see "Deviations") |
| `npm test` at `db822fb` (report reworded) | 142 files, 1142/1142 passed |
| `npm test` at `0df27b5` (final: version, pictures, Help sentence, changelog) | 142 files, 1142/1142 passed |
| `npm run test:runtime` | passed (song encodings on the app's runtime: 0 failed) |
| Round check `repro-project-song.cjs` (queue-row song, Chromium and WebKit, 390x844 and 768x1024, three roles) | 144 checks, 0 failed |
| Round check `repro-conditions.cjs` (slow network, quick double taps, lost tap, network off) | 110 checks, 0 failed |
| Review check `flows.cjs`, Chromium | 62 checks, 8 failed, all out-of-scope findings (below); the sermon paragraph check passes |
| Review check `flows.cjs`, WebKit | 62 checks, 10 failed, all out-of-scope findings (below); the sermon paragraph check passes |
| Review check `resilience.cjs`, Chromium | 19 checks, 3 failed: MR-05, MR-08, MR-09 |
| Review check `resilience.cjs`, WebKit | 18 checks, 3 failed: MR-05, MR-08, MR-09 |
| Phone: `remote-probe` / `remote-reconnect` / `phone-data-safety` / `phone-recent-songs` / `flows` | 23/23, 8/8, 49/49, 27/27, 8/8 |
| Projector: `output-probe` / `slide-fit` / `stage-room` / `font-late` | 6/6, 15/15, 43/43, 10/10 |
| Operator: `operator-zoom` / `operator-sizes` | 46/46, 72/72 |

The review checks' expected failures, each mapped to its finding: Chromium: MR-14, MR-07, MR-06, MR-16, MR-11, MR-12, MR-04 (two checks).
WebKit: the same, plus MR-10 and MR-17. These are the same counts as the round's own run; nothing else failed. The real-app checks ran
with the congregation and stage screens kept hidden (long sweeps).

**Identity, unchanged:** product name "Branham or Nothing"; app ID `com.joshmuepu.born`; remote port 4316; BORN registers no protocol
names. Icons: SHA-256 `a9dd996d` (png), `805174be` (icns), `4f3e98c7` (ico). No icon, build or workflow file changed. The only change to
`package.json` is the version.

## Release

- **Version:** 1.13.12 in `package.json` and `package-lock.json` (`f1aba2e`), as for 1.13.11.
- **Help pictures:** all seven scripted pictures were retaken with `scripts/qa/manual-screenshots.cjs` on an isolated profile, and each was
  looked at.
  - The six whose footer shows the version read v1.13.12 and were committed. They show placeholders, invented songs and KJV text only, and
    are each under 300 KB (largest 280,778 bytes).
  - Today's "On this day" lists seven placeholder sermon cards where 1.13.11's showed three, so three pictures are 14 to 17 KB larger.
  - The phone picture (`mobile-remote-queue.png`, the Queue tab's live view) came out byte for byte the same, so it was not changed. The
    fixes change what the phone does after a tap, not how the live view looks.
- **Help text:** one sentence in `operators/mobile-remote.md`: Next and Back move one page from the page the phone shows (`77e1af7`).
- **Changelog:** `CHANGELOG.md` entry (`0df27b5`).
- **Merge commit:** `50a5663` "Release v1.13.12" (`--no-ff`); its tree equals the branch.
- **Tag:** `v1.13.12`, annotated, "Branham or Nothing 1.13.12".
- **Release workflow:** https://github.com/joshmuepu/born-app/actions/runs/45741296313 succeeded on the first run (guard, build-db, macOS
  build, Windows build, release).
- **Release page:** https://github.com/joshmuepu/born-app/releases/tag/v1.13.12, published, not a draft and not a pre-release.

| Asset | 1.13.12 | 1.13.11 | Difference |
|---|---|---|---|
| `BORN-1.13.12-macOS-arm64.dmg` | 211,785,773 bytes | 211,716,815 | +67.3 KB |
| `BORN-1.13.12-macOS-x64.dmg` | 216,421,451 bytes | 216,395,778 | +25.1 KB |
| `BORN-1.13.12-Windows-Setup.exe` | 185,445,219 bytes | 185,397,794 | +46.3 KB |

**Why larger than about 25 KB:** the Help pictures ship inside the app (`docs/manual/v1` is packed as `manual/v1`), and the six retaken
ones are 46,446 bytes larger together (the "On this day" cards above; PNG does not compress further). That accounts for the Windows
installer. The disk images move a little more or less than that around it, within their usual variation. The same three platforms as
before; nothing is missing.

**Update feed:** `api.github.com/repos/joshmuepu/born-app/releases/latest` reports `v1.13.12` with these three installers, and each
`releases/latest/download/` link serves its file. `src/main/updateCheck.ts` is unchanged between v1.13.11 and v1.13.12; 1.13.11's own
`cmpVersion` was run on the two versions and returns 1.13.12 as newer, so 1.13.11 offers it.

**Release notes:** the workflow wrote only a "Full Changelog" link. The notes were set to the changelog entry with
`gh release edit --notes-file` (the file was checked non-empty and to start with `## 1.13.12`) and read back: the same words; only the
final newline differs. The release page shows them.

**Website:** `joshmuepu-site` commit `165b88f` "BORN 1.13.12: version, changelog entry, download links and dates", committed only after
the installers were published. It changes `born.html`, `changelog.html`, `index.html`, `netlify.toml` and `sitemap.xml` (the date moved
to November 25, 2026, as for 1.13.10). Live within a minute: born.html shows v1.13.12 and November 25, 2026, the home page shows BORN
1.13.12, the changelog lists v1.13.12 first, and `/download/mac-arm`, `/download/mac-intel` and `/download/windows` redirect to the
1.13.12 installers. The word-count figure, born.html's `datePublished` (2026-03-11) and the site's untracked `CLAUDE.md` are unchanged.

## Readings taken and deviations

- **The full suite failed once.** Its first run found two lines of the round's own report (`docs/qa/v1-mobile-fixes/report.md`) that the
  new word test does not allow: a removed note's file name and a mention of song fixtures' verse labels. The reading taken: the brief says
  both "release exactly what is on the branch" and "the word test must pass". A report never ships, so the two lines were reworded
  (`db822fb`), with no other change, and the full suite was run again: 1142/1142.
- **One Help sentence was added,** as the brief allows: the phone Help did not say that Next and Back move one page at most.
- **Changelog heading:** "On the phone and iPad", the heading earlier phone entries use, for the brief's "on the phone".
- **The full suite was also run at the final commit,** because the release commits change shipped Help text.
- **Installer sizes** are above about 25 KB for the reason above; not a packaging problem, so the release went ahead.

## Taking the release out later

Revert on a branch from `main`, newest first, then release a new version:

1. `git revert 77e1af7 0ca682c`: the Help sentence, then the tap check and position check (item 2). This also restores the phone tests
   it changed.
2. `git revert 70558c2`: the sermon paragraph (item 3).
3. `git revert 5c89e6c`: the queue-row song (item 1).

`6b96022` (item 0) changes no behavior and need not be reverted. `git revert -m 1 50a5663` would take out the whole round at once, but it
would also set the version back, so it is not recommended.

## Not in this release

- **MR-04:** BORN answers "OK" to phone commands it could not act on; a saved service that could not be opened says "Loaded".
- **MR-05:** while the phone cannot reach BORN, the live card still reads ON SCREEN at full strength.
- **MR-06:** a song projected from Songs cannot be opened from the live card to jump to another verse.
- **MR-07:** the open Full Queue list is not refreshed and goes on marking the old live item.
- **MR-08:** turning a phone on its side with a full page open covers Next.
- **MR-09:** the phone's back button leaves the page instead of closing the open page.
- **MR-10:** a fast double tap on + Queue can add the item twice.
- **MR-11:** a key change does not update the copies of the song already in the queue.
- **MR-12:** after New service, one tap on Show screen puts the old service's last page back up.
- **MR-13:** several controls are under 44 px, including the Close (X) of every page.
- **MR-14:** the live card in the queue strip is marked only by a green outline.
- **MR-15:** Back, Next and Hide screen sit at the top of the screen, out of easy thumb reach (a layout decision).
- **MR-16:** half-typed Bible or sermon search text is lost on a tab change.
- **MR-17:** right after a switch the Queue tab can show the old item for up to a second (WebKit).
- **MR-18:** two 12 px labels are under 4.5:1 contrast.
- **MR-19:** a Remove still inside its 5 s Undo time is never sent if the page closes.

## The owner's checklist (a real phone, after updating from 1.13.11)

1. Start a song from its queue row, upright and on its side, then use Next, Back and Hide screen.
2. On weak Wi-Fi, tap a verse and Next a few times: no false "Couldn't reach BORN" and no skipped page.
3. Open a sermon from Series or Date and tap a paragraph.
4. Lock the phone for a minute during a live song, then unlock it.
5. In 1.13.11, the update check offers 1.13.12.
