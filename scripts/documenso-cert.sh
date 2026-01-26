#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${INFRA_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +o allexport
fi

cd "${INFRA_DIR}"

CERT_PATH="${DOCUMENSO_CERT_PATH:-../data/certs/documenso/cert.p12}"
PASSPHRASE="${DOCUMENSO_SIGNING_PASSPHRASE:-change-me}"

mkdir -p "$(dirname "${CERT_PATH}")"

if [[ -f "${CERT_PATH}" ]]; then
  echo "[documenso] cert already exists: ${CERT_PATH}"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "[documenso] openssl not found; cannot generate signing cert." >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "${tmpdir}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "${tmpdir}/key.pem" \
  -out "${tmpdir}/cert.pem" \
  -days 3650 \
  -subj "/CN=agencyos-documenso.local" >/dev/null 2>&1

openssl pkcs12 -export \
  -out "${CERT_PATH}" \
  -inkey "${tmpdir}/key.pem" \
  -in "${tmpdir}/cert.pem" \
  -passout "pass:${PASSPHRASE}" >/dev/null 2>&1

echo "[documenso] generated signing cert: ${CERT_PATH}"

