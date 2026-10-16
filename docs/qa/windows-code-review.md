# Windows review of the media, remote and Help file code

Part of the [media follow-up report](v2-media-1a-followup-report.md). Written for the owner. **No Windows computer was available**; this is a code review plus
tests that run Windows path rules on any machine (`path.win32` and string-based helpers), and a manual-only Windows build to try it for real
([checklist](windows-church-pc-checklist.md)).

## Found and fixed

| # | Risk on Windows | What was wrong | Fix | Test |
|---|---|---|---|---|
| 1 | Antivirus or the search indexer holds a just-written file for a moment | A rename or delete right after writing can fail with EBUSY/EPERM/EACCES although trying again 100 ms later works. Import, thumbnails and the purge did it once and gave up | `winFs.ts`: retry a few times (50/100/200/400 ms), Windows only, only for those error codes | `winFs.test.ts` |
| 2 | Paths over 260 characters | `statSync`, reading and copying a very long source path could fail as "not found"; the decoder loads by `file://` URL and cannot carry the `\\?\` form | Source files are read through the `\\?\` form (also `\\?\UNC\server\share`); a long path is copied to a short temp name for decoding, and a long *linked* path is copied in instead of linked (with a plain note) | `winFs.test.ts` (long drive and UNC paths) |
| 3 | Reserved device names (`CON`, `NUL`, `COM1`, `LPT1`…), trailing dots/spaces | A pasted picture's file name went into a temp file; a name of `CON` is a device on Windows | `safeFileName()` for pasted pictures | `winFs.test.ts` |
| 4 | Case-insensitive file system / path prefix checks | The Help viewer's "stay inside the manual folder" check was a string prefix test: a sibling folder named `v2-x` passes for `v2`, and Windows case differences confuse it | Uses `path.relative()` (understands drive letters and case) | covered by the full suite; behaviour reviewed |
| 5 | Removable drives with changing letters | A linked picture whose drive is unplugged was "missing"; nothing told the operator it was recoverable | New **Drive not connected** state, **Reconnect by folder** (matches by contents, so a new drive letter just works), **Copy into library** | `mediaLibrary.test.ts`, `winFs.test.ts` (`E:\`, `e:/`, UNC, `/Volumes`, `/media`) |
| 6 | Dev-only test switches in an installed app | `BORN_TEST_*` environment variables answered file pickers in any build | Ignored whenever the app is packaged | `testHooks.test.ts` (also fails if code reads them directly) |
| 7 | Service pack names | A hostile or odd pack could carry `..\..\x`, `CON.jpg`, drive letters, trailing dots, case-only duplicates | Only exact names are accepted (`media/<64 hex>.<ext>`, `manifest.json`, `service.born`); files are written by BORN to names BORN makes | `servicePack.test.ts`, `zipStore.test.ts` |

## Reviewed and fine

- **Separators and normalisation:** every file path in the media code is built with `path.join/resolve/dirname/basename`; picture file names inside the library are
  `<hash>.<ext>` (never the user's name). The only forward-slash strings are URLs (`born-media://thumb/<id>`) and zip entry names, which are `/` by design.
- **Case-insensitive duplicates:** identity is the SHA-256 of the contents, not the path, so `A.JPG` and `a.jpg` are one picture; the pack format rejects case-only duplicate names.
- **Drive letters and UNC:** `isAbsolute` accepts both; `driveRootOf()` understands `E:\`, `e:/` and `\\server\share\`.
- **`file://` URLs:** the `born-media://` handler reads files itself; where a URL is needed it is built with `pathToFileURL` (spaces, accents, emoji, drive letters and UNC are encoded correctly). Tested with `Jo Ann O’Brien`, `café 🎉.jpg`.
- **User data under a spaced user name** (`C:\Users\Jo Ann\AppData\Roaming\…`): no path is ever given to a shell; the only external process (`sips`) is macOS-only and gets an argument array.
- **Disk full:** a free-space check before copying and before opening a pack; `ENOSPC` is mapped to the plain "not enough free disk space" message; failed copies remove their temp files.
- **Temp files:** `.convert-*`, `*.tmp-*` and the new `.pack-*` staging folders are swept at start; `.partial` pack files are removed on cancel or failure.
- **Panic keys:** `Esc` and `Ctrl+Shift+L` are handled in the window's own key handler (`ctrlKey || metaKey`, `key.toLowerCase()`), the same on every OS. Verified in the packaged macOS app; Windows differs only in the Ctrl key, which is in the same condition.
- **Read-only or permission-denied files:** reported as "BORN isn't allowed to read that file"; a read-only *source* is fine because it is copied, never modified.

## Not verified (needs a Windows PC)

| Item | Why it matters | How to check |
|---|---|---|
| The real NSIS installer, SmartScreen, uninstall | Only a Windows runner can build and run it | Run the manual workflow; the checklist's first section |
| Whether very long paths really read through `\\?\` on Electron 33 / Windows 11 | The code path is correct by Microsoft's rules but unexecuted | Make a folder tree deeper than 260 characters, add a picture |
| Speed of a 48-megapixel HEIC and its ~1.4 GB memory peak on an 8 GB PC | Measured on an Apple M4 Max only | Add a 48 MP iPhone photo |
| A dead network share: `existsSync` on an unreachable `\\server\share` can wait for the network time-out (seconds). Offline checks are cached for 2 s so a library check asks each drive once, but one ask can still be slow | Only affects pictures linked from a network share | Link a picture from a share, switch the share off, open Media |
| Antivirus retry timings (50–400 ms) are a reasoned guess | Real scanners vary | Copy a folder of photos with the scanner on |
| A pack's `.partial` file after a power cut is left next to the destination | Harmless, hidden, but not swept | Delete files named `.*.partial-*` |
