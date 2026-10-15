# YouTube spike (throwaway)

Run from `spikes/media/` with the repo's Electron (see `../README.md`):

| Command | What it does |
|---|---|
| `electron youtube embed` | Origin / Referer matrix (file://, http://127.0.0.1, http://localhost, custom scheme, injected Referer). Writes `results/youtube-embed-*.json` |
| `electron youtube features [--policy=default]` | Invalid ids, start/end, live stream, autoplay, offline, two windows, oEmbed, Google sign-in page |
| `electron youtube/ads.js` | **Owner-run**: ads test in this app's embedded player; add `--premium` for run B (signed-in) |

`ads.js` and `ads-preload.js` are standalone: `electron youtube/ads.js`.
