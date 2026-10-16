# Tape service — build progress

Branch `v2-sermon-audio` (from `v2-sermon-audio-design`). **Not merged.** Spec: `docs/design/sermon-audio/` (README, 01–04, mockups). Resume: read this file, `git log --oneline v2-sermon-audio-design..v2-sermon-audio`, run `npm test`.

## Test tape
`~/Downloads/65-0418M It Is The Rising Of The Sun VGR.m4a` (owner's file — never moved or modified; work on a copy in `/tmp/born-tape-work/tape.m4a`). Measured: M4A (AAC-LC, mono, 44.1 kHz, 33 kb/s), 38,458,111 bytes, **2:24:47.89**, `moov` first (faststart), cover art, boxes ftyp/moov/free/mdat. Sermon id **1115** (65-0418M "It Is The Rising Of The Sun"): 133 text rows (113 ranges, 1 "header"), `duration_min` 145. Only numbers about it are ever reported.

## Architecture decisions (deviations from the design are marked ⚑)
- ⚑ Tape data lives in its **own database `tape.db`** (new tables only; `PRAGMA user_version` migrations like `media.db`) instead of extra tables in `media.db`: the media library is picture-centric (width/height/thumbnails, the Media UI lists every row), so audio there would leak into the pictures UI. Same safety property (older BORN never sees it; `.born` unchanged); deleting a recording never touches sermon data (separate DB).
- Files: managed copy in `<userData>/tapes/<sha256>.<ext>` (copy by default), or linked in place.
- Audio engine: a hidden renderer page `audio.html` (own `BrowserWindow`, `show:false`, `backgroundThrottling:false`) is the clock owner; files served by the existing `born-media://` protocol (new `tape` host, Range-capable). Main keeps the tape record (reducers in `shared/tapePlayback.ts`).
- The numbered paragraph is derived from `quoteToItem(row).slides[].marker` (the same split the reader and projector use), so a sync map always agrees with what the operator sees.
- Following: main turns tape position into a normal slide payload (`slide.tape` carries view data) and sends it through `showChannelSlide`, so history, other channels, Graphics and stage keep working.

## Slices
| Slice | Status |
|---|---|
| S1 attach/import, filename matching, preflight | **done** (tests: +64; real tape: import 53 ms, 2:24:47.89, exact match to sermon 1115, original untouched) |
| S2 audio engine + player bar | **done** (suite 1366 → 1418) |
| S3 sync map + tap editor | — |
| S4 follow-along in the reader | — |
| S5 projection (a highlight, b one-at-a-time, c lower third/stage/Graphics) | — |
| S6 languages | — |
| S7 phone remote + automation API | — |
| S8 automatic alignment | — |
| S9 hardening, docs, OBS, packaged check | — |

## Log

### S1 (done)
- `src/main/audioProbe.ts` (M4A/MP3/FLAC/OGG/WAV reader: length, whole-file, VBR + seek-table, WAV size), `tapeDb.ts` (tape.db), `tapeLibrary.ts` (import, copy, link, folder scan, preflight), `tapeService.ts` (IPC, `born-tape://` protocol), `shared/tape*.ts`, `TapeAttach.tsx`, tape chip in `SermonFollowView`.
- Filename matching tolerates "65-0418M Title VGR", "VGR_65-0418M_Title", "650418M", lowercase suffix; a code without its letter is ambiguous (asks).
- "Get audio" opens https://branham.org/en/MessageAudio in the browser (no in-app download).
- Test helper: `BORN_TEST_PICK_TAPE` / `BORN_TEST_TAPE_FOLDER` answer the pickers in dev/test only.
- Real app run script: scratchpad `tape-start.sh` (isolated profile `/tmp/born-tape-profile`, port 4398, CDP 9346).

### S2 (done)
- `shared/tapePlayback.ts` (record + reducers), `main/tapeHub.ts` (hub; one sound source; resume position every 5 s; phone rules), hidden engine page `renderer/audio.html` + `src/audio.ts` (clock owner; seeks only on epoch change; 4 Hz reports; device loss), `tapeService.ts` (engine window, IPC, sleep/wake), `TapeBar.tsx` + `useTape.ts`, Shift+Esc / Esc rules and video-pauses-tape in `index.ts`; plain-words notices now reach the operator (`operator:notice` toast, which was previously not shown).
- **Real tape, real app (Chromium 130 in Electron):** loads in <3 s paused at resume position; position tracks wall clock within 40 ms over 5 s; 1.25× advanced 4.96 s in 4 s; device list shows names (5 outputs incl. built-in speakers, 2 HDMI monitors, Teams virtual); play/pause/seek exact.
- **Seek accuracy on the real tape** (30 seeks, 0 → 8680 s, captured audio cross-correlated against an ffmpeg reference decode): constant offset −86 ms (output/capture latency), **stdev 32 ms** (one 4096-sample capture block = 93 ms), **no drift with position** (first 8 seeks median −77 ms, last 8 −86 ms); seek returns in 0–2 ms. One capture (5522 s) had no usable correlation (silence) and is excluded. VBR/seek-table check on the tape: AAC M4A, not applicable (index first, whole). Method script lives outside the repo (/tmp/born-tape-work/seek).
- Deviation: tape not auto-loaded on opening a sermon; Play on the bar loads it (so nothing starts or occupies the audio window until asked).
