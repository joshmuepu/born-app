# Spike 9 — YouTube embedded player inside Born Again

**Question.** Can Born Again show a YouTube video with the official embedded player, controlled and
read back through the documented IFrame API, and what are the traps?

**How tested** (2026-10-15, macOS arm64, Electron 33.4.11 / Chromium 130.0.6723.191, real network).
Harness: `spikes/media/youtube/run.js` (raw output: `spikes/media/results/youtube-*.json`). A test page
creates the official `https://www.youtube.com/embed/<id>` iframe, loads `https://www.youtube.com/iframe_api`,
and logs `onReady`, `onStateChange`, `onError`, `getCurrentTime`, `getDuration`, `getVideoData`.
Test video: a public official music video; others as listed. Nothing was downloaded or modified.

## 1. "Error 153" and the origin — **verified**

The page that hosts the iframe was served six different ways. YouTube's embedded player:

| # | Host page | `Referer` YouTube received | Result |
|---|---|---|---|
| S1 | `file://` (how Born Again's windows load in production) | **none** | **`onError 153`**, `errorCode: embedder.identity.missing.referrer` |
| S2 | `file://` + iframe `referrerpolicy=strict-origin-when-cross-origin` | none | **153** — the common web fix does **not** help on `file://` |
| S3 | `http://127.0.0.1:<port>` + `origin` param | `http://127.0.0.1:<port>/` | **`onError 150`**, `errorCode: auth` — **rejected** even though a Referer was sent |
| S4 | `http://localhost:<port>` + `origin` param | `http://localhost:<port>/` | **Plays** (state 1, duration 213 s, title read back) |
| S5 | `http://127.0.0.1` + `referrerpolicy=no-referrer` | none | 153 |
| S6 | `file://` + **injected** `Referer: https://com.joshmuepu.born.v2dev/` (via `webRequest.onBeforeSendHeaders` on YouTube hosts only) | the injected value | **Plays** |
| S7 | custom scheme `bornapp://` (standard+secure), default | none | 153 |
| S8 | custom scheme + injected Referer (same app-id value) | injected | **Plays** |

**Conclusions (verified for this Electron/YouTube behaviour today):**

1. A plain Electron window **will** fail with 153 — exactly as YouTube's doc says error 153 means
   ("lacks an HTTP Referer header or equivalent API client identification",
   [API reference](https://developers.google.com/youtube/iframe_api_reference)).
2. **Two working designs:** (a) serve the player page from `http://localhost:<port>` (note:
   `127.0.0.1` is **rejected** — a trap), or (b) keep any origin and **inject the Referer** as YouTube's
   own doc instructs for desktop apps ("set the `Referer` by adding it as an HTTP Header",
   [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)).
   YouTube accepted the reverse-DNS app-id form in S6/S8, matching that doc's "domain must be your app ID".
3. **Recommendation:** dedicated player session/partition + Referer header set to the app's registered
   id (b) — it does not depend on a port or hostname. Scope the header rewrite to YouTube hosts only.
4. **Fragility:** this is YouTube's current behaviour; it changed in 2025 and may change again
   ([revision history](https://developers.google.com/youtube/terms/revision-history)). Keep a visible
   "Can't identify the app (153)" state with a fallback (design mockup `16`).

## 2. API control and read-back — **verified**

| Feature | Result |
|---|---|
| `onReady`, `onStateChange` (-1, 3, 1, 0), `getCurrentTime`, `getDuration`, `getVideoData` | Work; played at 1.0 s after load, title/author/duration readable |
| `start` / `end` (`start=20&end=26`) | Played from 20 s and **ended at exactly 26.0 s** with state 0 — honoured |
| `mute()` / `isMuted()` | Works; read back |
| Duration for the test video | 213.06 s (matches the oEmbed/title page) |

## 3. Autoplay and sound — **verified**

Electron's **default** autoplay policy lets media start without a user gesture. With that default,
`autoplay=1` **unmuted** starts **with sound** (F6). With
`autoplayPolicy: 'document-user-activation-required'` set on the player window:

| Config | Result |
|---|---|
| `autoplay=1` **unmuted** | **Blocked**; the API fires `onAutoplayBlocked`; state stays -1 |
| `autoplay=1` **muted** (`mute=1`) | Plays |

→ For "never a surprise sound": **always** pass `mute=1`, and set the strict autoplay policy on the
player window as a second lock. (One of my own tests, X3, was invalid because my test page muted in
`onReady`; X1/X2 above are the valid autoplay results.)

## 4. Error codes in practice — **verified, and different from the docs**

| Case | Documented | Observed |
|---|---|---|
| Well-formed id that doesn't exist (`aaaaaaaaaaa`) | 100 | **150** (`errorCode: auth`) |
| Malformed id (`x`) | 2 | **2** (`api.invalidparam`) |
| A 24/7 live stream whose oEmbed returns 200 | — | **150** from the embed (embedding not allowed for that stream) |
| File origin, no Referer | 153 | **153** |
| 127.0.0.1 origin | — | **150** (`auth`) |

→ **A "removed/private" video and an "embedding disabled" video both arrive as 150.** The UI must say
*"Can't be played here (removed, private, or embedding is turned off)"*, not claim a precise cause.

## 5. oEmbed for pre-checks (no sign-in) — **verified**

| Input | Status | Meaning |
|---|---|---|
| Valid public video | 200 + title, author, thumbnail | Works without any key |
| Nonexistent well-formed id | **400** `Bad Request` (not 404) | Treat 400 as "not found" |
| Malformed id | 400 | |
| The live stream that **cannot be embedded** | **200** | **oEmbed says yes, the player says no** |

→ **oEmbed is a hint, never the verdict.** Preflight must use the player's own `onReady`/`onError`
(a cue-only hidden player) as the authority.

## 6. Failure behaviour — **verified (simulated)**

Simulated with request blocking in the player's session:

| Simulation | What the page saw | Detection needed |
|---|---|---|
| All YouTube/Google hosts blocked (offline/DNS) | `iframe_api` script `error` event at ~7 ms; no player | script-error handler → "Offline" |
| Only the embed page blocked | API loads (`onYouTubeIframeAPIReady`) but **`onReady` never fires**, no error | **Watchdog timer** (e.g. 8 s without `onReady`) |
| Video bytes blocked (`googlevideo.com`) | `onReady` fires, state goes to **3 (buffering) and stays there**, no error | **Buffering watchdog** (e.g. 6 s) |

Network emulation via `session.enableNetworkEmulation({offline:true})` had **no effect** on the embed
(the page still played) — don't rely on it for tests. **Not tested:** region-block, age-restricted,
private-video ids (no known stable test ids; list in "Needs the owner").

## 7. Two windows — **measured, limited**

Two independent embeds of the same video in two windows on one machine, 55 s:

- Constant offset between them: **0.13 s** and **0.57 s** in two runs — equal to how far apart the
  windows happened to start; **no growth over 55 s**.
- So on one fast machine they don't drift *apart*; they simply never start aligned. Over 2–3 hours,
  different networks or ads (below) are expected to change this — **not measured**.

## 8. Ads — **not testable by me; test built for the owner**

- I cannot sign in to a Premium account, and a signed-out run on one video is not representative
  (whether an ad runs depends on the video, region and account). I recorded **no ad**-related claim.
- The IFrame API exposes no documented "ad playing" state ([API reference](https://developers.google.com/youtube/iframe_api_reference)),
  so the app can only notice "playing but time not advancing" — the design uses that wording.
- Google sign-in **page loaded** in a default Electron window (the "Sign in to continue to YouTube"
  form rendered, no up-front block). **Whether sign-in completes, and whether Premium then removes
  embed ads, is unknown**; community reports are mixed
  ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5433522/youtube-premium-still-shows-ads-in-embedded-powerp),
  [HN](https://news.ycombinator.com/item?id=40144199)).
- `spikes/media/youtube/ads.html` + `ads.js` run the test in the same engine, with a persistent
  profile, and log "ad seen / no ad" and stalled-clock events.

## Verdict: **SAFE WITH LIMITS**

Embedding, control and read-back work and are within YouTube's documented rules **provided** the app
identifies itself (Referer = app id). The limits: the 153/150 origin behaviour is YouTube's to change;
error codes can't distinguish removed from embedding-off; ads are outside our control; and the
design must give every item a fallback.

## What it means for the roadmap

1. **Phase 2a (YouTube) stays after 1b** as designed; its first task is the **player session with
   Referer header and `mute=1` + strict autoplay**, exactly as above.
2. Add two **watchdogs** to the design (no `onReady` in 8 s; buffering > 6 s) — both are now
   *observed* failure modes, not guesses.
3. Wording changes: "removed / private / embedding off" are one case.
4. Keep "Test play in Preview" and the fallback per item (already designed).
5. Don't promise ad behaviour; await the owner's Premium run.

## Needs the owner

1. **Ads test A (signed out):** on any computer with the repo, from `spikes/media/`:
   `electron youtube/ads.js` (Windows: `..\..\node_modules\electron\dist\electron.exe youtube\ads.js`).
   Play at least **5 different popular music videos** (the page has an id box; paste ids from YouTube
   URLs). Press **Ad seen** / **No ad** after each. **Copy results** and send back.
2. **Ads test B (Premium):** run `electron youtube/ads.js --premium`, press **Open Google sign-in**,
   try to sign in with the Premium account, close it, then play the *same* 5 videos and record the
   same way. **If Google refuses to let you sign in, copy the message it shows** — that is the result.
3. **Region/private/age cases:** if you know a *private* video link, an *age-restricted* one, and one
   with *embedding turned off*, paste them in the id box and send back the `ERROR` lines.
4. **Church Windows PC:** repeat test A there (corporate/church proxies and DNS filters can change
   the result).
