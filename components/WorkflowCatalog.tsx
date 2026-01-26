
import React, { useState, useMemo, useEffect } from 'react';
import { Workflow, WorkflowCandidate, Project } from '../types';
import { getCatalogStats, getRuntimeSettings, installWorkflowToProject, reindexCatalog, rewriteCatalogQuery, searchWorkflowCatalog } from '../services/api';
import { getIndustryHints } from '../services/industry';
import { useI18n } from '../services/i18n';

interface WorkflowCatalogProps {
  projects: Project[];
  onProjectUpdate: (updated: Project) => void;
  selectedProjectId: string | null;
  initialQuery?: string;
  initialRequiredTags?: string[];
}

const CATEGORIES: Array<{ id: string; label: { en: string; tr: string } }> = [
  { id: 'All', label: { en: 'All', tr: 'Hepsi' } },
  { id: 'webhook', label: { en: 'webhook', tr: 'webhook' } },
  { id: 'respond To Webhook', label: { en: 'Respond to Webhook', tr: 'Webhook’a Yanıt' } },
  { id: 'schedule Trigger', label: { en: 'Schedule Trigger', tr: 'Zamanlayıcı Trigger' } },
  { id: 'http Request', label: { en: 'HTTP Request', tr: 'HTTP Request' } },
  { id: 'google Sheets', label: { en: 'Google Sheets', tr: 'Google Sheets' } },
  { id: 'gmail', label: { en: 'Gmail', tr: 'Gmail' } },
  { id: 'slack', label: { en: 'Slack', tr: 'Slack' } },
  { id: 'telegram', label: { en: 'Telegram', tr: 'Telegram' } },
  { id: 'code', label: { en: 'Code', tr: 'Code' } },
];

const WorkflowCatalog: React.FC<WorkflowCatalogProps> = ({ projects, onProjectUpdate, selectedProjectId, initialQuery, initialRequiredTags }) => {
  const { language, tt } = useI18n();
  const [searchTerm, setSearchTerm] = useState(initialQuery ?? '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeProject, setActiveProject] = useState<string>(selectedProjectId || '');
  const [isMatching, setIsMatching] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteMessage, setRewriteMessage] = useState<string | null>(null);
  const [rewriteRequiredTags, setRewriteRequiredTags] = useState<string[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installingWorkflowId, setInstallingWorkflowId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<WorkflowCandidate[]>([]);
  const [relaxedCandidates, setRelaxedCandidates] = useState<WorkflowCandidate[]>([]);
  const [isRelaxed, setIsRelaxed] = useState(false);
  const [aiRecs, setAiRecs] = useState<WorkflowCandidate[]>([]);
  const [n8nBaseUrl, setN8nBaseUrl] = useState<string>('http://localhost:5678');
  const [catalogWorkflows, setCatalogWorkflows] = useState<number | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<string | null>(null);

  const project = useMemo(() => projects.find(p => p.id === activeProject), [projects, activeProject]);

  useEffect(() => {
    if (typeof initialQuery === 'string') setSearchTerm(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialRequiredTags) return;
    setActiveCategory('All');
    setRewriteRequiredTags(initialRequiredTags);
  }, [JSON.stringify(initialRequiredTags ?? [])]);

  const appliedRequiredTags = useMemo(() => {
    const raw = [
      ...(activeCategory === 'All' ? [] : [activeCategory]),
      ...(rewriteRequiredTags ?? []),
    ]
      .map((t) => String(t ?? '').trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of raw) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
    return out;
  }, [activeCategory, rewriteRequiredTags]);

  const removeFilterTag = (tag: string) => {
    const key = String(tag || '').toLowerCase();
    if (!key) return;
    if (activeCategory !== 'All' && activeCategory.toLowerCase() === key) {
      setActiveCategory('All');
      return;
    }
    setRewriteRequiredTags((prev) => prev.filter((t) => String(t || '').toLowerCase() !== key));
  };

  useEffect(() => {
    let cancelled = false;
    const requiredTags = appliedRequiredTags;

    const run = async () => {
      setIsLoadingCatalog(true);
      setCatalogError(null);
      setIsRelaxed(false);
      setRelaxedCandidates([]);
      try {
        const items = await searchWorkflowCatalog({ query: searchTerm, limit: 40, requiredTags });
        if (cancelled) return;
        setCandidates(items);
        if (items.length === 0 && requiredTags.length > 0 && searchTerm.trim().length > 0) {
          const fallback = await searchWorkflowCatalog({ query: searchTerm, limit: 40, requiredTags: [] });
          if (cancelled) return;
          setRelaxedCandidates(fallback);
          setIsRelaxed(fallback.length > 0);
        }
      } catch (e) {
        if (cancelled) return;
        setCatalogError(tt('Catalog service unreachable. Start `npm run dev:api`.', 'Katalog servisine ulaşılamıyor. `npm run dev:api` başlat.'));
        setCandidates([]);
      } finally {
        if (!cancelled) setIsLoadingCatalog(false);
      }
    };

    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchTerm, appliedRequiredTags]);

  const displayedCandidates = isRelaxed ? relaxedCandidates : candidates;

  const runAiRewrite = async () => {
    const raw = String(searchTerm || '').trim();
    if (!raw) return;
    if (isRewriting) return;
    setIsRewriting(true);
    setRewriteMessage(null);
    try {
      const out = await rewriteCatalogQuery({ query: raw });
      const nextQuery = String(out.query || raw).trim();
      setSearchTerm(nextQuery);
      const tags = Array.isArray(out.requiredTags) ? out.requiredTags.map(String) : [];
      setRewriteRequiredTags(tags);
      setActiveCategory('All');
      const meta = [
        out.notes ? out.notes : null,
        (Array.isArray(out.requiredTags) && out.requiredTags.length) ? `tags: ${out.requiredTags.join(', ')}` : null,
      ].filter(Boolean).join(' • ');
      setRewriteMessage(meta ? tt(`AI rewrite applied: ${meta}`, `AI yeniden yazma uygulandı: ${meta}`) : tt('AI rewrite applied.', 'AI yeniden yazma uygulandı.'));
    } catch (e) {
      setRewriteMessage(e instanceof Error ? e.message : tt('AI rewrite failed', 'AI yeniden yazma başarısız'));
    } finally {
      setIsRewriting(false);
    }
  };

  const runAiMatching = async () => {
    if (!project) return;
    setIsMatching(true);
    try {
      const hints = getIndustryHints(String(project.brief.industry || ''));
      const query = [
        project.brief.industry,
        project.brief.description,
        ...project.brief.goals,
        ...project.brief.tools,
        ...hints.keywords,
      ].filter(Boolean).join(' ');

      let recs = await searchWorkflowCatalog({ query, limit: 3, requiredTags: hints.requiredTags });
      if (!recs.length && hints.requiredTags.length) {
        recs = await searchWorkflowCatalog({ query, limit: 3 });
      }
      setAiRecs(recs);
      setCandidates(prev => {
        const merged = new Map<string, WorkflowCandidate>();
        [...recs, ...prev].forEach(c => merged.set(c.workflow.id, c));
        return Array.from(merged.values());
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsMatching(false);
    }
  };

  useEffect(() => {
    if (activeProject) {
      setAiRecs([]); // Reset recs when switching project
    }
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await getRuntimeSettings();
        if (!cancelled && s.n8nBaseUrl) setN8nBaseUrl(String(s.n8nBaseUrl).replace(/\/+$/, ''));
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stats = await getCatalogStats();
        if (!cancelled) setCatalogWorkflows(Number(stats.workflows ?? 0));
      } catch {
        if (!cancelled) setCatalogWorkflows(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleReindex = async () => {
    if (isReindexing) return;
    setIsReindexing(true);
    setCatalogStatus(null);
    try {
      const res = await reindexCatalog();
      setCatalogWorkflows(Number(res.workflows ?? 0));
      setCatalogStatus(tt(`Reindexed: ${Number(res.workflows ?? 0)} workflows`, `Yeniden indekslendi: ${Number(res.workflows ?? 0)} workflow`));
    } catch {
      setCatalogStatus(tt('Reindex failed. Is the API running?', 'İndeksleme başarısız. API çalışıyor mu?'));
    } finally {
      setIsReindexing(false);
    }
  };

  const handleInstall = (workflow: Workflow) => {
    if (!activeProject) {
      alert(tt('Please select a project first!', 'Önce bir proje seçmelisin!'));
      return;
    }
    const proj = projects.find(p => p.id === activeProject);
    if (proj) {
      const isAlreadyInstalled = proj.activeWorkflows.some(w => w.id === workflow.id);
      if (isAlreadyInstalled) return;

      setInstallError(null);
      setInstallingWorkflowId(workflow.id);
      (async () => {
        try {
          const res = await installWorkflowToProject({ projectId: activeProject, workflowId: workflow.id });
          onProjectUpdate(res.project);
        } catch (e) {
          const updatedProject: Project = {
            ...proj,
            activeWorkflows: [...proj.activeWorkflows, { ...workflow, deployment: { provider: 'n8n', status: 'Staged', updatedAt: new Date().toISOString() } }],
            status: 'Developing'
          };
          onProjectUpdate(updatedProject);
          setInstallError(tt('n8n import failed or API offline. Workflow staged locally (manual import).', 'n8n import başarısız veya API kapalı. Workflow lokal olarak stage edildi (manuel import).'));
        } finally {
          setInstallingWorkflowId(null);
        }
      })();
    }
  };

  const complexityLabel = (c: Workflow['complexity']) => {
    const map: Record<Workflow['complexity'], { en: string; tr: string }> = {
      Low: { en: 'Low', tr: 'Düşük' },
      Medium: { en: 'Medium', tr: 'Orta' },
      High: { en: 'High', tr: 'Yüksek' },
    };
    return map[c][language];
  };

  const deploymentLabel = (status: NonNullable<Project['activeWorkflows'][number]['deployment']>['status']) => {
    const map: Record<'Staged' | 'Imported' | 'Activated' | 'Error', { en: string; tr: string }> = {
      Staged: { en: 'STAGED', tr: 'HAZIR' },
      Imported: { en: 'IMPORTED', tr: 'İMPORT' },
      Activated: { en: 'ACTIVATED', tr: 'AKTİF' },
      Error: { en: 'ERROR', tr: 'HATA' },
    };
    return map[status][language];
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-slate-800/30 p-10 rounded-[40px] border border-slate-700/50 shadow-2xl relative overflow-hidden flex flex-col gap-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[120px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">{tt('n8n Automation Catalog', 'n8n Otomasyon Kataloğu')}</h2>
            <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">{tt('Production-Ready System Modules', 'Üretime Hazır Sistem Modülleri')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                {catalogWorkflows === null
                  ? tt('Catalog: offline', 'Katalog: offline')
                  : tt(`Catalog: ${catalogWorkflows} workflows`, `Katalog: ${catalogWorkflows} workflow`)}
              </span>
              <a
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest"
                href="https://github.com/Zie619/n8n-workflows"
                target="_blank"
                rel="noreferrer"
              >
                Zie619/n8n-workflows
              </a>
              <button
                onClick={handleReindex}
                disabled={isReindexing}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-4 py-2 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                title={tt('Rebuild catalog index (fast local scan).', 'Katalog indeksini yeniden oluştur (hızlı lokal tarama).')}
              >
                {isReindexing ? tt('Reindexing…', 'İndeksleniyor…') : tt('Reindex', 'Yeniden İndeksle')}
              </button>
              {catalogStatus && (
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{catalogStatus}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">{tt('Deploy To Cluster', 'Cluster’a Deploy')}</span>
              <select 
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-3.5 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-xl transition-all"
              >
                <option value="">{tt('-- Choose Target Project --', '-- Hedef Projeyi Seç --')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.brief.clientName.toUpperCase()}</option>
                ))}
              </select>
            </div>
            {project && (
              <button 
                onClick={runAiMatching}
                disabled={isMatching}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-8 py-5 rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-3 uppercase tracking-widest mt-4 md:mt-0 active:scale-95 border border-indigo-400/20"
	              >
	                {isMatching ? (
	                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : tt('🪄 Run AI Alignment', '🪄 AI Uyum Çalıştır')}
	              </button>
	            )}
	          </div>
	        </div>
	
      <div className="relative z-10 flex flex-col md:flex-row gap-6">
	          <div className="flex-1 relative group">
	            <input
	              type="text"
	              placeholder={tt("Search workflows (name, nodes, notes). e.g. 'heygen', 'shopify', 'slack webhook'…", "Workflow ara (isim, node, not). ör. 'heygen', 'shopify', 'slack webhook'…")}
	              value={searchTerm}
	              onChange={(e) => setSearchTerm(e.target.value)}
	              className="w-full bg-slate-950 border border-slate-800 rounded-3xl px-14 py-4 text-sm text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-700 font-medium"
	            />
            <span className="absolute left-6 top-5 text-xl opacity-30 group-focus-within:opacity-100 transition-opacity">🔍</span>
	            <button
	              onClick={runAiRewrite}
	              disabled={isRewriting || !searchTerm.trim()}
	              className="absolute right-4 top-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-4 py-2.5 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
	              title={tt('AI Assist: translate/expand query keywords', 'AI Yardım: sorguyu çevir/genişlet (keyword)')}
	            >
	              {isRewriting ? tt('Rewriting…', 'Yeniden yazılıyor…') : tt('✨ AI Assist', '✨ AI Yardım')}
	            </button>
	          </div>
	          
	          <div className="flex bg-slate-900 rounded-[28px] p-2 border border-slate-800 shadow-inner overflow-x-auto no-scrollbar gap-2">
	            {CATEGORIES.map((cat) => (
	              <button
	                key={cat.id}
	                onClick={() => setActiveCategory(cat.id)}
	                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
	                  activeCategory === cat.id
	                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
	                    : 'text-slate-500 hover:text-slate-300'
	                }`}
	              >
	                {cat.label[language]}
	              </button>
	            ))}
	          </div>
	        </div>
        {rewriteMessage && (
          <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {rewriteMessage}
          </div>
        )}
        {appliedRequiredTags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{tt('Filters:', 'Filtreler:')}</span>
            {appliedRequiredTags.map((tag) => {
              const isCategory = activeCategory !== 'All' && activeCategory.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => removeFilterTag(tag)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    isCategory
                      ? 'border-indigo-500/40 bg-indigo-600/10 text-indigo-200 hover:border-indigo-500/60'
                      : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700'
                  }`}
                  title={tt('Remove filter', 'Filtreyi kaldır')}
                >
                  <span>{tag}</span>
                  <span className="opacity-50">×</span>
                </button>
              );
            })}
            <button
              onClick={() => {
                setActiveCategory('All');
                setRewriteRequiredTags([]);
                setRewriteMessage(null);
              }}
              className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
              title={tt('Clear filters', 'Filtreleri temizle')}
            >
              {tt('Clear', 'Temizle')}
            </button>
          </div>
        )}
      </div>

      {project && aiRecs.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-600/10 to-blue-600/5 border border-indigo-500/20 p-10 rounded-[40px] flex items-center gap-10 animate-in slide-in-from-top-6 fade-in duration-700 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
          <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-600/40 group-hover:rotate-12 transition-transform duration-500 border border-indigo-400/20">✨</div>
          <div className="flex-1 relative z-10">
	            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
	               <span className="w-12 h-[1px] bg-indigo-500/30"></span>
	               {tt('Strategic Board Alignment Matrix', 'Stratejik Kurul Uyum Matrisi')}
	            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {aiRecs.map(rec => (
                <div key={rec.workflow.id} className="bg-slate-950/60 p-6 rounded-3xl border border-indigo-500/10 hover:border-indigo-500/30 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-black text-white tracking-tight">{rec.workflow.name}</span>
                    <span className="text-indigo-400 font-black text-xs">{Math.round(rec.score)}%</span>
                  </div>
	                  <p className="text-[11px] text-slate-500 leading-relaxed italic">"{rec.reason || rec.installPlan?.riskNotes?.[0] || tt('Aligned to brief + stack tags.', 'Brief + stack etiketlerine göre uyumlu.')}"</p>
	                </div>
	              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {catalogError && (
          <div className="lg:col-span-2 bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
            {catalogError}
          </div>
        )}

        {installError && (
          <div className="lg:col-span-2 bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-3xl text-yellow-200 text-xs font-black uppercase tracking-widest">
            {installError}
          </div>
        )}

        {isRelaxed && (
          <div className="lg:col-span-2 bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-3xl text-yellow-200 text-xs font-black uppercase tracking-widest flex flex-col gap-3">
            <div>
              {tt(
                'No results with current filters — showing matches without filters.',
                'Mevcut filtrelerle sonuç yok — filtreleri kaldırarak eşleşen sonuçlar gösteriliyor.',
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setIsRelaxed(false)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
              >
                {tt('Apply filters', 'Filtreleri uygula')}
              </button>
              <button
                onClick={() => {
                  setActiveCategory('All');
                  setRewriteRequiredTags([]);
                  setRewriteMessage(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-indigo-400/20 shadow-xl active:scale-95 transition-all"
              >
                {tt('Clear filters', 'Filtreleri temizle')}
              </button>
            </div>
          </div>
        )}

        {isLoadingCatalog && displayedCandidates.length === 0 && (
	          <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 p-10 rounded-[40px] text-slate-500 text-xs font-black uppercase tracking-widest">
	            {tt('Indexing workflow catalog…', 'Workflow kataloğu indeksleniyor…')}
	          </div>
	        )}

        {!isLoadingCatalog && !catalogError && displayedCandidates.length === 0 && searchTerm.trim().length > 0 && (
          <div className="lg:col-span-2 bg-slate-950/40 border border-slate-800 p-10 rounded-[40px] shadow-xl">
            <p className="text-white font-black text-lg tracking-tight">{tt('No workflows matched.', 'Workflow bulunamadı.')}</p>
            <p className="mt-2 text-slate-400 text-sm font-medium">
              {tt(
                `Try “AI Assist” to expand keywords or remove filters. Query: "${searchTerm.trim()}"`,
                `Keyword genişletmek için “AI Yardım”ı dene veya filtreleri kaldır. Sorgu: "${searchTerm.trim()}"`,
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={runAiRewrite}
                disabled={isRewriting}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                {isRewriting ? tt('Rewriting…', 'Yeniden yazılıyor…') : tt('✨ Try AI Assist', '✨ AI Yardım Dene')}
              </button>
              <button
                onClick={() => {
                  setActiveCategory('All');
                  setRewriteRequiredTags([]);
                  setRewriteMessage(null);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
              >
                {tt('Clear filters', 'Filtreleri temizle')}
              </button>
            </div>
          </div>
        )}

        {displayedCandidates.map(c => {
          const wf = c.workflow;
          const rec = aiRecs.find(r => r.workflow.id === wf.id);
          const installed = project?.activeWorkflows.find(w => w.id === wf.id);
          const isStaged = Boolean(installed);
          const installStatus = installed?.deployment?.status;
          const isInstalling = installingWorkflowId === wf.id;

          return (
            <div 
              key={wf.id} 
              className={`bg-slate-800/40 border p-10 rounded-[48px] transition-all duration-500 flex flex-col h-full relative group shadow-xl ${
                rec ? 'border-indigo-500/40 ring-4 ring-indigo-500/5 bg-indigo-600/5' : 'border-slate-700/50'
              } hover:border-indigo-500/50 hover:bg-slate-800/60 hover:-translate-y-1`}
            >
	              {rec && (
	                <div className="absolute -top-3 -right-3 bg-indigo-600 text-[10px] font-black px-4 py-2 rounded-2xl shadow-2xl shadow-indigo-600/40 border border-indigo-400/30 animate-pulse tracking-widest">
	                  {tt('AI STRATEGIC MATCH', 'AI STRATEJİK UYUM')}
	                </div>
	              )}

	              {installStatus && (
                <div className={`absolute -top-3 -left-3 text-[10px] font-black px-4 py-2 rounded-2xl shadow-2xl border tracking-widest ${
                  installStatus === 'Activated' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  installStatus === 'Imported' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  installStatus === 'Error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-slate-900 text-slate-400 border-slate-800'
                }`}>
	                  {deploymentLabel(installStatus)}
	                </div>
	              )}
              
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tighter leading-none mb-2 group-hover:text-indigo-400 transition-colors">{wf.name}</h3>
                   <div className="flex flex-wrap gap-2">
                     {wf.tags.map(tag => (
                       <span key={tag} className="text-[9px] font-black text-slate-600 border border-slate-800/80 px-2.5 py-0.5 rounded-lg uppercase tracking-widest group-hover:border-indigo-500/20 transition-all">
                         {tag}
                       </span>
                     ))}
                   </div>
                </div>
	                <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${
	                  wf.complexity === 'Low' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
	                  wf.complexity === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
	                }`}>
	                  {complexityLabel(wf.complexity)} {tt('Complexity', 'Zorluk')}
	                </span>
	              </div>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10 flex-1">{wf.description}</p>
              
              <div className="space-y-6">
	                <div className="bg-slate-950/60 p-7 rounded-[32px] border border-slate-800 group-hover:border-indigo-500/20 transition-all shadow-inner">
	                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">{tt('Credential Checklist', 'Credential Listesi')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    {wf.credentials.map(cred => (
                      <div key={cred} className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full shadow-[0_0_8px_#6366f1]"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{cred}</span>
                      </div>
                    ))}
	                    {wf.credentials.length === 0 && (
	                      <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest col-span-2">
	                        {tt('No explicit credentials detected (review nodes before import).', 'Açık credential bulunamadı (import öncesi node’ları kontrol et).')}
	                      </p>
	                    )}
	                  </div>
	                </div>

                <div className="flex items-center justify-between gap-4">
                  <a
                    href={wf.jsonUrl}
                    className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-slate-300 font-black py-4 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-slate-800"
	                  >
	                    {tt('Download JSON', 'JSON İndir')}
	                  </a>
                  <a
                    href={n8nBaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-slate-300 font-black py-4 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-slate-800"
	                  >
	                    {tt('Open n8n', 'n8n Aç')}
	                  </a>
	                </div>

                {c.installPlan && (
                  <details className="bg-slate-950/40 border border-slate-800 rounded-[32px] p-7 shadow-inner group-hover:border-indigo-500/20 transition-all">
	                    <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
	                      {tt('Setup Checklist', 'Kurulum Checklist')}
	                    </summary>
	                    <div className="mt-6 space-y-6">
	                      <div>
	                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">{tt('Install', 'Kurulum')}</p>
                        <ol className="space-y-2 list-decimal list-inside text-[11px] text-slate-400 font-medium">
                          {c.installPlan.installSteps.slice(0, 5).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
	                      <div>
	                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">{tt('Test', 'Test')}</p>
                        <ul className="space-y-2 list-disc list-inside text-[11px] text-slate-400 font-medium">
                          {c.installPlan.testSteps.slice(0, 4).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
	                      <div>
	                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">{tt('Risks', 'Riskler')}</p>
                        <ul className="space-y-2 list-disc list-inside text-[11px] text-slate-500 font-medium">
                          {c.installPlan.riskNotes.slice(0, 4).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                )}

                <button 
                  onClick={() => handleInstall(wf)}
                  disabled={isStaged || !activeProject || isInstalling}
                  className={`w-full font-black py-6 rounded-[30px] transition-all duration-300 uppercase tracking-[0.2em] text-[10px] shadow-2xl relative overflow-hidden group/btn ${
                    isStaged 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                      : isInstalling
                      ? 'bg-slate-800 text-slate-500 cursor-wait border border-slate-700'
                      : !activeProject
                      ? 'bg-slate-800/50 text-slate-700 cursor-not-allowed border border-slate-800'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/40 active:scale-[0.97] border border-indigo-400/20'
                  }`}
	                >
	                  <span className="relative z-10">
                      {isStaged
                        ? tt('Deployed to Node ✅', 'Node’a Deploy ✅')
                        : isInstalling
                          ? tt('Deploying…', 'Deploy ediliyor…')
                          : tt('Deploy to n8n Instance 🚀', 'n8n Instance’a Deploy 🚀')}
                    </span>
	                  {!isStaged && activeProject && !isInstalling && (
	                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
	                  )}
	                </button>

	                {c.installPlan?.riskNotes?.[0] && (
	                  <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest leading-relaxed">
	                    {tt('Risk', 'Risk')}: {c.installPlan.riskNotes[0]}
	                  </p>
	                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowCatalog;
