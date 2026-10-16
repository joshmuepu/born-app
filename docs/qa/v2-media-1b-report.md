# Media Phase 1b — video and moving backgrounds: QA report

Branch `v2-media-1b` (created from the tip of `v2-media-1a-followup`). Written for the owner. Plan: [08-phase-1b-build-plan.md](../design/media/08-phase-1b-build-plan.md).
The limits are the resolved spike gates (MP4 H.264+AAC, ≤ 3840×2160, 30 fps verified, warnings above 20/40 Mbit/s). **No long test was run in this round.**

## What was built (all seven slices)

| # | Slice | State |
|---|---|---|
| 0 | Video as a library type: MP4 reader (no FFmpeg), schema migration 2, poster decode in the browser engine, `Range` serving, video queue item + compat shell | **built, tested** |
| 1 | Video as a Content item: Take shows it **paused**; Play/Pause/seek/volume/mute/loop from the operator bar; the main output owns the clock | **built, tested, verified in the real app (dev and packaged)** |
| 2 | Looping motion backgrounds (muted, looping, no clock), per destination and channel with dim | **built, tested, verified** |
| 3 | Followers: the shared correction rule (nudge ±5% between 40–500 ms, seek beyond, still frame + time left when it cannot catch up); stage monitor shows time left | **built, tested; Chromium follower measured** |
| 4 | Preflight for video: whole file, allowed format and size, a real frame decodes here, limits as warnings, plain messages with the fix | **built, tested** |
| 5 | Phone remote: Play/Pause of the live video only; Play refused until the operator has started it | **built, tested; verified in WebKit and Chromium** |
| 6 | Panic: Esc / blank / logo key stop picture and sound at once; unblank returns **paused**; alerts unaffected | **built, tested, verified** |
| 7 | Graphics browser output (OBS): plays the video **muted** as a follower on Full-screen outputs; Lower-third never draws video; still + time left as the fallback | **built, tested; Chromium measured, WebKit headless unreliable (below)** |

Not built (by plan): audio-only items, in/out points, "when it ends then…", fades, WebM/MKV/MOV/AVI/HEVC/AV1, long local video as a normal use, YouTube (see the plan's "YouTube next"), video inside a service pack (refused with a plain message).

## Behaviour that differs from what you might expect

- **Take shows the first frame paused; Play is a separate action.** (Design rule: nothing plays by itself, no sound on Take.)
- **A phone cannot start a video that has not been played** on the main computer; it can pause and resume only.
- **A service pack refuses a service with a video** ("pictures only" for now).
- **Motion backgrounds loop with the browser's own loop**, each screen on its own; they are not synchronised (only the Content video is).
- **The Graphics page never plays sound**, whatever the main screen does.
- The Media list's "All pictures" is now "All media".

## Evidence

| What | Result |
|---|---|
| Tests | **1202 passed**, 1 skipped (the opt-in benchmark), 83 files (was 1072 at the follow-up). New: MP4 reader (8), playback rules (23), playback hub (12), Range (3), library video import/preflight/schema (18), service-pack video refusal, the leader window (11), the operator bar (6), the video route and Graphics page/SSE (6), the phone page and its controls (7), v1's own reader (1) |
| Typecheck, production build | clean |
| Real app, dev profile | import of a fragmented MP4, a classic M4V (64-bit mdat), 4K (warning shown), refusal of MKV, WebM and a HEVC MOV with the right messages; take → paused; Play; seek; pause; Esc; un-blank → paused; logo key; replacing the video; motion background (muted, looping, time advancing); video import 33–256 ms |
| Real app, **packaged** (macOS arm64) | import by drag-and-drop, refusals, take/play/seek/pause/Esc, Range → **206 with Content-Range**, preflight "ok" |
| Range / seeking | `born-media://file/<id>` answers 206/416 itself; a `<video>` seeks (5 s) correctly; HTTP route tested for 200/206/416/404 |
| Graphics follower | Chromium (the engine OBS uses): over 30 s of a looping clip, **difference from the main output: mean 37 ms, p95 76 ms, max 85 ms** (includes ~tens of ms of measurement jitter), 0 stills, muted, no page errors. **WebKit headless** (Playwright's build) played the video unevenly (position jumps) — mean 590 ms; it never showed a wrong picture and the rule bounds it, but treat Safari/WebKit browser sources as **unverified** |
| Phone remote | WebKit iPhone and Chromium Pixel: Play greyed + "Start it on the main computer first" before the operator plays; Pause/Play from the phone pauses/resumes the real output; no errors |
| Panic | Esc: picture and sound stop at once, record paused; un-blank: back paused; Ctrl+Shift+L: logo replaces the video; alert shows over a playing video |
| Contrast | 60 combinations (library videos, video detail, live video bar, preflight, backgrounds with videos × 3 sizes × dark/light/both high-contrast): **0 issues** ([report](media-1b-contrast-report.json)); the phone page and the stage monitor use their own hand-checked palettes (not covered by that tool) |
| Regression (fresh profiles) | navigation history 10/10, queue drag 20/20, Channels/Destinations/Profiles/automation 656/0, Graphics output profile/blank/suppress, a following Channel's Graphics frames, phone remote thumbnails in WebKit + Chromium |
| v1 compatibility | v1.13.0's own `migrateQueue` (the real file from the v1 checkout, in `v1Compat.test.ts`) opens a queue with picture, slideshow and **video** items: no crash, nothing dropped, the video data kept under `ext` |

## Not tested here

Windows; real projectors; a church-class (slow) PC; the 4K clip beyond a few seconds in this round (the spike's 20 minutes stands); 60 fps and high-bit-rate real-world files; HEVC (refused by design); thermal behaviour; WebKit/Safari browser outputs for OBS-style use; the phone remote on a real phone; the stage monitor in a real second display (unit and logic only).

## Decisions made without asking

See the final report of this round: listed there and in the commit messages.
