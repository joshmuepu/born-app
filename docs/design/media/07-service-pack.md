# 7. Service pack (`.bornpack`) — a service and its pictures in one file

Part of the [media design package](README.md). Written for the owner. **Status: built** on branch
`v2-media-1a-followup` (moved up from Phase 3 — see "Why now").

## What it is, in one paragraph

**Save service with pictures** makes one file, `Sunday.bornpack`, holding the queue **and every picture it uses**
(items, slideshow pages, and the backgrounds on the screens). Carry it on a USB stick or send it; on another
computer, **Open** shows what is inside, asks once, copies only the pictures that computer doesn't have yet, and opens
the queue. The ordinary **Save** (`.born`) is unchanged and stays the small, everyday file.

Mockups: [17 · Save with pictures](mockups/png/17-pack-export.dark.png) ·
[18 · Open a pack](mockups/png/18-pack-import.dark.png) · [19 · Errors and “Reconnect this drive”](mockups/png/19-pack-errors.dark.png)
(HTML versions beside them; `?theme=light` / `?theme=contrast`).

## Why now (and not Phase 3)

The roadmap had `.bornpack` in Phase 3 behind PowerPoint and shared folders. Phase 1a already stores pictures by content
hash and already has a "find these pictures" review, so a pack is mostly *packaging what exists*. And the church story it
solves is the first one people hit: "I made the service at home — the pictures aren't on the booth computer." Without it,
every shared service needs a manual folder copy, which is exactly how pictures go missing on Sunday. It needs no new
screen type, no video, and no network, so it carries little risk now; it **waits for nothing in Phase 1b**.

## The file

A pack is an ordinary ZIP file with **no compression** ("stored"), so any unzip tool can open it for inspection and, importantly,
a pack **cannot be a zip bomb**: every size is exactly what it says. It holds only:

| Entry | What |
|---|---|
| `manifest.json` | Format name and version, when/what made it, the item list, and for each picture: its **fingerprint** (SHA-256 of the bytes in the file), size, name, type, width/height, its library identity, and its role (queue item, slideshow page, background, logo) |
| `service.born` | The queue, exactly as a plain **Save** writes it. Rename the pack to `.zip`, take this out, and any v1.11–v1.13 or v2 opens it |
| `media/<fingerprint>.<ext>` | The pictures. Only JPEG, PNG, GIF, WebP, BMP, AVIF (HEIC/TIFF were already converted to JPEG on import) |

Nothing else is ever accepted. Sermons, songs and settings are **not** included.

## Saving (export)

1. **Save service with pictures…** (queue toolbar). The dialog lists what goes in, with sizes, the pack size and free space.
2. A pack over **1 GB** shows a plain warning and the biggest pictures. Over **4 GB** is refused (the ZIP format used has no larger
   mode; say what to remove). More than **5,000** pictures is refused.
3. **Choose where to save…** → a file picker. Pictures are copied in with a progress bar and **Cancel**.
4. It is written to a hidden `.partial` file beside the destination and renamed only when complete and re-read for a check, so a
   cancel or crash never leaves a half-pack that looks real.
5. If any picture is **missing or changed** on this computer, nothing is saved and it says which (use **Check** first).

## Opening (import) — review, then all or nothing

1. Choose a `.bornpack` in **Open**. Born Again reads the manifest and **checks every file against its fingerprint** (a read-only
   pass; nothing is copied or changed yet).
2. **Review** (mockup 18): each queue item shows **new**, **already in your library** (matched by what the picture *is*, so renamed copies
   are recognised) or **damaged in the file**. Totals and the sizes needed are shown.
3. **Cancel — change nothing**, or **Add N pictures and open**. A damaged picture does not stop the service opening; that item shows
   as missing, like any missing picture, and Preflight flags it.
4. **Copy phase is atomic.** New pictures are copied into a hidden staging folder inside the library's own drive, each re-verified and
   decoded as a picture (the same validity test every import uses). Only when all are good, they are moved into place and recorded in the
   library in **one database transaction**. A **Cancel**, a full disk, a power cut or an error **removes everything the import created** —
   the library and the queue are exactly as before. Leftover staging folders from a crash are swept at the next start.
5. The queue is replaced only after step 4 succeeds, with the usual **Undo**. Opening **never puts anything on a screen**.
6. Backgrounds in the pack are **not applied** (that would change what the congregation sees). The summary says they came along and where to set them.

## Safety

| Threat | What stops it |
|---|---|
| **Zip-slip** (`../../x`, absolute paths, drive letters, `\`) | Only exact names are allowed: `manifest.json`, `service.born`, `media/<64 hex>.<allowed ext>`. Anything else refuses the whole pack. Files are written by *us*, to a name *we* make from the fingerprint. |
| **Zip bomb** | Stored entries only (compressed size = real size); totals and counts capped (5,000 pictures, 4 GB total, 512 MB per picture, manifest ≤ 5 MB, queue ≤ 20 MB). Free-space check before copying. |
| **Hash mismatch / tampering** | Every entry's SHA-256 must equal the manifest's, and its CRC the zip's. A mismatch marks that picture damaged. |
| **Duplicate, reserved or odd names** (`CON`, `NUL`, trailing dots, case-only duplicates) | Names inside the pack are rejected unless they match the strict pattern; display names from the manifest are cleaned (control characters, length) and never used as file names. |
| **Disallowed types** | The extension *and* the file's own header must agree and be a supported picture; the picture must fully decode. HTML, SVG, scripts and executables are refused. A pack is never executed or opened as anything but an image. |
| **Truncated or damaged pack** | The index at the end of the file is checked first; every offset must be inside the file and not overlap another entry. Reported as "cut short" / "damaged", nothing changed. |
| **A newer pack** | `packVersion` higher than supported → "made by a newer Born Again", nothing changed. |
| **Memory** | Everything is streamed in 1 MB pieces, hashed as it goes; a 1 GB pack needs no more memory than a 1 MB one (tested). |

## Compatibility

- **`.born` unchanged.** Plain Save writes the same file it always did. v1.11–v1.13 and v2 open every `.born` as before.
- **A pack in old software.** Old v1/v2 open dialogs don't list `.bornpack`; if one is forced, the file is not JSON and they show their
  existing "may be damaged or empty" message — nothing is changed. (Take `service.born` out of the pack for them.)
- **Phone remote:** may list and open saved *services* as today. It does **not** import packs and can't create them (a phone should not
  be able to copy gigabytes onto the booth computer).
- Packs are a **v2-only** feature; recorded in `docs/V1-PARITY.md` as intentionally different.

## Linked-in-place pictures

A picture *linked* from a USB drive is exported like any other (its bytes go into the pack). On the receiving computer it becomes a normal
copied picture. If the drive isn't plugged in when saving, saving stops and says which pictures are offline (mockup 19 shows the
reconnect state used in the library and in Check).

## Not in this version

Encryption/passwords, sending to cloud storage, packs from the phone, merging a pack into the current queue (Open replaces, with Undo),
sermons/songs/settings inside the pack, and a pack larger than 4 GB.
