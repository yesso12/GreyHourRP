#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js 18+ before running this script."
  exit 1
fi

npm install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Fill it in before deploy." 
fi

echo "Install complete. Next: edit .env then run ./deploy.sh"
