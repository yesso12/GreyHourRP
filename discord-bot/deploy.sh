#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/greyhourrp-discord-bot}
SERVICE_NAME=${SERVICE_NAME:-greyhourrp-discord-bot}
NODE_BIN=${NODE_BIN:-node}
NPM_BIN=${NPM_BIN:-npm}

if [[ ! -f .env ]]; then
  echo "Missing .env in current directory. Copy .env.example to .env and fill it in."
  exit 1
fi

sudo mkdir -p "$APP_DIR"

# Sync files without rsync
sudo find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
sudo cp -a ./ "$APP_DIR/"

sudo bash -lc "cd '$APP_DIR' && (${NPM_BIN} ci --omit=dev || ${NPM_BIN} install --omit=dev)"

sudo bash -c "cat > /etc/systemd/system/${SERVICE_NAME}.service" <<SERVICE
[Unit]
Description=Grey Hour RP Discord Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${NPM_BIN} start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
RestrictRealtime=true
ReadWritePaths=${APP_DIR}/data
UMask=0077
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}

sudo bash -lc "cd '$APP_DIR' && ${NPM_BIN} run preflight"
sudo bash -lc "cd '$APP_DIR' && set -a && source .env && set +a && ${NPM_BIN} run register"
sudo mkdir -p /var/www/greyhourrp/content
if [[ -f /opt/greyhourrp/public/content/discord-commands.json ]]; then
  sudo cp /opt/greyhourrp/public/content/discord-commands.json /var/www/greyhourrp/content/discord-commands.json
fi
if [[ -f /opt/greyhourrp/public/content/discord-channel-commands.json ]]; then
  sudo cp /opt/greyhourrp/public/content/discord-channel-commands.json /var/www/greyhourrp/content/discord-channel-commands.json
fi
sudo systemctl restart ${SERVICE_NAME}
sudo bash -lc "cd '$APP_DIR' && ${NPM_BIN} run smoke"

echo "Deploy complete. Check status with: systemctl status ${SERVICE_NAME}"
