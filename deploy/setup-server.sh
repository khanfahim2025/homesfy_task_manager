#!/usr/bin/env bash
# First-time setup on Ubuntu 22.04 EC2. Run as a user with sudo access.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/app/taskmanager}"
DB_USER="${DB_USER:-taskmanager}"
DB_NAME="${DB_NAME:-taskmanager}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)}"

echo "==> Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y curl nginx postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> Setting up PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

echo "==> Installing nginx site..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/taskmanager 2>/dev/null \
  || echo "   (skip nginx copy until app is deployed to $APP_DIR)"

if [[ -f /etc/nginx/sites-available/taskmanager ]]; then
  sudo ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/taskmanager
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl enable nginx
  sudo systemctl reload nginx
fi

echo ""
echo "============================================"
echo "Server setup complete."
echo "App directory: $APP_DIR"
echo "PostgreSQL user: $DB_USER"
echo "PostgreSQL password: $DB_PASS"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
echo ""
echo "Next steps:"
echo "  1. Deploy app code to $APP_DIR"
echo "  2. cp deploy/env.production.template server/.env && edit secrets"
echo "  3. bash deploy/deploy-app.sh"
echo "============================================"
