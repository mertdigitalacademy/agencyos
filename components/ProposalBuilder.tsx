import { useState, useEffect } from 'react';
import { useI18n } from '../services/i18n';
import { getAuthHeader } from '../src/lib/supabase';
import {
  CouncilReviewButton,
  CouncilBadgeLarge,
} from './CouncilBadge';
import {
  quickCouncilReview,
  isCouncilApproved,
  buildProposalContext,
  buildCouncilTopic,
  type CouncilReviewResult,
} from '../services/councilHelpers';
import type {
  Proposal,
  ProposalPricingTier,
  ProposalScope,
  ProposalTerms,
  ProposalStatus,
  CurrencyCode,
  ServiceTier,
  AgencySolution,
  Project,
} from '../types';

interface ProposalBuilderProps {
  projectId?: string;
  project?: Project;
  solution?: AgencySolution;
  onClose: () => void;
  onSave?: (proposal: Proposal) => void;
  onSend?: (proposal: Proposal) => void;
}

// Default terms
const DEFAULT_TERMS: ProposalTerms = {
  paymentTerms: '50% upfront, 50% on completion',
  validityPeriod: 14,
  cancellationPolicy: '30-day notice required',
  revisionPolicy: 'Up to 2 revisions included',
  confidentiality: true,
};

// Generate unique ID
function generateId(): string {
  return `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function ProposalBuilder({
  projectId,
  project,
  solution,
  onClose,
  onSave,
  onSend,
}: ProposalBuilderProps) {
  const { tt, language } = useI18n();

  // Form state
  const [clientName, setClientName] = useState(project?.brief?.clientName || '');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  // Pricing tiers
  const [tiers, setTiers] = useState<ProposalPricingTier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  // Scope
  const [scope, setScope] = useState<ProposalScope>({
    objectives: [],
    deliverables: [],
    timeline: '',
    assumptions: [],
    exclusions: [],
  });

  // Terms
  const [terms, setTerms] = useState<ProposalTerms>(DEFAULT_TERMS);

  // UI state
  const [step, setStep] = useState<'info' | 'pricing' | 'scope' | 'preview'>('info');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Council review state
  const [councilReview, setCouncilReview] = useState<CouncilReviewResult | null>(null);
  const [isReviewingWithCouncil, setIsReviewingWithCouncil] = useState(false);
  const [showCouncilDetails, setShowCouncilDetails] = useState(false);

  // Initialize from solution if available
  useEffect(() => {
    if (solution) {
      // Set title from solution
      const solutionName = solution.name.en || solution.name[language as keyof typeof solution.name] || '';
      setTitle(`${solutionName} - Proposal`);

      // Generate tiers from service packages
      const generatedTiers: ProposalPricingTier[] = solution.servicePackages.map((pkg, index) => ({
        id: `tier-${index}`,
        tier: pkg.tier,
        name: pkg.name.en || pkg.name[language as keyof typeof pkg.name] || '',
        description: pkg.description.en || pkg.description[language as keyof typeof pkg.description] || '',
        features: pkg.features.map(f => f.en || f[language as keyof typeof f] || ''),
        setupFee: pkg.setupFee,
        monthlyFee: pkg.monthlyFee,
        currency: pkg.currency,
        isRecommended: pkg.tier === 'standard',
      }));

      setTiers(generatedTiers);
      setCurrency(solution.servicePackages[0]?.currency || 'USD');

      // Set default selected tier (standard)
      const standardTier = generatedTiers.find(t => t.tier === 'standard');
      if (standardTier) {
        setSelectedTierId(standardTier.id);
      }
    }
  }, [solution, language]);

  // Initialize from project if available
  useEffect(() => {
    if (project?.brief) {
      setClientName(project.brief.clientName);
      setTitle(`${project.brief.clientName} - Automation Proposal`);

      // Extract goals as objectives
      if (project.brief.goals) {
        setScope(prev => ({
          ...prev,
          objectives: project.brief.goals,
        }));
      }
    }
  }, [project]);

  // Generate proposal with AI
  async function generateWithAI() {
    setIsGenerating(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeader();
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          clientName,
          clientCompany,
          projectId,
          solutionId: solution?.id,
          language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary || '');
        if (data.scope) setScope(data.scope);
        if (data.tiers) setTiers(data.tiers);
      } else {
        // Fallback to mock generation
        generateMockContent();
      }
    } catch (e) {
      console.error('AI generation failed:', e);
      generateMockContent();
    } finally {
      setIsGenerating(false);
    }
  }

  // Mock content generation
  function generateMockContent() {
    setSummary(
      language === 'tr'
        ? `${clientName || 'Müşteri'} için özel olarak hazırlanmış otomasyon çözümü. İş süreçlerinizi hızlandırın, maliyetleri düşürün ve verimliliği artırın.`
        : `Custom automation solution prepared for ${clientName || 'Client'}. Accelerate your business processes, reduce costs, and increase efficiency.`
    );

    setScope({
      objectives: [
        language === 'tr' ? 'Manuel süreçleri otomatikleştir' : 'Automate manual processes',
        language === 'tr' ? 'Veri akışını optimize et' : 'Optimize data flow',
        language === 'tr' ? 'Operasyonel maliyetleri düşür' : 'Reduce operational costs',
      ],
      deliverables: [
        language === 'tr' ? 'Tam otomatik workflow sistemleri' : 'Fully automated workflow systems',
        language === 'tr' ? 'Dashboard ve raporlama' : 'Dashboard and reporting',
        language === 'tr' ? 'Eğitim ve dokümantasyon' : 'Training and documentation',
      ],
      timeline: language === 'tr' ? '2-4 hafta' : '2-4 weeks',
      assumptions: [
        language === 'tr' ? 'Mevcut sistemlere API erişimi' : 'API access to existing systems',
        language === 'tr' ? 'Müşteri işbirliği ve onayı' : 'Client collaboration and approval',
      ],
      exclusions: [
        language === 'tr' ? 'Üçüncü taraf lisans ücretleri' : 'Third-party license fees',
        language === 'tr' ? 'Donanım maliyetleri' : 'Hardware costs',
      ],
    });

    // Generate default tiers if empty
    if (tiers.length === 0) {
      setTiers([
        {
          id: 'tier-starter',
          tier: 'starter',
          name: language === 'tr' ? 'Başlangıç' : 'Starter',
          description: language === 'tr' ? 'Temel otomasyon paketi' : 'Basic automation package',
          features: [
            language === 'tr' ? '3 temel workflow' : '3 core workflows',
            language === 'tr' ? 'Email entegrasyonu' : 'Email integration',
            language === 'tr' ? '1 ay destek' : '1 month support',
          ],
          setupFee: 500,
          monthlyFee: 299,
          currency: 'USD',
          isRecommended: false,
        },
        {
          id: 'tier-standard',
          tier: 'standard',
          name: language === 'tr' ? 'Standart' : 'Standard',
          description: language === 'tr' ? 'Profesyonel otomasyon paketi' : 'Professional automation package',
          features: [
            language === 'tr' ? '10 workflow' : '10 workflows',
            language === 'tr' ? 'CRM entegrasyonu' : 'CRM integration',
            language === 'tr' ? 'Özel dashboard' : 'Custom dashboard',
            language === 'tr' ? '3 ay destek' : '3 months support',
          ],
          setupFee: 1000,
          monthlyFee: 599,
          currency: 'USD',
          isRecommended: true,
        },
        {
          id: 'tier-premium',
          tier: 'premium',
          name: language === 'tr' ? 'Premium' : 'Premium',
          description: language === 'tr' ? 'Kurumsal otomasyon paketi' : 'Enterprise automation package',
          features: [
            language === 'tr' ? 'Sınırsız workflow' : 'Unlimited workflows',
            language === 'tr' ? 'Tam entegrasyon' : 'Full integration',
            language === 'tr' ? 'AI asistan' : 'AI assistant',
            language === 'tr' ? '7/24 destek' : '24/7 support',
            language === 'tr' ? 'Özel geliştirme' : 'Custom development',
          ],
          setupFee: 2500,
          monthlyFee: 1299,
          currency: 'USD',
          isRecommended: false,
        },
      ]);
      setSelectedTierId('tier-standard');
    }
  }

  // Save proposal
  function handleSave() {
    const proposal: Proposal = {
      id: generateId(),
      projectId,
      clientName,
      clientEmail: clientEmail || undefined,
      clientCompany: clientCompany || undefined,
      title,
      summary,
      currency,
      tiers,
      selectedTierId: selectedTierId || undefined,
      scope,
      terms,
      validUntil: new Date(Date.now() + terms.validityPeriod * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage
    const existingProposals = JSON.parse(localStorage.getItem('agencyos_proposals') || '[]');
    existingProposals.push(proposal);
    localStorage.setItem('agencyos_proposals', JSON.stringify(existingProposals));

    onSave?.(proposal);
  }

  // Send proposal
  async function handleSend() {
    if (!clientEmail) {
      setError(tt('Please enter client email', 'Lütfen müşteri emailini girin'));
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const proposal: Proposal = {
        id: generateId(),
        projectId,
        clientName,
        clientEmail,
        clientCompany: clientCompany || undefined,
        title,
        summary,
        currency,
        tiers,
        selectedTierId: selectedTierId || undefined,
        scope,
        terms,
        validUntil: new Date(Date.now() + terms.validityPeriod * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Sent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Try to send via API
      const authHdrs = await getAuthHeader();
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHdrs },
        body: JSON.stringify(proposal),
      });

      if (response.ok) {
        const savedProposal = await response.json();
        onSend?.(savedProposal);
      } else {
        // Fallback: save locally
        const existingProposals = JSON.parse(localStorage.getItem('agencyos_proposals') || '[]');
        existingProposals.push(proposal);
        localStorage.setItem('agencyos_proposals', JSON.stringify(existingProposals));
        onSend?.(proposal);
      }
    } catch (e) {
      console.error('Send failed:', e);
      setError(tt('Failed to send proposal', 'Teklif gönderilemedi'));
    } finally {
      setIsSending(false);
    }
  }

  // Format currency
  const formatCurrency = (amount: number, curr: CurrencyCode = currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Request council review
  async function requestCouncilReview() {
    setIsReviewingWithCouncil(true);
    setError(null);

    try {
      const context = buildProposalContext({
        clientName,
        title,
        tiers: tiers.map(t => ({
          name: t.name,
          setupFee: t.setupFee,
          monthlyFee: t.monthlyFee,
        })),
        scope: {
          objectives: scope.objectives,
          deliverables: scope.deliverables,
        },
        currency,
      });

      const result = await quickCouncilReview({
        context,
        gateType: 'Strategic',
        topic: buildCouncilTopic('proposal', clientName || title, language),
        language,
      });

      setCouncilReview(result);

      // If council suggests pricing adjustments, show them
      if (result.pricing && result.pricing.lineItems && result.pricing.lineItems.length > 0) {
        setShowCouncilDetails(true);
      }
    } catch (e) {
      console.error('Council review failed:', e);
      setError(tt('Council review failed. You can still send the proposal.', 'Kurul incelemesi başarısız oldu. Teklifi yine de gönderebilirsiniz.'));
    } finally {
      setIsReviewingWithCouncil(false);
    }
  }

  // Apply council pricing suggestions
  function applyCouncilPricing() {
    if (!councilReview?.pricing?.lineItems) return;

    // Map council suggestions to tiers if possible
    const suggestedItems = councilReview.pricing.lineItems;

    // Update tiers with council suggestions
    setTiers(prevTiers => {
      return prevTiers.map((tier, index) => {
        const suggestion = suggestedItems[index];
        if (suggestion) {
          return {
            ...tier,
            setupFee: suggestion.cadence === 'One-Time' ? suggestion.amount : tier.setupFee,
            monthlyFee: suggestion.cadence === 'Monthly' ? suggestion.amount : tier.monthlyFee,
          };
        }
        return tier;
      });
    });

    setShowCouncilDetails(false);
  }

  // Step navigation
  const steps = [
    { id: 'info', label: tt('Client Info', 'Müşteri Bilgisi') },
    { id: 'pricing', label: tt('Pricing', 'Fiyatlandırma') },
    { id: 'scope', label: tt('Scope', 'Kapsam') },
    { id: 'preview', label: tt('Preview', 'Önizleme') },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/80 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                <span className="text-xl">✕</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📝</span>
                  <span>{tt('Proposal Builder', 'Teklif Oluşturucu')}</span>
                </h1>
                <p className="text-sm text-gray-400">
                  {tt('Create and send professional proposals', 'Profesyonel teklifler oluştur ve gönder')}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="hidden md:flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => setStep(s.id as typeof step)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                      i <= currentStepIndex
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        i < currentStepIndex
                          ? 'bg-blue-600 text-white'
                          : i === currentStepIndex
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-500'
                      }`}
                    >
                      {i < currentStepIndex ? '✓' : i + 1}
                    </span>
                    <span className="hidden lg:inline">{s.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <div className={`w-6 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-blue-600' : 'bg-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* Step 1: Client Info */}
        {step === 'info' && (
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                {tt('Client Information', 'Müşteri Bilgileri')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {tt('Client Name', 'Müşteri Adı')} *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={tt('John Smith', 'Ahmet Yılmaz')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {tt('Email', 'Email')} *
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="client@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {tt('Company', 'Şirket')}
                  </label>
                  <input
                    type="text"
                    value={clientCompany}
                    onChange={e => setClientCompany(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={tt('Acme Corp', 'ABC Şirketi')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {tt('Proposal Title', 'Teklif Başlığı')}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={tt('Automation Proposal', 'Otomasyon Teklifi')}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-400">
                    {tt('Summary', 'Özet')}
                  </label>
                  <button
                    onClick={generateWithAI}
                    disabled={isGenerating}
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {isGenerating ? (
                      <>
                        <span className="animate-spin">⚙️</span>
                        <span>{tt('Generating...', 'Üretiliyor...')}</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>{tt('Generate with AI', 'AI ile Üret')}</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={tt(
                    'Describe your proposal value proposition...',
                    'Teklifinizin değer önerisini açıklayın...'
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep('pricing')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
              >
                <span>{tt('Next: Pricing', 'Sonraki: Fiyatlandırma')}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 'pricing' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {tt('Pricing Tiers', 'Fiyat Paketleri')}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{tt('Currency:', 'Para Birimi:')}</span>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as CurrencyCode)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="TRY">TRY (₺)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map(tier => (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`relative bg-gray-800/50 border rounded-xl p-6 cursor-pointer transition ${
                    selectedTierId === tier.id
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : tier.isRecommended
                      ? 'border-green-500/50'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {tier.isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {tt('RECOMMENDED', 'ÖNERİLEN')}
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{tier.description}</p>
                  </div>

                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-white">
                      {formatCurrency(tier.monthlyFee)}
                      <span className="text-sm font-normal text-gray-400">/mo</span>
                    </div>
                    {tier.setupFee > 0 && (
                      <div className="text-sm text-gray-500 mt-1">
                        + {formatCurrency(tier.setupFee)} {tt('setup', 'kurulum')}
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {selectedTierId === tier.id && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {tiers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-gray-400 mb-4">
                  {tt('No pricing tiers yet', 'Henüz fiyat paketi yok')}
                </p>
                <button
                  onClick={generateMockContent}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  {tt('Generate Default Tiers', 'Varsayılan Paketleri Oluştur')}
                </button>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep('info')}
                className="text-gray-400 hover:text-white px-6 py-3 transition flex items-center gap-2"
              >
                <span>←</span>
                <span>{tt('Back', 'Geri')}</span>
              </button>
              <button
                onClick={() => setStep('scope')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
              >
                <span>{tt('Next: Scope', 'Sonraki: Kapsam')}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Scope */}
        {step === 'scope' && (
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                {tt('Project Scope', 'Proje Kapsamı')}
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {tt('Objectives', 'Hedefler')}
                </label>
                <textarea
                  value={scope.objectives.join('\n')}
                  onChange={e => setScope({ ...scope, objectives: e.target.value.split('\n').filter(Boolean) })}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={tt('One objective per line...', 'Her satıra bir hedef...')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {tt('Deliverables', 'Teslim Edilecekler')}
                </label>
                <textarea
                  value={scope.deliverables.join('\n')}
                  onChange={e => setScope({ ...scope, deliverables: e.target.value.split('\n').filter(Boolean) })}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={tt('One deliverable per line...', 'Her satıra bir teslimat...')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {tt('Timeline', 'Süre')}
                </label>
                <input
                  type="text"
                  value={scope.timeline}
                  onChange={e => setScope({ ...scope, timeline: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={tt('e.g., 2-4 weeks', 'örn. 2-4 hafta')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {tt('Assumptions', 'Varsayımlar')}
                  </label>
                  <textarea
                    value={scope.assumptions.join('\n')}
                    onChange={e => setScope({ ...scope, assumptions: e.target.value.split('\n').filter(Boolean) })}
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={tt('One per line...', 'Her satıra bir...')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {tt('Exclusions', 'Kapsam Dışı')}
                  </label>
                  <textarea
                    value={scope.exclusions.join('\n')}
                    onChange={e => setScope({ ...scope, exclusions: e.target.value.split('\n').filter(Boolean) })}
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={tt('One per line...', 'Her satıra bir...')}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('pricing')}
                className="text-gray-400 hover:text-white px-6 py-3 transition flex items-center gap-2"
              >
                <span>←</span>
                <span>{tt('Back', 'Geri')}</span>
              </button>
              <button
                onClick={() => setStep('preview')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
              >
                <span>{tt('Preview', 'Önizleme')}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-8 text-gray-900">
              {/* Preview Header */}
              <div className="border-b pb-6 mb-6">
                <h1 className="text-3xl font-bold text-gray-900">{title || tt('Proposal', 'Teklif')}</h1>
                <p className="text-gray-600 mt-2">
                  {tt('Prepared for:', 'Hazırlayan:')} <strong>{clientName || '...'}</strong>
                  {clientCompany && ` - ${clientCompany}`}
                </p>
              </div>

              {/* Summary */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-3">{tt('Executive Summary', 'Özet')}</h2>
                <p className="text-gray-700 leading-relaxed">{summary || tt('No summary yet', 'Henüz özet yok')}</p>
              </div>

              {/* Selected Tier */}
              {selectedTierId && (
                <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-3">{tt('Selected Package', 'Seçilen Paket')}</h2>
                  {(() => {
                    const tier = tiers.find(t => t.id === selectedTierId);
                    if (!tier) return null;
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">{tier.name}</h3>
                          <p className="text-gray-600">{tier.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(tier.monthlyFee)}/mo
                          </div>
                          {tier.setupFee > 0 && (
                            <div className="text-sm text-gray-500">
                              + {formatCurrency(tier.setupFee)} {tt('one-time', 'tek seferlik')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Scope */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-3">{tt('Scope of Work', 'İş Kapsamı')}</h2>

                {scope.objectives.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">{tt('Objectives', 'Hedefler')}</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {scope.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {scope.deliverables.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">{tt('Deliverables', 'Teslim Edilecekler')}</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {scope.deliverables.map((del, i) => (
                        <li key={i}>{del}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {scope.timeline && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">{tt('Timeline', 'Süre')}</h3>
                    <p className="text-gray-700">{scope.timeline}</p>
                  </div>
                )}
              </div>

              {/* Terms */}
              <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-3">{tt('Terms & Conditions', 'Şartlar ve Koşullar')}</h2>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <strong>{tt('Payment:', 'Ödeme:')}</strong> {terms.paymentTerms}
                  </div>
                  <div>
                    <strong>{tt('Valid for:', 'Geçerlilik:')}</strong> {terms.validityPeriod} {tt('days', 'gün')}
                  </div>
                </div>
              </div>
            </div>

            {/* Council Review Section */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span>🏛️</span>
                    <span>{tt('AI Council Review', 'AI Kurul İncelemesi')}</span>
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {tt(
                      'Get strategic feedback before sending',
                      'Göndermeden önce stratejik geri bildirim alın'
                    )}
                  </p>
                </div>

                {/* Council Badge or Review Button */}
                <CouncilReviewButton
                  onRequestReview={requestCouncilReview}
                  loading={isReviewingWithCouncil}
                  hasReview={!!councilReview}
                  decision={councilReview?.decision}
                  confidence={councilReview?.confidence}
                  language={language}
                />
              </div>

              {/* Council Review Result */}
              {councilReview && (
                <div className="space-y-4">
                  {/* Decision Badge */}
                  <div className="flex items-center gap-4">
                    <CouncilBadgeLarge
                      decision={councilReview.decision}
                      confidence={councilReview.confidence}
                      onClick={() => setShowCouncilDetails(!showCouncilDetails)}
                      language={language}
                    />
                    {isCouncilApproved(councilReview) && (
                      <span className="text-green-400 text-sm">
                        ✓ {tt('Ready to send', 'Gönderime hazır')}
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <p className="text-gray-300 text-sm">{councilReview.summary}</p>
                  </div>

                  {/* Recommendations */}
                  {councilReview.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">
                        {tt('Recommendations', 'Öneriler')}
                      </h4>
                      <ul className="space-y-1">
                        {councilReview.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-yellow-400 mt-0.5">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pricing Suggestions */}
                  {showCouncilDetails && councilReview.pricing && councilReview.pricing.lineItems && (
                    <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-indigo-300">
                          {tt('Suggested Pricing', 'Önerilen Fiyatlandırma')}
                        </h4>
                        <button
                          onClick={applyCouncilPricing}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg transition"
                        >
                          {tt('Apply Suggestions', 'Önerileri Uygula')}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {councilReview.pricing.lineItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-300">{item.label}</span>
                            <span className="text-indigo-300 font-medium">
                              {formatCurrency(item.amount)} {item.cadence === 'Monthly' && '/mo'}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-indigo-500/30 pt-2 mt-2 flex justify-between text-sm font-bold">
                          <span className="text-gray-300">{tt('First Month Total', 'İlk Ay Toplam')}</span>
                          <span className="text-indigo-300">{formatCurrency(councilReview.pricing.totalFirstMonth || 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setStep('scope')}
                className="text-gray-400 hover:text-white px-6 py-3 transition flex items-center gap-2"
              >
                <span>←</span>
                <span>{tt('Back', 'Geri')}</span>
              </button>

              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>{tt('Save Draft', 'Taslak Kaydet')}</span>
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <span className="animate-spin">⚙️</span>
                      <span>{tt('Sending...', 'Gönderiliyor...')}</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>{tt('Send Proposal', 'Teklifi Gönder')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
