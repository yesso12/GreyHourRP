#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${1:-$ROOT_DIR/dist}"
OUT_DIR="${2:-$DIST_DIR/provenance}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "[provenance] dist dir not found: $DIST_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

manifest="$OUT_DIR/manifest.sha256"
meta_json="$OUT_DIR/release-meta.json"

(
  cd "$DIST_DIR"
  find . -type f ! -path './provenance/*' -print0 | sort -z | xargs -0 sha256sum
) > "$manifest"

build_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
git_commit="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
git_ref="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

cat > "$meta_json" <<JSON
{
  "buildTimeUtc": "$build_time",
  "gitCommit": "$git_commit",
  "gitRef": "$git_ref",
  "manifestFile": "manifest.sha256"
}
JSON

if [[ -n "${PROVENANCE_SIGNING_KEY:-}" ]] && command -v openssl >/dev/null 2>&1; then
  printf '%s' "$PROVENANCE_SIGNING_KEY" > "$OUT_DIR/signing.key"
  chmod 600 "$OUT_DIR/signing.key"
  openssl dgst -sha256 -hmac "$(cat "$OUT_DIR/signing.key")" -out "$OUT_DIR/manifest.sha256.sig" "$manifest"
  rm -f "$OUT_DIR/signing.key"
  echo "[provenance] signed manifest"
fi

echo "[provenance] wrote $manifest and $meta_json"
