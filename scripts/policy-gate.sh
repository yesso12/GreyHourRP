#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${1:-$ROOT_DIR/dist}"

FORBIDDEN_PUBLIC_PATTERNS=(
  "export your loadout"
  "item catalog"
  "live players"
)

log() {
  echo "[policy-gate] $1"
}

fail() {
  echo "[policy-gate] FAIL: $1" >&2
  exit 1
}

if [[ ! -d "$DIST_DIR" ]]; then
  fail "dist directory missing: $DIST_DIR"
fi

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  fail "index.html missing in dist"
fi

# 1) Forbidden public content guard.
while IFS= read -r -d '' file; do
  base_name="$(basename "$file")"
  if [[ "$base_name" == Admin* ]] || [[ "$file" == *"/assets/Admin"* ]]; then
    continue
  fi
  lower_file="$(mktemp)"
  tr '[:upper:]' '[:lower:]' < "$file" > "$lower_file"
  for pattern in "${FORBIDDEN_PUBLIC_PATTERNS[@]}"; do
    if grep -Fq "$pattern" "$lower_file"; then
      rm -f "$lower_file"
      fail "forbidden public pattern '$pattern' found in $(realpath --relative-to="$ROOT_DIR" "$file" 2>/dev/null || echo "$file")"
    fi
  done
  rm -f "$lower_file"
done < <(find "$DIST_DIR" -type f \( -name '*.html' -o -name '*.js' -o -name '*.json' -o -name '*.txt' \) -print0)

# 2) Ensure no source maps are published.
if find "$DIST_DIR" -type f -name '*.map' | grep -q .; then
  fail "source maps found in dist output"
fi

# 3) Minimal static shell constraints.
index_size_bytes="$(wc -c < "$DIST_DIR/index.html" | tr -d ' ')"
if (( index_size_bytes > 50000 )); then
  fail "index.html unexpectedly large (${index_size_bytes} bytes)"
fi

# 4) Asset budget check for main entrypoint.
main_js="$(grep -oE '/assets/index-[^"]+\.js' "$DIST_DIR/index.html" | head -n 1 || true)"
main_js_rel="${main_js#/}"
if [[ -z "$main_js_rel" || ! -f "$DIST_DIR/$main_js_rel" ]]; then
  fail "main JS bundle reference missing in index.html"
fi
main_js_size="$(wc -c < "$DIST_DIR/$main_js_rel" | tr -d ' ')"
if (( main_js_size > 450000 )); then
  fail "main JS bundle exceeded budget (${main_js_size} bytes > 450000)"
fi

log "PASS"
