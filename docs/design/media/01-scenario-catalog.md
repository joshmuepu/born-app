# 1. Scenario catalog — everything a church might project

Written for the owner. Part of the [media design package](README.md).

**How to read this.** Each row is one thing a church might put on a screen. *How often* is a judgement
for a typical church of 50–500 people (weekly / monthly / seasonal / rare) — it comes from general
knowledge of church workflows and from the feature lists of the products in [02](02-state-of-the-art.md),
not from a survey, so treat it as informed opinion. *Priority* is for **a church of 50–500**:

- **Must** — a church would call the app unfinished without it.
- **Should** — most churches will want it within a few months.
- **Nice** — real value for some churches; safe to wait.

*Who* is the person at the controls: **Booth** (the operator at the computer), **Leader** (worship
leader/pastor with a phone), **Prep** (someone building the service during the week), **Staff**
(office/children's/youth).

Already in Born Again v2 today: scripture, songs, sermon quotes, a one-line **Message** (stage/main/both,
10 s), Hide/Show screen, Preview/Live, Channels, Graphics output (full-screen or lower-third), stage
monitor. Everything else below is new.

---

## A. Before the service (the "pre-service" moment)

| Item | What it is | How often | Who | What it needs from the software | Priority & reason |
|---|---|---|---|---|---|
| Pre-service loop | Looping slides/photos/announcements while people arrive | Weekly | Booth, Prep | Image slideshow with timed advance, loop, optional music; start by one key | **Must** — every church does it; today there is no way |
| Countdown to start | Big clock to "service begins" (9:30) | Weekly | Booth | Timer to a clock time or a length; show on main + stage; "when zero → go next" | **Must** — the single most common non-text item |
| Countdown video | A designed countdown clip (5:00) | Weekly at many churches | Booth | Play a video file; show remaining time on stage | **Must** (as plain video) — covered by video playback |
| Welcome slide | "Welcome — scan to connect" with logo | Weekly | Prep | Image or designed slide + QR | **Must** — an image is enough |
| Announcement slides | 3–8 slides of upcoming events | Weekly | Prep, Staff | Image set, reorder, advance manually or timed | **Must** |
| Announcement video | A recorded announcement by the pastor | Weekly–monthly | Staff | Video, sound on, ends then next | **Should** |
| Ambient music + visuals | Playlist of music under a still/motion background | Weekly | Booth | Audio playback, volume, fade, background | **Should** |
| Seating / room signs | "Nursery full — use Room 2" | Rare | Booth | One-off text (exists as Message) | **Nice** |
| Stream "starting soon" | Same as loop but on Graphics/stream output | Weekly if streaming | Booth | Per-Destination content (Graphics only) | **Should** — only if church streams |

## B. Worship and the Word

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| Scripture, songs, sermon | Done in v2 | Weekly | Booth | — | Done |
| Still background behind text | A picture behind lyrics/verses | Weekly | Prep | Background library; text stays readable (dim) | **Must** — nearly every church |
| Motion background | Soft looping video behind lyrics | Weekly at many churches | Prep | Loop video under text, no sound, low CPU | **Should** — high visual payoff; heavier technically |
| Song intro video / lyric video | Video of a song with words baked in | Monthly | Booth | Video with sound | **Should** |
| Sermon illustration clip | 30–90 s film/clip | Weekly–monthly | Booth, Prep | Video, audio, start/stop points, trim | **Must** |
| Sermon outline / fill-in-the-blank | Points appearing one by one | Weekly | Prep | Text slides in queue (v2 has text) | **Should** — mostly text, partly new |
| Sermon slides from the speaker | Guest's PowerPoint/Keynote | Monthly | Prep | Import & show; see section I | **Must** — guests always arrive with slides |
| Liturgy / responsive reading | Leader line / people line | Weekly in liturgical churches | Prep | Text slides with two styles; saved templates | **Should** |
| Creed, prayers, Lord's Prayer | Fixed texts reused weekly | Weekly in some | Prep | Saved reusable text items | **Should** |
| Communion / Lord's Supper | Quiet visual + scripture + music | Monthly | Booth | Still/motion background, text | **Should** |
| Baptism | Names + video of testimony; live camera | Seasonal | Booth | Video, lower third, camera | **Should** |
| Altar call / response | Song words + a calm background | Weekly at some | Booth | Backgrounds | covered |
| Benediction / closing slide | "Go in peace" + next steps | Weekly | Booth | Image/text | **Must** |

## C. Pictures and slideshows

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| Single image | A photo or graphic | Weekly | Booth | Fit/fill, safe margins, blank | **Must** |
| Photo slideshow | Event photos, baby dedications | Monthly | Prep | Ordered set, manual or timed, captions | **Must** |
| Memorial / tribute slideshow | Photos with music, 5–10 min | Rare but high stakes | Prep | Slideshow + music track, can't fail; fade | **Should** — emotionally critical, so reliability matters most |
| Baby dedication / member intro | Name card + photo | Monthly | Prep | Photo + caption/lower third | **Should** |
| Ministry highlights / "Meet the team" | Photos with names | Monthly | Staff | Slideshow with captions | **Nice** |
| Mission/offering graphics | Fundraising thermometer, thanks | Seasonal | Staff | Image | **Nice** |
| Scripture memory art | Verse as designed image | Weekly kids | Staff | Image | **Nice** |

## D. Video and audio

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| Testimony video | 2–5 min recorded story | Monthly | Booth | Video, sound, then-next | **Must** |
| Mission / ministry video | 3–5 min | Monthly | Booth | Same | **Must** |
| Special-event video (baptism, Christmas) | 3–8 min | Seasonal | Booth | Same; larger files | **Must** |
| Motion loop (stage) | Looping animation | Weekly at some | Booth | Loop, mute, per-Destination | **Should** |
| Audio-only track | Backing track, offertory music, prayer music | Weekly | Booth | Audio device choice, fade, volume, no surprise sound | **Should** — churches that use tracks use them every week |
| Audio with a visual | Track + still/lyrics | Weekly | Booth | Pair track with a background | **Should** |
| Sound effects / stingers | Short audio cues | Rare | Booth | One-key trigger | **Nice** |
| Video with end-then action | Play, then go next/black | Weekly | Booth | "When it ends" setting | **Must** — avoids a frozen last frame |
| Video with start/stop points | Skip the intro, end early | Weekly | Prep | In/out points (trim, no re-encode) | **Should** |
| Chapters/markers | Jump inside a long video | Rare | Booth | Markers | **Nice** |
| Streaming a web video (YouTube) | Playing online video | Occasional | Booth | Web item; **licence/ads/offline risk** | **Nice** — see risks; downloading files is the safer path |

## E. Live inputs

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| IMAG | Live camera of the speaker on the big screen | Weekly at bigger churches | Camera operator + Booth | Capture-card / NDI input shown as an item; low latency | **Should** for 200–500; **Nice** under 150 |
| Live feed from another room | Choir room, nursery, overflow | Occasional | Booth | Same input type | **Nice** |
| Remote speaker / video call | Zoom/Teams guest on screen | Occasional | Booth | Window/NDI capture of the call | **Should** — post-2020 churches expect it |
| Phone as camera | Use a phone via NDI/virtual camera | Occasional | Staff | NDI/webcam source | **Nice** |
| Stream program feed on a screen | Show the livestream in the lobby | Weekly at some | Booth | Browser/Graphics page on another computer (works today) | covered |
| Screen share of another computer | Guest laptop on the projector | Occasional | Booth | NDI Screen Capture or HDMI input | **Nice** |

## F. Overlays, alerts, and operations

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| Lower third (name/title) | "Pastor Daniel — Senior Pastor" | Weekly (streaming) | Booth | Template, one-tap show, auto-hide | **Should** |
| Offering / giving prompt + QR | "Give at …" with a QR | Weekly | Booth, Prep | QR generator, safe margins | **Must** — also a trust/safety item (wrong link) |
| Sign-up / connect-card prompt | "Fill in the card / scan" | Weekly | Prep | QR + text | **Should** |
| Prayer requests | List of names or topics (privacy!) | Weekly at some | Booth | Text list, **never saved with shareable queue by default** | **Should** |
| Alerts: nursery | "Parents of #14" | Weekly | Booth | One-tap preset, auto-clear, never over a video's audio | **Must** |
| Alerts: security/emergency/weather | "Shelter in place", "Move your car" | Rare, critical | Booth, Staff | Highest layer, overrides everything, big text, optional audio chime off by default | **Must** — a safety feature |
| Service-flow cards (stage) | "5 min", "Wrap up", "Stop" to the speaker | Weekly | Booth, Leader | Stage-only messages with presets | **Must** — talked about by every stage-display product |
| Stage/confidence monitor | Clock, next slide, timers, notes | Weekly | Booth | Existing stage window plus media timing | **Must** (extend what exists) |
| Segment timer | "Sermon: 28:00 left" | Weekly | Leader | Count-down/up per item shown on stage | **Should** |
| Live captions | Real-time text of speech | Rare–growing | Booth | Text feed in a lower-third; **no engine promised** | **Nice** |
| Translation / interpretation | A second language line | Weekly at multilingual churches | Booth | Channels (exists); text/ audio interpreter | **Should** — v2's Channels already target this |
| Sign-language interpreter | Camera or inset | Rare | Booth | Live input in a corner | **Nice** |

## G. Documents, web and guests

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| PDF | Bulletin, guest handout, order of service | Monthly | Prep | Page-by-page as slides | **Should** |
| PowerPoint (.pptx) | Guest speaker slides | Monthly | Prep | Import to pictures; warn on animations | **Must** |
| Keynote (.key) / Google Slides | Same | Occasional | Prep | Ask the sender to export PDF/PPTX; no direct import | **Should** (via PDF) |
| Web page / dashboard | A live web page on screen | Rare | Booth | Web item in an embedded browser; sandbox | **Nice** |
| Polls / quizzes / trivia | Online poll results on screen | Occasional (youth) | Staff | Web item or image | **Nice** |
| Social-media wall | Live posts | Rare | Booth | Web item | **Nice** — moderation risk |

## H. Ministries and special services

| Item | What | How often | Who | Needs | Priority & reason |
|---|---|---|---|---|---|
| Children's church | Bible-story video, songs with motion, games, timers | Weekly | Staff | Separate Channel/room, simple operator mode, loud/quiet safe | **Should** |
| Youth | Games, countdown timers, poll results, bumper videos | Weekly | Staff | Timer, video, web item | **Should** |
| Small groups / Sunday school | Study slides, video | Weekly | Staff | Import PPTX/PDF | **Should** |
| Wedding | Names, vows text, photo slideshow, music | Occasional | Prep | Slideshow + audio | **Nice** |
| Funeral / memorial | Tribute slideshow, hymn words, photo of the person | Occasional | Prep | Same; **fail-safe** | **Should** — high-stakes, rare |
| Christmas / Easter specials | Longer programme, many videos, candlelight songs | Seasonal | All | Reliability, long queues, preflight | **Should** |
| Holiday backgrounds | Seasonal motion/still sets | Seasonal | Prep | Library tags ("easter") | **Nice** |
| Multi-room / overflow | Same service in a second room | Weekly at big churches | Booth | Destination per room (v2 has Destinations); optional different background | **Should** |
| Livestream overlays | Lower third + live scripture over camera in OBS | Weekly if streaming | Booth | Graphics output (exists) + transparent profiles | **Should** — exists for text |
| Digital signage (lobby) | Loop of announcements on a lobby TV | Weekly | Staff | Browser Destination looping a playlist | **Nice** |

## I. Things we found by thinking about real workflows

- **A single "panic" key** that blanks everything, stops all sound, and shows the logo or black — every
  volunteer has had a mis-clicked video. **Must.**
- **"Is tonight's service ready?"** check on Saturday evening. **Must** (see [design §Preflight](03-product-design.md#6-operator-safety)).
- **Media travelling to the operator** from the worship leader's home or the office. **Must** for any
  multi-person team — see [Sharing](03-product-design.md#8-sharing-and-portability).
- **Rights information** — which videos are cleared for which use (live room vs. stream). **Should**,
  informational only.
- **Ceremonial order changes live** ("let's do communion before the offering") — reorder without
  surprising the screen. Exists (queue + undo).
- **Language- and region-specific content** — e.g. a Spanish Channel with a different intro video.
  Per-Channel media. **Should.**
- **Accessibility** — high-contrast stage cards, large type, captions on videos where available. **Should.**
- **Safety/privacy** — prayer requests and names of minors never leave the machine by default. **Must**
  (policy, not feature).

## Summary of the Must-haves

Image · video (sound, end-then, trim) · still & motion backgrounds · countdown timer · announcement
slideshow · PowerPoint/PDF import · QR/giving · alerts (nursery & safety) · stage cards & timers ·
panic key · preflight · portable media. Everything else builds on the same few pieces.
