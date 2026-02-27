#!/usr/bin/env bash
set -euo pipefail

SERVICE_BLUE="${ADMIN_API_BLUE_SERVICE:-greyhourrp-admin-api-blue}"
SERVICE_GREEN="${ADMIN_API_GREEN_SERVICE:-greyhourrp-admin-api-green}"
ACTIVE_MARKER="${ADMIN_API_ACTIVE_MARKER:-/var/lib/greyhourrp-admin-api/active-color}"
UPSTREAM_INCLUDE="${ADMIN_API_UPSTREAM_INCLUDE:-/etc/nginx/conf.d/greyhourrp-admin-api-upstream.inc}"
BLUE_PORT="${ADMIN_API_BLUE_PORT:-5056}"
GREEN_PORT="${ADMIN_API_GREEN_PORT:-5057}"
TARGET="${1:-promote-green}"

mkdir -p "$(dirname "$ACTIVE_MARKER")"
mkdir -p "$(dirname "$UPSTREAM_INCLUDE")"

health_check() {
  local port="$1"
  local attempts=12
  local delay=1
  local i code
  for i in $(seq 1 "$attempts"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/api/telemetry" || true)"
    if [[ "$code" == "204" || "$code" == "200" ]]; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

switch_upstream() {
  local port="$1"
  printf 'server 127.0.0.1:%s;\n' "$port" > "$UPSTREAM_INCLUDE"
  nginx -t >/dev/null
  systemctl reload nginx
}

case "$TARGET" in
  promote-green)
    systemctl restart "$SERVICE_GREEN"
    systemctl is-active --quiet "$SERVICE_GREEN"
    health_check "$GREEN_PORT"
    switch_upstream "$GREEN_PORT"
    printf 'green\n' > "$ACTIVE_MARKER"
    echo "[admin-api-bluegreen] promoted green (${GREEN_PORT})"
    ;;
  promote-blue)
    systemctl restart "$SERVICE_BLUE"
    systemctl is-active --quiet "$SERVICE_BLUE"
    health_check "$BLUE_PORT"
    switch_upstream "$BLUE_PORT"
    printf 'blue\n' > "$ACTIVE_MARKER"
    echo "[admin-api-bluegreen] promoted blue (${BLUE_PORT})"
    ;;
  status)
    current="unknown"
    [[ -f "$ACTIVE_MARKER" ]] && current="$(cat "$ACTIVE_MARKER")"
    echo "[admin-api-bluegreen] active=$current"
    echo "[admin-api-bluegreen] upstream=$(cat "$UPSTREAM_INCLUDE" 2>/dev/null || echo 'missing')"
    systemctl is-active "$SERVICE_BLUE" || true
    systemctl is-active "$SERVICE_GREEN" || true
    ;;
  *)
    echo "usage: $0 [promote-green|promote-blue|status]" >&2
    exit 2
    ;;
esac
