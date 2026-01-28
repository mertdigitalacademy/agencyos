import { useState } from 'react';
import { useI18n } from '../services/i18n';
import { getAuthHeader } from '../src/lib/supabase';
import type { AgencyBuilderSector, AgencyBuilderNiche, LocalizedString, CurrencyCode } from '../types';

// Helper to get localized string
function getLocalized(str: LocalizedString, lang: string): string {
  return (str as Record<string, string>)[lang] || str.en;
}

interface NicheDiscoveryProps {
  sector: AgencyBuilderSector;
  onSelectNiche: (niche: AgencyBuilderNiche) => void;
  onBack: () => void;
  onGenerateSolution: (customDescription: string) => void;
}

interface DiscoveredNiche {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  marketSize: 'small' | 'medium' | 'large';
  competitionLevel: 'low' | 'medium' | 'high';
  avgRevenue: { min: number; max: number; currency: CurrencyCode };
  confidence: number;
  reasoning: LocalizedString;
  suggestedWorkflows: string[];
  idealCustomer: LocalizedString;
  painPoints: LocalizedString[];
}

export default function NicheDiscovery({ sector, onSelectNiche, onBack, onGenerateSolution }: NicheDiscoveryProps) {
  const { tt, language } = useI18n();
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [discoveredNiches, setDiscoveredNiches] = useState<DiscoveredNiche[]>([]);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (min: number, max: number, currency: CurrencyCode) => {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  };

  const getCompetitionColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-900/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30';
      case 'high': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getCompetitionLabel = (level: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      low: { en: 'Low Competition', tr: 'Düşük Rekabet' },
      medium: { en: 'Medium Competition', tr: 'Orta Rekabet' },
      high: { en: 'High Competition', tr: 'Yüksek Rekabet' },
    };
    return tt(labels[level]?.en || level, labels[level]?.tr || level);
  };

  const getMarketSizeLabel = (size: string) => {
    const labels: Record<string, { en: string; tr: string }> = {
      small: { en: 'Small Market', tr: 'Küçük Pazar' },
      medium: { en: 'Medium Market', tr: 'Orta Pazar' },
      large: { en: 'Large Market', tr: 'Büyük Pazar' },
    };
    return tt(labels[size]?.en || size, labels[size]?.tr || size);
  };

  const buildAiErrorMessage = (raw?: string) => {
    const msg = String(raw ?? '').toLowerCase();
    const isConfigError =
      msg.includes('openrouter') ||
      msg.includes('gemini') ||
      msg.includes('api key') ||
      msg.includes('ai not configured');
    if (isConfigError) {
      return tt(
        'AI is not configured. Add OPENROUTER_API_KEY or GEMINI_API_KEY in Settings -> Vault or server/.env.',
        'AI yapılandırılmadı. OPENROUTER_API_KEY veya GEMINI_API_KEY anahtarını Settings -> Vault veya server/.env içine ekleyin.',
      );
    }
    return tt('AI request failed. Please try again.', 'AI isteği başarısız. Lütfen tekrar deneyin.');
  };

  async function handleDiscover() {
    if (!description.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeader();
      const response = await fetch('/api/agency-builder/discover-niches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          sectorId: sector.id,
          description: description.trim(),
          language,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(buildAiErrorMessage((data as any)?.error));
      }
      if (!Array.isArray((data as any)?.niches) || (data as any).niches.length === 0) {
        throw new Error(buildAiErrorMessage());
      }
      setDiscoveredNiches((data as any).niches);
    } catch (e) {
      console.error('Niche discovery failed:', e);
      const message = e instanceof Error ? e.message : buildAiErrorMessage();
      setError(message);
      setDiscoveredNiches([]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSelectDiscoveredNiche(niche: DiscoveredNiche) {
    // Convert to AgencyBuilderNiche format
    const builderNiche: AgencyBuilderNiche = {
      id: niche.id,
      sectorId: sector.id,
      name: niche.name,
      description: niche.description,
      keywords: niche.suggestedWorkflows,
      requiredWorkflowTags: niche.suggestedWorkflows,
      avgProjectValue: niche.avgRevenue,
      marketSize: niche.marketSize,
      competitionLevel: niche.competitionLevel,
      idealCustomer: niche.idealCustomer,
      painPoints: niche.painPoints,
    };
    onSelectNiche(builderNiche);
  }

  // Example prompts
  const examplePrompts = [
    {
      en: 'I want to help small restaurants automate their orders and customer communication',
      tr: 'Küçük restoranlara sipariş ve müşteri iletişimini otomatikleştirmelerine yardımcı olmak istiyorum',
    },
    {
      en: 'I\'m interested in helping YouTube creators manage their content and grow their channels',
      tr: 'YouTube içerik üreticilerine içeriklerini yönetmelerine ve kanallarını büyütmelerine yardımcı olmak istiyorum',
    },
    {
      en: 'I want to build AI solutions for real estate agents to find and nurture leads',
      tr: 'Emlakçılara potansiyel müşteri bulmak ve beslemek için AI çözümleri oluşturmak istiyorum',
    },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition"
      >
        <span>←</span>
        <span>{tt('Back to Sector', 'Sektöre Dön')}</span>
      </button>

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <span className="text-5xl">{sector.icon}</span>
          <span className="text-4xl">🤖</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          {tt('AI Niche Discovery', 'AI Niş Keşfi')}
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          {tt(
            `Tell us about your interests in ${getLocalized(sector.name, 'en')} and AI will discover the best niches for you.`,
            `${getLocalized(sector.name, 'tr')} alanındaki ilgi alanlarınızı bize anlatın ve AI size en iyi nişleri keşfetsin.`
          )}
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
        <label className="block text-sm font-medium text-gray-300">
          {tt('Describe what you want to build', 'Ne inşa etmek istediğinizi açıklayın')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tt(
            'E.g., "I want to help small businesses automate their customer support with AI chatbots..."',
            'Örn: "Küçük işletmelerin AI chatbot\'larla müşteri desteğini otomatikleştirmelerine yardımcı olmak istiyorum..."'
          )}
          className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />

        {/* Example prompts */}
        <div className="space-y-2">
          <div className="text-xs text-gray-500">{tt('Try these examples:', 'Bu örnekleri deneyin:')}</div>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => setDescription(tt(prompt.en, prompt.tr))}
                className="text-xs px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-full transition"
              >
                {tt(prompt.en, prompt.tr).slice(0, 50)}...
              </button>
            ))}
          </div>
        </div>

        {/* Discover button */}
        <button
          onClick={handleDiscover}
          disabled={!description.trim() || isAnalyzing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-4 rounded-lg transition flex items-center justify-center gap-3"
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{tt('Discovering niches...', 'Nişler keşfediliyor...')}</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>{tt('Discover Niches with AI', 'AI ile Nişleri Keşfet')}</span>
            </>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Discovered Niches */}
      {discoveredNiches.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {tt('Discovered Niches', 'Keşfedilen Nişler')} ({discoveredNiches.length})
            </h2>
            <button
              onClick={() => setDiscoveredNiches([])}
              className="text-sm text-gray-400 hover:text-white"
            >
              {tt('Clear results', 'Sonuçları temizle')}
            </button>
          </div>

          <div className="space-y-4">
            {discoveredNiches.map((niche, index) => (
              <div
                key={niche.id}
                className="bg-gray-800/50 border border-gray-700 hover:border-blue-500/50 rounded-lg p-6 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-xl">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {getLocalized(niche.name, language)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getCompetitionColor(niche.competitionLevel)}`}>
                          {getCompetitionLabel(niche.competitionLevel)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getMarketSizeLabel(niche.marketSize)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Confidence badge */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      {Math.round(niche.confidence * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {tt('Match', 'Eşleşme')}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-400 mb-4">
                  {getLocalized(niche.description, language)}
                </p>

                {/* Revenue */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">💰</span>
                  <span className="text-lg font-semibold text-green-400">
                    {formatCurrency(niche.avgRevenue.min, niche.avgRevenue.max, niche.avgRevenue.currency)}
                    <span className="text-sm text-gray-500 ml-1">/mo</span>
                  </span>
                </div>

                {/* AI Reasoning */}
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🤖</span>
                    <div>
                      <div className="text-xs text-blue-400 mb-1">{tt('AI Analysis', 'AI Analizi')}</div>
                      <p className="text-sm text-gray-300">
                        {getLocalized(niche.reasoning, language)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pain Points */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">{tt('Target Pain Points', 'Hedef Sorun Noktaları')}</div>
                  <div className="flex flex-wrap gap-2">
                    {niche.painPoints.map((point, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-red-900/20 text-red-300 rounded">
                        {getLocalized(point, language)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Suggested Workflows */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">{tt('Suggested Workflows', 'Önerilen Workflow\'lar')}</div>
                  <div className="flex flex-wrap gap-2">
                    {niche.suggestedWorkflows.map((workflow, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-purple-900/20 text-purple-300 rounded">
                        {workflow}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleSelectDiscoveredNiche(niche)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>{tt('Select This Niche', 'Bu Nişi Seç')}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Custom solution option */}
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">✨</div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-white mb-1">
                  {tt('Want a fully custom solution?', 'Tamamen özel bir çözüm mü istiyorsunuz?')}
                </h3>
                <p className="text-sm text-gray-400">
                  {tt(
                    'Skip niche selection and let AI create a completely custom agency solution based on your description.',
                    'Niş seçimini atlayın ve AI\'ın açıklamanıza göre tamamen özel bir ajans çözümü oluşturmasına izin verin.'
                  )}
                </p>
              </div>
              <button
                onClick={() => onGenerateSolution(description)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-lg transition"
              >
                {tt('Generate Custom Solution', 'Özel Çözüm Üret')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
