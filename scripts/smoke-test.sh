#!/usr/bin/env bash
set -euo pipefail

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

pick_port() {
  if [[ -n "${AGENCYOS_API_PORT:-}" ]]; then
    echo "${AGENCYOS_API_PORT}"
    return 0
  fi

  if curl -fsS "http://localhost:7000/api/health" >/dev/null 2>&1; then
    echo 7000
    return 0
  fi
  if curl -fsS "http://localhost:7001/api/health" >/dev/null 2>&1; then
    echo 7001
    return 0
  fi

  if port_in_use 7000; then
    echo 7001
    return 0
  fi
  echo 7000
}

PORT="$(pick_port)"
BASE_URL="http://localhost:${PORT}"

echo "[smoke] checking api on ${BASE_URL}"

API_PID=""
if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
  echo "[smoke] api already running"
else
  echo "[smoke] starting api"
  AGENCYOS_API_PORT="${PORT}" npx tsx server/index.ts >/tmp/agencyos-api-smoke.log 2>&1 &
  API_PID="$!"

  cleanup() {
    if [[ -n "${API_PID}" ]]; then
      kill "${API_PID}" >/dev/null 2>&1 || true
      wait "${API_PID}" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT

  for i in {1..40}; do
    if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

echo "[smoke] health"
curl -fsS "${BASE_URL}/api/health" | cat

echo
echo "[smoke] settings"
curl -fsS "${BASE_URL}/api/settings" | cat

echo
echo "[smoke] agency state"
AGENCY_JSON="$(curl -fsS "${BASE_URL}/api/agency")"
AGENCY_JSON="${AGENCY_JSON}" node -e "const a=JSON.parse(process.env.AGENCY_JSON); if(!a.goal||!Array.isArray(a.completedTaskIds)||!Array.isArray(a.documents)) process.exit(1); if(!a.revenueGoal||typeof a.revenueGoal!=='object') process.exit(1); const g=a.revenueGoal; if(typeof g.targetMrr!=='number'||typeof g.avgRetainer!=='number'||typeof g.closeRatePct!=='number'||typeof g.bookingRatePct!=='number') process.exit(1); console.log('goal:', a.goal, 'docs:', a.documents.length);"

echo
echo "[smoke] agency doc generate"
AGENCY_DOC_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"type":"Offer","markTaskId":"smoke.offer"}' "${BASE_URL}/api/agency/docs/generate")"
AGENCY_DOC_JSON="${AGENCY_DOC_JSON}" node -e "const r=JSON.parse(process.env.AGENCY_DOC_JSON); if(!r.document||!r.document.content) process.exit(1); console.log('doc:', r.document.type, 'chars:', (r.document.content||'').length);"

echo
echo "[smoke] agency doc generate (outbound playbook)"
AGENCY_DOC2_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"type":"OutboundPlaybook","markTaskId":"smoke.outbound"}' "${BASE_URL}/api/agency/docs/generate")"
AGENCY_DOC2_JSON="${AGENCY_DOC2_JSON}" node -e "const r=JSON.parse(process.env.AGENCY_DOC2_JSON); if(!r.document||!r.document.content) process.exit(1); console.log('doc:', r.document.type, 'chars:', (r.document.content||'').length);"

echo
echo "[smoke] secrets (redacted)"
curl -fsS "${BASE_URL}/api/secrets" | cat

echo
echo "[smoke] outbound pipeline (create/list/update/delete)"
OUT_CREATE_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"name":"Smoke Outbound Lead","source":"manual","stage":"New","country":"Turkey","city":"Istanbul","website":"https://example.com"}' "${BASE_URL}/api/outbound/leads")"
OUT_ID="$(OUT_CREATE_JSON="${OUT_CREATE_JSON}" node -e "const j=JSON.parse(process.env.OUT_CREATE_JSON); if(!j.lead?.id) process.exit(1); console.log(j.lead.id);")"
echo "outbound lead id: ${OUT_ID}"
OUT_LIST_JSON="$(curl -fsS "${BASE_URL}/api/outbound/leads")"
OUT_LIST_JSON="${OUT_LIST_JSON}" OUT_ID="${OUT_ID}" node -e "const j=JSON.parse(process.env.OUT_LIST_JSON); if(!Array.isArray(j.items)) process.exit(1); if(!j.items.some((x)=>x.id===process.env.OUT_ID)) process.exit(1); console.log('pipeline size:', j.items.length);"
OUT_UPD_JSON="$(curl -fsS -X PUT -H 'content-type: application/json' -d '{"stage":"Contacted"}' "${BASE_URL}/api/outbound/leads/${OUT_ID}")"
OUT_UPD_JSON="${OUT_UPD_JSON}" node -e "const j=JSON.parse(process.env.OUT_UPD_JSON); if(!j.lead||j.lead.stage!=='Contacted') process.exit(1); console.log('updated stage:', j.lead.stage);"
OUT_DEL_JSON="$(curl -fsS -X DELETE "${BASE_URL}/api/outbound/leads/${OUT_ID}")"
OUT_DEL_JSON="${OUT_DEL_JSON}" node -e "const j=JSON.parse(process.env.OUT_DEL_JSON); if(!j.removed) process.exit(1); console.log('removed:', j.removed);"

echo
echo "[smoke] integrations status"
INTEG_JSON="$(curl -fsS "${BASE_URL}/api/integrations/status")"
INTEG_JSON="${INTEG_JSON}" node -e "const j=JSON.parse(process.env.INTEG_JSON); if(!j.n8n||!j.suitecrm||!j.invoiceshelf||!j.documenso||!j.infisical||!j.apify||!j.postgres) { console.error('missing integration keys'); process.exit(1);} console.log('n8n:', j.n8n.connected ? 'connected' : 'offline');"

echo
echo "[smoke] market radar state"
MARKET_STATE_JSON="$(curl -fsS "${BASE_URL}/api/market/state")"
MARKET_STATE_JSON="${MARKET_STATE_JSON}" node -e "const j=JSON.parse(process.env.MARKET_STATE_JSON); if(!j.state||!j.apify) process.exit(1); const s=j.state; if(!s.country||!s.city||!s.updatedAt) process.exit(1); if(!Array.isArray(s.opportunities)||!Array.isArray(s.youtubeTrends)||!Array.isArray(s.youtubeIdeas)||!Array.isArray(s.internetTrends)||!Array.isArray(s.leads)) process.exit(1); console.log('market ok:', s.country, s.city, 'opps:', s.opportunities.length);"

echo
echo "[smoke] market opportunities"
MARKET_OPP_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"goal":"automation_agency","country":"Turkey","city":"Istanbul","language":"tr","count":3}' "${BASE_URL}/api/market/opportunities")"
MARKET_OPP_JSON="${MARKET_OPP_JSON}" node -e "const j=JSON.parse(process.env.MARKET_OPP_JSON); if(!Array.isArray(j.items)||!j.items.length) process.exit(1); if(!j.state) process.exit(1); console.log('opps:', j.items.length, 'source:', j.source);"

echo
echo "[smoke] market youtube trends"
MARKET_TRENDS_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"country":"Turkey","language":"tr","limit":3}' "${BASE_URL}/api/market/youtube/trends")"
MARKET_TRENDS_JSON="${MARKET_TRENDS_JSON}" node -e "const j=JSON.parse(process.env.MARKET_TRENDS_JSON); if(!Array.isArray(j.items)||!j.items.length) process.exit(1); console.log('trends:', j.items.length, 'source:', j.source);"

echo
echo "[smoke] market internet trends"
MARKET_WEB_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"limit":4}' "${BASE_URL}/api/market/internet/trends")"
MARKET_WEB_JSON="${MARKET_WEB_JSON}" node -e "const j=JSON.parse(process.env.MARKET_WEB_JSON); if(!Array.isArray(j.items)||!j.items.length) process.exit(1); console.log('internet:', j.items.length, 'source:', j.source);"

echo
echo "[smoke] market youtube ideas"
MARKET_IDEAS_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"goal":"automation_agency","country":"Turkey","niche":"dentist","language":"tr","count":3}' "${BASE_URL}/api/market/youtube/ideas")"
MARKET_IDEAS_JSON="${MARKET_IDEAS_JSON}" node -e "const j=JSON.parse(process.env.MARKET_IDEAS_JSON); if(!Array.isArray(j.items)||!j.items.length) process.exit(1); console.log('ideas:', j.items.length, 'source:', j.source);"

echo
echo "[smoke] market leads search + pitch"
MARKET_LEADS_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"country":"Turkey","city":"Istanbul","query":"dentist","language":"tr","limit":2}' "${BASE_URL}/api/market/leads/search")"
LEAD_JSON="$(MARKET_LEADS_JSON="${MARKET_LEADS_JSON}" node -e "const j=JSON.parse(process.env.MARKET_LEADS_JSON); if(!Array.isArray(j.items)||!j.items.length) process.exit(1); console.log(JSON.stringify(j.items[0]));")"
PITCH_JSON="$(curl -fsS -H 'content-type: application/json' -d "{\"goal\":\"automation_agency\",\"language\":\"tr\",\"lead\":${LEAD_JSON}}" "${BASE_URL}/api/market/leads/pitch")"
PITCH_JSON="${PITCH_JSON}" node -e "const j=JSON.parse(process.env.PITCH_JSON); if(!j.subject||!j.email||!j.dm) process.exit(1); console.log('pitch ok');"

echo
echo "[smoke] passive income ideas + plan"
PASSIVE_IDEAS_JSON="$(curl -fsS "${BASE_URL}/api/passive/ideas")"
IDEA_ID="$(PASSIVE_IDEAS_JSON="${PASSIVE_IDEAS_JSON}" node -e "const j=JSON.parse(process.env.PASSIVE_IDEAS_JSON); if(!Array.isArray(j.ideas)||!j.ideas.length) process.exit(1); console.log(j.ideas[0].id);")"
PASSIVE_PLAN_JSON="$(curl -fsS -H 'content-type: application/json' -d "{\"ideaId\":\"${IDEA_ID}\",\"language\":\"tr\"}" "${BASE_URL}/api/passive/plan")"
PASSIVE_PLAN_JSON="${PASSIVE_PLAN_JSON}" node -e "const j=JSON.parse(process.env.PASSIVE_PLAN_JSON); if(!j.document||!j.document.content) process.exit(1); console.log('passive plan ok');"

echo
echo "[smoke] global assistant state + respond"
ASST_STATE_JSON="$(curl -fsS "${BASE_URL}/api/assistant/state")"
ASST_STATE_JSON="${ASST_STATE_JSON}" node -e "const s=JSON.parse(process.env.ASST_STATE_JSON); if(!s.id||!Array.isArray(s.messages)) process.exit(1); console.log('assistant ok:', s.messages.length);"
ASST_RESP_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"message":"Kısa bir income stack planı ver ve 1 sonraki adımı söyle.","language":"tr"}' "${BASE_URL}/api/assistant/respond")"
ASST_RESP_JSON="${ASST_RESP_JSON}" node -e "const j=JSON.parse(process.env.ASST_RESP_JSON); if(!j.reply||!j.reply.content) process.exit(1); console.log('assistant respond ok');"

echo
echo "[smoke] catalog search"
SEARCH_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"query":"slack webhook","limit":3}' "${BASE_URL}/api/catalog/search")"
SEARCH_JSON="${SEARCH_JSON}" node -e "const j=JSON.parse(process.env.SEARCH_JSON); if(!j.items?.length) { console.error('no catalog items'); process.exit(1);} console.log('items:', j.items.length);"

echo
echo "[smoke] catalog search (deep match: heygen)"
HEYGEN_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"query":"heygen","limit":1}' "${BASE_URL}/api/catalog/search")"
HEYGEN_JSON="${HEYGEN_JSON}" node -e "const j=JSON.parse(process.env.HEYGEN_JSON); if(!j.items?.length) { console.error('no heygen match'); process.exit(1);} console.log('heygen match:', j.items[0].workflow.name);"

echo
echo "[smoke] catalog query rewrite"
REWRITE_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"query":"fatura sözleşme slack webhook"}' "${BASE_URL}/api/catalog/query-rewrite")"
REWRITE_JSON="${REWRITE_JSON}" node -e "const j=JSON.parse(process.env.REWRITE_JSON); if(!j.query) process.exit(1); console.log('rewrite query:', j.query);"

WF_ID="$(SEARCH_JSON="${SEARCH_JSON}" node -e "const j=JSON.parse(process.env.SEARCH_JSON); console.log(j.items[0].workflow.id);")"
echo "[smoke] picked workflow id: ${WF_ID}"

echo
echo "[smoke] create project"
PROJECT_JSON="$(curl -fsS -H 'content-type: application/json' -d @- "${BASE_URL}/api/projects" <<JSON
{"brief":{"id":"proj-smoke","clientName":"Smoke Client","description":"lead -> CRM -> proposal -> invoice","goals":["lead->crm","proposal","invoice"],"tools":["n8n","SuiteCRM","InvoiceShelf"],"budget":"TBD","riskLevel":"Medium"}}
JSON
)"
PROJECT_JSON="${PROJECT_JSON}" node -e "const p=JSON.parse(process.env.PROJECT_JSON); if(p.id!=='proj-smoke') process.exit(1); console.log('project ok:', p.id);"

echo
echo "[smoke] suitecrm lead create (direct endpoint; ok=200 or 400)"
SUITE_DIRECT_PATH="/tmp/agencyos-suitecrm-direct.json"
SUITE_DIRECT_CODE="$(curl -sS -o "${SUITE_DIRECT_PATH}" -w "%{http_code}" -H 'content-type: application/json' -d '{"lastName":"Smoke Lead","description":"smoke test","status":"New","leadSource":"AgencyOS"}' "${BASE_URL}/api/crm/suitecrm/lead")"
SUITE_DIRECT_JSON="$(cat "${SUITE_DIRECT_PATH}")"
if [[ "${SUITE_DIRECT_CODE}" != "200" && "${SUITE_DIRECT_CODE}" != "400" ]]; then
  echo "unexpected http code: ${SUITE_DIRECT_CODE}"
  echo "${SUITE_DIRECT_JSON}"
  exit 1
fi
SUITE_DIRECT_CODE="${SUITE_DIRECT_CODE}" SUITE_DIRECT_JSON="${SUITE_DIRECT_JSON}" node -e "const code=Number(process.env.SUITE_DIRECT_CODE); const j=JSON.parse(process.env.SUITE_DIRECT_JSON); if(code===200){ if(!j.baseUrl||!j.lead?.id) process.exit(1); console.log('suitecrm direct ok:', j.lead.id);} else { if(!j.error) process.exit(1); console.log('suitecrm direct needs config:', j.error);} "

echo
echo "[smoke] suitecrm lead create (project endpoint; ok=200 or 400)"
SUITE_PROJ_PATH="/tmp/agencyos-suitecrm-proj.json"
SUITE_PROJ_CODE="$(curl -sS -o "${SUITE_PROJ_PATH}" -w "%{http_code}" -X POST "${BASE_URL}/api/projects/proj-smoke/crm/suitecrm/lead")"
SUITE_PROJ_JSON="$(cat "${SUITE_PROJ_PATH}")"
if [[ "${SUITE_PROJ_CODE}" != "200" && "${SUITE_PROJ_CODE}" != "400" ]]; then
  echo "unexpected http code: ${SUITE_PROJ_CODE}"
  echo "${SUITE_PROJ_JSON}"
  exit 1
fi
SUITE_PROJ_CODE="${SUITE_PROJ_CODE}" SUITE_PROJ_JSON="${SUITE_PROJ_JSON}" node -e "const code=Number(process.env.SUITE_PROJ_CODE); const j=JSON.parse(process.env.SUITE_PROJ_JSON); if(code===200){ if(!j.project||!j.lead?.id) process.exit(1); console.log('suitecrm project ok:', j.lead.id);} else { if(!j.error) process.exit(1); console.log('suitecrm project needs config:', j.error);} "

echo
echo "[smoke] install workflow (staged unless N8N_API_KEY set)"
INSTALL_PATH="/tmp/agencyos-install.json"
INSTALL_CODE="$(curl -sS -o "${INSTALL_PATH}" -w "%{http_code}" -H 'content-type: application/json' -d "{\"workflowId\":\"${WF_ID}\",\"activate\":false}" "${BASE_URL}/api/projects/proj-smoke/workflows/install")"
INSTALL_JSON="$(cat "${INSTALL_PATH}")"
if [[ "${INSTALL_CODE}" != "200" && "${INSTALL_CODE}" != "502" ]]; then
  echo "unexpected http code: ${INSTALL_CODE}"
  echo "${INSTALL_JSON}"
  exit 1
fi
INSTALL_CODE="${INSTALL_CODE}" INSTALL_JSON="${INSTALL_JSON}" node -e "const r=JSON.parse(process.env.INSTALL_JSON); const p=r.project||r; if(!p?.activeWorkflows?.length) process.exit(1); console.log('http:', process.env.INSTALL_CODE, 'workflows:', p.activeWorkflows.length, 'status:', p.activeWorkflows[0]?.deployment?.status);"

echo
echo "[smoke] executions feed"
EXEC_JSON="$(curl -fsS "${BASE_URL}/api/projects/proj-smoke/executions?limit=5")"
EXEC_JSON="${EXEC_JSON}" node -e "const r=JSON.parse(process.env.EXEC_JSON); if(typeof r.connected!=='boolean'||!Array.isArray(r.executions)) process.exit(1); console.log('connected:', r.connected, 'executions:', r.executions.length);"

echo
echo "[smoke] invoiceshelf status sync endpoint"
INV_SYNC_PATH="/tmp/agencyos-invoicesync.json"
INV_SYNC_CODE="$(curl -sS -o "${INV_SYNC_PATH}" -w "%{http_code}" -X POST "${BASE_URL}/api/projects/proj-smoke/financials/invoiceshelf/sync")"
INV_SYNC_JSON="$(cat "${INV_SYNC_PATH}")"
if [[ "${INV_SYNC_CODE}" != "200" && "${INV_SYNC_CODE}" != "400" ]]; then
  echo "unexpected http code: ${INV_SYNC_CODE}"
  echo "${INV_SYNC_JSON}"
  exit 1
fi
INV_SYNC_CODE="${INV_SYNC_CODE}" INV_SYNC_JSON="${INV_SYNC_JSON}" node -e "const code=Number(process.env.INV_SYNC_CODE); const j=JSON.parse(process.env.INV_SYNC_JSON); if(code===200){ if(!j.project||!j.summary) process.exit(1); console.log('ok: updated', j.summary.updated);} else { if(!j.error) process.exit(1); console.log('needs config:', j.error);} "

echo
echo "[smoke] documenso status sync endpoint"
DOC_SYNC_PATH="/tmp/agencyos-docsync.json"
DOC_SYNC_CODE="$(curl -sS -o "${DOC_SYNC_PATH}" -w "%{http_code}" -X POST "${BASE_URL}/api/projects/proj-smoke/contracts/documenso/sync")"
DOC_SYNC_JSON="$(cat "${DOC_SYNC_PATH}")"
if [[ "${DOC_SYNC_CODE}" != "200" && "${DOC_SYNC_CODE}" != "400" ]]; then
  echo "unexpected http code: ${DOC_SYNC_CODE}"
  echo "${DOC_SYNC_JSON}"
  exit 1
fi
DOC_SYNC_CODE="${DOC_SYNC_CODE}" DOC_SYNC_JSON="${DOC_SYNC_JSON}" node -e "const code=Number(process.env.DOC_SYNC_CODE); const j=JSON.parse(process.env.DOC_SYNC_JSON); if(code===200){ if(!j.project||!j.summary) process.exit(1); console.log('ok: updated', j.summary.updated);} else { if(!j.error) process.exit(1); console.log('needs config:', j.error);} "

echo
echo "[smoke] council run"
COUNCIL_JSON="$(curl -fsS -H 'content-type: application/json' -d '{"projectId":"proj-smoke","gateType":"Risk","topic":"Risk & Test Gate","context":{"demo":true}}' "${BASE_URL}/api/council/run")"
COUNCIL_JSON="${COUNCIL_JSON}" node -e "const s=JSON.parse(process.env.COUNCIL_JSON); if(!s.id||!s.decision) process.exit(1); console.log('council ok:', s.decision);"

echo
echo "[smoke] done"
