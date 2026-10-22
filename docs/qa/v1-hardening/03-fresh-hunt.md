# 03 · Fresh v1 bug hunt (beyond v2's list)

Everything ran on isolated profiles (own `BORN_USER_DATA_DIR`, remote port, mDNS name), never the owner's real data or the running v2 dev instance.
Probes are in `scripts/qa/` (scripts only). No projection / stage window was opened: that would go fullscreen on a real display (see "Not driven").

## Found and fixed
| Finding | How found | Commit |
|---|---|---|
| Screens popover ran below the window, no scrolling (Smaller/Larger and lower screen rows unreachable) at 1040×640 @125%/150% and 1366×768 @150% | `sweep.cjs`: 10 surfaces × 3 sizes × 3 scales × 2 themes; 56 findings | `561cb42` |
| Search Filters popover off the left edge and below the bottom at 150%; Esc did not close it (and blanked the screens) | same sweep + screenshots (`screenshots/`) | `ab755a2` |
| Remote: slow older search overwrote the newer; a lost connection left "Searching…" forever; `"faith"` redrawn as an empty field; item id could run script (see `01`, E9/E11) | `remote-probe.cjs` in Chromium and WebKit | `15240e2`, `e8c8229` |
| Queue item of an unknown kind crashes the queue screen on every launch | reading v2's note, then a failing render test | `e8cec0b` |
| Damaged `settings.json` / `queue.json` overwritten; read-only data folder = silent exit | code reading + real-app launch with a read-only folder | `0c7c559`, `a289b20`, `9325e1e` |

After the two popover fixes the sweep reports **0 findings** across every surface, size, scale and theme.

## Checked and clean
| Area | Result |
|---|---|
| Unusual input (`input-probe.cjs`): 5,000-character strings, 4,000 unbroken characters, emoji and joined emoji, Arabic and Hebrew, pasted `<img onerror>`/`<script>` HTML, quotes/backslashes/FTS operators → Sermon, Bible, Songs search and the Paste-a-song screen | 24 / 24: no errors, no sideways scroll, no HTML interpreted |
| Phone remote offline / reconnect (`remote-reconnect.cjs`), Chromium and WebKit | 8 / 8: says "Reconnecting…" when BORN stops, a tap fails visibly, heals by itself when BORN returns |
| Large queue (`flows.cjs`): 600-item saved queue | loads; section switch 13–23 ms; no errors; removing an item autosaves; **survives a restart** (599 items) |
| Keyboard only (`flows.cjs`): 40 Tab presses | every stop is a control, none stuck, none off screen, **every stop shows a focus ring or highlight**; the order is the page order (header → panels → queue toolbar → status bar) |
| Phone remote A–Z jump, song rows overlapping, 320 px and 390 px | works / no overlap (v2's bugs E4, E5 do not exist in v1) |
| File open / save and old-file compatibility | see `06-verification.md`: output identical to `main` |
| Esc, click-away and focus on every popover | covered by the Esc tests and sweep after the fixes |

## Not driven (and why)
- **Projection, stage and the Message dialog end to end.** Opening a projection window goes fullscreen on an external display, which would disturb the owner's setup. Their *layout* was driven in headless Chromium against the built pages (`output-probe.cjs`); their text drawing is unit-tested.
- **Real mouse drag-and-drop of queue rows.** Electron's HTML5 drag cannot be driven over the debugging port. Reorder logic is unit-tested (`queueUtils`, `queueNav`).
- **A real Ctrl/Cmd+R key press in the installed app** (see `06-verification.md`).
- **Windows console flash on update** (`updateCheck.ts` spawns `cmd.exe` without `windowsHide`): cannot be observed here; listed in `05`.
- **First launch** feels fine on an empty profile (every probe started from one); a first run on a phone (Add-to-Home-Screen) was not driven.

## Single one-off
`npm test` printed `60 passed (61)` once; the next two runs were `61 passed (61)`, 745 tests. Noted, not chased (did not reproduce).
