#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${INFRA_DIR}/.env"

PROFILES=()
WIPE_VOLUMES="false"

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
    --all)
      PROFILES=("agencyosdb" "infisical" "invoiceshelf" "suitecrm" "documenso")
      ;;
    --wipe)
      WIPE_VOLUMES="true"
      ;;
    agencyosdb|infisical|invoiceshelf|suitecrm|documenso)
      PROFILES+=("${arg}")
      ;;
    *)
      echo "[infra] unknown option/profile: ${arg}" >&2
      echo "Usage: scripts/infra-up.sh [--all] [agencyosdb] [infisical] [invoiceshelf] [suitecrm] [documenso] [--wipe]" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${INFRA_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${INFRA_DIR}/.env.example" "${ENV_FILE}"
  echo "[infra] created ${ENV_FILE} from .env.example"
fi

if [[ " ${PROFILES[*]} " == *" documenso "* ]]; then
  bash "${ROOT_DIR}/scripts/documenso-cert.sh" >/dev/null
fi

CMD=(docker compose -f "${INFRA_DIR}/docker-compose.yml" --env-file "${ENV_FILE}")
for p in "${PROFILES[@]}"; do
  CMD+=(--profile "${p}")
done
CMD+=(up -d)

if [[ "${WIPE_VOLUMES}" == "true" ]]; then
  echo "[infra] wiping volumes first (down -v)..."
  docker_compose -f "${INFRA_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" down -v || true
fi

echo "[infra] starting docker compose…"
docker_compose "${CMD[@]:2}"

cat <<'EOF'

Infra is up.

Core:
  - n8n: http://localhost:5678

Optional (start with profiles):
  - All:        bash scripts/infra-up.sh --all
  - SuiteCRM:   bash scripts/infra-up.sh suitecrm
  - Invoice:    bash scripts/infra-up.sh invoiceshelf
  - Documenso:  bash scripts/infra-up.sh documenso
  - Infisical:  bash scripts/infra-up.sh infisical

EOF
