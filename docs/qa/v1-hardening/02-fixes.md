# 02 · Fixes (branch `v1-hardening`, from `origin/main` v1.13.1 = `19d4c37`)

One small commit per bug. Every fix has a test (unless marked); the test failed before the fix and passes after, and the evidence for each is in
`01-classification.md`. No refactors, no dependency changes, no version change. Test counts are in `06-verification.md`.

| # | Commit | What a person sees | Test |
|---|---|---|---|
| 1 | `1202540` | Esc that closes the manual, the Remote / Screens popover, the Import menu or the song key picker (or clears a search box) no longer also blanks the congregation screens. **Shift+Esc still always blanks.** The Import menu and key picker now close on Esc | `src/test/renderer/escBlank.test.tsx`, `escRule.test.ts`, `SongKeyPicker.test.tsx` (new `src/renderer/src/escRule.ts`, ported from v2) |
| 2 | `c4ec79d` | Ctrl/Cmd+R (and +Shift) no longer reloads the operator window or the screens in the **installed** app (unpackaged dev builds keep it) | `src/test/shared/reloadChord.test.ts`; wiring read + documented Electron behaviour, see `06-verification.md` |
| 3 | `7c396ea` | Help links to a section of another page open that page and scroll to the section (three links in the manual were dead) | `src/test/renderer/HelpViewer.test.tsx` |
| 4 | `98d1133` | The manual cannot read a folder next to it that starts with the same name | `src/test/main/manual.test.ts` |
| 5 | `5659b24` | The Keyboard shortcuts (and every `.modal`) dialog scrolls inside a short window instead of running off the top and bottom | `src/test/repo/modalFits.test.ts`; probe `layout-probe.cjs` |
| 6 | `10ccee3` | A line with no spaces wraps on the projector and the stage monitor; the stage "Next" band no longer cuts its reference line | `src/test/repo/outputsWrap.test.ts`; probe `output-probe.cjs` (6 real-layout checks) |
| 7 | `1a611cd` | The phone-remote page cannot be shown inside another site's frame | `src/test/main/remoteHttp.test.ts` |
| 8 | `1ff012f` | A remote command body over 256 KB is refused (413) instead of being read into memory | `remoteHttp.test.ts` |
| 9 | `055a272` | Remote search boxes show a focus ring; their text is 16 px so a phone does not zoom in | `src/test/main/remotePage.test.ts` |
| 10 | `e2a204e` | Remote A–Z letters are 44 px (were 28) | `remotePage.test.ts` |
| 11 | `e8c8229` | Remote: quote marks in text and in a queue item's id can no longer break a field or run script (the id comes from a shared service file); a quoted Bible search survives a redraw | `remotePage.test.ts` (runs the real tap-handler text) |
| 12 | `15240e2` | Remote sermon and Bible search show the newest search; if BORN cannot be reached they say so instead of staying on "Searching…" | `remotePage.test.ts` |
| 13 | `0c7c559` | A damaged `settings.json` is kept as `settings.corrupt-<time>.json` instead of being overwritten by the next save | `src/test/main/settings.test.ts` |
| 14 | `a289b20` | A damaged `queue.json` is kept as `queue.corrupt-<time>.json` the same way | `src/test/main/corruptFile.test.ts` |
| 15 | `9325e1e` | A read-only or full data folder gets a plain message instead of BORN quitting silently | `src/test/main/dataFolder.test.ts`; real-app check |
| 16 | `a0a4b0a`, `23ffb31` | Sermon text no longer starts with an empty box (the source's private-use symbol U+F6E1). **Display only** | `src/test/shared/sourceText.test.ts`, `src/test/main/sourceTextDisplayOnly.test.ts`, `src/test/renderer/outputsCleanText.test.tsx` (see below) |
| 17 | `bb6da84` | Copy buttons say "Copied" only when the copy really worked | `src/test/renderer/copyText.test.ts` |
| 18 | `e8cec0b` | An item of a kind this version does not know no longer crashes the queue screen | `ServiceQueue.test.tsx`, `queueItem.test.ts` |
| 19 | `561cb42` | The Screens popover stays inside the window and scrolls (every screen row and the Smaller/Larger text buttons were unreachable at 150% scale) | `modalFits.test.ts`; sweep 56 → 0 findings |
| 20 | `ab755a2` | The search Filters popover stays inside the window (it ran off the left edge and below the bottom) and closes on Esc | `popoverFit.test.ts`, `escBlank.test.tsx`; sweep; screenshots in `screenshots/` |
| 21 | `276ca65`, `2938472`, `cfd813c`, `43c2472` | **Tests only** (Windows): port-blocker test, 500-row fixture in one transaction, `Promise.withResolvers` shim for Node 20, 60 s limit for the two real-PDF tests | the Windows runs in `04-windows.md` |
| — | `0e4450f` | **Test only**: ⌘/Ctrl+→ keeps walking the queue across song/Bible items | `queueShortcuts.test.tsx` |
| — | `a7a02b6`, `fae01cc`, `57178db`, `fe3ba54`, `3ecff42`, `00dff4c`, `dfb351f`, `56bc543` | **Scripts only** in `scripts/qa/` (launcher, remote probe, library verifier, Windows smoke, input probe, compat check, packaged macOS smoke, flows + reconnect). Not part of the shipped app: the installer's `files` are `out/**`, `node_modules/**` and `package.json` | — |

## Fix 16: "display only", proven
The bundled library has U+F6E1 in 2,410 of 104,644 paragraphs (1,208 at the start), so the reader, projector, stage monitor and phone showed `▯ Let us bow our heads`.
`cleanSourceText()` (new `src/shared/sourceText.ts`) removes the symbol where text is **read for display**: `rowToQuote` (every search), the English paragraph reader, and the three places that draw
saved text (projector, stage monitor, queue row), so a service saved before the fix is drawn clean too. Tests with synthetic text prove:
- text without the symbol comes back as the very same string (including emoji, RTL, quotes, HTML text);
- only the private-use range is touched (neighbouring symbols stay);
- a search result is clean while the **stored database text is byte-identical** (the test opens the database read-only, so any write would throw) and the **FTS index still holds the original text**;
- the same paragraphs match the same searches, and the highlight still lands on the searched word;
- a saved item's slide text is not modified when it is drawn.
Saved `.born` files and `queue.json` are not rewritten by this change (see the compat check in `06-verification.md`: output identical to `main`).

## Judgement calls (so you can redirect)
- A–Z strip 28 → 44 px and search text 15 → 16 px: both are in your known list; 44 px matches v2's tap-size rule.
- `/command` limit 256 KB (v2's number): a command is a few hundred bytes.
- Unknown queue item kinds get the label "Item" and the quote icon.
- The Ctrl/Cmd+R guard is on only when the app is installed (`app.isPackaged`), so developers keep reload.
- The "can't reach BORN" text in remote searches is plain text in the existing results area. No new screen, button or setting.
- Popover height formulas (`100vh − 76px`, and measured room below the Filters popover) are conservative.
- Fix 20 also adds `.filter-popover` to fix 1's "something is open on top" list and gives the Filters popover Esc-to-close; the layout sweep found it (same bug as A1/A2).
