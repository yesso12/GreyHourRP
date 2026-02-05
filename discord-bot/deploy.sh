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
sudo rm -rf "$APP_DIR"/*
sudo cp -a ./ "$APP_DIR/"

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

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

${NPM_BIN} run register

echo "Deploy complete. Check status with: systemctl status ${SERVICE_NAME}"
