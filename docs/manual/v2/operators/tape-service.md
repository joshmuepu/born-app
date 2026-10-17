# Running a tape service

Some services play a **recorded sermon** — a message from the tape — while the congregation follows the text. Born Again plays the recording **and** keeps the text in step with it:
the paragraph being spoken is highlighted on your screen, on the congregation screen, on the stage monitor and on a Graphics (OBS) output.

Everything stays on this computer. Born Again does not stream recordings. To get one, press **＋ Add recording… ▾ → Download…** (or **Download…** on the empty Tape place) (English, from the publisher's own site, one recording, only when you press it; it is saved in your **Tape audio** folder and added), or bring your own audio file. **Open the publisher's page** opens the publisher's site in your browser instead (other languages, or to choose the file yourself).

## Where things are

- **The player is the bar at the bottom of every section.** Once a tape is loaded it stays there whether you are in Sermons, Bible, Songs, Media, Queue or the Tape place, so you can pause it to run a song and carry on.
- **The Tape place** (the **Tape** button in the left rail) is where recordings live: the list of all your recordings and whether each is ready, the big follow-along text, timing, options, and adding a recording.
- **The Sermons reader is just a reader.** It has no player. When the open sermon is the one playing, a small chip says **Following the tape · ¶5** (click it to open the Tape place).

![The bar at the bottom of every section: Songs here, with the tape playing underneath.](../images/tape-bar.png)

## Getting ready (once per recording)

1. Open the **Tape place** and press **＋ Add recording…** (top of the list on the left). The file picker opens **in your Tape audio folder** — choose the recording (or several), or drop the file anywhere on the Tape place. A file named with its date code (like `65-0418M …`) goes to the right sermon by itself, shows in the list and is selected. Only a file BORN cannot place asks you once which sermon it is. The **▾** next to the button offers **Download…**. **New files that appear in your Tape audio folder** are offered in a strip at the top ("1 new recording in your Tape audio folder") — BORN never adds one until you press **Add**. The folder itself is chosen in **Options → Tape audio folder** (Change…, Open folder). **Remove this recording…** is in the **⋯** menu on its row.
   File names like `65-0418M It Is The Rising Of The Sun VGR.m4a` are matched to the sermon by their date code; if it is not certain, you are asked to confirm.
   (From the Sermons reader, **Add a recording** opens a small window for that sermon: **Choose a file…** or **Download…**.)
2. Born Again **checks the file** (it must be complete, with a length that fits the sermon) and keeps a **managed copy**, so a missing USB stick never breaks a service.
   **M4A/AAC** is best. A **variable-bit-rate MP3** can be a second off when you jump around (you are told when you add it). Very large **WAV** files are refused (convert them to M4A or FLAC).
3. **That is all — BORN times it for you.** The recording **plays at once**. In the background BORN listens to it (speech recognition that is **built in**: nothing to install, nothing to choose, English only, entirely on this computer) and works out which paragraph starts when. The list shows **Timing… 40%** while it works; when it is done the text starts following the tape and a message says so. A 2½-hour sermon takes a couple of minutes on a recent computer; it works quietly at low priority, so it is safe to start while the service is on — a tape you add in the middle of the service plays immediately and the text joins in a little later. Recordings added earlier that are not timed yet are timed the next time BORN starts.
   If it cannot time a recording (a sermon in another language, say), the Follow tab says so and offers **Time it now**; the tape still plays.
4. *(Only for fixing something)* In the **Timing** tab, **Time it again** repeats the automatic timing, and **Tap to sync by hand…** opens the editor: play the recording and press **Space** at the start of each paragraph, nudge a time, drag a marker, mark a stretch **No text here** (a song, a prayer) or **Tape differs here**, **Undo**, **Save**. **Share timing** writes a small times-only file you can give to another computer — it holds **no text and no audio**. **Suggest timing** in the editor uses the same built-in recogniser and only proposes; press **Next least sure** to review its doubtful paragraphs.

![The Tape place: your recordings on the left, the follow-along text on the right.](../images/tape-place.png)

## During the service

- **Show** puts text on the screens. **Nothing plays and no sound starts when you Show.** Press **Play** in the bar when you want sound — Play is only ever in the bar and the Tape place, never next to Show.
- The bar has the recording and the paragraph being spoken, **Play/Pause**, **back / forward 10 s**, **previous / next paragraph**, the time and time left with a seek bar that has a mark at every paragraph start, **volume**,
  where the sound comes out, one word for how it is going (*In sync*, *Sound stopped*, *Output lost*, *Paused for video*…), and **Text: not on the screens / Text on the screens**.
- **Follow along.** In the Tape place the text follows the tape; scroll away to read ahead and a **Back to the tape** button brings you back. In the Sermons reader the same highlight shows on the sermon you have open.
- **Moving the tape.** Click a paragraph's **number** (in the Tape place or the Sermons reader) to move the tape there — an **Undo** appears. Clicking the text of a paragraph never moves the tape. You can also click the seek bar, or use ±10 s and the paragraph buttons.
- **Show the text on the screens** with the bar's **Text: not on the screens** button, or in the Tape place:
  - **Highlight** — a screenful of the sermon; the paragraph being spoken is bright with a large number, the rest is dimmed, and the text glides along.
  - **One at a time** — one paragraph fills the screen. **Next early** (0–10 s) switches a little before the speaker starts the next paragraph; a slim bar and **NEXT ¶** show what is coming.
  - Long paragraphs are shown a page at a time, moving with the tape.
  Pick **Dark / Light / High contrast** colours. A change while the screens are up waits for **Apply to the screens**. **Screens follow the tape** off holds the paragraph that is up while the tape moves on.

![The Highlight view on the congregation screen.](../images/tape-screen-highlight.png)
![The One at a time view, with NEXT and its bar.](../images/tape-screen-one.png)

- **Stage monitor** shows the time and time left, a bar, **NOW ¶** and **NEXT ¶ in 0:45**, and one plain word (*Playing*, *Paused*, *Sound has stopped moving*…).
- **Graphics / OBS** shows the tape as **lower-third pages** (about two lines each), turning at the tape's pace.

### Moving around while the tape plays

- Go to **Songs, Bible or Media** — the tape keeps playing and the bar stays. Show a **verse** or an **announcement** on the screens and the tape keeps playing; its text is off the screens, and a note offers **Back to the tape text**.
- A **video or YouTube** item **pauses the tape** and the bar says **Paused for video**, with a **Resume the tape** button. Only one thing makes sound at a time.
- **Alerts** (like a nursery call) show on top of the tape as usual.

### Keys and Esc

- **⌘/Ctrl+Shift+P** play/pause, **⌘/Ctrl+Shift+←/→** back/forward 10 s, **⌘/Ctrl+Shift+[ / ]** previous/next paragraph — from any section; never while you are typing or inside the timing editor. (Plain Space and the arrows keep meaning *next slide*.)
  The same actions are in the command palette (**⌘/Ctrl+K**, type "tape").
- **Esc** blanks the screens and **the tape keeps playing**. **Shift+Esc** blanks **and pauses** the tape. (**Tape options** can make plain Esc pause too.)

### If something goes wrong

- **The sound output is unplugged:** the tape pauses; the bar says **Output lost** with **Choose the output…**. Choose it again, press Play.
- **The sound stops moving or the player stops answering:** the bar says **Sound stopped** with **Restart the sound**.
- **Sleep:** the tape pauses when the computer sleeps and stays paused.
- **The recording file is missing:** the library says so, and *Is tonight ready?* tells you before the service.

## Another language

The **text** language and the **recording** language are chosen separately (the **Text** menu in the Tape place; the recording keeps its own language). A timing belongs to the recording and is keyed by **paragraph number**, so the same English recording can drive a Spanish text — **if the paragraphs are
numbered the same way**. If they are not, Born Again says where ("…205 numbers match. Only in the timing: 206–207…") and lets you **use matching numbers only**, **not follow this text**, or **line up the differences**
("this text's ¶113 is the timing's ¶115"). Text in Arabic, Persian, Urdu, Amharic, Thai and other scripts is drawn with the right direction; if this computer has no font for a script, you are told **before** you take it.

## From the phone

The phone remote shows a **Tape** card: **Play/Pause**, **−10 s / +10 s**, **previous / next paragraph**, **volume** (a little either side of the level you set), the time, a **sync** word, and a list of paragraphs that **follows the tape**.
The rules are the video rules: **Play stays off until you have started the tape once on the computer**; there is **no seek bar**; **jumping to a paragraph asks first**, and an **Undo** appears on the computer.

![The phone remote's Tape card.](../images/tape-phone.png)

## Is tonight ready?

*Is tonight ready?* (the **Is tonight ready?** chip at the top of the Service Queue) checks every sermon in the queue that has a recording: the file is there, its length fits, it has timing, and the chosen sound output is plugged in.

## Tape options

The **Options** tab of the Tape place holds the choices: projector view, next-paragraph lead, speed range, what a video does to the tape, what to do if the sound device is lost, what a language mismatch does, and what Esc does.
Defaults are the safe ones, and every option applies to the **next** tape, never to what is on the screen now.

![Tape options.](../images/tape-options.png)

*A first-time hint appears once on the bar and once in the Tape place; **Got it** hides it for good.*
