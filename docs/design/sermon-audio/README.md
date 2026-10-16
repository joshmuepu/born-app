# Tape service — design package

**What it is.** The church plays a sermon's recording (the *tape*) while BORN shows the sermon text and **the text follows the audio**, highlighting the paragraph being spoken, on the operator screen, projector, stage monitor, livestream and phone. Design and plan only: **nothing is built**. Branch `v2-sermon-audio-design` (not merged).

| Read | What |
|---|---|
| **[mockups/index.html](mockups/index.html)** | 11 clickable screens (a pretend tape runs at 12×; Space plays; click a paragraph to jump) |
| [01-investigation.md](01-investigation.md) | what the code has today, languages, audio spike numbers, alignment numbers, where timing data can come from |
| [02-product-design.md](02-product-design.md) | operator experience, projection modes, languages, sync editor, safety, phone, data, API |
| [03-visual-design.md](03-visual-design.md) | colours (tokens), projector palettes, type, motion, contrast audit plan |
| [04-build-plan.md](04-build-plan.md) | slices S1–S9 with tests, by-hand checks, risks |
| [../../notes/sermon-audio-needs-counsel.md](../../notes/sermon-audio-needs-counsel.md) | rights and terms questions; what is safe before counsel |
| [../../notes/sermon-audio-v1.md](../../notes/sermon-audio-v1.md) | what v1 would need (not planned) |

## Recommendation in 10 lines
1. **Timing data:** the operator **taps once per recording** (primary) in a fast sync editor; the result is a reusable, shareable *times-only* sync map. No public timing data exists.
2. **Fallback/accelerator:** local speech alignment (whisper.cpp, MIT) **proposes** times with a confidence; the operator reviews. In a generated-speech test it found 19/19 paragraphs, median error 0.11 s — **real old tapes must be validated by the owner**.
3. **Key identity fact:** 62 % of sermon rows are ranges ("41-47"); sync is keyed by the **numbered paragraph**, not the row.
4. **Audio:** Chromium's `<audio>` in a **dedicated hidden audio window** (the clock is independent of every projection window); prefer **M4A/AAC**; seeking is exact for M4A/CBR MP3/FLAC/OGG; **VBR MP3 is off by up to 0.9 s** (warn); long WAV refused.
5. **Projection:** profiles — *Highlight view* (first), *One at a time* with "next early", *Lower third*, and a *Stage monitor* layout; per Destination; `?profile=` works for OBS.
6. **Safety:** one sound source at a time; **Esc blanks, the tape keeps playing**, Shift+Esc also pauses; phone Play refused until the operator started it; jumps ask first and are undoable.
7. **Languages:** Text and Tape are chosen separately; the map applies to any text whose paragraph numbers match, with a warning and an override table when they don't; RTL and non-Latin handled per paragraph.
8. **Data:** new tables beside the media library; `.born` is unchanged, so every older BORN opens saved services; optional tape section in `.bornpack`.
9. **Order:** S1 attach → S2 player → S3 tap editor → S4 reader follow → S5a highlight view = **first usable tape service (≈6–8 weeks)**; then S5b/c, S6 languages, S7 phone, S8 auto-align (optional), S9 hardening.
10. **Needs from the owner:** one real tape + its text language, the church PC's audio output setup, answers to the counsel note.
