#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-/var/www/greyhourrp}"
BACKUP_DIR="${TARGET_DIR}/.releases"
RELEASE="${2:-latest}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "[rollback-static] backup directory not found: $BACKUP_DIR"
  exit 1
fi

if [[ "$RELEASE" == "latest" ]]; then
  RELEASE="$(ls -1 "$BACKUP_DIR" | sort | tail -n 1)"
fi

if [[ -z "$RELEASE" || ! -d "${BACKUP_DIR}/${RELEASE}" ]]; then
  echo "[rollback-static] release not found: ${RELEASE}"
  echo "[rollback-static] available:"
  ls -1 "$BACKUP_DIR" || true
  exit 1
fi

if [[ ! -f "${BACKUP_DIR}/${RELEASE}/index.html" || ! -d "${BACKUP_DIR}/${RELEASE}/assets" ]]; then
  echo "[rollback-static] backup is incomplete: ${BACKUP_DIR}/${RELEASE}"
  exit 1
fi

mkdir -p "${TARGET_DIR}/assets"
find "${TARGET_DIR}/assets" -mindepth 1 -delete
cp -f "${BACKUP_DIR}/${RELEASE}/index.html" "${TARGET_DIR}/index.html"
cp -a "${BACKUP_DIR}/${RELEASE}/assets/." "${TARGET_DIR}/assets/"

if id www-data >/dev/null 2>&1; then
  chown -R www-data:www-data "${TARGET_DIR}/index.html" "${TARGET_DIR}/assets"
fi

echo "[rollback-static] rollback complete: ${RELEASE}"
