# Born Again — projecting anything: media design package

**Status: research and design only, for owner review.** No application code was changed. Branch
`v2-media-design`, docs only. Nothing is merged, tagged or released.

Written for the owner (not an engineer). Dates: research done 2026-10-15.

## The package

| File | What it is |
|---|---|
| **This page** | One-page recommendation |
| [01 · Scenario catalog](01-scenario-catalog.md) | Everything a church might project, by moment and ministry; must/should/nice |
| [02 · State of the art](02-state-of-the-art.md) | What ProPresenter, Proclaim, EasyWorship, FreeShow, OBS, vMix, Companion, NDI and others do — what to steal and what not to copy |
| [03 · Product design](03-product-design.md) | The media model, library, playback, Channels/Destinations/layers, safety, remote, sharing, technical feasibility, rights, accessibility |
| [04 · Visual design](04-visual-design.md) | Index of the 12 mockup screens |
| [05 · Roadmap](05-roadmap.md) | Phases, spikes, tests, open questions with recommended answers |
| [mockups/](mockups/) | HTML + PNG mockups (open `mockups/png/` first) |
| [spikes/codec-check/](spikes/codec-check/) | The one measurement taken: what this app's Electron can play |

---

## The recommendation, on one page

**Build media as "more kinds of queue items," not as a second app.** Born Again already has the hard
parts: a queue, a trustworthy Preview/Live pair, Channels, Destinations, a stage monitor, a Graphics
page for OBS, a phone remote and an automation API. Pictures, video, audio, countdowns and alerts become
items that ride those rails. Three things are new:

1. **A Media library** you can trust — import by drag-and-drop or watched folder, folders/tags/favorites,
   thumbnails, and a *Needs attention* view; files are **found and checked on Saturday, not discovered
   missing on Sunday**.
2. **A playback bar** on the Live panel that reads back what the output is *really* doing — position,
   time left, loop, volume, fade, and "when it ends, then…". Nothing plays by itself, no surprise sound.
3. **Four fixed layers** — Background, Content, Overlay, Alert — so a nursery alert is always on top,
   a motion background never covers text, and the operator never arranges layers.

**Start small and safe:** Phase 1 is images, slideshows, MP4 video, audio, still and motion backgrounds,
a media library, basic playback, a one-key panic, and a preflight check — plus PDF import using a
library we already ship. Everything with real technical risk (converting formats, live cameras/NDI,
PowerPoint, bundles that carry media) comes after short prototypes that answer specific questions.

**Why this order.** The most-complained-about thing in the field is *missing media found on stage*
([ProPresenter relink guides](https://www.churchmotiongraphics.com/blog/how-to-relink-not-found-media-files-in-propresenter/)),
and the second is video that stutters or behaves differently on the output. So reliability features
(preflight, relink, watchdog, failure states) ship *with* video, not later.

**What we deliberately don't copy:** timelines/cue editors, user-built layer systems, cloud storage of
video, deep colour/crop effects, auto-play, and an in-app video editor. A tired volunteer in a dim booth
needs fewer choices, not more.

### One verified fact that shapes everything

I measured this repo's own Electron (33.4.11 / Chromium 130, macOS): **MP4 with H.264 + AAC, WebM
(VP8/VP9), AV1, MP3, AAC, FLAC, Ogg and Opus are supported; ProRes/MOV, MKV, AVI, MPEG-TS and AC-3 are
not.** HEVC *claims* support but depends on each computer's hardware. So **MP4/H.264 is the safe
format** and churches will hand us files that are not — we need either a friendly message (Phase 1) or
a safe-copy conversion (Phase 2, after a licensing decision). Details: [03 §9](03-product-design.md#9-technical-feasibility).

### Top ten scenarios (see [01](01-scenario-catalog.md))

1. Countdown to the start of service
2. Pre-service announcement loop (slides and photos)
3. A video clip (testimony, mission, sermon illustration) that ends *then* does something sensible
4. Still and motion backgrounds behind lyrics and verses
5. A guest speaker's PowerPoint/PDF
6. Photo slideshows (baby dedications, tributes — reliability matters most)
7. Nursery/security/weather **alerts** that always win
8. Stage cards and timers for the speaker ("5 min", "wrap up")
9. Giving/QR and connect-card prompts
10. A one-key **panic/blank/logo** and a Saturday **"is tonight ready?"** check

### The five best ideas to steal ([02](02-state-of-the-art.md))

1. **ProPresenter** — in/out points and a "then" action on media (without the timeline).
2. **Proclaim / Planning Center** — the *plan* is the unit; files ride the plan; "needs attention".
3. **FreeShow** — importers and NDI/timers as a proof of what a web-tech app can do (copy the spirit; NDI later).
4. **Holyrics** — alerts that go *only* to the stage monitor.
5. **Bitfocus Companion** — stable ids and a state feed with media position, so a Stream Deck can show "2:31 left".

(Honourable mention: **OpenLP's failure** — alerts that can't show over video — is why our layers are fixed.)

### Proposed phase 1 ([05](05-roadmap.md))

Media library · image/slideshow/video/audio · still & motion backgrounds · playback bar with in/out,
loop, fade, "when it ends" · panic key · preflight · stage monitor timing · remote Play/Pause/Blank ·
PDF import. After **8 short spikes** (stability, HEVC, sync, serving to OBS, capture cards, conversion
licensing, file compatibility, type cleanup).

### Biggest technical risks

| Risk | Why | How we reduce it |
|---|---|---|
| **Multi-screen sync** | Each output decodes its own copy; drift and different GPUs | Shared clock owned by the main process; 60-minute drift test |
| **Long-running stability and 4K** | A volunteer laptop; memory/GPU limits | Warn + 1080p copies; a 60-minute loop test on the slowest machine |
| **Formats churches will bring** (ProRes, MKV, AVI, HEVC) | Not playable in this engine ✔ measured | Message first; conversion after licensing advice |
| **FFmpeg licence/patents** | LGPL/GPL and codec patents | Don't bundle in Phase 1; decide with advice |
| **Old apps reading a new `.born`** | Unknown item kinds | Prove safe-skip, else a sibling file |
| **Media over the network to OBS/other computers** | `file://` can't cross machines | Serve with range requests from the app |
| **Live cameras/NDI** | Hardware variety, permissions, SDK licence | Use NDI Virtual Input (no SDK) first |

### Where the mockups are, and how to open them

`docs/design/media/mockups/png/` (start with `01-library.dark.png`, `03-queue-preview-live.dark.png`,
`08-preflight.dark.png`) and the same screens as HTML in `docs/design/media/mockups/`
(add `?theme=light` or `?theme=contrast` to see other themes). Index: [04](04-visual-design.md).

### Decisions I need from you

Full list with my recommended answers is in [05](05-roadmap.md#open-questions-for-the-owner-with-recommended-answers).
The ones that gate the most: **(1)** Media as a fourth top-level area with its own colour? **(2)**
Reference files in place by default, or copy into a library? **(3)** MP4/H.264 only for the first
release? **(4)** Is any FFmpeg bundling acceptable, or must we avoid it? **(5)** Phone: Play/Pause the
live video only — agreed that it cannot seek or start sound? **(6)** Go ahead with the 8 spikes first?

## Limits of this research

- Product facts come from public pages reachable on 2026-10-15; many were search snippets and
  aggregator reviews. Items marked *unverified* in [02](02-state-of-the-art.md) and [03](03-product-design.md)
  should not be relied on.
- The codec test ran on **macOS only**, with `canPlayType` (what the engine *claims*), not real files.
- Time/effort numbers in the roadmap are judgement.
- Licensing text is information, not legal advice.
