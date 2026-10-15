# Media library — storage, backup and safety (as built in Phase 1a, Step 2)

Written for the owner. Applies to branch `v2-media-1a`.

## Where things live

Everything is under the app's data folder (the same place as `sermons.db` and `settings.json`;
`BORN_USER_DATA_DIR` moves it for tests):

```
<data folder>/media/
  media.db            the index: names, tags, favourites, folders, where each file is
  media.db.bak        yesterday's healthy copy (made at start-up, at most once a day)
  files/ab/<hash>.jpg the managed copies (named by content, never by the operator's file name)
  thumbs/<hash>-320.jpg, <hash>-960.jpg   cached previews, safe to delete (rebuilt on demand)
```

## Copy by default, link in place for very large files

- **Default: copy.** The picture is copied into `files/` so a missing USB stick or a renamed
  folder can never break a service. The copy is written under a temporary name and renamed into
  place; a crash or a full disk leaves nothing that looks like a good file.
- **Link in place** (per import): the original stays where it is. BORN warns that it must stay there,
  and a moved or edited original shows up as *missing* / *changed* (never as a wrong picture).
  **BORN never modifies or deletes a linked original** — removing it from the library only forgets it.
- **Size hints** (`MEDIA_LIMITS`): a note at 100 MB, a "consider linking" hint at 500 MB; pictures
  over 60 megapixels get a warning and over 200 megapixels are refused (they would not display safely).
- **Disk space:** a copy needs the file size plus 500 MB left free, or the import is refused with a
  plain message and nothing is written.

## What counts as "the same picture"

The SHA-256 of the file exactly as it was imported. Importing the same bytes again (any name, any
folder) returns the existing item; nothing is copied twice. A picture that was removed (still
inside the undo window) is brought back with its tags when re-imported.
HEIC/TIFF files are hashed *before* conversion, so re-importing the same photo is still a duplicate.

## What formats work

| Kind | Result |
|---|---|
| JPEG, PNG, GIF, WebP, BMP, AVIF | Imported. Judged by content, not file name (a JPEG called `.png` is fine) |
| Animated GIF / WebP | Imported and flagged *animated* (plays and loops when shown); thumbnail is the first frame |
| HEIC / HEIF, TIFF | **macOS:** converted once, on import, to a JPEG by the system's own `sips` tool; the original name and "converted from" are remembered. **Elsewhere:** refused with the iPhone "Most Compatible" instructions — nothing is bundled |
| PDF | Refused here with "use Import PDF" (PDF import is Step 6) |
| Video, audio | Refused with "arrives in a later version" |
| SVG, RAW, PSD, anything else | Refused: "can't show this kind of file yet" |
| Empty, cut-off or damaged | Refused: *empty* / *truncated* / *damaged* with a plain message. Never becomes a broken item |
| EXIF rotation | Applied: a portrait phone photo is stored and measured the right way up |

Decoding is done by Chromium (the engine already inside the app) in a hidden sandboxed window.
A 50-megapixel JPEG imported in well under a second on the dev Mac.

## Removing

- **Remove** takes the item out of the library immediately but erases nothing; **Undo** brings it back.
- Erasure (`purge`) happens an hour later (or on request). For a managed copy the file in `files/`
  and its thumbnails are deleted — the operator's original elsewhere is untouched. For a linked item
  nothing on disk is touched at all.
- Deleting a folder never deletes pictures; they move up one level.

## Safety rules

- File names are display text only (control characters stripped, 200 characters). They are never part
  of a path: managed paths are built from the hash and a whitelisted extension, and verified to sit
  inside `files/`.
- Windows: paths are never concatenated by hand (`path.join` only), reserved names cannot occur
  (hash names), and linked paths must be absolute with no NUL bytes.
- Health checks are cheap (a `stat`): *missing*, *changed* (size or, for linked items, modified time
  differs) or *unreadable*. A deep check (`verifyHash`) re-reads a managed file and compares its hash.
  This is how a half-copied or silently damaged file is caught by preflight (Step 7).

## Backup and recovery

- `media.db.bak` is refreshed daily when the index is healthy. If `media.db` ever fails its integrity
  check it is **moved aside** (never deleted) and the last backup is restored.
- It is a separate database from `library.db` on purpose: `library.db` is re-created from the shipped
  copy when damaged, which would have erased the operator's own media index.
- To back up the library: copy the whole `media/` folder (the pictures are in it). To move it to
  another computer: copy the folder into the other computer's data folder while BORN is closed.
- A database written by a *newer* BORN is never modified: the media area reports itself unavailable
  with a message and the rest of the app carries on.

## Schema versions

`media.db` uses SQLite's `user_version`. Version 1 is the initial schema. Migrations are an
append-only list, each runs once inside a transaction, and none may drop or rewrite existing rows.
