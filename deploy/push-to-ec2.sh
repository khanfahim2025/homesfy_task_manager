#!/usr/bin/env bash
# Deploy from your Mac to EC2 via rsync + remote build.
# Usage:
#   export EC2_HOST=ubuntu@13.x.x.x
#   export EC2_KEY=~/.ssh/nodeang.pem   # optional
#   bash deploy/push-to-ec2.sh
set -euo pipefail

: "${EC2_HOST:?Set EC2_HOST (e.g. ubuntu@13.x.x.x)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${APP_DIR:-/var/app/taskmanager}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "${EC2_KEY:-}" ]] && SSH_OPTS+=(-i "$EC2_KEY")

RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "==> Syncing code to ${EC2_HOST}:${APP_DIR} ..."
rsync -az --delete \
  --exclude-from="$ROOT/deploy/rsync-exclude.txt" \
  -e "$RSYNC_SSH" \
  "$ROOT/" "${EC2_HOST}:${APP_DIR}/"

echo "==> Running remote deploy..."
ssh "${SSH_OPTS[@]}" "$EC2_HOST" "cd ${APP_DIR} && bash deploy/deploy-app.sh"

echo "Done. Open http://$(echo "$EC2_HOST" | cut -d@ -f2)/api/health"
