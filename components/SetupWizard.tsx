import React, { useEffect, useMemo, useState } from 'react';
import type { Project, ProjectTab } from '../types';
import { getIntegrationStatuses, getRuntimeSettings, invoiceShelfLogin, seedDemoProjects, updateRuntimeSettings, upsertSecret } from '../services/api';
import { markSetupCompleted, readOnboardingState, writeOnboardingState, type AgencyType, type DemoScenario, type UIMode } from '../services/onboarding';
import { useI18n } from '../services/i18n';

type StepId = 1 | 2 | 3 | 4 | 5;

interface SetupWizardProps {
  onFinish: () => void;
  onProjectsUpdated: (projects: Project[]) => void;
  onOpenProject: (projectId: string, tab?: ProjectTab) => void;
  onUIModeChange: (mode: UIMode) => void;
}

const agencyTypeLabel: Record<AgencyType, { en: string; tr: string }> = {
  automation: { en: 'Automation Agency (general)', tr: 'Otomasyon Ajansı (genel)' },
  marketing_ops: { en: 'Marketing Ops Agency', tr: 'Marketing Ops Ajansı' },
  ecom_ops: { en: 'E-commerce Ops Agency', tr: 'E-ticaret Ops Ajansı' },
};

const scenarioLabel: Record<DemoScenario, { en: string; tr: string }> = {
  lead_crm_proposal_invoice_report: { en: 'Lead → CRM → Proposal → Invoice → Report', tr: 'Lead → CRM → Teklif → Fatura → Rapor' },
  marketing_lead_crm: { en: 'Marketing → Lead → CRM (fast demo)', tr: 'Marketing → Lead → CRM (hızlı demo)' },
  accounting_invoice_report: { en: 'Accounting → Invoice → Report', tr: 'Muhasebe → Fatura → Rapor' },
};

const defaultCouncilModels = [
  'openai/gpt-5-mini',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.5-flash',
].join(', ');

const defaultCouncilChairman = 'openai/gpt-5-mini';

type SetupMode = 'lite' | 'full';

const SetupWizard: React.FC<SetupWizardProps> = ({ onFinish, onProjectsUpdated, onOpenProject, onUIModeChange }) => {
  const { language, tt } = useI18n();
  const initial = useMemo(() => readOnboardingState(), []);
  const [step, setStep] = useState<StepId>(1);
  const [setupMode, setSetupMode] = useState<SetupMode>('lite'); // Default to lite mode for beginners

  const [agencyType, setAgencyType] = useState<AgencyType>(initial.agencyType);
  const [demoScenario, setDemoScenario] = useState<DemoScenario>(initial.demoScenario);
  const [uiMode, setUiMode] = useState<UIMode>(initial.uiMode);

  useEffect(() => {
    if (uiMode !== 'simple') return;
    if (step === 3 || step === 4) setStep(5);
  }, [step, uiMode]);

  const [runtimeSettings, setRuntimeSettings] = useState<{
    n8nBaseUrl: string;
    suitecrmBaseUrl: string;
    invoiceshelfBaseUrl: string;
    documensoBaseUrl: string;
    infisicalBaseUrl: string;
    councilModels: string;
    councilChairmanModel: string;
    councilStage2Enabled: boolean;
    activeEnvironment: 'Development' | 'Staging' | 'Production';
  } | null>(null);

  const [integrationStatus, setIntegrationStatus] = useState<{
    n8n: { connected: boolean; baseUrl: string; reason?: string };
    suitecrm: { connected: boolean; baseUrl: string; reason?: string };
    invoiceshelf: { connected: boolean; baseUrl: string; reason?: string };
    documenso: { connected: boolean; baseUrl: string; reason?: string };
    infisical: { connected: boolean; baseUrl: string; reason?: string };
    apify: { connected: boolean; baseUrl: string; reason?: string };
    postgres: { connected: boolean; baseUrl: string; reason?: string };
  } | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [geminiKey, setGeminiKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [enableCouncil, setEnableCouncil] = useState(true);
  const [councilModels, setCouncilModels] = useState(defaultCouncilModels);
  const [councilChairmanModel, setCouncilChairmanModel] = useState(defaultCouncilChairman);
  const [councilStage2Enabled, setCouncilStage2Enabled] = useState(false);

  const [n8nApiKey, setN8nApiKey] = useState('');

  const [suiteCrmUsername, setSuiteCrmUsername] = useState('');
  const [suiteCrmPassword, setSuiteCrmPassword] = useState('');

  const [documensoToken, setDocumensoToken] = useState('');

  const [invoiceShelfUsername, setInvoiceShelfUsername] = useState('');
  const [invoiceShelfPassword, setInvoiceShelfPassword] = useState('');

  const [infisicalToken, setInfisicalToken] = useState('');
  const [infisicalWorkspaceId, setInfisicalWorkspaceId] = useState('');
  const [infisicalSecretPath, setInfisicalSecretPath] = useState('/clients');

  const [apifyToken, setApifyToken] = useState('');
  const [apifyYoutubeActor, setApifyYoutubeActor] = useState('');
  const [apifyLeadsActor, setApifyLeadsActor] = useState('');

  const refresh = async (): Promise<{
    settings: NonNullable<typeof runtimeSettings>;
    statuses: NonNullable<typeof integrationStatus>;
  } | null> => {
    if (isRefreshing) return null;
    setIsRefreshing(true);
    setError(null);
    try {
      const [settings, statuses] = await Promise.all([getRuntimeSettings(), getIntegrationStatuses()]);
      setRuntimeSettings(settings);
      setIntegrationStatus(statuses);
      setCouncilModels(settings.councilModels || defaultCouncilModels);
      setCouncilChairmanModel(settings.councilChairmanModel || defaultCouncilChairman);
      setCouncilStage2Enabled(Boolean(settings.councilStage2Enabled));
      setInfisicalWorkspaceId(settings.infisicalWorkspaceId || '');
      setInfisicalSecretPath(settings.infisicalSecretPath || '/');
      return { settings, statuses };
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to load settings/status', 'Ayarlar/durum yüklenemedi'));
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const badge = (connected: boolean, reason?: string) => {
    if (connected) return { label: tt('Connected', 'Bağlı'), cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
    if (reason?.startsWith('Missing')) return { label: tt('Needs Config', 'Kurulum Gerekli'), cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' };
    return { label: tt('Offline', 'Kapalı'), cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  };

  const persistBasics = (patch?: Partial<{ agencyType: AgencyType; demoScenario: DemoScenario; uiMode: UIMode }>) => {
    const next = writeOnboardingState({
      agencyType,
      demoScenario,
      uiMode,
      ...(patch ?? {}),
    });
    setAgencyType(next.agencyType);
    setDemoScenario(next.demoScenario);
    setUiMode(next.uiMode);
    onUIModeChange(next.uiMode);
  };

  const saveAiKeys = async () => {
    setError(null);
    setMessage(null);
    try {
      const env = runtimeSettings?.activeEnvironment ?? 'Production';

      if (geminiKey.trim()) {
        await upsertSecret({ key: 'GEMINI_API_KEY', value: geminiKey.trim(), environment: env });
      }

      if (openRouterKey.trim()) {
        await upsertSecret({ key: 'OPENROUTER_API_KEY', value: openRouterKey.trim(), environment: env });
      }

      if (enableCouncil) {
        await updateRuntimeSettings({
          councilModels: councilModels.trim(),
          councilChairmanModel: councilChairmanModel.trim(),
          councilStage2Enabled: Boolean(councilStage2Enabled),
        });
      }

      setGeminiKey('');
      setOpenRouterKey('');
      await refresh();
      setMessage(
        tt(
          'Saved AI settings. Next: open the Management Board to test multi-model gates.',
          'AI ayarları kaydedildi. Sonraki: çoklu model gate’lerini test etmek için Yönetim Kurulu’nu aç.',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save AI settings', 'AI ayarları kaydedilemedi'));
    }
  };

  const saveN8nKey = async () => {
    setError(null);
    setMessage(null);
    try {
      const env = runtimeSettings?.activeEnvironment ?? 'Production';
      if (!n8nApiKey.trim()) throw new Error(tt('Missing N8N_API_KEY', 'N8N_API_KEY eksik'));
      await upsertSecret({ key: 'N8N_API_KEY', value: n8nApiKey.trim(), environment: env });
      setN8nApiKey('');
      const out = await refresh();
      const n8n = out?.statuses?.n8n;
      setMessage(
        n8n?.connected
          ? tt('n8n connected. Import/activate + execution feed are ready.', 'n8n bağlı. Import/activate + execution feed hazır.')
          : tt(
              `Saved N8N_API_KEY, but n8n test failed: ${n8n?.reason || 'Offline'}`,
              `N8N_API_KEY kaydedildi ama n8n testi başarısız: ${n8n?.reason || tt('Offline', 'Kapalı')}`,
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save N8N_API_KEY', 'N8N_API_KEY kaydedilemedi'));
    }
  };

  const saveSuiteCrm = async () => {
    setError(null);
    setMessage(null);
    try {
      const env = runtimeSettings?.activeEnvironment ?? 'Production';
      if (!suiteCrmUsername.trim() || !suiteCrmPassword.trim())
        throw new Error(tt('Missing SuiteCRM username/password', 'SuiteCRM kullanıcı adı/şifre eksik'));
      await upsertSecret({ key: 'SUITECRM_USERNAME', value: suiteCrmUsername.trim(), environment: env });
      await upsertSecret({ key: 'SUITECRM_PASSWORD', value: suiteCrmPassword.trim(), environment: env });
      setSuiteCrmUsername('');
      setSuiteCrmPassword('');
      const out = await refresh();
      const suitecrm = out?.statuses?.suitecrm;
      setMessage(
        suitecrm?.connected
          ? tt('SuiteCRM connected.', 'SuiteCRM bağlı.')
          : tt(
              `SuiteCRM saved, but test failed: ${suitecrm?.reason || 'Offline'}`,
              `SuiteCRM kaydedildi ama test başarısız: ${suitecrm?.reason || tt('Offline', 'Kapalı')}`,
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save SuiteCRM credentials', 'SuiteCRM bilgileri kaydedilemedi'));
    }
  };

  const saveDocumenso = async () => {
    setError(null);
    setMessage(null);
    try {
      const env = runtimeSettings?.activeEnvironment ?? 'Production';
      if (!documensoToken.trim()) throw new Error(tt('Missing DOCUMENSO_API_TOKEN', 'DOCUMENSO_API_TOKEN eksik'));
      await upsertSecret({ key: 'DOCUMENSO_API_TOKEN', value: documensoToken.trim(), environment: env });
      setDocumensoToken('');
      const out = await refresh();
      const documenso = out?.statuses?.documenso;
      setMessage(
        documenso?.connected
          ? tt('Documenso connected.', 'Documenso bağlı.')
          : tt(
              `Documenso saved, but test failed: ${documenso?.reason || 'Offline'}`,
              `Documenso kaydedildi ama test başarısız: ${documenso?.reason || tt('Offline', 'Kapalı')}`,
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save Documenso token', 'Documenso token kaydedilemedi'));
    }
  };

  const loginInvoiceShelf = async () => {
    setError(null);
    setMessage(null);
    try {
      if (!invoiceShelfUsername.trim() || !invoiceShelfPassword.trim())
        throw new Error(tt('Missing InvoiceShelf username/password', 'InvoiceShelf kullanıcı adı/şifre eksik'));
      await invoiceShelfLogin({ username: invoiceShelfUsername.trim(), password: invoiceShelfPassword.trim(), deviceName: 'agencyos' });
      setInvoiceShelfUsername('');
      setInvoiceShelfPassword('');
      const out = await refresh();
      const invoiceshelf = out?.statuses?.invoiceshelf;
      setMessage(
        invoiceshelf?.connected
          ? tt(
              'InvoiceShelf connected. You can now create invoices from Board pricing.',
              'InvoiceShelf bağlı. Artık Yönetim Kurulu fiyatlamasından fatura oluşturabilirsin.',
            )
          : tt(
              `InvoiceShelf token saved, but test failed: ${invoiceshelf?.reason || 'Offline'}`,
              `InvoiceShelf token kaydedildi ama test başarısız: ${invoiceshelf?.reason || tt('Offline', 'Kapalı')}`,
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('InvoiceShelf login failed', 'InvoiceShelf giriş başarısız'));
    }
  };

  const saveInfisical = async () => {
    setError(null);
    setMessage(null);
    try {
      const env = runtimeSettings?.activeEnvironment ?? 'Production';
      if (infisicalToken.trim()) {
        await upsertSecret({ key: 'INFISICAL_TOKEN', value: infisicalToken.trim(), environment: env });
      }
      await updateRuntimeSettings({
        infisicalWorkspaceId: infisicalWorkspaceId.trim(),
        infisicalSecretPath: infisicalSecretPath.trim() || '/',
      });
      setInfisicalToken('');
      const out = await refresh();
      const infisical = out?.statuses?.infisical;
      setMessage(
        infisical?.connected
          ? tt(
              'Infisical reachable. Next: use Settings → Vault to sync secrets.',
              'Infisical erişilebilir. Sonraki: Ayarlar → Vault ile secret’ları senkronla.',
            )
          : tt(
              `Infisical saved, but test failed: ${infisical?.reason || 'Offline'}`,
              `Infisical kaydedildi ama test başarısız: ${infisical?.reason || tt('Offline', 'Kapalı')}`,
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save Infisical settings', 'Infisical ayarları kaydedilemedi'));
    }
  };

  const saveApify = async () => {
    setError(null);
    setMessage(null);
    try {
      const env = runtimeSettings?.activeEnvironment ?? 'Production';
      if (!apifyToken.trim()) throw new Error(tt('Missing APIFY_API_TOKEN', 'APIFY_API_TOKEN eksik'));
      await upsertSecret({ key: 'APIFY_API_TOKEN', value: apifyToken.trim(), environment: env });
      if (apifyYoutubeActor.trim()) {
        await upsertSecret({ key: 'APIFY_YOUTUBE_TRENDS_ACTOR', value: apifyYoutubeActor.trim(), environment: env });
      }
      if (apifyLeadsActor.trim()) {
        await upsertSecret({ key: 'APIFY_GOOGLE_MAPS_LEADS_ACTOR', value: apifyLeadsActor.trim(), environment: env });
      }
      setApifyToken('');
      setApifyYoutubeActor('');
      setApifyLeadsActor('');
      const out = await refresh();
      const apify = out?.statuses?.apify;
      const apifyReason = String(apify?.reason ?? '').trim();
      setMessage(
        apify?.connected
          ? tt('Apify connected. Market Radar can fetch real trends/leads.', 'Apify bağlı. Pazar Radarı artık gerçek trend/lead çekebilir.')
          : apifyReason.startsWith('Missing APIFY_')
            ? tt(
                `Apify token saved. Add actor IDs to enable real data. (${apifyReason})`,
                `Apify token kaydedildi. Gerçek veri için actor ID ekle. (${apifyReason})`,
              )
            : tt(
                `Apify saved, but status check failed: ${apify?.reason || 'Offline'}`,
                `Apify kaydedildi ama durum testi başarısız: ${apify?.reason || tt('Offline', 'Kapalı')}`,
              ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save Apify', 'Apify kaydedilemedi'));
    }
  };

  const loadDemo = async () => {
    setError(null);
    setMessage(null);
    try {
      const out = await seedDemoProjects();
      onProjectsUpdated(out.projects);
      setMessage(
        out.createdIds.length
          ? tt(`Loaded ${out.createdIds.length} demo client(s).`, `${out.createdIds.length} demo müşteri yüklendi.`)
          : tt('Demo clients already exist.', 'Demo müşteriler zaten var.'),
      );
      if (out.projects[0]?.id) onOpenProject(out.projects[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to load demo', 'Demo yüklenemedi'));
    }
  };

  const finish = () => {
    persistBasics();
    markSetupCompleted();
    onFinish();
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">{tt('Setup Wizard', 'Kurulum Sihirbazı')}</h2>
            <p className="text-slate-400 mt-2 text-sm font-medium">
              {uiMode === 'simple'
                ? tt(
                    '2 minutes: choose your agency model, turn on AI CEO, then load demo clients.',
                    '2 dakikada: ajans modelini seç, AI CEO’yu aç, demo müşterileri yükle.',
                  )
                : tt(
                    '10 minutes to run your AI automation agency: connect tools, seed demo clients, then run the first project.',
                    '10 dakikada AI otomasyon ajansını ayağa kaldır: araçları bağla, demo müşterileri yükle, ilk projeyi çalıştır.',
                  )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {uiMode === 'advanced' && (
              <button
                onClick={() => refresh()}
                disabled={isRefreshing}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
              >
                {isRefreshing ? tt('Refreshing…', 'Yenileniyor…') : tt('Refresh Status', 'Durumu Yenile')}
              </button>
            )}
            <button
              onClick={finish}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
            >
              {tt('Finish (Skip)', 'Bitir (Atla)')}
            </button>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`p-6 rounded-[36px] border shadow-2xl ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{error ?? message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Steps', 'Adımlar')}</p>
            <div className="mt-6 space-y-3">
              {(() => {
                const steps =
                  uiMode === 'simple'
                    ? ([
                        { id: 1 as const, title: tt('Profile', 'Profil'), desc: tt('Agency type + demo flow', 'Ajans tipi + demo akış') },
                        { id: 2 as const, title: 'AI', desc: tt('AI CEO + council settings', 'AI CEO + kurul ayarları') },
                        { id: 5 as const, title: 'Demo', desc: tt('Load 2 demo clients', '2 demo müşteri yükle') },
                      ] as const)
                    : ([
                        { id: 1 as const, title: tt('Profile', 'Profil'), desc: tt('Agency type + demo flow', 'Ajans tipi + demo akış') },
                        { id: 2 as const, title: 'AI', desc: tt('Board + proposal engine', 'Yönetim Kurulu + teklif motoru') },
                        { id: 3 as const, title: 'n8n', desc: tt('Workflow install + monitor', 'Workflow kurulum + izleme') },
                        { id: 4 as const, title: tt('Business Apps', 'İş Uygulamaları'), desc: tt('CRM / Contract / Invoice / Vault', 'CRM / Sözleşme / Fatura / Vault') },
                        { id: 5 as const, title: 'Demo', desc: tt('Load demo clients + run', 'Demo müşterileri yükle + çalıştır') },
                      ] as const);

                return steps.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setStep(s.id)}
                    className={`w-full text-left p-5 rounded-3xl border transition-all ${step === s.id ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-200 shadow-xl' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black uppercase tracking-tight">{s.title}</p>
                      <span className="text-[10px] font-black text-slate-500">
                        {idx + 1}/{steps.length}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-slate-500 mt-2">{s.desc}</p>
                  </button>
                ));
              })()}
            </div>
          </div>

          {uiMode === 'advanced' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Integration Status', 'Entegrasyon Durumu')}</p>
              <div className="mt-5 space-y-3">
                {integrationStatus ? (
                  (['n8n', 'suitecrm', 'documenso', 'invoiceshelf', 'infisical', 'apify', 'postgres'] as const).map((key) => {
                    const s = integrationStatus[key];
                    const b = badge(Boolean(s?.connected), s?.reason);
                    return (
                      <div key={key} className="flex items-center justify-between gap-4 bg-slate-950/40 border border-slate-800 rounded-2xl px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white uppercase tracking-tight">{key}</p>
                          <p className="text-[10px] text-slate-600 font-mono truncate">{s?.baseUrl || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {s?.baseUrl && /^https?:\/\//.test(s.baseUrl) && (
                            <a
                              href={s.baseUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
                              title={tt('Open in new tab', 'Yeni sekmede aç')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tt('Open', 'Aç')}
                            </a>
                          )}
                          <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${b.cls}`}>{b.label}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-slate-600 text-xs font-black uppercase tracking-widest py-10">
                    {tt('API offline. Start `npm run dev:up`.', 'API kapalı. Başlat: `npm run dev:up`.')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-8">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] p-10 shadow-2xl">
            {step === 1 && (
              <div className="space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('1) Agency Profile', '1) Ajans Profili')}</h3>
                  <p className="text-slate-400 text-sm mt-2">{tt('Pick a template. You can change this later.', 'Bir şablon seç. Sonradan değiştirebilirsin.')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(agencyTypeLabel) as AgencyType[]).map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setAgencyType(id);
                        persistBasics({ agencyType: id });
                      }}
                      className={`p-6 rounded-[32px] border text-left transition-all ${agencyType === id ? 'bg-indigo-600/10 border-indigo-500/20 text-white shadow-xl' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <p className="text-sm font-black uppercase tracking-tight">{agencyTypeLabel[id][language]}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-2">
                        {id === 'automation'
                          ? tt('General automation + delivery loop.', 'Genel otomasyon + teslimat döngüsü.')
                          : id === 'marketing_ops'
                            ? tt('Leads, reporting, CRM, campaigns.', 'Lead, raporlama, CRM, kampanyalar.')
                            : tt('Orders, refunds, fulfillment, payments.', 'Sipariş, iade, fulfillment, ödemeler.')}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(scenarioLabel) as DemoScenario[]).map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setDemoScenario(id);
                        persistBasics({ demoScenario: id });
                      }}
                      className={`p-6 rounded-[32px] border text-left transition-all ${demoScenario === id ? 'bg-indigo-600/10 border-indigo-500/20 text-white shadow-xl' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <p className="text-sm font-black uppercase tracking-tight">{scenarioLabel[id][language]}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-2">
                        {id === 'lead_crm_proposal_invoice_report'
                          ? tt('Best “agency owner” story.', 'Ajans sahibi için en iyi demo hikayesi.')
                          : id === 'marketing_lead_crm'
                            ? tt('Fastest demo, fewer integrations.', 'En hızlı demo, daha az entegrasyon.')
                            : tt('Finance-first workflow story.', 'Finans odaklı workflow hikayesi.')}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Setup Mode Selection */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-500/20 rounded-[36px] p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">⚡</span>
                    <p className="text-sm font-black text-white uppercase tracking-widest">{tt('Setup Mode', 'Kurulum Modu')}</p>
                  </div>
                  <p className="text-slate-400 text-xs mb-6">{tt('Choose how you want to set up your agency. You can always add integrations later.', 'Ajansını nasıl kurmak istediğini seç. Entegrasyonları sonra da ekleyebilirsin.')}</p>
                  <div className="flex flex-col md:flex-row gap-4">
                    <button
                      onClick={() => setSetupMode('lite')}
                      className={`flex-1 p-6 rounded-[28px] border text-left transition-all ${setupMode === 'lite' ? 'bg-green-600/20 border-green-500/40 text-white shadow-lg shadow-green-500/10' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">🚀</span>
                        <p className="text-sm font-black uppercase tracking-tight">{tt('Lite Mode', 'Lite Mod')}</p>
                        <span className="bg-green-500/20 text-green-400 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">{tt('Recommended', 'Önerilen')}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{tt('Start immediately with demo data. No API keys required. Perfect for exploring AgencyOS.', 'Demo verilerle hemen başla. API key gerekmez. AgencyOS\'u keşfetmek için mükemmel.')}</p>
                    </button>
                    <button
                      onClick={() => setSetupMode('full')}
                      className={`flex-1 p-6 rounded-[28px] border text-left transition-all ${setupMode === 'full' ? 'bg-purple-600/20 border-purple-500/40 text-white shadow-lg shadow-purple-500/10' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">⚙️</span>
                        <p className="text-sm font-black uppercase tracking-tight">{tt('Full Setup', 'Tam Kurulum')}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{tt('Configure AI models, n8n, CRM, and other integrations. For production use.', 'AI modelleri, n8n, CRM ve diğer entegrasyonları yapılandır. Üretim kullanımı için.')}</p>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('UI Mode', 'Arayüz Modu')}</p>
                  <div className="mt-4 flex flex-col md:flex-row gap-4">
                    <button
                      onClick={() => {
                        setUiMode('simple');
                        persistBasics({ uiMode: 'simple' });
                      }}
                      className={`flex-1 p-6 rounded-[28px] border text-left transition-all ${uiMode === 'simple' ? 'bg-indigo-600/10 border-indigo-500/20 text-white' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <p className="text-sm font-black uppercase tracking-tight">{tt('Simple', 'Basit')}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-2">{tt('Hide advanced panels. Focus on "next action".', 'Gelişmiş panelleri gizler. "Sonraki aksiyon"a odaklanır.')}</p>
                    </button>
                    <button
                      onClick={() => {
                        setUiMode('advanced');
                        persistBasics({ uiMode: 'advanced' });
                      }}
                      className={`flex-1 p-6 rounded-[28px] border text-left transition-all ${uiMode === 'advanced' ? 'bg-indigo-600/10 border-indigo-500/20 text-white' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <p className="text-sm font-black uppercase tracking-tight">{tt('Advanced', 'Gelişmiş')}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-2">{tt('Show all tools (Board, Documents view, etc.).', 'Tüm araçları gösterir (Yönetim Kurulu, Dokümanlar, vb.).')}</p>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setStep(setupMode === 'lite' ? 5 : 2)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95"
                  >
                    {setupMode === 'lite'
                      ? tt('Start with Demo Data', 'Demo Verilerle Başla')
                      : tt('Next', 'İleri') + ' → AI'
                    }
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('2) AI (Board + Documents)', '2) AI (Yönetim Kurulu + Dokümanlar)')}</h3>
                  <p className="text-slate-400 text-sm mt-2">
                    {tt(
                      'Minimum: add `GEMINI_API_KEY` (proposal/risk). Optional: add `OPENROUTER_API_KEY` for multi-model council.',
                      'Minimum: `GEMINI_API_KEY` ekle (teklif/risk). Opsiyonel: multi-model council için `OPENROUTER_API_KEY` ekle.',
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gemini</p>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="GEMINI_API_KEY"
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <p className="mt-3 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                      {tt(
                        'Used for intake analysis + proposal + council fallback.',
                        'Intake analizi + teklif + Yönetim Kurulu fallback için kullanılır.',
                      )}
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('OpenRouter (optional)', 'OpenRouter (opsiyonel)')}</p>
                    <input
                      type="password"
                      value={openRouterKey}
                      onChange={(e) => setOpenRouterKey(e.target.value)}
                      placeholder="OPENROUTER_API_KEY"
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <p className="mt-3 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                      {tt(
                        'Enables “multi-model council” if you set models.',
                        'Model seçersen “çoklu model council”i aktif eder.',
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 space-y-4">
                  <label className="flex items-center gap-3 text-slate-200 text-xs font-black uppercase tracking-widest">
                    <input type="checkbox" checked={enableCouncil} onChange={(e) => setEnableCouncil(e.target.checked)} />
                    {tt('Enable multi-model council (OpenRouter)', 'Çoklu model council’i etkinleştir (OpenRouter)')}
                  </label>
                  <textarea
                    value={councilModels}
                    onChange={(e) => setCouncilModels(e.target.value)}
                    placeholder="COUNCIL_MODELS (comma-separated)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono min-h-[90px]"
                    disabled={!enableCouncil}
                  />
                  <input
                    value={councilChairmanModel}
                    onChange={(e) => setCouncilChairmanModel(e.target.value)}
                    placeholder="COUNCIL_CHAIRMAN_MODEL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    disabled={!enableCouncil}
                  />
                  <label className="flex items-center gap-3 text-slate-300 text-xs font-black uppercase tracking-widest">
                    <input type="checkbox" checked={councilStage2Enabled} onChange={(e) => setCouncilStage2Enabled(e.target.checked)} disabled={!enableCouncil} />
                    {tt('Stage 2 peer ranking (higher quality, higher cost)', 'Aşama 2 karşılıklı puanlama (daha iyi kalite, daha yüksek maliyet)')}
                  </label>
                </div>

                <div className="flex justify-between gap-3">
                  <button onClick={() => setStep(1)} className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                    {tt('← Back', '← Geri')}
                  </button>
                  <div className="flex gap-3">
                    <button onClick={saveAiKeys} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95">
                      {tt('Save AI Settings', 'AI Ayarlarını Kaydet')}
                    </button>
                    <button
                      onClick={() => setStep(uiMode === 'simple' ? 5 : 3)}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                    >
                      {uiMode === 'simple' ? tt('Next → Demo', 'İleri → Demo') : tt('Next → n8n', 'İleri → n8n')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {uiMode === 'advanced' && step === 3 && (
              <div className="space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('3) n8n (Workflow Engine)', '3) n8n (Workflow Motoru)')}</h3>
                  <p className="text-slate-400 text-sm mt-2">
                    {tt('Needed for one-click import/activate + monitoring. Base URL:', 'Tek tık import/activate + izleme için gerekir. Base URL:')}{' '}
                    <a
                      href={runtimeSettings?.n8nBaseUrl || 'http://localhost:5678'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-slate-300 hover:text-white underline decoration-slate-700 hover:decoration-slate-500 transition-all"
                    >
                      {runtimeSettings?.n8nBaseUrl || 'http://localhost:5678'}
                    </a>
                  </p>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">N8N_API_KEY</p>
                  <ol className="mt-4 space-y-2 text-slate-300 text-sm font-medium">
                    <li>{tt('1) Open n8n → Settings → API Keys → Create', '1) n8n → Settings → API Keys → Create')}</li>
                    <li>{tt('2) Paste key below', '2) Anahtarı aşağıya yapıştır')}</li>
                    <li>{tt('3) Save + test', '3) Kaydet + test et')}</li>
                  </ol>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="password"
                      value={n8nApiKey}
                      onChange={(e) => setN8nApiKey(e.target.value)}
                      placeholder="N8N_API_KEY"
                      className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={saveN8nKey}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95"
                    >
                      {tt('Save + Test', 'Kaydet + Test Et')}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <button onClick={() => setStep(2)} className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                    {tt('← Back', '← Geri')}
                  </button>
                  <button onClick={() => setStep(4)} className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                    {tt('Next → Business Apps', 'İleri → İş Uygulamaları')}
                  </button>
                </div>
              </div>
            )}

            {uiMode === 'advanced' && step === 4 && (
              <div className="space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('4) Business Apps (optional)', '4) İş Uygulamaları (opsiyonel)')}</h3>
                  <p className="text-slate-400 text-sm mt-2">{tt('You can skip these and still run workflows + council.', 'Bunları atlayıp yine de workflow + council çalıştırabilirsin.')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SuiteCRM</p>
                    <a
                      href={runtimeSettings?.suitecrmBaseUrl || 'http://localhost:8091'}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-slate-600 hover:text-slate-300 font-black uppercase tracking-widest mt-2 underline decoration-slate-800 hover:decoration-slate-600 transition-all"
                    >
                      {runtimeSettings?.suitecrmBaseUrl || 'http://localhost:8091'}
                    </a>
                    <input
                      value={suiteCrmUsername}
                      onChange={(e) => setSuiteCrmUsername(e.target.value)}
                      placeholder="SUITECRM_USERNAME"
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                      type="password"
                      value={suiteCrmPassword}
                      onChange={(e) => setSuiteCrmPassword(e.target.value)}
                      placeholder="SUITECRM_PASSWORD"
                      className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button onClick={saveSuiteCrm} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                      {tt('Save SuiteCRM', 'SuiteCRM Kaydet')}
                    </button>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Documenso</p>
                    <a
                      href={runtimeSettings?.documensoBaseUrl || 'http://localhost:8092'}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-slate-600 hover:text-slate-300 font-black uppercase tracking-widest mt-2 underline decoration-slate-800 hover:decoration-slate-600 transition-all"
                    >
                      {runtimeSettings?.documensoBaseUrl || 'http://localhost:8092'}
                    </a>
                    <input
                      type="password"
                      value={documensoToken}
                      onChange={(e) => setDocumensoToken(e.target.value)}
                      placeholder="DOCUMENSO_API_TOKEN"
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button onClick={saveDocumenso} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                      {tt('Save Documenso', 'Documenso Kaydet')}
                    </button>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">InvoiceShelf</p>
                    <a
                      href={runtimeSettings?.invoiceshelfBaseUrl || 'http://localhost:8090'}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-slate-600 hover:text-slate-300 font-black uppercase tracking-widest mt-2 underline decoration-slate-800 hover:decoration-slate-600 transition-all"
                    >
                      {runtimeSettings?.invoiceshelfBaseUrl || 'http://localhost:8090'}
                    </a>
                    <input
                      value={invoiceShelfUsername}
                      onChange={(e) => setInvoiceShelfUsername(e.target.value)}
                      placeholder={tt('InvoiceShelf username/email', 'InvoiceShelf kullanıcı adı/e-posta')}
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                      type="password"
                      value={invoiceShelfPassword}
                      onChange={(e) => setInvoiceShelfPassword(e.target.value)}
                      placeholder={tt('InvoiceShelf password', 'InvoiceShelf şifre')}
                      className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button onClick={loginInvoiceShelf} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                      {tt('Login + Save Token', 'Giriş Yap + Token Kaydet')}
                    </button>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Infisical</p>
                    <a
                      href={runtimeSettings?.infisicalBaseUrl || 'http://localhost:8081'}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-slate-600 hover:text-slate-300 font-black uppercase tracking-widest mt-2 underline decoration-slate-800 hover:decoration-slate-600 transition-all"
                    >
                      {runtimeSettings?.infisicalBaseUrl || 'http://localhost:8081'}
                    </a>
                    <input
                      type="password"
                      value={infisicalToken}
                      onChange={(e) => setInfisicalToken(e.target.value)}
                      placeholder="INFISICAL_TOKEN"
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                      value={infisicalWorkspaceId}
                      onChange={(e) => setInfisicalWorkspaceId(e.target.value)}
                      placeholder="INFISICAL_WORKSPACE_ID"
                      className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                    <input
                      value={infisicalSecretPath}
                      onChange={(e) => setInfisicalSecretPath(e.target.value)}
                      placeholder="INFISICAL_SECRET_PATH (e.g. /clients)"
                      className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                    <button onClick={saveInfisical} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                      {tt('Save Infisical', 'Infisical Kaydet')}
                    </button>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Apify</p>
                    <a
                      href="https://console.apify.com"
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-slate-600 hover:text-slate-300 font-black uppercase tracking-widest mt-2 underline decoration-slate-800 hover:decoration-slate-600 transition-all"
                    >
                      https://console.apify.com
                    </a>
                    <input
                      type="password"
                      value={apifyToken}
                      onChange={(e) => setApifyToken(e.target.value)}
                      placeholder="APIFY_API_TOKEN"
                      className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                      value={apifyYoutubeActor}
                      onChange={(e) => setApifyYoutubeActor(e.target.value)}
                      placeholder={tt('APIFY_YOUTUBE_TRENDS_ACTOR (optional)', 'APIFY_YOUTUBE_TRENDS_ACTOR (opsiyonel)')}
                      className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                    <input
                      value={apifyLeadsActor}
                      onChange={(e) => setApifyLeadsActor(e.target.value)}
                      placeholder={tt('APIFY_GOOGLE_MAPS_LEADS_ACTOR (optional)', 'APIFY_GOOGLE_MAPS_LEADS_ACTOR (opsiyonel)')}
                      className="mt-3 w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                    <button onClick={saveApify} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                      {tt('Save Apify', 'Apify Kaydet')}
                    </button>
                    <p className="mt-3 text-[10px] text-slate-600 font-bold">
                      {tt('Tip: actor IDs can be a full apify.com URL or "user~actor".', 'İpucu: actor ID, apify.com URL’i veya "user~actor" olabilir.')}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <button onClick={() => setStep(3)} className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                    {tt('← Back', '← Geri')}
                  </button>
                  <button onClick={() => setStep(5)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95">
                    {tt('Next → Demo', 'İleri → Demo')}
                  </button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('5) Load Demo Clients', '5) Demo Müşterileri Yükle')}</h3>
                  <p className="text-slate-400 text-sm mt-2">
                    {tt(
                      'This will create 2 example clients and open the first project. Then click “Run Revenue Machine”.',
                      'Bu işlem 2 örnek müşteri oluşturur ve ilk projeyi açar. Sonra “Gelir Makinesini Çalıştır”a tıkla.',
                    )}
                  </p>
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8">
                  <button onClick={loadDemo} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-6 rounded-[30px] transition-all uppercase tracking-[0.2em] text-[10px] shadow-2xl border border-green-400/20 active:scale-95">
                    {tt('Load 2 Demo Clients', '2 Demo Müşteri Yükle')}
                  </button>
                  <p className="mt-4 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                    {tt('After loading: open a project → click', 'Yükledikten sonra: bir proje aç → tıkla')}{' '}
                    <span className="text-slate-300">{tt('Run Revenue Machine', 'Gelir Makinesini Çalıştır')}</span>.
                  </p>
                </div>

                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => setStep(setupMode === 'lite' ? 1 : (uiMode === 'simple' ? 2 : 4))}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                  >
                    {tt('← Back', '← Geri')}
                  </button>
                  <button onClick={finish} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95">
                    {tt('Finish Setup', 'Kurulumu Bitir')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
