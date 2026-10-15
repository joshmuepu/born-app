#!/bin/bash
# macOS: runs the unattended media spikes, keeping the Mac awake (display, idle, disk, system sleep).
cd "$(dirname "$0")"
ELECTRON_RUN_AS_NODE=1 caffeinate -dims ../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron overnight.js "$@"
echo; echo "Finished. Look in docs/design/media/spikes/results/ for the OVERNIGHT-*.md file."
