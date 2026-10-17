# Running a tape service

Some services play a **recorded sermon** — a message from the tape — while the congregation follows the text. Born Again plays the recording **and** keeps the text in step with it:
the paragraph being spoken is highlighted on your screen, on the congregation screen, on the stage monitor and on a Graphics (OBS) output.

Everything stays on this computer. Born Again **does not download or stream** recordings — you bring your own audio file (the **Get audio** button opens the publisher's page in your browser).

## Getting ready (once per recording)

1. **Open the sermon** in **Sermons** and press **Add the recording**. Pick the file, drop it on the window, or choose your **Tape audio folder** once and let Born Again find recordings in it.
   File names like `65-0418M It Is The Rising Of The Sun VGR.m4a` are matched to the sermon by their date code; if it is not certain, Born Again asks you to confirm.
2. Born Again **checks the file** (it must be complete, with a length that fits the sermon) and keeps a **managed copy**, so a missing USB stick never breaks a service.
   **M4A/AAC** is best. A **variable-bit-rate MP3** can be a second off when you jump around (you are told when you add it). Very large **WAV** files are refused (convert them to M4A or FLAC).
3. **Time it once.** A recording only follows the text once it has *timing* — which paragraph starts when. Press **Tap to sync**, play the recording, and press **Space** at the start of each
   paragraph (the reaction time is taken off for you). You can nudge a time, drag a marker, mark a stretch **No text here** (a song, a prayer) or **Tape differs here**, and **Undo**.
   It saves when you press **Save**. **Share timing** writes a small times-only file you can give to another computer — it holds **no text and no audio**.
4. *(Optional)* **Suggest timing** can propose the times for you, using speech recognition **you install yourself** (whisper.cpp — Born Again does not include it; choose its program and a model in
   the small tools panel). It runs on this computer, can be cancelled, and **only ever proposes**: you review the least-sure paragraphs first (**Next least sure**) and press **Save**.
   Plan on minutes, not seconds, on an ordinary PC — run it before the service, not during it.

## During the service

- **Take** puts the sermon text on the screens at the tape's place. **Nothing plays and no sound starts when you Take.** Press **Play** in the bar when you want sound.
- The bar has **Play/Pause**, **−10 s / +10 s**, **previous / next paragraph**, **speed**, **volume**, the **sound output** (choose the room's speakers here), the time, and a seek bar with a mark for every paragraph.
  **Continue from where it stopped?** appears when you reopen a recording.
- **Reader follows the tape** (a switch) keeps the paragraph being spoken in view. Turn it off to read ahead; **Back to the tape** returns. Clicking a paragraph moves the **tape** there (an **Undo** appears).
- **Put on the screens** chooses how the congregation sees it:
  - **Highlight** — a screenful of the sermon; the paragraph being spoken is bright with a large number, the rest is dimmed, and the text glides along.
  - **One at a time** — one paragraph fills the screen. **Next early** (0–10 s) switches a little before the speaker starts the next paragraph; a slim bar and **NEXT ¶** show what is coming.
  - Long paragraphs are shown a page at a time, moving with the tape.
  Pick **Dark / Light / High contrast** colours. A change while the screens are up waits for **Apply to the screens**. **Screens follow the tape** off holds the paragraph that is up while the tape and your reader move on.
- **Stage monitor** shows the time and time left, a bar, **NOW ¶** and **NEXT ¶ in 0:45**, and one plain word (*Playing*, *Paused*, *Sound has stopped moving*…).
- **Graphics / OBS** shows the tape as **lower-third pages** (about two lines each), turning at the tape's pace.

### Esc and the big keys

- **Esc** blanks the screens and **the tape keeps playing**. **Shift+Esc** blanks **and pauses** the tape. (*Tape options* can make plain Esc pause too.)
- Taking a **video or YouTube** item while a tape plays **pauses the tape** ("Tape paused for the video"). Only one thing makes sound at a time.
- **Alerts** (like a nursery call) show on top of the tape as usual.

### If something goes wrong

- **The sound output is unplugged:** the tape pauses and says so; choose the output again and press Play.
- **The sound stops moving or the player stops answering:** the bar and the stage monitor say so. Press **Pause**, then **Play**.
- **Sleep:** the tape pauses when the computer sleeps and stays paused.
- **The recording file is missing:** *Is tonight ready?* tells you before the service, with the one thing to press.

## Another language

The **text** language and the **recording** language are chosen separately. A timing belongs to the recording and is keyed by **paragraph number**, so the same English recording can drive a Spanish text — **if the paragraphs are
numbered the same way**. If they are not, Born Again says where ("…205 numbers match. Only in the timing: 206–207…") and lets you **use matching numbers only**, **not follow this text**, or **line up the differences**
("this text's ¶113 is the timing's ¶115"). Text in Arabic, Persian, Urdu, Amharic, Thai and other scripts is drawn with the right direction; if this computer has no font for a script, you are told **before** you take it.

## From the phone

The phone remote shows a **Tape** card: **Play/Pause**, **−10 s / +10 s**, **previous / next paragraph**, **volume** (a little either side of the level you set), the time, a **sync** word, and a list of paragraphs that **follows the tape**.
The rules are the video rules: **Play stays off until you have started the tape once on the computer**; there is **no seek bar**; **jumping to a paragraph asks first**, and an **Undo** appears on the computer.

## Is tonight ready?

*Is tonight ready?* checks every sermon in the queue that has a recording: the file is there, its length fits, it has timing, and the chosen sound output is plugged in.

## Tape options

**Tape options…** (next to the reader switch) holds the choices: projector view, next-paragraph lead, speed range, what a video does to the tape, what to do if the sound device is lost, what a language mismatch does, and what Esc does.
Defaults are the safe ones, and every option applies to the **next** tape, never to what is on the screen now.
