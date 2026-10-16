# Phase 1b gates — resolved from the overnight run (2026-10-16)

Decisions the long-run spikes were meant to settle, with the numbers behind them. Machine: Apple M4 Max, run under load; **best-case hardware** — see the caveat in
[spike 1](1-long-run-stability.md) and [spike 3](3-multi-screen-sync.md). The same text is in `docs/design/media/05-roadmap.md` on the media branches.

| Gate | Decision | Why (numbers) |
|---|---|---|
| **Looping motion backgrounds in 1b?** | **In 1b, with a caveat.** | 1080p30 H.264 looped for 2 hours in two windows: 0 stalls, 0 dropped frames, memory flat after warm-up (291 → 316 MB, then +2 MB/h), 1.7% CPU. Caveat: not yet seen on a church-class PC; ship with the preflight check and a "test on this computer" note, and repeat the soak on the church PC before the first video release. |
| **4K** | **Supported with a warning**, not capped, not promised. | 4K30 looped 20 minutes: 0 stalls, 0 dropped, 0.8% CPU, GPU 72 MB. Memory fit 21.8 MB/h (WARN) but only +6 MB in 20 minutes — a run that short can't separate warm-up from growth. Show "Very large video (4K): may play poorly on this computer" in preflight and offer a 1080p copy later (Phase 2 conversion). |
| **Do other screens play video or show a still?** | **They play it, in step.** | With main owning the clock and followers nudging their rate ±5%: p95 46 ms, max 82 ms, 0 hard seeks, 0 dropped frames over 15 minutes, on a local window and on the Graphics page over HTTP. Without it they drift 32–45 ms per minute. Fallback if the correction is ever off or a follower falls out of range (> 500 ms): that screen shows the **still frame and the time remaining** (the rule YouTube items already use). |

## Limits the app should enforce (recommended)

| Limit | Value | Basis |
|---|---|---|
| Largest accepted video | **3840×2160 (4K)**, 30 fps; warn above 1080p | Soaked at 1080p (2 h) and 4K (20 min), both at 30 fps |
| Frame rate | **≤ 30 fps verified.** 60 fps accepted but flagged "not soaked" | No 60 fps soak was run |
| Bitrate | **Warn above 20 Mbit/s** (1080p) / **40 Mbit/s** (4K); refuse nothing | Soaked files were ~2 Mbit/s (1080p) and ~6 Mbit/s (4K); real files at 20–50 Mbit/s decode harder and were **not** tested |
| Codec | H.264 (+ AAC) only in 1b | Spike 2 |
| Loop length | **No limit needed** for a looping clip | 239 loops of a 30 s clip over 2 h showed no accumulation; keep a preflight check that long clips are tested once |
| Screens playing the same video | Up to **3 windows** verified; apply the correction to every follower | Spike 3 used 3 windows |
| Correction thresholds | Nudge ±5% when 40–500 ms out; hard seek only beyond 500 ms; log every seek | As tested: 17 and 13 nudges in 15 min, no seeks |

## Not measured (do these before relying on the gates)

A Windows church PC (the result that matters), a slower or older laptop, thermal behaviour on any other machine, 60 fps and high-bitrate real-world files, HEVC, a real projector, and a 4K run longer than 20 minutes.
