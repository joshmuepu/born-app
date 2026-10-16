# Spike 1 — Long-run stability of video playback

> ## VERDICT (run 2026-10-16): 1080p — **safe**; 4K — **safe with limits** (WARN on a too-short run)
> Measured on the dev Mac, under load; best-case hardware. Details below.

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

**Hardware and conditions (read before trusting any number).** Apple M4 Max MacBook Pro (Mac16,5), 14 cores, 36 GB, macOS 26.6.2, Electron 33.4.11 (Chromium 130), on AC power, built-in display plus two 2560×1440 monitors, no sleep (`caffeinate -dims`). The run was **under load**: the machine never became quiet in the 4-hour wait (the owner's Chrome had an extension process using ~0.8 of one core the whole time, plus macOS file scanning and VS Code), so the run started at 06:42 anyway. With 14 cores that load is small, but treat the numbers as "a busy but powerful laptop". Full header: [`results/RUN-HEADER.md`](results/RUN-HEADER.md); wait log: [`results/quiet-wait.log`](results/quiet-wait.log).

**Caveat that matters most:** an Apple Silicon Mac with hardware video decoding is a **best case**. A church Windows PC is likely slower, with a different GPU and decoder. These results say the design is sound; they do **not** prove it on the church PC.

## Results (run 2026-10-16, 06:42–09:33 local; raw: [`results/OVERNIGHT-darwin-arm64-2026-10-16-10-42-raw/`](results/OVERNIGHT-darwin-arm64-2026-10-16-10-42-raw/))

| Measure | 1080p30, 2 windows, **120.1 min** | threshold | 4K30, 1 window, **20 min** | threshold |
|---|---|---|---|---|
| Stalls | **0** | 0 = PASS | **0** | 0 = PASS |
| Dropped frames (worst window) | **0 of 215,694** (0%) | ≤ 0.1% | **0 of 36,002** (0%) | ≤ 0.1% |
| Loops completed | 239 each window | — | 120 | — |
| Video errors / early exit | none | none | none | none |
| Memory growth, renderers + GPU (fit after first 5 min) | **10.0 MB/h** → PASS | ≤ 20 | **21.8 MB/h** → **WARN** | ≤ 20 (WARN ≤ 60) |
| CPU, all Born Again processes | **1.7%** of one core (max 1.9%) | ≤ 100% | **0.8%** (max 0.9%) | ≤ 150% |
| Sampling gaps | none (720 samples, every 10 s) | | none (120 samples) | |

Memory over time ([chart](results/soak-memory.svg)):

| | 5 min | 20 min | 30 min | 60 min | 90 min | 120 min |
|---|---|---|---|---|---|---|
| 1080p renderers (MB) | 291 | 301 | 313 | 314 | 315 | 316 |
| 1080p GPU process (MB) | 75 | 75 | 77 | 77 | 77 | 77 |
| 1080p main process (MB) | 140 | 141 | 143 | 147 | 147 | 147 |
| 4K renderer (MB), GPU 72 | 126 | 132 (at 20 min: 132) | | | | |

**Reading it.**
- **1080p looped for 2 hours with no stall, no dropped frame and no error.** The "10 MB/hour" figure is a start-up effect: the renderers grew **291 → 313 MB in the first 30 minutes, then stayed flat** (**2.2 MB/h** fitted over the last 90 minutes; the GPU process grew 2 MB in total). That is warm-up, not a leak.
- **4K looped for 20 minutes with the same clean result**, using less than 1% of a core and 72 MB in the GPU process (the Mac's hardware decoder does the work). The WARN is a threshold artefact: the renderer went 126 → 132 MB (**+6 MB in 20 minutes**), which the straight-line fit turns into 21.8 MB/h. **A 20-minute run cannot tell warm-up from growth** — the 1080p run grew 22 MB in its first half hour and then stopped — so 4K long-run behaviour is **not proven**, only "no sign of trouble".
- **Not observable here:** thermal throttling (CPU use was ~1%, so none is expected, but it was not sampled); audio/video sync inside a single window (sync is spike 3); 60 fps, high-bitrate or HEVC files.
- **Test files were light:** 1080p at ~2 Mbit/s and 4K at ~6 Mbit/s, 30 fps, H.264 (made by the runner). Real phone/camera files at 20–50 Mbit/s and 60 fps decode harder; they were **not** soaked.

**Verdict:** **1080p30 H.264 looping: SAFE** (on this hardware). **4K30: SAFE WITH LIMITS** — no failure of any kind, but the memory threshold was exceeded on a run too short to judge; support it with a preflight warning and re-run a longer 4K soak (60+ min) on the church PC before promising it.

**What it decides:** PASS for 1080p → Phase 1b may include looping motion backgrounds as designed, **with a caveat** until it has been repeated on a church-class PC (see the resolved gates in the roadmap).
