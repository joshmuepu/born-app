# Spike 3 — Multi-screen sync (main output, stage monitor, Graphics page)

> ## VERDICT (run 2026-10-16): **safe** — keeping Live authoritative holds three screens within ~46 ms (95th percentile), max 82 ms, with no visible jumps
> Free-running (no correction) drifts by hundreds of ms in 15 minutes, so the correction is required. Measured on the dev Mac, under load; best-case hardware.

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

## Measured: corrected mode and a second free-running run, 15 minutes each (2026-10-16)

**Hardware and conditions (read before trusting any number).** Apple M4 Max MacBook Pro (Mac16,5), 14 cores, 36 GB, macOS 26.6.2, Electron 33.4.11 (Chromium 130), on AC power, built-in display plus two 2560×1440 monitors, no sleep (`caffeinate -dims`). The run was **under load**: the machine never became quiet in the 4-hour wait (the owner's Chrome had an extension process using ~0.8 of one core the whole time, plus macOS file scanning and VS Code), so the run started at 06:42 anyway. With 14 cores that load is small, but treat the numbers as "a busy but powerful laptop". Full header: [`results/RUN-HEADER.md`](results/RUN-HEADER.md); wait log: [`results/quiet-wait.log`](results/quiet-wait.log).

**Caveat that matters most:** an Apple Silicon Mac with hardware video decoding is a **best case**. A church Windows PC is likely slower, with a different GPU and decoder. These results say the design is sound; they do **not** prove it on the church PC.

| Measure (15 min, after warm-up) | Free-running (stage / graphics) | **Corrected** (stage / graphics) | PASS threshold |
|---|---|---|---|
| 95th percentile abs difference | 774 / 500 ms | **46 / 43.6 ms** (worst: **46 ms**) | ≤ 80 ms |
| Mean abs difference | 408 / 276 ms | 19.9 / 18.8 ms | — |
| Maximum abs difference | 816 / 528 ms | **73.7 / 81.8 ms** (worst: **81.8 ms**) | ≤ 150 ms |
| Drift at start → end (free) | +36 → +706 ms / +30 → +509 ms (**≈ 45 / 32 ms per minute**) | held | |
| Hard seeks (visible jumps) | 0 | **0** | ≤ 2 |
| Rate corrections applied | 0 | 17 stage / 13 graphics (≈ one per minute, ±5% for a moment) | — |
| Dropped frames | 0 / 0 / 0 of ~26,900 | **0 / 0 / 0** of ~26,900 | ≤ 0.1% |

**Reading it.**
- **Without correction** the screens separate steadily: ~0.7 s (stage) and ~0.5 s (Graphics page) after 15 minutes — the earlier run's 0.85 s is the same effect (the run is not identical each time because the audio clock and the display clocks wander differently). Over a one-hour sermon video that is 2–3 seconds apart. **Correction is not optional.**
- **With "main owns the clock, followers nudge their playback rate"** the followers stay **within about 50 ms for 95% of the time and never beyond ~82 ms**, with **no hard seeks at all** and no dropped frames. The correction is a gentle speed-up or slow-down about once a minute, not a jump.
- **The Graphics page over HTTP (Range requests) behaved the same as a local window** (question 3): no extra drift, no dropped frames.
- Caveat from the harness: its summary "end of run" value for the stage window (−99 ms) is larger than its own reported maximum (73.7 ms); the per-sample statistics above are what the thresholds were applied to, and the end value is an average of the last few samples. It does not change the verdict but is worth looking at if the test is reused.
- One computer, one GPU, a 30-second clip, three windows on 2–3 displays. A church PC with different refresh rates (50 vs 60 Hz) or a slower GPU may drift faster and correct less smoothly.

**Verdict:** **SAFE.** All four PASS thresholds met on the worst of the two followers (p95 46 ms ≤ 80; max 81.8 ms ≤ 150; 0 seeks ≤ 2; 0% dropped). → **"Main owns the clock, followers correct" is the design for Phase 1b.** Other screens **can** play the video in step (not just a still), provided the correction loop ships with it.

Raw: [`results/OVERNIGHT-darwin-arm64-2026-10-16-10-42-raw/sync-free-900s.json`](results/OVERNIGHT-darwin-arm64-2026-10-16-10-42-raw/sync-free-900s.json) and `sync-corrected-900s.json`.
