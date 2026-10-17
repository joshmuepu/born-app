# 5. Where the tape lives today — a placement review

Owner feedback: *"the audio player lives directly inside the Sermons section, the same place where I browse and project sermon text."* This page says where each piece is today (screenshots in `mockups/png/today-*.png`, taken from the real build on a throw-away profile with generated audio and public-domain placeholder text) and what is wrong with it.

## Where each piece lives now
| Piece | Today | Evidence |
|---|---|---|
| Player (play, ±10 s, ¶ skip, speed, volume, output, seek bar) | A bar docked at the bottom of the **Sermons reader** only | `today-reader.png` |
| Follow-along highlight | Inside the same reader, between "Project"/"+ Queue" buttons | `today-reader.png` |
| "Put on the screens", Highlight / One at a time, colours, "Screens follow the tape" | A strip in the reader, just above the player | `today-reader.png` |
| Text-language picker, "Tape options…", "Reader follows the tape" | The strip above that | `today-reader.png` |
| Add the recording, "Tape audio" folder, Get audio, checks | A dialog opened from a small "Tape · 2:03 · timed" chip in the reader header | `today-attach.png` |
| Sync editor, Suggest timing, tools | A full-screen dialog opened from "Edit timing" in the reader header | `today-editor.png` |
| Options | A dialog from the reader | `today-options.png` |
| Phone remote, stage monitor, Graphics | Separate surfaces; fine as they are | — |

## What is wrong, judged against how a church service really runs
1. **The tape disappears the moment you leave Sermons.** On Songs the tape is still playing (we measured "playing 43 s"), but nothing on screen says so and there is no way to pause it without going back (`today-songs-midtape.png`). The operator needs Songs, Bible, Media and announcements *while* the tape runs; this is the main flaw.
2. **Listening and projecting are mixed.** Listening to a tape is a long-running background activity; projecting (Take, Preview/Live, queue) is a moment-to-moment action. In the reader, the big round **Play** sits a few millimetres from **Put on the screens** and from every paragraph's **Project** button. Play and Take look like siblings and are easy to confuse under pressure.
3. **The reader is cluttered.** Three stacked control strips plus the transport take about **215 of 570 px (38 %)** of the work area at the smallest window size (1040×640), leaving one paragraph visible (`today-narrow.png`). The reader's job — find and project text — suffers.
4. **Safety is scattered.** The one-sound-source rule, Esc / Shift+Esc and the phone rules are correct but invisible: nothing near the transport says "Esc blanks, the tape keeps playing".
5. **Setup lives behind small chips.** Attaching, syncing and options are reachable only from a reader that is already open on the right sermon; there is no place that lists *all* recordings, which ones lack timing, or what tonight needs.
6. **It does not use the structure the app already has.** The left rail, the Preview/Live pair and the queue are where the operator runs a service; the tape has no presence in any of them.

## What must be kept
The audio engine, sync-map storage, aligner, projection pages, stage layout and the phone/API rules are correct and tested; only *where the operator sees and controls them* needs to move.
