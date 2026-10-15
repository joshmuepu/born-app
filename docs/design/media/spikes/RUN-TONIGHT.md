# Run the long media tests tonight (one command, unattended)

**What this is.** Four tests that need hours, run back to back with nobody watching:

| # | Test | Time |
|---|---|---|
| 1 | Three screens playing the same video, left alone for 15 minutes | 15 min |
| 2 | The same, with Born Again keeping them in step | 15 min |
| 3 | A 1080p video looping for **2 hours** | 2 h |
| 4 | A 4K video looping | 20 min |

**Total: about 3 hours 10 minutes** (plus ~3 minutes to prepare its own test videos the first time).
It plays video on the screen and makes **no audible sound** (volume is at 2%). You do not need to be there.

> The tests are *throwaway*. They are not part of the Born Again app and change nothing in it.

---

## Mac (the dev laptop)

1. **Plug the laptop into power** and leave the lid **open** (closing it sleeps it).
2. **Close other apps** — especially anything that plays video, Zoom/Teams, and browsers with many tabs.
3. **Stop sleep and the screen saver.** The command below does this for you while it runs:
   you only need to start it the way shown in step 5. (If you prefer to do it by hand:
   *System Settings → Lock Screen → "Turn display off when inactive: Never"* and
   *Battery/Energy → Prevent automatic sleeping when the display is off*.)
4. Open **Terminal** and go to the repo folder:
   ```
   cd ~/MyProjects/born-again/spikes/media
   ```
5. Run **one** of these (both do the same thing):
   ```
   ./run-overnight.command
   ```
   or, with Node installed:
   ```
   caffeinate -dims npm run spike:overnight
   ```
   (`caffeinate -dims` is the macOS command that keeps the Mac awake while the test runs.)
6. **Leave it.** Windows will open and play video. Don't touch the mouse/keyboard; don't close them.

## Windows (the church PC)

The same script runs on Windows — it uses the copy of Electron that is already inside the repo
(`node_modules`), so **no extra software** is needed. *If the repo has never been installed on that PC
(there is no `node_modules` folder), run `npm install` once first; the script will tell you.*
*Not tested on Windows by me — that is the point of running it there.*

1. **Plug the PC into power.**
2. **Close other apps.**
3. **Stop sleep and the screen saver:** *Settings → System → Power & battery → Screen and sleep:*
   set **Screen** and **Sleep** to **Never** (for "plugged in"). Also *Settings → Personalization →
   Lock screen → Screen saver → None*. (The script also asks Windows to stay awake, but set this too.)
4. Open the repo folder in **File Explorer**, go into `spikes` → `media`.
5. **Double-click `run-overnight.bat`.** (Or in a terminal there: `npm run spike:overnight`.)
6. A black window shows progress; video windows open. **Leave it.**
7. If Windows Defender / the firewall asks about "Electron" — choose **Allow** (it only talks to
   itself on this computer).

---

## How to tell it finished

- The progress window says **`ALL DONE`**, and (Windows) waits for a key press.
- A file appears named like `OVERNIGHT-darwin-arm64-2026-10-16-22-04.md` in
  `docs/design/media/spikes/results/` (Windows: `OVERNIGHT-win32-x64-….md`).
- It prints a one-line verdict per test: **PASS / WARN / FAIL**.

If something fails, **it carries on to the next test** — you will still get a file. If the whole run
is interrupted (power cut), just send whatever is in the `results` folder.

## What to send back

1. The **`OVERNIGHT-….md`** file and the matching **`OVERNIGHT-….json`** file (both in
   `docs/design/media/spikes/results/`).
2. The **`OVERNIGHT-….log`** file (small; it records errors).
3. Tell me: the **model of the computer**, whether it was **on Wi-Fi or wired**, whether the projector
   was connected, and anything that happened (a pop-up, a restart, a fan going wild).

You do **not** need to send the `-raw` folder unless asked.

## Safe to leave overnight?

- It **cleans up** after itself: the test videos it makes are deleted at the end (keep them with
  `--keep-assets`), and every window it opens is closed.
- Its log is **capped at 2 MB**; the test videos take about 50 MB while it runs. It stops a step if
  the disk drops below 1 GB free.
- Each test has a **time limit**; a stuck test is stopped and the next one starts.
- A quick **practice run** (about 3 minutes, no visible windows) — run this first if you like:
  `./run-overnight.command --smoke --hidden` (Mac) / `run-overnight.bat --smoke --hidden` (Windows).
  Smoke results are marked "not valid for verdicts".

## Different questions that still need a person (not part of this script)

See the **by-hand list** at the end of `docs/design/media/spikes/README.md`: the HEVC/compatibility
table on the church PC, the camera/capture-card test, and the YouTube ads test with and without Premium.
