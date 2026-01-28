import { useState, useEffect } from 'react';
import { useI18n } from '../services/i18n';
import { getAuthHeader } from '../src/lib/supabase';
import SectorExplorer, { SECTORS } from './SectorExplorer';
import NicheDiscovery from './NicheDiscovery';
import PostDeployWizard from './PostDeployWizard';
import { CouncilBadge, CouncilBadgeLarge, CouncilReviewButton } from './CouncilBadge';
import {
  quickCouncilReview,
  isCouncilApproved,
  buildSolutionContext,
  type CouncilReviewResult,
} from '../services/councilHelpers';
import { View } from '../types';
import type {
  AgencyBuilderSector,
  AgencyBuilderNiche,
  AgencySolution,
  LocalizedString,
  CurrencyCode,
} from '../types';

// Helper to get localized string
function getLocalized(str: LocalizedString, lang: string): string {
  return (str as Record<string, string>)[lang] || str.en;
}

type WizardStep = 'sector' | 'niche' | 'discovery' | 'solution' | 'customize' | 'deploy';

interface AgencyBuilderProps {
  onClose: () => void;
  onSolutionDeployed?: (solution: AgencySolution) => void;
  onNavigate?: (view: View) => void;
}

export default function AgencyBuilder({ onClose, onSolutionDeployed, onNavigate }: AgencyBuilderProps) {
  const { tt, language } = useI18n();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('sector');
  const [selectedSector, setSelectedSector] = useState<AgencyBuilderSector | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<AgencyBuilderNiche | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [solution, setSolution] = useState<AgencySolution | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deployment state
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [showPostDeployWizard, setShowPostDeployWizard] = useState(false);

  // Council review state
  const [councilReview, setCouncilReview] = useState<CouncilReviewResult | null>(null);
  const [isReviewingWithCouncil, setIsReviewingWithCouncil] = useState(false);

  // Check if PostDeployWizard should be shown
  useEffect(() => {
    if (deployStatus === 'success' && solution) {
      const dismissed = localStorage.getItem('agencyos_post_deploy_dismissed');
      if (!dismissed) {
        // Show wizard after a brief delay to let the success animation play
        const timer = setTimeout(() => setShowPostDeployWizard(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [deployStatus, solution]);

  // Format currency
  const formatCurrency = (amount: number, currency: CurrencyCode = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
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

  // Handle sector selection
  function handleSectorSelect(sector: AgencyBuilderSector) {
    setSelectedSector(sector);
    setStep('discovery');
  }

  // Handle niche selection from sector explorer
  function handleNicheSelectFromExplorer(niche: AgencyBuilderNiche, sector: AgencyBuilderSector) {
    setSelectedSector(sector);
    setSelectedNiche(niche);
    generateSolution(sector.id, sector.name, niche);
  }

  // Handle niche selection from discovery
  function handleNicheSelect(niche: AgencyBuilderNiche) {
    setSelectedNiche(niche);
    if (selectedSector) {
      generateSolution(selectedSector.id, selectedSector.name, niche);
    }
  }

  // Handle custom description solution generation
  function handleGenerateCustomSolution(description: string) {
    setCustomDescription(description);
    if (selectedSector) {
      generateSolution(selectedSector.id, selectedSector.name, undefined, description);
    }
  }

  // Generate solution via API
  async function generateSolution(sectorId: string, sectorName: LocalizedString, niche?: AgencyBuilderNiche, customDesc?: string) {
    setIsLoading(true);
    setError(null);
    setStep('solution');

    try {
      const authHeaders = await getAuthHeader();
      const response = await fetch('/api/agency-builder/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          sectorId,
          sectorName: getLocalized(sectorName, 'en'),
          nicheId: niche?.id,
          nicheName: niche ? getLocalized(niche.name, 'en') : undefined,
          customDescription: customDesc,
          language,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(buildAiErrorMessage((data as any)?.error));
      }

      setSolution(data as AgencySolution);
    } catch (e) {
      console.error('Solution generation failed:', e);
      const message = e instanceof Error ? e.message : buildAiErrorMessage();
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  // Request council validation for the solution
  async function requestCouncilValidation() {
    if (!solution) return;

    setIsReviewingWithCouncil(true);

    try {
      const context = buildSolutionContext({
        name: getLocalized(solution.name, 'en'),
        sectorId: solution.sectorId,
        nicheId: solution.nicheId,
        servicePackages: solution.servicePackages.map(pkg => ({
          name: getLocalized(pkg.name, 'en'),
          setupFee: pkg.setupFee,
          monthlyFee: pkg.monthlyFee,
        })),
        targetCustomer: {
          description: getLocalized(solution.targetCustomer.description, 'en'),
        },
        pricingStrategy: {
          recommendedSetup: solution.pricingStrategy.recommendedSetup,
          recommendedMonthly: solution.pricingStrategy.recommendedMonthly,
        },
      });

      const result = await quickCouncilReview({
        context,
        gateType: 'Strategic',
        topic: `Agency Solution Validation: ${getLocalized(solution.name, language)}`,
        language,
      });

      setCouncilReview(result);
    } catch (e) {
      console.error('Council validation failed:', e);
    } finally {
      setIsReviewingWithCouncil(false);
    }
  }

  // Deploy solution (install workflows)
  async function deploySolution() {
    if (!solution) return;

    // Navigate to deploy step first
    setStep('deploy');
    setDeployStatus('deploying');
    setDeployProgress(0);

    try {
      const workflows = solution.recommendedWorkflows.filter(w => w.priority !== 'optional');
      const total = workflows.length;

      for (let i = 0; i < total; i++) {
        const workflow = workflows[i];

        // Call actual API to install workflow
        const authHdrs = await getAuthHeader();
        const response = await fetch('/api/agency-builder/install-workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHdrs },
          body: JSON.stringify({
            solutionId: solution.id,
            workflows: [workflow],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to install workflow: ${workflow.workflowName}`);
        }

        setDeployProgress(Math.round(((i + 1) / total) * 100));
      }

      // Save deployed solution to localStorage for persistence
      localStorage.setItem('agencyos_deployed_solution', JSON.stringify(solution));

      setDeployStatus('success');
      onSolutionDeployed?.(solution);
    } catch (e) {
      console.error('Deployment failed:', e);
      setDeployStatus('error');
    }
  }

  // Go back
  function goBack() {
    switch (step) {
      case 'niche':
        setStep('sector');
        setSelectedSector(null);
        break;
      case 'discovery':
        setStep('sector');
        setSelectedSector(null);
        break;
      case 'solution':
        if (selectedNiche) {
          setStep('discovery');
        } else {
          setStep('sector');
        }
        setSolution(null);
        break;
      case 'customize':
        setStep('solution');
        break;
      case 'deploy':
        setStep('solution');
        break;
    }
  }

  // Progress indicator
  const steps = [
    { id: 'sector', label: tt('Sector', 'Sektör') },
    { id: 'niche', label: tt('Niche', 'Niş') },
    { id: 'solution', label: tt('Solution', 'Çözüm') },
    { id: 'deploy', label: tt('Deploy', 'Dağıt') },
  ];

  const currentStepIndex = ['sector', 'discovery'].includes(step) ? 0
    : ['niche'].includes(step) ? 1
    : ['solution', 'customize'].includes(step) ? 2
    : 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-900/80 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition"
              >
                <span className="text-xl">✕</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🏛️</span>
                  <span>{tt('AI Agency Builder', 'AI Ajans Oluşturucu')}</span>
                </h1>
                <p className="text-sm text-gray-400">
                  {tt('Build your complete agency solution', 'Eksiksiz ajans çözümünüzü oluşturun')}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="hidden md:flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    i <= currentStepIndex
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'bg-gray-800 text-gray-500'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      i < currentStepIndex ? 'bg-blue-600 text-white' :
                      i === currentStepIndex ? 'bg-blue-500 text-white' :
                      'bg-gray-700 text-gray-500'
                    }`}>
                      {i < currentStepIndex ? '✓' : i + 1}
                    </span>
                    <span>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-blue-600' : 'bg-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-8">
        {/* Step 1: Sector Selection */}
        {step === 'sector' && (
          <SectorExplorer
            onSelectSector={handleSectorSelect}
            onSelectNiche={handleNicheSelectFromExplorer}
          />
        )}

        {/* Step 2: AI Niche Discovery */}
        {step === 'discovery' && selectedSector && (
          <NicheDiscovery
            sector={selectedSector}
            onSelectNiche={handleNicheSelect}
            onBack={goBack}
            onGenerateSolution={handleGenerateCustomSolution}
          />
        )}

        {/* Step 3: Solution Preview */}
        {step === 'solution' && (
          <div className="p-8 max-w-6xl mx-auto space-y-8">
            {/* Back button */}
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <span>←</span>
              <span>{tt('Back', 'Geri')}</span>
            </button>

            {/* Loading state */}
            {isLoading && (
              <div className="text-center py-20 space-y-6">
                <div className="text-6xl animate-pulse">🤖</div>
                <div className="text-xl font-medium text-white">
                  {tt('AI is creating your agency solution...', 'AI ajans çözümünüzü oluşturuyor...')}
                </div>
                <p className="text-gray-400">
                  {tt(
                    'Analyzing market data, matching workflows, and building your business package.',
                    'Pazar verilerini analiz ediyor, workflow\'ları eşleştiriyor ve iş paketinizi oluşturuyor.'
                  )}
                </p>
                <div className="w-64 mx-auto bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-6 text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <div className="text-red-300 mb-4">{error}</div>
                <button
                  onClick={goBack}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition"
                >
                  {tt('Try Again', 'Tekrar Dene')}
                </button>
              </div>
            )}

            {/* Solution display */}
            {solution && !isLoading && (
              <>
                {/* Header */}
                <div className="text-center space-y-4">
                  <div className="text-6xl">{selectedSector?.icon || '🎯'}</div>
                  <h1 className="text-3xl font-bold text-white">
                    {getLocalized(solution.name, language)}
                  </h1>
                  <p className="text-gray-400 max-w-2xl mx-auto">
                    {getLocalized(solution.description, language)}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm px-3 py-1 bg-green-900/30 text-green-400 rounded-full">
                      {Math.round(solution.confidence * 100)}% {tt('confidence', 'güven')}
                    </span>
                  </div>
                </div>

                {/* Service Packages */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-white">
                    {tt('Service Packages', 'Servis Paketleri')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {solution.servicePackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`bg-gray-800/50 border rounded-lg p-6 ${
                          pkg.tier === 'standard' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700'
                        }`}
                      >
                        {pkg.tier === 'standard' && (
                          <div className="text-xs text-blue-400 font-medium mb-2">
                            {tt('MOST POPULAR', 'EN POPÜLER')}
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {getLocalized(pkg.name, language)}
                        </h3>
                        <div className="mb-4">
                          <div className="text-3xl font-bold text-white">
                            {formatCurrency(pkg.monthlyFee, pkg.currency)}
                            <span className="text-sm font-normal text-gray-400">/mo</span>
                          </div>
                          {pkg.setupFee > 0 && (
                            <div className="text-sm text-gray-500">
                              + {formatCurrency(pkg.setupFee, pkg.currency)} {tt('setup', 'kurulum')}
                            </div>
                          )}
                        </div>
                        <ul className="space-y-2 mb-4">
                          {pkg.features.slice(0, 5).map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                              <span className="text-green-400">✓</span>
                              <span>{getLocalized(feature, language)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Workflows */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-white">
                    {tt('Recommended Workflows', 'Önerilen Workflow\'lar')} ({solution.recommendedWorkflows.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {solution.recommendedWorkflows.slice(0, 6).map((workflow) => (
                      <div
                        key={workflow.workflowId}
                        className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-center gap-3"
                      >
                        <span className={`px-2 py-1 text-xs rounded ${
                          workflow.priority === 'required' ? 'bg-red-900/30 text-red-400' :
                          workflow.priority === 'recommended' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {workflow.priority === 'required' ? tt('Required', 'Gerekli') :
                           workflow.priority === 'recommended' ? tt('Recommended', 'Önerilen') :
                           tt('Optional', 'Opsiyonel')}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-white">{workflow.workflowName}</div>
                          <div className="text-xs text-gray-500">{workflow.estimatedSetupTime}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Customer */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
                  <h2 className="text-xl font-semibold text-white">
                    {tt('Target Customer', 'Hedef Müşteri')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">{tt('Profile', 'Profil')}</h3>
                      <p className="text-white font-medium">{getLocalized(solution.targetCustomer.name, language)}</p>
                      <p className="text-sm text-gray-400 mt-1">{getLocalized(solution.targetCustomer.description, language)}</p>
                      <div className="mt-2 text-sm text-green-400">
                        {tt('Budget', 'Bütçe')}: {formatCurrency(solution.targetCustomer.budget.min)} - {formatCurrency(solution.targetCustomer.budget.max)}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">{tt('Where to Find', 'Nerede Bulunur')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {solution.targetCustomer.whereToFind.map((place, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded">
                            {getLocalized(place, language)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sales Pitch Preview */}
                {solution.salesPitchTemplates.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                      <span>📧</span>
                      <span>{tt('Sales Pitch Template', 'Satış Pitch Şablonu')}</span>
                    </h2>
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">{tt('Subject:', 'Konu:')}</div>
                      <div className="text-white font-medium mb-4">
                        {getLocalized(solution.salesPitchTemplates[0].subject, language)}
                      </div>
                      <div className="text-sm text-gray-400 mb-1">{tt('Elevator Pitch:', '30 Saniye Pitch:')}</div>
                      <div className="text-gray-300 italic">
                        "{getLocalized(solution.salesPitchTemplates[0].elevator, language)}"
                      </div>
                    </div>
                  </div>
                )}

                {/* Council Validation Section */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>🏛️</span>
                        <span>{tt('AI Council Validation', 'AI Kurul Doğrulaması')}</span>
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {tt(
                          'Get strategic validation before deploying',
                          'Dağıtmadan önce stratejik doğrulama alın'
                        )}
                      </p>
                    </div>

                    {/* Council Badge or Review Button */}
                    <CouncilReviewButton
                      onRequestReview={requestCouncilValidation}
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
                      <div className="flex items-center gap-4">
                        <CouncilBadgeLarge
                          decision={councilReview.decision}
                          confidence={councilReview.confidence}
                          language={language}
                        />
                        {isCouncilApproved(councilReview) && (
                          <span className="text-green-400 text-sm">
                            ✓ {tt('Ready to deploy', 'Dağıtıma hazır')}
                          </span>
                        )}
                      </div>

                      <div className="bg-gray-900/50 rounded-lg p-4">
                        <p className="text-gray-300 text-sm">{councilReview.summary}</p>
                      </div>

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
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={goBack}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition"
                  >
                    {tt('Back', 'Geri')}
                  </button>
                  <button
                    onClick={deploySolution}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-3"
                  >
                    <span>🚀</span>
                    <span>{tt('Deploy Solution', 'Çözümü Dağıt')}</span>
                    {councilReview && isCouncilApproved(councilReview) && (
                      <CouncilBadge
                        decision={councilReview.decision}
                        compact
                        language={language}
                      />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Deployment */}
        {step === 'deploy' && (
          <div className="p-8 max-w-2xl mx-auto">
            <div className="text-center py-12 space-y-6">
              {deployStatus === 'deploying' && (
                <>
                  <div className="text-6xl animate-bounce">🚀</div>
                  <h2 className="text-2xl font-bold text-white">
                    {tt('Deploying Your Agency...', 'Ajansınız Dağıtılıyor...')}
                  </h2>
                  <p className="text-gray-400">
                    {tt('Installing workflows and configuring your solution.', 'Workflow\'lar kuruluyor ve çözümünüz yapılandırılıyor.')}
                  </p>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${deployProgress}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-500">{deployProgress}%</div>
                </>
              )}

              {deployStatus === 'success' && (
                <>
                  <div className="text-6xl animate-bounce">🎉</div>
                  <h2 className="text-2xl font-bold text-white">
                    {tt('Your Agency is Ready!', 'Ajansınız Hazır!')}
                  </h2>
                  <p className="text-gray-400 max-w-md">
                    {tt(
                      'All workflows have been installed. You can now start acquiring clients.',
                      'Tüm workflow\'lar kuruldu. Artık müşteri edinmeye başlayabilirsiniz.'
                    )}
                  </p>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
                    <button
                      onClick={onClose}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium px-6 py-4 rounded-xl transition flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">📊</span>
                      <span>{tt('Go to Dashboard', 'Dashboard\'a Git')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        // Navigate to Market Radar will be handled by parent
                      }}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium px-6 py-4 rounded-xl transition flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">🎯</span>
                      <span>{tt('Find Clients', 'Müşteri Bul')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        // Navigate to Workflow Catalog will be handled by parent
                      }}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium px-6 py-4 rounded-xl transition flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">⚙️</span>
                      <span>{tt('View Workflows', 'Workflow\'ları Gör')}</span>
                    </button>
                  </div>

                  {/* Next Steps Checklist */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 w-full max-w-2xl mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>📋</span>
                      <span>{tt('Next Steps', 'Sonraki Adımlar')}</span>
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-sm">✓</span>
                        <span>{tt('Agency solution deployed', 'Ajans çözümü dağıtıldı')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center text-sm">2</span>
                        <span>{tt('Configure your n8n credentials', 'n8n kimlik bilgilerinizi yapılandırın')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center text-sm">3</span>
                        <span>{tt('Find your first client', 'İlk müşterinizi bulun')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-400 flex items-center justify-center text-sm">4</span>
                        <span>{tt('Create and send a proposal', 'Teklif oluşturun ve gönderin')}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {deployStatus === 'error' && (
                <>
                  <div className="text-6xl">⚠️</div>
                  <h2 className="text-2xl font-bold text-white">
                    {tt('Deployment Failed', 'Dağıtım Başarısız')}
                  </h2>
                  <p className="text-gray-400">
                    {tt('Something went wrong. Please try again.', 'Bir şeyler ters gitti. Lütfen tekrar deneyin.')}
                  </p>
                  <button
                    onClick={() => setDeployStatus('idle')}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition"
                  >
                    {tt('Try Again', 'Tekrar Dene')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Post Deploy Wizard Modal */}
      {showPostDeployWizard && solution && (
        <PostDeployWizard
          solution={solution}
          language={language as 'en' | 'tr'}
          onNavigate={(view) => {
            setShowPostDeployWizard(false);
            onNavigate?.(view);
            if (!onNavigate) onClose();
          }}
          onClose={() => setShowPostDeployWizard(false)}
        />
      )}
    </div>
  );
}
