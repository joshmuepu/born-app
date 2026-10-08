# What's new in v2 (vs. v1)

If your church has used BORN before, everything you already know still works the
same way: search, queue, project, Hide/Show screen, the mobile remote. v2 adds the
following on top — nothing was removed.

## Channels — a second language, running alongside the main service

v1 had one feed of content. v2 can run a second (or further) **channel**
alongside Main — its own translation, its own display or Graphics output, either
**Following** Main automatically or driven **Independently**. See [Channels & a
second language](setup/channels.md).

## Graphics output — feed a livestream the same words the room sees

A new output type, separate from the Congregation/Stage windows: a web page BORN
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
