# This folder: BORN v2 ("Born Again")

Unreleased. Branch `v2-channels`. Never tag or release from here.
Internal identity stays `2.0.0-dev.N` / `com.joshmuepu.born.v2dev`
until the owner says otherwise. v1 fixes arrive via `git merge main`.
Nothing under `docs/commercial` is ever pushed.

## v1 parity

- At the start of every session in this folder: `git fetch`, then
  `git log v2-channels..origin/main --oneline`. If that shows anything,
  tell the owner what it is before doing other work. Never merge it in
  without being asked.
- v2 must always get every v1 fix. Port a bug fix by its intent into
  v2's current code (the UI is being redesigned, so a diff may not
  apply as-is), add or adapt a test for it, and record it in
  `docs/V1-PARITY.md`.
- v1 *features* are not merged automatically. Each gets its own entry
  in `docs/V1-PARITY.md` (not started / investigating / ported /
  intentionally different) and the owner decides if/when it's ported.
- Never overwrite v2's identity or the `v1.x.x`-only release tag gate
  when merging `main` in.
