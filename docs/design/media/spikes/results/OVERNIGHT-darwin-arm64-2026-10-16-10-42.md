# Overnight media spikes — darwin-arm64

Started 2026-10-16T10:42:08.428Z · finished 2026-10-16T13:32:59.842Z
Machine: Apple M4 Max · 14 cores · 36 GB · OS 25.6.0


## Verdicts

| Test | Result | Key numbers |
|---|---|---|
| Sync, free-running (15 min) | INFO (info) | p95 773.7 ms · max 815.8 ms · growth 44.7,31.9 ms/min |
| Sync, corrected (15 min) | **PASS** | p95 46 ms (limit 80) · max 81.8 ms (limit 150) · seeks 0 |
| Soak 1080p30 (120.1 min, 2 windows) | **PASS** | stalls 0 · worst dropped 0% · memory slope 10 MB/h · CPU 1.7% |
| Soak 4K30 (20 min) | **WARN** | stalls 0 · worst dropped 0% · memory slope 21.8 MB/h · CPU 0.8% |

## Thresholds used

| Measure | PASS | WARN | FAIL |
|---|---|---|---|
| Stalls (playback stopped ≥ 2 samples) | 0 | ≤ 3 | more |
| Dropped frames (worst window) | ≤ 0.1% | ≤ 0.5% | more |
| Memory growth (renderers + GPU) | ≤ 20 MB/h | ≤ 60 MB/h | more |
| CPU (all Born Again processes) | ≤ 100% of one core (1080p) / 150% (4K) | above | — |
| Sync corrected: p95 / max drift | ≤ 80 ms / ≤ 150 ms | p95 ≤ 150 ms | more |

## Steps

| Step | Exit | Seconds |
|---|---|---|
| make h264-1080p30-30s.mp4 | ok | 31 |
| make h264-4k30-10s.mp4 | ok | 10 |
| sync free-running | ok | 902 |
| sync corrected | ok | 902 |
| soak 1080p30 | ok | 7205 |
| soak 4K30 | ok | 1201 |

Full numbers: `OVERNIGHT-darwin-arm64-2026-10-16-10-42.json` and the `OVERNIGHT-darwin-arm64-2026-10-16-10-42-raw/` folder. Progress log: `OVERNIGHT-darwin-arm64-2026-10-16-10-42.log`.