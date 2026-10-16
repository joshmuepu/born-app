# 4. Build plan — small slices

Part of the [sermon-audio design package](README.md). Each slice is independently useful and testable. Sizes: **S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ 2–4 weeks (one engineer). Every slice keeps the suite green, adds a contrast check for any new screen, follows the safety rules in 02, and **never changes the `.born` format** (tape data lives in its own tables).

**Earliest usable "tape service" = S1 + S2 + S3 + S4 + S5a (≈ 6–8 weeks): attach a file, play it with a proper player, tap to sync once, and see the highlight follow on the operator screen and the projector's highlight view.** Slices 1–2 alone already give "play the tape from BORN". Slice 3 alone gives a reusable sync map.

## Order and dependencies
```
S0 (done: this design)   S1 recordings+library+preflight ─┬─ S2 audio engine + player bar ─┬─ S4 follow in reader ─ S5a highlight view
                                                          └─ S3 sync map + tap editor ─────┘        └ S5b one-at-a-time ─ S5c lower third/stage/Graphics
                                                                           S6 languages ─ S7 phone ─ S8 auto alignment ─ S9 hardening
```

## S0 — Feasibility folded in (done)
Results are in [01-investigation.md](01-investigation.md): formats and seek accuracy; alignment numbers; no publisher timing data. **Decisions carried into S1–S3:** prefer M4A; warn on VBR MP3; refuse long WAV; position poll at 10 Hz in a dedicated audio window; sync map keyed by numbered paragraph; tap-to-sync primary.

## S1 — Recordings: attach, library, preflight (M)
*Visible:* "Add tape…" on a sermon; the file is copied/linked, checked in plain words; Media shows an "Audio" area; "Is tonight ready?" lists tapes.
Includes: `audio_items` + `sermon_recordings` migration; import (extensions, container/codec read, VBR/Xing detection, length vs. container check; refuse long WAV); managed copy/linked with drive-offline; the `sermon_index.duration_min` plausibility check; the `unsupported-audio` message replaced.
*Automated tests:* importer (each format, truncated, zero-byte, VBR with/without header, renamed non-audio, long WAV); migration 2→3 keeps rows; preflight rules table; `.bornpack` unaffected (tape section optional); real **v1.13.0 reader opens a `.born` saved while a tape is attached** (nothing new in the file).
*By hand (church PC):* import a real tape from USB, unplug the drive, plug it back.
*Risks:* VBR detection false positives; large linked files on slow USB.
*Ships alone:* yes (attach + check).

## S2 — Audio engine and operator player bar (M)
*Visible:* play/pause, ±10 s, previous/next paragraph (no-ops until S3), speed, volume, output device, time/total, seek bar, resume position.
Includes: the hidden audio window + the per-channel **tape record** in main (reusing the `PlaybackHub` pattern and reducers in a new `shared/tapePlayback.ts`); 10 Hz position; `setSinkId` device list + remember; device-loss pause; engine-crash restart; "one sound source" rule with video/YouTube; Esc / Shift+Esc rules; resume; keyboard shortcuts.
*Tests:* pure reducers (play/pause/seek/rate/end/error/blank), engine ↔ main message contract with a fake audio element, device-loss, crash-restart, video-pauses-tape rule, panic rules (Esc keeps tape playing, Shift+Esc pauses), renderer component tests (bar states, a11y), contrast. *Real-app check:* the investigation's burst-track method (re-created as a test helper, described in 01 §5) to assert seek landing ≤60 ms for M4A/CBR on Electron.
*By hand:* real speakers, unplug the device mid-play, sleep/wake, a 2-hour tape for 30 minutes.
*Risks:* Windows device handling; sleep/wake.
*Ships alone:* yes — "play the tape from BORN".

## S3 — Sync map storage and the tap-to-sync editor (M–L)
*Visible:* "Tap to sync" on a tape; the timeline/waveform editor (mockup 07); save; export/import the timing file.
Includes: `sync_maps/sync_marks`; the paragraph list of a sermon in numbered-paragraph form; tap with reaction offset + calibration; nudge/drag/undo; regions (no text / differs / skip); validation; waveform peaks job; timing-file export/import; "Is tonight ready?" item "tape has timing".
*Tests:* map validation (monotonic, bounds, gaps), reaction-offset maths, undo stack, serialisation round-trip, `splitSubParagraphs` keying (range rows, "header" rows), editor component tests (keyboard-only), import of a malformed timing file.
*By hand:* sync one real 1-hour tape and time it (target: ≤ 20 minutes for a 2-hour tape; owner records the real time).
*Risks:* the editor's speed is the product; waveform cost on long files.
*Ships alone:* yes (reusable sync maps; shareable timing).

## S4 — Follow-along in the operator reader (S–M)
*Visible:* the highlight moves with the tape; auto-scroll; follow/free-browse; click a paragraph to jump; jump Undo.
Includes: a tape driver for the `liveNav` cursor; reader highlight/scroll; the "Reader follows" switch; "Projector follows" plumbing (the paragraph goes live through the normal path so history, favourites and followers behave).
*Tests:* paragraph-at-time function (boundaries, gaps, skipped paragraphs), cursor driver vs. `liveNav`, scroll-follow component tests (follow off on manual scroll; back-to-tape), Undo of jump, history (`noteSermonUsed` once per paragraph).
*Risks:* scroll jank in long sermons (use the virtualised window).

## S5 — Projection modes (L, in three parts)
- **S5a Highlight view** (profile `tape-highlight`): palettes, auto-scroll, dim levels, large number, paging of long paragraphs by tape progress.
- **S5b One at a time** with "next early" lead and the countdown bar.
- **S5c Lower third, stage monitor, Graphics/OBS**: a `tape-lower-third` profile (own pagination), the stage layout with now/next/time and the sync pill, `?profile=` support for the new profiles, SSE messages for the tape record.
*Tests:* profile data tests (like `presentationProfiles`), rendering component tests per theme, **contrast audit on rendered pixels** (dimmed text per palette), long-paragraph paging maths, lead-time switching, Graphics page script tests (as `webRemoteGraphics.test.ts`), real OBS check (the OBS test harness) for latency and the transparent lower third.
*By hand:* a real projector from the back of the hall; the stage monitor; OBS on the church PC.
*Ships:* S5a alone makes a usable tape service.

## S6 — Languages (M)
*Visible:* separate Text and Tape pickers; mismatch warning with the list; per-language overrides; translated-text-on-English-tape; dubbed-recording maps; RTL/non-Latin checks; font preflight; (later) side-by-side.
*Tests:* agreement checker (counts/numbers/range rows), override table, RTL rendering snapshots (Arabic, Persian, Urdu), a font-presence check, a fixture of two languages with different paragraph counts.
*By hand:* a real translated text with a real tape; owner confirms numbering agreement for the languages they use.
*Risks:* the unverified assumption that numbering matches; fonts on Windows.

## S7 — Phone remote and automation API (S–M)
*Visible:* the tape screen (mockup 08); `/api/v1/automation/tape*`.
*Tests:* command rules table (Play refused before first operator start; jump asks; no seek-by-drag; volume bound), `/state` and WebSocket payloads, version/alias tests like `apiVersioning.test.ts`, WebKit and Chromium page checks.

## S8 — Automatic alignment (L, optional)
*Visible:* "Propose automatically" with progress; the editor shows confidence; low-confidence first.
Includes: whisper.cpp as an **optional download** (not bundled: ~80–150 MB models; MIT licence; model licences reviewed), run as a cancellable background process; word diff against the known text; windowed alignment between gaps; confidence; language support table (English models first).
*Tests:* alignment on generated-speech fixtures (the investigation's method, committed as small fixtures only if licence-clean), tolerance table (median/p90 error), mismatch detection (paragraph missing from the tape), cancel/resume, a CPU-only speed benchmark on the Windows build.
*By hand:* **one real tape** (the owner's), real accuracy and the real minutes on the church PC.
*Risks:* real-tape accuracy; model size; non-English models. *Only worth building if S3's tap time (measured with real tapes) is a pain.*

## S9 — Hardening (M)
Device loss, sleep/wake, a **long-run stability test** (a 2-hour tape, memory/CPU log), the packaged Windows build on the church PC, the contrast audit for every theme, the manual page "Using the tape service" (offline), the **"Is tonight ready?" integration** for all tape checks, and the by-hand matrix. Add the real-v1.13.0 reader check to the suite for any queue/pack change made in S1–S8.

## Cross-cutting tests (every slice)
Typecheck + full suite + production build; the isolated-profile packaged smoke script; the `themeContrast` test extended; `git status` clean of media (no audio, no sermon text in fixtures — fixtures use generated audio and public-domain text).

## Risks and what could change the plan
| Risk | Effect | Mitigation |
|---|---|---|
| VBR MP3 tapes common in the wild | seeks off by up to 0.9 s | warn at import; recommend M4A; (later) a one-time conversion if the owner supplies permission/a tool |
| Real tapes defeat auto-alignment | S8 less useful | S3 is complete on its own; keep S8 optional |
| Paragraph numbering differs across languages | wrong highlight in translated text | agreement check + overrides (S6) |
| Windows audio device quirks | tape plays in the wrong room | pause-on-loss default; by-hand device test |
| Rights questions | scope of S1/S8 sharing | [counsel note](../../notes/sermon-audio-needs-counsel.md); local files only until answered |
