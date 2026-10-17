# v2 UX build — progress (branch `v2-ux-build`, from `v2-ux-review`)

Building the 13 approved proposals in `docs/design/ux-review/03-proposals.md`, in its recommended order. Not merged. How to resume: `git checkout v2-ux-build`, read this file, continue at "Next".

Order: P-02 · P-03 · P-09 · P-10 · P-04 · P-01 · P-11 · P-05 · P-07 · P-13 · P-08 · P-12 · P-06.

## Done
- **P-02 vocabulary** — `src/shared/glossary.ts` (terms, retired words, aliases), `src/test/repo/glossary.test.ts` (fails if "Project", "Take next", "Put … on the screens" or "Blank" is back in operator-facing source), applied to the operator app, context menus, titles/aria names, the phone remote (Hide screen / Show screen, Show ▸), the tape wording, Help and the manual (31 lines) and the glossary page. The live box's second button is now **Hide screen / Show screen** (it always blacked the screen out; "Clear" was the wrong word). API field names and command ids are unchanged (`project`, `blank` …).

- **P-03 queue toolbar** — `File ▾` menu (`MenuButton`, reusable) with New service, Open, Import, Save, Save with pictures, Open pack; `ReadinessChip` ("Is tonight ready?" → Ready / N to look at / N to fix, resets when the queue changes; `Preflight.onResult`). Tests moved to the File menu.
- **P-09 target sizes** — tokens `--target-min 32 / --target-live 40 / --target-touch 44`, scoped rules in App.css; live DOM probe at 1366×768 finds no control under 32 px except a checkbox input.
- **P-10 skip links, landmarks, F6** — `SkipLinks`, `regions.ts` (F6 / Shift+F6 cycling, visibility-aware), main/complementary landmarks, one sr-only h1 per section, shortcut + cheat sheet entry. Skip to the queue opens a closed queue; Skip to live controls falls back to the queue when the screens are off.
- Gate after P-03/P-09/P-10: typecheck, suite 1,783 passed, build, regression scripts hist 10/0, dnd 20/0, az 656/0, reg 43/0, rem 64/0, gfx2 7/0 (gfx2 failed once on its last check, a timing flake; passes on re-run).
- **P-04 rail** — groups Find / Listen / Service (labels hidden at ≤ 820 scaled px), one plum selection colour (accent on `--bg-active`, covered by the existing contrast tests), Open removed from the rail (File menu), Saved kept in Find.
- **P-01 header zones + P-11 appearance menu** — `AppearanceMenu` (⚙: Theme, Contrast, Interface size, Help, Shortcuts), the ON AIR cluster (red outline live, amber while hidden), spacer layout, narrow rules moved to `data-w~='1240'` (label and Remote to icons), no header cut off at 1040/1180/1241/1280/1366 and at 150 %/125 % (checked live).
- **P-05 Now dock** — `NowDock` (LIVE zone with `liveSummary`, tape zone = `GlobalTapeBar embedded`, status dots + version/app-info), the old status bar footer and the separate tape strip are gone; notice row only for indexer/data messages; responsive (dots with a tape; tape to its own row ≤1180; tape output/Text buttons icon-only ≤1440). New width token 1440. Suite 1,798; regression 10/20/656/43/64/7 all green.
- **P-07 one primary** — `Show next` is the only filled button in the Preview/Live box; Back / Next arrows + "N of M" in their own row under the pictures (`plp-steps`); the big Back/Next row is gone. Tests added.

## Decisions
- P-02: "Clear" keeps its meaning for a second channel's output only; the main live box says Hide screen. Alternative: keep "Clear" on the main box (rejected: it blacks out, it does not clear).
- P-03: Edit button from the mockup is not built (desktop has no Edit action; it was the phone's). The chip resets to the question when the queue changes rather than re-running the check (a check can reach the network for YouTube items).
- P-07: the arrows sit in their own row under the thumbnails, not in the Preview header as in the mockup — the header cell is ~150 px wide and "PREVIEW ‹ 4 queued ›" overflowed into LIVE.
- P-05: "N in queue" is hidden while a tape is loaded (the rail badge has it); Phone chip not built (no connection feed yet); the mockup's Output chip is the tape's own output button.
- P-01: no phone-count chip on Remote yet (needs a connection feed from main; backlog). P-11 was folded into P-01 because they share the ⚙ menu.
- P-04: Saved stays in the rail (the mockup dropped it; favourites and recents need a home) — in the Find group. No per-section stripe inside panels (keeps the change small).
- P-10: `role="main"` on the existing content div and `role="complementary"` on the queue root, not new elements, to avoid re-indenting 300 lines of JSX.
- P-02: the retired-word test scans source lines that are not comments; comments and identifiers (`projectSong`, `onProject`) are unchanged.

## Next
P-13 phone remote.
