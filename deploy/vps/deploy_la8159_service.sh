#!/usr/bin/env bash
# Deploy Olivia to a VPS and install as a systemd service.
#
# Required env:
#   VPS_HOST                 e.g. 203.0.113.10
#
# Optional env:
#   VPS_USER                 default: root
#   VPS_APP_DIR              default: /opt/OliviaLegal
#   SERVICE_NAME             default: OliviaLegal
#   OliviaLegal_PORT              default: 3229
#   VPS_GATEWAY_URL          default: http://127.0.0.1:8183
#   DEPLOY_EXCLUDES_FILE     default: deploy/vps/rsync-excludes.txt
#
# Example:
#   VPS_HOST=your.vps.ip VPS_USER=root OliviaLegal_PORT=3229 ./deploy/vps/deploy_OliviaLegal_service.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
VPS_APP_DIR="${VPS_APP_DIR:-/opt/OliviaLegal}"
SERVICE_NAME="${SERVICE_NAME:-OliviaLegal}"
OliviaLegal_PORT="${OliviaLegal_PORT:-3229}"
VPS_GATEWAY_URL="${VPS_GATEWAY_URL:-http://127.0.0.1:8183}"
DEPLOY_EXCLUDES_FILE="${DEPLOY_EXCLUDES_FILE:-$ROOT_DIR/deploy/vps/rsync-excludes.txt}"

if [[ -z "$VPS_HOST" ]]; then
  echo "ERROR: set VPS_HOST (e.g. VPS_HOST=203.0.113.10)"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/deploy/vps/OliviaLegal.service.template" ]]; then
  echo "ERROR: missing service template at deploy/vps/OliviaLegal.service.template"
  exit 1
fi

echo "[1/6] Preparing service file from template"
SERVICE_TMP="$(mktemp)"
sed \
  -e "s#{{SERVICE_USER}}#${VPS_USER}#g" \
  -e "s#{{APP_DIR}}#${VPS_APP_DIR}#g" \
  "$ROOT_DIR/deploy/vps/OliviaLegal.service.template" > "$SERVICE_TMP"

echo "[2/6] Creating remote app directory"
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${VPS_APP_DIR}'"

echo "[3/6] Syncing project files"
RSYNC_ARGS=( -az --delete )
if [[ -f "$DEPLOY_EXCLUDES_FILE" ]]; then
  RSYNC_ARGS+=( --exclude-from "$DEPLOY_EXCLUDES_FILE" )
fi
rsync "${RSYNC_ARGS[@]}" "$ROOT_DIR/" "${VPS_USER}@${VPS_HOST}:${VPS_APP_DIR}/"

echo "[4/6] Installing runtime dependencies on VPS"
ssh "${VPS_USER}@${VPS_HOST}" "\
  set -euo pipefail; \
  cd '${VPS_APP_DIR}'; \
  command -v python3 >/dev/null; \
  command -v node >/dev/null; \
  python3 -m venv .venv; \
  .venv/bin/pip install --upgrade pip >/dev/null; \
  .venv/bin/pip install -r config/requirements.txt >/dev/null; \
  if [[ -f openclaude/package.json ]]; then \
    cd openclaude; npm install --omit=dev --no-audit --no-fund --loglevel=warn; cd ..; \
  fi; \
  cat > .env.service <<EOF
OliviaLegal_PORT=${OliviaLegal_PORT}
VPS_GATEWAY_URL=${VPS_GATEWAY_URL}
EOF
"

echo "[5/6] Installing systemd service ${SERVICE_NAME}"
scp "$SERVICE_TMP" "${VPS_USER}@${VPS_HOST}:/tmp/${SERVICE_NAME}.service"
ssh "${VPS_USER}@${VPS_HOST}" "\
  set -euo pipefail; \
  sudo mv /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service; \
  sudo systemctl daemon-reload; \
  sudo systemctl enable ${SERVICE_NAME}; \
  sudo systemctl restart ${SERVICE_NAME}; \
  sudo systemctl --no-pager --full status ${SERVICE_NAME} | head -n 40 \
"

echo "[6/6] Health check"
ssh "${VPS_USER}@${VPS_HOST}" "curl -fsS 'http://127.0.0.1:${OliviaLegal_PORT}/api/health' || true"

echo "Done."
echo "Service: ${SERVICE_NAME}"
echo "Port:    ${OliviaLegal_PORT}"
echo "URL:     http://${VPS_HOST}:${OliviaLegal_PORT}/olivia/"

rm -f "$SERVICE_TMP"
