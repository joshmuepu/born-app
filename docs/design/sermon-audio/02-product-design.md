# 2. Product design — "Tape service"

Part of the [sermon-audio design package](README.md). Mockups: [mockups/index.html](mockups/index.html). Visual rules: [03-visual-design.md](03-visual-design.md). Plan: [04-build-plan.md](04-build-plan.md).

**Idea.** The church plays a sermon's recording (the *tape*). BORN shows the sermon's text and **the text follows the tape**: the paragraph being spoken is highlighted and kept in view, on the operator's screen, the projector, the stage monitor, the livestream and the phone. The operator can always take over: tap any paragraph to move the tape there. Concept only is taken from the reference app; the look, wording, icons and behaviour details here are BORN's own.

**Priorities, in order:** (1) it never surprises the operator or the room; (2) it looks calm and readable from the back of a hall; (3) it works offline; (4) it works in the languages BORN has; (5) it is delivered in small, useful slices.

## 1. Operator experience

### 1.1 Where audio attaches to a sermon
A **tape** (recording) belongs to a *sermon*, not to a queue item. A sermon can have several recordings (English; a translated recording; a re-digitised file). Each recording has: a library item (the audio file), a language, a length, and **one or more sync maps**. In the Sermons reader (the `SermonFollowView` successor) a small **Tape** chip in the header shows: *No tape · Add tape…* / *Tape: English · 1:52:46 · In sync* / *Tape: English · no timing yet*. "Add tape" opens the dialog in mockup 02: a file on this computer (recommended), "get the file first" (opens the publisher's own page in the browser; BORN never downloads for them), and a greyed "stream (not available yet)". The file is copied into the managed library by default (or linked, like large video), then **preflighted** in plain words (whole, plays, length fits, timing present).

### 1.2 The reader with follow-along (mockup 01)
- The current paragraph has a tinted background, an accent edge and a large number; past paragraphs are slightly dimmed, future ones dimmer. Paragraph timestamps show on hover. Auto-scroll keeps the current paragraph at about 28 % from the top with a short ease (instant when the user prefers reduced motion).
- **Follow / free-browse switch ("Reader follows the tape").** Scrolling the reader by hand **turns follow off** and shows a small "Back to the tape" chip; nothing else changes (the tape and the screens keep going). Pressing the chip (or turning the switch on) glides back. The user's place is never lost: the highlight is always the tape's, the scroll is the user's.
- **Click/tap a paragraph** = move the tape there (and, if "Projector follows" is on, the screens follow). A jump shows the Undo toast "Jumped to ¶14 · Undo" for 8 s. Double-click = jump **and** play.
- **Keyboard:** `Space` play/pause · `←`/`→` back/forward 10 s · `[` / `]` previous/next paragraph · `Shift+←/→` 30 s · `F` toggle reader follow · `Esc` blank the screens (tape keeps playing) · `Shift+Esc` blank and pause · `M` mute · `↑`/`↓` volume · `,`/`.` slower/faster. (All also listed in the cheat-sheet.)

### 1.3 The player bar
Play/pause, previous/next paragraph, **−10 s / +10 s**, speed (0.9× … 1.25×, default 1×, the range is a setting; pitch is preserved), volume, **output device** (a named device from `setSinkId`), current time / time left, and a **seek bar with a tick for every paragraph start** (hover shows ¶ and time; click seeks; the bar never moves the tape on mere hover). A **sync pill** says *In sync* / *Out of step — re-sync* / *No timing for this recording*. **Resume:** BORN remembers the position per recording ("Continue from 1:12:03?").

### 1.4 Take, Preview and Live with a running tape
- **Take** puts the sermon's text on the screens **paused at the tape's current position** — no sound starts on Take (the same rule as video). Press **Play** to start the tape.
- **Live** means *the text is on the screens*; the tape is a separate thing that may be playing, paused or stopped. The Live panel shows the current paragraph exactly as the screens do. The tape can be paused without taking anything off the screen; clearing the screen does not stop the tape.
- **Projector follows** (switch): when off, the tape and the reader move but the screens stay where they are (e.g. while the operator reads ahead or the speaker goes off-topic). Turning it on snaps the screens to the tape's current paragraph.
- **Safety:** a tape and a video/YouTube item cannot both make sound (see 1.6).

### 1.5 Projection modes (profiles, per Destination)
Each is a **Presentation Profile option** (so each Destination — projector, stage, a Graphics output, `?profile=` per OBS source — chooses independently), driven by the channel's tape record. See 03 for typography.
1. **Highlight view** (mockup 03): a screenful of paragraphs, the current one bright with a large number, others dimmed to ~26 %, smooth auto-scroll. Best for the sanctuary.
2. **One at a time** (mockup 04): one paragraph fills the screen and changes as the tape moves. **"Show next paragraph early"** (0–10 s, default 4 s) switches slightly before the speaker starts it; a slim countdown bar and "NEXT ¶N" show what is coming. Long paragraphs are paged (see 3.2).
3. **Lower third** (mockup 05): the current paragraph in the lower-third band, two lines per page, cycling through a long one as the tape moves (a Graphics profile, with its own pagination).
4. **Stage monitor** (mockup 05): time and time left, a bar, **Now ¶** and **Next ¶ in 0:45**, and the sync pill; large for the speaker/sound desk.
The operator picks the view from the sidebar (mockup 01) and per Destination in Screens.

### 1.6 Sound sources
One programme at a time. Taking a video or YouTube item while a tape plays **pauses the tape** (setting: *Tape pauses* / *Tape off*), and the bar says "Tape paused for the video — press Play to resume". Alerts (nursery etc.) are never audio; they appear on the room/stage as today (over a *tape* highlight view they are fine; the YouTube-only alert rule does not apply).

## 2. Languages (mockup 06)
- **Text** and **Tape** are chosen separately in the Sermons header and in the player bar's language button (which opens a two-choice picker, not a recording toggle).
- A **sync map belongs to a recording** and is keyed by *numbered paragraph*. It is applied to any text language whose paragraph numbering matches.
- **Agreement check** (when attaching, and in preflight): compare the set of paragraph numbers in the text language with the map's. If they differ, show *"English has 207 paragraphs, the Spanish text has 205. 1–112 match. From 113 numbers may be off by 2"* with the list and a button to open the sync editor on the differing region. Policy when numbering differs (setting): **Ask me** (default) / **Never use** / **Use matching numbers only**. A per-text-language **override table** ("French ¶113 = English ¶115") sits on top of the tape's map.
- **Case B** (English tape, translated text): same tape and map, other text. **Case C** (translated recording): its own recording and map; text language is independent (default: the tape's language). **Case D** (two languages side by side): the same tape drives two text columns; each column keeps its own direction; designed now (mockup 06), built later.
- **RTL and non-Latin:** each paragraph carries `dir="auto"` / `unicode-bidi: plaintext` (as the Graphics lower third now does), numbers sit on the *start* side of the line, fonts come from the OS with a **font preflight** ("Amharic text needs a font this computer doesn't have"); highlight styles never rely on left/right.

## 3. Projection details

### 3.1 Typography (highlight view)
Reference size: **39 px text on a 720 p frame (5.4 % of the height), 1.42 line height**, number 76 px light weight; scales with the screen (the same clamp approach as today's `baseRem`). Measure about 38–48 characters per line on 16:9; side margins 6 % (the title-safe inset the Graphics profiles use). The current paragraph may be up to ~45 % of the screen; if it is taller than the screen it is **paged** (3.2).

### 3.2 Very long paragraphs
Sermon paragraphs can run to several hundred words. Rule: the **highlight view** shows the whole paragraph if it fits, otherwise it **pages** with the existing `paginateText` rules (sentence ends first, then clauses) and moves page by page **in proportion to the tape's progress through the paragraph** (progress = (t − start)/(next start − start), clamped; with a floor so a page never flips faster than ~4 s). *One at a time* and *lower third* page the same way. While the tape is mid-paragraph, the highlight shows the *page* being spoken.

### 3.3 Transitions, themes, accessibility
Scroll glide 0.9 s ease-out; paragraph dim/brighten 0.6 s; "one at a time" crossfade 0.35 s; all become instant under `prefers-reduced-motion`. Dark (default), light and high-contrast palettes follow the existing tokens (03); contrast is part of the audit. The reader exposes the current paragraph with `aria-current` and a polite live region ("Paragraph 14"), and every control is keyboard-operable.

## 4. Sync editor (mockup 07)
- **Tap to sync:** the tape plays (speed ≤1.25×); press `Space` (or the big Tap button) when each numbered paragraph *starts*. A marker is placed at that time **minus a configurable reaction offset** (default 0.25 s, calibrated by a two-tap test) and the next paragraph becomes the target. Undo removes the last marker.
- **Correct:** nudge ±0.1 s, drag markers on the **waveform/timeline** (peaks are computed once and cached), play from any marker, zoom, jump to the next low-confidence marker.
- **Regions:** mark **"no text here"** (intro, songs, prayer) and **"tape differs"** (text missing from the tape or extra speech). Skipped paragraphs ("not on this tape") get no time.
- **Auto-propose (later slice):** a progress view, then the same editor with **confidence** shown per marker (low-confidence first); the operator accepts or fixes.
- **Validation:** times must increase (except explicit repeats), the last must be within the tape's length, and gaps over a threshold (e.g. 6 min) are flagged.
- **Save / share:** saved with the recording; **export a timing file** (JSON: recording hash, language, paragraph → seconds; no text, no audio) to share with another church or put in a `.bornpack`.

## 5. Safety and resilience (church reality)
| Situation | Behaviour |
|---|---|
| Audio file missing / drive unplugged | the tape pauses; the screens keep the last paragraph; bar and phone say so with one button (find the file) |
| File truncated | preflight refuses to call it ready; at play time it plays up to the end and says "ended early" |
| Tape ends | the last paragraph stays until Clear |
| Text/audio drift | the sync pill goes amber if the screen's paragraph differs from the tape's for >5 s (e.g. the follower fell behind); one button re-syncs |
| Computer sleep | the tape pauses; on wake it stays paused at the last position; the screens re-sync; nothing plays by itself |
| Output device unplugged / changed mid-service | the tape **pauses** (never silently switches room); a prompt to pick the device (setting: "Pause the tape" / "Switch to default") |
| Phone seek by accident | the phone can only jump to a paragraph after a confirmation, and every jump has Undo on the operator screen |
| **Panic key** | **Esc** blanks the screens and the **tape keeps playing**; **Shift+Esc** blanks *and* pauses the tape; the phone's Blank only hides the words and says the tape is still playing; stopping the sound from a phone is not offered. *Why:* the recording is the service; a stray Esc must not silence it, and the operator still has a one-key way to stop it |
| Alerts during a tape | shown on room/stage as usual; they do not pause the tape |
| Streaming / OBS | Graphics shows the lower third (or highlight) but **never sound**; the sound reaches the stream via OBS application-audio capture (see the OBS page) |
| Offline | everything works with no internet once the text for the chosen language is cached (fetch it in advance, a preflight item) |
| Engine window crash | main restarts the audio window, resumes **paused** at the last position, and tells the operator |
Undo pattern: any change to the sync map or a jump gets the existing toast.

## 6. Phone remote (mockup 08)
Play/pause, back/forward 10 s, previous/next paragraph, volume, Blank; a **paragraph list that follows the tape** (current highlighted). **Safety, same as video:** *Play is refused until the operator has started that tape once on the computer* (the phone is never the first thing that makes sound); **no seek by dragging**; **jumping to a paragraph asks first** ("The tape is at ¶9. Jump to ¶14?") and is undoable on the computer; **no volume above the level the operator set** (the phone's volume control moves within ±20 % of it). The phone never edits the sync map.

## 7. Data model, compatibility, API, performance

### 7.1 Data
New tables in `media.db` (the media library database), versioned migrations like the existing ones:
- `audio_items` — the library file (extends `media_items.type` with `'audio'`, plus `duration_sec, codec, container, vbr (0/1), bitrate`).
- `sermon_recordings(id, sermon_id, media_id, language, label, duration_sec, created_at)`.
- `sync_maps(id, recording_id, text_language NULL, source ('tap'|'auto'|'imported'), created_at, updated_at)` and `sync_marks(map_id, paragraph_number, start_sec, confidence NULL, kind ('start'|'gap'|'skip'|'differs'))`. `text_language NULL` = the map for the recording's own language; a non-null row is an **override** for that text language.
- `tape_state(recording_id, position_sec, updated_at)` for resume.
Everything is keyed by **numbered paragraph** (after `splitSubParagraphs`), with "header" rows attached to the next number.

### 7.2 Files and older BORN
- A saved service (`.born`) is **unchanged**: the sermon paragraphs are ordinary quote items, so every older BORN opens it. The recording and its sync map are *not* queue items. In a `.bornpack`, add an **optional** `tape/` section (audio file + timing JSON) that older packs/builds ignore; a pack with audio is large, so the pack dialog's estimate shows it, and the audio is opt-in. The exported **timing file** is plain JSON.
- If a future queue item kind is ever added (for example "Sermon with tape"), use the **compat shell** (`ext` envelope in a `quote` row, `EXT_READERS`), and the plan requires the **real v1.13.0 reader test** (`src/test/shared/v1Compat.test.ts`) for it.

### 7.3 Automation API (additive, `/api/v1`)
`GET /api/v1/automation/tape` → `{ recordingId, status, position, duration, paragraph, nextParagraph, nextInSec, speed, volume, sync }` (also pushed on the existing WebSocket feed, `"v":1` message); `POST /api/v1/automation/tape/play|pause|back|forward|next-paragraph|prev-paragraph` (no seek-to-time, no volume above the operator's level); `GET /state` gains a `tape` field. No existing route changes.

### 7.4 Performance budget (modest Windows PC)
Audio engine position poll **10 Hz**; main → destinations **4 Hz** plus on every paragraph change (messages ≈150 bytes); a paragraph change re-renders **at most 3 paragraph elements** (previous, current, next) — the highlight view keeps a virtualised window of ~30 paragraphs (reuse `VirtualList`); scroll uses CSS `transform` on one layer; no per-frame React renders. Waveform peaks computed once off-thread (≈1 s per 10 min of audio), cached. Target: **<3 % CPU for the whole follow-along while playing a 2-hour tape**, +<40 MB memory. Auto-alignment (slice 8) is a separate, cancellable background job with a visible progress and low priority.
