#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/data/run"
mkdir -p "${RUN_DIR}"

PID_FILE="${RUN_DIR}/n8n.pid"
LOG_FILE="${RUN_DIR}/n8n.log"

export N8N_PORT="${N8N_PORT:-5678}"
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-127.0.0.1}"
export N8N_HOST="${N8N_HOST:-localhost}"
export N8N_PROTOCOL="${N8N_PROTOCOL:-http}"
export WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:${N8N_PORT}}"

# If n8n is already reachable (e.g. Docker Compose), don't start a second instance.
code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${N8N_PORT}/" || true)"
if [[ "${code}" != "000" ]]; then
  echo "[n8n] already reachable on http://localhost:${N8N_PORT} (skipping local start)"
  exit 0
fi

if [[ -f "${PID_FILE}" ]]; then
  PID="$(cat "${PID_FILE}" || true)"
  if [[ -n "${PID}" ]] && ps -p "${PID}" >/dev/null 2>&1; then
    echo "[n8n] already running pid=${PID}"
    echo "[n8n] logs: ${LOG_FILE}"
    echo "[n8n] url:  http://localhost:5678"
    exit 0
  fi
fi

export N8N_DIAGNOSTICS_ENABLED="${N8N_DIAGNOSTICS_ENABLED:-false}"
export N8N_PERSONALIZATION_ENABLED="${N8N_PERSONALIZATION_ENABLED:-false}"

# Optional: enable basic auth (may vary by n8n version)
export N8N_BASIC_AUTH_ACTIVE="${N8N_BASIC_AUTH_ACTIVE:-false}"
export N8N_BASIC_AUTH_USER="${N8N_BASIC_AUTH_USER:-admin}"
export N8N_BASIC_AUTH_PASSWORD="${N8N_BASIC_AUTH_PASSWORD:-admin}"

# Recommended for stable credential encryption
export N8N_ENCRYPTION_KEY="${N8N_ENCRYPTION_KEY:-agencyos-dev-encryption-key}"

nohup npx --yes n8n start >"${LOG_FILE}" 2>&1 &
echo $! >"${PID_FILE}"

PID="$(cat "${PID_FILE}")"
echo "[n8n] starting pid=${PID}"
echo "[n8n] logs: ${LOG_FILE}"

for i in {1..120}; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${N8N_PORT}/" || true)"
  if [[ "${code}" != "000" ]]; then
    echo "[n8n] up http_code=${code}"
    echo "[n8n] url: http://localhost:${N8N_PORT}"
    exit 0
  fi
  sleep 0.25
done

echo "[n8n] still not responding; check ${LOG_FILE}"
exit 1
