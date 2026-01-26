# AgencyOS v0.1 — Build Plan (PRD → Implementation)

Bu doküman PRD’deki v0 → v1 yolunu “repo + mimari + modül + endpoint + UI ekranı + test” seviyesinde uygulanabilir plana çevirir.

Para kazanma odaklı “zihinsel model” için ayrıca: `docs/MONEY_OS_V0_1.md`

## 0) MVP Varsayımları (Netleştirilmiş)

- **Hedef ajans tipi (varsayılan):** Genel “Automation Agency” (marketing/ops ağırlıklı).
- **MVP demo senaryosu (varsayılan):** `Lead → CRM → Proposal → Invoice → Report`.
- **Tenant modeli:** v0.1 = tek ajans instance, proje bazlı ayrım (multi-tenant v1).

İstersen bu 2 seçimi (ajans tipi + demo) değiştirebiliriz; planın sadece “starter pack” ve “prompt” kısımları değişir.

## 1) Çekirdekler (GitHub’dan alınanlar) ve Kullanım Şekli

Bu repo içinde submodule olarak bulunur:

- `external/n8n-workflows` (Zie619): **Workflow katalog datası** (JSON) + offline indeks/arama kaynağı.
- `external/llm-council` (karpathy): **Council yaklaşım referansı** (v0.1’de AgencyOS kendi “council gate” servisini çalıştırır; v1’de flow birebir yaklaştırılır).
- `external/invoiceshelf`: v0.1’de **docker profile** ile ayağa kaldırılabilir (Invoice UI/servis).
- `external/suitecrm`: v0.1’de **docker profile** ile ayağa kaldırılabilir (CRM UI/servis).
- `external/documenso`: v0.1’de **docker profile** ile ayağa kaldırılabilir (e-imza).
- `external/infisical`: v0.1’de **docker profile** ile ayağa kaldırılabilir (secrets vault).

> Not: Bu makinede Docker yoksa, infra servisleri sadece “planlanmış/konfigüre edilmiş” olur; AgencyOS API/UI çalışmaya devam eder.

## 2) v0.1 Teknik Mimari

**Bileşenler**

- **Web UI (Vite + React):** `localhost:3050`
  - Intake wizard
  - Catalog + öneri ekranı
  - Proje detay (workflow deploy/activate, monitoring, documents, operator chat)
  - Settings (integration health)
- **API (Express):** varsayılan `localhost:7000` (7000 doluysa `7001`)
  - Katalog arama + workflow JSON serve
  - Proje CRUD (JSON storage)
  - Council Gate (Gemini fallback + OpenRouter multi-model opsiyonel)
  - n8n import/activate + execution list (N8N_API_KEY varsa)
  - Integration health (n8n + SuiteCRM + InvoiceShelf + Documenso + Infisical)
- **Infra (Docker Compose, opsiyonel):** `infra/docker-compose.yml`
  - n8n + Postgres (core)
  - Infisical / SuiteCRM / InvoiceShelf / Documenso (profile ile)

**Veri**

- v0.1 hızlı iterasyon için JSON storage:
  - `data/projects.json` (projects)
  - `data/council-sessions.json` (council log)

## 3) Klasör Yapısı (Repo İçi)

- `server/`
  - `index.ts`: API routes
  - `lib/catalog.ts`: Zie619 workflow indeksleme + arama + metadata
  - `lib/n8n.ts`: n8n Public API client (import/activate/executions)
  - `lib/ai.ts`, `lib/gemini.ts`: Gemini/OpenRouter ile Council + doküman üretimi
  - `lib/ping.ts`: integration health ping
  - `lib/projects.ts`, `lib/storage.ts`: JSON storage CRUD
- `components/`
  - `IntakeWizard.tsx`: ihtiyaç → structured brief
  - `WorkflowCatalog.tsx`: arama + deploy
  - `ProjectDetail.tsx`: workflow ops + monitoring + operator + docs
  - `CouncilRoom.tsx`: gate çalıştırma + kayıt
  - `AgencySettings.tsx`: integration health + vault/team (UI)
- `services/api.ts`: UI → API adapter
- `infra/`: docker compose + env örneği
- `external/`: GitHub çekirdekleri (submodules)
- `docs/`: build plan + runbook (bu dosya)

## 4) Ortam Değişkenleri (v0.1)

**UI**

- `AGENCYOS_API_URL=http://localhost:7000` (Vite proxy target override)

**API**

- `AGENCYOS_API_PORT=7000` (7000 doluysa `7001` seç; `npm run dev:up` otomatik fallback yapar)

**AI**

- `GEMINI_API_KEY=...` (server side)
- `OPENROUTER_API_KEY=...` (opsiyonel multi-model council)
- `ASSISTANT_MODEL=...` (opsiyonel: Global Assistant için model override, default: chairman veya `google/gemini-2.5-flash`)
- `COUNCIL_MODELS=...,...` (OpenRouter model listesi)
- `COUNCIL_CHAIRMAN_MODEL=...` (chairman model)
- `COUNCIL_STAGE2_ENABLED=true|false` (varsayılan: true)

**Apify (opsiyonel, Market Radar için)**

- `APIFY_API_TOKEN=...`
- `APIFY_YOUTUBE_TRENDS_ACTOR=...` (opsiyonel actor id)
- `APIFY_GOOGLE_MAPS_LEADS_ACTOR=...` (opsiyonel actor id)

**Database (opsiyonel, Asistan hafızası için)**

- `AGENCYOS_DATABASE_URL=postgres://user:pass@host:5432/dbname`

**n8n**

- `N8N_BASE_URL=http://localhost:5678`
- `N8N_API_KEY=...` (n8n UI → API Keys)

**Opsiyonel servis base URL’leri (health check için)**

- `SUITECRM_BASE_URL=http://localhost:8091`
- `INVOICESHELF_BASE_URL=http://localhost:8090`
- `DOCUMENSO_BASE_URL=http://localhost:8092`
- `INFISICAL_BASE_URL=http://localhost:8081`

## 5) v0.1 Akışlar (E2E)

### 5.1 Intake → Öneri → Deploy (kritik akış)

1) User “ihtiyaç” metnini girer  
2) API `/api/intake/analyze` brief çıkarır  
3) UI brief ile `/api/catalog/search` çalıştırır, 3 aday workflow gösterir  
4) User “Deploy” der  
5) API `/api/projects/:id/workflows/install`
   - **N8N_API_KEY yoksa:** `Staged` + JSON download link
   - **N8N_API_KEY varsa:** n8n’e import → `Imported` (opsiyonel activate)

### 5.2 Council Gate (v0.1: 2 gate)

- Proposal Gate (Strategic)
- Risk/Test Gate (Risk)

API `/api/council/run`:
- Gemini ile structured JSON output (fallback)
- OpenRouter varsa multi-model Stage1 + Chairman synthesis (v0.1)

### 5.3 Monitoring (v0.1)

API `/api/projects/:id/executions`:
- n8n configured ise: workflowId’lere göre executions feed
- değilse: `connected:false` + reason

UI `ProjectDetail → Monitoring`:
- execution feed + refresh

## 6) Council Prompt Setleri (v0.1 → v1)

v0.1 hedefi: “tek model değil, gate kararı kayıtlı” + risk yakalama.

**Strategic Gate**
- Amaç: scope net mi, entegrasyonlar doğru mu, demo hikayesi net mi?
- Output: Risk/Architecture/Growth opinions + synthesis + decision

**Risk/Test Gate**
- Amaç: credential/secrets, data exposure, rollback, test plan, alerting

v1’e geçişte:
- llm-council tarzı peer-review/ranking (Stage2) + anonymize + scoring ağırlıkları eklenir.

## 7) Agent Rolleri (UI’da/Arka Planda)

v0.1’de “agent”ler UI metinleri olarak görünür; v1’de MCP ile tool-call.

- **Workflow Finder Agent:** brief → katalog arama → shortlist
- **Automation Operator Agent:** “deploy/test/activate” adımlarını yöneten kontrol botu (şu an text-chat)
- **Proposal Agent:** proposal + SOW üretimi (server-side AI)
- **Risk Officer:** Risk gate checklist + red flags
- **Chairman:** council synthesis + final decision

## 8) n8n Starter Pack (Demo İçin)

Demo hedefi (Lead → CRM → Proposal → Invoice):

- Trigger: Webhook / Form submit
- Action: CRM create lead (SuiteCRM) / Google Sheets append (fallback)
- Action: Proposal draft (AgencyOS AI → doc) + Slack approval
- Action: Invoice create (InvoiceShelf) / PDF export (fallback)
- Reporting: Email/Slack summary

v0.1’de “starter pack” yaklaşımı:
- Katalogdan “en yakın template” bulunur
- User credential checklist’ini tamamlar
- Manual test run + activate

## 9) Test Planı

**Otomatik**

- `npm run smoke`
  - health
  - catalog search
  - project create
  - workflow install (staged)
  - council run

**Manuel (UI)**

- UI `localhost:3050`
  - Intake → Dashboard → Catalog → Deploy → ProjectDetail/Workflows
  - Council Room → gate run → session kaydı
  - Monitoring → executions feed (n8n configured ise)

**n8n Integration Test (Docker gerekli)**

- n8n’i ayağa kaldır
- API key üret
- Deploy → Imported/Activated gör
- Monitoring → success/error execution’ları gör

## 10) v0.1 → v1 Build Plan (Adım Adım, Checkpoint’li)

Bu bölüm “v0.1’de demo çalışsın” ile “v1’de multi-tenant + production ops hazır olsun” arasındaki yolu, uygulanabilir checkpoint’lerle anlatır.

### M0 — v0.1 Stabilizasyon + Demo Hazırlığı (tek ajans instance)

**Hedef:** Tek makinede (veya tek sunucuda) demo akışını “bozulmadan tekrar tekrar” çalıştırmak.

- [DONE] Web + API + n8n local ayağa kalkıyor (`npm run dev:up`).
- [DONE] Setup Wizard (ilk kurulum): ajans tipi + UI modu + key onboarding + demo seed.
- [DONE] Gelir Yolculuğu (Journey Hub): hedef seçimi + uygulanabilir sistem dokümanları (plan/paket/satış yolu/YouTube).
- [DONE] Workflow catalog offline index + arama + JSON serve.
- [DONE] Catalog “AI Assist” query rewrite (Türkçe/serbest metin → keyword query) + requiredTags.
- [DONE] Council Gate + Council Playground (OpenRouter opsiyonel).
- [DONE] SuiteCRM / InvoiceShelf / Documenso / Infisical için API adaptörleri + UI yüzeyleri.
- [DONE] 2 demo müşteri seed + runbook dokümanı + CRM’de lead listesi.
- [DONE] Dashboard “Quick Start” (entegrasyon durumu + bir sonraki adım butonları).
- [DONE] Dashboard “Next Action” (proje başına tek sonraki adım önerisi).
- [DONE] Simple/Advanced UI modu (sidebar toggle).
- [DONE] Market Radar (fırsatlar + YouTube trend/fikir + internet trendleri + lead arama/pitch, Apify opsiyonel).
- [DONE] Pasif Gelir Hub (fikir kütüphanesi + plan/asset üretimi → Documents arşivi).
- [DONE] Global Assistant (OpenRouter/Gemini) + tool-call + hafıza (JSON; opsiyonel Postgres KV).
- [DONE] Gelir Makinesi (Journey içinde): seçili projede `Council → Catalog → Deploy → CRM → Invoice` pipeline’ı (best-effort) + run log.

**Checkpoint CP0 (Boot):**
- UI `http://localhost:3050` açılır.
- API `http://localhost:7000/api/health` `{ok:true}` döner (7000 doluysa `7001`).
- n8n `http://localhost:5678` açılır.

**Checkpoint CP1 (Demo Data):**
- Dashboard → `Load 2 Demo Clients` sonrası 2 proje oluşur.
- Her projede `Documents` içinde `Demo Flow Map (Runbook)` görünür.

**Checkpoint CP2 (Catalog + Stage):**
- Catalog ekranında arama yapılır, 3 aday listelenir.
- Projeye workflow “install” edilince en az `Staged` görünür ve JSON indirilebilir.

**Checkpoint CP3 (Council):**
- Council Room veya Project → `Council Gate` ile Strategic + Risk gate çalışır.
- Session kaydı oluşur ve UI’da listelenir.

**Checkpoint CP4 (CRM visibility):**
- Project → `CRM` tabı:
  - `Create/Sync Lead` ile lead yaratılır (SuiteCRM configured ise).
  - `Refresh Leads` ile lead listesi UI’da görünür (scope: project/agencyos/all).

**Checkpoint CP4b (Market Radar):**
- `Gelir Yolculuğu → Market Radar`:
  - Opportunities / YouTube / Internet / Leads aksiyonları çalışır (Apify yoksa mock data ile).
  - `Open Catalog` ile önerilen keyword’ler katalog ekranına taşınır.

**Checkpoint CP4c (Pasif Gelir Hub):**
- `Pasif Gelir Hub`:
  - Bir fikir seç → `Generate Plan` → `Documents` içine `PassiveIncome` dokümanı düşer.
  - `Generate Asset` ile seçili asset dokümanı arşive eklenir.

**Checkpoint CP4d (Global Assistant):**
- `Global Asistan`:
  - Prompt gönder → cevap gelir (OpenRouter/Gemini varsa AI, yoksa offline uyarı).
  - Tool-call ile `navigate.catalog` / `market.*` / `agency.doc.generate` gibi aksiyonlar tetiklenebilir.

**Checkpoint CP4e (Asistan Hafızası - opsiyonel Postgres):**
- `AGENCYOS_DATABASE_URL` set edilince `Settings → Integration Status` içinde `postgres: Connected` görünür.
- API restart sonrası `Global Asistan` konuşmaları persist eder.

### M1 — n8n Yönetimi v0.2 (Import/Test/Activate otomasyonu)

**Hedef:** “Kur” butonu gerçek kurulum pipeline’ına dönüşsün; staging → import → test → activate.

- [DONE] n8n API key onboarding (UI runbook + kopyala/yapıştır akışı + test button).
- [DONE] Workflow import: existing workflow update (duplicate yaratmadan).
- Credential checklist:
  - Node’lardan credential tiplerini çıkar (zaten var).
  - UI’da “required vs optional” ayrımı + “setup done” checkbox’ları.
- Test run:
  - “dry-run / manual execute” yaklaşımı (node tipine göre test yönergesi).
  - Sonuç: execution id/link + basic pass/fail.
- Activate:
  - Test pass olmadan activate engeli (go/no-go).

**Checkpoint CP5 (Import):**
- `N8N_API_KEY` girilince “install” aksiyonu `Imported` döner ve `n8nWorkflowId` set olur.

**Checkpoint CP6 (Activate):**
- `activate=true` ile workflow `Activated` olur.
- Monitoring ekranında execution feed görünür (connected true).

### M2 — Catalog Intelligence v0.3 (sektör + skor + bakım)

**Hedef:** “Sektör verince doğru workflow” seçimi daha güvenilir olsun.

- Tag/taksonomi:
  - Sektör → (entegrasyonlar, trigger tipleri, data sources) mapping tablosu.
  - [DONE] `industryHints` preset’leri + Intake’ta sektör önerileri (datalist) + Catalog AI alignment aynı presetleri kullanır.
- Skorlama:
  - Uyum (keyword/tag match) + zorluk (node count/creds) + risk (http/code) + bakım (node türleri).
  - [DONE] v0.1: server-side score’a complexity/credentials/http/code sinyalleri eklendi (keyword relevance korunarak).
- Index güncelleme:
  - submodule update + nightly rebuild (v1’de scheduler).

**Checkpoint CP7 (Sector match):**
- Intake’ta sektör seçilince “Run AI Alignment” sonucu gözle görülür farklılaşır (ör: Ecom → Shopify/Stripe).

### M3 — Council Gates v0.4 (policy + structured outputs + fiyat)

**Hedef:** Council sadece metin değil, “makine okuyabilir” karar üretsin ve fiyat/teklif pipeline’ını beslesin.

- Council output schema:
  - `decision`, `risks[]`, `assumptions[]`, `missingInfo[]`, `tests[]`, `rollbackPlan`, `pricing` (opsiyonel).
- [DONE] Strategic Gate pricing: `pricing` alanı üretimi + UI’da görüntüleme.
- Pricing:
  - Paket/kalem bazlı (setup fee + monthly retainer + usage).
  - InvoiceShelf “estimate/quote” veya invoice draft’ına map.
- Policy:
  - “no secrets in prompts” enforcement + PII redaction (v1’de daha kapsamlı).
- Stage2 peer ranking varsayılan açık, UI’da toggle mevcut.

**Checkpoint CP8 (Pricing → Document):**
- Council Strategic Gate çalışınca `pricing` üretir.
- [DONE] UI’da “Create Invoice Draft” ile InvoiceShelf’e pricing’den draft invoice oluşur ve proje dokümanlarına eklenir (token configured ise).

### M4 — CRM / Invoice / Contract v0.5 (gerçek iş akışı)

**Hedef:** Ajansın “satış → sözleşme → fatura” döngüsü tek projede uçtan uca yürüsün.

- SuiteCRM:
  - Lead list + create (var)
  - Accounts/Contacts/Opportunities (v1 öncesi minimum)
  - Web link: lead record deep-link
- Documenso:
  - Template seç + recipient map (var)
  - [DONE] Signing status sync (poll endpoint: `POST /api/projects/:id/contracts/documenso/sync`)
  - Signed doc link + project docs’a ekleme
- InvoiceShelf:
  - Customer create + invoice create (var)
  - [DONE] Payment status sync (poll endpoint: `POST /api/projects/:id/financials/invoiceshelf/sync`) + “Paid” durumu UI’da görünür

**Checkpoint CP9 (Sales loop):**
- Lead create → Contract send → Invoice create → status güncellenir (en az 1 örnek).

### M5 — Secrets & Environments v0.6 (Infisical ile gerçek yönetim)

**Hedef:** Credential’lar “local json” değil, gerçek secret manager üzerinden yönetilsin.

- Infisical:
  - Workspace + path + env slug config (var)
  - Push/Pull sync (var)
  - v1’de: per-project/per-client isolation path (örn: `/clients/<id>/...`)
- n8n credential injection stratejisi:
  - v0.6: runbook + manual
  - v1: otomatik credential provisioning (scope kontrollü)

**Checkpoint CP10 (Secrets sync):**
- UI → `Infisical Sync` ile push/pull çalışır ve secret listesi görünür.

### M6 — MCP Layer v0.7 (ajanların tool çağırması)

**Hedef:** “Operator Agent” n8n tool’larını MCP üzerinden çağırabilsin.

- MCP trigger node seçimi + n8n’e kurulumu (community node / resmi çözüm).
- AgencyOS ↔ MCP:
  - Tool registry (hangi tool’lar var, param schema)
  - AuthN/AuthZ (token + allowlist)
  - Audit log (kim hangi tool’u çağırdı)
- 1 örnek tool:
  - `workflow_search` (catalog)
  - `workflow_install` (n8n)
  - `send_contract` (documenso)

**Checkpoint CP11 (MCP demo):**
- MCP client → n8n tool call → AgencyOS’a sonuç düşer (en az 1 tool call).

### V1 — Multi-tenant + Observability + Production Hardening

**Hedef:** Birden fazla müşteri/ajans aynı platformda izole şekilde çalışsın; operasyon görünür olsun.

- Veri katmanı:
  - JSON storage → Postgres (migrations)
  - Modeller: User, Workspace, Project, Deployments, Executions, CouncilSessions, Documents, AuditEvents
- Workspace isolation:
  - RBAC (Owner/Ops/Viewer)
  - Secrets isolation (Infisical path + env bazlı)
  - n8n isolation stratejisi:
    - v1.0: tek n8n instance + project prefix + RBAC + credential scopes
    - v1.1: müşteri başına n8n instance (daha güçlü izolasyon)
- Observability:
  - Event log + audit
  - Execution failure alerts + MTTR
  - SLA dashboard (per project)
- Güvenlik:
  - PII redaction
  - Council prompt firewall (no secrets)
  - MCP endpoint hardening (rate limit + allowlist + signed requests)
- CI / test:
  - API integration tests (mocked external APIs)
  - E2E smoke + seed + flows

**Checkpoint V1-CP0 (Tenant):**
- 2 workspace oluşturulur, birbirinin project/secrets’ini göremez.

**Checkpoint V1-CP1 (Go-live gate):**
- Risk + Test gate “Approved” olmadan activate mümkün değildir.

**Checkpoint V1-CP2 (Ops):**
- Bir workflow execution fail olduğunda alert + incident kaydı + post-mortem gate otomatik açılır.

## 11) v0.1 İş Kırılımı (Çok Detaylı Checklist)

### Epic A — Repo/Çekirdekler

- [ ] `git submodule update --init --recursive` ile tüm çekirdeklerin geldiğini doğrula
- [ ] `external/*` altındaki repo versiyonlarını (commit/tag) dokümante et
- [ ] `infra/docker-compose.yml` profile’larını doğrula (n8n, infisical, invoiceshelf, suitecrm, documenso)

### Epic B — Catalog Service (Zie619)

- [ ] JSON indeks üretimi: file scan → metadata çıkar (name/tags/credentials/complexity)
- [ ] Arama: keyword + tag filter + limit
- [ ] Skorlama: (query match + tag match + complexity penalty + credential count penalty)
- [ ] Workflow download: id → raw JSON endpoint
- [ ] “Install Plan” üretimi:
  - [ ] credential checklist
  - [ ] import steps (manual + API)
  - [ ] test steps (minimum smoke)
  - [ ] risk notes (secrets, webhooks, code node)

### Epic C — Project Service (v0.1 JSON Storage)

- [ ] Project CRUD (list/create/get/update)
- [ ] Project state machine: Intake → Proposal → Developing → Testing → Live
- [ ] Deployment state: workflow bazlı `Staged/Imported/Activated/Error`
- [ ] Council session log storage

### Epic D — n8n Management (Public API)

- [ ] Config: `N8N_BASE_URL`, `N8N_API_KEY`
- [ ] Workflow create/import: JSON → `/api/v1/workflows`
- [ ] Activate: `/api/v1/workflows/:id/activate`
- [ ] Execution list: `/api/v1/executions?workflowId=...`
- [ ] UI surface:
  - [ ] ProjectDetail/Workflows: Import status + Activate butonu + JSON download
  - [ ] ProjectDetail/Monitoring: execution feed + refresh + offline reason

### Epic E — Council Service (v0.1)

- [ ] Gate endpoint: `/api/council/run`
- [ ] Gate types: Strategic + Risk (MVP), Launch/Post-Mortem (v1)
- [ ] Gemini fallback (structured JSON schema)
- [ ] OpenRouter opsiyonel multi-model:
  - [ ] Stage1: multi-model critique
  - [ ] Chairman: synthesis + decision
  - [ ] (v1) Stage2: peer review + ranking + anonymization

### Epic F — Documents (v0.1)

- [ ] Proposal generation endpoint (server-side)
- [ ] SOW generation endpoint (server-side)
- [ ] UI Documents tab: draft üret, listede göster, modal viewer
- [ ] (v1) InvoiceShelf entegrasyonu: “create invoice” API + link
- [ ] (v1) Documenso entegrasyonu: “send contract for signature” + status

### Epic G — Integrations (Health + UX)

- [ ] `/api/integrations/status` ile:
  - [ ] n8n (API key varsa)
  - [ ] SuiteCRM ping
  - [ ] InvoiceShelf ping
  - [ ] Documenso ping
  - [ ] Infisical ping
- [ ] UI Settings → Infrastructure: canlı/kapalı durumlarını göster
- [ ] (v1) gerçek auth + API client ekle (her servis için)

### Epic H — “AgencyOS çalışıyor mu?” Demo Checklist

- [ ] `npm run dev:api` + `npm run dev` ile UI + API açılıyor
- [ ] Intake tamamlanıyor ve proje oluşuyor
- [ ] Catalog araması sonuç dönüyor
- [ ] Deploy workflow “Staged” oluyor (N8N_API_KEY yokken)
- [ ] Council Risk Gate çalışıyor, session kaydoluyor
- [ ] Monitoring tab offline reason gösteriyor (N8N_API_KEY yokken)
- [ ] n8n kuruluysa: Import → Activate → Execution feed görünüyor

## 12) API Kontratları (v0.1)

### Health
- `GET /api/health` → `{ ok: true }`

### Intake
- `POST /api/intake/analyze` `{ input }` → `ProjectBrief` parçaları

### Catalog
- `POST /api/catalog/search` `{ query, limit, requiredTags }` → `{ items: WorkflowCandidate[] }`
- `POST /api/catalog/reindex` → `{ ok: true, workflows: number }`
- `POST /api/catalog/query-rewrite` `{ query }` → `{ query, requiredTags, keywords, notes }`
- `GET /api/catalog/workflow/:id/raw` → workflow JSON download

### Projects
- `GET /api/projects` → `Project[]`
- `POST /api/projects` `{ brief }` → `Project`
- `PUT /api/projects/:id` `{ project }` → `Project`

### Gelir Yolculuğu (Agency)
- `GET /api/agency` → `AgencyState`
- `PUT /api/agency` `{ goal?, completedTaskIds? }` → `AgencyState`
- `POST /api/agency/docs/generate` `{ type, markTaskId? }` → `{ agency: AgencyState, document }`

### Market Radar
- `GET /api/market/state` → `{ state, apify }`
- `POST /api/market/opportunities` `{ goal, country, city, niche?, language, count? }` → `{ items, source, state }`
- `POST /api/market/youtube/trends` `{ country, language, limit? }` → `{ items, source, error?, state }`
- `POST /api/market/youtube/ideas` `{ goal, country, niche, language, trends?, count? }` → `{ items, source, state }`
- `POST /api/market/internet/trends` `{ sources?: ["hackernews"|"github"], limit? }` → `{ items, source, error?, state }`
- `POST /api/market/leads/search` `{ country, city, query, language, limit? }` → `{ items, source, error?, state }`
- `POST /api/market/leads/pitch` `{ goal, language, lead, opportunity? }` → `MarketLeadPitch`

### Deploy / n8n
- `POST /api/projects/:id/workflows/install` `{ workflowId, activate? }` → `{ project, workflow }`
- `POST /api/projects/:id/workflows/:workflowId/activate` → `Project`
- `GET /api/projects/:id/executions?limit=20` → `{ connected, baseUrl, executions, reason? }`

### Council
- `POST /api/council/run` `{ projectId, gateType, topic, context }` → `CouncilSession`
- `POST /api/council/playground` `{ prompt }` → Stage1/Stage2/Final (llm-council benzeri)
- `GET /api/council/sessions?projectId=...` → `CouncilSession[]`

### Integrations
- `GET /api/integrations/n8n` → `{ connected, baseUrl, reason?, sample? }`
- `GET /api/integrations/status` → `{ n8n, suitecrm, invoiceshelf, documenso, infisical }`
- `GET /api/integrations/documenso/me`
- `GET /api/integrations/documenso/templates?page=1&perPage=25`
- `GET /api/integrations/documenso/templates/:id`
- `GET /api/integrations/documenso/documents?page=1&perPage=10`
- `POST /api/projects/:id/contracts/documenso/send` → `{ project, documenso }`
- `POST /api/projects/:id/contracts/documenso/sync` → `{ project, summary, changes }`
- `GET /api/integrations/infisical/secrets?env=Production`
- `POST /api/integrations/infisical/sync/push` → `{ ok, scope, pushed, errors }`
- `POST /api/integrations/infisical/sync/pull` → `{ ok, imported, activeEnvironment, environmentSlug }`

### Runtime Settings / Vault
- `GET /api/settings` → `{ activeEnvironment, n8nBaseUrl, suitecrmBaseUrl, invoiceshelfBaseUrl, documensoBaseUrl, infisicalBaseUrl, infisicalWorkspaceId, infisicalSecretPath, infisicalEnvDevelopmentSlug, infisicalEnvStagingSlug, infisicalEnvProductionSlug, councilModels, councilChairmanModel, councilStage2Enabled }`
- `PUT /api/settings` → aynı payload (patch) ile güncelle
- `GET /api/secrets` → secret listesi (redacted)
- `PUT /api/secrets` → `{ key, value, environment }` ile upsert (server-side persist)
- `DELETE /api/secrets/:id` → `{ ok: true }`

### SuiteCRM / InvoiceShelf Actions
- `POST /api/projects/:id/crm/suitecrm/lead` → `{ project, lead }`
- `POST /api/projects/:id/financials/invoiceshelf/invoice` → `{ project, invoice }`
- `POST /api/projects/:id/financials/invoiceshelf/sync` → `{ project, summary, changes }`
- `POST /api/integrations/invoiceshelf/login` → `{ ok: true }` (token’ı vault’a yazar)

## 13) Runbook (Local)

- API: `npm run dev:api` (varsayılan `7000`, 7000 doluysa `AGENCYOS_API_PORT=7001`)
- UI: `npm run dev` (varsayılan `3050`)
- Tek komut: `npm run dev:all`
- Smoke: `npm run smoke`
