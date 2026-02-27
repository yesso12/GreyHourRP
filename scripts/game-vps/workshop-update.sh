#!/usr/bin/env bash
set -euo pipefail

# Grey Hour RP - Project Zomboid workshop updater
#
# Required:
#   STEAMCMD_PATH=/path/to/steamcmd or steamcmd.sh
#   GAME_APP_ID=xxxxxx
#
# Optional:
#   WORKSHOP_APP_ID=xxxxxx (defaults to GAME_APP_ID)
#   WORKSHOP_IDS="id1;id2;id3"
#   SERVER_INI=/path/to/Server.ini (parsed for WorkshopItems=)
#   INSTALL_DIR=/path/to/pz/server
#   STEAM_LOGIN="anonymous" (or user)
#

STEAMCMD_PATH="${STEAMCMD_PATH:-}"
GAME_APP_ID="${GAME_APP_ID:-}"
WORKSHOP_APP_ID="${WORKSHOP_APP_ID:-${GAME_APP_ID}}"
WORKSHOP_IDS="${WORKSHOP_IDS:-}"
SERVER_INI="${SERVER_INI:-}"
WORKSHOP_INSTALL_DIR="${WORKSHOP_INSTALL_DIR:-}"
INSTALL_DIR="${INSTALL_DIR:-}"
STEAM_LOGIN="${STEAM_LOGIN:-anonymous}"

if [[ -z "${STEAMCMD_PATH}" || -z "${GAME_APP_ID}" ]]; then
  echo "[error] Set STEAMCMD_PATH and GAME_APP_ID."
  exit 1
fi

if [[ -z "${WORKSHOP_IDS}" && -n "${SERVER_INI}" && -f "${SERVER_INI}" ]]; then
  WORKSHOP_IDS="$(grep -E '^\s*WorkshopItems\s*=' "${SERVER_INI}" | head -n 1 | cut -d '=' -f2- | tr -d '[:space:]')"
fi

IFS=';' read -r -a WORKSHOP_LIST <<< "${WORKSHOP_IDS}"

CMD=("${STEAMCMD_PATH}" "+login" "${STEAM_LOGIN}")
install_dir="${WORKSHOP_INSTALL_DIR:-${INSTALL_DIR}}"
if [[ -n "${install_dir}" ]]; then
  CMD+=("+force_install_dir" "${install_dir}")
fi
CMD+=("+app_update" "${GAME_APP_ID}" "validate")

if [[ -n "${WORKSHOP_IDS}" ]]; then
  for wid in "${WORKSHOP_LIST[@]}"; do
    if [[ -n "${wid}" ]]; then
      CMD+=("+workshop_download_item" "${WORKSHOP_APP_ID}" "${wid}")
    fi
  done
else
  echo "[warn] No workshop IDs provided or detected. Only running app_update."
fi

CMD+=("+quit")

echo "[info] Running steamcmd update..."
"${CMD[@]}"
echo "[ok] Workshop update complete."
