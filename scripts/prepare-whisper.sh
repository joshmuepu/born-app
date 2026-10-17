#!/bin/bash
# Fills the (git-ignored) resources/whisper/ folder that the installer ships: the speech recogniser program for this computer type and the English model.
# Usage: scripts/prepare-whisper.sh [path-to-whisper.cpp/build/bin]   (the build of whisper.cpp, MIT licence; the model is MIT too)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-}"
ARCH="$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/')"
DEST="resources/whisper/$ARCH"
MODEL="resources/whisper/ggml-base.en.bin"
SHA="a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002"
mkdir -p "$DEST"
if [ -n "$SRC" ]; then
  cp -a "$SRC"/whisper-cli "$DEST"/
  for f in "$SRC"/lib*.dylib "$SRC"/lib*.so* ; do [ -e "$f" ] && case "$(basename "$f")" in libparakeet*) ;; *) cp -a "$f" "$DEST"/ ;; esac; done
fi
[ -x "$DEST/whisper-cli" ] || { echo "No whisper-cli in $DEST - pass the whisper.cpp build/bin folder as the first argument."; exit 1; }
if [ ! -f "$MODEL" ]; then
  curl -L --fail -o "$MODEL.part" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
  mv "$MODEL.part" "$MODEL"
fi
echo "$SHA  $MODEL" | shasum -a 256 -c -
echo "ready: $DEST + $MODEL"
