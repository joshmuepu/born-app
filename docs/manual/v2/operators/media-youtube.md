# Using YouTube

Born Again can play a **YouTube video** on the main screen. It uses **YouTube's own player** and nothing else: the video plays **online**, from YouTube. Born Again
never downloads, saves or changes a YouTube video. That is the rule YouTube sets, and it has some plain consequences — please read the next section once.

## What to know before you rely on it

- **It needs the internet during the service.** If the connection drops, the video stops. **Give every YouTube video a backup** (see below).
- **Ads may appear** before or during a video. Born Again **cannot remove or skip them**. Whether being signed in to YouTube Premium changes that in Born Again has **not been
  confirmed** — test it first on the computer you will use.
- **Some videos cannot be shown here.** The owner of a video can switch off showing it in other programs. When that happens YouTube refuses, and Born Again says so in plain words.
  Nothing in Born Again can change it. Choose another video, or use a file from your Media library.
- Showing a video to a congregation has **copyright rules of its own**, separate from YouTube's. Born Again does not check them and does not clear anything for you.

## Adding a video

1. In **Media**, press **YouTube** (or press **Ctrl/Cmd+K** and choose **Add a YouTube video…**).
2. **Paste the link.** Any normal form works: the address from the browser bar, a **youtu.be** short link, a **Shorts** link, or an **embed** link. A start time or playlist
   in the link is ignored — only that one video is used.
3. Born Again asks YouTube for the **title**. If you are offline it cannot — you can still add it and **type your own name** for it.
4. Choose a **backup**: *a black screen*, or **a picture or video from your Media library**, or nothing (you would press **Clear** yourself).
5. **Test play** opens a small window that plays the video **muted for a few seconds** so you can see it works, ads and all.
6. **Add to queue.** Nothing starts playing. The row is marked **YouTube · Online**.

## Playing it

1. **Show** it. YouTube's player appears **paused**. **Nothing plays by itself and no sound starts when you Show.**
2. Press **Play** in the bar under the Live picture. You can pause, drag the position, change the volume, and mute. (There is no Loop for YouTube.)
3. **Esc** (or **Clear**, or **Ctrl/Cmd+Shift+L** for the logo) stops it **at once** and blacks the screen. The player is closed completely. Showing the screen again brings it back
   **paused** where it was — it never starts by itself.

**Only the main screen plays the video.** The **stage monitor** shows its name, the **time left** and a bar. A **Graphics / OBS** output shows the **name only** — never a second
player, because a second player would have its own internet, its own ads and its own clock. If the church streams the service, the video is part of what the camera or capture sees.

**The phone remote** can **Play**, **Pause** and **Hide screen** a YouTube video that is live. It can only **Play** after you have started the video once on this computer, so a phone
can never be the first thing that makes sound. There is no seek and no volume on the phone.

**Alerts:** nothing may be drawn over YouTube's player. While a YouTube video is on the screen, an alert (for example the nursery) goes to the **stage monitor only**, and you are
told so. Everything else about alerts is unchanged.

## "Is tonight ready?"

The check looks at every YouTube video: is this computer online, does YouTube **accept** the video, is it allowed to be shown here. For each one it says one of:

| It says | What it means | What to do |
|---|---|---|
| **Ready** | YouTube accepted it. | Press **Test play** if you want to see it. Add a backup if it has none. |
| **Can't check — this computer is offline** | The video stays in the queue. | Connect to the internet and **Check again**. |
| **YouTube didn't answer** | Online, but YouTube did not respond in time. | Check again; otherwise use the backup. |
| **Removed or private** | The video is gone or not public. | Choose another video, or use a file from your Media library. |
| **The owner … does not allow it to be shown in other programs** | Embedding is switched off. | Choose another video, or use a file from your Media library. |
| **YouTube could not identify BORN (error 153)** | A problem in Born Again, not yours. | Use a library file tonight and tell whoever looks after Born Again. |

A check on **Saturday** cannot promise **Sunday**: the video may be removed or the internet may be down. That is what the backup is for.

## If it goes wrong during the service

Press **Clear** (or **Esc**). Then take your backup item, or carry on with the next item. A bar that says *Playing — time not advancing* can be an ad or a slow connection;
wait a moment, then **Clear** if it does not recover.

## Using it with older versions

A saved service with YouTube videos opens in an older Born Again (including v1.13) — the YouTube rows show as a plain, readable line and **nothing is lost** when it is saved
again. A service pack (**.bornpack**) carries **only the link** for a YouTube video, never the video.
