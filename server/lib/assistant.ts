import { Type } from "@google/genai";
import type { AssistantPreferences, AssistantState, JourneyGoal, MarketRadarState, Project } from "../../types";
import { getGeminiClient } from "./gemini";
import { openRouterChat } from "./openrouter";
import { extractFirstJsonObject } from "./parseJson";

type AssistantToolCall = { name: string; args: Record<string, unknown> };

export type AssistantReply = {
  content: string;
  toolCall?: AssistantToolCall;
  preferencesPatch?: Partial<AssistantPreferences>;
};

function safeText(input: unknown): string {
  return String(input ?? "").trim();
}

function clampText(input: string, max: number): string {
  const s = String(input ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function redactLikelySecrets(text: string): string {
  const raw = String(text ?? "");
  const noBearer = raw.replace(/bearer\\s+[A-Za-z0-9_\\-\\.]{12,}/gi, "Bearer [REDACTED]");
  const noTokens = noBearer.replace(/[A-Za-z0-9_\\-\\.]{28,}/g, "[REDACTED]");
  return noTokens;
}

function pickModelFromEnv(): string {
  const explicit = safeText(process.env.ASSISTANT_MODEL);
  if (explicit) return explicit;
  const chairman = safeText(process.env.COUNCIL_CHAIRMAN_MODEL);
  if (chairman) return chairman;
  const first = safeText(process.env.COUNCIL_MODELS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || "google/gemini-2.5-flash";
}

function toolGuide(): Record<string, { description: string; args: Record<string, string> }> {
  return {
    "navigate.journey": {
      description: "Open Revenue Journey UI.",
      args: {},
    },
    "navigate.passiveHub": {
      description: "Open Passive Income Hub UI.",
      args: {},
    },
    "navigate.settings": {
      description: "Open Settings UI (Vault, integrations).",
      args: {},
    },
    "navigate.catalog": {
      description: "Open Workflow Catalog UI with a prefilled query.",
      args: { query: "string", requiredTags: "string[] (optional)" },
    },
    "agency.setGoal": {
      description: "Set the agency goal (affects Journey + docs).",
      args: { goal: "ai_agency | automation_agency | web_design_agency | ads_agency | youtube_systems" },
    },
    "agency.doc.generate": {
      description: "Generate and save a system document to the Agency archive.",
      args: { type: "RevenuePlan | Offer | SalesPath | OutboundPlaybook | YouTubeSystem | IncomeStack | PassiveIncome" },
    },
    "agency.revenueGoal.set": {
      description: "Set revenue goal numbers for the funnel calculator (MRR target + rates).",
      args: { currency: "USD|TRY|EUR|GBP", targetMrr: "number", avgRetainer: "number", closeRatePct: "0-100", bookingRatePct: "0-100" },
    },
    "outbound.leads.list": {
      description: "List saved outbound pipeline leads (AgencyOS internal).",
      args: {},
    },
    "outbound.lead.create": {
      description: "Save a lead into the outbound pipeline (AgencyOS internal).",
      args: { name: "string", category: "string (optional)", website: "string (optional)", phone: "string (optional)", country: "string (optional)", city: "string (optional)", stage: "OutboundStage (optional)" },
    },
    "outbound.lead.update": {
      description: "Update a lead in outbound pipeline (stage/follow-up/notes).",
      args: { id: "string", stage: "OutboundStage (optional)", nextFollowUpAt: "string (optional)", notes: "string (optional)" },
    },
    "outbound.autopilot.seed": {
      description: "Autopilot: find local leads and save top N into outbound pipeline (uses Market Radar lead search).",
      args: { country: "string", city: "string", query: "string", saveCount: "number (1-30)", limit: "number (optional)" },
    },
    "catalog.search": {
      description: "Search n8n workflow library (offline index) with keywords.",
      args: { query: "string", limit: "number (1-10)", requiredTags: "string[] (optional)" },
    },
    "market.opportunities": {
      description: "Generate sellable opportunities for a niche/geo.",
      args: { goal: "JourneyGoal", country: "string", city: "string", niche: "string (optional)" },
    },
    "market.youtube.trends": {
      description: "Fetch YouTube trends (Apify if configured, else samples).",
      args: { country: "string", limit: "number (3-20)" },
    },
    "market.internet.trends": {
      description: "Fetch internet trends (Hacker News + GitHub Trending).",
      args: { sources: "string[] (optional: hackernews|github)", limit: "number (3-30)" },
    },
    "market.youtube.ideas": {
      description: "Generate YouTube video ideas (uses AI; can ground on trends).",
      args: { goal: "JourneyGoal", country: "string", niche: "string", count: "number (3-20)" },
    },
    "market.leads.search": {
      description: "Find local leads (Apify if configured, else samples).",
      args: { country: "string", city: "string", query: "string", limit: "number (5-30)" },
    },
    "market.leads.pitch": {
      description: "Generate outreach pitch for a lead + offer.",
      args: { goal: "JourneyGoal", leadName: "string", category: "string (optional)", website: "string (optional)", offer: "string (optional)" },
    },
    "passive.ideas.list": {
      description: "List Passive Income Hub ideas (id + title).",
      args: {},
    },
    "passive.plan.generate": {
      description: "Generate a passive income plan doc for an idea (saves to Archive).",
      args: { ideaId: "string", goal: "JourneyGoal (optional)" },
    },
    "passive.asset.generate": {
      description: "Generate a specific asset doc for an idea (saves to Archive).",
      args: { ideaId: "string", assetIndex: "number", goal: "JourneyGoal (optional)" },
    },
    "assistant.preferences.patch": {
      description: "Persist user preferences for personalization.",
      args: {
        language: "tr|en (optional)",
        goal: "JourneyGoal (optional)",
        country: "string (optional)",
        city: "string (optional)",
        niche: "string (optional)",
        incomeFocus: "['ai_agency'|'youtube'|'passive'] (optional)",
      },
    },
  };
}

function summarizeProjects(projects: Project[]): Array<{ id: string; client: string; status: string; workflows: number; billed: number }> {
  return projects.slice(0, 10).map((p) => ({
    id: p.id,
    client: p.brief.clientName,
    status: p.status,
    workflows: p.activeWorkflows?.length ?? 0,
    billed: p.totalBilled ?? 0,
  }));
}

function buildPrompt(params: {
  language: "tr" | "en";
  query: string;
  state: AssistantState;
  agency: {
    goal: JourneyGoal;
    documents: number;
    completedTasks: number;
    revenueGoal?: { currency: string; targetMrr: number; avgRetainer: number; closeRatePct: number; bookingRatePct: number };
  };
  market?: MarketRadarState | null;
  projects: Project[];
}): { system: string; user: string; history: Array<{ role: "system" | "user" | "assistant"; content: string }> } {
  const { language, query, state, agency, market, projects } = params;

  const pref = state.preferences ?? {};
  const ctx = {
    agency: { goal: agency.goal, documents: agency.documents, completedTasks: agency.completedTasks, revenueGoal: agency.revenueGoal ?? null },
    market: market
      ? {
          country: market.country,
          city: market.city,
          niche: market.niche,
          opportunities: (market.opportunities ?? []).slice(0, 3).map((o) => ({
            niche: o.niche,
            offer: o.offer,
            query: o.suggestedCatalogQuery,
          })),
        }
      : null,
    projects: summarizeProjects(projects),
    config: {
      hasGemini: Boolean(safeText(process.env.GEMINI_API_KEY)),
      hasOpenRouter: Boolean(safeText(process.env.OPENROUTER_API_KEY)),
      hasN8n: Boolean(safeText(process.env.N8N_API_KEY)),
      hasApify: Boolean(safeText(process.env.APIFY_API_TOKEN)),
      hasDatabase: Boolean(safeText(process.env.AGENCYOS_DATABASE_URL)),
    },
    preferences: pref,
  };

  const system = [
    language === "tr" ? "Türkçe yaz." : "Write in English.",
    "You are the AgencyOS Global Assistant. You help a non-technical user build an income engine: AI agency + YouTube + passive income.",
    "Be practical, step-by-step, and keep it simple. Ask at most 1 clarifying question when necessary.",
    "Never request secrets. If user wants integrations, instruct them to use Settings → Vault.",
    "You can optionally request ONE tool call to execute an action. Tool call is optional.",
    "If user explicitly confirms new preferences (goal/country/city/niche/income focus), include preferencesPatch to persist them. Otherwise omit it.",
    "",
    `Tool guide (JSON): ${JSON.stringify(toolGuide())}`,
    "",
    `Current context (JSON, redacted): ${JSON.stringify(ctx)}`,
    "",
    "Output MUST be valid JSON only (no markdown). Schema:",
    '{ "content": "string", "toolCall": { "name": "string", "args": {} }?, "preferencesPatch": {}? }',
  ].join("\n");

  const history = (state.messages ?? [])
    .slice(-14)
    .map((m) => ({
      role: m.role === "system" ? ("system" as const) : m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: clampText(redactLikelySecrets(m.content), 1200),
    }))
    .filter((m) => m.content.length > 0);

  const user = clampText(redactLikelySecrets(query), 2500);
  return { system, user, history };
}

export async function generateAssistantReply(params: {
  query: string;
  language: "tr" | "en";
  state: AssistantState;
  agency: {
    goal: JourneyGoal;
    documents: number;
    completedTasks: number;
    revenueGoal?: { currency: string; targetMrr: number; avgRetainer: number; closeRatePct: number; bookingRatePct: number };
  };
  market?: MarketRadarState | null;
  projects: Project[];
}): Promise<AssistantReply> {
  const built = buildPrompt(params);
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  const ai = getGeminiClient();

  if (openRouterKey) {
    const model = pickModelFromEnv();
    const raw = await openRouterChat({
      apiKey: openRouterKey,
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: built.system },
        ...built.history,
        { role: "user", content: built.user },
      ],
    });
    const parsed = extractFirstJsonObject<AssistantReply>(raw);
    if (parsed && typeof parsed.content === "string" && parsed.content.trim()) {
      return {
        content: parsed.content.trim(),
        toolCall: parsed.toolCall && safeText(parsed.toolCall.name) ? { name: safeText(parsed.toolCall.name), args: (parsed.toolCall.args ?? {}) as any } : undefined,
        preferencesPatch: parsed.preferencesPatch && typeof parsed.preferencesPatch === "object" ? (parsed.preferencesPatch as any) : undefined,
      };
    }
    return { content: clampText(raw, 1800) };
  }

  if (ai) {
    const historyBlock = built.history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");
    const prompt = `${built.system}\n\nConversation (most recent):\n${historyBlock}\n\nUSER:\n${built.user}`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            toolCall: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                args: { type: Type.OBJECT },
              },
            },
            preferencesPatch: { type: Type.OBJECT },
          },
          required: ["content"],
        },
      },
    });

    try {
      const parsed = JSON.parse(response.text || "{}") as AssistantReply;
      if (typeof parsed.content === "string" && parsed.content.trim()) {
        return {
          content: parsed.content.trim(),
          toolCall: parsed.toolCall && safeText((parsed.toolCall as any).name) ? { name: safeText((parsed.toolCall as any).name), args: ((parsed.toolCall as any).args ?? {}) as any } : undefined,
          preferencesPatch: parsed.preferencesPatch && typeof parsed.preferencesPatch === "object" ? (parsed.preferencesPatch as any) : undefined,
        };
      }
    } catch {
      // fall through
    }
  }

  return {
    content:
      params.language === "tr"
        ? "Global Assistant offline. Settings → Vault’tan `OPENROUTER_API_KEY` veya `GEMINI_API_KEY` ekle, sonra tekrar dene."
        : "Global Assistant is offline. Add `OPENROUTER_API_KEY` or `GEMINI_API_KEY` in Settings → Vault and try again.",
  };
}
