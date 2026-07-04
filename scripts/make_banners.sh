#!/usr/bin/env bash
set -euo pipefail

GAMES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/games"
QUALITY=80

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp not found. Install with: brew install webp" >&2
  exit 1
fi

shopt -s nullglob
for png in "$GAMES_DIR"/*/*.png; do
  dir="$(dirname "$png")"
  webp="$dir/banner.webp"
  cwebp -q "$QUALITY" "$png" -o "$webp"
  rm "$png"
  echo "Converted $(basename "$dir")/$(basename "$png") -> $(basename "$dir")/banner.webp"
done
