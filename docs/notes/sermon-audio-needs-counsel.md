# Sermon audio ("tape service") — what needs counsel or the owner

Written for the owner. Information, not legal advice. Design only; nothing is built. Sources: the rights holder's public audio page (branham.org/en/messageaudio, read 2026-10-16), and the existing BORN code.

## What is safe to build before counsel
- A **local audio player** for files the church already has, with sync maps made by the church itself (times only).
- A **timing editor** and a **times-only** export (no text, no audio).
- Local **speech alignment** on the church computer (optional download), producing times only.
- Mockups, the manual, tests with **generated audio and public-domain text**.

## Questions for counsel
1. **Rights to the audio.** The publisher's page says "All Rights Reserved" and offers downloads and a **Permission Request** page. May a church play a downloaded recording publicly in a service, and from a product like BORN? Is a licence or permission needed for the *product* (distributing software that plays it) as opposed to the *church* (using a file it downloaded)?
2. **Rights to the text.** BORN already shows sermon text fetched from table.branham.org's REST endpoints (`src/main/tableApi.ts`). The terms for that use were not found in public pages. Does the existing integration, and a follow-along view of it, need written permission? (This predates the tape feature but the feature makes the dependency more visible.)
3. **Downloading and streaming terms.** *Update 2026-10-17, at the owner's request:* **Get audio** now downloads one recording from the publisher's own stream page on the operator's click (the file its "Download Audio" button offers; English; saved in the church's Tape audio folder; never bulk, never cached elsewhere). The question below now applies to that button. *Original design:* BORN did **not** download or stream the audio itself (the operator saves the file from the publisher's own page, then chooses it). Confirm that is acceptable, and say what would be needed before an in-app "download" or "stream" button.
4. **Timing data.** None was found published. If the publisher has timing/caption data, how can BORN get it with permission? Is a church-made sync map (times only, no text) a derivative work, and may churches **share** such files with each other (including inside a `.bornpack`)? Is an exported timing file that names the recording (by its file hash and sermon id) acceptable?
5. **Speech-recognition models.** whisper.cpp is MIT; the Whisper model weights are published by OpenAI under the MIT licence; **the app now ships whisper.cpp (MIT) and the `ggml-base.en` model file inside the installer (decision recorded 2026-10-17: the owner asked for the recogniser to be bundled so operators never configure it) — counsel to confirm the licence text for those exact files and add the notices to the third-party licences,** and whether recognised text (kept only in memory to compute times) is a copy of the sermon text.
6. **Public performance.** Playing a recording to a congregation, and **streaming** it (the stream captures the room or the lower third): separate rights from any download licence (as with YouTube video). BORN makes no claim anything is cleared.
7. **Trademark and design copying.** The feature concept (a sermon reader whose current paragraph follows the audio) is general; BORN's look, wording, icons and layout are original and must stay so. Do not use another app's name, branding, assets, private APIs, data or timing files. Counsel may want to review the final screens against the reference app.
8. **Privacy.** The tape position and "recently used" are stored locally only. Nothing is sent anywhere.

## Owner decisions needed
- Which audio formats to support first (recommended: M4A, MP3, FLAC, OGG; warn on VBR MP3; no long WAV).
- Whether an optional alignment model may be offered as a download (S8), and whether to build S8 at all.
- Who owns real-tape validation (one real tape + its text language; the church PC's audio output setup).
