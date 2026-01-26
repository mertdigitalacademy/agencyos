#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/data/run/n8n.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "[n8n] not running (no pid file)"
  exit 0
fi

PID="$(cat "${PID_FILE}" || true)"
if [[ -z "${PID}" ]]; then
  rm -f "${PID_FILE}"
  echo "[n8n] not running (empty pid)"
  exit 0
fi

if ps -p "${PID}" >/dev/null 2>&1; then
  echo "[n8n] stopping pid=${PID}"
  kill "${PID}" >/dev/null 2>&1 || true
  for i in {1..40}; do
    if ! ps -p "${PID}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

rm -f "${PID_FILE}"
echo "[n8n] stopped"

