# BORN v2 + OBS — live test report

Branch `v2-obs-live` (from the v2-channels tip c45371d). Not merged. Mac only; **nothing here was run on Windows**.

## Environment
| | |
|---|---|
| Computer | MacBook Pro, Apple M4 Max, macOS 26.6.2 |
| OBS Studio | 32.2.2 (obs-websocket 5.7.4, obs-browser 2.26.9, **CEF 127.0.6533.120**), OpenGL on Metal, browser hardware acceleration ON |
| BORN | v2 dev build 2.0.0-dev.1 (this branch), Electron 33 / **Chromium 130** |
| OBS profile | separate profile + collection **"BORN-Test"**, 1920×1080 @ 30; websocket on a random port with a random password (deleted at the end) |
| Test content | public-domain "Amazing Grace" and KJV verses; own generated picture and H.264/AAC video; one public YouTube video (name card only is shown in OBS) |

OBS had to be started through macOS `open -a` (starting its binary directly left the browser engine without helper processes, so no browser source drew anything).

## Matrix
Latency numbers are from polling OBS source screenshots (about 40 ms resolution); recordings were also decoded to check real pixels.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Scripture lower third | **Pass** (after 3 fixes) | Verse visible ~50 ms after BORN shows it; ~490 ms when sent from the phone remote (includes the phone → app hop); fades out in ~310 ms. Long verse wraps to 4 lines inside the panel. 10-tap next/prev burst settles on exactly the slide BORN reports (pixel-identical to projecting that slide directly, stable 2.5 s later). |
| 2 | Lyrics full-screen and lower third, motion background, navigation, Preview/Live | **Pass** (after fix) | Moving background loop visible in OBS (7,567 pixels changed per second). Verse/chorus navigation 0→3. BORN's live read-back agrees with the output. Lower third shows 2 lines per page and cycles. |
| 3 | Announcement picture, queue advance, panic | **Pass / partly unverified** | Picture fills the frame at once. Blank clears the room window and the OBS output (~310 ms) and un-blank brings it back. **Esc and Ctrl/Cmd+Shift+L pressed on a real keyboard could not be sent** (macOS Accessibility); the clear function they call was exercised through BORN's own IPC. Undo of queue edits is a queue feature, not an output one, and was not re-run here. |
| 4 | Local video clip | **Pass** | Follower in real OBS (CEF 127): **mean offset −35 ms, worst 100 ms** over 40 sampled pairs (screenshot pairs are not simultaneous, so ±50 ms of this is measurement). After the scene was hidden 12 s and shown again: ~−237 ms behind, converging at the designed ±5% rate (still −200 ms after 3 s; inside the 40–500 ms band, so no still frame). A leader seek is followed within ~0.5 s. The page's video is muted. |
| 5 | YouTube | **Pass** | Full-screen layout shows "YouTube · name · Playing on the main screen"; lower third shows nothing; the room plays the real YouTube video (position advanced 3.5 s in 4 s, muted); no player in OBS. Supported alternative (window capture of BORN's output) **not tested**: needs Screen Recording permission. |
| 6 | Alerts | **Pass** | Alert shows on the room screen during lyrics and during local video; never over YouTube (withheld, stage gets it); never in the OBS output. |
| 7 | Two channels/destinations | **Pass** | Second channel set to follow Main with its own lower-third Graphics output: it showed the verse in its own layout (opaque 9.4 %); clearing that channel did not touch Main. (A hand-made test Bible item without a structured source did not re-resolve on the follower; real queue items do — covered by existing tests.) The new `?profile=` makes a second channel unnecessary for "lower third on the stream, full-screen lyrics on the stream". |
| 8 | Phone remote | **Pass** | Emulated phone (Chrome, iPhone user agent) loaded `http://born-remote-v2.local:4399/` (the real mDNS name resolved), showed "Connected"; Next/Prev taps and Blank/Show drove OBS correctly while live. WebKit itself was not run (no Playwright on this Mac). |
| 9 | Resilience | **Pass** (after fixes) | See below. |
| 10 | Performance | **Pass** | See below. |
| 11 | Edge cases | **Pass** (after 3 fixes) | See below. |
| 12 | Windows | Not run | Owner list below. |

### Resilience numbers
| Case | Before | After |
|---|---|---|
| BORN quit and relaunched, OBS source used a `.local` name | recovered **71.7 s** after BORN's port came back | **3.7 s** with the address made of numbers or `127.0.0.1`; **2.7–4.5 s** in the final runs |
| Stale verse while BORN is down | stayed forever | held for blips, **cleared after 10 s** |
| Red "RECONNECTING…" text | drawn into the stream | not drawn inside OBS (`window.obsstudio`) |
| Connection dies silently (a proxy stopped forwarding, nothing closed) | no recovery until the OS gave up | page restarts itself after **45 s** of silence; measured recovery **46 s** |
| Idle connection | no keep-alive | BORN sends a `ping` event every **15 s** (measured 48 s → 03 s → 18 s) |
| Port in use | — | BORN logs "port already in use — remote disabled" and keeps running; the Screens panel says "Remote unavailable right now" |
| BORN started after OBS | — | covered by the restart runs (the page reconnects when BORN appears; HTTP 404 while starting is retried) |
| OBS quit and relaunched while BORN keeps running | — | OBS back and websocket up in ~1 s, the live verse on the overlay **1.5 s** after relaunch, no manual refresh |
| Network interface change, sleep/wake | not tested | covered only by the silent-death proxy test; **owner list** |

Scene-switch reveal time (BORN verse live, OBS scene switched): **shutdown OFF: 19–47 ms** either with or without "refresh when active"; **shutdown ON: 0.6–0.9 s**. Chosen: shutdown OFF, refresh OFF.

### Performance (OBS recording 1080p30 x264 to disk, M4 Max)
| Scene | Time | OBS skipped (render/output) | OBS CPU (api) | all OBS processes | all BORN processes |
|---|---|---|---|---|---|
| Baseline: "Starting soon", no BORN overlay | 150 s | 0 / 0 | 3.3 % | ~43 % of one core | ~11 % of one core, 0.6 GB |
| Video clip playing (BORN leader + OBS follower) | 150 s | 0 / 0 | 3.3 % | ~50 % | ~19 %, 0.7 GB |
| Lyrics on the lower third over camera | 60 s | 0 / 0 | 3.2 % | ~42 % | ~12 % |

**No dropped or skipped frames in 360 s.** GPU use was not measured (needs sudo `powermetrics`). The brief asked for 5-minute samples; 150 s + 150 s + 60 s were run.

### Layout and edge cases
| Case | Result |
|---|---|
| Canvas 1280×720, 1920×1080, 3840×2160, 1080p60 (and the source's own 60 fps setting) | Panel at the same relative place (left 6 %, right 94 %, bottom gap 6.1 %) once each BORN source is stretched to the canvas (the imported scenes do this). |
| 4:3 (1440×1080) and vertical 9:16 (1080×1920) | Panel inside the picture, 6 % margins, no clipping. |
| BORN theme dark / light / high-contrast | Overlay pixel-identical: the app theme does not leak into the Graphics page. |
| Emoji, Chinese, Arabic, Hebrew | All render. **Arabic and Hebrew were left-aligned — fixed** (now right-aligned per line). |
| 120-character unbroken word | Ran past the panel — **fixed** (wraps). |
| Very long verse | Panel grows to about a quarter of the picture; **now capped at ~52 % of the height**. |
| Readability over a bright background | **Bug:** panel over white video measured **129/255** in a real recording (OBS blends in linear light): white text 3.9:1, reference line 2.5:1. **Fixed:** panel opacity 0.78 → 0.92; measured **80/255** in a recording (white text ≈ 8:1). Over black ≥ 20:1. Text also raised from ~27 px to ~35 px and the reference line from ~14 px to ~17 px on a 1080p stream. |
| Browser source "custom FPS" 60 | No difference. |
| Hardware acceleration on/off | **Not tested** (a global OBS setting that needs a restart; left alone on purpose). |

## Bugs found and fixed (each a separate commit, with tests)
1. **Empty dark bar over the camera at idle** — the lower-third panel kept its background and padding when nothing was live (also behind pictures/videos). Page now hides the panel.
2. **Backgrounds never showed on a Graphics output** — the full-screen panel is an opaque black backdrop above the background layers. Still and moving backgrounds now show through.
3. **Resilience:** no keep-alive and no way to notice a dead connection; a 404 while BORN was starting killed the feed for good. Added a 15 s `ping`, a 45 s silence watchdog, and an automatic retry; stale frame clears after 10 s; no red text inside OBS.
4. **72 s recovery with a `.local` name** — OBS's browser caches the failed name lookup. The Screens panel now also offers an **"OBS on this computer" address (`127.0.0.1`)**, which recovers in seconds; the manual explains it.
5. **One Graphics output could only have one layout.** New, optional **`?profile=lower-third|fullscreen`** on the page address picks the layout per OBS source (own pagination per layout; a page with no ending behaves exactly as before). The Graphics URL scheme, API and file format are otherwise unchanged.
6. **Right-to-left text, long words, long verses** (above).
7. **Unreadable over bright video** (above).

Tests: **1291 → 1306 passed** (15 new, in `webRemoteGraphics.test.ts`), 1 skipped, typecheck and production build clean. Automated tests cannot see OBS; the matrix above is the live proof.

## What a v1 check found
v1 (v1.13.1) has **no Graphics output at all**, so none of these bugs exist there. No v1 hand-off note is needed.

## Open issues / larger changes (not done)
- A read-only list of Graphics outputs in the automation API would let a script (and Companion) find the URL without the UI. Not added.
- The reference line is still small for a phone screen; the lower third is a single text style. A "large text" lower-third profile could be added later.
- A Graphics page cannot play the sound of a video (by design); the sound path needs OBS application-audio capture (see manual).
- OBS **window capture of BORN's output** is the only way to put a YouTube video into the stream; untested here.

## Not verified / owner by-hand list
1. **Windows (OBS + BORN):** import BORN-scenes.json, paste the URL, check the overlay, the scene-switch speed, a BORN restart (note whether `.local` names work without Bonjour), 1080p30 and the performance on the church PC.
2. **Sound into the stream:** Mac *application audio capture* (and the Screen Recording prompt) or a loopback device; Windows *Application Audio Capture* of the BORN window. Check the OBS audio meter with a clip.
3. **YouTube into the stream** with window capture (Mac Screen Recording prompt; Windows Window Capture), if wanted.
4. **Esc and Ctrl/Cmd+Shift+L on a real keyboard** clear the stream output as well as the room.
5. **A real livestream platform** (this test never streamed): start a private/unlisted stream with the overlay for a few minutes.
6. **Church network:** OBS on a second computer using the address made of numbers; unplug/replug the cable and Wi-Fi; a laptop sleeping and waking while the overlay is up.
7. Hardware acceleration off in OBS (Advanced) — check the overlay still draws.
8. A **phone (real iPhone/Android)** driving BORN while OBS is live.

## Decisions I made without asking
- **Separate OBS profile and collection "BORN-Test"**, websocket by command-line flags (so nothing was written to the owner's websocket settings). OBS's global.ini/user.ini, the owner's profile and collection and an old crash marker were backed up and restored; a stale "crash detected" marker from the owner's last session had to be moved aside for OBS to start unattended, then put back.
- Added `?profile=` rather than recommending two channels, because songs never follow another channel, so a "follower" channel cannot carry lyrics.
- Recommended **shutdown OFF, refresh OFF**; "refresh on active" costs a visible flash for no gain now that the page reconnects itself.
- Raised lower-third text size and panel opacity from measured evidence (real recording); alternative was a text shadow.
- Recommended the **same-computer address** for OBS on the BORN computer; kept the `.local` address as the default for other computers (it is stable across IP changes) but documented its slow recovery.
- Kept the exported **BORN-scenes.json portable**: browser sources, colour and text only. Mac-only audio/window-capture sources are added by hand (they would show as "missing" on Windows).
- Screenshots: 7 small JPEGs of my own test content in `docs/manual/obs/`, copied to `docs/manual/v2/images/` so the in-app Help can show them.
- 150 s + 150 s + 60 s performance samples instead of one 5-minute run per case.
