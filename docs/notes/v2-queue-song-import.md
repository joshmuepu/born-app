# Porting queue song-import to v2 — design notes (not yet built)

v1 shipped (branch `v1-queue-import-songs`, released in v1.13.0): when a
queue is opened or imported and it contains songs not yet in the local
library, one review dialog offers to add them, before the import finishes.
This note is **not an implementation** — it records what v1 built, what of
it is reusable as-is, and the real open questions a v2 port raises because
of Channels and songbooks. v2's queue song-import feature has not been
designed or built; this is the starting point for that design pass.

## What v1 built

- **`src/shared/songMatch.ts`** — pure, framework-agnostic matching.
  `normalizeSongTitle` (strips accents/punctuation/case), `lyricsSimilarity`
  (Dice's-coefficient bigram overlap, `SAME_SONG_THRESHOLD = 0.9`),
  `matchSongs(incoming, library)` returning a `matched | new | conflict`
  result per song, with in-file duplicates collapsed to one group.
- **`src/main/queueSongImport.ts`** — the write side: `matchQueueSongs`
  (read-only) and `commitSongImportDecisions` (one `db.transaction()`,
  rolls back whole on any failure).
- **`src/renderer/src/components/SongImportReview.tsx`** — the dialog:
  checkbox per new song (default checked), radio choice per title conflict
  (default "add as a separate song," never a silent overwrite), "Import
  without adding," Cancel/Esc backs out with nothing changed.
- **The format extension**: `SongItem.songKey?: string`, added as a plain
  optional field — no version bump, no wrapper change. A `.born` file is
  still a bare `QueueItem[]` JSON array in both v1 and v2 today.
- Wired into all 5 entry points (Open, Open Recent, Import, and the
  remote's open/import-service commands).

## What's reusable as-is

`songMatch.ts` has no Electron, React, or BORN-specific dependency — it
takes plain `{title, lyrics}` shapes in and returns a decision per song.
It should port to v2 unchanged, or close to it.

The dialog component's structure (list of decisions, checkbox/radio
pattern, the three exit buttons) is also UI-framework-portable; its styling
and exact copy would need to match v2's own modal conventions, not v1's.

## What is NOT reusable as-is, and why

**v2 has songbooks; v1 does not.** v1's `songs` table has no book concept —
every song is just in "the library." v2's schema partitions songs by
`songbookId` (`src/main/songs.ts`, `src/main/songInsert.ts`), and a Channel
can default to a specific songbook (`ChannelDefinition.songbookId`,
`src/shared/channels.ts`). v1's matching compares an incoming song against
*the whole library*; a v2 port has to decide **which songbook(s) to match
against** — the importing Channel's own songbook only, or every songbook on
this computer? Matching only within one songbook could silently create a
duplicate of a song that already exists in a *different* songbook; matching
across all of them could "match" a song the importing Channel's songbook
was never meant to have. This is a real product decision, not a mechanical
diff — it wasn't designed in this session.

**v2's `SongItem` carries no `songKey` and no songbook reference.** Porting
the format extension means adding `songKey?: string` (safe, same as v1 —
still just an optional field, no version bump needed either way), but
*also* deciding whether a queue item should record which songbook it came
from, which only matters once the "which songbook do we match against"
question above is answered.

**v2's queue is still a single shared queue, not one per Channel.** Checked
directly in this session (`App.tsx`'s `queueRef`/`serviceQueue`): there is
one `QueueItem[]`, same shape as v1 — Channels are output destinations, not
separate queues. This removes one assumption this task's brief raised ("a
different queue") — there is no "which Channel's queue does the review
belong to" problem, because there is only one queue. What *does* follow
from Channels is the songbook question above: a song added during review
still has to land in some songbook, and the single queue doesn't indicate
which one.

**File compatibility between v1 and v2.** A `.born` file is a bare
`QueueItem[]` array in both products today, and a v1 file with `songKey`
set would just be ignored by v2 reading it (an unknown property on an
object v2's own shape-check doesn't require) — no crash, same
forward-compatible pattern v1 relies on. The reverse (a file v2 writes,
opened in v1) is equally safe today since neither product has added a
field the other doesn't already tolerate. This stays true only as long as
neither side's extension becomes *required* to read the file correctly —
worth re-checking once v2's own fields (if any) are decided.

## Suggested order for the actual design pass

1. Decide the songbook-matching scope question above — this gates
   everything else.
2. Decide whether a `SongItem` needs a songbook reference, and whether
   `songKey` ports as-is.
3. Reuse `songMatch.ts` directly; write v2's own main-process insert layer
   (an `commitSongImportDecisions`-equivalent that calls v2's own
   `insertSong`/`songInsert.ts` with the resolved songbook id).
4. Adapt the review dialog to v2's modal conventions.
5. Wire into v2's Open/Import entry points — same shape as v1's, once the
   songbook question is settled.
