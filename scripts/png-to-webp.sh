#!/usr/bin/env bash
set -euo pipefail

ASSETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/assets"
QUALITY=80

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp not found. Install with: brew install webp" >&2
  exit 1
fi

shopt -s nullglob
for png in "$ASSETS_DIR"/*.png; do
  webp="${png%.png}.webp"
  cwebp -q "$QUALITY" "$png" -o "$webp"
  rm "$png"
  echo "Converted $(basename "$png") -> $(basename "$webp")"
done
