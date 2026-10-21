#!/usr/bin/env bash
# Quick launcher for Linux MMC/SD Flow Explorer
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8080

echo "Starting MMC/SD Detection Flow Explorer on http://localhost:$PORT ..."
if which xdg-open > /dev/null 2>&1; then
    (sleep 1 && xdg-open "http://localhost:$PORT/index.html") &
fi

python3 -m http.server "$PORT" --directory "$DIR"
