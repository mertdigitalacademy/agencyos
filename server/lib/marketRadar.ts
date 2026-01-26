import { Type } from "@google/genai";
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
} from "../../types";
import { getGeminiClient } from "./gemini";
import { openRouterChat } from "./openrouter";
import { extractFirstJsonObject } from "./parseJson";
import { readJsonFile, writeJsonFile } from "./storage";

const FILE = "market-radar.json";

function nowIso(): string {
  return new Date().toISOString();
}

function safeText(input: unknown): string {
  return String(input ?? "").trim();
}

function pickOpenRouterModel(): string {
  const marketModel = safeText(process.env.MARKET_MODEL);
  if (marketModel) return marketModel;
  const chairman = safeText(process.env.COUNCIL_CHAIRMAN_MODEL);
  if (chairman) return chairman;
  const first = safeText(process.env.COUNCIL_MODELS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || "openai/gpt-5-mini";
}

function clampInt(input: unknown, fallback: number, min: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeCountry(input: unknown): string {
  const v = safeText(input);
  return v.length > 0 ? v : "Turkey";
}

function normalizeCity(input: unknown): string {
  const v = safeText(input);
  return v.length > 0 ? v : "Istanbul";
}

function normalizeNiche(input: unknown): string {
  const v = safeText(input);
  return v.length > 0 ? v : "Local service businesses";
}

function normalizeLanguage(input: unknown): AppLanguage {
  return safeText(input).toLowerCase() === "en" ? "en" : "tr";
}

function uniqId(prefix: string, seed: string): string {
  const base = seed.trim().toLowerCase().slice(0, 40).replace(/[^a-z0-9]+/g, "-");
  return `${prefix}-${base || Date.now()}`;
}

function parseViews(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = safeText(input);
  if (!raw) return undefined;
  const compact = raw.replace(/,/g, "").toUpperCase();
  const m = compact.match(/([\d.]+)\s*([KMB])?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const unit = m[2];
  if (unit === "K") return Math.round(n * 1000);
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "B") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

function defaultState(): MarketRadarState {
  const updatedAt = nowIso();

  const opportunities: MarketOpportunity[] = [
    {
      id: "opp-dentists",
      niche: "Dental clinics",
      idealCustomer: "Owner/manager at a local dental clinic",
      painPoints: ["No-shows", "Slow lead follow-up", "Manual appointment reminders", "Low review velocity"],
      offer:
        "AI receptionist + missed-call text back + appointment reminders + review requests (done-for-you automation)",
      suggestedCatalogQuery: "webhook google sheets sms whatsapp calendar reminders",
      suggestedTags: ["webhook"],
      pricingHint: "Setup + monthly retainer",
      pricing: { currency: "USD", setup: 1500, monthly: 800, firstMonth: 2300, notes: "Starter automation + support." },
      source: "mock",
    },
    {
      id: "opp-real-estate",
      niche: "Real estate agencies",
      idealCustomer: "Agency owner or lead agent",
      painPoints: ["Leads scattered across channels", "Manual listings follow-up", "Slow response time"],
      offer: "Lead capture → CRM → instant reply → pipeline automation + weekly reporting",
      suggestedCatalogQuery: "lead webhook crm slack email follow up google sheets report",
      suggestedTags: ["webhook"],
      pricingHint: "Monthly retainer + performance add-on",
      pricing: { currency: "USD", setup: 2000, monthly: 1200, firstMonth: 3200, notes: "Includes weekly report + SLA." },
      source: "mock",
    },
    {
      id: "opp-restaurants",
      niche: "Restaurants",
      idealCustomer: "Restaurant owner",
      painPoints: ["Reservation management", "Repetitive customer messages", "Low repeat rate"],
      offer: "WhatsApp/Instagram DM auto-reply + reservation routing + loyalty follow-ups",
      suggestedCatalogQuery: "instagram webhook whatsapp google sheets reservation",
      suggestedTags: ["webhook"],
      pricingHint: "Setup + monthly",
      pricing: { currency: "USD", setup: 1200, monthly: 700, firstMonth: 1900, notes: "Lightweight DM + booking flows." },
      source: "mock",
    },
    {
      id: "opp-ecom",
      niche: "Shopify e-commerce stores",
      idealCustomer: "Founder/ops manager",
      painPoints: ["Manual order updates", "Support ticket overload", "Abandoned cart recovery"],
      offer: "AI support triage + order status automation + abandoned cart sequences",
      suggestedCatalogQuery: "shopify order webhook email slack support",
      suggestedTags: ["webhook"],
      pricingHint: "Monthly + usage",
      pricing: { currency: "USD", setup: 2500, monthly: 1500, firstMonth: 4000, notes: "Support automation + reporting." },
      source: "mock",
    },
  ];

  const youtubeTrends: MarketTrendVideo[] = [
    {
      id: "yt-ai-agency-2026",
      title: "AI ajansı nasıl kurulur? (2026 blueprint)",
      url: "https://www.youtube.com/results?search_query=ai+ajansı+nasıl+kurulur",
      channel: "Market Radar",
      source: "mock",
    },
    {
      id: "yt-n8n-templates",
      title: "n8n workflow template’leri ile 10 dakikada otomasyon",
      url: "https://www.youtube.com/results?search_query=n8n+workflow+templates",
      channel: "Market Radar",
      source: "mock",
    },
    {
      id: "yt-cold-email",
      title: "Cold email otomasyonu: teklif → toplantı → kapanış",
      url: "https://www.youtube.com/results?search_query=cold+email+automation+agency",
      channel: "Market Radar",
      source: "mock",
    },
  ];

  const youtubeIdeas: MarketVideoIdea[] = [
    {
      id: "idea-1",
      title: "0’dan 7 günde ilk müşteri: AI Ajansı satış sistemi",
      hook: "7 günde ilk müşteriyi getirmenin 3 adımı: niş, teklif, otomasyon.",
      angle: "Sistem kurma + gerçek checklist",
      outline: ["Niş seçimi", "Teklif paketleri", "CRM + takip otomasyonu", "Demo ile kapanış"],
      cta: "İstersen AgencyOS’ta hazır şablonları birlikte kuralım.",
      keywords: ["ai ajansı", "satış sistemi", "otomasyon"],
    },
    {
      id: "idea-2",
      title: "n8n ile ajans operasyonu: teklif→sözleşme→fatura otomasyonu",
      hook: "Sıfır kod ile 1 günde kurulan ajans işletim sistemi.",
      angle: "Uçtan uca demo akışı",
      outline: ["Intake form", "CRM lead", "Council gate", "Invoice + rapor"],
      cta: "Workflow kataloğundan şablon seçip kurulum checklist’ini çalıştır.",
      keywords: ["n8n", "workflow", "ajans"],
    },
  ];

  const internetTrends: MarketInternetTrend[] = [
    {
      id: "web-hn-ai-agency",
      provider: "HackerNews",
      title: "AI agents: real-world automation playbooks (HN)",
      url: "https://news.ycombinator.com/",
      description: "Use HN to spot tools + pain points that can be productized.",
      score: 0,
      source: "mock",
    },
    {
      id: "web-gh-trending-automation",
      provider: "GitHubTrending",
      title: "Trending repos: automation / workflow / agents (GitHub)",
      url: "https://github.com/trending",
      description: "Find templates, SDKs, and agent tooling the market is adopting.",
      score: 0,
      source: "mock",
    },
  ];

  const leads: MarketLeadCandidate[] = [
    {
      id: "lead-istanbul-dentist",
      name: "Istanbul Smile Dental Clinic",
      category: "Dental clinic",
      address: "Şişli, Istanbul",
      website: "https://example.com",
      phone: "+90 212 000 0000",
      rating: 4.7,
      reviews: 210,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=dental+clinic+%C5%9Fi%C5%9Fli",
      source: "mock",
    },
    {
      id: "lead-istanbul-realestate",
      name: "Bosporus Realty",
      category: "Real estate agency",
      address: "Beşiktaş, Istanbul",
      website: "https://example.com",
      phone: "+90 212 000 0001",
      rating: 4.4,
      reviews: 95,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=real+estate+agency+be%C5%9Fikta%C5%9F",
      source: "mock",
    },
  ];

  return {
    country: "Turkey",
    city: "Istanbul",
    niche: "AI automation for local businesses",
    updatedAt,
    opportunities,
    youtubeTrends,
    youtubeIdeas,
    internetTrends,
    leads,
  };
}

export async function readMarketRadarState(): Promise<MarketRadarState> {
  const fallback = defaultState();
  const stored = await readJsonFile<Partial<MarketRadarState>>(FILE, fallback);
  return {
    ...fallback,
    ...stored,
    country: normalizeCountry(stored.country ?? fallback.country),
    city: normalizeCity(stored.city ?? fallback.city),
    niche: normalizeNiche(stored.niche ?? fallback.niche),
    opportunities: Array.isArray(stored.opportunities) ? stored.opportunities : fallback.opportunities,
    youtubeTrends: Array.isArray(stored.youtubeTrends) ? stored.youtubeTrends : fallback.youtubeTrends,
    youtubeIdeas: Array.isArray(stored.youtubeIdeas) ? stored.youtubeIdeas : fallback.youtubeIdeas,
    internetTrends: Array.isArray((stored as any).internetTrends) ? ((stored as any).internetTrends as any) : fallback.internetTrends,
    leads: Array.isArray(stored.leads) ? stored.leads : fallback.leads,
    updatedAt: typeof stored.updatedAt === "string" && stored.updatedAt.trim() ? stored.updatedAt : fallback.updatedAt,
  };
}

export async function patchMarketRadarState(patch: Partial<MarketRadarState>): Promise<MarketRadarState> {
  const current = await readMarketRadarState();
  const next: MarketRadarState = {
    ...current,
    ...patch,
    country: normalizeCountry(patch.country ?? current.country),
    city: normalizeCity(patch.city ?? current.city),
    niche: normalizeNiche(patch.niche ?? current.niche),
    opportunities: Array.isArray(patch.opportunities) ? patch.opportunities : current.opportunities,
    youtubeTrends: Array.isArray(patch.youtubeTrends) ? patch.youtubeTrends : current.youtubeTrends,
    youtubeIdeas: Array.isArray(patch.youtubeIdeas) ? patch.youtubeIdeas : current.youtubeIdeas,
    internetTrends: Array.isArray(patch.internetTrends) ? patch.internetTrends : current.internetTrends,
    leads: Array.isArray(patch.leads) ? patch.leads : current.leads,
    updatedAt: nowIso(),
  };
  await writeJsonFile(FILE, next);
  return next;
}

function normalizeApifyActorId(input: unknown): string {
  const raw = safeText(input);
  if (!raw) return "";
  const urlMatch = raw.match(/apify\.com\/([^/]+)\/([^/?#]+)/i);
  const fromUrl = urlMatch ? `${urlMatch[1]}~${urlMatch[2]}` : raw;
  if (fromUrl.includes("/")) return fromUrl.replace("/", "~");
  return fromUrl;
}

async function apifyJson<T>(url: string, init?: RequestInit, timeoutMs = 25_000): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Apify request failed (${res.status}): ${body.slice(0, 400)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

export function getApifyMarketStatus(): { connected: boolean; reason?: string; hasToken: boolean; hasYoutubeActor: boolean; hasLeadsActor: boolean } {
  const token = safeText(process.env.APIFY_API_TOKEN);
  const youtubeActor = normalizeApifyActorId(process.env.APIFY_YOUTUBE_TRENDS_ACTOR);
  const leadsActor = normalizeApifyActorId(process.env.APIFY_GOOGLE_MAPS_LEADS_ACTOR);
  const hasToken = token.length > 0;
  const hasYoutubeActor = youtubeActor.length > 0;
  const hasLeadsActor = leadsActor.length > 0;

  if (!hasToken) return { connected: false, reason: "Missing APIFY_API_TOKEN", hasToken, hasYoutubeActor, hasLeadsActor };
  if (!hasYoutubeActor && !hasLeadsActor) {
    return {
      connected: false,
      reason: "Missing APIFY_YOUTUBE_TRENDS_ACTOR and APIFY_GOOGLE_MAPS_LEADS_ACTOR",
      hasToken,
      hasYoutubeActor,
      hasLeadsActor,
    };
  }
  return { connected: true, hasToken, hasYoutubeActor, hasLeadsActor };
}

async function apifyRunActor(params: {
  actorId: string;
  token: string;
  input: any;
  waitSecs?: number;
}): Promise<{ defaultDatasetId: string; status: string; id: string }> {
  const waitSecs = clampInt(params.waitSecs, 30, 1, 120);
  const timeoutMs = Math.max(25_000, (waitSecs + 10) * 1000);
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(params.actorId)}/runs?token=${encodeURIComponent(
    params.token,
  )}&waitForFinish=${waitSecs}`;
  const out = await apifyJson<{ data: any }>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params.input ?? {}),
  }, timeoutMs);
  const data = out?.data ?? {};
  const defaultDatasetId = safeText(data.defaultDatasetId);
  const status = safeText(data.status).toUpperCase();
  const id = safeText(data.id);
  if (!defaultDatasetId) throw new Error("Apify run missing defaultDatasetId");
  return { defaultDatasetId, status, id };
}

async function apifyGetDatasetItems(params: { datasetId: string; token: string; limit?: number }): Promise<any[]> {
  const limit = clampInt(params.limit, 50, 1, 200);
  const url = `https://api.apify.com/v2/datasets/${encodeURIComponent(params.datasetId)}/items?token=${encodeURIComponent(
    params.token,
  )}&clean=true&format=json&limit=${limit}`;
  const items = await apifyJson<any[]>(url, { method: "GET" });
  return Array.isArray(items) ? items : [];
}

export async function marketFetchYouTubeTrends(params: {
  country?: string;
  language?: AppLanguage;
  limit?: number;
}): Promise<{ items: MarketTrendVideo[]; source: "mock" | "apify"; error?: string }> {
  const country = normalizeCountry(params.country);
  const limit = clampInt(params.limit, 12, 3, 50);
  const token = safeText(process.env.APIFY_API_TOKEN);
  const actorId = normalizeApifyActorId(process.env.APIFY_YOUTUBE_TRENDS_ACTOR);

  if (token && actorId) {
    try {
      const run = await apifyRunActor({
        actorId,
        token,
        input: { country, maxItems: limit },
        waitSecs: 25,
      });
      const rawItems = await apifyGetDatasetItems({ datasetId: run.defaultDatasetId, token, limit });
      const mapped: MarketTrendVideo[] = rawItems
        .map((item, idx) => {
          const title = safeText(item?.title ?? item?.videoTitle ?? item?.name);
          const url = safeText(item?.url ?? item?.videoUrl ?? item?.link);
          const channel = safeText(item?.channelName ?? item?.channel ?? item?.author);
          if (!title) return null;
          const publishedAt = safeText(item?.publishedAt ?? item?.publishedTimeText ?? item?.published);
          const views = parseViews(item?.viewCount ?? item?.views ?? item?.viewCountText);
          return {
            id: safeText(item?.id) || `yt-${Date.now()}-${idx}`,
            title,
            url: url || undefined,
            channel: channel || undefined,
            publishedAt: publishedAt || undefined,
            views,
            source: "apify",
            raw: item,
          } satisfies MarketTrendVideo;
        })
        .filter(Boolean) as MarketTrendVideo[];

      if (mapped.length > 0) return { items: mapped.slice(0, limit), source: "apify" };
      return { items: defaultState().youtubeTrends.slice(0, limit), source: "mock", error: "Apify actor returned no usable items" };
    } catch (e) {
      return { items: defaultState().youtubeTrends.slice(0, limit), source: "mock", error: e instanceof Error ? e.message : "Apify trends failed" };
    }
  }

  return { items: defaultState().youtubeTrends.slice(0, limit), source: "mock", error: token ? "Missing APIFY_YOUTUBE_TRENDS_ACTOR" : "Missing APIFY_API_TOKEN" };
}

function fallbackIdeas(params: { language: AppLanguage; niche: string; trends: MarketTrendVideo[]; count: number }): MarketVideoIdea[] {
  const count = clampInt(params.count, 10, 3, 30);
  const base = params.trends.length > 0 ? params.trends.map((t) => t.title) : ["AI agency growth", "n8n automation", "cold outreach systems"];
  const items: MarketVideoIdea[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = base[i % base.length] || params.niche;
    const title =
      params.language === "tr"
        ? `(${i + 1}) ${seed} — 10 dakikada uygulanabilir sistem`
        : `(${i + 1}) ${seed} — an actionable 10-minute system`;
    items.push({
      id: uniqId("idea", title),
      title,
      hook: params.language === "tr" ? "Bugün uygulayabileceğin net bir adım listesi." : "A clear step-by-step you can apply today.",
      angle: params.language === "tr" ? "Checklist + örnek akış" : "Checklist + example flow",
      outline: params.language === "tr" ? ["Problem", "Çözüm", "Demo", "Teklif + fiyat", "Kurulum"] : ["Problem", "Solution", "Demo", "Offer + pricing", "Setup"],
      cta: params.language === "tr" ? "İstersen bu akışı AgencyOS’ta birlikte kuralım." : "Want it implemented? Let’s set it up in AgencyOS.",
      keywords: [params.niche].filter(Boolean),
    });
  }
  return items;
}

export async function marketGenerateYouTubeIdeas(params: {
  goal: JourneyGoal;
  country?: string;
  niche?: string;
  language?: AppLanguage;
  trends?: MarketTrendVideo[];
  count?: number;
}): Promise<{ items: MarketVideoIdea[]; source: "ai" | "mock" }> {
  const language = normalizeLanguage(params.language);
  const niche = normalizeNiche(params.niche);
  const count = clampInt(params.count, 12, 3, 30);
  const trends = Array.isArray(params.trends) ? params.trends : [];
  const mapIdeas = (list: Array<Omit<MarketVideoIdea, "id">>) =>
    list
      .slice(0, count)
      .map((idea) => ({
        id: uniqId("idea", safeText(idea.title)),
        title: safeText(idea.title) || "Untitled",
        hook: safeText(idea.hook) || "",
        angle: safeText(idea.angle) || "",
        outline: Array.isArray(idea.outline) ? idea.outline.map((x) => safeText(x)).filter(Boolean).slice(0, 10) : [],
        cta: safeText(idea.cta) || "",
        keywords: Array.isArray(idea.keywords) ? idea.keywords.map((x) => safeText(x)).filter(Boolean).slice(0, 12) : [],
      }))
      .filter((x) => x.title.length > 0);

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    const prompt = [
      language === "tr" ? "Türkçe yaz." : "Write in English.",
      `Goal: ${params.goal}`,
      `Niche: ${niche}`,
      `Trends: ${JSON.stringify(trends.map((t) => t.title).slice(0, 12))}`,
      `Return ONLY JSON: {"ideas":[{"title":"...","hook":"...","angle":"...","outline":["..."],"cta":"...","keywords":["..."]}]}`,
      `Count: ${count}`,
    ].join("\n");

    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        messages: [
          { role: "system", content: "Output ONLY valid JSON. Do not reveal secrets." },
          { role: "user", content: prompt },
        ],
      });
      const parsed = extractFirstJsonObject<{ ideas?: Array<Omit<MarketVideoIdea, "id">> }>(raw);
      const list = Array.isArray(parsed?.ideas) ? parsed?.ideas : [];
      const items = mapIdeas(list);
      if (items.length > 0) return { items, source: "ai" };
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (ai) {
    const prompt = [
      language === "tr" ? "Türkçe yaz." : "Write in English.",
      `Goal: ${params.goal}`,
      `Niche: ${niche}`,
      `Use trends if provided.`,
      `Trends: ${JSON.stringify(trends.map((t) => ({ title: t.title, channel: t.channel, url: t.url })).slice(0, 12))}`,
      `Return ONLY valid JSON with: { "ideas": [ { "title": "...", "hook": "...", "angle": "...", "outline": ["..."], "cta": "...", "keywords": ["..."] } ] }`,
      `Rules: actionable, no hype, no secrets, no copyrighted scripts.`,
    ].join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ideas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  angle: { type: Type.STRING },
                  outline: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cta: { type: Type.STRING },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["title", "hook", "angle", "outline", "cta", "keywords"],
              },
            },
          },
          required: ["ideas"],
        },
      },
    });

    try {
      const parsed = JSON.parse(response.text || "{}") as { ideas?: Array<Omit<MarketVideoIdea, "id">> };
      const list = Array.isArray(parsed.ideas) ? parsed.ideas : [];
      const items = mapIdeas(list);
      if (items.length > 0) return { items, source: "ai" };
    } catch {
      // fall through
    }
  }

  return { items: fallbackIdeas({ language, niche, trends, count }), source: "mock" };
}

function fallbackOpportunities(params: { goal: JourneyGoal; language: AppLanguage; country: string; city: string; count: number }): MarketOpportunity[] {
  const base = defaultState().opportunities;
  const items = base.slice(0, clampInt(params.count, 6, 3, 20)).map((o) => ({ ...o, source: "mock" as const }));
  if (params.language === "en") {
    return items.map((o) => ({
      ...o,
      offer: o.offer,
    }));
  }
  return items;
}

export async function marketGenerateOpportunities(params: {
  goal: JourneyGoal;
  country?: string;
  city?: string;
  niche?: string;
  language?: AppLanguage;
  count?: number;
}): Promise<{ items: MarketOpportunity[]; source: "ai" | "mock" }> {
  const language = normalizeLanguage(params.language);
  const country = normalizeCountry(params.country);
  const city = normalizeCity(params.city);
  const count = clampInt(params.count, 6, 3, 20);
  const niche = safeText(params.niche);
  const prompt = [
    language === "tr" ? "Türkçe yaz." : "Write in English.",
    `Goal: ${params.goal}`,
    `Country: ${country}`,
    `City: ${city}`,
    niche ? `Focus niche: ${niche}` : "Suggest profitable niches for an AI/automation agency.",
    `Return ONLY JSON: { "opportunities": [ { "niche":"...", "idealCustomer":"...", "painPoints":["..."], "offer":"...", "suggestedCatalogQuery":"...", "suggestedTags":["..."], "pricingHint":"...", "pricing": { "currency":"USD", "setup": 1500, "monthly": 800, "firstMonth": 2300, "notes":"..." } } ] }`,
    `Rules: real-world, actionable, avoid hype. Catalog query should be simple keywords for n8n workflows.`,
    `Count: ${count}`,
  ].join("\n");

  const mapOpportunities = (list: any[]): MarketOpportunity[] =>
    list.slice(0, count).map((o, idx) => ({
      id: uniqId("opp", safeText(o?.niche) || String(idx)),
      niche: safeText(o?.niche) || "Niche",
      idealCustomer: safeText(o?.idealCustomer) || "",
      painPoints: Array.isArray(o?.painPoints) ? o.painPoints.map((x: any) => safeText(x)).filter(Boolean).slice(0, 8) : [],
      offer: safeText(o?.offer) || "",
      suggestedCatalogQuery: safeText(o?.suggestedCatalogQuery) || "",
      suggestedTags: Array.isArray(o?.suggestedTags) ? o.suggestedTags.map((x: any) => safeText(x)).filter(Boolean).slice(0, 8) : [],
      pricingHint: safeText(o?.pricingHint) || undefined,
      pricing: (() => {
        const p = o?.pricing;
        if (!p || typeof p !== "object") return undefined;
        const currency = safeText(p?.currency) || "USD";
        const setup = Number(p?.setup);
        const monthly = Number(p?.monthly);
        const firstMonthRaw = Number(p?.firstMonth);
        const firstMonth =
          Number.isFinite(firstMonthRaw) && firstMonthRaw > 0
            ? firstMonthRaw
            : Number.isFinite(setup) && setup > 0 && Number.isFinite(monthly) && monthly > 0
              ? setup + monthly
              : undefined;
        const notes = safeText(p?.notes) || undefined;

        const out: any = { currency };
        if (Number.isFinite(setup) && setup > 0) out.setup = setup;
        if (Number.isFinite(monthly) && monthly > 0) out.monthly = monthly;
        if (Number.isFinite(firstMonth) && firstMonth > 0) out.firstMonth = firstMonth;
        if (notes) out.notes = notes;
        return Object.keys(out).length > 1 ? out : undefined;
      })(),
      source: "ai",
    }));

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        messages: [
          { role: "system", content: "Output ONLY valid JSON. Do not reveal secrets." },
          { role: "user", content: prompt },
        ],
      });
      const parsed = extractFirstJsonObject<{ opportunities?: any[] }>(raw);
      const list = Array.isArray(parsed?.opportunities) ? parsed?.opportunities : [];
      const items = mapOpportunities(list);
      const usable = items.filter((o) => o.niche.length > 0 && o.suggestedCatalogQuery.length > 0);
      if (usable.length > 0) return { items: usable, source: "ai" };
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (ai) {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            opportunities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  niche: { type: Type.STRING },
                  idealCustomer: { type: Type.STRING },
                  painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  offer: { type: Type.STRING },
                  suggestedCatalogQuery: { type: Type.STRING },
                  suggestedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  pricingHint: { type: Type.STRING },
                  pricing: {
                    type: Type.OBJECT,
                    properties: {
                      currency: { type: Type.STRING },
                      setup: { type: Type.NUMBER },
                      monthly: { type: Type.NUMBER },
                      firstMonth: { type: Type.NUMBER },
                      notes: { type: Type.STRING },
                    },
                  },
                },
                required: ["niche", "idealCustomer", "painPoints", "offer", "suggestedCatalogQuery"],
              },
            },
          },
          required: ["opportunities"],
        },
      },
    });

    try {
      const parsed = JSON.parse(response.text || "{}") as { opportunities?: any[] };
      const list = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
      const items = mapOpportunities(list);
      const usable = items.filter((o) => o.niche.length > 0 && o.suggestedCatalogQuery.length > 0);
      if (usable.length > 0) return { items: usable, source: "ai" };
    } catch {
      // fall through
    }
  }

  return { items: fallbackOpportunities({ goal: params.goal, language, country, city, count }), source: "mock" };
}

export async function marketSearchLeads(params: {
  country?: string;
  city?: string;
  query?: string;
  language?: AppLanguage;
  limit?: number;
}): Promise<{ items: MarketLeadCandidate[]; source: "mock" | "apify"; error?: string }> {
  const country = normalizeCountry(params.country);
  const city = normalizeCity(params.city);
  const query = normalizeNiche(params.query);
  const limit = clampInt(params.limit, 15, 5, 50);

  const token = safeText(process.env.APIFY_API_TOKEN);
  const actorId = normalizeApifyActorId(process.env.APIFY_GOOGLE_MAPS_LEADS_ACTOR);

  if (token && actorId) {
    try {
      const run = await apifyRunActor({
        actorId,
        token,
        input: {
          searchStringsArray: [`${query} ${city} ${country}`],
          maxCrawledPlaces: limit,
        },
        waitSecs: 35,
      });
      const rawItems = await apifyGetDatasetItems({ datasetId: run.defaultDatasetId, token, limit });
      const mapped: MarketLeadCandidate[] = rawItems
        .map((item, idx) => {
          const name = safeText(item?.title ?? item?.name);
          if (!name) return null;
          const address = safeText(item?.address ?? item?.location ?? item?.formattedAddress);
          const website = safeText(item?.website ?? item?.websiteUrl);
          const phone = safeText(item?.phone ?? item?.phoneNumber);
          const ratingRaw = item?.totalScore ?? item?.rating;
          const rating = typeof ratingRaw === "number" && Number.isFinite(ratingRaw) ? ratingRaw : undefined;
          const reviewsRaw = item?.reviewsCount ?? item?.numberOfReviews ?? item?.reviews;
          const reviews = typeof reviewsRaw === "number" && Number.isFinite(reviewsRaw) ? reviewsRaw : parseViews(reviewsRaw);
          const mapsUrl = safeText(item?.url ?? item?.placeUrl ?? item?.googleUrl);
          const category = safeText(item?.categoryName ?? item?.category);
          return {
            id: safeText(item?.placeId) || `lead-${Date.now()}-${idx}`,
            name,
            category: category || undefined,
            address: address || undefined,
            website: website || undefined,
            phone: phone || undefined,
            rating,
            reviews,
            mapsUrl: mapsUrl || undefined,
            source: "apify",
            raw: item,
          } satisfies MarketLeadCandidate;
        })
        .filter(Boolean) as MarketLeadCandidate[];

      if (mapped.length > 0) return { items: mapped.slice(0, limit), source: "apify" };
      return { items: defaultState().leads.slice(0, limit), source: "mock", error: "Apify actor returned no usable leads" };
    } catch (e) {
      return { items: defaultState().leads.slice(0, limit), source: "mock", error: e instanceof Error ? e.message : "Apify leads failed" };
    }
  }

  return { items: defaultState().leads.slice(0, limit), source: "mock", error: token ? "Missing APIFY_GOOGLE_MAPS_LEADS_ACTOR" : "Missing APIFY_API_TOKEN" };
}

function fallbackPitch(params: { language: AppLanguage; lead: MarketLeadCandidate; goal: JourneyGoal; opportunity?: MarketOpportunity | null }): MarketLeadPitch {
  const name = params.lead.name || "there";
  const offer =
    params.opportunity?.offer ||
    (params.goal === "youtube_systems"
      ? "YouTube content pipeline + analytics automation"
      : "AI lead capture + instant follow-up + reporting automation");

  if (params.language === "en") {
    return {
      subject: `Quick idea for ${name} (automation)`,
      email: `Hi ${name},\n\nI noticed your business and I think we can help with ${offer}. In 7 days we can set up: lead capture → instant follow-up → weekly reporting.\n\nIf you're open to it, I can send a 1-page plan and a short demo.\n\nBest,\nAgencyOS`,
      dm: `Hi ${name} — quick idea: ${offer}. Want a 1-page plan + demo?`,
      suggestedOffer: offer,
      suggestedAutomations: ["Lead capture + instant reply", "CRM pipeline + reminders", "Weekly reporting dashboard"],
      nextSteps: ["Confirm target channel (WhatsApp/Email/Instagram)", "Collect credentials safely (vault)", "Run a test workflow", "Go-live with monitoring"],
      source: "mock",
    };
  }

  return {
    subject: `${name} için hızlı otomasyon fikri`,
    email: `Selam ${name},\n\nİşletmeniz için ${offer} kurabiliriz. 7 gün içinde: lead toplama → anında dönüş → haftalık rapor akışını kurup teslim ediyoruz.\n\nİstersen 1 sayfalık plan + kısa demo göndereyim.\n\nSevgiler,\nAgencyOS`,
    dm: `Selam ${name} — hızlı fikir: ${offer}. 1 sayfalık plan + demo ister misin?`,
    suggestedOffer: offer,
    suggestedAutomations: ["Lead toplama + anında dönüş", "CRM pipeline + hatırlatmalar", "Haftalık raporlama"],
    nextSteps: ["Hedef kanal seçimi (WhatsApp/Email/Instagram)", "Credential’ları vault’a ekle", "Test workflow çalıştır", "İzleme ile canlıya al"],
    source: "mock",
  };
}

export async function marketGenerateLeadPitch(params: {
  goal: JourneyGoal;
  language?: AppLanguage;
  lead: MarketLeadCandidate;
  opportunity?: MarketOpportunity | null;
}): Promise<MarketLeadPitch> {
  const language = normalizeLanguage(params.language);
  const lead = params.lead;

  const prompt = [
    language === "tr" ? "Türkçe yaz." : "Write in English.",
    `Goal: ${params.goal}`,
    `Lead: ${JSON.stringify({ name: lead.name, category: lead.category, address: lead.address, website: lead.website })}`,
    params.opportunity ? `Opportunity: ${JSON.stringify(params.opportunity)}` : "",
    `Return ONLY JSON: { "subject":"...", "email":"...", "dm":"...", "suggestedOffer":"...", "suggestedAutomations":["..."], "nextSteps":["..."] }`,
    `Rules: short, respectful, no spammy claims, no secrets.`,
  ]
    .filter(Boolean)
    .join("\n");

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        messages: [
          { role: "system", content: "Output ONLY valid JSON. Do not reveal secrets." },
          { role: "user", content: prompt },
        ],
      });

      const parsed = extractFirstJsonObject<Omit<MarketLeadPitch, "source">>(raw);
      if (parsed && safeText(parsed.subject) && safeText(parsed.email)) {
        return {
          subject: safeText(parsed.subject),
          email: safeText(parsed.email),
          dm: safeText(parsed.dm),
          suggestedOffer: safeText(parsed.suggestedOffer),
          suggestedAutomations: Array.isArray(parsed.suggestedAutomations)
            ? parsed.suggestedAutomations.map((x) => safeText(x)).filter(Boolean).slice(0, 10)
            : [],
          nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map((x) => safeText(x)).filter(Boolean).slice(0, 10) : [],
          source: "ai",
        };
      }
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (ai) {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            email: { type: Type.STRING },
            dm: { type: Type.STRING },
            suggestedOffer: { type: Type.STRING },
            suggestedAutomations: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["subject", "email", "dm", "suggestedOffer", "suggestedAutomations", "nextSteps"],
        },
      },
    });

    try {
      const parsed = JSON.parse(response.text || "{}") as Omit<MarketLeadPitch, "source">;
      if (safeText(parsed.subject) && safeText(parsed.email)) {
        return {
          subject: safeText(parsed.subject),
          email: safeText(parsed.email),
          dm: safeText(parsed.dm),
          suggestedOffer: safeText(parsed.suggestedOffer),
          suggestedAutomations: Array.isArray(parsed.suggestedAutomations)
            ? parsed.suggestedAutomations.map((x) => safeText(x)).filter(Boolean).slice(0, 10)
            : [],
          nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map((x) => safeText(x)).filter(Boolean).slice(0, 10) : [],
          source: "ai",
        };
      }
    } catch {
      // fall through
    }
  }

  return fallbackPitch({ language, lead, goal: params.goal, opportunity: params.opportunity ?? null });
}
