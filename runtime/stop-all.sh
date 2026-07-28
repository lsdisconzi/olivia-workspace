#!/usr/bin/env bash
# stop-all.sh — Stop Olivia (standalone)
# Usage:  ./stop-all.sh [--port 3229] [--no-watchers] [--force-after 5]
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd "$SCRIPT_DIR"

PORT="${Olivia_PORT:-3229}"
STOP_WATCHERS=1
FORCE_AFTER=5
STOP_OLLAMA=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --no-watchers)
      STOP_WATCHERS=0
      shift
      ;;
    --force-after)
      FORCE_AFTER="$2"
      shift 2
      ;;
    --ollama)
      STOP_OLLAMA=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./stop-all.sh [--port 3229] [--no-watchers] [--force-after 5] [--ollama]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if ! [[ "$FORCE_AFTER" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --force-after must be an integer number of seconds"
  exit 1
fi

kill_with_fallback() {
  local pid="$1"
  local label="$2"

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  echo "Stopping $label (PID $pid)..."
  kill "$pid" 2>/dev/null || true

  local elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if (( elapsed >= FORCE_AFTER * 10 )); then
      echo "Force killing $label (PID $pid)"
      kill -9 "$pid" 2>/dev/null || true
      break
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done
}

found_any=0

# 1) Stop server listening on the configured port.
SERVER_PIDS_RAW="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
SERVER_PIDS="$(printf '%s\n' "$SERVER_PIDS_RAW" | sed '/^$/d' | sort -u || true)"

if [[ -n "$SERVER_PIDS" ]]; then
  found_any=1
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    cmd="$(ps -p "$pid" -o command= 2>/dev/null | sed -e 's/^ *//' || true)"
    [[ -n "$cmd" ]] && echo "Port $PORT listener: $cmd"
    kill_with_fallback "$pid" "port-$PORT listener"
  done <<< "$SERVER_PIDS"
  echo "Done: port $PORT is free"
else
  echo "No listener found on port $PORT"
fi

# 2) Stop optional function watcher(s) associated with this workspace and port.
if [[ "$STOP_WATCHERS" -eq 1 ]]; then
  WATCH_PATTERN="${SCRIPT_DIR}/automation/watch_functions_sync.py.*127.0.0.1:${PORT}/api/functions/reload"
  WATCH_PIDS_RAW="$(pgrep -f "$WATCH_PATTERN" 2>/dev/null || true)"
  WATCH_PIDS="$(printf '%s\n' "$WATCH_PIDS_RAW" | sed '/^$/d' | sort -u || true)"

  if [[ -n "$WATCH_PIDS" ]]; then
    found_any=1
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      cmd="$(ps -p "$pid" -o command= 2>/dev/null | sed -e 's/^ *//' || true)"
      [[ -n "$cmd" ]] && echo "Watcher: $cmd"
      kill_with_fallback "$pid" "functions watcher"
    done <<< "$WATCH_PIDS"
    echo "Done: watcher processes stopped"
  else
    echo "No matching watcher process found"
  fi
fi

# 3) Stop Electron desktop wrapper
ELECTRON_PIDS="$(pgrep -f "electron.*desktop" 2>/dev/null || true)"
if [[ -n "$ELECTRON_PIDS" ]]; then
  found_any=1
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    cmd="$(ps -p "$pid" -o command= 2>/dev/null | sed -e 's/^ *//' || true)"
    [[ -n "$cmd" ]] && echo "Electron desktop: $cmd"
    kill_with_fallback "$pid" "Electron desktop"
  done <<< "$ELECTRON_PIDS"
  echo "Done: Electron desktop stopped"
fi

# 4) Stop Ollama server (only when --ollama was passed)
if [[ "$STOP_OLLAMA" -eq 1 ]]; then
  OLLAMA_PIDS="$(pgrep -x "ollama" 2>/dev/null || true)"
  if [[ -z "$OLLAMA_PIDS" ]]; then
    echo "No Ollama process found"
  else
    found_any=1
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      kill_with_fallback "$pid" "Ollama server"
    done <<< "$OLLAMA_PIDS"
    echo "Done: Ollama server stopped"
  fi
fi

if [[ "$found_any" -eq 0 ]]; then
  echo "Nothing to stop"
fi
