import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgencyDocument, AgencyDocumentType, AgencyState, JourneyGoal, Project, ProjectBrief, ProjectDocument, ProjectTab, RevenueGoal } from '../types';
import {
  createInvoiceShelfInvoice,
  createInvoiceShelfInvoiceFromCouncil,
  createSuiteCrmLead,
  generateAgencyDocument,
  getAgencyState,
  getIntegrationStatuses,
  installWorkflowToProject,
  runCouncilSession,
  saveProject,
  searchWorkflowCatalog,
  updateAgencyState,
} from '../services/api';
import { useI18n } from '../services/i18n';
import MarketRadar from './MarketRadar';

type CatalogPrefill = { query: string; requiredTags?: string[] };
type LocalizedText = { en: string; tr: string };

interface RevenueJourneyProps {
  projects: Project[];
  onOpenSetup: () => void;
  onOpenIntake: () => void;
  onCreateProject: (brief: ProjectBrief) => void;
  onProjectUpdate: (project: Project) => void;
  onOpenProject: (id: string, tab?: ProjectTab) => void;
  onOpenCatalog: (prefill?: CatalogPrefill) => void;
  onOpenCouncil: () => void;
  onOpenSettings: () => void;
  onOpenAssistant: (prompt?: string) => void;
  onOpenPassiveHub: () => void;
  onSeedDemo: () => Promise<boolean>;
}

type ModuleId = 'income' | 'agency' | 'youtube';

type JourneyTask = {
  id: string;
  module: ModuleId;
  title: LocalizedText;
  description: LocalizedText;
  cta?: LocalizedText;
  action?:
    | { kind: 'open'; target: 'setup' | 'intake' | 'council' | 'settings' }
    | { kind: 'seedDemo' }
    | { kind: 'catalog'; presets: Record<JourneyGoal, CatalogPrefill> }
    | { kind: 'doc'; docType: AgencyDocumentType }
    | { kind: 'machine' };
};

const GOALS: Array<{ id: JourneyGoal; label: LocalizedText; desc: LocalizedText }> = [
  { id: 'ai_agency', label: { en: 'AI Agency', tr: 'AI Ajansı' }, desc: { en: 'Consulting + delivery: proposals, scope, docs, faster delivery.', tr: 'Danışmanlık + üretim: teklif, kapsam, doküman, teslimat hızlandırma.' } },
  { id: 'automation_agency', label: { en: 'Automation Agency', tr: 'Otomasyon Ajansı' }, desc: { en: 'Process automation with n8n: integration, setup, monitoring, maintenance.', tr: 'n8n ile süreç otomasyonu: entegrasyon, kurulum, izleme, bakım.' } },
  { id: 'web_design_agency', label: { en: 'Web Design Agency', tr: 'Web Tasarım Ajansı' }, desc: { en: 'Project delivery + sales cycle + content and reporting automation.', tr: 'Proje teslimi + satış döngüsü + içerik ve raporlama otomasyonu.' } },
  { id: 'ads_agency', label: { en: 'Ads Agency', tr: 'Reklam Ajansı' }, desc: { en: 'Lead → CRM → proposal → report → invoice chain + dashboard.', tr: 'Lead → CRM → teklif → rapor → fatura zinciri + dashboard.' } },
  { id: 'youtube_systems', label: { en: 'YouTube Systems', tr: 'YouTube Sistemleri' }, desc: { en: 'Content → growth → revenue: plan, production pipeline, analytics, CTA.', tr: 'İçerik → büyüme → gelir: plan, üretim hattı, analiz, CTA.' } },
];

const MODULES: Array<{ id: ModuleId; title: LocalizedText; subtitle: LocalizedText }> = [
  { id: 'income', title: { en: 'Revenue Journey (0 → Revenue)', tr: 'Gelir Yolculuğu (0 → Kazanç)' }, subtitle: { en: 'Pick the goal, set up the system, close the first sale.', tr: 'Hedefi seç, sistemi kur, ilk satışı kapat.' } },
  { id: 'agency', title: { en: 'Agency Model', tr: 'Ajans Modeli' }, subtitle: { en: 'Service packages + sales path + contract/invoice.', tr: 'Hizmet paketleri + satış yolu + sözleşme/fatura.' } },
  { id: 'youtube', title: { en: 'YouTube Systems', tr: 'YouTube Sistemleri' }, subtitle: { en: 'Content pipeline + measurement + revenue stream.', tr: 'İçerik üretim hattı + ölçüm + gelir akışı.' } },
];

const TASKS: JourneyTask[] = [
  {
    id: 'income.revenuePlan',
    module: 'income',
    title: { en: 'Generate revenue plan (actionable)', tr: 'Gelir planını üret (uygulanabilir)' },
    description: { en: 'Create a 30-day plan from zero to revenue (checklist + metrics).', tr: '0’dan kazanca giden 30 günlük planı oluştur (checklist + metrik).' },
    cta: { en: 'Generate plan', tr: 'Plan üret' },
    action: { kind: 'doc', docType: 'RevenuePlan' },
  },
  {
    id: 'income.incomeStack',
    module: 'income',
    title: { en: 'Generate income stack (AI agency + YouTube + passive)', tr: 'Gelir stack’i üret (AI ajansı + YouTube + pasif)' },
    description: { en: 'One blueprint that combines active services, YouTube growth, and productized passive income.', tr: 'Aktif hizmet, YouTube büyüme ve ürünleştirilmiş pasif geliri tek blueprint’te birleştir.' },
    cta: { en: 'Generate stack', tr: 'Stack üret' },
    action: { kind: 'doc', docType: 'IncomeStack' },
  },
  {
    id: 'income.passiveIncome',
    module: 'income',
    title: { en: 'Design passive income system', tr: 'Pasif gelir sistemini tasarla' },
    description: { en: 'Productize your agency assets (templates, starter packs) and automate delivery.', tr: 'Ajans varlıklarını ürünleştir (template, starter pack) ve teslimatı otomatikleştir.' },
    cta: { en: 'Generate passive plan', tr: 'Pasif plan üret' },
    action: { kind: 'doc', docType: 'PassiveIncome' },
  },
  {
    id: 'income.setupTools',
    module: 'income',
    title: { en: 'Connect tools (minimum)', tr: 'Araçları bağla (minimum)' },
    description: { en: 'Connect AI (Gemini/OpenRouter) + n8n keys so the system can “one-click deploy”.', tr: 'AI (Gemini/OpenRouter) + n8n key’lerini bağla; sistem “tek tık deploy” yapabilsin.' },
    cta: { en: 'Setup Wizard', tr: 'Setup Wizard' },
    action: { kind: 'open', target: 'setup' },
  },
  {
    id: 'income.seedDemo',
    module: 'income',
    title: { en: 'Load 2 demo clients', tr: '2 demo müşteri yükle' },
    description: { en: 'Test the system end-to-end with two sample clients.', tr: 'Hazır iki örnek müşteri ile sistemi uçtan uca dene.' },
    cta: { en: 'Load demo', tr: 'Demo yükle' },
    action: { kind: 'seedDemo' },
  },
  {
    id: 'income.outboundPlaybook',
    module: 'income',
    title: { en: 'Generate outbound playbook (lead gen + outreach)', tr: 'Outbound playbook üret (lead gen + outreach)' },
    description: { en: 'Daily quotas + scripts + follow-ups so you can book calls and close the first client.', tr: 'Günlük kota + mesaj şablonu + follow-up ile görüşme al ve ilk müşteriyi kapat.' },
    cta: { en: 'Generate playbook', tr: 'Playbook üret' },
    action: { kind: 'doc', docType: 'OutboundPlaybook' },
  },
  {
    id: 'income.findWorkflows',
    module: 'income',
    title: { en: 'Find first automation pack', tr: 'İlk otomasyon paketini bul' },
    description: { en: 'Find goal-aligned workflows in the catalog and stage/import into the project.', tr: 'Hedefine uygun workflow’ları katalogdan bul ve projeye stage/import et.' },
    cta: { en: 'Open catalog', tr: 'Kataloğu aç' },
    action: {
      kind: 'catalog',
      presets: {
        ai_agency: { query: 'intake form webhook slack proposal sow invoice', requiredTags: ['webhook', 'slack'] },
        automation_agency: { query: 'webhook google sheets slack crm invoice', requiredTags: ['webhook'] },
        web_design_agency: { query: 'webflow form webhook slack notion invoice', requiredTags: ['webhook'] },
        ads_agency: { query: 'lead webhook facebook ads google sheets slack report', requiredTags: ['webhook'] },
        youtube_systems: { query: 'youtube analytics google sheets slack report', requiredTags: ['google sheets'] },
      },
    },
  },
  {
    id: 'income.governanceGate',
    module: 'income',
    title: { en: 'Pressure-test “risk + pricing” with the Board', tr: 'Yönetim Kurulu ile “risk + fiyat” pressure test' },
    description: { en: 'Avoid single-model decisions: run Strategic + Risk gates and save outputs.', tr: 'Tek model kararını engelle: Strategic + Risk gate çalıştır, çıktılarını kaydet.' },
    cta: { en: 'Board Room', tr: 'Yönetim Kurulu' },
    action: { kind: 'open', target: 'council' },
  },
  {
    id: 'income.revenueMachine',
    module: 'income',
    title: { en: 'Run revenue machine (first sale)', tr: 'Gelir makinesini çalıştır (ilk satış)' },
    description: { en: 'One click: Board → Catalog → Deploy → CRM → Invoice (best-effort).', tr: 'Tek tık: Yönetim Kurulu → Katalog → Deploy → CRM → Fatura (best-effort).' },
    cta: { en: 'Run machine', tr: 'Makineyi çalıştır' },
    action: { kind: 'machine' },
  },

  {
    id: 'agency.offerDoc',
    module: 'agency',
    title: { en: 'Generate service packages', tr: 'Hizmet paketlerini üret' },
    description: { en: 'Create Starter / Standard / Premium packages, scope boundaries, and pricing band.', tr: 'Starter / Standard / Premium paketlerini, kapsam sınırlarını ve fiyat bandını çıkar.' },
    cta: { en: 'Generate packages', tr: 'Paket üret' },
    action: { kind: 'doc', docType: 'Offer' },
  },
  {
    id: 'agency.salesPathDoc',
    module: 'agency',
    title: { en: 'Generate sales path', tr: 'Satış yolunu üret' },
    description: { en: 'Clarify Lead → CRM → proposal → contract → invoice flow + automation recommendations.', tr: 'Lead → CRM → teklif → sözleşme → fatura akışını netleştir + otomasyon önerileri.' },
    cta: { en: 'Generate sales path', tr: 'Satış yolu üret' },
    action: { kind: 'doc', docType: 'SalesPath' },
  },
  {
    id: 'agency.contractInvoice',
    module: 'agency',
    title: { en: 'Connect contract + invoicing integrations', tr: 'Sözleşme + fatura entegrasyonlarını bağla' },
    description: { en: 'Run the sales cycle for real with Documenso + InvoiceShelf.', tr: 'Documenso + InvoiceShelf ile “satış döngüsü”nü gerçek hayatta çalıştır.' },
    cta: { en: 'Settings', tr: 'Ayarlar' },
    action: { kind: 'open', target: 'settings' },
  },

  {
    id: 'youtube.systemDoc',
    module: 'youtube',
    title: { en: 'Generate YouTube system', tr: 'YouTube sistemini üret' },
    description: { en: 'Content pillars + weekly plan + production pipeline + metrics + CTA.', tr: 'İçerik sütunları + haftalık plan + üretim hattı + metrikler + CTA.' },
    cta: { en: 'Generate YouTube plan', tr: 'YouTube planı üret' },
    action: { kind: 'doc', docType: 'YouTubeSystem' },
  },
  {
    id: 'youtube.installAnalytics',
    module: 'youtube',
    title: { en: 'Install analytics/reporting workflow', tr: 'Analitik/raporlama workflow’u kur' },
    description: { en: 'Stage/import YouTube/GA4/Sheets reporting flow.', tr: 'YouTube/GA4/Sheets rapor akışını stage/import et.' },
    cta: { en: 'Open catalog', tr: 'Kataloğu aç' },
    action: {
      kind: 'catalog',
      presets: {
        ai_agency: { query: 'weekly report slack google sheets', requiredTags: ['slack', 'google sheets'] },
        automation_agency: { query: 'weekly report slack google sheets', requiredTags: ['slack', 'google sheets'] },
        web_design_agency: { query: 'weekly report slack google sheets', requiredTags: ['slack', 'google sheets'] },
        ads_agency: { query: 'facebook ads report google sheets slack', requiredTags: ['google sheets', 'slack'] },
        youtube_systems: { query: 'youtube analytics report google sheets', requiredTags: ['google sheets'] },
      },
    },
  },
];

function docIcon(type: AgencyDocumentType): string {
  if (type === 'Offer') return '📦';
  if (type === 'SalesPath') return '🧩';
  if (type === 'OutboundPlaybook') return '📣';
  if (type === 'YouTubeSystem') return '🎥';
  if (type === 'IncomeStack') return '🏗️';
  if (type === 'PassiveIncome') return '💤';
  return '🗺️';
}

function docLabel(type: AgencyDocumentType): LocalizedText {
  if (type === 'Offer') return { en: 'Service Packages', tr: 'Hizmet Paketleri' };
  if (type === 'SalesPath') return { en: 'Sales Path', tr: 'Satış Yolu' };
  if (type === 'OutboundPlaybook') return { en: 'Outbound Playbook', tr: 'Outbound Playbook' };
  if (type === 'YouTubeSystem') return { en: 'YouTube System', tr: 'YouTube Sistemleri' };
  if (type === 'IncomeStack') return { en: 'Income Stack', tr: 'Gelir Stack’i' };
  if (type === 'PassiveIncome') return { en: 'Passive Income', tr: 'Pasif Gelir' };
  return { en: 'Revenue Plan', tr: 'Gelir Planı' };
}

function parseMoneyAmount(input: string): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/([0-9]{1,3}([.,][0-9]{3})+|[0-9]+)([.,][0-9]{1,2})?/);
  if (!m) return null;
  const compact = m[0].replace(/[^\d.,]/g, '');
  const hasComma = compact.includes(',');
  const hasDot = compact.includes('.');
  let normalized = compact;
  if (hasComma && hasDot) {
    normalized = compact.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    const parts = compact.split(',');
    const last = parts[parts.length - 1] || '';
    normalized = last.length === 2 ? compact.replace(',', '.') : compact.replace(/,/g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseBudgetMonthly(budget: string): { currency: string; monthly: number } | null {
  const raw = String(budget ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const isMonthly = /month|monthly|\/\s*month|\/\s*mo|per\s*month|aylık|ay\s*\/|\/\s*ay|\/\s*aylık/.test(lower);
  if (!isMonthly) return null;
  const currency = raw.includes('₺') || /\btl\b|\btry\b/.test(lower) ? 'TRY' : raw.includes('€') || /\beur\b/.test(lower) ? 'EUR' : raw.includes('£') || /\bgbp\b/.test(lower) ? 'GBP' : raw.includes('$') || /\busd\b/.test(lower) ? 'USD' : 'USD';
  const amount = parseMoneyAmount(raw);
  if (!amount) return null;
  return { currency, monthly: amount };
}

function formatMoney(currency: string, amount: number, language: 'tr' | 'en'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

const RevenueJourney: React.FC<RevenueJourneyProps> = ({
  projects,
  onOpenSetup,
  onOpenIntake,
  onCreateProject,
  onProjectUpdate,
  onOpenProject,
  onOpenCatalog,
  onOpenCouncil,
  onOpenSettings,
  onOpenAssistant,
  onOpenPassiveHub,
  onSeedDemo,
}) => {
  const { language, tt } = useI18n();
  const [agency, setAgency] = useState<AgencyState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    n8n: { connected: boolean; baseUrl: string; reason?: string };
    suitecrm: { connected: boolean; baseUrl: string; reason?: string };
    invoiceshelf: { connected: boolean; baseUrl: string; reason?: string };
    documenso: { connected: boolean; baseUrl: string; reason?: string };
    infisical: { connected: boolean; baseUrl: string; reason?: string };
    apify: { connected: boolean; baseUrl: string; reason?: string };
    postgres: { connected: boolean; baseUrl: string; reason?: string };
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<AgencyDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState<AgencyDocumentType | null>(null);

  const [machineProjectId, setMachineProjectId] = useState<string>('');
  const [machineBusy, setMachineBusy] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);
  const [machineLogs, setMachineLogs] = useState<string[]>([]);
  const [machineInvoiceAmount, setMachineInvoiceAmount] = useState<number>(1500);
  const [machineForceInvoice, setMachineForceInvoice] = useState(false);
  const [coachInput, setCoachInput] = useState<string>('');
  const [moneyCurrency, setMoneyCurrency] = useState<'USD' | 'TRY' | 'EUR' | 'GBP'>('USD');
  const [moneyTarget, setMoneyTarget] = useState<number>(5000);
  const [moneyRetainer, setMoneyRetainer] = useState<number>(800);
  const [moneyCloseRate, setMoneyCloseRate] = useState<number>(25);
  const [moneyBookingRate, setMoneyBookingRate] = useState<number>(15);
  const [savingRevenueGoal, setSavingRevenueGoal] = useState(false);
  const [revenueGoalMessage, setRevenueGoalMessage] = useState<string | null>(null);
  const revenueGoalUpdatedAtRef = useRef<string | null>(null);

  const goal = agency?.goal ?? 'automation_agency';
  const completed = useMemo(() => new Set(agency?.completedTaskIds ?? []), [agency?.completedTaskIds]);
  const starterPreset = useMemo(() => {
    const task = TASKS.find((t) => t.id === 'income.findWorkflows');
    if (!task?.action || task.action.kind !== 'catalog') return undefined;
    return task.action.presets[goal];
  }, [goal]);

  useEffect(() => {
    if (!agency) return;
    const g = agency.revenueGoal;
    const stamp = String(g?.updatedAt || '');
    if (!stamp) return;
    if (revenueGoalUpdatedAtRef.current === stamp) return;
    setMoneyCurrency(g.currency as any);
    setMoneyTarget(Math.round(Number(g.targetMrr) || 0));
    setMoneyRetainer(Math.round(Number(g.avgRetainer) || 0));
    setMoneyCloseRate(Math.round(Number(g.closeRatePct) || 0));
    setMoneyBookingRate(Math.round(Number(g.bookingRatePct) || 0));
    revenueGoalUpdatedAtRef.current = stamp;
  }, [agency?.revenueGoal?.updatedAt]);

  const revenueSnapshot = useMemo(() => {
    const billed = projects.reduce((sum, p) => sum + (Number(p.totalBilled) || 0), 0);
    const pipeline = projects
      .filter((p) => p.status !== 'Live')
      .map((p) => parseBudgetMonthly(p.brief.budget))
      .filter(Boolean) as Array<{ currency: string; monthly: number }>;
    const active = projects
      .filter((p) => p.status === 'Live')
      .map((p) => parseBudgetMonthly(p.brief.budget))
      .filter(Boolean) as Array<{ currency: string; monthly: number }>;

    const sumBy = (rows: Array<{ currency: string; monthly: number }>) => {
      const out: Record<string, number> = {};
      for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + r.monthly;
      return out;
    };

    return {
      billed,
      pipelineMonthlyByCurrency: sumBy(pipeline),
      activeMonthlyByCurrency: sumBy(active),
      pipelineCount: pipeline.length,
      activeCount: active.length,
    };
  }, [projects]);

  const revenueMath = useMemo(() => {
    const target = Math.max(0, Number(moneyTarget) || 0);
    const retainer = Math.max(0, Number(moneyRetainer) || 0);
    const closeRate = Math.min(100, Math.max(0, Number(moneyCloseRate) || 0));
    const bookingRate = Math.min(100, Math.max(0, Number(moneyBookingRate) || 0));

    const clientsNeeded = retainer > 0 ? Math.ceil(target / retainer) : 0;
    const callsNeeded = closeRate > 0 ? Math.ceil(clientsNeeded / (closeRate / 100)) : 0;
    const leadsNeeded = bookingRate > 0 ? Math.ceil(callsNeeded / (bookingRate / 100)) : 0;

    const perWeek = Math.ceil(leadsNeeded / 4);
    const perDay = Math.ceil(leadsNeeded / 20);

    return {
      target,
      retainer,
      closeRate,
      bookingRate,
      clientsNeeded,
      callsNeeded,
      leadsNeeded,
      perWeek,
      perDay,
    };
  }, [moneyTarget, moneyRetainer, moneyCloseRate, moneyBookingRate]);

  const moduleProgress = useMemo(() => {
    const out: Record<ModuleId, { done: number; total: number }> = {
      income: { done: 0, total: 0 },
      agency: { done: 0, total: 0 },
      youtube: { done: 0, total: 0 },
    };
    for (const t of TASKS) {
      out[t.module].total += 1;
      if (completed.has(t.id)) out[t.module].done += 1;
    }
    return out;
  }, [completed]);

  const progressValues = Object.values(moduleProgress) as Array<{ done: number; total: number }>;
  const totalDone = progressValues.reduce((sum, p) => sum + p.done, 0);
  const totalAll = progressValues.reduce((sum, p) => sum + p.total, 0);
  const overallPct = totalAll ? Math.round((totalDone / totalAll) * 100) : 0;

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const s = await getAgencyState();
      setAgency(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to load agency state', 'Ajans durumu yüklenemedi'));
      setAgency(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const refreshIntegrations = async () => {
    setIsLoadingIntegrations(true);
    try {
      const status = await getIntegrationStatuses();
      setIntegrationStatus(status);
    } catch {
      setIntegrationStatus(null);
    } finally {
      setIsLoadingIntegrations(false);
    }
  };

  useEffect(() => {
    refreshIntegrations().catch(() => {});
  }, []);

  useEffect(() => {
    if (machineProjectId) return;
    if (!projects.length) return;
    setMachineProjectId(projects[0].id);
  }, [projects.length, machineProjectId]);

  const persist = async (patch: Partial<{ goal: JourneyGoal; completedTaskIds: string[]; revenueGoal: RevenueGoal }>) => {
    setError(null);
    try {
      const next = await updateAgencyState(patch);
      setAgency(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to save', 'Kaydedilemedi'));
      throw e;
    }
  };

  const toggleTask = async (id: string) => {
    if (!agency) return;
    const nextIds = completed.has(id)
      ? agency.completedTaskIds.filter((t) => t !== id)
      : [...agency.completedTaskIds, id];
    await persist({ completedTaskIds: nextIds });
  };

  const changeGoal = async (nextGoal: JourneyGoal) => {
    setMessage(null);
    await persist({ goal: nextGoal });
    setMessage(tt('Goal updated. Now execute modules in order.', 'Hedef güncellendi. Şimdi modülleri sırayla uygula.'));
  };

  const saveRevenueGoal = async () => {
    if (savingRevenueGoal) return;
    setRevenueGoalMessage(null);
    setSavingRevenueGoal(true);
    try {
      await persist({
        revenueGoal: {
          currency: moneyCurrency,
          targetMrr: Math.max(0, Number(moneyTarget) || 0),
          avgRetainer: Math.max(0, Number(moneyRetainer) || 0),
          closeRatePct: Math.min(100, Math.max(0, Number(moneyCloseRate) || 0)),
          bookingRatePct: Math.min(100, Math.max(0, Number(moneyBookingRate) || 0)),
          updatedAt: new Date().toISOString(),
        },
      });
      setRevenueGoalMessage(tt('Revenue goal saved.', 'Gelir hedefi kaydedildi.'));
    } catch (e) {
      setRevenueGoalMessage(e instanceof Error ? e.message : tt('Failed to save revenue goal', 'Gelir hedefi kaydedilemedi'));
    } finally {
      setSavingRevenueGoal(false);
    }
  };

  const runAction = async (task: JourneyTask) => {
    setMessage(null);
    setError(null);

    const a = task.action;
    if (!a) return;

    if (a.kind === 'machine') {
      try {
        const ok = await runRevenueMachine();
        if (ok && agency && !completed.has(task.id)) {
          await toggleTask(task.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : tt('Revenue Machine failed', 'Gelir Makinesi başarısız'));
      }
      return;
    }

    if (a.kind === 'open') {
      if (a.target === 'setup') return onOpenSetup();
      if (a.target === 'intake') return onOpenIntake();
      if (a.target === 'council') return onOpenCouncil();
      return onOpenSettings();
    }

    if (a.kind === 'seedDemo') {
      try {
        const ok = await onSeedDemo();
        if (ok && agency && !completed.has(task.id)) {
          await toggleTask(task.id);
        }
        if (ok) {
          setMessage(tt('Demo clients loaded. Open a project and run “Run Revenue Machine”.', 'Demo müşteriler yüklendi. Bir projeyi açıp “Gelir Makinesini Çalıştır” çalıştır.'));
        } else {
          setError(tt('Demo could not be loaded. Check API logs.', 'Demo yüklenemedi. API loglarını kontrol et.'));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : tt('Demo seed failed', 'Demo yükleme başarısız'));
      }
      return;
    }

    if (a.kind === 'catalog') {
      const prefill = a.presets[goal];
      onOpenCatalog(prefill);
      return;
    }

    if (a.kind === 'doc') {
      if (isGenerating) return;
      setIsGenerating(a.docType);
      try {
        const out = await generateAgencyDocument({ type: a.docType, markTaskId: task.id });
        setAgency(out.agency);
        setMessage(tt(`${docLabel(a.docType).en} generated and saved to the archive.`, `${docLabel(a.docType).tr} üretildi ve arşive kaydedildi.`));
      } catch (e) {
        setError(e instanceof Error ? e.message : tt('Document generation failed', 'Doküman üretimi başarısız'));
      } finally {
        setIsGenerating(null);
      }
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(tt('Copied.', 'Kopyalandı.'));
    } catch {
      setMessage(tt('Copy failed. Please copy manually.', 'Kopyalanamadı. Manuel kopyala.'));
    }
  };

  const badge = (connected: boolean, reason?: string) => {
    if (connected) return { label: tt('Connected', 'Bağlı'), cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
    if (reason?.startsWith('Missing')) return { label: tt('Needs Config', 'Kurulum Gerekli'), cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' };
    return { label: tt('Offline', 'Kapalı'), cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  };

  const addMachineLog = (en: string, tr: string) => {
    const line = language === 'tr' ? tr : en;
    setMachineLogs((prev) => [line, ...prev].slice(0, 30));
  };

  const councilTimeoutMs = 15000;
  const isTimeoutError = (err: unknown) => String((err as Error)?.message ?? err).toLowerCase().includes('timeout');

  const runRevenueMachine = async (): Promise<boolean> => {
    if (machineBusy) return false;
    setMachineBusy(true);
    setMachineError(null);
    setMachineLogs([]);

    const project = projects.find((p) => p.id === machineProjectId) ?? projects[0] ?? null;
    if (!project) {
      setMachineBusy(false);
      setMachineError(tt('No projects found. Create one from Market Radar or Intake.', 'Proje yok. Market Radar veya Intake ile proje oluştur.'));
      return false;
    }

    let current: Project = project;
    const query = [
      current.brief.industry,
      current.brief.description,
      ...current.brief.goals,
      ...current.brief.tools,
    ]
      .filter(Boolean)
      .join(' ');

    addMachineLog(
      `Revenue Machine started for ${current.brief.clientName}.`,
      `${current.brief.clientName} için Gelir Makinesi başlatıldı.`,
    );

    let strategic: any = null;
    try {
      try {
        addMachineLog('Board: running Strategic gate…', 'Yönetim Kurulu: Strategic gate çalışıyor…');
        strategic = await runCouncilSession({
          projectId: current.id,
          gateType: 'Strategic' as any,
          topic: 'Proposal & Pricing Gate',
          context: { brief: current.brief, workflows: current.activeWorkflows },
          language,
          timeoutMs: councilTimeoutMs,
        });
        addMachineLog(`Board (Strategic): ${strategic.decision}`, `Yönetim Kurulu (Strategic): ${strategic.decision}`);
      } catch (e) {
        addMachineLog(
          isTimeoutError(e) ? 'Board (Strategic) skipped (timeout).' : 'Board (Strategic) skipped (AI offline).',
          isTimeoutError(e) ? 'Yönetim Kurulu (Strategic) atlandı (zaman aşımı).' : 'Yönetim Kurulu (Strategic) atlandı (AI kapalı).',
        );
      }

      try {
        addMachineLog('Board: running Risk gate…', 'Yönetim Kurulu: Risk gate çalışıyor…');
        const risk = await runCouncilSession({
          projectId: current.id,
          gateType: 'Risk' as any,
          topic: 'Risk & Test Gate',
          context: { brief: current.brief, workflows: current.activeWorkflows },
          language,
          timeoutMs: councilTimeoutMs,
        });
        addMachineLog(`Board (Risk): ${risk.decision}`, `Yönetim Kurulu (Risk): ${risk.decision}`);
      } catch (e) {
        addMachineLog(
          isTimeoutError(e) ? 'Board (Risk) skipped (timeout).' : 'Board (Risk) skipped (AI offline).',
          isTimeoutError(e) ? 'Yönetim Kurulu (Risk) atlandı (zaman aşımı).' : 'Yönetim Kurulu (Risk) atlandı (AI kapalı).',
        );
      }

      addMachineLog('Catalog: searching best workflow…', 'Katalog: en iyi workflow aranıyor…');
      const recs = await searchWorkflowCatalog({ query, limit: 1 });
      if (!recs.length) throw new Error(tt('No workflows matched this project.', 'Bu projeye uygun workflow bulunamadı.'));
      const wf = recs[0].workflow;
      addMachineLog(`Catalog: selected "${wf.name}".`, `Katalog: seçildi "${wf.name}".`);

      addMachineLog('Deploy: staging/importing workflow…', 'Deploy: workflow stage/import ediliyor…');
      const installed = await installWorkflowToProject({ projectId: current.id, workflowId: wf.id, activate: false });
      current = installed.project;
      onProjectUpdate(current);
      addMachineLog(
        `Deploy: ${installed.workflow.deployment?.status || 'Staged'}.`,
        `Deploy: ${installed.workflow.deployment?.status || 'Hazır'}.`,
      );

      try {
        addMachineLog('CRM: syncing lead to SuiteCRM…', "CRM: SuiteCRM'e lead aktarılıyor…");
        const crm = await createSuiteCrmLead({ projectId: current.id });
        current = crm.project;
        onProjectUpdate(current);
        addMachineLog(`CRM: lead synced (${crm.lead.id}).`, `CRM: lead aktarıldı (${crm.lead.id}).`);
      } catch (e) {
        const reason = e instanceof Error ? e.message : '';
        addMachineLog(
          `CRM: skipped (${reason || 'SuiteCRM not configured'}).`,
          `CRM: atlandı (${reason || 'SuiteCRM yapılandırılmamış'}).`,
        );
      }

      try {
        const hasPricing = Boolean(strategic?.pricing?.lineItems?.length);
        if (!hasPricing && !machineForceInvoice) {
          addMachineLog('Invoice: skipped (no Board pricing).', 'Fatura: atlandı (Yönetim Kurulu fiyatı yok).');
        } else {
          addMachineLog('Invoice: creating in InvoiceShelf…', 'Fatura: InvoiceShelf’te oluşturuluyor…');
          const inv = hasPricing
            ? await createInvoiceShelfInvoiceFromCouncil({ projectId: current.id, sessionId: String(strategic.id), mode: 'first_month' })
            : await createInvoiceShelfInvoice({ projectId: current.id, amount: machineInvoiceAmount, description: current.brief.description });
          current = inv.project;
          onProjectUpdate(current);
          addMachineLog('Invoice: created.', 'Fatura: oluşturuldu.');
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : '';
        addMachineLog(
          `Invoice: skipped (${reason || 'InvoiceShelf not configured'}).`,
          `Fatura: atlandı (${reason || 'InvoiceShelf yapılandırılmamış'}).`,
        );
      }

      const report: ProjectDocument = {
        id: `doc-${Date.now()}`,
        name: tt(`Report: Revenue Machine (${current.brief.clientName})`, `Rapor: Gelir Makinesi (${current.brief.clientName})`),
        type: 'Report',
        status: 'Draft',
        content: tt(
          [
            `Revenue Machine executed for ${current.brief.clientName}.`,
            '',
            `- Catalog query: ${query}`,
            `- Board Strategic: ${strategic?.decision || 'SKIPPED'}`,
            `- Workflows: ${current.activeWorkflows.length}`,
            `- CRM: SuiteCRM sync attempted`,
            `- Invoice: InvoiceShelf attempted`,
          ].join('\n'),
          [
            `${current.brief.clientName} için Gelir Makinesi çalıştırıldı.`,
            '',
            `- Katalog sorgusu: ${query}`,
            `- Yönetim Kurulu Strategic: ${strategic?.decision || 'ATLANDI'}`,
            `- Workflow sayısı: ${current.activeWorkflows.length}`,
            `- CRM: SuiteCRM senkron denendi`,
            `- Fatura: InvoiceShelf denendi`,
          ].join('\n'),
        ),
        url: '#',
        createdAt: new Date().toISOString(),
      };

      try {
        const saved = await saveProject({ ...current, documents: [report, ...current.documents] });
        onProjectUpdate(saved);
        addMachineLog('Report: saved to project Documents.', 'Rapor: proje Documents içine kaydedildi.');
      } catch {
        onProjectUpdate({ ...current, documents: [report, ...current.documents] });
        addMachineLog('Report: saved locally (API offline).', 'Rapor: lokal kaydedildi (API kapalı).');
      }

      addMachineLog('Revenue Machine: complete.', 'Gelir Makinesi: tamamlandı.');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Revenue Machine failed', 'Gelir Makinesi başarısız');
      setMachineError(msg);
      addMachineLog(`Revenue Machine failed: ${msg}`, `Gelir Makinesi başarısız: ${msg}`);
      return false;
    } finally {
      setMachineBusy(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">{tt('Revenue Journey Platform', 'Gelir Yolculuğu Platformu')}</h2>
            <p className="text-slate-400 mt-3 text-sm font-medium leading-relaxed">
              {tt(
                'No matter your goal (AI agency / automation agency / web design / ads agency / YouTube), choose your path here and execute step-by-step. Training isn’t “watchable content”; it’s a checklist + ready systems.',
                'Hedefin ne olursa olsun (AI ajansı / otomasyon ajansı / web tasarım / reklam ajansı / YouTube), burada yolunu seçip adım adım uygulayarak ilerlersin. Eğitim “izlenecek içerik” değil; yapılacaklar listesi + hazır sistemler.',
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <div className="bg-slate-900 px-6 py-4 rounded-3xl border border-slate-800 shadow-xl text-right min-w-[260px]">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Progress', 'İlerleme')}</p>
              <p className="text-3xl font-black text-white mt-2 tracking-tight">{overallPct}%</p>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2">
                {totalDone}/{totalAll} {tt('steps completed', 'adım tamamlandı')}
              </p>
            </div>
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
            >
              {isLoading ? tt('Refreshing…', 'Yenileniyor…') : tt('Refresh', 'Yenile')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-[36px] shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-700">{tt('Pipeline potential (monthly)', 'Pipeline potansiyeli (aylık)')}</p>
          <p className="mt-3 text-3xl font-black text-slate-200 tracking-tight">
            {Object.keys(revenueSnapshot.pipelineMonthlyByCurrency).length
              ? Object.entries(revenueSnapshot.pipelineMonthlyByCurrency)
                  .map(([c, v]) => formatMoney(c, Number(v) || 0, language))
                  .join(' • ')
              : tt('—', '—')}
          </p>
          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {tt('From project budgets (non-Live).', 'Proje bütçelerinden (Live olmayan).')} • {revenueSnapshot.pipelineCount}{' '}
            {tt('projects', 'proje')}
          </p>
        </div>
        <div className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-[36px] shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{tt('Active retainers (monthly)', 'Aktif retainer (aylık)')}</p>
          <p className="mt-3 text-3xl font-black text-slate-200 tracking-tight">
            {Object.keys(revenueSnapshot.activeMonthlyByCurrency).length
              ? Object.entries(revenueSnapshot.activeMonthlyByCurrency)
                  .map(([c, v]) => formatMoney(c, Number(v) || 0, language))
                  .join(' • ')
              : tt('—', '—')}
          </p>
          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {tt('Only Live projects with monthly budgets.', 'Sadece Live projeler (aylık bütçeli).')} • {revenueSnapshot.activeCount}{' '}
            {tt('projects', 'proje')}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[36px] shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Billed to date', 'Şimdiye kadar faturalandı')}</p>
          <p className="mt-3 text-3xl font-black text-slate-200 tracking-tight">{formatMoney('USD', revenueSnapshot.billed, language)}</p>
          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {tt('Tracked in projects (totalBilled).', 'Projelerde takip edilir (totalBilled).')}
          </p>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[36px] shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Revenue math', 'Gelir matematiği')}</p>
            <p className="mt-2 text-sm text-slate-200 font-bold">
              {tt('A simple funnel calculator: target → clients → calls → leads.', 'Basit bir funnel hesaplayıcı: hedef → müşteri → görüşme → lead.')}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full lg:max-w-4xl">
            <div className="col-span-2 md:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Currency', 'Para birimi')}</p>
              <select
                value={moneyCurrency}
                onChange={(e) => {
                  setRevenueGoalMessage(null);
                  setMoneyCurrency(e.target.value as any);
                }}
                className="mt-2 w-full bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
              >
                {(['USD', 'TRY', 'EUR', 'GBP'] as const).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Target MRR', 'Hedef MRR')}</p>
              <input
                type="number"
                min={0}
                value={moneyTarget}
                onChange={(e) => {
                  setRevenueGoalMessage(null);
                  setMoneyTarget(Number(e.target.value));
                }}
                className="mt-2 w-full bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Avg retainer', 'Ort. retainer')}</p>
              <input
                type="number"
                min={0}
                value={moneyRetainer}
                onChange={(e) => {
                  setRevenueGoalMessage(null);
                  setMoneyRetainer(Number(e.target.value));
                }}
                className="mt-2 w-full bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Close %', 'Kapanış %')}</p>
              <input
                type="number"
                min={0}
                max={100}
                value={moneyCloseRate}
                onChange={(e) => {
                  setRevenueGoalMessage(null);
                  setMoneyCloseRate(Number(e.target.value));
                }}
                className="mt-2 w-full bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Book %', 'Görüşme %')}</p>
              <input
                type="number"
                min={0}
                max={100}
                value={moneyBookingRate}
                onChange={(e) => {
                  setRevenueGoalMessage(null);
                  setMoneyBookingRate(Number(e.target.value));
                }}
                className="mt-2 w-full bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Target', 'Hedef')}</p>
            <p className="mt-2 text-2xl font-black text-slate-200">{formatMoney(moneyCurrency, revenueMath.target, language)}</p>
          </div>
          <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Clients needed', 'Gerekli müşteri')}</p>
            <p className="mt-2 text-2xl font-black text-slate-200">{revenueMath.clientsNeeded}</p>
          </div>
          <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Calls needed', 'Gerekli görüşme')}</p>
            <p className="mt-2 text-2xl font-black text-slate-200">{revenueMath.callsNeeded}</p>
          </div>
          <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Leads needed', 'Gerekli lead')}</p>
            <p className="mt-2 text-2xl font-black text-slate-200">{revenueMath.leadsNeeded}</p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              {tt('≈', '≈')} {revenueMath.perWeek}/{tt('week', 'hafta')} • {revenueMath.perDay}/{tt('day', 'gün')}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={saveRevenueGoal}
            disabled={savingRevenueGoal}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all shadow-xl active:scale-95"
          >
            {savingRevenueGoal ? tt('Saving…', 'Kaydediliyor…') : tt('Save goal', 'Hedefi kaydet')}
          </button>
          <button
            onClick={() =>
              onOpenAssistant(
                tt(
                  `I want to hit ${formatMoney(moneyCurrency, revenueMath.target, 'en')} MRR. My average retainer is ${formatMoney(moneyCurrency, revenueMath.retainer, 'en')}. Close rate is ${revenueMath.closeRate}%, booking rate is ${revenueMath.bookingRate}%. Create a 14-day outbound plan (daily quotas, scripts, follow-ups) and tell me which screens to use in AgencyOS (Market Radar → Leads, SuiteCRM, Board, Catalog).`,
                  `Aylık hedefim ${formatMoney(moneyCurrency, revenueMath.target, 'tr')} MRR. Ortalama retainer ${formatMoney(moneyCurrency, revenueMath.retainer, 'tr')}. Kapanış oranı %${revenueMath.closeRate}, görüşme oranı %${revenueMath.bookingRate}. 14 günlük outbound planı (günlük kota, mesaj şablonları, follow-up) çıkar ve AgencyOS’ta hangi ekranları kullanacağımı söyle (Market Radar → Leads, SuiteCRM, Yönetim Kurulu, Katalog).`,
                ),
              )
            }
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
          >
            {tt('Ask AI for 14-day plan', 'AI’den 14 günlük plan iste')}
          </button>
          {revenueGoalMessage && (
            <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">{revenueGoalMessage}</div>
          )}
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-[36px] shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('AI coach', 'AI koç')}</p>
            <p className="mt-2 text-sm text-slate-200 font-bold">
              {tt('Describe what you want. The assistant will ask the right questions and take you to the next step.', 'Ne istediğini yaz. Asistan doğru soruları sorar ve seni sıradaki adıma götürür.')}
            </p>
          </div>
          <div className="flex gap-3 w-full lg:max-w-xl">
            <input
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder={tt('e.g. “I want to sell AI automation to dentists in Istanbul”', 'örn. “İstanbul’da diş kliniklerine AI otomasyon satmak istiyorum”')}
              className="flex-1 bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />
            <button
              onClick={() =>
                onOpenAssistant(
                  coachInput.trim() ||
                    tt(
                      `I am a beginner. My goal is ${goal}. Ask me 5 short questions, then give the next 3 actions in AgencyOS (buttons to click) to reach first revenue.`,
                      `Ben yeni başlıyorum. Hedefim: ${goal}. Bana 5 kısa soru sor, sonra AgencyOS içinde ilk kazanca gitmek için sıradaki 3 aksiyonu (tıklanacak ekranlar) ver.`,
                    ),
                )
              }
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
            >
              {tt('Ask AI', 'AI’ye Sor')}
            </button>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`p-6 rounded-[36px] border shadow-2xl ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{error ?? message}</p>
        </div>
      )}

      <MarketRadar
        goal={goal}
        onOpenCatalog={onOpenCatalog}
        onOpenSettings={onOpenSettings}
        onOpenAssistant={onOpenAssistant}
        onOpenProject={onOpenProject}
        onCreateProject={onCreateProject}
        suitecrmStatus={integrationStatus?.suitecrm}
        targets={{ leadsNeeded: revenueMath.leadsNeeded, callsNeeded: revenueMath.callsNeeded, clientsNeeded: revenueMath.clientsNeeded }}
      />

      <div className="bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Revenue Machine (First Sale)', 'Gelir Makinesi (İlk Satış)')}</h3>
            <p className="text-slate-400 mt-2 text-sm font-medium leading-relaxed">
              {tt(
                'Run the end-to-end pipeline on a project: Board → Catalog → Deploy → CRM → Invoice. Steps are best-effort and skip if not configured.',
                'Bir proje üzerinde uçtan uca pipeline çalıştır: Yönetim Kurulu → Katalog → Deploy → CRM → Fatura. Adımlar “best-effort” çalışır; kurulu değilse atlar.',
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onOpenProject(machineProjectId || projects[0]?.id || '', 'Workflows')}
                disabled={!projects.length}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
              >
                {tt('Open project', 'Projeyi aç')}
              </button>
              <button
                onClick={onOpenSettings}
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
              >
                {tt('Configure integrations', 'Entegrasyonları ayarla')}
              </button>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl min-w-[360px]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Target project', 'Hedef proje')}</p>
            <select
              value={machineProjectId}
              onChange={(e) => setMachineProjectId(e.target.value)}
              className="mt-4 w-full bg-slate-950 border border-slate-800 rounded-3xl px-5 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
              disabled={!projects.length}
            >
              {projects.length === 0 ? (
                <option value="">{tt('-- No projects yet --', '-- Henüz proje yok --')}</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brief.clientName}
                  </option>
                ))
              )}
            </select>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <input
                    type="checkbox"
                    checked={machineForceInvoice}
                    onChange={(e) => setMachineForceInvoice(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  {tt('Create invoice even without Board pricing', 'Yönetim Kurulu fiyatı olmasa da fatura oluştur')}
                </label>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Fallback invoice amount', 'Yedek fatura tutarı')}</p>
                <input
                  type="number"
                  min={1}
                  value={machineInvoiceAmount}
                  onChange={(e) => setMachineInvoiceAmount(Number(e.target.value))}
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white"
                />
              </div>
            </div>

            <button
              onClick={runRevenueMachine}
              disabled={machineBusy || !projects.length}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black px-8 py-5 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
            >
              {machineBusy ? tt('Running…', 'Çalışıyor…') : tt('Run Revenue Machine', 'Gelir Makinesini Çalıştır')}
            </button>
          </div>
        </div>

        {(machineError || machineLogs.length) && (
          <div className="relative z-10 mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`p-6 rounded-[36px] border shadow-2xl ${machineError ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
              <p className="text-xs font-black uppercase tracking-widest">{machineError ?? tt('Pipeline executed.', 'Pipeline çalıştırıldı.')}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-6 shadow-xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Run log', 'Çalıştırma logu')}</p>
              <div className="mt-4 space-y-2">
                {machineLogs.slice(0, 10).map((l, idx) => (
                  <p key={idx} className="text-[11px] text-slate-300 font-mono leading-relaxed">
                    - {l}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-5 space-y-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Choose Goal', 'Hedef Seç')}</p>
            <div className="mt-6 grid grid-cols-1 gap-4">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => changeGoal(g.id)}
                  className={`p-6 rounded-[32px] border text-left transition-all ${goal === g.id ? 'bg-indigo-600/10 border-indigo-500/20 text-white shadow-xl' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-black uppercase tracking-tight">{g.label[language]}</p>
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border ${goal === g.id ? 'border-indigo-500/30 text-indigo-300 bg-indigo-600/10' : 'border-slate-800 text-slate-500 bg-slate-900/50'}`}>
                      {goal === g.id ? tt('Active', 'Aktif') : tt('Select', 'Seç')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium mt-2 leading-relaxed">{g.desc[language]}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Quick Actions', 'Hızlı Aksiyonlar')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={onOpenSetup} className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95">
                <p className="text-xs font-black text-white uppercase tracking-tight">{tt('Setup Wizard', 'Setup Wizard')}</p>
                <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">{tt('Keys + integrations', 'Key’ler + entegrasyonlar')}</p>
              </button>
              <button onClick={onOpenIntake} className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95">
                <p className="text-xs font-black text-white uppercase tracking-tight">{tt('New Project', 'Yeni Proje')}</p>
                <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">{tt('Client brief → pipeline', 'Client brief → pipeline')}</p>
              </button>
              <button
                onClick={() => onOpenCatalog(starterPreset)}
                className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95"
              >
                <p className="text-xs font-black text-white uppercase tracking-tight">{tt('Workflow Catalog', 'Workflow Kataloğu')}</p>
                <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">{tt('Goal-based preset', 'Hedefe göre preset')}</p>
              </button>
              <button onClick={onOpenCouncil} className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95">
                <p className="text-xs font-black text-white uppercase tracking-tight">{tt('Board Room', 'Yönetim Kurulu')}</p>
                <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">{tt('Pricing + risk gates', 'Fiyat + risk kapısı')}</p>
              </button>
              <button onClick={onOpenAssistant} className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95">
                <p className="text-xs font-black text-white uppercase tracking-tight">{tt('Global Assistant', 'Global Asistan')}</p>
                <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">{tt('System-wide AI (memory)', 'Tüm sistem AI (hafıza)')}</p>
              </button>
              <button onClick={onOpenPassiveHub} className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95">
                <p className="text-xs font-black text-white uppercase tracking-tight">{tt('Passive Income Hub', 'Pasif Gelir Hub')}</p>
                <p className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">{tt('Ideas → plan → assets', 'Fikir → plan → asset')}</p>
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Integrations', 'Entegrasyonlar')}</p>
              <button
                onClick={() => refreshIntegrations()}
                disabled={isLoadingIntegrations}
                className="bg-slate-950/60 hover:bg-slate-900 disabled:bg-slate-900/40 text-slate-200 font-black px-4 py-2.5 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
              >
                {isLoadingIntegrations ? tt('Checking…', 'Kontrol…') : tt('Refresh', 'Yenile')}
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              {tt('Tip: connect AI + n8n first, then CRM/contract/invoice.', 'İpucu: önce AI + n8n, sonra CRM/sözleşme/fatura.')}
            </p>
            <div className="mt-6 space-y-3">
              {(['n8n', 'suitecrm', 'documenso', 'invoiceshelf', 'infisical', 'apify', 'postgres'] as const).map((key) => {
                const s = integrationStatus?.[key];
                const b = badge(Boolean(s?.connected), s?.reason);
                const url = typeof s?.baseUrl === 'string' ? s.baseUrl.trim() : '';
                const canOpen = /^https?:\/\//i.test(url);
                return (
                  <div key={key} className="flex items-center justify-between gap-4 bg-slate-950/40 border border-slate-800 rounded-3xl px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white uppercase tracking-tight">{key}</p>
                      <p className="text-[10px] text-slate-600 font-mono truncate">{s?.baseUrl || '—'}</p>
                      {s?.reason && !s.connected && <p className="mt-1 text-[10px] text-slate-600 font-bold">{s.reason}</p>}
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
                      <button
                        onClick={onOpenSettings}
                        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
                      >
                        {tt('Configure', 'Ayarla')}
                      </button>
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${b.cls}`}>
                        {b.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!integrationStatus && !isLoadingIntegrations && (
                <div className="text-center text-slate-600 text-xs font-black uppercase tracking-widest py-8">
                  {tt('API offline (start `npm run dev:up`).', 'API kapalı (`npm run dev:up` çalıştır).')}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Workflow Search Presets', 'Workflow Arama Presetleri')}</p>
            <p className="mt-3 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              {tt(
                'Tip: in the catalog, use',
                'İpucu: kataloğa gidince',
              )}{' '}
              <span className="text-slate-300">AI Assist</span>{' '}
              {tt('to expand the query.', 'ile sorguyu genişlet.')}
            </p>
            <div className="mt-6 space-y-3">
              {(() => {
                const preset = starterPreset;
                if (!preset) return null;
                return (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white uppercase tracking-tight">{tt('Starter Search', 'Başlangıç Araması')}</p>
                        <p className="mt-2 text-[10px] text-slate-500 font-mono break-words">{preset.query}</p>
                        {preset.requiredTags?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {preset.requiredTags.map((t) => (
                              <span key={t} className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-800 bg-slate-900 text-slate-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => onOpenCatalog(preset)}
                          className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                        >
                          {tt('Open', 'Aç')}
                        </button>
                        <button
                          onClick={() => copy(preset.query)}
                          className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-black uppercase text-[10px] tracking-widest border border-slate-800 transition-all active:scale-95"
                        >
                          {tt('Copy', 'Kopyala')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-10">
          {MODULES.map((m) => {
            const p = moduleProgress[m.id];
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            const tasks = TASKS.filter((t) => t.module === m.id);
            return (
              <div key={m.id} className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-600/5 blur-[110px] rounded-full -ml-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase">{m.title[language]}</h3>
                    <p className="text-slate-400 mt-2 text-sm font-medium">{m.subtitle[language]}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-3xl px-6 py-4 shadow-xl min-w-[220px]">
                    <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Progress', 'İlerleme')}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{pct}%</p>
                  </div>
                    <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    <p className="mt-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {p.done}/{p.total} {tt('steps', 'adım')}
                    </p>
                  </div>
                </div>

                <div className="relative z-10 mt-8 space-y-3">
                  {tasks.map((t) => {
                    const done = completed.has(t.id);
                    const busy = isGenerating && t.action?.kind === 'doc' && t.action.docType === isGenerating;
                    return (
                      <div key={t.id} className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-7 shadow-xl">
                        <div className="flex items-start gap-5">
                          <button
                            onClick={() => toggleTask(t.id)}
                            disabled={!agency}
                            className={`mt-1 w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${done ? 'bg-green-600/20 border-green-500/30 text-green-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white hover:border-slate-700'}`}
                            title={done ? tt('Done', 'Tamam') : tt('Mark done', 'Tamamlandı işaretle')}
                          >
                            {done ? '✓' : ''}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white uppercase tracking-tight">{t.title[language]}</p>
                            <p className="mt-2 text-[11px] text-slate-500 font-medium leading-relaxed">{t.description[language]}</p>
                          </div>
                          {t.action && (
                            <button
                              onClick={() => runAction(t)}
                              disabled={busy || (t.action.kind === 'doc' && isGenerating !== null)}
                              className="px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                              title={t.cta?.[language] ?? tt('Run', 'Çalıştır')}
                            >
                              {busy ? tt('Running…', 'Çalışıyor…') : (t.cta?.[language] ?? tt('Open', 'Aç'))}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] p-10 shadow-2xl">
            <div className="flex items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Archive', 'Arşiv')}</h3>
                <p className="text-slate-400 mt-2 text-sm font-medium">{tt('Generated system documents are stored here.', 'Üretilen sistem dokümanları burada saklanır.')}</p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(agency?.documents ?? []).length === 0 ? (
                <div className="md:col-span-2 bg-slate-950/40 border border-slate-800 rounded-[36px] p-10 text-center">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{tt('No documents yet', 'Henüz doküman yok')}</p>
                  <p className="text-slate-600 text-sm mt-2">{tt('Generate “Plan/Packages/Sales Path/YouTube” above.', 'Yukarıdan “Plan/Paket/Satış Yolu/YouTube” üret.')}</p>
                </div>
              ) : (
                (agency?.documents ?? []).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setViewingDoc(d)}
                    className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-7 text-left hover:border-indigo-500/30 transition-all shadow-xl active:scale-95"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-2xl">
                          {docIcon(d.type)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white tracking-tight truncate">{d.name}</p>
                          <p className="mt-1 text-[10px] text-slate-600 font-black uppercase tracking-widest">{docLabel(d.type)[language]} • {new Date(d.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${d.status === 'Final' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
                        {d.status === 'Final' ? tt('Final', 'Final') : tt('Draft', 'Taslak')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {viewingDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-slate-950 border border-slate-800 rounded-[60px] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(15,23,42,0.12)] animate-in zoom-in-95 duration-500">
            <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-slate-950/90">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl shadow-2xl border border-slate-700">
                  {docIcon(viewingDoc.type)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{viewingDoc.name}</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">
                    {docLabel(viewingDoc.type)[language]} • {new Date(viewingDoc.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingDoc(null)} className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center text-3xl font-light shadow-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-20 text-slate-300 leading-relaxed font-serif text-xl bg-slate-900/40 custom-scrollbar">
              <div className="max-w-3xl mx-auto whitespace-pre-wrap leading-[1.8] prose">
                {viewingDoc.content}
              </div>
            </div>
            <div className="p-10 border-t border-slate-800 bg-slate-950/90 flex justify-end gap-6">
              <button onClick={() => setViewingDoc(null)} className="px-10 py-4 rounded-2xl text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">{tt('Close', 'Kapat')}</button>
              <button
                onClick={() => copy(viewingDoc.content)}
                className="px-12 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all"
              >
                {tt('Copy', 'Kopyala')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueJourney;
