# 01 · Findings (UX review of Born Again v2, branch `v2-ux-review`)

Severity: **P0** breaks a service · **P1** slows or confuses an operator · **P2** polish. Kind: **bug** (fixed on this branch, see `02-fixed-bugs.md`) or **design change** (proposed only, see `03-proposals.md` and the mockups).

## How this was done, and what was not covered

Evidence was captured from the running app on throw-away profiles (dev build, isolated data dir, port and mDNS name), with placeholder content (Psalm 23 / John 3 KJV, hymn titles, a sample message with a tape), a real tape on a separate profile for the tape checks, 3 outputs, the phone remote in Chromium and WebKit.
* Screenshots (kept out of the repo because some profiles hold the real sermon library): every section (Sermons, Bible, Songs, Media, Tape, Saved, Queue) × 1040×640, 1366×768, 1920×1080 × dark, light and both high-contrast variants (84 images); the Screens popover, Remote panel, Help manual, Shortcuts, command palette; the busiest live view; 100–175 % interface scale at 1366 and 1040; the phone remote in 4 sizes × 2 engines × 2 themes + offline.
* Probes over the live DOM: unlabeled controls, clipped text, off-screen controls, target sizes, tab order and focus rings, landmarks, console errors across a 40-step tour, dialog geometry at three window sizes, header geometry at four widths and four scales, rail geometry.
* Workflow counts below are **by inspection of the real flows** (clicks and keystrokes), not stopwatch-timed with a volunteer.
* **Not captured / not checked:** Windows, the church PC, real phones, a real projector or second monitor connect/disconnect, sleep/wake, the update flow, OBS (existing OBS QA stands), first-run onboarding (there is none: a fresh profile opens an empty Sermons search), true low-end GPU performance, RTL layout (the interface text is English-only; see the backlog), real-user timing.

## The verdict in ten lines
1. The product is **capable and visually coherent**: tokens, three themes, drill-down columns, undo toasts, a command palette, and a phone remote that already meets target sizes. Contrast is clean in all themes.
2. It is **crowded at the edges**: the header carries 13 controls of four kinds in one row; the queue toolbar is seven text buttons in two rows; the rail uses five accent colours for "which section".
3. **"What is live right now?" is answered by small words** (a 12 px "On air", a 100 px Live box that disappears when the queue pane is hidden).
4. The **vocabulary drifts**: Project / Take / Show / Put on the screen / Hide screen / Blank / Clear.
5. **Two same-weight purple buttons** (Take next, Next ›) in the live box.
6. The layout is the **preparation layout even during the service**; the queue, the thing in use, gets a third of the width.
7. Several **layout rules ignored the interface scale** (media queries see the window, not the scaled page), so a 1040 px window at 150 % or a 1366 px window at 175 % cut the header off the left edge. Fixed.
8. A **safety bug**: pressing Esc to close the manual, the Remote panel or the Screens menu also blanked the screens. Fixed.
9. A tall dialog (the shortcuts list) ran off the window with no scrolling. Fixed.
10. Biggest wins to approve: P-02 vocabulary, P-03 queue toolbar, P-05 Now dock, P-07 one primary, P-06 Run view.

## Inventory (from the live DOM at 1366×768, projection closed)
Controls visible per section: Sermons 42 · Bible 133 (verses × 2 buttons each) · Songs 43 · Media 53 · Tape 39. **34 of them are identical on every section** (header 13, rail 8, status bar, queue pane toolbar and live box), against 5–19 section-specific controls outside Bible. In other words the chrome outweighs the content in most sections.

| Control | Where | Places offering the same action | Shortcut | Need |
|---|---|---|---|---|
| Show something | row buttons "Project", live "Take next", Enter, double-click, palette, phone Next | 6 | Space / → | every minute |
| Hide screen / Show screen | header, live box "Clear"/"Show", Esc, B, phone Blank | 5 | Esc, B | several per service |
| Open saved service | rail Open, queue toolbar Open, empty-state button, palette, File | 5 | ⌘O | once |
| Save service | queue toolbar, palette | 2 | ⌘S | once |
| Is tonight ready? | queue toolbar "Check", palette | 2 | — | once per service |
| Open/Close projection | header, palette, Screens menu | 3 | ⌘/Ctrl+Shift+W | start/end |
| Message on screen | header, palette | 2 | — | occasional |
| Theme / Contrast / Interface size | header icons, palette | 2 (size: palette only) | — | rare |
| Help / Shortcuts | header, palette | 2 | F1 / ? | rare |
| Tape play/pause | bar, Tape place, phone, palette | 4 | ⌘/Ctrl+Shift+P | during tape services |
| Add to queue | row "+ Queue", context menu, Q, drag | 4 | Q | frequent in preparation |

## Findings

### Bugs (all fixed on this branch)
| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-01 | P1 | **Esc that closes the manual, the Remote panel or the Screens menu also blanks the congregation screens.** The popovers close themselves and the app-wide Esc handler then toggles the blackout. A volunteer opening the Remote QR mid-service and pressing Esc blanks the room. | Live check: `blanked` true after Esc from each; false after the fix; Shift+Esc still blanks. `src/renderer/src/escRule.ts` |
| B-02 | P1 | **Header cut off at a narrow scaled width.** Media queries see the window (1040), not the scaled page (693 at 150 %), so compact rules never applied; at 1040×640/150 % and 1366×768/175 % the Back button and search sat at x = −15 … −113 and could not be clicked. | `header` geometry probe at 4 widths × 4 scales; screenshots `zoom-*.png` |
| B-03 | P1 | **Search button squeezed to an empty 22 px pill and the header overlapped its logo** at 1040 px with the screens live (Hide screen, Message, Close projection add 215 px). | Header widths at 1040/1100: search 22 px; overlap with logo |
| B-04 | P1 | **Keyboard shortcuts dialog 1021 px tall in a 640 px window**, top −191, bottom 831, no scrolling: title and the last rows unreachable. | Dialog geometry at 3 sizes |
| B-05 | P1 | **Rail falls off the bottom** (Saved, Open, Queue unreachable) on a short window or a large interface scale (rail 404 px in a 345 px column at 150 % on 1040×640); `overflow: visible`. | Rail probe |
| B-06 | P1 | **The queue pane's maximum width ignored the interface scale**, so at 150 % it took half of the screen pixels, not half of the scaled page. | Layout at 1040/150 % |
| B-07 | P2 | **Three dialogs (Message, Keyboard shortcuts, channel operator) had no `role="dialog"`, `aria-modal` or name**: screen readers did not announce them as dialogs. | DOM probe (11 of 14 dialogs were named) |
| B-08 | P2 | **Raw browser text in an operator error**: a failed `play()` showed "NotSupportedError: Failed to load because no supported source was found" in the tape bar and "This video stopped: …" bar. | `audio.ts`, `ProjectionVideo.tsx` |
| B-09 | P2 | **A malformed tape command was read as "go to 0:00"** (`Number(undefined) \|\| 0`): the merge-check's seek (sent with the wrong field name) started the tape at the beginning instead of being refused. Seeking itself works in every state (see 02). | Code + 12-state live matrix + phone |
| B-10 | P2 | **Regression scripts were stale or needed manual setup** (Remote wording and address check; Graphics script needed a Graphics page; no runner). | `scripts/regression/` |

### Design changes (proposed only)
| ID | Sev | Finding | Proposal |
|---|---|---|---|
| D-01 | P1 | 13 header controls in one row mix navigation, search, appearance, help and the live controls | P-01 |
| D-02 | P1 | The same job has six names (Project, Take, Put on the screen, Show, Blank, Clear…) | P-02 |
| D-03 | P1 | The queue toolbar is two rows (~70 px); queue list shows 6 rows at 1366×768, 2 at 1040×640; "Open" exists 5 times | P-03 |
| D-04 | P2 | Rail: five accent colours for "which section" dilute colour meaning; Saved/Open are file actions among places | P-04 |
| D-05 | P1 | "What is on air?" is a small word; two bottom strips cost ~87 px | P-05 |
| D-06 | P1 | The preparation layout is used during the service; Take/Next/Back are 36 px | P-06 |
| D-07 | P1 | Two purple primaries with different jobs (Take next, Next ›) | P-07 |
| D-08 | P2 | Two buttons on every verse/paragraph row, plus "tap to put on screen" | P-08 |
| D-09 | P2 | 10–15 visible controls under 24 px per section; Open projection / Hide screen only 28 px | P-09 |
| D-10 | P2 | 26 Tab stops to the first content control; no skip link, no h1, queue pane not a landmark | P-10 |
| D-11 | P2 | Interface size is only in the command palette; theme and contrast are unlabeled icons | P-11 |
| D-12 | P2 | A fresh profile has no first-run guidance | P-12 |
| D-13 | P2 | The phone remote has no Media or Tape tab and no "hidden" banner | P-13 |
| D-14 | P2 | The queue row's first row shows "John 3:16 · …" truncated beside the UP NEXT tag while there is room | (inside P-03/P-08) |
| D-15 | P2 | At ≤ 800 scaled px the queue pane and the browse columns together leave the content ~180 px (the sermon search input shrinks to an empty box) | (inside P-06: auto-collapse) |

## Real-service workflows (clicks / keystrokes, by inspection of the real flows)
| Job | Today | Notes |
|---|---|---|
| Put John 3:16 on the screens (from the Bible, nothing open) | ⌘K, type "John 3:16", Enter = 3 actions; mouse: Bible, book, chapter, verse "Project" = 4 clicks | Both fine. The words differ (Project vs Take). |
| Build a 9-item queue from the Bible and Songs | ~2 actions per item with Q / "+ Queue" | OK; keyboard path (Q) is good. |
| Pre-service check | Queue toolbar → Check (1 click, but the quietest word in the toolbar) | P-03 chip. |
| Step through the queue live | Space / Next (keyboard) — Take next vs Next confusing | P-07. |
| Last-minute scripture | ⌘K, verse, Enter = 3 actions without leaving the live view | Good. Keep in Run view. |
| Undo a mistake | ⌘Z or the toast Undo; "New service" with 12 items shows an Undo toast, no confirm | Good; matches the repo pattern. |
| Panic / blank | Esc (or Shift+Esc to also pause the tape) | Good; bug B-01 fixed so closing a popover cannot do this by accident. |
| Tape service | ⌘/Ctrl+Shift+P to play/pause from any section; the bar shows what is playing | Good. |
| **A volunteer at 9:55 who has used the app twice** | Needs to know: open projection, find "Screens ▾" to check displays, queue is where the service is, "Is tonight ready?" is the word "Check"; reading the live box needs the 100 px Live thumbnail | P-12 (checklist), P-05 (dock), P-02 (words). |

## Glossary drift (terms in use today)
Take / Take next · Project / Projection / Close projection · Put on the screen(s) · Show / Show screen · Hide screen / Blank / Clear · Screens (menu) / displays / Outputs · Congregation / Stage / Graphics (destinations) · Channel / Destination / Profile (see Screens ▸ Manage) · Queue / Service queue / My list (phone). The proposal P-02 fixes the first group; the second needs a plain-words pass on the Screens Manager (backlog item B-5).

## Lenses with no findings of consequence
* **Contrast:** the existing audit (dark, light, high-contrast) is green; no new failure found in the review screens.
* **Focus rings:** all 70 sampled Tab stops showed a visible focus ring.
* **Console:** a 40-step tour produced no errors or warnings except Electron's dev-build CSP notice (dev only).
* **Undo pattern:** present for queue changes; consistent.
* **Phone remote layout:** no overflow at 360×640, 390×844, phone landscape, tablets (64 checks in two engines).
