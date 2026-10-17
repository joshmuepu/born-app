# v2 UX build — progress (branch `v2-ux-build`, from `v2-ux-review`)

Building the 13 approved proposals in `docs/design/ux-review/03-proposals.md`, in its recommended order. Not merged. How to resume: `git checkout v2-ux-build`, read this file, continue at "Next".

Order: P-02 · P-03 · P-09 · P-10 · P-04 · P-01 · P-11 · P-05 · P-07 · P-13 · P-08 · P-12 · P-06.

## Done
- **P-02 vocabulary** — `src/shared/glossary.ts` (terms, retired words, aliases), `src/test/repo/glossary.test.ts` (fails if "Project", "Take next", "Put … on the screens" or "Blank" is back in operator-facing source), applied to the operator app, context menus, titles/aria names, the phone remote (Hide screen / Show screen, Show ▸), the tape wording, Help and the manual (31 lines) and the glossary page. The live box's second button is now **Hide screen / Show screen** (it always blacked the screen out; "Clear" was the wrong word). API field names and command ids are unchanged (`project`, `blank` …).

## Decisions
- P-02: "Clear" keeps its meaning for a second channel's output only; the main live box says Hide screen. Alternative: keep "Clear" on the main box (rejected: it blacks out, it does not clear).
- P-02: the retired-word test scans source lines that are not comments; comments and identifiers (`projectSong`, `onProject`) are unchanged.

## Next
P-03 queue toolbar.
