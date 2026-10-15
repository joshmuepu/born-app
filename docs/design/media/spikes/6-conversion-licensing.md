# Spike 6 — Conversion and licensing (FFmpeg and alternatives)

*Information, not legal advice.* Question: what would **bundling or calling FFmpeg** mean, and what
are the alternatives for turning "can't play this" files into something playable?

## What was verified

**FFmpeg's own legal page** ([ffmpeg.org/legal](https://ffmpeg.org/legal.html), read 2026-10-15):

- FFmpeg is **LGPL 2.1+**, but "optional parts are under GPL 2 or later. If those parts get used the
  GPL applies to all of FFmpeg." It is "not available under any other licensing terms, especially not
  proprietary/commercial ones".
- To stay LGPL: compile **without** `--enable-gpl` and `--enable-nonfree`; the page names **libx264**
  as a GPL library to avoid.
- LGPL obligations when distributing: link **dynamically**; ship FFmpeg's **source** matching the
  binaries; provide your changes and the configure line; host the source next to the binary; credit
  FFmpeg in the About box/EULA; don't forbid reverse engineering in your EULA.
- **Patents:** "We do not know, we are not lawyers" — commercial products carry more risk, since
  patent owners "will come after their licensing fees"; MPEG LA is cited as especially active.

**H.264 patent licensing** ([Via LA — AVC/H.264](https://www.via-la.com/licensing-2/avc-h%20264/)): the
patent pool is now administered by Via Licensing Alliance; it describes per-unit fees for products
that include an encoder/decoder, with the first tier at $0 and higher tiers above 100,000 units. I did
**not** retrieve the current full schedule; older figures found are superseded. **Whether and how
this applies to Born Again (which already ships Chromium's decoders inside Electron, and would add an
*encoder*) is a question for counsel.**

## What was measured — two "no-FFmpeg" converters (dev Mac, 2026-10-15)

### A. Chromium itself (play → re-record as H.264 MP4)

`spikes/media/tools/convert-test.js` plays a file in a hidden window and records it with
`MediaRecorder` to `video/mp4; avc1 + aac`:

| Source | Result | Speed |
|---|---|---|
| HEVC 1080p30 MP4 (3.9 s) | converted, 366 KB | **0.93× real time** |
| HEVC 4K30 MP4 (4.1 s) | converted, 1.8 MB | **1.02× real time** |
| VP9 1080p30 WebM | converted | ~real time |
| H.264 720p MKV | converted | ~real time |

- Works for **anything Chromium can decode** (HEVC, VP9, AV1, MKV-H.264 …) and needs **no extra
  software or licence beyond what Electron ships** *(licensing of the encoder inside Chromium is the
  same question for counsel)*.
- **Limits found:** runs at **1× real time** (a 4-minute video takes 4 minutes); output is *fragmented*
  MP4; **audio was lost** in this test because the source element was muted (needs an
  un-muted-at-volume-0 source — fixable, not yet re-tested); bitrate/quality control is coarse; it
  **cannot read formats Chromium can't decode** (ProRes).

### B. The operating system's converter (macOS `avconvert`, AVFoundation)

| Conversion | Result |
|---|---|
| H.264 → HEVC MP4 / MOV, H.264 → ProRes | worked (seconds) |
| **ProRes 422 .mov → H.264 MP4** (the format Chromium can't read) | **worked**, 0.57 MB |

- Fast, high quality, hardware-accelerated; handles ProRes. **macOS only.** The Windows equivalent
  (Media Foundation transcoding) was **not tested** *(unverified)*.

## Options compared

| Option | Plays ProRes? | Speed | Licence/legal | Install burden | Verdict |
|---|---|---|---|---|---|
| **Don't convert; show a clear message + "how to export MP4"** | — | — | none | none | **Phase 1** (decided) |
| **Chromium re-record (A)** | no | 1× real time | same as Electron | none | **Good Phase-2 "safe copy"** for HEVC/VP9/AV1/MKV |
| **OS converter (B)** | yes (mac) | fast | OS-provided | none (mac) | Optional helper on macOS |
| **Bundle FFmpeg (LGPL build, no x264)** | yes | fast | LGPL checklist above; **H.264 *encoding* needs another encoder** (x264 is GPL); patents unresolved | +~30–80 MB *(estimate)* | **Not recommended** without counsel |
| **Detect a user-installed FFmpeg/HandBrake** | yes | fast | not our distribution | user installs | **Acceptable "advanced" fallback** |
| **Ask the user to convert** (HandBrake, phone settings) | yes | — | none | user | **Always shown** |

## Verdict: **FINAL — SAFE WITH LIMITS**

- **No FFmpeg bundling in phase 1 — confirmed.** There is a working, zero-dependency alternative (A)
  for everything except ProRes, and ProRes is rare in churches.
- **Do not bundle FFmpeg until counsel has answered:** (1) LGPL build without x264 — is the available
  encoder acceptable and sufficient? (2) H.264 patent exposure for an *encoder* in a paid product.

## What it means for the roadmap

Phase 2 "safe copy": implement conversion via approach **A**, run in the background with a progress
bar and **a time estimate** ("about 4 minutes"), keeping the original untouched. Fix the audio-track
issue first (prototype < 1 day). ProRes/other: message + instructions.

## Owner questions

1. Ask counsel the two questions above before any FFmpeg talk.
2. Are churches in your market likely to have ProRes? (If not, A is enough.)
