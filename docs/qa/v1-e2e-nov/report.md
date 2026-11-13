# BORN v1 end-to-end round, November: report

Round `v1-e2e-nov`, 2026-11-12. A work branch for the owner to review: nothing merged, tagged, version-bumped or released.

- **Branch:** `v1-e2e-nov`, from `main` at `f67b1f4` (v1.13.5).
- **Version:** unchanged at 1.13.5. **Identity:** unchanged (`com.joshmuepu.born`, "Branham or Nothing", port 4316). **Icon hashes:** unchanged (png `a9dd996d`, icns `805174be`, ico `4f3e98c7`). **Workflows:** untouched.

## How it was tested

Every live run used a throwaway profile, its own remote port (14316–14354) and debugger port (9356–9384), and its own network name. The congregation screen and stage monitor were real windows, kept hidden. Phones and tablets were the real remote page in WebKit (iOS Safari's engine) and Chromium.

1. **Automated checks** (`scripts/qa/run-all.sh`): typecheck, unit tests, build, layout, output, remote, reconnect, input, flows, the layout sweep, the library check.
2. **Visual tour, both themes** (`scripts/qa/visual-tour.cjs`, new): 20 steps of a mock service at 1366×768 and 1040×640, with pictures of the operator window, the congregation screen and the phone/iPad remote, all looked at by eye.
3. **Service tour** (`scripts/qa/service-tour.cjs`, new): three items queued from the phone, congregation screen and stage monitor on, the service run from the keyboard (→, Space, ←, ⌘/Ctrl+→, B, Shift+Esc with a dialog open), saved from the phone, cleared, reopened from the start screen, a song pasted in, a Help link to another page. Each step checks what the two screens actually show.
4. **Browse and popovers:** sermon Date / Series / Location / Recently Played, Filters, Bible Browse and keyword search, Songs A–Z, Import menu.
5. **Existing live scripts:** Esc matrix, the two reach probes, closing the operator window, the phone/tablet sweep, old-file compatibility.

**Not tested here:** real projectors and unplugging, real phones on real Wi-Fi, the native Save / Open / confirm dialogs (a script cannot answer them; the phone's equivalents were used), the update download, Windows (see the end).

## Findings

Severity: **P1** wrong thing on the projected screen or lost data, **P2** clearly broken with a workaround, **P3** cosmetic.

| ID | Sev | Area | What happened | How found | Fix | Test | Status |
|---|---|---|---|---|---|---|---|
| NOV-01 | P2 | Service Queue | An item's title was cut to three or four letters ("Doo…") in the usual 300 px queue: the hover-only Project / Remove buttons kept their width while hidden | Visual tour | `7f48226` | `queueRowTitleRoom.test.ts`; live: titles now get their full width (239–254 px of 300) | Fixed |
| NOV-02 | P2 | Congregation screen, stage | The Message banner was 92% opaque, so the reference line under it showed through the message | Visual tour | `0bb2329` | `messageBannerOpaque.test.ts` | Fixed |
| NOV-03 | P3 | Phone | Sermon results and Recently Played began with the paragraph number ("75 Well, He…") right under "¶75"; the desktop drops it | Visual tour | `48444e6` | `phoneResultNumber.test.ts`; live: the phone's result now starts "Well, He…" | Fixed |

Each fix's test fails on the code before it and passes after.

**Checked and found to be by design (not changed):**
- While the screen is hidden, the stage monitor shows only the clock.
- After Close projection the stage monitor stays open on its own.
- Something projected straight from search shows "Not in your queue", even when the same paragraph or song is also queued.
- The sermon reader's "still searching "faith"" label means the highlights still follow the search.
- In the Message dialog, "Both" wraps onto a second line at the dialog's width. It is a deliberate wrap, and every button stays usable.

**Harness problems found and fixed** (scripts only, `b6eb628`):
- The compatibility script put its old files outside the folder the phone may open since 1.13.4, so every file "saved 0 items". It now uses that folder.
- With no spare screen, the stage monitor opens as a visible floating window, which the hide-outputs helper did not catch. The Esc matrix rightly refused to run. The helper now hides it as it is created.

## Results

| Check | Result |
|---|---|
| Typecheck | Clean; `tsc --noUnusedLocals` also clean |
| Unit tests | **938 passed, 0 failed, 107 files** (931 at v1.13.5; 7 new) |
| Build | OK |
| Automated probes | layout 19/0, output 6/0, remote 23/0, remote-reconnect 8/0, input 24/0, flows 8/0, sweep 0 findings, verify-libraries 6/0 |
| Visual tour, dark and light | 28 steps each, 110 pictures; no console errors or failed steps; found NOV-01, -02, -03 |
| Service tour | **20/20**: John 3:16–18 verse by verse, then the song, then the sermon paragraph, on both screens; B and Shift+Esc; save from the phone, clear, reopen from the start screen (same three items); a pasted song added; a Help link to another page lands on its section; no console errors |
| Esc matrix | **74/74** |
| Reach probes | Pass: queued and projected paragraphs stay in view, including one about 400 paragraphs down |
| Closing the operator window | 2/2 |
| Phone/tablet sweep | 336 screens (7 devices, both orientations, 100% and 150%, keyboard open, Home Screen app, WebKit and Chromium): nothing off-screen, no sideways scrolling, no tap target under 44 px, no cut-off labels, no page errors. As last round, 26 small labels (9–10.5 px) remain by design |
| Old service files | v1.0, v1.12, v1.13 and a newer-version file open and save with every item. Song keys, who added each item and unknown fields survive |
| macOS package (`dist:mac`, unsigned, not published) | arm64 215.0 MB, x64 219.6 MB |
| Packaged smoke (arm64) | **11/11** (libraries, bundle id / name / version 1.13.5, icon `805174be`, window, remote, frame protection, sermon / song / Bible search, clean start) |
| Packaged reload guard | **16/16** |
| Identity and icons | 1.13.5, `com.joshmuepu.born`, "Branham or Nothing", port 4316; icons `a9dd996d` / `805174be` / `4f3e98c7`. No change to `package.json`, `.github`, `build/` or `resources/` |
| Windows (temporary read-only branch `tmp-win-e2e-nov`, deleted afterwards) | **Passed**, [run 43340306654](https://github.com/joshmuepu/born-app/actions/runs/43340306654). Libraries taken from the snapshot `libraries-v1-20261031` (checksums and counts match; 6/6). Windows unit tests **937 passed, 1 skipped** (the read-only-folder test, as before), 107 files. Packaged smoke **11/11**, including all 7 icon images byte-identical to `icon.ico` and not the Electron default. "faith" gave 200 single-paragraph results. Installer `BORN-1.13.5-Windows-Setup.exe`, 176.8 MB, unsigned; the artifact expires 2026-11-20 (`gh run download 43340306654 -R joshmuepu/born-app -n BORN-v1-e2e-nov-Windows-installer`). **First attempt**, [run 43339916641](https://github.com/joshmuepu/born-app/actions/runs/43339916641), failed before packaging: the check workflow ran the tests on Node 20, and `librarySnapshot.test.ts` uses Node's built-in SQLite, which needs Node 22.5 or later. A setup problem, not a product one: `release.yml` runs no unit tests, and the snapshot tooling already runs on Node 22. The second run used Node 22 |

## Commits on `v1-e2e-nov`

- `0bb2329` Message banner solid (NOV-02)
- `7f48226` Service Queue titles use the whole row (NOV-01)
- `48444e6` Phone results without the leading paragraph number (NOV-03)
- `b6eb628`, `872485f` and the commit with the Windows result: QA scripts and this report only (visual tour, service tour, compat and hide-outputs fixes)

## For the owner, on real hardware

1. Hover over a queue item: Project and Remove appear over the right end of the row, and the title is readable otherwise.
2. Send a Message while a slide with a reference line is up: the banner is solid.
3. On a phone, search sermons: each result's text starts with the words, not the number.
