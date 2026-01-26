# AgencyOS v0.1 — Self‑Host Runbook (Docker)

Bu runbook, PRD’deki “çekirdekleri self-host et” hedefi için: n8n + SuiteCRM + InvoiceShelf + Documenso + Infisical’i tek makinede ayağa kaldırıp AgencyOS’a bağlamak için gereken **bilgileri (credential checklist)** ve adımları içerir.

## 1) Gerekenler (ön koşullar)

- Docker Desktop (Docker Compose v2 ile)
- Node.js (AgencyOS Web/API için)

## 2) 10 dakikalık hızlı kurulum (local)

1) Infra (n8n + tüm opsiyonel servisler)
- `npm run infra:up:all`

2) AgencyOS (UI + API + local n8n runner)
- `npm run dev:up`

3) UI
- `http://localhost:3050`

4) Otomatik “local secret seed” (SuiteCRM + AgencyOS Postgres + InvoiceShelf demo token)
- `npm run selfhost:seed`

Notlar:
- API `7000` doluysa `7001` kullanılır (aktif port: `data/run/api.port`).
- Eğer Docker ile n8n zaten açıksa, `dev:up` ikinci bir n8n başlatmaz (mevcut n8n’i kullanır).
- Documenso için signing cert gerekir; `infra:up` bunu otomatik üretir: `data/certs/documenso/cert.p12`.

## 3) Hangi bilgiler lazım? (Baştan sona checklist)

AgencyOS “tek başına” da çalışır; ama gerçek entegrasyonlar için aşağıdaki bilgileri girmen gerekir.

### 3.1 AI (Council + doküman üretimi)

En az 1 tanesi:
- `GEMINI_API_KEY` (server-side, önerilen baseline)
- `OPENROUTER_API_KEY` (multi-model Council + opsiyonel Assistant modeli)

Opsiyonel ayarlar:
- `COUNCIL_MODELS` (OpenRouter model listesi, virgülle)
- `COUNCIL_CHAIRMAN_MODEL`
- `COUNCIL_STAGE2_ENABLED=true|false`

Nereye girilir:
- UI → `Setup Wizard` veya `Agency Settings → Vault`

### 3.2 n8n (workflow import / activate)

Gerekli:
- n8n UI’dan API key üret → `N8N_API_KEY`

Nereye girilir:
- UI → `Setup Wizard` veya `Agency Settings → Vault`

### 3.3 Apify (Market Radar: gerçek trend/lead)

Gerekli:
- `APIFY_API_TOKEN`

Opsiyonel ama önerilen:
- `APIFY_YOUTUBE_TRENDS_ACTOR` (YouTube trend çekmek için)
- `APIFY_GOOGLE_MAPS_LEADS_ACTOR` (Google Maps lead çekmek için)

Not: Actor ID formatı `https://apify.com/<user>/<actor>` veya `<user>~<actor>` olabilir.

Nereye girilir:
- UI → `Setup Wizard` veya `Agency Settings → Vault`

### 3.4 SuiteCRM (CRM — self-host)

SuiteCRM **ücretli üyelik istemez**, ama **normal bir kullanıcı girişi** vardır (CRM olduğu için).

Gerekli:
- `SUITECRM_BASE_URL` (varsayılan: `http://localhost:8091`)
- `SUITECRM_USERNAME`
- `SUITECRM_PASSWORD`

Default (docker compose ile):
- kullanıcı: `admin`
- şifre: `admin`

Nereye girilir:
- UI → `Setup Wizard` veya `Agency Settings → Vault`

### 3.5 InvoiceShelf (Invoice/Estimate — self-host)

InvoiceShelf ilk kurulumda UI’da admin kullanıcı oluşturmanı ister (bu “üyelik” değil, kendi sistemindeki kullanıcı).

Gerekli:
- `INVOICESHELF_BASE_URL` (varsayılan: `http://localhost:8090`)
- `INVOICESHELF_TOKEN` (AgencyOS bunu UI’daki “Login + Save Token” ile alır)

Nereye girilir:
- UI → `Setup Wizard → InvoiceShelf → Login + Save Token`

### 3.6 Documenso (E‑sign — self-host)

Documenso da kullanıcı girişi ister (e‑imza platformu).

Gerekli:
- `DOCUMENSO_BASE_URL` (varsayılan: `http://localhost:8092`)
- `DOCUMENSO_API_TOKEN` (Documenso UI’dan API token üret)

Self-host için ayrıca:
- Signing cert: `DOCUMENSO_CERT_PATH` (varsayılan: `data/certs/documenso/cert.p12`)
- Passphrase: `DOCUMENSO_SIGNING_PASSPHRASE` (dev için `change-me` yeter)

Nereye girilir:
- UI → `Setup Wizard` veya `Agency Settings → Vault`

### 3.7 Infisical (Secrets vault — self-host)

Infisical ilk kurulumda org/workspace kurmanı ister.

Gerekli:
- `INFISICAL_BASE_URL` (varsayılan: `http://localhost:8081`)
- `INFISICAL_TOKEN` (Infisical UI’dan service token)

AgencyOS runtime settings (Vault sync için):
- `INFISICAL_WORKSPACE_ID`
- `INFISICAL_SECRET_PATH` (örn: `/clients`)
- `INFISICAL_ENV_*_SLUG` (dev/staging/prod)

Nereye girilir:
- Token: `Setup Wizard` veya `Agency Settings → Vault`
- Workspace/Path: `Setup Wizard` veya `Agency Settings → Infrastructure → Runtime Settings`

## 4) Hızlı kontrol (çalışıyor mu?)

- UI → `Setup Wizard → Integration Status`:
  - SuiteCRM: “Connected”
  - InvoiceShelf: token yoksa “Needs Config”
  - Documenso: token yoksa “Needs Config”
  - Infisical: token/workspace yoksa “Needs Config”
  - Apify: token/actor eksikse “Needs Config”
- Postgres (AgencyOS): `AGENCYOS_DATABASE_URL` set edilince “Connected”
- UI → `Revenue Journey → Market Radar`:
  - Leads: Apify varsa gerçek lead, yoksa sample
  - YouTube: Apify actor varsa gerçek trend, yoksa sample

Mailhog (Documenso local SMTP):
- UI: `http://localhost:8025`

## 5) Sık sorunlar

- **7000 portu dolu:** `npm run dev:up` otomatik `7001`’e geçer.
- **Documenso container başlamıyor:** `npm run documenso:cert` çalıştırıp tekrar `npm run infra:up documenso`.
- **Apify “Connected” ama veri sample geliyor:** Actor ID’leri eksik olabilir (`APIFY_*_ACTOR`).
