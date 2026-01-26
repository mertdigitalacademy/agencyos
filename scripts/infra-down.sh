#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${INFRA_DIR}/.env"

WIPE="false"
if ! command -v docker >/dev/null 2>&1; then
  echo "[infra] docker not found. Install Docker Desktop first." >&2
  exit 1
fi

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return 0
  fi
  echo "[infra] docker compose not available. Install the docker-compose plugin." >&2
  exit 1
}

for arg in "$@"; do
  case "${arg}" in
    --wipe)
      WIPE="true"
      ;;
    *)
      echo "[infra] unknown option: ${arg}" >&2
      echo "Usage: scripts/infra-down.sh [--wipe]" >&2
      exit 1
      ;;
  esac
done

CMD=(-f "${INFRA_DIR}/docker-compose.yml")
if [[ -f "${ENV_FILE}" ]]; then
  CMD+=(--env-file "${ENV_FILE}")
fi
CMD+=(down)
if [[ "${WIPE}" == "true" ]]; then
  CMD+=(-v)
fi

echo "[infra] stopping docker compose…"
docker_compose "${CMD[@]}"

echo "[infra] stopped"
