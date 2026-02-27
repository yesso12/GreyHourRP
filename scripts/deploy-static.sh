#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-}"
TARGET_DIR="${2:-/var/www/greyhourrp}"
BACKUP_DIR="${TARGET_DIR}/.releases"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

if [[ -z "$SRC_DIR" || ! -d "$SRC_DIR" ]]; then
  echo "[deploy-static] source directory is required"
  echo "[deploy-static] usage: deploy-static.sh <built-dist-dir> [target-dir]"
  exit 1
fi

if [[ ! -f "${SRC_DIR}/index.html" || ! -d "${SRC_DIR}/assets" ]]; then
  echo "[deploy-static] source must contain index.html and assets/"
  exit 1
fi

mkdir -p "$TARGET_DIR" "$BACKUP_DIR"

if [[ -f "${TARGET_DIR}/index.html" || -d "${TARGET_DIR}/assets" || -d "${TARGET_DIR}/audio" ]]; then
  mkdir -p "${BACKUP_DIR}/${STAMP}"
  [[ -f "${TARGET_DIR}/index.html" ]] && cp -a "${TARGET_DIR}/index.html" "${BACKUP_DIR}/${STAMP}/index.html"
  [[ -d "${TARGET_DIR}/assets" ]] && cp -a "${TARGET_DIR}/assets" "${BACKUP_DIR}/${STAMP}/assets"
  [[ -d "${TARGET_DIR}/audio" ]] && cp -a "${TARGET_DIR}/audio" "${BACKUP_DIR}/${STAMP}/audio"
  echo "[deploy-static] backup created at ${BACKUP_DIR}/${STAMP}"
fi

mkdir -p "${TARGET_DIR}/assets"
mkdir -p "${TARGET_DIR}/audio"
find "${TARGET_DIR}/audio" -mindepth 1 -delete
cp -f "${SRC_DIR}/index.html" "${TARGET_DIR}/index.html"
cp -a "${SRC_DIR}/assets/." "${TARGET_DIR}/assets/"
if [[ -d "${SRC_DIR}/audio" ]]; then
  cp -a "${SRC_DIR}/audio/." "${TARGET_DIR}/audio/"
fi

if id www-data >/dev/null 2>&1; then
  chown -R www-data:www-data "${TARGET_DIR}/index.html" "${TARGET_DIR}/assets" "${TARGET_DIR}/audio"
fi

echo "[deploy-static] deploy complete"
