# Tape place · Add — review (2026-10-17)

Reviewed in the running app (dev build of `v2-ux-build`, throw-away profiles: one empty, one with three recordings), wide (1366) and narrow (1040), dark and light. Screenshots of the real app were kept out of the repo (real sermon titles); the mockups under `mockups/` show the same screens with invented titles.

## What is there today
- Left rail → **Tape** → header, a **welcome note** (with "Got it"), a **list of recordings** (title, date code, length, format, status chip) with an **Add a recording…** button under it, and four tabs: **Follow · Timing · Options · Add**.
- **Add** = three equal cards: (1) *Add a recording* (picker button, "drop anywhere", a paragraph); (2) *In your "Tape audio" folder* (path, **Change…**, **Look again**, a status line); (3) *Don't have the file? Get audio* (a text field, a match chip, a paragraph, **Download the tape for …**, **Open the download page**, an ownership line).
- With no recordings the same three cards are repeated under "No recordings yet".

## Findings
**Bugs (fixed on this branch, separate commits, with tests)**
1. The welcome note still said "add one, **time one once**, and the text follows it" — wrong since timing became automatic. (`TapePlace.tsx`)
2. The **Options** tab had lost its styling: headings jammed against the rows, "Show next paragraph early" and its select on different lines, the select drawn as a bright native box in the dark theme. The rules only applied inside the old settings window. (`TapePlace.css`)
3. In a fresh profile the folder card said **"Not chosen yet"** while the picker opened in Downloads — two statements that cannot both be true. Same line in the "Add the tape" dialog. (`TapeAddPanel.tsx`, `TapeAttach.tsx`)

**Design problems (proposals only)**
1. **Add is not a tab of a recording.** Follow, Timing and Options describe the selected tape; Add describes the library. Selecting a recording and then finding Add among its tabs mixes two levels.
2. **"Add a recording" appears three times** on one screen (list button, card title, card button), plus a fourth in the empty state.
3. **Three methods at equal weight**, but they are not equal: the picker is by far the most used, download is rare, and the folder is a *setting*, not an action. A first-time volunteer has to read all three to find the one they want.
4. **The folder is passive.** A file that lands in "Tape audio" is only found when the app starts or when someone presses **Look again** — a button whose purpose has to be guessed (it already needed a bug fix to show it did anything). Nothing tells you a file is waiting.
5. **Paragraphs of explanation** on a page that is used once a week. The one promise that matters ("BORN keeps its own copy and never changes your file") is buried in it.
6. **Download is a card at the bottom**: below the fold at 768 px high, its field has no label of its own, and progress/errors appear inside a card that may be scrolled away.
7. **Errors have no home**: each card shows its own line, wherever it is.
8. **"Remove this recording" lives in the Timing tab**, a destructive action inside a tab named for something else.
9. **The folder setting is on the page you use every time**, but you touch it once.
10. **Narrow window** (1040): the library becomes a strip across the top and the Add tab scrolls; the download card is not visible without scrolling. Light and high-contrast themes are fine (tokens only).

**Checked and fine:** keyboard order, focus rings, contrast in all three themes, Esc behaviour, nothing plays or shows by itself, the in-app download's progress/Cancel/plain-words errors.

## When and why the in-app download was added
Commit `afbebf7` (2026-10-17, this branch's parent line): the owner reported that **Get audio only took them to branham.org/en/MessageAudio** and asked for it to download the tape directly. It was built as `src/shared/tapeDownload.ts`, `TapeDownload.tsx` and the `tape:download*` IPC: English only, one recording, only on the click, progress + Cancel, plain-words errors, into the Tape audio folder, then added. The publisher's recordings are "All Rights Reserved" with a Permission Request page, so it is recorded as an open question in `docs/notes/sermon-audio-needs-counsel.md`. This round does not change its behaviour.

## Not checked
Windows; real tapes on the church PC; a screen reader pass over the new designs (the proposal lists it as an acceptance test).
