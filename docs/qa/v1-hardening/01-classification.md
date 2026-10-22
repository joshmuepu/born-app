# 01 · Classification and evidence

Rule used: nothing was fixed that was not reproduced on v1 (failing test or scripted repro in the real v1 app) or proven by reading the code.
"Repro" names the evidence. Probes are in `scripts/qa/` and are not part of the shipped app. Fix commits are in `02-fixes.md`.

Legend: **fixed** = fixed on `v1-hardening` · **n/a** = the code does not exist in v1 · **not reproduced** = code exists, behaves correctly in v1 ·
**decision** = needs the owner (see `05-needs-owner-decision.md`).

## A · Keyboard and live safety
| ID | Shared? | v1 evidence | Result |
|---|---|---|---|
| A1 | yes | `App.tsx` blanked on any Esc while projecting. Repro: App-level test (`escBlank.test.tsx`): Remote popover and manual open → Esc → `setBlankScreen` called | **fixed** `1202540` |
| A2 | yes | Same test with the Import menu open. In v1 Esc did not even close the menu | **fixed** `1202540` |
| A3 | yes | Same test with text in the sermon search box | **fixed** `1202540` |
| A4 | yes | v1 never calls `Menu.setApplicationMenu`; probe of Electron's default menu shows Reload / Force Reload roles (Ctrl/Cmd+R, +Shift). A real key press cannot be injected over the debugging port (checked: an injected Cmd+R does not reload even the unpackaged app), so the guard is covered by a unit test of the key rule and by Electron's documented behaviour; see the manual check in `06-verification.md` | **fixed** `c4ec79d` |
| A5 | yes | Test: ⌘/Ctrl+→ across song/Bible items projects every item in turn; the cursor is never pulled into a search box by a queue jump in v1 | **not reproduced**; guard test kept `0e4450f` |
| A6 | n/a | no command palette in v1 | n/a |
| A7 | n/a | no saved drawer in v1 | n/a |
| A8 | n/a | no songbook menu in v1 | n/a |

## B · Graphics / OBS
All **n/a** (no Graphics output in v1). B8's two items: the favicon request exists only on the Graphics page (n/a); the deprecated `apple-mobile-web-app-capable` meta tag exists on v1's remote page and only produces a browser console warning, so it is left alone (cosmetic).

## C · Desktop layout and visuals
| ID | Shared? | v1 evidence | Result |
|---|---|---|---|
| C1 | n/a | no toast component on the desktop | n/a |
| C2 | n/a | no `SlideThumb`; measured instead: with a 600-item queue v1 switches sections in 16–23 ms (`flows.cjs`) | **not reproduced** |
| C3, C4, C5 | n/a | v2's header / interface scale / rail do not exist in v1 | n/a |
| C6 | yes | Probe at 1040×640 with 150% scale: the Keyboard shortcuts dialog is 469 px tall in a 427 px window (top −22, bottom cut) | **fixed** `5659b24` |
| C7 | partly | Probe at 1040×640 @150%: the start screen's first element is at y=164, not cut off | **not reproduced** |
| C8 | yes | v1's app-info popover opens from the left of the status bar; stays inside the window at every size tested | **not reproduced** |
| C9 | yes | Probe (`output-probe.cjs`, real layout in Chromium): a 160-character unbroken line is 5–6× wider than the projector and stage screens; the stage "Next" band's reference line is cut (scrollHeight 279 > clientHeight 228) | **fixed** `10ccee3` (wrapping and the height cap only; contrast colours → decision) |
| C10 | partly | Stage text fit: covered by the same probe; no further cut-off found in v1's layout | **not reproduced** beyond C9 |
| C11, C12 | n/a | no Now dock / rail in v1 | n/a |
| C13 | n/a | the dialog squeeze was v2's own layout | n/a |
| C14 | yes | v1's `<select>`s are themed (computed background/colour/border are the dark theme's) | **not reproduced** |
| C15 | yes | The paste-song textarea shows the browser's default amber focus outline. It is visible; the colour just is not the app's | **decision** (design) |
| C16 | yes | `.song-row-title` has no `nowrap`: a long title wraps inside its row, nothing is clipped | **not reproduced** (clamping is a design choice) |
| C17, C18, C19 | n/a | v2 tokens / layouts not in v1 | n/a |
| C20 | yes | Probe: Screens popover (a row per connected screen) runs below the window with no scrolling; 56 findings at 1040×640 @125/150% and 1366×768 @150%, "Smaller/Larger" text buttons unreachable | **fixed** `561cb42` |
| C21 | yes | already in v1 (`e9671b7`) | already in v1 |
| C22 | yes | already in v1 (tests "shows a plain-language error with a Retry button…") | already in v1 |
| C23 | n/a | v1's `DisplayInfo` has no ambiguity concept; adding it is a feature | **decision** |
| (new, found by the sweep) | — | The search **Filters** popover (320 px wide, anchored right of a narrow left panel) ran 32 px off the left edge and below the bottom at 150% scale, so "Done" was unreachable; and Esc did not close it (and blanked the screens) | **fixed** `ab755a2` |

## D · Help viewer
| ID | Shared? | v1 evidence | Result |
|---|---|---|---|
| D1 | yes | `handleContentClick` did `querySelector(href)` for `#x` only; `page.md#x` never matched the manifest. Test: click a cross-page link → nothing happened. Three real links are affected (`cheat-sheet.md:38`, `service-day.md:30,37`) | **fixed** `7c396ea` |
| D2 | yes | `resolved.startsWith(normalize(base))` accepts `…/v1-private/…` next to `…/v1`. Test reads the sibling folder's file | **fixed** `98d1133` |

## E · Phone remote
Probe `remote-probe.cjs`: the real remote page in headless Chromium **and** WebKit, against a running v1 on an isolated profile.
| ID | Shared? | v1 evidence | Result |
|---|---|---|---|
| E1 | yes | `.searchbox input{outline:none}` and no focus-within style: computed box-shadow and border identical focused / unfocused | **fixed** `055a272` |
| E2 | yes | Not measured. Tap-size and tooltip tweaks are polish, not broken behaviour | **decision** (design) |
| E3 | yes | A–Z letters 28×28 px | **fixed** `e2a204e` (judgement: 44 px) |
| E4 | yes | Jump from Z to a middle letter lands at offset 0 in both engines | **not reproduced** |
| E5 | yes | 400 rows and 1,958 search rows: no overlap at 390 px and 320 px (buttons keep their content height) | **not reproduced** |
| E6 | yes | Not investigated: the Add-to-Home-Screen sheet stacking on the role prompt needs a real first-run on a phone | **decision** (to check on a phone) |
| E7, E12 | partly | no YouTube thumbnails in v1; v1's tablet already shows words | n/a / not reproduced |
| E8 | yes | `POST /command` with a 400 KB body returned 204 (read in full into memory) | **fixed** `1ff012f` |
| E9 | yes | (a) item id → `onclick="cmd('project',{id:'<id>'})"` unescaped: an id `a'});window.__pwned=1;//` ran (`pwned=true`) in both engines; a plain `'` in an id broke the button; ids come from a shared service file (`migrateQueue` keeps `item.id` as given). (b) double tap, poll pile-up, offline bar: not reproduced as harmful in v1 (reconnect check 8/8) / feature | (a) **fixed** `e8c8229`; (b) not built |
| E10 | yes | `GET /` had no `X-Frame-Options` / `frame-ancestors` | **fixed** `1a611cd` |
| E11 | yes | sermon search: a delayed first answer replaced the newer one (`FIRST` shown); a rejected fetch left "Searching…" forever; Bible search the same; inputs 15 px; `"faith"` redrawn as an empty field (`esc()` did not escape `"`) | **fixed** `15240e2`, `055a272`, `e8c8229` |

## F · Data safety and startup
| ID | Shared? | v1 evidence | Result |
|---|---|---|---|
| F1 | yes | `queue:load` returned `[]` for an unreadable `queue.json`; the next autosave overwrote it. Test: damaged file → kept as `queue.corrupt-<time>.json` | **fixed** `a289b20` (notice UI → decision) |
| F2 | yes | `getSettings` fell back to defaults; the next save overwrote the damaged file. Test | **fixed** `0c7c559` |
| F3 | yes | Real app with a read-only data folder: exits with code 0, no window, no message (Chromium cannot take its lock). After: a plain-language dialog | **fixed** `9325e1e` |
| F4 | yes | The bundled database has U+F6E1 in 2,410 of 104,644 paragraphs (1,208 at the start). Tests prove display-only; see `02-fixes.md` | **fixed** `a0a4b0a`, `23ffb31` |
| F5 | yes | `navigator.clipboard?.writeText(x); setCopied(true)` unconditional (4 places) | **fixed** `bb6da84` |
| F6–F8 | n/a | v2-only | n/a |
| F9 | yes | v1 uses native HTML5 drag; the harness cannot drive a real drag. Reorder logic is unit-tested (`queueUtils`) | **not reproduced** (not driven end to end; listed in the fresh hunt) |
| (note) | yes | A queue item with an unknown `kind` and a `slides` array threw "Element type is invalid" in `ServiceQueue` (test), and it is autosaved into `queue.json`, so the crash would repeat every launch | **fixed** `e8cec0b` |

## G · Windows
| ID | Shared? | v1 evidence | Result |
|---|---|---|---|
| G1 | yes | **Real release path is not broken**: databases are built on Linux and packed on Windows; the Windows run passes every strict check (`04-windows.md`). v1's own npm scripts do not work on Windows (`npm test` runs no tests; `build:db`, `build:library` fail), but release does not use them there | **not applied** (per instruction); → decision |
| G2 | yes | Windows run: 9 test failures in 4 files (port blocker, 500-row inserts, `Promise.withResolvers` on Node 20, two PDF timeouts) | **fixed** `276ca65`, `2938472`, `cfd813c`, `43c2472`; re-run: 0 failures |
| G3 | yes | Bible download retry: build-time only, not triggered | **not built** |
| G4 | partly | only the `manual.ts` part applies (D2) | see D2 |
| G5 | yes | `updateCheck.ts` spawns `cmd.exe` without `windowsHide`; cannot be observed from here | **decision** |
| G6 | n/a | v1's smoke scripts already use their own paths | n/a |
