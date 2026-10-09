# Changelog

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
