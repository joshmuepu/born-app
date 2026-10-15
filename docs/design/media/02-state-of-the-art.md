# 2. State of the art — what to steal, from whom

Part of the [media design package](README.md). Written for the owner.

## How this was researched (and its limits)

Web searches were run on 2026-10-15. Many vendor pages were only reachable as search snippets, and
several review sites are aggregator/affiliate pages. So:

- **Verified** = a source below says it. Each claim carries a link.
- **Recalled** = general knowledge of the product, not re-checked today. Marked *(recalled)*.
- **Unverified** = I could not confirm it. Marked *(unverified)*. Do not rely on these.
- "Pain points" come from vendor support pages, forum threads and reviews — they are individual
  reports, not statistics.

## Product-by-product

### ProPresenter 7 (Renewed Vision) — the market reference

| Area | What we found |
|---|---|
| Media features | Video and images played directly with in/out points; colour, brightness, volume, crop/scale adjustable during playback ([user guide](https://files.renewedvision.com/propresenter/support/Pro7UserGuide.pdf)). Playback **markers** on media in the Media Bin trigger actions at set points — not supported on images or on media inside slides ([support](https://support.renewedvision.com/hc/en-us/articles/7171761588371-Using-Playback-Markers-in-ProPresenter)). Hardware H.264/H.265 decoding on macOS added in 7.10 ([release post](https://renewedvision.com/blog/propresenter-7-10/)). |
| Library / organisation | A **Media Bin** with a separate Audio Bin, Props, and an *Announcement layer* (user guide TOC). Files are *referenced*, not copied, unless "Manage Media Automatically" is on ([relink guide](https://support.renewedvision.com/hc/en-us/articles/360011693694)). |
| Loops & timers | Looping announcements are a presentation with **Go To Next timers** and a loop cue; timers cannot be applied to items in the media bin directly. For a background video the timer starts at the video's start; for a foreground video it starts at the end ([support](https://support.renewedvision.com/hc/en-us/articles/360011694134-How-do-I-create-a-looping-presentation)). |
| Timeline | Records slides, media, audio and actions so they play in sequence ([blog](https://renewedvision.com/blog/?p=214244)). |
| Countdowns & stage | Countdown timers for audience and stage; stage screens can show clocks, timers and "what's next" ([7.10 post](https://renewedvision.com/blog/propresenter-7-10/)). |
| Live inputs | NDI and capture inputs *(recalled)*. |
| Remote control | iOS/Android remote apps *(recalled)*; Companion module exists ([Companion docs index](https://freeshow.app/docs/companion) lists FreeShow's; ProPresenter's module is *recalled*). |
| Planning side | Planning Center integration: playlists sync from the plan; **standalone media cues** can be uploaded to a plan, media *inside* presentations and backgrounds do not sync; Planning Center has storage limits ([PP support](https://support.renewedvision.com/hc/en-us/articles/1500003710301), [PCO](https://planningcenter.com/integrations/propresenter)). |
| Import | PowerPoint import — the user guide has an *Importing* section but the snippet did not show formats *(unverified for PowerPoint specifically)*. |
| Pain points | Missing "Not Found" media after files move ([relink guide](https://www.churchmotiongraphics.com/blog/how-to-relink-not-found-media-files-in-propresenter/)); corrupted media-bin file that must be deleted and rebuilt ([support](https://support.renewedvision.com/hc/en-us/articles/360011693694)); a user report of embedded video bogging down on output/stream while audio continued ([OBS forum](https://obsproject.com/forum/threads/trouble-live-streaming-embedded-video-in-propresenter-7.142945/)); release notes mention videos with a Go-to-Next timer sometimes failing to trigger. Power and depth also make it a lot for volunteers *(recalled)*. |

### Proclaim (Faithlife / Logos)

| Area | What we found |
|---|---|
| Media | Media library with countdowns, still and motion backgrounds, sermon graphics; searchable inside the app ([features](https://proclaim.logos.com/features), [community post](https://faithlife.com/posts/3202722)). |
| Planning | Plan-first: the service is a plan that others can contribute to; cloud-based *(recalled)*. |
| Stage | Stage/confidence monitor with timers, notes, next-slide preview; NDI/SDI/HDMI output ([review](https://churchleaders.com/ministry-tech-leaders/385298-faithlife-proclaim-3-0.html)). |
| Countdown handling | A countdown is just an item with auto-advance (e.g. 300 s); users call options for clock size/placement limited; older feedback asked for countdowns independent of slides ([community post](https://faithlife.com/posts/3202722), [Logos forum](https://community.logos.com/discussion/comment/293111)) — *may have been addressed since*. |

### EasyWorship

| Area | What we found |
|---|---|
| Media | Subscription media library of backgrounds/countdowns/titles (counts vary across pages and versions — treat as marketing) ([EW7 downloads](https://support.easyworship.com/solution/articles/24000018839), [faith.tools](https://faith.tools/app/easyworship)). |
| Live inputs | NDI supported; release notes mention NDI feed/background fixes ([EW7 notes](https://support.easyworship.com/solution/articles/24000018839)). |
| Gaps in what I could confirm | Countdown behaviour and live-video setup in EW7 were *not* documented in sources I reached *(unverified)*. |

### MediaShout 7

| Area | What we found |
|---|---|
| Strengths (reviewer opinions) | Built-in libraries; easy to train volunteers; saved presentations keep their backgrounds even if the network drops ([Capterra UK](https://www.capterra.co.uk/software/140318/mediashout), [GetApp](https://www.getapp.com/communication-software/a/mediashout/)). |
| Pain points | Crashes/lock-ups reported weekly by one reviewer; "overly complex since v6"; older presentation import harder; upgrade costs and membership renewals. |
| Caveat | No official feature list or media-library detail was reachable *(unverified)*. |

### OpenLP (free, open source)

| Area | What we found |
|---|---|
| Playback | Uses VLC as a back end for almost any video/audio ([toolradar](https://toolradar.com/tools/openlp)). |
| Known limitation | Long-standing bug: **alerts do not display over VLC-played video** because VLC cannot overlay text ([Launchpad thread](https://lists.launchpad.net/openlp-core/msg17538.html), ~2012; may have changed). |
| Backgrounds | A reviewer says motion-background support is weak ([Capterra](https://www.capterra.co.uk/software/170167/openlp)) — single opinion. |
| Stage & remote | Built-in browser stage view and web remote. |
| Lesson | Alerts-over-video is a real design constraint — we avoid it by rendering alerts in the same layer stack as video (see [03](03-product-design.md#4-channels-profiles-destinations-and-layers)). |

### Holyrics

Free Windows program; built-in media player using VLC; videos as animated backgrounds; playlists per
service; a stage view; a "communication panel" for alerts shown only on monitors; play-history
reports; paid mobile remote app ([official](https://holyrics.com.br/software.php),
[App Store](https://apps.apple.com/app/id1451668865)). *Steal:* alerts that go **only** to the stage.

### FreeShow (open source, GPL-3, ChurchApps) — strongest newcomer

| Area | What we found |
|---|---|
| Features | Multiple simultaneous outputs, stage view, mobile remote, **NDI output and (v1.2.3+) NDI input**, custom countdown timers, slide **autoplay timers**, **MIDI** control, imports from ProPresenter/EasyWorship/PowerPoint/OpenLP/OpenSong ([docs](https://freeshow.app/docs/features), [releases](https://github.com/ChurchApps/FreeShow/releases)). |
| Caveat | Website footer out of date; the app ships monthly — rely on release notes ([review](https://learnofchrist.com/resources/freeshow)). |
| Why it matters | Same stack family as us (Electron-based *(recalled)*) — a living proof of what's achievable in a web-tech shell. Worth a hands-on review before building. |

### Planning Center Services (planning side)

Plans with items, times and attachments; sync to ProPresenter/Proclaim as playlists; storage limits
make video heavy. ([PCO integration](https://planningcenter.com/integrations/propresenter)). *Steal:*
the idea that a *plan* is the unit, the *media* is attached to plan items, and a "needs attention"
state appears when a file is missing. *Do not copy:* cloud storage of big video.

### Resolume and QLab (live playback tools)

- **QLab** is cue-based: a video cue can fade via a separate fade cue; fade-ins are non-obvious (start at
  opacity zero, then fade up); looping a clip with a seam crossfade has no simple built-in answer
  ([QLab list](https://groups.google.com/g/qlab/c/86fhh6plE9s)). Crossfades are done by layering and
  fading the top layer.
- **Resolume** is clip/layer-based, with transitions and loops on the clip; clips are addressable by
  layer/column for OSC control ([Resolume forum](https://resolume.com/forum/viewtopic.php?p=73149)).
- *Steal:* **layers with a defined order**; fades expressed as one number on the item. *Avoid:* cue
  programming — a volunteer should never build a fade out of two cues.

### OBS Studio and vMix (live production)

- **OBS**: free; reviews call it powerful but hard for beginners; hotkeys speed up volunteers; no
  scheduling; lower-end hardware lags ([review](https://theleadpastor.com/tools/obs-studio-review/)).
  A church forum report shows volunteers losing OBS controls behind a full-screen PowerPoint
  ([OBS forum](https://obsproject.com/forum/threads/windows-small-always-on-top-window-available.91667/)).
  *Born Again already feeds OBS via a Browser Source — keep that the integration point.*
- **vMix** (paid, Windows): NDI in/out, playlists as one input, instant replay, GT title designer,
  overlay channels ([features](https://www.vmix.com/features.aspx), [guide](https://help.vmix.com/27/vMixUserGuide.pdf)).
  Countdown not confirmed in sources *(unverified)*. *Steal:* a playlist as a single input.

### Bitfocus Companion + Stream Deck (control)

Free, open source, controls hundreds of devices; HTTP and WebSocket friendly
([Companion](https://mimolive.com/user-manual/remote-control-automation/bitfocus-companion)).
Born Again's `/api/v1/automation` already works with it. The ProPresenter module's action list was
not retrievable *(unverified)*; one integration guide shows group triggers by ID
([Rundown Studio](https://rundownstudio.app/docs/integrations/propresenter/)). *Steal:* **stable ids
for everything** a button could point at, and a **state feed** with media position.

### NDI (protocol)

A free toolset turns screens/webcams into network video sources; Studio Monitor views them; a virtual
input makes any NDI source appear as a webcam; NDI|HX is the lower-bandwidth variant
([NDI tools](https://ndi.video/tools), [StreamGeeks](https://streamgeeks.us/ndi-screen-capture/)).
Licensing for *embedding* the NDI SDK in our app must be checked with NDI *(unverified)*.

### Other newcomers noticed

Playlister, WorshipExtreme (freemium), VideoPsalm, ZionWorx, Risen Media appear on comparison pages
([G2/GetApp lists](https://www.g2.com/products/renewed-vision-propresenter/competitors/alternatives/small-business)).
No detail was verified; none is a reason to change the plan.

---

## What to steal

| From | Best idea | How we adapt it for Born Again |
|---|---|---|
| **ProPresenter** | Media inside a *bin* plus markers/in-out points | One **library**, with in/out points and a "when it ends → then" setting on every video. No timeline. |
| **ProPresenter** | Layers incl. an announcement layer | Four fixed layers (Background · Content · Overlay · Alert) — never user-built; see [03 §4](03-product-design.md#4-channels-profiles-destinations-and-layers). |
| **Proclaim** | The plan is the unit; files "ride" the plan | Media is attached to **queue items**, and a queue can be exported with its media ([§8](03-product-design.md#8-sharing-and-portability)). |
| **Proclaim / EasyWorship** | Searchable built-in countdown & backgrounds | Ship ~10 original countdowns and ~12 backgrounds *we* make (license-clean), searchable the same way. |
| **FreeShow** | NDI in/out, autoplay timers, MIDI, many importers | Same spirit later; **phase NDI**, don't start there. Steal the importers idea: PowerPoint/PDF first. |
| **Holyrics** | Alerts that go *only* to stage | Per-Destination alert target: "Stage only" / "Main" / "Both" (v2's Message already does this). |
| **OpenLP** (its failure) | Alerts can't show over video | Alerts are drawn by our own layer, above video, always. |
| **QLab / Resolume** | A fade is one parameter on the clip | One "Fade 1 s" control per item; no cue stacking. |
| **vMix** | A playlist plays as one input | A **slideshow/playlist** item: one queue row, many files. |
| **OBS** | Hotkeys; the browser source as the bridge | Keep the Graphics URL as *the* integration; every action gets a keyboard shortcut. |
| **Companion** | Stable ids + state feed | Add `mediaId`, position, remaining, state to `/api/v1/automation/state`. |
| **ProPresenter** (its failure) | Missing media found only on stage | **Preflight** before service and a relink flow ([§6](03-product-design.md#6-operator-safety)). |
| **Planning Center** | "Needs attention" | A *Needs attention* smart folder and queue badge. |

## What we should deliberately NOT copy

| Don't copy | Why |
|---|---|
| A **timeline / cue editor** (ProPresenter, QLab) | A volunteer under pressure cannot debug a timeline. One "then" rule per item covers 95% of cases. |
| Per-slide **transition & timer matrices** | Combinatorial; a loop = *one* item with one interval. |
| User-built **layer systems** (Resolume) | Fixed order removes "why is my alert behind the video?". |
| **Media referenced from anywhere** with silent failure | Leads to the number one pain point (missing media). We reference *and* verify. |
| **Cloud storage** of video | Storage limits and uploads at 8 AM Sunday. Keep files local; sync with the *queue*, not the cloud. |
| **Deep effects** (colour, brightness, crop) during playback | Looks powerful, is easy to wreck a service. Provide a simple fit/fill and nothing else. |
| **Auto-playing anything** when an item is selected | Every product has a story of a surprise sound. We never do it. |
| **MediaShout-style** feature sprawl | Reviewers call it overly complex. |
| Building an **in-app video editor** | Out of scope; trim is points only, never re-encoding the original. |
