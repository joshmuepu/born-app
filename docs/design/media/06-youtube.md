# 6. YouTube items

Part of the [media design package](README.md). Written for the owner. **Design only — nothing is built.**
Information, not legal advice. Sources were read on 2026-10-15; anything not confirmed is marked
*unverified*.

## 0. The short version

Born Again can support YouTube videos **if it uses YouTube's own embedded player and nothing else**.
That means: the video plays online, from YouTube, in YouTube's player; Born Again controls it only with
the calls YouTube documents; and Born Again never downloads, saves, converts, restyles, covers or
blocks anything. Because the video is *not* a file we own, a YouTube item behaves like a **guest**
in the queue: clearly labelled *Online*, checked before the service, always given a fallback, and
played on **one** output only.

### Excluded on purpose (YouTube's rules)

These are **not** features of this design and will not be added, because YouTube's terms forbid them:

| Excluded | What YouTube's published rules say |
|---|---|
| **Downloading, caching, saving or "offline" copies** | Developers must not "download, import, backup, cache, or store copies of YouTube audiovisual content without YouTube's prior written approval" and must not "make content available for offline playback" ([Developer Policies, III.E.1](https://developers.google.com/youtube/terms/developer-policies)). The Terms of Service also bar anyone to "access, reproduce, download, distribute, … display" content except through the Service or with written permission ([Terms of Service](https://www.youtube.com/t/terms)). |
| **Ad blocking or hiding ads** | "modify, interfere with, replace, or block advertisements placed or served by YouTube" is prohibited ([III.I.5](https://developers.google.com/youtube/terms/developer-policies)). |
| **Changing, restyling or hiding parts of the player; hiding the branding** | "modify, build upon, or block any portion or functionality of a YouTube player" is prohibited ([III.I.6](https://developers.google.com/youtube/terms/developer-policies)); "You must not make changes to the YouTube player that are not explicitly described by the API documentation" and no overlays, frames or other visual elements in front of any part of the player ([Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)). |
| **Extracting audio only, or playing it unseen** | Separating "the audio or video components" is prohibited ([III.I.7](https://developers.google.com/youtube/terms/developer-policies)); features that play content in a player "not displayed in the page, tab, or screen that the user is viewing" are prohibited ([III.I.9](https://developers.google.com/youtube/terms/developer-policies)). |
| **Scraping or automated access to YouTube pages** | Prohibited "except in the case of public search engines" or with written permission ([Terms of Service](https://www.youtube.com/t/terms)). We use only the embedded player and its documented API, plus the public oEmbed link-preview address (see §1). |
| **Copying the video into a `.born`/bundle file** | Same download/storage rule. Only the video id and times are stored (see §9). |

Where this document says "can't", it means "we chose not to, because of the rules above", not "we
couldn't build it".

## 1. User flow

1. **Paste a link** — in the Media area (**Add → YouTube video**), or in the command palette (`Ctrl/Cmd+K`,
   paste a `youtube.com/watch?v=`, `youtu.be/…` or `youtube.com/live/…` link). Searching YouTube *from
   inside the palette* is **not** designed: it would need the YouTube Data API (a key, quota and extra
   terms). Phase-2 proposal is **paste only**; a search box is listed under *Later*.
2. **Born Again looks it up** without any sign-in, with two public means:
   - **oEmbed**: a public address that returns a title, channel name and thumbnail for a watch link.
     Behaviour for private/embedding-disabled videos is *reported as inconsistent* (some return 401,
     some 404; sources: [WordPress ticket](https://core.trac.wordpress.org/ticket/24712),
     [Ghost forum](https://forum.ghost.org/t/youtube-oembed-fails-on-one-video/21185)) — *unverified
     officially*, so it is a **hint**, not the verdict (spike 9 tests it).
   - **The player itself** (`cueVideoById` in a test player): the documented way to learn the real
     duration (`getDuration()`), and to receive the real error if a video can't be embedded
     (`onError` codes 100, 101, 150, 153 — [IFrame Player API reference](https://developers.google.com/youtube/iframe_api_reference)).
3. **The Add dialog** ([`13-youtube-add`](mockups/png/13-youtube-add.dark.png)) shows the thumbnail,
   title, channel and length, three status chips (*Found · Embedding allowed · Online*) and:
   - **Start at / Stop at** (`start` and `end` player parameters; the player seeks to the nearest
     keyframe, so it may begin up to ~2 s early — [player parameters](https://developers.google.com/youtube/player_parameters)).
   - **Start muted — always on.** (see §2)
   - **Loop — off by default**; YouTube documents looping a single video as "limited support" and
     requires `playlist` to be set to the same id ([player parameters](https://developers.google.com/youtube/player_parameters)).
   - **If this fails on the day, show…** — a fallback from the Media library (§4).
4. **Add to queue** or **Add and stage** (put in Preview). *Nothing starts playing.* The item sits in the
   queue with the same Take/Preview/Live rules as every other item.

Never: autoplay when added, when selected, or when staged. The player is created only on **Take** (or
**Test play**), and `autoplay` is requested only then — and only when the player is visible, as
YouTube requires ("must not initiate an automatic playback until the player is visible", [Required
Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)).

## 2. What the operator sees

([`14-youtube-queue`](mockups/png/14-youtube-queue.dark.png), [`16-youtube-playbar`](mockups/png/16-youtube-playbar.dark.png))

| Element | Design |
|---|---|
| **Online badge** | A blue-ish "Online" chip with a globe, on the queue row, library card, Preview and Live. It uses the existing *Screens* ice colour — **not** red (red is Live) and **not** green (green is OK). Local media never carries it. |
| **Preview is a picture** | The queue's Preview pane is ~170 px wide; YouTube requires a player of **at least 200×200 px** ([Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)). So Preview shows the **thumbnail only**, labelled "Still image only", and **Test play** opens a proper ≥480×270 test player. |
| **Playback bar** | The same bar as local video, but its numbers come only from the player: `getCurrentTime()`, `getDuration()`, and `onStateChange` (−1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued). It never guesses; when the player stops answering it says **"No reply from player"** and keeps the last value, dimmed. |
| **Controls** | Play/Pause, Mute/Sound, Blank. **Seek is available to the booth only**, never the phone. Sound is *muted until the operator turns it on*. |
| **Time left** | Shown on the stage monitor from the player's real time. |
| **Panic / Blank** | `Esc` and the big Blank button **destroy the embed** (remove the iframe) and show black or the logo, instead of "covering" it (covering is an overlay, which YouTube's rules disallow) and instead of waiting for a stalled player to respond. Pressing again *recreates* the player cued at the last known time, **muted, paused**. |
| **Overlays on top** | The Overlay layer (lower thirds, clocks, QR) is **suppressed over a YouTube item**; the Alert layer is handled as in §6. |

## 3. Preflight — the online check

([`15-youtube-preflight`](mockups/png/15-youtube-preflight.dark.png))

For every YouTube item in tonight's queue, preflight runs:

| Check | How | Result shown |
|---|---|---|
| **Network** | Reach YouTube and measure a quick round-trip/throughput | OK / "Offline" / "Slow" |
| **Still exists, public or unlisted, embeddable** | Create a hidden **cue-only** player (`cueVideoById`, no playback) and wait for `onReady` / `onError` | Ok · "Removed or private" (100) · "Embedding off" (101/150) · "Can't identify app" (153) |
| **Live/premiere** | Duration reports as time-since-start for live events ([API reference](https://developers.google.com/youtube/iframe_api_reference)) | "Can't be tested ahead of time" |
| **Can't be verified offline** | No network | Amber: "Can't check — you're offline"; **the item stays in the queue** |
| **Fallback present** | Item has a fallback set | If none: amber "Add a fallback" |
| **Ads notice** | Always, once | "Ads may appear. Test play in Preview, or use your own licensed file" |
| **Test play** | Button opens a visible ≥480×270 test player, **muted**, runs 5 s, reports state | Pass/fail with the error code |

**Fallback plan per item.** Each YouTube item can name one fallback: a library item (image, video, a
countdown card) or "Blank". At Take time, if the player reports an error or doesn't reach *playing*
within a timeout (default 8 s), the operator is shown the fallback as a **one-tap button** — it is
*not* shown automatically (Live is never changed by anything but the operator).

*Honest limit:* a Saturday check cannot promise Sunday: the video may be removed, the network may be
down, or YouTube may change rules. That is why the fallback exists and why the badge says *Online*.

## 4. Ads — what is true, what is not known

What is **verified**:

- YouTube's own help describes Premium as removing ads "before and during a video", framed around
  YouTube's own apps and site ([YouTube Help](https://support.google.com/youtube/answer/6308116)).
- Nothing in YouTube's developer terms promises or addresses ad-free embedded playback; the
  [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
  page has no ad rules at all, and [III.I.5](https://developers.google.com/youtube/terms/developer-policies)
  forbids interfering with them.

What is **reported but not official**:

- A Microsoft support thread says Premium subscribers still see ads in YouTube videos embedded in
  desktop PowerPoint ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5433522/youtube-premium-still-shows-ads-in-embedded-powerp)).
- Forum posts report that ad-free embeds depend on YouTube cookies reaching the embed and on the
  embedding site ([Hacker News thread](https://news.ycombinator.com/item?id=40144199)) — anecdotal,
  mixed, and some posts contradict each other.

What is **unknown** (spike 9 builds a test the owner runs): whether a Premium sign-in persisted in
Born Again's own browser profile suppresses ads in its embeds; and whether Google lets you sign in
inside an Electron window at all (Google restricts sign-in in embedded browsers — *unverified for this app*).

What the app **can ethically do**:

| Do | Don't |
|---|---|
| Tell the operator plainly: "Ads may appear; Born Again can't remove them." | Block, skip, mute-during-ad, or speed through ads |
| **Test play** in Preview so the operator sees what a viewer will see | Detect an ad and hide the player or cover it |
| Offer the licensed file alternative: "Use your own file from the Media library" | Download the video to make that file |
| Let the operator **pre-roll the video on Saturday** (nothing to cache; this only tells them what it looks like) | Keep a copy |
| Show a pre-roll *warning* in preflight | Promise a result |

*The player's `onStateChange` does not distinguish an ad from the video in the documented API*
(unverified; spike 9 checks), so the playback bar may show "playing" during an ad with the real video's
clock stalled. The design shows **"Playing — time not advancing"** after 3 s without progress, which
covers an ad *without* ever claiming to detect one.

## 5. Where it plays — multi-screen

**Recommendation: play on the main output only.**

| Output | What it shows for a YouTube item | Why |
|---|---|---|
| **Main / Congregation** | The real player | The one place that matters |
| **Stage monitor** | Title card + **time left** (from the player's state) + the next item | Keeps the speaker informed without a second decode |
| **Overflow room (a second display of the same Channel)** | A title card ("Video playing in the sanctuary") by default; *optional*: its own player, clearly marked "may drift" | Two independent embeds drift apart and may show different ads |
| **Graphics / OBS** | Title card (transparent lower third "Now playing: …") — never a second player | An OBS Browser Source on another computer would load its **own** player: different network, different ads, no shared clock; also the embedded player requires a visible player ≥200×200 and an app identity |
| **Follow Channels (Spanish)** | Same as Main (title card unless a language variant is set) | Same reason |

Why independent embeds drift: each page runs its own player, buffers on its own network connection and
decodes on its own clock; YouTube provides no shared time source. The design shares **state, not
video**: Main's player is the authority, and others display what Main's player reports.

*Streaming note:* if the church livestreams the service, YouTube video shown on Main would be captured
by the stream's camera/capture, and **streaming it** has separate rights and platform consequences (§10).

## 6. Layers and alerts

YouTube's rule is "no overlays, frames, or other visual elements in front of any part of a YouTube
embedded player" ([Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)).
So for a YouTube item:

- **Overlay layer (lower third, clock, QR): suppressed** on the output that plays it.
- **Alert layer (nursery, emergency): never drawn over the player.** Two options for review —
  A) the output **re-lays-out**: the player is reduced to leave a band, and the alert is drawn in that
  band (layout, not overlay); B) alerts to the **stage monitor and phone** immediately and the booth
  chooses whether to pause/blank. **Recommended: A for emergencies and B for routine alerts.** Whether
  A is acceptable to YouTube is an *interpretation* — **needs the owner's/lawyer's confirmation** and is
  not decided here.

## 7. Failure matrix

| Case | How we find out | What the room sees | What the operator sees | Action offered |
|---|---|---|---|---|
| **Offline** | Network check; player never reaches ready | Unchanged | Amber "No internet" | Show fallback · Retry |
| **Slow network** | `onStateChange` = buffering (3) for > 3 s | Frozen/buffering picture | Amber "Buffering 4 s" | Wait · Fallback · Blank |
| **Video removed or private** | `onError` 100 | Unchanged | Red "Removed or private" | Fallback · Skip |
| **Embedding disabled** | `onError` 101 or 150 | Unchanged | Red "Embedding turned off" | Fallback · Skip |
| **Region-blocked** | Player error or unavailable state *(code mapping unverified)* | Unchanged | Red "Not available here" | Fallback |
| **Age-restricted** | Often requires sign-in; embed shows an error *(unverified)* | Unchanged | Red "Can't play without sign-in" | Fallback |
| **Live stream / premiere** | Duration = time since start; no end | Live content | "Live — no end time" | Treated as manual stop |
| **Invalid link/id** | `onError` 2 | — | "That isn't a valid YouTube link" | Re-paste |
| **HTML5 player error** | `onError` 5 | Frozen/black | Red "Player error 5" | Reload · Fallback |
| **"Error 153" / "player configuration error"** | `onError` 153: "request lacks an HTTP Referer header or equivalent API client identification" ([API reference](https://developers.google.com/youtube/iframe_api_reference)) | Error text in the player | Red "Can't identify the app" + Copy details | Fallback; **this is our bug** |
| **Player stalls / stops answering** | No `onStateChange`/time update for 6 s | Frozen | Red "No reply from player" | Fallback · Reload · Blank (Blank destroys embed) |
| **Window/crash** | Existing window events | Black | Red banner | Reopen · Use another screen |
| **Ads playing** | Not detectable (§4) | An ad | "Playing — time not advancing" | Wait · Blank |

### Error 153, verified

- YouTube documents it: error **153** means "The request lacks an HTTP Referer header or equivalent API
  client identification" ([IFrame API reference](https://developers.google.com/youtube/iframe_api_reference)),
  and API clients "must provide identification through the `HTTP Referer` request header" and must not
  suppress it ([Required Minimum Functionality — API Client Identity and Credentials](https://developers.google.com/youtube/terms/required-minimum-functionality));
  that section was added to the terms on **2025-07-07** ([Revision history](https://developers.google.com/youtube/terms/revision-history)).
- **Why Electron is exposed:** Born Again's windows load from `file://` in production, which has **no
  usable origin/Referer**. Reports from other desktop apps say a `file://` app got this error and was
  fixed by serving the app from a local `http://127.0.0.1` address ([Delibera release note](https://delibera.ethosfera.org/hm/z6Mko5npVz4Bx9Rf4vkRUf2swvb568SDbhLwStaha3HzgrLS/blog/release-2025111)),
  and others fixed it with `referrerpolicy="strict-origin-when-cross-origin"` ([UMich KB](https://teamdynamix.umich.edu/TDClient/30/Portal/KB/Article/14491/Fixing-YouTube-Player-Error-153-with-Referrer-Policy-Settings)).
- **What YouTube asks of desktop apps:** set the Referer header yourself; the domain "must be your app
  ID" (usually reverse-DNS), with `https` as the protocol; use the OS-provided WebView type when available;
  never use `noreferrer`. The page does not mention Electron ([Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)).
- **Design consequence:** the YouTube player must live in a **page served from a known origin** (the
  app's existing local HTTP server is the natural home) and the app must **identify itself** as YouTube
  asks. *How* (which origin, which Referer value, where to set it) is spike 9's job and the design does
  not depend on a particular choice.

## 8. Remote and automation

Consistent with the rest of media:

| Allowed | Not allowed |
|---|---|
| See what's live (title + state + time left) | Start a YouTube item **with sound** |
| **Play / Pause** the live YouTube item | Seek |
| **Blank / Show** | Change the item, its times or its fallback |
| `GET /state` includes `{ kind:'youtube', videoId, state, position, duration, online:true }` | Add a link from the phone *(not in this phase)* |

`POST /api/v1/automation/media/play|pause` apply to a live YouTube item exactly as to local media.

## 9. Portability — in a shared `.born`

A YouTube item is stored as **an id and a few settings, never video**:

```
{ "kind":"youtube", "id":"item-…", "videoId":"dQw4w9WgXcQ", "title":"How Great Is Our God",
  "start":12, "end":210, "muted":true, "loop":false,
  "fallback": { "mediaId":"m_9f2c…", "name":"Mission Trip — Kenya.mp4" },
  "slides":[ { "text":"YouTube: How Great Is Our God (needs a newer Born Again)" } ] }
```

- **Metadata freshness:** YouTube requires stored API data to be deleted or refreshed after 30 days
  ([III.E.4](https://developers.google.com/youtube/terms/developer-policies)). The title is a *display
  hint* and is re-read when the item is opened or preflighted; thumbnails are **not** stored in the file.
- **Sharing is safe:** a file with only ids is not "copying content" and has no size.
- **Older BORN:** an unknown `kind` is exactly the compatibility question of spike 8. The design
  includes the one-line `slides[]` text so that **an older version that renders `slides` shows readable
  text, not a crash**; whether older versions skip safely is *unverified* until spike 8 runs.
- **Fallback** travels as a reference (`mediaId`); missing at the receiver means "no fallback" and a
  preflight amber.

## 10. Rights and terms — for the January commercialization checklist

*Information, not legal advice. Keep this section in the media docs; nothing here belongs in
`docs/commercial`.*

**A. YouTube's rules for a product that embeds the player**

| Topic | What the sources say | Implication |
|---|---|---|
| The embedded player is allowed for showing videos | "You may also show YouTube videos through the embeddable YouTube player." ([Terms of Service](https://www.youtube.com/t/terms)) | The basic use is permitted |
| It is *personal, non-commercial* by default | "You may view or listen to Content for your personal, non-commercial use." ([Terms of Service](https://www.youtube.com/t/terms)) | Whether a *church service* is "personal, non-commercial" is a **question for counsel** — see B |
| Selling a product that uses the API | Developer Policies list "Selling an API Client" as permitted ([III.G.2.a](https://developers.google.com/youtube/terms/developer-policies)) | Selling Born Again with the embed is not itself prohibited |
| But you must not sell ads/sponsorship on or in YouTube content, nor redistribute it | [III.G.1](https://developers.google.com/youtube/terms/developer-policies) | Never put sponsorship over YouTube items; never bundle videos |
| Using the IFrame Player API makes you an "API Client" bound by the API Services Terms | [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) | A commercial product must follow these terms; they change (latest entries May/June 2026 per the [revision history](https://developers.google.com/youtube/terms/revision-history)) |
| Required items for API clients such as privacy-policy links and attribution | *Recalled; not re-verified here* | **Verify** against the current terms before release |
| Identity | Referer/app ID rules since 2025-07-07 | Must be solved and tested (spike 9) |
| Metadata retention | 30 days | Refresh or delete |
| Don't obscure attribution | "must not interfere with or obscure any attribution" ([search summary of the policy](https://developers.google.com/youtube/terms/required-minimum-functionality)) | Never hide the player's UI |

**B. Public performance in a church (separate from YouTube's terms)**

- **Copyright is separate from YouTube's terms.** Church guidance says playing a YouTube video in
  worship generally needs permission from the copyright owner, and that official-channel videos or
  those marked for church use are more acceptable; lyric videos and music may need rights holder
  consent ([Church Visuals](https://churchvisuals.com/article/can-i-legally-show-youtube-videos-at-church/),
  [MediaShout](https://mediashout.com/showing-youtube-videos-in-church-2021/),
  [GCFA](https://www.gcfa.org/resource/9-common-church-copyright-myths)). These are advocacy/vendor
  sources — **not legal authority**.
- A **Church Video License** covers certain studio films and clips, not every uploaded clip; a
  streaming licence does not cover everything either ([CCLI](https://support-ccli-us.helpscoutdocs.com/article/1505-does-our-ccli-streamingstreaming-plus-license-permit-us-to-include-all-types-of-copyrighted-content-in-our-online-services)).
- **What the app can do (information only):** a **rights note** field on each YouTube item, a reminder
  "check permission for public showing", and *no* claim that anything is cleared.

**C. For counsel (questions, not answers)**

1. Is a congregational showing "personal, non-commercial" under the Terms, and does the embedded-player
   permission cover it?
2. Do the API Services Terms require anything extra for a *paid* desktop product (terms/privacy links,
   an audit, a compliance form)?
3. Is re-laying-out the player to make room for an alert (§6A) acceptable?
4. Is showing the **thumbnail** (a `ytimg.com` image) on other outputs acceptable metadata use?

## 11. Where it lands in the roadmap

**After local video (1b), as Phase 2a — and only if spike 9 passes.** Reasons:

1. It depends on the same **playback bar, Preview/Live readback, panic and preflight** as local video;
   building it first would build those twice.
2. It is the **riskiest** media type: it needs the network, a third party's policies and an app
   identity. Local video is a bounded technical problem; YouTube is partly outside our control.
3. It benefits from the **fallback** design (a local video to fall back to), so the library must exist.
4. Terms and ads questions (§4, §10) need answers *before* we promise it publicly.

Rough size: **M** (1–2 weeks) after 1b, including the origin/identity work and the preflight additions.
See [05-roadmap.md](05-roadmap.md).

## 12. Mockups

| Screen | Mockup |
|---|---|
| Paste a link, with result states | [13-youtube-add](mockups/png/13-youtube-add.dark.png) · [html](mockups/13-youtube-add.html) |
| YouTube item in the queue (Online badge) | [14-youtube-queue](mockups/png/14-youtube-queue.dark.png) · [html](mockups/14-youtube-queue.html) |
| Preflight with online warnings | [15-youtube-preflight](mockups/png/15-youtube-preflight.dark.png) · [html](mockups/15-youtube-preflight.html) |
| Playback bar, states and failures | [16-youtube-playbar](mockups/png/16-youtube-playbar.dark.png) · [html](mockups/16-youtube-playbar.html) |
