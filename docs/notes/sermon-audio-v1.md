# Sermon audio ("tape service") — what v1 would need

This feature is **v2 only**. If the owner later wants it in v1, it is a deliberate decision, not a merge. What v1 (v1.13.x) would need:
- **No Graphics profile system** (v1 has no Graphics output), so only the operator reader, the congregation window and the stage monitor could show it.
- **No media library** (no managed files, preflight, `.bornpack`): the audio would need its own file handling, hash, missing-file and drive-offline checks.
- **No playback record / panic framework** (those arrived with v2's video): the audio engine, the per-channel tape record and the Esc rules would have to be written from scratch.
- **Queue file format:** unchanged. A tape lives in new tables, not in `.born`, so v1 files stay readable by every build.
- The sermon **paragraph model** is shared (`splitSubParagraphs`, `paragraphRef`), so the sync map keys would carry over.
Nothing in v1 was touched or changed by this design.
