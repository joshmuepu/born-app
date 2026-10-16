# Spike 7 — Compatibility of real-world files

**Question.** What do phone videos, PowerPoint exports and screen recordings do in Born Again, and
what is the clearest message when they fail?

**Honest scope.** I do **not** have real iPhone or Android files or a PowerPoint install. I tested
**faithful stand-ins** produced on this Mac, so these are *predictions to confirm*, not final facts.

## Stand-ins and results (dev Mac, 2026-10-15)

| Real-world file | Stand-in I tested | Result | Confidence |
|---|---|---|---|
| iPhone video (.MOV, HEVC) | HEVC 1080p in .mov, HEVC 4K .mp4 | **Plays**, hardware decode | Medium — real iPhone files are often **10-bit HDR (HLG)**, which I could not produce |
| iPhone "Most Compatible" setting (.MOV, H.264) | H.264 in .mov | **Plays** | Medium |
| Android video (.mp4, H.264 or HEVC) | H.264 and HEVC MP4 | **Plays** | Medium |
| Phone video held upright | 1080×1920 H.264 | **Plays**, pillarboxed | Medium; real files use **rotation metadata** — not tested |
| PowerPoint "Create a video" (.mp4, H.264+AAC) | H.264 + AAC MP4 | **Plays** | High for the codec; the *file* wasn't from PowerPoint |
| Screen recording (macOS QuickTime/`screencapture` .mov) | a real 3-second capture of this Mac's screen at 3456×2234 | **Plays**, 0 dropped | **High** — this one was genuinely produced by the OS tool |
| Screen recording from Windows Game Bar (.mp4 H.264) | H.264 MP4 | Expected to play | Low-medium |
| Editor export, ProRes (.mov) | Apple ProRes 422 | **Fails — no supported streams** | High |
| Old camcorder/DVD formats (.avi/.mpg/.wmv/.3gp) | not tested | Expected **fail** (canPlayType "no") | Low |
| Half-copied file (cloud sync unfinished) | truncated .mp4 | **Plays then stops early** | High |
| Empty / renamed / audio-only file | 0-byte, text, m4a-as-mp4 | **Fail** (see messages) | High |

## The clearest messages (proposed copy; map from what the engine reports)

| What happened | Engine says | Show the operator |
|---|---|---|
| Format not supported (ProRes, AVI, WMV…) | error 4 / no supported streams | **"Born Again can't play this kind of video. Export it as MP4 (H.264) and add it again."** + *How* link |
| File damaged or empty | error 4 / format error / 0 bytes | **"This file is damaged or empty. Copy it again from the original."** |
| Not a video | could not open | **"This isn't a video file."** |
| Audio only inside a video file | no picture | **"This file has sound but no picture."** (offer as audio) |
| Plays but ends early | played length < reported length | **"This file looks incomplete (cut off at 0:03 of 0:04). Copy it again."** |
| HEVC fails on this PC | decode error / stuck | **"This computer can't play this phone-style (HEVC) video. Export as MP4 (H.264) or set your phone to 'Most Compatible'."** |
| Very large / 4K on a 1080p screen | size check | **"Large file — a 1080p copy will play more smoothly."** |
| Vertical video | width < height | **"This video is vertical; it will show with black bars."** |

## Verdict: **SAFE WITH LIMITS — final for the Mac stand-ins, pending real files**

Nothing here argues against the Phase 1b plan. The two real surprises are the **truncated file that
looks fine** and the **real-file unknowns (HDR HEVC, rotation metadata)**.

## By hand — please send me real files

Send (or just run through the compat tool's drop box, [spike 2](2-codec-compatibility.md)) **one of each**:

1. A video from an **iPhone** (default settings) and one from the "Most Compatible" setting.
2. A video from an **Android** phone.
3. A **PowerPoint → "Create a video"** export (and the same deck as PDF, for Phase 1a PDF import).
4. A **screen recording** from the church PC.
5. Any **sermon/announcement video** the church already has, especially the biggest one.

The tool prints a pass/fail line per file; paste that back. You don't need to send the files themselves.
