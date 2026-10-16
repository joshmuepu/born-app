# Spike 10 — iPhone photos (HEIC) and TIFF on Windows

Part of the [spike series](README.md). Written for the owner. Measured 2026-10-16 on an Apple M4 Max Mac
(**not** a Windows PC — see "What is not measured"). Outcome: **a bundled WebAssembly decoder passes; it is now
the single conversion path on Windows and macOS.**

## The question

Chromium (inside Electron) cannot open HEIC or TIFF. v2's first media build leaned on macOS's own `sips` tool, so on
Windows — where nearly every church PC is — an iPhone photo was refused. Can BORN open them itself, offline,
without making the user install anything?

## The options

| Option | Works offline with nothing to install? | Verdict |
|---|---|---|
| **Chromium / Electron 33 native** | — | **No.** Tested: `createImageBitmap` on a real HEIC fails with "source image could not be decoded" (even on macOS). Not a Windows-only gap. |
| **Windows "HEIF Image Extensions" + "HEVC Video Extensions"** (Microsoft Store) | **No.** | The HEVC part is a paid Store add-on on many PCs, and Electron does not use Windows' picture-decoding service for HEIC anyway, so BORN would have to shell out to PowerShell/WIC. Depends on what each church PC happens to have installed. Rejected. |
| **libheif compiled to WebAssembly** — `libheif-js` (used by `heic-decode`, `heic-convert`) | **Yes.** Pure JavaScript + WASM, no native build, no install | **Chosen.** |
| `heic-convert` (wrapper) | Yes | Same engine; drops the colour profile and orientation choices we need, so we call `heic-decode` + `jpeg-js` ourselves. |
| TIFF: `utif2` (MIT, pure JS) | Yes | **Chosen.** Handles the usual TIFF compressions (tested LZW, uncompressed); 12 MP in 0.5 s. |
| TIFF: macOS `sips` | Mac only | Not needed any more. |

## Measurements (M4 Max, Node 24 worker thread; the packaged app gave the same results)

Synthetic photographs with sensor-like noise saved with Apple's encoder (quality 70) — a real iPhone file of the
same size has the same decode cost. JPEG output at quality 92.

| Input | Decode + colour + encode | Peak memory (whole process) | Output |
|---|---|---|---|
| 1.9 MP HEIC (1600×1200) | 0.22 s | 185 MB | 0.9 MB |
| **12 MP HEIC (4032×3024)** | **0.97 s** | 424 MB | 5.4 MB |
| **48 MP HEIC (8064×6048)** | **3.6 s** | **1.4 GB** | 20.7 MB |
| 12 MP TIFF (LZW) | 0.5 s | 0.8 GB | 5.4 MB |
| macOS `sips` for comparison | 12 MP 0.10 s · 48 MP 0.24 s | — | — |

- **Off the UI thread:** conversion runs in a worker thread. In the **packaged** app, a batch of 12 MP + 48 MP + P3 + TIFF
  photos (plus a damaged one) took 7 s in total and the operator window's longest stall was **3 ms** — it stays fully usable.
- **Memory:** 48 MP is the largest an iPhone Pro takes. It peaks near 1.4 GB, so BORN refuses anything over **64 megapixels**
  with a plain message instead of risking the machine. A churchwide 8 GB PC copes; a 4 GB one may be slow on a 48 MP photo.
- **Install size:** about **3.2 MB** added to the installed app (the 2 MB WebAssembly bundle, 0.8 MB of zlib code for TIFF, small
  wrappers). Unused variants of libheif were excluded from the package.
- `sips` is 10–15× faster, but 1–4 s per photo is fine, and one path means the same pictures look the same everywhere.
  `sips` is kept **only as a macOS fallback** when libheif cannot read a HEIC (the OS knows a few more HDR/depth variants).

## Correctness

| Check | Result |
|---|---|
| Orientation | HEIC stores rotation as metadata; libheif applies it. Test: a 96×64 file marked "turn 90°" comes out 64×96 with the red corner where it belongs. |
| **Display P3 → sRGB** | iPhone photos are Display P3. The file's colour profile is read (ICC matrix/curve profiles, plus the CICP tag some Android phones write) and the pixels are converted to sRGB, so colours are not washed out. Test compares the ICC route with the CICP route. Lookup-table/CMYK profiles are left untouched, never guessed. |
| HDR (PQ/HLG) photos | Not tone-mapped; shown as standard range. Stated, not hidden. |
| Live Photos | The still is an ordinary HEIC and converts; the little `.mov` beside it is ignored (video is a later phase). |
| Burst | Each frame is its own file; each converts. |
| Several pictures in one file (depth map, thumbnail) | The largest is used and the operator is told. |
| Damaged / cut-off HEIC | "This picture is damaged…" — the rest of a batch continues, no temp file left behind. |
| Over 64 megapixels | A plain refusal. |
| The original | Never changed. The library also keeps an untouched copy next to the converted JPEG (`…orig.heic`), removed when the picture is purged. |

Real small files for all of this are in `src/test/fixtures/media/` (`heic-*.heic`, `tiff-quad.tiff`).

## If a file still cannot be opened

Message (also used for unusual codecs): "This is an iPhone photo format that this computer cannot open. Share it as JPEG:
in Photos, choose Share, Options, Most Compatible (or use AirDrop with “Most Compatible”), then add it again." The batch
continues.

## Licences and patents — for the January counsel list

| Piece | Licence | Note |
|---|---|---|
| `libheif-js` 1.23.5 (libheif + libde265 compiled to WebAssembly) | **LGPL-3.0** | Shipped as its own file (`node_modules/libheif-js`, unpacked beside the app, not merged into BORN's code) so a user can replace it — the usual way to satisfy the LGPL. Needs the licence text and a source offer in the third-party notices. Counsel: is this arrangement enough for the planned commercial edition? |
| `heic-decode` 2.1.0 | ISC | |
| `jpeg-js` 0.4.4 | BSD-3-Clause (some Apache-2.0 in older notes) | |
| `utif2` 4.1.0 + `pako` | MIT | |
| **HEVC (H.265) patents** | not a copyright licence | HEIC photos are HEVC-compressed. libde265 is free software, but HEVC is covered by patent pools (Access Advance, Via LA, others) and the open licence gives no patent rights. Shipping a software HEVC decoder in a commercial product is a question for counsel (Microsoft charges for the same thing in its Store extension). **Open question — decide before any commercial release.** |

## What is not measured

- **Windows**: no Windows PC was available. The code has no platform-specific parts (WebAssembly + JavaScript) and the manual-only
  GitHub workflow builds the Windows installer, but speed on a typical church PC (likely 2–4× slower than this Mac) and the
  48 MP memory peak on an 8 GB machine are **unmeasured**. The checklist in `docs/qa/windows-church-pc-checklist.md` covers it.
- Real iPhone files from several iOS versions (only Apple's encoder via macOS was available), HDR/Dolby Vision photos, and
  files from Android HEIC encoders.

## Decision

Implemented: `src/main/imageConvert.ts` (decode, colour, JPEG), `colorProfile.ts`, `heicWorker.ts` + `heicConvert.ts`
(worker thread, 2-minute limit), used by `mediaDecoder.ts` on every platform.
