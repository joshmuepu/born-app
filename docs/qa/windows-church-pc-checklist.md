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

**Last**
- [ ] Anything that looked wrong, felt slow, or that Windows complained about: note it and tell us. A photo of the screen is perfect.

## What we can't see from here

How fast big iPhone photos are on *this* PC, whether antivirus slows copying, and how Windows treats an unplugged drive. Your notes on those three are the most useful thing you can send back.

## A quick automatic check (optional)

On the same PC, with the installed or unpacked app, PowerShell can run the packaged-app smoke test:
`./scripts/smoke-windows-packaged.ps1 -Exe "C:\Users\<you>\AppData\Local\Programs\Branham or Nothing (v2 dev)\Branham or Nothing (v2 dev).exe"`
It starts the app with a throw-away data folder, checks the window loads and the picture library is created, and closes it.
