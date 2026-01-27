/**
 * AgencyOS - Netlify Serverless API
 *
 * This function handles all API requests for AgencyOS.
 * For long-running operations (Council meetings), it creates jobs in the
 * council_jobs table and returns immediately. The Supabase Edge Function
 * (council-worker) processes these jobs asynchronously.
 */

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// Import storage and handlers
import { isSupabaseEnabled, getSupabasePool } from "../../server/lib/supabaseStorage";
import * as projects from "../../server/lib/projects";
import * as assistantStore from "../../server/lib/assistantStore";
import * as runtimeStore from "../../server/lib/runtimeStore";
import { generateAssistantReply } from "../../server/lib/assistant";
import { readAgencyState, patchAgencyState, addAgencyDocument } from "../../server/lib/agency";
import {
  readMarketRadarState,
  marketGenerateOpportunities,
  marketFetchYouTubeTrends,
  marketGenerateYouTubeIdeas,
  marketSearchLeads,
  marketGenerateLeadPitch,
} from "../../server/lib/marketRadar";
import { fetchInternetTrends } from "../../server/lib/internetTrends";
import { listOutboundLeads, createOutboundLead, updateOutboundLead, deleteOutboundLead } from "../../server/lib/outbound";
import { listPassiveIdeas, generatePassiveIdeaPlan, generatePassiveAsset } from "../../server/lib/passiveIncome";
import {
  generateExecutiveSummary,
  generateStrategicAdvice,
  analyzeStrategicPivot,
  generateProposal,
  generateSow,
  generateAgencyDocument,
  getOperatorResponse,
} from "../../server/lib/ai";
import { getCatalogIndex, searchCatalog, readWorkflowJsonById, resetCatalogIndexCache } from "../../server/lib/catalog";
import { rewriteCatalogQueryFallback } from "../../server/lib/queryRewrite";
import type { JourneyGoal, AgencyDocumentType } from "../../types";

// ============================================
// TYPES
// ============================================

type RouteHandler = (
  event: HandlerEvent,
  context: HandlerContext,
  params: Record<string, string>,
  userId: string | null
) => Promise<HandlerResponse>;

type Route = {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
};

// ============================================
// HELPERS
// ============================================

function json(data: unknown, statusCode = 200): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    },
    body: JSON.stringify(data),
  };
}

function error(message: string, statusCode = 500): HandlerResponse {
  return json({ error: message }, statusCode);
}

function parseBody<T>(event: HandlerEvent): T {
  if (!event.body) return {} as T;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return {} as T;
  }
}

function pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${pattern}$`), paramNames };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Extract userId from JWT Bearer token via Supabase Auth.
 * Returns null if no token or invalid token.
 */
async function extractUserId(event: HandlerEvent): Promise<string | null> {
  const authHeader = event.headers["authorization"] || event.headers["Authorization"];
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  try {
    const sb = createClient(url, key);
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/** Helper: return 401 if not authenticated */
function requireAuth(userId: string | null): HandlerResponse | null {
  if (!userId) return error("Unauthorized — please log in", 401);
  return null;
}

// ============================================
// PER-USER SECRET LOADING
// ============================================

/**
 * Load THIS user's secrets from the database into process.env.
 * Each user stores their own API keys (e.g. OPENROUTER_API_KEY) via Settings → Vault.
 * Filtered by user_id for proper isolation.
 */
async function loadUserSecrets(userId: string | null): Promise<void> {
  if (!userId) return;

  const pool = getSupabasePool();
  if (!pool) return;

  try {
    const result = await pool.query(
      "SELECT key, value FROM secrets WHERE user_id = $1 AND environment = 'Production'",
      [userId]
    );
    for (const row of result.rows) {
      process.env[row.key] = row.value;
    }
  } catch (e) {
    console.warn("Failed to load user secrets:", e);
  }
}

// ============================================
// COUNCIL QUEUE SYSTEM
// ============================================

async function createCouncilJob(
  jobType: "council_run" | "council_playground" | "doc_generate",
  input: Record<string, unknown>
): Promise<string> {
  const pool = getSupabasePool();
  if (!pool) {
    throw new Error("Database not connected - cannot create council job");
  }

  const projectId = input.projectId ? String(input.projectId) : null;

  const result = await pool.query(
    `INSERT INTO council_jobs (job_type, status, input, progress, project_id, created_at)
     VALUES ($1, 'pending', $2, 0, $3, NOW())
     RETURNING id`,
    [jobType, JSON.stringify(input), projectId]
  );

  return result.rows[0].id;
}

async function getCouncilJob(jobId: string): Promise<{
  id: string;
  jobType: string;
  status: string;
  progress: number;
  result: unknown;
  error?: string;
}> {
  const pool = getSupabasePool();
  if (!pool) {
    throw new Error("Database not connected");
  }

  const result = await pool.query(
    "SELECT id, job_type, status, progress, result, error FROM council_jobs WHERE id = $1",
    [jobId]
  );

  if (result.rows.length === 0) {
    throw new Error("Job not found");
  }

  const row = result.rows[0];
  return {
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    progress: row.progress,
    result: row.result,
    error: row.error,
  };
}

// ============================================
// ROUTE HANDLERS
// ============================================

const routes: Route[] = [];

function route(method: string, path: string, handler: RouteHandler): void {
  const { pattern, paramNames } = pathToRegex(path);
  routes.push({ method, pattern, paramNames, handler });
}

// --- Health & Meta (PUBLIC — no auth required) ---

route("GET", "/api/health", async () => {
  return json({ ok: true, serverless: true, supabase: isSupabaseEnabled() });
});

route("GET", "/api/meta", async (event) => {
  const host = event.headers.host || "localhost";
  const proto = event.headers["x-forwarded-proto"] || "https";
  return json({ apiBaseUrl: `${proto}://${host}` });
});

// --- Assistant (AUTH REQUIRED) ---

route("GET", "/api/assistant/state", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const state = await assistantStore.readAssistantState();
  return json(state);
});

route("POST", "/api/assistant/reset", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  await assistantStore.resetAssistantState();
  return json({ ok: true });
});

route("PUT", "/api/assistant/preferences", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ preferences: Record<string, unknown> }>(event);
  if (body.preferences) {
    await assistantStore.patchAssistantPreferences(body.preferences as any);
  }
  const state = await assistantStore.readAssistantState();
  return json(state);
});

route("POST", "/api/assistant/respond", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const { message, language } = parseBody<{ message: string; language?: "tr" | "en" }>(event);
  if (!message) return error("Missing message", 400);

  const reply = await generateAssistantReply(message, language);
  await assistantStore.appendAssistantMessage({
    id: generateId("msg"),
    role: "user",
    content: message,
  });
  await assistantStore.appendAssistantMessage({
    id: generateId("msg"),
    role: "assistant",
    content: reply.content,
    toolCall: reply.toolCall,
  });

  return json({ reply: reply.content, toolCall: reply.toolCall });
});

route("POST", "/api/assistant/log", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ action: string; details?: Record<string, unknown> }>(event);
  if (!body.action) return error("Missing action", 400);

  await assistantStore.appendAssistantMessage({
    id: generateId("msg"),
    role: "system",
    content: `[${body.action}] ${body.details ? JSON.stringify(body.details) : ""}`,
  });
  return json({ ok: true });
});

// --- Agency (AUTH REQUIRED) ---

route("GET", "/api/agency", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const state = await readAgencyState();
  return json(state);
});

route("PUT", "/api/agency", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const updated = await patchAgencyState(body);
  return json(updated);
});

route("POST", "/api/agency/docs/generate", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const { docType, language } = parseBody<{ docType: string; language?: "tr" | "en" }>(event);
  if (!docType) return error("Missing docType", 400);

  const state = await readAgencyState();
  const content = await generateAgencyDocument({
    type: docType as AgencyDocumentType,
    goal: state.goal,
  });
  const doc = await addAgencyDocument({
    type: docType as AgencyDocumentType,
    name: docType,
    content,
  });
  return json(doc);
});

// --- Market Radar (AUTH REQUIRED) ---

route("GET", "/api/market/state", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const state = await readMarketRadarState();
  return json(state);
});

route("POST", "/api/market/opportunities", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const { goal, niche, language, country, city } = parseBody<{
    goal?: JourneyGoal;
    niche?: string;
    language?: "tr" | "en";
    country?: string;
    city?: string;
  }>(event);

  const result = await marketGenerateOpportunities({
    goal: goal || "automation_agency",
    niche,
    language,
    country,
    city,
  });
  return json({ opportunities: result.items });
});

route("POST", "/api/market/youtube/trends", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ country?: string; limit?: number }>(event);
  const trends = await marketFetchYouTubeTrends(body);
  return json({ trends });
});

route("POST", "/api/market/youtube/ideas", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const ideas = await marketGenerateYouTubeIdeas(body as any);
  return json({ ideas });
});

route("POST", "/api/market/internet/trends", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ count?: number }>(event);
  const trends = await fetchInternetTrends({ limit: body.count ?? 10 });
  return json({ trends });
});

route("POST", "/api/market/leads/search", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const result = await marketSearchLeads(body as any);
  return json({ leads: result.items });
});

route("POST", "/api/market/leads/pitch", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const pitch = await marketGenerateLeadPitch(body as any);
  return json({ pitch });
});

// --- Outbound Leads (AUTH REQUIRED) ---

route("GET", "/api/outbound/leads", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const leads = await listOutboundLeads();
  return json(leads);
});

route("POST", "/api/outbound/leads", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const lead = await createOutboundLead(body as any);
  return json(lead);
});

route("PUT", "/api/outbound/leads/:id", async (event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const lead = await updateOutboundLead(params.id, body as any);
  return json(lead);
});

route("DELETE", "/api/outbound/leads/:id", async (_event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  await deleteOutboundLead(params.id);
  return json({ ok: true });
});

// --- Passive Income (AUTH REQUIRED) ---

route("GET", "/api/passive/ideas", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const ideas = await listPassiveIdeas();
  return json(ideas);
});

route("POST", "/api/passive/plan", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const plan = await generatePassiveIdeaPlan(body as any);
  return json(plan);
});

route("POST", "/api/passive/asset", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const asset = await generatePassiveAsset(body as any);
  return json(asset);
});

// --- Settings & Secrets (AUTH REQUIRED) ---

route("GET", "/api/settings", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const settings = await runtimeStore.readRuntimeSettings();
  return json(settings);
});

route("PUT", "/api/settings", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const settings = await runtimeStore.updateRuntimeSettings(body as any);
  return json(settings);
});

route("GET", "/api/secrets", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const secrets = await runtimeStore.listSecretsRedacted();
  return json(secrets);
});

route("PUT", "/api/secrets", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ key: string; value: string; environment?: string }>(event);
  if (!body.key || body.value === undefined) return error("Missing key or value", 400);

  await runtimeStore.upsertSecret(body.key, body.value, body.environment as any);
  const secrets = await runtimeStore.listSecretsRedacted();
  return json(secrets);
});

route("DELETE", "/api/secrets/:id", async (_event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  await runtimeStore.deleteSecret(params.id);
  return json({ ok: true });
});

// --- AI Features (AUTH REQUIRED) ---

route("GET", "/api/ai/executive-summary", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const projectsList = await projects.listProjects(userId!);
  const summary = await generateExecutiveSummary(projectsList);
  return json({ summary });
});

route("POST", "/api/ai/strategic-advice", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ projectId?: string; language?: "tr" | "en" }>(event);
  if (!body.projectId) return error("Missing projectId", 400);

  const project = await projects.getProject(body.projectId);
  if (!project) return error("Project not found", 404);

  const advice = await generateStrategicAdvice(project);
  return json({ advice });
});

route("POST", "/api/ai/pivot-analysis", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ projectId: string; language?: "tr" | "en" }>(event);
  if (!body.projectId) return error("Missing projectId", 400);

  const project = await projects.getProject(body.projectId);
  if (!project) return error("Project not found", 404);

  const analysis = await analyzeStrategicPivot(project, body.language);
  return json({ analysis });
});

route("POST", "/api/ai/proposal", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const proposal = await generateProposal(body as any);
  return json({ proposal });
});

route("POST", "/api/ai/sow", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ projectId: string }>(event);
  if (!body.projectId) return error("Missing projectId", 400);

  const project = await projects.getProject(body.projectId);
  if (!project) return error("Project not found", 404);

  const sow = await generateSow(project);
  return json({ sow });
});

route("POST", "/api/operator/respond", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ projectId: string; message: string; language?: "tr" | "en" }>(event);
  if (!body.projectId || !body.message) return error("Missing projectId or message", 400);

  const project = await projects.getProject(body.projectId);
  if (!project) return error("Project not found", 404);

  const response = await getOperatorResponse(project, body.message, body.language);
  return json({ response });
});

// --- Projects (AUTH REQUIRED) ---

route("GET", "/api/projects", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const projectsList = await projects.listProjects(userId!);
  return json(projectsList);
});

route("POST", "/api/projects", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const project = await projects.createProject(body as any);
  return json(project);
});

route("GET", "/api/projects/:id", async (_event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const project = await projects.getProject(params.id);
  if (!project) return error("Project not found", 404);
  return json(project);
});

route("PUT", "/api/projects/:id", async (event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  const project = await projects.saveProject({ id: params.id, ...body } as any);
  return json(project);
});

// --- Catalog (AUTH REQUIRED) ---

route("POST", "/api/catalog/search", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ query: string; tags?: string[]; limit?: number }>(event);
  const results = await searchCatalog(body.query, body.tags, body.limit);
  return json(results);
});

route("GET", "/api/catalog/stats", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const index = await getCatalogIndex();
  return json({
    totalWorkflows: index.length,
    indexedAt: new Date().toISOString(),
  });
});

route("POST", "/api/catalog/reindex", async (_e, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  resetCatalogIndexCache();
  const index = await getCatalogIndex();
  return json({ reindexed: true, count: index.length });
});

route("POST", "/api/catalog/query-rewrite", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<{ query: string; language?: "tr" | "en" }>(event);
  const rewritten = await rewriteCatalogQueryFallback(body.query, body.language);
  return json({ original: body.query, rewritten });
});

route("GET", "/api/catalog/workflow/:id/raw", async (_event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const workflow = await readWorkflowJsonById(params.id);
  if (!workflow) return error("Workflow not found", 404);
  return json(workflow);
});

// --- Council (AUTH REQUIRED, Queue-based for Netlify) ---

route("POST", "/api/council/run", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  if (!body.projectId) return error("Missing projectId", 400);

  const jobId = await createCouncilJob("council_run", body);

  return json({
    jobId,
    status: "pending",
    message: "Council session queued. Poll /api/council/jobs/:jobId for status.",
  });
});

route("POST", "/api/council/playground", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const body = parseBody<Record<string, unknown>>(event);
  if (!body.prompt) return error("Missing prompt", 400);

  const jobId = await createCouncilJob("council_playground", body);

  return json({
    jobId,
    status: "pending",
    message: "Playground session queued. Poll /api/council/jobs/:jobId for status.",
  });
});

route("GET", "/api/council/jobs/:id", async (_event, _ctx, params, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  try {
    const job = await getCouncilJob(params.id);
    return json(job);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Job not found", 404);
  }
});

route("GET", "/api/council/sessions", async (event, _c, _p, userId) => {
  const deny = requireAuth(userId); if (deny) return deny;
  const projectId = event.queryStringParameters?.projectId;

  const pool = getSupabasePool();
  if (!pool) return json([]);

  // Filter by user's projects only
  let query = "SELECT cs.* FROM council_sessions cs";
  const qParams: string[] = [];
  if (projectId) {
    query += " WHERE cs.project_id = $1";
    qParams.push(projectId);
  }
  query += " ORDER BY cs.created_at DESC LIMIT 50";

  const result = await pool.query(query, qParams);
  return json(result.rows);
});

// --- Demo (PUBLIC) ---

route("POST", "/api/demo/seed", async () => {
  const { seedDemoProjects } = await import("../../server/lib/demo");
  await seedDemoProjects();
  return json({ ok: true });
});

// ============================================
// MAIN HANDLER
// ============================================

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      },
      body: "",
    };
  }

  // Authenticate: extract userId from JWT token
  const userId = await extractUserId(event);

  // Load this user's secrets (API keys) from DB
  await loadUserSecrets(userId);

  const path = event.path.replace("/.netlify/functions/api", "/api");
  const method = event.httpMethod;

  // Find matching route
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = path.match(r.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    r.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });

    try {
      return await r.handler(event, context, params, userId);
    } catch (e) {
      console.error(`Error in ${method} ${path}:`, e);
      return error(e instanceof Error ? e.message : "Internal server error", 500);
    }
  }

  return error(`Not found: ${method} ${path}`, 404);
};
