import type { MarketInternetTrend, MarketInternetTrendProvider } from "../../types";

type FetchResult = { items: MarketInternetTrend[]; source: "web" | "mock"; error?: string };

type InternetTrendSource = "hackernews" | "github";

type CacheEntry = { key: string; expiresAt: number; value: FetchResult };

let cache: CacheEntry | null = null;

function nowMs(): number {
  return Date.now();
}

function safeText(input: unknown): string {
  return String(input ?? "").trim();
}

function uniqId(prefix: string, seed: string): string {
  const base = seed.trim().toLowerCase().slice(0, 64).replace(/[^a-z0-9]+/g, "-");
  return `${prefix}-${base || nowMs()}`;
}

function clampInt(input: unknown, fallback: number, min: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function fetchText(url: string, timeoutMs = 18_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "AgencyOS/0.1 (trend fetch; +https://localhost)",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, timeoutMs = 18_000): Promise<T> {
  const txt = await fetchText(url, timeoutMs);
  return JSON.parse(txt) as T;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

function stripTags(input: string): string {
  const noTags = input.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(noTags).replace(/\s+/g, " ").trim();
}

async function fetchHackerNewsTop(limit: number): Promise<MarketInternetTrend[]> {
  const ids = await fetchJson<number[]>("https://hacker-news.firebaseio.com/v0/topstories.json", 18_000);
  const slice = ids.slice(0, Math.max(1, limit));

  const concurrency = 8;
  const out: MarketInternetTrend[] = [];

  for (let i = 0; i < slice.length; i += concurrency) {
    const batch = slice.slice(i, i + concurrency);
    const items = await Promise.all(
      batch.map(async (id) => {
        try {
          const item = await fetchJson<any>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 18_000);
          const title = safeText(item?.title);
          const url = safeText(item?.url) || `https://news.ycombinator.com/item?id=${id}`;
          const score = Number(item?.score);
          return {
            id: `hn-${id}`,
            provider: "HackerNews" as const,
            title: title || `HN item ${id}`,
            url,
            description: safeText(item?.by) ? `by ${safeText(item?.by)}` : undefined,
            score: Number.isFinite(score) ? score : undefined,
            source: "web" as const,
            raw: { id, by: item?.by, descendants: item?.descendants, time: item?.time },
          } satisfies MarketInternetTrend;
        } catch {
          return null;
        }
      }),
    );
    for (const it of items) if (it) out.push(it);
  }

  return out.slice(0, limit);
}

async function fetchGitHubTrending(limit: number): Promise<MarketInternetTrend[]> {
  const html = await fetchText("https://github.com/trending?since=daily", 18_000);
  const articles = [...html.matchAll(/<article[^>]*class="Box-row[^"]*"[\s\S]*?<\/article>/g)].map((m) => m[0]);
  const out: MarketInternetTrend[] = [];

  for (const block of articles.slice(0, limit * 2)) {
    const hrefMatch = block.match(/<h2[^>]*>[\s\\S]*?<a[^>]*href="([^"]+)"[^>]*>/i);
    const href = hrefMatch ? hrefMatch[1] : "";
    if (!href.startsWith("/")) continue;
    const repo = href.slice(1).trim();
    if (!repo || !repo.includes("/")) continue;

    const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? stripTags(descMatch[1]) : undefined;

    const starsTodayMatch = block.match(/([0-9,.]+)\\s+stars\\s+today/i);
    const starsToday = starsTodayMatch ? Number(String(starsTodayMatch[1]).replace(/,/g, "")) : undefined;

    out.push({
      id: uniqId("gh", repo),
      provider: "GitHubTrending" as const,
      title: repo,
      url: `https://github.com/${repo}`,
      description,
      score: Number.isFinite(starsToday) ? starsToday : undefined,
      source: "web",
      raw: { repo, href },
    });

    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

function filterSources(input: unknown): InternetTrendSource[] {
  const raw = Array.isArray(input) ? input.map((s) => safeText(s).toLowerCase()) : [];
  const allowed: InternetTrendSource[] = ["hackernews", "github"];
  const picked = raw.filter((s): s is InternetTrendSource => (allowed as string[]).includes(s));
  if (picked.length) return picked.slice(0, 3);
  return allowed;
}

function titleForProvider(provider: MarketInternetTrendProvider): string {
  if (provider === "HackerNews") return "Hacker News";
  return "GitHub Trending";
}

export async function fetchInternetTrends(params: {
  limit?: number;
  sources?: unknown;
}): Promise<FetchResult> {
  const sources = filterSources(params.sources);
  const limit = clampInt(params.limit, 12, 3, 30);

  const cacheKey = `${sources.join(",")}|${limit}`;
  const existing = cache && cache.key === cacheKey && cache.expiresAt > nowMs() ? cache.value : null;
  if (existing) return existing;

  try {
    const buckets = await Promise.all(
      sources.map(async (source) => {
        if (source === "hackernews") return fetchHackerNewsTop(Math.ceil(limit / sources.length));
        if (source === "github") return fetchGitHubTrending(Math.ceil(limit / sources.length));
        return [] as MarketInternetTrend[];
      }),
    );

    const flat = buckets.flat().slice(0, limit);
    const result: FetchResult = { items: flat, source: "web" };
    cache = { key: cacheKey, expiresAt: nowMs() + 10 * 60 * 1000, value: result };
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Trend fetch failed";
    const mock: MarketInternetTrend[] = sources.map((s) => {
      const provider: MarketInternetTrendProvider = s === "github" ? "GitHubTrending" : "HackerNews";
      return {
        id: uniqId("mock", `${provider}-${nowMs()}`),
        provider,
        title: `${titleForProvider(provider)} trends (offline)`,
        url: provider === "GitHubTrending" ? "https://github.com/trending" : "https://news.ycombinator.com/",
        description: "Configure internet access / try again.",
        source: "mock",
      };
    });
    const result: FetchResult = { items: mock, source: "mock", error: message };
    cache = { key: cacheKey, expiresAt: nowMs() + 2 * 60 * 1000, value: result };
    return result;
  }
}

