#!/usr/bin/env bash
set -euo pipefail

JOB_NAME="${1:-unknown-job}"
EXIT_CODE="${2:-1}"
LOG_FILE="${3:-}"
HOST_NAME="$(hostname -f 2>/dev/null || hostname)"
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [[ -f /etc/default/greyhourrp-automation ]]; then
  # shellcheck disable=SC1091
  source /etc/default/greyhourrp-automation
fi

AUTOMATION_ALERTS_ENABLED="${AUTOMATION_ALERTS_ENABLED:-true}"
AUTOMATION_ALERT_WEBHOOK_URL="${AUTOMATION_ALERT_WEBHOOK_URL:-}"
AUTOMATION_ALERT_MAX_LINES="${AUTOMATION_ALERT_MAX_LINES:-25}"
AUTOMATION_ALERT_MAX_CHARS="${AUTOMATION_ALERT_MAX_CHARS:-3500}"
AUTOMATION_ALERT_STATE_DIR="${AUTOMATION_ALERT_STATE_DIR:-/var/lib/greyhourrp-automation-alerts}"
AUTOMATION_ALERT_WEBHOOK_DISABLE_AFTER_FAILS="${AUTOMATION_ALERT_WEBHOOK_DISABLE_AFTER_FAILS:-3}"
AUTOMATION_ALERT_WEBHOOK_DISABLE_SECONDS="${AUTOMATION_ALERT_WEBHOOK_DISABLE_SECONDS:-3600}"
AUTOMATION_ALERT_WEBHOOK_PROBE_INTERVAL_SECONDS="${AUTOMATION_ALERT_WEBHOOK_PROBE_INTERVAL_SECONDS:-300}"
AUTOMATION_ALERT_CHANNEL_ID="${AUTOMATION_ALERT_CHANNEL_ID:-}"
AUTOMATION_DISCORD_TOKEN="${AUTOMATION_DISCORD_TOKEN:-}"
AUTOMATION_DISCORD_TOKEN_FILE="${AUTOMATION_DISCORD_TOKEN_FILE:-/opt/greyhourrp-discord-bot/.env}"
AUTOMATION_ALERT_CHANNEL_KEY="${AUTOMATION_ALERT_CHANNEL_KEY:-LOG_CHANNEL_ID}"

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

if ! is_true "${AUTOMATION_ALERTS_ENABLED}"; then
  exit 0
fi

extract_env_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "${file}" ]]; then
    return 1
  fi
  local line
  line="$(grep -m1 "^${key}=" "${file}" || true)"
  if [[ -z "${line}" ]]; then
    return 1
  fi
  local value="${line#*=}"
  # Remove matching quotes when present.
  if [[ "${value}" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

STATUS_TEXT="FAILED"
if [[ "${EXIT_CODE}" == "0" ]]; then
  STATUS_TEXT="SUCCESS"
fi

LOG_TAIL="(no log output)"
if [[ -n "${LOG_FILE}" && -f "${LOG_FILE}" ]]; then
  LOG_TAIL="$(tail -n "${AUTOMATION_ALERT_MAX_LINES}" "${LOG_FILE}" || true)"
  if [[ -z "${LOG_TAIL}" ]]; then
    LOG_TAIL="(no log output)"
  fi
fi

# Keep payload bounded.
LOG_TAIL="${LOG_TAIL:0:${AUTOMATION_ALERT_MAX_CHARS}}"
LOG_TAIL="$(printf '%s' "${LOG_TAIL}" | sed -r 's/\x1B\[[0-9;]*[A-Za-z]//g' | tr -cd '\11\12\15\40-\176')"

CONTENT_RAW=$(
  cat <<EOF
[automation] ${STATUS_TEXT}
host=${HOST_NAME}
job=${JOB_NAME}
exitCode=${EXIT_CODE}
timeUtc=${NOW_UTC}

lastLogs:
${LOG_TAIL}
EOF
)

# Discord channel messages have a strict max length (2000 chars).
MAX_DISCORD_CONTENT_CHARS=1900
if [[ ${#CONTENT_RAW} -gt ${MAX_DISCORD_CONTENT_CHARS} ]]; then
  CONTENT_RAW="${CONTENT_RAW:0:${MAX_DISCORD_CONTENT_CHARS}}"
fi

PAYLOAD="$(
  CONTENT_RAW="${CONTENT_RAW}" node -e "process.stdout.write(JSON.stringify({content: process.env.CONTENT_RAW || ''}))"
)"

send_via_webhook() {
  if [[ -z "${AUTOMATION_ALERT_WEBHOOK_URL}" ]]; then
    return 1
  fi
  mkdir -p "${AUTOMATION_ALERT_STATE_DIR}"
  local webhook_hash="default"
  if command -v sha256sum >/dev/null 2>&1; then
    webhook_hash="$(printf '%s' "${AUTOMATION_ALERT_WEBHOOK_URL}" | sha256sum | awk '{print $1}')"
  else
    webhook_hash="$(printf '%s' "${AUTOMATION_ALERT_WEBHOOK_URL}" | cksum | awk '{print $1}')"
  fi
  local state_file="${AUTOMATION_ALERT_STATE_DIR}/webhook-${webhook_hash}.state"
  local now_epoch
  now_epoch="$(date +%s)"
  local fail_count=0
  local disabled_until=0
  local last_probe=0
  if [[ -f "${state_file}" ]]; then
    # shellcheck disable=SC1090
    source "${state_file}" || true
    fail_count="${fail_count:-0}"
    disabled_until="${disabled_until:-0}"
    last_probe="${last_probe:-0}"
  fi

  if (( now_epoch < disabled_until )); then
    local since_probe=$((now_epoch - last_probe))
    if (( since_probe < AUTOMATION_ALERT_WEBHOOK_PROBE_INTERVAL_SECONDS )); then
      echo "[notify-automation] webhook temporarily disabled until ${disabled_until}; skipping webhook send" >&2
      return 1
    fi

    local probe_code
    probe_code="$(
      curl --silent --show-error --location \
        --output /tmp/greyhourrp-automation-alert-webhook-probe.out \
        --write-out "%{http_code}" \
        "${AUTOMATION_ALERT_WEBHOOK_URL}" || true
    )"
    last_probe="${now_epoch}"
    if [[ "${probe_code}" == "200" || "${probe_code}" == "204" ]]; then
      fail_count=0
      disabled_until=0
      echo "[notify-automation] webhook probe recovered; re-enabled" >&2
    else
      printf 'fail_count=%s\ndisabled_until=%s\nlast_probe=%s\n' "${fail_count}" "${disabled_until}" "${last_probe}" > "${state_file}"
      echo "[notify-automation] webhook probe still failing code=${probe_code}; keep disabled" >&2
      return 1
    fi
  fi

  local code
  code="$(
    curl --silent --show-error --location \
      --output /tmp/greyhourrp-automation-alert-webhook.out \
      --write-out "%{http_code}" \
      --header "Content-Type: application/json" \
      --data "${PAYLOAD}" \
      "${AUTOMATION_ALERT_WEBHOOK_URL}" || true
  )"
  if [[ "${code}" == "200" || "${code}" == "204" ]]; then
    printf 'fail_count=0\ndisabled_until=0\nlast_probe=0\n' > "${state_file}"
    return 0
  fi
  fail_count=$((fail_count + 1))
  if (( fail_count >= AUTOMATION_ALERT_WEBHOOK_DISABLE_AFTER_FAILS )); then
    disabled_until=$((now_epoch + AUTOMATION_ALERT_WEBHOOK_DISABLE_SECONDS))
  fi
  printf 'fail_count=%s\ndisabled_until=%s\nlast_probe=%s\n' "${fail_count}" "${disabled_until}" "${last_probe}" > "${state_file}"
  local body
  body="$(head -c 300 /tmp/greyhourrp-automation-alert-webhook.out 2>/dev/null || true)"
  echo "[notify-automation] webhook send failed code=${code} fail_count=${fail_count} disabled_until=${disabled_until} body=${body}" >&2
  return 1
}

send_via_bot_api() {
  local token="${AUTOMATION_DISCORD_TOKEN}"
  local channel="${AUTOMATION_ALERT_CHANNEL_ID}"

  if [[ -z "${token}" && -f "${AUTOMATION_DISCORD_TOKEN_FILE}" ]]; then
    token="$(extract_env_value "${AUTOMATION_DISCORD_TOKEN_FILE}" "DISCORD_TOKEN" || true)"
  fi
  if [[ -z "${channel}" && -f "${AUTOMATION_DISCORD_TOKEN_FILE}" ]]; then
    channel="$(extract_env_value "${AUTOMATION_DISCORD_TOKEN_FILE}" "${AUTOMATION_ALERT_CHANNEL_KEY}" || true)"
  fi
  if [[ -z "${token}" || -z "${channel}" ]]; then
    return 1
  fi

  local code
  code="$(
    curl --silent --show-error --location \
      --output /tmp/greyhourrp-automation-alert-botapi.out \
      --write-out "%{http_code}" \
      --header "Content-Type: application/json" \
      --header "Authorization: Bot ${token}" \
      --data "${PAYLOAD}" \
      "https://discord.com/api/v10/channels/${channel}/messages" || true
  )"
  if [[ "${code}" == "200" || "${code}" == "201" ]]; then
    return 0
  fi
  local body
  body="$(head -c 300 /tmp/greyhourrp-automation-alert-botapi.out 2>/dev/null || true)"
  echo "[notify-automation] bot-api send failed code=${code} body=${body}" >&2
  return 1
}

if send_via_webhook; then
  echo "[notify-automation] alert delivered via webhook (${JOB_NAME})"
  exit 0
fi

if send_via_bot_api; then
  echo "[notify-automation] alert delivered via bot API (${JOB_NAME})"
  exit 0
fi

echo "[notify-automation] alert delivery failed for ${JOB_NAME}" >&2
exit 0
