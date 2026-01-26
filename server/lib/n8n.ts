type N8nConfig = {
  baseUrl: string;
  apiKey: string;
};

export type N8nWorkflow = { id: string; name: string; active: boolean };

export type N8nWorkflowCreateInput = {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
  staticData?: unknown;
};

export function getN8nConfig(): N8nConfig | null {
  const baseUrl = String(process.env.N8N_BASE_URL ?? "http://localhost:5678").replace(/\/+$/, "");
  const apiKey = String(process.env.N8N_API_KEY ?? "").trim();
  if (!apiKey) return null;
  return { baseUrl, apiKey };
}

async function n8nRequest<T>(path: string, init: RequestInit): Promise<T> {
  const cfg = getN8nConfig();
  if (!cfg) throw new Error("n8n not configured (set N8N_API_KEY)");

  const res = await fetch(`${cfg.baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": cfg.apiKey,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`n8n API error (${res.status}): ${body.slice(0, 800)}`);
  }

  return (await res.json()) as T;
}

export async function createWorkflow(input: N8nWorkflowCreateInput): Promise<N8nWorkflow> {
  return n8nRequest<N8nWorkflow>("/workflows", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      nodes: input.nodes,
      connections: input.connections,
      settings: input.settings,
      staticData: input.staticData ?? null,
    }),
  });
}

export async function updateWorkflow(workflowId: string, input: N8nWorkflowCreateInput): Promise<N8nWorkflow> {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(workflowId)}`, {
    method: "PUT",
    body: JSON.stringify({
      name: input.name,
      nodes: input.nodes,
      connections: input.connections,
      settings: input.settings,
      staticData: input.staticData ?? null,
    }),
  });
}

export async function activateWorkflow(
  workflowId: string,
  options?: { versionId?: string; name?: string; description?: string },
): Promise<N8nWorkflow> {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(workflowId)}/activate`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export async function deactivateWorkflow(workflowId: string): Promise<N8nWorkflow> {
  return n8nRequest<N8nWorkflow>(`/workflows/${encodeURIComponent(workflowId)}/deactivate`, { method: "POST" });
}

export type N8nExecutionStatus =
  | "canceled"
  | "crashed"
  | "error"
  | "new"
  | "running"
  | "success"
  | "unknown"
  | "waiting";

export type N8nExecution = {
  id: number;
  finished?: boolean;
  mode?: string;
  retryOf?: number | null;
  startedAt: string;
  stoppedAt?: string | null;
  workflowId?: any;
  status: N8nExecutionStatus;
};

export async function listExecutions(params: {
  workflowId?: string;
  status?: N8nExecutionStatus;
  limit?: number;
  cursor?: string;
  includeData?: boolean;
}): Promise<{ data: N8nExecution[]; nextCursor?: string | null }> {
  const url = new URLSearchParams();
  if (params.workflowId) url.set("workflowId", params.workflowId);
  if (params.status) url.set("status", params.status);
  if (params.limit != null) url.set("limit", String(params.limit));
  if (params.cursor) url.set("cursor", params.cursor);
  if (params.includeData != null) url.set("includeData", params.includeData ? "true" : "false");

  const qs = url.toString();
  const path = `/executions${qs ? `?${qs}` : ""}`;
  return n8nRequest<{ data: N8nExecution[]; nextCursor?: string | null }>(path, { method: "GET" });
}

export async function listWorkflows(params?: {
  limit?: number;
  cursor?: string;
  active?: boolean;
  name?: string;
}): Promise<{ data: Array<{ id: string; name: string; active: boolean }>; nextCursor?: string | null }> {
  const url = new URLSearchParams();
  if (params?.limit != null) url.set("limit", String(params.limit));
  if (params?.cursor) url.set("cursor", params.cursor);
  if (params?.active != null) url.set("active", params.active ? "true" : "false");
  if (params?.name) url.set("name", params.name);

  const qs = url.toString();
  const path = `/workflows${qs ? `?${qs}` : ""}`;
  return n8nRequest<{ data: Array<{ id: string; name: string; active: boolean }>; nextCursor?: string | null }>(path, {
    method: "GET",
  });
}
