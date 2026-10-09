# v1 QA pass 3 — report

Branch: `v1-qa-pass-3` (off `v1-qa-pass-2`), isolated userData profile (same as passes 1/2). Two defects carried over from Pass 2, each fixed in its own commit with tests. Full suite + typecheck green before every commit.

## F9 — corrupted sermon database (commit `dff5539`)

**Before:** a corrupted `sermons.db` (e.g. disk write cut short, drive error) either crashed the open attempt or left the app silently stuck with no sermons and no explanation.

**Fix:** `src/main/dbIntegrity.ts` — `PRAGMA integrity_check` on startup for both `sermons.db` and `library.db`. A damaged file is renamed to `<name>.corrupt-<timestamp>` (never deleted — kept in case support needs it) and the app reseeds from the bundled copy / re-fetches, exactly like a first run. The footer shows a plain-language message ("Your local sermon data was damaged — it's been reset and is rebuilding now") instead of a silent or confusing state, with a Retry button and an always-visible "Open data folder" action.

**Tests:** `src/test/main/dbIntegrity.test.ts`, 4 cases — missing file (seeds), healthy file (left alone), file that won't even open (quarantined + reseeded), file that opens but fails `integrity_check` (quarantined + reseeded). All pass stably across repeated runs.

**Live verification:** screenshots in `docs/qa/screenshots3/f9-before-normal-state.png` and `f9-after-reseeding-in-progress.png`. The exact zero-indexed "just recovered" moment was too fast in this dev environment to catch mid-transition (the indexer crosses into normal progress within a fraction of a second) — this is stated plainly rather than claimed as captured; the recovery itself was confirmed via the exact expected log sequence and the quarantined file present on disk afterward (`sermons.db.corrupt-2026-10-09T...`).

## F7 — wrong verse/chorus labels on split songs (commit `a660937`)

**Before:** a named section's continuation slide (e.g. the back half of a 2-slide chorus) was labeled blank, which a downstream renumbering step misread as "give this a brand-new verse number" — producing labels that collide with a later, genuinely different section. Confirmed on the real bundled "How Great Thou Art": the 2nd half of Verse 1 came out mislabeled "Verse 2," an exact duplicate of the song's real Verse 2 later on (Pass 2's original finding, `docs/qa/screenshots2/song-label-bug-how-great-thou-art.png`).

**Investigation note:** the root cause first suspected in Pass 2 (the unnamed-group verse counter in `proPresenter7.ts`) turned out, on direct inspection of the real bundled-library data, to already be correct — "This Little Light Of Mine" genuinely has 5 distinct verses dumped in one unnamed ProPresenter group, each correctly getting its own number. An initial fix attempt based on that first theory was written, checked against the full bundled library, found to incorrectly collapse that song's 5 real verses down to one repeated "Verse 1," and was reverted before being committed. The actual bug was traced instead to `normalizeSlideLabels()` in `src/main/songs.ts`, confirmed by hand-tracing it against the real Pass-2 `library.db` row data and matching the exact chip sequence in the original screenshot.

**Fix:** every cue in a *named* ProPresenter group now repeats that group's own name instead of leaving continuation slides blank. Unnamed-group handling (the original, incorrect suspect) is untouched.

**Safety check — the whole bundled library, not a sample:** snapshotted every slide's label, text, and order for all 1,164 bundled songs (`Songs.zip`) before and after the fix. Result: 231 songs got a label-only change, **0 songs had any change to lyric text, slide order, title, or song key.**

**Tests:** `src/test/main/songParsers.test.ts` — `how-great-thou-art.pro` (the real fixture, copied from the bundled library) asserts the exact corrected label sequence (`Verse 1, Verse 1, Chorus 1, Chorus 1, Verse 2, Verse 2, …`), that no slide is ever left unlabeled, and that the lyric text is unchanged and in original order. A second test explicitly pins `little-light.pro`'s unnamed-group case (5 distinct verses, each its own number) as unaffected by this fix. All existing tests, including two pre-existing tests of `normalizeSlideLabels`'s own intended behavior for non-ProPresenter formats, pass unchanged.

**Live verification:** rebuilt the real `library.db` (isolated QA profile, reusing its already-cached Bible data) from the fixed parser against the full bundled library, then drove the actual running app via CDP to search "How Great Thou Art" and read the real jump-chip row. Screenshots: `docs/qa/screenshots3/f7-before-how-great-thou-art-colliding-labels.png` (Pass 2's original bug) and `f7-after-how-great-thou-art-fixed-labels.png` (this fix, same song, real UI) — chip row reads `Verse 1, Verse 1, Chorus 1, Chorus 1, Verse 2, Verse 2, Chorus 1, Chorus 1, Verse 3, Verse 3, …`, no collisions.

## What could not be verified

- Every one of the 231 label-changed songs was checked programmatically (text/order byte-identical, label change only) but not individually eyeballed — the "How Great Thou Art" live check above is the one done by hand, end-to-end, through the real UI.
- The remaining ~930 unaffected bundled songs were confirmed unaffected by the same whole-library diff, not spot-checked individually.
