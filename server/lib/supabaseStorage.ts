/**
 * Supabase Storage Layer for AgencyOS
 *
 * This module provides PostgreSQL-based storage operations using Supabase.
 * It replaces the JSON file-based storage for production deployments.
 *
 * Usage:
 * - Set AGENCYOS_DATABASE_URL environment variable to enable
 * - Falls back to JSON storage if database is unavailable
 */

import pg from "pg";
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

type PgPool = pg.Pool;

// ============================================
// CONNECTION MANAGEMENT
// ============================================

let pool: PgPool | null = null;

function getDatabaseUrl(): string {
  return String(process.env.AGENCYOS_DATABASE_URL ?? "").trim();
}

export function isSupabaseEnabled(): boolean {
  return getDatabaseUrl().length > 0;
}

export function getSupabasePool(): PgPool | null {
  const url = getDatabaseUrl();
  if (!url) return null;
  if (pool) return pool;
  const { Pool } = pg;
  pool = new Pool({
    connectionString: url,
    ssl: url.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function supabaseHealthcheck(): Promise<{ connected: boolean; reason?: string }> {
  const p = getSupabasePool();
  if (!p) return { connected: false, reason: "Missing AGENCYOS_DATABASE_URL" };
  try {
    await p.query("SELECT 1 as ok");
    return { connected: true };
  } catch (e) {
    return { connected: false, reason: e instanceof Error ? e.message : "Database connection failed" };
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

// ============================================
// USERS (for multi-tenant support)
// ============================================

export async function createUser(email: string, name?: string): Promise<{ id: string; email: string; name?: string }> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const result = await p.query(
    `INSERT INTO users (email, name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name), updated_at = NOW()
     RETURNING id, email, name`,
    [email, name]
  );
  return result.rows[0];
}

export async function getUserByEmail(email: string): Promise<{ id: string; email: string; name?: string } | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const result = await p.query("SELECT id, email, name FROM users WHERE email = $1", [email]);
  return result.rows[0] ?? null;
}

// ============================================
// PROJECTS
// ============================================

export async function listProjects(userId?: string): Promise<Project[]> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = `
    SELECT p.*,
           pb.client_name, pb.description, pb.industry, pb.goals, pb.tools, pb.budget, pb.risk_level,
           COALESCE(
             (SELECT json_agg(pw.* ORDER BY pw.created_at DESC)
              FROM project_workflows pw WHERE pw.project_id = p.id),
             '[]'
           ) as workflows,
           COALESCE(
             (SELECT json_agg(pd.* ORDER BY pd.created_at DESC)
              FROM project_documents pd WHERE pd.project_id = p.id),
             '[]'
           ) as documents,
           COALESCE(
             (SELECT json_agg(el.* ORDER BY el.timestamp DESC LIMIT 100)
              FROM execution_logs el WHERE el.project_id = p.id),
             '[]'
           ) as execution_logs,
           COALESCE(
             (SELECT json_agg(pi.* ORDER BY pi.timestamp DESC)
              FROM project_incidents pi WHERE pi.project_id = p.id),
             '[]'
           ) as incidents,
           COALESCE(
             (SELECT json_agg(oc.* ORDER BY oc.created_at ASC)
              FROM operator_chat oc WHERE oc.project_id = p.id),
             '[]'
           ) as operator_chat,
           COALESCE(
             (SELECT json_agg(ca.* ORDER BY ca.timestamp DESC)
              FROM crm_activities ca WHERE ca.project_id = p.id),
             '[]'
           ) as crm_activities
    FROM projects p
    LEFT JOIN project_briefs pb ON pb.project_id = p.id
  `;

  const params: unknown[] = [];
  if (userId) {
    query += " WHERE p.user_id = $1";
    params.push(userId);
  }
  query += " ORDER BY p.created_at DESC";

  const result = await p.query(query, params);
  return result.rows.map(rowToProject);
}

export async function getProject(projectId: string, userId?: string): Promise<Project | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = `
    SELECT p.*,
           pb.client_name, pb.description, pb.industry, pb.goals, pb.tools, pb.budget, pb.risk_level,
           COALESCE(
             (SELECT json_agg(pw.* ORDER BY pw.created_at DESC)
              FROM project_workflows pw WHERE pw.project_id = p.id),
             '[]'
           ) as workflows,
           COALESCE(
             (SELECT json_agg(pd.* ORDER BY pd.created_at DESC)
              FROM project_documents pd WHERE pd.project_id = p.id),
             '[]'
           ) as documents,
           COALESCE(
             (SELECT json_agg(el.* ORDER BY el.timestamp DESC LIMIT 100)
              FROM execution_logs el WHERE el.project_id = p.id),
             '[]'
           ) as execution_logs,
           COALESCE(
             (SELECT json_agg(pi.* ORDER BY pi.timestamp DESC)
              FROM project_incidents pi WHERE pi.project_id = p.id),
             '[]'
           ) as incidents,
           COALESCE(
             (SELECT json_agg(oc.* ORDER BY oc.created_at ASC)
              FROM operator_chat oc WHERE oc.project_id = p.id),
             '[]'
           ) as operator_chat,
           COALESCE(
             (SELECT json_agg(ca.* ORDER BY ca.timestamp DESC)
              FROM crm_activities ca WHERE ca.project_id = p.id),
             '[]'
           ) as crm_activities
    FROM projects p
    LEFT JOIN project_briefs pb ON pb.project_id = p.id
    WHERE p.id = $1
  `;

  const params: unknown[] = [projectId];
  if (userId) {
    query += " AND p.user_id = $2";
    params.push(userId);
  }

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;
  return rowToProject(result.rows[0]);
}

export async function createProject(brief: ProjectBrief, userId?: string): Promise<Project> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const now = nowIso();
  const client = await p.connect();

  try {
    await client.query("BEGIN");

    // Insert project
    await client.query(
      `INSERT INTO projects (id, user_id, status, financials, governance, total_billed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        brief.id,
        userId,
        "Intake",
        JSON.stringify({ revenue: 0, expenses: 0, hoursSaved: 0, costPerExecution: 0 }),
        JSON.stringify({ certified: false, lastScore: 0, verdict: "None" }),
        0,
        now,
      ]
    );

    // Insert brief
    await client.query(
      `INSERT INTO project_briefs (project_id, client_name, description, industry, goals, tools, budget, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id) DO UPDATE SET
         client_name = EXCLUDED.client_name,
         description = EXCLUDED.description,
         industry = EXCLUDED.industry,
         goals = EXCLUDED.goals,
         tools = EXCLUDED.tools,
         budget = EXCLUDED.budget,
         risk_level = EXCLUDED.risk_level`,
      [
        brief.id,
        brief.clientName,
        brief.description,
        brief.industry,
        brief.goals,
        brief.tools,
        brief.budget,
        brief.riskLevel,
      ]
    );

    // Insert initial CRM activity
    await client.query(
      `INSERT INTO crm_activities (id, project_id, type, subject, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [generateId("crm"), brief.id, "Note", "Project Initialized from Intake Wizard", "Completed", now]
    );

    // Insert initial operator message
    await client.query(
      `INSERT INTO operator_chat (id, project_id, role, content, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        generateId("msg"),
        brief.id,
        "system",
        `Operator initialized for ${brief.clientName}. I am connected to your n8n MCP server cluster.`,
        now,
      ]
    );

    await client.query("COMMIT");

    // Return the created project
    const project = await getProject(brief.id, userId);
    if (!project) throw new Error("Failed to retrieve created project");
    return project;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function saveProject(project: Project, userId?: string): Promise<Project> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const client = await p.connect();
  const now = nowIso();

  try {
    await client.query("BEGIN");

    // Update main project
    const updateQuery = userId
      ? `UPDATE projects SET status = $1, financials = $2, governance = $3, total_billed = $4, updated_at = $5
         WHERE id = $6 AND user_id = $7`
      : `UPDATE projects SET status = $1, financials = $2, governance = $3, total_billed = $4, updated_at = $5
         WHERE id = $6`;

    const updateParams = userId
      ? [project.status, JSON.stringify(project.financials), JSON.stringify(project.governance), project.totalBilled, now, project.id, userId]
      : [project.status, JSON.stringify(project.financials), JSON.stringify(project.governance), project.totalBilled, now, project.id];

    await client.query(updateQuery, updateParams);

    // Update brief
    await client.query(
      `UPDATE project_briefs SET
         client_name = $2, description = $3, industry = $4, goals = $5, tools = $6, budget = $7, risk_level = $8
       WHERE project_id = $1`,
      [
        project.id,
        project.brief.clientName,
        project.brief.description,
        project.brief.industry,
        project.brief.goals,
        project.brief.tools,
        project.brief.budget,
        project.brief.riskLevel,
      ]
    );

    // Sync workflows (replace all)
    await client.query("DELETE FROM project_workflows WHERE project_id = $1", [project.id]);
    for (const wf of project.activeWorkflows) {
      await client.query(
        `INSERT INTO project_workflows (id, project_id, name, description, tags, json_url, complexity, credentials, install_plan, deployment, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          wf.id,
          project.id,
          wf.name,
          wf.description,
          wf.tags,
          wf.jsonUrl,
          wf.complexity,
          wf.credentials,
          wf.installPlan ? JSON.stringify(wf.installPlan) : null,
          wf.deployment ? JSON.stringify(wf.deployment) : null,
          now,
        ]
      );
    }

    // Sync documents
    await client.query("DELETE FROM project_documents WHERE project_id = $1", [project.id]);
    for (const doc of project.documents) {
      await client.query(
        `INSERT INTO project_documents (id, project_id, name, type, status, content, url, amount, external_ref, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          doc.id,
          project.id,
          doc.name,
          doc.type,
          doc.status,
          doc.content,
          doc.url,
          doc.amount,
          doc.externalRef ? JSON.stringify(doc.externalRef) : null,
          doc.createdAt,
        ]
      );
    }

    // Sync execution logs (keep last 100)
    await client.query("DELETE FROM execution_logs WHERE project_id = $1", [project.id]);
    const logs = project.executionLogs.slice(-100);
    for (const log of logs) {
      await client.query(
        `INSERT INTO execution_logs (id, project_id, workflow_name, status, error_details, timestamp, duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [log.id, project.id, log.workflowName, log.status, log.errorDetails, log.timestamp, log.duration]
      );
    }

    // Sync incidents
    await client.query("DELETE FROM project_incidents WHERE project_id = $1", [project.id]);
    for (const inc of project.incidents) {
      await client.query(
        `INSERT INTO project_incidents (id, project_id, title, severity, status, root_cause, resolution_plan, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [inc.id, project.id, inc.title, inc.severity, inc.status, inc.rootCause, inc.resolutionPlan, inc.timestamp]
      );
    }

    // Sync operator chat
    await client.query("DELETE FROM operator_chat WHERE project_id = $1", [project.id]);
    for (const msg of project.operatorChat) {
      await client.query(
        `INSERT INTO operator_chat (id, project_id, role, content, tool_call, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [msg.id, project.id, msg.role, msg.content, msg.toolCall ? JSON.stringify(msg.toolCall) : null, now]
      );
    }

    // Sync CRM activities
    await client.query("DELETE FROM crm_activities WHERE project_id = $1", [project.id]);
    for (const act of project.crmActivities) {
      await client.query(
        `INSERT INTO crm_activities (id, project_id, type, subject, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [act.id, project.id, act.type, act.subject, act.status, act.timestamp]
      );
    }

    await client.query("COMMIT");
    return project;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteProject(projectId: string, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "DELETE FROM projects WHERE id = $1 AND user_id = $2"
    : "DELETE FROM projects WHERE id = $1";

  const params = userId ? [projectId, userId] : [projectId];
  await p.query(query, params);
}

function rowToProject(row: Record<string, unknown>): Project {
  const brief: ProjectBrief = {
    id: String(row.id),
    clientName: String(row.client_name ?? ""),
    description: String(row.description ?? ""),
    industry: row.industry ? String(row.industry) : undefined,
    goals: Array.isArray(row.goals) ? row.goals : [],
    tools: Array.isArray(row.tools) ? row.tools : [],
    budget: String(row.budget ?? ""),
    riskLevel: (row.risk_level as "Low" | "Medium" | "High") ?? "Low",
  };

  const workflows = Array.isArray(row.workflows)
    ? row.workflows.map((w: Record<string, unknown>) => ({
        id: String(w.id),
        name: String(w.name ?? ""),
        description: String(w.description ?? ""),
        tags: Array.isArray(w.tags) ? w.tags : [],
        jsonUrl: String(w.json_url ?? ""),
        complexity: (w.complexity as "Low" | "Medium" | "High") ?? "Low",
        credentials: Array.isArray(w.credentials) ? w.credentials : [],
        installPlan: w.install_plan as Workflow["installPlan"],
        deployment: w.deployment as Workflow["deployment"],
      }))
    : [];

  const documents = Array.isArray(row.documents)
    ? row.documents.map((d: Record<string, unknown>) => ({
        id: String(d.id),
        name: String(d.name ?? ""),
        type: (d.type as ProjectDocument["type"]) ?? "Report",
        status: (d.status as ProjectDocument["status"]) ?? "Draft",
        content: d.content ? String(d.content) : undefined,
        url: String(d.url ?? ""),
        amount: d.amount ? Number(d.amount) : undefined,
        externalRef: d.external_ref as ProjectDocument["externalRef"],
        createdAt: String(d.created_at ?? nowIso()),
      }))
    : [];

  const executionLogs = Array.isArray(row.execution_logs)
    ? row.execution_logs.map((l: Record<string, unknown>) => ({
        id: String(l.id),
        workflowName: String(l.workflow_name ?? ""),
        status: (l.status as ExecutionLog["status"]) ?? "Success",
        errorDetails: l.error_details ? String(l.error_details) : undefined,
        timestamp: String(l.timestamp ?? nowIso()),
        duration: String(l.duration ?? "0s"),
      }))
    : [];

  const incidents = Array.isArray(row.incidents)
    ? row.incidents.map((i: Record<string, unknown>) => ({
        id: String(i.id),
        title: String(i.title ?? ""),
        severity: (i.severity as ProjectIncident["severity"]) ?? "Low",
        status: (i.status as ProjectIncident["status"]) ?? "Open",
        rootCause: i.root_cause ? String(i.root_cause) : undefined,
        resolutionPlan: i.resolution_plan ? String(i.resolution_plan) : undefined,
        timestamp: String(i.timestamp ?? nowIso()),
      }))
    : [];

  const operatorChat = Array.isArray(row.operator_chat)
    ? row.operator_chat.map((m: Record<string, unknown>) => ({
        id: String(m.id),
        role: (m.role as OperatorMessage["role"]) ?? "system",
        content: String(m.content ?? ""),
        toolCall: m.tool_call as OperatorMessage["toolCall"],
      }))
    : [];

  const crmActivities = Array.isArray(row.crm_activities)
    ? row.crm_activities.map((a: Record<string, unknown>) => ({
        id: String(a.id),
        type: (a.type as CRMActivity["type"]) ?? "Note",
        subject: String(a.subject ?? ""),
        status: (a.status as CRMActivity["status"]) ?? "Completed",
        timestamp: String(a.timestamp ?? nowIso()),
      }))
    : [];

  const financials = (row.financials as Project["financials"]) ?? {
    revenue: 0,
    expenses: 0,
    hoursSaved: 0,
    costPerExecution: 0,
  };

  const governance = (row.governance as Project["governance"]) ?? {
    certified: false,
    lastScore: 0,
    verdict: "None",
  };

  return {
    id: String(row.id),
    brief,
    status: (row.status as Project["status"]) ?? "Intake",
    activeWorkflows: workflows,
    documents,
    executionLogs,
    incidents,
    operatorChat,
    crmActivities,
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
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = "SELECT * FROM council_sessions";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (projectId) {
    params.push(projectId);
    conditions.push(`project_id = $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    conditions.push(`user_id = $${params.length}`);
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY created_at DESC";

  const result = await p.query(query, params);
  return result.rows.map(rowToCouncilSession);
}

export async function getCouncilSession(sessionId: string, userId?: string): Promise<CouncilSession | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = "SELECT * FROM council_sessions WHERE id = $1";
  const params: unknown[] = [sessionId];

  if (userId) {
    query += " AND user_id = $2";
    params.push(userId);
  }

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;
  return rowToCouncilSession(result.rows[0]);
}

export async function saveCouncilSession(session: CouncilSession, userId?: string): Promise<CouncilSession> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  await p.query(
    `INSERT INTO council_sessions (
       id, user_id, project_id, gate_type, topic, opinions, synthesis, decision, pricing,
       language, board_name, current_stage, board_summary, next_steps, money_steps,
       workflow_suggestions, suggested_catalog_query, model_outputs, chairman_model,
       stage2_rankings, label_to_model, aggregate_rankings, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT (id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       gate_type = EXCLUDED.gate_type,
       topic = EXCLUDED.topic,
       opinions = EXCLUDED.opinions,
       synthesis = EXCLUDED.synthesis,
       decision = EXCLUDED.decision,
       pricing = EXCLUDED.pricing,
       language = EXCLUDED.language,
       board_name = EXCLUDED.board_name,
       current_stage = EXCLUDED.current_stage,
       board_summary = EXCLUDED.board_summary,
       next_steps = EXCLUDED.next_steps,
       money_steps = EXCLUDED.money_steps,
       workflow_suggestions = EXCLUDED.workflow_suggestions,
       suggested_catalog_query = EXCLUDED.suggested_catalog_query,
       model_outputs = EXCLUDED.model_outputs,
       chairman_model = EXCLUDED.chairman_model,
       stage2_rankings = EXCLUDED.stage2_rankings,
       label_to_model = EXCLUDED.label_to_model,
       aggregate_rankings = EXCLUDED.aggregate_rankings`,
    [
      session.id,
      userId,
      session.projectId,
      session.gateType,
      session.topic,
      JSON.stringify(session.opinions),
      session.synthesis,
      session.decision,
      session.pricing ? JSON.stringify(session.pricing) : null,
      session.language,
      session.boardName,
      session.currentStage ? JSON.stringify(session.currentStage) : null,
      session.boardSummary,
      session.nextSteps,
      session.moneySteps,
      session.workflowSuggestions ? JSON.stringify(session.workflowSuggestions) : null,
      session.suggestedCatalogQuery ? JSON.stringify(session.suggestedCatalogQuery) : null,
      session.modelOutputs ? JSON.stringify(session.modelOutputs) : null,
      session.chairmanModel,
      session.stage2Rankings ? JSON.stringify(session.stage2Rankings) : null,
      session.labelToModel ? JSON.stringify(session.labelToModel) : null,
      session.aggregateRankings ? JSON.stringify(session.aggregateRankings) : null,
      session.createdAt ?? nowIso(),
    ]
  );

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
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const id = generateId("job");
  const now = nowIso();

  await p.query(
    `INSERT INTO council_jobs (id, user_id, project_id, job_type, status, input, progress, created_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, 0, $6)`,
    [id, userId, projectId, jobType, JSON.stringify(input), now]
  );

  return {
    id,
    userId,
    projectId,
    jobType,
    status: "pending",
    input,
    progress: 0,
    createdAt: now,
  };
}

export async function getCouncilJob(jobId: string, userId?: string): Promise<CouncilJob | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = "SELECT * FROM council_jobs WHERE id = $1";
  const params: unknown[] = [jobId];

  if (userId) {
    query += " AND user_id = $2";
    params.push(userId);
  }

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;
  return rowToCouncilJob(result.rows[0]);
}

export async function updateCouncilJob(
  jobId: string,
  update: Partial<Pick<CouncilJob, "status" | "result" | "error" | "progress" | "startedAt" | "completedAt">>
): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (update.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(update.status);
  }
  if (update.result !== undefined) {
    sets.push(`result = $${idx++}`);
    params.push(JSON.stringify(update.result));
  }
  if (update.error !== undefined) {
    sets.push(`error = $${idx++}`);
    params.push(update.error);
  }
  if (update.progress !== undefined) {
    sets.push(`progress = $${idx++}`);
    params.push(update.progress);
  }
  if (update.startedAt !== undefined) {
    sets.push(`started_at = $${idx++}`);
    params.push(update.startedAt);
  }
  if (update.completedAt !== undefined) {
    sets.push(`completed_at = $${idx++}`);
    params.push(update.completedAt);
  }

  if (sets.length === 0) return;

  params.push(jobId);
  await p.query(`UPDATE council_jobs SET ${sets.join(", ")} WHERE id = $${idx}`, params);
}

export async function claimNextPendingJob(): Promise<CouncilJob | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const now = nowIso();
  const result = await p.query(
    `UPDATE council_jobs
     SET status = 'processing', started_at = $1
     WHERE id = (
       SELECT id FROM council_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [now]
  );

  if (result.rows.length === 0) return null;
  return rowToCouncilJob(result.rows[0]);
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
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "SELECT * FROM assistant_state WHERE user_id = $1"
    : "SELECT * FROM assistant_state WHERE user_id IS NULL";
  const params = userId ? [userId] : [];

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // Get messages
  const messagesQuery = userId
    ? "SELECT * FROM assistant_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 300"
    : "SELECT * FROM assistant_messages WHERE user_id IS NULL ORDER BY created_at ASC LIMIT 300";

  const messagesResult = await p.query(messagesQuery, params);
  const messages: AssistantMessage[] = messagesResult.rows.map((m) => ({
    id: String(m.id),
    role: (m.role as AssistantMessage["role"]) ?? "system",
    content: String(m.content ?? ""),
    toolCall: m.tool_call as AssistantMessage["toolCall"],
    createdAt: String(m.created_at ?? nowIso()),
  }));

  return {
    id: String(row.id),
    preferences: (row.preferences as AssistantPreferences) ?? {},
    messages,
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export async function saveAssistantState(state: AssistantState, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const client = await p.connect();

  try {
    await client.query("BEGIN");

    // Upsert state
    await client.query(
      `INSERT INTO assistant_state (id, user_id, preferences, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         preferences = EXCLUDED.preferences,
         updated_at = EXCLUDED.updated_at`,
      [state.id, userId, JSON.stringify(state.preferences), state.updatedAt]
    );

    // Replace messages
    if (userId) {
      await client.query("DELETE FROM assistant_messages WHERE user_id = $1", [userId]);
    } else {
      await client.query("DELETE FROM assistant_messages WHERE user_id IS NULL");
    }

    for (const msg of state.messages) {
      await client.query(
        `INSERT INTO assistant_messages (id, user_id, role, content, tool_call, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [msg.id, userId, msg.role, msg.content, msg.toolCall ? JSON.stringify(msg.toolCall) : null, msg.createdAt]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ============================================
// OUTBOUND LEADS
// ============================================

export async function listOutboundLeads(userId?: string): Promise<OutboundLead[]> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "SELECT * FROM outbound_leads WHERE user_id = $1 ORDER BY updated_at DESC"
    : "SELECT * FROM outbound_leads ORDER BY updated_at DESC";
  const params = userId ? [userId] : [];

  const result = await p.query(query, params);
  return result.rows.map(rowToOutboundLead);
}

export async function getOutboundLead(leadId: string, userId?: string): Promise<OutboundLead | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = "SELECT * FROM outbound_leads WHERE id = $1";
  const params: unknown[] = [leadId];

  if (userId) {
    query += " AND user_id = $2";
    params.push(userId);
  }

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;
  return rowToOutboundLead(result.rows[0]);
}

export async function saveOutboundLead(lead: OutboundLead, userId?: string): Promise<OutboundLead> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  await p.query(
    `INSERT INTO outbound_leads (
       id, user_id, name, category, address, website, phone, maps_url, country, city,
       stage, notes, last_action_at, next_follow_up_at, source, source_ref, external_ref,
       project_id, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       address = EXCLUDED.address,
       website = EXCLUDED.website,
       phone = EXCLUDED.phone,
       maps_url = EXCLUDED.maps_url,
       country = EXCLUDED.country,
       city = EXCLUDED.city,
       stage = EXCLUDED.stage,
       notes = EXCLUDED.notes,
       last_action_at = EXCLUDED.last_action_at,
       next_follow_up_at = EXCLUDED.next_follow_up_at,
       source = EXCLUDED.source,
       source_ref = EXCLUDED.source_ref,
       external_ref = EXCLUDED.external_ref,
       project_id = EXCLUDED.project_id,
       updated_at = EXCLUDED.updated_at`,
    [
      lead.id,
      userId,
      lead.name,
      lead.category,
      lead.address,
      lead.website,
      lead.phone,
      lead.mapsUrl,
      lead.country,
      lead.city,
      lead.stage,
      lead.notes,
      lead.lastActionAt,
      lead.nextFollowUpAt,
      lead.source,
      lead.sourceRef,
      lead.externalRef ? JSON.stringify(lead.externalRef) : null,
      lead.projectId,
      lead.createdAt,
      lead.updatedAt,
    ]
  );

  return lead;
}

export async function deleteOutboundLead(leadId: string, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "DELETE FROM outbound_leads WHERE id = $1 AND user_id = $2"
    : "DELETE FROM outbound_leads WHERE id = $1";
  const params = userId ? [leadId, userId] : [leadId];

  await p.query(query, params);
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
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "SELECT * FROM agency_state WHERE user_id = $1"
    : "SELECT * FROM agency_state WHERE user_id IS NULL LIMIT 1";
  const params = userId ? [userId] : [];

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // Get documents
  const docsQuery = userId
    ? "SELECT * FROM agency_documents WHERE user_id = $1 ORDER BY created_at DESC"
    : "SELECT * FROM agency_documents WHERE user_id IS NULL ORDER BY created_at DESC";

  const docsResult = await p.query(docsQuery, params);
  const documents: AgencyDocument[] = docsResult.rows.map((d) => ({
    id: String(d.id),
    type: (d.type as AgencyDocument["type"]) ?? "RevenuePlan",
    name: String(d.name ?? ""),
    status: (d.status as AgencyDocument["status"]) ?? "Draft",
    content: String(d.content ?? ""),
    createdAt: String(d.created_at ?? nowIso()),
  }));

  return {
    goal: (row.goal as AgencyState["goal"]) ?? "ai_agency",
    completedTaskIds: (row.completed_task_ids as string[]) ?? [],
    documents,
    revenueGoal: (row.revenue_goal as AgencyState["revenueGoal"]) ?? {
      currency: "USD",
      targetMrr: 0,
      avgRetainer: 0,
      closeRatePct: 0,
      bookingRatePct: 0,
      updatedAt: nowIso(),
    },
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export async function saveAgencyState(state: AgencyState, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const client = await p.connect();

  try {
    await client.query("BEGIN");

    const id = userId ?? "default";

    // Upsert state
    await client.query(
      `INSERT INTO agency_state (id, user_id, goal, completed_task_ids, revenue_goal, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         goal = EXCLUDED.goal,
         completed_task_ids = EXCLUDED.completed_task_ids,
         revenue_goal = EXCLUDED.revenue_goal,
         updated_at = EXCLUDED.updated_at`,
      [id, userId, state.goal, state.completedTaskIds, JSON.stringify(state.revenueGoal), state.updatedAt]
    );

    // Replace documents
    if (userId) {
      await client.query("DELETE FROM agency_documents WHERE user_id = $1", [userId]);
    } else {
      await client.query("DELETE FROM agency_documents WHERE user_id IS NULL");
    }

    for (const doc of state.documents) {
      await client.query(
        `INSERT INTO agency_documents (id, user_id, type, name, status, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [doc.id, userId, doc.type, doc.name, doc.status, doc.content, doc.createdAt]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ============================================
// MARKET RADAR STATE
// ============================================

export async function getMarketRadarState(userId?: string): Promise<MarketRadarState | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "SELECT * FROM market_radar_state WHERE user_id = $1"
    : "SELECT * FROM market_radar_state WHERE user_id IS NULL LIMIT 1";
  const params = userId ? [userId] : [];

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const stateId = row.id;

  // Get related data
  const [opportunities, youtubeTrends, youtubeIdeas, internetTrends, leads] = await Promise.all([
    p.query("SELECT * FROM market_opportunities WHERE state_id = $1", [stateId]),
    p.query("SELECT * FROM market_youtube_trends WHERE state_id = $1", [stateId]),
    p.query("SELECT * FROM market_youtube_ideas WHERE state_id = $1", [stateId]),
    p.query("SELECT * FROM market_internet_trends WHERE state_id = $1", [stateId]),
    p.query("SELECT * FROM market_lead_candidates WHERE state_id = $1", [stateId]),
  ]);

  return {
    country: String(row.country ?? ""),
    city: String(row.city ?? ""),
    niche: String(row.niche ?? ""),
    updatedAt: String(row.updated_at ?? nowIso()),
    opportunities: opportunities.rows.map((o) => o.data as MarketOpportunity),
    youtubeTrends: youtubeTrends.rows.map((t) => t.data as MarketTrendVideo),
    youtubeIdeas: youtubeIdeas.rows.map((i) => i.data as MarketVideoIdea),
    internetTrends: internetTrends.rows.map((t) => t.data as MarketInternetTrend),
    leads: leads.rows.map((l) => l.data as MarketLeadCandidate),
  };
}

export async function saveMarketRadarState(state: MarketRadarState, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const client = await p.connect();

  try {
    await client.query("BEGIN");

    const id = userId ?? "default";

    // Upsert main state
    await client.query(
      `INSERT INTO market_radar_state (id, user_id, country, city, niche, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         country = EXCLUDED.country,
         city = EXCLUDED.city,
         niche = EXCLUDED.niche,
         updated_at = EXCLUDED.updated_at`,
      [id, userId, state.country, state.city, state.niche, state.updatedAt]
    );

    // Clear and re-insert related data
    await client.query("DELETE FROM market_opportunities WHERE state_id = $1", [id]);
    await client.query("DELETE FROM market_youtube_trends WHERE state_id = $1", [id]);
    await client.query("DELETE FROM market_youtube_ideas WHERE state_id = $1", [id]);
    await client.query("DELETE FROM market_internet_trends WHERE state_id = $1", [id]);
    await client.query("DELETE FROM market_lead_candidates WHERE state_id = $1", [id]);

    for (const opp of state.opportunities) {
      await client.query(
        "INSERT INTO market_opportunities (id, state_id, data) VALUES ($1, $2, $3)",
        [opp.id, id, JSON.stringify(opp)]
      );
    }

    for (const trend of state.youtubeTrends) {
      await client.query(
        "INSERT INTO market_youtube_trends (id, state_id, data) VALUES ($1, $2, $3)",
        [trend.id, id, JSON.stringify(trend)]
      );
    }

    for (const idea of state.youtubeIdeas) {
      await client.query(
        "INSERT INTO market_youtube_ideas (id, state_id, data) VALUES ($1, $2, $3)",
        [idea.id, id, JSON.stringify(idea)]
      );
    }

    for (const trend of state.internetTrends) {
      await client.query(
        "INSERT INTO market_internet_trends (id, state_id, data) VALUES ($1, $2, $3)",
        [trend.id, id, JSON.stringify(trend)]
      );
    }

    for (const lead of state.leads) {
      await client.query(
        "INSERT INTO market_lead_candidates (id, state_id, data) VALUES ($1, $2, $3)",
        [lead.id, id, JSON.stringify(lead)]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ============================================
// RUNTIME SETTINGS
// ============================================

export async function getRuntimeSettings(): Promise<RuntimeSettings | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const result = await p.query("SELECT * FROM runtime_settings WHERE id = 'default' LIMIT 1");
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    activeEnvironment: (row.active_environment as EnvironmentName) ?? "Production",
    n8nBaseUrl: String(row.n8n_base_url ?? "http://localhost:5678"),
    suitecrmBaseUrl: String(row.suitecrm_base_url ?? "http://localhost:8091"),
    invoiceshelfBaseUrl: String(row.invoiceshelf_base_url ?? "http://localhost:8090"),
    documensoBaseUrl: String(row.documenso_base_url ?? "http://localhost:8092"),
    infisicalBaseUrl: String(row.infisical_base_url ?? "http://localhost:8081"),
    infisicalWorkspaceId: String(row.infisical_workspace_id ?? ""),
    infisicalSecretPath: String(row.infisical_secret_path ?? "/"),
    infisicalEnvDevelopmentSlug: String(row.infisical_env_development_slug ?? "dev"),
    infisicalEnvStagingSlug: String(row.infisical_env_staging_slug ?? "staging"),
    infisicalEnvProductionSlug: String(row.infisical_env_production_slug ?? "prod"),
    councilModels: String(row.council_models ?? ""),
    councilChairmanModel: String(row.council_chairman_model ?? ""),
    councilStage2Enabled: Boolean(row.council_stage2_enabled),
  };
}

export async function saveRuntimeSettings(settings: RuntimeSettings): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  await p.query(
    `INSERT INTO runtime_settings (
       id, active_environment, n8n_base_url, suitecrm_base_url, invoiceshelf_base_url,
       documenso_base_url, infisical_base_url, infisical_workspace_id, infisical_secret_path,
       infisical_env_development_slug, infisical_env_staging_slug, infisical_env_production_slug,
       council_models, council_chairman_model, council_stage2_enabled, updated_at
     ) VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
     ON CONFLICT (id) DO UPDATE SET
       active_environment = EXCLUDED.active_environment,
       n8n_base_url = EXCLUDED.n8n_base_url,
       suitecrm_base_url = EXCLUDED.suitecrm_base_url,
       invoiceshelf_base_url = EXCLUDED.invoiceshelf_base_url,
       documenso_base_url = EXCLUDED.documenso_base_url,
       infisical_base_url = EXCLUDED.infisical_base_url,
       infisical_workspace_id = EXCLUDED.infisical_workspace_id,
       infisical_secret_path = EXCLUDED.infisical_secret_path,
       infisical_env_development_slug = EXCLUDED.infisical_env_development_slug,
       infisical_env_staging_slug = EXCLUDED.infisical_env_staging_slug,
       infisical_env_production_slug = EXCLUDED.infisical_env_production_slug,
       council_models = EXCLUDED.council_models,
       council_chairman_model = EXCLUDED.council_chairman_model,
       council_stage2_enabled = EXCLUDED.council_stage2_enabled,
       updated_at = NOW()`,
    [
      settings.activeEnvironment,
      settings.n8nBaseUrl,
      settings.suitecrmBaseUrl,
      settings.invoiceshelfBaseUrl,
      settings.documensoBaseUrl,
      settings.infisicalBaseUrl,
      settings.infisicalWorkspaceId,
      settings.infisicalSecretPath,
      settings.infisicalEnvDevelopmentSlug,
      settings.infisicalEnvStagingSlug,
      settings.infisicalEnvProductionSlug,
      settings.councilModels,
      settings.councilChairmanModel,
      settings.councilStage2Enabled,
    ]
  );
}

// ============================================
// SECRETS
// ============================================

export async function listSecrets(): Promise<StoredSecret[]> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const result = await p.query("SELECT * FROM secrets ORDER BY last_updated DESC");
  return result.rows.map((row) => ({
    id: String(row.id),
    key: String(row.key),
    value: String(row.value),
    environment: (row.environment as EnvironmentName) ?? "Production",
    lastUpdated: String(row.last_updated ?? nowIso()),
  }));
}

export async function upsertSecret(secret: Omit<StoredSecret, "lastUpdated"> & { lastUpdated?: string }): Promise<StoredSecret> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const now = nowIso();
  const id = secret.id ?? generateId("sec");

  await p.query(
    `INSERT INTO secrets (id, key, value, environment, last_updated)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       key = EXCLUDED.key,
       value = EXCLUDED.value,
       environment = EXCLUDED.environment,
       last_updated = EXCLUDED.last_updated`,
    [id, secret.key, secret.value, secret.environment, secret.lastUpdated ?? now]
  );

  return {
    id,
    key: secret.key,
    value: secret.value,
    environment: secret.environment,
    lastUpdated: secret.lastUpdated ?? now,
  };
}

export async function deleteSecret(secretId: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  await p.query("DELETE FROM secrets WHERE id = $1", [secretId]);
}

// ============================================
// AGENCY BUILDER STATE
// ============================================

export async function getAgencyBuilderState(userId?: string): Promise<AgencyBuilderState | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "SELECT * FROM agency_builder_state WHERE user_id = $1"
    : "SELECT * FROM agency_builder_state WHERE user_id IS NULL LIMIT 1";
  const params = userId ? [userId] : [];

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    currentStep: (row.current_step as AgencyBuilderState["currentStep"]) ?? "sector",
    selectedSectorId: row.selected_sector_id ? String(row.selected_sector_id) : undefined,
    selectedNicheId: row.selected_niche_id ? String(row.selected_niche_id) : undefined,
    targetRegion: row.target_region ? String(row.target_region) : undefined,
    solution: row.solution as AgencyBuilderState["solution"],
    customizations: row.customizations as AgencyBuilderState["customizations"],
    deploymentStatus: row.deployment_status as AgencyBuilderState["deploymentStatus"],
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

export async function saveAgencyBuilderState(state: AgencyBuilderState, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const id = userId ?? "default";

  await p.query(
    `INSERT INTO agency_builder_state (
       id, user_id, current_step, selected_sector_id, selected_niche_id, target_region,
       solution, customizations, deployment_status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       current_step = EXCLUDED.current_step,
       selected_sector_id = EXCLUDED.selected_sector_id,
       selected_niche_id = EXCLUDED.selected_niche_id,
       target_region = EXCLUDED.target_region,
       solution = EXCLUDED.solution,
       customizations = EXCLUDED.customizations,
       deployment_status = EXCLUDED.deployment_status,
       updated_at = EXCLUDED.updated_at`,
    [
      id,
      userId,
      state.currentStep,
      state.selectedSectorId,
      state.selectedNicheId,
      state.targetRegion,
      state.solution ? JSON.stringify(state.solution) : null,
      state.customizations ? JSON.stringify(state.customizations) : null,
      state.deploymentStatus ? JSON.stringify(state.deploymentStatus) : null,
      state.createdAt,
      state.updatedAt,
    ]
  );
}

// ============================================
// PROPOSALS
// ============================================

export async function listProposals(userId?: string): Promise<Proposal[]> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "SELECT * FROM proposals WHERE user_id = $1 ORDER BY updated_at DESC"
    : "SELECT * FROM proposals ORDER BY updated_at DESC";
  const params = userId ? [userId] : [];

  const result = await p.query(query, params);
  return result.rows.map(rowToProposal);
}

export async function getProposal(proposalId: string, userId?: string): Promise<Proposal | null> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = "SELECT * FROM proposals WHERE id = $1";
  const params: unknown[] = [proposalId];

  if (userId) {
    query += " AND user_id = $2";
    params.push(userId);
  }

  const result = await p.query(query, params);
  if (result.rows.length === 0) return null;
  return rowToProposal(result.rows[0]);
}

export async function saveProposal(proposal: Proposal, userId?: string): Promise<Proposal> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  await p.query(
    `INSERT INTO proposals (
       id, user_id, project_id, client_name, client_email, client_company, title, summary,
       currency, tiers, selected_tier_id, scope, terms, valid_until, status,
       viewed_at, responded_at, external_ref, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     ON CONFLICT (id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       client_name = EXCLUDED.client_name,
       client_email = EXCLUDED.client_email,
       client_company = EXCLUDED.client_company,
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       currency = EXCLUDED.currency,
       tiers = EXCLUDED.tiers,
       selected_tier_id = EXCLUDED.selected_tier_id,
       scope = EXCLUDED.scope,
       terms = EXCLUDED.terms,
       valid_until = EXCLUDED.valid_until,
       status = EXCLUDED.status,
       viewed_at = EXCLUDED.viewed_at,
       responded_at = EXCLUDED.responded_at,
       external_ref = EXCLUDED.external_ref,
       updated_at = EXCLUDED.updated_at`,
    [
      proposal.id,
      userId,
      proposal.projectId,
      proposal.clientName,
      proposal.clientEmail,
      proposal.clientCompany,
      proposal.title,
      proposal.summary,
      proposal.currency,
      JSON.stringify(proposal.tiers),
      proposal.selectedTierId,
      JSON.stringify(proposal.scope),
      JSON.stringify(proposal.terms),
      proposal.validUntil,
      proposal.status,
      proposal.viewedAt,
      proposal.respondedAt,
      proposal.externalRef ? JSON.stringify(proposal.externalRef) : null,
      proposal.createdAt,
      proposal.updatedAt,
    ]
  );

  return proposal;
}

export async function deleteProposal(proposalId: string, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "DELETE FROM proposals WHERE id = $1 AND user_id = $2"
    : "DELETE FROM proposals WHERE id = $1";
  const params = userId ? [proposalId, userId] : [proposalId];

  await p.query(query, params);
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
      objectives: [],
      deliverables: [],
      timeline: "",
      assumptions: [],
      exclusions: [],
    },
    terms: (row.terms as Proposal["terms"]) ?? {
      paymentTerms: "",
      validityPeriod: 30,
      cancellationPolicy: "",
      revisionPolicy: "",
      confidentiality: false,
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
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  let query = "SELECT * FROM financial_transactions";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (userId) {
    params.push(userId);
    conditions.push(`user_id = $${params.length}`);
  }
  if (projectId) {
    params.push(projectId);
    conditions.push(`project_id = $${params.length}`);
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY date DESC, created_at DESC";

  const result = await p.query(query, params);
  return result.rows.map(rowToFinancialTransaction);
}

export async function saveFinancialTransaction(transaction: FinancialTransaction, userId?: string): Promise<FinancialTransaction> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  await p.query(
    `INSERT INTO financial_transactions (
       id, user_id, type, amount, currency, status, description, project_id,
       client_name, invoice_ref, date, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       type = EXCLUDED.type,
       amount = EXCLUDED.amount,
       currency = EXCLUDED.currency,
       status = EXCLUDED.status,
       description = EXCLUDED.description,
       project_id = EXCLUDED.project_id,
       client_name = EXCLUDED.client_name,
       invoice_ref = EXCLUDED.invoice_ref,
       date = EXCLUDED.date`,
    [
      transaction.id,
      userId,
      transaction.type,
      transaction.amount,
      transaction.currency,
      transaction.status,
      transaction.description,
      transaction.projectId,
      transaction.clientName,
      transaction.invoiceRef,
      transaction.date,
      transaction.createdAt,
    ]
  );

  return transaction;
}

export async function deleteFinancialTransaction(transactionId: string, userId?: string): Promise<void> {
  const p = getSupabasePool();
  if (!p) throw new Error("Database not connected");

  const query = userId
    ? "DELETE FROM financial_transactions WHERE id = $1 AND user_id = $2"
    : "DELETE FROM financial_transactions WHERE id = $1";
  const params = userId ? [transactionId, userId] : [transactionId];

  await p.query(query, params);
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
