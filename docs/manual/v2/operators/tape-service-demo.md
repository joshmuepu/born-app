# Tape service: a 10-step demo

This walks through the whole tape service with a recording that is already added and timed. Nothing here plays sound unless you press Play. Use a throw-away profile (a dev instance) the first time.

**Before you start:** open the Tape place (the **Tape** button in the left rail). You should see one recording, **It Is The Rising Of The Sun**, marked **Timed**, with *in the player* under it. The player — a bar — is at the bottom of the window.

1. **Play from the bottom bar.** Press the round **Play** button in the bar. The time starts, the pill says **In sync**, and a small equaliser appears on the **Tape** rail button. Use the volume slider in the bar; **System default** is where the sound comes out.
2. **Go to Songs and back.** Click **Songs** in the rail. The bar is still there and the tape is still playing. Press **⌘/Ctrl+Shift+P** to pause and again to play. Click **Tape** to come back.
3. **Follow along.** In the Tape place, **Follow** tab, the paragraph being spoken is highlighted and the text glides with it. Scroll up to read ahead — a **Back to the tape** button appears. Open **Sermons**, search the title, open the sermon: the chip says **Following the tape · ¶n** and the same paragraph is highlighted.
4. **Tap a paragraph number to seek.** Click the **number** of any paragraph (in the Tape place or in the reader): the tape moves there and an **Undo** appears. Clicking the paragraph's text does not move the tape. Try the bar's seek bar, **back / forward 10 s**, and the **previous / next paragraph** buttons too.
5. **Highlight and One at a time.** Press **Open projection** (top right). In the bar press **Text: not on the screens**; the screens show the highlight view (current paragraph bright, the rest dim). In the Tape place, **Follow** tab, choose **One at a time**, set **Next early** to 4 s, and press **Apply to the screens**. Press **Take off the screens** when you have seen enough. **Esc** blanks the screens and the tape keeps playing; **Shift+Esc** blanks and pauses it.
6. **Lower third in OBS.** Open **Screens**, add a **Graphics output**, and copy its address into an OBS browser source ending in `?profile=lower-third` (see *Using BORN with OBS*). With the tape's text on the screens, the lower third shows about two lines at a time and turns the page at the speaker's pace.
7. **Phone controls.** Press **Remote**, scan the code with a phone. The **Tape** card has **Play** (greyed until you have started the tape on the computer), **−10 s / +10 s**, **previous / next paragraph**, **volume**, and a paragraph list that follows. Tapping a paragraph asks "Jump to ¶n?" first; an **Undo** appears on the computer.
8. **The tap-to-sync editor.** Tape place → **Timing** tab → **Edit timing…**. Press **P** to play, then **Space** at the start of paragraphs to place markers; **U** undoes. **Save** keeps it.
9. **Review the low-confidence paragraphs.** In the editor press **Suggest timing** (needs the optional whisper.cpp tools — the small gear opens where to choose them). It *proposes* times; nothing is saved until you press **Save**. Press **Next least sure** to jump through the paragraphs it was least sure about, listen from one second before each marker (the clock button), nudge with **−/+**, then **Save**.
10. **Is tonight ready?** Add the sermon to the queue, then press the **Is tonight ready?** chip at the top of the Service Queue. The tape row says the recording is there, the length fits, it has timing, and the sound output is plugged in. Unplug the file's drive (or rename the file) and check again: it names the problem.

## The paragraphs automatic timing could not locate

On the real tape used for these tests, automatic timing proposed a time for every paragraph but **could not locate 14 of the 363** in what it heard (their times are guesses between their neighbours). These are the ones to listen to first (paragraph numbers only):

**97, 166, 185, 190, 192, 210, 217, 260, 270, 276, 280, 289, 292, 328**

A different tape or a different recording of it will have a different list; in the editor, **Next least sure** walks them for you.
