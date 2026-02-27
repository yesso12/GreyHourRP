#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://greyhourrp.xyz}"

fail() {
  echo "[smoke] FAIL: $1"
  exit 1
}

check_route() {
  local route="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}${route}")"
  if [[ "$code" != "200" ]]; then
    fail "${route} returned HTTP ${code}"
  fi
  echo "[smoke] route OK: ${route}"
}

echo "[smoke] checking SPA shell and route health at ${BASE_URL}"

index_html="$(curl -sS "${BASE_URL}/index.html")"
[[ -n "$index_html" ]] || fail "index.html response was empty"

js_asset="$(printf '%s' "$index_html" | sed -n 's/.*src="\([^"]*index-[^"]*\.js\)".*/\1/p' | head -n 1)"
css_asset="$(printf '%s' "$index_html" | sed -n 's/.*href="\([^"]*index-[^"]*\.css\)".*/\1/p' | head -n 1)"

[[ -n "$js_asset" ]] || fail "could not find hashed JS asset in index.html"
[[ -n "$css_asset" ]] || fail "could not find hashed CSS asset in index.html"

index_cache="$(curl -sSI "${BASE_URL}/index.html" | tr -d '\r' | sed -n 's/^cache-control: //Ip' | tail -n 1)"
[[ "$index_cache" == *"no-store"* ]] || fail "index.html cache-control missing no-store"
echo "[smoke] cache OK: /index.html (${index_cache})"

asset_cache="$(curl -sSI "${BASE_URL}${js_asset}" | tr -d '\r' | sed -n 's/^cache-control: //Ip' | tail -n 1)"
[[ "$asset_cache" == *"immutable"* ]] || fail "JS asset cache-control missing immutable"
echo "[smoke] cache OK: ${js_asset} (${asset_cache})"

check_route "/"
check_route "/about"
check_route "/directory"
check_route "/status"
check_route "/discord"
check_route "/updates"
check_route "/events"
check_route "/factions"
check_route "/mods"
check_route "/rules"
check_route "/how-to-join"
check_route "/transmissions"

echo "[smoke] PASS"
