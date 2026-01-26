#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/data/run"
mkdir -p "${RUN_DIR}"

start_bg() {
  local name="$1"
  local pid_file="${RUN_DIR}/${name}.pid"
  local log_file="${RUN_DIR}/${name}.log"
  shift

  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}" || true)"
    if [[ -n "${pid}" ]] && ps -p "${pid}" >/dev/null 2>&1; then
      echo "[${name}] already running pid=${pid}"
      echo "[${name}] logs: ${log_file}"
      return 0
    fi
  fi

  echo "[${name}] starting..."
  nohup "$@" >"${log_file}" 2>&1 &
  echo $! >"${pid_file}"
  echo "[${name}] pid=$(cat "${pid_file}") logs=${log_file}"
}

cd "${ROOT_DIR}"

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "${port}" >/dev/null 2>&1
    return $?
  fi
  return 1
}

pick_api_port() {
  # Prefer 7000 (as requested) but fall back to 7001 if occupied.
  if port_in_use 7000; then
    echo 7001
    return 0
  fi
  echo 7000
}

detect_running_api_port() {
  local pid_file="${RUN_DIR}/api.pid"
  local log_file="${RUN_DIR}/api.log"
  local port_file="${RUN_DIR}/api.port"

  if [[ ! -f "${pid_file}" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "${pid_file}" || true)"
  if [[ -z "${pid}" ]] || ! ps -p "${pid}" >/dev/null 2>&1; then
    return 1
  fi

  if [[ -f "${port_file}" ]]; then
    local port
    port="$(cat "${port_file}" || true)"
    if [[ "${port}" =~ ^[0-9]+$ ]]; then
      echo "${port}"
      return 0
    fi
  fi

  if [[ -f "${log_file}" ]]; then
    local port
    port="$(grep -Eo "listening on http://localhost:[0-9]+" "${log_file}" | tail -n 1 | sed -E 's/.*:([0-9]+)$/\\1/' || true)"
    if [[ "${port}" =~ ^[0-9]+$ ]]; then
      echo "${port}" >"${port_file}" 2>/dev/null || true
      echo "${port}"
      return 0
    fi
  fi

  return 1
}

API_PORT="${AGENCYOS_API_PORT:-}"
if [[ -z "${API_PORT}" ]]; then
  API_PORT="$(detect_running_api_port || true)"
fi
if [[ -z "${API_PORT}" ]]; then
  API_PORT="$(pick_api_port)"
fi

# API + Web
start_bg api env AGENCYOS_API_PORT="${API_PORT}" npm run dev:api
echo "${API_PORT}" >"${RUN_DIR}/api.port" 2>/dev/null || true
start_bg web env AGENCYOS_API_URL="http://localhost:${API_PORT}" npm run dev

echo
echo "URLs:"
echo "  - Web UI: http://localhost:3050"
echo "  - API:    http://localhost:${API_PORT}/api/health"
