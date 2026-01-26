# AgencyOS - Basit Mod Dokümantasyonu

## Genel Bakış

AgencyOS artık **Basit Mod** ve **Gelişmiş Mod** olmak üzere iki farklı kullanıcı deneyimi sunuyor:

- **Basit Mod**: Teknik bilgisi olmayan ajans sahipleri için "butona bas, çalışsın" basitliği
- **Gelişmiş Mod**: Teknik kullanıcılar için tüm özelliklere erişim

## Basit Mod Özellikleri

### 📱 Sadeleştirilmiş Navigasyon (5 Öğe)
- 🏠 **Ana Sayfa** - Hızlı genel bakış ve metrikler
- 🤖 **AI Koç** - Yapay zeka asistanı
- 📁 **Projeler** - Proje yönetimi
- 💰 **Gelir** - Gelir hesaplayıcı ve "Ya" senaryoları
- ⚡ **Kurulum** - 2 adımlık basit kurulum

### 🎯 Yeni Kullanıcı Yolculuğu

**Eski:** 10-15 dakika, 15-20 tık, 7 entegrasyon
**Yeni:** 2 dakika, 5 tık, sadece 2 temel ayar

#### Adım 1: Hızlı Kurulum (60 saniye)
1. Dil seçin (🇹🇷 Türkçe / 🇺🇸 English)
2. Arayüz modu seçin (✨ Basit / 🚀 Gelişmiş)

#### Adım 2: AI Anahtarı (Opsiyonel)
- Gemini API anahtarı ekleyin (veya demo için atla)
- Otomatik demo proje yüklenir

#### Sonuç
- İlk değere ulaşma: < 2 dakika
- Anında kullanıma hazır demo proje
- AI önerileriyle workflow'lar

## Yeni Bileşenler

### 🏠 Home.tsx
**Amaç:** Ana dashboard - karmaşık Revenue Journey'nin yerine

**Özellikler:**
- 3 ana metrik: Potansiyel | Aktif | Faturalanan
- AI destekli "Sonraki Adım" önerisi
- Hızlı aksiyonlar: Yeni Proje, AI Koça Sor
- Son 5 proje listesi
- Boş durum rehberliği

**Konum:** `components/Home.tsx` (200 satır)

### 💰 Money.tsx
**Amaç:** Gelir planlaması ve hesaplama

**Özellikler:**
- Gelir hesaplayıcı (MRR hedefi, ortalama fiyat, dönüşüm oranları)
- "Ya" senaryoları: Tek tıkla 5K₺, 10K₺, 20K₺ hedeflerine nasıl ulaşılır
- Görsel sonuç gösterimi (kaç müşteri, kaç teklif, kaç lead gerekli)

**Konum:** `components/Money.tsx` (246 satır)

### 📁 DashboardSimple.tsx
**Amaç:** Basit proje listesi

**Özellikler:**
- 4 KPI kartı (Toplam, Aktif, Gelir, Workflow)
- Filtreler (Tümü | Aktif | Canlı)
- Lead listesi
- Proje kartları (durum, gelir, workflow sayısı)

**Konum:** `components/DashboardSimple.tsx` (280 satır)

### 🏛️ CouncilRoomSimple.tsx
**Amaç:** AI Konsey kararları - karmaşıklığı gizli

**Özellikler:**
- 4 karar tipi seçimi (Strateji, Risk, Yayın, Analiz)
- Özel soru girişi
- Basit sonuç gösterimi (karmaşık board yerine özet)
- Fiyatlandırma bilgisi (varsa)
- Onaylanmış kararlar için "Fatura Oluştur" butonu

**Konum:** `components/CouncilRoomSimple.tsx` (337 satır)

### ⚡ SetupWizardSimple.tsx
**Amaç:** 2 adımlık basit kurulum

**Eski:** 945 satır, 5 adım, 7 entegrasyon
**Yeni:** 340 satır, 2 adım, 2 temel ayar

**Adımlar:**
1. Dil + UI modu seçimi
2. Gemini API anahtarı (opsiyonel)

**Konum:** `components/SetupWizardSimple.tsx` (340 satır)

## 🤖 Yeni AI Özellikleri

### Multimodal Intake (Görsel/Video Analizi)
**Nedir:** Müşteriler logo, web sitesi ekran görüntüsü veya video yükleyebilir, AI otomatik analiz eder

**Özellikler:**
- Marka renkleri çıkarma (hex kodları)
- Görsel stil analizi (modern, minimalist, kurumsal vb.)
- Sektör tespiti
- Video transkript oluşturma
- Otomatik form doldurma

**Teknik:** Gemini 2.0 Flash multimodal API
**Konum:** `server/lib/geminiVision.ts` (188 satır)

**Kullanım:**
```typescript
// IntakeWizard'da dosya yükleme
<input type="file" accept="image/*,video/*" multiple />

// Otomatik analiz
POST /api/intake/analyze-visual
{
  file: base64Data,
  mimeType: "image/png"
}

// Sonuç
{
  brandColors: ["#FF5733", "#3498DB"],
  visualStyle: "Modern ve minimalist",
  industry: "E-ticaret",
  requirements: ["Online satış", "Ödeme entegrasyonu"],
  confidence: 0.85
}
```

### Otomatik Workflow Önerileri
**Nedir:** AI proje özetini analiz eder, en uygun 3 workflow'u otomatik bulur ve önerir

**Nasıl Çalışır:**
1. Proje özetinden anahtar kelimeler çıkar
2. Workflow kataloğunda AI araması yapar
3. Uygunluk skoru hesaplar (0-1)
4. En iyi 3'ü neden/gerekçeleriyle gösterir
5. Tek tıkla kurulum

**Teknik:** `services/autoWorkflow.ts` (239 satır)

**Özellikler:**
- Sektör eşleştirme
- Araç/teknoloji eşleştirme
- Hedef eşleştirme
- Karmaşıklık tercihi (basit öncelikli)
- Güven skoru (>60% = tek tıkla kur)

**Kullanım:**
```typescript
import { suggestWorkflows } from './services/autoWorkflow';

// Proje oluşturulduktan sonra
const suggestions = await suggestWorkflows(project);

// Göster
<WorkflowSuggestionCard
  suggestions={suggestions}
  onInstall={(id) => installWorkflow(id)}
  onInstallAll={() => installAll(suggestions)}
/>
```

## Tasarım Sistemi

### Tutarlı Tasarım Dili
Tüm basit mod bileşenleri aynı tasarım kurallarını takip eder:

**Renkler:**
- Arkaplan: `bg-gray-800/50` + `border-gray-700`
- CTA Butonları: `bg-blue-600 hover:bg-blue-700`
- İkincil Butonlar: `bg-gray-700 hover:bg-gray-600`
- Başarı: `bg-green-600`, `text-green-400`
- Uyarı: `bg-yellow-900/20`, `text-yellow-300`

**Şekiller:**
- Tüm kartlar: `rounded-lg`
- Butonlar: `rounded-lg` veya `rounded-full` (durum göstergeleri için)

**Boşluklar:**
- Bölümler arası: `space-y-8`
- Alt bölümler: `space-y-4`
- Kart padding: `p-6` veya `p-8`

**İkonlar:**
- Büyük başlıklar: `text-6xl`
- Bölüm başlıkları: `text-3xl` veya `text-4xl`
- Küçük işaretler: `text-2xl`

**Metrik Kartları:**
```tsx
<div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center space-y-2">
  <div className="text-4xl">📋</div>
  <div className="text-3xl font-bold text-blue-400">{value}</div>
  <div className="text-sm text-gray-400">{label}</div>
</div>
```

## Kod Organizasyonu

### Yeni Dosya Yapısı
```
components/
├── Home.tsx                    (200 satır) - Basit ana sayfa
├── Money.tsx                   (246 satır) - Gelir hesaplayıcı
├── DashboardSimple.tsx         (280 satır) - Basit proje listesi
├── CouncilRoomSimple.tsx       (337 satır) - Basit AI konsey
├── SetupWizardSimple.tsx       (340 satır) - 2 adım kurulum
├── WorkflowSuggestionCard.tsx  (180 satır) - AI workflow önerileri
└── ... (mevcut bileşenler)

services/
├── autoWorkflow.ts             (239 satır) - AI workflow önerisi
├── onboarding.ts               (mevcut) - UI mode yönetimi
└── ... (mevcut servisler)

server/lib/
├── geminiVision.ts             (188 satır) - Multimodal analiz
└── ... (mevcut lib'ler)
```

### App.tsx Değişiklikleri

**Landing'den giriş:**
```typescript
const onboarding = readOnboardingState();
setUiMode(onboarding.uiMode);

if (!onboarding.setupCompleted) {
  setCurrentView(View.SETUP);
} else {
  // Basit modda HOME, gelişmiş modda JOURNEY
  setCurrentView(onboarding.uiMode === 'simple' ? View.HOME : View.JOURNEY);
}
```

**Setup bileşeni seçimi:**
```typescript
{currentView === View.SETUP && (
  uiMode === 'simple' ? (
    <SetupWizardSimple ... />
  ) : (
    <SetupWizard ... />
  )
)}
```

**Breadcrumb navigasyonu:**
```typescript
// Basit modda HOME'a dön, gelişmiş modda JOURNEY'e dön
setCurrentView(uiMode === 'simple' ? View.HOME : View.JOURNEY);
```

## Gelişmiş Özellikleri Gizleme

### Basit Modda Gizlenen Özellikler
- ❌ Revenue Journey (1,406 satır karmaşık dashboard)
- ❌ Workflow Catalog (manuel arama)
- ❌ Board Studio (karmaşık konsey görünümü)
- ❌ Documents sayfası
- ❌ Gelişmiş ayarlar
- ❌ 6 entegrasyon durumu (SuiteCRM, InvoiceShelf, Documenso, Infisical, Apify, Postgres)
- ❌ Teknik jargon ve metrikler
- ❌ n8n durum başlığı

### Basit Modda Görünen Özellikler
- ✅ HOME - Ana sayfa (metrikler + hızlı aksiyonlar)
- ✅ ASSISTANT - AI Koç
- ✅ PROJECTS - Basit proje listesi
- ✅ MONEY - Gelir hesaplayıcı
- ✅ SETUP - 2 adım kurulum
- ✅ Gemini API (tek entegrasyon)
- ✅ AI CEO durum başlığı

### İleride: Kademeli Açılım (Progressive Disclosure)
Planlandı ancak henüz uygulanmadı:

```typescript
// Kullanıcı ilerledikçe özellikler açılır
function calculateProgressLevel(user) {
  if (user.completedTasks >= 10 && user.projects >= 5 && user.revenue >= 5000) {
    return 'advanced';  // Tüm 11 nav öğesi
  }
  if (user.completedTasks >= 5 && user.projects >= 2) {
    return 'intermediate';  // 7 nav öğesi
  }
  return 'beginner';  // Sadece 5 nav öğesi
}
```

## API Endpoints

### Yeni Endpoint: Görsel Analiz
```
POST /api/intake/analyze-visual
Content-Type: application/json

{
  "file": "base64_encoded_data",
  "mimeType": "image/png"
}

Response:
{
  "brandColors": ["#FF5733"],
  "visualStyle": "Modern",
  "industry": "E-ticaret",
  "requirements": ["Online satış"],
  "confidence": 0.85
}
```

## Test Senaryoları

### 1. İlk Kullanıcı Yolculuğu (Basit Mod)
1. Landing sayfası → "Ajansımı Başlat"
2. Setup Adım 1: Dil seç (TR), Mod seç (Basit)
3. Setup Adım 2: API key atla
4. HOME sayfası açılır, demo proje gösterilir
5. "Yeni Proje" tıkla
6. Intake wizard'da logo yükle → Otomatik analiz
7. Proje oluştur
8. AI workflow önerileri gösterilir → "Tümünü Kur"
9. HOME'a dön → Metrikler güncellendi

**Süre:** < 2 dakika
**Tık sayısı:** 5-7

### 2. Gelir Planlaması
1. HOME → MONEY butonu
2. Hedef MRR gir (örn: 10,000₺)
3. Hesapla → Sonuçları gör
4. "Ya 10K₺'ye ulaşırsam?" → Senaryo gör
5. Plan gösterilir: X müşteri × Y₺

### 3. AI Konsey Kararı
1. PROJECTS → Proje seç
2. "AI Ekibine Sor" butonu
3. CouncilRoomSimple açılır
4. Gate seç (Strateji)
5. "AI Ekibine Danış"
6. Basit karar gösterilir (özet + fiyat)
7. "Fatura Oluştur" (eğer onaylandıysa)

### 4. Multimodal Intake
1. Yeni Proje → Intake
2. Dosya yükle butonu → Logo seç
3. AI analiz eder → Marka renkleri çıkarır
4. Form otomatik doldurulur
5. Video yükle → Transkript oluşur
6. Proje oluştur

## Performans Metrikleri

### Build
- ✅ Başarılı: 865ms
- ⚠️ Bundle size: 664.67 KB (optimizasyon önerilir)
- ✅ 0 TypeScript hatası
- ✅ 56 modül

### Hedef Metrikler
- İlk değere ulaşma: < 2 dakika ✅
- İlk projeye kadar tık: < 5 ✅
- Kurulum adımları: 2-3 ✅
- Gerekli env var: 0-1 (Gemini API opsiyonel) ✅
- Navigasyon öğeleri: 5 (basit mod) ✅

## Başarı Kriterleri: "Yeterince Basit mi?"

### Testler
1. ✅ **Anne Testi:** Teknik olmayan biri kurulumu tamamlayabilir mi?
   - EVET - 2 adım, görsel rehberlik, demo modu

2. ✅ **5 Yaşında Testi:** UI'ı 5 yaşındaki çocuğa açıklayabilir misin?
   - "Butona bas, AI para kazanmana yardım eder"

3. ✅ **Hayal Kırıklığı Testi:** Kullanıcı "Ne yapacağımı bilmiyorum" der mi?
   - HAYIR - "Sonraki Adım" her zaman gösteriliyor

4. ✅ **Jargon Testi:** Kullanıcı kafa karıştırıcı teknik terimler görür mü?
   - HAYIR - Basit modda sıfır jargon

5. ✅ **Başarı Testi:** Kullanıcı dökümansız ilk gelir döngüsünü tamamlayabilir mi?
   - EVET - Demo + AI önerileri + hızlı aksiyonlar

## Gelecek Geliştirmeler

### Hafta 4 (Henüz Uygulanmadı)
- [ ] Kademeli açılım sistemi (progressive disclosure)
- [ ] Gelişmiş ayarlar sayfası (6 entegrasyonun tam kontrolü)
- [ ] "Yeni Özellik Açıldı" modalları
- [ ] Kullanıcı ilerleme takibi

### Optimizasyonlar
- [ ] Code splitting (bundle size küçültme)
- [ ] Lazy loading (bileşenler ihtiyaç duyuldukça yüklensin)
- [ ] Cache stratejisi (API sonuçları)
- [ ] Service Worker (offline destek)

## Önemli Notlar

### UI Mode Değiştirme
Kullanıcılar UI mode'u Sidebar üzerinden değiştirebilir:
- Basit → Gelişmiş: Tüm özellikler açılır
- Gelişmiş → Basit: Sadeleştirilmiş görünüm

### Veri Uyumluluğu
- ✅ Tüm veriler her iki modda da aynı
- ✅ Mod değiştirirken veri kaybı yok
- ✅ Projeler, workflow'lar, kararlar paylaşılıyor

### Geriye Uyumluluk
- ✅ Eski bileşenler hala mevcut (gelişmiş mod için)
- ✅ API değişmedi, sadece yeni endpoint eklendi
- ✅ Tüm mevcut özellikler gelişmiş modda çalışıyor

## Sorun Giderme

### "AI önerileri çalışmıyor"
- Gemini API anahtarı doğru mu?
- `server/.env` dosyasında `GEMINI_API_KEY` var mı?
- Backend çalışıyor mu? (`npm run server`)

### "Görsel analiz çalışmıyor"
- Dosya boyutu < 20MB mi?
- Format destekleniyor mu? (PNG, JPG, MP4, WEBM)
- Gemini 2.0 Flash API erişimi var mı?

### "Kurulum tamamlanamıyor"
- Browser console'da hata var mı?
- `data/` klasörü yazılabilir mi?
- Port 7000/7001 kullanılabilir mi?

## Katkı Sağlama

Bu basitleştirme çalışması 4 haftalık bir plandır. Şu an **Hafta 3 tamamlandı**.

### Yapılan İşler
- ✅ Hafta 1: Backend refactoring, basit kurulum, basit navigasyon, ana sayfa
- ✅ Hafta 2: Multimodal intake, otomatik workflow önerileri
- ✅ Hafta 3: Gelir sayfası, basit projeler, basit AI konsey

### Kalan İşler
- ⏳ Hafta 4: Kademeli açılım, entegrasyonları gizleme, son parlatma

---

**Oluşturulma:** 2025-12-31
**Versiyon:** 1.0
**Durum:** Aktif geliştirme
