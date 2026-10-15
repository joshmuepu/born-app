# Spike 1 — Long-run stability of video playback

> ## PENDING: runs tonight
> Needs a 2-hour run. Command and steps: [RUN-TONIGHT.md](RUN-TONIGHT.md). **No verdict yet.**

**Questions it will answer**

1. Does a 1080p30 H.264 loop, shown in two windows (main output + Graphics-style page) for **2 hours**,
   ever **stall** (playback stops moving)?
2. Does it **drop frames**? How many, as a percentage?
3. Does **memory grow** over time in the renderers or GPU process (a leak)? How fast, in MB/hour?
4. How much **CPU** does it use (all Born Again processes together)?
5. Does a **4K30** H.264 loop hold up for 20 minutes on the same machine?

**How it measures** (`spikes/media/tools/soak.js`): every 10 s it records per-process CPU and
working-set memory from Electron's `app.getAppMetrics()`; each video window reports dropped/total
frames, a stall counter (position unchanged for 2 consecutive samples), loop count and JS heap.
Memory growth is a straight-line fit over the run **after** a 5-minute start-up allowance.

**Pass / fail thresholds** (decided now, before seeing numbers)

| Measure | PASS | WARN | FAIL |
|---|---|---|---|
| Stalls (2 h, both windows) | 0 | 1–3 | more than 3 |
| Dropped frames, worst window | ≤ 0.1% | ≤ 0.5% | > 0.5% |
| Memory growth, renderers + GPU | ≤ 20 MB/hour | ≤ 60 MB/hour | > 60 MB/hour |
| CPU, 1080p (all processes) | ≤ 100% of one core | above | — |
| CPU, 4K | ≤ 150% of one core | above | — |
| Errors / early exit | none | — | any |

**What the verdict will decide.** PASS → Phase 1b can include looping video (motion backgrounds) as
designed. WARN → ship with a "long loop" caveat and a preflight warning. FAIL → motion backgrounds
move to Phase 2 and video items are limited to short clips until the cause is fixed.

**What is already known (not a verdict).** The pipeline works end to end: a 24-second smoke run on
the dev Mac (M4 Max) showed 0 stalls, 0 dropped frames, ~1% CPU. That says nothing about a 2-hour run
or about a low-end PC. **This Mac is the best case**; the church PC result matters more.

**Verdict:** _pending_
