# 6. Where the tape should live — options, recommendation, migration

Context: [05-placement-review.md](05-placement-review.md) (what is wrong today). Clickable mockups: [mockups/index.html](mockups/index.html) → *Where does the tape live?* (start with [the side-by-side](mockups/17-compare-placement.html); every option has buttons for the situations that matter: tape playing in Sermons, go to Songs, a verse goes on the screens, a video starts, narrow window).

## Recommendation (6 lines)
1. **Choose Option A: an app-wide "now playing" bar plus a "Tape" place in the left rail.**
2. The bar sits at the bottom of **every** section, so the tape is controllable (and visibly playing) while the operator runs Songs, Bible, Media and announcements — the main flaw today.
3. Play lives in the **bottom bar**, Take/Project live in the **right-hand Preview/Live column and the cards**: far apart, so Play cannot be mistaken for Take.
4. The Sermons reader goes back to being a clean reader (one small "Following the tape · ¶5" chip); the three control strips leave it.
5. The **Tape place** is the home for everything that is not mid-service: all recordings with their status, the big follow view, timing, options, adding a recording.
6. It uses structures the app already has (left rail, one-row bar, Preview/Live), reuses almost all existing tape components, and changes **no stored data**.

## The options
| | Idea | Fit | Safety | Effort | Risk |
|---|---|---|---|---|---|
| **A ★** | Bottom transport bar in every section + "Tape" place in the rail | Very good: rail is how the app is already organised | Best: Play apart from Take; the bar says what is on the screens | **M** | **Low** (renderer only) |
| **B** | A "Tape service" workspace (a mode) + top-bar mini-bar elsewhere | Good for a tape-only service; heavier for a service that mixes tape, songs and verses | Good in the workspace; minimal controls outside (can't skip ¶ from Songs) | M–L | Medium (a second place to keep in sync; mode switching under pressure) |
| **C** | Docked panel (T) beside the queue | Good: reuses the right column | Medium: the queue and the tape fight for one column; Take/Preview sit right under Play | S–M | Medium (queue is hidden while the tape is open; narrow windows need a sheet) |
| **D** | The tape as an item in the service plan (queue) | Best conceptual fit for a planned order of service | Medium: Play and Take live in the same list | **L** | Medium–high: a new queue item kind in saved `.born` files (needs the unknown-item safety on older BORN) |

Ratings against seven service criteria are in [the comparison page](mockups/17-compare-placement.html). In one line each: **A** wins on reachability, Play-vs-Take separation, a clean reader and setup clarity; **B** is excellent while you are *in* it and weak everywhere else; **C** is the cheapest and the easiest to forget; **D** is elegant but the most expensive and touches the saved file.

## Why A (plain language)
A service is not "tape mode" for two hours; it is song, scripture, announcement, **tape**, song, offering. The operator needs to touch the tape (pause it for an interruption, skip a paragraph) from wherever they happen to be, and to *see* that it is playing. A bar that is always in the same place gives that and costs one row of space. Keeping **Take** and **Play** in different parts of the screen is the single most important safety change: one is what the congregation sees, the other is what they hear. Everything that is *setup* (recordings, timing, options) is moved out of the reader into one findable place, so the reader no longer carries three strips of controls (38 % of a small window today).

What I would borrow from the others: B's large follow view becomes the Tape place's *Follow* tab; C's key shortcut idea becomes ⌘/Ctrl+Shift+P (play/pause from anywhere); D's "readiness" idea is already in *Is tonight ready?*.

## Migration plan from the current build (all renderer work; small slices)
Nothing here touches the audio engine, the hub, sync-map storage, the aligner, the projection / stage / Graphics pages, the phone/API rules, `tape.db`, or the `slide.tape` payload. They are reused unchanged.

| Slice | What moves or is added | Files (existing → new) | Tests |
|---|---|---|---|
| **P1 Global bar** | The player bar (`TapeBar`) is mounted once in the app shell, shown whenever a tape is loaded; the reader loses it. The bar gains the "Text: on / not on the screens" button, the "paused for the video" and "sound output lost" wording. | `App.tsx` (shell), `TapeBar.tsx/.css` (reused), new `GlobalTapeBar.tsx` (thin wrapper), `SermonFollowView.tsx` (remove bar) | Existing `TapeBar.test` re-mounted at app level; `SermonFollowTape` adapted (no bar in reader) |
| **P2 Tape place** | New rail item "Tape" and a view with the recordings list (needs one read-only method `listAll()` in `tapeDb` + an IPC) and tabs Follow · Timing · Options · Add that **embed** the existing `TapeSyncEditor`, `TapeSettingsPanel`, `TapeAttach` | `App.tsx` (rail), new `TapePlace.tsx`, `tapeDb.ts` (+`listAll`), `tapeService.ts` (+1 IPC), reuse of the three components | New `TapePlace` component tests; `tapeLibrary`/`tapeDb` test for `listAll` |
| **P3 Screens controls** | "Put on the screens", Highlight/One at a time, colours, "Screens follow the tape", Apply — extracted from `TapeScreenControls` into a hook + the Follow tab header; the bar button calls the same hook | `TapeScreenControls.tsx` → `useTapeScreen.ts` + header; `SermonFollowView.tsx` | `TapeScreen.test` (controls) adapted; no logic change |
| **P4 Mid-tape behaviour** | Toast "Back to the tape text" when something else is taken; a ⌘/Ctrl+Shift+P shortcut; compact bar at narrow widths | `App.tsx`, `GlobalTapeBar.tsx`, `onLiveChanged` already exists | New small tests; real-app regression pass |
| **P5 Reader tidy** | Reader keeps the highlight and one chip; the ¶ **number** (not the card) jumps the tape; the language notice stays in the Tape place with a warning chip in the reader | `SermonFollowView.tsx`, `useTapeFollow.ts` (unchanged) | `SermonFollowTape` / `SermonFollowLanguage` adapted |
| **P6 Close-out** | Manual page and screenshots, contrast audit (4 themes), phone/Chromium+WebKit pass, packaged smoke, v1.13.1 compatibility re-check | docs, `scripts/packaged-check/tape.cjs` (unchanged) | Existing suites; same checks as the last round |

**Rough size:** about 6–8 working days. Most lines are moved, not rewritten; the genuinely new code is `GlobalTapeBar`, `TapePlace` and the small `listAll` read. **Compatibility:** no stored format changes (`tape.db`, settings, `.born`, packs all as now), so every older BORN keeps opening v2 files and the v1.x.x release gate is untouched. **Rollback:** each slice can ship alone; after P1 the tape is already controllable from every section.

## Open questions I answered myself
- *Does the bar need seek on every section?* Yes — a seek bar with paragraph ticks is the same component; at narrow widths it keeps play/pause, ¶ skip and time and drops the output chip.
- *Should clicking a paragraph in the reader still jump the tape?* No: only the ¶ number (a deliberate handle) does, to avoid accidental jumps while reading ahead.
- *Where does "Esc blanks, tape keeps playing" show?* In the bar's tooltip and in Tape options; behaviour is unchanged.

**Status: awaiting owner choice.** Nothing in the app was changed in this round.
