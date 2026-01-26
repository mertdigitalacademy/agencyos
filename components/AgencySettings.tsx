
import React, { useEffect, useState } from 'react';
import { AgencySecret, TeamMember } from '../types';
import {
  deleteSecretById,
  getIntegrationStatuses,
  getRuntimeSettings,
  listInfisicalSecrets,
  listSecrets,
  pullInfisicalSync,
  pushInfisicalSync,
  updateRuntimeSettings,
  upsertSecret,
} from '../services/api';
import { useI18n } from '../services/i18n';

interface AgencySettingsProps {
  secrets: AgencySecret[];
  onUpdateSecrets: (secrets: AgencySecret[]) => void;
  teamMembers: TeamMember[];
}

const COMMON_SECRET_KEYS = [
  'N8N_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'ASSISTANT_MODEL',
  'AGENCYOS_DATABASE_URL',
  'APIFY_API_TOKEN',
  'APIFY_YOUTUBE_TRENDS_ACTOR',
  'APIFY_GOOGLE_MAPS_LEADS_ACTOR',
  'SUITECRM_USERNAME',
  'SUITECRM_PASSWORD',
  'DOCUMENSO_API_TOKEN',
  'INVOICESHELF_TOKEN',
  'INFISICAL_TOKEN',
] as const;

const AgencySettings: React.FC<AgencySettingsProps> = ({ secrets, onUpdateSecrets, teamMembers }) => {
  const { language, tt } = useI18n();
  const [activeTab, setActiveTab] = useState<'Infrastructure' | 'Vault' | 'Team'>('Infrastructure');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [activeEnv, setActiveEnv] = useState<'Development' | 'Staging' | 'Production'>('Production');
  const [quickN8nApiKey, setQuickN8nApiKey] = useState('');
  const [quickN8nMessage, setQuickN8nMessage] = useState<string | null>(null);
  const [quickN8nError, setQuickN8nError] = useState<string | null>(null);
  const [isSavingQuickN8n, setIsSavingQuickN8n] = useState(false);
  const [testingInteg, setTestingInteg] = useState<string | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<{
    activeEnvironment: 'Development' | 'Staging' | 'Production';
    n8nBaseUrl: string;
    suitecrmBaseUrl: string;
    invoiceshelfBaseUrl: string;
    documensoBaseUrl: string;
    infisicalBaseUrl: string;
    infisicalWorkspaceId: string;
    infisicalSecretPath: string;
    infisicalEnvDevelopmentSlug: string;
    infisicalEnvStagingSlug: string;
    infisicalEnvProductionSlug: string;
    councilModels: string;
    councilChairmanModel: string;
    councilStage2Enabled: boolean;
  } | null>(null);
  const [editingUrls, setEditingUrls] = useState({
    n8nBaseUrl: '',
    suitecrmBaseUrl: '',
    invoiceshelfBaseUrl: '',
    documensoBaseUrl: '',
    infisicalBaseUrl: '',
    infisicalWorkspaceId: '',
    infisicalSecretPath: '/',
    infisicalEnvDevelopmentSlug: 'dev',
    infisicalEnvStagingSlug: 'staging',
    infisicalEnvProductionSlug: 'prod',
    councilModels: '',
    councilChairmanModel: '',
    councilStage2Enabled: true,
  });
  const [isSavingUrls, setIsSavingUrls] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    n8n: { connected: boolean; baseUrl: string; reason?: string };
    suitecrm: { connected: boolean; baseUrl: string; reason?: string };
    invoiceshelf: { connected: boolean; baseUrl: string; reason?: string };
    documenso: { connected: boolean; baseUrl: string; reason?: string };
    infisical: { connected: boolean; baseUrl: string; reason?: string };
    apify: { connected: boolean; baseUrl: string; reason?: string };
    postgres: { connected: boolean; baseUrl: string; reason?: string };
  } | null>(null);

  const [infisicalRemote, setInfisicalRemote] = useState<{
    workspaceId: string;
    environmentName: 'Development' | 'Staging' | 'Production';
    environmentSlug: string;
    secretPath: string;
    secrets: Array<{ key: string; value: string; hasValue: boolean; comment: string; version: number }>;
  } | null>(null);
  const [isLoadingInfisicalRemote, setIsLoadingInfisicalRemote] = useState(false);
  const [isPushingInfisical, setIsPushingInfisical] = useState(false);
  const [isPullingInfisical, setIsPullingInfisical] = useState(false);
  const [infisicalScope, setInfisicalScope] = useState<'active' | 'all'>('active');
  const [infisicalMessage, setInfisicalMessage] = useState<string | null>(null);
  const [infisicalError, setInfisicalError] = useState<string | null>(null);

  const refreshSecrets = async () => {
    const remote = await listSecrets();
    onUpdateSecrets(remote.map(s => ({
      id: s.id,
      key: s.key,
      value: s.value,
      environment: s.environment,
      lastUpdated: s.lastUpdated,
    })));
  };

  const refreshInfisical = async (env?: 'Development' | 'Staging' | 'Production') => {
    const targetEnv = env ?? activeEnv;
    setIsLoadingInfisicalRemote(true);
    setInfisicalError(null);
    try {
      const remote = await listInfisicalSecrets({ env: targetEnv, recursive: false, includeValues: false });
      setInfisicalRemote({
        workspaceId: remote.workspaceId,
        environmentName: remote.environmentName,
        environmentSlug: remote.environmentSlug,
        secretPath: remote.secretPath,
        secrets: remote.secrets,
      });
    } catch (e) {
      setInfisicalRemote(null);
      setInfisicalError(e instanceof Error ? e.message : tt('Infisical request failed', 'Infisical isteği başarısız'));
    } finally {
      setIsLoadingInfisicalRemote(false);
    }
  };

  const handleAddSecret = async () => {
    if (!newKey || !newValue) return;
    await upsertSecret({ key: newKey.toUpperCase(), value: newValue, environment: activeEnv });
    setNewKey('');
    setNewValue('');
    await refreshSecrets();
  };

  const saveQuickN8nApiKey = async () => {
    if (isSavingQuickN8n) return;
    setQuickN8nMessage(null);
    setQuickN8nError(null);
    const value = String(quickN8nApiKey || '').trim();
    if (!value) return;
    setIsSavingQuickN8n(true);
    try {
      await upsertSecret({ key: 'N8N_API_KEY', value, environment: activeEnv });
      setQuickN8nApiKey('');
      setQuickN8nMessage(tt(`Saved N8N_API_KEY to ${activeEnv}. Testing connection…`, `N8N_API_KEY ${activeEnv} ortamına kaydedildi. Bağlantı test ediliyor…`));
      await refreshSecrets();
      const status = await getIntegrationStatuses();
      setIntegrationStatus(status);
      setQuickN8nMessage(
        status.n8n.connected
          ? tt('n8n connected. Import/activate is now enabled.', 'n8n bağlı. Import/activate artık aktif.')
          : tt(
              `Saved, but n8n still not connected: ${status.n8n.reason || 'unknown'}`,
              `Kaydedildi ama n8n hâlâ bağlı değil: ${status.n8n.reason || tt('unknown', 'bilinmiyor')}`,
            ),
      );
    } catch (e) {
      setQuickN8nError(e instanceof Error ? e.message : tt('Failed to save N8N_API_KEY', 'N8N_API_KEY kaydedilemedi'));
    } finally {
      setIsSavingQuickN8n(false);
    }
  };

  const removeSecret = async (id: string) => {
    await deleteSecretById(id);
    await refreshSecrets();
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [settings, remoteSecrets, status] = await Promise.all([
          getRuntimeSettings(),
          listSecrets(),
          getIntegrationStatuses(),
        ]);

        if (cancelled) return;
        setRuntimeSettings(settings);
        setActiveEnv(settings.activeEnvironment);
        setEditingUrls({
          n8nBaseUrl: settings.n8nBaseUrl,
          suitecrmBaseUrl: settings.suitecrmBaseUrl,
          invoiceshelfBaseUrl: settings.invoiceshelfBaseUrl,
          documensoBaseUrl: settings.documensoBaseUrl,
          infisicalBaseUrl: settings.infisicalBaseUrl,
          infisicalWorkspaceId: settings.infisicalWorkspaceId,
          infisicalSecretPath: settings.infisicalSecretPath,
          infisicalEnvDevelopmentSlug: settings.infisicalEnvDevelopmentSlug,
          infisicalEnvStagingSlug: settings.infisicalEnvStagingSlug,
          infisicalEnvProductionSlug: settings.infisicalEnvProductionSlug,
          councilModels: settings.councilModels,
          councilChairmanModel: settings.councilChairmanModel,
          councilStage2Enabled: settings.councilStage2Enabled,
        });
        onUpdateSecrets(remoteSecrets.map(s => ({
          id: s.id,
          key: s.key,
          value: s.value,
          environment: s.environment,
          lastUpdated: s.lastUpdated,
        })));
        setIntegrationStatus(status);
      } catch {
        if (cancelled) return;
        setIntegrationStatus({
          n8n: { connected: false, baseUrl: 'http://localhost:5678', reason: 'API offline' },
          suitecrm: { connected: false, baseUrl: 'http://localhost:8091', reason: 'API offline' },
          invoiceshelf: { connected: false, baseUrl: 'http://localhost:8090', reason: 'API offline' },
          documenso: { connected: false, baseUrl: 'http://localhost:8092', reason: 'API offline' },
          infisical: { connected: false, baseUrl: 'http://localhost:8081', reason: 'API offline' },
          apify: { connected: false, baseUrl: 'https://api.apify.com', reason: 'API offline' },
          postgres: { connected: false, baseUrl: 'postgres', reason: 'API offline' },
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'Vault') return;
    refreshInfisical(activeEnv).catch(() => {});
  }, [activeTab, activeEnv]);

  const integrationLabel = (s?: { connected: boolean; reason?: string }) => {
    if (s?.connected) return { status: 'Connected', uptime: 'LIVE' };
    if (s?.reason?.startsWith('Missing')) return { status: 'Needs Config', uptime: 'READY' };
    return { status: 'Offline', uptime: 'DOWN' };
  };

  const integrations = [
    {
      id: 'n8n',
      name: 'n8n Logic Cluster',
      ...integrationLabel(integrationStatus?.n8n),
      version: integrationStatus?.n8n.baseUrl || 'http://localhost:5678',
      reason: integrationStatus?.n8n.reason,
      icon: '⚡',
    },
    {
      id: 'suitecrm',
      name: 'SuiteCRM Nexus',
      ...integrationLabel(integrationStatus?.suitecrm),
      version: integrationStatus?.suitecrm.baseUrl || 'http://localhost:8091',
      reason: integrationStatus?.suitecrm.reason,
      icon: '👥',
    },
    {
      id: 'invoiceshelf',
      name: 'InvoiceShelf API',
      ...integrationLabel(integrationStatus?.invoiceshelf),
      version: integrationStatus?.invoiceshelf.baseUrl || 'http://localhost:8090',
      reason: integrationStatus?.invoiceshelf.reason,
      icon: '💰',
    },
    {
      id: 'documenso',
      name: 'Documenso E-Sign',
      ...integrationLabel(integrationStatus?.documenso),
      version: integrationStatus?.documenso.baseUrl || 'http://localhost:8092',
      reason: integrationStatus?.documenso.reason,
      icon: '🖋️',
    },
    {
      id: 'infisical',
      name: 'Infisical Vault',
      ...integrationLabel(integrationStatus?.infisical),
      version: integrationStatus?.infisical.baseUrl || 'http://localhost:8081',
      reason: integrationStatus?.infisical.reason,
      icon: '🔒',
    },
    {
      id: 'apify',
      name: 'Apify Market Intel',
      ...integrationLabel(integrationStatus?.apify),
      version: integrationStatus?.apify.baseUrl || 'https://api.apify.com',
      reason: integrationStatus?.apify.reason,
      icon: '🧭',
    },
    {
      id: 'postgres',
      name: 'Postgres Memory Store',
      ...integrationLabel(integrationStatus?.postgres),
      version: integrationStatus?.postgres.baseUrl || 'postgres',
      reason: integrationStatus?.postgres.reason,
      icon: '🗄️',
    },
  ];

  const testConnection = (id: string) => {
    setTestingInteg(id);
    (async () => {
      try {
        const status = await getIntegrationStatuses();
        setIntegrationStatus(status);
      } catch {
        // keep existing
      } finally {
        setTimeout(() => setTestingInteg(null), 800);
      }
    })();
  };

  const saveBaseUrls = async () => {
    setIsSavingUrls(true);
    try {
      const updated = await updateRuntimeSettings(editingUrls);
      setRuntimeSettings(updated);
      setIntegrationStatus(await getIntegrationStatuses());
    } finally {
      setIsSavingUrls(false);
    }
  };

  const pushToInfisical = async () => {
    if (isPushingInfisical) return;
    setInfisicalMessage(null);
    setInfisicalError(null);
    setIsPushingInfisical(true);
    try {
      const res = await pushInfisicalSync({ scope: infisicalScope });
      if (res.errors?.length) {
        setInfisicalError(
          tt(
            `Some secrets failed to sync (${res.errors.length}). First: ${res.errors[0].key}`,
            `Bazı secret’lar senkronlanamadı (${res.errors.length}). İlk: ${res.errors[0].key}`,
          ),
        );
      }
      setInfisicalMessage(tt(`Pushed ${res.pushed} secret(s) to Infisical (${res.scope}).`, `${res.pushed} secret Infisical’e push edildi (${res.scope}).`));
      await refreshInfisical(activeEnv);
    } catch (e) {
      setInfisicalError(e instanceof Error ? e.message : tt('Infisical push failed', 'Infisical push başarısız'));
    } finally {
      setIsPushingInfisical(false);
    }
  };

  const pullFromInfisical = async () => {
    if (isPullingInfisical) return;
    setInfisicalMessage(null);
    setInfisicalError(null);
    setIsPullingInfisical(true);
    try {
      const res = await pullInfisicalSync({ recursive: false });
      setInfisicalMessage(tt(`Imported ${res.imported} secret(s) from Infisical into ${res.activeEnvironment}.`, `Infisical’ten ${res.imported} secret içe aktarıldı (${res.activeEnvironment}).`));
      await refreshSecrets();
      await refreshInfisical(activeEnv);
    } catch (e) {
      setInfisicalError(e instanceof Error ? e.message : tt('Infisical pull failed', 'Infisical pull başarısız'));
    } finally {
      setIsPullingInfisical(false);
    }
  };

  const tabLabel = (tab: 'Infrastructure' | 'Vault' | 'Team') => {
    const map: Record<typeof tab, { en: string; tr: string }> = {
      Infrastructure: { en: 'Infrastructure', tr: 'Altyapı' },
      Vault: { en: 'Vault', tr: 'Vault' },
      Team: { en: 'Team', tr: 'Ekip' },
    };
    return map[tab][language];
  };

  const envLabel = (env: 'Development' | 'Staging' | 'Production') => {
    const map: Record<typeof env, { en: string; tr: string }> = {
      Development: { en: 'Development', tr: 'Geliştirme' },
      Staging: { en: 'Staging', tr: 'Staging' },
      Production: { en: 'Production', tr: 'Üretim' },
    };
    return map[env][language];
  };

  const integStatusLabel = (status: 'Connected' | 'Needs Config' | 'Offline') =>
    status === 'Connected'
      ? tt('Connected', 'Bağlı')
      : status === 'Needs Config'
        ? tt('Needs Config', 'Kurulum Gerekli')
        : tt('Offline', 'Kapalı');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="bg-slate-800/30 p-12 rounded-[40px] border border-slate-700/50 flex flex-wrap justify-between items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 blur-[120px] rounded-full"></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">{tt('Agency Infrastructure', 'Ajans Altyapısı')}</h2>
          <p className="text-slate-500 mt-2 font-black uppercase tracking-[0.3em] text-xs">{tt('Distributed Resource Protocol • v1.0.4-LTS', 'Dağıtık Kaynak Protokolü • v1.0.4-LTS')}</p>
        </div>
        <div className="flex gap-4 relative z-10">
           <div className="bg-slate-900/80 px-8 py-5 rounded-3xl border border-slate-700/50 flex flex-col items-center min-w-[140px] shadow-xl">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{tt('Vault Secrets', 'Vault Secretları')}</span>
              <span className="text-2xl font-black text-white">{secrets.length}</span>
           </div>
           <div className="bg-slate-900/80 px-8 py-5 rounded-3xl border border-slate-700/50 flex flex-col items-center min-w-[140px] shadow-xl">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{tt('Cluster Pulse', 'Cluster Nabzı')}</span>
              <span className="text-2xl font-black text-green-400">99.9%</span>
           </div>
        </div>
      </div>

      <div className="flex gap-10 border-b border-slate-800/50 px-4">
        {(['Infrastructure', 'Vault', 'Team'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-5 font-black text-xs uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {tabLabel(tab)}
            {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>}
          </button>
        ))}
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'Infrastructure' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-8 space-y-8">
               <div className="bg-slate-800/40 border border-slate-700 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] mb-6">{tt('Runtime Settings', 'Runtime Ayarları')}</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-8">
                    {tt('Active environment controls which secrets are used by the API at runtime.', 'Aktif ortam, API’nin runtime’da hangi secret’ları kullandığını belirler.')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Active Environment', 'Aktif Ortam')}</p>
                      <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
                        {(['Development', 'Staging', 'Production'] as const).map(env => (
                          <button
                            key={env}
                            onClick={async () => {
                              setActiveEnv(env);
                              try {
                                const updated = await updateRuntimeSettings({ activeEnvironment: env });
                                setRuntimeSettings(updated);
                              } catch {
                                // ignore
                              }
                            }}
                            className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                              activeEnv === env ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-white'
                            }`}
                          >
                            {envLabel(env)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Base URLs', 'Base URL’ler')}</p>
                      <div className="space-y-3">
                        {[
                          { k: 'n8nBaseUrl', label: 'n8n', placeholder: 'http://localhost:5678' },
                          { k: 'suitecrmBaseUrl', label: 'SuiteCRM', placeholder: 'http://localhost:8091' },
                          { k: 'invoiceshelfBaseUrl', label: 'InvoiceShelf', placeholder: 'http://localhost:8090' },
                          { k: 'documensoBaseUrl', label: 'Documenso', placeholder: 'http://localhost:8092' },
                          { k: 'infisicalBaseUrl', label: 'Infisical', placeholder: 'http://localhost:8081' },
                        ].map((row) => (
                          <div key={row.k} className="flex items-center gap-3">
                            <span className="min-w-[90px] text-[9px] font-black text-slate-500 uppercase tracking-widest">{row.label}</span>
                            <input
                              value={(editingUrls as any)[row.k]}
                              onChange={(e) => setEditingUrls((prev) => ({ ...prev, [row.k]: e.target.value }))}
                              placeholder={row.placeholder}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 pt-6 border-t border-slate-800/60 space-y-3">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">{tt('Infisical Sync', 'Infisical Senkron')}</p>
                        {[
                          { k: 'infisicalWorkspaceId', label: tt('Workspace ID', 'Workspace ID'), placeholder: tt('workspaceId (UUID)', 'workspaceId (UUID)') },
                          { k: 'infisicalSecretPath', label: tt('Secret Path', 'Secret Path'), placeholder: '/' },
                          { k: 'infisicalEnvDevelopmentSlug', label: tt('Dev Env Slug', 'Dev Env Slug'), placeholder: 'dev' },
                          { k: 'infisicalEnvStagingSlug', label: tt('Staging Env Slug', 'Staging Env Slug'), placeholder: 'staging' },
                          { k: 'infisicalEnvProductionSlug', label: tt('Prod Env Slug', 'Prod Env Slug'), placeholder: 'prod' },
                        ].map((row) => (
                          <div key={row.k} className="flex items-center gap-3">
                            <span className="min-w-[90px] text-[9px] font-black text-slate-500 uppercase tracking-widest">{row.label}</span>
                            <input
                              value={(editingUrls as any)[row.k]}
                              onChange={(e) => setEditingUrls((prev) => ({ ...prev, [row.k]: e.target.value }))}
                              placeholder={row.placeholder}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 pt-6 border-t border-slate-800/60 space-y-4">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{tt('LLM Council', 'Yönetim Kurulu')}</p>
                        <div className="space-y-2">
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{tt('Models (comma-separated)', 'Modeller (virgülle ayrılmış)')}</p>
                          <textarea
                            value={(editingUrls as any).councilModels}
                            onChange={(e) => setEditingUrls((prev) => ({ ...prev, councilModels: e.target.value }))}
                            placeholder="openai/gpt-5.1,google/gemini-3-pro-preview,anthropic/claude-sonnet-4.5"
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono min-h-[80px]"
                          />
                          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                            {tt('Needs `OPENROUTER_API_KEY` in Vault.', 'Vault içinde `OPENROUTER_API_KEY` gerekir.')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="min-w-[90px] text-[9px] font-black text-slate-500 uppercase tracking-widest">{tt('Chairman', 'Chairman')}</span>
                          <input
                            value={(editingUrls as any).councilChairmanModel}
                            onChange={(e) => setEditingUrls((prev) => ({ ...prev, councilChairmanModel: e.target.value }))}
                            placeholder="google/gemini-3-pro-preview"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                          />
                        </div>
                        <label className="flex items-center gap-3 text-slate-300 text-xs font-black uppercase tracking-widest">
                          <input
                            type="checkbox"
                            checked={Boolean((editingUrls as any).councilStage2Enabled)}
                            onChange={(e) => setEditingUrls((prev) => ({ ...prev, councilStage2Enabled: e.target.checked }))}
                          />
                          {tt('Stage 2 peer ranking (higher quality, higher cost)', 'Aşama 2 karşılıklı puanlama (daha iyi kalite, daha yüksek maliyet)')}
                        </label>
                      </div>
                      <button
                        onClick={saveBaseUrls}
                        disabled={isSavingUrls}
                        className="mt-5 w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-300 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                      >
                        {isSavingUrls ? tt('Saving…', 'Kaydediliyor…') : tt('Save Runtime Settings', 'Runtime Ayarlarını Kaydet')}
                      </button>
                    </div>
                  </div>
               </div>
	               {integrationStatus?.n8n && !integrationStatus.n8n.connected && integrationStatus.n8n.reason?.startsWith('Missing') && (
	                 <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-[48px] p-10 shadow-2xl">
	                   <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
	                     <div>
	                       <h3 className="text-xl font-black text-white uppercase tracking-tighter">{tt('n8n API Key Quick Setup', 'n8n API Key Hızlı Kurulum')}</h3>
	                       <p className="text-[10px] text-yellow-700 font-black uppercase tracking-widest mt-2">
	                         {tt('Needed for one-click import/activate + executions feed.', 'Tek tık import/activate + execution feed için gerekir.')}
	                       </p>
	                       <ol className="mt-6 space-y-2 text-slate-200 text-sm font-medium">
	                         <li>{tt('1) Open n8n → Settings → API Keys → Create', '1) n8n → Settings → API Keys → Create')}</li>
	                         <li>
                             {tt('2) Paste the key below (Environment:', '2) Key’i aşağıya yapıştır (Ortam:')}{' '}
                             <span className="font-mono">{envLabel(activeEnv)}</span>)
                           </li>
	                         <li>{tt('3) Save and re-run “Re-sync (Import/Update)” on a workflow', '3) Kaydet ve workflow üzerinde “Re-sync (Import/Update)” çalıştır')}</li>
	                       </ol>
	                     </div>
                     <a
                       href={(runtimeSettings?.n8nBaseUrl || integrationStatus.n8n.baseUrl || 'http://localhost:5678').replace(/\/+$/, '')}
                       target="_blank"
                       rel="noreferrer"
                       className="bg-slate-900 hover:bg-slate-800 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95 h-fit"
	                     >
	                       {tt('Open n8n', 'n8n Aç')}
	                     </a>
	                   </div>

                   {quickN8nMessage && (
                     <div className="mt-8 bg-green-500/10 border border-green-500/20 p-6 rounded-3xl text-green-300 text-xs font-black uppercase tracking-widest">
                       {quickN8nMessage}
                     </div>
                   )}

                   {quickN8nError && (
                     <div className="mt-8 bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                       {quickN8nError}
                     </div>
                   )}

                   <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                     <input
                       type="password"
                       value={quickN8nApiKey}
                       onChange={(e) => setQuickN8nApiKey(e.target.value)}
                       placeholder="N8N_API_KEY"
                       className="md:col-span-2 bg-slate-950 border border-yellow-500/20 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-yellow-500/20"
                     />
                     <button
                       onClick={saveQuickN8nApiKey}
                       disabled={isSavingQuickN8n || !quickN8nApiKey.trim()}
                       className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95"
	                     >
	                       {isSavingQuickN8n ? tt('Saving…', 'Kaydediliyor…') : tt('Save Key + Test', 'Key Kaydet + Test Et')}
	                     </button>
	                   </div>
	                 </div>
	               )}
               <div className="bg-slate-800/40 border border-slate-700 rounded-[48px] p-10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 blur-[80px] rounded-full transition-transform duration-1000 group-hover:scale-150"></div>
                  <h3 className="text-xl font-black text-white tracking-tighter uppercase mb-10 flex items-center gap-4 relative z-10">
                    <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]"></span>
                    {tt('Cluster Integration Connectivity', 'Entegrasyon Bağlantı Durumu')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                     {integrations.map(integ => (
                       <div key={integ.id} className="p-8 bg-slate-950/60 rounded-[32px] border border-slate-800 flex justify-between items-center group/card hover:border-indigo-500/40 transition-all shadow-lg hover:-translate-y-1">
                          <div className="flex items-center gap-6">
                             <div className="w-14 h-14 bg-slate-900 rounded-[22px] flex items-center justify-center text-2xl shadow-inner border border-slate-800 group-hover/card:rotate-6 transition-transform">{integ.icon}</div>
                             <div>
                                <p className="text-lg font-black text-white tracking-tight uppercase">{integ.name}</p>
                                <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-1.5">{integ.version}</p>
                                {integ.reason && integ.status !== 'Connected' && (
                                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-2">
                                    {integ.reason}
                                  </p>
                                )}
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                              integ.status === 'Connected' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                              integ.status === 'Needs Config' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' :
                              'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {integStatusLabel(integ.status as any)}
                            </span>
                            <button onClick={() => testConnection(integ.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${testingInteg === integ.id ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-900 text-slate-500 hover:text-white border-slate-800 hover:border-slate-700'}`}>
                               {testingInteg === integ.id ? tt('Testing...', 'Test ediliyor...') : tt('Ping', 'Ping')}
                            </button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
            <div className="lg:col-span-4 space-y-8">
               <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[48px] shadow-2xl shadow-indigo-600/30 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                  <div className="relative z-10">
                     <div className="flex justify-between items-start mb-10">
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">{tt('Billing Tier', 'Paket')}</h3>
                        <span className="text-[10px] bg-white/20 text-white font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-white/20 shadow-lg">Enterprise Core</span>
                     </div>
                     <p className="text-sm text-indigo-700 leading-relaxed mb-10 font-medium italic">
                       "{tt(
                         'AgencyOS is currently managing 12 global node workers with automated load-balancing active across 4 regions.',
                         'AgencyOS şu anda 4 bölgede otomatik yük dengeleme ile 12 global node worker yönetiyor.',
                       )}"
                     </p>
                     <button className="w-full bg-white text-indigo-700 font-black py-5 rounded-[24px] text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-white/20">
                       {tt('Manage Subscriptions', 'Abonelikleri Yönet')}
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
        
        {activeTab === 'Vault' && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-[48px] p-10 shadow-2xl animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-12">
               <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{tt('Infisical Secure Vault', 'Infisical Güvenli Vault')}</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{tt('E2E Encrypted Secret Management', 'Uçtan uca şifreli secret yönetimi')}</p>
               </div>
               <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
                  {(['Development', 'Staging', 'Production'] as const).map(env => (
                    <button
                      key={env}
                      onClick={async () => {
                        setActiveEnv(env);
                        try {
                          const updated = await updateRuntimeSettings({ activeEnvironment: env });
                          setRuntimeSettings(updated);
                        } catch {
                          // ignore
                        }
                      }}
                      className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeEnv === env ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-white'}`}
                    >
                      {envLabel(env)}
                    </button>
                  ))}
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      list="agencyos-secret-keys"
                      placeholder={tt('SECRET_KEY (e.g. N8N_API_KEY)', 'SECRET_KEY (ör. N8N_API_KEY)')}
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <datalist id="agencyos-secret-keys">
                      {COMMON_SECRET_KEYS.map((k) => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                    <p className="mt-2 text-[9px] text-slate-600 font-black uppercase tracking-widest">
                      {tt('Suggestions', 'Öneriler')}: {COMMON_SECRET_KEYS.join(', ')}
                    </p>
                  </div>
                  <input type="password" placeholder="••••••••••••" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  <button onClick={handleAddSecret} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95">{tt('Add Secret', 'Secret Ekle')}</button>
                </div>
                <div className="bg-slate-950/60 rounded-3xl p-8 border border-slate-800 shadow-inner">
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6">{tt('Active Secrets', 'Aktif Secret’lar')}: {envLabel(activeEnv)}</p>
                   <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-4">
                      {secrets.filter(s => s.environment === activeEnv).map(sec => (
                        <div key={sec.id} className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                           <div>
                              <p className="text-[10px] font-black text-slate-100">{sec.key}</p>
                              <p className="text-[8px] text-slate-600 uppercase font-black mt-1">
                                {tt('Updated', 'Güncellendi')} {new Date(sec.lastUpdated).toLocaleDateString()}
                              </p>
                           </div>
                          <button onClick={() => removeSecret(sec.id)} className="text-[10px] text-red-600 hover:text-red-700 transition-all uppercase font-black">{tt('Revoke', 'Kaldır')}</button>
                        </div>
                      ))}
                      {secrets.filter(s => s.environment === activeEnv).length === 0 && (
                        <p className="text-center py-10 text-slate-700 uppercase font-black text-[10px]">{tt('Vault empty for this environment.', 'Bu ortam için vault boş.')}</p>
                      )}
                   </div>
                </div>
             </div>

             <div className="bg-slate-950/60 rounded-[40px] p-10 border border-slate-800 shadow-inner space-y-8">
               <div className="flex justify-between items-start gap-6">
                 <div>
                   <h4 className="text-xl font-black text-white uppercase tracking-tighter">{tt('Infisical Sync', 'Infisical Senkron')}</h4>
                   <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">
                     {tt('Workspace', 'Workspace')}: {runtimeSettings?.infisicalWorkspaceId || '—'} • {tt('Path', 'Path')}: {runtimeSettings?.infisicalSecretPath || '/'} • {tt('Env', 'Ortam')}: {envLabel(activeEnv)}
                     {infisicalRemote?.environmentSlug ? ` (${infisicalRemote.environmentSlug})` : ''}
                   </p>
                 </div>
                 <button
                   onClick={() => refreshInfisical(activeEnv)}
                   disabled={isLoadingInfisicalRemote}
                   className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-300 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                 >
                   {isLoadingInfisicalRemote ? tt('Refreshing…', 'Yenileniyor…') : tt('Refresh Remote', 'Remote Yenile')}
                 </button>
               </div>

               {infisicalMessage && (
                 <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl text-green-300 text-xs font-black uppercase tracking-widest">
                   {infisicalMessage}
                 </div>
               )}

               {infisicalError && (
                 <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                   {infisicalError}
                 </div>
               )}

               <div className="flex flex-wrap items-center gap-4">
                 <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800">
                   {(['active', 'all'] as const).map(scope => (
                     <button
                       key={scope}
                       onClick={() => setInfisicalScope(scope)}
                       className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${infisicalScope === scope ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-white'}`}
                     >
                       {scope === 'active' ? tt('Active Env', 'Aktif Ortam') : tt('All Envs', 'Tüm Ortamlar')}
                     </button>
                   ))}
                 </div>
                 <button
                   onClick={pushToInfisical}
                   disabled={isPushingInfisical}
                   className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900/40 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95"
                 >
                   {isPushingInfisical ? tt('Pushing…', 'Push ediliyor…') : tt('Push → Infisical', 'Push → Infisical')}
                 </button>
                 <button
                   onClick={pullFromInfisical}
                   disabled={isPullingInfisical}
                   className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest transition-all shadow-xl border border-slate-800 active:scale-95"
                 >
                   {isPullingInfisical ? tt('Pulling…', 'Çekiliyor…') : tt('Pull ← Infisical', 'Pull ← Infisical')}
                 </button>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-slate-900/60 rounded-[32px] border border-slate-800 p-8">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">{tt('Remote Secrets (redacted)', 'Remote Secret’lar (maskeli)')}</p>
                   <div className="space-y-4 max-h-[260px] overflow-y-auto custom-scrollbar pr-4">
                     {isLoadingInfisicalRemote && (
                       <p className="text-center py-10 text-slate-700 uppercase font-black text-[10px]">{tt('Loading…', 'Yükleniyor…')}</p>
                     )}
                     {!isLoadingInfisicalRemote && (infisicalRemote?.secrets?.length || 0) === 0 && (
                       <p className="text-center py-10 text-slate-700 uppercase font-black text-[10px]">{tt('No remote secrets found.', 'Remote secret bulunamadı.')}</p>
                     )}
                     {!isLoadingInfisicalRemote && infisicalRemote?.secrets?.map((sec) => (
                       <div key={sec.key} className="flex justify-between items-center p-4 bg-slate-950 rounded-2xl border border-slate-800">
                         <div>
                           <p className="text-[10px] font-black text-slate-100">{sec.key}</p>
                           <p className="text-[8px] text-slate-600 uppercase font-black mt-1">v{sec.version}{sec.comment ? ` • ${sec.comment}` : ''}</p>
                         </div>
                         <span className="text-[10px] text-slate-700 font-black">••••</span>
                       </div>
                     ))}
                   </div>
                 </div>

                 <div className="bg-slate-900/60 rounded-[32px] border border-slate-800 p-8 space-y-4">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('How it works', 'Nasıl çalışır')}</p>
                   <p className="text-xs text-slate-400 font-medium leading-relaxed">
                     {tt(
                       'Push syncs your local AgencyOS Vault secrets to Infisical. Pull imports Infisical secrets into the currently active environment so the API can use them immediately.',
                       'Push, lokal AgencyOS Vault secret’larını Infisical’e senkronlar. Pull, Infisical secret’larını aktif ortama içe aktarır; API anında kullanır.',
                     )}
                   </p>
                   <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                     {tt(
                       'Configure Workspace ID / Path / Env Slugs in Infrastructure → Runtime Settings.',
                       'Infrastructure → Runtime Ayarları içinde Workspace ID / Path / Env Slug değerlerini ayarla.',
                     )}
                   </p>
                 </div>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'Team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
             {teamMembers.map(member => (
               <div key={member.id} className="bg-slate-800/40 border border-slate-700 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-2xl rounded-full"></div>
                  <div className="flex items-center gap-6 mb-8">
                     <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-slate-800 group-hover:scale-110 transition-transform">{member.avatar}</div>
                     <div>
                        <h4 className="text-xl font-black text-white tracking-tight">{member.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                           <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Online' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-orange-500'} animate-pulse`}></span>
                           <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{member.role}</span>
                        </div>
                     </div>
                  </div>
                  <div className="space-y-2 mb-8">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Specialization', 'Uzmanlık')}</p>
                     <div className="flex flex-wrap gap-2">
                        {member.specialization.map(spec => (
                          <span key={spec} className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/10">{spec}</span>
                        ))}
                     </div>
                  </div>
                  <button className="w-full bg-slate-900 border border-slate-800 text-slate-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">{tt('Node Configuration', 'Node Ayarları')}</button>
               </div>
             ))}
             <button className="bg-slate-800/20 border-2 border-dashed border-slate-800 rounded-[40px] flex flex-col items-center justify-center py-20 hover:bg-slate-800/40 hover:border-indigo-500/30 transition-all group">
                <span className="text-4xl mb-4 opacity-20 group-hover:opacity-100 group-hover:rotate-12 transition-all">➕</span>
                <span className="text-[10px] font-black text-slate-700 group-hover:text-slate-500 uppercase tracking-[0.4em]">{tt('Provision AI Agent', 'AI Ajan Ekle')}</span>
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgencySettings;
