# Spike 3 — Multi-screen sync (main output, stage monitor, Graphics page)

> ## PARTLY MEASURED, PARTLY PENDING
> Free-running drift is **measured** (below). The **corrected** run (does keeping Live authoritative
> hold the screens together?) needs tonight's run: [RUN-TONIGHT.md](RUN-TONIGHT.md).

**Questions**

1. If three windows play the same video with nothing keeping them together, **how far apart do they
   drift**, and how fast?
2. With the **main process owning the clock** and followers nudging themselves, **how close do they
   stay** over 15 minutes? How many hard seeks (visible jumps) does it cost?
3. Does the **Graphics page served over HTTP** behave differently from a local window?

**How it measures** (`spikes/media/tools/sync-test.js`): one 30-second clip, looped, in three windows:
*main* (plays with sound at 2% volume — so its audio device drives the clock), *stage* (muted),
*graphics* (muted, loaded from `http://127.0.0.1` with Range requests). Each window records, for one
frame in 15, the frame's **presentation time** via `requestVideoFrameCallback`. After a 10 s warm-up the
positions of *stage* and *graphics* are compared to *main* at the same instants. In the corrected mode,
the followers read *main*'s position once per second and adjust playback rate ±5% for small errors
(>40 ms) or seek for large ones (>500 ms).

## Measured: free-running, 15 minutes (dev Mac, 2026-10-15)

| | Stage window | Graphics (HTTP) window |
|---|---|---|
| Mean absolute difference from main | 439 ms | 443 ms |
| 95th percentile | 819 ms | 846 ms |
| Maximum | 868 ms | 889 ms |
| Difference at start → at end | **+23 ms → +849 ms** | **+19 ms → +876 ms** |
| Frames played in 900 s (main / stage / graphics) | 26,905 / 26,931 / 26,931 | |
| Dropped frames | 0 / 0 / 0 | |

**Reading it.** The window that was playing **sound ran slower** than the silent ones by about
0.1% — 26 frames, **~0.9 s over 15 minutes**, growing steadily (≈ 55 ms per minute). That is the
sound card's clock and the computer's clock disagreeing, the classic cause of lip-sync drift. The
two silent windows stayed together with each other (equal frame counts).

An earlier 90-second run with **everything muted** showed only ±6 ms mean (max 25 ms) — so drift
appears when **one window is driven by audio and the others are not**, which is exactly the church
case (the main output has sound).

Over a 60-minute sermon video this would grow to **~3.5 seconds** if left alone.

**Interim finding (verified for this machine):** *without* correction, the screens **will** be
visibly out of step within minutes whenever one of them plays sound. Keeping Live authoritative is not
optional.

## Pending: corrected mode

**Pass / fail thresholds**

| Measure (stage and graphics, 15 min, after warm-up) | PASS | WARN | FAIL |
|---|---|---|---|
| 95th percentile absolute difference | ≤ 80 ms | ≤ 150 ms | > 150 ms |
| Maximum absolute difference | ≤ 150 ms | — | above |
| Hard seeks (visible jumps) | ≤ 2 in 15 min | — | more |
| Dropped frames | ≤ 0.1% | ≤ 0.5% | more |

**What the verdict will decide.** PASS → "main owns the clock, followers correct" is the design for
Phase 1b. FAIL → video plays on the main output only; other outputs show a still and the time left
(the same rule YouTube items already use).

**Verdict:** _free-running: measured (drift is real); corrected: pending._

**Limits to remember.** One computer, one GPU, three windows on two/three displays: results on the
church PC (different GPU, different refresh rates, possibly Windows) may differ.
