<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AgencyOS

AI destekli otomasyon ajansı kur/işlet platformu (v0.1).

## Quickstart (Local)

**Prereqs:** Node.js (infra için Docker opsiyonel)

1) GitHub çekirdeklerini indir (submodules):
`git submodule update --init --recursive`

2) Dependencies:
`npm install`

3) Full stack (Web + API + n8n) tek komut:
`npm run dev:up`

İlk açılışta UI seni otomatik olarak `Setup Wizard` ekranına yönlendirir (key’ler + demo seed).
Kurulum bitince `Gelir Yolculuğu` ekranı açılır: hedefini seçip (AI ajansı / otomasyon / web tasarım / reklam / YouTube) “uygulanabilir sistem” dokümanlarını üretebilir ve `Gelir Makinesi (İlk Satış)` pipeline’ını çalıştırabilirsin.

Kapatmak için:
`npm run dev:down`

Sadece Web+API:
`npm run dev:all`

## Infra (n8n + opsiyonel servisler)

Self-host (Docker) runbook: `docs/SELF_HOST_V0_1.md`

Core (n8n + Postgres):
- `npm run infra:up`

Tüm opsiyoneller (Infisical / InvoiceShelf / SuiteCRM / Documenso):
- `npm run infra:up:all`

Not:
- Documenso self-host için signing cert gerekir; `infra:up` otomatik üretir: `data/certs/documenso/cert.p12`

## URLs

- Web UI: `http://localhost:3050`
- API health: `http://localhost:7000/api/health` (7000 doluysa `7001`)
- n8n: `http://localhost:5678`
- Infisical (profile): `http://localhost:8081`
- InvoiceShelf (profile): `http://localhost:8090`
- SuiteCRM (profile): `http://localhost:8091`
- Documenso (profile): `http://localhost:8092`

Not: macOS’ta `7000/tcp` bazen Control Center (AirPlay) tarafından kullanılıyor; `npm run dev:up` otomatik olarak `7001`’e fallback yapar. İstersen `AGENCYOS_API_PORT=...` ile override edebilirsin.

## LLM Keys

- Gemini (server-side): `server/.env` içine `GEMINI_API_KEY=...` **veya** UI → `Settings → Vault` üzerinden `GEMINI_API_KEY` kaydı ekle.
- OpenRouter Council (multi-model, opsiyonel): API için env ekle **veya** UI → `Settings → Vault`
  - `OPENROUTER_API_KEY=...`
  - Model listesi + chairman: UI → `Settings → Infrastructure → Runtime Settings → LLM Council`
    - `COUNCIL_MODELS=...` (comma-separated)
    - `COUNCIL_CHAIRMAN_MODEL=...`
    - `COUNCIL_STAGE2_ENABLED=true|false`

Council Playground:
- UI → `Council Room → Council Playground` (Stage1/Stage2/Chairman çıktılarını görürsün)

## n8n API (Workflow Import)

- AgencyOS API’nin workflow import edebilmesi için:
  - `N8N_BASE_URL=http://localhost:5678` (env **veya** UI → `Settings → Runtime Settings → Base URLs`)
  - `N8N_API_KEY=...` (n8n UI → API Keys, env **veya** UI → `Settings → Vault`)

Not: `N8N_API_KEY` yoksa “Deploy” aksiyonu sadece stage eder ve JSON indirmen için link verir.

## CRM / Invoice / Documenso / Infisical (v0.1)

Bu entegrasyonlar için base URL’leri `Settings → Runtime Settings` kısmından, token/şifreleri `Settings → Vault` kısmından girebilirsin:

- SuiteCRM: `SUITECRM_USERNAME`, `SUITECRM_PASSWORD`, `SUITECRM_BASE_URL`
- InvoiceShelf: `INVOICESHELF_TOKEN`, `INVOICESHELF_BASE_URL`
- Documenso: `DOCUMENSO_API_TOKEN`, `DOCUMENSO_BASE_URL`
- Infisical: `INFISICAL_TOKEN` + `INFISICAL_BASE_URL` + `INFISICAL_WORKSPACE_ID` + `INFISICAL_SECRET_PATH` + `INFISICAL_ENV_*_SLUG`

Documenso sözleşme akışı:
- `Project → Documents → Documenso E-Sign` ile template seç → recipient gir → “Create & Send Contract”.

Infisical sync:
- `Settings → Vault → Infisical Sync` ile “Push → Infisical” (lokal vault → Infisical) ve “Pull ← Infisical” (Infisical → lokal vault).

Not: Council session logları `data/council-sessions.json` içine yazılır (gitignored).
Not: Project verisi `data/projects.json` içine yazılır (gitignored).
Not: UI üzerinden girilen secret/settings değerleri `data/secrets.json` ve `data/settings.json` içine yazılır (gitignored).

## External Cores (PRD)

- `external/llm-council`
- `external/n8n-workflows`
- `external/invoiceshelf`
- `external/suitecrm`
- `external/documenso`
- `external/infisical`
