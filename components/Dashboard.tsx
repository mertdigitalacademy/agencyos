
import React, { useState, useEffect } from 'react';
import { CouncilSession, Project, Lead, SystemEvent, ProjectTab } from '../types';
import { getExecutiveSummary, getIntegrationStatuses, getRuntimeSettings, listSecrets, updateRuntimeSettings } from '../services/api';
import { getNextAction } from '../services/nextAction';
import { useI18n } from '../services/i18n';

interface DashboardProps {
  projects: Project[];
  leads: Lead[];
  councilSessions: CouncilSession[];
  alerts: { projectId: string; clientName: string; error: string; workflow: string; timestamp: string }[];
  systemEvents: SystemEvent[];
  onNewProject: () => void;
  onSeedDemo: () => void;
  onOpenCatalog: (projectId: string) => void;
  onOpenSettings: () => void;
  onOpenCouncil: (id: string) => void;
  onOpenProject: (id: string, tab?: ProjectTab) => void;
  onLeadIntake: (lead: Lead) => void;
}

const FAST_COUNCIL_MODELS = [
  'openai/gpt-5-mini',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.5-flash',
].join(', ');
const FAST_CHAIRMAN = 'openai/gpt-5-mini';

const Dashboard: React.FC<DashboardProps> = ({ projects, leads, councilSessions, alerts, systemEvents, onNewProject, onSeedDemo, onOpenCatalog, onOpenSettings, onOpenCouncil, onOpenProject, onLeadIntake }) => {
  const { language, tt } = useI18n();
  const [executiveBrief, setExecutiveBrief] = useState<string>('');
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    n8n: { connected: boolean; baseUrl: string; reason?: string };
    suitecrm: { connected: boolean; baseUrl: string; reason?: string };
    invoiceshelf: { connected: boolean; baseUrl: string; reason?: string };
    documenso: { connected: boolean; baseUrl: string; reason?: string };
    infisical: { connected: boolean; baseUrl: string; reason?: string };
    apify: { connected: boolean; baseUrl: string; reason?: string };
    postgres: { connected: boolean; baseUrl: string; reason?: string };
  } | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(false);
  const [councilUi, setCouncilUi] = useState<{
    activeEnvironment: 'Development' | 'Staging' | 'Production';
    hasOpenRouterKey: boolean;
    models: string[];
    chairman: string;
    stage2Enabled: boolean;
  } | null>(null);
  const [loadingCouncilUi, setLoadingCouncilUi] = useState(false);

  useEffect(() => {
    const fetchBrief = async () => {
      if (projects.length === 0) return;
      setLoadingBrief(true);
      try {
        const brief = await getExecutiveSummary();
        setExecutiveBrief(brief);
      } catch {
        setExecutiveBrief(tt('Intelligence feed offline.', 'İstihbarat akışı kapalı.'));
      }
      setLoadingBrief(false);
    };
    fetchBrief();
  }, [projects.length, tt]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingIntegration(true);
      try {
        const status = await getIntegrationStatuses();
        if (!cancelled) setIntegrationStatus(status);
      } catch {
        if (!cancelled) setIntegrationStatus(null);
      } finally {
        if (!cancelled) setLoadingIntegration(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingCouncilUi(true);
      try {
        const [settings, secrets] = await Promise.all([getRuntimeSettings(), listSecrets()]);
        if (cancelled) return;
        const activeEnvironment = settings.activeEnvironment;
        const keySecret =
          secrets.find((s) => s.key === 'OPENROUTER_API_KEY' && s.environment === activeEnvironment) ??
          secrets.find((s) => s.key === 'OPENROUTER_API_KEY');
        const hasOpenRouterKey = Boolean(keySecret?.hasValue);
        const models = String(settings.councilModels ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const chairman = String(settings.councilChairmanModel ?? '').trim();
        const stage2Enabled = Boolean(settings.councilStage2Enabled);
        setCouncilUi({ activeEnvironment, hasOpenRouterKey, models, chairman, stage2Enabled });
      } catch {
        if (!cancelled) setCouncilUi(null);
      } finally {
        if (!cancelled) setLoadingCouncilUi(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { label: tt('Pipeline Value', 'Pipeline Değeri'), value: projects.length, icon: '🚀', trend: '+12%' },
    { label: tt('Agency Yield', 'Ajans Getirisi'), value: `$${projects.reduce((acc, p) => acc + (p.totalBilled || 0), 0).toLocaleString()}`, icon: '💰', trend: '+8%' },
    { label: tt('Cluster Health', 'Cluster Sağlığı'), value: '99.9%', icon: '🛡️', trend: tt('STABLE', 'STABİL') },
    { label: tt('Avg MTTR', 'Ort. MTTR'), value: '4.2m', icon: '⏱️', trend: '-18%' },
  ];

  const badge = (connected: boolean, reason?: string) => {
    if (connected) return { label: tt('Connected', 'Bağlı'), cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
    if (reason?.startsWith('Missing')) return { label: tt('Needs Config', 'Kurulum Gerekli'), cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' };
    return { label: tt('Offline', 'Kapalı'), cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  };

  const projectStatusLabel = (status: Project['status']) => {
    const map: Record<Project['status'], { en: string; tr: string }> = {
      Intake: { en: 'Intake', tr: 'İntake' },
      Proposal: { en: 'Proposal', tr: 'Teklif' },
      Developing: { en: 'Developing', tr: 'Geliştirme' },
      Testing: { en: 'Testing', tr: 'Test' },
      Live: { en: 'Live', tr: 'Canlı' },
    };
    return map[status][language];
  };

  const latestProject = (() => {
    if (projects.length === 0) return null;
    return projects
      .slice()
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
  })();

  const latestSession = (() => {
    if (!councilSessions?.length) return null;
    return councilSessions
      .slice()
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
  })();

  const councilBadge = (() => {
    if (!councilUi) return { label: tt('Unknown', 'Bilinmiyor'), cls: 'bg-slate-400/10 text-slate-500 border-slate-500/20' };
    if (!councilUi.hasOpenRouterKey) return { label: tt('Needs Key', 'Key Gerekli'), cls: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' };
    if (councilUi.models.length < 2 || !councilUi.chairman) return { label: tt('Needs Models', 'Model Gerekli'), cls: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' };
    return { label: tt('Ready', 'Hazır'), cls: 'bg-green-500/10 text-green-700 border-green-500/20' };
  })();

  const speedUpCouncil = async (mode: 'stage2_off' | 'fast_defaults') => {
    try {
      if (mode === 'stage2_off') {
        const settings = await updateRuntimeSettings({ councilStage2Enabled: false });
        setCouncilUi((prev) =>
          prev
            ? { ...prev, stage2Enabled: Boolean(settings.councilStage2Enabled), models: String(settings.councilModels ?? '').split(',').map((s) => s.trim()).filter(Boolean), chairman: String(settings.councilChairmanModel ?? '').trim() }
            : prev,
        );
        return;
      }
      const settings = await updateRuntimeSettings({
        councilModels: FAST_COUNCIL_MODELS,
        councilChairmanModel: FAST_CHAIRMAN,
        councilStage2Enabled: false,
      });
      setCouncilUi((prev) =>
        prev
          ? { ...prev, stage2Enabled: Boolean(settings.councilStage2Enabled), models: String(settings.councilModels ?? '').split(',').map((s) => s.trim()).filter(Boolean), chairman: String(settings.councilChairmanModel ?? '').trim() }
          : prev,
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-800/40 p-6 rounded-[32px] border border-slate-700/50 hover:border-indigo-500/50 transition-all group relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-2xl rounded-full -mr-8 -mt-8"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-800">{stat.icon}</div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter ${stat.trend.startsWith('+') ? 'text-green-400 bg-green-400/10' : stat.trend.startsWith('-') ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 bg-slate-400/10'}`}>{stat.trend}</span>
            </div>
            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest relative z-10">{stat.label}</h3>
            <p className="text-3xl font-black text-white mt-1 relative z-10 tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-600/5 blur-[110px] rounded-full -ml-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-center lg:justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Quick Start (v0.1)', 'Hızlı Başlangıç (v0.1)')}</h3>
            <p className="text-slate-400 mt-2 text-sm font-medium">
              {tt(
                'Keep it simple: create a project → find a workflow → install to n8n → run Board review → send contract → create invoice.',
                'Basit ilerle: proje oluştur → workflow bul → n8n’e kur → Yönetim Kurulu incelemesini çalıştır → sözleşme gönder → fatura oluştur.',
              )}
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-[28px] p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Step 1', 'Adım 1')}</p>
                <p className="text-white font-black text-lg mt-2">{tt('Load demo or create project', 'Demo yükle veya proje oluştur')}</p>
                <div className="mt-4 flex gap-3">
                  <button onClick={onSeedDemo} className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] px-5 py-3 rounded-2xl font-black uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                    {tt('Load Demo', 'Demo Yükle')}
                  </button>
                  <button onClick={onNewProject} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-5 py-3 rounded-2xl font-black uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95">
                    {tt('Create Project', 'Proje Oluştur')}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-[28px] p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Step 2', 'Adım 2')}</p>
                <p className="text-white font-black text-lg mt-2">{tt('Connect integrations (optional)', 'Entegrasyonları bağla (opsiyonel)')}</p>
                <p className="text-slate-500 text-xs mt-2 font-medium">
                  {tt(
                    'n8n enables one-click import/activate + executions feed. Others enable CRM/contract/invoicing.',
                    'n8n tek tık import/activate + execution feed sağlar. Diğerleri CRM/sözleşme/faturalama sağlar.',
                  )}
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={onOpenSettings} className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] px-5 py-3 rounded-2xl font-black uppercase tracking-widest border border-slate-800 transition-all active:scale-95">
                    {tt('Open Settings', 'Ayarları Aç')}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-[28px] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Step 3', 'Adım 3')}</p>
                    <p className="text-white font-black text-lg mt-2">{tt('Run Management Board (clear)', 'Yönetim Kurulu Çalıştır (net)')}</p>
                    <p className="text-slate-500 text-xs mt-2 font-medium">
                      {tt(
                        'Multi-model board review for pricing + scope + risks. Saves outputs per project.',
                        'Fiyat + kapsam + risk için çoklu model “kurul” incelemesi. Çıktıları projeye kaydeder.',
                      )}
                    </p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${councilBadge.cls}`}>
                    {loadingCouncilUi ? tt('Checking…', 'Kontrol…') : councilBadge.label}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-[10px] text-slate-600 font-mono">
                    {tt('Env', 'Ortam')}: {councilUi?.activeEnvironment ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    {tt('Models', 'Modeller')}: {councilUi?.models?.length ? `${councilUi.models.length} (${councilUi.models.slice(0, 2).join(', ')}${councilUi.models.length > 2 ? ', …' : ''})` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    {tt('Chairman', 'Chairman')}: {councilUi?.chairman || '—'}
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono">
                    {tt('Peer ranking (Stage 2)', 'Peer ranking (Aşama 2)')}: {councilUi ? (councilUi.stage2Enabled ? tt('ON (slow)', 'AÇIK (yavaş)') : tt('OFF (fast)', 'KAPALI (hızlı)')) : '—'}
                  </p>
                  {latestSession && (
                    <p className="text-[10px] text-slate-600 font-mono">
                      {tt('Last decision', 'Son karar')}: {latestSession.decision} · {latestSession.gateType} · {projects.find((p) => p.id === latestSession.projectId)?.brief.clientName ?? latestSession.projectId}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      const targetId = latestProject?.id || latestSession?.projectId || projects[0]?.id;
                      if (targetId) onOpenCouncil(targetId);
                    }}
                    disabled={projects.length === 0 && !latestSession}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[10px] px-5 py-3 rounded-2xl font-black uppercase tracking-widest border border-indigo-400/20 transition-all active:scale-95"
                  >
                    {tt('Open Board', 'Yönetim Kurulu Aç')}
                  </button>
                  {councilUi?.stage2Enabled && (
                    <button
                      onClick={() => speedUpCouncil('stage2_off')}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] px-5 py-3 rounded-2xl font-black uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                      title={tt('Disables Stage 2 (peer ranking) to speed up.', 'Hız için Aşama 2 (peer ranking) kapatır.')}
                    >
                      {tt('Speed up', 'Hızlandır')}
                    </button>
                  )}
                  <button
                    onClick={() => speedUpCouncil('fast_defaults')}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] px-5 py-3 rounded-2xl font-black uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                    title={tt('Switches to fast multi-model defaults.', 'Hızlı çoklu-model varsayılanlarına geçer.')}
                  >
                    {tt('Use Fast Defaults', 'Hızlı Default')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[420px] bg-slate-950/60 border border-slate-800 rounded-[36px] p-8">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Integration Status', 'Entegrasyon Durumu')}</p>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{loadingIntegration ? tt('Checking…', 'Kontrol ediliyor…') : tt('Live', 'Canlı')}</p>
            </div>
            <div className="mt-5 space-y-3">
              {(['n8n', 'suitecrm', 'documenso', 'invoiceshelf', 'infisical', 'apify', 'postgres'] as const).map((key) => {
                const s = integrationStatus?.[key];
                const b = badge(Boolean(s?.connected), s?.reason);
                const url = typeof s?.baseUrl === 'string' ? s.baseUrl.trim() : '';
                const canOpen = /^https?:\/\//i.test(url);
                return (
                  <div key={key} className="flex items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white uppercase tracking-tight">{key}</p>
                      <p className="text-[10px] text-slate-600 font-mono truncate">{s?.baseUrl || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canOpen && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
                        >
                          {tt('Open', 'Aç')}
                        </a>
                      )}
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${b.cls}`}>
                        {b.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!integrationStatus && !loadingIntegration && (
                <div className="text-center text-slate-600 text-xs font-black uppercase tracking-widest py-10">
                  {tt('API offline (start `npm run dev:up`).', 'API kapalı (`npm run dev:up` çalıştır).')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Intelligence Feed */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[48px] shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
         <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center text-4xl shadow-2xl border border-indigo-400/20 group-hover:rotate-6 transition-transform">🧠</div>
            <div className="flex-1">
               <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">{tt('Cross-Project Intelligence', 'Proje Arası İstihbarat')}</span>
                  <div className="h-[1px] flex-1 bg-indigo-500/20"></div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">v1.0.4 OPS_SUMMARY</span>
               </div>
               {loadingBrief ? (
                 <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-indigo-500/20 rounded w-[90%]"></div>
                    <div className="h-4 bg-indigo-500/20 rounded w-[60%]"></div>
                 </div>
               ) : (
                 <p className="text-white text-lg font-medium leading-relaxed italic">"{executiveBrief || tt('Ready for pipeline synchronization...', 'Pipeline senkronizasyonuna hazır...')}"</p>
               )}
            </div>
            <div className="hidden lg:flex flex-col items-center gap-4">
               <div className="flex gap-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-8 bg-indigo-500/30 rounded-full animate-pulse" style={{ animationDelay: `${i*150}ms` }}></div>)}
               </div>
               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">{tt('Neural Feed Active', 'Neural Feed Aktif')}</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-4 space-y-8">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[40px] p-8 shadow-2xl relative overflow-hidden flex flex-col">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[80px] rounded-full"></div>
             <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8 flex justify-between items-center relative z-10">
                <span>{tt('System Event Stream', 'Sistem Olay Akışı')}</span>
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]"></span>
             </h3>
             <div className="space-y-4 custom-scrollbar relative z-10">
                {systemEvents.map((ev) => (
                  <div key={ev.id} className="flex gap-4 group cursor-default">
                     <div className={`w-1 h-full min-h-[40px] rounded-full transition-all group-hover:scale-y-110 ${ev.type === 'Success' ? 'bg-green-500' : ev.type === 'Alert' ? 'bg-red-500' : ev.type === 'Warning' ? 'bg-orange-500' : 'bg-indigo-500'}`}></div>
                     <div className="flex-1">
                        <p className="text-[11px] text-slate-200 font-bold leading-tight">{ev.message}</p>
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">{new Date(ev.timestamp).toLocaleTimeString()}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-slate-800/40 rounded-[32px] border border-slate-700/50 overflow-hidden flex flex-col shadow-2xl">
               <div className="p-6 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center">
                 <div>
                  <h2 className="text-lg font-black text-white tracking-tight uppercase">{tt('Intake Vector', 'İntake Akışı')}</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{tt('Automated Lead Qualified', 'Lead otomatik nitelendirildi')}</p>
               </div>
               <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-indigo-600/30">
                 {leads.length} {tt('Pending', 'Bekleyen')}
               </span>
            </div>
            <div className="divide-y divide-slate-700/30 custom-scrollbar">
              {leads.map(lead => (
                <div key={lead.id} className="p-6 hover:bg-indigo-600/5 transition-all group cursor-pointer relative" onClick={() => onLeadIntake(lead)}>
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-all"></div>
                      <div className="flex justify-between items-start mb-3">
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">{lead.source}</span>
                      <span className="text-[10px] font-black text-green-400 uppercase">
                        {lead.aiScore}% {tt('Match', 'Uyum')}
                      </span>
                  </div>
                  <h4 className="font-black text-white text-lg mb-2 group-hover:text-indigo-400 transition-colors tracking-tight uppercase">{lead.clientName}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium mb-4">{lead.brief}</p>
                  <button className="text-[10px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest flex items-center gap-2 transition-all">
                    {tt('Convert to Node', 'Node’a Çevir')} <span className="text-indigo-500">→</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Registry */}
        <div className="xl:col-span-8 space-y-8">
          <div className="bg-slate-800/40 rounded-[40px] border border-slate-700/50 overflow-hidden flex flex-col shadow-2xl h-full">
            <div className="p-8 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Operational Registry', 'Operasyon Kaydı')}</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={onSeedDemo}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl uppercase tracking-widest border border-slate-700"
                >
                  + {tt('Load 2 Demo Clients', '2 Demo Müşteri Yükle')}
                </button>
                <button onClick={onNewProject} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/30 uppercase tracking-widest border border-indigo-400/20">
                  + {tt('Provision Node', 'Node Oluştur')}
                </button>
              </div>
            </div>
            
            <div className="custom-scrollbar divide-y divide-slate-700/50">
              {projects.map(project => (
                <div key={project.id} className="p-10 hover:bg-slate-800/60 transition-all flex items-center justify-between group cursor-pointer border-l-4 border-transparent hover:border-indigo-500" onClick={() => onOpenProject(project.id)}>
                  <div className="flex gap-8 items-center">
                    <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-3xl border transition-all duration-500 relative ${project.status === 'Live' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                      {project.status === 'Live' ? '⚡' : '📦'}
                      {project.governance.certified && <div className="absolute -top-3 -right-3 bg-indigo-600 text-[10px] w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xl">🏛️</div>}
                    </div>
                    <div>
                      <h4 className="font-black text-white text-2xl group-hover:text-indigo-400 transition-colors tracking-tight mb-2 uppercase">{project.brief.clientName}</h4>
                      <div className="flex flex-wrap items-center gap-6">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${project.status === 'Live' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{projectStatusLabel(project.status)}</span>
                        <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">
                          {project.activeWorkflows.length} {tt('Operational Units', 'Operasyon Birimi')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase bg-slate-900 px-4 py-1 rounded-lg border border-slate-800">
                          {tt('Billed', 'Faturalandı')}: ${project.totalBilled.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const next = getNextAction({ project, integrations: integrationStatus ?? undefined });
                      const run = () => {
                        if (next.target === 'settings') return onOpenSettings();
                        if (next.target === 'catalog') return onOpenCatalog(project.id);
                        if (next.target === 'council') return onOpenCouncil(project.id);
                        return onOpenProject(project.id, next.projectTab);
                      };
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            run();
                          }}
                          className="hidden lg:flex items-center gap-3 px-6 py-4 rounded-[22px] bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-indigo-600/10 transition-all shadow-xl active:scale-95"
                          title={next.description[language]}
                        >
                          <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">{tt('Next', 'Sıradaki')}</span>
                          <span className="text-white text-xs font-black uppercase tracking-tight">{next.title[language]}</span>
                        </button>
                      );
                    })()}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCouncil(project.id);
                      }}
                      className="h-14 px-5 bg-slate-900 border border-slate-800 rounded-[20px] flex items-center justify-center gap-2 text-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-xl group-hover:border-indigo-500/30 active:scale-95 group/btn"
                      title={tt('Open Management Board', 'Yönetim Kurulu Aç')}
                    >
                      <span className="group-hover/btn:scale-110 transition-transform">🏛️</span>
                      <span className="hidden xl:inline text-[10px] font-black uppercase tracking-widest">{tt('Board', 'Yönetim Kurulu')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
