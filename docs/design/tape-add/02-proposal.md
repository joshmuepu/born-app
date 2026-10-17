# Tape place · Add — proposal (awaiting owner choice)

Open `mockups/index.html` (the Review board). Nothing here is implemented. My recommendation is **A · One door**.

## The four options
| | Idea | Steps: add a dated file / new file in folder / download | Effort | Risk |
|---|---|---|---|---|
| **A · One door ★** | No Add tab. One **＋ Add recording…** button on the list (▾ = Download). The Tape audio folder is watched and new files are *offered* in a strip. Folder setting moves to Options. Download is a small dialog. | 2 / 1 / 4 (2 from the reader) | M | Low |
| B · One page | Keep the tab, make it one page: drop zone first, live "found in your folder" list, Download collapsed. | 3 / 2 / 4 | M | Low |
| C · Find a tape | Sermon-first search; each result has one action (Load / Add / Download). | 3 / 2 / 2 | L | Medium |
| D · Tidy only | Same tab, two cards, no duplicates, no Look again, one-line folder note. | 2 / 2 / 3 | S | Very low |

Honest note on A: **download takes one more step than today** (▾, item, type, Download vs tab, type, Download). It is rare (once per new sermon, prepared ahead) and it is 2 steps when started from a sermon in the reader (prefilled). Everything common gets shorter or equal.

## Why A
- It removes a whole screen instead of rearranging it: the thing a volunteer must learn becomes "the Add button on the list".
- The common action (a file with a date code) stays at two steps; the folder case drops from three steps to one *and* the volunteer no longer has to know a folder is being watched.
- It keeps every capability and every safety rule: picker, drop anywhere, folder, filename matching, BORN's own copy, preflight, in-app download and publisher link, nothing plays or shows by itself (folder files are never added silently).
- It is the smallest design that makes the structure honest (library actions with the library; settings in Options).
- C is where the product wants to go for mid-service use ("find a tape and play it"), but it needs a sermon search with per-sermon availability and is a new idea for volunteers. It is a good **phase 2** that A does not block (A's strip and dialog become rows in C).

## What would be removed, merged, moved or renamed (for A)
| # | Change |
|---|---|
| R1 | Remove the **Add** tab. Tabs become Follow · Timing · Options. |
| R2 | **Tape audio folder** → Options (Change…, Open folder). **Look again** is removed: BORN reads the folder when the Tape place opens and while it is open. |
| R3 | New files → one **strip**: "2 new recordings in your Tape audio folder — Add 1 recognised · See both". Never added silently. |
| R4 | **Get audio** card → **Download…** dialog (from ▾, or prefilled from the reader), then a progress row with Cancel. |
| R5 | Remove the welcome note. |
| R6 | Remove the explanatory paragraphs; the "BORN keeps its own copy" promise moves to the empty page and the Added toast. |
| R7 | Rename "Get audio" → "Download…". Keep "Add recording…". |
| R8 | Move **Remove this recording…** from Timing to a ⋯ menu on the recording row (still confirms). |

## Copy (every string)
- Button: **＋ Add recording…** (tooltip: "Choose a file (opens in your Tape audio folder)"); ▾ tooltip "More ways to add".
- Menu: **Choose a file…** / "Opens in {folder} · or just drop a file here"; **Download…** / "English · one recording, only when you press the button".
- Empty page: **Add your first recording** / "Drop a recording here, or choose a file. A file named with its date code (like 99-0303M) goes to the right sermon by itself. BORN keeps its own copy and never changes your file." Buttons **Choose a file…**, **Download…**. Line: "Or put files in {folder} and BORN will offer them here. Change folder". Drag-over: **Drop to add**.
- Folder strip: "**{n} new recordings in your Tape audio folder.** Found by BORN just now — nothing is added until you say." **Add {k} recognised** · **See both** (rows: file name → sermon, **Add**; unknown: **Choose sermon…**; **Add all**). No folder chosen yet: "Using your Downloads folder until you choose another."
- Added toast: "Added “{title}” to {code} · plays now". Banner while timing: "This recording plays now. BORN is timing it in the background ({pct}%); the text will follow it when that finishes." Done: "Timing finished — the text now follows the tape ({n} of {m} paragraphs found)."
- Several files: "Added {n} recordings. **{file}** needs a sermon." **Choose sermon**. Sheet: "Which sermon is “{file}”?" · **This one** · "Or type a title or date code" · **Not now**.
- Download dialog: title **Download**; field "Type a title or a date code, e.g. 99-0404E"; found chip "{code} · {title}"; "English, about {mb} MB. Goes into {folder} and is added. One recording, only when you press the button." **Download {code}** · **Cancel** · **Open the publisher's page**. Progress row: "Downloading {code} — {a} of {b} MB" · **Cancel**.
- Errors (never a stack trace; always what happened to their data): "The publisher's site did not answer. Nothing was added." **Try again** · **Open the publisher's page** · **Close**. "“{file}” is not an audio file BORN can play. Nothing was added." "That recording is already added — here it is." "BORN keeps its own copy of each recording, which needs {mb} MB; this computer has {free} MB free." **Use the file where it is** · **Cancel** + "If that drive is not plugged in during a service, the recording will not play." Timing: "This recording plays, but BORN could not time it automatically (it is not in English)." **Time it by hand…**

## Build plan (A) — small slices, each ships green
1. **Add button + menu** on the list (`TapePlace.tsx`, new `AddMenu`); the main part opens the picker (existing `tapeAddFiles`). Tests: one click opens the picker; ▾ lists two items; Esc closes the menu only; keyboard operable; narrow strip layout.
2. **Remove the Add tab** and the welcome note; empty page = drop zone (`TapePlace.tsx`, `TapeAddPanel.tsx` → `AddEmpty`, `AddPending`). Tests: no Add tab; empty page has both buttons; drop anywhere still adds; placement sheet for unplaced files.
3. **Folder watcher**: main process watches the Tape audio folder (debounced `fs.watch` + re-scan on open) and sends `tape:folder-changed`; strip + "See both" list. Tests: a file appearing makes the strip show without any click; nothing is added until Add; Add all; unrecognised → Choose sermon.
4. **Folder setting → Options** (Change…, Open folder); remove Look again. Tests: Options row; Change… updates the strip.
5. **Download dialog + progress row** (reuse `TapeDownload`'s IPC, behaviour unchanged); prefill from the reader. Tests: field → chip → Download; progress, Cancel, plain-words error; nothing fetched until the button.
6. **⋯ menu on the row** with Remove… (still confirms); drop it from Timing.
7. **Copy pass** against the glossary test; screenshots; manual (`tape-service.md`) and `docs/notes/v2-ux-build-changes.md`; packaged check on a throw-away profile (add by picker, drop, folder strip, download with the network off).
Acceptance for the whole: every capability in the "keep" list still works; adding a dated file is ≤ 2 steps; a new file in the folder is ≤ 1; no text is clipped at 1040 px in any theme; `themeContrast`, glossary and `headerNarrow` tests stay green.

## Decisions made without asking
- Based on `v2-ux-build` because `v2-channels` does not contain it yet (checked; see the final report).
- Counted "steps" including the picker's Open and typing, so the comparison is honest about A's download step.
- Kept real-app screenshots out of the repo (real sermon titles); mockups use invented titles.
- Fixed three small bugs now rather than proposing them.
