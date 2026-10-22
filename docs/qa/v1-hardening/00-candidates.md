# 00 · Candidate list: bugs v2 fixed, to check against v1

Built from the v2 repo (`born-again`, branch `v2-channels`, read-only): its git log, `docs/qa/final-qa/changes.md` and `recommendations.md`,
`docs/design/ux-review/02-fixed-bugs.md`, `docs/notes/v1-handoff-*.md`, `docs/qa/{remote,search,pin}/`, `docs/qa/help-audit.md`,
`docs/qa/windows-code-review.md`, `docs/qa/song-structure-progress.md`, `docs/V1-PARITY.md`.
v2 split from v1 at `74ededf`; v1.13.1 (`19d4c37`) is what this round starts from.

Two things in v2's own notes are wrong and are corrected here: `changes.md` lists F-001 (reload menu) under `58671cc`, but the code is in
`64c16d2`; F-043/F-044 say "see git log", they are `027b8ab`.

IDs below are used in `01-classification.md` and `02-fixes.md`. Only bug fixes are listed. v2 features are not.

## A · Keyboard and live safety
| ID | Bug | v2 commit |
|---|---|---|
| A1 | Esc that closes the manual / a dialog / the Remote or Screens popover also blanks the congregation screens | `9f02821` |
| A2 | Same, with the Import menu (`role=menu`) or the song key picker open | `e1dc01f` |
| A3 | Esc in a search box that has text clears it and also blanks the screens | in `5e96873` |
| A4 | Ctrl/Cmd+R reloads the operator window mid-service | `64c16d2` (F-001) |
| A5 | Ctrl/Cmd+→ stalls after one press (a section's search box takes the cursor) | `c167c78` |
| A6 | Cmd/Ctrl+K swallowed or fires twice | `3051dc4`, `0a155d3` |
| A7 | Saved drawer stays open over the next section | `1a08531` |
| A8 | Songbook menu and Import menu open at once | `709d1ab` |

## B · Graphics / OBS output (v2-only feature)
B1 stale verse and red RECONNECTING inside OBS (`0f20878`) · B2 Graphics backgrounds never showed (`a20344e`) · B3 empty panel / no keep-alive (`8a6f89e`) ·
B4 unreadable over white video (`6489b83`) · B5 RTL and long-word lower third (`1ae6363`, `e190f63`) · B6 profile change did not re-send the frame (`f125882`) ·
B7 closing the congregation window left Graphics stale (`d1bd397`) · B8 Graphics page favicon 404 and a deprecated meta tag (`5baaf8e`, F-020).

## C · Desktop layout and visuals
| ID | Bug | v2 commit |
|---|---|---|
| C1 | Toast Dismiss overlaps its action at a small window / large scale | `ec902f9`, `161522b` |
| C2 | Section switching 44% slower with a 600-item queue (`contain: layout`) | `bf18576` |
| C3 | Header search button squeezed, overlapping the logo at 1040 px | `424aa77` |
| C4 | Header cut off at 150%/175% scale | `91108c8`, `367467b` |
| C5 | Rail buttons fall off a short window | `bc4c7eb` |
| C6 | A tall dialog (Keyboard shortcuts) runs off a short window | `494618f` |
| C7 | Start screen cut off at the top | `18be226` |
| C8 | App-info popover runs off the right edge | `893c2d7` |
| C9 | A line with no spaces runs off the projector / stage; stage "Next" band cuts its reference line; stage label contrast | `0dcc819` |
| C10 | Stage monitor text cut off | `6380e9c`, `8b83a66` |
| C11 | Saved drawer covers the Now dock | `029edc3` |
| C12 | Rail active item hides the focus ring | `7ce840a` |
| C13 | Shortcuts dialog squeezed | `88d0607` |
| C14 | Native `<select>` not themed | `f6370bf` |
| C15 | Textarea shows the browser's amber outline | `85d5499` |
| C16 | A 150-character song title takes 10 lines | `6351aec` |
| C17 | Touch targets under 32 px (several) | `ffdbfe3`, `77bc103`, `edc9346`, `ec169a2`, `e20cbd9`, `1d169ae` |
| C18 | Media buttons clipped at 1366; queue toolbar clipped; banner one character per line | `e93647c`, `982e85d`, `6a451bf` |
| C19 | Theme contrast problems (high-contrast-light) | `cb94326`, `cd064fe` |
| C20 | Screens popover cannot scroll; status chips lost | `12c8657`, `a8779f0` |
| C21 | Hide/Show button not amber while hidden | `ef12b1d` |
| C22 | Help viewer spins forever when a request fails | `753b319` |
| C23 | Ambiguous display match guessed silently | `3d1edee` |

## D · Help viewer
| ID | Bug | v2 commit |
|---|---|---|
| D1 | A Help link to a section of another page does nothing | `7aa1b48` |
| D2 | Manual path check is a string prefix (a sibling folder is reachable; Windows case) | in `50ad837` |

## E · Phone remote
| ID | Bug | v2 commit |
|---|---|---|
| E1 | Search boxes have no visible focus ring | `027b8ab` (F-043) |
| E2 | Scope pills / stage buttons under 32 px; truncated live text has no tooltip | `027b8ab` (F-044) |
| E3 | A–Z strip too small | `596ac4a` |
| E4 | A–Z jump backwards does nothing (sticky headers) | `ae5fd13` |
| E5 | Song rows overlap with many results | `1b67d38` |
| E6 | Add-to-Home-Screen sheet stacks on the role prompt; broken thumbnail; 19–23 px buttons | `b0f2534` |
| E7 | YouTube thumbnail 404; focus ring | `243c60c` |
| E8 | `/command` body read with no size limit | `9eb62f0` |
| E9 | Remote polish: queue item id put unescaped into a tap handler; double tap sends a command twice; polls pile up on weak Wi-Fi; no offline notice | `6a6d59f` |
| E10 | Remote page can be framed (clickjacking) | `d229800` |
| E11 | Older search answers replace newer ones; "Searching…" stuck on a dropped connection; 14 px inputs make phones zoom | in `5e96873` |
| E12 | Tablet connection state is a grey dot only | `2b6fc76` |
| (already in v1) | stale state after resume, silent failure on a dropped connection, rapid-Next race, "+ Queue" contributor tag, network picker / mDNS per adapter / bind 0.0.0.0 | `74bc8bd`, `46422c7`, `8e3dbf6`, `dae3d75`, `2d41c3b`, `e17ef57`, `e05879c` |
| (feature) | PIN on the remote and its limiter fixes | `1f9a4ec` … `b47ac9c` |

## F · Data safety and startup
| ID | Bug | v2 commit |
|---|---|---|
| F1 | A damaged `queue.json` silently becomes empty and is overwritten | `4708bbc`, `063b4e8` |
| F2 | A damaged `settings.json` is overwritten | `316948a` |
| F3 | Read-only data folder: unhandled error, no window | `9cc3daf` |
| F4 | Sermon text starts with an empty box (U+F6E1 in ~2,410 paragraphs) | `f9ec2d7` |
| F5 | Copy buttons say "Copied" when the clipboard refused | `c1c2607` |
| F6–F8 | Test hooks, installed app honouring `BORN_TEST_*`, undo re-pointing screens | `dbce84f`, `8c27a2c`, `ba4ab98` (v2-only) |
| F9 | Drag insertion element swallows drops | `5ecd085` |
| (note) | A queue item of an unknown kind crashes the queue screen | `docs/notes/v1-needs-unknown-item-safety.md` |

## G · Windows build and tests
| ID | Bug | v2 commit |
|---|---|---|
| G1 | Windows installer shipped without libraries (Mac/Linux npm script syntax + continue-on-error) | `ef4ca7e` |
| G2 | Windows-only test failures (line endings, `.cmd` shims, timing, port blocker, slow inserts, `Promise.withResolvers`, PDF timeout) | `541d6b1`, `5a5f5f2`, `7cfafc8`, `b47ac9c`, `18e161f`, `145a3d9` |
| G3 | Bible download gives up after ~12 s on HTTP 429 | `a29e4b1` |
| G4 | Windows file hardening (`winFs.ts`) | `50ad837` |
| G5 | Console window flashes on Windows | `88d09da` |
| G6 | Smoke script / test port hygiene | `6fab709`, `610dc1c` |

## H · v2-only features' own bugs (tape, media, song structure, Channels)
Not applicable to v1 (no such code). Listed in v2's `changes.md`: tape seek / play failure / focus rules (`d9607a0`, `21bb780`, `7d940b3`, `161d499`, `88d31c3`, `b1552a3`, `aea9b1b`, `5c9b4ff`, `2cfd278`, `16bfa05`, `1d169ae`, `0c848a7`, `b8e51e1`),
media (`34ce481`, `c649683`, `362a783`, `d3f2f7a`, `6dd8075`), song-structure (`a3cf8c0`).

## J · Decisions v2 itself left open
App-window CSP; queue list not virtualised; database build needs the network; remote `open-service` / `import-service` path not sandboxed (SEC-01).
