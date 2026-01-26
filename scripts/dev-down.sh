#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/data/run"

stop_pid() {
  local name="$1"
  local pid_file="${RUN_DIR}/${name}.pid"
  if [[ ! -f "${pid_file}" ]]; then
    echo "[${name}] not running (no pid file)"
    return 0
  fi

  local pid
  pid="$(cat "${pid_file}" || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${pid_file}"
    echo "[${name}] not running (empty pid)"
    return 0
  fi

  if ps -p "${pid}" >/dev/null 2>&1; then
    echo "[${name}] stopping pid=${pid}"
    kill "${pid}" >/dev/null 2>&1 || true
    for i in {1..40}; do
      if ! ps -p "${pid}" >/dev/null 2>&1; then
        break
      fi
      sleep 0.1
    done
  fi

  rm -f "${pid_file}"
  echo "[${name}] stopped"
}

stop_pid web
stop_pid api
rm -f "${RUN_DIR}/api.port" >/dev/null 2>&1 || true
