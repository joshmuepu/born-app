# YouTube (Phase 2a) — build report

Branch `v2-youtube`, from the merged `v2-channels` tip (288d9d3). **Not merged anywhere.** Counsel questions: `docs/notes/youtube-needs-counsel.md`. Manual page: `docs/manual/v2/operators/media-youtube.md`.

## What was built
| Item | Where |
|---|---|
| YouTube queue item (`kind:'youtube'`), library "Recent" list, add dialog (all link forms, ID validation, oEmbed title, operator label, backup) | `shared/queueItem.ts`, `shared/youtube.ts`, `renderer/.../YouTubeAdd.tsx`, `main/youtubeService.ts` |
| Playback in YouTube's official IFrame Player, on the main output only, via a local loopback page (a real origin) | `main/youtubeHost.ts`, `renderer/.../ProjectionYouTube.tsx` |
| Operator bar: play/pause/seek/volume/mute; Take shows it paused | `VideoBar.tsx` (`online`), the existing playback record (`PlaybackHub`) |
| Online preflight (internet, player script reachable, per-item ready / unreachable / blocked / not-embeddable, plain fixes, Test play) | `main/youtubeProbe.ts`, `Preflight.tsx` |
| Phone Play/Pause/Blank (Play refused until the operator has started it once); panic (Esc, Ctrl/Cmd+Shift+L) closes the player | existing hub rules, tested for YouTube |
| Other screens: stage = name + time left; Graphics/OBS = name only; no second player anywhere | `StageApp.tsx`, `webRemote.ts` |
| Alerts: stage monitor only while YouTube is live; one commented switch | `YOUTUBE_ALERT_POLICY` |
| Compat shell: v1.13.0 and v1.13.1's real queue readers open and keep YouTube items | `youtubeQueue.test.ts` |
| Service packs: YouTube items carry the **link only** | `servicePack.test.ts` |

## Error 153 — proven
The packaged-style app (loads from `file://`, the exact risky case) was driven over CDP on an isolated profile. A real public video (`jNQXAC9IVRw`, "Me at the zoo") came up **paused on Take with its length read (19 s)**, then **played** (position advanced 0 → 5.5 s in 6 s, muted), **paused** on command, and **Esc/blank paused it and destroyed the frame (0 player frames left)**. **No error 153.** The player frame was `http://127.0.0.1:<port>/player.html` (parent Referer = that origin, policy `strict-origin-when-cross-origin`). The optional app-id Referer override was not needed and is OFF. Real checks of known-bad ids returned the plain "owner does not allow it" message. Not yet proven: **Windows**, and a Premium/ads run — see the owner list.

## Contrast audit (new screens, measured on rendered colours)
Queue "YouTube · Online" badge 7.1 (dark) / 4.5 (light) / 10.8 (dark HC) / 8.0 (light HC); thumbnail Online chip 8.2 / 5.8 / 11.6 / 9.2; thumbnail title 16.1 / 17.7 / 19.8 / 21. All ≥ 4.5:1 (AA); high-contrast ≥ 7:1. All colours are existing tokens (the Screens pair); `themeContrast.test.ts` stays green.

## Tests
Full suite: **1290 passed, 1 skipped (90 files)** (was 1202). Typecheck clean; `electron-vite build` OK. New: URL parsing/ID validation, error mapping, preflight verdicts, report/stall maths, alert policy, queue round-trip + compat shell (incl. v1.13.0 and v1.13.1), probe/preflight/Test play with a fake player and fake network, local host server, title lookup, phone/panic rules on the shared record, renderer (frame, reports, commands, no alert, blank destroys it, bar, thumbnail).
