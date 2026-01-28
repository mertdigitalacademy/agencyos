/**
 * Supabase Storage Layer for AgencyOS
 *
 * This module provides storage operations using the Supabase JS Client (PostgREST).
 * It replaces the previous pg Pool implementation to work from environments
 * without direct PostgreSQL access (e.g., Netlify Functions with IPv6-only DB).
 *
 * Usage:
 * - Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables to enable
 * - The service role key bypasses Row Level Security for server-side operations
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Project,
  ProjectBrief,
  ProjectDocument,
  Workflow,
  ExecutionLog,
  ProjectIncident,
  OperatorMessage,
  CRMActivity,
  CouncilSession,
  AssistantState,
  AssistantMessage,
  AssistantPreferences,
  OutboundLead,
  AgencyState,
  AgencyDocument,
  MarketRadarState,
  MarketOpportunity,
  MarketTrendVideo,
  MarketVideoIdea,
  MarketInternetTrend,
  MarketLeadCandidate,
  AgencyBuilderState,
  Proposal,
  FinancialTransaction,
} from "../../types";
import type { RuntimeSettings, StoredSecret, EnvironmentName } from "./runtimeStore";

// ============================================
// CONNECTION MANAGEMENT
// ============================================

let client: SupabaseClient | null = null;

export function isSupabaseEnabled(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL ?? "").trim() &&
    (process.env.SUPABASE_SERVICE_KEY ?? "").trim()
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseEnabled()) return null;
  if (client) return client;
  client = createClient(
    process.env.SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_KEY!.trim()
  );
  return client;
}

/** @deprecated Use getSupabaseClient() instead. Kept for backward compat during migration. */
export const getSupabasePool = getSupabaseClient;

function requireClient(): SupabaseClient {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_KEY)");
  return sb;
}

export async function supabaseHealthcheck(): Promise<{ connected: boolean; reason?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { connected: false, reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY" };
  try {
    const { error } = await sb.from("projects").select("id").limit(1);
    if (error) return { connected: false, reason: error.message };
    return { connected: true };
  } catch (e) {
    return { connected: false, reason: e instanceof Error ? e.message : "Connection failed" };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Throw if Supabase returns an error */
function throwIfError(error: { message: string; code?: string } | null, context?: string): void {
  if (error) {
    throw new Error(`${context ? context + ": " : ""}${error.message}`);
  }
}

// ============================================
// USERS (for multi-tenant support)
// ============================================

export async function createUser(email: string, name?: string): Promise<{ id: string; email: string; name?: string }> {
  const sb = requireClient();

  const { data, error } = await sb
    .from("users")
    .upsert({ email, display_name: name ?? null, updated_at: nowIso() }, { onConflict: "email" })
    .select("id, email, display_name")
    .single();

  throwIfError(error, "createUser");
  return { id: data!.id, email: data!.email, name: data!.display_name ?? undefined };
}

/**
 * Ensure a user record exists for the given Supabase Auth user.
 * This is called on every authenticated request to handle the FK constraint.
 */
export async function ensureUserExists(authUserId: string, email: string): Promise<void> {
  const sb = requireClient();

  // Upsert: if user already exists by this id, do nothing
  const { error } = await sb.from("users").upsert({
    id: authUserId,
    email,
    updated_at: nowIso(),
  }, { onConflict: "id" });

  // Ignore errors silently — user might already exist
  if (error) {
    console.warn("ensureUserExists warning:", error.message);
  }
}

export async function getUserByEmail(email: string): Promise<{ id: string; email: string; name?: string } | null> {
  const sb = requireClient();

  const { data, error } = await sb
    .from("users")
    .select("id, email, display_name")
    .eq("email", email)
    .maybeSingle();

  throwIfError(error, "getUserByEmail");
  return data ? { id: data.id, email: data.email, name: data.display_name ?? undefined } : null;
}

// ============================================
// PROJECTS
// ============================================

export async function listProjects(userId?: string): Promise<Project[]> {
  const sb = requireClient();

  // Fetch projects with briefs
  let query = sb.from("projects").select("*, project_briefs(*)").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);

  const { data: projects, error } = await query;
  throwIfError(error, "listProjects");
  if (!projects || projects.length === 0) return [];

  // For each project, fetch related data in parallel
  const results = await Promise.all(
    projects.map(async (p: Record<string, unknown>) => {
      const id = String(p.id);
      const [wf, docs, logs, incidents, chat, crm] = await Promise.all([
        sb.from("project_workflows").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("project_documents").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("execution_logs").select("*").eq("project_id", id).order("timestamp", { ascending: false }).limit(100),
        sb.from("project_incidents").select("*").eq("project_id", id).order("timestamp", { ascending: false }),
        sb.from("operator_chat").select("*").eq("project_id", id).order("created_at", { ascending: true }),
        sb.from("crm_activities").select("*").eq("project_id", id).order("timestamp", { ascending: false }),
      ]);
      return assembleProject(p, wf.data ?? [], docs.data ?? [], logs.data ?? [], incidents.data ?? [], chat.data ?? [], crm.data ?? []);
    })
  );

  return results;
}

export async function getProject(projectId: string, userId?: string): Promise<Project | null> {
  const sb = requireClient();

  let query = sb.from("projects").select("*, project_briefs(*)").eq("id", projectId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getProject");
  if (!data) return null;

  const id = String(data.id);
  const [wf, docs, logs, incidents, chat, crm] = await Promise.all([
    sb.from("project_workflows").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    sb.from("project_documents").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    sb.from("execution_logs").select("*").eq("project_id", id).order("timestamp", { ascending: false }).limit(100),
    sb.from("project_incidents").select("*").eq("project_id", id).order("timestamp", { ascending: false }),
    sb.from("operator_chat").select("*").eq("project_id", id).order("created_at", { ascending: true }),
    sb.from("crm_activities").select("*").eq("project_id", id).order("timestamp", { ascending: false }),
  ]);

  return assembleProject(data, wf.data ?? [], docs.data ?? [], logs.data ?? [], incidents.data ?? [], chat.data ?? [], crm.data ?? []);
}

export async function createProject(brief: ProjectBrief, userId?: string): Promise<Project> {
  const sb = requireClient();
  const now = nowIso();

  // Insert project (financials/governance are computed defaults, not DB columns)
  const { error: projErr } = await sb.from("projects").upsert({
    id: brief.id,
    user_id: userId ?? null,
    status: "Intake",
    total_billed: 0,
    created_at: now,
    updated_at: now,
  }, { onConflict: "id", ignoreDuplicates: true });
  throwIfError(projErr, "createProject:project");

  // Insert brief
  const { error: briefErr } = await sb.from("project_briefs").upsert({
    project_id: brief.id,
    client_name: brief.clientName,
    description: brief.description,
    industry: brief.industry,
    goals: brief.goals,
    tools: brief.tools,
    budget: brief.budget,
    risk_level: brief.riskLevel,
  }, { onConflict: "project_id" });
  throwIfError(briefErr, "createProject:brief");

  // Insert initial CRM activity
  const { error: crmErr } = await sb.from("crm_activities").insert({
    id: generateId("crm"),
    project_id: brief.id,
    type: "Note",
    subject: "Project Initialized from Intake Wizard",
    status: "Completed",
    timestamp: now,
  });
  throwIfError(crmErr, "createProject:crm");

  // Insert initial operator message
  const { error: chatErr } = await sb.from("operator_chat").insert({
    id: generateId("msg"),
    project_id: brief.id,
    role: "system",
    content: `Operator initialized for ${brief.clientName}. I am connected to your n8n MCP server cluster.`,
    created_at: now,
  });
  throwIfError(chatErr, "createProject:chat");

  const project = await getProject(brief.id, userId);
  if (!project) throw new Error("Failed to retrieve created project");
  return project;
}

export async function saveProject(project: Project, userId?: string): Promise<Project> {
  const sb = requireClient();
  const now = nowIso();

  // Update main project (financials/governance are not DB columns)
  let updateQuery = sb.from("projects").update({
    status: project.status,
    total_billed: project.totalBilled,
    updated_at: now,
  }).eq("id", project.id);
  if (userId) updateQuery = updateQuery.eq("user_id", userId);

  const { error: projErr } = await updateQuery;
  throwIfError(projErr, "saveProject:project");

  // Update brief
  const { error: briefErr } = await sb.from("project_briefs").update({
    client_name: project.brief.clientName,
    description: project.brief.description,
    industry: project.brief.industry,
    goals: project.brief.goals,
    tools: project.brief.tools,
    budget: project.brief.budget,
    risk_level: project.brief.riskLevel,
  }).eq("project_id", project.id);
  throwIfError(briefErr, "saveProject:brief");

  // Sync sub-tables: delete + re-insert
  const subTables = [
    { table: "project_workflows", data: project.activeWorkflows.map((wf) => ({
      id: wf.id, project_id: project.id, name: wf.name, description: wf.description,
      tags: wf.tags, json_url: wf.jsonUrl, complexity: wf.complexity, credentials: wf.credentials,
      install_plan: wf.installPlan ?? null, deployment: wf.deployment ?? null, created_at: now,
    }))},
    { table: "project_documents", data: project.documents.map((doc) => ({
      id: doc.id, project_id: project.id, name: doc.name, type: doc.type, status: doc.status,
      content: doc.content, url: doc.url, amount: doc.amount, external_ref: doc.externalRef ?? null,
      created_at: doc.createdAt,
    }))},
    { table: "execution_logs", data: project.executionLogs.slice(-100).map((log) => ({
      id: log.id, project_id: project.id, workflow_name: log.workflowName, status: log.status,
      error_details: log.errorDetails, timestamp: log.timestamp, duration: log.duration,
    }))},
    { table: "project_incidents", data: project.incidents.map((inc) => ({
      id: inc.id, project_id: project.id, title: inc.title, severity: inc.severity,
      status: inc.status, root_cause: inc.rootCause, resolution_plan: inc.resolutionPlan, timestamp: inc.timestamp,
    }))},
    { table: "operator_chat", data: project.operatorChat.map((msg) => ({
      id: msg.id, project_id: project.id, role: msg.role, content: msg.content,
      tool_call: msg.toolCall ?? null, created_at: now,
    }))},
    { table: "crm_activities", data: project.crmActivities.map((act) => ({
      id: act.id, project_id: project.id, type: act.type, subject: act.subject,
      status: act.status, timestamp: act.timestamp,
    }))},
  ];

  for (const { table, data } of subTables) {
    const { error: delErr } = await sb.from(table).delete().eq("project_id", project.id);
    throwIfError(delErr, `saveProject:delete:${table}`);
    if (data.length > 0) {
      const { error: insErr } = await sb.from(table).insert(data);
      throwIfError(insErr, `saveProject:insert:${table}`);
    }
  }

  return project;
}

export async function deleteProject(projectId: string, userId?: string): Promise<void> {
  const sb = requireClient();

  let query = sb.from("projects").delete().eq("id", projectId);
  if (userId) query = query.eq("user_id", userId);

  const { error } = await query;
  throwIfError(error, "deleteProject");
}

function assembleProject(
  row: Record<string, unknown>,
  workflows: Record<string, unknown>[],
  documents: Record<string, unknown>[],
  executionLogs: Record<string, unknown>[],
  incidents: Record<string, unknown>[],
  operatorChat: Record<string, unknown>[],
  crmActivities: Record<string, unknown>[],
): Project {
  // project_briefs comes as an array or object from Supabase join
  const briefData = Array.isArray(row.project_briefs)
    ? row.project_briefs[0] ?? {}
    : row.project_briefs ?? {};

  const brief: ProjectBrief = {
    id: String(row.id),
    clientName: String((briefData as Record<string, unknown>).client_name ?? ""),
    description: String((briefData as Record<string, unknown>).description ?? ""),
    industry: (briefData as Record<string, unknown>).industry ? String((briefData as Record<string, unknown>).industry) : undefined,
    goals: Array.isArray((briefData as Record<string, unknown>).goals) ? (briefData as Record<string, unknown>).goals as string[] : [],
    tools: Array.isArray((briefData as Record<string, unknown>).tools) ? (briefData as Record<string, unknown>).tools as string[] : [],
    budget: String((briefData as Record<string, unknown>).budget ?? ""),
    riskLevel: ((briefData as Record<string, unknown>).risk_level as "Low" | "Medium" | "High") ?? "Low",
  };

  const mappedWorkflows: Workflow[] = workflows.map((w) => ({
    id: String(w.id),
    name: String(w.name ?? ""),
    description: String(w.description ?? ""),
    tags: Array.isArray(w.tags) ? w.tags : [],
    jsonUrl: String(w.json_url ?? ""),
    complexity: (w.complexity as "Low" | "Medium" | "High") ?? "Low",
    credentials: Array.isArray(w.credentials) ? w.credentials : [],
    installPlan: w.install_plan as Workflow["installPlan"],
    deployment: w.deployment as Workflow["deployment"],
  }));

  const mappedDocuments: ProjectDocument[] = documents.map((d) => ({
    id: String(d.id),
    name: String(d.name ?? ""),
    type: (d.type as ProjectDocument["type"]) ?? "Report",
    status: (d.status as ProjectDocument["status"]) ?? "Draft",
    content: d.content ? String(d.content) : undefined,
    url: String(d.url ?? ""),
    amount: d.amount ? Number(d.amount) : undefined,
    externalRef: d.external_ref as ProjectDocument["externalRef"],
    createdAt: String(d.created_at ?? nowIso()),
  }));

  const mappedLogs: ExecutionLog[] = executionLogs.map((l) => ({
    id: String(l.id),
    workflowName: String(l.workflow_name ?? ""),
    status: (l.status as ExecutionLog["status"]) ?? "Success",
    errorDetails: l.error_details ? String(l.error_details) : undefined,
    timestamp: String(l.timestamp ?? nowIso()),
    duration: String(l.duration ?? "0s"),
  }));

  const mappedIncidents: ProjectIncident[] = incidents.map((i) => ({
    id: String(i.id),
    title: String(i.title ?? ""),
    severity: (i.severity as ProjectIncident["severity"]) ?? "Low",
    status: (i.status as ProjectIncident["status"]) ?? "Open",
    rootCause: i.root_cause ? String(i.root_cause) : undefined,
    resolutionPlan: i.resolution_plan ? String(i.resolution_plan) : undefined,
    timestamp: String(i.timestamp ?? nowIso()),
  }));

  const mappedChat: OperatorMessage[] = operatorChat.map((m) => ({
    id: String(m.id),
    role: (m.role as OperatorMessage["role"]) ?? "system",
    content: String(m.content ?? ""),
    toolCall: m.tool_call as OperatorMessage["toolCall"],
  }));

  const mappedCrm: CRMActivity[] = crmActivities.map((a) => ({
    id: String(a.id),
    type: (a.type as CRMActivity["type"]) ?? "Note",
    subject: String(a.subject ?? ""),
    status: (a.status as CRMActivity["status"]) ?? "Completed",
    timestamp: String(a.timestamp ?? nowIso()),
  }));

  const financials = (row.financials as Project["financials"]) ?? {
    revenue: 0, expenses: 0, hoursSaved: 0, costPerExecution: 0,
  };

  const governance = (row.governance as Project["governance"]) ?? {
    certified: false, lastScore: 0, verdict: "None",
  };

  return {
    id: String(row.id),
    brief,
    status: (row.status as Project["status"]) ?? "Intake",
    activeWorkflows: mappedWorkflows,
    documents: mappedDocuments,
    executionLogs: mappedLogs,
    incidents: mappedIncidents,
    operatorChat: mappedChat,
    crmActivities: mappedCrm,
    financials,
    governance,
    totalBilled: Number(row.total_billed ?? 0),
    createdAt: String(row.created_at ?? nowIso()),
  };
}

// ============================================
// COUNCIL SESSIONS
// ============================================

export async function listCouncilSessions(projectId?: string, userId?: string): Promise<CouncilSession[]> {
  const sb = requireClient();

  let query = sb.from("council_sessions").select("*").order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  throwIfError(error, "listCouncilSessions");
  return (data ?? []).map(rowToCouncilSession);
}

export async function getCouncilSession(sessionId: string, userId?: string): Promise<CouncilSession | null> {
  const sb = requireClient();

  let query = sb.from("council_sessions").select("*").eq("id", sessionId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getCouncilSession");
  return data ? rowToCouncilSession(data) : null;
}

export async function saveCouncilSession(session: CouncilSession, userId?: string): Promise<CouncilSession> {
  const sb = requireClient();

  const { error } = await sb.from("council_sessions").upsert({
    id: session.id,
    user_id: userId ?? null,
    project_id: session.projectId,
    gate_type: session.gateType,
    topic: session.topic,
    opinions: session.opinions,
    synthesis: session.synthesis,
    decision: session.decision,
    pricing: session.pricing ?? null,
    language: session.language ?? null,
    board_name: session.boardName ?? null,
    current_stage: session.currentStage ?? null,
    board_summary: session.boardSummary ?? null,
    next_steps: session.nextSteps ?? null,
    money_steps: session.moneySteps ?? null,
    workflow_suggestions: session.workflowSuggestions ?? null,
    suggested_catalog_query: session.suggestedCatalogQuery ?? null,
    model_outputs: session.modelOutputs ?? null,
    chairman_model: session.chairmanModel ?? null,
    stage2_rankings: session.stage2Rankings ?? null,
    label_to_model: session.labelToModel ?? null,
    aggregate_rankings: session.aggregateRankings ?? null,
    created_at: session.createdAt ?? nowIso(),
  }, { onConflict: "id" });

  throwIfError(error, "saveCouncilSession");
  return session;
}

function rowToCouncilSession(row: Record<string, unknown>): CouncilSession {
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    gateType: (row.gate_type as CouncilSession["gateType"]) ?? "Strategic",
    topic: String(row.topic ?? ""),
    opinions: (row.opinions as CouncilSession["opinions"]) ?? [],
    synthesis: String(row.synthesis ?? ""),
    decision: (row.decision as CouncilSession["decision"]) ?? "Needs Revision",
    pricing: row.pricing as CouncilSession["pricing"],
    language: row.language as CouncilSession["language"],
    boardName: row.board_name ? String(row.board_name) : undefined,
    currentStage: row.current_stage as CouncilSession["currentStage"],
    boardSummary: row.board_summary ? String(row.board_summary) : undefined,
    nextSteps: row.next_steps as CouncilSession["nextSteps"],
    moneySteps: row.money_steps as CouncilSession["moneySteps"],
    workflowSuggestions: row.workflow_suggestions as CouncilSession["workflowSuggestions"],
    suggestedCatalogQuery: row.suggested_catalog_query as CouncilSession["suggestedCatalogQuery"],
    modelOutputs: row.model_outputs as CouncilSession["modelOutputs"],
    chairmanModel: row.chairman_model ? String(row.chairman_model) : undefined,
    stage2Rankings: row.stage2_rankings as CouncilSession["stage2Rankings"],
    labelToModel: row.label_to_model as CouncilSession["labelToModel"],
    aggregateRankings: row.aggregate_rankings as CouncilSession["aggregateRankings"],
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

// ============================================
// COUNCIL JOBS (Queue System)
// ============================================

export type CouncilJobType = "council_run" | "council_playground" | "doc_generate";
export type CouncilJobStatus = "pending" | "processing" | "completed" | "failed";

export interface CouncilJob {
  id: string;
  userId?: string;
  projectId?: string;
  jobType: CouncilJobType;
  status: CouncilJobStatus;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export async function createCouncilJob(
  jobType: CouncilJobType,
  input: Record<string, unknown>,
  userId?: string,
  projectId?: string
): Promise<CouncilJob> {
  const sb = requireClient();
  const id = generateId("job");
  const now = nowIso();

  const { error } = await sb.from("council_jobs").insert({
    id,
    user_id: userId ?? null,
    project_id: projectId ?? null,
    job_type: jobType,
    status: "pending",
    input,
    progress: 0,
    created_at: now,
  });
  throwIfError(error, "createCouncilJob");

  return { id, userId, projectId, jobType, status: "pending", input, progress: 0, createdAt: now };
}

export async function getCouncilJob(jobId: string, userId?: string): Promise<CouncilJob | null> {
  const sb = requireClient();

  let query = sb.from("council_jobs").select("*").eq("id", jobId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getCouncilJob");
  return data ? rowToCouncilJob(data) : null;
}

export async function updateCouncilJob(
  jobId: string,
  update: Partial<Pick<CouncilJob, "status" | "result" | "error" | "progress" | "startedAt" | "completedAt">>
): Promise<void> {
  const sb = requireClient();

  const updateObj: Record<string, unknown> = {};
  if (update.status !== undefined) updateObj.status = update.status;
  if (update.result !== undefined) updateObj.result = update.result;
  if (update.error !== undefined) updateObj.error = update.error;
  if (update.progress !== undefined) updateObj.progress = update.progress;
  if (update.startedAt !== undefined) updateObj.started_at = update.startedAt;
  if (update.completedAt !== undefined) updateObj.completed_at = update.completedAt;

  if (Object.keys(updateObj).length === 0) return;

  const { error } = await sb.from("council_jobs").update(updateObj).eq("id", jobId);
  throwIfError(error, "updateCouncilJob");
}

export async function claimNextPendingJob(): Promise<CouncilJob | null> {
  const sb = requireClient();

  // Try using RPC function first (for proper FOR UPDATE SKIP LOCKED)
  try {
    const { data, error } = await sb.rpc("claim_next_pending_job");
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return rowToCouncilJob(data[0]);
    }
    if (!error && data && !Array.isArray(data)) {
      return rowToCouncilJob(data);
    }
  } catch {
    // RPC not available, fall back to non-atomic approach
  }

  // Fallback: Find oldest pending and update it (not atomic, but functional)
  const { data: pending } = await sb
    .from("council_jobs")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pending) return null;

  const now = nowIso();
  const { data: claimed, error } = await sb
    .from("council_jobs")
    .update({ status: "processing", started_at: now })
    .eq("id", pending.id)
    .eq("status", "pending") // Ensure it hasn't been claimed by another worker
    .select("*")
    .maybeSingle();

  if (error || !claimed) return null;
  return rowToCouncilJob(claimed);
}

function rowToCouncilJob(row: Record<string, unknown>): CouncilJob {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    projectId: row.project_id ? String(row.project_id) : undefined,
    jobType: (row.job_type as CouncilJobType) ?? "council_run",
    status: (row.status as CouncilJobStatus) ?? "pending",
    input: (row.input as Record<string, unknown>) ?? {},
    result: row.result as Record<string, unknown> | undefined,
    error: row.error ? String(row.error) : undefined,
    progress: Number(row.progress ?? 0),
    createdAt: String(row.created_at ?? nowIso()),
    startedAt: row.started_at ? String(row.started_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

// ============================================
// ASSISTANT STATE
// ============================================

export async function getAssistantState(userId?: string): Promise<AssistantState | null> {
  const sb = requireClient();

  let stateQuery = sb.from("assistant_state").select("*");
  if (userId) {
    stateQuery = stateQuery.eq("user_id", userId);
  } else {
    stateQuery = stateQuery.is("user_id", null);
  }

  const { data: stateRow, error: stateErr } = await stateQuery.maybeSingle();
  throwIfError(stateErr, "getAssistantState:state");
  if (!stateRow) return null;

  const stateId = String(stateRow.id);
  const { data: msgs, error: msgsErr } = await sb
    .from("assistant_messages")
    .select("*")
    .eq("assistant_state_id", stateId)
    .order("created_at", { ascending: true })
    .limit(300);
  throwIfError(msgsErr, "getAssistantState:messages");

  const messages: AssistantMessage[] = (msgs ?? []).map((m: Record<string, unknown>) => ({
    id: String(m.id),
    role: (m.role as AssistantMessage["role"]) ?? "system",
    content: String(m.content ?? ""),
    toolCall: m.tool_call as AssistantMessage["toolCall"],
    createdAt: String(m.created_at ?? nowIso()),
  }));

  return {
    id: String(stateRow.id),
    preferences: (stateRow.preferences as AssistantPreferences) ?? {},
    messages,
    updatedAt: String(stateRow.updated_at ?? nowIso()),
  };
}

export async function saveAssistantState(state: AssistantState, userId?: string): Promise<void> {
  const sb = requireClient();

  // Upsert state
  const { error: stateErr } = await sb.from("assistant_state").upsert({
    id: state.id,
    user_id: userId ?? null,
    preferences: state.preferences,
    updated_at: state.updatedAt,
  }, { onConflict: "id" });
  throwIfError(stateErr, "saveAssistantState:state");

  // Delete old messages (linked by assistant_state_id, not user_id)
  const { error: delErr } = await sb.from("assistant_messages").delete().eq("assistant_state_id", state.id);
  throwIfError(delErr, "saveAssistantState:deleteMessages");

  // Insert new messages
  if (state.messages.length > 0) {
    const rows = state.messages.map((msg) => ({
      id: msg.id,
      assistant_state_id: state.id,
      role: msg.role,
      content: msg.content,
      tool_call: msg.toolCall ?? null,
      created_at: msg.createdAt,
    }));
    const { error: insErr } = await sb.from("assistant_messages").insert(rows);
    throwIfError(insErr, "saveAssistantState:insertMessages");
  }
}

// ============================================
// OUTBOUND LEADS
// ============================================

export async function listOutboundLeads(userId?: string): Promise<OutboundLead[]> {
  const sb = requireClient();

  let query = sb.from("outbound_leads").select("*").order("updated_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  throwIfError(error, "listOutboundLeads");
  return (data ?? []).map(rowToOutboundLead);
}

export async function getOutboundLead(leadId: string, userId?: string): Promise<OutboundLead | null> {
  const sb = requireClient();

  let query = sb.from("outbound_leads").select("*").eq("id", leadId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getOutboundLead");
  return data ? rowToOutboundLead(data) : null;
}

export async function saveOutboundLead(lead: OutboundLead, userId?: string): Promise<OutboundLead> {
  const sb = requireClient();

  const { error } = await sb.from("outbound_leads").upsert({
    id: lead.id,
    user_id: userId ?? null,
    name: lead.name,
    category: lead.category ?? null,
    address: lead.address ?? null,
    website: lead.website ?? null,
    phone: lead.phone ?? null,
    maps_url: lead.mapsUrl ?? null,
    country: lead.country ?? null,
    city: lead.city ?? null,
    stage: lead.stage,
    notes: lead.notes ?? null,
    last_action_at: lead.lastActionAt ?? null,
    next_follow_up_at: lead.nextFollowUpAt ?? null,
    source: lead.source,
    source_ref: lead.sourceRef ?? null,
    external_ref: lead.externalRef ?? null,
    project_id: lead.projectId ?? null,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  }, { onConflict: "id" });

  throwIfError(error, "saveOutboundLead");
  return lead;
}

export async function deleteOutboundLead(leadId: string, userId?: string): Promise<void> {
  const sb = requireClient();

  let query = sb.from("outbound_leads").delete().eq("id", leadId);
  if (userId) query = query.eq("user_id", userId);

  const { error } = await query;
  throwIfError(error, "deleteOutboundLead");
}

function rowToOutboundLead(row: Record<string, unknown>): OutboundLead {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    category: row.category ? String(row.category) : undefined,
    address: row.address ? String(row.address) : undefined,
    website: row.website ? String(row.website) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    mapsUrl: row.maps_url ? String(row.maps_url) : undefined,
    country: row.country ? String(row.country) : undefined,
    city: row.city ? String(row.city) : undefined,
    stage: (row.stage as OutboundLead["stage"]) ?? "New",
    notes: row.notes ? String(row.notes) : undefined,
    lastActionAt: row.last_action_at ? String(row.last_action_at) : undefined,
    nextFollowUpAt: row.next_follow_up_at ? String(row.next_follow_up_at) : undefined,
    source: (row.source as OutboundLead["source"]) ?? "manual",
    sourceRef: row.source_ref ? String(row.source_ref) : undefined,
    externalRef: row.external_ref as OutboundLead["externalRef"],
    projectId: row.project_id ? String(row.project_id) : undefined,
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

// ============================================
// AGENCY STATE
// ============================================

export async function getAgencyState(userId?: string): Promise<AgencyState | null> {
  const sb = requireClient();

  let stateQuery = sb.from("agency_state").select("*");
  if (userId) {
    stateQuery = stateQuery.eq("user_id", userId);
  } else {
    stateQuery = stateQuery.is("user_id", null).limit(1);
  }

  const { data: stateRow, error: stateErr } = await stateQuery.maybeSingle();
  throwIfError(stateErr, "getAgencyState:state");
  if (!stateRow) return null;

  const stateId = String(stateRow.id);
  const { data: docs, error: docsErr } = await sb
    .from("agency_documents")
    .select("*")
    .eq("agency_state_id", stateId)
    .order("created_at", { ascending: false });
  throwIfError(docsErr, "getAgencyState:documents");

  const documents: AgencyDocument[] = (docs ?? []).map((d: Record<string, unknown>) => ({
    id: String(d.id),
    type: (d.type as AgencyDocument["type"]) ?? "RevenuePlan",
    name: String(d.name ?? ""),
    status: (d.status as AgencyDocument["status"]) ?? "Draft",
    content: String(d.content ?? ""),
    createdAt: String(d.created_at ?? nowIso()),
  }));

  return {
    goal: (stateRow.goal as AgencyState["goal"]) ?? "ai_agency",
    completedTaskIds: (stateRow.completed_task_ids as string[]) ?? [],
    documents,
    revenueGoal: (stateRow.revenue_goal as AgencyState["revenueGoal"]) ?? {
      currency: "USD", targetMrr: 0, avgRetainer: 0, closeRatePct: 0, bookingRatePct: 0, updatedAt: nowIso(),
    },
    updatedAt: String(stateRow.updated_at ?? nowIso()),
  };
}

export async function saveAgencyState(state: AgencyState, userId?: string): Promise<void> {
  const sb = requireClient();
  const id = userId ?? "default";

  // Upsert state
  const { error: stateErr } = await sb.from("agency_state").upsert({
    id,
    user_id: userId ?? null,
    goal: state.goal,
    completed_task_ids: state.completedTaskIds,
    revenue_goal: state.revenueGoal,
    updated_at: state.updatedAt,
  }, { onConflict: "id" });
  throwIfError(stateErr, "saveAgencyState:state");

  // Delete old documents (linked by agency_state_id, not user_id)
  const { error: delErr } = await sb.from("agency_documents").delete().eq("agency_state_id", id);
  throwIfError(delErr, "saveAgencyState:deleteDocs");

  // Insert new documents
  if (state.documents.length > 0) {
    const rows = state.documents.map((doc) => ({
      id: doc.id,
      agency_state_id: id,
      type: doc.type,
      name: doc.name,
      status: doc.status,
      content: doc.content,
      created_at: doc.createdAt,
    }));
    const { error: insErr } = await sb.from("agency_documents").insert(rows);
    throwIfError(insErr, "saveAgencyState:insertDocs");
  }
}

// ============================================
// MARKET RADAR STATE
// ============================================

export async function getMarketRadarState(userId?: string): Promise<MarketRadarState | null> {
  const sb = requireClient();

  let stateQuery = sb.from("market_radar_state").select("*");
  if (userId) {
    stateQuery = stateQuery.eq("user_id", userId);
  } else {
    stateQuery = stateQuery.is("user_id", null).limit(1);
  }

  const { data: stateRow, error: stateErr } = await stateQuery.maybeSingle();
  throwIfError(stateErr, "getMarketRadarState:state");
  if (!stateRow) return null;

  const stateId = String(stateRow.id);

  const [opportunities, youtubeTrends, youtubeIdeas, internetTrends, leads] = await Promise.all([
    sb.from("market_opportunities").select("*").eq("state_id", stateId),
    sb.from("market_youtube_trends").select("*").eq("state_id", stateId),
    sb.from("market_youtube_ideas").select("*").eq("state_id", stateId),
    sb.from("market_internet_trends").select("*").eq("state_id", stateId),
    sb.from("market_lead_candidates").select("*").eq("state_id", stateId),
  ]);

  return {
    country: String(stateRow.country ?? ""),
    city: String(stateRow.city ?? ""),
    niche: String(stateRow.niche ?? ""),
    updatedAt: String(stateRow.updated_at ?? nowIso()),
    opportunities: (opportunities.data ?? []).map((o: Record<string, unknown>) => o.data as MarketOpportunity),
    youtubeTrends: (youtubeTrends.data ?? []).map((t: Record<string, unknown>) => t.data as MarketTrendVideo),
    youtubeIdeas: (youtubeIdeas.data ?? []).map((i: Record<string, unknown>) => i.data as MarketVideoIdea),
    internetTrends: (internetTrends.data ?? []).map((t: Record<string, unknown>) => t.data as MarketInternetTrend),
    leads: (leads.data ?? []).map((l: Record<string, unknown>) => l.data as MarketLeadCandidate),
  };
}

export async function saveMarketRadarState(state: MarketRadarState, userId?: string): Promise<void> {
  const sb = requireClient();
  const id = userId ?? "default";

  // Upsert main state
  const { error: stateErr } = await sb.from("market_radar_state").upsert({
    id,
    user_id: userId ?? null,
    country: state.country,
    city: state.city,
    niche: state.niche,
    updated_at: state.updatedAt,
  }, { onConflict: "id" });
  throwIfError(stateErr, "saveMarketRadarState:state");

  // Clear and re-insert sub-tables
  const subTables = [
    { table: "market_opportunities", data: state.opportunities.map((opp) => ({ id: opp.id, state_id: id, data: opp })) },
    { table: "market_youtube_trends", data: state.youtubeTrends.map((t) => ({ id: t.id, state_id: id, data: t })) },
    { table: "market_youtube_ideas", data: state.youtubeIdeas.map((i) => ({ id: i.id, state_id: id, data: i })) },
    { table: "market_internet_trends", data: state.internetTrends.map((t) => ({ id: t.id, state_id: id, data: t })) },
    { table: "market_lead_candidates", data: state.leads.map((l) => ({ id: l.id, state_id: id, data: l })) },
  ];

  for (const { table, data } of subTables) {
    const { error: delErr } = await sb.from(table).delete().eq("state_id", id);
    throwIfError(delErr, `saveMarketRadarState:delete:${table}`);
    if (data.length > 0) {
      const { error: insErr } = await sb.from(table).insert(data);
      throwIfError(insErr, `saveMarketRadarState:insert:${table}`);
    }
  }
}

// ============================================
// RUNTIME SETTINGS
// ============================================

export async function getRuntimeSettings(userId?: string): Promise<RuntimeSettings | null> {
  const sb = requireClient();

  let query = sb.from("runtime_settings").select("*").limit(1);
  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null);
  }

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getRuntimeSettings");
  if (!data) return null;

  return {
    activeEnvironment: (data.active_environment as EnvironmentName) ?? "Production",
    n8nBaseUrl: String(data.n8n_base_url ?? "http://localhost:5678"),
    suitecrmBaseUrl: String(data.suitecrm_base_url ?? "http://localhost:8091"),
    invoiceshelfBaseUrl: String(data.invoiceshelf_base_url ?? "http://localhost:8090"),
    documensoBaseUrl: String(data.documenso_base_url ?? "http://localhost:8092"),
    infisicalBaseUrl: String(data.infisical_base_url ?? "http://localhost:8081"),
    infisicalWorkspaceId: String(data.infisical_workspace_id ?? ""),
    infisicalSecretPath: String(data.infisical_secret_path ?? "/"),
    infisicalEnvDevelopmentSlug: String(data.infisical_env_development_slug ?? "dev"),
    infisicalEnvStagingSlug: String(data.infisical_env_staging_slug ?? "staging"),
    infisicalEnvProductionSlug: String(data.infisical_env_production_slug ?? "prod"),
    councilModels: String(data.council_models ?? ""),
    councilChairmanModel: String(data.council_chairman_model ?? ""),
    councilStage2Enabled: Boolean(data.council_stage2_enabled),
  };
}

export async function saveRuntimeSettings(settings: RuntimeSettings, userId?: string): Promise<void> {
  const sb = requireClient();
  const id = userId ?? "default";

  const { error } = await sb.from("runtime_settings").upsert({
    id,
    user_id: userId ?? null,
    active_environment: settings.activeEnvironment,
    n8n_base_url: settings.n8nBaseUrl,
    suitecrm_base_url: settings.suitecrmBaseUrl,
    invoiceshelf_base_url: settings.invoiceshelfBaseUrl,
    documenso_base_url: settings.documensoBaseUrl,
    infisical_base_url: settings.infisicalBaseUrl,
    infisical_workspace_id: settings.infisicalWorkspaceId,
    infisical_secret_path: settings.infisicalSecretPath,
    infisical_env_development_slug: settings.infisicalEnvDevelopmentSlug,
    infisical_env_staging_slug: settings.infisicalEnvStagingSlug,
    infisical_env_production_slug: settings.infisicalEnvProductionSlug,
    council_models: settings.councilModels,
    council_chairman_model: settings.councilChairmanModel,
    council_stage2_enabled: settings.councilStage2Enabled,
    updated_at: nowIso(),
  }, { onConflict: "id" });

  throwIfError(error, "saveRuntimeSettings");
}

// ============================================
// SECRETS
// ============================================

export async function listSecrets(userId?: string): Promise<StoredSecret[]> {
  const sb = requireClient();

  let query = sb.from("secrets").select("*").order("last_updated", { ascending: false });
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  throwIfError(error, "listSecrets");

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    key: String(row.key),
    value: String(row.value),
    environment: (row.environment as EnvironmentName) ?? "Production",
    lastUpdated: String(row.last_updated ?? nowIso()),
  }));
}

export async function upsertSecret(secret: Omit<StoredSecret, "lastUpdated"> & { lastUpdated?: string }, userId?: string): Promise<StoredSecret> {
  const sb = requireClient();
  const now = nowIso();
  const id = secret.id ?? generateId("sec");

  const { error } = await sb.from("secrets").upsert({
    id,
    key: secret.key,
    value: secret.value,
    environment: secret.environment,
    last_updated: secret.lastUpdated ?? now,
    user_id: userId ?? null,
  }, { onConflict: "id" });

  throwIfError(error, "upsertSecret");

  return {
    id,
    key: secret.key,
    value: secret.value,
    environment: secret.environment,
    lastUpdated: secret.lastUpdated ?? now,
  };
}

export async function deleteSecret(secretId: string, userId?: string): Promise<void> {
  const sb = requireClient();

  let query = sb.from("secrets").delete().eq("id", secretId);
  if (userId) query = query.eq("user_id", userId);

  const { error } = await query;
  throwIfError(error, "deleteSecret");
}

// ============================================
// AGENCY BUILDER STATE
// ============================================

export async function getAgencyBuilderState(userId?: string): Promise<AgencyBuilderState | null> {
  const sb = requireClient();

  let query = sb.from("agency_builder_state").select("*");
  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getAgencyBuilderState");
  if (!data) return null;

  return {
    currentStep: (data.current_step as AgencyBuilderState["currentStep"]) ?? "sector",
    selectedSectorId: data.selected_sector_id ? String(data.selected_sector_id) : undefined,
    selectedNicheId: data.selected_niche_id ? String(data.selected_niche_id) : undefined,
    targetRegion: data.target_region ? String(data.target_region) : undefined,
    solution: data.solution as AgencyBuilderState["solution"],
    customizations: data.customizations as AgencyBuilderState["customizations"],
    deploymentStatus: data.deployment_status as AgencyBuilderState["deploymentStatus"],
    createdAt: String(data.created_at ?? nowIso()),
    updatedAt: String(data.updated_at ?? nowIso()),
  };
}

export async function saveAgencyBuilderState(state: AgencyBuilderState, userId?: string): Promise<void> {
  const sb = requireClient();
  const id = userId ?? "default";

  const { error } = await sb.from("agency_builder_state").upsert({
    id,
    user_id: userId ?? null,
    current_step: state.currentStep,
    selected_sector_id: state.selectedSectorId ?? null,
    selected_niche_id: state.selectedNicheId ?? null,
    target_region: state.targetRegion ?? null,
    solution: state.solution ?? null,
    customizations: state.customizations ?? null,
    deployment_status: state.deploymentStatus ?? null,
    created_at: state.createdAt,
    updated_at: state.updatedAt,
  }, { onConflict: "id" });

  throwIfError(error, "saveAgencyBuilderState");
}

// ============================================
// PROPOSALS
// ============================================

export async function listProposals(userId?: string): Promise<Proposal[]> {
  const sb = requireClient();

  let query = sb.from("proposals").select("*").order("updated_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  throwIfError(error, "listProposals");
  return (data ?? []).map(rowToProposal);
}

export async function getProposal(proposalId: string, userId?: string): Promise<Proposal | null> {
  const sb = requireClient();

  let query = sb.from("proposals").select("*").eq("id", proposalId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  throwIfError(error, "getProposal");
  return data ? rowToProposal(data) : null;
}

export async function saveProposal(proposal: Proposal, userId?: string): Promise<Proposal> {
  const sb = requireClient();

  const { error } = await sb.from("proposals").upsert({
    id: proposal.id,
    user_id: userId ?? null,
    project_id: proposal.projectId ?? null,
    client_name: proposal.clientName,
    client_email: proposal.clientEmail ?? null,
    client_company: proposal.clientCompany ?? null,
    title: proposal.title,
    summary: proposal.summary,
    currency: proposal.currency,
    tiers: proposal.tiers,
    selected_tier_id: proposal.selectedTierId ?? null,
    scope: proposal.scope,
    terms: proposal.terms,
    valid_until: proposal.validUntil,
    status: proposal.status,
    viewed_at: proposal.viewedAt ?? null,
    responded_at: proposal.respondedAt ?? null,
    external_ref: proposal.externalRef ?? null,
    created_at: proposal.createdAt,
    updated_at: proposal.updatedAt,
  }, { onConflict: "id" });

  throwIfError(error, "saveProposal");
  return proposal;
}

export async function deleteProposal(proposalId: string, userId?: string): Promise<void> {
  const sb = requireClient();

  let query = sb.from("proposals").delete().eq("id", proposalId);
  if (userId) query = query.eq("user_id", userId);

  const { error } = await query;
  throwIfError(error, "deleteProposal");
}

function rowToProposal(row: Record<string, unknown>): Proposal {
  return {
    id: String(row.id),
    projectId: row.project_id ? String(row.project_id) : undefined,
    clientName: String(row.client_name ?? ""),
    clientEmail: row.client_email ? String(row.client_email) : undefined,
    clientCompany: row.client_company ? String(row.client_company) : undefined,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    currency: (row.currency as Proposal["currency"]) ?? "USD",
    tiers: (row.tiers as Proposal["tiers"]) ?? [],
    selectedTierId: row.selected_tier_id ? String(row.selected_tier_id) : undefined,
    scope: (row.scope as Proposal["scope"]) ?? {
      objectives: [], deliverables: [], timeline: "", assumptions: [], exclusions: [],
    },
    terms: (row.terms as Proposal["terms"]) ?? {
      paymentTerms: "", validityPeriod: 30, cancellationPolicy: "", revisionPolicy: "", confidentiality: false,
    },
    validUntil: String(row.valid_until ?? nowIso()),
    status: (row.status as Proposal["status"]) ?? "Draft",
    viewedAt: row.viewed_at ? String(row.viewed_at) : undefined,
    respondedAt: row.responded_at ? String(row.responded_at) : undefined,
    externalRef: row.external_ref as Proposal["externalRef"],
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

// ============================================
// FINANCIAL TRANSACTIONS
// ============================================

export async function listFinancialTransactions(userId?: string, projectId?: string): Promise<FinancialTransaction[]> {
  const sb = requireClient();

  let query = sb.from("financial_transactions").select("*").order("date", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  throwIfError(error, "listFinancialTransactions");
  return (data ?? []).map(rowToFinancialTransaction);
}

export async function saveFinancialTransaction(transaction: FinancialTransaction, userId?: string): Promise<FinancialTransaction> {
  const sb = requireClient();

  const { error } = await sb.from("financial_transactions").upsert({
    id: transaction.id,
    user_id: userId ?? null,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    description: transaction.description,
    project_id: transaction.projectId ?? null,
    client_name: transaction.clientName ?? null,
    invoice_ref: transaction.invoiceRef ?? null,
    date: transaction.date,
    created_at: transaction.createdAt,
  }, { onConflict: "id" });

  throwIfError(error, "saveFinancialTransaction");
  return transaction;
}

export async function deleteFinancialTransaction(transactionId: string, userId?: string): Promise<void> {
  const sb = requireClient();

  let query = sb.from("financial_transactions").delete().eq("id", transactionId);
  if (userId) query = query.eq("user_id", userId);

  const { error } = await query;
  throwIfError(error, "deleteFinancialTransaction");
}

function rowToFinancialTransaction(row: Record<string, unknown>): FinancialTransaction {
  return {
    id: String(row.id),
    type: (row.type as FinancialTransaction["type"]) ?? "Invoice",
    amount: Number(row.amount ?? 0),
    currency: (row.currency as FinancialTransaction["currency"]) ?? "USD",
    status: (row.status as FinancialTransaction["status"]) ?? "Pending",
    description: String(row.description ?? ""),
    projectId: row.project_id ? String(row.project_id) : undefined,
    clientName: row.client_name ? String(row.client_name) : undefined,
    invoiceRef: row.invoice_ref ? String(row.invoice_ref) : undefined,
    date: String(row.date ?? nowIso()),
    createdAt: String(row.created_at ?? nowIso()),
  };
}
