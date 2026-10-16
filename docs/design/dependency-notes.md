# Dependency notes for the commercialization list

For whoever maintains `docs/commercial/dependency-audit.md` and `licenses.csv`
(those files are not edited from this branch; this note is the source to copy from).

## Added by the Born Again UI pass

| Package | Version (exact) | License | Used in | Why |
|---|---|---|---|---|
| `@tanstack/react-virtual` | 3.13.12 | MIT | renderer only (`VirtualList.tsx`) | Windows very long lists — a 25,000-hit search, a 1,600-row sermon, a 2,000+ song library — so only the rows near the viewport are in the DOM. Measured: search first paint 4.4 s → 0.29 s; longest sermon 261 ms → 66 ms. |
| `@tanstack/virtual-core` | 3.13.12 | MIT | transitive of the above | The framework-agnostic engine. |

- **Source:** https://github.com/TanStack/virtual · **Copyright:** (c) 2021-present Tanner Linsley
- **Size:** about 12 kB of ES modules for the React adapter; no native code, no install scripts, no network access at runtime.
- **Bundled into:** the renderer bundle (shipped inside the app); not used by the main process, the projection window, the stage window or the phone remote.
- **Pinned** with `--save-exact` in `package.json`.
- **Attribution:** MIT requires the copyright and licence text to ship with the app; the existing third-party notices mechanism should list it.

## Not added (tooling only, never in `package.json`)

Playwright 1.49.1 (Apache-2.0) was installed in a scratch directory outside the repository to drive the real
app with real mouse input and to load the phone remote in WebKit. It is a test aid, not a dependency of the
product, and is not in the lockfile.

## Not changed

No existing dependency was upgraded or removed in this branch.

## Media library, Phase 1a (branch `v2-media-1a`)

**No new npm dependencies.** Image decoding and thumbnails use Chromium inside Electron (already
shipped); the index uses `better-sqlite3` (already a dependency); hashing uses Node's `crypto`.
PDF import (Step 6) will use `pdfjs-dist` (already a dependency).

| Used | What for | Notes |
|---|---|---|
| macOS `/usr/bin/sips` (operating-system tool, not bundled) | Convert HEIC/TIFF to JPEG on import | Now only a macOS **fallback**; see the follow-up section below for the real path |

## Media follow-up (branch `v2-media-1a-followup`): HEIC/TIFF everywhere

Justification and measurements: [media/spikes/10-heic-windows.md](media/spikes/10-heic-windows.md). None are native modules
(no compiler, no install scripts); all run in a worker thread; none touch the network.

| Package | Version (exact) | License | Size installed | Native? | Used for |
|---|---|---|---|---|---|
| `libheif-js` | 1.23.5 | **LGPL-3.0** (libheif and libde265 compiled to WebAssembly) | 2.0 MB (only `libheif-wasm/libheif-bundle.js` is packaged; other variants excluded) | No (WebAssembly) | Decode HEIC. Shipped **unpacked** (`asarUnpack`) as a separate replaceable file. **HEVC patent question for counsel.** |
| `heic-decode` | 2.1.0 | ISC | 16 kB | No | Thin wrapper over libheif-js |
| `jpeg-js` | 0.4.4 | BSD-3-Clause | 100 kB | No | Write the converted JPEG |
| `utif2` | 4.1.0 | MIT | 116 kB (+ `pako` 1.x, MIT/zlib, 0.8 MB) | No | Decode TIFF |

All pinned with `--save-exact`. Attribution and the LGPL notice/source offer must be added to the third-party notices.
