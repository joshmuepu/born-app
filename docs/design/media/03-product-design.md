# 3. Product design — media in Born Again

Part of the [media design package](README.md). Written for the owner; plain language first, technical
detail in the boxes marked **Engineering note**. Pictures are in [04](04-visual-design.md).

## 0. The idea in one paragraph

Born Again already knows how to put *words* on screens: a queue of items, a Preview you check, a Live
you can trust, Channels for audiences, Destinations for places. **Media is not a second app bolted on —
it is more kinds of queue items that ride the same rails.** An image, a video, a countdown or an alert is
an item like a song; it gets staged in Preview, taken Live, and read back from the real output. Three new
things are added: a **Media library** (to find and trust files), a **playback bar** (for things that
move), and a **layer order** (so text, backgrounds and alerts never fight). Nothing plays by itself,
nothing makes a sound unless you asked, and a missing file is found on Saturday, not on Sunday.

## 1. The media model

### 1.1 Item types

| Type | What it is | Plays? | Has sound? | Lives in the library? | Notes |
|---|---|---|---|---|---|
| **Image** | One picture | no | no | yes | Fit or fill; safe margins |
| **Video** | A clip | yes | optional | yes | In/out points, loop, "when it ends" |
| **Audio** | A track | yes | yes | yes | Optional visual (a background) |
| **Slideshow** | Ordered pictures (photos, or an imported deck) | steps or timed | optional music | yes | One queue row, many files |
| **Document** | A PDF/PowerPoint imported as pictures | steps | no | yes | See [§9.6](#96-presentations-pdf-powerpoint-keynote-google-slides) |
| **Background** | An image or looping video that sits *behind* text | loop | no | yes | Same files as above, used differently |
| **Live input** | Camera, capture card, NDI/virtual camera, window capture | live | optional | no (a *source*) | Needs permission & a device |
| **Web** | A web page | live | optional | no | Last priority; sandboxed |
| **Timer / countdown** | Count to a time or for a length | ticks | no | template | Generated, not a file |
| **Lower third** | Name/title card | no | no | template | Generated |
| **Alert** | Short urgent text | no | optional chime (off) | template | Top layer, auto-clears |
| **Announcement** | A text+image card, or a set (loop) | optional | no | template | |
| **Giving / QR** | QR code + text | no | no | template | Generated; shows the URL as text too |
| **Blank / Logo** | Black, or the church logo | no | no | yes | Used by panic key and "then" |

### 1.2 What every media item remembers (metadata)

| Field | Meaning | Example |
|---|---|---|
| `mediaId` | A stable id, from the file's *content* (not its name or place) | `m_9f2c…` |
| name, notes | What people see | "Mission Trip — Kenya" |
| type, kind | As above | video |
| duration, size, resolution, frame rate, has-audio | Read on import | 4:12 · 1080p · 30 fps · yes |
| in / out points | Trim without changing the file | 0:04 → 4:08 |
| loop, volume, fade-in/out, "when it ends" | Playback defaults (can be overridden per queue item) | then: go next |
| fit | Fit (letterbox), Fill (crop) | Fit |
| tags, folder, favorite | Organisation | `missions`, Videos |
| rights note | Free text + source + licence kind (information only) | "Own footage" |
| where the file lives | Path *and* a relative hint; whether a managed copy exists | `~/Church/Media/…` |
| health | OK / missing / unsupported / needs a safe copy / large | OK |

### 1.3 How media becomes a queue item

Today `QueueItem` is `quote | bible | song`, each with `slides[]` (a flat list the projector steps
through). A media item adds **one more kind** with the same shape plus a reference:

```
MediaItem { id, kind:'media', mediaId, mediaKind, name, slides[], playback:{ loop, volume, in, out, then, fade }, source? }
```

- `slides[]` is what keeps it compatible with Back/Next: an image is one slide; a slideshow is N slides;
  a video is one slide whose "advance" is *play/pause*, with "Next" jumping to the next item.
- The playback settings live **on the queue item** (the library holds defaults), so "this one time, skip
  the intro" never edits the shared file's settings.
- A `source` field stays (existing: which phone added it).

> **Engineering note.** `SlidePayload.kind` is `'quote'|'bible'|'song'` in three places
> (`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/types.ts`), each with a comment that
> they must not carry content. A `media` payload is allowed to carry only a **reference** (`mediaId`,
> position, state), never file bytes. The three duplicated types would be unified first (small spike).

## 2. The media library

### 2.1 Getting media in

| Way | Behaviour |
|---|---|
| **Drag and drop** files or a folder onto the window or the Media area | Imports; shows progress; never blocks the screen |
| **Add media…** button / `Ctrl+Shift+I` | File picker, multi-select |
| **Watch a folder** | A chosen folder (e.g. a synced Dropbox) is scanned at start and on change; new files appear under "New" |
| **From a phone** | The remote's Media tab "Send to booth": photo/video uploaded over Wi-Fi into an *Inbox* (never straight to a screen). Size cap, operator approves |
| **From a queue file** | Opening a `.born` with a media bundle offers to add its media ([§8](#8-sharing-and-portability)) |
| **Generated** | Countdowns, lower thirds, alerts, QR — made in the designer ([04](04-visual-design.md)); stored as small templates, not files |

By default Born Again **keeps the original where it is** and records a reference (fast, no duplication,
no surprise disk use). One switch — *Copy into the Born Again library* — makes managed copies, which is
the safe choice for a single dedicated booth computer. The mockup shows both
([`01-library`](mockups/png/01-library.dark.png), [`02-library-states`](mockups/png/02-library-states.dark.png)).

### 2.2 Organising and finding

- **Folders** (real folders the church names), **tags** (free labels), **Smart** views: Favorites,
  Recently used, *Needs attention* (missing/unsupported/large), and *Inbox*.
- **Search** is the existing global palette (`Ctrl/Cmd+K`) extended to media; plus a search box in the
  library. Matches name, tag, notes, folder.
- **Drill-down** — the same Finder-style columns as Sermons/Bible/Songs: folders as columns, the
  chosen item in the large right pane ([`04-drilldown`](mockups/png/04-drilldown.dark.png)); `\` slides the
  folder columns away; grid/list remembered.
- **Thumbnails**: made on import (a frame at ~10% for video, small cover for audio), stored in a cache
  we can rebuild. **Hover preview** scrubs a few frames; never plays sound.

### 2.3 Big files, duplicates, missing or moved files

| Situation | What the operator sees | What happens |
|---|---|---|
| **Large file** (e.g. 4K > ~500 MB) | Chip "Large" and a hint "A 1080p copy plays more smoothly" | Offer a safe copy; never force |
| **Duplicate** (same content) | "Same file already in Announcements — use existing / keep both" | Detected by content hash after copy/import |
| **Missing / moved** | A *File missing* card with the last-known location; **Relink** offers a candidate with the same size and length | Items in saved services keep their place and show "media missing" instead of playing |
| **Drive not connected** | Same, with "that drive isn't connected" | Auto-recheck when a drive appears |
| **Unsupported format** | "Can't be played here — make a safe copy" | Transcode on request, original untouched ([§9.2](#92-formats-and-conversion)) |
| **Unreadable / corrupt** | Marked "can't open", never added to a queue silently | Skipped by preflight with a clear list |

## 3. Playback — what the operator sees and does

### 3.1 The controls (see [`03-queue-preview-live`](mockups/png/03-queue-preview-live.dark.png))

| Control | Behaviour |
|---|---|
| **Play / Pause** | A large button; **Space** when the Live panel has focus |
| **Seek** | A wide scrubber (≥ 36 px tall); in/out points and markers drawn on it; click or drag; `←`/`→` = 5 s, `Shift` = 30 s |
| **Time** | Elapsed (big) and **time left** (also on the stage monitor and phone) |
| **Loop** | Toggle; loops the in/out range |
| **Volume / mute** | Per item; master volume per Destination; mute is a toggle, never hidden |
| **Fade** | None / 1 s / 3 s for in and out (video + audio) |
| **When it ends** | *Stay on last frame* · *Go to next item* · *Black* · *Logo* (default **Go to next item** for video, **Stay** for slideshow) |
| **In / out points** | Set on the library item or the queue item; non-destructive |
| **Auto-advance (slideshow)** | Manual, or every 3/5/8/15 s; a loop option |
| **Transitions** | **Cut** (default) and **Dissolve** (0.3/0.6/1 s). Nothing else in v1 of the feature |
| **Audio routing** | One output device per Destination (default: system); a *Test tone* button that only plays when pressed |

### 3.2 Live is authoritative

The Live panel never shows what the app *thinks* it sent. It shows what the output reports: **playing /
paused / ended / stalled / error**, the real position and the real time left, read from the output
windows. The existing `live:snapshot`/`live:changed` main-process state is extended with `{ mediaId,
state, position, duration, volume, muted, deviceOk }`. The scrubber moves from those reports, not from a
local timer. If the output stops reporting, the UI says **"Output not responding"** instead of
pretending.

### 3.3 Never a surprise

1. Selecting, hovering or staging **never** plays. Only **Take**, or **Play** inside the Live panel.
2. Sound is **off by default** for backgrounds and loops; on by default only for a Video the operator
   took with sound enabled in the library ("Has audio" shown on the card).
3. Taking a video while sound is on shows a one-time inline label: **"Sound on · HDMI — Sanctuary"** —
   not a dialog.
4. Anything arriving from a **phone** or **API** cannot start sound by itself ([§7](#7-remote-and-automation)).

## 4. Channels, Presentation Profiles, Destinations and layers

### 4.1 How it maps onto what exists

| Existing concept | Plain meaning | What changes for media |
|---|---|---|
| **Channel** | "What is live for one audience" (Main, Spanish) | A channel's `current` may now be a media item |
| **Follow Main** | A channel tracks Main, re-resolved in its language | A following channel shows the **same media**, unless it has a *language variant* (see §4.4) |
| **Destination** (window or browser) | A place a channel is shown: Congregation, Stage, Graphics (OBS) | Each Destination decides **how** it renders media (see table) |
| **Presentation Profile** (Full-screen, Lower third, Auto) | How a Graphics output lays content out | Gains two data fields: `background` and `mediaFit`; Auto chooses by content kind (video → Full-screen) |
| **Stage monitor** | Next slide, clock, message | Shows media **timing**, not the picture, by default |

### 4.2 What each Destination shows

| Content | Congregation | Stage monitor | Graphics (OBS) | Overflow room |
|---|---|---|---|---|
| Image / slideshow | Picture | Small picture + "Next" | Picture or **transparent** (profile) | Same as Congregation |
| Video | Video + sound | **Time left (huge)**, progress, next item | Video (transparent if a loop with alpha is chosen) | Same + its own audio device |
| Audio only | Background or logo | Time left, track name | Nothing / logo | Optional |
| Background under text | Motion/still behind text | Black (text only) | **Transparent** by default | As Congregation |
| Timer | Large clock | Large clock + label | Clock (transparent) | Same |
| Alert | Banner above everything | **Highest priority banner** | Optional (off by default) | Optional |
| Stage cue | — | Large card, amber | — | — |
| Live input | Picture | Small picture | Picture | Same |

### 4.3 The four layers (fixed order, bottom to top)

1. **Background** — still or motion; never has text of its own.
2. **Content** — the current item (a verse, a song, a picture, a video).
3. **Overlay** — lower third, clock, QR.
4. **Alert** — urgent text. *Always* wins. Always clears itself.

The order is fixed on purpose. The operator never arranges layers. This is the answer to the
long-standing "alerts don't show over video" complaint ([OpenLP report](https://lists.launchpad.net/openlp-core/msg17538.html))
and avoids layer-system complexity from Resolume-style tools.

A **video as the content** replaces the Background layer while it plays (so you don't double-decode).

### 4.4 Per-Channel behaviour and follow sync

- Backgrounds are set **per Destination per Channel**, with a "same as Main" default
  ([`05-backgrounds`](mockups/png/05-backgrounds.dark.png)).
- **Follow** = the following Channel receives the same *media position*: the same video at the same
  time. The follower never decides to play on its own.
- A **language variant** (e.g. the intro video with Spanish subtitles) is an *optional alternate* on a
  library item: `variants: { es: mediaId }`. If missing, the follower uses the original — the same
  "fall back and say so" rule Born Again already uses for translations.
- **Sync across screens**: all outputs follow one clock owned by the main process; see
  [§9.4](#94-multi-window-playback-and-sync).

## 5. Queue, Preview/Live and drill-down

- **In the queue:** a media row shows a thumbnail with a play glyph, name, length and a one-word state
  (*Ready · Large · Missing*). Drag to reorder; the existing Undo toast covers removal.
- **Preview** shows a still frame with its length; **Live** shows the real output. For a video in Live
  the transport panel appears below the pair.
- **Take** is the only thing that changes Live. **Right-click** and the palette offer *Stage in Preview*,
  *Add to queue*, *Add next*, *Play now…* — the last asks if something is live.
- **Palette** (`Ctrl/Cmd+K`) finds media like everything else and adds actions: *Blank to logo*,
  *Show countdown 5:00*, *Play next video* ([`06-palette-menus`](mockups/png/06-palette-menus.dark.png)).

## 6. Operator safety

### 6.1 Rules

1. **Live is never changed by anything except the operator's explicit Take** (existing rule, extended
   to menus, drops, remote, API).
2. **A failure never changes what the room sees on its own** — the previous picture stays; audio is
   muted; the UI says what happened and offers one obvious next step.
3. **Never a surprise sound.** Defaults above; the master mute is visible.
4. **No autoplay on open.** A saved service opens with nothing playing.

### 6.2 Failure matrix (also drawn in [`12-failure-states`](mockups/png/12-failure-states.dark.png))

| Event | Detected by | What the room sees | What the operator sees | Offered action |
|---|---|---|---|---|
| File missing at Take | Check before send | Unchanged | Red inline message on the item | Relink · Skip |
| Codec unsupported | Import + before send | Unchanged | "Can't play this format" | Make safe copy · Skip |
| Video stalls (> 2 s no progress) | Output position watchdog | Frozen last frame; audio muted | Amber banner, big | Restart · Skip · Blank |
| Output window crashed | Window `crashed`/unresponsive events | Black | Red banner | Reopen · Use Stage monitor |
| Display unplugged | Display events (existing) | Whatever the OS shows | "Congregation display gone" | Use another · Wait (resume in place) |
| Low memory / big 4K | Preflight + runtime warning | — | Amber hint | Use 1080p copy |
| Drive removed mid-service | File read errors | Frozen last frame or black | Amber | Skip · Retry |
| Audio device gone | Device-change event | Silent | Amber chip "Audio device missing" | Switch to default |
| Phone/API sends Play | Policy gate | — | Toast "Phone asked to play — Allow?" if sound would start | Allow · Deny |

### 6.3 Panic

One key — **Esc** (existing blackout) extended: pause all video, mute, clear alerts, show **Black** or
**Logo** (setting). Press again to return to where it was. The phone has a 56–64 px **Blank** button.
"Return" never replays from zero and never un-mutes without asking.

### 6.4 Preflight — "Is tonight's service ready?" ([`08-preflight`](mockups/png/08-preflight.dark.png))

A single screen, run on demand and automatically when a service is opened:

| Check | Why |
|---|---|
| All files found and readable | #1 pain point in the field |
| Formats playable; sizes sensible vs. the projector's resolution | Avoids stutter surprises |
| Test-play the first and last 3 seconds of each video (muted, hidden) | Finds codec and decode issues early |
| Audio device present; test tone available | No silent video |
| Displays and Destinations present | The existing display warnings, summarised |
| Fonts/text overflow (existing auto-fit) | Already handled |
| Rights notes present where the church wants them | Information only |
| Disk space and memory | Avoids a mid-service failure |

Result is a green/amber/red list with **one fix per row**; the queue header shows ✓ Ready or "1 problem".

## 7. Remote and automation

### 7.1 Phone remote ([`09-phone-remote`](mockups/png/09-phone-remote.dark.png))

| Allowed | Not allowed (deliberately) |
|---|---|
| See what is live (picture, time, time left) | Delete or import media |
| Play / Pause the video that is **already live** | Start the first play of a video **with sound** without the booth allowing it |
| Next / Back, **Blank / Show** | Scrub (seek) — a thumb on a phone mis-seeks; the booth can |
| Stage an item in Preview (not Take) from a *Media* tab | Change audio device, volume master |
| Send a photo/video to the booth Inbox (size-capped) | Publish to the Graphics output |

Phone controls change to a calm "Reconnecting…" state when the connection drops; nothing on screen
changes. The remote already has this connection-pill pattern.

### 7.2 `/api/v1/automation`

Additive, versioned, same token:

| Method | Path | Effect |
|---|---|---|
| `GET` | `/state` | Existing, extended: `current.media = { mediaId, state, position, duration, remaining, volume, muted }` |
| `POST` | `/media/play`, `/media/pause`, `/media/toggle` | Only the item that is **already live** |
| `POST` | `/media/restart` | Seek to in-point of the live item |
| `POST` | `/media/loop/<on\|off>` | |
| `POST` | `/blank/<channelId>` | Existing |
| `POST` | `/timer/<start\|pause\|add/<seconds>>` | Countdown control |
| `POST` | `/alert/<presetId>` and `/alert/clear` | Alert presets only (no free text over the API by default) |

**Deliberately not remote-controllable:** taking *new* content with sound, deleting, importing, changing
audio device, changing master volume, opening files. (Seek is not on the phone; an automation user can
be given `seek` as an opt-in with the token.)

## 8. Sharing and portability

Builds on the `.born` plain-JSON queue file and the song-import review in
[`docs/notes/v2-queue-song-import.md`](../../notes/v2-queue-song-import.md).

### 8.1 What travels

| Option | What is in the file | Good for | Cost |
|---|---|---|---|
| **A. References only** (default) | `mediaId`, name, size, duration, relative path hint, optional tiny thumbnail | Same church computers / shared drive | Tiny; media must exist on the target |
| **B. Bundle** | A `.bornpack` (zip): the queue JSON + the media files + thumbnails | Song leader at home → operator | Large; enforced size cap (say 1 GB) with a visible total before saving |
| **C. Link to a shared folder** | References + "media root" the church picks (Dropbox/Drive/NAS) | Teams with a synced folder | Needs the folder; best of both |

### 8.2 On the receiving side

- Opening a queue with media runs the **same matching dialog pattern as the song import**: *found /
  missing / new*, defaulting to the safest answer (never overwrite; "add as separate" on conflict).
  `mediaId` (content hash) makes "same file, different name" a *match*.
- **Relink** offers the likely match first (same size and length).
- **Size limits** are shown before saving, not discovered after.
- **Privacy:** prayer-request items and anything tagged *private* are **excluded from bundles by
  default**, with a visible count.

### 8.3 The song leader at home

1. At home the leader builds the service, dragging songs, backgrounds and a video from *their* library.
2. **Share → Bundle for the booth** (or, if the church has a shared folder, *Share a reference*).
3. The operator opens it Saturday; the **review** shows: 3 songs new, 2 backgrounds new, 1 video new
   (418 MB). One click adds them; preflight runs.

### 8.4 File format compatibility

`.born` remains a plain JSON array of items. Media items add `kind: "media"` (and `mediaId`).
An older Born Again (v1 / a v2 build before this) meeting an unknown kind **must skip it with a visible
message, not crash** — this is *unverified* today and is listed as a required test ([05](05-roadmap.md)).
If it cannot be made safe, media files are saved in a **sibling file** (`name.born.media.json`) the old
app never reads.

## 9. Technical feasibility

Verified facts are marked **✔ verified here** (measured in this repository's Electron, 33.4.11 / Chromium
130, on macOS, 2026-10-15). Everything else is *reasoned, not measured*.

### 9.1 What the engine plays (verified)

Measured with `canPlayType`/`MediaSource.isTypeSupported` in the app's own Electron:

| Format | Result | Meaning |
|---|---|---|
| MP4 + H.264 (baseline/high) + AAC | "probably" ✔ | Supported — the safe default |
| MP4 + HEVC (H.265) | "probably" ✔ | *Claims* support; depends on the computer's hardware decoder — **must test with a real file on each target OS** |
| WebM VP8 / VP9 / VP9+Opus | "probably" ✔ | Supported (software, often hardware) |
| MP4/WebM AV1 | "probably" ✔ | Supported; heavy on old machines |
| MOV container, **ProRes** | "no" ✔ | **Not playable** |
| MKV, AVI, MPEG-TS, Theora | "no" ✔ | Not playable |
| MP3, AAC (m4a), FLAC, Ogg Vorbis, Opus | "probably" ✔ | Supported |
| WAV | "maybe" ✔ | Works in practice (container ok) — test |
| AC-3 / E-AC-3 | "no" ✔ | Not playable |
| Output-device choice (`setSinkId`) | present ✔ | Per-window audio device is possible |

> **Reading this.** The two big consequences: (1) **H.264/AAC in MP4 is the "just works" format**, and
> (2) churches *will* hand us `.mov` (ProRes from editors), `.mkv`, and `.avi`. We need either a
> **safe-copy conversion** or a clear message.

Other notes: Electron ships FFmpeg *with* proprietary codecs by default ([Electron commit](https://ayakael.net/mirrors/electron/commit/5b4f715d2e6ffc1427205448825e85857f28240b)),
which matches the H.264/AAC result. Chrome's HEVC hardware decode has been on by default since 107
([Streaming Learning Center](https://streaminglearningcenter.com/?p=17448)) — consistent with ✔ above,
but **Windows/Linux were not tested** (unverified). WebCodecs was *not available* in my plain-page test
(`VideoDecoder is not defined`) — that test page was not a secure context, so its availability in
the app's real windows is **unverified**; it matters only if we later want frame-accurate custom
decoding.

### 9.2 Formats and conversion

| Option | What | Licence / risk | Recommendation |
|---|---|---|---|
| **Don't convert; reject politely** | Say "export as MP4 (H.264)" with a short how-to | None | **Phase 1** |
| **Convert on import with FFmpeg** | Safe MP4 copy + 1080p proxy + thumbnails | FFmpeg is LGPL/GPL depending on build; H.264 encoders (x264) are GPL; patent considerations for H.264 are outside what I can state — *take advice before bundling* | Phase 2 spike |
| **Use the OS's own tools** | e.g. macOS AVFoundation `avconvert` | Mac only | Spike only |
| **Optional external helper** | The app detects an FFmpeg the user installed and uses it | Avoids bundling; extra setup | Possible fallback |

*(Licensing claims here are information, not legal advice; confirm with counsel before bundling.)*

### 9.3 Performance, hardware decoding, memory

- Hardware decoding is automatic where the OS exposes it (H.264 almost everywhere; HEVC varies).
- **4K on a 1080p projector wastes memory and risks dropped frames**; preflight warns and offers a
  1080p copy. Exact limits are **unmeasured** — a spike must measure CPU/GPU/RAM for 1080p30, 1080p60,
  4K30 on a low-end target machine (e.g. a 5-year-old Intel laptop) over a 60-minute loop.
- Thumbnails/proxies are generated in the background with a priority below playback.

### 9.4 Multi-window playback and sync

Each output (Congregation, Stage, Graphics, overflow) is a separate window/page. Two ways to keep video
together:

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Per-window decode + shared clock** (recommended) | Main process owns `position`; each window plays its own copy and nudges `currentTime` when drift > ~80 ms | Simple; independent failure; works with the Graphics page over HTTP | Some drift; each window uses memory |
| One decoder, share frames | Capture one window's frames and send to others | Perfect sync | Complex, costly, a single point of failure |

Spike to measure drift over 60 minutes and with two different GPUs/refresh rates. The **Graphics**
output is a web page served over HTTP: it needs the media *served* (range requests, correct MIME) from
the app; **`file://` access from another computer is impossible**, so the OBS machine either shares
the same computer or receives the file over the network via the app's server.

### 9.5 Live inputs

| Input | How | Feasibility |
|---|---|---|
| USB capture card / camera (UVC) | `getUserMedia` in a window | **Likely** — needs a permission handler and device picker; spike |
| **NDI** | NDI's *Virtual Input* turns an NDI source into a webcam ([NDI tools](https://ndi.video/tools)) → same as UVC, **no SDK** | **Feasible now** via virtual input |
| Native NDI receive/send | NDI SDK, native module | Heavy; licence to be confirmed with NDI *(unverified)*; **defer** |
| Window/screen capture (guest laptop, video call) | `desktopCapturer` | Likely; macOS permission prompts |
| SRT/RTMP in | Not in the browser stack | Defer |

### 9.6 Presentations (PDF, PowerPoint, Keynote, Google Slides)

| Source | Method | Fidelity | Licence / dependency | Phase |
|---|---|---|---|---|
| **PDF** | `pdfjs-dist` — **already a dependency** (`src/main/songParsers/pdf.ts`) — render each page to an image | Excellent | Apache-2.0 | 1–2 |
| **PowerPoint (.pptx)** | (a) ask for PDF export; (b) LibreOffice headless → PDF if installed | (a) perfect; (b) good, fonts/animations differ | LibreOffice MPL, ~hundreds of MB | 2, optional |
| **Keynote** | Export to PDF/PPTX from Keynote; **no** direct import | via PDF | — | Document only |
| **Google Slides** | *File → Download → PDF* | via PDF | — | Document only |
| Native PowerPoint/Keynote automation (COM/AppleScript) | Drives the real app | Highest | Requires the app installed; fragile | Not recommended |
| Embedded videos/animations | Not carried | n/a | — | Warn on import |

The import flow ([`11-slides-import`](mockups/png/11-slides-import.dark.png)) says plainly "pages are
made into pictures; animations don't carry over; slide 4 had a video — add it separately."

### 9.7 Storage and backups

- Library index in the existing SQLite database (a `media` table; `better-sqlite3` is already
  used); thumbnails/proxies in a rebuildable cache folder under the profile's user-data directory.
- Originals are **never modified**. Managed copies (if chosen) live in
  `<userData>/media/…`.
- Backup: the library index and settings are small and included in the existing data-folder backup
  advice; media files are the church's own and are backed up by *their* process. The app shows how big
  everything is and where it is.
- Isolated dev profile (`BORN_USER_DATA_DIR`) keeps working: all paths are derived from it.

### 9.8 Feasibility verdict

| Area | Verdict |
|---|---|
| Images, backgrounds, slideshows, timers, alerts, lower thirds, QR | **Feasible now** (web tech; no native work) |
| MP4/H.264/AAC video, audio, loops, in/out, fade | **Feasible now**; needs the playback watchdog and the shared clock |
| Sync across screens | **Needs a prototype** (drift measurement) |
| 4K, HEVC | **Risky** — hardware-dependent; prototype per OS |
| Conversion (MOV/MKV/AVI/ProRes) | **Needs a decision on bundling FFmpeg** |
| Capture card / NDI via virtual input | **Likely**; prototype |
| Native NDI, SRT/RTMP | **Defer** |
| PPTX direct import | **Defer**; PDF now |

## 10. Rights and licensing awareness (information, not legal advice)

What the sources say (US-centric; **rules differ by country** — see [CCLI](https://support-ccli-us.helpscoutdocs.com/article/1409-what-does-the-streaming-plus-license-cover)):

- A **streaming licence** covers *live* music performed in services you stream, not commercial
  *recordings* unless a higher tier covers them; neither covers every kind of creative work
  ([CCLI FAQ](https://support-ccli-us.helpscoutdocs.com/article/1505-does-our-ccli-streamingstreaming-plus-license-permit-us-to-include-all-types-of-copyrighted-content-in-our-online-services)).
- **Video** (movies, TV, clips) is a *different* licence (a church video licence), not covered by the
  music licences ([overview](https://au.thegospelcoalition.org/article/real-law-for-virtual-gatherings-copyright-and-the-livestream-church/)).
- Streaming platforms have their own terms and may still issue takedown notices.

How the app can help **without making claims**:

| Feature | What it does |
|---|---|
| **Rights note** on every library item | Free text + a "kind" (Own / Licensed / Public domain / Unknown), source, licence number |
| **Used in** report | Which items played in a given service (like song play-history reports) |
| **Gentle flags** | "This video has no rights note" in preflight — optional, can be turned off |
| **Stream-safe mode** | A tag the church can set per item; preflight lists items *not* marked, when a Graphics/stream output is live |
| **CCLI reporting** | The song play log already available to export; extend to include the item types the church wants |
| **Never** | Block playback, or say something is "legal" or "illegal" |

## 11. Accessibility and performance targets

| Target | Number |
|---|---|
| Contrast | WCAG AA everywhere; AAA in the high-contrast theme (existing automated test extended to new tokens) |
| Targets | ≥ 40 px (48 px in touch mode); scrubber ≥ 36 px tall; phone transport 56–64 px |
| Keyboard | Every media action reachable and listed in the palette |
| Reduced motion | Dissolve becomes cut; loops still play but UI animations stop |
| Screen readers | State announced: "Playing, 1:12 of 4:12" as polite live region |
| Take-to-picture latency | Image ≤ 150 ms; video first frame ≤ 400 ms for a local H.264 file |
| UI readback lag | Live panel reflects output state within 250 ms |
| Sync drift | ≤ 80 ms between outputs over 60 min (to be proven) |
| Stability | 60-min 1080p loop on a 5-year-old laptop with < 1 dropped frame per minute (to be proven) |
| Library | Browsing 5,000 items stays smooth (existing virtual list) |
| Import | UI stays responsive; thumbnails within 2 s per item for images, 5 s for video |
