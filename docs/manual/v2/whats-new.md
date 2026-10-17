# What's new in v2 (vs. v1)

If your church has used Born Again before, everything you already know still works the
same way: search, queue, project, Hide/Show screen, the mobile remote. v2 adds the
following on top — nothing was removed.

## A new name and a calmer layout

The app is now called **Born Again**. The look is new too: a left rail for
**Sermons / Bible / Songs**, a service queue that slides away when you don't need
it, and the same drill-down everywhere — pick on the left, read and project on the
right. Press **Ctrl+K** (**⌘K** on a Mac) to search everything from one box. There
is also a **high-contrast** button next to the light/dark toggle, and the phone
remote follows your phone's light or dark setting. Everything from before is still
there.

## Preview and Live, undo, and saving time

The queue panel now shows a true **Preview** and **Live** picture side by side, read
back from the screen itself. Mistakes can be undone (toasts with **Undo**, **Ctrl+Z**),
sermon paragraphs, verses and songs can be dragged into the queue, right-click menus,
favorites, and back/forward history are new. See [Preview, Live, and saving
time](operators/preview-live.md).

## Channels — a second language, running alongside the main service

v1 had one feed of content. v2 can run a second (or further) **channel**
alongside Main — its own translation, its own display or Graphics output, either
**Following** Main automatically or driven **Independently**. See [Channels & a
second language](setup/channels.md).

## Graphics output — feed a livestream the same words the room sees

A new output type, separate from the Congregation/Stage windows: a web page Born Again
generates that OBS (or anything else that can show a web page) can display as an
overlay. See [Graphics output & OBS](setup/graphics-obs.md).

## Presentation profiles — Full-screen or Lower third

Each Graphics output can be laid out as **Full-screen** (replaces the whole
frame) or **Lower third** (a transparent caption band for overlaying a camera
feed), picked automatically by content type or set by hand. See [Presentation
profiles](setup/profiles.md).

## The Screens menu — redesigned

What used to be one long popover is now a short, quick-actions popover (live
status, Hide/Show, a profile picker) plus a separate **Manage…** panel for
everything configured once — adding channels, naming displays, adding Graphics
outputs. See [The Screens menu](operators/screens-menu.md).

## Automation API — Stream Deck / Companion

A new HTTP + WebSocket interface for a macro pad, covering next/previous/clear/
blank/show per channel and a read-only state feed. See [Automation
API](advanced/automation-api.md).

## Naming and clearing display names

Displays can be given a persistent name (so "the projector" always means the
same physical screen even after a reboot), and — new — that name can be **cleared**
again if it's no longer needed. See [Connecting & naming displays](setup/displays.md).

## Recorded sermons that the text follows (tape service)

Add a recording to a sermon and Born Again plays it **and** highlights the paragraph being spoken — on your screen, the congregation screen, the stage monitor, an OBS Graphics output and the phone remote.
You time a recording once (or let speech recognition that *you* install propose the times, and review them). Everything stays on this computer. See *Running a tape service*.

