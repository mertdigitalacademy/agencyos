#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/data/run"
INFRA_ENV="${ROOT_DIR}/infra/.env"

if [[ ! -d "${RUN_DIR}" ]]; then
  mkdir -p "${RUN_DIR}"
fi

pick_api_port() {
  if [[ -f "${RUN_DIR}/api.port" ]]; then
    local p
    p="$(cat "${RUN_DIR}/api.port" || true)"
    if [[ "${p}" =~ ^[0-9]+$ ]]; then
      echo "${p}"
      return 0
    fi
  fi

  for p in 7000 7001; do
    if curl -sS -o /dev/null "http://localhost:${p}/api/health" >/dev/null 2>&1; then
      echo "${p}"
      return 0
    fi
  done

  echo 7000
}

API_PORT="$(pick_api_port)"
API_BASE="http://localhost:${API_PORT}"

wait_http() {
  local url="$1"
  local name="$2"
  local tries="${3:-120}"
  for _i in $(seq 1 "${tries}"); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "${url}" || true)"
    if [[ "${code}" != "000" ]]; then
      echo "[seed] ${name} up (http ${code})"
      return 0
    fi
    sleep 1
  done
  echo "[seed] ${name} not responding: ${url}" >&2
  return 1
}

upsert_secret() {
  local key="$1"
  local value="$2"
  local env="${3:-Production}"
  curl -sS -X PUT "${API_BASE}/api/secrets" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"${key}\",\"value\":\"${value}\",\"environment\":\"${env}\"}" >/dev/null
}

echo "[seed] checking AgencyOS API on ${API_BASE}"
wait_http "${API_BASE}/api/health" "AgencyOS API"

# --- SuiteCRM defaults (Bitnami image default admin/admin in our compose) -----
upsert_secret "SUITECRM_USERNAME" "admin"
upsert_secret "SUITECRM_PASSWORD" "admin"
echo "[seed] SuiteCRM credentials saved (admin/admin)"

# --- AgencyOS Postgres (optional, profile: agencyosdb) ------------------------
AGENCYOS_DB_PORT="5434"
AGENCYOS_DB_USER="agencyos"
AGENCYOS_DB_PASSWORD="agencyos"
AGENCYOS_DB_NAME="agencyos"

if [[ -f "${INFRA_ENV}" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "${INFRA_ENV}"
  set +o allexport
  AGENCYOS_DB_PORT="${AGENCYOS_DB_PORT:-5434}"
  AGENCYOS_DB_USER="${AGENCYOS_DB_USER:-agencyos}"
  AGENCYOS_DB_PASSWORD="${AGENCYOS_DB_PASSWORD:-agencyos}"
  AGENCYOS_DB_NAME="${AGENCYOS_DB_NAME:-agencyos}"
fi

upsert_secret "AGENCYOS_DATABASE_URL" "postgres://${AGENCYOS_DB_USER}:${AGENCYOS_DB_PASSWORD}@localhost:${AGENCYOS_DB_PORT}/${AGENCYOS_DB_NAME}"
echo "[seed] AGENCYOS_DATABASE_URL saved (localhost:${AGENCYOS_DB_PORT}/${AGENCYOS_DB_NAME})"

# --- InvoiceShelf bootstrap (optional) ---------------------------------------
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q '^agencyos-invoiceshelf$'; then
    echo "[seed] bootstrapping InvoiceShelf demo data..."
    docker exec -i agencyos-invoiceshelf bash -lc "cd /var/www/html && ./artisan reset:app --force" >/dev/null 2>&1 || true
    wait_http "http://localhost:8090/api/ping" "InvoiceShelf"

    token="$(
      curl -sS -X POST "http://localhost:8090/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"demo@invoiceshelf.com","password":"demo","device_name":"agencyos"}' \
        | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s); if(!j||!j.token) throw new Error('missing token'); process.stdout.write(String(j.token));}catch(e){process.exit(2)}})"
    )" || true

    if [[ -n "${token:-}" ]]; then
      upsert_secret "INVOICESHELF_TOKEN" "${token}"
      echo "[seed] InvoiceShelf token saved (demo@invoiceshelf.com)"
    else
      echo "[seed] InvoiceShelf token not saved (login failed). Open http://localhost:8090 to complete setup." >&2
    fi
  else
    echo "[seed] InvoiceShelf container not running (skip). Start: npm run infra:up invoiceshelf"
  fi
else
  echo "[seed] docker not found; skipping InvoiceShelf bootstrap."
fi

echo
echo "[seed] done"
echo "Next:"
echo "  - Open Setup Wizard → Integration Status"
echo "  - SuiteCRM: http://localhost:8091 (admin/admin)"
echo "  - InvoiceShelf: http://localhost:8090 (demo@invoiceshelf.com / demo)"
echo "  - Documenso: http://localhost:8092 (create user + API token, then set DOCUMENSO_API_TOKEN in Vault)"
echo "  - Infisical: http://localhost:8081 (create workspace + service token, then set INFISICAL_TOKEN in Vault)"

