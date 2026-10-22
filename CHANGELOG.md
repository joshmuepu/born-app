# Changelog

## 1.13.2

**Fixed: things that could go wrong during a service**
- Pressing **Esc** to close a window or menu (the manual, Remote, Screens, the song key list, Import, or the search Filters) no longer also **blanks the congregation screen**. Pressing Esc in a search box that has text in it now just clears the box. **Shift+Esc still hides the screen right away**, even with a window or menu open.
- **Ctrl/Cmd+R** no longer reloads BORN in the middle of a service and wipes what is on screen.
- A very long line with no spaces (for example a web address in an announcement) now wraps on the **projector and the stage monitor** instead of running off the screen. The stage monitor's **Next** box no longer cuts off the reference line.
- Sermon text no longer starts with an **empty box** (a stray symbol in the source text). It is only hidden when shown; nothing in your library or saved services is changed.
- If the service queue BORN remembers between sessions, or BORN's settings, cannot be read, the damaged file is now **kept aside** (named `…corrupt…`, in BORN's data folder) instead of being quietly replaced by an empty one the next time BORN saves. If BORN's data folder is read-only or full, BORN now **tells you** instead of closing without a word.
- An item in a shared service that this version does not recognise no longer makes the queue screen stop working.

**Fixed: small screens and large text sizes**
- The **Keyboard shortcuts** window, the **Screens** menu and the search **Filters** menu now stay inside the BORN window and scroll when the window is small (for example a laptop set to 150% size). Before, buttons such as **Done** and the text-size **Smaller / Larger** could be out of reach.

**Fixed: help and copying**
- Links in the manual that point to a section of another page now open that page at that section (three links did nothing).
- The **Copy** buttons only say **Copied** when the text really was copied.

**Fixed: the phone remote**
- The search boxes show a clear outline when you tap into them, and phones no longer zoom in when you do.
- The **A–Z** letters on the Songs tab are bigger and easier to tap.
- If you search quickly, the **latest** search is the one shown. If the phone loses its connection during a sermon or Bible search, it now says so instead of staying on "Searching…".
- A quote mark in a search, or in a shared service, can no longer break the page.
- Other websites can no longer show the remote inside their pages, and the remote refuses oversized requests.

Nothing new was added: no new screens, buttons or settings. Your saved services open and save exactly as before.

## 1.13.1

**Fixed**
- On a computer connected to two networks at once (for example a network cable *and* the church WiFi), the phone remote's QR code and address pointed at only one of them — sometimes the one the phone couldn't reach, so the phone couldn't connect and there was no way to see or choose the other. BORN now lists every network the remote is available on, and the QR code and address follow the one you pick.
- BORN now shows the network it picked first and why — your WiFi if you have one, otherwise the cable — and remembers which network a phone last connected from, so it shows that one first next time.
- The phone remote's name on the local network (`born-remote.local`) is now announced on every network, not just one.

**Improved**
- The Remote panel names the network it's showing (for WiFi, the WiFi's own name where the computer allows it to be read). VPNs, virtual adapters and unconnected ports are hidden, with a **Show all** link if you need them.
- **Remote connection check** now tests every address of this computer and says which ones answer, shows whether any phone has connected and from which network, gives a plain hint when a phone is likely on the wrong network, and on Windows shows the two PowerShell commands to check the network type and allow the remote through Windows Firewall (BORN never changes firewall settings itself). The Help manual has been updated to match.

## 1.13.0

**New**
- When you open or import a shared service queue, BORN now offers to add the songs that are missing from your library — so a song leader's new songs show up in **Songs** and search for good, not just for that one service. Nothing already in your library is ever overwritten, and you can always cancel or choose to import without adding anything.

Song leaders: update too, so your shared queues carry each song's key along with the lyrics.

**Fixed**
- Turning on the Stage screen while BORN runs on a single computer could fill the whole operator screen, hiding the app underneath it with no way to get back — including at least one real church-computer incident. Stage no longer takes over the operator's own screen like that, and a new shortcut (`Ctrl/Cmd+Alt+Shift+W`) force-closes both Stage and Projection if a screen window ever gets stuck.
- The Stage screen's own picker was hidden until Stage was already turned on, making it hard to choose the right screen ahead of time. You can now pick it before switching Stage on.
- A computer with a projector or monitor set to "Duplicate"/mirror mode could cause Stage or Projection to mistakenly pick a screen that's really the same one as the operator's own display.
- "Check for updates" could sit on "Checking…" indefinitely on a slow or flaky connection instead of giving up and saying so.
- A couple of small consistency and data-hygiene fixes found during an end-to-end review (a mismatched button label; a settings value that re-corrected itself on every launch instead of staying fixed).

## 1.12.1

**New**
- A built-in Help viewer, reachable any time with `F1`.

**Fixed**
- The remote's "Who's this?" role picker (Song Leader, Preacher, Operator, or a typed name) didn't actually tag anything — the everyday "+ Queue" button on a search result sent no identity, so the operator's queue never showed who added what. Only the separate "My list → Send" feature worked correctly. Both paths now tag correctly, including when someone switches roles mid-service on the same phone.
- Two rapid taps of Next/Previous (on the remote, the desktop, or the keyboard) could get lost or only advance once instead of twice.
- The remote could show stale information for up to a minute after a phone's browser tab came back from the background (e.g. the screen waking up) — it now refreshes immediately.
- Remote commands (Next, Queue, Project, etc.) that failed to reach BORN — most often a dropped Wi-Fi connection — used to fail silently with no indication to the person tapping. The remote now shows a clear banner and recovers automatically once the connection returns.
- The "Show a message on screen" dialog: `Esc` now closes it, it has a close (X) button, and it defaults to a screen that's actually turned on instead of one that may not be.
- Songs → Browse's A-Z jump could scroll one row too far, hiding the target letter's first song title under its own sticky header.
- Various update-check and release-pipeline hardening (clearer version-mismatch handling, a tag gate to prevent mis-tagged releases).

## 1.12.0

**New**
- A built-in "Remote connection check" in the Remote panel — shows whether the phone remote is actually reachable, which network address it's using, and plain-language next steps if a phone can't connect. Includes a "Copy diagnostics" button for getting help.

**Fixed**
- Sermon search result highlighting no longer stays stuck on a previous search term when you open an unrelated sermon from Browse or the queue.
- Projecting a sermon's header slide (with no specific paragraph chosen) no longer marks hundreds of unrelated paragraphs as "on screen" at once.
- The Hide/Show screen button now actually turns amber while the screen is hidden, matching its label.
- Starting a new service or opening a saved one while something was live could leave the congregation screen showing stale content while the app itself said nothing was on screen — the screen is now correctly blanked, and the status message is honest about what's actually showing.
- Opening a damaged or empty saved-service file now shows a clear error instead of failing silently; importing several files no longer drops the whole batch because one file was bad.
- "Check for updates" no longer claims you're on the latest version when the check actually failed (for example, while offline) — it now says so.
- Pressing `/` to jump to search now works correctly even when a sermon is currently open.
- A damaged local sermon database is now detected and automatically repaired on startup — the damaged file is kept (not deleted) in case it's needed for support, and the app explains what happened instead of showing a misleading "needs internet" message.
- Song slides split across multiple ProPresenter slides (long verses and choruses) no longer get mislabeled with the wrong verse/chorus number — a label could previously collide with a different section's real number, risking an operator clicking the wrong slide live.

**Remote connectivity**
- The remote's displayed address could silently pick a VPN or virtual network adapter instead of the real Wi-Fi/Ethernet one, making the QR code useless. The app now correctly prefers a real adapter.
- The remote could advertise itself as available on the network before it had actually finished starting, which could leave a phone connecting to nothing. This ordering is now fixed, and more detail is now written to the app's log file to help diagnose connection problems.
- The remote's address now shows the computer's plain network address (e.g. `10.0.0.5`) as the primary way to connect, since it's more reliable than the `.local` name on some networks — the `.local` name is still shown as a backup.
