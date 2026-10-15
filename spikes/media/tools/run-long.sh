#!/bin/bash
# Long-running spike chain (about 2.5 hours). Writes results/*.json(l). Keeps the Mac awake with caffeinate.
cd "$(dirname "$0")/.."
E=../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
run() { env -u ELECTRON_RUN_AS_NODE $E "$@" ; }
run tools/sync-test.js free 900       > /tmp/long-sync-free.log 2>&1
run tools/sync-test.js corrected 900  > /tmp/long-sync-corr.log 2>&1
run tools/soak.js 120 1080 2          > /tmp/long-soak1080.log 2>&1
run tools/soak.js 20 4k 1             > /tmp/long-soak4k.log 2>&1
echo ALL-DONE > /tmp/long-done.flag
