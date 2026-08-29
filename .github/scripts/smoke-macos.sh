#!/usr/bin/env bash
# Mount a BORN .dmg, launch the app, and fail unless the window loads.
# Usage: smoke-macos.sh <path-to-dmg> [timeout-seconds]
set -euo pipefail

DMG="${1:?usage: smoke-macos.sh <dmg> [timeout]}"
TIMEOUT="${2:-90}"
LOG="$HOME/Library/Application Support/Branham or Nothing/born.log"

echo "==================  $DMG  (timeout ${TIMEOUT}s)  =================="
MP=$(hdiutil attach "$DMG" -nobrowse -noautoopen | tail -1 | sed 's/.*\(\/Volumes\/.*\)/\1/')
rm -rf /tmp/BORN-smoke.app
cp -R "$MP"/*.app /tmp/BORN-smoke.app
hdiutil detach "$MP" -quiet
xattr -cr /tmp/BORN-smoke.app
rm -f "$LOG"

BIN=$(ls "/tmp/BORN-smoke.app/Contents/MacOS/")
ARCHS=$(lipo -archs "/tmp/BORN-smoke.app/Contents/MacOS/$BIN")
echo "binary archs: $ARCHS"
# Warm the Rosetta translator when the build is x64-only on an arm64 host.
if [ "$ARCHS" = "x86_64" ] && [ "$(uname -m)" = "arm64" ]; then
  echo "x64 binary on Apple Silicon — running under Rosetta 2"
  /usr/bin/arch -x86_64 /bin/echo "rosetta warm-up" >/dev/null 2>&1 || true
fi

"/tmp/BORN-smoke.app/Contents/MacOS/$BIN" --no-sandbox --disable-gpu &
PID=$!

OK=
for _ in $(seq 1 "$TIMEOUT"); do
  sleep 1
  if [ -f "$LOG" ] && grep -q "mainWindow did-finish-load" "$LOG"; then OK=1; break; fi
  kill -0 "$PID" 2>/dev/null || { echo "::error::$DMG exited early"; cat "$LOG" 2>/dev/null || true; exit 1; }
done

kill "$PID" 2>/dev/null || true
pkill -f "BORN-smoke.app" 2>/dev/null || true
[ "$OK" = 1 ] || { echo "::error::$DMG window never loaded in ${TIMEOUT}s"; cat "$LOG" 2>/dev/null || true; exit 1; }

echo "PASS — $DMG window loaded"
grep -E "BORN starting|did-finish-load|seed complete|already complete" "$LOG" || true
