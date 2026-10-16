# 5. Roadmap

> **Approved by the owner, 2026-10-15** — see [README](README.md#approved-by-the-owner). Phase 1 is now
> split into **1a** and **1b**; library files are **copied by default**; YouTube is added as **2a**.
> The tables below are updated; where an earlier answer was reversed it is marked.

Part of the [media design package](README.md). Written for the owner.

Effort uses **S** (days), **M** (1–2 weeks), **L** (3–5 weeks), **XL** (6+ weeks) for one developer
with the existing codebase, *including tests*. Estimates are judgement, not measurement. Risk is
**low / medium / high**.

## Principles for the order

1. The smallest thing a church can **use on Sunday and trust**.
2. Reliability before cleverness: preflight and failure handling ship *with* video, not after.
3. Reuse what exists (queue, Preview/Live, Channels, palette, Graphics server, `.born`).
4. Each phase ends with a state where nothing is half-built and **v1 parity is untouched**.

## Phase 0 — Spikes (no UI shipped)

Answer the risky questions with throwaway prototypes **before** committing. ~M total.

| Spike | Question | Done when |
|---|---|---|
| S1 Playback | Do 1080p30/60 and 4K30 H.264 loop for 60 minutes without drops on a 5-year-old laptop (macOS + Windows)? Memory/CPU/GPU numbers | Table of results |
| S2 HEVC | Does a real HEVC file play on our target OS/hardware? | Pass/fail per machine |
| S3 Sync | Drift between Congregation, Graphics and a second window over 60 min; correction strategy | ≤ 80 ms or a better plan |
| S4 Serving | Serve media to the Graphics page with range requests; works in OBS Browser Source | OBS test |
| S5 Capture | `getUserMedia` for a USB capture card and NDI Virtual Input in Electron windows; permission flow | Works or documented limits |
| S6 Convert | FFmpeg options: bundle vs. detect vs. none; size and licence advice | Recommendation + legal check |
| S7 File compat | What do v1 and current v2 do with an unknown `kind` in `.born`? | Safe-skip proven or sibling-file plan |
| S8 Unify types | Merge the three duplicated `SlidePayload` types | Typecheck clean |

## Phase 1a — "Pictures, backgrounds, safety" (approved; spikes 1, 3, 4 not required)

**Scope:** media library (import by drag/drop and picker, folders, tags, favorites, search, thumbnails,
missing-file relink, duplicate detection); **copy into a managed library by default**, with **link in
place** for very large files (with a clear "this file lives at … and must stay there" state); images
and slideshows (manual/timed); still **backgrounds**; **PDF import** (`pdfjs-dist`); **preflight**;
**panic key**; stage-monitor content for images; `.born` with media references; unsupported files show a
clear message and never become a broken item.
**Effort:** M–L · **Risk:** low–medium · **Test:** library, import, relink, preflight, `.born` compat
(spike 8 first).

## Phase 1b — "Video and audio" (only after spikes 1–4 and 7 pass)

**Scope:** MP4/H.264 + AAC video; MP3/AAC/FLAC/Ogg/Opus audio; motion backgrounds; **playback bar**
(play/pause, seek, loop, volume, fade, in/out, "when it ends"); Live readback; stalled-video watchdog;
phone **Play/Pause live media only**; stage-monitor time left. **No FFmpeg.**
**Effort:** L · **Risk:** medium–high until the spikes report.

## Phase 2a — YouTube items (after 1b; only if spike 9 passes)

Paste-a-link, online badge, online preflight with fallback per item, Test play, Play/Pause/Blank only
from the phone. **Why after 1b:** it reuses the playback bar, Preview/Live readback, panic and
preflight, is the riskiest type (network, a third party's rules, an app identity), and needs a local
fallback to exist. **Effort:** M. **Risk:** medium–high (policy and origin/identity). See
[06-youtube.md](06-youtube.md).

## (superseded) Phase 1 — "Pictures, video, backgrounds"

The original single Phase 1 below is kept for history; 1a/1b above replace it.

**Scope**
- Media library: import (drag/drop + picker), folders, tags, favorites, search, thumbnails, missing-file
  relink, "reference by default / copy" switch.
- Item types: **Image, Slideshow (manual/timed), Video (MP4/H.264/AAC), Audio (MP3/M4A/WAV)**, Blank/Logo.
- **Backgrounds**: still and motion behind text (dimmed), per-Destination.
- Playback: play/pause, seek, loop, volume/mute, in/out, "when it ends", fade 1 s, Cut/Dissolve.
- Queue integration, Preview/Live readback, panic key, preflight (files found, formats, test-play).
- Stage monitor: time left and next.
- Remote: see live item, Play/Pause the live video, Blank.
- `.born`: references only (no bundles).
- PDF import (via existing `pdfjs-dist`).

**Out of this phase:** conversion, bundles, timers/alerts designer, live inputs, PowerPoint, captions.

**Effort:** L–XL · **Risk:** medium (sync + stability; mitigated by Phase 0). **Dependencies:** S1, S3, S4,
S7, S8. **Test strategy:** see matrix below.

## Phase 2 — "Things that tick and warn"

- **Countdown/timers** (to a time or for a length, per-Destination, "then" action), stage timers.
- **Alerts** with presets and a safety layer; lower thirds with templates.
- QR / giving generator.
- Service-flow cards to the stage.
- Rights notes + "used in" report; stream-safe tag.
- Safe-copy **conversion** (decision from S6) and 1080p proxies.
- API additions (`/media/*`, `/timer/*`, `/alert/*`).

**Effort:** L · **Risk:** low–medium. **Dependencies:** Phase 1; S6.

## Phase 1a follow-up — service pack (moved up from Phase 3)

`.bornpack` (a queue plus its pictures in one shareable file) with a review-then-atomic import, built in the 1a hardening round.
Moved up because Phase 1a already identifies pictures by content hash and has the "find these pictures" review, so it is packaging
what exists; it needs no video, no network and no new screen type; and "the pictures aren't on the booth computer" is the first
real-world failure churches meet. Design: [07-service-pack.md](07-service-pack.md).

## Phase 3 — "Travels well"

- ~~`.bornpack` bundles~~ — **done in the 1a follow-up** (see above); relink review stays.
- Shared-folder media root; phone **Send to booth** Inbox; watch folders.
- PowerPoint via PDF/LibreOffice-if-installed.
- Language variants, per-Channel backgrounds polish.

**Effort:** M–L · **Risk:** medium (file sizes, privacy). **Dependencies:** Phase 1–2; song-import port.

## Phase 4 — "Live pictures"

- Capture card / NDI Virtual Input / window capture as items; IMAG-style fit/crop.
- Multi-room overflow polish, per-room audio device.

**Effort:** M–L · **Risk:** medium–high (hardware variety, permissions). **Dependency:** S5.

## Defer (deliberately)

Native NDI SDK, SRT/RTMP, timeline/cue editor, in-app video editor, cloud storage, web-page items,
live captions engine, social-wall, MIDI. Revisit after Phase 3 with real church feedback.

## Test strategy

| Area | How |
|---|---|
| **Unit** | Media model, queue serialization, `.born` read/write incl. unknown kinds, relink matching, playback state machine, preflight rules |
| **Component** | Library, transport, preflight, failure banners (the existing jsdom pattern) |
| **Long-running playback** | Scripted 60-minute 1080p loop, logging dropped frames, memory growth, position drift; run on the lowest-spec machine; repeated overnight before each release |
| **Multi-screen sync** | Two or three outputs + OBS Browser Source; log difference between reported positions every second; fail the build if > 80 ms for a minute |
| **Failure matrix** | Automated + manual: delete file at Take; kill output window; unplug display; fill disk; rename drive; unplug audio device; bad codec; zero-byte file; very long filename; non-ASCII path |
| **Safety** | Assert that no code path from menu/drop/remote/API changes Live or starts sound (the existing "nothing changes live" tests extended) |
| **Real mouse & keyboard** | The CDP-based real-input harness used in the UI pass, for drag-into-queue and scrub |
| **Accessibility** | Existing contrast test extended to `--ba-media`; keyboard-only run-through |
| **Compat** | v1 opening a media `.born`; v2 opening an old `.born` |
| **By hand** | A written Saturday-night checklist for the owner (like `docs/qa/`) |

## Open questions for the owner, with recommended answers

| # | Question | Recommended answer |
|---|---|---|
| 1 | Is "Media" a new top-level area beside Sermons/Bible/Songs? | **Yes** — same drill-down; new teal colour. |
| 2 | Reference files by default, or copy into a library? | **Reference by default**, with an obvious "copy into library" switch; recommend copy for a dedicated booth PC. |
| 3 | First video format? | **MP4 (H.264 + AAC) only**; friendly message for others; conversion in Phase 2. |
| 4 | Bundle FFmpeg? | **Not in Phase 1.** Decide after S6 and legal advice. |
| 5 | Can the phone start a video? | **Play/Pause the live one only**; no first-play with sound, no seek. |
| 6 | Should alerts play a sound? | **No by default**; optional chime per preset. |
| 7 | Live camera in the first release? | **No** — Phase 4, after a capture-card spike. |
| 8 | PowerPoint? | **PDF first**; "export to PDF" guide; PPTX through LibreOffice only if installed. |
| 9 | What happens to a video's last frame? | **Default "go to next item"** for video; "stay" for slideshow. |
| 10 | Bundle size limit when sharing? | **1 GB** with a visible total; references by default. |
| 11 | Where do motion backgrounds come from? | **Ship ~12 original loops** (we make them) so there is no third-party licence question. |
| 12 | Do we add music/track licensing logic? | **No** — notes and reports only; no legal claims. |
| 13 | Does v1 get any of this? | **No** — v2-only (parity doc records "intentionally different"). |
| 14 | YouTube videos? | **Owner: yes, if possible** — embedded player only; Phase 2a after 1b; see [06](06-youtube.md). |
| 15 | "Link in place" size threshold | **Recommend 2 GB**, always offered below it too. *Open.* |
| 16 | YouTube alerts: re-layout (A) or stage-only (B)? | **A for emergencies, B for routine**; needs counsel. *Open.* |
