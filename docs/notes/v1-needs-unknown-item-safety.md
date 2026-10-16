# Hand-off: v1 still lacks "unknown queue item" safety (v2 has it)

**Status:** v1 side not built — there is no v1 branch for this (checked 2026-10-16: no `v1-unknown-queue-items` locally or on `origin`). v1 and `main` were not touched.

**What v2 does (Media 1a, Step 1):** a queue item of a kind this version doesn't know (made by a newer BORN) or a damaged one is kept as an `UnknownItem` — shown as a plain row, never opened, never dropped, written back to the file unchanged. New item kinds (pictures, and in 1b video) are written as a quote-shaped "compat shell" carrying the real data under `ext`.

**What v1.13.x does with a v2 file:** verified in the real v1.13.0: it opens a v2 `.born` file **without crashing** — it shows the shell as a quote row and its autosave preserves `ext`.

**The remaining gap in v1:** an *unknown top-level kind that carries slides* would make v1's queue screen crash (`KIND_ICON[item.kind]` is undefined in `ServiceQueue.tsx`). v2 never writes such files, so nothing breaks today; it matters only if a future v2 writes a new top-level kind.

**The optional two-line hotfix (owner's decision; v1 not touched):**
1. `src/renderer/src/components/ServiceQueue.tsx`: use `KIND_ICON[item.kind] ?? FallbackIcon`.
2. `src/shared/queueItem.ts` `itemTitle`: add a `default:` branch returning a generic label.
Then a test that a queue with `{kind: 'future', slides: [...]}` renders and round-trips.

**Parity:** recorded in `docs/V1-PARITY.md` ("v2-only: the .born compat shell").
