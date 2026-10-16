# 4. Visual design — mockups for review

Part of the [media design package](README.md). Written for the owner.

## How to open them

Each screen is a **self-contained HTML page** (fonts and styles are inside the file) and a **PNG**.

- **Quickest:** open the PNGs in `docs/design/media/mockups/png/` — they are named
  `NN-name.<theme>.png`.
- **Interactive look:** double-click any `docs/design/media/mockups/NN-name.html` in a browser.
  Add `?theme=light` or `?theme=contrast` to the address to see the other themes
  (for example `01-library.html?theme=light`).
- They are **static pictures of states**, not working software. Nothing was added to the app.

Look and feel: the existing Born Again design language — near-black canvas, Plum for the one action
colour, Stone/Sage/Amber for Sermons/Bible/Songs, red only for live/destructive, green for OK —
using the real tokens from [`docs/design/tokens.css`](../tokens.css) (dark default, light, high contrast).
**One new token is proposed:** `--ba-media` (teal) as the colour of the Media area, with light and
high-contrast values, so Media sits beside Sermons, Bible and Songs. All pictures in the mockups are
original gradients — no stock photos.

## The screens

Screens 13–16 were added with the [YouTube design](06-youtube.md), 17–19 with the [service pack](07-service-pack.md); the numbering is by creation, not by order.

| # | Screen | What to look at | Themes shown |
|---|---|---|---|
| 01 | **Media library — grid** ([png](mockups/png/01-library.dark.png), [html](mockups/01-library.html)) | Folders, Smart views (Needs attention), tags, search + type filters, grid/list switch, drop zone with a watched folder, thumbnails with length and loop badges, a **missing** card, the queue on the right | dark · light · contrast |
| 02 | **Library states** ([png](mockups/png/02-library-states.dark.png), [html](mockups/02-library-states.html)) | List view; empty library; **missing-file relink**; import progress with **unsupported** and **duplicate** handling | dark |
| 03 | **Queue + Preview/Live with a video** ([png](mockups/png/03-queue-preview-live.dark.png), [html](mockups/03-queue-preview-live.html)) | Media items in the queue; red-framed Live video with *time left*; big scrubber with in/out points; loop; volume; fade; **When it ends** | dark · light · contrast |
| 04 | **Drill-down for media** ([png](mockups/png/04-drilldown.dark.png), [html](mockups/04-drilldown.html)) | Folders as collapsed columns, list beside a large right pane, text-over-motion preview | dark |
| 05 | **Backgrounds + where they show** ([png](mockups/png/05-backgrounds.dark.png), [html](mockups/05-backgrounds.html)) | Still and motion picker, automatic dimming, per-Destination table (Congregation / Stage / Graphics / Overflow) with profile, per-Channel tab | dark |
| 06 | **Palette and context menu** ([png](mockups/png/06-palette-menus.dark.png), [html](mockups/06-palette-menus.html)) | Media results next to Bible/Songs, action commands, "Opening never goes live", media context menu | dark |
| 07 | **Alert / lower third / countdown** ([png](mockups/png/07-alert-lowerthird-timer.dark.png), [html](mockups/07-alert-lowerthird-timer.html)) | The designer (countdown) with safe area, templates, and the **operator view**: one-tap alert presets, active-alert banner, timer controls, lower-third shows | dark · light · contrast |
| 08 | **Preflight** ([png](mockups/png/08-preflight.dark.png), [html](mockups/08-preflight.html)) | "Ready for Sunday?" with green/amber/red rows, one fix each; queue shows "1 problem" | dark · light · contrast |
| 09 | **Phone remote** ([png](mockups/png/09-phone-remote.dark.png), [html](mockups/09-phone-remote.html)) | Portrait (transport + Blank, no scrubbing), landscape, and the **reconnecting** state | dark · light · contrast |
| 10 | **Stage monitor** ([png](mockups/png/10-stage-monitor.dark.png), [html](mockups/10-stage-monitor.html)) | Time left in huge type, progress, Next / Then, amber "from the booth" cue, clock and elapsed | dark |
| 11 | **Slides import** ([png](mockups/png/11-slides-import.dark.png), [html](mockups/11-slides-import.html)) | Step bar, page thumbnails, fidelity warning, slideshow vs separate pictures | dark |
| 13 | **Add a YouTube video** ([png](mockups/png/13-youtube-add.dark.png), [html](mockups/13-youtube-add.html)) | Paste a link, found/embeddable chips, start/stop, muted always, fallback, ads notice, error variants | dark |
| 14 | **YouTube in the queue** ([png](mockups/png/14-youtube-queue.dark.png), [html](mockups/14-youtube-queue.html)) | *Online* badge, Preview is a picture, Test play, fallback | dark · light · contrast |
| 15 | **Preflight with YouTube** ([png](mockups/png/15-youtube-preflight.dark.png), [html](mockups/15-youtube-preflight.html)) | Online checks, can't-verify-offline, embedding-off with fallback, ads notice | dark · light · contrast |
| 16 | **YouTube playback bar and failures** ([png](mockups/png/16-youtube-playbar.dark.png), [html](mockups/16-youtube-playbar.html)) | Playing, buffering, stalled, error 101/150, error 153, offline | dark |
| 17 | **Save service with pictures** ([png](mockups/png/17-pack-export.dark.png), [html](mockups/17-pack-export.html)) | What goes in the pack, size and free space, big-pack warning, progress with Cancel, a missing-picture refusal. Design: [07](07-service-pack.md) | dark · light · contrast |
| 18 | **Open a service pack** ([png](mockups/png/18-pack-import.dark.png), [html](mockups/18-pack-import.html)) | Review before anything is copied: new / already here / damaged, atomic copy with Cancel, the summary | dark · light · contrast |
| 19 | **Pack errors and reconnect a drive** ([png](mockups/png/19-pack-errors.dark.png), [html](mockups/19-pack-errors.html)) | Not a pack, cut short, newer version, too big, no space, wrong file type; “Reconnect this drive” for linked pictures | dark |
| 12 | **Failure states** ([png](mockups/png/12-failure-states.dark.png), [html](mockups/12-failure-states.html)) | Stalled video, missing file, unsupported format, projector unplugged, low memory, and the **panic** key | dark |

## Honest notes about the mockups

- **Light and high-contrast** were rendered for the five most important screens (01, 03, 07, 08, 09)
  rather than all twelve. The high-contrast values were taken from the existing token set, and the new
  `--ba-media` token has contrast values proposed but **not yet run through the automated WCAG test**
  (that is a build-phase task).
- The **stage monitor** and **designer** screens use illustrative type sizes; real sizes follow the
  existing auto-fit rules.
- The mockups show *proposals*. Several controls (e.g. Dissolve, audio routing per Destination) are
  deliberately small so nothing here implies the first version must include everything.
- The generator is in [`mockups/_src/`](mockups/_src/) (Python + one Electron screenshot script) so the
  pages can be regenerated after feedback.
