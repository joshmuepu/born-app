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
