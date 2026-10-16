# 1. Investigation — a "tape service" mode for Sermons

Part of the [sermon-audio design package](README.md). Written for the owner and the next engineer. **Nothing is built; no app code was changed.**
Branch `v2-sermon-audio-design`, from the tip of `v2-channels` (4a3e1c0). `v2-obs-live` was already merged there, so nothing was missing.
"Measured here" means measured on this Mac (Apple M4 Max, macOS 26) with generated test audio. "Must be checked with a real tape" is called out each time.

## 0. The short version

- **The text side is ready.** BORN already holds 1,218 sermons (104,644 text rows) offline, and fetches 65 other languages on demand. The blocking facts are about *identity*: a database row is **not** one paragraph (62 % of rows are ranges like "41-47" holding several numbered paragraphs), so timing must be keyed by the **numbered paragraph**, not the row.
- **The audio side is a new capability but a small one.** BORN has no audio player today. Chromium's `<audio>` is enough: seeking is exact for **M4A/AAC, constant-bitrate MP3, FLAC and OGG** and **wrong by up to 0.9 s for variable-bitrate MP3**, which is the format risk to design around.
- **The crux is timing data.** There is no public timing file. Primary path: **the operator taps once per recording** (reusable, shareable as times only). Fallback / accelerator: **local speech alignment** (whisper.cpp, MIT) proposes the times and the operator reviews them. In a generated-speech test it located 19 of 19 paragraphs with median error 0.11 s; **real old tapes are much harder and must be validated by the owner.**

## 1. How Sermons work in v2 today

### 1.1 Data model
- `src/main/schema.ts:9-70` — `sermons(id, date_code, title, total_sections)`, `paragraphs(id, sermon_id, paragraph_ref, paragraph_index, text)` + FTS5, `sermon_index(id, date_code, title, para_count, duration_min, is_book)`, and the on-demand translation cache `translated_sermons`, `translated_paragraphs(sermon_id, language, paragraph_ref, paragraph_index, text)`.
- The seeded database (`resources/sermons.db.gz`, English) was inspected for **counts only** (no text was copied): **1,218 sermons; 104,644 rows; median 84 rows per sermon (max 389)**. Row references: 37,262 single numbers ("12"), **65,079 ranges ("41-47")**, 2,303 non-numeric ("header", or empty). **908 sermons contain at least one range row.** `sermon_index.duration_min` is filled for 1,217 sermons: **median 93 min, maximum 377 min, 47 sermons longer than 150 min** (so "about 1–2.5 hours" is the norm but not the limit).
- A range row stores several numbered paragraphs inline; `splitSubParagraphs()` (`src/shared/queueItem.ts:180`) splits it at the inline numbers, and every surface (search preview, the phone, projection) already uses that split. `parseParagraphRef()` (`src/shared/paragraphRef.ts`) reads "41-47" as `[41, 47]`.
  **Consequence for tape sync:** the unit is the **numbered paragraph** (after `splitSubParagraphs`), plus "header" rows that carry no number. A sync map is `{ recordingId, paragraphNumber → startSeconds }`.
- Text comes from table.branham.org's REST endpoints (`src/main/tableApi.ts:9`) already used by the app (see the [counsel note](../../notes/sermon-audio-needs-counsel.md) — that integration's terms deserve the same review as audio).

### 1.2 How a sermon is shown today
- Browse/search lists (`SermonPanel`, `ChannelSermonsPanel`), and `SermonFollowView.tsx` — the whole sermon as cards, one per *numbered paragraph*, scrolled to the one you picked; clicking projects it, and the highlight follows Next/Prev. **This is the natural home for the "follow the tape" highlight.**
- Projection: one slide per paragraph page (`paginateText`, `MAX_SLIDE_CHARS = 240`, `src/shared/paginate.ts`); `liveNav.ts` ("keep pressing Next") walks the source — the next paragraph of that sermon — even if only one was queued. A **tape follower is a second driver of the same `liveNav` cursor**, driven by time instead of Next.
- Queue / recents: a sermon paragraph is a `QuoteItem` (`src/shared/queueItem.ts`); the used list is `recentQuotes` (`src/main/index.ts:1974`, `sermons:recent`); `noteSermonUsed` records it.
- Phone remote: `/api/search/sermons`, `sermonParagraphs`, `/command` project/next/prev (`src/main/webRemote.ts:142-152, 1062-1128`).
- Stage monitor: `StageApp.tsx` shows current/next text; for video it already shows a large *time left* and bar (`StageVideo`).
- Graphics/OBS: `webRemote.ts` Graphics page, `presentationProfiles.ts` (profiles are data: `fullscreen`, `lower-third`; each has its own `broadcastPagination`), `?profile=` per page (from the OBS work), SSE feed with keep-alive.

### 1.3 Where a "follow the audio" mode plugs into Channel / Profile / Destination
- A **Channel** is "what is live for an audience" (`channels` in `src/main/index.ts`, `patchChannel`, `setChannelBlank`). A tape service is channel state: *"this channel follows tape T at time t"*, like the video `PlaybackHub` record (`src/main/mediaPlayback.ts`).
- A **Destination** (congregation window, stage window, Graphics) only renders. The tape follower must not live in any destination.
- A **Presentation Profile** (`src/shared/presentationProfiles.ts`) is where "highlight view", "paragraph at a time" and "lower-third current paragraph" belong: each is a layout of the same content, as `fullscreen` and `lower-third` already are. New *behaviours* (scroll, lead time) are channel settings; new *layouts* are profiles.
- The current "paragraph" is already a first-class thing on a channel (`SlidePayload.source = { kind:'quote', sermonId, paragraphRef, page }`; `cascadeFollowSlide` keeps other channels in step). The tape follower simply calls the same "show this paragraph" function as the operator's click.

## 2. Languages

- 65 languages have sermon **text** (`src/shared/sermonLanguages.ts`, found by probing the source; code = ISO 639-1). English is local; the rest is fetched on first use and cached (`translated_paragraphs`, `src/main/index.ts:2630-2720`). Right-to-left: Arabic, Persian, Urdu. Many need non-Latin scripts (Amharic, Burmese, Khmer, Thai, Tamil, Telugu, Hindi, Chinese, Japanese…). BORN bundles only Inter and JetBrains Mono (`src/renderer/src/assets/fonts`); everything else comes from the operating system's fonts, so **non-Latin text depends on the church PC having a font for it** (a preflight check, see the plan).
- **What "language" means in the UI today:** a Bible translation per channel (`channelTranslations`, with `TRANSLATION_SERMON_LANGUAGE` mapping KJV→en, FRLSG→fr…, `src/main/index.ts:1287`) and a language argument to `browse:sermon-paragraphs`. A following channel re-resolves a paragraph by **paragraph reference** (`resolveFullParagraphText`, `index.ts:2900-2960`): exact `paragraph_ref` match, else it finds the range row containing the number and splits it. **So the codebase already assumes that paragraph number N means the same paragraph in every language.**
- **Does it hold?** Not verified for any translation here (the seeded DB has 0 cached translations and the rule is not to scrape at scale). Translators number paragraphs to match the English edition, but counts can differ (merged/split paragraphs, headings). The design therefore treats matching as an **assumption to verify per sermon**: compare paragraph counts and the list of numbers; show a plain warning and the list of differences (mockup 06). Fallback when they differ: (a) use the tape's map only for the numbers both have; (b) the operator adjusts in the sync editor — the text language gets its **own overrides on top of the tape's map** (a small "this paragraph in French starts where English ¶113 starts" table).
- **Use cases and slices**
  | Case | In scope | Slice |
  |---|---|---|
  | (a) English tape, English text | yes — the core | S1–S5 |
  | (b) English tape, translated text on the screen (interpreter in the room) | yes, same tape and map, other text | S6 |
  | (c) A dubbed/translated recording with its own audio and its own timing | yes — its own recording and map; text language chosen independently | S6 |
  | (d) Two languages side by side on the projector | design now, build later | after S6 |
- The player bar's "language" button in the reference app switches the *recording*. In BORN it opens a small picker with two independent choices — **Text** and **Tape** — because they are independent (mockup 06).

## 3. Audio in the app today

- **No audio playback exists.** `shared/media.ts:194` returns "Audio arrives in a later version of BORN" for an audio file (`unsupported-audio`); `docs/design/media/05-roadmap.md` lists audio as out of the media phases. `media_items.type` is `'image' | 'video'` (`src/main/mediaSchema.ts:32`).
- **Reusable:** the managed library (copy by default, SHA-256 identity, soft delete, linked-in-place with drive-offline handling), preflight ("Is tonight ready?"), `born-media://` with Range (206/416) for seeking, `.bornpack` service packs (`src/main/servicePack.ts`), and the playback record + phone/panic rules (`PlaybackHub`).
- **Output device:** Chromium supports `HTMLMediaElement.setSinkId()` (Electron 33 = Chromium 130), so the operator can choose the output (the sanctuary speakers) per audio element. Not used anywhere yet; to be tested on the church PC (Windows exclusive-mode and multi-output cases).
- **Who owns the audio clock?** With video, the congregation window is the leader (it is the thing that plays). A sermon tape must keep playing when that window is closed, blanked, moved to another display, or crashes, and the stage monitor and phone need the clock too. **Decision: a dedicated audio engine in its own hidden window** (a `BrowserWindow` with `show:false`, `backgroundThrottling:false`, like `mediaDecoder.ts` / the YouTube probe window), owned by the main process. It reports position ~4× a second and on every event; the main process keeps one **tape record per channel** (the same shape as the video record: `status, position, at, duration, volume, speed, epoch, hasPlayedOnce, error`). Every destination follows that record; none is a leader. If the engine window dies, main restarts it and resumes at the last position, paused.
- **Coexistence with video/YouTube:** one **sound source live at a time**. Taking a video or YouTube item while a tape is playing **pauses the tape** and says so on the bar (the setting "Volume when a video plays: Tape pauses / Tape off"); never mix two programmes by default. Ducking is a later option, not default.

## 4. Where the timing data comes from

| | A. Operator taps once | B. Automatic alignment on the church PC | C. Import timing from a publisher | D. Hybrid (B proposes, operator corrects) |
|---|---|---|---|---|
| Works offline, any recording, any language | yes | yes (language-specific models) | n/a | yes |
| Accuracy | as good as the operator (±0.2 s) | see below | would be best | high |
| Effort per recording | 10–20 min of listening, once | minutes of compute + 5–10 min review | none | the lowest total |
| Risk | tedious for 100+ tapes | wrong on noisy/accented tapes | **no public source found** | needs both |
| Rights | none (times only) | none (runs locally; model licence MIT/Apache) | unknown | as B |

**C — public information only.** The rights holder's public audio page (branham.org/en/messageaudio, read 2026-10-16) offers downloads of "all of Brother Branham's sermons" in about 70 languages as **M4A** files and **PDF** text; the footer says "Copyright © 2026 Voice Of God Recordings, All Rights Reserved" and links a Privacy Policy and a **Permission Request** page. It mentions **no captions, transcripts or timing files**, and it states no download terms on that page. table.branham.org's page text exposed nothing about terms or an API. So **no timing data is available to import**, and nothing from another app may be used. (Searches for terms returned only third-party pages; the counsel note lists what to ask.)

**B — measured here.** whisper.cpp (MIT, `ggml-tiny.en` 78 MB, `ggml-base.en` 148 MB) on a generated test (macOS "Samantha" voice reading public-domain Bible text, 19 paragraphs, 319 s, with: a 22 s music intro, random gaps, 25 s of "singing" with no text, a paragraph present in the text but **missing from the tape**; then degraded to sound like an old tape — 250–3200 Hz band-limit, pink noise, 60 Hz hum, hall echo, compression). The recogniser's words were matched to the known text (word-level diff) and each paragraph's start = its first matched word's time.
| Model / audio | Words matched | Paragraphs located | Start error median / p90 / max |
|---|---|---|---|
| tiny, clean | 91 % | 19/19 | 0.13 / 1.6 / 12.2 s |
| base, clean | 92 % | 19/19 | 0.26 / 1.1 / 5.6 s |
| tiny, degraded | 80 % | 19/19 | 0.11 / 1.8 / 27.4 s |
| **base, degraded** | **85 %** | **19/19** | **0.11 / 0.28 / 1.75 s** |
The paragraph missing from the tape was **correctly not located** (so a mismatch is detectable). Speed on the M4 Max: 319 s of audio in 2–6 s with the GPU; **CPU-only with 2 threads: 6 s (tiny) and 10 s (base)** — 32–54× real time. A modest Windows PC is unmeasured; if it is 5–10× slower than this, a 2-hour tape takes roughly **12–40 minutes** for the base model (an estimate, to be measured).
**What this does not tell us:** the test voice is clean modern speech. Real sermon tapes (accent, 1950s tape noise, audience, reverb, long prayers, many "whoops" and ad-libs that are not in the text) are harder; accuracy will be lower and the *text may not match the speech word for word*. The English models also do not cover the 64 other languages equally well. **Must be validated on a real tape** (see §7).

**Recommendation.** **Primary: A (tap to sync), as a fast, well-designed editor**, because it is certain, offline, works for every language and recording, produces a reusable sync map, and every other option still ends in the same editor. **Accelerator, then fallback: D** — automatic alignment *proposes* (with a confidence per paragraph), the operator reviews the low-confidence ones first. B alone is never trusted without review. C does not exist today; the design keeps the sync map a plain times-only file so a publisher-supplied one could be imported later if the owner obtains permission.

**When audio and text do not match exactly**
| Situation | What the model and editor do |
|---|---|
| Intro/music/prayer with no text | a **"no text here" region**: the screen keeps the last paragraph (or shows the title card); the map stores `gap` markers |
| Tape edited; paragraphs missing | the paragraph has **no time**: flagged "not on this tape"; the highlight skips it |
| Repeated section on the tape | the map allows a **non-monotonic jump** only if the operator marks it; otherwise times must increase (validated) |
| Long song/prayer in the middle | gap region; auto-alignment is restricted to a window between its neighbours |
| Text has "header" rows | headings take the time of the next numbered paragraph |
| Tape starts mid-sermon | the first timed paragraph is not 1; paragraphs before it show as "before the tape" |

## 5. Audio formats and seeking — the spike (measured here)

Method (a throwaway Electron page, not merged): 2-hour test files built with ffmpeg 6.0 from a track with a **tone burst every second whose pitch encodes that second** (so the audio itself says where it is); in **Electron 33 / Chromium 130** the page seeks to eight positions from 12.3 s to 7195.2 s, plays, and a Web Audio analyser detects the first burst onset; the onset's offset from the whole second, read against `currentTime`, is the landing error. A **constant** offset (about 30 ms here = analyser/output latency) means exact; scatter means inexact. Ranges are served with 206 responses, like `born-media://`.
| Format (2 h) | File size | Seek landing (offset from the whole second) | Verdict |
|---|---|---|---|
| **M4A / AAC-LC 64 k** (faststart) | 11.6 MB | 22–35 ms, constant | **exact** |
| M4A, index at the end (not faststart) | 11.6 MB | 24–35 ms | **exact** (metadata ready in 15 ms) |
| MP3 CBR 64 k | 57.6 MB | 2–35 ms | exact within ±35 ms |
| FLAC | 15.2 MB | 2–9 ms | exact |
| OGG Vorbis (q2) | 3.0 MB | 0–10 ms (and −10…−18 ms) | exact |
| **MP3 VBR (with Xing header)** | 32.4 MB | **31–941 ms, scattered** | **not exact — up to 0.9 s** |
| **MP3 VBR without a seek table** | 32.4 MB | **50–770 ms, and the length reads 6,917.6 s instead of 7,200 s (4 % short)**; seeks past 6,917 s clamp | **unreliable** |
| WAV 44.1 kHz mono 16-bit | 635 MB | Chromium refused the 2 h file ("Format error"); a 10-minute WAV of the same kind worked (3–8 ms) | **not for long files** |
Other measurements (same runs, all formats that loaded):
- **Seek latency:** 0–9 ms for AAC/CBR/FLAC/OGG; 6–40 ms for VBR (local file, Range requests).
- **Time updates:** the `timeupdate` event fires **every ≈266 ms (3.75 Hz)**; polling `currentTime` in an animation frame sees it change every **8 ms** (≈120 Hz). A highlight needs paragraph-level precision (≥0.1 s), so **a 10 Hz poll of `currentTime` in the audio window** is plenty; do not rely on `timeupdate` alone (a paragraph change could lag 0.27 s).
- **Clock drift:** over 6 s of playback `currentTime` stayed within ±10 ms of the wall clock.
- **Playback rate** (0.75, 1.25, 1.5, 2): measured speed was within 1 % of requested (e.g. 1.5 → 1.49); `preservesPitch` was on by default.
- **Very long files / memory:** Chromium streamed the files; the tab process grew from ≈105 MB to ≈116–133 MB across a full set of seeks on a **2-hour** file (the 635 MB WAV, which failed to open as 2 h, aside); no full-file load.
- **Start-up:** metadata ready in **4–31 ms**. (A true "press Play to first sound" latency was not separable from waiting for the next test burst; expect tens of milliseconds locally.)
- **Not measured here:** subjective quality of rate change, memory over a *playing* 2-hour session, behaviour on Windows.
**Consequences for the design:** accept **M4A (AAC), MP3, FLAC, OGG**; **prefer M4A** (it is also what the rights holder publishes); **warn on VBR MP3** ("this file's length and position may be off by up to a second; convert to M4A") — detect it at import by checking the Xing/VBRI header and comparing the container length with the decoded length; **refuse or warn on very long WAV**; always verify with the browser's `duration`.

## 6. Sources of audio

| Source | Proposal |
|---|---|
| A file on the church computer (managed copy / linked) | **First and only for v1 of the feature.** Same import flow as pictures/video: copy by default, hashed, drive-offline handling, preflight. |
| A downloaded file | The operator downloads from the rights holder's own page in a browser, then chooses it. BORN does **not** fetch it for them (mockup 02). |
| Streaming | **Not proposed**: needs the internet for the whole service and the rights holder's permission (counsel list). |
**Preflight ("Is tonight ready?")** adds, per tape: file present (and drive connected); file **whole** (container length vs. size; the M4A `moov`/MP3 frame scan, as MP4 video does); **decodable** (the browser opens it and reports a duration); **duration plausible** vs. `sermon_index.duration_min` (e.g. ±8 min); a **sync map exists** and covers ≥90 % of the paragraphs; **text/tape agreement** (paragraph count and numbers vs. the chosen text language); the **output device** from settings is present; a non-Latin **font** exists for the text language.

## 7. What the owner should provide or test (real-world gaps)

1. **One real tape** (any sermon's audio file, M4A or MP3) **and the sermon's text language** — to measure real alignment accuracy, real seek behaviour on a real encoder, and how a real tape differs from the text.
2. **The church PC's audio output setup** (which device, any mixer/USB interface) — to test device selection and loss.
3. The **real Windows church PC**: alignment speed with the base model (the 12–40 minute estimate), long-file memory, and `setSinkId` behaviour.
4. A translated text the church actually uses (for paragraph-number agreement).

## 8. Other constraints in the code
- **Undo:** queue edits use the Undo toast (`queueUndo.ts`); a **jump of the tape is not a queue edit** — it gets its own "Jumped to ¶14 · Undo" toast that returns the tape *and* the screens to the previous position.
- **Panic key** (`attachOperatorShortcuts`, `src/main/index.ts:730-751`; Esc and B call `setChannelBlank('main', …)`; `playbackHub.blank()` pauses video): for a tape, **Esc blanks the screens and the tape keeps playing**, because the sound is the service and cutting it on a stray key press is worse; **Shift+Esc blanks and pauses**. Rationale in the product design.
- **History logging:** use `noteSermonUsed` when a tape-driven paragraph first goes live, plus a "last position" per recording for resume.
- **Stage monitor:** reuse the `StageVideo` pattern (large time + bar) and add current/next paragraph and a sync pill.
- **The Remote's open-network model** (no authentication unless the automation token is set): any phone on the network can send commands. Tape commands therefore follow the video rules (no first Play with sound, no seek by drag, jump asks first) and are listed in the automation API; the token should be recommended for churches with open Wi-Fi.
- **Compatibility:** a tape attachment lives beside the sermon (new tables, §02 of the design), **not** inside queue items, so older BORN builds never see an unknown item kind; a saved service that contains a sermon with a tape keeps its ordinary quote items. Where a new queue kind is ever needed, use the existing compat-shell pattern and test against the real v1.13.0 reader.
