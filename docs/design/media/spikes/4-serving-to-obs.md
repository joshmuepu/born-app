# Spike 4 — Serving media to OBS / the Graphics browser destination

**Question.** Can a Graphics-style browser page, possibly on *another computer* running OBS, play media
served by Born Again? What breaks?

**How tested** (2026-10-15, macOS, Electron 33.4.11 / Chromium 130):

1. A small Node HTTP server with `Range` support (`spikes/media/tools/serve.js`) bound to `0.0.0.0`,
   serving the clips and a test page.
2. A Chromium window loaded the page from the machine's **LAN address** (`http://10.0.0.124:4399/…`),
   i.e. a different origin from the app, as an OBS or second computer would.
3. `curl` against the LAN address for throughput, range-seek latency, parallel streams and path
   traversal.
4. Read how the existing server is wired (`src/main/webRemote.ts`).

**Not tested:** a second physical computer, real Wi-Fi, and **OBS itself** (OBS's embedded browser is a
different Chromium build — see "Needs the owner"). Loopback to the LAN address measures server
overhead, not network speed.

## Measured

| Check | Result |
|---|---|
| Chromium page from `http://<LAN-IP>:4399` playing H.264 720p / 1080p+AAC / 4K, HEVC, VP9, VP8, AV1 | **All 7 played**, `t=2.8 s` in a 2.8 s window, dropped frames 0–1 per ~88 (VP9: 10/87) |
| Same-machine Graphics window over `http://127.0.0.1` (spike 3) | 2,654 frames, 0 dropped, 90 s |
| Server: 27 MB file, full download over LAN address | 0.028 s (≈ 1 GB/s — loopback, so not meaningful as network speed) |
| Server: 20 × 1 MB range requests | mean 1.7 ms, max 2.2 ms |
| Server: 3 parallel full downloads | each 0.027 s |
| Path traversal (`/../../package.json`) | 404 — blocked |
| Existing app server | `server.listen(port)` → all interfaces; CORS `*`; **no auth** on Graphics/remote routes; no media route and no `Range` handling exists today |

## What the network must carry (arithmetic, not measured)

A 1080p30 H.264 file at ~8 Mbit/s needs ~1 MB/s per viewer; a 4K file at ~20 Mbit/s ~2.5 MB/s. A
church's Wi-Fi is normally fine for one or two such streams; several 4K streams over weak Wi-Fi are
not. **Wired is strongly preferred** for the OBS machine.

## Verdict: **SAFE WITH LIMITS**

- **Same computer, or another computer on the LAN, in a Chromium browser/page: safe.** Range serving
  works and is cheap.
- **OBS Browser Source: unknown until tested.** OBS embeds CEF; community reports say some builds
  don't play H.264 `<video>` ([OBS forum](https://obsproject.com/forum/threads/osx-catalina-streamoverlay-loop-video-elements-wont-play-in-obs-as-browser-source.119874/post-464832),
  [Flathub thread](https://discourse.flathub.org/t/obs-studio-30-1-video-format-not-supported/6393)) —
  anecdotal, **unverified**. The test page `spikes/media/obs-test/index.html` answers it in 30 seconds.

## What it means for the roadmap

1. Phase 1b needs a **media route** on the app's HTTP server: `Range`, correct MIME, `Cache-Control`,
   a random per-file token in the URL (not guessable ids), and a refusal to serve outside the library.
2. Because the server is open on the LAN, media URLs must **not** be listable and the existing
   "Require a token" setting should extend to media.
3. Design for the Graphics output to **prefer a still/lower-third** and treat full video in OBS as an
   opt-in "Video on Graphics" switch until the OBS test passes. Fallback if OBS can't play H.264:
   provide a **VP9/WebM or VP8** rendition *(needs Phase 2 conversion)* or capture the main output with
   OBS's window/NDI capture instead.

## Needs the owner (5 minutes)

On the computer that runs OBS (or any computer, to start):

1. On the Born Again computer, from the repo root: `node spikes/media/tools/serve.js 4399`
   (or `electron spikes/media/tools/serve.js` with ELECTRON_RUN_AS_NODE=1). It prints a URL like
   `http://192.168.1.23:4399/obs-test/index.html`.
2. In **OBS → Sources → + → Browser**, paste that URL, width 1920, height 1080, OK.
3. Look at the seven rows; **send back a screenshot or the "RESULTS" text** at the bottom of the page.
4. Repeat with the OBS computer on **Wi-Fi** and on **wired** if both are possible, and note the OBS
   version (Help → About).
