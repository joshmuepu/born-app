# Installing & updating BORN

## Installing

Download the installer for your computer from BORN's release page:

- **Mac** — `BORN-<version>-macOS-arm64.dmg` (Apple Silicon Macs, 2020 onward) or
  `BORN-<version>-macOS-x64.dmg` (Intel Macs). Open the `.dmg` and drag **Branham
  or Nothing** onto **Applications**.
- **Windows** — `BORN-<version>-Windows-Setup.exe`. Run it and follow the
  installer.

BORN doesn't need an internet connection to run a service once it's installed —
only the very first sermon search needs one, to build its local search index (see
below).

## First launch

BORN opens straight into the **Sermons** tab with an empty queue — there's no
setup wizard to click through. The footer (bottom-left corner) shows its progress
preparing the sermon search index; the very first time, this needs an internet
connection and takes a few minutes. After that, BORN works fully offline.

## Updating

BORN checks for a new version on its own and shows a banner across the top of the
window when one is available:

- **BORN *(version)* is available — you have *(version)*.** Click **Upgrade** to
  download and install it automatically — BORN closes and reopens on the new
  version when it's ready, or **Later** to dismiss the banner for now (it reappears
  next time BORN starts).
- While downloading: a progress bar and percentage.
- **BORN *(version)* is ready.** Click **Restart & update** to apply it
  immediately.
- If the automatic install can't run on this computer, BORN falls back to opening
  the downloaded installer for you to click through by hand — on a Mac, drag
  **Branham or Nothing** onto **Applications** again (replacing the old one); on
  Windows, click through the installer window that opens.
- If the update check or download itself fails, the banner shows **Update didn't
  go through** with a reason, and an **Open download page** button to get it from
  the website instead.

Your settings, saved services, and the sermon/song search data all carry forward
automatically — updating never asks you to reconfigure anything.
