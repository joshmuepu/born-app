# Media spikes — results

Throwaway experiments (code in `spikes/media/`, **not** part of the app). Branch `v2-media-spikes`.
Run on the dev Mac (Apple M4 Max, macOS 26, Electron 33.4.11) on 2026-10-15. **That is a very fast
machine: every "safe" below is a best case until the church PC repeats it.**

## Verdicts

| # | Spike | Verdict | Final? | One line |
|---|---|---|---|---|
| 1 | [Long-run stability](1-long-run-stability.md) | **1080p: safe** (2 h, 0 stalls, 0 dropped, memory flat after warm-up). **4K: safe with limits** (20 min clean; memory WARN on a run too short to judge) | run 2026-10-16, under load, M4 Max | Best-case hardware; repeat a longer 4K soak and a 1080p one on the church PC |
| 2 | [Codecs / compatibility](2-codec-compatibility.md) | **Safe** on Apple-silicon Mac; **unknown** on Windows | Mac final; Windows by hand | H.264/HEVC/VP9/AV1/MKV/MOV play; **ProRes does not**; a truncated file passes a play test |
| 3 | [Multi-screen sync](3-multi-screen-sync.md) | **Safe.** Free-running drifts 0.5–0.8 s / 15 min when one window plays sound; **corrected: p95 46 ms, max 82 ms, 0 jumps** | run 2026-10-16, under load, M4 Max | Live must be authoritative; the correction works |
| 4 | [Serving to OBS](4-serving-to-obs.md) | **Safe with limits** | Chromium final; **OBS needs a 5-min test** | Range serving works; OBS's embedded browser untested |
| 5 | [Live inputs](5-live-inputs.md) | **Safe with limits — needs hardware** | pending camera test | Enumeration/permissions work; no card measured |
| 6 | [Conversion & licensing](6-conversion-licensing.md) | **Safe with limits** | **final** | No FFmpeg in phase 1; Chromium can transcode at 1× real time; counsel questions listed |
| 7 | [Real-world files](7-real-world-files.md) | **Safe with limits** | Mac stand-ins final; real phone files by hand | messages drafted; HDR-HEVC/rotation unknown |
| 8 | [`.born` compatibility](8-born-file-compat.md) | **Not safe as designed → safe with the fix** | **final** | Today an unknown item kind **crashes the queue** (v1 too); "compat shell" fixes it |
| 9 | [YouTube](9-youtube.md) | **Safe with limits** | embed/control final; **ads need the owner** | 153 on `file://`; works with `Referer = app id`; 150 for both "removed" and "embedding off" |

## Recommendation: Phase 1a vs 1b (updated)

- **Phase 1a proceeds as approved**, with one **new first task**: the `.born` type cleanup and
  compat-shell writer/reader (spike 8). It is cheap and removes a real crash that exists in v1 and v2
  today. Also consider a **v1 hotfix** (two-line fallback) — owner's decision.
- **Phase 1b is conditional** on tonight's run (spikes 1 and 3). Design change already warranted by
  data: **"main output owns the clock; every other output follows"** (not "everyone plays freely").
  If the *corrected* run fails the thresholds, video plays on the main output only and other outputs
  show a still + time left.
- **Preflight gets two additions from spike 2:** a real decode (not `canPlayType`) and a
  played-length/size check (truncated files).
- **YouTube (2a)** is unchanged in position; its first task is the player session with Referer = app
  id, `mute=1` and a strict autoplay policy, plus two watchdogs (no `onReady` in 8 s; buffering > 6 s).
- **No FFmpeg** — confirmed; a Chromium-based "safe copy" is the Phase-2 path.

## What depends on tonight's results

| Result | Decides |
|---|---|
| Soak 1080p PASS/WARN/FAIL | whether looping motion backgrounds are in 1b, 1b-with-caveat, or Phase 2 |
| Soak 4K | whether 4K is "supported" or "works, with a warning" |
| Sync corrected PASS/FAIL | whether secondary outputs play video or show a still + timer |
| (church PC) the same on Windows | whether any of the above holds on the real hardware |

## Owner's by-hand list (in order of value)

1. **Tonight (Mac or church PC): the overnight run** — [RUN-TONIGHT.md](RUN-TONIGHT.md). Send the
   `OVERNIGHT-*.md`, `.json` and `.log`.
2. **Church Windows PC — compatibility table** (2 min): [spike 2, "By hand"](2-codec-compatibility.md#by-hand-church-windows-pc--2-minutes).
   Include 2–3 of the church's own videos.
3. **YouTube ads test, signed out and with Premium** (15 min): [spike 9, "Needs the owner"](9-youtube.md#needs-the-owner).
   `electron youtube/ads.js` and `electron youtube/ads.js --premium`; if Google refuses sign-in, send
   the message it shows. Do it on the church PC too.
4. **Camera / capture-card test** (5 min, with the hardware plugged in): [spike 5](5-live-inputs.md#needs-the-owner).
5. **OBS browser-source test** (5 min): [spike 4](4-serving-to-obs.md#needs-the-owner-5-minutes).
6. **Real phone / PowerPoint / screen-recording files:** [spike 7](7-real-world-files.md#by-hand--please-send-me-real-files).

## Repeatable tools

| Tool | Where | Purpose |
|---|---|---|
| Overnight runner | `spikes/media/overnight.js`, `run-overnight.bat`, `run-overnight.command` | spikes 1 and 3 |
| Compatibility test | `spikes/media/compat/` | spikes 2, 7 |
| YouTube harness / ads test | `spikes/media/youtube/` | spike 9 |
| Server + OBS test page | `spikes/media/tools/serve.js`, `obs-test/` | spike 4 |
| Capture test | `spikes/media/capture/` | spike 5 |
| `.born` compat test | `spikes/media/tools/born-compat.spike.tsx` (run: `node node_modules/vitest/vitest.mjs run --config spikes/media/vitest.spike.config.mts`) | spike 8 |
| Converter test | `spikes/media/tools/convert-test.js` | spike 6 |

Raw measured data: [results/measured-2026-10-15/](results/measured-2026-10-15/).
