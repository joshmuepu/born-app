# Spike 8 — Queue item model and `.born` file: do old versions fail safely?

**Question.** If a `.born` file contains an item kind an older Born Again doesn't know (media,
YouTube), what happens? What must change so old versions fail *safely and clearly*?

**How tested.** A throwaway test (`spikes/media/tools/born-compat.spike.tsx`, run with
`spikes/media/vitest.spike.config.mts`; it is not part of `npm test`) runs the **real** code:
`migrateQueue` and `itemTitle` (`src/shared/queueItem.ts`), `stepForward` (`src/shared/queueNav.ts`) and
the **real `ServiceQueue` component** rendered in jsdom. v1 (`origin/main`) was compared by reading its
source.

## Measured (all against current v2; v1 compared where stated)

| # | Case | Result |
|---|---|---|
| A | Unknown `kind` **with** a `slides[]` array → `migrateQueue` | **Passes through unchanged** |
| B | Unknown kind **without** `slides[]` → `migrateQueue` | **Silently dropped.** No message; the user just sees fewer items |
| C | `itemTitle()` on an unknown kind | Returns `undefined` (switch has no default) |
| D | Back/Next stepping over an unknown kind | Works (treated as slide holder) |
| E | **Rendering the queue with an unknown kind that has `slides[]`** | **Throws** — `KIND_ICON[item.kind]` is `undefined` at `ServiceQueue.tsx:272`, React error "Element type is invalid … got: undefined". The queue UI crashes |
| F | A **"compat shell"** — a *known* kind (`quote`) whose text reads "This service has a YouTube video… Open it in a newer Born Again", carrying the real payload under `ext` | Passes `migrateQueue`, **renders** in the real queue, title and text readable; Back/Next work; payload **survives a save/re-open round-trip** |
| v1 | `migrateQueue` identical to v2 (diff empty); `KIND_ICON[item.kind]` present at `ServiceQueue.tsx:242` on `origin/main` | **v1 has the same crash for unknown kinds** (by source; not executed) |

So: *today*, putting a new kind into a `.born` file and opening it in any released/current BORN either
**silently loses the item** (no `slides`) or **crashes the queue screen** (with `slides`). Neither is
"safe and clear".

## Verdict: **NOT SAFE as designed — SAFE with the fix below**

## The fix (recommended format rule)

1. **Never write a new `kind` at the top level of an item.** Every new media/YouTube item is saved as a
   *compat shell*: `kind: "quote"` (or another *known* kind), `slides:[{text:"…needs a newer Born
   Again"}]`, a human-readable `quote.sermonTitle`, and the real data under **`ext: { v, kind, … }`**.
2. A new reader checks for `ext` and promotes it to the real item. An old reader shows a readable row
   and can step over it; re-saving **preserves** `ext` (verified in test G).
3. Keep the file a **bare JSON array** (no wrapper): an old reader given `{born:2, items:[…]}` gets
   `Array.isArray` false → **empty queue, no message**, which is worse.
4. Add a `ext.v` number so future readers can refuse a newer `ext` politely.
5. Add a **defensive default** in new code: `KIND_ICON[item.kind] ?? FallbackIcon`, and
   `itemTitle` default branch — so *new* versions never crash on a kind from an even newer version.
6. Optional hardening for **v1** (a separate decision; v1 is out of scope here): the same two-line
   default in v1's `ServiceQueue` would make v1 safe against v2 files.

**Caveat (unverified):** a quote shell may be handled by *follow-channel* code (it looks up
`sermonId`/`paragraphRef`), and the song-import review ignores quotes. `sermonId: -1` is used in the
test; follow-channel behaviour with it was **not** tested and must be before shipping.

## What it means for the roadmap

Phase 1a's first task is the type cleanup: unify the three `SlidePayload` copies, add the `ext`
shell writer/reader and the fallback branches, and ship **a v1 hotfix proposal** to the owner. Add the
tests F/G above to `npm test` (they are cheap).
