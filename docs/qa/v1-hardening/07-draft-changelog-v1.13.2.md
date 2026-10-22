# DRAFT: v1.13.2 release notes (not published, not in `CHANGELOG.md`)

For church operators. Plain language. Edit freely; nothing here has been released, tagged or versioned.

## 1.13.2

**Fixed: things that could go wrong during a service**
- Pressing **Esc** to close a window or menu (the manual, Remote, Screens, the song key list, Import, or the search Filters) no longer also **blanks the congregation screen**. Pressing Esc in a search box with text in it now just clears the box. **Shift+Esc still always blanks the screens**, as the keyboard shortcuts list says.
- **Ctrl/Cmd+R** no longer reloads BORN in the middle of a service and wipes what is on screen.
- A very long line with no spaces (for example a web address in an announcement) now wraps on the **projector and the stage monitor** instead of running off the screen. The stage monitor's **Next** box no longer cuts off the reference line.
- Sermon text no longer starts with an **empty box** (a stray symbol in the source text). It is only hidden when shown; nothing in your library or saved services is changed.
- A saved service or queue that cannot be read is now **kept aside** (as `…corrupt…` in BORN's data folder) instead of being quietly replaced by an empty one the next time BORN saves. If BORN's data folder is read-only or full, BORN now **tells you** instead of closing without a word.
- An item in a shared service that this version does not recognise no longer makes the queue screen stop working.

**Fixed: on small screens and large text sizes**
- The **Keyboard shortcuts** window, the **Screens** menu and the search **Filters** menu now stay inside the BORN window and scroll when the window is small (for example a laptop at 150% size). Before, buttons such as **Done** and the text-size **Smaller / Larger** could be out of reach.

**Fixed: help and copying**
- Links in the manual that point to a section of another page now open that page at that section (three links were dead).
- The **Copy** buttons only say **Copied** when the text really was copied.

**Fixed: the phone remote**
- The search boxes show a clear outline when you tap into them, and phones no longer zoom in when you do.
- The **A–Z** letters on the Songs tab are bigger and easier to tap.
- If you search quickly, the **latest** search is the one shown. If the phone loses its connection mid-search, it now says so instead of staying on "Searching…".
- A quote mark in a song title, a search, or a shared service can no longer break the page.
- Other websites can no longer show the remote inside their pages, and the remote refuses oversized requests.

**Under the hood**
- Tests for Windows are fixed so they can run there. (No change to the Windows app.)

*Nothing new was added: no new screens, buttons or settings. Your saved services open and save exactly as before.*
