import React, { useEffect, useMemo, useState } from 'react';
import type { AppLanguage, AssistantMessage, AssistantPreferences, AssistantState, JourneyGoal, MarketLeadCandidate, MarketOpportunity, OutboundLead, OutboundStage } from '../types';
import {
  assistantLog,
  assistantRespond,
  createOutboundLead,
  generateAgencyDocument,
  generateLeadPitch,
  generateMarketOpportunities,
  generatePassiveIncomeAsset,
  generatePassiveIncomePlan,
  generateYouTubeIdeas,
  getAssistantState,
  listPassiveIdeas,
  listOutboundLeads,
  resetAssistantState,
  searchLocalLeads,
  searchWorkflowCatalog,
  updateOutboundLead,
  updateAgencyState,
  fetchInternetTrends,
  fetchYouTubeTrends,
  patchAssistantPreferences,
} from '../services/api';
import { useI18n } from '../services/i18n';

type CatalogPrefill = { query: string; requiredTags?: string[] };

type AgencyAssistantProps = {
  onOpenCatalog: (prefill?: CatalogPrefill) => void;
  onOpenSettings: () => void;
  onOpenJourney: () => void;
  onOpenPassiveHub: () => void;
  initialPrompt?: string;
  autoSend?: boolean;
  onConsumedInitialPrompt?: () => void;
};

function toAppLanguage(language: string): AppLanguage {
  return language === 'en' ? 'en' : 'tr';
}

function formatTool(tool: { name: string; args: Record<string, unknown> }): string {
  return `${tool.name} ${Object.keys(tool.args ?? {}).length ? JSON.stringify(tool.args ?? {}) : ''}`.trim();
}

const AgencyAssistant: React.FC<AgencyAssistantProps> = ({
  onOpenCatalog,
  onOpenSettings,
  onOpenJourney,
  onOpenPassiveHub,
  initialPrompt,
  autoSend = false,
  onConsumedInitialPrompt,
}) => {
  const { language, tt } = useI18n();
  const appLang = toAppLanguage(language);

  const [state, setState] = useState<AssistantState | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const messages = state?.messages ?? [];
  const preferences = state?.preferences ?? {};

  const quickPrompts = useMemo(
    () => [
      {
        id: 'stack',
        label: tt('Build my income stack', 'Gelir stack’imi kur'),
        text: tt(
          'I want to build an income stack: AI agency + YouTube + passive income. Make a simple 30-day plan and tell me the next 3 actions.',
          'AI ajansı + YouTube + pasif gelirden oluşan bir gelir stack’i kurmak istiyorum. Basit bir 30 günlük plan yap ve sıradaki 3 aksiyonu söyle.',
        ),
      },
      {
        id: 'passive',
        label: tt('Passive income ideas', 'Pasif gelir fikirleri'),
        text: tt(
          'Give me 5 passive income ideas based on my situation, and pick the best one to execute first with automations.',
          'Durumuma göre 5 pasif gelir fikri ver ve otomasyonla ilk hangisini uygulayacağımı seç.',
        ),
      },
      {
        id: 'youtube',
        label: tt('YouTube ideas', 'YouTube fikirleri'),
        text: tt(
          'Generate YouTube video ideas for my niche and connect them to lead generation.',
          'Nişime göre YouTube video fikirleri üret ve lead toplama ile bağla.',
        ),
      },
      {
        id: 'leads',
        label: tt('Find local leads', 'Yerel lead bul'),
        text: tt(
          'Find local businesses I can sell AI automation to (country/city), and draft a pitch.',
          'Ülke/şehir bazlı AI otomasyonu satabileceğim işletmeleri bul ve bir pitch hazırla.',
        ),
      },
      {
        id: 'autopilot',
        label: tt('Autopilot: save 10 leads', 'Autopilot: 10 lead kaydet'),
        text: tt(
          'Use outbound.autopilot.seed to find and save 10 local leads for my niche in my city/country. If you need a query, ask me for a niche + city.',
          'outbound.autopilot.seed kullanarak şehir/ülkemde nişime uygun 10 yerel lead bul ve pipeline’a kaydet. Query gerekiyorsa benden niş + şehir iste.',
        ),
      },
      {
        id: 'internet',
        label: tt('Internet trends', 'İnternet trendleri'),
        text: tt(
          'Fetch internet trends (Hacker News + GitHub Trending) and propose 3 sellable automation offers I can package as an agency.',
          'İnternet trendlerini (Hacker News + GitHub Trending) çek ve ajans olarak paketleyebileceğim 3 satılabilir otomasyon teklifi öner.',
        ),
      },
    ],
    [tt],
  );

  const refresh = async () => {
    setError(null);
    try {
      const s = await getAssistantState();
      setState(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Failed to load assistant', 'Asistan yüklenemedi'));
      setState(null);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  useEffect(() => {
    const prompt = String(initialPrompt ?? '').trim();
    if (!prompt) return;
    if (autoSend) {
      send(prompt).catch(() => {});
      onConsumedInitialPrompt?.();
      return;
    }
    setInput(prompt);
    onConsumedInitialPrompt?.();
  }, [initialPrompt, autoSend]);

  const log = async (content: string, toolCall?: { name: string; args: Record<string, unknown> }) => {
    try {
      const next = await assistantLog({ role: 'system', content, toolCall });
      setState(next);
    } catch {
      // ignore
    }
  };

  const runTool = async (tool: { name: string; args: Record<string, unknown> }) => {
    const name = String(tool.name || '').trim();
    const args: any = tool.args ?? {};

    const asString = (v: any) => (typeof v === 'string' ? v : String(v ?? ''));
    const asNumber = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
    const asArrayStrings = (v: any) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

    try {
      if (name === 'navigate.catalog') {
        const query = asString(args.query).trim();
        const requiredTags = asArrayStrings(args.requiredTags);
        await log(tt(`Navigate: Catalog (${query})`, `Gezin: Katalog (${query})`), tool);
        onOpenCatalog({ query, requiredTags });
        return;
      }
      if (name === 'navigate.settings') {
        await log(tt('Navigate: Settings', 'Gezin: Ayarlar'), tool);
        onOpenSettings();
        return;
      }
      if (name === 'navigate.journey') {
        await log(tt('Navigate: Revenue Journey', 'Gezin: Gelir Yolculuğu'), tool);
        onOpenJourney();
        return;
      }
      if (name === 'navigate.passiveHub') {
        await log(tt('Navigate: Passive Income Hub', 'Gezin: Pasif Gelir Hub'), tool);
        onOpenPassiveHub();
        return;
      }

      if (name === 'assistant.preferences.patch') {
        const patch: Partial<AssistantPreferences> = {
          language: args.language === 'en' ? 'en' : args.language === 'tr' ? 'tr' : undefined,
          goal: asString(args.goal).trim() as any,
          country: asString(args.country).trim() || undefined,
          city: asString(args.city).trim() || undefined,
          niche: asString(args.niche).trim() || undefined,
          incomeFocus: Array.isArray(args.incomeFocus) ? args.incomeFocus : undefined,
        };
        const next = await patchAssistantPreferences(patch);
        setState(next);
        await log(tt('Preferences updated.', 'Tercihler güncellendi.'), tool);
        return;
      }

      if (name === 'agency.setGoal') {
        const goal = asString(args.goal).trim() as JourneyGoal;
        await updateAgencyState({ goal });
        await log(tt(`Agency goal set: ${goal}`, `Ajans hedefi ayarlandı: ${goal}`), tool);
        return;
      }

      if (name === 'agency.revenueGoal.set') {
        const currency = asString(args.currency || 'USD').trim().toUpperCase();
        const targetMrr = asNumber(args.targetMrr ?? 0);
        const avgRetainer = asNumber(args.avgRetainer ?? 0);
        const closeRatePct = asNumber(args.closeRatePct ?? 25);
        const bookingRatePct = asNumber(args.bookingRatePct ?? 15);

        await updateAgencyState({
          revenueGoal: {
            currency: currency === 'TRY' || currency === 'EUR' || currency === 'GBP' ? (currency as any) : 'USD',
            targetMrr: Number.isFinite(targetMrr) ? Math.max(0, Math.min(1_000_000, targetMrr)) : 0,
            avgRetainer: Number.isFinite(avgRetainer) ? Math.max(0, Math.min(1_000_000, avgRetainer)) : 0,
            closeRatePct: Number.isFinite(closeRatePct) ? Math.max(0, Math.min(100, closeRatePct)) : 25,
            bookingRatePct: Number.isFinite(bookingRatePct) ? Math.max(0, Math.min(100, bookingRatePct)) : 15,
            updatedAt: new Date().toISOString(),
          },
        });
        await log(tt('Revenue goal saved.', 'Gelir hedefi kaydedildi.'), tool);
        return;
      }

      if (name === 'agency.doc.generate') {
        const type = asString(args.type).trim() as any;
        await generateAgencyDocument({ type });
        await log(tt(`Generated doc: ${type}`, `Doküman üretildi: ${type}`), tool);
        return;
      }

      if (name === 'outbound.leads.list') {
        const leads = await listOutboundLeads();
        const top = leads.slice(0, 12).map((l: OutboundLead) => `- [${l.stage}] ${l.name}${l.website ? ` (${l.website})` : ''}`).join('\n');
        await log(leads.length ? tt(`Pipeline leads:\n${top}`, `Pipeline lead'leri:\n${top}`) : tt('Pipeline is empty.', 'Pipeline boş.'), tool);
        return;
      }

      if (name === 'outbound.lead.create') {
        const lead = await createOutboundLead({
          name: asString(args.name).trim(),
          category: asString(args.category).trim() || undefined,
          website: asString(args.website).trim() || undefined,
          phone: asString(args.phone).trim() || undefined,
          country: asString(args.country).trim() || undefined,
          city: asString(args.city).trim() || undefined,
          stage: asString(args.stage).trim() as OutboundStage,
          source: 'manual',
        });
        await log(tt(`Saved lead: ${lead.name}`, `Lead kaydedildi: ${lead.name}`), tool);
        return;
      }

      if (name === 'outbound.lead.update') {
        const id = asString(args.id).trim();
        const stage = asString(args.stage).trim();
        const nextFollowUpAt = asString(args.nextFollowUpAt).trim();
        const notes = asString(args.notes).trim();
        const lead = await updateOutboundLead(id, {
          stage: stage ? (stage as any) : undefined,
          nextFollowUpAt: nextFollowUpAt || undefined,
          notes: notes || undefined,
        });
        await log(tt(`Updated lead: ${lead.name}`, `Lead güncellendi: ${lead.name}`), tool);
        return;
      }

      if (name === 'outbound.autopilot.seed') {
        const country = asString(args.country || preferences.country || 'Turkey').trim();
        const city = asString(args.city || preferences.city || 'Istanbul').trim();
        const query = asString(args.query || preferences.niche || '').trim();
        const saveCountRaw = asNumber(args.saveCount ?? args.count ?? 10);
        const limitRaw = asNumber(args.limit ?? 0);

        const saveCount = Number.isFinite(saveCountRaw) ? Math.max(1, Math.min(30, Math.round(saveCountRaw))) : 10;
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.max(saveCount, Math.min(30, Math.round(limitRaw))) : Math.max(saveCount, 20);

        if (!query) {
          await log(tt('Autopilot missing `query`.', 'Autopilot için `query` eksik.'), tool);
          return;
        }

        await log(
          tt(
            `Autopilot: searching leads in ${city}, ${country} for "${query}" (save ${saveCount})…`,
            `Autopilot: ${city}, ${country} için "${query}" lead arıyor (kaydet: ${saveCount})…`,
          ),
          tool,
        );

        const existing = await listOutboundLeads().catch(() => []);
        const existingSourceRefs = new Set(
          existing
            .filter((l) => l.source === 'market_radar' && l.sourceRef)
            .map((l) => String(l.sourceRef)),
        );
        const existingWebsites = new Set(existing.filter((l) => l.website).map((l) => String(l.website)));

        const out = await searchLocalLeads({ country, city, query, language: appLang, limit });
        const today = new Date().toLocaleDateString('en-CA');

        const saved: OutboundLead[] = [];
        let skipped = 0;
        for (const candidate of out.items) {
          if (saved.length >= saveCount) break;
          const sourceRef = String(candidate.id || '').trim();
          const website = String(candidate.website || '').trim();

          if (sourceRef && existingSourceRefs.has(sourceRef)) {
            skipped += 1;
            continue;
          }
          if (website && existingWebsites.has(website)) {
            skipped += 1;
            continue;
          }

          const lead = await createOutboundLead({
            name: candidate.name,
            category: candidate.category,
            address: candidate.address,
            website: candidate.website,
            phone: candidate.phone,
            mapsUrl: candidate.mapsUrl,
            country,
            city,
            stage: 'New',
            nextFollowUpAt: today,
            source: 'market_radar',
            sourceRef: sourceRef || undefined,
          });

          saved.push(lead);
          if (sourceRef) existingSourceRefs.add(sourceRef);
          if (website) existingWebsites.add(website);
        }

        const lines = saved
          .slice(0, 12)
          .map((l) => `- [${l.stage}] ${l.name}${l.website ? ` (${l.website})` : ''}`)
          .join('\n');

        await log(
          saved.length
            ? tt(
                `Autopilot saved ${saved.length}/${saveCount} lead(s) to pipeline (${skipped} skipped).\n${lines}`,
                `Autopilot ${saved.length}/${saveCount} lead’i pipeline’a kaydetti (${skipped} atlandı).\n${lines}`,
              )
            : tt(
                `Autopilot found leads, but all were already in your pipeline (${skipped} skipped).`,
                `Autopilot lead buldu ama hepsi zaten pipeline’ındaydı (${skipped} atlandı).`,
              ),
          tool,
        );
        return;
      }

      if (name === 'catalog.search') {
        const query = asString(args.query || args.q).trim();
        const limit = asNumber(args.limit ?? 5);
        const requiredTags = asArrayStrings(args.requiredTags);
        const results = await searchWorkflowCatalog({ query, limit: Number.isFinite(limit) ? Math.max(1, Math.min(10, limit)) : 5, requiredTags });
        const lines = results.slice(0, 5).map((c) => `- ${c.workflow.name} (${Math.round(c.score)}%) [${c.workflow.id}]`).join('\n');
        await log(results.length ? tt(`Catalog results:\n${lines}`, `Katalog sonuçları:\n${lines}`) : tt('No workflows matched.', 'Workflow bulunamadı.'), tool);
        if (query) onOpenCatalog({ query, requiredTags });
        return;
      }

      if (name === 'market.opportunities') {
        const goal = asString(args.goal || preferences.goal || 'automation_agency').trim() as JourneyGoal;
        const country = asString(args.country || preferences.country || 'Turkey').trim();
        const city = asString(args.city || preferences.city || 'Istanbul').trim();
        const niche = asString(args.niche || preferences.niche || '').trim() || undefined;
        const out = await generateMarketOpportunities({ goal, country, city, niche, language: appLang, count: 6 });
        const lines = out.items.slice(0, 5).map((o) => `- ${o.niche}: ${o.offer}`).join('\n');
        await log(tt(`Top opportunities:\n${lines}`, `En iyi fırsatlar:\n${lines}`), tool);
        return;
      }

      if (name === 'market.youtube.trends') {
        const country = asString(args.country || preferences.country || 'Turkey').trim();
        const limit = asNumber(args.limit ?? 10);
        const out = await fetchYouTubeTrends({ country, language: appLang, limit: Number.isFinite(limit) ? Math.max(3, Math.min(20, limit)) : 10 });
        const lines = out.items.slice(0, 8).map((t) => `- ${t.title}`).join('\n');
        await log(tt(`Trends:\n${lines}`, `Trendler:\n${lines}`), tool);
        return;
      }

      if (name === 'market.internet.trends') {
        const limit = asNumber(args.limit ?? 10);
        const sourcesRaw = asArrayStrings(args.sources);
        const sources = sourcesRaw
          .map((s) => s.toLowerCase())
          .filter((s): s is 'hackernews' | 'github' => s === 'hackernews' || s === 'github');
        const out = await fetchInternetTrends({
          limit: Number.isFinite(limit) ? Math.max(3, Math.min(30, limit)) : 10,
          sources: sources.length ? sources : undefined,
        });
        const lines = out.items
          .slice(0, 8)
          .map((t) => `- [${t.provider}] ${t.title}${t.url ? ` (${t.url})` : ''}`)
          .join('\n');
        await log(tt(`Internet trends:\n${lines}`, `İnternet trendleri:\n${lines}`), tool);
        return;
      }

      if (name === 'market.youtube.ideas') {
        const goal = asString(args.goal || preferences.goal || 'youtube_systems').trim() as JourneyGoal;
        const country = asString(args.country || preferences.country || 'Turkey').trim();
        const niche = asString(args.niche || preferences.niche || 'AI agency').trim();
        const count = asNumber(args.count ?? 12);
        const out = await generateYouTubeIdeas({ goal, country, niche, language: appLang, count: Number.isFinite(count) ? Math.max(3, Math.min(20, count)) : 12 });
        const lines = out.items.slice(0, 10).map((i) => `- ${i.title}`).join('\n');
        await log(tt(`Video ideas:\n${lines}`, `Video fikirleri:\n${lines}`), tool);
        return;
      }

      if (name === 'market.leads.search') {
        const country = asString(args.country || preferences.country || 'Turkey').trim();
        const city = asString(args.city || preferences.city || 'Istanbul').trim();
        const query = asString(args.query || preferences.niche || 'dentist').trim();
        const limit = asNumber(args.limit ?? 10);
        const out = await searchLocalLeads({ country, city, query, language: appLang, limit: Number.isFinite(limit) ? Math.max(5, Math.min(30, limit)) : 10 });
        const lines = out.items.slice(0, 8).map((l) => `- ${l.name}${l.category ? ` (${l.category})` : ''}`).join('\n');
        await log(tt(`Leads:\n${lines}`, `Lead’ler:\n${lines}`), tool);
        return;
      }

      if (name === 'market.leads.pitch') {
        const goal = asString(args.goal || preferences.goal || 'automation_agency').trim() as JourneyGoal;
        const lead: MarketLeadCandidate = {
          id: `lead-${Date.now()}`,
          name: asString(args.leadName).trim() || tt('Local business', 'Yerel işletme'),
          category: asString(args.category).trim() || undefined,
          website: asString(args.website).trim() || undefined,
          source: 'ai',
        } as any;
        const opportunity: MarketOpportunity | null = args.offer
          ? ({
              id: `opp-${Date.now()}`,
              niche: asString(args.category).trim() || 'Opportunity',
              idealCustomer: '',
              painPoints: [],
              offer: asString(args.offer).trim(),
              suggestedCatalogQuery: '',
              source: 'ai',
            } as any)
          : null;
        const pitch = await generateLeadPitch({ goal, language: appLang, lead, opportunity });
        await log(tt(`Pitch (email):\n${pitch.email}`, `Pitch (e-posta):\n${pitch.email}`), tool);
        return;
      }

      if (name === 'passive.ideas.list') {
        const ideas = await listPassiveIdeas();
        const lines = ideas.slice(0, 8).map((i) => `- ${i.id}: ${i.title[appLang]}`).join('\n');
        await log(
          ideas.length
            ? tt(`Passive ideas:\n${lines}`, `Pasif gelir fikirleri:\n${lines}`)
            : tt('No passive ideas available.', 'Pasif gelir fikri bulunamadı.'),
          tool,
        );
        onOpenPassiveHub();
        return;
      }

      if (name === 'passive.plan.generate') {
        const ideaId = asString(args.ideaId || args.id).trim();
        if (!ideaId) {
          await log(tt('Missing `ideaId` for passive plan.', 'Pasif plan için `ideaId` eksik.'), tool);
          onOpenPassiveHub();
          return;
        }
        const goal = asString(args.goal || preferences.goal || '').trim() as JourneyGoal;
        const res = await generatePassiveIncomePlan({ ideaId, goal: goal || undefined, language: appLang });
        await log(
          tt(
            `Passive plan generated: ${res.document?.name ?? ideaId}`,
            `Pasif plan üretildi: ${res.document?.name ?? ideaId}`,
          ),
          tool,
        );
        onOpenPassiveHub();
        return;
      }

      if (name === 'passive.asset.generate') {
        const ideaId = asString(args.ideaId || args.id).trim();
        const assetIndex = asNumber(args.assetIndex ?? args.index);
        if (!ideaId) {
          await log(tt('Missing `ideaId` for passive asset.', 'Pasif asset için `ideaId` eksik.'), tool);
          onOpenPassiveHub();
          return;
        }
        if (!Number.isFinite(assetIndex)) {
          await log(tt('Missing/invalid `assetIndex`.', '`assetIndex` eksik/geçersiz.'), tool);
          onOpenPassiveHub();
          return;
        }
        const goal = asString(args.goal || preferences.goal || '').trim() as JourneyGoal;
        const res = await generatePassiveIncomeAsset({ ideaId, assetIndex: assetIndex as any, goal: goal || undefined, language: appLang });
        await log(
          tt(
            `Passive asset generated: ${res.document?.name ?? `${ideaId}#${res.assetIndex}`}`,
            `Pasif asset üretildi: ${res.document?.name ?? `${ideaId}#${res.assetIndex}`}`,
          ),
          tool,
        );
        onOpenPassiveHub();
        return;
      }

      await log(tt(`Tool not supported: ${name}`, `Desteklenmeyen araç: ${name}`), tool);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Unknown error', 'Bilinmeyen hata');
      await log(tt(`Tool failed (${name}): ${msg}`, `Araç başarısız (${name}): ${msg}`), tool);
    }
  };

  const send = async (text?: string) => {
    if (busy) return;
    const q = String(text ?? input).trim();
    if (!q) return;
    setInput('');
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await assistantRespond({ message: q, language: appLang });
      setState(res.state);
      const tool = res.reply.toolCall;
      if (tool?.name) {
        await log(tt(`Tool requested: ${formatTool(tool)}`, `Araç istendi: ${formatTool(tool)}`), tool);
        await runTool(tool);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Assistant request failed', 'Asistan isteği başarısız'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const s = await resetAssistantState();
      setState(s);
      setMessage(tt('Assistant reset.', 'Asistan sıfırlandı.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Reset failed', 'Sıfırlama başarısız'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-slate-800/40 border border-slate-700/50 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">{tt('Global Assistant', 'Global Asistan')}</h2>
            <p className="text-slate-400 mt-3 text-sm font-medium leading-relaxed">
              {tt(
                'This AI oversees the whole system (market radar, docs, catalog) and helps you build: AI agency + YouTube + passive income.',
                'Bu AI tüm sistemi (pazar radarı, dokümanlar, katalog) görür ve şunu kurmana yardım eder: AI ajansı + YouTube + pasif gelir.',
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {quickPrompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => send(p.text)}
                  disabled={busy}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
                  title={p.text}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => refresh()}
              disabled={busy}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 font-black px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
            >
              {tt('Refresh', 'Yenile')}
            </button>
            <button
              onClick={reset}
              disabled={busy}
              className="bg-red-500/10 hover:bg-red-500/20 disabled:bg-red-500/5 text-red-300 font-black px-6 py-4 rounded-3xl text-[10px] uppercase tracking-widest border border-red-500/20 transition-all active:scale-95"
            >
              {tt('Reset', 'Sıfırla')}
            </button>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`p-6 rounded-[36px] border shadow-2xl ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{error ?? message}</p>
        </div>
      )}

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] p-10 shadow-2xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Conversation', 'Konuşma')}</h3>
            <p className="text-slate-400 mt-2 text-sm font-medium">
              {tt('Tip: Configure `OPENROUTER_API_KEY` in Settings → Vault for multi-model quality.', 'İpucu: çoklu model kalite için Settings → Vault’tan `OPENROUTER_API_KEY` ekle.')}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl px-6 py-4 shadow-xl min-w-[280px]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Preferences', 'Tercihler')}</p>
            <p className="text-[11px] text-slate-300 font-bold mt-2">
              {tt('Goal', 'Hedef')}: <span className="text-white">{String(preferences.goal ?? '—')}</span>
            </p>
            <p className="text-[11px] text-slate-300 font-bold mt-1">
              {tt('Geo', 'Konum')}: <span className="text-white">{`${preferences.country ?? '—'} / ${preferences.city ?? '—'}`}</span>
            </p>
            <p className="text-[11px] text-slate-300 font-bold mt-1">
              {tt('Niche', 'Niş')}: <span className="text-white">{String(preferences.niche ?? '—')}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {messages.length === 0 ? (
            <div className="text-slate-500 text-sm">{tt('No messages yet.', 'Henüz mesaj yok.')}</div>
          ) : (
            messages.slice(-60).map((m: AssistantMessage) => (
              <div key={m.id} className={`border rounded-[32px] p-7 shadow-xl ${m.role === 'user' ? 'bg-slate-950/40 border-slate-800' : m.role === 'system' ? 'bg-indigo-600/5 border-indigo-500/20' : 'bg-slate-900/40 border-slate-800'}`}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {m.role === 'user' ? tt('You', 'Sen') : m.role === 'assistant' ? tt('Assistant', 'Asistan') : tt('System', 'Sistem')}
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.toolCall?.name && (
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                    {tt('Tool', 'Araç')}: {formatTool(m.toolCall)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-10 bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Send a message', 'Mesaj gönder')}</p>
          <div className="mt-4 flex flex-col lg:flex-row gap-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              placeholder={tt('Tell me what you want to build…', 'Ne kurmak istiyorsun…')}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-3xl px-5 py-4 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black px-8 py-5 rounded-3xl text-[10px] uppercase tracking-widest border border-indigo-400/20 transition-all shadow-xl active:scale-95"
            >
              {busy ? tt('Sending…', 'Gönderiliyor…') : tt('Send', 'Gönder')}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={onOpenPassiveHub}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
            >
              {tt('Open Passive Income Hub', 'Pasif Gelir Hub’ı Aç')}
            </button>
            <button
              onClick={onOpenJourney}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
            >
              {tt('Open Revenue Journey', 'Gelir Yolculuğu Aç')}
            </button>
            <button
              onClick={onOpenSettings}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-black px-4 py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-slate-800 transition-all active:scale-95"
            >
              {tt('Open Settings', 'Ayarları Aç')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyAssistant;
