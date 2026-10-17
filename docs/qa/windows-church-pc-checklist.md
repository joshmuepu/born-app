# Trying Born Again v2 (dev) on the church Windows PC

Written for the owner. About 30 minutes. Nothing here changes your real v1 install or its data: the v2 dev build uses its own name,
its own data folder and its own ports.

## Getting the installer (one time)

1. On GitHub open the repository → **Actions** → **"v2 dev build (manual, no release)"** → **Run workflow**.
2. Under **Branch** choose the branch to test (for example `v2-media-1a-followup`) → **Run workflow**.
3. Wait for the green tick (about 20–40 minutes the first time, because it prepares the Bible and song data).
4. Open the finished run, scroll to **Artifacts** at the bottom, download **v2-dev-windows**, and unzip it. Inside is `BORN-2.0.0-dev.1-Windows-Setup.exe`.
   (The download disappears after 3 days. This workflow never makes a release, never makes a tag, and can only *read* the repository.)

The installer is **not code-signed**, so Windows SmartScreen will say "Windows protected your PC". Choose **More info → Run anyway**.

## Before you start

- Put ten photos on the PC (some from an iPhone as **.HEIC** if you have them), a **PDF** (a PowerPoint saved as PDF is perfect), and, if you have one, a **USB stick** with a few more pictures.
- Have a second computer or a USB stick handy for the "service pack" step.

## The checklist (tick each one; write down anything odd)

**Install and start**
- [ ] Run the installer. Install it somewhere (the default is fine). Start **Branham or Nothing (v2 dev)**. The window opens.
- [ ] Click **Help** at the top. The manual opens and the pictures in it show (try *Pictures: the Media library*). No internet is needed for this.

**Pictures**
- [ ] Click **Media**. Drag your ten photos in (or **Add pictures**). All ten appear with thumbnails. HEIC photos are included and the right way up.
- [ ] Press **Import PDF** (or drag the PDF onto the Media area). Every page becomes a picture and a slideshow appears in the queue.
- [ ] In the library, pick a picture and choose **Use as a background → Congregation screen**.

**On the screen**
- [ ] Open the projection window (**Open projection**). Put each kind of item on the screen with **Take**: a picture, the slideshow (press **Next** a couple of times), a Bible verse (the background shows behind the text).
- [ ] Press **Check** at the top of the queue. It should say everything is ready.
- [ ] Press **Esc**. The screen goes blank at once.
- [ ] Take a picture, then press **Ctrl+Shift+L**. The church logo (or the "no logo set" message) shows — nothing else.

**Staying put**
- [ ] Close Born Again completely, then open it again. The pictures, the queue and the background are all still there.

**A drive that goes away** (needs the USB stick)
- [ ] In Media tick **Don't copy (link in place)**, add a picture from the USB stick, and put it in the queue.
- [ ] Pull the USB stick out. The picture now says **Drive not connected** and **Check** says the same, with a **Find the folder…** button.
- [ ] Plug the stick back in (it may get a different letter). Press **Check again**, or **Find the folder…** and choose the stick. The picture is back.

**A service pack** (a service and its pictures in one file)
- [ ] Press **Save + pictures**, then **Choose where to save…**, and save to the USB stick.
- [ ] On another computer with Born Again v2 (or after clearing the library), press **Open pack**, choose the file. The review shows what's new; press **Add … pictures and open**. The queue and pictures appear.

**Video and moving backgrounds** (a few short MP4 clips: one 1080p, ideally one 4K, one with sound)
- [ ] Add the clips (drag them into **Media**). They show ▶ and a length. Try one MOV or MKV file too: it should be refused with advice to export an MP4.
- [ ] Put a clip in the queue, **Take** it: the first frame shows **paused**, nothing plays and there is no sound. Press **Play**: it plays with sound through the projector/speakers. Try Pause, drag the position, volume, loop.
- [ ] Press **Esc** while it plays: picture and sound stop at once. Show the screen again: it is back **paused**. Press **Ctrl+Shift+L**: the logo replaces the video.
- [ ] Press **Check**: the clips are listed as ready; the 4K clip (if any) shows a warning.
- [ ] If the 4K clip stutters on this PC, note it (that is the information we need).
- [ ] Set a short looping clip as the **Congregation background** (Media → Backgrounds). Project a Bible verse: the text sits over the moving picture, with no sound.
- [ ] **Real phone**: scan the Remote QR code. With a video live, the phone shows **Pause/Play** and the time; Play is greyed out until you start it on the PC.
- [ ] **OBS** (if you use it): add the Graphics URL as a Browser Source. The video plays there silently, in step with the screen.
- [ ] **Projector** (a real second screen): the video fills it; the stage monitor (if used) shows only the time left.

**Last**
- [ ] Anything that looked wrong, felt slow, or that Windows complained about: note it and tell us. A photo of the screen is perfect.

## Also worth trying on the church PC (by hand)

- **YouTube ads test** (when YouTube arrives): play a video with and without YouTube Premium and note whether ads appear.
- **Camera / capture card**: a camera or capture-card test is a later phase.
- **HEVC table**: try a phone-made HEVC video and an AV1 video; both should be refused with the export advice (we deliberately don't trust them).

## What we can't see from here

How fast big iPhone photos are on *this* PC, whether antivirus slows copying, and how Windows treats an unplugged drive. Your notes on those three are the most useful thing you can send back.

## A quick automatic check (optional)

On the same PC, with the installed or unpacked app, PowerShell can run the packaged-app smoke test:
`./scripts/smoke-windows-packaged.ps1 -Exe "C:\Users\<you>\AppData\Local\Programs\Branham or Nothing (v2 dev)\Branham or Nothing (v2 dev).exe"`
It starts the app with a throw-away data folder, checks the window loads and the picture library is created, and closes it.

## YouTube (v2-youtube) — by hand on the church PC
- [ ] Add a public video; Take: it shows paused, no sound; Play works; Esc closes it at once.
- [ ] Check "Is tonight ready?" with the internet on, then **unplug the internet** and check again (should say "Can't check — offline"; item stays).
- [ ] **Drop the internet mid-video**: the bar should say time is not advancing; Clear + backup works.
- [ ] A video whose owner disabled embedding: plain message, backup offered.
- [ ] Ads: note whether ads appear with and without YouTube Premium signed in on this PC (not confirmed anywhere).
- [ ] No "Error 153" on Windows (the player page origin is the proof point).

## OBS (v2-obs-live) — by hand on the church PC
Mac results and numbers: `docs/qa/v2-obs-live-report.md`. Manual: *Using BORN with OBS*.
- [ ] OBS 30+: *Scene Collection → Import* `docs/manual/obs/BORN-scenes.json`; paste the Graphics address into **BORN Lower Third** and **BORN Full-screen** (keep the `?profile=` endings). Project a verse: it appears on scene 1 in about a second.
- [ ] Same computer: use the **"OBS on this computer"** address. Quit and restart BORN: the overlay returns by itself within ~5 s. Try the `.local` address too and write down how long it takes (Windows needs Bonjour).
- [ ] Other computer: use the numbers address. Pull the network cable for 20 s and put it back; the overlay returns within ~1 minute without touching OBS.
- [ ] Scene switch is instant (source setting *Shutdown when not visible* is OFF); canvas 1920×1080 @ 30, sources stretched to the screen.
- [ ] Video clip: scene 4 follows the room within about a quarter of a second; the browser source is silent; sound reaches the stream through **Application Audio Capture** of BORN (check the OBS meter).
- [ ] Right-to-left or long text (if you use it): panel aligns right and stays inside the picture; text readable over a bright camera shot.
- [ ] Esc and Ctrl+Shift+L clear the stream output as well as the room; phone Blank does too.
- [ ] YouTube item: stream shows the name only (or nothing on the lower third); if window capture is wanted, add *Window Capture* of BORN's output and check it.
- [ ] 10 minutes of a private/unlisted livestream with the overlay: no stale verse, no frozen overlay; watch OBS *Stats* for dropped frames.
- [ ] Hardware acceleration off (OBS Advanced): the overlay still draws.

## Tape service (v2-sermon-audio) — by hand on the church PC
Mac results and numbers: `docs/qa/v2-sermon-audio-progress.md`. Manual: *Running a tape service*. Nothing here has been run on Windows yet.
- [ ] Add a recording (an M4A, an MP3 and a FLAC if you have them): each is accepted; a half-copied file and a 600 MB WAV are refused with a plain message. A VBR MP3 warns.
- [ ] **Sound output**: choose the room's speakers in the bar; play 10 s. Then **unplug that output** while playing: the tape pauses and says why; plug it back, choose it again, press Play. Note what Windows does with a USB / HDMI / Bluetooth output.
- [ ] **Sleep and wake** the PC while a tape is paused and while it is playing: it comes back paused at the same place (never playing by itself).
- [ ] **Tap to sync** a real recording on this PC (note how long a 2-hour message takes), then the same **Suggest timing** if whisper.cpp is installed: note the minutes it takes and how many paragraphs need fixing. (Mac: 71 s with GPU; 6–30 min expected on a modest PC.)
- [ ] Take the sermon to the screens in **Highlight** and **One at a time**; stand at the back of the hall: is the highlighted paragraph and the number easy to read? Try **High contrast**.
- [ ] Press **Esc**: the screens blank and the tape keeps playing. **Shift+Esc**: blanks and pauses.
- [ ] Take a **video** while a tape plays: the tape pauses and the bar says so. The reverse: start the tape while a video plays — the video pauses.
- [ ] **Stage monitor**: time, time left, NOW/NEXT, the status word. **Alerts** still show over the tape.
- [ ] **OBS**: a Graphics output shows the tape as lower-third pages and turns the page at the speaker's pace; Esc clears it; after restarting BORN the overlay returns. The tape's *sound* reaches the stream through Application Audio Capture of BORN (check the meter).
- [ ] **Phone remote** (real phones, both iPhone and Android if you have them): the Tape card appears; Play is greyed until you have started the tape on the PC; ±10 s, next/previous paragraph, volume (stays within a little of your level), tapping a paragraph asks first and an Undo appears on the PC; no seek bar.
- [ ] **Is tonight ready?** with a sermon that has a recording in the queue: passes; rename the recording file and check again: it names the problem.
- [ ] A **2-hour** recording played for 30 minutes at normal speed: highlight stays on the right paragraph; Task Manager shows memory steady.
- [ ] Packaged app only: the first launch after install finds the "Tape audio" folder you choose and the recording imports without a console window.
