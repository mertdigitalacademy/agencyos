import React, { useEffect, useMemo, useState } from 'react';
import type {
  AppLanguage,
  JourneyGoal,
  MarketInternetTrend,
  MarketLeadCandidate,
  MarketLeadPitch,
  MarketOpportunity,
  MarketRadarState,
  MarketTrendVideo,
  MarketVideoIdea,
  OutboundLead,
  OutboundStage,
  ProjectBrief,
  ProjectTab,
} from '../types';
import {
  createOutboundLead,
  createSuiteCrmLeadDirect,
  deleteOutboundLead,
  fetchInternetTrends,
  fetchYouTubeTrends,
  generateLeadPitch,
  generateMarketOpportunities,
  generateYouTubeIdeas,
  getMarketRadarState,
  listOutboundLeads,
  searchLocalLeads,
  updateOutboundLead,
} from '../services/api';
import { useI18n } from '../services/i18n';

type CatalogPrefill = { query: string; requiredTags?: string[] };

type MarketRadarProps = {
  goal: JourneyGoal;
  onOpenCatalog: (prefill?: CatalogPrefill) => void;
  onOpenSettings: () => void;
  onOpenAssistant?: (prompt?: string) => void;
  onOpenProject?: (id: string, tab?: ProjectTab) => void;
  onCreateProject: (brief: ProjectBrief) => void;
  suitecrmStatus?: { connected: boolean; baseUrl: string; reason?: string };
  targets?: { leadsNeeded: number; callsNeeded: number; clientsNeeded: number };
};

type TabId = 'opportunities' | 'youtube' | 'internet' | 'leads';

function toLanguage(code: AppLanguage): AppLanguage {
  return code === 'en' ? 'en' : 'tr';
}

function defaultTab(goal: JourneyGoal): TabId {
  if (goal === 'youtube_systems') return 'youtube';
  if (goal === 'ai_agency') return 'opportunities';
  return 'leads';
}

function formatIdea(idea: MarketVideoIdea): string {
  const lines = [
    `# ${idea.title}`,
    ``,
    `## Hook`,
    idea.hook,
    ``,
    `## Angle`,
    idea.angle,
    ``,
    `## Outline`,
    ...idea.outline.map((o) => `- ${o}`),
    ``,
    `## CTA`,
    idea.cta,
    ``,
    idea.keywords.length ? `Keywords: ${idea.keywords.join(', ')}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function formatMoney(currency: string, amount: number, language: AppLanguage): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${Math.round(value).toLocaleString()}`;
  }
}

function formatMonthlyBudget(currency: string, monthly: number): string {
  const symbol = currency === 'TRY' ? '₺' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.round(monthly).toLocaleString()} / month`;
}

type LeadImportRow = {
  name: string;
  website?: string;
  phone?: string;
  category?: string;
  address?: string;
  mapsUrl?: string;
  notes?: string;
};

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  out.push(current.trim());
  return out.map((s) => s.replace(/^"(.*)"$/, '$1').trim());
}

function normalizeWebsite(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const candidate = trimmed.replace(/^"+|"+$/g, '').trim();
  if (!candidate) return undefined;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (/^www\./i.test(candidate)) return `https://${candidate}`;
  if (candidate.includes('.') && !candidate.includes(' ')) return `https://${candidate}`;
  return undefined;
}

function guessNameFromWebsite(website: string): string {
  try {
    const url = new URL(website);
    const host = url.hostname.replace(/^www\./i, '').trim();
    const base = host.split('.')[0] || host;
    const name = base
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!name) return 'New Lead';
    return name
      .split(' ')
      .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
      .join(' ');
  } catch {
    return 'New Lead';
  }
}

function parseLeadImportText(text: string): LeadImportRow[] {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500);

  if (!rawLines.length) return [];

  const delimiter = (() => {
    const sample = rawLines.slice(0, 5).join('\n');
    if (sample.includes('\t')) return '\t';
    if (sample.includes(';') && !sample.includes(',')) return ';';
    return ',';
  })();

  const header = splitDelimitedLine(rawLines[0]!, delimiter).map((h) => h.toLowerCase());
  const headerLooksValid = header.some((h) => h.includes('name')) && header.some((h) => h.includes('web') || h.includes('url'));

  const colIndex = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));

  const mapping = headerLooksValid
    ? {
        name: colIndex(['name', 'company']),
        website: colIndex(['website', 'url', 'domain']),
        phone: colIndex(['phone', 'tel']),
        category: colIndex(['category', 'industry', 'niche']),
        address: colIndex(['address', 'location']),
        mapsUrl: colIndex(['maps', 'mapsurl']),
        notes: colIndex(['notes', 'note']),
      }
    : null;

  const rows = headerLooksValid ? rawLines.slice(1) : rawLines;
  const leads: LeadImportRow[] = [];

  for (const line of rows) {
    if (!line.trim()) continue;
    const parts = splitDelimitedLine(line, delimiter).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    if (mapping) {
      const website = mapping.website >= 0 ? normalizeWebsite(parts[mapping.website] || '') : undefined;
      const nameRaw = mapping.name >= 0 ? (parts[mapping.name] || '').trim() : '';
      const name = nameRaw || (website ? guessNameFromWebsite(website) : '');
      if (!name) continue;

      leads.push({
        name,
        website,
        phone: mapping.phone >= 0 ? (parts[mapping.phone] || '').trim() || undefined : undefined,
        category: mapping.category >= 0 ? (parts[mapping.category] || '').trim() || undefined : undefined,
        address: mapping.address >= 0 ? (parts[mapping.address] || '').trim() || undefined : undefined,
        mapsUrl: mapping.mapsUrl >= 0 ? (parts[mapping.mapsUrl] || '').trim() || undefined : undefined,
        notes: mapping.notes >= 0 ? (parts[mapping.notes] || '').trim() || undefined : undefined,
      });
      continue;
    }

    const combined = parts.join(' ');
    const website = normalizeWebsite(parts[1] || '') || normalizeWebsite(parts[0] || '') || normalizeWebsite(combined);

    const name = (() => {
      if (parts.length >= 2) return (parts[0] || '').trim();
      const textOnly = (parts[0] || '').trim();
      if (website && (textOnly.startsWith('http') || textOnly.startsWith('www.'))) return guessNameFromWebsite(website);
      if (textOnly.includes(' - ')) return textOnly.split(' - ')[0]!.trim();
      if (textOnly.includes(' — ')) return textOnly.split(' — ')[0]!.trim();
      return textOnly;
    })();

    const phone = (() => {
      const maybePhone = parts.find((p) => /\+?\d[\d\s()-]{7,}/.test(p));
      return maybePhone ? maybePhone.trim() : undefined;
    })();

    const notes = (() => {
      if (parts.length <= 3) return undefined;
      return parts.slice(3).join(' ').trim() || undefined;
    })();

    const finalName = name || (website ? guessNameFromWebsite(website) : '');
    if (!finalName) continue;
    leads.push({ name: finalName, website, phone, notes });
  }

  const deduped: LeadImportRow[] = [];
  const seen = new Set<string>();
  for (const l of leads) {
    const key = (l.website || l.name).toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(l);
  }

  return deduped.slice(0, 200);
}

const MarketRadar: React.FC<MarketRadarProps> = ({ goal, onOpenCatalog, onOpenSettings, onOpenAssistant, onOpenProject, onCreateProject, suitecrmStatus, targets }) => {
  const { language, tt } = useI18n();
  const appLang = toLanguage(language);
  const [tab, setTab] = useState<TabId>(() => defaultTab(goal));

  const [state, setState] = useState<MarketRadarState | null>(null);
  const [apify, setApify] = useState<{ connected: boolean; reason?: string; hasToken: boolean; hasYoutubeActor: boolean; hasLeadsActor: boolean } | null>(null);

  const [country, setCountry] = useState('Turkey');
  const [city, setCity] = useState('Istanbul');
  const [niche, setNiche] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [trends, setTrends] = useState<MarketTrendVideo[]>([]);
  const [ideas, setIdeas] = useState<MarketVideoIdea[]>([]);
  const [internetTrends, setInternetTrends] = useState<MarketInternetTrend[]>([]);
  const [leads, setLeads] = useState<MarketLeadCandidate[]>([]);
  const [leadImportText, setLeadImportText] = useState('');
  const [isImportingLeads, setIsImportingLeads] = useState(false);
  const [showLeadFinder, setShowLeadFinder] = useState(true);
  const [pipelineLeads, setPipelineLeads] = useState<OutboundLead[]>([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineBusyId, setPipelineBusyId] = useState<string | null>(null);
  const [pipelineBulkBusy, setPipelineBulkBusy] = useState(false);
  const [showPipeline, setShowPipeline] = useState(true);
  const [todayChecklist, setTodayChecklist] = useState<{ date: string; leads: boolean; outreach: boolean; followups: boolean }>(() => {
    const today = (() => {
      try {
        return new Date().toLocaleDateString('en-CA');
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    })();
    return { date: today, leads: false, outreach: false, followups: false };
  });

  const [selectedTrendIds, setSelectedTrendIds] = useState<Record<string, boolean>>({});
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const selectedOpportunity = useMemo(
    () => opportunities.find((o) => o.id === selectedOpportunityId) ?? opportunities[0] ?? null,
    [opportunities, selectedOpportunityId],
  );

  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isLoadingInternetTrends, setIsLoadingInternetTrends] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);
  const [pitchBusyId, setPitchBusyId] = useState<string | null>(null);
  const [pitchByLeadId, setPitchByLeadId] = useState<Record<string, MarketLeadPitch>>({});
  const [activePipelinePitchLeadId, setActivePipelinePitchLeadId] = useState<string | null>(null);

  const [suiteCrmBusyId, setSuiteCrmBusyId] = useState<string | null>(null);
  const [suiteCrmByLeadId, setSuiteCrmByLeadId] = useState<Record<string, { id: string; url?: string }>>({});

  const leadImportPreviewCount = useMemo(() => parseLeadImportText(leadImportText).length, [leadImportText]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingState(true);
      setError(null);
      try {
        const { state: s, apify } = await getMarketRadarState();
        if (cancelled) return;
        setState(s);
        setApify(apify);
        setCountry(s.country || 'Turkey');
        setCity(s.city || 'Istanbul');
        setNiche(s.niche || '');
        setOpportunities(Array.isArray(s.opportunities) ? s.opportunities : []);
        setTrends(Array.isArray(s.youtubeTrends) ? s.youtubeTrends : []);
        setIdeas(Array.isArray(s.youtubeIdeas) ? s.youtubeIdeas : []);
        setInternetTrends(Array.isArray((s as any).internetTrends) ? ((s as any).internetTrends as any) : []);
        setLeads(Array.isArray(s.leads) ? s.leads : []);
        setSelectedOpportunityId((prev) => prev ?? s.opportunities?.[0]?.id ?? null);
        const nextSelected: Record<string, boolean> = {};
        for (const t of s.youtubeTrends ?? []) nextSelected[t.id] = true;
        setSelectedTrendIds(nextSelected);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : tt('Failed to load Market Radar', 'Market Radar yüklenemedi'));
      } finally {
        if (!cancelled) setIsLoadingState(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tt]);

  useEffect(() => {
    setTab(defaultTab(goal));
  }, [goal]);

  useEffect(() => {
    const storageKey = 'agencyos.marketRadar.todayChecklist';
    const today = (() => {
      try {
        return new Date().toLocaleDateString('en-CA');
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    })();
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setTodayChecklist((prev) => ({ ...prev, date: today }));
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && String(parsed.date || '') === today) {
        setTodayChecklist({
          date: today,
          leads: Boolean((parsed as any).leads),
          outreach: Boolean((parsed as any).outreach),
          followups: Boolean((parsed as any).followups),
        });
      } else {
        setTodayChecklist({ date: today, leads: false, outreach: false, followups: false });
      }
    } catch {
      setTodayChecklist({ date: today, leads: false, outreach: false, followups: false });
    }
  }, []);

  useEffect(() => {
    const storageKey = 'agencyos.marketRadar.todayChecklist';
    try {
      localStorage.setItem(storageKey, JSON.stringify(todayChecklist));
    } catch {
      // ignore
    }
  }, [todayChecklist]);

  const refreshPipeline = async () => {
    if (isLoadingPipeline) return;
    setPipelineError(null);
    setIsLoadingPipeline(true);
    try {
      const items = await listOutboundLeads();
      setPipelineLeads(items);
    } catch (e) {
      setPipelineLeads([]);
      setPipelineError(e instanceof Error ? e.message : tt('Failed to load pipeline', 'Pipeline yüklenemedi'));
    } finally {
      setIsLoadingPipeline(false);
    }
  };

  useEffect(() => {
    refreshPipeline().catch(() => {});
  }, [tt]);

  const importLeadsToPipeline = async () => {
    if (isImportingLeads) return;
    setMessage(null);
    setError(null);
    setPipelineError(null);

    const rows = parseLeadImportText(leadImportText);
    if (!rows.length) {
      setError(tt('Paste a lead list first.', 'Önce bir lead listesi yapıştır.'));
      return;
    }

    const today = (() => {
      try {
        return new Date().toLocaleDateString('en-CA');
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    })();

    setIsImportingLeads(true);
    try {
      for (const row of rows) {
        await createOutboundLead({
          name: row.name,
          category: row.category || undefined,
          address: row.address || undefined,
          website: row.website || undefined,
          phone: row.phone || undefined,
          mapsUrl: row.mapsUrl || undefined,
          notes: row.notes || undefined,
          country,
          city,
          stage: 'New',
          nextFollowUpAt: today,
          source: 'manual',
        });
      }
      await refreshPipeline();
      setShowPipeline(true);
      setTodayChecklist((prev) => ({ ...prev, leads: true }));
      setLeadImportText('');
      setMessage(tt(`Imported ${rows.length} lead(s) into your pipeline.`, `${rows.length} lead pipeline'a aktarıldı.`));
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : tt('Lead import failed', 'Lead içe aktarma başarısız'));
    } finally {
      setIsImportingLeads(false);
    }
  };

  const toggleTrend = (id: string) => {
    setSelectedTrendIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedTrends = useMemo(() => trends.filter((t) => selectedTrendIds[t.id]), [trends, selectedTrendIds]);

  const stageLabel = (stage: OutboundStage): string => {
    const map: Record<OutboundStage, { en: string; tr: string }> = {
      New: { en: 'New', tr: 'Yeni' },
      Contacted: { en: 'Contacted', tr: 'İletişime Geçildi' },
      Replied: { en: 'Replied', tr: 'Cevapladı' },
      Booked: { en: 'Booked', tr: 'Görüşme' },
      Proposal: { en: 'Proposal', tr: 'Teklif' },
      Won: { en: 'Won', tr: 'Kazandı' },
      Lost: { en: 'Lost', tr: 'Kaybetti' },
    };
    return map[stage][language];
  };

  const pipelineCounts = useMemo(() => {
    const counts: Record<OutboundStage, number> = { New: 0, Contacted: 0, Replied: 0, Booked: 0, Proposal: 0, Won: 0, Lost: 0 };
    for (const l of pipelineLeads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    return counts;
  }, [pipelineLeads]);

  const dailyLeadsQuota = useMemo(() => {
    const leadsNeeded = Number(targets?.leadsNeeded ?? 0) || 0;
    if (leadsNeeded <= 0) return 10;
    return Math.max(5, Math.min(40, Math.ceil(leadsNeeded / 20)));
  }, [targets?.leadsNeeded]);

  const pipelineProgress = useMemo(() => {
    const targetLeads = Number(targets?.leadsNeeded ?? 0) || 0;
    const targetCalls = Number(targets?.callsNeeded ?? 0) || 0;
    const targetClients = Number(targets?.clientsNeeded ?? 0) || 0;

    const savedLeads = pipelineLeads.length;
    const callsBooked = (pipelineCounts.Booked ?? 0) + (pipelineCounts.Proposal ?? 0) + (pipelineCounts.Won ?? 0);
    const clientsWon = pipelineCounts.Won ?? 0;

    const pct = (value: number, target: number) => {
      if (!target || target <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
    };

    return {
      targetLeads,
      targetCalls,
      targetClients,
      savedLeads,
      callsBooked,
      clientsWon,
      leadsPct: pct(savedLeads, targetLeads),
      callsPct: pct(callsBooked, targetCalls),
      clientsPct: pct(clientsWon, targetClients),
    };
  }, [pipelineCounts.Booked, pipelineCounts.Proposal, pipelineCounts.Won, pipelineLeads.length, targets?.callsNeeded, targets?.clientsNeeded, targets?.leadsNeeded]);

  const followUpsDue = useMemo(() => {
    const today = (() => {
      try {
        return new Date().toLocaleDateString('en-CA');
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    })();
    return pipelineLeads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      if (l.stage === 'Won' || l.stage === 'Lost') return false;
      const d = String(l.nextFollowUpAt).slice(0, 10);
      return d && d <= today;
    }).length;
  }, [pipelineLeads]);

  const pipelineSortedLeads = useMemo(() => {
    const today = (() => {
      try {
        return new Date().toLocaleDateString('en-CA');
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    })();

    const isDue = (l: OutboundLead) => {
      if (!l.nextFollowUpAt) return false;
      if (l.stage === 'Won' || l.stage === 'Lost') return false;
      const d = String(l.nextFollowUpAt).slice(0, 10);
      return d && d <= today;
    };

    const followUpKey = (l: OutboundLead) => {
      const d = l.nextFollowUpAt ? String(l.nextFollowUpAt).slice(0, 10) : '';
      return d || '9999-12-31';
    };

    return [...pipelineLeads].sort((a, b) => {
      const ad = isDue(a);
      const bd = isDue(b);
      if (ad !== bd) return ad ? -1 : 1;
      const ak = followUpKey(a);
      const bk = followUpKey(b);
      if (ak !== bk) return ak.localeCompare(bk);
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }, [pipelineLeads]);

  const activePipelinePitchLead = useMemo(() => {
    if (!activePipelinePitchLeadId) return null;
    return pipelineLeads.find((l) => l.id === activePipelinePitchLeadId) ?? null;
  }, [activePipelinePitchLeadId, pipelineLeads]);

  const activePipelinePitch = activePipelinePitchLeadId ? pitchByLeadId[activePipelinePitchLeadId] ?? null : null;

  const runOpportunities = async (overrideNiche?: string) => {
    if (isLoadingOpportunities) return;
    setMessage(null);
    setError(null);
    setIsLoadingOpportunities(true);
    try {
      const requestedNiche = String(overrideNiche ?? niche).trim();
      const out = await generateMarketOpportunities({ goal, country, city, niche: requestedNiche || undefined, language: appLang, count: 6 });
      setOpportunities(out.items);
      setState(out.state);
      if (out.items?.[0]?.id) setSelectedOpportunityId(out.items[0].id);
      setMessage(
        out.source === 'ai'
          ? tt('Opportunities generated with AI.', 'Fırsatlar AI ile üretildi.')
          : tt('Showing sample opportunities (AI/Apify not configured).', 'Örnek fırsatlar gösteriliyor (AI/Apify kurulu değil).'),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Opportunity generation failed', 'Fırsat üretimi başarısız'));
    } finally {
      setIsLoadingOpportunities(false);
    }
  };

  const runInternetTrends = async () => {
    if (isLoadingInternetTrends) return;
    setMessage(null);
    setError(null);
    setIsLoadingInternetTrends(true);
    try {
      const out = await fetchInternetTrends({ limit: 14 });
      setInternetTrends(out.items);
      setState(out.state);
      setMessage(
        out.source === 'web'
          ? tt('Internet trends fetched.', 'İnternet trendleri çekildi.')
          : tt('Showing sample internet trends.', 'Örnek internet trendleri gösteriliyor.'),
      );
      if (out.error) setError(out.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Internet trend fetch failed', 'İnternet trend çekme başarısız'));
    } finally {
      setIsLoadingInternetTrends(false);
    }
  };

  const runTrends = async () => {
    if (isLoadingTrends) return;
    setMessage(null);
    setError(null);
    setIsLoadingTrends(true);
    try {
      const out = await fetchYouTubeTrends({ country, language: appLang, limit: 12 });
      setTrends(out.items);
      setState(out.state);
      const nextSelected: Record<string, boolean> = {};
      for (const t of out.items) nextSelected[t.id] = true;
      setSelectedTrendIds(nextSelected);
      if (out.source === 'apify') setMessage(tt('Trends fetched via Apify.', 'Trendler Apify ile çekildi.'));
      else setMessage(tt('Showing sample trends (Apify not configured).', 'Örnek trendler gösteriliyor (Apify kurulu değil).'));
      if (out.error) setError(out.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Trend fetch failed', 'Trend çekme başarısız'));
    } finally {
      setIsLoadingTrends(false);
    }
  };

  const runIdeas = async () => {
    if (isGeneratingIdeas) return;
    setMessage(null);
    setError(null);
    setIsGeneratingIdeas(true);
    try {
      const out = await generateYouTubeIdeas({
        goal,
        country,
        niche: niche || tt('AI agency systems', 'AI ajansı sistemleri'),
        language: appLang,
        trends: selectedTrends,
        count: 12,
      });
      setIdeas(out.items);
      setState(out.state);
      setMessage(out.source === 'ai' ? tt('Video ideas generated with AI.', 'Video fikirleri AI ile üretildi.') : tt('Showing sample ideas.', 'Örnek fikirler gösteriliyor.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Idea generation failed', 'Fikir üretimi başarısız'));
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const runLeads = async () => {
    if (isSearchingLeads) return;
    setMessage(null);
    setError(null);
    setIsSearchingLeads(true);
    try {
      const out = await searchLocalLeads({
        country,
        city,
        query: niche || tt('dentist', 'diş kliniği'),
        language: appLang,
        limit: 15,
      });
      setLeads(out.items);
      setState(out.state);
      if (out.source === 'apify') setMessage(tt('Leads fetched via Apify.', 'Lead’ler Apify ile çekildi.'));
      else setMessage(tt('Showing sample leads (Apify not configured).', 'Örnek lead’ler gösteriliyor (Apify kurulu değil).'));
      if (out.error) setError(out.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Lead search failed', 'Lead arama başarısız'));
    } finally {
      setIsSearchingLeads(false);
    }
  };

  const runPitch = async (lead: MarketLeadCandidate) => {
    if (pitchBusyId) return;
    setMessage(null);
    setError(null);
    setPitchBusyId(lead.id);
    try {
      const pitch = await generateLeadPitch({
        goal,
        language: appLang,
        lead,
        opportunity: selectedOpportunity,
      });
      setPitchByLeadId((prev) => ({ ...prev, [lead.id]: pitch }));
      setMessage(pitch.source === 'ai' ? tt('Pitch generated with AI.', 'Pitch AI ile üretildi.') : tt('Showing sample pitch.', 'Örnek pitch gösteriliyor.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Pitch generation failed', 'Pitch üretimi başarısız'));
    } finally {
      setPitchBusyId(null);
    }
  };

  const runPipelinePitch = async (lead: OutboundLead) => {
    if (pitchBusyId) return;
    setMessage(null);
    setError(null);
    setPitchBusyId(lead.id);
    try {
      const candidate: MarketLeadCandidate = {
        id: lead.id,
        name: lead.name,
        category: lead.category,
        address: lead.address,
        website: lead.website,
        phone: lead.phone,
        mapsUrl: lead.mapsUrl,
        source: 'mock',
        raw: { pipelineStage: lead.stage, notes: lead.notes },
      };
      const pitch = await generateLeadPitch({
        goal,
        language: appLang,
        lead: candidate,
        opportunity: selectedOpportunity,
      });
      setPitchByLeadId((prev) => ({ ...prev, [lead.id]: pitch }));
      setMessage(pitch.source === 'ai' ? tt('Pitch generated with AI.', 'Pitch AI ile üretildi.') : tt('Showing sample pitch.', 'Örnek pitch gösteriliyor.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('Pitch generation failed', 'Pitch üretimi başarısız'));
    } finally {
      setPitchBusyId(null);
    }
  };

  const openPipelinePitch = (lead: OutboundLead, opts?: { regenerate?: boolean }) => {
    setActivePipelinePitchLeadId(lead.id);
    const existing = pitchByLeadId[lead.id];
    if (!existing || opts?.regenerate) {
      runPipelinePitch(lead).catch(() => {});
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(tt('Copied.', 'Kopyalandı.'));
    } catch {
      setError(tt('Copy failed.', 'Kopyalama başarısız.'));
    }
  };

  const makeProjectId = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return `proj-${(crypto as any).randomUUID()}`;
    } catch {
      // ignore
    }
    return `proj-${Date.now()}`;
  };

  const createSegmentProjectFromOpportunity = (o: MarketOpportunity) => {
    const budget = o.pricing?.monthly ? formatMonthlyBudget(o.pricing.currency || 'USD', o.pricing.monthly) : 'TBD';
    const brief: ProjectBrief = {
      id: makeProjectId(),
      clientName: `Outbound — ${o.niche} — ${city}`,
      industry: o.niche,
      description: [
        `Goal: ${goal}`,
        `Geo: ${country} / ${city}`,
        ``,
        `Offer: ${o.offer}`,
        o.pricingHint ? `Pricing hint: ${o.pricingHint}` : '',
        o.painPoints?.length ? `Pain points:\n${o.painPoints.map((p) => `- ${p}`).join('\n')}` : '',
        ``,
        `Workflow keywords: ${o.suggestedCatalogQuery}`,
      ]
        .filter(Boolean)
        .join('\n'),
      goals: ['outbound', 'lead->crm', 'proposal', 'contract', 'invoice'],
      tools: ['AgencyOS', 'n8n', 'SuiteCRM', 'Documenso', 'InvoiceShelf'],
      budget,
      riskLevel: 'Medium',
    };
    return brief;
  };

  const createClientProjectFromLead = (lead: MarketLeadCandidate) => {
    const o = selectedOpportunity;
    const budget = o?.pricing?.monthly ? formatMonthlyBudget(o.pricing.currency || 'USD', o.pricing.monthly) : 'TBD';
    const brief: ProjectBrief = {
      id: makeProjectId(),
      clientName: String(lead.name || '').trim() || (appLang === 'tr' ? 'Yeni Müşteri' : 'New Client'),
      industry: o?.niche || lead.category,
      description: [
        `Lead source: Market Radar (${lead.source})`,
        `Geo: ${country} / ${city}`,
        lead.category ? `Category: ${lead.category}` : '',
        lead.website ? `Website: ${lead.website}` : '',
        lead.phone ? `Phone: ${lead.phone}` : '',
        lead.mapsUrl ? `Maps: ${lead.mapsUrl}` : '',
        ``,
        o ? `Proposed offer: ${o.offer}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      goals: ['lead->crm', 'proposal', 'contract', 'invoice'],
      tools: ['AgencyOS', 'n8n', 'SuiteCRM', 'Documenso', 'InvoiceShelf'],
      budget,
      riskLevel: 'Medium',
    };
    return brief;
  };

  const createClientProjectFromOutboundLead = (lead: OutboundLead) => {
    const o = selectedOpportunity;
    const budget = o?.pricing?.monthly ? formatMonthlyBudget(o.pricing.currency || 'USD', o.pricing.monthly) : 'TBD';
    const brief: ProjectBrief = {
      id: makeProjectId(),
      clientName: String(lead.name || '').trim() || (appLang === 'tr' ? 'Yeni Müşteri' : 'New Client'),
      industry: o?.niche || lead.category,
      description: [
        `Lead source: Outbound Pipeline`,
        `Stage: ${lead.stage}`,
        `Geo: ${lead.country || country} / ${lead.city || city}`,
        lead.category ? `Category: ${lead.category}` : '',
        lead.website ? `Website: ${lead.website}` : '',
        lead.phone ? `Phone: ${lead.phone}` : '',
        lead.mapsUrl ? `Maps: ${lead.mapsUrl}` : '',
        lead.notes ? `Notes: ${lead.notes}` : '',
        ``,
        o ? `Proposed offer: ${o.offer}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      goals: ['lead->crm', 'proposal', 'contract', 'invoice'],
      tools: ['AgencyOS', 'n8n', 'SuiteCRM', 'Documenso', 'InvoiceShelf'],
      budget,
      riskLevel: 'Medium',
    };
    return brief;
  };

  const saveLeadToPipeline = async (lead: MarketLeadCandidate) => {
    if (pipelineBusyId) return;
    setPipelineError(null);
    setPipelineBusyId(lead.id);
    try {
      const today = (() => {
        try {
          return new Date().toLocaleDateString('en-CA');
        } catch {
          return new Date().toISOString().slice(0, 10);
        }
      })();
      await createOutboundLead({
        name: lead.name,
        category: lead.category,
        address: lead.address,
        website: lead.website,
        phone: lead.phone,
        mapsUrl: lead.mapsUrl,
        country,
        city,
        stage: 'New',
        nextFollowUpAt: today,
        source: 'market_radar',
        sourceRef: lead.id,
      });
      await refreshPipeline();
      setMessage(tt('Saved to pipeline.', 'Pipeline’a kaydedildi.'));
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : tt('Failed to save lead', 'Lead kaydedilemedi'));
    } finally {
      setPipelineBusyId(null);
    }
  };

  const saveTopLeadsToPipeline = async () => {
    if (pipelineBulkBusy) return;
    setPipelineError(null);
    setPipelineBulkBusy(true);
    try {
      const today = (() => {
        try {
          return new Date().toLocaleDateString('en-CA');
        } catch {
          return new Date().toISOString().slice(0, 10);
        }
      })();

      let sourceLeads: MarketLeadCandidate[] = leads;
      if (!sourceLeads.length) {
        const out = await searchLocalLeads({
          country,
          city,
          query: niche || tt('dentist', 'diş kliniği'),
          language: appLang,
          limit: 15,
        });
        sourceLeads = out.items;
        setLeads(out.items);
        setState(out.state);
      }

      const picked = sourceLeads.slice(0, Math.max(1, dailyLeadsQuota));
      for (const lead of picked) {
        await createOutboundLead({
          name: lead.name,
          category: lead.category,
          address: lead.address,
          website: lead.website,
          phone: lead.phone,
          mapsUrl: lead.mapsUrl,
          country,
          city,
          stage: 'New',
          nextFollowUpAt: today,
          source: 'market_radar',
          sourceRef: lead.id,
        });
      }
      await refreshPipeline();
      setTodayChecklist((prev) => ({ ...prev, leads: true }));
      setMessage(tt(`Saved ${picked.length} leads to pipeline.`, `${picked.length} lead pipeline’a kaydedildi.`));
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : tt('Failed to save leads', 'Lead’ler kaydedilemedi'));
    } finally {
      setPipelineBulkBusy(false);
    }
  };

  const changePipelineStage = async (lead: OutboundLead, stage: OutboundStage) => {
    if (pipelineBusyId) return;
    setPipelineError(null);
    setPipelineBusyId(lead.id);
    try {
      const next = await updateOutboundLead(lead.id, { stage, lastActionAt: new Date().toISOString() });
      setPipelineLeads((prev) => prev.map((l) => (l.id === lead.id ? next : l)));
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : tt('Failed to update stage', 'Stage güncellenemedi'));
    } finally {
      setPipelineBusyId(null);
    }
  };

  const setPipelineFollowUp = async (lead: OutboundLead, nextFollowUpAt: string) => {
    if (pipelineBusyId) return;
    setPipelineError(null);
    setPipelineBusyId(lead.id);
    try {
      const next = await updateOutboundLead(lead.id, { nextFollowUpAt, lastActionAt: new Date().toISOString() });
      setPipelineLeads((prev) => prev.map((l) => (l.id === lead.id ? next : l)));
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : tt('Failed to update follow-up date', 'Takip tarihi güncellenemedi'));
    } finally {
      setPipelineBusyId(null);
    }
  };

  const removePipelineLead = async (lead: OutboundLead) => {
    if (pipelineBusyId) return;
    const ok = window.confirm(tt('Remove this lead from pipeline?', 'Bu lead’i pipeline’dan kaldır?'));
    if (!ok) return;
    setPipelineError(null);
    setPipelineBusyId(lead.id);
    try {
      await deleteOutboundLead(lead.id);
      setPipelineLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setMessage(tt('Removed.', 'Kaldırıldı.'));
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : tt('Failed to remove lead', 'Lead kaldırılamadı'));
    } finally {
      setPipelineBusyId(null);
    }
  };

  const runSuiteCrmPipelineSync = async (lead: OutboundLead) => {
    if (suiteCrmBusyId) return;
    if (!suitecrmStatus?.connected) {
      setMessage(null);
      setError(suitecrmStatus?.reason || tt('SuiteCRM is not connected. Configure it in Settings.', 'SuiteCRM bağlı değil. Settings’ten yapılandır.'));
      return;
    }
    setMessage(null);
    setError(null);
    setSuiteCrmBusyId(lead.id);
    try {
      const desc = [
        `Outbound pipeline lead`,
        `Stage: ${lead.stage}`,
        `Geo: ${(lead.country || country)} / ${(lead.city || city)}`,
        lead.category ? `Category: ${lead.category}` : '',
        lead.website ? `Website: ${lead.website}` : '',
        lead.phone ? `Phone: ${lead.phone}` : '',
        lead.mapsUrl ? `Maps: ${lead.mapsUrl}` : '',
        lead.notes ? `Notes: ${lead.notes}` : '',
        selectedOpportunity ? `Offer: ${selectedOpportunity.offer}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const out = await createSuiteCrmLeadDirect({
        lastName: String(lead.name || '').trim() || tt('Local business', 'Yerel işletme'),
        description: desc,
        leadSource: 'AgencyOS',
        status: 'New',
      });
      const updated = await updateOutboundLead(lead.id, {
        externalRef: { provider: 'suitecrm', id: out.lead.id, url: out.lead.url } as any,
        lastActionAt: new Date().toISOString(),
      });
      setPipelineLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      setMessage(tt('Lead synced to SuiteCRM.', 'Lead SuiteCRM’e senkronlandı.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('SuiteCRM sync failed', 'SuiteCRM senkronu başarısız'));
    } finally {
      setSuiteCrmBusyId(null);
    }
  };

  const runSuiteCrmSync = async (lead: MarketLeadCandidate) => {
    if (suiteCrmBusyId) return;
    if (!suitecrmStatus?.connected) {
      setMessage(null);
      setError(suitecrmStatus?.reason || tt('SuiteCRM is not connected. Configure it in Settings.', 'SuiteCRM bağlı değil. Settings’ten yapılandır.'));
      return;
    }
    setMessage(null);
    setError(null);
    setSuiteCrmBusyId(lead.id);
    try {
      const desc = [
        `Market Radar lead`,
        `Geo: ${country} / ${city}`,
        lead.category ? `Category: ${lead.category}` : '',
        lead.website ? `Website: ${lead.website}` : '',
        lead.phone ? `Phone: ${lead.phone}` : '',
        lead.mapsUrl ? `Maps: ${lead.mapsUrl}` : '',
        selectedOpportunity ? `Offer: ${selectedOpportunity.offer}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const out = await createSuiteCrmLeadDirect({
        lastName: String(lead.name || '').trim() || tt('Local business', 'Yerel işletme'),
        description: desc,
        leadSource: 'AgencyOS',
        status: 'New',
      });
      setSuiteCrmByLeadId((prev) => ({ ...prev, [lead.id]: { id: out.lead.id, url: out.lead.url } }));
      const piped = pipelineLeads.find((l) => l.source === 'market_radar' && l.sourceRef === lead.id);
      if (piped) {
        await updateOutboundLead(piped.id, { externalRef: { provider: 'suitecrm', id: out.lead.id, url: out.lead.url } as any });
        await refreshPipeline();
      }
      setMessage(tt('Lead synced to SuiteCRM.', 'Lead SuiteCRM’e senkronlandı.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('SuiteCRM sync failed', 'SuiteCRM senkronu başarısız'));
    } finally {
      setSuiteCrmBusyId(null);
    }
  };

  const apifyHint = useMemo(() => {
    if (!apify) return null;
    if (!apify.hasToken) return tt('Apify is not connected. Using sample data.', 'Apify bağlı değil. Örnek data kullanılıyor.');
    const missing: string[] = [];
    if (!apify.hasLeadsActor) missing.push(tt('leads', 'lead'));
    if (!apify.hasYoutubeActor) missing.push(tt('YouTube trends', 'YouTube trend'));
    if (missing.length > 0) {
      return tt(
        `Apify token is set. Missing actor(s): ${missing.join(', ')}.`,
        `Apify token hazır. Eksik actor: ${missing.join(', ')}.`,
      );
    }
    return tt('Apify connected.', 'Apify bağlı.');
  }, [apify, tt]);

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-[48px] p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/5 blur-[120px] rounded-full -mr-40 -mt-40" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tt('Market Radar', 'Pazar Radarı')}</h3>
          <p className="text-slate-400 mt-2 text-sm font-medium leading-relaxed">
            {tt(
              'Trends → ideas → leads: discover where to make money, what to publish, and who to sell to.',
              'Trend → fikir → lead: nereden para kazanacağını, ne üreteceğini ve kime satacağını keşfet.',
            )}
          </p>
          {onOpenAssistant ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  onOpenAssistant(
                    tt(
                      `I am a beginner. My goal is ${goal}. Country: ${country}, City: ${city}. Niche/query: "${niche || 'auto'}". Give me the next 3 actions inside Market Radar (which buttons to click), then propose 2 offers with pricing and workflow keywords.`,
                      `Ben yeni başlıyorum. Hedefim: ${goal}. Ülke: ${country}, Şehir: ${city}. Niş/sorgu: "${niche || 'otomatik'}". Market Radar içinde sıradaki 3 aksiyonu (hangi butonlara basacağımı) ver, sonra fiyatlı 2 teklif + workflow keyword’leri öner.`,
                    ),
                  )
                }
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all border border-indigo-400/20"
              >
                {tt('Ask AI (next steps)', 'AI’ye Sor (sıradaki adımlar)')}
              </button>
            </div>
          ) : null}
          {showLeadFinder && apifyHint && (
            <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-3xl px-6 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{apifyHint}</p>
              {!apify?.hasToken && (
                <button
                  onClick={onOpenSettings}
                  className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  {tt('Connect Apify in Settings', 'Settings’ten Apify bağla')}
                </button>
              )}
              {apify?.hasToken && (!apify.hasYoutubeActor || !apify.hasLeadsActor) && (
                <div className="mt-3 text-[11px] text-slate-400 font-medium leading-relaxed">
                  <p className="font-black text-slate-300 uppercase tracking-widest text-[10px]">{tt('Vault keys', 'Vault anahtarları')}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    APIFY_API_TOKEN • APIFY_YOUTUBE_TRENDS_ACTOR • APIFY_GOOGLE_MAPS_LEADS_ACTOR
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-[36px] p-6 shadow-xl min-w-[320px]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Inputs', 'Girdiler')}</p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={tt('Country (e.g. Turkey)', 'Ülke (örn. Türkiye)')}
              className="bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tt('City (e.g. Istanbul)', 'Şehir (örn. İstanbul)')}
              className="bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder={tt('Niche / query (e.g. dentists, real estate)', 'Niş / sorgu (örn. diş kliniği, emlak)')}
              className="bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          {state && (
            <p className="mt-3 text-[10px] font-black text-slate-600 uppercase tracking-widest">
              {tt('Last update', 'Son güncelleme')}: {new Date(state.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {(message || error) && (
        <div className={`relative z-10 mt-8 p-6 rounded-[36px] border shadow-2xl ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{error ?? message}</p>
        </div>
      )}

      <div className="relative z-10 mt-10">
        <div className="flex flex-wrap gap-3">
          {([
            { id: 'opportunities' as const, label: tt('Opportunities', 'Fırsatlar') },
            { id: 'youtube' as const, label: tt('YouTube', 'YouTube') },
            { id: 'internet' as const, label: tt('Internet', 'İnternet') },
            { id: 'leads' as const, label: tt('Leads', 'Lead') },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${tab === t.id ? 'bg-indigo-600 text-white border-indigo-400/20 shadow-xl shadow-indigo-600/20' : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoadingState && !state ? (
          <div className="mt-8 text-slate-400 text-sm font-medium">{tt('Loading…', 'Yükleniyor…')}</div>
        ) : (
          <>
            {tab === 'opportunities' && (
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">{tt('Where to sell', 'Nereye satılır')}</h4>
                    <p className="text-slate-400 mt-2 text-sm font-medium">
                      {tt('Pick a niche and instantly get a sellable offer + workflow keywords.', 'Bir niş seç ve satılabilir teklif + workflow keyword’lerini al.')}
                    </p>
                  </div>
                  <button
                    onClick={runOpportunities}
                    disabled={isLoadingOpportunities}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    {isLoadingOpportunities ? tt('Generating…', 'Üretiliyor…') : tt('Generate opportunities', 'Fırsat üret')}
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {opportunities.map((o) => (
                    <div key={o.id} className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Niche', 'Niş')}</p>
                          <h5 className="text-white font-black text-lg tracking-tight uppercase mt-2">{o.niche}</h5>
                          <p className="text-slate-400 text-sm font-medium mt-2">{o.idealCustomer}</p>
                        </div>
                        <button
                          onClick={() => setSelectedOpportunityId(o.id)}
                          className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedOpportunityId === o.id ? 'bg-indigo-600 text-white border-indigo-400/20' : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700'}`}
                        >
                          {selectedOpportunityId === o.id ? tt('Selected', 'Seçili') : tt('Use this offer', 'Bunu kullan')}
                        </button>
                      </div>

                      <div className="mt-6">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Offer', 'Teklif')}</p>
                        <p className="text-slate-200 text-sm font-medium mt-2 leading-relaxed">{o.offer}</p>
                        {o.pricing?.firstMonth || o.pricing?.monthly || o.pricing?.setup ? (
                          <p className="text-slate-500 text-xs font-bold mt-3">
                            💰 {tt('Potential', 'Potansiyel')}:{' '}
                            {o.pricing?.firstMonth ? `${formatMoney(o.pricing.currency, o.pricing.firstMonth, appLang)} ${tt('first month', 'ilk ay')}` : null}
                            {o.pricing?.monthly
                              ? `${o.pricing?.firstMonth ? ' • ' : ''}${formatMoney(o.pricing.currency, o.pricing.monthly, appLang)} / ${tt('month', 'ay')}`
                              : null}
                            {o.pricingHint ? ` • ${o.pricingHint}` : ''}
                          </p>
                        ) : o.pricingHint ? (
                          <p className="text-slate-500 text-xs font-bold mt-3">💰 {o.pricingHint}</p>
                        ) : null}
                      </div>

                      {o.painPoints?.length > 0 && (
                        <div className="mt-6">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Pain points', 'Acılar')}</p>
                          <div className="mt-2 space-y-1">
                            {o.painPoints.slice(0, 6).map((p, idx) => (
                              <p key={idx} className="text-[11px] text-slate-400 font-medium">
                                - {p}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          onClick={() => onOpenCatalog({ query: o.suggestedCatalogQuery, requiredTags: o.suggestedTags })}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                        >
                          {tt('Search workflows', 'Workflow ara')}
                        </button>
                        <button
                          onClick={() => copy(o.suggestedCatalogQuery)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                        >
                          {tt('Copy keywords', 'Keyword kopyala')}
                        </button>
                        <button
                          onClick={() => onCreateProject(createSegmentProjectFromOpportunity(o))}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                        >
                          {tt('Create project', 'Proje oluştur')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'youtube' && (
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">{tt('Trends & ideas', 'Trend & fikir')}</h4>
                    <p className="text-slate-400 mt-2 text-sm font-medium">
                      {tt('Fetch trends, select a few, then generate a week of content ideas.', 'Trendleri çek, birkaçını seç, sonra 1 haftalık içerik fikri üret.')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={runTrends}
                      disabled={isLoadingTrends}
                      className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                    >
                      {isLoadingTrends ? tt('Fetching…', 'Çekiliyor…') : tt('Fetch trends', 'Trend çek')}
                    </button>
                    <button
                      onClick={runIdeas}
                      disabled={isGeneratingIdeas}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                      {isGeneratingIdeas ? tt('Generating…', 'Üretiliyor…') : tt('Generate ideas', 'Fikir üret')}
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Trends', 'Trendler')}</p>
                    <div className="mt-4 space-y-3">
                      {trends.length === 0 ? (
                        <p className="text-slate-500 text-sm">{tt('No trends yet. Fetch trends.', 'Henüz trend yok. Trend çek.')}</p>
                      ) : (
                        trends.map((t) => (
                          <label key={t.id} className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedTrendIds[t.id])}
                              onChange={() => toggleTrend(t.id)}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 font-bold leading-snug">{t.title}</p>
                              {t.channel && <p className="text-[11px] text-slate-500 font-medium mt-1">{t.channel}</p>}
                              {t.url && (
                                <a href={t.url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-400 font-black uppercase tracking-widest mt-2 inline-block">
                                  {tt('Open', 'Aç')} →
                                </a>
                              )}
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedTrends.length > 0 && (
                      <p className="mt-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {tt('Selected', 'Seçili')}: {selectedTrends.length}
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Video ideas', 'Video fikirleri')}</p>
                    <div className="mt-4 space-y-4">
                      {ideas.length === 0 ? (
                        <p className="text-slate-500 text-sm">{tt('No ideas yet. Generate ideas.', 'Henüz fikir yok. Fikir üret.')}</p>
                      ) : (
                        ideas.slice(0, 12).map((idea) => (
                          <div key={idea.id} className="border border-slate-800 rounded-3xl p-5 bg-slate-900/40">
                            <p className="text-white font-black text-sm uppercase tracking-tight">{idea.title}</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-2 leading-relaxed">{idea.hook}</p>
                            <div className="mt-4 flex gap-3">
                              <button
                                onClick={() => copy(formatIdea(idea))}
                                className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                              >
                                {tt('Copy', 'Kopyala')}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'internet' && (
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">{tt('Internet trends', 'İnternet trendleri')}</h4>
                    <p className="text-slate-400 mt-2 text-sm font-medium">
                      {tt('Use HN + GitHub Trending to find niches, tools, and sellable automations.', "HN + GitHub Trending ile niş, tool ve satılabilir otomasyon fikirleri bul.")}
                    </p>
                  </div>
                  <button
                    onClick={runInternetTrends}
                    disabled={isLoadingInternetTrends}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    {isLoadingInternetTrends ? tt('Refreshing…', 'Güncelleniyor…') : tt('Refresh trends', 'Trendleri güncelle')}
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {internetTrends.length === 0 ? (
                    <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                      <p className="text-slate-500 text-sm">{tt('No internet trends yet. Refresh trends.', 'Henüz internet trendi yok. Trendleri güncelle.')}</p>
                    </div>
                  ) : (
                    internetTrends.map((t) => (
                      <div key={t.id} className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.provider}</p>
                            <h5 className="text-white font-black text-lg tracking-tight mt-2 break-words">{t.title}</h5>
                            {t.description ? <p className="text-slate-400 text-sm font-medium mt-2 leading-relaxed">{t.description}</p> : null}
                          </div>
                          {typeof t.score === 'number' ? (
                            <span className="px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border bg-slate-900/60 text-slate-300 border-slate-800">
                              {tt('Score', 'Skor')}: {t.score}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          {t.url ? (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                            >
                              {tt('Open', 'Aç')}
                            </a>
                          ) : null}
                          <button
                            onClick={() => {
                              setNiche(t.title);
                              setMessage(tt('Niche set from internet trend.', 'Niş internet trendinden ayarlandı.'));
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                          >
                            {tt('Use as niche', 'Niş yap')}
                          </button>
                          <button
                            onClick={() => onOpenCatalog({ query: t.title })}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                          >
                            {tt('Search workflows', 'Workflow ara')}
                          </button>
                          <button
                            onClick={() => {
                              setNiche(t.title);
                              setTab('opportunities');
                              runOpportunities(t.title).catch(() => {});
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                          >
                            {tt('Generate offers', 'Teklif üret')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'leads' && (
              <div className="mt-8">
                <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h4 className="text-lg font-black text-white uppercase tracking-tight">{tt('Lead hub (import)', 'Lead merkezi (içe aktar)')}</h4>
                      <p className="text-slate-400 mt-2 text-sm font-medium">
                        {tt(
                          'Paste a lead list from Google Sheets / CSV. We will add it to your outbound pipeline.',
                          "Google Sheets / CSV'den lead listesini yapıştır. Outbound pipeline'a ekleyelim.",
                        )}
                      </p>
                      <p className="mt-3 text-[11px] text-slate-500 font-bold">
                        {tt('Detected', 'Algılandı')}: {leadImportPreviewCount} {tt('lead(s)', 'lead')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          setShowLeadFinder(true);
                          runLeads().catch(() => {});
                        }}
                        disabled={isSearchingLeads}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                      >
                        {isSearchingLeads ? tt('Searching…', 'Aranıyor…') : tt('Find leads', 'Lead bul')}
                      </button>
                      <label className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all cursor-pointer">
                        {tt('Upload CSV', 'CSV yükle')}
                        <input
                          type="file"
                          accept=".csv,.txt"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            file
                              .text()
                              .then((txt) => setLeadImportText(txt))
                              .catch(() => setError(tt('Failed to read file', 'Dosya okunamadı')));
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <button
                        onClick={() => setLeadImportText('')}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                      >
                        {tt('Clear', 'Temizle')}
                      </button>
                      <button
                        onClick={importLeadsToPipeline}
                        disabled={isImportingLeads || leadImportPreviewCount === 0}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                      >
                        {isImportingLeads ? tt('Importing…', 'Aktarılıyor…') : tt('Import to pipeline', "Pipeline'a aktar")}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={leadImportText}
                    onChange={(e) => setLeadImportText(e.target.value)}
                    placeholder={tt(
                      'Example:\nAcme Dental, https://acme.com, +90 555 000 0000\nBosporus Realty, bosporusrealty.com\nhttps://example.org',
                      'Örnek:\nAcme Dental, https://acme.com, +90 555 000 0000\nBosporus Realty, bosporusrealty.com\nhttps://example.org',
                    )}
                    className="mt-6 w-full min-h-[140px] bg-slate-950/40 border border-slate-800 rounded-3xl px-5 py-4 text-sm text-white placeholder:text-slate-600 font-mono"
                  />
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {tt('Format: name, website, phone, notes (optional).', 'Format: isim, web, telefon, not (opsiyonel).')}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-slate-500 text-sm font-medium">
                    {tt('Need help writing your outreach messages?', 'Mesajlarını yazmak için yardım ister misin?')}
                    {onOpenAssistant ? (
                      <button
                        onClick={() =>
                          onOpenAssistant(
                            tt(
                              `Act as my AI Agency CEO. My niche is "${niche || 'local businesses'}" in ${city}. Help me plan outreach and pricing.`,
                              `AI Ajansı CEO'su gibi davran. Nişim "${niche || 'yerel işletmeler'}", şehir: ${city}. Outreach ve fiyat planı çıkar.`,
                            ),
                          )
                        }
                        className="ml-3 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-2.5 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                      >
                        {tt('Ask AI CEO', 'AI CEO’ya sor')}
                      </button>
                    ) : null}
                  </div>
                  <button
                    onClick={() => setShowLeadFinder((v) => !v)}
                    className="bg-slate-950/40 hover:bg-slate-900 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                  >
                    {showLeadFinder ? tt('Hide lead finder', 'Lead bulucuyu gizle') : tt('Optional: lead finder', 'Opsiyonel: lead bulucu')}
                  </button>
                </div>

                {showLeadFinder && (
                  <>
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tight">
                          {tt('Lead finder (optional)', 'Lead bulucu (opsiyonel)')}
                        </h4>
                        <p className="text-slate-400 mt-2 text-sm font-medium">
                          {tt(
                            'Pick a city, fetch leads, then generate a personalized pitch + automation plan.',
                            'Şehir seç, lead çek, sonra kişisel pitch + otomasyon planı üret.',
                          )}
                        </p>
                        {selectedOpportunity && (
                          <p className="mt-3 text-[11px] text-slate-400 font-medium">
                            {tt('Selected offer', 'Seçili teklif')}: <span className="text-slate-200 font-bold">{selectedOpportunity.niche}</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={runLeads}
                        disabled={isSearchingLeads}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                      >
                        {isSearchingLeads ? tt('Searching…', 'Aranıyor…') : tt('Find leads', 'Lead bul')}
                      </button>
                    </div>

                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {leads.length === 0 && !isSearchingLeads ? (
                        <div className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                          <p className="text-slate-500 text-sm font-medium">
                            {tt('No leads yet. Click "Find leads" to fetch from Apify.', 'Henüz lead yok. Apify için “Lead bul”a tıkla.')}
                          </p>
                        </div>
                      ) : null}
                      {leads.map((lead) => {
                        const pitch = pitchByLeadId[lead.id];
                        const busy = pitchBusyId === lead.id;
                        const crm = suiteCrmByLeadId[lead.id];
                        const crmBusy = suiteCrmBusyId === lead.id;
                        const suiteCrmConnected = Boolean(suitecrmStatus?.connected);
                        const piped = pipelineLeads.find((l) => l.source === 'market_radar' && l.sourceRef === lead.id);
                        const pipelineBusy = Boolean(pipelineBusyId) && (pipelineBusyId === lead.id || pipelineBusyId === piped?.id);
                        return (
                          <div key={lead.id} className="bg-slate-950/40 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h5 className="text-white font-black text-lg tracking-tight uppercase">{lead.name}</h5>
                                <p className="text-slate-500 text-sm font-medium mt-1">{lead.category || tt('Business', 'İşletme')}</p>
                                {lead.address && <p className="text-slate-600 text-xs font-bold mt-2">{lead.address}</p>}
                                {lead.website && (
                                  <a
                                    href={lead.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-3 inline-block"
                                  >
                                    {tt('Website', 'Web')} →
                                  </a>
                                )}
                                {lead.mapsUrl && (
                                  <a
                                    href={lead.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-3 text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-3 inline-block"
                                  >
                                    {tt('Maps', 'Harita')} →
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => runPitch(lead)}
                                disabled={Boolean(pitchBusyId)}
                                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                              >
                                {busy ? tt('Generating…', 'Üretiliyor…') : tt('Generate pitch', 'Pitch üret')}
                              </button>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                              {piped?.projectId && onOpenProject ? (
                                <button
                                  onClick={() => onOpenProject(piped.projectId as string, 'Documents')}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                >
                                  {tt('Open project', 'Projeyi aç')}
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    const brief = createClientProjectFromLead(lead);
                                    onCreateProject(brief);
                                    if (piped) {
                                      const nextStage: OutboundStage = piped.stage === 'Won' || piped.stage === 'Lost' ? piped.stage : 'Proposal';
                                      updateOutboundLead(piped.id, { projectId: brief.id, stage: nextStage, lastActionAt: new Date().toISOString() })
                                        .then((next) => {
                                          setPipelineLeads((prev) => prev.map((l) => (l.id === piped.id ? next : l)));
                                        })
                                        .catch(() => {});
                                    }
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                >
                                  {tt('Create project', 'Proje oluştur')}
                                </button>
                              )}
                              {piped ? (
                                <button
                                  onClick={() => setShowPipeline(true)}
                                  className="bg-green-500/10 text-green-300 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-green-500/20 shadow-xl"
                                  title={tt('Saved in pipeline', 'Pipeline’a kaydedildi')}
                                >
                                  {tt('Pipeline', 'Pipeline')}: {stageLabel(piped.stage)}
                                </button>
                              ) : (
                                <button
                                  onClick={() => saveLeadToPipeline(lead)}
                                  disabled={pipelineBusy}
                                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                >
                                  {pipelineBusy ? tt('Saving…', 'Kaydediliyor…') : tt('Save to pipeline', 'Pipeline’a kaydet')}
                                </button>
                              )}
                              {crm ? (
                                <>
                                  {crm.url ? (
                                    <a
                                      href={crm.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                    >
                                      {tt('Open in SuiteCRM', "SuiteCRM'de aç")}
                                    </a>
                                  ) : (
                                    <span className="bg-slate-900 text-slate-300 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl">
                                      SuiteCRM: {crm.id}
                                    </span>
                                  )}
                                  <span className="bg-green-500/10 text-green-300 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-green-500/20">
                                    {tt('Synced', 'Senkron')}
                                  </span>
                                </>
                              ) : suiteCrmConnected ? (
                                <button
                                  onClick={() => runSuiteCrmSync(lead)}
                                  disabled={Boolean(suiteCrmBusyId)}
                                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                >
                                  {crmBusy ? tt('Syncing…', 'Senkron…') : tt('Sync to SuiteCRM', "CRM'e aktar")}
                                </button>
                              ) : (
                                <button
                                  onClick={onOpenSettings}
                                  className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                >
                                  {tt('Configure SuiteCRM', 'SuiteCRM ayarla')}
                                </button>
                              )}
                            </div>

                            {pitch && (
                              <div className="mt-6 border border-slate-800 rounded-3xl p-5 bg-slate-900/40">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Email', 'E-posta')}</p>
                                <p className="mt-3 text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">{pitch.email}</p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button
                                    onClick={() => copy(pitch.email)}
                                    className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                  >
                                    {tt('Copy', 'Kopyala')}
                                  </button>
                                  {selectedOpportunity?.suggestedCatalogQuery && (
                                    <button
                                      onClick={() => onOpenCatalog({ query: selectedOpportunity.suggestedCatalogQuery, requiredTags: selectedOpportunity.suggestedTags })}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                    >
                                      {tt('Open workflows', 'Workflow aç')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="mt-10 bg-slate-900/60 border border-slate-800 rounded-[36px] p-8 shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h4 className="text-lg font-black text-white uppercase tracking-tight">{tt('Outbound pipeline', 'Outbound pipeline')}</h4>
                      <p className="text-slate-400 mt-2 text-sm font-medium">
                        {targets?.leadsNeeded
                          ? tt(
                              `Saved leads: ${pipelineLeads.length}/${targets.leadsNeeded} (to hit your target)`,
                              `Kaydedilen lead: ${pipelineLeads.length}/${targets.leadsNeeded} (hedef için)`,
                            )
                          : tt('Saved leads you are actively contacting.', 'Aktif olarak iletişime geçtiğin lead’ler.')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowPipeline((v) => !v)}
                        className="bg-slate-950/40 hover:bg-slate-900 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                      >
                        {showPipeline ? tt('Hide', 'Gizle') : tt('Show', 'Göster')}
                      </button>
                      <button
                        onClick={refreshPipeline}
                        disabled={isLoadingPipeline}
                        className="bg-slate-950/40 hover:bg-slate-900 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                      >
                        {isLoadingPipeline ? tt('Refreshing…', 'Yenileniyor…') : tt('Refresh', 'Yenile')}
                      </button>
                    </div>
                  </div>

                  {pipelineError && (
                    <div className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-3xl text-red-300 text-xs font-black uppercase tracking-widest">
                      {pipelineError}
                    </div>
                  )}

                  {showPipeline && (
                    <>
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Leads saved', 'Kaydedilen lead')}</p>
                          <p className="mt-2 text-xl font-black text-slate-200">
                            {pipelineProgress.savedLeads}
                            {pipelineProgress.targetLeads ? <span className="text-slate-500">/{pipelineProgress.targetLeads}</span> : null}
                          </p>
                          {pipelineProgress.targetLeads ? (
                            <div className="mt-3 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div className="h-full bg-indigo-600" style={{ width: `${pipelineProgress.leadsPct}%` }} />
                            </div>
                          ) : null}
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Calls booked', 'Görüşme')}</p>
                          <p className="mt-2 text-xl font-black text-slate-200">
                            {pipelineProgress.callsBooked}
                            {pipelineProgress.targetCalls ? <span className="text-slate-500">/{pipelineProgress.targetCalls}</span> : null}
                          </p>
                          {pipelineProgress.targetCalls ? (
                            <div className="mt-3 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div className="h-full bg-indigo-600" style={{ width: `${pipelineProgress.callsPct}%` }} />
                            </div>
                          ) : null}
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Deals won', 'Kapanış')}</p>
                          <p className="mt-2 text-xl font-black text-slate-200">
                            {pipelineProgress.clientsWon}
                            {pipelineProgress.targetClients ? <span className="text-slate-500">/{pipelineProgress.targetClients}</span> : null}
                          </p>
                          {pipelineProgress.targetClients ? (
                            <div className="mt-3 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div className="h-full bg-green-600" style={{ width: `${pipelineProgress.clientsPct}%` }} />
                            </div>
                          ) : null}
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('Follow-ups due', 'Takip zamanı')}</p>
                          <p className="mt-2 text-xl font-black text-slate-200">{followUpsDue}</p>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            {followUpsDue > 0 ? tt('Check Follow-up column.', 'Takip sütununu kontrol et.') : tt('Nothing due today.', 'Bugün takip yok.')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {tt('Today checklist', 'Bugün checklist')}
                            </p>
                            <p className="mt-2 text-sm font-bold text-slate-200">
                              {tt('Do these 3 things daily to get calls.', 'Görüşme almak için her gün bu 3 şeyi yap.')}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const today = (() => {
                                try {
                                  return new Date().toLocaleDateString('en-CA');
                                } catch {
                                  return new Date().toISOString().slice(0, 10);
                                }
                              })();
                              setTodayChecklist({ date: today, leads: false, outreach: false, followups: false });
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                          >
                            {tt('Reset', 'Sıfırla')}
                          </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3">
                            <input
                              type="checkbox"
                              checked={todayChecklist.leads}
                              onChange={(e) => setTodayChecklist((prev) => ({ ...prev, leads: e.target.checked }))}
                              className="accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-200">
                              {tt(`Save ${dailyLeadsQuota} leads`, `${dailyLeadsQuota} lead kaydet`)}
                            </span>
                          </label>
                          <label className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3">
                            <input
                              type="checkbox"
                              checked={todayChecklist.outreach}
                              onChange={(e) => setTodayChecklist((prev) => ({ ...prev, outreach: e.target.checked }))}
                              className="accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-200">
                              {tt(`Send ${dailyLeadsQuota} outreach`, `${dailyLeadsQuota} outreach gönder`)}
                            </span>
                          </label>
                          <label className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3">
                            <input
                              type="checkbox"
                              checked={todayChecklist.followups}
                              onChange={(e) => setTodayChecklist((prev) => ({ ...prev, followups: e.target.checked }))}
                              className="accent-indigo-600"
                            />
                            <span className="text-[11px] font-bold text-slate-200">{tt('5 follow-ups', '5 follow-up')}</span>
                          </label>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            onClick={runLeads}
                            disabled={isSearchingLeads}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                          >
                            {isSearchingLeads ? tt('Searching…', 'Aranıyor…') : tt('Find leads', 'Lead bul')}
                          </button>
                          <button
                            onClick={saveTopLeadsToPipeline}
                            disabled={pipelineBulkBusy}
                            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                            title={tt('Auto-save top leads into the pipeline (deduped).', 'En iyi lead’leri pipeline’a otomatik kaydet (tekrarları atlar).')}
                          >
                            {pipelineBulkBusy ? tt('Saving…', 'Kaydediliyor…') : tt(`Save top ${dailyLeadsQuota}`, `İlk ${dailyLeadsQuota} kaydet`)}
                          </button>
                          {onOpenAssistant ? (
                            <button
                              onClick={() =>
                                onOpenAssistant(
                                  tt(
                                    `Create an outbound script pack (DM + email + 2 follow-ups) for ${country}/${city} niche "${niche || 'auto'}". Use the selected offer and keep it short. Add daily quotas.`,
                                    `${country}/${city} için "${niche || 'otomatik'}" nişine outbound mesaj paketi (DM + email + 2 follow-up) üret. Seçili teklifi kullan, kısa olsun. Günlük kota ekle.`,
                                  ),
                                )
                              }
                              className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-3 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                            >
                              {tt('AI scripts', 'AI mesajları')}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {(['New', 'Contacted', 'Replied', 'Booked', 'Proposal', 'Won', 'Lost'] as OutboundStage[]).map((s) => (
                          <div key={s} className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-800 bg-slate-950/40 text-slate-200">
                            {stageLabel(s)}: {pipelineCounts[s] ?? 0}
                          </div>
                        ))}
                      </div>

                      {pipelineLeads.length === 0 ? (
                        <div className="mt-8 bg-slate-950/40 border border-slate-800 rounded-3xl p-8 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt('No saved leads yet', 'Henüz kaydedilmiş lead yok')}</p>
                          <p className="mt-2 text-slate-600 text-sm">
                            {tt(
                              'Paste a lead list above, or use “Save to pipeline” on an optional lead.',
                              "Yukarıdan lead listesini yapıştır veya (opsiyonel) “Pipeline'a kaydet” kullan.",
                            )}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-8 overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="px-6 py-4">{tt('Lead', 'Lead')}</th>
                                <th className="px-6 py-4">{tt('Stage', 'Aşama')}</th>
                                <th className="px-6 py-4">{tt('Follow-up', 'Takip')}</th>
                                <th className="px-6 py-4 text-right">{tt('Actions', 'Aksiyonlar')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {pipelineSortedLeads.slice(0, 60).map((l) => {
                                const busy = pipelineBusyId === l.id;
                                const followUpDate = l.nextFollowUpAt ? String(l.nextFollowUpAt).slice(0, 10) : '';
                                const today = todayChecklist.date || new Date().toISOString().slice(0, 10);
                                const isDue = Boolean(followUpDate) && followUpDate <= today && l.stage !== 'Won' && l.stage !== 'Lost';
                                const pitch = pitchByLeadId[l.id];
                                const pitchBusy = pitchBusyId === l.id;
                                const suiteUrl = l.externalRef?.provider === 'suitecrm' ? l.externalRef.url : undefined;
                                const suiteConnected = Boolean(suitecrmStatus?.connected);
                                const suiteBusy = suiteCrmBusyId === l.id;
                                return (
                                  <tr key={l.id} className={`hover:bg-indigo-600/5 transition-all ${isDue ? 'bg-yellow-500/5' : ''}`}>
                                    <td className="px-6 py-4">
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-200 truncate">{l.name}</p>
                                        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-1 truncate">
                                          {(l.category || tt('Business', 'İşletme')) as string}
                                          {l.website ? ` • ${l.website}` : ''}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <select
                                        value={l.stage}
                                        onChange={(e) => changePipelineStage(l, e.target.value as OutboundStage)}
                                        disabled={busy}
                                        className="bg-slate-950/40 border border-slate-800 rounded-2xl px-3 py-2 text-[11px] text-slate-200"
                                      >
                                        {(['New', 'Contacted', 'Replied', 'Booked', 'Proposal', 'Won', 'Lost'] as OutboundStage[]).map((s) => (
                                          <option key={s} value={s}>
                                            {stageLabel(s)}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-6 py-4">
                                      <input
                                        type="date"
                                        value={followUpDate}
                                        onChange={(e) => setPipelineFollowUp(l, e.target.value)}
                                        disabled={busy}
                                        className={`bg-slate-950/40 border rounded-2xl px-3 py-2 text-[11px] text-slate-200 ${isDue ? 'border-yellow-500/40' : 'border-slate-800'}`}
                                      />
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex justify-end gap-2">
                                        {l.projectId && onOpenProject ? (
                                          <button
                                            onClick={() => onOpenProject(l.projectId as string, 'Documents')}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-3 py-2 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                          >
                                            {tt('Open', 'Aç')}
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              const brief = createClientProjectFromOutboundLead(l);
                                              onCreateProject(brief);
                                              const nextStage: OutboundStage = l.stage === 'Won' || l.stage === 'Lost' ? l.stage : 'Proposal';
                                              updateOutboundLead(l.id, { projectId: brief.id, stage: nextStage, lastActionAt: new Date().toISOString() })
                                                .then((next) => {
                                                  setPipelineLeads((prev) => prev.map((row) => (row.id === l.id ? next : row)));
                                                })
                                                .catch(() => {});
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-3 py-2 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                          >
                                            {tt('Project', 'Proje')}
                                          </button>
                                        )}
                                        <button
                                          onClick={() => openPipelinePitch(l)}
                                          disabled={Boolean(pitchBusyId)}
                                          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-3 py-2 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                        >
                                          {pitchBusy
                                            ? tt('Generating…', 'Üretiliyor…')
                                            : pitch
                                              ? tt('View pitch', 'Pitch aç')
                                              : tt('AI pitch', 'AI pitch')}
                                        </button>
                                        {!suiteUrl && suiteConnected && (
                                          <button
                                            onClick={() => runSuiteCrmPipelineSync(l)}
                                            disabled={Boolean(suiteCrmBusyId)}
                                            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-3 py-2 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                          >
                                            {suiteBusy ? tt('Syncing…', 'Senkron…') : tt('Sync CRM', "CRM'e aktar")}
                                          </button>
                                        )}
                                        {suiteUrl && (
                                          <a
                                            href={suiteUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-3 py-2 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                          >
                                            SuiteCRM
                                          </a>
                                        )}
                                        <button
                                          onClick={() => removePipelineLead(l)}
                                          disabled={busy}
                                          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-slate-200 text-[10px] font-black px-3 py-2 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                                        >
                                          {tt('Remove', 'Kaldır')}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {activePipelinePitchLeadId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-slate-950 border border-slate-800 rounded-[48px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(15,23,42,0.12)]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/90">
              <div className="min-w-0">
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{tt('AI pitch', 'AI pitch')}</h3>
                <p className="mt-1 text-[10px] text-slate-500 font-black uppercase tracking-[0.35em] truncate">
                  {activePipelinePitchLead?.name || tt('Lead', 'Lead')}
                  {activePipelinePitchLead?.website ? ` • ${activePipelinePitchLead.website}` : ''}
                </p>
              </div>
              <button
                onClick={() => setActivePipelinePitchLeadId(null)}
                className="w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center text-3xl font-light shadow-xl border border-slate-800"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-900/40 space-y-6 custom-scrollbar">
              {!activePipelinePitch ? (
                <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 text-slate-500 text-sm font-bold">
                  {tt('Generating…', 'Üretiliyor…')}
                </div>
              ) : (
                <>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Subject', 'Konu')}</p>
                    <p className="mt-3 text-sm font-black text-slate-200 break-words">{activePipelinePitch.subject}</p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Email', 'E-posta')}</p>
                      <button
                        onClick={() => copy(activePipelinePitch.email)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-2.5 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                      >
                        {tt('Copy', 'Kopyala')}
                      </button>
                    </div>
                    <p className="mt-4 text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">{activePipelinePitch.email}</p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('DM', 'DM')}</p>
                      <button
                        onClick={() => copy(activePipelinePitch.dm)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-black px-4 py-2.5 rounded-2xl uppercase tracking-widest border border-slate-800 shadow-xl active:scale-95 transition-all"
                      >
                        {tt('Copy', 'Kopyala')}
                      </button>
                    </div>
                    <p className="mt-4 text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">{activePipelinePitch.dm}</p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Suggested offer', 'Önerilen teklif')}</p>
                    <p className="mt-3 text-sm font-bold text-slate-200 leading-relaxed">{activePipelinePitch.suggestedOffer}</p>
                    {activePipelinePitch.suggestedAutomations?.length ? (
                      <div className="mt-5 space-y-1">
                        {activePipelinePitch.suggestedAutomations.slice(0, 8).map((s, idx) => (
                          <p key={idx} className="text-[11px] text-slate-400 font-medium">
                            - {s}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {activePipelinePitch.nextSteps?.length ? (
                    <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tt('Next steps', 'Sonraki adımlar')}</p>
                      <div className="mt-4 space-y-1">
                        {activePipelinePitch.nextSteps.slice(0, 8).map((s, idx) => (
                          <p key={idx} className="text-[11px] text-slate-400 font-medium">
                            - {s}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="p-8 border-t border-slate-800 bg-slate-950/90 flex justify-between gap-4">
              <button
                onClick={() => setActivePipelinePitchLeadId(null)}
                className="px-8 py-3 rounded-2xl text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
              >
                {tt('Close', 'Kapat')}
              </button>
              {activePipelinePitchLead ? (
                <button
                  onClick={() => openPipelinePitch(activePipelinePitchLead, { regenerate: true })}
                  disabled={Boolean(pitchBusyId)}
                  className="px-10 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  {tt('Regenerate', 'Yeniden üret')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketRadar;
