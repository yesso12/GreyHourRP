#!/usr/bin/env bash
set -euo pipefail

CONTENT_ROOT="${CONTENT_ROOT:-/var/www/greyhourrp/content}"
BOT_DATA_ROOT="${BOT_DATA_ROOT:-/opt/greyhourrp-discord-bot/data}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/greyhourrp}"
QUARANTINE_ROOT="${QUARANTINE_ROOT:-${BACKUP_ROOT}/quarantine}"
ENABLE_AUTO_RESTORE_ON_CORRUPTION="${ENABLE_AUTO_RESTORE_ON_CORRUPTION:-true}"
CONTENT_SCAN_MAXDEPTH="${CONTENT_SCAN_MAXDEPTH:-1}"

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

log() {
  echo "[integrity-check] $1"
}

is_json_file_valid() {
  local path="$1"
  node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.argv[1],'utf8'));" "$path" >/dev/null 2>&1
}

latest_backup_archive() {
  find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'greyhourrp-backup-*.tar.gz' | sort | tail -n 1
}

restore_from_latest_backup() {
  local kind="$1"
  local rel="$2"
  local dest="$3"
  local archive
  archive="$(latest_backup_archive)"
  if [[ -z "$archive" ]]; then
    log "no backup archive available for restore: ${kind}/${rel}"
    return 1
  fi

  local tmpdir
  tmpdir="$(mktemp -d)"
  tar -xzf "$archive" -C "$tmpdir"

  local extract_root
  extract_root="$(find "$tmpdir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$extract_root" ]]; then
    rm -rf "$tmpdir"
    log "restore extract failed for ${archive}"
    return 1
  fi

  local src
  if [[ "$kind" == "content" ]]; then
    src="$extract_root/content/$rel"
  else
    src="$extract_root/bot-data/$rel"
  fi

  if [[ ! -f "$src" ]]; then
    rm -rf "$tmpdir"
    log "backup missing file: ${kind}/${rel}"
    return 1
  fi

  if ! is_json_file_valid "$src"; then
    rm -rf "$tmpdir"
    log "backup file invalid JSON: ${kind}/${rel}"
    return 1
  fi

  mkdir -p "$(dirname "$dest")"
  cp -f "$src" "$dest"
  rm -rf "$tmpdir"
  log "restored from backup: ${kind}/${rel}"
  return 0
}

scan_root_json() {
  local kind="$1"
  local root="$2"
  local -n out_arr_ref=$3

  if [[ ! -d "$root" ]]; then
    log "root missing, skipping ${kind}: $root"
    return 0
  fi

  local list_file
  local bad_file
  list_file="$(mktemp)"
  bad_file="$(mktemp)"
  if [[ "$kind" == "content" ]]; then
    find "$root" -maxdepth "$CONTENT_SCAN_MAXDEPTH" -type f -name '*.json' | sort > "$list_file"
  else
    find "$root" -type f -name '*.json' | sort > "$list_file"
  fi
  node -e '
    const fs = require("fs");
    const files = fs.readFileSync(process.argv[1], "utf8").split(/\n/).filter(Boolean);
    for (const file of files) {
      try {
        JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        process.stdout.write(file + "\n");
      }
    }
  ' "$list_file" > "$bad_file"

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local rel="${file#$root/}"
    out_arr_ref+=("${kind}|${root}|${rel}|${file}")
  done < "$bad_file"

  rm -f "$list_file" "$bad_file"
}

main() {
  local -a corrupt=()
  scan_root_json "content" "$CONTENT_ROOT" corrupt
  scan_root_json "bot-data" "$BOT_DATA_ROOT" corrupt

  if [[ "${#corrupt[@]}" -eq 0 ]]; then
    log "no corruption detected"
    exit 0
  fi

  log "detected ${#corrupt[@]} corrupt JSON file(s)"
  local stamp
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  local quarantine_dir="${QUARANTINE_ROOT}/${stamp}"
  mkdir -p "$quarantine_dir"

  local failures=0
  local record
  for record in "${corrupt[@]}"; do
    IFS='|' read -r kind root rel path <<< "$record"

    local qdest="$quarantine_dir/${kind}/${rel}"
    mkdir -p "$(dirname "$qdest")"
    mv -f "$path" "$qdest"
    log "quarantined ${kind}/${rel} -> ${qdest}"

    if is_true "$ENABLE_AUTO_RESTORE_ON_CORRUPTION"; then
      if ! restore_from_latest_backup "$kind" "$rel" "$path"; then
        failures=$((failures + 1))
      fi
    else
      failures=$((failures + 1))
    fi
  done

  if (( failures > 0 )); then
    log "corruption remediation incomplete; failures=${failures}"
    exit 1
  fi

  log "corruption remediation complete"
}

main "$@"
