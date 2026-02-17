#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/greyhourrp}"
DRILL_ROOT="${RESTORE_DRILL_ROOT:-/tmp/greyhourrp-restore-drill}"
KEEP_LATEST="${RESTORE_DRILL_KEEP_LATEST:-3}"

log() {
  echo "[restore-drill] $1"
}

is_json_file_valid() {
  local path="$1"
  node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.argv[1],'utf8'));" "$path" >/dev/null 2>&1
}

mkdir -p "${BACKUP_ROOT}"
mkdir -p "${DRILL_ROOT}"

LATEST_ARCHIVE="$(find "${BACKUP_ROOT}" -maxdepth 1 -type f -name 'greyhourrp-backup-*.tar.gz' | sort | tail -n 1)"
if [[ -z "${LATEST_ARCHIVE}" ]]; then
  log "no backup archive found in ${BACKUP_ROOT}"
  exit 1
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TARGET_DIR="${DRILL_ROOT}/${STAMP}"
mkdir -p "${TARGET_DIR}"

log "using archive: ${LATEST_ARCHIVE}"
tar -xzf "${LATEST_ARCHIVE}" -C "${TARGET_DIR}"

EXTRACT_ROOT="$(find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [[ -z "${EXTRACT_ROOT}" ]]; then
  log "extract failed: no root directory found"
  exit 1
fi

CONTENT_DIR="${EXTRACT_ROOT}/content"
BOT_DATA_DIR="${EXTRACT_ROOT}/bot-data"

if [[ ! -d "${CONTENT_DIR}" ]]; then
  log "content directory missing in extracted backup"
  exit 1
fi
if [[ ! -d "${BOT_DATA_DIR}" ]]; then
  log "bot-data directory missing in extracted backup"
  exit 1
fi

if [[ ! -f "${CONTENT_DIR}/server-status.json" ]]; then
  log "missing required file: ${CONTENT_DIR}/server-status.json"
  exit 1
fi

if ! is_json_file_valid "${CONTENT_DIR}/server-status.json"; then
  log "invalid JSON: ${CONTENT_DIR}/server-status.json"
  exit 1
fi

if [[ -f "${CONTENT_DIR}/mods.json" ]] && ! is_json_file_valid "${CONTENT_DIR}/mods.json"; then
  log "invalid JSON: ${CONTENT_DIR}/mods.json"
  exit 1
fi

log "restore drill validation: PASS"
log "content files: $(find "${CONTENT_DIR}" -type f | wc -l)"
log "bot-data files: $(find "${BOT_DATA_DIR}" -type f | wc -l)"

if [[ "${KEEP_LATEST}" =~ ^[0-9]+$ ]] && [[ "${KEEP_LATEST}" -ge 1 ]]; then
  mapfile -t old_dirs < <(find "${DRILL_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort | head -n "-${KEEP_LATEST}" || true)
  for d in "${old_dirs[@]}"; do
    rm -rf "${d}"
    log "pruned old drill dir: ${d}"
  done
fi

log "restore drill complete"
