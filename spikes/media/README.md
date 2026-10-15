# spikes/media — THROWAWAY

Experiments for the media design (docs: `docs/design/media/spikes/`). **Not part of the shipped app.**
Nothing here is imported by `src/`, bundled by `electron-builder` (its `files` list is `out/**`,
`node_modules/**`, `package.json`) or run by `npm test`.

Run any script with the repo's own Electron (`node_modules/electron`), from this folder:

    env -u ELECTRON_RUN_AS_NODE ../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron tools/<script>.js   # macOS
    ..\..\node_modules\electron\dist\electron.exe tools\<script>.js                                                    # Windows

Folders: `assets/` generated test media · `compat/` the owner-runnable compatibility test ·
`tools/` generators and measurement runners · `results/` raw JSON output.
