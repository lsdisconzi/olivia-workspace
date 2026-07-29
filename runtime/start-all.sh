#!/usr/bin/env bash
# start-all.sh — Start Olivia (standalone)
# Usage:  ./start-all.sh [--port 3229] [--no-tail] [--watch-functions] [--watch-interval 20] [--skip-config-doctor] [--smoke] [--ollama] [--index] [--reindex-qdrant] [--fetch-ecosystem]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PORT="${Olivia_PORT:-3229}"
TAIL_LOGS=1
WATCH_FUNCTIONS=0
WATCH_INTERVAL=20
RUN_CONFIG_DOCTOR=1
RUN_SMOKE=0
BUILD_ELECTRON=0
START_OLLAMA=0
RUN_INDEXER=0
RUN_QDRANT_REINDEX=0
FETCH_ECOSYSTEM=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --port)  PORT="$2"; shift 2 ;;
    --no-tail) TAIL_LOGS=0; shift ;;
    --watch-functions) WATCH_FUNCTIONS=1; shift ;;
    --watch-interval) WATCH_INTERVAL="$2"; shift 2 ;;
    --skip-config-doctor) RUN_CONFIG_DOCTOR=0; shift ;;
    --smoke) RUN_SMOKE=1; shift ;;
    --build-electron) BUILD_ELECTRON=1; shift ;;
    --ollama) START_OLLAMA=1; shift ;;
    --index)         RUN_INDEXER=1; shift ;;
    --reindex-qdrant) RUN_QDRANT_REINDEX=1; RUN_INDEXER=1; shift ;;
    --fetch-ecosystem) FETCH_ECOSYSTEM=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

LOG_DIR="$HOME/.dev-logs"
LOG_FILE="$LOG_DIR/OliviaLegal.log"
WATCH_LOG_FILE="$LOG_DIR/OliviaLegal-functions-sync.log"
mkdir -p "$LOG_DIR"

# ── 1. Check Node.js ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌  node not found. Install Node.js ≥20 (https://nodejs.org)."
  exit 1
fi
echo "✓  node $(node --version)"

# ── 2. Verify/open OpenClaude runtime ────────────────────────────────────────
# Honor pre-set overrides from shell/.env when present.
OPENCLAUDE_DEFAULT_PATH="$PROJECT_ROOT/openclaude"
export OPENCLAUDE_PATH="${OPENCLAUDE_PATH:-$OPENCLAUDE_DEFAULT_PATH}"

OPENCLAUDE_SOURCE_PATH="$OPENCLAUDE_PATH"
OPENCLAUDE_RESOLVED_BIN="${OPENCLAUDE_BIN:-}"
OPENCLAUDE_USING_FALLBACK=0

if [[ -n "$OPENCLAUDE_RESOLVED_BIN" ]] && [[ ! -f "$OPENCLAUDE_RESOLVED_BIN" ]]; then
  echo "⚠  OPENCLAUDE_BIN is set but file does not exist: $OPENCLAUDE_RESOLVED_BIN"
  OPENCLAUDE_RESOLVED_BIN=""
fi

if [[ -z "$OPENCLAUDE_RESOLVED_BIN" ]] && [[ -f "$OPENCLAUDE_SOURCE_PATH/dist/cli.mjs" ]]; then
  OPENCLAUDE_RESOLVED_BIN="$OPENCLAUDE_SOURCE_PATH/dist/cli.mjs"
fi

if [[ -z "$OPENCLAUDE_RESOLVED_BIN" ]]; then
  echo "⚠  openclaude/dist/cli.mjs not found at $OPENCLAUDE_SOURCE_PATH"
  if ! command -v npm &>/dev/null; then
    echo "❌  npm not found; cannot auto-install a prebuilt OpenClaude runtime."
    echo "    Option A (recommended here): install npm, then rerun ./start-all.sh"
    echo "    Option B (source build):     install bun and run bun run build in openclaude/"
    exit 1
  fi

  OPENCLAUDE_FALLBACK_DIR="$PROJECT_ROOT/.openclaude-runtime"
  OPENCLAUDE_FALLBACK_ROOT="$OPENCLAUDE_FALLBACK_DIR/node_modules/@gitlawb/openclaude"
  OPENCLAUDE_FALLBACK_BIN="$OPENCLAUDE_FALLBACK_ROOT/dist/cli.mjs"

  if [[ ! -f "$OPENCLAUDE_FALLBACK_BIN" ]]; then
    echo "  Installing prebuilt @gitlawb/openclaude (no bun required)..."
    mkdir -p "$OPENCLAUDE_FALLBACK_DIR"
    npm install --prefix "$OPENCLAUDE_FALLBACK_DIR" --no-audit --no-fund --loglevel=warn @gitlawb/openclaude
  fi

  if [[ -f "$OPENCLAUDE_FALLBACK_BIN" ]]; then
    OPENCLAUDE_PATH="$OPENCLAUDE_FALLBACK_ROOT"
    OPENCLAUDE_RESOLVED_BIN="$OPENCLAUDE_FALLBACK_BIN"
    OPENCLAUDE_USING_FALLBACK=1
  fi
fi

if [[ -z "$OPENCLAUDE_RESOLVED_BIN" ]] || [[ ! -f "$OPENCLAUDE_RESOLVED_BIN" ]]; then
  echo "❌  OpenClaude CLI not found."
  echo "    Checked: $OPENCLAUDE_SOURCE_PATH/dist/cli.mjs"
  echo "    Fallback: $PROJECT_ROOT/.openclaude-runtime/node_modules/@gitlawb/openclaude/dist/cli.mjs"
  echo "    Rebuild source with bun: cd $OPENCLAUDE_SOURCE_PATH && bun run build"
  exit 1
fi

export OPENCLAUDE_BIN="$OPENCLAUDE_RESOLVED_BIN"

# Install source checkout dependencies only when using the local source tree.
if [[ "$OPENCLAUDE_USING_FALLBACK" -eq 0 ]] && [[ -f "$OPENCLAUDE_SOURCE_PATH/package.json" ]] && [[ ! -d "$OPENCLAUDE_SOURCE_PATH/node_modules" ]]; then
  echo "  Installing openclaude Node.js dependencies..."
  (cd "$OPENCLAUDE_SOURCE_PATH" && npm install --omit=dev --no-audit --no-fund --loglevel=warn)
  echo "✓  openclaude node_modules installed"
fi

if [[ "$OPENCLAUDE_USING_FALLBACK" -eq 1 ]]; then
  echo "✓  openclaude  → $OPENCLAUDE_BIN (npm prebuilt fallback)"
else
  echo "✓  openclaude  → $OPENCLAUDE_BIN"
fi

# ── 3. Create / activate Python venv ──────────────────────────────────────────
SYSTEM_PYTHON="$(command -v python3 2>/dev/null || true)"
if [[ -z "$SYSTEM_PYTHON" ]]; then
  echo "❌  python3 not found. Install Python ≥3.10."
  exit 1
fi

VENV_DIR="$PROJECT_ROOT/.venv"
if [[ ! -d "$VENV_DIR" ]]; then
  echo "  Creating venv at $VENV_DIR ..."
  "$SYSTEM_PYTHON" -m venv "$VENV_DIR"
  echo "✓  venv created"
fi

PYTHON="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

if [[ ! -x "$PYTHON" ]]; then
  echo "❌  venv python not found at $PYTHON — recreating..."
  rm -rf "$VENV_DIR"
  "$SYSTEM_PYTHON" -m venv "$VENV_DIR"
fi

# Install / update dependencies if requirements.txt exists
REQ_FILE="$PROJECT_ROOT/config/requirements.txt"
if [[ -f "$REQ_FILE" ]]; then
  # Only reinstall if requirements.txt is newer than the stamp file
  STAMP="$VENV_DIR/.requirements-stamp"
  if [[ ! -f "$STAMP" ]] || [[ "$REQ_FILE" -nt "$STAMP" ]]; then
    echo "  Installing Python dependencies..."
    "$PIP" install --quiet --upgrade pip
    "$PIP" install --quiet -r "$REQ_FILE"
    touch "$STAMP"
    echo "✓  dependencies installed"
  fi
fi

# Ensure DOCX extraction dependency exists for shared document context.
if ! "$PYTHON" -c "import docx" >/dev/null 2>&1; then
  echo "  Installing python-docx for DOCX context support..."
  "$PIP" install --quiet python-docx
fi

echo "✓  python      → $PYTHON  ($($PYTHON --version 2>&1))"

# ── 3.5. Ollama server check/start (optional) ────────────────────────────
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
OLLAMA_PORT="$(echo "$OLLAMA_HOST" | sed -E 's|^https?://[^:]+:?([0-9]*).*$|\1|')"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"

ollama_already_running=0
if curl -sf "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
  echo "✓  ollama      → already running at $OLLAMA_HOST"
  ollama_already_running=1
elif curl -sf "http://127.0.0.1:${OLLAMA_PORT}/api/tags" > /dev/null 2>&1; then
  echo "✓  ollama      → already running at http://127.0.0.1:${OLLAMA_PORT}"
  ollama_already_running=1
fi

if [[ $START_OLLAMA -eq 1 && $ollama_already_running -eq 0 ]]; then
  if ! command -v ollama &>/dev/null; then
    echo "⚠  --ollama requested but 'ollama' binary not found in PATH"
  else
    echo "  Starting Ollama with recommended config..."
    echo "    OLLAMA_HOST=$OLLAMA_HOST"
    echo "    OLLAMA_KEEP_ALIVE=-1"
    echo "    OLLAMA_FLASH_ATTENTION=1"
    echo "    OLLAMA_KV_CACHE_TYPE=q8_0"
    echo "    OLLAMA_NUM_CTX=8192"
    LOG_DIR="$HOME/.dev-logs"
    mkdir -p "$LOG_DIR"
    OLLAMA_LOG="$LOG_DIR/ollama.log"
    OLLAMA_KEEP_ALIVE=-1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 OLLAMA_NUM_CTX=8192 OLLAMA_HOST="$OLLAMA_HOST" \
      nohup ollama serve > "$OLLAMA_LOG" 2>&1 &
    OLLAMA_PID=$!
    echo "✓  ollama      → PID $OLLAMA_PID (log: $OLLAMA_LOG)"

    # Wait up to 5 seconds for the server to become ready
    for i in {1..10}; do
      if curl -sf "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
        echo "✓  ollama      → ready in ~$((i * 500))ms"
        ollama_already_running=1
        break
      fi
      sleep 0.5
    done
    if [[ $ollama_already_running -eq 0 ]]; then
      echo "⚠  ollama      → server started but not yet responding — may still be initializing"
    fi
  fi
elif [[ $START_OLLAMA -eq 0 && $ollama_already_running -eq 0 ]]; then
  echo "   ollama      → not running (add --ollama to auto-start)"
fi

# ── 4. Rebuild project index (optional) ──────────────────────────────────────
INDEX_SCRIPT="$PROJECT_ROOT/scripts/index_project.py"
if [[ $RUN_INDEXER -eq 1 ]]; then
  if [[ ! -f "$INDEX_SCRIPT" ]]; then
    echo "⚠  --index requested but index_project.py not found at $INDEX_SCRIPT"
  else
    echo "  Rebuilding project index (config/index-project/)..."
    "$PYTHON" "$INDEX_SCRIPT" --project-root "$PROJECT_ROOT"
    echo "✓  project index rebuilt"
  fi
fi

# ── 5. Rebuild Qdrant indexes (optional) ──────────────────────────────────────
if [[ $RUN_QDRANT_REINDEX -eq 1 ]]; then
  echo "  Rebuilding Qdrant indexes (Tier 1: dev code → olivia-dev-code)..."
  INDEX_PUSH_SCRIPT="$PROJECT_ROOT/scripts/index_project.py"
  if [[ -f "$INDEX_PUSH_SCRIPT" ]]; then
    "$PYTHON" "$INDEX_PUSH_SCRIPT" --project-root "$PROJECT_ROOT" --push-to-qdrant
    echo "✓  dev code index pushed to Qdrant"
  else
    echo "⚠  index_project.py not found, skipping dev code index"
  fi

  echo "  Rebuilding Qdrant indexes (Tier 2/3: uploads → Qdrant)..."
  UPLOADS_SCRIPT="$PROJECT_ROOT/scripts/index_uploads_to_qdrant.py"
  if [[ -f "$UPLOADS_SCRIPT" ]]; then
    "$PYTHON" "$UPLOADS_SCRIPT" --global --all-projects
    echo "✓  uploads indexes pushed to Qdrant"
  else
    echo "⚠  index_uploads_to_qdrant.py not found, skipping uploads index"
  fi
fi

# ── 6. Fetch ecosystem metadata (optional) ────────────────────────────────────
if [[ $FETCH_ECOSYSTEM -eq 1 ]]; then
  FETCH_SCRIPT="$PROJECT_ROOT/scripts/fetch_ecosystem.py"
  if [[ -f "$FETCH_SCRIPT" ]]; then
    echo "  Fetching ecosystem metadata..."
    if "$PYTHON" "$FETCH_SCRIPT" --skip-report; then
      echo "✓  ecosystem metadata fetched → config/ecosystem_metadata.json"
    else
      echo "⚠  ecosystem fetch failed (non-fatal)"
    fi
  else
    echo "⚠  fetch_ecosystem.py not found at $FETCH_SCRIPT"
  fi
fi

# ── 7. Validate env config (optional preflight) ─────────────────────────────
if [[ $RUN_CONFIG_DOCTOR -eq 1 ]]; then
  DOCTOR_SCRIPT="$PROJECT_ROOT/runtime/config_doctor.py"
  ENV_FILE="$PROJECT_ROOT/.env"
  if [[ -f "$DOCTOR_SCRIPT" ]]; then
    if [[ -f "$ENV_FILE" ]]; then
      echo "  Running config doctor..."
      if ! "$PYTHON" "$DOCTOR_SCRIPT" --env-file "$ENV_FILE"; then
        echo "❌  config doctor failed. Fix .env issues or rerun with --skip-config-doctor"
        exit 1
      fi
      echo "✓  config doctor passed"
    else
      echo "⚠  .env not found at $ENV_FILE (skipping config doctor)"
    fi
  else
    echo "⚠  config doctor script not found: $DOCTOR_SCRIPT"
  fi
fi

# ── 8. Kill anything already on the port ────────────────────────────────────
if lsof -Pi :"$PORT" -sTCP:LISTEN -t &>/dev/null; then
  echo "  Port $PORT busy — killing existing process..."
  lsof -ti :"$PORT" -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

# ── 9. Start serve.py ────────────────────────────────────────────────────────
echo "" > "$LOG_FILE"
PYTHONUNBUFFERED=1 nohup "$PYTHON" -u "$PROJECT_ROOT/serve.py" --port "$PORT" \
  >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "✓  serve.py    → PID $SERVER_PID  (port $PORT)"
echo "   Log: $LOG_FILE"
echo ""

# ── 10. Wait for server ready ────────────────────────────────────────────────
echo -n "   Waiting for server"
SERVER_READY=0
for i in {1..20}; do
  if curl -s "http://127.0.0.1:$PORT/api/health" > /dev/null; then
    echo " ready!"
    SERVER_READY=1
    break
  fi
  echo -n "."
  sleep 0.5
done
echo ""

if [[ $SERVER_READY -eq 0 ]]; then
  echo "❌  Server failed to start within 10 seconds."
  echo "    Check log: $LOG_FILE"
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi
echo "┌────────────────────────────────────────────────────────┐"
echo "│  Olivia UI   →  http://localhost:$PORT/olivia/          │"
echo "│  API root   →  http://localhost:$PORT/api             │"
echo "│  PID        →  $SERVER_PID                               │"
echo "│  Kill       →  kill $SERVER_PID                          │"
echo "└────────────────────────────────────────────────────────┘"
echo ""

# ── 11. Optional smoke checks ────────────────────────────────────────────────
if [[ $RUN_SMOKE -eq 1 ]]; then
  SMOKE_SCRIPT="$PROJECT_ROOT/scripts/smoke_runtime.sh"
  if [[ -f "$SMOKE_SCRIPT" ]]; then
    echo "  Running smoke checks..."
    "$SMOKE_SCRIPT" "http://127.0.0.1:$PORT"
    echo "✓  smoke checks passed"
    echo ""
  else
    echo "⚠  smoke script not found: $SMOKE_SCRIPT"
    echo ""
  fi
fi

# ── 12. Optional function-catalog watcher ──────────────────────────────────
if [[ $WATCH_FUNCTIONS -eq 1 ]]; then
  WATCH_SCRIPT="$PROJECT_ROOT/automation/watch_functions_sync.py"  # optional: may not exist yet
  if [[ -f "$WATCH_SCRIPT" ]]; then
    WORKSPACE_ROOT="$PROJECT_ROOT"
    WATCH_PYTHON="$PYTHON"

    PYTHONUNBUFFERED=1 nohup "$PYTHON" -u "$WATCH_SCRIPT" \
      --interval "$WATCH_INTERVAL" \
      --python "$WATCH_PYTHON" \
      --reload-url "http://127.0.0.1:$PORT/api/functions/reload" \
      >> "$WATCH_LOG_FILE" 2>&1 &
    WATCH_PID=$!
    echo "✓  functions sync watcher → PID $WATCH_PID"
    echo "   Watch log: $WATCH_LOG_FILE"
    echo ""
  else
    echo "⚠  watcher script not found: $WATCH_SCRIPT"
    echo ""
  fi
fi

# ── 13. Launch Electron desktop wrapper ───────────────────────────────────
DESKTOP_DIR="$PROJECT_ROOT/desktop"
if [[ -f "$DESKTOP_DIR/package.json" ]]; then
  ELECTRON_LOG="$LOG_DIR/electron.log"
  if [[ ! -d "$DESKTOP_DIR/node_modules" ]]; then
    echo "  Installing Electron dependencies..."
    (cd "$DESKTOP_DIR" && npm install --no-audit --no-fund --loglevel=warn)
    echo "✓  Electron dependencies installed"
  fi

  # Optional: rebuild the packaged Electron app before launch (off by default).
  # This runs electron-builder for the CURRENT platform so the shipped binary
  # reflects the latest source, then launches that packaged app instead of
  # running main.js live. Without --build-electron we launch from source via
  # `npx electron .` (live edits to main.js apply immediately).
  ELECTRON_APP_BIN=""
  if [[ $BUILD_ELECTRON -eq 1 ]]; then
    # Map the OS to the matching electron-builder npm script.
    case "$(uname -s)" in
      Darwin)  EBUILD_SCRIPT="build:mac" ;;
      Linux)   EBUILD_SCRIPT="build:linux" ;;
      MINGW*|CYGWIN*|MSYS*) EBUILD_SCRIPT="build:win" ;;
      *)       EBUILD_SCRIPT="build:linux" ;;
    esac
    echo "  Rebuilding Electron app (npm run $EBUILD_SCRIPT)..."
    (cd "$DESKTOP_DIR" && npm run "$EBUILD_SCRIPT") >> "$ELECTRON_LOG" 2>&1
    BUILD_RC=$?
    if [[ $BUILD_RC -ne 0 ]]; then
      echo "❌  Electron build failed (rc=$BUILD_RC). Check $ELECTRON_LOG"
      echo "    Falling back to live-source launch (npx electron .)"
      BUILD_ELECTRON=0
    else
      # Resolve the freshly built executable for the current platform.
      if [[ "$(uname -s)" == "Darwin" ]]; then
        APP_PATH="$(ls -d "$DESKTOP_DIR"/dist/mac*/"Olivia Desktop.app" 2>/dev/null | head -1)"
        [[ -n "$APP_PATH" ]] && ELECTRON_APP_BIN="$APP_PATH/Contents/MacOS/Olivia Desktop"
      elif [[ "$(uname -s)" == "Linux" ]]; then
        APP_PATH="$(ls -d "$DESKTOP_DIR"/dist/linux-* 2>/dev/null | head -1)"
        [[ -n "$APP_PATH" ]] && ELECTRON_APP_BIN="$APP_PATH/olivia-legal-desktop"
      fi
      if [[ -z "$ELECTRON_APP_BIN" ]]; then
        echo "⚠  Built app not found at expected path — falling back to live-source launch."
        BUILD_ELECTRON=0
      else
        echo "✓  Electron app built → $ELECTRON_APP_BIN"
      fi
    fi
  fi

  # Launch Electron with flags needed for headless / container environments.
  # --no-sandbox: required when running as root or without kernel sandbox support
  # --disable-gpu: avoids GPU process crashes on headless servers
  # --disable-dev-shm-usage: prevents /dev/shm exhaustion in containers
  # --ozone-platform=x11: forces X11 backend (avoids Wayland crashes under xvfb)
  ELECTRON_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer --disable-features=dbus --ozone-platform=x11"

  if [[ $BUILD_ELECTRON -eq 1 && -n "$ELECTRON_APP_BIN" ]]; then
    # Launch the packaged app directly; pass the port via the macOS/Linux URL
    # scheme is not wired, so forward --port as a CLI arg the app reads.
    ELECTRON_CMD="\"$ELECTRON_APP_BIN\" $ELECTRON_FLAGS --port $PORT"
  else
    ELECTRON_CMD="npx electron . $ELECTRON_FLAGS --port $PORT"
  fi

  # Use dbus-run-session if no D-Bus session exists (suppresses DBus errors)
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]] && command -v dbus-run-session >/dev/null 2>&1; then
    ELECTRON_CMD="dbus-run-session -- $ELECTRON_CMD"
  fi

  if [[ -z "${DISPLAY:-}" ]] && command -v xvfb-run >/dev/null 2>&1; then
    echo "   No DISPLAY set — launching Electron under xvfb-run (virtual display)"
    (cd "$DESKTOP_DIR" && xvfb-run -a bash -c "$ELECTRON_CMD") >> "$ELECTRON_LOG" 2>&1 &
    ELECTRON_PID=$!
  else
    (cd "$DESKTOP_DIR" && bash -c "$ELECTRON_CMD") >> "$ELECTRON_LOG" 2>&1 &
    ELECTRON_PID=$!
  fi
  echo "✓  Electron desktop → PID $ELECTRON_PID  (port $PORT)$([[ $BUILD_ELECTRON -eq 1 ]] && echo '  [packaged build]')"
  echo "   Log: $ELECTRON_LOG"
  echo ""
else
  echo "⚠  Electron desktop/package.json not found — skipping desktop launch"
  echo ""
fi

# ── 14. Tail logs ────────────────────────────────────────────────────────────
if [[ $TAIL_LOGS -eq 1 ]]; then
  echo "=== Tailing $LOG_FILE  (Ctrl-C to stop tailing, server stays up) ==="
  tail -f "$LOG_FILE"
fi
