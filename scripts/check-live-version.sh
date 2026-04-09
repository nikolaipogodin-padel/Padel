#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://nikolaipogodin-padel.github.io/Padel/}"
HTML="$(curl -fsSL "$URL")"
TITLE="$(printf '%s' "$HTML" | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' | head -n1)"
BUILD="$(printf '%s' "$HTML" | sed -n 's:.*Build \(v[0-9.]*\).*:\1:p' | head -n1)"

echo "URL:   $URL"
echo "Title: ${TITLE:-<not found>}"
echo "Build: ${BUILD:-<not found>}"
