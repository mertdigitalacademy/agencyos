import type {
  AgencyDocument,
  AgencyDocumentType,
  AgencyState,
  AppLanguage,
  AssistantPreferences,
  AssistantState,
  CouncilGate,
  CouncilSession,
  JourneyGoal,
  MarketLeadCandidate,
  MarketLeadPitch,
  MarketInternetTrend,
  MarketOpportunity,
  MarketRadarState,
  MarketTrendVideo,
  MarketVideoIdea,
  OutboundLead,
  PassiveIdea,
  Project,
  ProjectBrief,
  RevenueGoal,
  WorkflowCandidate,
  Workflow,
} from "../types";
import { getAuthHeader } from "../src/lib/supabase";

async function apiJson<T>(path: string, init?: RequestInit, opts?: { timeoutMs?: number }): Promise<T> {
  const controller = opts?.timeoutMs ? new AbortController() : null;
  const timeout = opts?.timeoutMs
    ? setTimeout(() => controller?.abort(), Math.max(1000, opts.timeoutMs))
    : null;

  const authHeaders = await getAuthHeader();

  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...authHeaders, ...(init?.headers ?? {}) },
      ...init,
      signal: init?.signal ?? controller?.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("API timeout");
    }
    throw e;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

export async function getApiMeta(): Promise<{ apiBaseUrl: string }> {
  return apiJson<{ apiBaseUrl: string }>("/api/meta");
}

export async function getAgencyState(): Promise<AgencyState> {
  return apiJson<AgencyState>("/api/agency");
}

export async function updateAgencyState(
  patch: Partial<{ goal: JourneyGoal; completedTaskIds: string[]; revenueGoal: RevenueGoal }>,
): Promise<AgencyState> {
  return apiJson<AgencyState>("/api/agency", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function generateAgencyDocument(params: { type: AgencyDocumentType; markTaskId?: string }): Promise<{ agency: AgencyState; document: AgencyDocument }> {
  return apiJson<{ agency: AgencyState; document: AgencyDocument }>("/api/agency/docs/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function analyzeIntake(input: string): Promise<Partial<ProjectBrief>> {
  return apiJson<Partial<ProjectBrief>>("/api/intake/analyze", {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export async function searchWorkflowCatalog(params: {
  query: string;
  limit?: number;
  requiredTags?: string[];
}): Promise<WorkflowCandidate[]> {
  const { query, limit = 20, requiredTags = [] } = params;
  const res = await apiJson<{ items: WorkflowCandidate[] }>("/api/catalog/search", {
    method: "POST",
    body: JSON.stringify({ query, limit, requiredTags }),
  });

  return res.items.map((c) => ({
    ...c,
    workflow: { ...c.workflow, installPlan: c.installPlan },
  }));
}

export async function getCatalogStats(): Promise<{ workflows: number }> {
  return apiJson<{ workflows: number }>("/api/catalog/stats");
}

export async function reindexCatalog(): Promise<{ ok: boolean; workflows: number }> {
  return apiJson<{ ok: boolean; workflows: number }>("/api/catalog/reindex", { method: "POST" });
}

export async function rewriteCatalogQuery(params: { query: string }): Promise<{ query: string; requiredTags: string[]; keywords: string[]; notes?: string }> {
  return apiJson<{ query: string; requiredTags: string[]; keywords: string[]; notes?: string }>("/api/catalog/query-rewrite", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function runCouncilSession(params: {
  projectId: string;
  gateType: CouncilGate;
  topic: string;
  context: unknown;
  language?: 'tr' | 'en';
  timeoutMs?: number;
}): Promise<CouncilSession> {
  return apiJson<CouncilSession>("/api/council/run", {
    method: "POST",
    body: JSON.stringify(params),
  }, { timeoutMs: params.timeoutMs });
}

export async function listCouncilSessions(projectId?: string): Promise<CouncilSession[]> {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiJson<CouncilSession[]>(`/api/council/sessions${q}`);
}

export async function runCouncilPlayground(params: { prompt: string; language?: 'tr' | 'en' }): Promise<{
  id: string;
  prompt: string;
  stage1: Array<{ model: string; content: string }>;
  stage2: Array<{ model: string; content: string; parsedRanking: string[] }>;
  labelToModel: Record<string, string>;
  aggregateRankings: Array<{ model: string; averageRank: number; rankingsCount: number }>;
  chairmanModel: string;
  final: { model: string; content: string };
  createdAt: string;
}> {
  return apiJson<{
    id: string;
    prompt: string;
    stage1: Array<{ model: string; content: string }>;
    stage2: Array<{ model: string; content: string; parsedRanking: string[] }>;
    labelToModel: Record<string, string>;
    aggregateRankings: Array<{ model: string; averageRank: number; rankingsCount: number }>;
    chairmanModel: string;
    final: { model: string; content: string };
    createdAt: string;
  }>("/api/council/playground", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getProjects(): Promise<Project[]> {
  return apiJson<Project[]>("/api/projects");
}

export async function seedDemoProjects(): Promise<{ projects: Project[]; createdIds: string[] }> {
  return apiJson<{ projects: Project[]; createdIds: string[] }>("/api/demo/seed", { method: "POST" });
}

export async function createProject(brief: ProjectBrief): Promise<Project> {
  return apiJson<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ brief }),
  });
}

export async function saveProject(project: Project): Promise<Project> {
  return apiJson<Project>(`/api/projects/${encodeURIComponent(project.id)}`, {
    method: "PUT",
    body: JSON.stringify({ project }),
  });
}

export async function installWorkflowToProject(params: {
  projectId: string;
  workflowId: string;
  activate?: boolean;
}): Promise<{ project: Project; workflow: Workflow }> {
  const { projectId, workflowId, activate = false } = params;
  return apiJson<{ project: Project; workflow: Workflow }>(
    `/api/projects/${encodeURIComponent(projectId)}/workflows/install`,
    {
      method: "POST",
      body: JSON.stringify({ workflowId, activate }),
    },
  );
}

export async function getExecutiveSummary(): Promise<string> {
  const res = await apiJson<{ text: string }>("/api/ai/executive-summary");
  return res.text;
}

export async function getStrategicAdvice(projectId: string): Promise<string> {
  const res = await apiJson<{ text: string }>("/api/ai/strategic-advice", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  return res.text;
}

export async function getPivotAnalysis(projectId: string): Promise<{ assessment: string; recommendation: string; urgency: number }> {
  return apiJson<{ assessment: string; recommendation: string; urgency: number }>("/api/ai/pivot-analysis", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export async function generateProposal(projectId: string): Promise<string> {
  const res = await apiJson<{ text: string }>("/api/ai/proposal", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  return res.text;
}

export async function generateSOW(projectId: string): Promise<string> {
  const res = await apiJson<{ text: string }>("/api/ai/sow", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
  return res.text;
}

export async function getOperatorResponse(params: {
  projectId: string;
  query: string;
}): Promise<{ content: string; toolCall?: { name: string; args: Record<string, unknown> } }> {
  return apiJson<{ content: string; toolCall?: { name: string; args: Record<string, unknown> } }>("/api/operator/respond", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getN8nIntegrationStatus(): Promise<{ connected: boolean; baseUrl: string; reason?: string; sample?: any }> {
  return apiJson<{ connected: boolean; baseUrl: string; reason?: string; sample?: any }>("/api/integrations/n8n");
}

export async function getRuntimeSettings(): Promise<{
  activeEnvironment: "Development" | "Staging" | "Production";
  n8nBaseUrl: string;
  suitecrmBaseUrl: string;
  invoiceshelfBaseUrl: string;
  documensoBaseUrl: string;
  infisicalBaseUrl: string;
  infisicalWorkspaceId: string;
  infisicalSecretPath: string;
  infisicalEnvDevelopmentSlug: string;
  infisicalEnvStagingSlug: string;
  infisicalEnvProductionSlug: string;
  councilModels: string;
  councilChairmanModel: string;
  councilStage2Enabled: boolean;
}> {
  return apiJson<{
    activeEnvironment: "Development" | "Staging" | "Production";
    n8nBaseUrl: string;
    suitecrmBaseUrl: string;
    invoiceshelfBaseUrl: string;
    documensoBaseUrl: string;
    infisicalBaseUrl: string;
    infisicalWorkspaceId: string;
    infisicalSecretPath: string;
    infisicalEnvDevelopmentSlug: string;
    infisicalEnvStagingSlug: string;
    infisicalEnvProductionSlug: string;
    councilModels: string;
    councilChairmanModel: string;
    councilStage2Enabled: boolean;
  }>("/api/settings");
}

export async function updateRuntimeSettings(patch: Partial<{
  activeEnvironment: "Development" | "Staging" | "Production";
  n8nBaseUrl: string;
  suitecrmBaseUrl: string;
  invoiceshelfBaseUrl: string;
  documensoBaseUrl: string;
  infisicalBaseUrl: string;
  infisicalWorkspaceId: string;
  infisicalSecretPath: string;
  infisicalEnvDevelopmentSlug: string;
  infisicalEnvStagingSlug: string;
  infisicalEnvProductionSlug: string;
  councilModels: string;
  councilChairmanModel: string;
  councilStage2Enabled: boolean;
}>): Promise<{
  activeEnvironment: "Development" | "Staging" | "Production";
  n8nBaseUrl: string;
  suitecrmBaseUrl: string;
  invoiceshelfBaseUrl: string;
  documensoBaseUrl: string;
  infisicalBaseUrl: string;
  infisicalWorkspaceId: string;
  infisicalSecretPath: string;
  infisicalEnvDevelopmentSlug: string;
  infisicalEnvStagingSlug: string;
  infisicalEnvProductionSlug: string;
  councilModels: string;
  councilChairmanModel: string;
  councilStage2Enabled: boolean;
}> {
  return apiJson<{
    activeEnvironment: "Development" | "Staging" | "Production";
    n8nBaseUrl: string;
    suitecrmBaseUrl: string;
    invoiceshelfBaseUrl: string;
    documensoBaseUrl: string;
    infisicalBaseUrl: string;
    infisicalWorkspaceId: string;
    infisicalSecretPath: string;
    infisicalEnvDevelopmentSlug: string;
    infisicalEnvStagingSlug: string;
    infisicalEnvProductionSlug: string;
    councilModels: string;
    councilChairmanModel: string;
    councilStage2Enabled: boolean;
  }>("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
}

export async function listSecrets(): Promise<Array<{
  id: string;
  key: string;
  value: string;
  hasValue: boolean;
  environment: "Development" | "Staging" | "Production";
  lastUpdated: string;
}>> {
  return apiJson<Array<{
    id: string;
    key: string;
    value: string;
    hasValue: boolean;
    environment: "Development" | "Staging" | "Production";
    lastUpdated: string;
  }>>("/api/secrets");
}

export async function upsertSecret(params: {
  id?: string;
  key: string;
  value: string;
  environment: "Development" | "Staging" | "Production";
}): Promise<{
  id: string;
  key: string;
  value: string;
  hasValue: boolean;
  environment: "Development" | "Staging" | "Production";
  lastUpdated: string;
}> {
  return apiJson<{
    id: string;
    key: string;
    value: string;
    hasValue: boolean;
    environment: "Development" | "Staging" | "Production";
    lastUpdated: string;
  }>("/api/secrets", { method: "PUT", body: JSON.stringify(params) });
}

export async function deleteSecretById(id: string): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>(`/api/secrets/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getIntegrationStatuses(): Promise<{
  n8n: { connected: boolean; baseUrl: string; reason?: string; sample?: any };
  suitecrm: { connected: boolean; baseUrl: string; reason?: string };
  invoiceshelf: { connected: boolean; baseUrl: string; reason?: string };
  documenso: { connected: boolean; baseUrl: string; reason?: string };
  infisical: { connected: boolean; baseUrl: string; reason?: string };
  apify: { connected: boolean; baseUrl: string; reason?: string };
  postgres: { connected: boolean; baseUrl: string; reason?: string };
}> {
  return apiJson<{
    n8n: { connected: boolean; baseUrl: string; reason?: string; sample?: any };
    suitecrm: { connected: boolean; baseUrl: string; reason?: string };
    invoiceshelf: { connected: boolean; baseUrl: string; reason?: string };
    documenso: { connected: boolean; baseUrl: string; reason?: string };
    infisical: { connected: boolean; baseUrl: string; reason?: string };
    apify: { connected: boolean; baseUrl: string; reason?: string };
    postgres: { connected: boolean; baseUrl: string; reason?: string };
  }>("/api/integrations/status");
}

export async function getMarketRadarState(): Promise<{
  state: MarketRadarState;
  apify: { connected: boolean; reason?: string; hasToken: boolean; hasYoutubeActor: boolean; hasLeadsActor: boolean };
}> {
  return apiJson<{
    state: MarketRadarState;
    apify: { connected: boolean; reason?: string; hasToken: boolean; hasYoutubeActor: boolean; hasLeadsActor: boolean };
  }>("/api/market/state");
}

export async function generateMarketOpportunities(params: {
  goal: JourneyGoal;
  country: string;
  city: string;
  niche?: string;
  language: AppLanguage;
  count?: number;
}): Promise<{ items: MarketOpportunity[]; source: "ai" | "mock"; state: MarketRadarState }> {
  return apiJson<{ items: MarketOpportunity[]; source: "ai" | "mock"; state: MarketRadarState }>("/api/market/opportunities", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchYouTubeTrends(params: {
  country: string;
  language: AppLanguage;
  limit?: number;
}): Promise<{ items: MarketTrendVideo[]; source: "mock" | "apify"; error?: string; state: MarketRadarState }> {
  return apiJson<{ items: MarketTrendVideo[]; source: "mock" | "apify"; error?: string; state: MarketRadarState }>("/api/market/youtube/trends", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchInternetTrends(params: {
  limit?: number;
  sources?: Array<"hackernews" | "github">;
}): Promise<{ items: MarketInternetTrend[]; source: "web" | "mock"; error?: string; state: MarketRadarState }> {
  return apiJson<{ items: MarketInternetTrend[]; source: "web" | "mock"; error?: string; state: MarketRadarState }>("/api/market/internet/trends", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function generateYouTubeIdeas(params: {
  goal: JourneyGoal;
  country: string;
  niche: string;
  language: AppLanguage;
  trends?: MarketTrendVideo[];
  count?: number;
}): Promise<{ items: MarketVideoIdea[]; source: "ai" | "mock"; state: MarketRadarState }> {
  return apiJson<{ items: MarketVideoIdea[]; source: "ai" | "mock"; state: MarketRadarState }>("/api/market/youtube/ideas", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function searchLocalLeads(params: {
  country: string;
  city: string;
  query: string;
  language: AppLanguage;
  limit?: number;
}): Promise<{ items: MarketLeadCandidate[]; source: "mock" | "apify"; error?: string; state: MarketRadarState }> {
  return apiJson<{ items: MarketLeadCandidate[]; source: "mock" | "apify"; error?: string; state: MarketRadarState }>("/api/market/leads/search", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function generateLeadPitch(params: {
  goal: JourneyGoal;
  language: AppLanguage;
  lead: MarketLeadCandidate;
  opportunity?: MarketOpportunity | null;
}): Promise<MarketLeadPitch> {
  return apiJson<MarketLeadPitch>("/api/market/leads/pitch", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listOutboundLeads(): Promise<OutboundLead[]> {
  const res = await apiJson<{ items: OutboundLead[] }>("/api/outbound/leads");
  return Array.isArray(res.items) ? res.items : [];
}

export async function createOutboundLead(lead: Partial<OutboundLead>): Promise<OutboundLead> {
  const res = await apiJson<{ lead: OutboundLead }>("/api/outbound/leads", {
    method: "POST",
    body: JSON.stringify(lead),
  });
  return res.lead;
}

export async function updateOutboundLead(id: string, patch: Partial<OutboundLead>): Promise<OutboundLead> {
  const res = await apiJson<{ lead: OutboundLead }>(`/api/outbound/leads/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return res.lead;
}

export async function deleteOutboundLead(id: string): Promise<{ removed: boolean }> {
  return apiJson<{ removed: boolean }>(`/api/outbound/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getAssistantState(): Promise<AssistantState> {
  return apiJson<AssistantState>("/api/assistant/state");
}

export async function resetAssistantState(): Promise<AssistantState> {
  return apiJson<AssistantState>("/api/assistant/reset", { method: "POST" });
}

export async function patchAssistantPreferences(patch: Partial<AssistantPreferences>): Promise<AssistantState> {
  return apiJson<AssistantState>("/api/assistant/preferences", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function assistantRespond(params: { message: string; language: AppLanguage }): Promise<{ state: AssistantState; reply: { content: string; toolCall?: { name: string; args: Record<string, unknown> }; preferencesPatch?: Partial<AssistantPreferences> } }> {
  return apiJson<{ state: AssistantState; reply: { content: string; toolCall?: { name: string; args: Record<string, unknown> }; preferencesPatch?: Partial<AssistantPreferences> } }>(
    "/api/assistant/respond",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
}

export async function assistantLog(params: { role?: "user" | "assistant" | "system"; content: string; toolCall?: { name: string; args: Record<string, unknown> } }): Promise<AssistantState> {
  return apiJson<AssistantState>("/api/assistant/log", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listPassiveIdeas(): Promise<PassiveIdea[]> {
  const res = await apiJson<{ ideas: PassiveIdea[] }>("/api/passive/ideas");
  return res.ideas ?? [];
}

export async function generatePassiveIncomePlan(params: { ideaId: string; goal?: JourneyGoal; language: AppLanguage }): Promise<{ agency: AgencyState; document: AgencyDocument; ideaId: string }> {
  return apiJson<{ agency: AgencyState; document: AgencyDocument; ideaId: string }>("/api/passive/plan", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function generatePassiveIncomeAsset(params: { ideaId: string; assetIndex: number; goal?: JourneyGoal; language: AppLanguage }): Promise<{ agency: AgencyState; document: AgencyDocument; ideaId: string; assetIndex: number }> {
  return apiJson<{ agency: AgencyState; document: AgencyDocument; ideaId: string; assetIndex: number }>("/api/passive/asset", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getProjectExecutions(params: {
  projectId: string;
  limit?: number;
}): Promise<{ connected: boolean; baseUrl: string; executions: any[]; reason?: string }> {
  const limit = params.limit ?? 20;
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  return apiJson<{ connected: boolean; baseUrl: string; executions: any[]; reason?: string }>(
    `/api/projects/${encodeURIComponent(params.projectId)}/executions?${q.toString()}`,
  );
}

export async function activateProjectWorkflow(params: {
  projectId: string;
  workflowId: string;
}): Promise<Project> {
  return apiJson<Project>(
    `/api/projects/${encodeURIComponent(params.projectId)}/workflows/${encodeURIComponent(params.workflowId)}/activate`,
    { method: "POST" },
  );
}

export async function invoiceShelfLogin(params: { username: string; password: string; deviceName?: string }): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>("/api/integrations/invoiceshelf/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createInvoiceShelfInvoice(params: {
  projectId: string;
  amount: number;
  description?: string;
}): Promise<{ project: Project; invoice: { id?: any; invoice_number?: any; invoice_pdf_url?: any } }> {
  const { projectId, amount, description } = params;
  return apiJson<{ project: Project; invoice: { id?: any; invoice_number?: any; invoice_pdf_url?: any } }>(
    `/api/projects/${encodeURIComponent(projectId)}/financials/invoiceshelf/invoice`,
    {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    },
  );
}

export async function createInvoiceShelfInvoiceFromCouncil(params: {
  projectId: string;
  sessionId: string;
  mode?: "first_month" | "setup" | "monthly" | "all";
}): Promise<{
  project: Project;
  invoice: { id?: any; invoice_number?: any; invoice_pdf_url?: any };
  council: { sessionId: string; currency: string; total: number };
}> {
  const { projectId, sessionId, mode = "first_month" } = params;
  return apiJson<{
    project: Project;
    invoice: { id?: any; invoice_number?: any; invoice_pdf_url?: any };
    council: { sessionId: string; currency: string; total: number };
  }>(`/api/projects/${encodeURIComponent(projectId)}/financials/invoiceshelf/invoice-from-council`, {
    method: "POST",
    body: JSON.stringify({ sessionId, mode }),
  });
}

export async function syncInvoiceShelfInvoiceStatuses(params: {
  projectId: string;
}): Promise<{
  project: Project;
  summary: { checked: number; updated: number; errors: Array<{ invoiceId: number; error: string }> };
  changes: Array<{ documentId: string; invoiceId: number; from: string; to: string }>;
}> {
  return apiJson<{
    project: Project;
    summary: { checked: number; updated: number; errors: Array<{ invoiceId: number; error: string }> };
    changes: Array<{ documentId: string; invoiceId: number; from: string; to: string }>;
  }>(`/api/projects/${encodeURIComponent(params.projectId)}/financials/invoiceshelf/sync`, { method: "POST" });
}

export async function createSuiteCrmLead(params: {
  projectId: string;
}): Promise<{ project: Project; lead: { id: string } }> {
  const { projectId } = params;
  return apiJson<{ project: Project; lead: { id: string } }>(
    `/api/projects/${encodeURIComponent(projectId)}/crm/suitecrm/lead`,
    { method: "POST" },
  );
}

export async function createSuiteCrmLeadDirect(params: {
  lastName: string;
  description?: string;
  status?: string;
  leadSource?: string;
}): Promise<{ baseUrl: string; lead: { id: string; url?: string } }> {
  return apiJson<{ baseUrl: string; lead: { id: string; url?: string } }>("/api/crm/suitecrm/lead", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listSuiteCrmLeads(params: {
  projectId: string;
  limit?: number;
  scope?: "project" | "agencyos" | "all";
}): Promise<{
  baseUrl: string;
  leads: Array<{ id: string; last_name?: string; status?: string; lead_source?: string; date_entered?: string; description?: string }>;
  totalCount: number | null;
}> {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  if (params.scope) q.set("scope", String(params.scope));
  const qs = q.toString();
  return apiJson<{
    baseUrl: string;
    leads: Array<{ id: string; last_name?: string; status?: string; lead_source?: string; date_entered?: string; description?: string }>;
    totalCount: number | null;
  }>(`/api/projects/${encodeURIComponent(params.projectId)}/crm/suitecrm/leads${qs ? `?${qs}` : ""}`);
}

export async function documensoMe(): Promise<{ name: string }> {
  return apiJson<{ name: string }>("/api/integrations/documenso/me");
}

export async function listDocumensoTemplates(params?: {
  page?: number;
  perPage?: number;
}): Promise<{ templates: Array<{ id: number; title: string; type?: string }>; totalPages: number }> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.perPage) q.set("perPage", String(params.perPage));
  const qs = q.toString();
  return apiJson<{ templates: Array<{ id: number; title: string; type?: string }>; totalPages: number }>(
    `/api/integrations/documenso/templates${qs ? `?${qs}` : ""}`,
  );
}

export async function getDocumensoTemplate(templateId: number): Promise<{
  id: number;
  title: string;
  type?: string;
  Recipient: Array<{ id: number; name: string; email: string; role?: string; signingOrder?: number | null }>;
}> {
  return apiJson<{
    id: number;
    title: string;
    type?: string;
    Recipient: Array<{ id: number; name: string; email: string; role?: string; signingOrder?: number | null }>;
  }>(`/api/integrations/documenso/templates/${encodeURIComponent(String(templateId))}`);
}

export async function listDocumensoDocuments(params?: {
  page?: number;
  perPage?: number;
}): Promise<{ documents: Array<{ id: number; title: string; status: string; createdAt: string; completedAt?: string | null }>; totalPages: number }> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.perPage) q.set("perPage", String(params.perPage));
  const qs = q.toString();
  return apiJson<{ documents: any[]; totalPages: number }>(`/api/integrations/documenso/documents${qs ? `?${qs}` : ""}`);
}

export async function sendDocumensoContract(params: {
  projectId: string;
  templateId: number;
  title?: string;
  recipients: Array<{ name: string; email: string }>;
  sendEmail?: boolean;
  subject?: string;
  message?: string;
  redirectUrl?: string;
}): Promise<{ project: Project; documenso: { documentId: number; recipients: Array<{ recipientId: number; signingUrl: string; email: string; name: string }> } }> {
  const { projectId, ...body } = params;
  return apiJson<{ project: Project; documenso: { documentId: number; recipients: any[] } }>(
    `/api/projects/${encodeURIComponent(projectId)}/contracts/documenso/send`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function syncDocumensoContractStatuses(params: {
  projectId: string;
}): Promise<{
  project: Project;
  summary: { checked: number; updated: number; errors: Array<{ documensoId: number; error: string }> };
  changes: Array<{ documentId: string; documensoId: number; from: string; to: string }>;
}> {
  return apiJson<{
    project: Project;
    summary: { checked: number; updated: number; errors: Array<{ documensoId: number; error: string }> };
    changes: Array<{ documentId: string; documensoId: number; from: string; to: string }>;
  }>(`/api/projects/${encodeURIComponent(params.projectId)}/contracts/documenso/sync`, { method: "POST" });
}

export async function listInfisicalSecrets(params?: {
  env?: "Development" | "Staging" | "Production";
  recursive?: boolean;
  includeValues?: boolean;
}): Promise<{
  workspaceId: string;
  environmentName: "Development" | "Staging" | "Production";
  environmentSlug: string;
  secretPath: string;
  secrets: Array<{ key: string; value: string; hasValue: boolean; comment: string; version: number }>;
  imports: any[];
}> {
  const q = new URLSearchParams();
  if (params?.env) q.set("env", params.env);
  if (params?.recursive) q.set("recursive", "true");
  if (params?.includeValues) q.set("includeValues", "true");
  const qs = q.toString();
  return apiJson<{
    workspaceId: string;
    environmentName: "Development" | "Staging" | "Production";
    environmentSlug: string;
    secretPath: string;
    secrets: Array<{ key: string; value: string; hasValue: boolean; comment: string; version: number }>;
    imports: any[];
  }>(`/api/integrations/infisical/secrets${qs ? `?${qs}` : ""}`);
}

export async function pushInfisicalSync(params?: { scope?: "active" | "all" }): Promise<{
  ok: true;
  scope: "active" | "all";
  pushed: number;
  errors: Array<{ key: string; environment: string; error: string }>;
}> {
  return apiJson<{
    ok: true;
    scope: "active" | "all";
    pushed: number;
    errors: Array<{ key: string; environment: string; error: string }>;
  }>("/api/integrations/infisical/sync/push", {
    method: "POST",
    body: JSON.stringify({ scope: params?.scope ?? "active" }),
  });
}

export async function pullInfisicalSync(params?: { recursive?: boolean }): Promise<{
  ok: true;
  imported: number;
  activeEnvironment: "Development" | "Staging" | "Production";
  environmentSlug: string;
  secretPath: string;
}> {
  return apiJson<{
    ok: true;
    imported: number;
    activeEnvironment: "Development" | "Staging" | "Production";
    environmentSlug: string;
    secretPath: string;
  }>("/api/integrations/infisical/sync/pull", {
    method: "POST",
    body: JSON.stringify({ recursive: params?.recursive ?? false }),
  });
}
