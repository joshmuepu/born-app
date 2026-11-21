# BORN v1 fixes round for 1.13.10: report

Branch `v1-fixes-1.13.10`, from `main` at the 1.13.9 release report (`0cc1016`). Nothing was merged, tagged, published or version-bumped; the
changelog and the website were not touched.

| Item | Result | Commits |
|---|---|---|
| 1. Interface size never breaks the operator window | **Code changed.** The View menu zoom is fitted to the window, with a "reduced to fit" line | `6245db4` (fix), `1673282` (check script), `5c90238` (Help sentence) |
| 2. Congregation text that shrinks a lot says so | **Code changed (warning only).** "Text is very small" / "Text is cut" marks for the operator; the congregation screen is unchanged | `c566f02` (fix), `03e4279` (check script) |
| 3. Stage monitor text floor | **No change.** The 12 px floor is never what limits stage text; a test pins it | `c9d14ae` (test) |
| Items 2 and 3 | Measurement script for real content | `8d57c3e` |
| 4. The stage's current text is never cut (asked for after the first report) | **Code changed.** A long page gets room for itself only; 0 of 231 pages cut | `9bdd048` (fix), `224740f` (scripts) |

Each item's commits stand alone: any one can be dropped with `git revert` without the others. Items 2 and 3 both use `8d57c3e`, a script only.
`9bdd048` also updates the item 3 test (`stageTextFloor.test.ts`) for the new 16 px minimum; reverting it restores that test as it was.

## How it was measured

All measurements ran in the real app, built from the branch, on isolated profiles (a temporary data folder, remote port 14316, CDP 9376, a
separate network name), with the output windows kept hidden (`hide-outputs.cjs`). Screen sizes were set with the DevTools protocol; no display
was touched. No running BORN instance of the owner's was touched, and every app started was stopped.

## Item 1: the operator window at its largest interface size

**Which case applied.** v1 has no interface size setting of its own. It does have a zoom: BORN sets no menu of its own, so Electron's
standard menu is in place, and its **View** menu has **Zoom In**, **Zoom Out** and **Actual Size** (Ctrl/Cmd + = − 0). That zoom applies to the
operator window only (measured: the congregation screen and stage monitor stayed at 100%), from 25% to 500%, and is not kept after a restart.
This was treated as v1's interface size, so the "setting" branch of the item applies; no setting was added.

**Before** (the menu's real zoom items, driven in the main process; the layout is made for at least 1040x640):

| Window | Zoom where controls first ran off the window | What ran off |
|---|---|---|
| 1040x640 (the smallest allowed) | 158% | the sermon cards, then the theme button (189%), Help (207%), Shortcuts (227%) |
| 1280x800 | 189% | the sermon cards, then the theme button (227%) |
| 1920x1080 | none up to 227% (the layout was 845x425 there) | — |

**Change** (`src/main/operatorZoom.ts`):
- The zoom the operator chooses is remembered. The window shows the largest zoom up to it that still gives the layout 1040x640, and never
  less than 100%: `max(1, min(width / 1040, height / 640))`, with the window size in screen points, so moving to a display with other scaling
  gives the same fit.
- While that is less than the chosen zoom, one line at the bottom of the window says: "Zoom reduced to fit this window. A larger window shows
  the zoom you chose."
- Resizing the window, moving it, a display change and the menu's zoom items (and their shortcuts) re-fit at once. Actual Size is heard from
  its menu item, because at a zoom already reduced to 100% it changes nothing on the page.
- Zooming out below 100% is left as it was (see "Noticed, not changed").
- The text and control floors hold because the shown zoom is never under 100%, where the window already meets them (12 px, 32 px).

**After** (`scripts/qa/operator-zoom.cjs`, 46 checks, 0 failed), at the menu's largest zoom (500%), on the start screen and on sermon results:

| Window | Zoom shown | Layout | Controls off the window or covered | Text < 12 px, controls < 32 px (as drawn) | Line shown |
|---|---|---|---|---|---|
| 1040x640 | 100% | 1040x640 | none | none | yes |
| 1280x800 | 123% | 1040x650 | none | none | yes |
| 1600x900 | 141% | 1137x640 | none | none | yes |
| 1920x1080 (966 high on this screen) | 151% | 1272x640 | none | none | yes |

Live re-fit, also checked:
- 131% chosen on the smallest window shows 100% with the line, and 131% without the line as soon as the window is made larger.
- Made small again, it shows 100% with the line again; Actual Size gives 100% and clears the line.
- A zoom that fits (120% on 1920x1080) is shown as chosen; zooming out to 83% is left as it is.
- The output windows stay at 100% throughout.

Unit tests: `src/test/main/operatorZoom.test.ts` (the fit, the reduced flag, Actual Size and menu steps while reduced, zoom-out left alone).
Help: one sentence in `operators/shortcuts.md`.

## Item 2: congregation text that shrinks a lot

**What v1 has.** The congregation screen fits a slide by shrinking it from its starting size (4.2% of the screen width, at most 7.4% of its
height) in steps down to a third of it. A slide that still does not fit has its end cut off. The operator was told neither. There is **no "Text is cut" mark and no "Ready?" check in v1**, so the most conservative reading was taken: the warning
uses the place and style of the live preview's existing warning badges ("Not in your queue") and the queue rows' small tags ("Up next").
Bible verses and sermon paragraphs are already split into pages of at most 240 characters (`shared/paginate.ts`); song pages are not split.

**Measured** (`scripts/qa/content-sizes.cjs`): every one of the 5,219 song pages in the bundled library and the 3,000 longest of the 97,546
Bible pages (KJV, ASV, WEB), fitted in a hidden copy of the screen's own layout and cross-checked with real slides (identical sizes), at the default projected text size:

| Screen | Content | Starts at | Smallest | Share of height | Shrink | Pages under 3% | Cut |
|---|---|---|---|---|---|---|---|
| 1920x1080 | song pages | 80 px | 32.0 px | 2.96% | 0.40 | 1 | 0 |
| 1920x1080 | Bible pages | 80 px | 76.8 px | 7.11% | 0.96 | 0 | 0 |
| 3840x2160 | song pages | 160 px | 64.0 px | 2.96% | 0.40 | 1 | 0 |
| 3840x2160 | Bible pages | 160 px | 153.6 px | 7.11% | 0.96 | 0 | 0 |
| 1280x720 | song pages | 53.8 px | 21.5 px | 2.99% | 0.40 | 1 | 0 |
| 1280x720 | Bible pages | 53.8 px | 51.6 px | 7.17% | 0.96 | 0 | 0 |

The one song page under 3% is a 15-line page of "More Than Anything"; the next smallest is 3.56% (13-line pages).

**Threshold.** 3% of the screen height (32 px on a 1080-line screen), as given, kept: the numbers show a clear gap there (one page at 2.96%,
the next at 3.56%), and the starting size is 7.4%, so 3% means the text was shrunk to about 40% of its intended size. No bundled content comes
near the smallest fit (a third), so nothing bundled is cut, but a song a church imports or pastes can have longer pages and be cut.

**Decision.** Content does go under the threshold, so the operator is warned; the congregation screen is unchanged, because no bundled content
goes below a readable size (the smallest is 2.96%) and v1 has no way to split a song page into more pages.

**Change:**
- With the congregation screen open, it measures every queued slide at its real size and projected text size, laid out off screen exactly as
  it would be shown (`ProjectionApp.tsx`, `shared/slideFit.ts`).
- Under 3% of the screen height the operator window says **Text is very small**; a slide that does not fit at the smallest size says **Text is
  cut**. On the queue row before it is live (the item's worst slide), and on the live preview while that slide is on screen.
- It measures again when the queue, the screen's size or the projected text size changes. With the screen closed nothing is measured or
  shown.
- The first take also put the mark on the active row's title line, where it ran off the right edge; it was removed there (the live preview
  shows it).

**Tests.**
- `src/test/renderer/queueFitNotices.test.tsx` fails on the old code: a very long song page and a very long verse page, measured small and cut,
  are marked on their rows, and the live mark follows the slide on screen.
- `src/test/shared/slideFit.test.ts`: the threshold, using the measured sizes; cut outranks small; a very long verse is split into pages of at
  most 240 characters.
- Real app: `scripts/qa/slide-fit.cjs` (15 checks, 0 failed). The long song's row is marked at 1920x1080, 3840x2160 and 1280x720 before it is
  live, and a short song's row is not. The live mark appears only while the 15-line page is on screen (32.0 px, 2.96%) and clears on the
  opening page, and no mark is left once the item is removed.

## Item 3: the stage monitor text floor

**What v1 has.** The stage's root text size is the screen height / 67.5, never under 12 px. The current text starts at 4.2% of the width and
fits down to 55% of that; the Next text fits its band (a fifth of the screen) down to 0.9 rem.

**Measured** (`scripts/qa/content-sizes.cjs`, the same content as item 2; the current text with a Next verse showing):

| Screen | Root | Current text: smallest (song / Bible) | Current under 12 px | Next text: smallest (song / Bible) | Next under 12 px |
|---|---|---|---|---|---|
| 1280x720 | 12 px (floor applies) | 29.6 / 45.2 px | 0 | 13.5 / 18.4 px | 0 |
| 1024x768 | 12 px (floor applies) | 23.7 / 43.0 px | 0 | 14.7 / 19.7 px | 0 |
| 1600x900 | 13.3 px | 36.7 / 56.0 px | 0 | 18.0 / 23.6 px | 0 |
| 1920x1080 | 16 px | 44.0 / 67.2 px | 0 | 20.0 / 28.3 px | 0 |
| 1920x1200 | 17.8 px | 44.4 / 74.2 px | 0 | — | — |
| 2560x1440 | 21.3 px | 58.7 / 89.6 px | 0 | — | — |
| 3840x2160 | 32 px | 88.0 / 134.4 px | 0 | 43.3 / 56.6 px | 0 |

**Decision.** The 12 px floor applies only below 810 lines, and there it makes the root *larger* (12 px instead of 10.7 px at 720 lines). No
stage text comes near 12 px: the smallest current text is 23.7 px and the smallest Next text 13.5 px, and the current text cannot be fitted
under 22.2 px on any stage from 720 to 2160 lines, 4:3 to 21:9. The floor is not a practical problem, so nothing changed;
`src/test/repo/stageTextFloor.test.ts` pins that arithmetic. The current text was cut on long song pages, by its 55% limit, not the
12 px floor; that is item 4.

## Item 4: the stage's current text is never cut

**Before.** With a Next verse showing, the stage cut the end off the current text of long song pages. The current text stopped at 55% of its
size and the Next band kept a fifth of the screen. 231 of the 5,219 bundled song pages (on 124 songs) were cut on every 16:9 stage; up to 10 were
cut even as the last page. This came from 1.13.9.

**The rule now** (`src/renderer/src/stageRoom.ts`, `StageApp.tsx`): a page whose current text does not fit gets room one step at a time, for
that page only, and only as far as it needs:
1. A smaller Next band (15%, then 11% of the screen height instead of 20%), with its text fitted to it. A step whose Next text would be cut is skipped.
2. No Next band for that page.
3. Smaller current text than the usual 55%, down to the size that fits, never under 16 px at any screen height.

The step starts again at 0 for every new page, screen size or view, so the next page is drawn as usual. A page whose current text fits at step 0
is drawn exactly as before (step 0 only moves on for cut current text). v1 has no way to split a song page across stage pages, so a page that
could not fit at 16 px would stay at 16 px; no bundled page comes near that.

**Reading taken for the Next text.** The Next text shows at most its first 4 lines, ending in an ellipsis, by design: it is a preview of what
comes next. That was left as it is, because changing it would change pages that fit today. "Never cut" was checked as: nothing in the Next band
is clipped beyond that preview.

**Before and after, real slides** (`scripts/qa/stage-pages.cjs`): every bundled song page (5,219) and the 3,000 longest Bible pages were sent
to the real stage monitor of each build, with the following page as Next and with no Next. The table counts current text that was cut:

| Stage | Songs, with Next: before → after | Songs, last page: before → after | Bible pages, either | Next text cut (after) |
|---|---|---|---|---|
| 1280x720 | 231 → 0 | 10 → 0 | 0 → 0 | 0 |
| 1024x768 | 28 → 0 | 0 → 0 | 0 → 0 | 0 |
| 1600x900 | 231 → 0 | 10 → 0 | 0 → 0 | 0 |
| 1920x1080 | 231 → 0 | 10 → 0 | 0 → 0 | 0 |
| 1920x1200 | 112 → 0 | 1 → 0 | 0 → 0 | 0 |
| 2560x1440 | 231 → 0 | 10 → 0 | 0 → 0 | 0 |
| 3840x2160 | 231 → 0 | 10 → 0 | 0 → 0 | 0 |

**What the 231 pages needed** (each 16:9 size alike):
- **A smaller Next band:** 1 page (Midnight Cry, page 3, 9 lines).
- **No Next band, current text at no less than 55%:** 220 pages.
- **No Next band and smaller current text:** 10 pages, all of 13 lines or more:
  - Israel Anthem p1;
  - Jehovah God p4;
  - Jesus Dropped The Charges p1–4;
  - Privileged To Serve Him p3;
  - This Is How It Feels To Be Free Choir Edition p7;
  - We Are The People p6;
  - More Than Anything p10 (15 lines).

  At 1080 lines these are drawn at 41.6 px, and More Than Anything at 35.2 px.
- **Smallest current text on any page:** 23.6 px at 720 lines (3.28% of the height); 35.2 px at 1080; 70.4 px at 2160. No page reached the 16 px
  minimum and **no page is left that cannot fit**.
- **Unchanged pages:** compared field by field (current text size, cut or not, Next band height, Next text size, Next cut or not), every page
  that was not cut is drawn **exactly as before** in all 28 groups (7 sizes × with/without Next × songs/Bible). That is 4,988 of 5,219 song
  pages with Next at 16:9, and all 3,000 Bible pages.

**Tests.**
- `src/test/renderer/stageRoom.test.tsx` uses a model of the stage's layout, since jsdom has none. A 15-line page and a 20-line page with a
  Next verse are cut on the old code and fit now. A page that fits keeps the full band and the usual fit, a last page shrinks only if it
  must, and a 40-line page stops at 16 px. Four of its page tests fail on the old code.
- The steps and the 16 px limit are tested directly.
- Real app: `scripts/qa/stage-room.cjs` (43 checks, 0 failed) runs a stage window at 1280x720, 1920x1080 and 3840x2160. Four long bundled
  pages are not cut, with Next and as the last page, and their Next text is not cut. A page that fits keeps the full band with no change, and
  so does the short page after a long one.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test` (full unit suite) | 138 files, 1110/1110 passed (after item 4) |
| `operator-zoom.cjs` (new) | 46 checks, 0 failed |
| `slide-fit.cjs` (new) | 15 checks, 0 failed |
| `operator-sizes.cjs` (the queue rows changed) | 72 checks, 0 failed |
| `output-probe.cjs` (the congregation screen changed) | 6 checks, 0 failed |
| `content-sizes.cjs` (new, a measurement) | ran; numbers above |
| `stage-pages.cjs` (new): both builds, then `compare` | 0 pages cut after (231 before); every page that was not cut drawn exactly as before |
| `stage-room.cjs` (new) | 43 checks, 0 failed |
| `screen-sizes.cjs` `ONLY=stage` (the stage changed) | 437 checks, 0 failed |
| `output-probe.cjs`, after item 4 | 6 checks, 0 failed |

Not run (nothing they cover changed): the congregation part of the screen-size check, the phone checks, the layout sweep. No release workflow
was started. No gate failed for a reason outside this round.

## Noticed, not changed

1. (Fixed as item 4: the stage cut the current text of long song pages.)
2. **Zooming out below 100%** (View → Zoom Out) still makes operator text smaller than 12 px and controls shorter than 32 px. The item's rule
   is about reducing a chosen size; zoom-out is the operator's own choice and was left as it was.
3. **The stage's Next text is under 3% of the screen height for almost every page** (5,008 of 5,219 song pages at 1080 lines). That is by design (a
   glance at what is next, not reading) and was accepted in 1.13.9; it is never under 12 px.
4. **The slide-fit marks need the congregation screen open**, because only the screen knows its real size. Before the screen is opened, a
   queue shows no marks.
5. **The View menu zoom is not kept after a restart**; that is unchanged.

## For the owner to check on the church PC

1. **Operator window at the largest size, on the real screen.** View → Zoom In until it stops.
   - Nothing runs off the window.
   - The bottom line says the zoom was reduced.
   - Make the window bigger: the text grows. View → Actual Size: back to normal, and the line goes.
2. **A long verse and a long song on the projector.**
   - Queue a long Bible passage: no mark, and each page is large from the back row.
   - Queue "More Than Anything": its row says **Text is very small**. Put its tenth page (Verse 10) up: the live preview says so too, and from the back row judge whether that size is acceptable.
   - With the projector at its real size, any other songs your church uses that show the mark are worth splitting into shorter pages in the
     song editor.
3. **The stage monitor with a real 6 to 8 line song**, from the pulpit: the current verse is large and whole.
   - Also try a long one, such as the 9-line page of "Be Still And Know", with the next verse showing: the whole verse shows, and the Next
     band is left out for that page only; the page after it has the Next band again.
