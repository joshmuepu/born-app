# v1 service notes — what was found and fixed (branch `v1-service-notes`, from v1.13.2 `14afed7`)

Hardening only: bug fixes, no new feature, setting, screen, button, shortcut or menu item. Nothing merged, tagged, released or version-bumped.
Everything below was measured on the **real app** (isolated profile, seeded library, projection and stage windows created but kept hidden, never shown on a monitor), 1366×768 and 1920×1080 at 100% and 1366×768 at 150%.
Scripts: `scripts/qa/esc-matrix.cjs`, `reach-probe.cjs`, `reach-jump.cjs` (+ `hide-outputs.cjs`). Other docs here: `02-needs-owner-decision.md`, `03-draft-changelog-v1.13.3.md`.

## The owner's notes and how they were read
**Note 1 — "when pressing Esc while projecting the sermons, it scrolls things down. It should stay fixed."**
Read as: Esc hides the screens (that is the v1.13.2 rule and stays); the operator's list must not move. Tested every list (sermon reader, Bible chapter, song slides, queue, search results), Esc / Esc / phone-remote hide / show / Shift+Esc, and the projection and stage pages themselves.
Only the *operator window* moved. The projection and stage pages never scroll (checked on hide and show).

**Note 2 — "get easily to the queued sermon, especially a paragraph far down … a bunch of things are highlighted … where there are no paragraphs, go by slide."**
Read three ways, all tested on "The Revelation of Jesus Christ" (60-1204M, 749 cards, ¶396–399 and the last paragraph), the longest sermon (389 rows, 1,680 cards), a sermon with one 6,276-character paragraph and the no-paragraph-number book chapters ("1 - The Revelation Of Jesus Christ", "5 - The Pergamean Church Age"):
1. *Reach*: click the queued row → does the reader show the queued paragraph? Evidence says yes it opens at the right place within ~150–800 ms, but it landed at the **end** of a multi-paragraph range, so the paragraph you queued was partly off-screen, and pressing Project left the live paragraph off-screen.
2. *"A bunch highlighted"*: a queued range marks every paragraph of the range (that is intended), but a paragraph **with no number** marked every slide of itself at once, all labelled "On screen" and "¶§103655" (an internal id).
3. *"No paragraphs → go by slide"*: those no-number chapters are the case. They were readable but unusable as a list: identical labels, everything lit. Now each slide is labelled "Slide 1, 2, 3" and only the one on screen is lit.
A *new* way to jump (type a paragraph or slide number, "back to the queued paragraph" button) was **not built**: see `02-needs-owner-decision.md`.

## Reproduced and fixed
| # | Commit | What the operator saw | Test |
|---|---|---|---|
| 1 | `ca504c9` | **Our own v1.13.2 regression.** With a song open, any Esc moved keyboard focus to the key button, even with the picker closed | `SongKeyPicker.test.tsx` (fails before) |
| 2 | `f1e3b92` | **Esc scrolled the sermon reader.** Hiding the screen dropped the "live" paragraph, so the reader fell back to the queued range and scrolled to its **last** card. Also the queued range now opens at its **first** paragraph | `SermonFollowView.test.tsx` (3 new, 2 failed before) |
| 3 | `7a5cd83`, `4f3dd1f` | **Esc closed the Bible chapter** (back to the book list) and, after showing again, jumped to the verse. Now the chapter stays open at the same verse | `BiblePanel.test.tsx` |
| 4 | `4f3dd1f` | Hiding the screen shifted the song slide list by 4 px (the "On screen" tag was taller than the label) | `songSlideTagHeight.test.ts` |
| 5 | `32dfbf6` | A paragraph with **no number** lit all its slides together ("¶§103655"); pages past the 26th of a long paragraph were labelled `{`, `|`, `}` … (now aa, ab …) | `queueItem.test.ts` (page letters, `liveParagraphRef`), `SermonFollowView.test.tsx` |

Display only: slide text, references, saved files and the projector are unchanged (the new page letters only differ from the old ones past page 26, which were garbage).

## Numbers
**Esc scroll (sermon reader, operator scrolled 25% in), first Esc:**
| Window | Before | After |
|---|---|---|
| 1366×768 | 21,614 → 85,052 px | unchanged |
| 1920×1080 | 19,312 → 75,756 px | unchanged |
| 1366×768 @150% | 25,648 → 101,076 px | unchanged |

Full matrix: 80 checks per size; before 31 failed (sermon reader 10, Bible 11, song 10), after **0 failed** at all three sizes. (Two things in the matrix were corrected while building it: the phone remote's second command is `unblank`, not a second `blank`; and while hidden the Bible/song lists legitimately lose their "On screen" tag. Real failures before: reader scroll, Bible chapter closing and re-jumping, song 4 px.) Focus, selection, open views, queue scroll and the projection/stage pages were also unchanged.

**Reaching a far paragraph** (`reach-probe`, `reach-jump`; click the queued row, Project, Next, Next, Previous; queue is always on the right, so "back to the queue" costs 0 actions):
| Case | Click row (ms) | Marked paragraphs in view, before → after | After Project, live paragraph in view | Next/Previous |
|---|---|---|---|---|
| ¶396–399 of 749 cards | 205 → 204 | 4 of 5 (¶396 hidden) → 4 of 5 (¶396 first, centred) | **no → yes** | stays in sermon, in view |
| last paragraph | 145 | 5 → 4 (first mark now centred) | yes | yes |
| longest sermon, last row (1,680 cards) | 167 → 160 | | yes | yes |
| no-number chapter, row at 80% | 175 | 3 lit → **1 lit** ("Slide 1") | 3 lit → 1 | 1 lit, follows Slide 2, Slide 3 |
| 6,276-char paragraph (31 slides) | 202 → 58 | 31 marked (one paragraph, intended) | yes | yes |

Steps for the operator: 1 click to open the queued row, 1 click to project, 1 key per slide; no scrolling needed. Time is well under a second even with 1,680 cards. Jumping from one queued row to another in the **same** open sermon works (reader moved 84,696 px in 778 ms in the probe). A search-term highlight ("still searching") adds no measurable delay (the sermon reader scenario opens from a search with a phrase); I did not time a very common one-word search separately.

## Whole-service hunt
Covered by: the matrix (sermon far paragraph, Bible, song, queue, search results; screens on/off; stage window present), `flows.cjs` (600-item queue, restart, Tab focus) 8/8, `sweep.cjs` (10 surfaces × sizes × scales × themes) 0 findings, and the packaged smoke. I did **not** build a separate scripted song→Bible→sermon→song service end to end beyond that, and did not drive a real projector or a phone. Nothing else clear was found, so nothing else was changed.

## Does v2 have the same bugs? (read-only look at `born-again`, branch `v2-channels`)
- Song key Esc focus: **yes**, same line (`SongKeyPicker.tsx:43`).
- Page letters past 26: **yes** (`queueItem.ts:288`; v2's tape code already clamps with `Math.min(i, 25)`).
- Bible chapter closing on hide: **yes**, same `focusVerse = preview ?? onScreen ?? browseAnchor`.
- Sermon reader on hide: **probably yes** — same `focusRef = liveRef ?? anchorRef` and the same blank → `onScreenLoc` null; but v2 already scrolls to the **first** matching card (not the last) and has the paragraph-number jump and the ◂ ▸ search-match walker. Not measured in a running v2.
- Song tag 4 px and no-number slides: shared code, expected to behave the same; not measured.
v2 should get fixes 1–5 by intent (this branch is not merged into v2; v2 was not touched).

## Verification (once, at the head commit)
- Typecheck clean. Unit tests **63 files, 757 tests, all pass** (start: 61 files, 745 at v1.13.1; `npm test` passed on the first run, no teardown flake).
- Production build builds. Probes: `flows` 8/8, `sweep` 0 findings, Esc matrix 0/80 failed ×3 sizes.
- Packaged macOS arm64 smoke: 11/11 (bundle id, name, version 1.13.2, icon `805174be`, libraries, remote, searches, no log errors).
- Old-file compatibility (`compat.cjs`, four formats): output **identical** to a build of `origin/main` once the random per-load item ids are normalised.
- Identity: version 1.13.2, appId `com.joshmuepu.born`, productName "Branham or Nothing", port 4316 unchanged; icons sha256 `a9dd996d` / `805174be` / `4f3e98c7` unchanged; `git diff origin/main` touches no `package.json`, `build/`, `resources/`, `.github/`.
