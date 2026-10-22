# 08 · Does v2 already have each v1 fix?

Checked by reading `born-again` (branch `v2-channels`, **not edited**). The rule stays: v2 must receive every v1 fix. Nothing here needs a v2 change today
except the two items marked **port by intent**; `docs/V1-PARITY.md` in the v2 repo was not edited (note it there in the next v2 round).

| v1 fix | In v2? | Where (v2) |
|---|---|---|
| 1 Esc closes what is on top without blanking (incl. Import menu, key picker, search clear, Filters) | yes | `9f02821`, `e1dc01f`, `5e96873`; `SearchBar.tsx` Esc → `stopPropagation` |
| 2 Ctrl/Cmd+R does not reload the installed app | yes, different mechanism | `64c16d2`, `appMenu.ts` (no Reload when packaged) |
| 3 Help cross-page links | yes | `7aa1b48` |
| 4 Manual path containment | yes | `50ad837` |
| 5 Dialogs scroll in a short window | yes | `494618f` |
| 6 Long unbroken line wraps; stage Next band | yes | `0dcc819` |
| 7 Remote not frameable | yes | `d229800` |
| 8 `/command` body limit | yes | `9eb62f0` (`MAX_BODY_BYTES`) |
| 9, 10 Remote focus ring, 16 px, A–Z 44 px | yes | `027b8ab`, `596ac4a`, `5e96873` |
| 11 Remote quote marks / unescaped id | yes | `6a6d59f` (`escAttr`) |
| 12 Remote newest search wins / lost connection | yes | `5e96873` |
| 13, 14 Damaged `settings.json` / `queue.json` kept aside | yes | `316948a`, `4708bbc`, `063b4e8` (plus a notice) |
| 15 Read-only data folder message | yes | `9cc3daf` |
| 16 Private-use symbol hidden | yes, **at read time only** | `f9ec2d7` cleans in `main/index.ts` and `search.ts`. **Port by intent:** v1 also cleans where saved items are *drawn* (projector, stage, queue row) so a service saved before the fix is clean too. v2 items saved before `f9ec2d7` may still show the box |
| 17 Copy says "Copied" only on success | yes | `c1c2607` (`copyText`) |
| 18 Unknown queue item kind | yes | `UnknownItem` (Media 1a) |
| 19 Screens popover scrolls | yes | `12c8657`; v2's popover has a scrolling body and a capped height |
| 20 Filters popover stays on screen | Esc yes; **edge clamp: port by intent.** v2's layout differs, so check the search Filters popover at 1040×640 with 150% scale; v1's `popoverFit` (`src/renderer/src/popoverFit.ts`) is a small reusable clamp | — |
| 21 Windows test fixes | yes | `541d6b1`, `5a5f5f2`, `7cfafc8`, `b47ac9c` |

v1-only observations not applicable to v2: the Windows run of v1's old npm scripts (`04-windows.md`); v2 already replaced those scripts (`ef4ca7e`).
