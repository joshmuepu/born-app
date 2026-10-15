# Codec check (throwaway)

Asks the repo's own Electron (33.4.11 / Chromium 130) which media formats it claims to play.
Run from this folder: `env -u ELECTRON_RUN_AS_NODE ../../../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`
(macOS path; adjust per OS). Result of the 2026-10-15 run on macOS is `out.json`.
`canPlayType` reports what the engine *claims*; it does not prove a given file plays — see the roadmap spikes.
