#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://nikolaipogodin-padel.github.io/Padel/}"
ATTEMPTS="${ATTEMPTS:-5}"
SLEEP_SEC="${SLEEP_SEC:-3}"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

extract() {
  local html="$1"
  local title build
  title="$(printf '%s' "$html" | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' | head -n1)"
  build="$(printf '%s' "$html" | sed -n 's:.*Build \(v[0-9.]*\).*:\1:p' | head -n1)"
  printf '%s\n%s\n' "${title:-<not found>}" "${build:-<not found>}"
}

last_err=""
for i in $(seq 1 "$ATTEMPTS"); do
  probe_url="${URL}?cache_bust=$(date +%s)-${i}"
  if html="$(curl -A "$UA" -fsSL "$probe_url" 2>/tmp/live_check_err.log)"; then
    mapfile -t parsed < <(extract "$html")
    echo "URL:   $probe_url"
    echo "Title: ${parsed[0]}"
    echo "Build: ${parsed[1]}"
    exit 0
  fi
  last_err="$(cat /tmp/live_check_err.log 2>/dev/null || true)"
  sleep "$SLEEP_SEC"
done

echo "URL:   $URL"
echo "Title: <unavailable>"
echo "Build: <unavailable>"
echo "Error: ${last_err:-unknown error}" >&2
exit 1
