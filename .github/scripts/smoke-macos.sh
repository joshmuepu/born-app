#!/usr/bin/env bash
# Mount a BORN .dmg, launch the app, and fail unless the window loads.
# Usage: smoke-macos.sh <path-to-dmg>
set -euo pipefail

DMG="${1:?usage: smoke-macos.sh <dmg>}"
LOG="$HOME/Library/Application Support/Branham or Nothing/born.log"

echo "==================  $DMG  =================="
MP=$(hdiutil attach "$DMG" -nobrowse -noautoopen | tail -1 | sed 's/.*\(\/Volumes\/.*\)/\1/')
rm -rf /tmp/BORN-smoke.app
cp -R "$MP"/*.app /tmp/BORN-smoke.app
hdiutil detach "$MP" -quiet
xattr -cr /tmp/BORN-smoke.app
rm -f "$LOG"

BIN=$(ls "/tmp/BORN-smoke.app/Contents/MacOS/")
echo "binary archs: $(lipo -archs "/tmp/BORN-smoke.app/Contents/MacOS/$BIN")"

"/tmp/BORN-smoke.app/Contents/MacOS/$BIN" &
PID=$!

OK=
for _ in $(seq 1 90); do
  sleep 1
  if [ -f "$LOG" ] && grep -q "mainWindow did-finish-load" "$LOG"; then OK=1; break; fi
  kill -0 "$PID" 2>/dev/null || { echo "::error::$DMG exited early"; cat "$LOG" 2>/dev/null || true; exit 1; }
done

kill "$PID" 2>/dev/null || true
[ "$OK" = 1 ] || { echo "::error::$DMG window never loaded"; cat "$LOG" 2>/dev/null || true; exit 1; }

echo "PASS — $DMG window loaded"
grep -E "BORN starting|did-finish-load|seed complete|already complete" "$LOG" || true
