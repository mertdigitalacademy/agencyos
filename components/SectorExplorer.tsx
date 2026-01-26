import { useState } from 'react';
import { useI18n } from '../services/i18n';
import type { AgencyBuilderSector, AgencyBuilderNiche, LocalizedString, CurrencyCode } from '../types';

// Helper to get localized string
function getLocalized(str: LocalizedString, lang: string): string {
  return (str as Record<string, string>)[lang] || str.en;
}

// 12 Main Sectors with sub-niches
const SECTORS: AgencyBuilderSector[] = [
  {
    id: 'ecom',
    icon: '🛒',
    name: { en: 'E-commerce', tr: 'E-ticaret' },
    description: { en: 'Online stores, marketplaces, dropshipping', tr: 'Online mağazalar, pazaryerleri, dropshipping' },
    marketSize: 'large',
    competitionLevel: 'high',
    avgProjectValue: { min: 500, max: 3000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'ecom-shopify', sectorId: 'ecom', name: { en: 'Shopify Automation', tr: 'Shopify Otomasyonu' }, description: { en: 'Automate Shopify stores with AI', tr: 'AI ile Shopify mağazalarını otomatikleştirin' }, keywords: ['shopify', 'ecommerce', 'store'], requiredWorkflowTags: ['shopify', 'ecommerce'], avgProjectValue: { min: 800, max: 2500, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'Shopify store owners', tr: 'Shopify mağaza sahipleri' }, painPoints: [{ en: 'Manual order processing', tr: 'Manuel sipariş işleme' }, { en: 'Inventory management', tr: 'Stok yönetimi' }] },
      { id: 'ecom-amazon', sectorId: 'ecom', name: { en: 'Amazon Seller Tools', tr: 'Amazon Satıcı Araçları' }, description: { en: 'Amazon FBA and seller automation', tr: 'Amazon FBA ve satıcı otomasyonu' }, keywords: ['amazon', 'fba', 'seller'], requiredWorkflowTags: ['amazon', 'ecommerce'], avgProjectValue: { min: 1000, max: 4000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'high', idealCustomer: { en: 'Amazon FBA sellers', tr: 'Amazon FBA satıcıları' }, painPoints: [{ en: 'Price monitoring', tr: 'Fiyat takibi' }, { en: 'Review management', tr: 'Yorum yönetimi' }] },
      { id: 'ecom-dropship', sectorId: 'ecom', name: { en: 'Dropshipping Automation', tr: 'Dropshipping Otomasyonu' }, description: { en: 'Automate dropshipping operations', tr: 'Dropshipping operasyonlarını otomatikleştirin' }, keywords: ['dropshipping', 'aliexpress', 'oberlo'], requiredWorkflowTags: ['dropshipping', 'ecommerce'], avgProjectValue: { min: 500, max: 1500, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'medium', idealCustomer: { en: 'Dropshippers', tr: 'Dropshipper\'lar' }, painPoints: [{ en: 'Supplier sync', tr: 'Tedarikçi senkronizasyonu' }, { en: 'Order tracking', tr: 'Sipariş takibi' }] },
    ]
  },
  {
    id: 'marketing',
    icon: '📣',
    name: { en: 'Marketing', tr: 'Pazarlama' },
    description: { en: 'Digital marketing, ads, campaigns', tr: 'Dijital pazarlama, reklamlar, kampanyalar' },
    marketSize: 'large',
    competitionLevel: 'high',
    avgProjectValue: { min: 800, max: 5000, currency: 'USD' },
    growthTrend: 'booming',
    subNiches: [
      { id: 'mkt-social', sectorId: 'marketing', name: { en: 'Social Media Marketing', tr: 'Sosyal Medya Pazarlama' }, description: { en: 'Instagram, TikTok, Facebook automation', tr: 'Instagram, TikTok, Facebook otomasyonu' }, keywords: ['social', 'instagram', 'tiktok', 'facebook'], requiredWorkflowTags: ['social-media', 'marketing'], avgProjectValue: { min: 600, max: 2000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'high', idealCustomer: { en: 'Brands & influencers', tr: 'Markalar ve influencer\'lar' }, painPoints: [{ en: 'Content scheduling', tr: 'İçerik planlama' }, { en: 'Analytics tracking', tr: 'Analitik takibi' }] },
      { id: 'mkt-email', sectorId: 'marketing', name: { en: 'Email Marketing', tr: 'E-posta Pazarlama' }, description: { en: 'Email campaigns and automation', tr: 'E-posta kampanyaları ve otomasyon' }, keywords: ['email', 'newsletter', 'mailchimp'], requiredWorkflowTags: ['email', 'marketing'], avgProjectValue: { min: 500, max: 1500, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'medium', idealCustomer: { en: 'SaaS & e-commerce', tr: 'SaaS ve e-ticaret' }, painPoints: [{ en: 'List management', tr: 'Liste yönetimi' }, { en: 'Personalization', tr: 'Kişiselleştirme' }] },
      { id: 'mkt-seo', sectorId: 'marketing', name: { en: 'SEO Automation', tr: 'SEO Otomasyonu' }, description: { en: 'Search engine optimization tools', tr: 'Arama motoru optimizasyon araçları' }, keywords: ['seo', 'google', 'ranking'], requiredWorkflowTags: ['seo', 'marketing'], avgProjectValue: { min: 1000, max: 4000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'high', idealCustomer: { en: 'Agencies & businesses', tr: 'Ajanslar ve işletmeler' }, painPoints: [{ en: 'Keyword tracking', tr: 'Anahtar kelime takibi' }, { en: 'Backlink analysis', tr: 'Backlink analizi' }] },
    ]
  },
  {
    id: 'finance',
    icon: '💰',
    name: { en: 'Finance', tr: 'Finans' },
    description: { en: 'Accounting, invoicing, financial reporting', tr: 'Muhasebe, faturalama, finansal raporlama' },
    marketSize: 'large',
    competitionLevel: 'medium',
    avgProjectValue: { min: 1000, max: 5000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'fin-accounting', sectorId: 'finance', name: { en: 'Accounting Automation', tr: 'Muhasebe Otomasyonu' }, description: { en: 'Bookkeeping and accounting workflows', tr: 'Defter tutma ve muhasebe iş akışları' }, keywords: ['accounting', 'bookkeeping', 'quickbooks'], requiredWorkflowTags: ['accounting', 'finance'], avgProjectValue: { min: 1200, max: 4000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'SMBs & accountants', tr: 'KOBİ\'ler ve muhasebeciler' }, painPoints: [{ en: 'Manual data entry', tr: 'Manuel veri girişi' }, { en: 'Reconciliation', tr: 'Mutabakat' }] },
      { id: 'fin-invoicing', sectorId: 'finance', name: { en: 'Invoicing & Billing', tr: 'Faturalama' }, description: { en: 'Automated invoicing systems', tr: 'Otomatik faturalama sistemleri' }, keywords: ['invoice', 'billing', 'payments'], requiredWorkflowTags: ['invoicing', 'finance'], avgProjectValue: { min: 800, max: 2500, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Freelancers & agencies', tr: 'Serbest çalışanlar ve ajanslar' }, painPoints: [{ en: 'Late payments', tr: 'Geç ödemeler' }, { en: 'Invoice tracking', tr: 'Fatura takibi' }] },
    ]
  },
  {
    id: 'realestate',
    icon: '🏠',
    name: { en: 'Real Estate', tr: 'Emlak' },
    description: { en: 'Property listings, lead generation, CRM', tr: 'Emlak ilanları, potansiyel müşteri, CRM' },
    marketSize: 'large',
    competitionLevel: 'medium',
    avgProjectValue: { min: 800, max: 4000, currency: 'USD' },
    growthTrend: 'stable',
    subNiches: [
      { id: 're-agents', sectorId: 'realestate', name: { en: 'Agent Tools', tr: 'Emlakçı Araçları' }, description: { en: 'Tools for real estate agents', tr: 'Emlakçılar için araçlar' }, keywords: ['realtor', 'agent', 'listings'], requiredWorkflowTags: ['real-estate', 'crm'], avgProjectValue: { min: 800, max: 3000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'Real estate agents', tr: 'Emlakçılar' }, painPoints: [{ en: 'Lead follow-up', tr: 'Potansiyel müşteri takibi' }, { en: 'Listing management', tr: 'İlan yönetimi' }] },
      { id: 're-proptech', sectorId: 'realestate', name: { en: 'PropTech Solutions', tr: 'PropTech Çözümleri' }, description: { en: 'Property technology automation', tr: 'Emlak teknolojisi otomasyonu' }, keywords: ['proptech', 'property', 'rental'], requiredWorkflowTags: ['real-estate', 'automation'], avgProjectValue: { min: 1500, max: 5000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Property managers', tr: 'Mülk yöneticileri' }, painPoints: [{ en: 'Tenant communication', tr: 'Kiracı iletişimi' }, { en: 'Maintenance tracking', tr: 'Bakım takibi' }] },
    ]
  },
  {
    id: 'saas',
    icon: '☁️',
    name: { en: 'SaaS', tr: 'SaaS' },
    description: { en: 'Software companies, product-led growth', tr: 'Yazılım şirketleri, ürün odaklı büyüme' },
    marketSize: 'large',
    competitionLevel: 'high',
    avgProjectValue: { min: 1500, max: 8000, currency: 'USD' },
    growthTrend: 'booming',
    subNiches: [
      { id: 'saas-onboarding', sectorId: 'saas', name: { en: 'User Onboarding', tr: 'Kullanıcı Onboarding' }, description: { en: 'Automated user onboarding flows', tr: 'Otomatik kullanıcı onboarding akışları' }, keywords: ['onboarding', 'activation', 'retention'], requiredWorkflowTags: ['saas', 'onboarding'], avgProjectValue: { min: 2000, max: 6000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'SaaS startups', tr: 'SaaS girişimleri' }, painPoints: [{ en: 'User activation', tr: 'Kullanıcı aktivasyonu' }, { en: 'Churn prevention', tr: 'Churn önleme' }] },
      { id: 'saas-support', sectorId: 'saas', name: { en: 'Customer Success', tr: 'Müşteri Başarısı' }, description: { en: 'CS automation and health scoring', tr: 'CS otomasyonu ve sağlık skorlaması' }, keywords: ['customer-success', 'health-score', 'cs'], requiredWorkflowTags: ['saas', 'customer-success'], avgProjectValue: { min: 2500, max: 8000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'medium', idealCustomer: { en: 'B2B SaaS', tr: 'B2B SaaS' }, painPoints: [{ en: 'Churn prediction', tr: 'Churn tahmini' }, { en: 'Account health', tr: 'Hesap sağlığı' }] },
    ]
  },
  {
    id: 'support',
    icon: '🎧',
    name: { en: 'Customer Support', tr: 'Müşteri Desteği' },
    description: { en: 'Help desk, chatbots, ticket automation', tr: 'Yardım masası, chatbot\'lar, bilet otomasyonu' },
    marketSize: 'large',
    competitionLevel: 'medium',
    avgProjectValue: { min: 600, max: 3000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'sup-chatbot', sectorId: 'support', name: { en: 'AI Chatbots', tr: 'AI Chatbot\'lar' }, description: { en: 'Intelligent chatbot solutions', tr: 'Akıllı chatbot çözümleri' }, keywords: ['chatbot', 'ai', 'conversational'], requiredWorkflowTags: ['chatbot', 'support'], avgProjectValue: { min: 1000, max: 4000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'high', idealCustomer: { en: 'E-commerce & SaaS', tr: 'E-ticaret ve SaaS' }, painPoints: [{ en: '24/7 availability', tr: '7/24 erişilebilirlik' }, { en: 'Response time', tr: 'Yanıt süresi' }] },
      { id: 'sup-helpdesk', sectorId: 'support', name: { en: 'Help Desk Automation', tr: 'Yardım Masası Otomasyonu' }, description: { en: 'Ticket routing and automation', tr: 'Bilet yönlendirme ve otomasyon' }, keywords: ['helpdesk', 'zendesk', 'freshdesk'], requiredWorkflowTags: ['helpdesk', 'support'], avgProjectValue: { min: 800, max: 2500, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'medium', idealCustomer: { en: 'Support teams', tr: 'Destek ekipleri' }, painPoints: [{ en: 'Ticket overload', tr: 'Bilet yoğunluğu' }, { en: 'SLA compliance', tr: 'SLA uyumu' }] },
    ]
  },
  {
    id: 'healthcare',
    icon: '🏥',
    name: { en: 'Healthcare', tr: 'Sağlık' },
    description: { en: 'Medical practices, patient management', tr: 'Tıbbi uygulamalar, hasta yönetimi' },
    marketSize: 'large',
    competitionLevel: 'low',
    avgProjectValue: { min: 1500, max: 6000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'health-clinic', sectorId: 'healthcare', name: { en: 'Clinic Management', tr: 'Klinik Yönetimi' }, description: { en: 'Patient scheduling and records', tr: 'Hasta randevu ve kayıtları' }, keywords: ['clinic', 'patient', 'medical'], requiredWorkflowTags: ['healthcare', 'scheduling'], avgProjectValue: { min: 1500, max: 5000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'low', idealCustomer: { en: 'Medical clinics', tr: 'Tıp klinikleri' }, painPoints: [{ en: 'Appointment no-shows', tr: 'Randevu kaçırma' }, { en: 'Patient records', tr: 'Hasta kayıtları' }] },
      { id: 'health-telehealth', sectorId: 'healthcare', name: { en: 'Telehealth Solutions', tr: 'Telesağlık Çözümleri' }, description: { en: 'Remote healthcare automation', tr: 'Uzaktan sağlık otomasyonu' }, keywords: ['telehealth', 'telemedicine', 'remote'], requiredWorkflowTags: ['healthcare', 'telehealth'], avgProjectValue: { min: 2000, max: 7000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Healthcare providers', tr: 'Sağlık sağlayıcıları' }, painPoints: [{ en: 'Virtual consultations', tr: 'Sanal konsültasyonlar' }, { en: 'Follow-up care', tr: 'Takip bakımı' }] },
    ]
  },
  {
    id: 'education',
    icon: '📚',
    name: { en: 'Education', tr: 'Eğitim' },
    description: { en: 'Online courses, LMS, student management', tr: 'Online kurslar, LMS, öğrenci yönetimi' },
    marketSize: 'large',
    competitionLevel: 'medium',
    avgProjectValue: { min: 500, max: 3000, currency: 'USD' },
    growthTrend: 'booming',
    subNiches: [
      { id: 'edu-course', sectorId: 'education', name: { en: 'Course Creators', tr: 'Kurs Oluşturucular' }, description: { en: 'Online course automation', tr: 'Online kurs otomasyonu' }, keywords: ['course', 'udemy', 'teachable'], requiredWorkflowTags: ['education', 'courses'], avgProjectValue: { min: 500, max: 2000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'Course creators', tr: 'Kurs oluşturucular' }, painPoints: [{ en: 'Student engagement', tr: 'Öğrenci katılımı' }, { en: 'Content delivery', tr: 'İçerik dağıtımı' }] },
      { id: 'edu-school', sectorId: 'education', name: { en: 'School Management', tr: 'Okul Yönetimi' }, description: { en: 'School and institution automation', tr: 'Okul ve kurum otomasyonu' }, keywords: ['school', 'lms', 'institution'], requiredWorkflowTags: ['education', 'school'], avgProjectValue: { min: 1500, max: 5000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Schools & universities', tr: 'Okullar ve üniversiteler' }, painPoints: [{ en: 'Administrative tasks', tr: 'İdari işler' }, { en: 'Parent communication', tr: 'Veli iletişimi' }] },
    ]
  },
  {
    id: 'hr',
    icon: '👥',
    name: { en: 'HR & Recruiting', tr: 'İK & İşe Alım' },
    description: { en: 'Hiring, onboarding, employee management', tr: 'İşe alım, onboarding, çalışan yönetimi' },
    marketSize: 'large',
    competitionLevel: 'medium',
    avgProjectValue: { min: 1000, max: 5000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'hr-recruiting', sectorId: 'hr', name: { en: 'Recruiting Automation', tr: 'İşe Alım Otomasyonu' }, description: { en: 'ATS and hiring workflows', tr: 'ATS ve işe alım iş akışları' }, keywords: ['recruiting', 'ats', 'hiring'], requiredWorkflowTags: ['hr', 'recruiting'], avgProjectValue: { min: 1200, max: 4000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'HR teams & recruiters', tr: 'İK ekipleri ve işe alımcılar' }, painPoints: [{ en: 'Resume screening', tr: 'CV tarama' }, { en: 'Interview scheduling', tr: 'Mülakat planlama' }] },
      { id: 'hr-onboard', sectorId: 'hr', name: { en: 'Employee Onboarding', tr: 'Çalışan Onboarding' }, description: { en: 'New hire automation', tr: 'Yeni işe alım otomasyonu' }, keywords: ['onboarding', 'employee', 'hr'], requiredWorkflowTags: ['hr', 'onboarding'], avgProjectValue: { min: 800, max: 3000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Growing companies', tr: 'Büyüyen şirketler' }, painPoints: [{ en: 'Paperwork', tr: 'Evrak işleri' }, { en: 'Training tracking', tr: 'Eğitim takibi' }] },
    ]
  },
  {
    id: 'legal',
    icon: '⚖️',
    name: { en: 'Legal', tr: 'Hukuk' },
    description: { en: 'Law firms, contracts, compliance', tr: 'Hukuk firmaları, sözleşmeler, uyumluluk' },
    marketSize: 'medium',
    competitionLevel: 'low',
    avgProjectValue: { min: 1500, max: 6000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'legal-contracts', sectorId: 'legal', name: { en: 'Contract Automation', tr: 'Sözleşme Otomasyonu' }, description: { en: 'Contract generation and management', tr: 'Sözleşme oluşturma ve yönetimi' }, keywords: ['contracts', 'legal', 'documents'], requiredWorkflowTags: ['legal', 'contracts'], avgProjectValue: { min: 1500, max: 5000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Law firms & legal teams', tr: 'Hukuk firmaları ve hukuk ekipleri' }, painPoints: [{ en: 'Document generation', tr: 'Belge oluşturma' }, { en: 'Version control', tr: 'Versiyon kontrolü' }] },
      { id: 'legal-compliance', sectorId: 'legal', name: { en: 'Compliance Tracking', tr: 'Uyumluluk Takibi' }, description: { en: 'Regulatory compliance automation', tr: 'Düzenleyici uyumluluk otomasyonu' }, keywords: ['compliance', 'gdpr', 'regulatory'], requiredWorkflowTags: ['legal', 'compliance'], avgProjectValue: { min: 2000, max: 7000, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Enterprises', tr: 'Kurumsal şirketler' }, painPoints: [{ en: 'Audit trails', tr: 'Denetim izleri' }, { en: 'Policy updates', tr: 'Politika güncellemeleri' }] },
    ]
  },
  {
    id: 'content',
    icon: '🎬',
    name: { en: 'Content Creation', tr: 'İçerik Üretimi' },
    description: { en: 'Video, podcast, blog, social content', tr: 'Video, podcast, blog, sosyal içerik' },
    marketSize: 'large',
    competitionLevel: 'high',
    avgProjectValue: { min: 500, max: 3000, currency: 'USD' },
    growthTrend: 'booming',
    subNiches: [
      { id: 'content-youtube', sectorId: 'content', name: { en: 'YouTube Automation', tr: 'YouTube Otomasyonu' }, description: { en: 'Video production workflows', tr: 'Video üretim iş akışları' }, keywords: ['youtube', 'video', 'creator'], requiredWorkflowTags: ['youtube', 'content'], avgProjectValue: { min: 600, max: 2500, currency: 'USD' }, marketSize: 'large', competitionLevel: 'high', idealCustomer: { en: 'YouTubers & creators', tr: 'YouTuber\'lar ve içerik üreticileri' }, painPoints: [{ en: 'Editing workflow', tr: 'Düzenleme iş akışı' }, { en: 'Publishing schedule', tr: 'Yayın takvimi' }] },
      { id: 'content-blog', sectorId: 'content', name: { en: 'Blog & SEO Content', tr: 'Blog ve SEO İçeriği' }, description: { en: 'AI-powered content creation', tr: 'AI destekli içerik oluşturma' }, keywords: ['blog', 'content', 'writing'], requiredWorkflowTags: ['content', 'blog'], avgProjectValue: { min: 400, max: 1500, currency: 'USD' }, marketSize: 'large', competitionLevel: 'high', idealCustomer: { en: 'Bloggers & marketers', tr: 'Blog yazarları ve pazarlamacılar' }, painPoints: [{ en: 'Content ideation', tr: 'İçerik fikri' }, { en: 'SEO optimization', tr: 'SEO optimizasyonu' }] },
    ]
  },
  {
    id: 'logistics',
    icon: '📦',
    name: { en: 'Logistics', tr: 'Lojistik' },
    description: { en: 'Shipping, inventory, supply chain', tr: 'Kargo, envanter, tedarik zinciri' },
    marketSize: 'large',
    competitionLevel: 'medium',
    avgProjectValue: { min: 1000, max: 5000, currency: 'USD' },
    growthTrend: 'growing',
    subNiches: [
      { id: 'log-shipping', sectorId: 'logistics', name: { en: 'Shipping Automation', tr: 'Kargo Otomasyonu' }, description: { en: 'Shipping and delivery workflows', tr: 'Kargo ve teslimat iş akışları' }, keywords: ['shipping', 'delivery', 'tracking'], requiredWorkflowTags: ['logistics', 'shipping'], avgProjectValue: { min: 1000, max: 4000, currency: 'USD' }, marketSize: 'large', competitionLevel: 'medium', idealCustomer: { en: 'E-commerce & retailers', tr: 'E-ticaret ve perakendeciler' }, painPoints: [{ en: 'Tracking updates', tr: 'Takip güncellemeleri' }, { en: 'Carrier selection', tr: 'Kargo seçimi' }] },
      { id: 'log-inventory', sectorId: 'logistics', name: { en: 'Inventory Management', tr: 'Envanter Yönetimi' }, description: { en: 'Stock and warehouse automation', tr: 'Stok ve depo otomasyonu' }, keywords: ['inventory', 'warehouse', 'stock'], requiredWorkflowTags: ['logistics', 'inventory'], avgProjectValue: { min: 1200, max: 4500, currency: 'USD' }, marketSize: 'medium', competitionLevel: 'low', idealCustomer: { en: 'Warehouses & distributors', tr: 'Depolar ve distribütörler' }, painPoints: [{ en: 'Stock accuracy', tr: 'Stok doğruluğu' }, { en: 'Reorder alerts', tr: 'Yeniden sipariş uyarıları' }] },
    ]
  },
];

interface SectorExplorerProps {
  onSelectSector: (sector: AgencyBuilderSector) => void;
  onSelectNiche: (niche: AgencyBuilderNiche, sector: AgencyBuilderSector) => void;
}

export default function SectorExplorer({ onSelectSector, onSelectNiche }: SectorExplorerProps) {
  const { tt, language } = useI18n();
  const [selectedSector, setSelectedSector] = useState<AgencyBuilderSector | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const formatCurrency = (min: number, max: number, currency: CurrencyCode) => {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  };

  const getMarketSizeLabel = (size: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      small: { en: 'Small', tr: 'Küçük' },
      medium: { en: 'Medium', tr: 'Orta' },
      large: { en: 'Large', tr: 'Büyük' },
    };
    return tt(labels[size]?.en || size, labels[size]?.tr || size);
  };

  const getCompetitionLabel = (level: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      low: { en: 'Low', tr: 'Düşük' },
      medium: { en: 'Medium', tr: 'Orta' },
      high: { en: 'High', tr: 'Yüksek' },
    };
    return tt(labels[level]?.en || level, labels[level]?.tr || level);
  };

  const getGrowthIcon = (trend: string) => {
    switch (trend) {
      case 'booming': return '🚀';
      case 'growing': return '📈';
      case 'stable': return '➡️';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  // Niche selection view
  if (selectedSector) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Back button */}
        <button
          onClick={() => setSelectedSector(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <span>←</span>
          <span>{tt('Back to Sectors', 'Sektörlere Dön')}</span>
        </button>

        {/* Selected Sector Header */}
        <div className="text-center space-y-4">
          <div className="text-6xl">{selectedSector.icon}</div>
          <h1 className="text-3xl font-bold text-white">
            {getLocalized(selectedSector.name, language)}
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {getLocalized(selectedSector.description, language)}
          </p>
        </div>

        {/* Sector Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-lg font-semibold text-blue-400">{getMarketSizeLabel(selectedSector.marketSize)}</div>
            <div className="text-xs text-gray-500">{tt('Market Size', 'Pazar Büyüklüğü')}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">⚔️</div>
            <div className="text-lg font-semibold text-yellow-400">{getCompetitionLabel(selectedSector.competitionLevel)}</div>
            <div className="text-xs text-gray-500">{tt('Competition', 'Rekabet')}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">{getGrowthIcon(selectedSector.growthTrend)}</div>
            <div className="text-lg font-semibold text-green-400">
              {formatCurrency(selectedSector.avgProjectValue.min, selectedSector.avgProjectValue.max, selectedSector.avgProjectValue.currency)}
            </div>
            <div className="text-xs text-gray-500">{tt('Avg. Project Value', 'Ort. Proje Değeri')}</div>
          </div>
        </div>

        {/* Sub-Niches */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            {tt('Choose a Niche', 'Bir Niş Seçin')} ({selectedSector.subNiches.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedSector.subNiches.map((niche) => (
              <button
                key={niche.id}
                onClick={() => onSelectNiche(niche, selectedSector)}
                className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-blue-500/50 rounded-lg p-6 transition text-left group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-white group-hover:text-blue-400 transition">
                    {getLocalized(niche.name, language)}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                    {getCompetitionLabel(niche.competitionLevel)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  {getLocalized(niche.description, language)}
                </p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-400 font-medium">
                    {formatCurrency(niche.avgProjectValue.min, niche.avgProjectValue.max, niche.avgProjectValue.currency)}
                    <span className="text-gray-500 ml-1">/mo</span>
                  </span>
                  <span className="text-gray-500">
                    {niche.keywords.slice(0, 3).join(', ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Or describe your own */}
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🤖</div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-white mb-1">
                {tt("Can't find your niche?", 'Nişinizi bulamadınız mı?')}
              </h3>
              <p className="text-sm text-gray-400">
                {tt(
                  'Describe what you want to build and AI will create a custom solution for you.',
                  'Ne inşa etmek istediğinizi açıklayın, AI sizin için özel bir çözüm oluşturacak.'
                )}
              </p>
            </div>
            <button
              onClick={() => onSelectSector(selectedSector)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-lg transition"
            >
              {tt('Use AI Discovery', 'AI Keşfi Kullan')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main sector grid view
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="text-6xl">🎯</div>
        <h1 className="text-3xl font-bold text-white">
          {tt('Choose Your Sector', 'Sektörünüzü Seçin')}
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          {tt(
            'Select an industry to build your AI agency. We\'ll help you find the best niches and create a complete business solution.',
            'AI ajansınızı kurmak için bir sektör seçin. Size en iyi nişleri bulmanıza ve eksiksiz bir iş çözümü oluşturmanıza yardımcı olacağız.'
          )}
        </p>
      </div>

      {/* Sector Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {SECTORS.map((sector) => (
          <button
            key={sector.id}
            onClick={() => setSelectedSector(sector)}
            onMouseEnter={() => setHoveredSector(sector.id)}
            onMouseLeave={() => setHoveredSector(null)}
            className="relative bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-blue-500/50 rounded-lg p-6 transition text-center group"
          >
            <div className="text-4xl mb-3">{sector.icon}</div>
            <h3 className="text-lg font-medium text-white group-hover:text-blue-400 transition mb-2">
              {getLocalized(sector.name, language)}
            </h3>

            {/* Hover info */}
            <div className={`transition-all duration-200 ${hoveredSector === sector.id ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'} overflow-hidden`}>
              <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-700">
                <div className="flex justify-between">
                  <span>{tt('Niches', 'Nişler')}:</span>
                  <span className="text-blue-400">{sector.subNiches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{tt('Avg. Value', 'Ort. Değer')}:</span>
                  <span className="text-green-400">${sector.avgProjectValue.min}-${sector.avgProjectValue.max}</span>
                </div>
              </div>
            </div>

            {/* Growth indicator */}
            <div className="absolute top-2 right-2 text-sm">
              {getGrowthIcon(sector.growthTrend)}
            </div>

            {/* Market size indicator */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex gap-1">
                {['small', 'medium', 'large'].map((size, i) => (
                  <div
                    key={size}
                    className={`h-1 flex-1 rounded-full ${
                      ['small', 'medium', 'large'].indexOf(sector.marketSize) >= i
                        ? 'bg-blue-500'
                        : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* AI Discovery Option */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🤖</div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-white mb-1">
              {tt('Not sure which sector?', 'Hangi sektör olduğundan emin değil misiniz?')}
            </h3>
            <p className="text-sm text-gray-400">
              {tt(
                'Tell AI about your interests and skills, and it will suggest the best sectors and niches for you.',
                'AI\'a ilgi alanlarınızı ve becerilerinizi anlatın, size en uygun sektörleri ve nişleri önersin.'
              )}
            </p>
          </div>
          <button className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-lg transition">
            {tt('Ask AI', 'AI\'a Sor')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-800/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">12</div>
          <div className="text-sm text-gray-500">{tt('Sectors', 'Sektör')}</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{SECTORS.reduce((sum, s) => sum + s.subNiches.length, 0)}</div>
          <div className="text-sm text-gray-500">{tt('Niches', 'Niş')}</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">$500-$8K</div>
          <div className="text-sm text-gray-500">{tt('Project Range', 'Proje Aralığı')}</div>
        </div>
      </div>
    </div>
  );
}

// Export sectors for use in other components
export { SECTORS };
export type { AgencyBuilderSector as Sector, AgencyBuilderNiche as Niche };
