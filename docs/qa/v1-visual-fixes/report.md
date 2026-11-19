# BORN v1 visual fixes: report

Branch `v1-visual-fixes`, from `main` at the 1.13.8 release and its report. Not merged, tagged or released.

The stage monitor and the screens are readable at the sizes churches really use. Only sizes, caps, colours and margins changed: there
are no new features, settings or screens.

## Commits

| Commit | What | Optional? |
|---|---|---|
| `b799c07` | QA scripts: `screen-sizes.cjs` and `operator-sizes.cjs` measure the real app | – |
| `65fbf13` | Stage monitor: sizes are a share of the screen height; the Next band is a fifth of the screen; the current verse is never smaller than the next | – |
| `117297f` | Stage monitor: labels, references and verse numbers bright enough to read | – |
| `c260dc2` | Operator window: no text under 12 px, no button, tab or field under 32 px high | – |
| `55a0d3e` | Phone page: no text under 12 px | – |
| `d51cf26` | QA scripts: the screen-size check also measures a long congregation reference | – |
| `78a71bf` | **Congregation screen: reference line and label keep their share of the screen height** | **optional (item 5)** |
| `6461af5` | **Congregation screen: side margins are 5% of the width** | **optional (item 5)** |
| `7b31bdb` | Help pictures retaken (taller operator buttons, larger phone captions) | – |
| `c7f2322` | Stage monitor: the Next band's reference line as bright as the current one's | – |

**Leaving item 5 out of a release:** run `git revert 6461af5 78a71bf`. The two commits touch only `ProjectionApp.css` and their own
tests (`congregationReference.test.ts`, `congregationMargins.test.ts`), and no other commit depends on them. After the revert, run
the screen-size check with `ONLY=stage`, because its congregation-reference and margin rules would then fail by design.

## How it was measured

- **Screens:** `scripts/qa/screen-sizes.cjs` runs the real app on an isolated profile.
  - Profile settings: remote port 14316, CDP 9376, mDNS name `born-remote-v1-sizes`, `ELECTRON_RUN_AS_NODE` unset.
  - The stage monitor and congregation screen are kept hidden by `hide-outputs.cjs`, and each window's size is set with the DevTools protocol, so no display was touched.
  - Content is invented: an 8-line song, KJV John 11:35 (short) and 1 Corinthians 13:4-7 (long), a placeholder sermon quote, and a placeholder reference long enough to wrap.
  - Resolutions: 1280×720, 1920×1080, 1024×768, 1920×1200 and 3840×2160 at 100%; 3840×2160 at 125% and 150%; 1920×1080 at 125% and 150%. Windows-style scaling is emulated as a smaller CSS size at a higher pixel ratio.
  - Text sizes are read from the drawn page, and cut text from the boxes' scroll sizes.
  - Colours are sampled from screenshot pixels: inside each text's box, the commonest colour is taken as the background and the pixel that differs most from it as the text colour.
- **Operator window:** `scripts/qa/operator-sizes.cjs` walks the start screen, sermon results, sermon browse, Bible browse, a Bible chapter with the queue and screens on, Songs, the Screens menu, the Remote menu and Shortcuts.
  - Sizes: 1366×768, 1440×900, 1920×1080, and 1920×1080 at 150%.
  - It lists any text under 12 px and any control under 32 px high.
- **Phone:** the phone/iPad sweep (`remote-viewports.cjs`) now flags text under 12 px (it was 11 px).
- **This computer:** display resolutions, appearance (Dark) and output volume (25) were recorded before the live checks and found unchanged afterwards. No keychain prompt appeared.
- **Running apps:** the owner's own BORN instance and its ports were not touched, and every check stopped the apps it started; nothing was left on 9376 or 14316.

## Item 1 and 2: stage monitor sizes and the Next band

**Before:**
- The stage's sizes were pixel caps made for 1080-line screens. On a 4K screen at 100%, a short verse was 80 px (3.7% of the screen height, against 7.4% at 1080), the Next text 42 px (1.9%) and the captions 11 px.
- The Next band had a fixed text size and took 30–37% of the screen. The current text could shrink to 30% of its size, so on 1080p an 8-line song's current verse (35 px) was smaller than the next verse (42 px). At 720 lines it was 19 px against 31 px.

**After:**
- **Root size:** the stage's root text size is the screen height / 67.5, at least 12 px: 16 px at 1080 lines, 32 px at 2160. Every stage size is in rem or a share of the screen, so it keeps its share at every resolution.
- **Next band:** the band is a fifth of the screen height, with its text fitted inside it, and the Next text never starts larger than the current text.
- **Current text:** it goes no smaller than 55% of its start size.
- **Captions:** the current label, Next and the view switch are 1 rem.
- **Result:** on 1080p the 8-line song's current verse is 48 px (4.4% of the height) and the next verse 20 px. On 4K a short verse is 160 px (7.4%), as on 1080p.

**Before and after numbers** (from the real app):

#### Stage monitor: current and Next text

| Case | Screen | Current before | Current after | Next before | Next after | Current smaller than Next |
|---|---|---|---|---|---|---|
| song-8-lines | 1280x720@100% | 19 px (2.7%) | 30 px (4.2%) | 31 px (4.3%) | 13 px (1.8%) | **yes** → no |
| song-8-lines | 1920x1080@100% | 35 px (3.3%) | 48 px (4.4%) | 42 px (3.9%) | 20 px (1.8%) | **yes** → no |
| song-8-lines | 1024x768@100% | 26 px (3.4%) | 34 px (4.5%) | 25 px (3.2%) | 15 px (1.9%) | no → no |
| song-8-lines | 1920x1200@100% | 42 px (3.5%) | 52 px (4.3%) | 42 px (3.5%) | 24 px (2.0%) | no → no |
| song-8-lines | 3840x2160@100% | 80 px (3.7%) | 90 px (4.1%) | 42 px (1.9%) | 43 px (2.0%) | no → no |
| song-8-lines | 3840x2160@125% | 80 px (4.6%) | 77 px (4.4%) | 42 px (2.4%) | 35 px (2.0%) | no → no |
| song-8-lines | 3840x2160@150% | 58 px (4.0%) | 60 px (4.1%) | 42 px (2.9%) | 27 px (1.8%) | no → no |
| song-8-lines | 1920x1080@125% | 23 px (2.7%) | 38 px (4.4%) | 37 px (4.3%) | 17 px (2.0%) | **yes** → no |
| song-8-lines | 1920x1080@150% | 19 px (2.7%) | 30 px (4.2%) | 31 px (4.3%) | 13 px (1.8%) | **yes** → no |
| short-verse | 1280x720@100% | 54 px (7.5%) | 54 px (7.5%) | 31 px (4.3%) | 17 px (2.4%) | no → no |
| short-verse | 1920x1080@100% | 80 px (7.4%) | 80 px (7.4%) | 42 px (3.9%) | 28 px (2.6%) | no → no |
| short-verse | 1024x768@100% | 43 px (5.6%) | 43 px (5.6%) | 25 px (3.2%) | 17 px (2.2%) | no → no |
| short-verse | 1920x1200@100% | 80 px (6.7%) | 81 px (6.7%) | 42 px (3.5%) | 31 px (2.6%) | no → no |
| short-verse | 3840x2160@100% | 80 px (3.7%) | 160 px (7.4%) | 42 px (1.9%) | 57 px (2.6%) | no → no |
| short-verse | 3840x2160@125% | 80 px (4.6%) | 128 px (7.4%) | 42 px (2.4%) | 45 px (2.6%) | no → no |
| short-verse | 3840x2160@150% | 80 px (5.6%) | 107 px (7.4%) | 42 px (2.9%) | 38 px (2.6%) | no → no |
| short-verse | 1920x1080@125% | 65 px (7.5%) | 64 px (7.4%) | 37 px (4.3%) | 23 px (2.6%) | no → no |
| short-verse | 1920x1080@150% | 54 px (7.5%) | 54 px (7.5%) | 31 px (4.3%) | 17 px (2.4%) | no → no |
| long-passage | 1280x720@100% | 41 px (5.7%) | 41 px (5.7%) | 31 px (4.3%) | 31 px (4.3%) | no → no |
| long-passage | 1920x1080@100% | 64 px (5.9%) | 64 px (5.9%) | 42 px (3.9%) | 42 px (3.9%) | no → no |
| long-passage | 1024x768@100% | 40 px (5.2%) | 40 px (5.2%) | 25 px (3.2%) | 25 px (3.2%) | no → no |
| long-passage | 1920x1200@100% | 64 px (5.3%) | 65 px (5.4%) | 42 px (3.5%) | 46 px (3.8%) | no → no |
| long-passage | 3840x2160@100% | 80 px (3.7%) | 122 px (5.6%) | 42 px (1.9%) | 83 px (3.9%) | no → no |
| long-passage | 3840x2160@125% | 80 px (4.6%) | 102 px (5.9%) | 42 px (2.4%) | 67 px (3.9%) | no → no |
| long-passage | 3840x2160@150% | 80 px (5.6%) | 81 px (5.6%) | 42 px (2.9%) | 55 px (3.9%) | no → no |
| long-passage | 1920x1080@125% | 49 px (5.7%) | 51 px (5.9%) | 37 px (4.3%) | 33 px (3.9%) | no → no |
| long-passage | 1920x1080@150% | 41 px (5.7%) | 41 px (5.7%) | 31 px (4.3%) | 31 px (4.3%) | no → no |
| sermon-quote | 1280x720@100% | 39 px (5.4%) | 45 px (6.3%) | 31 px (4.3%) | 18 px (2.6%) | no → no |
| sermon-quote | 1920x1080@100% | 58 px (5.3%) | 70 px (6.5%) | 42 px (3.9%) | 28 px (2.6%) | no → no |
| sermon-quote | 1024x768@100% | 36 px (4.7%) | 40 px (5.2%) | 25 px (3.2%) | 20 px (2.6%) | no → no |
| sermon-quote | 1920x1200@100% | 67 px (5.6%) | 71 px (5.9%) | 42 px (3.5%) | 31 px (2.6%) | no → no |
| sermon-quote | 3840x2160@100% | 80 px (3.7%) | 141 px (6.5%) | 42 px (1.9%) | 57 px (2.6%) | no → no |
| sermon-quote | 3840x2160@125% | 80 px (4.6%) | 113 px (6.5%) | 42 px (2.4%) | 45 px (2.6%) | no → no |
| sermon-quote | 3840x2160@150% | 80 px (5.6%) | 94 px (6.5%) | 42 px (2.9%) | 38 px (2.6%) | no → no |
| sermon-quote | 1920x1080@125% | 46 px (5.4%) | 56 px (6.5%) | 37 px (4.3%) | 23 px (2.6%) | no → no |
| sermon-quote | 1920x1080@150% | 39 px (5.4%) | 45 px (6.3%) | 31 px (4.3%) | 18 px (2.6%) | no → no |

#### Stage monitor: clock, Next band and captions (8-line song)

| Screen | Clock before | after | Idle clock before | after | Next band before | after | Captions before | after |
|---|---|---|---|---|---|---|---|---|
| 1280x720@100% | 7.1% | 7.1% | 30.2% | 28.3% | 36.6% | 20.0% | 11.2 px | 12.0 px |
| 1920x1080@100% | 7.0% | 7.0% | 25.2% | 25.2% | 33.1% | 20.0% | 11.2 px | 16.0 px |
| 1024x768@100% | 5.3% | 5.3% | 22.7% | 22.7% | 29.6% | 20.0% | 11.2 px | 12.0 px |
| 1920x1200@100% | 6.3% | 6.4% | 22.7% | 25.2% | 30.3% | 20.0% | 11.2 px | 17.8 px |
| 3840x2160@100% | 3.5% | 7.0% | 12.6% | 25.2% | 17.1% | 20.0% | 11.2 px | 32.0 px |
| 3840x2160@125% | 4.4% | 7.0% | 15.7% | 25.2% | 21.4% | 20.0% | 11.2 px | 25.6 px |
| 3840x2160@150% | 5.3% | 7.0% | 18.9% | 25.2% | 25.7% | 20.0% | 11.2 px | 21.3 px |
| 1920x1080@125% | 7.1% | 7.0% | 30.2% | 25.2% | 36.4% | 20.0% | 11.2 px | 12.8 px |
| 1920x1080@150% | 7.1% | 7.1% | 30.2% | 28.3% | 36.6% | 20.0% | 11.2 px | 12.0 px |

#### Stage colours (sampled from the drawn screen, 1920x1080, worst case over the slides)

| Colour | Before | After |
|---|---|---|
| current label | #35567b on #0d0d0d: 2.56:1 | #84aad7 on #0d0d0d: 8.06:1 |
| verse marker | #5b5b5b on #0d0d0d: 2.86:1 | #999999 on #0d0d0d: 6.82:1 |
| current reference | #6f6f6f on #0d0d0d: 3.87:1 | #a7a7a7 on #0d0d0d: 8.08:1 |
| Next label | #53779e on #161616: 3.88:1 | #84aad7 on #161616: 7.51:1 |
| Next text | #8f8f8f on #161616: 5.6:1 | #8f8f8f on #161616: 5.6:1 |
| Next reference | #505050 on #161616: 2.24:1 | #a7a7a7 on #161616: 7.52:1 |
| clock | #a1abbc on #0d0d0d: 8.39:1 | #a1abbc on #0d0d0d: 8.39:1 |

#### Congregation screen (a long Bible passage)

| Screen | Text before | after | Reference before | after | Label before | after | Side margin before | after | Cut before → after |
|---|---|---|---|---|---|---|---|---|---|
| 1280x720@100% | 45 px (6.2%) | 45 px (6.2%) | 24 px (3.3%) | 24 px (3.3%) | 23 px (3.2%) | 23 px (3.2%) | 100 px (7.8%) | 64 px (5.0%) | no → no |
| 1920x1080@100% | 67 px (6.2%) | 67 px (6.2%) | 35 px (3.2%) | 35 px (3.2%) | 26 px (2.4%) | 26 px (2.4%) | 100 px (5.2%) | 96 px (5.0%) | no → no |
| 1024x768@100% | 42 px (5.5%) | 44 px (5.7%) | 25 px (3.2%) | 25 px (3.2%) | 18 px (2.4%) | 18 px (2.4%) | 100 px (9.8%) | 51 px (5.0%) | no → no |
| 1920x1200@100% | 74 px (6.2%) | 74 px (6.2%) | 38 px (3.2%) | 38 px (3.2%) | 26 px (2.1%) | 29 px (2.4%) | 100 px (5.2%) | 96 px (5.0%) | no → no |
| 3840x2160@100% | 132 px (6.1%) | 132 px (6.1%) | 48 px (2.2%) | 69 px (3.2%) | 26 px (1.2%) | 52 px (2.4%) | 100 px (2.6%) | 192 px (5.0%) | no → no |
| 3840x2160@125% | 107 px (6.2%) | 107 px (6.2%) | 48 px (2.8%) | 55 px (3.2%) | 26 px (1.5%) | 41 px (2.4%) | 100 px (3.3%) | 154 px (5.0%) | no → no |
| 3840x2160@150% | 89 px (6.2%) | 89 px (6.2%) | 46 px (3.2%) | 46 px (3.2%) | 26 px (1.8%) | 35 px (2.4%) | 100 px (3.9%) | 128 px (5.0%) | no → no |
| 1920x1080@125% | 54 px (6.2%) | 54 px (6.2%) | 28 px (3.2%) | 28 px (3.2%) | 26 px (3.0%) | 26 px (3.0%) | 100 px (6.5%) | 77 px (5.0%) | no → no |
| 1920x1080@150% | 45 px (6.2%) | 45 px (6.2%) | 24 px (3.3%) | 24 px (3.3%) | 23 px (3.2%) | 23 px (3.2%) | 100 px (7.8%) | 64 px (5.0%) | no → no |

The checks (`screen-sizes.cjs`, 577 in all) fail on the old build and pass now:
- the current text is never smaller than the Next text;
- an 8-line song at 1080p is at least 4% of the screen height;
- nothing is cut, on the stage or on the congregation screen;
- the Next band is at most a fifth of the screen;
- every stage colour reaches 4.5:1.

The old build failed 277 of the stage and congregation checks.

## Item 3: stage colours

| Colour | CSS before | CSS after | Contrast on #0a0a0a (CSS) |
|---|---|---|---|
| current label, Next label | #3a6186, #5b83a8 | #8db4dc | 3.05 / 4.96 → 9.14:1 |
| verse marker (and the unused "nothing next" style) | #666 | #a3a3a3 | 3.45 → 7.85:1 |
| current reference | #7a7a7a | #b0b0b0 | 4.61 → 9.13:1 |
| Next reference | #5a5a5a | #b0b0b0 | 2.87 → 9.13:1 |

The table above, sampled from the drawn screen, is the real measure.
- Small text samples darker than its CSS colour because of antialiasing.
- The lowest sampled ratio is now the verse marker's 6.82:1. It was 2.24:1 for the Next reference.
- The Next text (#9a9a9a, not one of the flagged colours) samples at 5.6:1 and was left as it is.

## Item 4: operator window and phone page

**Operator window, before:** all 72 checks failed (9 surfaces × 4 sizes × text and controls).
- **Text:** 33 kinds of text were under 12 px, from 9.9 px (`--text-2xs`) and 11.5 px (`--text-xs`): sub-tabs, result details, queue details, popover titles, the Screens count (10 px), the screen rows' second line (11 px), Bible book counts (10.4 px).
- **Controls:** 27 kinds were under 32 px high, among them:
  - the header and queue buttons (22.5 px);
  - the Search/Browse sub-tabs (21.5 px);
  - the small buttons such as + Queue and Project (24.5 px);
  - the preview switch (22 px);
  - the screen rows and their icon buttons (14.5 and 24 px);
  - clear search (20 px);
  - the status button (15.5 px).

**Operator window, after:** 72/72 checks pass.
- The two smallest text sizes are 12 px, and the fixed sizes under 12 px are 12 px.
- Every button, sub-tab, the preview switch, the screen rows, the status button, the language list and the inline "browse all songs" link are at least 32 px high. Icon buttons are 32 × 32.
- The status bar is 34 px high, to hold its button.
- The layout sweep (`sweep.cjs`, now also at 1440×900) finds nothing: no sideways scrolling and no control outside the window at 1040×640, 1366×768, 1440×900 and 1920×1080, each at 100%, 125% and 150%.

**Phone page:**
- **Before:** 28 text sizes from 9 to 11 px: the tab labels (10.5 px), the queue's kind labels (9 px), "On screen" and "Next — not on screen yet" (10–10.5 px), and captions. The Cancel button in the Save question was drawn at Safari's 11 px button default.
- **After:** all of them are 12 px, and the Cancel button is 15.5 px like the other main buttons. The phone sweep finds no text under 12 px on any of 720 screens plus the 384-screen pass through every role. The phone's buttons were already 34 px or more and 44 px where they were 44 px; nothing was made smaller.

## Item 5 (optional): congregation screen reference line, label and side margins

**Reference line and label (`78a71bf`):**
- The reference was capped at 48 px: 2.2% of the screen height on 4K at 100%, against 3.2% at 1080.
- It is now `max(1.5rem, 3.2vh)`.
- The label is now the larger of its old size and 2.4% of the screen height. Its old cap was 25.6 px, which was 1.2% on 4K.
- Neither is smaller than before at any resolution measured; they changed only on screens taller than 1080 lines.

**Side margins (`6461af5`):**
- The margins were a fixed 100 px (9.8% of the width on a 1024×768 projector, 2.6% on 4K).
- They are now 5% of the width for the text, the label and the reference.
- On 1024×768 a long passage now fits at 44 px instead of 42 px.

**Layout check:** at every resolution, for a verse, a long passage, an 8-line song, a quote and a long reference:
- no text is cut or runs off the side;
- the reference stays on screen and below the text.

A long reference wraps to two lines at 1280×720, 1024×768 and 1920×1200, as it did before at the same size. v1's congregation screen shows only quotes, Bible text and songs, so there were no pictures to check.

## Tests

| Test | Count | Before the fix |
|---|---|---|
| `src/test/repo/stageSizes.test.ts` (root size, no pixel caps, 1 rem captions, colours ≥ 6.6:1 from CSS, the faint colours gone) | 11 | all 11 fail |
| `src/test/renderer/stageFit.test.tsx` (55% smallest fit; Next fitted in its band, never starting above the current text) | 4 (2 new) | the 2 new fail |
| `src/test/repo/outputsWrap.test.ts` (the Next band is a fifth of the screen with its own fitted box; was: "not height-capped") | 3 (1 changed) | the changed one fails |
| `src/test/repo/operatorSizes.test.ts` | 5 | all 5 fail |
| `src/test/main/phoneTextSize.test.ts` | 1 | fails |
| `src/test/repo/congregationReference.test.ts` (optional) | 2 | both fail |
| `src/test/repo/congregationMargins.test.ts` (optional) | 4 | all 4 fail |
| `scripts/qa/screen-sizes.cjs` (real app) | 577 | 277 failed on the old build |
| `scripts/qa/operator-sizes.cjs` (real app) | 72 | 72 failed on the old build |

## Gates (each once, on the branch)

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 132 files, 1081/1081 passed |
| `npm run test:runtime` | passed (0 failed) |
| `screen-sizes.cjs` | 577/577 (re-run after `c7f2322`, which changed one stage colour) |
| `operator-sizes.cjs` | 72/72 |
| Layout sweep (`sweep.cjs`) | 0 findings |
| `output-probe.cjs` | 6/6 |
| Phone/iPad sweep (`remote-viewports.cjs`: WebKit and Chromium, portrait and landscape, 150% text, every phone role) | 720 screens, plus 384 in the role pass; 0 page errors; no text under 12 px |
| Remote regressions | `phone-data-safety` 49/49, `phone-recent-songs` 27/27, `remote-probe` 23/23, `remote-reconnect` 8/8 |
| CI on a pushed branch | none runs: the release workflow runs only on a `v*` tag or by hand |
| Identity | version 1.13.8 unchanged, appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316, icon SHA-256 a9dd996d / 805174be / 4f3e98c7; no change under `.github` or to `package.json` |

The phone sweep's notes that predate this round are unchanged:
- the Add to Home Screen sheet covers the queue screen until it is dismissed;
- the sheet's Close button is 34 px;
- the File, Save and Edit buttons are 36 px.

All of these are above the 32 px floor.

## Judgement calls

- **Root size floor of 12 px, not 16:** with a 16 px floor, a 720-line stage (or 1080p at 150% scaling) gets captions and spacing a third larger than its share. An 8-line song or a long passage was then cut at the new smallest size. With 12 px every size keeps its 1080 share down to 810 lines, and nothing is cut.
- **A fixed Next band:** the Next band is a fixed fifth of the screen height rather than "at most" a fifth. When its height followed its content, the current text was sometimes fitted while the band was still changing size, and a long passage got cut. A fixed band also stays in one place on the screen.
- **Next text is smaller:** the band is a fifth of the screen, so a four-line next verse is now about 20 px at 1080p (1.8% of the height), down from 42 px, and about 13 px at 720 lines. That is how the current verse is kept larger than the next. A one- or two-line next item is larger.
- **Colours:** the labels became a lighter blue in the same hue, and the references and verse numbers a lighter grey. Nothing changed colour family. The view switch (Stage / Congregation) stays faded until pointed at, as before.
- **The A–Z song index rail:** its letters went from 10 px to 12 px. Its buttons stay shorter than 32 px, because 26 letters at 32 px would not fit the window's height at 768 lines. It is left out of the control check.
- **Operator controls:** the floor is a `min-height`, so nothing that was already taller changed.
- **Two tiers merged:** the two smallest size tokens are both 12 px now; the tiers above them are unchanged.
- **Help:** Help never describes stage sizes, and "the Stage monitor keeps its own size" is still true, so no Help text changed. The Help pictures were retaken because the operator window's buttons and the phone's captions look different. They use placeholders only and are each under 300 KB.
- **Measurement setup:** the measurements use the real app with its output windows hidden and sized by the DevTools protocol. Real displays, real TVs and real Windows scaling were not used.

## Not verifiable here: the owner's checklist

1. **Stage monitor at the church, with a real song of 6 to 8 lines, from the pulpit:**
   - the current verse fills most of the screen;
   - the Next band along the bottom is about a fifth of the screen;
   - the next verse is smaller but readable;
   - "Verse 1" and "Next · Verse 2" are light blue and easy to read.

   Then put up a long Bible passage: nothing is cut off at the top or bottom.
2. **If the church has a 4K TV for the stage:** the text should fill the same share of the screen as on a 1080p one, not sit in a small band in the middle.
3. **On the stage monitor, Shift+Esc or Hide screen:** the big clock fills the screen as before.
4. **Projector, from the back row** (only if item 5 is in the release):
   - the reference line under a verse is readable;
   - the text has a margin of about a twentieth of the screen width each side;
   - on a 4:3 projector the margins are narrower than before and the text a little wider.
5. **Operator window:**
   - on the church computer at its usual scaling, the buttons and tabs are bigger but nothing is pushed off the window;
   - the Screens menu's rows and icons are easy to hit.
6. **A phone:** the tab labels at the bottom and the queue's SONG / BIBLE labels are a little larger and still on one line.

## Remaining risks

- **The Next verse at pulpit distance:** it is now small (about 2% of the screen height). If the platform needs to read the next verse, not just glance at it, the band's share or the current verse's smallest size would need the owner's call.
- **The current verse in two cases:** the 8-line song on 4K at 125% scaling went from 80 px to 77 px (4.6% to 4.4% of the height), because the band is now a fixed fifth. Every other case stayed the same or grew.
- **The idle clock on 720-line screens:** it is a little smaller (30% to 28% of the height); on 4K it doubled.
- **Windows scaling:** emulated, not run on Windows; Chromium lays out the same way there.

## Not done

- No real TV, projector or Windows computer was used (see the checklist).
- The congregation screen's slide text itself was not changed: its 132 px cap still gives 6.1% on 4K instead of 6.2%. Item 4 said not to touch it.
- The changelog was not edited; the proposed entry is below.

## Proposed changelog entry

```
**On the stage monitor**
- On a 4K or other large screen the stage text now fills the same share of the screen as on a 1080p one, instead of sitting in a
  small band in the middle. Its labels and clock grow with it.
- The current verse is never smaller than the next one. The Next band along the bottom takes a fifth of the screen, with its text
  fitted inside it; a long current verse goes no smaller than about half its size.
- The labels ("Verse 1", "Next"), references and verse numbers are brighter, so they can be read from the platform.

**In the app and on the phone**
- No text in BORN's window or on the phone is smaller than 12 px, and every button and tab in BORN's window is at least 32 px high.

**On the congregation screen** (optional changes)
- On a 4K or other tall screen the reference line and label keep their size relative to the screen, instead of staying at their
  1080p size.
- The side margins are 5% of the screen width instead of a fixed 100 px, so a 4:3 projector loses less of its width.
```
