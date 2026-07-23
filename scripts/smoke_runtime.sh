#!/usr/bin/env bash
# Basic runtime smoke checks for OliviaLegal.
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:${OliviaLegal_PORT:-3229}}"

check_endpoint() {
  local path="$1"
  local allowed="$2"
  local label="$3"

  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" || true)"

  if [[ ",${allowed}," == *",${code},"* ]]; then
    echo "PASS ${label}: ${code} ${path}"
    return 0
  fi

  echo "FAIL ${label}: ${code} ${path} (expected one of ${allowed})"
  return 1
}

failures=0

check_endpoint "/health" "200" "health" || failures=$((failures + 1))
check_endpoint "/OliviaLegal/" "200,302" "ui-entry" || failures=$((failures + 1))
check_endpoint "/api/OliviaLegal/remote-bus?role=desktop&since=0&wait=0" "200" "remote-bus" || failures=$((failures + 1))

if (( failures > 0 )); then
  echo "Smoke result: FAIL (${failures} checks failed)"
  exit 1
fi

echo "Smoke result: PASS"
