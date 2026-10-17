#!/bin/bash
# Regression passes on a FRESH throw-away profile: history, queue drag-and-drop, songs/A-Z, Channels/Destinations/Profiles, phone remote (Chromium + WebKit), Graphics.
# Needs: `npm run rebuild:native` done, and playwright (installed once into a scratch folder: PW_DIR, default /tmp/born-pw: `mkdir -p /tmp/born-pw && cd /tmp/born-pw && npm i playwright && npx playwright install webkit`).
# Never touches real data or ports: BORN_USER_DATA_DIR / BORN_REMOTE_PORT=4317 / BORN_MDNS_NAME are set here. Prints "N checks, M failed" per script.
cd "$(dirname "$0")/../.." || exit 1
PW_DIR=${PW_DIR:-/tmp/born-pw}; export NODE_PATH="$PW_DIR/node_modules"
OUT=${OUT:-/tmp/born-regression-out}; mkdir -p "$OUT"
for s in ${@:-hist dnd az reg rem gfx2}; do
  pkill -f "remoteDebuggingPort 9920" 2>/dev/null; sleep 2
  rm -rf "$OUT/profile"; mkdir -p "$OUT/profile"
  (env -u ELECTRON_RUN_AS_NODE BORN_USER_DATA_DIR="$OUT/profile" BORN_REMOTE_PORT=4317 BORN_MDNS_NAME=born-reg ./node_modules/.bin/electron-vite dev --remoteDebuggingPort 9920 > "$OUT/dev.log" 2>&1 &)
  for i in $(seq 1 60); do curl -s localhost:9920/json 2>/dev/null | grep -q "Born Again" && break; sleep 1; done; sleep 8
  node "scripts/regression/$s.cjs" "$OUT" > "$OUT/$s.log" 2>&1; rc=$?
  printf '%-5s exit %s  %s\n' "$s" "$rc" "$(grep -E ' checks, ' "$OUT/$s.log" | tail -1)"
done
pkill -f "remoteDebuggingPort 9920" 2>/dev/null
