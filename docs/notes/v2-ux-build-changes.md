# What changed in the v2 interface (draft for the media team)

Plain language. Updated with every slice of the UX build.

## One set of words
- **Show** replaces "Project" and "Take". It means: put this on the screens now. You will see it on every verse, paragraph, song, picture and search result, and as **Show next** in the box under the queue.
- **Hide screen / Show screen** is the blackout (the same as pressing Esc). On the phone it used to say Blank / Restore.
- **Next / Back** only step through the queue. **Clear** is only for a second channel.
- Typing "project" or "take" in the search box (⌘K) still finds the right command.

## The queue
- The seven small words at the top of the queue are now one button, **File**: New service, Open a saved service, Import, Save, Save with pictures, Open a service pack.
- Next to it is the **Is tonight ready?** chip. It shows what the last check found (**Ready**, **2 to look at**, **3 to fix**) and goes back to a question when the queue changes.

## Sizes and the keyboard
- Every button is now at least 32 px high (40 px for Show, Hide screen, Open/Close projection and Play; 44 px on a touch screen), so they are easier to hit in a dark booth.
- **F6** (and **Shift+F6**) jumps between the header, the sections, the content, the queue and the status bar. The first Tab stop in the window is a hidden "Skip to content / queue / live controls" link. Every section has a heading and the page has proper landmarks for screen readers. No existing key changed.

## The left rail
- Three labelled groups: **Find** (Sermons, Bible, Songs, Media, Saved), **Listen** (Tape) and **Service** (Queue). The selected section is always the same plum colour — before, each section had its own colour.
- The **Open** button moved into **File → Open a saved service…** at the top of the queue (and is still on the start screen of an empty queue).

## The top bar
- The screens controls are now together in one outlined group: a label (**ON AIR** in red while the screens are live, **SCREEN HIDDEN** in amber while they are blacked out, **OFF AIR** otherwise), **Screens ▾**, **Hide screen**, **Message** and **Open / Close projection**. Remote sits next to it.
- The things you set once — light/dark, **High contrast**, **Interface size** — plus **Help** (F1) and **Keyboard shortcuts** (?) moved into one **⚙** menu at the far right. The sun and half-circle buttons, Help and Shortcuts are no longer in the bar. Interface size used to be found only through ⌘K.
- On a small window the label and Remote shrink to their icons so nothing is cut off.

## The bottom strip (the "Now" dock)
- The thin status bar and the separate tape bar are now **one strip** at the bottom of every section. On the left, in a box that is outlined **red while the screens are live** (amber while hidden, grey when nothing is on): what is on air, how long it has been up, and **Hide screen / Show screen**. In the middle, the tape (when one is loaded). On the right, small status dots (Screens, Stage) and the version.
- On a small laptop window the tape takes its own row under the live box. Below ~1440 px the tape's output and "Text on the screens" buttons show only their icons (the words are still read by screen readers, and the tooltip says them).
- "N in queue" and the version moved: the count is on the Queue button in the rail; the version opens the app-info popover as before.

## The box under the queue (Preview and Live)
- **Show next** is now the one big purple button. **Hide screen / Show screen** sits beside it. **Back** and **Next** are small arrows under the two pictures with where you are in the queue ("3 of 9"). The keys did not change: → or Space is Next, ← or Shift+Space is Back.

## The phone remote
- Two new tabs: **Media** (thumbnails; **Show** or **+ Queue**) and **Tape** (the tape controls and the paragraph list). The phone now has the same six places as the main window.
- A full-width amber **SCREEN HIDDEN — tap to show** banner appears while the screens are hidden; the button says **Show screen** (before: it said Restore and only its colour changed). The button is at least 56 px high.
- Words match the main window: **Show** (was Project) and **Hide screen / Show screen** (was Blank / Restore).

## Verses, song slides and sermon paragraphs
- A **single click now only selects** the row (it gets a purple edge). It no longer puts anything on the screens by accident. **Enter**, **Space** or a **double-click** shows it, and the row's **Show** button always shows it. The **Show** and **+ Queue** buttons appear when you point at a row, tab to it or select it (always on a touch screen).
- If your team likes the old one-click way: **⚙ menu → A single click shows it**.

## The first time (new profiles only)
- A brand-new install opens with the queue panel showing a **Set up Sunday** checklist: choose your screens, add tonight's items, check that it is ready. It has three **plans** that line up the usual public-domain readings in one step (with an Undo): **Sunday morning** (Psalm 100, the Lord's Prayer, the benediction), **Midweek**, **Funeral or memorial** (Psalm 23, John 14, 1 Thessalonians 4, Revelation 21). You add the songs and the sermon.
- It disappears when the queue first has something in it, or with **Hide this checklist**. Existing installs with a queue never see it. **⚙ → Show the Set up Sunday checklist** brings it back.

## Run view (new)
- **Run view** puts the queue (big rows) and the live controls (big **Show next**, **Hide screen**, **‹ N queued ›**, the Preview and Live pictures) on one screen, with the browse panels out of the way. Switch with the **Run view** button above the queue or **Ctrl/⌘+Shift+U**; the rail or ⌘K takes you back to Prepare. Nothing on the screens changes when you switch.
- On a brand-new install it switches by itself when the screens open and the queue has items; existing installs keep things as they were (**⚙ → Switch to Run view when the screens open** turns it on).
- New shortcuts: **Ctrl/⌘+Shift+U** (Run/Prepare), **F6** (regions, earlier slice), **↑ ↓** between queue rows.

## Smaller things
- **⌘/Ctrl+K → type a reference → Enter** now opens the verse and puts the keyboard on it, so **Enter** shows it: four keystrokes, no mouse (opening a verse from search, Saved or a link never shows it by itself).
- The first-run checklist can no longer be cut off at the top of the queue column.
- Esc that closes the manual, the Remote panel, the Screens menu or the ⚙ menu no longer also blanks the screens (found in the UX review; Shift+Esc always blanks).

## Get audio now downloads the tape
- On a sermon's **Add the tape** dialog and in the **Tape place → Add** tab, **Get audio** now has **Download the tape for 65-0418M** (English). It fetches the recording from the publisher's own site into your **Tape audio** folder and adds it, with a progress bar and **Cancel**. **Open the download page** is still there for other languages.
- **Change…** (the Tape audio folder) now says which folder you picked.

## Adding a recording is one click
- In the Tape place, **Add a recording…** now opens the file picker straight away, **in your Tape audio folder** (Downloads until you choose one), and takes several files. A file named with its date code (65-0418M …) is added to that sermon at once; the Tape place selects it in the list on the left and opens **Timing** if it has none yet. You no longer choose the sermon first or go through a second dialog. Dropping files anywhere on the Tape place does the same.
- Only a file BORN cannot place asks you once, right on the Add tab (the likeliest sermons are one-click buttons, or search by title or date code).
- The Add tab also lists what is already in your Tape audio folder (**Add all N** when several match), and **Get audio** (download from the publisher) is its own small card.

## Timing is automatic (speech recognition is built in)
- The speech recogniser (whisper.cpp program + the English `base` model, ~150 MB) now ships **inside the app** (`resources/whisper/`, git-ignored, filled by `scripts/prepare-whisper.sh`, packaged through `extraResources` to `whisper/`). Nothing to install or choose; the whisper/ffmpeg path settings are gone from the editor (a path saved by an older build still wins).
- When an **English** recording is added, downloaded, or found untimed at startup (15 s after launch), `tapeAuto.ts` queues it. One at a time, at low priority: the M4A is decoded in a hidden window with the browser engine's own AAC decoder (`tapeDecode.ts`, `mp4Audio.ts`, `resample.ts` — no ffmpeg, no GPL), the recogniser listens, the words are matched to the sermon's numbered paragraphs and the result is saved as an **auto** timing. MP3/FLAC/OGG/WAV go straight to the recogniser. It never replaces a timing that already exists and never touches what is live.
- The tape **plays immediately**; the list/bar/Follow tab show **Timing… NN%**, and a toast says when the text can follow. Timing tab: **Time it now / Time it again / Stop timing**; tap-to-sync is now "by hand", for fixing only.
- Measured on the real 2½-hour tape (38 MB, mono AAC, 44.1 kHz): decode + listen + match in **82 s** on an Apple-silicon Mac, 356 of 363 paragraphs located (the optional tool-based run before found 349).
- Found on the way: this file's AAC header says mono while its sample entry says stereo, which the browser decoder rejects — the header wins (`mp4Audio.ts`, with a test).
- Not done yet: the macOS-Intel and Windows recogniser programs (built by hand or in CI and dropped into `resources/whisper/<platform>-<arch>/`, see `scripts/prepare-whisper.sh`); until then those builds simply do not time automatically (the tape still plays; tap-to-sync still works).

## Tape: Add is one door (owner approved option A, 2026-10-17)
- The **Add tab and the welcome note are gone**. One **＋ Add recording…** button on the list opens the picker in the Tape audio folder; its **▾** has **Download…** (just "Download", per the owner). Tabs are Follow · Timing · Options.
- BORN **watches the Tape audio folder** (`watchTapeFolder` in `tapeService.ts`, debounced) and offers new files in a strip: "1 new recording in your Tape audio folder" with **Add N recognised** / **See them**. Nothing is added until you press Add. **Look again** is gone.
- The folder setting moved to **Options → Tape audio folder** (Change…, Open folder). Download is a small dialog (prefilled from a sermon); while it runs and the dialog is closed a progress row with Cancel shows above the list. Files BORN cannot place ask in a small dialog. **Remove this recording…** moved to the row's ⋯ menu (still asks first).
- The empty Tape place is one drop zone with **Choose a file…** and **Download…**.
- Design record: `docs/design/tape-add/`. The R1–R8 items on the board were the parts of option A; the owner approved the option.
