# AgencyOS “Money OS” — Eğer ben AI ile para kazanmak isteseydim

Bu doküman, AgencyOS’u “para kazanma makinesi” gibi tasarlamak için **zihinsel modeli + UI akışı + veri/entegrasyon parçalarını** netleştirir.

Amaç: Hiç teknik bilmeyen biri bile, **tek ekrandan** (AI ile konuşarak) “hedef → teklif → lead → satış → teslimat → fatura → rapor → retainer” döngüsünü yönetebilsin.

---

## 1) 1 cümle: Money OS nedir?

**Money OS = hedefi seçtirir → teklif paketler → lead bulur → outreach yaptırır → görüşme/teklif kapısını Council ile güvenceye alır → teslimatı n8n ile otomatikleştirir → fatura/sözleşme döngüsünü işletir → rapor ile retainer’a bağlar.**

Bu yüzden sistem 5 ana “motor”dan oluşur:

1) **Acquisition OS (Lead + Outreach)**
2) **Offer OS (Paket + fiyat + ROI)**
3) **Delivery OS (n8n workflow + test + activate)**
4) **Retention OS (haftalık rapor + SLA + upsell)**
5) **Product OS (pasif gelir: template/starter pack)**

---

## 2) v0.1’de (bugün) sistemin çalışması gereken minimum

### 2.1 Revenue Goal (Hedef sayıları)
Kullanıcı “kaç para kazanmak istiyorum?”u netleştirir:

- Para birimi: USD/TRY/EUR/GBP
- Hedef MRR
- Ortalama retainer
- Close rate (%)
- Booking rate (%)

Sistem otomatik “funnel matematiği” çıkarır:
- kaç müşteri → kaç görüşme → kaç lead
- haftalık/günlük lead kotası

### 2.2 Market Radar (Fırsat → Lead)
Kullanıcı:
- ülke/şehir seçer
- niş (query) yazar
- “sellable opportunities” üretir (AI/mock)
- Google Maps/Apify ile lead listesi çıkarır (yoksa mock)
- her lead için pitch üretir

### 2.3 Outbound Pipeline (CRM-lite)
SuiteCRM yoksa bile AgencyOS içinde:
- lead’i “pipeline”a kaydeder
- stage yönetir: New → Contacted → Replied → Booked → Proposal → Won/Lost
- follow-up tarihi koyar

### 2.4 Project’e dönüştürme
Pipeline’dan “Project” açınca:
- intake/brief → öneri → deploy akışı başlar
- Council Gate (pricing + risk) çalıştırılır

### 2.5 Delivery
Katalogdan workflow bul → stage/import → test → activate → monitoring.

### 2.6 Sales loop (opsiyonel entegrasyonlar)
Kuruluysa:
- SuiteCRM lead sync
- Documenso sözleşme
- InvoiceShelf invoice

---

## 3) UI tasarım prensipleri (para odaklı)

1) **Tek hedef / tek sonraki adım**: Her ekranda “NEXT ACTION” net.
2) **Günlük checklist**: “Bugün 3 iş yap: lead kaydet + outreach + follow-up”.
3) **Gelir görünürlüğü**: “Pipeline potansiyeli / aktif retainer / billed” her yerde görünür.
4) **AI her yerde**: her modülde “AI’ye Sor” ile kullanıcı hiç bilmeden ilerleyebilir.
5) **Basit/Gelişmiş mod**: yeni kullanıcı basitte kalsın, ops/entegrasyonlar gelişmişte açılsın.

---

## 4) “Ben olsaydım” ideal kullanıcı yolculuğu (0 → ilk satış)

### Adım 0 — Setup (5 dk)
- Dil + hedef ajans tipi
- AI key (Gemini/OpenRouter) + n8n key (varsa)

### Adım 1 — Hedef (1 dk)
- MRR hedefi + retainer + oranlar
- Sistem “Günlük lead kotası” verir

### Adım 2 — Niş (3 dk)
- ülke/şehir + niş
- Market Radar “3 teklif” üretir (pricing + workflow keyword)

### Adım 3 — Lead (5–10 dk)
- lead bul (15–30)
- en iyi 10 lead’i pipeline’a kaydet
- pitch üret + kopyala

### Adım 4 — Görüşme / Teklif (Council Gate)
- 1 lead olumlu → “Project” aç
- Council: fiyat + risk (tek model kararı engellenir)
- Teklif/SOW üret

### Adım 5 — Teslimat (n8n)
- katalogdan doğru starter pack’i seç
- stage/import/test/activate
- monitoring

### Adım 6 — Sözleşme/Fatura
- Documenso → imza
- InvoiceShelf → fatura

### Adım 7 — Retainer’a bağla
- haftalık rapor otomasyonu (Sheets/Slack/Email)
- SLA + bakım paketi → retainer

---

## 5) v1’e giderken (Money OS’u gerçek “otomatik satış makinesi” yapmak)

### 5.1 Outreach otomasyonu (n8n)
- pipeline’daki lead’lere otomatik email/DM sequence
- follow-up takvimi + reply detection

### 5.2 Pipeline → CRM senkron
- AgencyOS pipeline, SuiteCRM ile çift yönlü sync

### 5.3 Offer Builder
- tek sayfa “offer one-pager” (ROI + paket + fiyat + garanti)
- Council Gate ile “price pressure test”

### 5.4 Retention OS
- weekly KPI report
- incident + MTTR dashboard
- churn risk scoring

### 5.5 Product OS
- template/starter-pack marketi
- ödeme sonrası otomatik teslim + upsell

---

## 6) “Basit ama etkili” MVP kriterleri

Kullanıcı 1 oturumda şunu yapabilmeli:
- 1 hedef gir → günlük kota gör
- 1 niş seç → 1 teklif + fiyat gör
- 10 lead bul → pipeline’a kaydet
- 1 pitch üret → outreach at
- 1 lead’i project’e çevir → Council pricing/risk
- 1 workflow stage/import → checklist gör

