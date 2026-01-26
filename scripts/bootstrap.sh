#!/usr/bin/env bash
set -euo pipefail

git submodule update --init --recursive
npm install

cat <<'EOF'

Bootstrap complete.

Next:
  - Start API: npm run dev:api
  - Start Web: npm run dev
  - Start infra (self-host): npm run infra:up
  - Start infra (all integrations): npm run infra:up:all

EOF
