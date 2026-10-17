# Pictures and the Media library: troubleshooting

| What you see | What it means | What to do |
|---|---|---|
| *"…can't be found"* / **File missing** badge | The original (linked) or BORN's own copy is gone | **Find the file…** in the picture's pane; or add the picture again |
| *"…looks incomplete (cut short)"* | The file was only partly copied | Copy it again from the original |
| *"…is damaged"* / *"won't open as a picture"* | The file is corrupt | Re-export it from the program that made it |
| *"This is an iPhone photo format that this computer cannot open"* | A rare HEIC variant BORN can't read (normal iPhone photos work on Windows and Mac) | Press **Copy instructions**, or on the iPhone: **Share → Options → Most Compatible**, then add the JPEG |
| *"This picture is enormous (over 64 megapixels)…"* | A HEIC/TIFF too big to convert safely | Resize it and add it again |
| **Drive not connected** badge / a banner about drive **E:** | A linked picture's USB stick or network drive isn't there | Plug it in and **Check again**; or **Find the folder…** if it has a new letter |
| *"Made by a newer Born Again"* / *"isn't a Born Again pack"* / *"cut short"* when opening a `.bornpack` | The pack can't be trusted or understood | Nothing was changed. Update Born Again, or copy the pack again from the original |
| *"…contains something that isn't a picture"* when opening a pack | For safety the whole pack is refused | Ask for a new pack made by Born Again |
| *"Some pictures are missing… nothing was saved"* when saving a pack | A picture in the queue isn't readable now | **Check**, fix it, save again |
| *"This is a PDF"* | You added a PDF as a picture | Use **Import PDF** |
| *"Can't show … The screen was not changed"* | The picture was missing or unreadable when you took it | Fix it (see above); what was live stayed live |
| A picture doesn't show on the Graphics (OBS) output | That output is set to **Lower third**, which never draws pictures, or **Auto** sent it a text-style profile | Set the output to **Full-screen** |
| Text sits on a plain background | The background picture is missing | **Check** lists it; set another in **Media → Backgrounds** |
| *"The media library isn't available"* | Its database couldn't be opened (for example it was made by a newer BORN) | Your services are unaffected. Close BORN and see *A damaged database* |
| The screen went black right after Show | You pressed **Esc** (or **B**, or the phone's Hide screen) while it was loading | Show it again |
| PDF import says *"nothing was added"* | Too many pages couldn't be drawn, or you cancelled | Export a simpler PDF, or split it |

If something else goes wrong, **Check** (top of the queue) is the best first stop; it explains most problems in one list.

## Videos

| What you see | What it means | What to do |
|---|---|---|
| *"…uses a format many computers cannot play"* (HEVC, AV1, ProRes…) | Not H.264 | Export it as **MP4 with H.264 video and AAC audio** (HandBrake "Web" preset, or your editor's "Most compatible") and add that |
| *"Born Again plays MP4 files… not MOV, MKV, AVI or WebM"* | Wrong container | Same fix: export as MP4 |
| *"This video looks incomplete"* | The file was only partly copied or downloaded | Copy or download it again from the original |
| *"This video won't open on this computer"* / **Check** says *it won't play* | The file is damaged, or this computer's decoder can't read it | Export it again as MP4 (H.264 / AAC); try the new file in Preview |
| A video shows **4K**, **frames per second** or **bit rate** warning | It was only tested lightly at that size | Try it once on this computer; if it stutters, export a 1080p or lower bit-rate copy |
| The video appears but **nothing plays** | By design: Show displays the first frame, paused | Press **Play** in the bar under the Live picture |
| *"The picture has stopped moving"* | The video froze on the screen | Press **Pause** then **Play**, or **Clear** and take it again |
| No sound | Mute is on, the volume is low, the video has no sound track, or this is a Graphics (OBS) output (browser outputs never play sound) | Check the bar's mute and volume; sound comes from the main screen only |
| The phone's **Play** button is greyed out | You haven't started this video on the main computer yet | Press Play on the main computer once; then the phone can pause and resume it |
| A Graphics (OBS) output shows a still picture and a time | It couldn't keep in step with the main screen | It recovers by itself; if not, take the video again |

