#!/bin/bash
# Start BORN (dev build) on a THROW-AWAY profile so you can try the OBS setup without touching real data, then print what to do next.
# Nothing here needs a password or a key. Usage: scripts/obs-demo.sh [port]   (default port 4399; never the real 4316)
set -e
cd "$(dirname "$0")/.."
PORT="${1:-4399}"
if [ "$PORT" = "4316" ]; then echo "Refusing to use 4316 (a real BORN may be using it). Pick another port."; exit 1; fi
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $PORT is already in use. Close that program (or another BORN), or pass a different port."; exit 1; fi
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/born-obs-demo.XXXXXX")"
# ELECTRON_RUN_AS_NODE must be unset or Electron behaves as plain Node and will not open.
env -u ELECTRON_RUN_AS_NODE BORN_USER_DATA_DIR="$PROFILE" BORN_REMOTE_PORT="$PORT" BORN_MDNS_NAME=born-obs-demo \
  ./node_modules/.bin/electron . >"$PROFILE/born.log" 2>&1 &
BORN_PID=$!
echo "BORN started (pid $BORN_PID) with a temporary profile: $PROFILE"
for _ in $(seq 1 60); do curl -s -m1 "http://127.0.0.1:$PORT/state" >/dev/null 2>&1 && break; sleep 0.5; done
cat <<TXT

Next, in BORN:
  1. Screens -> Manage... -> Outputs -> "Add Graphics" (on Main).
  2. Under the new row, copy the address that says "OBS on this computer". It looks like:
       http://127.0.0.1:$PORT/output/graphics/<output-id>
     Add one of these endings for the layout you want:
       ?profile=lower-third   (transparent band at the bottom, over the camera)
       ?profile=fullscreen    (solid full-screen layout)

Next, in OBS (use a SEPARATE profile and scene collection, e.g. "BORN-Test", so your own are not touched):
  3. Scene Collection -> Import -> docs/manual/obs/BORN-scenes.json, then Scene Collection -> BORN.
  4. In the sources "BORN Lower Third" and "BORN Full-screen", replace http://127.0.0.1:4316/output/graphics/PASTE-YOUR-OUTPUT-ID-HERE
     with http://127.0.0.1:$PORT/output/graphics/<output-id>  (keep the ?profile=... ending).
  5. Project a Bible verse in BORN and watch scene "1 Camera + Lower Third".

Demo steps (pause a few seconds between each): scripture -> next verse -> a song with a moving background -> an announcement picture -> a video clip
-> a YouTube item (OBS shows the name only) -> an alert (room only) -> Esc (clears room and stream) -> phone remote Next/Blank -> quit and restart BORN
(the overlay returns by itself in a few seconds).

When finished:   kill $BORN_PID ; rm -rf "$PROFILE"
TXT
