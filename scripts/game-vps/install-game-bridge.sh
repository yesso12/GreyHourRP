#!/usr/bin/env bash
set -euo pipefail

# Grey Hour RP - Game VPS Control Bridge installer
#
# Usage:
#   1) Edit the REQUIRED values below.
#   2) Run: sudo bash install-game-bridge.sh
#
# After install, this bridge exposes:
#   GET  /control/status
#   POST /control/restart
#   POST /control/announce
#   POST /control/command
#   POST /control/workshop-update
#
# Auth:
#   Authorization: Bearer <GREYHOURRP_GAME_CONTROL_TOKEN>

###############################################################################
# REQUIRED: set these before running
###############################################################################

GREYHOURRP_GAME_CONTROL_TOKEN="${GREYHOURRP_GAME_CONTROL_TOKEN:-CHANGE_ME_TO_A_LONG_RANDOM_TOKEN}"
GAME_SERVICE_NAME="${GAME_SERVICE_NAME:-zomboid.service}"

# Optional: script for in-game announcement
# Expected usage: /path/to/script "message text"
ANNOUNCE_SCRIPT="${ANNOUNCE_SCRIPT:-}"

# Optional: script for command execution
# Expected usage: /path/to/script "command" "<args_json>"
COMMAND_SCRIPT="${COMMAND_SCRIPT:-}"

# Optional: script for workshop update
# Expected usage: /path/to/script
WORKSHOP_UPDATE_SCRIPT="${WORKSHOP_UPDATE_SCRIPT:-}"

# Optional: workshop update env (passed to workshop script)
STEAMCMD_PATH="${STEAMCMD_PATH:-}"
GAME_APP_ID="${GAME_APP_ID:-}"
WORKSHOP_APP_ID="${WORKSHOP_APP_ID:-}"
WORKSHOP_IDS="${WORKSHOP_IDS:-}"
SERVER_INI="${SERVER_INI:-}"
WORKSHOP_INSTALL_DIR="${WORKSHOP_INSTALL_DIR:-}"
STEAM_LOGIN="${STEAM_LOGIN:-}"

###############################################################################
# Optional runtime settings
###############################################################################

BRIDGE_BIND="${BRIDGE_BIND:-127.0.0.1}"
BRIDGE_PORT="${BRIDGE_PORT:-8787}"
INSTALL_DIR="${INSTALL_DIR:-/opt/greyhour-game-bridge}"
ENV_FILE="${ENV_FILE:-/etc/greyhour-game-bridge.env}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/greyhour-game-bridge.service}"

if [[ "${GREYHOURRP_GAME_CONTROL_TOKEN}" == "CHANGE_ME_TO_A_LONG_RANDOM_TOKEN" ]]; then
  echo "[error] Set GREYHOURRP_GAME_CONTROL_TOKEN before running."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[error] python3 is required."
  exit 1
fi

mkdir -p "${INSTALL_DIR}"

cat > "${INSTALL_DIR}/bridge.py" <<'PY'
#!/usr/bin/env python3
import json
import os
import shlex
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("GREYHOURRP_GAME_CONTROL_TOKEN", "")
GAME_SERVICE = os.environ.get("GAME_SERVICE_NAME", "zomboid.service")
ANNOUNCE_SCRIPT = os.environ.get("ANNOUNCE_SCRIPT", "").strip()
COMMAND_SCRIPT = os.environ.get("COMMAND_SCRIPT", "").strip()
WORKSHOP_UPDATE_SCRIPT = os.environ.get("WORKSHOP_UPDATE_SCRIPT", "").strip()
ALLOWED_COMMANDS = set(
    x.strip() for x in os.environ.get(
        "ALLOWED_COMMANDS",
        "save,kick,ban,unban,weather,settime,whitelist",
    ).split(",") if x.strip()
)

def run_cmd(args, timeout=20):
    proc = subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
        check=False,
    )
    return {
        "exitCode": proc.returncode,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
    }

def service_active():
    res = run_cmd(["systemctl", "is-active", GAME_SERVICE], timeout=8)
    active = res["stdout"].strip() == "active" and res["exitCode"] == 0
    return active, res

class Handler(BaseHTTPRequestHandler):
    server_version = "GreyHourGameBridge/1.0"

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def _send(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return False
        got = auth[7:].strip()
        return bool(TOKEN) and got == TOKEN

    def _require_auth(self):
        if self._authorized():
            return True
        self._send(401, {"ok": False, "error": "unauthorized"})
        return False

    def do_GET(self):
        if self.path == "/control/status":
            if not self._require_auth():
                return
            active, raw = service_active()
            self._send(200, {
                "ok": True,
                "timeUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "service": GAME_SERVICE,
                "online": active,
                "serviceCheck": raw,
                "announceConfigured": bool(ANNOUNCE_SCRIPT),
                "commandConfigured": bool(COMMAND_SCRIPT),
                "workshopUpdateConfigured": bool(WORKSHOP_UPDATE_SCRIPT),
                "allowedCommands": sorted(ALLOWED_COMMANDS),
            })
            return

        self._send(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if not self._require_auth():
            return

        if self.path == "/control/restart":
            res = run_cmd(["systemctl", "restart", GAME_SERVICE], timeout=30)
            ok = res["exitCode"] == 0
            self._send(200 if ok else 500, {"ok": ok, "action": "restart", "service": GAME_SERVICE, "result": res})
            return

        if self.path == "/control/announce":
            body = self._read_json()
            if body is None:
                self._send(400, {"ok": False, "error": "invalid_json"})
                return
            msg = str(body.get("message", "")).strip()
            if not msg:
                self._send(400, {"ok": False, "error": "missing_message"})
                return
            if not ANNOUNCE_SCRIPT:
                self._send(503, {"ok": False, "error": "announce_not_configured"})
                return
            res = run_cmd([ANNOUNCE_SCRIPT, msg], timeout=20)
            ok = res["exitCode"] == 0
            self._send(200 if ok else 500, {"ok": ok, "action": "announce", "result": res})
            return

        if self.path == "/control/command":
            body = self._read_json()
            if body is None:
                self._send(400, {"ok": False, "error": "invalid_json"})
                return
            cmd = str(body.get("command", "")).strip().lower()
            if not cmd:
                self._send(400, {"ok": False, "error": "missing_command"})
                return
            if cmd not in ALLOWED_COMMANDS:
                self._send(403, {"ok": False, "error": "command_not_allowed", "command": cmd})
                return
            if not COMMAND_SCRIPT:
                self._send(503, {"ok": False, "error": "command_not_configured"})
                return

            args_json = json.dumps(body.get("args", None))
            res = run_cmd([COMMAND_SCRIPT, cmd, args_json], timeout=30)
            ok = res["exitCode"] == 0
            self._send(200 if ok else 500, {"ok": ok, "action": "command", "command": cmd, "result": res})
            return

        if self.path == "/control/workshop-update":
            if not WORKSHOP_UPDATE_SCRIPT:
                self._send(503, {"ok": False, "error": "workshop_update_not_configured"})
                return
            res = run_cmd([WORKSHOP_UPDATE_SCRIPT], timeout=600)
            ok = res["exitCode"] == 0
            self._send(200 if ok else 500, {"ok": ok, "action": "workshop-update", "result": res})
            return

        self._send(404, {"ok": False, "error": "not_found"})

    def log_message(self, fmt, *args):
        return

def main():
    bind = os.environ.get("BRIDGE_BIND", "127.0.0.1")
    port = int(os.environ.get("BRIDGE_PORT", "8787"))
    httpd = ThreadingHTTPServer((bind, port), Handler)
    print(f"[bridge] listening on http://{bind}:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    main()
PY

chmod +x "${INSTALL_DIR}/bridge.py"

cat > "${ENV_FILE}" <<EOF
GREYHOURRP_GAME_CONTROL_TOKEN=${GREYHOURRP_GAME_CONTROL_TOKEN}
GAME_SERVICE_NAME=${GAME_SERVICE_NAME}
ANNOUNCE_SCRIPT=${ANNOUNCE_SCRIPT}
COMMAND_SCRIPT=${COMMAND_SCRIPT}
WORKSHOP_UPDATE_SCRIPT=${WORKSHOP_UPDATE_SCRIPT}
STEAMCMD_PATH=${STEAMCMD_PATH}
GAME_APP_ID=${GAME_APP_ID}
WORKSHOP_APP_ID=${WORKSHOP_APP_ID}
WORKSHOP_IDS=${WORKSHOP_IDS}
SERVER_INI=${SERVER_INI}
WORKSHOP_INSTALL_DIR=${WORKSHOP_INSTALL_DIR}
STEAM_LOGIN=${STEAM_LOGIN}
ALLOWED_COMMANDS=save,kick,ban,unban,weather,settime,whitelist
BRIDGE_BIND=${BRIDGE_BIND}
BRIDGE_PORT=${BRIDGE_PORT}
EOF

chmod 600 "${ENV_FILE}"

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=GreyHourRP Game Control Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/env python3 ${INSTALL_DIR}/bridge.py
Restart=always
RestartSec=2
User=root
Group=root
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=${INSTALL_DIR} /run /var/log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now greyhourrp-game-bridge.service
systemctl status greyhourrp-game-bridge.service --no-pager

echo
echo "[ok] Bridge installed."
echo "[info] Local status test:"
echo "curl -s -H 'Authorization: Bearer ${GREYHOURRP_GAME_CONTROL_TOKEN}' http://${BRIDGE_BIND}:${BRIDGE_PORT}/control/status"
echo
echo "[next] On API VPS, set:"
echo "GREYHOURRP_GAME_CONTROL_URL=http://<GAME_VPS_PUBLIC_OR_PRIVATE_IP>:${BRIDGE_PORT}"
echo "GREYHOURRP_GAME_CONTROL_TOKEN=<same token>"
