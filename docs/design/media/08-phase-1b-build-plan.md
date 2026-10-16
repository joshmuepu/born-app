# 8. Phase 1b build plan — video and looping motion backgrounds

Part of the [media design package](README.md). Written for the owner. Status: **plan, then built on branch `v2-media-1b`** (see "What was built" at the end, kept up to date).
The long-run spikes are finished and accepted; their verdicts and limits are the **spec** here: [roadmap, "Phase 1b gates"](05-roadmap.md#phase-1b-gates--resolved-overnight-run-2026-10-16),
[spike 1](spikes/1-long-run-stability.md), [spike 3](spikes/3-multi-screen-sync.md). No long test is part of this build.

## Scope (in)

| # | Slice | One-line description |
|---|---|---|
| 0 | Plumbing | `video` as a library type: MP4 probe (no FFmpeg), poster thumbnails, `Range` serving, schema migration 2, queue item kind, compat shell |
| 1 | Video as a Content item | Take a video; Preview/Live pair; play / pause / seek / volume / mute / loop from the operator; the main output owns the clock |
| 2 | Looping motion backgrounds | A video in the Background layer, muted, loops, no length limit |
| 3 | Followers | Every other screen follows the main clock; nudge, hard-seek only when needed; still frame + time remaining as the fallback beyond ~500 ms |
| 4 | Preflight for video | "Is tonight ready?" knows resolution, bitrate, codec/container, truncated files; plain messages with a suggested fix |
| 5 | Phone remote | Play / Pause of the **live** video only |
| 6 | Panic | `Esc` and `Ctrl/Cmd+Shift+L` stop sound and picture at once; alerts unaffected |
| 7 | Graphics browser output / OBS | Decide and implement the safest behaviour (below) |

## Out (stays out of 1b)

Audio-only items, in/out points, "when it ends then…", fades and dissolves, playlists, timeline/cue editing, FFmpeg or any conversion, WebM/MKV/MOV/AVI/HEVC/AV1/ProRes, live inputs, **YouTube** (Phase 2a; see "YouTube next"), seek from the phone, starting sound from the phone, a long local video as a normal use (long videos are expected to come from YouTube).

## The limits (the spec, from the spikes)

| Rule | Value | What the app does |
|---|---|---|
| Container / codecs | **MP4 with H.264 video and AAC audio (or no audio)** | Anything else is refused with a plain message and a suggested fix. HEVC is never trusted to play. |
| Largest | **3840×2160**, **30 fps verified** | Over 3840×2160: refused. 4K: allowed with a preflight warning. Above 30 fps: allowed, flagged "not soaked". |
| Bitrate | warn above **20 Mbit/s** (≤1080p) / **40 Mbit/s** (4K) | Warning only; nothing refused. |
| Length | **no limit** | A looping clip needs none (239 loops showed no growth). |
| Screens | main output + any number of followers | Followers correct to the main clock. |
| Clock | Main output owns it | Followers nudge the rate ±5% between **40 and 500 ms** out; hard seek beyond 500 ms; if a follower is still > 500 ms out after a seek it shows the **still frame and the time remaining** until it catches up. |

## Design

**Files.** Video is a library item like a picture (type `video`): copied into the managed folder (or linked), identified by SHA-256, soft-deleted, tagged, foldered. The library reads the MP4 itself (a small box reader — no FFmpeg): container brand, codecs, size, frame rate, duration, bitrate, and whether the file is whole (the top-level boxes must add up exactly to the file length; `moov` must be present). It then asks the real browser engine to **decode a frame** in the hidden window; that frame is the poster (320 and 960 px thumbnails). **No decision rests on `canPlayType`.**
Served to windows with `Range` (seeking) through `born-media://file/<id>` and, for browser outputs, `/media/<id>/file`.

**Queue.** A video is a `MediaItem` with `mediaKind: 'video'` (+ optional `loop`). It is written as the same quote-shaped **compat shell** as pictures, so v1.13.x opens the file and shows a harmless row; older v2 builds show it as an "unknown item" (kept, never dropped).

**Playback state (main process).** One record per channel: `{ mediaId, status: loading|paused|playing|ended|error, position, at, volume, muted, loop, duration, hasPlayedOnce }`. The main output window (congregation) is the **leader**: it applies the record and reports its real position about once a second and on every event; main stores that as the clock. Followers and the operator receive `media:playback` messages (position, status, a timestamp) about once a second. If there is no leader window the main process's wall clock stands in. The rules (position maths, follower action, time formatting, preflight rules) are **pure functions in `src/shared/videoPlayback.ts`** and are unit-tested without Electron.

**Taking a video** shows its first frame **paused** — *nothing plays by itself and no sound starts on Take*. **Play** is the operator's action (button or Space when the Live panel is focused).
**Esc / Blank / logo key** pause at once (silence), hide the picture, and a later unblank shows the paused frame — it never resumes by itself. A take still loading when Esc is pressed is cancelled (the existing blank-epoch guard).

**Motion backgrounds.** Same Background setting as stills (per destination and per channel, with dim), now allowed to be a video: drawn as a muted looping `<video>` behind the text, never audio, never reported to the clock. Loops with the element's `loop`; each screen loops on its own (backgrounds are not synchronised — only the Content video is).

**Followers.** `followerAction(leader, mine)` returns *nothing / rate / seek / still*; the Graphics page runs it once a second. **Stage monitor:** it shows the time remaining (large) and progress only — no video decoding (the design in mockup 10).

**Graphics browser output (OBS) — decision.** The Graphics page already plays a muted picture of the content layer. For video it plays the video **muted, as a follower** (same `Range` route, same correction), on the Full-screen profile only (a Lower-third output never draws pictures or video, so a video can never cover a camera). If the follower is out of range or the video can't load, it shows the **poster still and the time remaining**. Never sound from a browser output. *Why this is the safest:* sound stays on one device; an OBS scene can't be covered by a failing video; the worst case is a still picture.

**Phone remote.** `/command` accepts `media-play` and `media-pause` only; the state feed carries `{ playing, position, duration, hasPlayedOnce }` for the live video. **Play is refused until the operator has started that video once** (so the phone can never be the first thing that makes sound). No seek, no volume. Uses the existing remote server and connection model; no new authentication.

**Panic.** `Esc`: main sets the channel blank → playback `paused` and the leader pauses audio immediately; `Ctrl/Cmd+Shift+L` (logo) does the same. The alert layer is separate and unaffected.

## Preflight rules for video ("Is tonight ready?")

1. The file is there; the size is what was recorded; the file is **whole** (box lengths add up; `moov` present) — a half-copied file is flagged, not trusted.
2. Container is MP4 (brand `isom`, `mp41`, `mp42`, `avc1`, `M4V `…; `qt  ` MOV is refused); video track is H.264; audio is AAC or absent.
3. **A frame really decodes** (poster rebuilt/verified in the hidden window) and the browser's duration agrees with the file's within a second.
4. Resolution ≤ 3840×2160; > 1920×1080 → "4K: may play poorly on this computer — test it" warning.
5. Bitrate warnings at 20 / 40 Mbit/s; > 30 fps → "not soaked" note.
6. Linked file: its drive is connected (the offline state from the follow-up).
Each failure says what is wrong and a fix in plain words, e.g. "This video uses HEVC (H.265), which many computers can't play. In your editor, or in HandBrake, export it as **MP4, H.264 video, AAC audio** (the 'Web' or 'Most compatible' preset) and add that file."

## Acceptance tests (every slice has tests; the suite stays green)

| Slice | Automated | Real app |
|---|---|---|
| 0 | MP4 box reader on generated and hand-made files (whole / truncated / no moov / HEVC / MOV brand / audio-less); schema migration 1→2 keeps rows; `Range` handler; queue round trip + compat shell; v1.13.0's `migrateQueue` (from the v1 checkout, when present) opens a file with video items | import a generated clip, thumbnails, packaged-origin protocol |
| 1 | playback reducer (play/pause/seek/loop/ended/position maths); item→slide payload; operator bar component | Take, Play, Pause, seek, volume in a real projection window |
| 2 | background resolution accepts video; `has-bg` rendering component test | video behind a verse |
| 3 | `followerAction` table (none/rate/seek/still, hysteresis); time-remaining formatting | a second (Graphics) output follows |
| 4 | preflight rules for every limit and refusal | Check lists a bad file with its fix |
| 5 | remote command handler: play refused before first play, pause always allowed, no seek | phone page buttons (WebKit + Chromium) |
| 6 | blank/logo pause the record and bump the epoch | Esc during playback |
| 7 | graphics frame carries the playback record; lower-third drops video | OBS-style page in WebKit |

## Risks

- Smooth `Range` seeking through a custom protocol (verified in slice 0 on the real engine; fallback is a localhost HTTP route).
- Windows decoders differ (hardware H.264 is near-universal; the spike numbers are Mac-only) — hence the preflight warnings and the church-PC checklist.
- Frame accuracy of position reports (±1 s reporting; followers extrapolate).
- 4K on weak PCs: warning only; the 4K soak was 20 minutes.
- A custom-protocol video needs `stream` privileges (already set for `born-media`).

## YouTube next (not started; Phase 2a)

What the roadmap and [06-youtube.md](06-youtube.md) say: long videos should play from YouTube **inside the app with the official embedded player only** (no downloading, no scraping, no changing the player), as an item with an *Online* badge, an online preflight, a **local fallback** per item (which is why local video had to exist first), Test play, and **Play/Pause/Blank only** from the phone.
- **Can be built before counsel review:** the item type and queue shell, URL parsing, the player host window with the required `Referer`/origin fix for **Error 153** (identify the app to YouTube), the playback bar reuse (position, time left, stalled/error states), the online preflight (reachability, embeddable flag via the official player), the fallback item, and offline behaviour.
- **Must wait for counsel / the owner:** how ads are handled and described to churches; whether alerts may re-lay-out the player or are stage-monitor-only (06 §6, choice A vs B — recommendation: B for routine, A for emergencies, needs counsel); whether any search (Data API) is used; the terms-of-service review in 06 §10C; commercial-edition wording.
- Spike 9 must still pass for the origin/identity behaviour on the target OS.

## What was built

All seven slices are built and tested; evidence, numbers and what differs from the plan are in
[docs/qa/v2-media-1b-report.md](../../qa/v2-media-1b-report.md); merge readiness in [docs/qa/v2-media-merge-readiness.md](../../qa/v2-media-merge-readiness.md).
Differences from this plan: the library label "All pictures" became "All media"; a service pack refuses a service that contains a video (pictures only);
the Graphics follower is measured on Chromium (what OBS uses) and unverified on WebKit; motion backgrounds are not synchronised across screens (as planned).
