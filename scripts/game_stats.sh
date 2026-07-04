#!/usr/bin/env bash
set -euo pipefail

GAMES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/games"

for file in "$GAMES_DIR"/*/index.ts; do
  dir="$(dirname "$file")"
  lines="$(wc -l <"$file" | tr -d ' ')"
  printf '%-20s %s lines\n' "$(basename "$dir")" "$lines"
done | sort -k2 -n -r
