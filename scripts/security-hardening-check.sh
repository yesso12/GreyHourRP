#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SECURITY_CHECK_BASE_URL:-https://greyhourrp.xyz}"
SECURITY_REQUIRE_CSP="${SECURITY_REQUIRE_CSP:-false}"
SECURITY_ENFORCE="${SECURITY_ENFORCE:-false}"

headers="$(curl -sSI "$BASE_URL/" | tr -d '\r')"

require_header() {
  local name="$1"
  if ! printf '%s\n' "$headers" | grep -iq "^${name}:"; then
    if [[ "${SECURITY_ENFORCE,,}" == "true" || "${SECURITY_ENFORCE}" == "1" ]]; then
      echo "[security-hardening] missing header: ${name}" >&2
      exit 1
    fi
    echo "[security-hardening] WARN missing header: ${name}" >&2
  fi
}

require_header "x-content-type-options"
require_header "x-frame-options"
require_header "referrer-policy"
if [[ "${SECURITY_REQUIRE_CSP,,}" == "true" || "${SECURITY_REQUIRE_CSP}" == "1" ]]; then
  require_header "content-security-policy"
fi

echo "[security-hardening] PASS"
