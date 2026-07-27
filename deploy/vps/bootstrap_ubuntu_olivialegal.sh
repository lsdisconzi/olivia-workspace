#!/usr/bin/env bash
# Bootstrap Olivia on a fresh Ubuntu VPS.
#
# What this script does:
# 1) Installs required Ubuntu packages
# 2) Installs/updates Node.js 22.x (NodeSource)
# 3) Clones or updates the Olivia repository
# 4) Creates Python venv and installs requirements
# 5) Installs prebuilt OpenClaude runtime (no bun required)
# 6) Optionally installs/restarts a systemd service
#
# Example:
#   sudo ./deploy/vps/bootstrap_ubuntu_olivialegal.sh \
#     --repo-url https://github.com/your-org/OliviaLegal.git \
#     --app-dir /opt/Olivia \
#     --git-ref main \
#     --port 3229 \
#     --gateway-url http://127.0.0.1:8183

set -euo pipefail

APP_DIR="/opt/OliviaLegal"
REPO_URL=""
GIT_REF="main"
SERVICE_NAME="OliviaLegal"
SERVICE_USER="root"
Olivia_PORT="3229"
VPS_GATEWAY_URL="http://127.0.0.1:8183"
INSTALL_SERVICE=1

usage() {
  cat <<'USAGE'
Usage: bootstrap_ubuntu_olivialegal.sh [options]

Options:
  --repo-url URL         Git repository URL to clone when app dir is missing
  --app-dir PATH         Install/update directory (default: /opt/OliviaLegal)
  --git-ref REF          Git branch/tag/commit to checkout (default: main)
  --service-name NAME    systemd service name (default: OliviaLegal)
  --service-user USER    systemd service user (default: root)
  --port PORT            Olivia port (default: 3229)
  --gateway-url URL      VPS gateway URL (default: http://127.0.0.1:8183)
  --no-service           Skip systemd service installation/restart
  -h, --help             Show this help

Notes:
  - If APP_DIR already contains a git repo, --repo-url is optional.
  - Run as root or with sudo privileges.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-url)
      REPO_URL="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --git-ref)
      GIT_REF="$2"
      shift 2
      ;;
    --service-name)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --service-user)
      SERVICE_USER="$2"
      shift 2
      ;;
    --port)
      Olivia_PORT="$2"
      shift 2
      ;;
    --gateway-url)
      VPS_GATEWAY_URL="$2"
      shift 2
      ;;
    --no-service)
      INSTALL_SERVICE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ ! "$Olivia_PORT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --port must be a numeric value"
  exit 1
fi

if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    echo "ERROR: this installer supports Ubuntu only (detected: ${ID:-unknown})"
    exit 1
  fi
else
  echo "ERROR: cannot determine OS (missing /etc/os-release)"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run this script as root (sudo ./deploy/vps/bootstrap_ubuntu_olivialegal.sh ...)"
  exit 1
fi

echo "[1/7] Installing Ubuntu dependencies"
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  git \
  lsof \
  python3 \
  python3-venv \
  python3-pip \
  rsync

echo "[2/7] Ensuring Node.js 22.x"
NODE_MAJOR="0"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
fi

if (( NODE_MAJOR < 22 )); then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    | tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  apt-get update
  apt-get install -y nodejs
fi

echo "    node: $(node -v)"
echo "    npm:  $(npm -v)"

echo "[3/7] Cloning/updating repository"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --all --tags --prune
  git -C "$APP_DIR" checkout "$GIT_REF"
  if git -C "$APP_DIR" rev-parse --verify "origin/$GIT_REF" >/dev/null 2>&1; then
    git -C "$APP_DIR" pull --ff-only origin "$GIT_REF"
  fi
elif [[ -e "$APP_DIR" ]] && [[ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]]; then
  echo "ERROR: $APP_DIR exists but is not a git repo"
  echo "       Move/remove it, or choose another --app-dir"
  exit 1
else
  if [[ -z "$REPO_URL" ]]; then
    echo "ERROR: --repo-url is required when $APP_DIR does not contain a git repo"
    exit 1
  fi
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
  git -C "$APP_DIR" checkout "$GIT_REF"
fi

echo "[4/7] Installing Python dependencies"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --upgrade pip
"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/config/requirements.txt"

echo "[5/7] Installing prebuilt OpenClaude runtime"
npm install --prefix "$APP_DIR/.openclaude-runtime" --no-audit --no-fund --loglevel=warn @gitlawb/openclaude

OPENCLAUDE_ROOT="$APP_DIR/.openclaude-runtime/node_modules/@gitlawb/openclaude"
OPENCLAUDE_BIN="$OPENCLAUDE_ROOT/dist/cli.mjs"
if [[ ! -f "$OPENCLAUDE_BIN" ]]; then
  echo "ERROR: OpenClaude binary not found after install: $OPENCLAUDE_BIN"
  exit 1
fi

echo "[6/7] Writing runtime environment files"
if [[ ! -f "$APP_DIR/.env" ]] && [[ -f "$APP_DIR/config/.env.example" ]]; then
  cp "$APP_DIR/config/.env.example" "$APP_DIR/.env"
  echo "    Created $APP_DIR/.env from config/.env.example (review and update secrets)"
fi

cat > "$APP_DIR/.env.service" <<EOF
Olivia_PORT=${Olivia_PORT}
VPS_GATEWAY_URL=${VPS_GATEWAY_URL}
OPENCLAUDE_PATH=${OPENCLAUDE_ROOT}
OPENCLAUDE_BIN=${OPENCLAUDE_BIN}
EOF

if [[ "$INSTALL_SERVICE" -eq 1 ]]; then
  echo "[7/7] Installing/restarting systemd service"
  SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  TMP_SERVICE_FILE="$(mktemp)"
  cat > "$TMP_SERVICE_FILE" <<EOF
[Unit]
Description=Olivia Unified Agent Server
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env.service
ExecStart=${APP_DIR}/.venv/bin/python -u ${APP_DIR}/serve.py --port \${Olivia_PORT}
Restart=always
RestartSec=3
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

  install -m 0644 "$TMP_SERVICE_FILE" "$SERVICE_FILE"
  rm -f "$TMP_SERVICE_FILE"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  systemctl --no-pager --full status "$SERVICE_NAME" | head -n 30

  echo "Health check:"
  curl -fsS "http://127.0.0.1:${Olivia_PORT}/api/health" || true
else
  echo "[7/7] Service installation skipped (--no-service)"
  echo "Start manually with:"
  echo "  cd $APP_DIR && ./runtime/start-all.sh"
fi

echo "Done."
echo "App dir:  $APP_DIR"
echo "Port:     $Olivia_PORT"
echo "UI URL:   http://<server-ip>:${Olivia_PORT}/olivia/"
