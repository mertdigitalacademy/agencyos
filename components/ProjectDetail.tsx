
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, Workflow, ProjectDocument, ExecutionLog, OperatorMessage, CRMActivity, ProjectIncident, ProjectTab } from '../types';
import {
  activateProjectWorkflow,
  createInvoiceShelfInvoice,
  createInvoiceShelfInvoiceFromCouncil,
  createSuiteCrmLead,
  listSuiteCrmLeads,
  getDocumensoTemplate,
  listDocumensoTemplates,
  syncDocumensoContractStatuses,
  syncInvoiceShelfInvoiceStatuses,
  generateProposal,
  generateSOW,
  getApiMeta,
  getN8nIntegrationStatus,
  getOperatorResponse,
  getPivotAnalysis,
  getProjectExecutions,
  getRuntimeSettings,
  installWorkflowToProject,
  listCouncilSessions,
  runCouncilSession,
  searchWorkflowCatalog,
  sendDocumensoContract,
  getStrategicAdvice,
} from '../services/api';
import { useI18n } from '../services/i18n';

interface ProjectDetailProps {
  project: Project;
  initialTab?: ProjectTab;
  onUpdate: (project: Project) => void;
  onOpenCouncil: (id: string, gate?: string) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, initialTab, onUpdate, onOpenCouncil }) => {
  const { language, tt } = useI18n();
  const [activeTab, setActiveTab] = useState<ProjectTab>('Workflows');
  const [viewingDoc, setViewingDoc] = useState<ProjectDocument | null>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [operatorInput, setOperatorInput] = useState('');
  const [isOperatorThinking, setIsOperatorThinking] = useState(false);
  const [strategicAdvice, setStrategicAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState<'Proposal' | 'SOW' | null>(null);
  const [pivotAnalysis, setPivotAnalysis] = useState<{ assessment: string, recommendation: string, urgency: number } | null>(null);
  const [isPivoting, setIsPivoting] = useState(false);
  
  // Voice/Live API Refs
  const [isVoiceActive] = useState(false);
  const [n8nStatus, setN8nStatus] = useState<{ connected: boolean; baseUrl: string; reason?: string } | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [runtimeSettings, setRuntimeSettings] = useState<{
    n8nBaseUrl: string;
    suitecrmBaseUrl: string;
    invoiceshelfBaseUrl: string;
    documensoBaseUrl: string;
    infisicalBaseUrl: string;
  } | null>(null);
  const [isActivatingWorkflowId, setIsActivatingWorkflowId] = useState<string | null>(null);
  const [isResyncingWorkflowId, setIsResyncingWorkflowId] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(1500);
  const [invoiceDescription, setInvoiceDescription] = useState<string>('');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [isSyncingCrm, setIsSyncingCrm] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [suiteCrmLeadScope, setSuiteCrmLeadScope] = useState<'project' | 'agencyos' | 'all'>('project');
  const [suiteCrmLeads, setSuiteCrmLeads] = useState<Array<{ id: string; last_name?: string; status?: string; lead_source?: string; date_entered?: string; description?: string }>>([]);
  const [isLoadingSuiteCrmLeads, setIsLoadingSuiteCrmLeads] = useState(false);
  const [suiteCrmLeadsError, setSuiteCrmLeadsError] = useState<string | null>(null);

  const refreshSuiteCrmLeads = useCallback(
    async (scope?: 'project' | 'agencyos' | 'all') => {
      if (isLoadingSuiteCrmLeads) return;
      setSuiteCrmLeadsError(null);
      setIsLoadingSuiteCrmLeads(true);
      try {
        const res = await listSuiteCrmLeads({ projectId: project.id, limit: 25, scope: scope ?? suiteCrmLeadScope });
        setSuiteCrmLeads(res.leads ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : tt('SuiteCRM lead list failed', 'SuiteCRM lead listesi alınamadı');
        setSuiteCrmLeadsError(msg);
      } finally {
        setIsLoadingSuiteCrmLeads(false);
      }
    },
    [isLoadingSuiteCrmLeads, project.id, suiteCrmLeadScope, tt],
  );

  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const [documensoTemplates, setDocumensoTemplates] = useState<Array<{ id: number; title: string; type?: string }>>([]);
  const [isLoadingDocumensoTemplates, setIsLoadingDocumensoTemplates] = useState(false);
  const [selectedDocumensoTemplateId, setSelectedDocumensoTemplateId] = useState<number | null>(null);
  const [selectedDocumensoTemplate, setSelectedDocumensoTemplate] = useState<{
    id: number;
    title: string;
    type?: string;
    Recipient: Array<{ id: number; name: string; email: string; role?: string; signingOrder?: number | null }>;
  } | null>(null);
  const [contractRecipients, setContractRecipients] = useState<Array<{ name: string; email: string }>>([]);
  const [contractTitle, setContractTitle] = useState<string>('');
  const [contractSubject, setContractSubject] = useState<string>('');
  const [contractMessage, setContractMessage] = useState<string>(() => tt('Please review and sign.', 'Lütfen inceleyip imzalayın.'));
  const [contractSendEmail, setContractSendEmail] = useState(true);
  const [isSendingContract, setIsSendingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [isSyncingContracts, setIsSyncingContracts] = useState(false);
  const [contractSyncMessage, setContractSyncMessage] = useState<string | null>(null);
  const [isSyncingInvoices, setIsSyncingInvoices] = useState(false);
  const [invoiceSyncMessage, setInvoiceSyncMessage] = useState<string | null>(null);

  const [executionsState, setExecutionsState] = useState<{
    connected: boolean;
    baseUrl: string;
    executions: any[];
    reason?: string;
  } | null>(null);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [lastExecutionRefreshAt, setLastExecutionRefreshAt] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialTab ?? 'Workflows');
  }, [project.id, initialTab]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [liveLog]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const status = await getN8nIntegrationStatus();
        if (!cancelled) setN8nStatus(status);
      } catch (e) {
        if (!cancelled) setN8nStatus({ connected: false, baseUrl: 'http://localhost:5678', reason: 'API offline' });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await getApiMeta();
        if (cancelled) return;
        setApiBaseUrl(String(meta.apiBaseUrl || '').replace(/\/+$/, ''));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await getRuntimeSettings();
        if (!cancelled) {
          setRuntimeSettings({
            n8nBaseUrl: s.n8nBaseUrl,
            suitecrmBaseUrl: s.suitecrmBaseUrl,
            invoiceshelfBaseUrl: s.invoiceshelfBaseUrl,
            documensoBaseUrl: s.documensoBaseUrl,
            infisicalBaseUrl: s.infisicalBaseUrl,
          });
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setInvoiceDescription(project.brief.description);
  }, [project.id]);

  useEffect(() => {
    setSuiteCrmLeads([]);
    setSuiteCrmLeadsError(null);
  }, [project.id]);

  useEffect(() => {
    if (activeTab !== 'CRM') return;
    refreshSuiteCrmLeads().catch(() => {});
  }, [activeTab, refreshSuiteCrmLeads, suiteCrmLeadScope]);

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'Documents') return;
    if (documensoTemplates.length > 0) return;

    (async () => {
      setIsLoadingDocumensoTemplates(true);
      setContractError(null);
      try {
        const res = await listDocumensoTemplates({ page: 1, perPage: 50 });
        if (cancelled) return;
        const templates = res.templates || [];
        setDocumensoTemplates(templates);
        if (!selectedDocumensoTemplateId && templates[0]?.id) {
          setSelectedDocumensoTemplateId(templates[0].id);
        }
      } catch (e: any) {
        if (cancelled) return;
        setContractError(e instanceof Error ? e.message : tt('Failed to load Documenso templates', 'Documenso template’leri yüklenemedi'));
      } finally {
        if (!cancelled) setIsLoadingDocumensoTemplates(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, documensoTemplates.length]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedDocumensoTemplateId) {
      setSelectedDocumensoTemplate(null);
      setContractRecipients([]);
      return;
    }

    (async () => {
      try {
        const t = await getDocumensoTemplate(selectedDocumensoTemplateId);
        if (cancelled) return;
        setSelectedDocumensoTemplate(t);
        setContractTitle(tt(`${project.brief.clientName} — Contract`, `${project.brief.clientName} — Sözleşme`));
        setContractSubject(tt(`Contract for ${project.brief.clientName}`, `${project.brief.clientName} için sözleşme`));
        setContractRecipients((t.Recipient || []).map((r) => ({ name: r.name || project.brief.clientName, email: r.email || '' })));
      } catch (e: any) {
        if (cancelled) return;
        setSelectedDocumensoTemplate(null);
        setContractRecipients([]);
        setContractError(e instanceof Error ? e.message : tt('Failed to load template', 'Template yüklenemedi'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumensoTemplateId, project.id]);

  const refreshStrategicAdvice = useCallback(async () => {
    setIsLoadingAdvice(true);
    try {
      const advice = await getStrategicAdvice(project.id);
      setStrategicAdvice(advice);
    } catch {
      setStrategicAdvice(tt('Strategic advice engine offline.', 'Stratejik tavsiye motoru kapalı.'));
    } finally {
      setIsLoadingAdvice(false);
    }
  }, [project.id, tt]);

  useEffect(() => {
    if (activeTab === 'Workflows' || activeTab === 'Financials') {
      refreshStrategicAdvice().catch(() => {});
    }
  }, [activeTab, refreshStrategicAdvice]);

  // Telemetry Matrix Animation Logic
  const [matrixData, setMatrixData] = useState<number[]>(Array.from({ length: 48 }, () => Math.random()));
  useEffect(() => {
    if (activeTab === 'Monitoring') {
      const interval = setInterval(() => {
        setMatrixData(prev => prev.map(v => Math.random() > 0.9 ? Math.random() : v));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const toggleVoiceMode = async () => {
    addLiveLog(tt('Voice Operator is disabled in v0.1. Use Operator chat (text) instead.', 'Ses Operatörü v0.1’de kapalı. Bunun yerine Operatör sohbetini (metin) kullan.'));
  };

  const addLiveLog = (msg: string) => {
    setLiveLog(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const addLiveLogT = (en: string, tr: string) => addLiveLog(tt(en, tr));

  const refreshExecutions = async () => {
    setIsLoadingExecutions(true);
    try {
      const res = await getProjectExecutions({ projectId: project.id, limit: 20 });
      setExecutionsState(res);
      setLastExecutionRefreshAt(new Date().toISOString());
      addLiveLogT(`Execution feed refreshed (${res.executions.length}).`, `Execution feed yenilendi (${res.executions.length}).`);
    } catch (e) {
      setExecutionsState({
        connected: false,
        baseUrl: n8nStatus?.baseUrl || 'http://localhost:5678',
        executions: [],
        reason: e instanceof Error ? e.message : tt('Failed to load executions', 'Execution’lar alınamadı'),
      });
      addLiveLogT('Execution feed refresh failed.', 'Execution feed yenileme başarısız.');
    } finally {
      setIsLoadingExecutions(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'Monitoring') return;
    let cancelled = false;

    (async () => {
      try {
        await refreshExecutions();
      } catch {
        // handled in refresh
      }
    })();

    const interval = setInterval(() => {
      if (cancelled) return;
      refreshExecutions().catch(() => {});
    }, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, project.id, project.activeWorkflows.length]);

  const handleActivateWorkflow = async (wf: Workflow) => {
    if (isActivatingWorkflowId) return;
    if (!wf.deployment?.n8nWorkflowId) {
      addLiveLogT('Activation blocked: workflow not imported to n8n yet.', 'Aktivasyon engellendi: workflow henüz n8n’e import edilmedi.');
      return;
    }

    setIsActivatingWorkflowId(wf.id);
    addLiveLogT(`Activating workflow in n8n: ${wf.name}…`, `n8n’de workflow aktif ediliyor: ${wf.name}…`);
    try {
      const updated = await activateProjectWorkflow({ projectId: project.id, workflowId: wf.id });
      onUpdate(updated);
      addLiveLogT(`Activated: ${wf.name}`, `Aktif: ${wf.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Unknown error', 'Bilinmeyen hata');
      addLiveLogT(`Activation failed: ${msg}`, `Aktivasyon başarısız: ${msg}`);
    } finally {
      setIsActivatingWorkflowId(null);
    }
  };

  const workflowJsonUrl = (wf: Workflow) => {
    const raw = String(wf.jsonUrl || '');
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (!apiBaseUrl) return raw;
    return `${apiBaseUrl}${raw}`;
  };

  const handleCopyImportUrl = async (wf: Workflow) => {
    const url = workflowJsonUrl(wf);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      addLiveLogT('Import URL copied to clipboard.', 'Import URL panoya kopyalandı.');
    } catch {
      addLiveLogT('Clipboard unavailable. Copy this URL manually: ' + url, 'Pano erişilemiyor. Bu URL’yi manuel kopyalayın: ' + url);
    }
  };

  const handleResyncWorkflow = async (wf: Workflow) => {
    if (isResyncingWorkflowId) return;
    setIsResyncingWorkflowId(wf.id);
    addLiveLogT(`Re-syncing workflow from catalog: ${wf.name}…`, `Katalogdan workflow yeniden senkronlanıyor: ${wf.name}…`);
    try {
      const res = await installWorkflowToProject({ projectId: project.id, workflowId: wf.id, activate: false });
      onUpdate(res.project);
      const status = res.workflow.deployment?.status || 'Staged';
      addLiveLogT(`Re-sync complete: ${status}`, `Re-sync tamam: ${status === 'Staged' ? tt('Staged', 'Hazır') : workflowDeployStatusLabel(status)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Unknown error', 'Bilinmeyen hata');
      addLiveLogT(`Re-sync failed: ${msg}`, `Re-sync başarısız: ${msg}`);
    } finally {
      setIsResyncingWorkflowId(null);
    }
  };

  const handleSynthesize = async (type: 'Proposal' | 'SOW') => {
    setIsSynthesizing(type);
    const trType = type === 'Proposal' ? 'Teklif' : 'SOW';
    addLiveLogT(`Synthesizing strategic ${type} via Board-AI...`, `Board-AI ile stratejik ${trType} oluşturuluyor...`);
    try {
      const content = type === 'Proposal' ? await generateProposal(project.id) : await generateSOW(project.id);
      const newDoc: ProjectDocument = {
        id: `doc-${Date.now()}`,
        name: tt(`${type}: ${project.brief.clientName}`, `${trType}: ${project.brief.clientName}`),
        type,
        status: 'Draft',
        content,
        url: '#',
        createdAt: new Date().toISOString()
      };
      onUpdate({ ...project, documents: [newDoc, ...project.documents] });
      addLiveLogT(`${type} generated and archived in Cluster Repository.`, `${trType} üretildi ve Cluster arşivine alındı.`);
    } catch (e) {
      addLiveLogT('Synthesis failed: Logic mismatch.', 'Sentez başarısız: Tutarsızlık.');
    } finally {
      setIsSynthesizing(null);
    }
  };

  const handleStrategicPivot = async () => {
    setIsPivoting(true);
    addLiveLogT('Running Strategic Pivot Analysis for project node...', 'Proje node’u için Stratejik Pivot Analizi çalıştırılıyor...');
    try {
      const analysis = await getPivotAnalysis(project.id);
      setPivotAnalysis(analysis);
    } catch (e) {
      addLiveLogT('Pivot analysis failed.', 'Pivot analizi başarısız.');
    } finally {
      setIsPivoting(false);
    }
  };

  const handleOperatorSend = async () => {
    if (!operatorInput.trim() || isOperatorThinking) return;
    setIsOperatorThinking(true);
    const query = operatorInput;
    const userMsg: OperatorMessage = { id: `msg-${Date.now()}`, role: 'user', content: query };
    let chat: OperatorMessage[] = [...project.operatorChat, userMsg];
    onUpdate({ ...project, operatorChat: chat });
    setOperatorInput('');
    try {
      const res = await getOperatorResponse({ projectId: project.id, query });
      const aiMsg: OperatorMessage = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: res.content };
      chat = [...chat, aiMsg];
      onUpdate({ ...project, operatorChat: chat });

      const tool = res.toolCall;
      if (tool?.name) {
        const toolMsg: OperatorMessage = {
          id: `msg-${Date.now() + 2}`,
          role: 'system',
          content: tt(
            `Tool: ${tool.name} (${JSON.stringify(tool.args ?? {})})`,
            `Araç: ${tool.name} (${JSON.stringify(tool.args ?? {})})`,
          ),
        };
        chat = [...chat, toolMsg];
        onUpdate({ ...project, operatorChat: chat });

        const asString = (v: any) => (typeof v === 'string' ? v : '');
        const asNumber = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
        const asBool = (v: any) => Boolean(v);

        const toolName = String(tool.name);
        const toolArgs: any = tool.args ?? {};

        try {
          if (toolName === 'catalog.search') {
            const query = asString(toolArgs.query || toolArgs.q).trim();
            const limit = asNumber(toolArgs.limit ?? 5);
            const requiredTags = Array.isArray(toolArgs.requiredTags) ? toolArgs.requiredTags.map(String) : [];
            const results = await searchWorkflowCatalog({ query, limit: Number.isFinite(limit) ? Math.max(1, Math.min(10, limit)) : 5, requiredTags });
            const lines = results.slice(0, 5).map((c) => `- ${c.workflow.name} (${Math.round(c.score)}%) [${c.workflow.id}]`).join('\n');
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: results.length ? tt(`Top matches:\n${lines}`, `En iyi eşleşmeler:\n${lines}`) : tt('No workflows matched.', 'Workflow bulunamadı.'),
            };
            chat = [...chat, out];
            onUpdate({ ...project, operatorChat: chat });
          } else if (toolName === 'workflow.install') {
            const workflowId = asString(toolArgs.workflowId || toolArgs.id).trim();
            const activate = asBool(toolArgs.activate);
            if (!workflowId) throw new Error(tt('Missing workflowId', 'workflowId eksik'));
            const res2 = await installWorkflowToProject({ projectId: project.id, workflowId, activate });
            const status = res2.workflow.deployment?.status || 'Staged';
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(
                `Workflow deployed: ${res2.workflow.name} (status: ${status}).`,
                `Workflow deploy edildi: ${res2.workflow.name} (durum: ${status === 'Staged' ? tt('Staged', 'Hazır') : workflowDeployStatusLabel(status)}).`,
              ),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'workflow.activate') {
            const workflowId = asString(toolArgs.workflowId || toolArgs.id).trim();
            if (!workflowId) throw new Error(tt('Missing workflowId', 'workflowId eksik'));
            const updated = await activateProjectWorkflow({ projectId: project.id, workflowId });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(`Workflow activated: ${workflowId}`, `Workflow aktif edildi: ${workflowId}`),
            };
            chat = [...chat, out];
            onUpdate({ ...updated, operatorChat: chat });
          } else if (toolName === 'crm.suitecrm.syncLead') {
            const res2 = await createSuiteCrmLead({ projectId: project.id });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(`SuiteCRM lead synced: ${res2.lead.id}`, `SuiteCRM lead senkronlandı: ${res2.lead.id}`),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'finance.invoiceshelf.createInvoice') {
            const amount = asNumber(toolArgs.amount);
            const description = asString(toolArgs.description);
            if (!Number.isFinite(amount) || amount <= 0) throw new Error(tt('Invalid amount', 'Geçersiz tutar'));
            const res2 = await createInvoiceShelfInvoice({ projectId: project.id, amount, description });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(
                `Invoice created in InvoiceShelf (#${res2.invoice?.invoice_number ?? '—'}).`,
                `InvoiceShelf’te fatura oluşturuldu (#${res2.invoice?.invoice_number ?? '—'}).`,
              ),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'finance.invoiceshelf.createInvoiceFromCouncilLatest') {
            const modeRaw = asString(toolArgs.mode).trim();
            const mode = (['first_month', 'setup', 'monthly', 'all'] as const).includes(modeRaw as any) ? (modeRaw as any) : 'first_month';
            const sessions = await listCouncilSessions(project.id);
            const best = sessions
              .filter((s: any) => Array.isArray(s?.pricing?.lineItems) && s.pricing.lineItems.length > 0)
              .sort((a: any, b: any) => {
                const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
              })[0];
            if (!best?.id) {
              throw new Error(
                tt(
                  'No Board pricing session found. Run Strategic Gate first.',
                  'Yönetim Kurulu fiyatlandırma oturumu bulunamadı. Önce Strategic Gate çalıştır.',
                ),
              );
            }
            const res2 = await createInvoiceShelfInvoiceFromCouncil({ projectId: project.id, sessionId: String(best.id), mode });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(
                `Invoice created from Board pricing (#${res2.invoice?.invoice_number ?? '—'}, total: ${res2.council?.currency ?? ''} ${res2.council?.total ?? ''}).`,
                `Yönetim Kurulu fiyatlandırmasından fatura oluşturuldu (#${res2.invoice?.invoice_number ?? '—'}, toplam: ${res2.council?.currency ?? ''} ${res2.council?.total ?? ''}).`,
              ),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'finance.invoiceshelf.sync') {
            const res2 = await syncInvoiceShelfInvoiceStatuses({ projectId: project.id });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(
                `Invoice status sync: checked ${res2.summary.checked}, updated ${res2.summary.updated}.`,
                `Fatura durum senkronu: kontrol ${res2.summary.checked}, güncel ${res2.summary.updated}.`,
              ),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'contract.documenso.send') {
            const templateId = asNumber(toolArgs.templateId);
            const recipients = Array.isArray(toolArgs.recipients)
              ? toolArgs.recipients
                  .map((r: any) => ({ name: asString(r?.name).trim(), email: asString(r?.email).trim() }))
                  .filter((r: any) => r.email.length > 0)
              : [];
            if (!Number.isFinite(templateId)) throw new Error(tt('Missing/invalid templateId', 'templateId eksik/geçersiz'));
            if (recipients.length === 0) throw new Error(tt('Missing recipients (need at least one email).', 'Alıcı eksik (en az 1 e-posta gerekli).'));
            const title = asString(toolArgs.title).trim() || tt(`${project.brief.clientName} — Contract`, `${project.brief.clientName} — Sözleşme`);
            const subject = asString(toolArgs.subject).trim() || tt(`Contract for ${project.brief.clientName}`, `${project.brief.clientName} için sözleşme`);
            const message = asString(toolArgs.message).trim() || tt('Please review and sign.', 'Lütfen inceleyip imzalayın.');
            const sendEmail = toolArgs.sendEmail === false ? false : true;
            const redirectUrl = asString(toolArgs.redirectUrl).trim() || undefined;
            const res2 = await sendDocumensoContract({
              projectId: project.id,
              templateId: Number(templateId),
              recipients,
              title,
              subject,
              message,
              sendEmail,
              redirectUrl,
            });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(
                `Contract sent via Documenso (documentId: ${res2.documenso?.documentId ?? '—'}).`,
                `Documenso ile sözleşme gönderildi (documentId: ${res2.documenso?.documentId ?? '—'}).`,
              ),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'contract.documenso.sync') {
            const res2 = await syncDocumensoContractStatuses({ projectId: project.id });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(
                `Contract status sync: checked ${res2.summary.checked}, updated ${res2.summary.updated}.`,
                `Sözleşme durum senkronu: kontrol ${res2.summary.checked}, güncel ${res2.summary.updated}.`,
              ),
            };
            chat = [...chat, out];
            onUpdate({ ...res2.project, operatorChat: chat });
          } else if (toolName === 'council.run') {
            const gateType = asString(toolArgs.gateType || toolArgs.gate).trim() || 'Risk';
            const topic = asString(toolArgs.topic).trim() || `${gateType} Gate`;
            const session = await runCouncilSession({ projectId: project.id, gateType: gateType as any, topic, context: { brief: project.brief, workflows: project.activeWorkflows }, language });
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(`Board decision: ${session.decision}\n\n${session.synthesis}`, `Yönetim Kurulu kararı: ${session.decision}\n\n${session.synthesis}`),
            };
            chat = [...chat, out];
            onUpdate({ ...project, operatorChat: chat });
          } else {
            const out: OperatorMessage = {
              id: `msg-${Date.now() + 3}`,
              role: 'assistant',
              content: tt(`Tool not supported: ${toolName}`, `Desteklenmeyen araç: ${toolName}`),
            };
            chat = [...chat, out];
            onUpdate({ ...project, operatorChat: chat });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : tt('Unknown error', 'Bilinmeyen hata');
          const out: OperatorMessage = {
            id: `msg-${Date.now() + 3}`,
            role: 'assistant',
            content: tt(`Tool failed (${toolName}): ${msg}`, `Araç başarısız (${toolName}): ${msg}`),
          };
          chat = [...chat, out];
          onUpdate({ ...project, operatorChat: chat });
        }
      }
    } catch (e) {
      addLiveLogT('Operator node sync failed: Cluster timed out.', 'Operatör node senkronu başarısız: Cluster zaman aşımına uğradı.');
    } finally {
      setIsOperatorThinking(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (isCreatingInvoice) return;
    setInvoiceError(null);
    setInvoiceSyncMessage(null);
    setIsCreatingInvoice(true);
    addLiveLogT('Creating invoice in InvoiceShelf...', 'InvoiceShelf’te fatura oluşturuluyor...');
    try {
      const res = await createInvoiceShelfInvoice({ projectId: project.id, amount: invoiceAmount, description: invoiceDescription });
      onUpdate(res.project);
      addLiveLogT(`Invoice created (#${res.invoice?.invoice_number ?? '—'}).`, `Fatura oluşturuldu (#${res.invoice?.invoice_number ?? '—'}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Invoice create failed', 'Fatura oluşturma başarısız');
      setInvoiceError(msg);
      addLiveLogT(`Invoice creation failed: ${msg}`, `Fatura oluşturma başarısız: ${msg}`);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleSyncInvoiceStatuses = async () => {
    if (isSyncingInvoices) return;
    setInvoiceError(null);
    setInvoiceSyncMessage(null);
    setIsSyncingInvoices(true);
    addLiveLogT('Syncing invoice statuses from InvoiceShelf...', 'InvoiceShelf’ten fatura durumları senkronlanıyor...');
    try {
      const res = await syncInvoiceShelfInvoiceStatuses({ projectId: project.id });
      onUpdate(res.project);
      const errors = res.summary?.errors?.length ?? 0;
      const updated = res.summary?.updated ?? 0;
      setInvoiceSyncMessage(
        tt(
          `Synced. Updated ${updated} invoice doc(s).${errors ? ` Errors: ${errors}` : ''}`,
          `Senkronlandı. ${updated} fatura dokümanı güncellendi.${errors ? ` Hata: ${errors}` : ''}`,
        ),
      );
      addLiveLogT(`Invoice sync complete. Updated ${updated}.`, `Fatura senkronu tamam. Güncel: ${updated}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Invoice sync failed', 'Fatura senkronu başarısız');
      setInvoiceError(msg);
      addLiveLogT(`Invoice sync failed: ${msg}`, `Fatura senkronu başarısız: ${msg}`);
    } finally {
      setIsSyncingInvoices(false);
    }
  };

  const handleSyncSuiteCrmLead = async () => {
    if (isSyncingCrm) return;
    setCrmError(null);
    setIsSyncingCrm(true);
    addLiveLogT('Syncing lead to SuiteCRM...', 'SuiteCRM’e lead senkronlanıyor...');
    try {
      const res = await createSuiteCrmLead({ projectId: project.id });
      onUpdate(res.project);
      addLiveLogT(`SuiteCRM lead synced (${res.lead.id}).`, `SuiteCRM lead senkronlandı (${res.lead.id}).`);
      refreshSuiteCrmLeads().catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('SuiteCRM sync failed', 'SuiteCRM senkronu başarısız');
      setCrmError(msg);
      addLiveLogT(`SuiteCRM sync failed: ${msg}`, `SuiteCRM senkronu başarısız: ${msg}`);
    } finally {
      setIsSyncingCrm(false);
    }
  };

  const handleSendContract = async () => {
    if (isSendingContract) return;
    setContractError(null);
    setContractSyncMessage(null);

    if (!selectedDocumensoTemplateId) {
      setContractError(tt('Select a Documenso template first.', 'Önce bir Documenso template seç.'));
      return;
    }

    const trimmedRecipients = contractRecipients.map((r) => ({
      name: String(r.name ?? '').trim(),
      email: String(r.email ?? '').trim(),
    }));

    if (trimmedRecipients.length === 0 || trimmedRecipients.some((r) => !r.email)) {
      setContractError(tt('Recipient email is required.', 'Alıcı e-postası gerekli.'));
      return;
    }

    setIsSendingContract(true);
    addLiveLogT('Creating & sending contract via Documenso...', 'Documenso ile sözleşme oluşturuluyor ve gönderiliyor...');
    try {
      const res = await sendDocumensoContract({
        projectId: project.id,
        templateId: selectedDocumensoTemplateId,
        title: contractTitle,
        recipients: trimmedRecipients,
        sendEmail: contractSendEmail,
        subject: contractSubject,
        message: contractMessage,
      });
      onUpdate(res.project);
      addLiveLogT(`Contract sent (Documenso doc ${res.documenso.documentId}).`, `Sözleşme gönderildi (Documenso doc ${res.documenso.documentId}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Contract send failed', 'Sözleşme gönderimi başarısız');
      setContractError(msg);
      addLiveLogT(`Documenso failed: ${msg}`, `Documenso başarısız: ${msg}`);
    } finally {
      setIsSendingContract(false);
    }
  };

  const handleSyncContractStatuses = async () => {
    if (isSyncingContracts) return;
    setContractError(null);
    setContractSyncMessage(null);
    setIsSyncingContracts(true);
    addLiveLogT('Syncing contract statuses from Documenso...', 'Documenso’dan sözleşme durumları senkronlanıyor...');
    try {
      const res = await syncDocumensoContractStatuses({ projectId: project.id });
      onUpdate(res.project);
      const errors = res.summary?.errors?.length ?? 0;
      const updated = res.summary?.updated ?? 0;
      setContractSyncMessage(
        tt(
          `Synced. Updated ${updated} contract doc(s).${errors ? ` Errors: ${errors}` : ''}`,
          `Senkronlandı. ${updated} sözleşme dokümanı güncellendi.${errors ? ` Hata: ${errors}` : ''}`,
        ),
      );
      addLiveLogT(`Contract sync complete. Updated ${updated}.`, `Sözleşme senkronu tamam. Güncel: ${updated}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Contract sync failed', 'Sözleşme senkronu başarısız');
      setContractError(msg);
      addLiveLogT(`Contract sync failed: ${msg}`, `Sözleşme senkronu başarısız: ${msg}`);
    } finally {
      setIsSyncingContracts(false);
    }
  };

  const councilTimeoutMs = 15000;
  const isTimeoutError = (err: unknown) => String((err as Error)?.message ?? err).toLowerCase().includes('timeout');

  const handleRunDemoPipeline = async () => {
    if (isRunningDemo) return;
    setDemoError(null);
    setIsRunningDemo(true);

    let currentProject: Project = project;
    const query = [
      project.brief.description,
      ...project.brief.goals,
      ...project.brief.tools,
    ].filter(Boolean).join(' ');
    let strategicSession: any = null;

    addLiveLogT(
      'Revenue machine: starting (Board → Catalog → Deploy → CRM → Invoice)…',
      'Gelir makinesi: başlıyor (Yönetim Kurulu → Katalog → Deploy → CRM → Fatura)…',
    );
    try {
      try {
        const strategic = await runCouncilSession({
          projectId: project.id,
          gateType: 'Strategic' as any,
          topic: 'Proposal & Pricing Gate',
          context: { brief: project.brief, workflows: project.activeWorkflows },
          language,
          timeoutMs: councilTimeoutMs,
        });
        strategicSession = strategic;
        addLiveLogT(`Board (Strategic): ${strategic.decision}`, `Yönetim Kurulu (Strategic): ${strategic.decision}`);
      } catch (e) {
        addLiveLogT(
          isTimeoutError(e) ? 'Board (Strategic) skipped: timeout.' : 'Board (Strategic) skipped: AI offline.',
          isTimeoutError(e) ? 'Yönetim Kurulu (Strategic) atlandı: zaman aşımı.' : 'Yönetim Kurulu (Strategic) atlandı: AI kapalı.',
        );
      }

      try {
        const risk = await runCouncilSession({
          projectId: project.id,
          gateType: 'Risk' as any,
          topic: 'Risk & Test Gate',
          context: { brief: project.brief, workflows: project.activeWorkflows },
          language,
          timeoutMs: councilTimeoutMs,
        });
        addLiveLogT(`Board (Risk): ${risk.decision}`, `Yönetim Kurulu (Risk): ${risk.decision}`);
      } catch (e) {
        addLiveLogT(
          isTimeoutError(e) ? 'Board (Risk) skipped: timeout.' : 'Board (Risk) skipped: AI offline.',
          isTimeoutError(e) ? 'Yönetim Kurulu (Risk) atlandı: zaman aşımı.' : 'Yönetim Kurulu (Risk) atlandı: AI kapalı.',
        );
      }

      const recs = await searchWorkflowCatalog({ query, limit: 1 });
      if (!recs.length) throw new Error(tt('No workflows found for this brief.', 'Bu brief için workflow bulunamadı.'));
      const wf = recs[0].workflow;
      addLiveLogT(`Catalog: selected "${wf.name}"`, `Katalog: seçildi "${wf.name}"`);

      const installed = await installWorkflowToProject({ projectId: project.id, workflowId: wf.id, activate: false });
      currentProject = installed.project;
      onUpdate(currentProject);
      addLiveLogT(
        `Deploy: ${installed.workflow.deployment?.status || 'Staged'}`,
        `Deploy: ${installed.workflow.deployment?.status ? workflowDeployStatusLabel(installed.workflow.deployment.status) : tt('Staged', 'Hazır')}`,
      );

      try {
        const crm = await createSuiteCrmLead({ projectId: project.id });
        currentProject = crm.project;
        onUpdate(currentProject);
        addLiveLogT(`CRM: SuiteCRM lead synced (${crm.lead.id})`, `CRM: SuiteCRM lead senkronlandı (${crm.lead.id})`);
      } catch {
        addLiveLogT('CRM: SuiteCRM not configured (skipped).', 'CRM: SuiteCRM yapılandırılmamış (atlandı).');
      }

      try {
        const hasPricing = !!strategicSession?.pricing?.lineItems?.length;
        const inv = hasPricing
          ? await createInvoiceShelfInvoiceFromCouncil({ projectId: project.id, sessionId: String(strategicSession.id), mode: 'first_month' })
          : await createInvoiceShelfInvoice({
              projectId: project.id,
              amount: invoiceAmount,
              description: invoiceDescription || project.brief.description,
            });
        currentProject = inv.project;
        onUpdate(currentProject);
        addLiveLogT(
          `Invoice: created (${hasPricing ? 'from Board pricing' : 'manual'} #${inv.invoice?.invoice_number ?? '—'})`,
          `Fatura: oluşturuldu (${hasPricing ? 'Yönetim Kurulu fiyatlandırmasından' : 'manuel'} #${inv.invoice?.invoice_number ?? '—'})`,
        );
      } catch {
        addLiveLogT('Invoice: InvoiceShelf not configured (skipped).', 'Fatura: InvoiceShelf yapılandırılmamış (atlandı).');
      }

      const report: ProjectDocument = {
        id: `doc-${Date.now()}`,
        name: tt(`Report: Revenue Machine (${project.brief.clientName})`, `Rapor: Gelir Makinesi (${project.brief.clientName})`),
        type: 'Report',
        status: 'Draft',
        content: tt(
          [
            `Revenue machine executed for ${project.brief.clientName}.`,
            '',
            `- Catalog query: ${query}`,
            `- Selected workflow: ${wf.name} (${wf.id})`,
            `- Deployment: check Workflows tab`,
            `- CRM: check CRM tab`,
            `- Invoice: check Documents tab`,
          ].join('\n'),
          [
            `${project.brief.clientName} için gelir makinesi çalıştırıldı.`,
            '',
            `- Katalog sorgusu: ${query}`,
            `- Seçilen workflow: ${wf.name} (${wf.id})`,
            `- Deploy: Workflows sekmesini kontrol et`,
            `- CRM: CRM sekmesini kontrol et`,
            `- Fatura: Documents sekmesini kontrol et`,
          ].join('\n'),
        ),
        url: '#',
        createdAt: new Date().toISOString(),
      };
      onUpdate({ ...currentProject, documents: [report, ...currentProject.documents] });
      addLiveLogT('Revenue machine: complete.', 'Gelir makinesi: tamam.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Revenue machine failed', 'Gelir makinesi başarısız');
      setDemoError(msg);
      addLiveLogT(`Revenue machine failed: ${msg}`, `Gelir makinesi başarısız: ${msg}`);
    } finally {
      setIsRunningDemo(false);
    }
  };

  const n8nBaseUrl = (executionsState?.baseUrl || n8nStatus?.baseUrl || runtimeSettings?.n8nBaseUrl || 'http://localhost:5678').replace(/\/+$/, '');

  const getExecutionWorkflowName = (e: any) => {
    const wfId = String(e?._workflowId ?? e?.workflowId ?? '');
    const match = project.activeWorkflows.find(w => w.deployment?.n8nWorkflowId === wfId);
    return match?.name || wfId || tt('Unknown workflow', 'Bilinmeyen workflow');
  };

  const formatExecutionDuration = (e: any) => {
    const startedAt = e?.startedAt ? new Date(e.startedAt).getTime() : null;
    const stoppedAt = e?.stoppedAt ? new Date(e.stoppedAt).getTime() : null;
    if (!startedAt) return '—';
    const end = stoppedAt || Date.now();
    const ms = Math.max(0, end - startedAt);
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}${language === 'tr' ? 'sn' : 's'}`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return language === 'tr' ? `${min}dk ${rem}sn` : `${min}m ${rem}s`;
  };

  const executionBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'error' || s === 'crashed') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'running' || s === 'waiting') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'canceled') return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
    return 'bg-slate-900 text-slate-400 border-slate-800';
  };

  const executionStatusLabel = (status: string) => {
    const s = String(status || '').toLowerCase() || 'unknown';
    const map: Record<string, { en: string; tr: string }> = {
      success: { en: 'Success', tr: 'Başarılı' },
      error: { en: 'Error', tr: 'Hata' },
      crashed: { en: 'Crashed', tr: 'Çöktü' },
      running: { en: 'Running', tr: 'Çalışıyor' },
      waiting: { en: 'Waiting', tr: 'Beklemede' },
      canceled: { en: 'Canceled', tr: 'İptal' },
      unknown: { en: 'Unknown', tr: 'Bilinmiyor' },
    };
    if (map[s]) return map[s][language];
    return language === 'tr' ? status || map.unknown.tr : status || map.unknown.en;
  };

  const documentBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'draft') return 'bg-slate-900 text-slate-400 border-slate-800';
    if (s === 'sent') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'signed') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'paid') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-slate-900 text-slate-400 border-slate-800';
  };

  const tabLabel = (tab: ProjectTab) => {
    const map: Record<ProjectTab, { en: string; tr: string }> = {
      Workflows: { en: 'Workflows', tr: 'Workflow’lar' },
      Operator: { en: 'Operator', tr: 'Operatör' },
      CRM: { en: 'CRM', tr: 'CRM' },
      Documents: { en: 'Documents', tr: 'Dokümanlar' },
      Financials: { en: 'Financials', tr: 'Finans' },
      Monitoring: { en: 'Monitoring', tr: 'İzleme' },
      Settings: { en: 'Settings', tr: 'Ayarlar' },
    };
    return map[tab][language];
  };

  const workflowDeployStatusLabel = (status: NonNullable<Workflow['deployment']>['status']) => {
    const map: Record<NonNullable<Workflow['deployment']>['status'], { en: string; tr: string }> = {
      Staged: { en: 'Staged', tr: 'Hazır' },
      Imported: { en: 'Imported', tr: 'İmport' },
      Activated: { en: 'Activated', tr: 'Aktif' },
      Error: { en: 'Error', tr: 'Hata' },
    };
    return map[status][language];
  };

  const docStatusLabel = (status: ProjectDocument['status']) => {
    const map: Record<ProjectDocument['status'], { en: string; tr: string }> = {
      Draft: { en: 'Draft', tr: 'Taslak' },
      Sent: { en: 'Sent', tr: 'Gönderildi' },
      Signed: { en: 'Signed', tr: 'İmzalandı' },
      Paid: { en: 'Paid', tr: 'Ödendi' },
    };
    return map[status][language];
  };

  const docTypeLabel = (type: ProjectDocument['type']) => {
    const map: Record<ProjectDocument['type'], { en: string; tr: string }> = {
      Proposal: { en: 'Proposal', tr: 'Teklif' },
      SOW: { en: 'SOW', tr: 'SOW' },
      Invoice: { en: 'Invoice', tr: 'Fatura' },
      Contract: { en: 'Contract', tr: 'Sözleşme' },
      Report: { en: 'Report', tr: 'Rapor' },
    };
    return map[type][language];
  };

  const crmActivityTypeLabel = (type: CRMActivity['type']) => {
    const map: Record<CRMActivity['type'], { en: string; tr: string }> = {
      Call: { en: 'Call', tr: 'Arama' },
      Meeting: { en: 'Meeting', tr: 'Toplantı' },
      Email: { en: 'Email', tr: 'E-posta' },
      Note: { en: 'Note', tr: 'Not' },
      'Status Change': { en: 'Status Change', tr: 'Durum Değişikliği' },
    };
    return map[type][language];
  };

  const crmActivityStatusLabel = (status: CRMActivity['status']) => {
    const map: Record<CRMActivity['status'], { en: string; tr: string }> = {
      Completed: { en: 'Completed', tr: 'Tamamlandı' },
      Scheduled: { en: 'Scheduled', tr: 'Planlandı' },
      Pending: { en: 'Pending', tr: 'Bekliyor' },
      Draft: { en: 'Draft', tr: 'Taslak' },
    };
    return map[status][language];
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      {/* High-Fi Project Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-[40px] p-10 flex flex-wrap gap-12 items-center relative overflow-hidden shadow-2xl group">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
        <div className="flex-1 min-w-[300px] relative z-10">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
             <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{tt('Operational Instance', 'Operasyon Instance')}: {project.id.slice(0, 8)}</h2>
          </div>
          <h2 className="text-white text-5xl font-black leading-tight tracking-tighter uppercase mb-6 group-hover:text-indigo-400 transition-colors">{project.brief.clientName}</h2>
          <p className="text-slate-400 text-lg max-w-xl leading-relaxed font-medium">{project.brief.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {project.brief.industry ? (
              <span className="px-4 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {tt('Industry', 'Sektör')}: {project.brief.industry}
              </span>
            ) : null}
            <span className="px-4 py-2 rounded-2xl bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase tracking-widest text-green-700">
              {tt('Budget', 'Bütçe')}: {project.brief.budget || tt('TBD', 'TBD')}
            </span>
            <span className="px-4 py-2 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-700">
              {tt('Billed', 'Faturalandı')}: ${Math.round(project.totalBilled || 0).toLocaleString()}
            </span>
            <span className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
              project.brief.riskLevel === 'High' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
              project.brief.riskLevel === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700' :
              'bg-green-500/10 border-green-500/20 text-green-700'
            }`}>
              {tt('Risk', 'Risk')}: {project.brief.riskLevel}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-4 relative z-10">
          <button onClick={() => onOpenCouncil(project.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[24px] font-black transition-all shadow-xl shadow-indigo-600/30 flex items-center gap-3 border border-indigo-400/20 active:scale-95 group/btn">
            <span className="text-2xl group-hover:rotate-12 transition-transform">🏛️</span> {tt('Management Board', 'Yönetim Kurulu')}
          </button>
          <button
            onClick={handleRunDemoPipeline}
            disabled={isRunningDemo}
            className="bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-10 py-5 rounded-[24px] font-black transition-all shadow-xl shadow-green-600/20 flex items-center gap-3 border border-green-400/20 active:scale-95"
          >
            <span className="text-2xl">🚀</span> {isRunningDemo ? tt('Running…', 'Çalışıyor…') : tt('Run Revenue Machine', 'Gelir Makinesini Çalıştır')}
          </button>
          <button onClick={toggleVoiceMode} className={`px-10 py-5 rounded-[24px] font-black transition-all shadow-xl flex items-center gap-3 border active:scale-95 ${isVoiceActive ? 'bg-red-600/20 border-red-500/30 text-red-400 animate-pulse' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}>
             <span className="text-2xl">{isVoiceActive ? '🛑' : '🎙️'}</span> {isVoiceActive ? tt('Voice Active', 'Ses Aktif') : tt('Voice Operator', 'Ses Operatörü')}
          </button>
          {demoError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 text-[10px] font-black text-red-300 uppercase tracking-widest">
              {demoError}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <div className="flex gap-12 border-b border-slate-800/50 px-4 overflow-x-auto no-scrollbar">
            {(['Workflows', 'Operator', 'CRM', 'Documents', 'Financials', 'Monitoring', 'Settings'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-5 font-black text-xs uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                {tabLabel(tab)}
                {activeTab === tab && <div className="absolute bottom-[-1px] left-0 right-0 h-[3px] bg-indigo-500 rounded-full shadow-[0_0_15px_#6366f1]"></div>}
              </button>
            ))}
          </div>

          <div className="min-h-[600px] pt-4">
            {activeTab === 'Workflows' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                {project.activeWorkflows.map(wf => (
                  <div key={wf.id} className="bg-slate-800/40 border border-slate-700 p-10 rounded-[48px] flex flex-col justify-between transition-all group shadow-xl hover:border-indigo-500/30">
                    <div>
                      <div className="flex items-start justify-between gap-6 mb-4">
                        <h4 className="font-black text-white text-3xl tracking-tighter uppercase">{wf.name}</h4>
	                        {wf.deployment?.status && (
	                          <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${
	                            wf.deployment.status === 'Activated' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
	                            wf.deployment.status === 'Imported' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
	                            wf.deployment.status === 'Error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
	                            'bg-slate-900 text-slate-400 border-slate-800'
	                          }`}>
	                            {workflowDeployStatusLabel(wf.deployment.status)}
	                          </span>
	                        )}
                      </div>
                      <p className="text-slate-400 text-base leading-relaxed mb-8">{wf.description}</p>
                      <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
                         <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">{tt('Credentials Staged', 'Credential Hazır')}</h5>
                         <div className="flex flex-wrap gap-3">
                           {wf.credentials.map(c => <span key={c} className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/10 uppercase tracking-widest">{c}</span>)}
                         </div>
                         {wf.deployment?.n8nWorkflowId && (
                           <p className="mt-5 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                             n8n id: <span className="text-slate-400 font-mono">{wf.deployment.n8nWorkflowId}</span>
                           </p>
                         )}
                      </div>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <a
                        href={wf.jsonUrl}
                        className="text-center bg-slate-900 hover:bg-slate-800 text-slate-300 font-black py-5 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-slate-800 shadow-lg"
                      >
                        {tt('Download JSON', 'JSON İndir')}
                      </a>
                      <a
                        href={n8nBaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-center bg-slate-900 hover:bg-slate-800 text-slate-300 font-black py-5 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-slate-800 shadow-lg"
                      >
                        {tt('Open n8n', 'n8n Aç')}
                      </a>
                      <button
                        onClick={() => handleCopyImportUrl(wf)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-black py-5 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-slate-800 shadow-lg active:scale-95"
                      >
                        {tt('Copy Import URL', 'Import URL Kopyala')}
                      </button>
                      <button
                        onClick={() => handleResyncWorkflow(wf)}
                        disabled={!!isResyncingWorkflowId}
                        className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-300 font-black py-5 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-slate-800 shadow-lg active:scale-95"
                      >
                        {isResyncingWorkflowId === wf.id ? tt('Re-syncing…', 'Senkronlanıyor…') : tt('Re-sync (Import/Update)', 'Re-sync (İmport/Güncelle)')}
                      </button>
                      {wf.deployment?.status === 'Imported' && (
                        <button
                          onClick={() => handleActivateWorkflow(wf)}
                          disabled={!!isActivatingWorkflowId}
                          className="col-span-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-5 rounded-[24px] transition-all uppercase tracking-[0.2em] text-[10px] border border-indigo-400/20 shadow-2xl shadow-indigo-600/30 active:scale-95"
                        >
                          {isActivatingWorkflowId === wf.id ? tt('Activating…', 'Aktif ediliyor…') : tt('Activate in n8n', 'n8n’de Aktif Et')}
                        </button>
                      )}
                      {wf.deployment?.status === 'Error' && wf.deployment?.message && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/20 rounded-3xl p-5 text-[10px] font-black text-red-300 uppercase tracking-widest">
                          {wf.deployment.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {project.activeWorkflows.length === 0 && (
                  <div className="col-span-2 py-40 text-center bg-slate-800/20 rounded-[60px] border-2 border-dashed border-slate-800">
                     <p className="text-slate-600 font-black uppercase tracking-widest">{tt('No workflows deployed to cluster node.', 'Bu proje için workflow yok.')}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Operator' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden flex flex-col h-[750px] shadow-2xl relative">
                  <div className="p-8 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center text-3xl border border-indigo-400/20 shadow-2xl">🤖</div>
                        <div>
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">{tt('n8n MCP Cluster Operator', 'n8n MCP Cluster Operatörü')}</h3>
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{tt('Active Node', 'Aktif Node')}: W-A1-04</span>
                          </div>
                        </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-slate-950/40 custom-scrollbar relative z-10 no-scrollbar">
                    {project.operatorChat.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-[32px] p-8 shadow-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-indigo-600/20' : msg.role === 'system' ? 'bg-slate-800/30 text-slate-500 text-center w-full text-[10px] font-mono tracking-widest uppercase border border-slate-800' : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-xl'}`}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-10 bg-slate-900/95 border-t border-slate-800 flex gap-6 relative z-10">
                    <input type="text" value={operatorInput} onChange={(e) => setOperatorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleOperatorSend()} placeholder={tt('Command the node cluster…', 'Node cluster’a komut ver…')} className="flex-1 bg-slate-950 border border-slate-800 rounded-[24px] px-8 py-6 text-sm text-white outline-none focus:ring-4 focus:ring-indigo-500/10 font-medium tracking-tight shadow-inner" />
                    <button onClick={handleOperatorSend} className="bg-indigo-600 hover:bg-indigo-500 text-white px-14 rounded-[24px] font-black uppercase tracking-widest text-xs border border-indigo-400/20 shadow-xl shadow-indigo-600/20 transition-all active:scale-95">{tt('Execute', 'Çalıştır')}</button>
                  </div>
              </div>
            )}

            {activeTab === 'CRM' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-slate-900 border border-slate-800 rounded-[48px] p-10 shadow-2xl">
                  <div className="flex justify-between items-start gap-6 mb-8">
                    <div>
	                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">SuiteCRM</h4>
	                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
	                        {tt(
	                          'Requires `SUITECRM_USERNAME` + `SUITECRM_PASSWORD` in Agency Settings → Vault.',
	                          'Agency Settings → Vault içinde `SUITECRM_USERNAME` + `SUITECRM_PASSWORD` gerekir.',
	                        )}
	                      </p>
	                    </div>
                    <a
                      href={(runtimeSettings?.suitecrmBaseUrl || 'http://localhost:8091').replace(/\/+$/, '')}
                      target="_blank"
                      rel="noreferrer"
	                      className="bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
	                    >
	                      {tt('Open SuiteCRM', 'SuiteCRM Aç')}
	                    </a>
	                  </div>

                  {crmError && (
                    <div className="mb-8 bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                      {crmError}
                    </div>
                  )}

                  <button
                    onClick={handleSyncSuiteCrmLead}
                    disabled={isSyncingCrm}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-6 rounded-[30px] transition-all duration-300 uppercase tracking-[0.2em] text-[10px] shadow-2xl border border-indigo-400/20 active:scale-95"
	                  >
	                    {isSyncingCrm ? tt('Syncing…', 'Senkronlanıyor…') : tt('Create/Sync Lead to SuiteCRM', 'SuiteCRM’e Lead Oluştur/Senkronla')}
	                  </button>

                  <div className="mt-8 bg-slate-950/60 rounded-[32px] border border-slate-800 p-8 shadow-inner">
	                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
	                      <div>
	                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Lead Visibility', 'Lead Görünürlüğü')}</h5>
	                        <p className="text-slate-400 text-sm font-medium mt-2">
	                          {tt('Leads are tagged as', 'Lead’ler şu etiketle oluşturulur:')}{' '}
	                          <span className="font-mono text-slate-300">lead_source=AgencyOS</span>{' '}
	                          {tt('and include', 've açıklamada')}{' '}
	                          <span className="font-mono text-slate-300">AgencyOS Project: {project.id}</span>{' '}
	                          {tt('in the description.', 'bilgisi yer alır.')}
	                        </p>
	                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={suiteCrmLeadScope}
                          onChange={(e) => setSuiteCrmLeadScope(e.target.value as any)}
	                          className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
	                        >
	                          <option value="project">{tt('This project', 'Bu proje')}</option>
	                          <option value="agencyos">{tt('All AgencyOS leads', 'Tüm AgencyOS lead’leri')}</option>
	                          <option value="all">{tt('All leads', 'Tüm lead’ler')}</option>
	                        </select>
                        <button
                          onClick={() => refreshSuiteCrmLeads(suiteCrmLeadScope)}
	                          disabled={isLoadingSuiteCrmLeads}
	                          className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
	                        >
	                          {isLoadingSuiteCrmLeads ? tt('Refreshing…', 'Yenileniyor…') : tt('Refresh Leads', 'Lead’leri Yenile')}
	                        </button>
	                      </div>
	                    </div>

                    {suiteCrmLeadsError && (
                      <div className="mt-6 bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                        {suiteCrmLeadsError}
                      </div>
                    )}

                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-left">
	                        <thead>
	                          <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
	                            <th className="px-6 py-4">{tt('Name', 'İsim')}</th>
	                            <th className="px-6 py-4">{tt('Status', 'Durum')}</th>
	                            <th className="px-6 py-4">{tt('Source', 'Kaynak')}</th>
	                            <th className="px-6 py-4">{tt('Created', 'Oluşturma')}</th>
	                            <th className="px-6 py-4 text-right">{tt('Actions', 'İşlemler')}</th>
	                          </tr>
	                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {suiteCrmLeads.map((l) => {
                            const base = (runtimeSettings?.suitecrmBaseUrl || 'http://localhost:8091').replace(/\/+$/, '');
                            const url = `${base}/index.php?module=Leads&action=DetailView&record=${encodeURIComponent(l.id)}`;
                            return (
                              <tr key={l.id} className="hover:bg-indigo-600/5 transition-all">
                                <td className="px-6 py-4 text-sm text-slate-200 font-medium">{l.last_name || l.id}</td>
                                <td className="px-6 py-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">{l.status || '—'}</td>
                                <td className="px-6 py-4 text-[10px] text-slate-500 font-black uppercase tracking-widest">{l.lead_source || '—'}</td>
                                <td className="px-6 py-4 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                                  {l.date_entered ? new Date(l.date_entered).toLocaleString() : '—'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
	                                    className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-black px-4 py-2 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
	                                  >
	                                    {tt('Open', 'Aç')}
	                                  </a>
	                                </td>
	                              </tr>
                            );
                          })}
                          {suiteCrmLeads.length === 0 && (
                            <tr>
	                              <td colSpan={5} className="py-10 text-center text-slate-600 font-black uppercase tracking-widest text-[10px]">
	                                {isLoadingSuiteCrmLeads
	                                  ? tt('Loading…', 'Yükleniyor…')
	                                  : tt('No leads found (configure SuiteCRM + click Sync).', 'Lead bulunamadı (SuiteCRM’i yapılandır + Senkronla).')}
	                              </td>
	                            </tr>
	                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

	                  <div className="bg-slate-900 border border-slate-800 rounded-[48px] overflow-hidden shadow-2xl">
	                  <div className="p-10 border-b border-slate-800 bg-slate-900/50">
	                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">{tt('CRM Activity Log', 'CRM Aktivite Logu')}</h4>
	                  </div>
                  <div className="max-h-[520px] overflow-y-auto custom-scrollbar no-scrollbar">
                    <table className="w-full text-left">
                      <thead>
	                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
	                          <th className="px-10 py-6">{tt('Type', 'Tip')}</th>
	                          <th className="px-10 py-6">{tt('Subject', 'Konu')}</th>
	                          <th className="px-10 py-6">{tt('Status', 'Durum')}</th>
	                          <th className="px-10 py-6">{tt('When', 'Zaman')}</th>
	                        </tr>
	                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {project.crmActivities.map((a) => (
                          <tr key={a.id} className="hover:bg-indigo-600/5 transition-all">
	                            <td className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{crmActivityTypeLabel(a.type)}</td>
                            <td className="px-10 py-6 text-sm text-slate-200 font-medium">{a.subject}</td>
                            <td className="px-10 py-6">
                              <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-slate-700/50 text-slate-500 border-slate-700">
	                                {crmActivityStatusLabel(a.status)}
	                              </span>
                            </td>
                            <td className="px-10 py-6 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                              {new Date(a.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {project.crmActivities.length === 0 && (
                          <tr>
	                            <td colSpan={4} className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs">
	                              {tt('No CRM activities yet.', 'Henüz CRM aktivitesi yok.')}
	                            </td>
	                          </tr>
	                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Monitoring' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-slate-900 border border-slate-800 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>
	                   <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
	                      <span className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_#22c55e] ${executionsState?.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
	                      {tt('Operational Telemetry Hub', 'Operasyon Telemetri Merkezi')}
	                   </h3>
	                   {!executionsState?.connected && (
	                     <div className="mb-10 bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-3xl text-yellow-200 text-xs font-black uppercase tracking-widest">
	                       {tt(
	                         `n8n execution feed is offline. Set \`N8N_API_KEY\` in \`server/.env\` and ensure n8n is running at ${n8nBaseUrl}.`,
	                         `n8n execution feed kapalı. \`server/.env\` içinde \`N8N_API_KEY\` ayarla ve n8n’in ${n8nBaseUrl} adresinde çalıştığından emin ol.`,
	                       )}
	                       {executionsState?.reason ? ` (${executionsState.reason})` : ''}
	                     </div>
	                   )}
	                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
	                      {[
	                        {
	                          id: 'n8n',
	                          label: 'n8n',
	                          val: executionsState?.connected ? tt('Connected', 'Bağlı') : tt('Offline', 'Kapalı'),
	                          color: executionsState?.connected ? 'green' : 'red',
	                        },
	                        { id: 'executions', label: tt('Executions', 'Çalıştırmalar'), val: String(executionsState?.executions?.length ?? 0), color: 'blue' },
	                        {
	                          id: 'refresh',
	                          label: tt('Refresh', 'Yenileme'),
	                          val: isLoadingExecutions ? tt('Loading', 'Yükleniyor') : (lastExecutionRefreshAt ? new Date(lastExecutionRefreshAt).toLocaleTimeString() : '—'),
	                          color: 'indigo',
	                        },
	                        { id: 'baseUrl', label: tt('Base URL', 'Base URL'), val: n8nBaseUrl.replace(/^https?:\/\//, ''), color: 'green' },
	                      ].map((stat) => (
	                        <div key={stat.id} className="bg-slate-950/60 p-6 rounded-3xl border border-slate-800 shadow-inner group hover:border-indigo-500/30 transition-all">
	                           <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{stat.label}</p>
	                           <p className={`text-2xl font-black text-${stat.color}-400`}>{stat.val}</p>
	                        </div>
	                      ))}
	                   </div>
                   
	                   <div className="bg-slate-950 rounded-[32px] border border-slate-800 p-10 mb-10 shadow-inner">
	                        <div className="flex justify-between items-center mb-8">
	                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">{tt('Node Propagation Matrix', 'Node Yayılım Matrisi')}</h4>
	                            <div className="flex gap-2">
	                                {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-500/50 rounded-full animate-ping" style={{ animationDelay: `${i*200}ms` }}></div>)}
	                            </div>
	                        </div>
                        <div className="grid grid-cols-12 gap-3">
                            {matrixData.map((val, i) => (
                                <div key={i} className={`h-10 rounded-lg transition-all duration-700 shadow-xl ${val > 0.9 ? 'bg-red-500/40 animate-pulse' : val > 0.4 ? 'bg-indigo-500/30' : 'bg-slate-900 border border-slate-800'}`}></div>
                            ))}
                        </div>
                   </div>

	                   <div className="bg-slate-950 rounded-[32px] border border-slate-800 p-10 mb-10 shadow-inner">
	                     <div className="flex justify-between items-center mb-8">
	                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">{tt('Execution Feed', 'Execution Akışı')}</h4>
	                       <div className="flex items-center gap-4">
	                         <button
	                           onClick={refreshExecutions}
	                           disabled={isLoadingExecutions}
                           className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-300 font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
	                         >
	                           {isLoadingExecutions ? tt('Refreshing…', 'Yenileniyor…') : tt('Refresh', 'Yenile')}
	                         </button>
                         <a
                           href={n8nBaseUrl}
                           target="_blank"
                           rel="noreferrer"
	                           className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
	                         >
	                           {tt('Open n8n', 'n8n Aç')}
	                         </a>
	                       </div>
	                     </div>

                     {executionsState?.executions?.length ? (
                       <div className="space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar pr-4">
                         {executionsState.executions.slice(0, 30).map((e: any) => (
                           <div key={`${e.id}-${e.startedAt}`} className="flex items-center justify-between gap-6 p-5 bg-slate-900 rounded-3xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                             <div className="min-w-0">
                               <div className="flex items-center gap-3 mb-1">
	                                 <span className={`text-[9px] font-black px-3 py-1 rounded-xl uppercase tracking-widest border ${executionBadge(e.status)}`}>
	                                   {executionStatusLabel(String(e.status || 'unknown'))}
	                                 </span>
                                 <p className="text-[11px] font-black text-slate-200 truncate">
                                   {getExecutionWorkflowName(e)}
                                 </p>
                               </div>
	                               <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
	                                 {tt('Exec', 'Çalıştırma')} #{e.id} • {e.startedAt ? new Date(e.startedAt).toLocaleString() : '—'} • {formatExecutionDuration(e)}
	                               </p>
	                             </div>
	                             <div className="text-right">
	                               <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{tt('Mode', 'Mod')}</p>
	                               <p className="text-[11px] text-slate-300 font-black">{String(e.mode || '—')}</p>
	                             </div>
	                           </div>
                         ))}
                       </div>
                     ) : (
	                       <div className="py-20 text-center text-slate-600 font-black uppercase tracking-widest">
	                         {executionsState?.connected
	                           ? tt('No executions yet for installed workflows.', 'Kurulu workflow’lar için henüz execution yok.')
	                           : tt('Execution feed unavailable.', 'Execution feed erişilemiyor.')}
	                       </div>
	                     )}
                   </div>

                   <div className="h-48 bg-slate-950 rounded-3xl border border-slate-800 p-8 font-mono text-[10px] text-slate-600 overflow-y-auto no-scrollbar shadow-inner relative custom-scrollbar">
	                      {liveLog.length === 0
	                        ? tt('Establishing telemetry link to operational cluster...', 'Operasyon cluster’ına telemetri bağlantısı kuruluyor...')
	                        : liveLog.map((log, i) => (
	                            <p key={i} className="mb-2 hover:text-green-400 transition-colors cursor-default animate-in slide-in-from-left-2 duration-300">
	                              ❯ {log}
	                            </p>
	                          ))}
	                      <div ref={logEndRef} />
	                   </div>
                </div>
              </div>
            )}

            {activeTab === 'Documents' && (
	              <div className="bg-slate-900/40 border border-slate-800 rounded-[48px] overflow-hidden animate-in fade-in duration-500 h-[750px] flex flex-col shadow-2xl">
	                <div className="p-10 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
	                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">{tt('Strategic Artifact Archives', 'Stratejik Doküman Arşivi')}</h3>
	                    <div className="flex gap-4">
	                        <button onClick={() => handleSynthesize('Proposal')} disabled={!!isSynthesizing} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-indigo-400/20 hover:bg-indigo-500 transition-all disabled:opacity-50 active:scale-95">
	                            {isSynthesizing === 'Proposal' ? tt('Synthesizing...', 'Sentezleniyor...') : tt('Draft Proposal', 'Teklif Taslağı')}
	                        </button>
	                        <button onClick={() => handleSynthesize('SOW')} disabled={!!isSynthesizing} className="bg-slate-800 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl border border-slate-700 hover:bg-slate-700 transition-all disabled:opacity-50 active:scale-95">
	                            {isSynthesizing === 'SOW' ? tt('Synthesizing...', 'Sentezleniyor...') : tt('Draft SOW', 'SOW Taslağı')}
	                        </button>
	                    </div>
	                </div>

                <div className="p-10 border-b border-slate-800 bg-slate-950/30 space-y-8">
                  <div className="flex justify-between items-start gap-6">
                    <div>
	                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">Documenso E-Sign</h4>
	                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
	                        {tt(
	                          'Requires `DOCUMENSO_API_TOKEN` in Agency Settings → Vault.',
	                          'Agency Settings → Vault içinde `DOCUMENSO_API_TOKEN` gerekir.',
	                        )}
	                      </p>
	                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSyncContractStatuses}
                        disabled={isSyncingContracts}
	                        className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
	                      >
	                        {isSyncingContracts ? tt('Syncing…', 'Senkronlanıyor…') : tt('Sync Status', 'Durum Senkronu')}
	                      </button>
                      <a
                        href={(runtimeSettings?.documensoBaseUrl || 'http://localhost:8092').replace(/\/+$/, '')}
                        target="_blank"
                        rel="noreferrer"
	                        className="bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
	                      >
	                        {tt('Open Documenso', 'Documenso Aç')}
	                      </a>
                    </div>
                  </div>

                  {contractError && (
                    <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                      {contractError}
                    </div>
                  )}
                  {contractSyncMessage && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl text-indigo-200 text-xs font-black uppercase tracking-widest">
                      {contractSyncMessage}
                    </div>
                  )}

	                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
	                    <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Template', 'Template')}</p>
                      <select
                        value={selectedDocumensoTemplateId ?? ''}
                        onChange={(e) => setSelectedDocumensoTemplateId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
	                      >
	                        {!selectedDocumensoTemplateId && <option value="">{tt('Select…', 'Seç…')}</option>}
                        {documensoTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
	                      <p className="mt-3 text-[10px] text-slate-600 font-black uppercase tracking-widest">
	                        {isLoadingDocumensoTemplates
	                          ? tt('Loading templates…', 'Template’ler yükleniyor…')
	                          : tt(`${documensoTemplates.length} templates`, `${documensoTemplates.length} template`)}
	                      </p>
	                    </div>

	                    <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Delivery', 'Teslimat')}</p>
                      <label className="flex items-center gap-3 text-slate-300 text-xs font-black uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={contractSendEmail}
                          onChange={(e) => setContractSendEmail(e.target.checked)}
                        />
	                        {tt('Send email to recipients', 'Alıcılara e-posta gönder')}
	                      </label>
	                      <p className="mt-3 text-[10px] text-slate-600 font-black uppercase tracking-widest">
	                        {selectedDocumensoTemplate
	                          ? tt(
	                              `Recipients: ${selectedDocumensoTemplate.Recipient?.length || 0}`,
	                              `Alıcılar: ${selectedDocumensoTemplate.Recipient?.length || 0}`,
	                            )
	                          : tt('Select a template', 'Bir template seç')}
	                      </p>
	                    </div>
	                  </div>

                  {selectedDocumensoTemplate && (
                    <>
	                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
	                        <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Title', 'Başlık')}</p>
                          <input
                            value={contractTitle}
                            onChange={(e) => setContractTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                          />
                        </div>
	                        <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Subject', 'Konu')}</p>
                          <input
                            value={contractSubject}
                            onChange={(e) => setContractSubject(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                          />
                        </div>
                      </div>

	                      <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Message', 'Mesaj')}</p>
                        <textarea
                          value={contractMessage}
                          onChange={(e) => setContractMessage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono min-h-[90px]"
                        />
                      </div>

	                      <div className="space-y-4">
	                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{tt('Recipients', 'Alıcılar')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {contractRecipients.map((r, idx) => (
	                            <div key={idx} className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner space-y-4">
	                              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
	                                {tt('Recipient', 'Alıcı')} {idx + 1}
	                              </p>
                              <input
                                value={r.name}
                                onChange={(e) =>
                                  setContractRecipients((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                                }
	                                placeholder={tt('Name', 'İsim')}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                              />
                              <input
                                value={r.email}
                                onChange={(e) =>
                                  setContractRecipients((prev) => prev.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)))
                                }
	                                placeholder={tt('Email', 'E-posta')}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[11px] text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleSendContract}
                        disabled={isSendingContract}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-5 rounded-[30px] transition-all duration-300 uppercase tracking-[0.2em] text-[10px] shadow-2xl border border-indigo-400/20 active:scale-95"
	                      >
	                        {isSendingContract ? tt('Sending…', 'Gönderiliyor…') : tt('Create & Send Contract', 'Sözleşme Oluştur ve Gönder')}
	                      </button>
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
                    <table className="w-full text-left">
	                        <thead>
	                            <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
	                                <th className="px-10 py-6">{tt('Artifact', 'Doküman')}</th>
	                                <th className="px-10 py-6">{tt('Status', 'Durum')}</th>
	                                <th className="px-10 py-6 text-right">{tt('Actions', 'İşlemler')}</th>
	                            </tr>
	                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                            {project.documents.map((doc) => (
                                <tr key={doc.id} className="group hover:bg-indigo-600/5 transition-all cursor-pointer" onClick={() => setViewingDoc(doc)}>
                                    <td className="px-10 py-7">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">
                                              {doc.type === 'Invoice'
                                                ? '💰'
                                                : doc.type === 'Proposal'
                                                  ? '📜'
                                                  : doc.type === 'SOW'
                                                    ? '📑'
                                                    : doc.type === 'Contract'
                                                      ? '🖋️'
                                                      : '📊'}
                                            </span>
	                                            <div>
	                                                <p className="text-sm font-black text-slate-200 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{doc.name}</p>
	                                                <p className="text-[9px] text-slate-600 font-bold uppercase mt-1 tracking-widest">{docTypeLabel(doc.type)}</p>
	                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7">
	                                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${documentBadge(doc.status)}`}>{docStatusLabel(doc.status)}</span>
                                    </td>
                                    <td className="px-10 py-7 text-right">
                                        <button
                                          className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-all"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (doc.url && doc.url !== '#') window.open(doc.url, '_blank', 'noreferrer');
                                            else setViewingDoc(doc);
                                          }}
	                                        >
	                                          {tt('Open Artifact', 'Dokümanı Aç')}
	                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {project.documents.length === 0 && (
                              <tr>
	                                <td colSpan={3} className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs">
	                                  {tt('No strategic artifacts found in cluster archives.', 'Cluster arşivinde stratejik doküman bulunamadı.')}
	                                </td>
	                              </tr>
	                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

	            {activeTab === 'Financials' && (
	              <div className="space-y-12 animate-in fade-in duration-700">
	                 <div className="bg-slate-800/30 p-12 rounded-[40px] border border-slate-700/50 flex justify-between items-center shadow-2xl relative overflow-hidden group">
	                    <div className="absolute top-0 right-0 w-80 h-80 bg-green-500/5 blur-[100px] rounded-full"></div>
	                    <div className="relative z-10">
	                       <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">{tt('Resource ROI Matrix', 'Kaynak ROI Matrisi')}</h3>
	                       <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">{tt('Project-Level Performance Multiplier', 'Proje Bazlı Performans Çarpanı')}</p>
	                    </div>
                    <button
                      onClick={handleSyncInvoiceStatuses}
	                      disabled={isSyncingInvoices}
	                      className="bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-black px-10 py-5 rounded-3xl shadow-xl transition-all active:scale-95 uppercase tracking-widest border border-green-400/20"
	                    >
	                      {isSyncingInvoices ? tt('Syncing Invoice Status…', 'Fatura Durumları Senkronlanıyor…') : tt('Sync Invoice Status', 'Fatura Durumlarını Senkronla')}
	                    </button>
	                 </div>

                 <div className="bg-slate-900 border border-slate-800 rounded-[48px] p-10 shadow-2xl">
                    <div className="flex justify-between items-start gap-6 mb-8">
                      <div>
	                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">InvoiceShelf</h4>
	                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
	                          {tt(
	                            'Requires `INVOICESHELF_TOKEN` in Agency Settings → Vault.',
	                            'Agency Settings → Vault içinde `INVOICESHELF_TOKEN` gerekir.',
	                          )}
	                        </p>
	                      </div>
                      <a
                        href={(runtimeSettings?.invoiceshelfBaseUrl || 'http://localhost:8090').replace(/\/+$/, '')}
                        target="_blank"
	                        rel="noreferrer"
	                        className="bg-slate-800 hover:bg-slate-700 text-white font-black px-8 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-700 transition-all active:scale-95"
	                      >
	                        {tt('Open InvoiceShelf', 'InvoiceShelf Aç')}
	                      </a>
	                    </div>

                    {invoiceError && (
                      <div className="mb-8 bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                        {invoiceError}
                      </div>
                    )}
                    {invoiceSyncMessage && (
                      <div className="mb-8 bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl text-indigo-200 text-xs font-black uppercase tracking-widest">
                        {invoiceSyncMessage}
                      </div>
                    )}

	                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
	                      <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Amount', 'Tutar')}</p>
                        <input
                          type="number"
                          min={1}
                          value={invoiceAmount}
                          onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
	                      </div>
	                      <div className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">{tt('Line Item Description', 'Kalem Açıklaması')}</p>
                        <input
                          value={invoiceDescription}
                          onChange={(e) => setInvoiceDescription(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCreateInvoice}
	                      disabled={isCreatingInvoice}
	                      className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black py-6 rounded-[30px] transition-all duration-300 uppercase tracking-[0.2em] text-[10px] shadow-2xl border border-indigo-400/20 active:scale-95"
	                    >
	                      {isCreatingInvoice ? tt('Creating…', 'Oluşturuluyor…') : tt('Create Invoice in InvoiceShelf', 'InvoiceShelf’te Fatura Oluştur')}
	                    </button>
	                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
	                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl group hover:border-green-500/30 transition-all">
	                       <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2">{tt('Projected Value', 'Öngörülen Değer')}</p>
	                       <p className="text-5xl font-black text-white tracking-tighter">${project.financials.revenue.toLocaleString()}</p>
	                    </div>

	                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl group hover:border-indigo-500/30 transition-all">
	                       <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2">{tt('Labor Efficiency', 'İş Gücü Verimi')}</p>
	                       <p className="text-5xl font-black text-indigo-400 tracking-tighter">
	                         {project.financials.hoursSaved}
	                         {language === 'tr' ? 'sa' : 'h'} <span className="text-xs uppercase font-black text-slate-500">{tt('Saved', 'Tasarruf')}</span>
	                       </p>
	                    </div>

	                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl group hover:border-orange-500/30 transition-all">
	                       <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2">{tt('Execution Yield', 'Execution Verimi')}</p>
	                       <p className="text-5xl font-black text-white tracking-tighter">{(project.financials.revenue / (project.totalBilled || 1)).toFixed(2)}x</p>
	                    </div>
                 </div>
	              </div>
	            )}

	            {activeTab === 'Settings' && (
	              <div className="space-y-8 animate-in fade-in duration-500">
	                <div className="bg-slate-900 border border-slate-800 rounded-[48px] p-10 shadow-2xl">
	                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
	                    <div>
	                      <h4 className="text-xl font-black text-white uppercase tracking-tighter">{tt('Project Settings', 'Proje Ayarları')}</h4>
	                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
	                        {tt('Endpoints and quick links for this project.', 'Bu proje için endpoint’ler ve hızlı linkler.')}
	                      </p>
	                    </div>
	                    <div className="md:text-right">
	                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('API Base URL', 'API Base URL')}</p>
	                      <p className="mt-2 text-[11px] text-slate-200 font-mono break-all">{apiBaseUrl || 'http://localhost:7000'}</p>
	                    </div>
	                  </div>

	                  <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
	                    {[
	                      { id: 'n8n', name: 'n8n', url: n8nBaseUrl },
	                      { id: 'suitecrm', name: 'SuiteCRM', url: (runtimeSettings?.suitecrmBaseUrl || 'http://localhost:8091').replace(/\/+$/, '') },
	                      { id: 'invoiceshelf', name: 'InvoiceShelf', url: (runtimeSettings?.invoiceshelfBaseUrl || 'http://localhost:8090').replace(/\/+$/, '') },
	                      { id: 'documenso', name: 'Documenso', url: (runtimeSettings?.documensoBaseUrl || 'http://localhost:8092').replace(/\/+$/, '') },
	                      { id: 'infisical', name: 'Infisical', url: (runtimeSettings?.infisicalBaseUrl || 'http://localhost:8093').replace(/\/+$/, '') },
	                    ].map((svc) => (
	                      <div key={svc.id} className="bg-slate-950/60 rounded-3xl p-6 border border-slate-800 shadow-inner">
	                        <div className="flex items-start justify-between gap-4">
	                          <div className="min-w-0">
	                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{svc.name}</p>
	                            <p className="mt-2 text-[11px] text-slate-200 font-mono break-all">{svc.url}</p>
	                          </div>
	                          <a
	                            href={svc.url}
	                            target="_blank"
	                            rel="noreferrer"
	                            className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
	                          >
	                            {tt('Open', 'Aç')}
	                          </a>
	                        </div>
	                        {svc.id === 'n8n' && (
	                          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
	                            {tt('Status', 'Durum')}: {n8nStatus?.connected ? tt('Connected', 'Bağlı') : tt('Offline', 'Kapalı')}
	                            {n8nStatus?.reason ? ` (${n8nStatus.reason})` : ''}
	                          </p>
	                        )}
	                      </div>
	                    ))}
	                  </div>

	                  <p className="mt-10 text-[10px] text-slate-500 font-black uppercase tracking-widest">
	                    {tt('Credentials/tokens are configured in Agency Settings → Vault.', 'Credential/token ayarları Agency Settings → Vault içindedir.')}
	                  </p>
	                </div>
	              </div>
	            )}
	          </div>
	        </div>

        {/* Intelligence Sidebar */}
        <div className="xl:col-span-4 space-y-8">
	           <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-[48px] p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[80px] rounded-full"></div>
              <div className="flex items-center gap-6 mb-10">
                 <div className="w-16 h-16 bg-indigo-600 rounded-[28px] flex items-center justify-center text-3xl shadow-2xl border border-indigo-400/20 group-hover:rotate-6 transition-transform">🧠</div>
	                 <div>
	                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">{tt('Strategic Advisor', 'Stratejik Danışman')}</h3>
	                    <p className="text-white font-black text-sm tracking-tight mt-1 uppercase">{tt('Node Intelligence Feed', 'Node Zeka Akışı')}</p>
	                 </div>
	              </div>
	              <p className="text-indigo-600 leading-[1.8] text-sm font-medium italic">
	                "
	                {isLoadingAdvice
	                  ? tt('Recalibrating throughput data...', 'Throughput verisi yeniden kalibre ediliyor...')
	                  : strategicAdvice || tt('Analyzing operational cluster data...', 'Operasyon cluster verisi analiz ediliyor...')}
	                "
	              </p>
	              <button
	                onClick={() => refreshStrategicAdvice().catch(() => {})}
	                className="mt-10 w-full text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest border border-indigo-500/20 py-4 rounded-2xl transition-all"
	              >
	                {tt('Re-Sync Strategic Engine', 'Stratejik Motoru Yenile')}
	              </button>
	           </div>

	           <div className="bg-slate-800/40 border border-slate-700 rounded-[40px] p-10 shadow-2xl space-y-4">
	              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10 text-center uppercase tracking-widest">{tt('Strategic Controls', 'Stratejik Kontroller')}</h3>
	              <button onClick={handleStrategicPivot} disabled={isPivoting} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-indigo-500 transition-all shadow-xl active:scale-95">
	                 <span className="text-2xl group-hover:scale-110 transition-transform">📉</span>
	                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white">
	                   {isPivoting ? tt('Analyzing Pivot...', 'Pivot analiz ediliyor...') : tt('Strategic Pivot Analysis', 'Stratejik Pivot Analizi')}
	                 </span>
	                 <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">❯</span>
	              </button>
              
              {pivotAnalysis && (
                <div className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-[32px] animate-in slide-in-from-top-4 duration-500 space-y-4">
	                  <div className="flex justify-between items-center">
	                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{tt('Pivot Urgency', 'Pivot Aciliyeti')}</p>
	                    <p className="text-xl font-black text-white">{pivotAnalysis.urgency}%</p>
	                  </div>
	                  <p className="text-[11px] text-indigo-600 font-medium leading-relaxed italic">"{pivotAnalysis.recommendation}"</p>
	                  <button onClick={() => setPivotAnalysis(null)} className="w-full text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 pt-4">
	                    {tt('Dismiss Analysis', 'Analizi Kapat')}
	                  </button>
	                </div>
	              )}

	              <button onClick={() => handleSynthesize('SOW')} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between group hover:border-indigo-500 transition-all shadow-xl active:scale-95">
	                 <span className="text-2xl group-hover:scale-110 transition-transform">🖋️</span>
	                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white">{tt('Synthesize Technical SOW', 'Teknik SOW Sentezle')}</span>
	                 <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">❯</span>
	              </button>
	           </div>
	        </div>
      </div>

      {/* Artifact Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-slate-950 border border-slate-800 rounded-[60px] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(15,23,42,0.12)] animate-in zoom-in-95 duration-500">
             <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-slate-950/90">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl shadow-2xl border border-slate-700">
                       {viewingDoc.type === 'Invoice' ? '💰' : '📄'}
                   </div>
                   <div>
	                      <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{viewingDoc.name}</h3>
	                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">
	                        {tt('Classified Strategic Artifact', 'Sınıflandırılmış Stratejik Doküman')} • {tt('Archive Node', 'Arşiv Node')}{' '}
	                        {project.id.slice(0, 6)}
	                      </p>
	                   </div>
                </div>
                <button onClick={() => setViewingDoc(null)} className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center text-3xl font-light shadow-xl">&times;</button>
             </div>
             <div className="flex-1 overflow-y-auto p-20 text-slate-300 leading-relaxed font-serif text-xl bg-slate-900/40 custom-scrollbar">
	                <div className="max-w-3xl mx-auto whitespace-pre-wrap leading-[1.8] prose">
	                   {viewingDoc.content || tt('Artifact synchronization failed. Re-generation required.', 'Doküman senkronizasyonu başarısız. Yeniden üretim gerekli.')}
	                </div>
	             </div>
	             <div className="p-10 border-t border-slate-800 bg-slate-950/90 flex justify-end gap-6">
	                <button onClick={() => setViewingDoc(null)} className="px-10 py-4 rounded-2xl text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
	                  {tt('Close Archive', 'Arşivi Kapat')}
	                </button>
	                {viewingDoc.url && viewingDoc.url !== '#' ? (
	                  <a
	                    href={viewingDoc.url}
                    target="_blank"
                    rel="noreferrer"
	                    className="px-12 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all"
	                  >
	                    {tt('Open Link', 'Link Aç')}
	                  </a>
	                ) : (
	                  <button
	                    disabled
	                    className="px-12 py-4 rounded-2xl bg-slate-800 text-slate-500 font-black uppercase text-[10px] tracking-widest border border-slate-700"
	                  >
	                    {tt('No Link', 'Link Yok')}
	                  </button>
	                )}
	             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
