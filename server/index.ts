import cors from "cors";
import express from "express";
import * as dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

import type { AssistantPreferences, Project, ProjectDocument, Workflow } from "../types";

const serverEnvPath = path.resolve(process.cwd(), "server/.env");
if (fs.existsSync(serverEnvPath)) dotenv.config({ path: serverEnvPath });
else dotenv.config();

import { schemas, getGeminiClient } from "./lib/gemini";
import { buildInstallPlan, getCatalogIndex, readWorkflowJsonById, resetCatalogIndexCache, searchCatalog } from "./lib/catalog";
import { openRouterChat } from "./lib/openrouter";
import { extractFirstJsonObject } from "./lib/parseJson";
import { readJsonFile, writeJsonFile } from "./lib/storage";
import { createProject, getProject, listProjects, saveProject } from "./lib/projects";
import { activateWorkflow, createWorkflow, deactivateWorkflow, getN8nConfig, listExecutions, listWorkflows, updateWorkflow } from "./lib/n8n";
import { pingUrl, probeUrl } from "./lib/ping";
import { calculateAggregateRankings, parseRankingFromText } from "./lib/councilRank";
import {
  deleteSecret,
  hydrateProcessEnvFromDisk,
  listSecretsRedacted,
  readSecrets,
  readRuntimeSettings,
  updateRuntimeSettings,
  upsertSecret,
} from "./lib/runtimeStore";
import { generateAssistantReply } from "./lib/assistant";
import { appendAssistantMessage, patchAssistantPreferences, readAssistantState, resetAssistantState } from "./lib/assistantStore";
import { pgHealthcheck, redactDatabaseUrl } from "./lib/postgres";
import {
  getInvoiceShelfAuth,
  invoiceShelfCreateCustomer,
  invoiceShelfCreateInvoice,
  invoiceShelfGetInvoice,
  invoiceShelfGetInvoiceTemplates,
  invoiceShelfGetNextInvoiceNumber,
  invoiceShelfLogin,
} from "./lib/invoiceshelf";
import { getSuiteCrmCredentials, suiteCrmCreateLead, suiteCrmListLeads, suiteCrmLogin } from "./lib/suitecrm";
import {
  analyzeStrategicPivot,
  generateAgencyDocument,
  generateExecutiveSummary,
  generateProposal,
  generateSow,
  generateStrategicAdvice,
  getOperatorResponse,
} from "./lib/ai";
import { addAgencyDocument, patchAgencyState, readAgencyState } from "./lib/agency";
import {
  documensoGenerateDocumentFromTemplate,
  documensoGetDocument,
  documensoGetTemplate,
  documensoListDocuments,
  documensoListTemplates,
  documensoMe,
  documensoSendDocument,
} from "./lib/documenso";
import { infisicalListSecretsRaw, infisicalUpsertSecretRaw } from "./lib/infisical";
import { seedDemoProjects } from "./lib/demo";
import { rewriteCatalogQueryFallback } from "./lib/queryRewrite";
import {
  getApifyMarketStatus,
  marketFetchYouTubeTrends,
  marketGenerateLeadPitch,
  marketGenerateOpportunities,
  marketGenerateYouTubeIdeas,
  marketSearchLeads,
  patchMarketRadarState,
  readMarketRadarState,
} from "./lib/marketRadar";
import { generatePassiveAsset, generatePassiveIdeaPlan, getPassiveIdeaById, listPassiveIdeas } from "./lib/passiveIncome";
import { fetchInternetTrends } from "./lib/internetTrends";
import { createOutboundLead, deleteOutboundLead, listOutboundLeads, updateOutboundLead } from "./lib/outbound";

type CouncilGate = "Strategic" | "Risk" | "Launch" | "Post-Mortem";
type CouncilDecision = "Approved" | "Rejected" | "Needs Revision";

type CouncilOpinion = {
  persona: string;
  role: string;
  opinion: string;
  score: number;
};

type CouncilPricingCadence = "One-Time" | "Monthly" | "Usage";

type CouncilPricing = {
  currency: string;
  lineItems: Array<{ label: string; amount: number; cadence: CouncilPricingCadence; notes?: string }>;
  totalOneTime?: number;
  totalMonthly?: number;
  totalFirstMonth?: number;
  assumptions?: string[];
};

type CouncilSession = {
  id: string;
  projectId: string;
  gateType: CouncilGate;
  topic: string;
  opinions: CouncilOpinion[];
  synthesis: string;
  decision: CouncilDecision;
  pricing?: CouncilPricing;
  language?: "tr" | "en";
  boardName?: string;
  currentStage?: { id: Project["status"]; label: string };
  boardSummary?: string;
  nextSteps?: string[];
  moneySteps?: string[];
  workflowSuggestions?: Array<{
    workflow: {
      id: string;
      name: string;
      description: string;
      tags: string[];
      jsonUrl: string;
      complexity: "Low" | "Medium" | "High";
      credentials: string[];
    };
    score: number;
    installPlan: { credentialChecklist: string[]; installSteps: string[]; testSteps: string[]; riskNotes: string[] };
    reason?: string;
  }>;
  suggestedCatalogQuery?: { query: string; requiredTags?: string[] };
  modelOutputs?: Array<{ model: string; content: string }>;
  chairmanModel?: string;
  stage2Rankings?: Array<{ model: string; content: string; parsedRanking: string[] }>;
  labelToModel?: Record<string, string>;
  aggregateRankings?: Array<{ model: string; averageRank: number; rankingsCount: number }>;
  createdAt: string;
};

await hydrateProcessEnvFromDisk();

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

async function patchAssistantPreferencesBestEffort(
  patch: Partial<AssistantPreferences>,
  opts?: { addIncomeFocus?: "ai_agency" | "youtube" | "passive" },
): Promise<void> {
  try {
    const nextPatch: Partial<AssistantPreferences> = {};
    if (patch.language === "tr" || patch.language === "en") nextPatch.language = patch.language;
    if (patch.goal) nextPatch.goal = patch.goal;
    if (typeof patch.country === "string" && patch.country.trim()) nextPatch.country = patch.country.trim();
    if (typeof patch.city === "string" && patch.city.trim()) nextPatch.city = patch.city.trim();
    if (typeof patch.niche === "string" && patch.niche.trim()) nextPatch.niche = patch.niche.trim();

    const focusToAdd = opts?.addIncomeFocus;
    if (focusToAdd) {
      const current = await readAssistantState();
      const existing = Array.isArray(current.preferences?.incomeFocus) ? current.preferences.incomeFocus : [];
      const merged = [...new Set([...existing, focusToAdd])].slice(0, 3);
      nextPatch.incomeFocus = merged;
    } else if (Array.isArray(patch.incomeFocus) && patch.incomeFocus.length) {
      nextPatch.incomeFocus = patch.incomeFocus as any;
    }

    if (!Object.keys(nextPatch).length) return;
    await patchAssistantPreferences(nextPatch);
  } catch {
    // never break primary flows due to assistant persistence
  }
}

function pickOpenRouterModel(): string {
  const assistant = String(process.env.ASSISTANT_MODEL ?? "").trim();
  if (assistant) return assistant;
  const chairman = String(process.env.COUNCIL_CHAIRMAN_MODEL ?? "").trim();
  if (chairman) return chairman;
  const first = String(process.env.COUNCIL_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || "openai/gpt-5-mini";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/meta", (req, res) => {
  const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"] : undefined;
  const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : req.protocol;
  const host = req.get("host") || `localhost:${process.env.AGENCYOS_API_PORT ?? 7000}`;
  res.json({ apiBaseUrl: `${proto}://${host}` });
});

app.get("/api/assistant/state", async (_req, res) => {
  const state = await readAssistantState();
  res.json(state);
});

app.post("/api/assistant/reset", async (_req, res) => {
  const state = await resetAssistantState();
  res.json(state);
});

app.put("/api/assistant/preferences", async (req, res) => {
  try {
    const patch = typeof req.body === "object" && req.body ? req.body : {};
    const next = await patchAssistantPreferences(patch);
    res.json(next);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid preferences payload" });
  }
});

app.post("/api/assistant/respond", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "Missing message" });

  const language = req.body?.language === "en" ? "en" : "tr";

  const before = await readAssistantState();
  await appendAssistantMessage({ id: `msg-${Date.now()}`, role: "user", content: message });

  const agencyState = await readAgencyState();
  const market = await readMarketRadarState();
  const projects = await listProjects();

  try {
    const reply = await generateAssistantReply({
      query: message,
      language: language,
      state: before,
      agency: {
        goal: agencyState.goal,
        documents: agencyState.documents.length,
        completedTasks: agencyState.completedTaskIds.length,
        revenueGoal: agencyState.revenueGoal,
      },
      market,
      projects,
    });

    if (reply.preferencesPatch) {
      await patchAssistantPreferences(reply.preferencesPatch);
    }

    await appendAssistantMessage({
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: reply.content,
      toolCall: reply.toolCall,
    });

    const state = await readAssistantState();
    res.json({ state, reply });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Assistant request failed";
    await appendAssistantMessage({ id: `msg-${Date.now() + 1}`, role: "assistant", content: `Error: ${errMsg}` });
    res.status(502).json({ error: errMsg });
  }
});

app.post("/api/assistant/log", async (req, res) => {
  try {
    const roleRaw = String(req.body?.role ?? "system").trim();
    const role = roleRaw === "user" || roleRaw === "assistant" || roleRaw === "system" ? (roleRaw as any) : "system";
    const content = String(req.body?.content ?? "").trim();
    if (!content) return res.status(400).json({ error: "Missing content" });
    const toolCall = req.body?.toolCall && typeof req.body.toolCall === "object" ? req.body.toolCall : undefined;
    const state = await appendAssistantMessage({
      id: `msg-${Date.now()}`,
      role,
      content: content.slice(0, 12_000),
      toolCall: toolCall?.name ? { name: String(toolCall.name), args: typeof toolCall.args === "object" && toolCall.args ? toolCall.args : {} } : undefined,
    });
    res.json(state);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid log payload" });
  }
});

app.get("/api/agency", async (_req, res) => {
  const state = await readAgencyState();
  res.json(state);
});

app.put("/api/agency", async (req, res) => {
  try {
    const patch = typeof req.body === "object" && req.body ? req.body : {};
    const next = await patchAgencyState({
      goal: patch.goal,
      completedTaskIds: patch.completedTaskIds,
      revenueGoal: patch.revenueGoal,
    });
    await patchAssistantPreferencesBestEffort({ goal: next.goal });
    res.json(next);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid agency payload" });
  }
});

app.post("/api/agency/docs/generate", async (req, res) => {
  const type = String(req.body?.type ?? "").trim();
  const allowed = new Set(["RevenuePlan", "Offer", "SalesPath", "OutboundPlaybook", "YouTubeSystem", "IncomeStack", "PassiveIncome"]);
  if (!allowed.has(type)) return res.status(400).json({ error: "Invalid document type" });
  const markTaskId = String(req.body?.markTaskId ?? "").trim();

  const state = await readAgencyState();
  const market = await readMarketRadarState();
  const content = await generateAgencyDocument({ type: type as any, goal: state.goal as any, market });
  const name =
    type === "RevenuePlan"
      ? `Gelir Planı — ${state.goal}`
      : type === "Offer"
        ? `Hizmet Paketleri — ${state.goal}`
        : type === "SalesPath"
          ? `Satış Yolu — ${state.goal}`
          : type === "OutboundPlaybook"
            ? `Outbound Playbook — ${state.goal}`
          : type === "YouTubeSystem"
            ? `YouTube Sistemleri — ${state.goal}`
            : type === "IncomeStack"
              ? `Gelir Stack’i — ${state.goal}`
              : `Pasif Gelir — ${state.goal}`;

  let next = await addAgencyDocument({ type: type as any, name, content });
  if (markTaskId) {
    next = await patchAgencyState({ completedTaskIds: [...next.completedTaskIds, markTaskId] });
  }
  res.json({ agency: next, document: next.documents[0] ?? null });
});

app.get("/api/market/state", async (_req, res) => {
  const state = await readMarketRadarState();
  const apify = getApifyMarketStatus();
  res.json({ state, apify });
});

app.post("/api/market/opportunities", async (req, res) => {
  const goal = String(req.body?.goal ?? "").trim();
  const allowedGoals = new Set(["ai_agency", "automation_agency", "web_design_agency", "ads_agency", "youtube_systems"]);
  if (!allowedGoals.has(goal)) return res.status(400).json({ error: "Invalid goal" });

  const country = String(req.body?.country ?? "").trim();
  const city = String(req.body?.city ?? "").trim();
  const niche = String(req.body?.niche ?? "").trim();
  const language = req.body?.language === "en" ? "en" : "tr";
  const count = Number(req.body?.count ?? 6);

  const out = await marketGenerateOpportunities({ goal: goal as any, country, city, niche, language, count });
  const state = await patchMarketRadarState({
    country: country || undefined,
    city: city || undefined,
    niche: niche || undefined,
    opportunities: out.items,
  });
  await patchAssistantPreferencesBestEffort({ goal: goal as any, country, city, niche });
  res.json({ ...out, state });
});

app.post("/api/market/youtube/trends", async (req, res) => {
  const country = String(req.body?.country ?? "").trim();
  const language = req.body?.language === "en" ? "en" : "tr";
  const limit = Number(req.body?.limit ?? 12);
  const out = await marketFetchYouTubeTrends({ country, language, limit });
  const state = await patchMarketRadarState({ country: country || undefined, youtubeTrends: out.items });
  await patchAssistantPreferencesBestEffort({ country }, { addIncomeFocus: "youtube" });
  res.json({ ...out, state });
});

app.post("/api/market/youtube/ideas", async (req, res) => {
  const goal = String(req.body?.goal ?? "").trim();
  const allowedGoals = new Set(["ai_agency", "automation_agency", "web_design_agency", "ads_agency", "youtube_systems"]);
  if (!allowedGoals.has(goal)) return res.status(400).json({ error: "Invalid goal" });

  const country = String(req.body?.country ?? "").trim();
  const niche = String(req.body?.niche ?? "").trim();
  const language = req.body?.language === "en" ? "en" : "tr";
  const count = Number(req.body?.count ?? 12);
  const trends = Array.isArray(req.body?.trends) ? req.body.trends : undefined;

  const out = await marketGenerateYouTubeIdeas({
    goal: goal as any,
    country,
    niche,
    language,
    trends,
    count,
  });

  const state = await patchMarketRadarState({
    country: country || undefined,
    niche: niche || undefined,
    youtubeIdeas: out.items,
  });
  await patchAssistantPreferencesBestEffort({ goal: goal as any, country, niche }, { addIncomeFocus: "youtube" });
  res.json({ ...out, state });
});

app.post("/api/market/internet/trends", async (req, res) => {
  const limit = Number(req.body?.limit ?? 12);
  const sources = req.body?.sources;

  const out = await fetchInternetTrends({ limit, sources });
  const state = await patchMarketRadarState({ internetTrends: out.items });
  res.json({ ...out, state });
});

app.post("/api/market/leads/search", async (req, res) => {
  const country = String(req.body?.country ?? "").trim();
  const city = String(req.body?.city ?? "").trim();
  const query = String(req.body?.query ?? "").trim();
  const language = req.body?.language === "en" ? "en" : "tr";
  const limit = Number(req.body?.limit ?? 15);

  const out = await marketSearchLeads({ country, city, query, language, limit });
  const state = await patchMarketRadarState({
    country: country || undefined,
    city: city || undefined,
    niche: query || undefined,
    leads: out.items,
  });
  await patchAssistantPreferencesBestEffort({ country, city, niche: query }, { addIncomeFocus: "ai_agency" });
  res.json({ ...out, state });
});

app.post("/api/market/leads/pitch", async (req, res) => {
  const goal = String(req.body?.goal ?? "").trim();
  const allowedGoals = new Set(["ai_agency", "automation_agency", "web_design_agency", "ads_agency", "youtube_systems"]);
  if (!allowedGoals.has(goal)) return res.status(400).json({ error: "Invalid goal" });

  const language = req.body?.language === "en" ? "en" : "tr";
  const lead = typeof req.body?.lead === "object" && req.body.lead ? req.body.lead : null;
  if (!lead) return res.status(400).json({ error: "Missing lead" });
  if (!String(lead?.name ?? "").trim()) return res.status(400).json({ error: "Lead missing name" });
  const opportunity = typeof req.body?.opportunity === "object" && req.body.opportunity ? req.body.opportunity : null;

  try {
    const pitch = await marketGenerateLeadPitch({
      goal: goal as any,
      language,
      lead,
      opportunity,
    });
    res.json(pitch);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Pitch generation failed" });
  }
});

app.get("/api/outbound/leads", async (_req, res) => {
  const items = await listOutboundLeads();
  res.json({ items });
});

app.post("/api/outbound/leads", async (req, res) => {
  try {
    const lead = await createOutboundLead(req.body);
    res.json({ lead });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid lead payload" });
  }
});

app.put("/api/outbound/leads/:id", async (req, res) => {
  try {
    const lead = await updateOutboundLead(String(req.params.id ?? ""), req.body);
    res.json({ lead });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid lead patch" });
  }
});

app.delete("/api/outbound/leads/:id", async (req, res) => {
  try {
    const out = await deleteOutboundLead(String(req.params.id ?? ""));
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid lead delete" });
  }
});

app.get("/api/passive/ideas", async (_req, res) => {
  res.json({ ideas: listPassiveIdeas() });
});

app.post("/api/passive/plan", async (req, res) => {
  const ideaId = String(req.body?.ideaId ?? "").trim();
  if (!ideaId) return res.status(400).json({ error: "Missing ideaId" });
  const idea = getPassiveIdeaById(ideaId);
  if (!idea) return res.status(404).json({ error: "Idea not found" });

  const language = req.body?.language === "en" ? "en" : "tr";

  const state = await readAgencyState();
  const goalRaw = String(req.body?.goal ?? state.goal).trim();
  const allowedGoals = new Set(["ai_agency", "automation_agency", "web_design_agency", "ads_agency", "youtube_systems"]);
  const goal = allowedGoals.has(goalRaw) ? (goalRaw as any) : state.goal;

  try {
    const market = await readMarketRadarState();
    const content = await generatePassiveIdeaPlan({ idea, goal, language, market });
    const name = language === "tr" ? `Pasif Gelir Planı — ${idea.title.tr}` : `Passive Income Plan — ${idea.title.en}`;
    const next = await addAgencyDocument({ type: "PassiveIncome", name, content });
    await patchAssistantPreferencesBestEffort({ goal, language }, { addIncomeFocus: "passive" });
    res.json({ agency: next, document: next.documents[0] ?? null, ideaId });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Passive plan generation failed" });
  }
});

app.post("/api/passive/asset", async (req, res) => {
  const ideaId = String(req.body?.ideaId ?? "").trim();
  if (!ideaId) return res.status(400).json({ error: "Missing ideaId" });
  const idea = getPassiveIdeaById(ideaId);
  if (!idea) return res.status(404).json({ error: "Idea not found" });

  const assetIndex = Number(req.body?.assetIndex ?? NaN);
  if (!Number.isFinite(assetIndex)) return res.status(400).json({ error: "Missing/invalid assetIndex" });
  const idx = Math.max(0, Math.min(idea.assets.length - 1, Math.floor(assetIndex)));
  const language = req.body?.language === "en" ? "en" : "tr";

  const state = await readAgencyState();
  const goalRaw = String(req.body?.goal ?? state.goal).trim();
  const allowedGoals = new Set(["ai_agency", "automation_agency", "web_design_agency", "ads_agency", "youtube_systems"]);
  const goal = allowedGoals.has(goalRaw) ? (goalRaw as any) : state.goal;

  try {
    const market = await readMarketRadarState();
    const assetTitle = idea.assets[idx]?.[language] ?? idea.assets[idx]?.en ?? `Asset ${idx + 1}`;
    const content = await generatePassiveAsset({ idea, goal, language, market, assetTitle });
    const name =
      language === "tr"
        ? `Asset — ${assetTitle} — ${idea.title.tr}`
        : `Asset — ${assetTitle} — ${idea.title.en}`;
    const next = await addAgencyDocument({ type: "PassiveIncome", name, content });
    await patchAssistantPreferencesBestEffort({ goal, language }, { addIncomeFocus: "passive" });
    res.json({ agency: next, document: next.documents[0] ?? null, ideaId, assetIndex: idx });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Passive asset generation failed" });
  }
});

app.get("/api/settings", async (_req, res) => {
  const settings = await readRuntimeSettings();
  res.json(settings);
});

app.put("/api/settings", async (req, res) => {
  try {
    const patch = typeof req.body === "object" && req.body ? req.body : {};
    const settings = await updateRuntimeSettings(patch);
    res.json(settings);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid settings payload" });
  }
});

app.get("/api/secrets", async (_req, res) => {
  const secrets = await listSecretsRedacted();
  res.json(secrets);
});

app.put("/api/secrets", async (req, res) => {
  try {
    const id = req.body?.id ? String(req.body.id) : undefined;
    const key = String(req.body?.key ?? "");
    const value = String(req.body?.value ?? "");
    const environment = String(req.body?.environment ?? "Production") as any;
    const saved = await upsertSecret({ id, key, value, environment });
    res.json(saved);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid secret payload" });
  }
});

app.delete("/api/secrets/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing secret id" });
  await deleteSecret(id);
  res.json({ ok: true });
});

app.get("/api/ai/executive-summary", async (_req, res) => {
  try {
    const projects = await listProjects();
    const text = await generateExecutiveSummary(projects);
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.post("/api/ai/strategic-advice", async (req, res) => {
  const projectId = String(req.body?.projectId ?? "");
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const text = await generateStrategicAdvice(project);
  res.json({ text });
});

app.post("/api/ai/pivot-analysis", async (req, res) => {
  const projectId = String(req.body?.projectId ?? "");
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const analysis = await analyzeStrategicPivot(project);
  res.json(analysis);
});

app.post("/api/ai/proposal", async (req, res) => {
  const projectId = String(req.body?.projectId ?? "");
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const text = await generateProposal(project.brief);
  res.json({ text });
});

app.post("/api/ai/sow", async (req, res) => {
  const projectId = String(req.body?.projectId ?? "");
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const text = await generateSow(project);
  res.json({ text });
});

app.post("/api/operator/respond", async (req, res) => {
  const projectId = String(req.body?.projectId ?? "");
  const query = String(req.body?.query ?? "");
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });
  if (!query.trim()) return res.status(400).json({ error: "Missing query" });
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const answer = await getOperatorResponse(query, project);
  res.json(answer);
});

app.get("/api/integrations/n8n", async (_req, res) => {
  const cfg = getN8nConfig();
  if (!cfg) {
    const baseUrl = String(process.env.N8N_BASE_URL ?? "http://localhost:5678").replace(/\/+$/, "");
    const ping = await probeUrl(`${baseUrl}/healthz`);
    return res.json({
      connected: false,
      baseUrl,
      reason: ping.ok ? "Missing N8N_API_KEY" : `n8n unreachable: ${ping.reason ?? "unknown"}`,
    });
  }

  try {
    const workflows = await listWorkflows({ limit: 1 });
    return res.json({
      connected: true,
      baseUrl: cfg.baseUrl,
      sample: workflows.data?.[0] ?? null,
    });
  } catch (e) {
    return res.json({
      connected: false,
      baseUrl: cfg.baseUrl,
      reason: e instanceof Error ? e.message : "n8n request failed",
    });
  }
});

app.get("/api/integrations/documenso/me", async (_req, res) => {
  try {
    const me = await documensoMe();
    res.json(me);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Documenso request failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.get("/api/integrations/documenso/templates", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const perPage = Number(req.query.perPage ?? 25);
  try {
    const data = await documensoListTemplates({ page, perPage });
    res.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Documenso request failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.get("/api/integrations/documenso/templates/:id", async (req, res) => {
  const templateId = Number(req.params.id);
  if (!Number.isFinite(templateId)) return res.status(400).json({ error: "Invalid template id" });
  try {
    const template = await documensoGetTemplate(templateId);
    res.json(template);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Documenso request failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.get("/api/integrations/documenso/documents", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const perPage = Number(req.query.perPage ?? 10);
  try {
    const data = await documensoListDocuments({ page, perPage });
    res.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Documenso request failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.post("/api/projects/:id/contracts/documenso/send", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const templateId = Number(req.body?.templateId ?? NaN);
  if (!Number.isFinite(templateId)) return res.status(400).json({ error: "Missing/invalid templateId" });

  const rawRecipients = Array.isArray(req.body?.recipients) ? req.body.recipients : null;
  const recipients: Array<{ name: string; email: string }> = rawRecipients
    ? rawRecipients
        .map((r: any) => ({ name: String(r?.name ?? "").trim(), email: String(r?.email ?? "").trim() }))
        .filter((r: any) => r.email.length > 0)
    : [];

  if (recipients.length === 0) return res.status(400).json({ error: "Missing recipients" });

  const title = String(req.body?.title ?? `${project.brief.clientName} — Contract`).trim();
  const sendEmail = req.body?.sendEmail === false ? false : true;
  const subject = String(req.body?.subject ?? `Contract for ${project.brief.clientName}`).trim();
  const message = String(req.body?.message ?? "Please review and sign.").trim();
  const redirectUrlRaw = String(req.body?.redirectUrl ?? "").trim();
  const redirectUrl = redirectUrlRaw.length > 0 ? redirectUrlRaw : undefined;

  try {
    const template = await documensoGetTemplate(templateId);
    const templateRecipients = Array.isArray(template?.Recipient) ? template.Recipient : [];
    if (templateRecipients.length === 0) return res.status(400).json({ error: "Selected template has no recipients" });
    if (templateRecipients.length !== recipients.length) {
      return res.status(400).json({
        error: `Recipient count mismatch. Template expects ${templateRecipients.length}, got ${recipients.length}.`,
        expected: templateRecipients.map((r) => ({ id: r.id, name: r.name, email: r.email })),
      });
    }

    const created = await documensoGenerateDocumentFromTemplate({
      templateId,
      title,
      recipients: templateRecipients.map((r, i) => ({
        id: r.id,
        email: recipients[i].email,
        name: recipients[i].name || r.name,
        signingOrder: typeof r.signingOrder === "number" ? r.signingOrder : undefined,
      })),
      meta: { subject, message, redirectUrl },
    });

    await documensoSendDocument({ documentId: created.documentId, sendEmail });

    const signingLinks = created.recipients?.map((r) => `- ${r.email}: ${r.signingUrl}`).join("\n") ?? "";
    const doc: ProjectDocument = {
      id: `doc-${Date.now()}`,
      name: `Contract: ${project.brief.clientName}`,
      type: "Contract" as const,
      status: "Sent" as const,
      content: `Documenso document created and sent.\nDocument ID: ${created.documentId}\nTemplate: ${template.title}\n\nSigning links:\n${signingLinks}`,
      url: String(created.recipients?.[0]?.signingUrl ?? "#"),
      externalRef: {
        provider: "documenso",
        id: String(created.documentId),
        url: String(created.recipients?.[0]?.signingUrl ?? "#"),
        meta: { templateId, templateTitle: template.title },
      },
      createdAt: new Date().toISOString(),
    };

    const updated: Project = {
      ...project,
      documents: [doc, ...project.documents],
      crmActivities: [
        {
          id: `crm-${Date.now()}`,
          type: "Note",
          subject: `Contract sent via Documenso (doc ${created.documentId})`,
          status: "Completed",
          timestamp: new Date().toISOString(),
        },
        ...project.crmActivities,
      ],
    };

    const saved = await saveProject(updated);
    res.json({ project: saved, documenso: { documentId: created.documentId, recipients: created.recipients } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Documenso send failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.post("/api/projects/:id/contracts/documenso/sync", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const parseDocumensoId = (doc: any): number | null => {
    const fromRef =
      doc?.externalRef?.provider === "documenso" ? Number(doc.externalRef.id) : null;
    if (fromRef && Number.isFinite(fromRef)) return fromRef;
    const content = typeof doc?.content === "string" ? doc.content : "";
    const m = content.match(/Document ID:\\s*(\\d+)/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const changes: Array<{ documentId: string; documensoId: number; from: string; to: string }> = [];
  const errors: Array<{ documensoId: number; error: string }> = [];

  const nextDocs = project.documents.map((doc) => ({ ...doc }));
  const now = new Date().toISOString();
  let nextActivities = [...project.crmActivities];

  for (let i = 0; i < nextDocs.length; i += 1) {
    const doc = nextDocs[i];
    if (doc.type !== "Contract") continue;

    const documensoId = parseDocumensoId(doc);
    if (!documensoId) continue;

    try {
      const remote = await documensoGetDocument(documensoId);
      const remoteStatus = String(remote?.status ?? "").toUpperCase();
      const completedAt = remote?.completedAt ?? null;
      const recipients = Array.isArray(remote?.recipients) ? remote.recipients : [];
      const allSigned =
        recipients.length > 0 &&
        recipients.every((r: any) => Boolean(r?.signedAt) || String(r?.signingStatus ?? "").toUpperCase().includes("SIGNED"));

      const isSigned = Boolean(completedAt) || remoteStatus.includes("COMPLETED") || remoteStatus.includes("SIGNED") || allSigned;
      const nextStatus = isSigned ? "Signed" : "Sent";

      if (doc.status !== nextStatus) {
        changes.push({ documentId: String(doc.id), documensoId, from: String(doc.status), to: nextStatus });
        if (nextStatus === "Signed") {
          nextActivities = [
            {
              id: `crm-${Date.now()}`,
              type: "Status Change",
              subject: `Contract signed in Documenso (doc ${documensoId})`,
              status: "Completed",
              timestamp: now,
            },
            ...nextActivities,
          ];
        }
      }

      const firstSigningUrl = String(recipients?.[0]?.signingUrl ?? doc.url ?? "#");
      nextDocs[i] = {
        ...doc,
        status: nextStatus,
        url: firstSigningUrl,
        externalRef: {
          provider: "documenso",
          id: String(documensoId),
          url: firstSigningUrl,
          meta: doc.externalRef?.meta ?? {},
        },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Documenso sync failed";
      errors.push({ documensoId, error: message });
      if (message.includes("not configured")) {
        return res.status(400).json({ error: message });
      }
    }
  }

  const saved = await saveProject({ ...project, documents: nextDocs, crmActivities: nextActivities });
  return res.json({
    project: saved,
    summary: { checked: nextDocs.filter((d) => d.type === "Contract").length, updated: changes.length, errors },
    changes,
  });
});

app.get("/api/integrations/infisical/secrets", async (req, res) => {
  const settings = await readRuntimeSettings();
  const workspaceId = String(settings.infisicalWorkspaceId ?? "").trim();
  const secretPath = String(settings.infisicalSecretPath ?? "/").trim() || "/";
  const requestedEnv = typeof req.query.env === "string" ? String(req.query.env) : undefined;
  const environmentName =
    requestedEnv === "Development" || requestedEnv === "Staging" || requestedEnv === "Production"
      ? requestedEnv
      : settings.activeEnvironment;
  const recursive = String(req.query.recursive ?? "false") === "true";
  const includeValues = String(req.query.includeValues ?? "false") === "true";

  if (!workspaceId) return res.status(400).json({ error: "Infisical not configured (set infisicalWorkspaceId in Settings)" });

  const environmentSlug =
    environmentName === "Development"
      ? settings.infisicalEnvDevelopmentSlug
      : environmentName === "Staging"
        ? settings.infisicalEnvStagingSlug
        : settings.infisicalEnvProductionSlug;

  try {
    const data = await infisicalListSecretsRaw({ workspaceId, environment: environmentSlug, secretPath, recursive });
    res.json({
      workspaceId,
      environmentName,
      environmentSlug,
      secretPath,
      secrets: (data.secrets ?? []).map((s) => ({
        key: s.secretKey,
        value: includeValues ? s.secretValue : "••••••••••••••••",
        hasValue: true,
        comment: s.secretComment ?? "",
        version: s.version,
      })),
      imports: data.imports ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Infisical request failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.post("/api/integrations/infisical/sync/push", async (req, res) => {
  const settings = await readRuntimeSettings();
  const workspaceId = String(settings.infisicalWorkspaceId ?? "").trim();
  const secretPath = String(settings.infisicalSecretPath ?? "/").trim() || "/";
  const scope = req.body?.scope === "all" ? "all" : "active";

  if (!workspaceId) return res.status(400).json({ error: "Infisical not configured (set infisicalWorkspaceId in Settings)" });

  const localSecrets = await readSecrets();
  const selected =
    scope === "all"
      ? localSecrets
      : localSecrets.filter((s) => s.environment === settings.activeEnvironment);

  const errors: Array<{ key: string; environment: string; error: string }> = [];
  let pushed = 0;

  for (const s of selected) {
    const envSlug =
      s.environment === "Development"
        ? settings.infisicalEnvDevelopmentSlug
        : s.environment === "Staging"
          ? settings.infisicalEnvStagingSlug
          : settings.infisicalEnvProductionSlug;

    try {
      await infisicalUpsertSecretRaw({
        workspaceId,
        environment: envSlug,
        secretPath,
        key: s.key,
        value: s.value,
        comment: `Synced from AgencyOS (${s.environment}) at ${new Date().toISOString()}`,
        type: "shared",
      });
      pushed += 1;
    } catch (e) {
      errors.push({
        key: s.key,
        environment: s.environment,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  if (errors.length > 0) {
    return res.status(207).json({ ok: true, scope, pushed, errors });
  }

  return res.json({ ok: true, scope, pushed, errors: [] });
});

app.post("/api/integrations/infisical/sync/pull", async (req, res) => {
  const settings = await readRuntimeSettings();
  const workspaceId = String(settings.infisicalWorkspaceId ?? "").trim();
  const secretPath = String(settings.infisicalSecretPath ?? "/").trim() || "/";
  const recursive = Boolean(req.body?.recursive ?? false);

  if (!workspaceId) return res.status(400).json({ error: "Infisical not configured (set infisicalWorkspaceId in Settings)" });

  const environmentSlug =
    settings.activeEnvironment === "Development"
      ? settings.infisicalEnvDevelopmentSlug
      : settings.activeEnvironment === "Staging"
        ? settings.infisicalEnvStagingSlug
        : settings.infisicalEnvProductionSlug;

  try {
    const data = await infisicalListSecretsRaw({ workspaceId, environment: environmentSlug, secretPath, recursive });
    let imported = 0;
    for (const s of data.secrets ?? []) {
      const key = String(s.secretKey ?? "").trim();
      const value = String(s.secretValue ?? "").trim();
      if (!key || !value) continue;
      await upsertSecret({ key, value, environment: settings.activeEnvironment });
      imported += 1;
    }

    res.json({
      ok: true,
      imported,
      activeEnvironment: settings.activeEnvironment,
      environmentSlug,
      secretPath,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Infisical sync failed";
    const code = message.includes("not configured") ? 400 : 502;
    res.status(code).json({ error: message });
  }
});

app.post("/api/integrations/invoiceshelf/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "").trim();
  const deviceName = String(req.body?.deviceName ?? "agencyos").trim();
  if (!username || !password) return res.status(400).json({ error: "Missing username/password" });

  try {
    const result = await invoiceShelfLogin({ username, password, deviceName });
    const settings = await readRuntimeSettings();
    await upsertSecret({ key: "INVOICESHELF_TOKEN", value: result.token, environment: settings.activeEnvironment });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "InvoiceShelf login failed" });
  }
});

app.post("/api/projects/:id/financials/invoiceshelf/invoice", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const amount = Number(req.body?.amount ?? 0);
  const description = String(req.body?.description ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

  const auth = getInvoiceShelfAuth();
  if (!auth) return res.status(400).json({ error: "InvoiceShelf not configured (set INVOICESHELF_TOKEN)" });

  try {
    const customer = await invoiceShelfCreateCustomer({ name: project.brief.clientName });
    const templates = await invoiceShelfGetInvoiceTemplates();
    const templateName = String(templates?.[0]?.name ?? "invoice");
    const invoiceNumber = await invoiceShelfGetNextInvoiceNumber();

    const now = new Date();
    const invoiceDate = now.toISOString().slice(0, 10);
    const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const dueDate = due.toISOString().slice(0, 10);

    const invoice = await invoiceShelfCreateInvoice({
      customerId: customer.id,
      invoiceNumber,
      templateName,
      invoiceDate,
      dueDate,
      items: [
        {
          name: "Automation Setup & Deployment",
          description: description || project.brief.description,
          quantity: 1,
          price: amount,
        },
      ],
    });

    const invoiceData = (invoice as any)?.data ?? invoice;
    const invoiceId = Number(invoiceData?.id ?? NaN);
    const invoiceNo = String(invoiceData?.invoice_number ?? invoiceNumber);
    const invoicePdfUrl = String(invoiceData?.invoicePdfUrl ?? invoiceData?.invoice_pdf_url ?? "#");
    const invoiceStatus = String(invoiceData?.status ?? "").toUpperCase();
    const paidStatus = String(invoiceData?.paid_status ?? invoiceData?.paidStatus ?? "").toUpperCase();

    const docStatus = (() => {
      if (paidStatus === "PAID") return "Paid" as const;
      if (["SENT", "VIEWED", "COMPLETED"].includes(invoiceStatus)) return "Sent" as const;
      return "Draft" as const;
    })();

    const doc: ProjectDocument = {
      id: `doc-${Date.now()}`,
      name: `Invoice: ${project.brief.clientName}`,
      type: "Invoice" as const,
      status: docStatus,
      content: `InvoiceShelf invoice created.\nInvoice ID: ${Number.isFinite(invoiceId) ? invoiceId : "unknown"}\nInvoice #: ${invoiceNo}\nStatus: ${invoiceStatus || "DRAFT"} / Paid: ${paidStatus || "UNPAID"}\nAmount: ${amount}\nPDF: ${invoicePdfUrl !== "#" ? invoicePdfUrl : ""}`,
      url: invoicePdfUrl,
      amount,
      externalRef: Number.isFinite(invoiceId)
        ? { provider: "invoiceshelf", id: String(invoiceId), url: invoicePdfUrl, meta: { invoiceNumber: invoiceNo } }
        : undefined,
      createdAt: new Date().toISOString(),
    };

    const updated: Project = {
      ...project,
      documents: [doc, ...project.documents],
      crmActivities: [
        {
          id: `crm-${Date.now()}`,
          type: "Note",
          subject: `Invoice created in InvoiceShelf (#${invoiceNo})`,
          status: "Completed",
          timestamp: new Date().toISOString(),
        },
        ...project.crmActivities,
      ],
      financials: {
        ...project.financials,
        revenue: project.financials.revenue + amount,
      },
      totalBilled: project.totalBilled + amount,
    };

    const saved = await saveProject(updated);
    return res.json({
      project: saved,
      invoice: { id: Number.isFinite(invoiceId) ? invoiceId : undefined, invoice_number: invoiceNo, invoice_pdf_url: invoicePdfUrl },
    });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "InvoiceShelf invoice create failed" });
  }
});

app.post("/api/projects/:id/financials/invoiceshelf/invoice-from-council", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const auth = getInvoiceShelfAuth();
  if (!auth) return res.status(400).json({ error: "InvoiceShelf not configured (set INVOICESHELF_TOKEN)" });

  const sessionId = String(req.body?.sessionId ?? "").trim();
  const modeRaw = String(req.body?.mode ?? "first_month").trim().toLowerCase();
  const mode = (["first_month", "setup", "monthly", "all"].includes(modeRaw) ? modeRaw : "first_month") as
    | "first_month"
    | "setup"
    | "monthly"
    | "all";

  const sessions = await readJsonFile<CouncilSession[]>("council-sessions.json", []);
  const pickSession = (): CouncilSession | null => {
    if (sessionId) {
      return sessions.find((s) => s.id === sessionId && s.projectId === projectId) ?? null;
    }
    for (let i = sessions.length - 1; i >= 0; i -= 1) {
      const s = sessions[i];
      if (s.projectId !== projectId) continue;
      if (s.gateType !== "Strategic") continue;
      if (!s.pricing?.lineItems?.length) continue;
      return s;
    }
    return null;
  };

  const session = pickSession();
  if (!session?.pricing?.lineItems?.length) {
    return res.status(400).json({ error: "No Strategic council pricing found for this project (run Strategic Gate first)." });
  }

  const currency = String(session.pricing.currency ?? "USD").trim() || "USD";

  const selectedLineItems = session.pricing.lineItems.filter((li) => {
    const cadence = String(li.cadence ?? "").trim();
    if (mode === "all") return true;
    if (mode === "setup") return cadence === "One-Time";
    if (mode === "monthly") return cadence === "Monthly";
    return cadence === "One-Time" || cadence === "Monthly";
  });

  const items = selectedLineItems
    .map((li) => ({
      name: String(li.label ?? "").trim(),
      description: String(li.notes ?? "").trim() || null,
      quantity: 1,
      price: Number(li.amount ?? 0),
      cadence: String(li.cadence ?? "").trim(),
    }))
    .filter((i) => i.name && Number.isFinite(i.price) && i.price > 0);

  if (items.length === 0) {
    return res.status(400).json({ error: "Pricing items invalid or empty (check council pricing output)." });
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  try {
    const customer = await invoiceShelfCreateCustomer({ name: project.brief.clientName });
    const templates = await invoiceShelfGetInvoiceTemplates();
    const templateName = String(templates?.[0]?.name ?? "invoice");
    const invoiceNumber = await invoiceShelfGetNextInvoiceNumber();

    const now = new Date();
    const invoiceDate = now.toISOString().slice(0, 10);
    const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const dueDate = due.toISOString().slice(0, 10);

    const invoice = await invoiceShelfCreateInvoice({
      customerId: customer.id,
      invoiceNumber,
      templateName,
      invoiceDate,
      dueDate,
      items: items.map((i) => ({
        name: i.name,
        description: i.description ?? undefined,
        quantity: i.quantity,
        price: i.price,
      })),
    });

    const invoiceData = (invoice as any)?.data ?? invoice;
    const invoiceId = Number(invoiceData?.id ?? NaN);
    const invoiceNo = String(invoiceData?.invoice_number ?? invoiceNumber);
    const invoicePdfUrl = String(invoiceData?.invoicePdfUrl ?? invoiceData?.invoice_pdf_url ?? "#");
    const invoiceStatus = String(invoiceData?.status ?? "").toUpperCase();
    const paidStatus = String(invoiceData?.paid_status ?? invoiceData?.paidStatus ?? "").toUpperCase();

    const docStatus = (() => {
      if (paidStatus === "PAID") return "Paid" as const;
      if (["SENT", "VIEWED", "COMPLETED"].includes(invoiceStatus)) return "Sent" as const;
      return "Draft" as const;
    })();

    const contentLines: string[] = [];
    contentLines.push("InvoiceShelf invoice created from Council pricing.");
    contentLines.push(`Council session: ${session.id}`);
    contentLines.push(`Mode: ${mode}`);
    contentLines.push(`Currency: ${currency}`);
    contentLines.push(`Invoice ID: ${Number.isFinite(invoiceId) ? invoiceId : "unknown"}`);
    contentLines.push(`Invoice #: ${invoiceNo}`);
    contentLines.push("");
    contentLines.push("Line items:");
    for (const i of items) {
      contentLines.push(`- ${i.name} (${i.cadence}): ${i.price}`);
    }
    contentLines.push("");
    contentLines.push(`Total: ${total}`);
    if (invoicePdfUrl && invoicePdfUrl !== "#") contentLines.push(`PDF: ${invoicePdfUrl}`);

    const doc: ProjectDocument = {
      id: `doc-${Date.now()}`,
      name: `Invoice (Council Pricing): ${project.brief.clientName}`,
      type: "Invoice" as const,
      status: docStatus,
      content: contentLines.join("\n"),
      url: invoicePdfUrl,
      amount: total,
      externalRef: Number.isFinite(invoiceId)
        ? { provider: "invoiceshelf", id: String(invoiceId), url: invoicePdfUrl, meta: { invoiceNumber: invoiceNo, councilSessionId: session.id, mode } }
        : undefined,
      createdAt: new Date().toISOString(),
    };

    const updated: Project = {
      ...project,
      documents: [doc, ...project.documents],
      crmActivities: [
        {
          id: `crm-${Date.now()}`,
          type: "Note",
          subject: `Invoice created from Council pricing (#${invoiceNo})`,
          status: "Completed",
          timestamp: new Date().toISOString(),
        },
        ...project.crmActivities,
      ],
      financials: {
        ...project.financials,
        revenue: project.financials.revenue + total,
      },
      totalBilled: project.totalBilled + total,
    };

    const saved = await saveProject(updated);
    return res.json({
      project: saved,
      invoice: { id: Number.isFinite(invoiceId) ? invoiceId : undefined, invoice_number: invoiceNo, invoice_pdf_url: invoicePdfUrl },
      council: { sessionId: session.id, currency, total },
    });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "InvoiceShelf invoice create failed" });
  }
});

app.post("/api/projects/:id/financials/invoiceshelf/sync", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const auth = getInvoiceShelfAuth();
  if (!auth) return res.status(400).json({ error: "InvoiceShelf not configured (set INVOICESHELF_TOKEN)" });

  const parseInvoiceId = (doc: any): number | null => {
    const fromRef =
      doc?.externalRef?.provider === "invoiceshelf" ? Number(doc.externalRef.id) : null;
    if (fromRef && Number.isFinite(fromRef)) return fromRef;
    const content = typeof doc?.content === "string" ? doc.content : "";
    const m = content.match(/Invoice ID:\\s*(\\d+)/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const changes: Array<{ documentId: string; invoiceId: number; from: string; to: string }> = [];
  const errors: Array<{ invoiceId: number; error: string }> = [];

  const nextDocs = project.documents.map((doc) => ({ ...doc }));
  const now = new Date().toISOString();
  let nextActivities = [...project.crmActivities];

  const mapInvoiceStatus = (invoiceData: any): "Draft" | "Sent" | "Paid" => {
    const status = String(invoiceData?.status ?? "").toUpperCase();
    const paidStatus = String(invoiceData?.paid_status ?? invoiceData?.paidStatus ?? "").toUpperCase();
    if (paidStatus === "PAID") return "Paid";
    if (["SENT", "VIEWED", "COMPLETED"].includes(status)) return "Sent";
    return "Draft";
  };

  for (let i = 0; i < nextDocs.length; i += 1) {
    const doc = nextDocs[i];
    if (doc.type !== "Invoice") continue;
    const invoiceId = parseInvoiceId(doc);
    if (!invoiceId) continue;

    try {
      const remote = await invoiceShelfGetInvoice(invoiceId);
      const invoiceData = (remote as any)?.data ?? remote;
      const nextStatus = mapInvoiceStatus(invoiceData);
      const invoiceNo = String(invoiceData?.invoice_number ?? "");
      const invoicePdfUrl = String(invoiceData?.invoicePdfUrl ?? invoiceData?.invoice_pdf_url ?? doc.url ?? "#");

      if (doc.status !== nextStatus) {
        changes.push({ documentId: String(doc.id), invoiceId, from: String(doc.status), to: nextStatus });
        if (nextStatus === "Paid") {
          nextActivities = [
            {
              id: `crm-${Date.now()}`,
              type: "Status Change",
              subject: `Invoice paid in InvoiceShelf (${invoiceNo || invoiceId})`,
              status: "Completed",
              timestamp: now,
            },
            ...nextActivities,
          ];
        }
      }

      nextDocs[i] = {
        ...doc,
        status: nextStatus,
        url: invoicePdfUrl,
        externalRef: {
          provider: "invoiceshelf",
          id: String(invoiceId),
          url: invoicePdfUrl,
          meta: { invoiceNumber: invoiceNo || doc.externalRef?.meta?.invoiceNumber },
        },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "InvoiceShelf sync failed";
      errors.push({ invoiceId, error: message });
    }
  }

  const saved = await saveProject({ ...project, documents: nextDocs, crmActivities: nextActivities });
  return res.json({
    project: saved,
    summary: { checked: nextDocs.filter((d) => d.type === "Invoice").length, updated: changes.length, errors },
    changes,
  });
});

app.post("/api/projects/:id/crm/suitecrm/lead", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const creds = getSuiteCrmCredentials();
  if (!creds) return res.status(400).json({ error: "SuiteCRM not configured (set SUITECRM_USERNAME + SUITECRM_PASSWORD)" });

  try {
    const { sessionId } = await suiteCrmLogin(creds);
    const lead = await suiteCrmCreateLead({
      sessionId,
      lastName: project.brief.clientName,
      description: `${project.brief.description}\n\nAgencyOS Project: ${project.id}`,
      status: "New",
      leadSource: "AgencyOS",
    });

    const updated: Project = {
      ...project,
      crmActivities: [
        {
          id: `crm-${Date.now()}`,
          type: "Status Change",
          subject: `Lead synced to SuiteCRM (${lead.id})`,
          status: "Completed",
          timestamp: new Date().toISOString(),
        },
        ...project.crmActivities,
      ],
    };
    const saved = await saveProject(updated);
    res.json({ project: saved, lead });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "SuiteCRM lead create failed" });
  }
});

app.post("/api/crm/suitecrm/lead", async (req, res) => {
  const creds = getSuiteCrmCredentials();
  if (!creds) return res.status(400).json({ error: "SuiteCRM not configured (set SUITECRM_USERNAME + SUITECRM_PASSWORD)" });

  const lastName = String(req.body?.lastName ?? req.body?.name ?? "").trim();
  if (!lastName) return res.status(400).json({ error: "Missing lastName" });

  const description = String(req.body?.description ?? "").trim() || undefined;
  const status = String(req.body?.status ?? "").trim() || undefined;
  const leadSource = String(req.body?.leadSource ?? "AgencyOS").trim() || "AgencyOS";

  try {
    const { sessionId } = await suiteCrmLogin(creds);
    const lead = await suiteCrmCreateLead({
      sessionId,
      lastName,
      description,
      status,
      leadSource,
    });
    const baseUrl = String(process.env.SUITECRM_BASE_URL ?? "http://localhost:8091").replace(/\/+$/, "");
    const url = `${baseUrl}/index.php?module=Leads&action=DetailView&record=${encodeURIComponent(String(lead.id))}`;
    res.json({ baseUrl, lead: { id: lead.id, url } });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "SuiteCRM lead create failed" });
  }
});

app.get("/api/projects/:id/crm/suitecrm/leads", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const creds = getSuiteCrmCredentials();
  if (!creds) return res.status(400).json({ error: "SuiteCRM not configured (set SUITECRM_USERNAME + SUITECRM_PASSWORD)" });

  const limit = Number(req.query.limit ?? 25);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 25;

  const scope = String(req.query.scope ?? "project").trim().toLowerCase();
  const escape = (v: string) => v.replace(/'/g, "''");

  const projectTag = escape(`AgencyOS Project: ${project.id}`);
  const clientName = escape(project.brief.clientName);

  const query =
    scope === "all"
      ? ""
      : scope === "agencyos"
        ? "leads.lead_source = 'AgencyOS'"
        : `leads.lead_source = 'AgencyOS' AND (leads.description LIKE '%${projectTag}%' OR leads.last_name LIKE '%${clientName}%')`;

  try {
    const { sessionId } = await suiteCrmLogin(creds);
    const out = await suiteCrmListLeads({ sessionId, query, limit: safeLimit, offset: 0 });
    res.json({
      baseUrl: String(process.env.SUITECRM_BASE_URL ?? "http://localhost:8091").replace(/\/+$/, ""),
      leads: out.leads,
      totalCount: out.totalCount ?? null,
    });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "SuiteCRM lead list failed" });
  }
});

app.get("/api/integrations/status", async (_req, res) => {
  const n8nCfg = getN8nConfig();
  const n8nBaseUrl = String(process.env.N8N_BASE_URL ?? "http://localhost:5678").replace(/\/+$/, "");

  let n8n: { connected: boolean; baseUrl: string; reason?: string; sample?: any };
  if (!n8nCfg) {
    const ping = await probeUrl(`${n8nBaseUrl}/healthz`);
    n8n = { connected: false, baseUrl: n8nBaseUrl, reason: ping.ok ? "Missing N8N_API_KEY" : `n8n unreachable: ${ping.reason ?? "unknown"}` };
  } else {
    try {
      const workflows = await listWorkflows({ limit: 1 });
      n8n = { connected: true, baseUrl: n8nCfg.baseUrl, sample: workflows.data?.[0] ?? null };
    } catch (e) {
      n8n = {
        connected: false,
        baseUrl: n8nCfg.baseUrl,
        reason: e instanceof Error ? e.message : "n8n request failed",
      };
    }
  }

  const suitecrmBaseUrl = String(process.env.SUITECRM_BASE_URL ?? "http://localhost:8091").replace(/\/+$/, "");
  const invoiceshelfBaseUrl = String(process.env.INVOICESHELF_BASE_URL ?? "http://localhost:8090").replace(/\/+$/, "");
  const documensoBaseUrl = String(process.env.DOCUMENSO_BASE_URL ?? "http://localhost:8092").replace(/\/+$/, "");
  const infisicalBaseUrl = String(process.env.INFISICAL_BASE_URL ?? "http://localhost:8081").replace(/\/+$/, "");

  const suiteCrmCreds = getSuiteCrmCredentials();
  const suitecrm = await (async () => {
    if (!suiteCrmCreds) {
      return { connected: false, baseUrl: suitecrmBaseUrl, reason: "Missing SUITECRM_USERNAME/SUITECRM_PASSWORD" };
    }
    try {
      await suiteCrmLogin(suiteCrmCreds);
      return { connected: true, baseUrl: suitecrmBaseUrl };
    } catch (e) {
      return { connected: false, baseUrl: suitecrmBaseUrl, reason: e instanceof Error ? e.message : "SuiteCRM login failed" };
    }
  })();

  const invoiceshelfToken = String(process.env.INVOICESHELF_TOKEN ?? "").trim();
  const invoiceshelf = await (async () => {
    if (!invoiceshelfToken) {
      return { connected: false, baseUrl: invoiceshelfBaseUrl, reason: "Missing INVOICESHELF_TOKEN" };
    }
    const ping = await pingUrl(`${invoiceshelfBaseUrl}/api/v1/auth/check`, {
      headers: { Authorization: `Bearer ${invoiceshelfToken}` },
    });
    return { connected: ping.ok, baseUrl: invoiceshelfBaseUrl, reason: ping.reason };
  })();

  const documensoToken = String(process.env.DOCUMENSO_API_TOKEN ?? "").trim();
  const documenso = await (async () => {
    if (!documensoToken) {
      return { connected: false, baseUrl: documensoBaseUrl, reason: "Missing DOCUMENSO_API_TOKEN" };
    }
    const ping = await pingUrl(`${documensoBaseUrl}/api/v1/me`, { headers: { authorization: `Bearer ${documensoToken}` } });
    return { connected: ping.ok, baseUrl: documensoBaseUrl, reason: ping.reason };
  })();

  const infisicalPing = await pingUrl(`${infisicalBaseUrl}/api/status`);
  const apify = getApifyMarketStatus();
  const postgres = await pgHealthcheck();
  const postgresBase = redactDatabaseUrl();

  res.json({
    n8n,
    suitecrm,
    invoiceshelf,
    documenso,
    infisical: {
      connected: infisicalPing.ok,
      baseUrl: infisicalBaseUrl,
      reason: infisicalPing.reason,
    },
    apify: {
      connected: apify.connected,
      baseUrl: "https://api.apify.com",
      reason: apify.reason,
    },
    postgres: {
      connected: postgres.connected,
      baseUrl: postgresBase || "postgres",
      reason: postgres.reason,
    },
  });
});

app.get("/api/projects/:id/executions", async (req, res) => {
  const projectId = req.params.id;
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const cfg = getN8nConfig();
  if (!cfg) {
    return res.json({
      connected: false,
      baseUrl: String(process.env.N8N_BASE_URL ?? "http://localhost:5678"),
      executions: [],
      reason: "Missing N8N_API_KEY",
    });
  }

  const limit = Number(req.query.limit ?? 20);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 20;

  const workflowIds = project.activeWorkflows
    .map((w) => w.deployment?.n8nWorkflowId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (workflowIds.length === 0) {
    try {
      await listWorkflows({ limit: 1 });
      return res.json({ connected: true, baseUrl: cfg.baseUrl, executions: [] });
    } catch (e) {
      return res.json({
        connected: false,
        baseUrl: cfg.baseUrl,
        executions: [],
        reason: e instanceof Error ? e.message : "n8n request failed",
      });
    }
  }

  try {
    const all = await Promise.all(
      workflowIds.map(async (wfId) => {
        const out = await listExecutions({ workflowId: wfId, limit: safeLimit, includeData: false });
        return out.data.map((e) => ({ ...e, _workflowId: wfId }));
      }),
    );

    const flattened = all.flat();
    flattened.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));

    return res.json({ connected: true, baseUrl: cfg.baseUrl, executions: flattened.slice(0, safeLimit * 2) });
  } catch (e) {
    return res.json({
      connected: false,
      baseUrl: cfg.baseUrl,
      executions: [],
      reason: e instanceof Error ? e.message : "n8n request failed",
    });
  }
});

app.get("/api/projects", async (_req, res) => {
  const projects = await listProjects();
  res.json(projects);
});

app.post("/api/demo/seed", async (_req, res) => {
  try {
    const out = await seedDemoProjects();
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Demo seed failed" });
  }
});

app.post("/api/projects", async (req, res) => {
  const brief = req.body?.brief;
  if (!brief?.id || !brief?.clientName) return res.status(400).json({ error: "Missing brief" });
  const project = await createProject(brief);
  res.json(project);
});

app.get("/api/projects/:id", async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json(project);
});

app.put("/api/projects/:id", async (req, res) => {
  const project = req.body?.project;
  if (!project?.id || project.id !== req.params.id) {
    return res.status(400).json({ error: "Invalid project payload" });
  }
  const saved = await saveProject(project);
  res.json(saved);
});

app.post("/api/projects/:id/workflows/install", async (req, res) => {
  const projectId = req.params.id;
  const workflowId = String(req.body?.workflowId ?? "");
  const activate = Boolean(req.body?.activate ?? false);

  if (!workflowId) return res.status(400).json({ error: "Missing workflowId" });

  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const index = await getCatalogIndex();
  const meta = index.find((w) => w.id === workflowId);
  if (!meta) return res.status(404).json({ error: "Workflow not found in catalog index" });

  const now = new Date().toISOString();
  const existing = project.activeWorkflows.find((w) => w.id === meta.id);
  const existingDeployment = existing?.deployment;
  const workflow: Workflow = {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    tags: meta.tags,
    jsonUrl: `/api/catalog/workflow/${meta.id}/raw`,
    complexity: meta.complexity,
    credentials: meta.credentials,
    installPlan: buildInstallPlan(meta),
    deployment: {
      provider: "n8n",
      status: existingDeployment?.status ?? "Staged",
      n8nWorkflowId: existingDeployment?.n8nWorkflowId,
      message: existingDeployment?.message,
      updatedAt: now,
    },
  };

  const existingIdx = project.activeWorkflows.findIndex((w) => w.id === workflow.id);
  const activeWorkflows = [...project.activeWorkflows];
  if (existingIdx === -1) activeWorkflows.push(workflow);
  else activeWorkflows[existingIdx] = { ...activeWorkflows[existingIdx], ...workflow };

  let updatedProject: Project = {
    ...project,
    activeWorkflows,
    status: project.status === "Intake" ? "Developing" : project.status,
  };

  const n8nCfg = getN8nConfig();
  if (!n8nCfg) {
    updatedProject = await saveProject(updatedProject);
    return res.json({ project: updatedProject, workflow: workflow });
  }

  try {
    const json = await readWorkflowJsonById(workflowId);
    const input = {
      name: String(json?.name ?? meta.name),
      nodes: Array.isArray(json?.nodes) ? json.nodes : [],
      connections: typeof json?.connections === "object" && json.connections ? json.connections : {},
      settings: typeof json?.settings === "object" && json.settings ? json.settings : {},
      staticData: json?.staticData ?? null,
    };

    const existingN8nWorkflowId = existingDeployment?.n8nWorkflowId;

    const upserted = await (async () => {
      if (existingN8nWorkflowId) {
        try {
          return await updateWorkflow(existingN8nWorkflowId, input);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("(404)")) {
            return await createWorkflow(input);
          }
          throw e;
        }
      }

      return await createWorkflow(input);
    })();

    const nextWorkflow: Workflow = {
      ...workflow,
      deployment: {
        provider: "n8n",
        status: upserted.active ? "Activated" : "Imported",
        n8nWorkflowId: upserted.id,
        message: existingN8nWorkflowId ? "Updated in n8n" : "Imported to n8n",
        updatedAt: new Date().toISOString(),
      },
    };

    const idx2 = updatedProject.activeWorkflows.findIndex((w) => w.id === workflow.id);
    if (idx2 !== -1) {
      const copy = [...updatedProject.activeWorkflows];
      copy[idx2] = nextWorkflow;
      updatedProject = { ...updatedProject, activeWorkflows: copy };
    }

    if (activate) {
      try {
        const activated = await activateWorkflow(upserted.id);
        const idx3 = updatedProject.activeWorkflows.findIndex((w) => w.id === workflow.id);
        if (idx3 !== -1) {
          const copy = [...updatedProject.activeWorkflows];
          copy[idx3] = {
            ...copy[idx3],
            deployment: {
              provider: "n8n",
              status: "Activated",
              n8nWorkflowId: activated.id,
              updatedAt: new Date().toISOString(),
            },
          };
          updatedProject = { ...updatedProject, activeWorkflows: copy };
        }
      } catch (e) {
        const idx3 = updatedProject.activeWorkflows.findIndex((w) => w.id === workflow.id);
        if (idx3 !== -1) {
          const copy = [...updatedProject.activeWorkflows];
          copy[idx3] = {
            ...copy[idx3],
            deployment: {
              provider: "n8n",
              status: "Error",
              n8nWorkflowId: upserted.id,
              message: e instanceof Error ? e.message : "Activation failed",
              updatedAt: new Date().toISOString(),
            },
          };
          updatedProject = { ...updatedProject, activeWorkflows: copy };
        }
      }
    }

    updatedProject = await saveProject(updatedProject);
    return res.json({ project: updatedProject, workflow: nextWorkflow });
  } catch (e) {
    const idx2 = updatedProject.activeWorkflows.findIndex((w) => w.id === workflow.id);
    if (idx2 !== -1) {
      const copy = [...updatedProject.activeWorkflows];
      copy[idx2] = {
        ...copy[idx2],
        deployment: {
          provider: "n8n",
          status: "Error",
          message: e instanceof Error ? e.message : "Import failed",
          updatedAt: new Date().toISOString(),
        },
      };
      updatedProject = { ...updatedProject, activeWorkflows: copy };
    }

    updatedProject = await saveProject(updatedProject);
    return res.status(502).json({ error: "n8n import failed", project: updatedProject });
  }
});

app.post("/api/projects/:id/workflows/:workflowId/activate", async (req, res) => {
  const projectId = req.params.id;
  const workflowId = req.params.workflowId;

  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const idx = project.activeWorkflows.findIndex((w) => w.id === workflowId);
  if (idx === -1) return res.status(404).json({ error: "Workflow not installed in project" });

  const wf = project.activeWorkflows[idx];
  const n8nWorkflowId = wf.deployment?.n8nWorkflowId;
  if (!n8nWorkflowId) return res.status(400).json({ error: "Workflow is not imported to n8n yet" });

  const cfg = getN8nConfig();
  if (!cfg) return res.status(400).json({ error: "n8n not configured (set N8N_API_KEY)" });

  try {
    const activated = await activateWorkflow(n8nWorkflowId);
    const copy = [...project.activeWorkflows];
    copy[idx] = {
      ...wf,
      deployment: {
        provider: "n8n",
        status: "Activated",
        n8nWorkflowId: activated.id,
        updatedAt: new Date().toISOString(),
      },
    };

    const updated: Project = {
      ...project,
      status: "Live",
      activeWorkflows: copy,
    };

    const saved = await saveProject(updated);
    return res.json(saved);
  } catch (e) {
    const copy = [...project.activeWorkflows];
    copy[idx] = {
      ...wf,
      deployment: {
        provider: "n8n",
        status: "Error",
        n8nWorkflowId,
        message: e instanceof Error ? e.message : "Activation failed",
        updatedAt: new Date().toISOString(),
      },
    };
    const saved = await saveProject({ ...project, activeWorkflows: copy });
    return res.status(502).json({ error: "Activation failed", project: saved });
  }
});

app.post("/api/intake/analyze", async (req, res) => {
  const input = String(req.body?.input ?? "");
  if (!input.trim()) return res.status(400).json({ error: "Missing input" });

  const fallback = {
    clientName: "Unnamed Entity",
    industry: "Automation",
    goals: ["Automate intake → delivery loop"],
    tools: ["n8n", "CRM", "Invoice"],
    budget: "TBD",
    riskLevel: "Medium",
  };

  const openRouterKey = String(process.env.OPENROUTER_API_KEY ?? "").trim();
  if (openRouterKey) {
    const prompt = [
      "Extract structured info from this automation agency client request.",
      "Return ONLY JSON.",
      'Schema: {"clientName":"string","industry":"string","goals":["..."],"tools":["..."],"budget":"string","riskLevel":"Low|Medium|High"}',
      `User request: "${input}"`,
    ].join("\n");

    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 500,
        messages: [
          { role: "system", content: "You are a careful analyst. Output ONLY valid JSON." },
          { role: "user", content: prompt },
        ],
      });

      const parsed = extractFirstJsonObject<{
        clientName?: string;
        industry?: string;
        goals?: string[];
        tools?: string[];
        budget?: string;
        riskLevel?: string;
      }>(raw);

      if (parsed) {
        const safeText = (value: unknown) => String(value ?? "").trim();
        const normalizeList = (list: unknown, fallbackList: string[]) => {
          if (!Array.isArray(list)) return fallbackList;
          const items = list.map((item) => safeText(item)).filter(Boolean).slice(0, 8);
          return items.length > 0 ? items : fallbackList;
        };

        return res.json({
          clientName: safeText(parsed.clientName) || fallback.clientName,
          industry: safeText(parsed.industry) || fallback.industry,
          goals: normalizeList(parsed.goals, fallback.goals),
          tools: normalizeList(parsed.tools, fallback.tools),
          budget: safeText(parsed.budget) || fallback.budget,
          riskLevel: safeText(parsed.riskLevel) || fallback.riskLevel,
        });
      }
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json(fallback);
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this automation agency client request and extract structured information.\nUser request: "${input}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schemas.intake,
    },
  });

  try {
    return res.json(JSON.parse(response.text || "{}"));
  } catch {
    return res.status(502).json({ error: "Invalid model response" });
  }
});

// Multimodal visual analysis endpoint
app.post("/api/intake/analyze-visual", async (req, res) => {
  const { file, mimeType } = req.body;

  if (!file || !mimeType) {
    return res.status(400).json({ error: "Missing file or mimeType" });
  }

  try {
    // Import dynamically to avoid circular dependencies
    const { analyzeVisual } = await import('./lib/geminiVision.js');

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(file, 'base64');

    // Analyze with Gemini 2.0 Flash
    const analysis = await analyzeVisual(fileBuffer, mimeType);

    return res.json(analysis);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Visual analysis failed';
    return res.status(502).json({ error: errorMsg });
  }
});

app.post("/api/catalog/search", async (req, res) => {
  const query = String(req.body?.query ?? "");
  const limit = Number(req.body?.limit ?? 10);
  const requiredTags = Array.isArray(req.body?.requiredTags) ? req.body.requiredTags.map(String) : [];

  const items = await searchCatalog({ query, limit: Number.isFinite(limit) ? limit : 10, requiredTags });
  const enriched = items.map((wf) => ({
    workflow: {
      id: wf.id,
      name: wf.name,
      description: wf.description,
      tags: wf.tags,
      jsonUrl: `/api/catalog/workflow/${wf.id}/raw`,
      complexity: wf.complexity,
      credentials: wf.credentials,
    },
    score: wf.score,
    installPlan: buildInstallPlan(wf),
  }));

  res.json({ items: enriched });
});

app.get("/api/catalog/stats", async (_req, res) => {
  try {
    const index = await getCatalogIndex();
    return res.json({ workflows: index.length });
  } catch {
    return res.status(500).json({ workflows: 0 });
  }
});

app.post("/api/catalog/reindex", async (_req, res) => {
  resetCatalogIndexCache();
  const index = await getCatalogIndex();
  res.json({ ok: true, workflows: index.length });
});

app.post("/api/catalog/query-rewrite", async (req, res) => {
  const query = String(req.body?.query ?? "");
  if (!query.trim()) return res.json({ query: "", requiredTags: [], keywords: [], notes: "Empty query" });

  const fallback = rewriteCatalogQueryFallback({ query });
  const normalizeRewrite = (parsed: any) => {
    const outQuery = String(parsed?.query ?? "").trim();
    if (!outQuery) return null;
    const requiredTags = Array.isArray(parsed?.requiredTags) ? parsed.requiredTags.map(String).filter(Boolean).slice(0, 3) : [];
    const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords.map(String).filter(Boolean).slice(0, 24) : [];
    const notes = typeof parsed?.notes === "string" ? parsed.notes : "LLM rewrite";

    const uniq = (items: string[]) => [...new Set(items.map((s) => String(s ?? "").trim()).filter(Boolean))];
    const mergedQuery = `${outQuery} ${fallback.query}`.trim().slice(0, 220);
    const mergedRequiredTags = uniq([...requiredTags, ...fallback.requiredTags]).slice(0, 3);
    const mergedKeywords = uniq([...keywords, ...fallback.keywords]).slice(0, 24);
    const mergedNotes = [notes, fallback.notes ? `+ ${fallback.notes}` : ""].join(" ").trim();

    return { query: mergedQuery || outQuery, requiredTags: mergedRequiredTags, keywords: mergedKeywords, notes: mergedNotes };
  };

  const openRouterKey = String(process.env.OPENROUTER_API_KEY ?? "").trim();
  if (openRouterKey) {
    try {
      const prompt = [
        "You rewrite user requests into a compact keyword query for searching an n8n workflow library.",
        "Rules:",
        "- Output English keywords.",
        "- Keep it short (6-18 words).",
        "- Include integration names (e.g. slack, shopify, woocommerce, gmail, google sheets, webhook, calendar, stripe).",
        "- requiredTags: up to 3 must-have tags from common node/integration names.",
        "",
        "Return ONLY JSON: {\"query\":\"...\",\"requiredTags\":[\"...\"],\"keywords\":[\"...\"],\"notes\":\"...\"}",
        `User query: "${query}"`,
      ].join("\n");

      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 350,
        messages: [
          { role: "system", content: "Output ONLY valid JSON. Do not reveal secrets." },
          { role: "user", content: prompt },
        ],
      });

      const parsed = extractFirstJsonObject<{
        query?: string;
        requiredTags?: string[];
        keywords?: string[];
        notes?: string;
      }>(raw);
      const result = normalizeRewrite(parsed);
      if (result) return res.json(result);
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return res.json(fallback);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You rewrite user requests into a compact keyword query for searching an n8n workflow library.\n\nRules:\n- Output English keywords.\n- Keep it short (6-18 words).\n- Include integration names (e.g. slack, shopify, woocommerce, gmail, google sheets, webhook, calendar, stripe).\n- requiredTags: up to 3 must-have tags from common node/integration names.\n\nUser query: "${query}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: schemas.catalogRewrite,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const result = normalizeRewrite(parsed);
    if (!result) return res.json(rewriteCatalogQueryFallback({ query }));
    return res.json(result);
  } catch (e) {
    return res.json(rewriteCatalogQueryFallback({ query }));
  }
});

app.get("/api/catalog/workflow/:id/raw", async (req, res) => {
  try {
    const json = await readWorkflowJsonById(req.params.id);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="workflow-${req.params.id}.json"`);
    return res.send(JSON.stringify(json, null, 2));
  } catch (e) {
    return res.status(404).json({ error: "Workflow not found" });
  }
});

app.post("/api/council/run", async (req, res) => {
  const projectId = String(req.body?.projectId ?? "");
  const gateType = String(req.body?.gateType ?? "Strategic") as CouncilGate;
  const topic = String(req.body?.topic ?? `${gateType} Gate`);
  const context = req.body?.context ?? {};
  const language = req.body?.language === "en" ? ("en" as const) : ("tr" as const);
  const boardName = language === "tr" ? "Yönetim Kurulu" : "Management Board";

  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const councilModels = String(process.env.COUNCIL_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chairmanModel = String(process.env.COUNCIL_CHAIRMAN_MODEL ?? councilModels[0] ?? "").trim();
  const stage2Enabled = String(process.env.COUNCIL_STAGE2_ENABLED ?? "true").trim().toLowerCase() !== "false";

  const ai = getGeminiClient();

  let session: CouncilSession;
  let openRouterSession: CouncilSession | null = null;
  if (openRouterKey && councilModels.length >= 2 && chairmanModel) {
    try {
      const contextTextRaw = JSON.stringify(context);
      const contextText =
        contextTextRaw.length > 12_000 ? `${contextTextRaw.slice(0, 12_000)}…(truncated)` : contextTextRaw;

      const memberAsk =
        gateType === "Strategic"
          ? language === "tr"
            ? "En iyi eleştiri ve önerini ver. Somut bir fiyat önerisi ekle (para birimi + tek seferlik kurulum + aylık retainer + varsa kullanım bazlı kalemler) ve kapsam sınırları + varsayımlar belirt."
            : "Give your best critique and recommendation. Include a concrete pricing suggestion (currency + one-time setup + monthly retainer + any usage-based items), plus key assumptions and scope boundaries."
          : gateType === "Risk"
            ? language === "tr"
              ? "En iyi eleştiri ve önerini ver. Somut riskler, test planı, credential/secrets yönetimi, rollback ve izleme/alert öner."
              : "Give your best critique and recommendation. Include concrete risks, a test plan, credential/secrets handling, rollback, and monitoring."
            : language === "tr"
              ? "En iyi eleştiri ve önerini ver. Kısa, net ve uygulanabilir yaz."
              : "Give your best critique and recommendation.";

      const stage1Settled = await Promise.allSettled(
        councilModels.map(async (model) => {
          const content = await openRouterChat({
            apiKey: openRouterKey,
            model,
            timeoutMs: 25_000,
            maxTokens: 650,
            messages: [
              {
                role: "system",
                content:
                  language === "tr"
                    ? `Türkçe yaz. Sen AgencyOS ${boardName} üyesisin. Ajans sahibine yazıyorsun: az teknik, net, uygulanabilir.`
                    : `You are an AgencyOS ${boardName} member. Be direct, practical, minimal jargon, and flag risks.`,
              },
              {
                role: "user",
                content: `Gate: ${gateType}\nTopic: ${topic}\nProject Context (truncated): ${contextText}\n\n${memberAsk}`,
              },
            ],
          });
          return { model, content };
        }),
      );

      const firstOpinions = stage1Settled
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((v): v is { model: string; content: string } => Boolean(v && String(v.content ?? "").trim().length > 0));

      if (firstOpinions.length < 2) {
        throw new Error("Council stage1 produced insufficient outputs");
      }

      const labels = firstOpinions.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
      const labelToModel: Record<string, string> = Object.fromEntries(
        labels.map((label, i) => [`Response ${label}`, firstOpinions[i]?.model ?? "unknown"]),
      );

      const responsesText = labels
        .map((label, i) => `Response ${label}:\n${firstOpinions[i]?.content ?? ""}`)
        .join("\n\n");

      let stage2Rankings: Array<{ model: string; content: string; parsedRanking: string[] }> = [];
      let aggregateRankings: Array<{ model: string; averageRank: number; rankingsCount: number }> = [];

      if (stage2Enabled) {
        try {
          const rankingPrompt = `You are evaluating different council member critiques for the following gate review.

Gate: ${gateType}
Topic: ${topic}
Project Context (truncated): ${contextText}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. Evaluate each response individually (what it does well vs poorly).
2. Provide a final ranking at the end.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text in the ranking section

Now provide your evaluation and ranking:`;

          const stage2Settled = await Promise.allSettled(
            councilModels.map(async (model) => {
              const content = await openRouterChat({
                apiKey: openRouterKey,
                model,
                timeoutMs: 22_000,
                maxTokens: 700,
                messages: [{ role: "user", content: rankingPrompt }],
                temperature: 0.1,
              });
              return { model, content };
            }),
          );

          const stage2Raw = stage2Settled
            .map((r) => (r.status === "fulfilled" ? r.value : null))
            .filter((v): v is { model: string; content: string } => Boolean(v && String(v.content ?? "").trim().length > 0));

          stage2Rankings = stage2Raw.map((r) => ({
            model: r.model,
            content: r.content,
            parsedRanking: parseRankingFromText(r.content),
          }));

          aggregateRankings = calculateAggregateRankings(stage2Rankings, labelToModel);
        } catch {
          stage2Rankings = [];
          aggregateRankings = [];
        }
      } else {
        stage2Rankings = [];
        aggregateRankings = [];
      }

      const chairmanText = await openRouterChat({
        apiKey: openRouterKey,
        model: chairmanModel,
        timeoutMs: 45_000,
        maxTokens: 1800,
        messages: [
          {
            role: "system",
            content:
              language === "tr"
                ? `Sen AgencyOS ${boardName} Başkanı'sın. Kurul çıktısını tek karara indir. SADECE geçerli JSON üret (markdown yok). JSON içindeki tüm metin alanları Türkçe olmalı.`
                : `You are the Chairman. Synthesize the council into a single decision. Output ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Gate: ${gateType}\nTopic: ${topic}\nProject Context (truncated): ${contextText}\n\nSTAGE 1 - Anonymized Responses:\n${responsesText}\n\nSTAGE 2 - Peer Rankings (optional):\n${stage2Rankings
              .map((r) => `Model: ${r.model}\n${r.content}`)
              .join("\n\n")}\n\nSTAGE 2 - Aggregate Ranking (optional):\n${JSON.stringify(
              aggregateRankings,
            )}\n\nReturn ONLY valid JSON (no markdown, no code fences, no extra keys).\n\nConstraints (keep it short):\n- Each opinion: max 3 short sentences.\n- synthesis: max 6 short sentences.\n- pricing.lineItems: max 6 items.\n- pricing.assumptions: max 6 items.\n\nRequired schema:\n{\n  \"opinions\": [\n    {\"persona\":\"Risk\",\"role\":\"Risk Officer\",\"opinion\":\"string\",\"score\":0},\n    {\"persona\":\"Architecture\",\"role\":\"Systems Architect\",\"opinion\":\"string\",\"score\":0},\n    {\"persona\":\"Growth\",\"role\":\"Revenue Lead\",\"opinion\":\"string\",\"score\":0}\n  ],\n  \"synthesis\":\"string\",\n  \"decision\":\"Approved|Rejected|Needs Revision\"${
              gateType === "Strategic"
                ? ',\n  \"pricing\": {\"currency\":\"USD\",\"lineItems\":[{\"label\":\"string\",\"amount\":0,\"cadence\":\"One-Time|Monthly|Usage\",\"notes\":\"string\"}],\"totalOneTime\":0,\"totalMonthly\":0,\"totalFirstMonth\":0,\"assumptions\":[\"string\"]}'
                : ""
            }\n}\n\nIf unsure, set decision to \"Needs Revision\".`,
          },
        ],
      });

      const parsed = extractFirstJsonObject<{
        opinions: CouncilOpinion[];
        synthesis: string;
        decision: CouncilDecision;
        pricing?: CouncilPricing;
      }>(chairmanText);

      const normalizeDecision = (input: unknown): CouncilDecision => {
        const raw = String(input ?? "").trim();
        if (raw === "Approved" || raw === "Rejected" || raw === "Needs Revision") return raw;
        if (/approve/i.test(raw)) return "Approved";
        if (/reject/i.test(raw)) return "Rejected";
        return "Needs Revision";
      };

      const roleForPersona = (persona: string): string => {
        const p = persona.toLowerCase();
        if (p.includes("risk")) return "Risk Officer";
        if (p.includes("arch")) return "Systems Architect";
        if (p.includes("growth") || p.includes("revenue")) return "Revenue Lead";
        return "Council Member";
      };

      const canonPersona = (input: string): "Risk" | "Architecture" | "Growth" | string => {
        const p = input.trim().toLowerCase();
        if (!p) return "";
        if (p.startsWith("risk")) return "Risk";
        if (p.startsWith("arch")) return "Architecture";
        if (p.startsWith("growth") || p.startsWith("revenue")) return "Growth";
        if (p === "security") return "Risk";
        return input.trim();
      };

      const normalizeOpinions = (input: unknown): CouncilOpinion[] => {
        const arr = Array.isArray(input) ? input : [];
        const mapped: CouncilOpinion[] = arr
          .map((o: any) => {
            const persona = canonPersona(String(o?.persona ?? o?.area ?? o?.theme ?? ""));
            const opinion = String(o?.opinion ?? o?.content ?? "").trim();
            const role = String(o?.role ?? roleForPersona(persona || "Council")).trim();
            const scoreRaw = typeof o?.score === "number" ? o.score : Number(o?.score);
            const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 80;
            return { persona: persona || "Council", role, opinion, score };
          })
          .filter((o) => Boolean(o.opinion));

        const byPersona = new Map<string, CouncilOpinion>();
        for (const o of mapped) {
          const key = canonPersona(o.persona) || o.persona;
          if (!byPersona.has(key)) byPersona.set(key, { ...o, persona: key });
        }

        const required: Array<"Risk" | "Architecture" | "Growth"> = ["Risk", "Architecture", "Growth"];
        const filled = required.map((p) => {
          const existing = byPersona.get(p);
          if (existing) return { ...existing, persona: p, role: existing.role || roleForPersona(p) };
          return {
            persona: p,
            role: roleForPersona(p),
            opinion: p === "Risk"
              ? "Key risks are unclear; define scope, data handling, rollback, and monitoring before go-live."
              : p === "Architecture"
                ? "Architecture details missing; confirm integrations, credentials, and a minimal test plan."
                : "Define a measurable pilot and package deliverables into a clear offer to close faster.",
            score: 75,
          };
        });

        return filled;
      };

      if (parsed) {
        const normalizedOpinions = normalizeOpinions((parsed as any)?.opinions);
        const normalizedDecision = normalizeDecision((parsed as any)?.decision);
        const synthesis = String((parsed as any)?.synthesis ?? "").trim();

        openRouterSession = {
          id: `session-${Date.now()}`,
          projectId,
          gateType,
          topic,
          opinions: normalizedOpinions,
          synthesis,
          decision: normalizedDecision,
          pricing: (parsed as any)?.pricing,
          modelOutputs: firstOpinions,
          chairmanModel,
          stage2Rankings,
          labelToModel,
          aggregateRankings,
          createdAt: new Date().toISOString(),
        };
      }
    } catch {
      openRouterSession = null;
    }
  }

  if (openRouterSession) {
    session = openRouterSession;
  } else if (!ai) {
    session = {
      id: `session-${Date.now()}`,
      projectId,
      gateType,
      topic,
      opinions: [
        language === "tr"
          ? { persona: "Risk", role: "Risk Officer", opinion: "Kapsamı minimumda tut ve mutlaka rollback (geri dönüş) planı ekle.", score: 72 }
          : { persona: "Risk", role: "Risk Officer", opinion: "Proceed with a minimal scope and add a rollback plan.", score: 72 },
        language === "tr"
          ? { persona: "Architecture", role: "Systems Architect", opinion: "Bilinen bir workflow şablonundan başla; code node’lardan kaçın.", score: 78 }
          : { persona: "Architecture", role: "Systems Architect", opinion: "Start from a known workflow template; avoid custom code nodes.", score: 78 },
        language === "tr"
          ? { persona: "Growth", role: "Revenue Lead", opinion: "10 dakikalık demo paketle: lead → CRM → teklif → fatura.", score: 81 }
          : { persona: "Growth", role: "Revenue Lead", opinion: "Package as a 10‑minute demo: lead → CRM → proposal → invoice.", score: 81 },
      ],
      synthesis:
        language === "tr"
          ? "Revizyonla ilerle: kapsamı kilitle, credential checklist çıkar, canlıya almadan önce mutlaka test çalıştır."
          : "Approved with revisions: lock scope, define credential checklist, and run a test execution before go-live.",
      decision: "Needs Revision",
      createdAt: new Date().toISOString(),
    };
  } else {
    const pricingHint =
      gateType === "Strategic"
        ? "\nAlso include an optional pricing object: {currency, lineItems[{label,amount,cadence:\"One-Time\"|\"Monthly\"|\"Usage\",notes}], totalOneTime, totalMonthly, totalFirstMonth, assumptions[]}."
        : "";
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `${language === "tr" ? "Türkçe yaz.\n" : ""}Execute Council Gate protocol.\nGate: ${gateType}\nTopic: ${topic}\nProject Context: ${JSON.stringify(context)}\nProvide Risk, Architecture, and Growth opinions plus a final synthesis and decision.${pricingHint}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: schemas.council,
      },
    });

    const parsed = JSON.parse(response.text || "{}") as {
      opinions: CouncilOpinion[];
      synthesis: string;
      decision: CouncilDecision;
      pricing?: CouncilPricing;
    };

    session = {
      id: `session-${Date.now()}`,
      projectId,
      gateType,
      topic,
      opinions: parsed.opinions ?? [],
      synthesis: parsed.synthesis ?? "",
      decision: parsed.decision ?? "Needs Revision",
      pricing: parsed.pricing,
      createdAt: new Date().toISOString(),
    };
  }

  const deriveProjectFromContext = async (): Promise<Project | null> => {
    try {
      if (context && typeof context === "object") {
        const maybe = context as any;
        if (maybe?.brief && maybe?.status) return maybe as Project;
      }
    } catch {
      // ignore
    }
    return (await getProject(projectId)) ?? null;
  };

  const projectForBrief = await deriveProjectFromContext();
  const stageId: Project["status"] = (projectForBrief?.status as any) || "Intake";
  const stageLabel =
    language === "tr"
      ? ({ Intake: "İntake", Proposal: "Teklif", Developing: "Geliştirme", Testing: "Test", Live: "Canlı" } as const)[stageId]
      : stageId;

  const formatMoney = (currency: string, amount: number): string => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const safeCurrency = typeof currency === "string" && currency.trim().length ? currency.trim().toUpperCase() : "USD";
    try {
      return new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: safeCurrency }).format(safeAmount);
    } catch {
      return `${safeCurrency} ${safeAmount.toFixed(0)}`;
    }
  };

  const deriveNextSteps = (): string[] => {
    const client = projectForBrief?.brief?.clientName ? `"${projectForBrief.brief.clientName}"` : "bu proje";
    const common = language === "tr"
      ? [
          `Bu hafta hedef: ${client} için “tek sayfalık teklif + çalışan demo” çıkarmak.`,
          "3 adet workflow seç (aşağıdaki önerilerden başla) ve JSON’ları indir.",
          "Lead listesini yükle → AI Pitch ile 10 kişiye ilk mesajı çıkar.",
          "Sözleşme + ilk ay fatura adımını hazırlayıp gönder.",
        ]
      : [
          `This week goal: ship a 1-page offer + working demo for ${client}.`,
          "Pick 3 workflows (start from suggestions below) and download JSONs.",
          "Upload leads → generate 10 outreach messages with AI Pitch.",
          "Prepare contract + first invoice step.",
        ];

    const byStage: Record<Project["status"], string[]> =
      language === "tr"
        ? {
            Intake: ["Hedefi 1 cümleye indir (ne otomatikleşecek + KPI).", "Stratejik karar (fiyat + kapsam sınırı) al.", ...common],
            Proposal: ["Teklifi finalize et (scope + KPI + timeline).", "Stratejik karar (fiyat + kapsam) al ve gönder.", ...common],
            Developing: ["Workflow’ları import et (manual) ve ilk test çalıştır.", "Risk gate çalıştır (güvenlik + test planı).", ...common],
            Testing: ["Test senaryolarını bitir (başarısız senaryo dahil).", "Go‑Live gate çalıştır ve canlıya al.", ...common],
            Live: ["Haftalık rapor ritmi kur (1 sayfa).", "1 yeni otomasyon upsell planla (ayın 2. haftası).", ...common],
          }
        : {
            Intake: ["Reduce scope to 1 sentence (automation + KPI).", "Run Strategic decision (pricing + scope).", ...common],
            Proposal: ["Finalize proposal (scope + KPI + timeline).", "Run Strategic decision and send.", ...common],
            Developing: ["Import workflows (manual) and run first test.", "Run Risk gate (security + test plan).", ...common],
            Testing: ["Finish test scenarios (incl. failure case).", "Run Go‑Live gate and launch.", ...common],
            Live: ["Set a weekly 1-page report cadence.", "Plan 1 upsell automation for week 2.", ...common],
          };

    const picked = (byStage[stageId] ?? common).slice(0, 6);
    // Keep it non-technical and punchy.
    return picked.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 6);
  };

  const deriveMoneySteps = (): string[] => {
    const pricing = session.pricing;
    const currency = pricing?.currency || (language === "tr" ? "TRY" : "USD");
    const items = Array.isArray(pricing?.lineItems) ? pricing!.lineItems : [];
    const sumBy = (cadence: "One-Time" | "Monthly" | "Usage") =>
      items.filter((i) => i.cadence === cadence).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    const oneTime = Number.isFinite(pricing?.totalOneTime as any) ? Number(pricing?.totalOneTime) : sumBy("One-Time");
    const monthly = Number.isFinite(pricing?.totalMonthly as any) ? Number(pricing?.totalMonthly) : sumBy("Monthly");
    const firstMonth = Number.isFinite(pricing?.totalFirstMonth as any) ? Number(pricing?.totalFirstMonth) : oneTime + monthly;

    const lines: string[] = [];
    if (pricing && (oneTime > 0 || monthly > 0)) {
      lines.push(
        language === "tr"
          ? `Fiyat önerisi: ${formatMoney(currency, oneTime)} kurulum + ${formatMoney(currency, monthly)}/ay (ilk ay ≈ ${formatMoney(currency, firstMonth)}).`
          : `Pricing suggestion: ${formatMoney(currency, oneTime)} setup + ${formatMoney(currency, monthly)}/mo (first month ≈ ${formatMoney(currency, firstMonth)}).`,
      );
    } else {
      lines.push(
        language === "tr"
          ? "Fiyatı basit tut: 1 haftalık pilot (kurulum) + aylık bakım (retainer)."
          : "Keep pricing simple: 1-week pilot (setup) + monthly retainer.",
      );
    }

    lines.push(
      language === "tr"
        ? "Satış formülü: 10 hedef lead → 3 görüşme → 1 kapanış (her gün küçük kota)."
        : "Sales math: 10 target leads → 3 calls → 1 close (small daily quota).",
    );
    lines.push(
      language === "tr"
        ? "“10 dakikalık demo” paketle: lead → CRM → teklif taslağı → fatura akışı (1 oturumda)."
        : "Package a 10‑minute demo: lead → CRM → proposal draft → invoice flow (single session).",
    );
    lines.push(
      language === "tr"
        ? "Upsell: 2. ayda raporlama + izleme + SLA ekleyip retainer’ı büyüt."
        : "Upsell: in month 2 add reporting + monitoring + SLA to grow retainer.",
    );
    return lines.slice(0, 5);
  };

  const buildCatalogQuery = (): { query: string; requiredTags: string[] } => {
    const brief = projectForBrief?.brief;
    const text = [brief?.industry, brief?.description, ...(brief?.goals ?? []), ...(brief?.tools ?? [])].filter(Boolean).join(" ");
    const lower = text.toLowerCase();
    const tokens = new Set<string>();
    const add = (t: string) => {
      for (const part of t.split(/[^a-z0-9]+/i).map((s) => s.trim().toLowerCase())) {
        if (!part) continue;
        tokens.add(part);
      }
    };

    if (/(lead|intake|başvuru|form|typeform|tally|webhook)/i.test(lower)) add("lead webhook form");
    if (/(crm|suitecrm)/i.test(lower)) add("crm suitecrm");
    if (/(invoice|fatura|billing|invoiceshelf)/i.test(lower)) add("invoice invoiceshelf billing");
    if (/(contract|sözleşme|imza|sign|documenso)/i.test(lower)) add("contract sign documenso");
    if (/(slack)/i.test(lower)) add("slack");
    if (/(notion)/i.test(lower)) add("notion");
    if (/(google\\s*sheets|sheets|sheet)/i.test(lower)) add("google sheets");
    if (/(youtube)/i.test(lower)) add("youtube analytics");
    if (/(facebook\\s*ads|meta\\s*ads|google\\s*ads)/i.test(lower)) add("facebook ads google ads");
    if (/(shopify|woocommerce|ecom|e-commerce)/i.test(lower)) add("shopify woocommerce stripe");

    if (tokens.size === 0) add("webhook crm invoice");

    const query = [...tokens].join(" ");
    const requiredTags: string[] = [];
    if (query.includes("webhook")) requiredTags.push("webhook");
    if (query.includes("slack")) requiredTags.push("slack");
    if (query.includes("google") || query.includes("sheets")) requiredTags.push("google sheets");
    return { query, requiredTags: requiredTags.slice(0, 3) };
  };

  const catalogPlan = buildCatalogQuery();
  let workflowSuggestions: CouncilSession["workflowSuggestions"] = undefined;
  try {
    const found = await searchCatalog({ query: catalogPlan.query, limit: 3, requiredTags: catalogPlan.requiredTags });
    workflowSuggestions = found.map((wf) => {
      const matches = catalogPlan.requiredTags.filter((t) => wf.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase())));
      const reason =
        language === "tr"
          ? matches.length
            ? `Eşleşen entegrasyonlar: ${matches.join(", ")}`
            : "Brief ile uyumlu şablon (düşük/orta kurulum)"
          : matches.length
            ? `Matches: ${matches.join(", ")}`
            : "Brief-aligned template (lower setup effort)";
      return {
        workflow: {
          id: wf.id,
          name: wf.name,
          description: wf.description,
          tags: wf.tags,
          jsonUrl: `/api/catalog/workflow/${wf.id}/raw`,
          complexity: wf.complexity,
          credentials: wf.credentials,
        },
        score: wf.score,
        installPlan: buildInstallPlan(wf),
        reason,
      };
    });
  } catch {
    workflowSuggestions = undefined;
  }

  session = {
    ...session,
    language,
    boardName,
    currentStage: { id: stageId, label: stageLabel },
    boardSummary:
      language === "tr"
        ? `${boardName}: Şu an ${stageLabel} aşamasındayız. Şimdi “net teklif + çalışan demo + ilk satış” şeklinde ilerleyelim.`
        : `${boardName}: You are currently in ${stageLabel}. Next: ship a clear offer + working demo + first sale.`,
    nextSteps: deriveNextSteps(),
    moneySteps: deriveMoneySteps(),
    suggestedCatalogQuery: { query: catalogPlan.query, requiredTags: catalogPlan.requiredTags },
    workflowSuggestions: workflowSuggestions?.length ? workflowSuggestions : undefined,
  };

  const existing = await readJsonFile<CouncilSession[]>("council-sessions.json", []);
  await writeJsonFile("council-sessions.json", [...existing, session]);

  return res.json(session);
});

app.post("/api/council/playground", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  const language = req.body?.language === "en" ? ("en" as const) : ("tr" as const);
  const boardName = language === "tr" ? "Yönetim Kurulu" : "Management Board";

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const councilModels = String(process.env.COUNCIL_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chairmanModel = String(process.env.COUNCIL_CHAIRMAN_MODEL ?? councilModels[0] ?? "").trim();
  const stage2Enabled = String(process.env.COUNCIL_STAGE2_ENABLED ?? "true").trim().toLowerCase() !== "false";

  const now = new Date().toISOString();

	  if (openRouterKey && councilModels.length >= 2 && chairmanModel) {
	    try {
	      const personas = [
	        {
	          id: "strategy",
	          roleTr: "Strateji Üyesi",
	          roleEn: "Strategy Member",
	          focusTr: "Teklif/paket, konumlandırma, fiyatlandırma, değer önerisi",
	          focusEn: "Offer/packages, positioning, pricing, value proposition",
	        },
	        {
	          id: "risk",
	          roleTr: "Risk Üyesi",
	          roleEn: "Risk Member",
	          focusTr: "Güvenlik, KVKK/PII, gerçekçilik, edge-case’ler, yanlış vaatlerden kaçınma",
	          focusEn: "Security, privacy, realism, edge cases, avoiding over-promises",
	        },
	        {
	          id: "ops",
	          roleTr: "Operasyon Üyesi",
	          roleEn: "Ops Member",
	          focusTr: "Teslimat planı, checklist, test/izleme, bakım maliyeti, sade uygulama",
	          focusEn: "Delivery plan, checklist, testing/monitoring, maintenance cost, simple implementation",
	        },
	        {
	          id: "growth",
	          roleTr: "Büyüme Üyesi",
	          roleEn: "Growth Member",
	          focusTr: "Hedef kitle (ICP), kanallar, outreach mesajları, teklif sunumu, kapanış",
	          focusEn: "ICP, channels, outreach messages, pitch, closing",
	        },
	      ] as const;

	      const stage1Settled = await Promise.allSettled(
	        councilModels.map(async (model, idx) => {
	          const persona = personas[idx % personas.length];
	          const system =
	            language === "tr"
	              ? [
	                  `Türkçe yaz. Sen AgencyOS ${boardName} üyesisin: ${persona.roleTr}.`,
	                  `Odak: ${persona.focusTr}.`,
	                  "Kurallar: az teknik, net ve uygulanabilir yaz; gereksiz tekrar yok.",
	                  "Sadece kendi rolünün açısından cevap ver (maks. 10 madde).",
	                  "Fiyat/kazanç varsa: sayılar + varsayımlar ver. Outbound varsa: kısa mesaj şablonları ver.",
	                ].join("\n")
	              : [
	                  `Write in English. You are an AgencyOS ${boardName} member: ${persona.roleEn}.`,
	                  `Focus: ${persona.focusEn}.`,
	                  "Rules: low-jargon, practical, no fluff.",
	                  "Respond ONLY from your role (max 10 bullets).",
	                  "If pricing/revenue: include numbers + assumptions. If outbound: include short message templates.",
	                ].join("\n");

	          const content = await openRouterChat({
	            apiKey: openRouterKey,
	            model,
	            timeoutMs: 25_000,
	            maxTokens: 800,
	            messages: [
	              {
	                role: "system",
	                content: system,
	              },
	              { role: "user", content: prompt },
	            ],
	            temperature: 0.2,
	          });
	          return { model, content };
	        }),
	      );

      const stage1 = stage1Settled
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((v): v is { model: string; content: string } => Boolean(v && String(v.content ?? "").trim().length > 0));

      if (stage1.length === 0) {
        throw new Error("Council playground produced no outputs");
      }

      const labels = stage1.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
      const labelToModel: Record<string, string> = Object.fromEntries(
        labels.map((label, i) => [`Response ${label}`, stage1[i]?.model ?? "unknown"]),
      );

      const responsesText = labels
        .map((label, i) => `Response ${label}:\n${stage1[i]?.content ?? ""}`)
        .join("\n\n");

      const rankingPrompt = `You are evaluating different responses to the following question:

Question: ${prompt}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Now provide your evaluation and ranking:`;

      const stage2Raw = stage2Enabled
        ? (
            await Promise.allSettled(
              councilModels.map(async (model) => {
                const content = await openRouterChat({
                  apiKey: openRouterKey,
                  model,
                  timeoutMs: 22_000,
                  maxTokens: 900,
                  messages: [{ role: "user", content: rankingPrompt }],
                  temperature: 0.1,
                });
                return { model, content };
              }),
            )
          )
            .map((r) => (r.status === "fulfilled" ? r.value : null))
            .filter((v): v is { model: string; content: string } => Boolean(v && String(v.content ?? "").trim().length > 0))
        : [];

      const stage2 = stage2Enabled
        ? stage2Raw.map((r) => ({
            model: r.model,
            content: r.content,
            parsedRanking: parseRankingFromText(r.content),
          }))
        : [];

      const aggregateRankings = stage2Enabled ? calculateAggregateRankings(stage2, labelToModel) : [];

      const chairmanPrompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${prompt}

STAGE 1 - Individual Responses:
${stage1.map((r) => `Model: ${r.model}\nResponse:\n${r.content}`).join("\n\n")}

STAGE 2 - Peer Rankings:
${stage2.map((r) => `Model: ${r.model}\nRanking:\n${r.content}`).join("\n\n")}

STAGE 2 - Aggregate Rankings:
${JSON.stringify(aggregateRankings)}

      Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Provide ONLY the final answer text.`;

	      const final = await openRouterChat({
	        apiKey: openRouterKey,
	        model: chairmanModel,
	        timeoutMs: 45_000,
	        maxTokens: 1600,
	        messages: [
	          {
	            role: "system",
	            content:
	              language === "tr"
	                ? [
	                    "Türkçe yaz. Ajans sahibine göre: az teknik, net, uygulanabilir.",
	                    "Çıktı formatı: başlık + bölümler (Teklif, Fiyat/Kazanç, ICP+Kanallar, Mesaj Şablonları, Demo/Pilot, 7 Gün Plan, Riskler).",
	                    "Gereksiz tekrar yok; varsayımları belirt; sayılar ver.",
	                  ].join("\n")
	                : [
	                    "Write in English. Low-jargon, direct, and practical for an agency owner.",
	                    "Output format: title + sections (Offer, Pricing/Revenue, ICP+Channels, Outreach Messages, Demo/Pilot, 7-Day Plan, Risks).",
	                    "No fluff; state assumptions; include numbers.",
	                  ].join("\n"),
	          },
	          { role: "user", content: chairmanPrompt },
	        ],
	        temperature: 0.2,
	      });

      return res.json({
        id: `councilpg-${Date.now()}`,
        prompt,
        stage1,
        stage2,
        labelToModel,
        aggregateRankings,
        chairmanModel,
        final: { model: chairmanModel, content: final },
        createdAt: now,
      });
    } catch (e) {
      return res.status(502).json({ error: e instanceof Error ? e.message : "Council playground failed" });
    }
  }

  const ai = getGeminiClient();
  if (!ai) return res.status(400).json({ error: "Council not configured (set OPENROUTER_API_KEY or GEMINI_API_KEY)" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `${language === "tr" ? "Türkçe yaz.\n" : ""}${prompt}`,
    });
    return res.json({
      id: `councilpg-${Date.now()}`,
      prompt,
      stage1: [],
      stage2: [],
      labelToModel: {},
      aggregateRankings: [],
      chairmanModel: "gemini-3-pro-preview",
      final: { model: "gemini-3-pro-preview", content: response.text || "" },
      createdAt: now,
    });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "Council playground failed" });
  }
});

app.get("/api/council/sessions", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const sessions = await readJsonFile<CouncilSession[]>("council-sessions.json", []);
  res.json(projectId ? sessions.filter((s) => s.projectId === projectId) : sessions);
});

// ============================================
// AGENCY BUILDER ROUTES
// ============================================

import { discoverNiches, generateSolution, matchWorkflows, getMarketPricing } from "./lib/agencyBuilder";

// Get available sectors
app.get("/api/agency-builder/sectors", async (_req, res) => {
  // Return static sector data - the actual data is in the frontend component
  res.json({
    sectors: [
      { id: "ecom", name: "E-commerce", icon: "🛒" },
      { id: "marketing", name: "Marketing", icon: "📣" },
      { id: "finance", name: "Finance", icon: "💰" },
      { id: "realestate", name: "Real Estate", icon: "🏠" },
      { id: "saas", name: "SaaS", icon: "☁️" },
      { id: "support", name: "Customer Support", icon: "🎧" },
      { id: "healthcare", name: "Healthcare", icon: "🏥" },
      { id: "education", name: "Education", icon: "📚" },
      { id: "hr", name: "HR & Recruiting", icon: "👥" },
      { id: "legal", name: "Legal", icon: "⚖️" },
      { id: "content", name: "Content Creation", icon: "🎬" },
      { id: "logistics", name: "Logistics", icon: "📦" },
    ],
  });
});

// Discover niches using AI
app.post("/api/agency-builder/discover-niches", async (req, res) => {
  const sectorId = String(req.body?.sectorId ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const language = req.body?.language === "tr" ? "tr" : "en";

  if (!sectorId) return res.status(400).json({ error: "Missing sectorId" });
  if (!description) return res.status(400).json({ error: "Missing description" });

  try {
    // Get sector name (simplified lookup)
    const sectorNames: Record<string, string> = {
      ecom: "E-commerce",
      marketing: "Marketing",
      finance: "Finance",
      realestate: "Real Estate",
      saas: "SaaS",
      support: "Customer Support",
      healthcare: "Healthcare",
      education: "Education",
      hr: "HR & Recruiting",
      legal: "Legal",
      content: "Content Creation",
      logistics: "Logistics",
    };

    const result = await discoverNiches({
      sectorId,
      sectorName: sectorNames[sectorId] || sectorId,
      description,
      language,
    });
    res.json(result);
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Niche discovery failed");
    const payload: Record<string, unknown> = { error: err.message || "Niche discovery failed" };
    const details = (e as any)?.details;
    if (details) payload.details = details;
    res.status(502).json(payload);
  }
});

// Generate complete agency solution
app.post("/api/agency-builder/generate-solution", async (req, res) => {
  const sectorId = String(req.body?.sectorId ?? "").trim();
  const sectorName = String(req.body?.sectorName ?? "").trim();
  const nicheId = req.body?.nicheId ? String(req.body.nicheId).trim() : undefined;
  const nicheName = req.body?.nicheName ? String(req.body.nicheName).trim() : undefined;
  const customDescription = req.body?.customDescription ? String(req.body.customDescription).trim() : undefined;
  const targetRegion = req.body?.targetRegion ? String(req.body.targetRegion).trim() : undefined;
  const language = req.body?.language === "tr" ? "tr" : "en";

  if (!sectorId) return res.status(400).json({ error: "Missing sectorId" });
  if (!sectorName) return res.status(400).json({ error: "Missing sectorName" });

  try {
    const solution = await generateSolution({
      sectorId,
      sectorName,
      nicheId,
      nicheName,
      customDescription,
      targetRegion,
      language,
    });
    res.json(solution);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Solution generation failed" });
  }
});

// Match workflows for a solution
app.post("/api/agency-builder/match-workflows", async (req, res) => {
  const sectorId = String(req.body?.sectorId ?? "").trim();
  const nicheId = req.body?.nicheId ? String(req.body.nicheId).trim() : undefined;
  const serviceTypes = Array.isArray(req.body?.serviceTypes) ? req.body.serviceTypes : [];
  const keywords = Array.isArray(req.body?.keywords) ? req.body.keywords : [];

  if (!sectorId) return res.status(400).json({ error: "Missing sectorId" });

  try {
    const recommendations = await matchWorkflows({
      sectorId,
      nicheId,
      serviceTypes,
      keywords,
    });
    res.json({ recommendations });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Workflow matching failed" });
  }
});

// Get market pricing data
app.get("/api/agency-builder/pricing/:industry", async (req, res) => {
  const industry = req.params.industry;
  const region = typeof req.query.region === "string" ? req.query.region : undefined;
  const complexity = typeof req.query.complexity === "string" ? req.query.complexity as any : undefined;

  try {
    const pricing = await getMarketPricing({
      industry,
      region,
      complexity,
    });
    res.json(pricing);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Pricing lookup failed" });
  }
});

// Get/save agency builder state
app.get("/api/agency-builder/state", async (_req, res) => {
  const state = await readJsonFile("agency-builder-state.json", {
    currentStep: "sector",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.json(state);
});

app.put("/api/agency-builder/state", async (req, res) => {
  try {
    const current = await readJsonFile("agency-builder-state.json", {});
    const next = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile("agency-builder-state.json", next);
    res.json(next);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid state payload" });
  }
});

// Install workflows for deployed solution
app.post("/api/agency-builder/install-workflows", async (req, res) => {
  const workflowIds = Array.isArray(req.body?.workflowIds) ? req.body.workflowIds : [];

  if (!workflowIds.length) return res.status(400).json({ error: "Missing workflowIds" });

  const results: Array<{ workflowId: string; status: "success" | "error"; message?: string }> = [];

  for (const workflowId of workflowIds) {
    try {
      // Get workflow JSON
      const workflowJson = await readWorkflowJsonById(workflowId);
      if (!workflowJson) {
        results.push({ workflowId, status: "error", message: "Workflow not found" });
        continue;
      }

      // Import to n8n
      const created = await createWorkflow(workflowJson);
      if (!created?.id) {
        results.push({ workflowId, status: "error", message: "Failed to create in n8n" });
        continue;
      }

      // Activate
      await activateWorkflow(created.id);
      results.push({ workflowId, status: "success" });
    } catch (e) {
      results.push({
        workflowId,
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  res.json({
    installed: successCount,
    total: workflowIds.length,
    results,
  });
});

function resolveExplicitPort(): number | null {
  const raw = String(process.env.AGENCYOS_API_PORT ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

async function listenOnPort(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => resolve());
    server.on("error", (err) => {
      try {
        server.close();
      } catch {
        // ignore
      }
      reject(err);
    });
  });
}

const explicitPort = resolveExplicitPort();
// If a user copied `.env.example` (7000) on macOS, 7000 is often taken (ControlCenter).
// In that case, still fall back to 7001 so `npm run dev:api` "just works".
const portsToTry = explicitPort ? (explicitPort === 7000 ? [7000, 7001] : [explicitPort]) : [7000, 7001];
let listeningPort: number | null = null;
let lastError: unknown = null;

for (const port of portsToTry) {
  try {
    await listenOnPort(port);
    listeningPort = port;
    break;
  } catch (e) {
    lastError = e;
  }
}

if (!listeningPort) {
  throw lastError instanceof Error ? lastError : new Error("Failed to bind API port");
}

// eslint-disable-next-line no-console
console.log(`[agencyos-api] listening on http://localhost:${listeningPort}`);
