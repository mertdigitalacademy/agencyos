import { promises as fs } from "node:fs";
import path from "node:path";

export type CatalogComplexity = "Low" | "Medium" | "High";

export type CatalogWorkflow = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  searchTokens: string[];
  complexity: CatalogComplexity;
  credentials: string[];
  nodeTypes: string[];
  nodeCount: number;
  relativePath: string;
};

export type WorkflowInstallPlan = {
  credentialChecklist: string[];
  installSteps: string[];
  testSteps: string[];
  riskNotes: string[];
};

const WORKFLOWS_DIR = path.resolve(process.cwd(), "external/n8n-workflows/workflows");

let cachedIndex: CatalogWorkflow[] | null = null;

export function resetCatalogIndexCache(): void {
  cachedIndex = null;
}

export function encodeWorkflowId(relativePath: string): string {
  return Buffer.from(relativePath, "utf8").toString("base64url");
}

export function decodeWorkflowId(id: string): string {
  return Buffer.from(id, "base64url").toString("utf8");
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) files.push(full);
  }
  return files;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function toComplexity(nodeCount: number): CatalogComplexity {
  if (nodeCount <= 5) return "Low";
  if (nodeCount <= 12) return "Medium";
  return "High";
}

function normalizeTag(tag: string): string {
  return tag
    .replace(/^n8n-nodes-base\./, "")
    .replace(/^@n8n\/n8n-nodes-langchain\./, "langchain.")
    .replace(/^n8n-nodes-langchain\./, "langchain.")
    .replace(/^n8n-nodes-community\./, "community.")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .trim();
}

function extractWorkflowTags(nodeTypes: string[]): string[] {
  const raw = nodeTypes
    .map((type) => normalizeTag(type))
    .map((t) => t.split(".").pop() || t)
    .map((t) => t.trim())
    .filter(Boolean);

  const tags = unique(raw)
    .filter((t) => !["start", "manual trigger"].includes(t.toLowerCase()))
    .slice(0, 12);

  return tags;
}

function extractCredentials(workflowJson: any): string[] {
  const nodes = Array.isArray(workflowJson?.nodes) ? workflowJson.nodes : [];
  const creds = nodes.flatMap((n: any) => Object.keys(n?.credentials ?? {})) as string[];
  return unique<string>(creds).sort((a, b) => a.localeCompare(b));
}

function hasNodeType(nodeTypes: string[], predicate: (t: string) => boolean): boolean {
  return nodeTypes.some((t) => predicate(t.toLowerCase()));
}

export function buildInstallPlan(meta: CatalogWorkflow): WorkflowInstallPlan {
  const credentialChecklist = meta.credentials.map((c) => c);
  const installSteps = [
    "Download the workflow JSON from AgencyOS.",
    "In n8n, go to Workflows → Import → From File (or From URL).",
    "Create the required credentials and assign them to nodes.",
    "Review node parameters (URLs, IDs, filters) before enabling.",
    "Run a test execution, then activate the workflow.",
  ];

  const testSteps: string[] = [];
  if (hasNodeType(meta.nodeTypes, (t) => t.includes("webhook"))) {
    testSteps.push("Trigger the Webhook node with a test request and verify the execution output.");
  }
  if (hasNodeType(meta.nodeTypes, (t) => t.includes("cron") || t.includes("schedule"))) {
    testSteps.push("Use manual execution first; then verify the schedule trigger timing.");
  }
  if (testSteps.length === 0) testSteps.push("Click “Execute workflow” in n8n and verify each node output.");

  const riskNotes: string[] = [];
  if (meta.complexity === "High") riskNotes.push("High complexity: expect more configuration and edge cases.");
  if (hasNodeType(meta.nodeTypes, (t) => t.includes("http"))) {
    riskNotes.push("HTTP nodes detected: validate external endpoints, timeouts, retries, and allowlists.");
  }
  if (hasNodeType(meta.nodeTypes, (t) => t.includes("code") || t.includes("function"))) {
    riskNotes.push("Code nodes detected: require code review for security and maintenance.");
  }
  if (meta.credentials.length > 3) {
    riskNotes.push("Multiple credentials required: plan a secure credential handoff and rotation policy.");
  }
  if (riskNotes.length === 0) riskNotes.push("Standard automation risk: validate credentials scope and logging before go-live.");

  return { credentialChecklist, installSteps, testSteps, riskNotes };
}

export async function getCatalogIndex(): Promise<CatalogWorkflow[]> {
  if (cachedIndex) return cachedIndex;

  const files = await listJsonFiles(WORKFLOWS_DIR);
  const items: CatalogWorkflow[] = [];

  for (const fullPath of files) {
    const relativePath = path.relative(WORKFLOWS_DIR, fullPath);
    try {
      const raw = await fs.readFile(fullPath, "utf8");
      const json = JSON.parse(raw);

      const name = typeof json?.name === "string" && json.name.trim().length > 0 ? json.name : path.basename(fullPath, ".json");
      const nodes = Array.isArray(json?.nodes) ? json.nodes : [];
      const nodeTypes = unique<string>(nodes.map((n: any) => String(n?.type ?? "")).filter(Boolean));
      const tags = extractWorkflowTags(nodeTypes);
      const credentials = extractCredentials(json);
      const nodeCount = nodes.length;
      const complexity = toComplexity(nodeCount);
      const searchTokens = buildSearchTokens({ workflowJson: json, relativePath, tags, credentials, nodeTypes });

      const description =
        typeof json?.settings?.timezone === "string"
          ? `Timezone: ${json.settings.timezone}.`
          : `Auto-extracted integrations: ${tags.slice(0, 6).join(", ") || "n8n"}.`;

      items.push({
        id: encodeWorkflowId(relativePath),
        name,
        description,
        tags,
        searchTokens,
        complexity,
        credentials,
        nodeTypes,
        nodeCount,
        relativePath,
      });
    } catch {
      continue;
    }
  }

  cachedIndex = items;
  return items;
}

function tokenize(query: string): string[] {
  const normalized = String(query ?? "")
    .toLowerCase()
    .normalize("NFKD")
    // Remove diacritics so e.g. "sözleşme" → "sozlesme" (helps TR search).
    .replace(/\p{M}/gu, "")
    // Turkish dotless i.
    .replace(/ı/g, "i");

  return normalized
    .split(/[^\p{L}\p{N}]+/gu)
    .map((t) => t.trim())
    .filter(Boolean);
}

function buildSearchTokens(params: { workflowJson: any; relativePath: string; tags: string[]; credentials: string[]; nodeTypes: string[] }): string[] {
  const { workflowJson, relativePath, tags, credentials, nodeTypes } = params;
  const nodes = Array.isArray(workflowJson?.nodes) ? workflowJson.nodes : [];

  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "your",
    "you",
    "to",
    "of",
    "in",
    "on",
    "or",
    "a",
    "an",
    "is",
    "are",
    "be",
    "as",
    "via",
    "api",
    "url",
    "http",
    "https",
    "request",
    "webhook",
    "trigger",
    "manual",
    "workflow",
    "node",
    "json",
    "set",
    "get",
    "create",
    "update",
    "delete",
    "send",
    "data",
    "true",
    "false",
  ]);

  const freq = new Map<string, number>();
  const bump = (token: string) => {
    const t = token.trim().toLowerCase();
    if (!t) return;
    if (t.length < 3) return;
    if (stop.has(t)) return;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  };

  const addText = (text: string) => {
    for (const t of tokenize(text)) bump(t);
  };

  addText(relativePath);
  if (typeof workflowJson?.name === "string") addText(workflowJson.name);
  addText(tags.join(" "));
  addText(credentials.join(" "));
  addText(nodeTypes.join(" "));

  for (const node of nodes) {
    if (typeof node?.name === "string") addText(node.name);
    if (typeof node?.notes === "string") addText(node.notes);

    const type = String(node?.type ?? "");
    if (type.toLowerCase().includes("stickynote")) {
      const content =
        typeof node?.parameters?.content === "string"
          ? node.parameters.content
          : typeof node?.parameters?.text === "string"
            ? node.parameters.text
            : "";
      if (content) addText(content);
    }

    const url = typeof node?.parameters?.url === "string" ? node.parameters.url : "";
    if (url) addText(url);

    const creds = node?.credentials;
    if (creds && typeof creds === "object") {
      for (const cred of Object.values(creds as Record<string, any>)) {
        if (typeof cred?.name === "string") addText(cred.name);
      }
    }
  }

  const tokens = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 64);

  return tokens;
}

export async function searchCatalog(params: {
  query: string;
  limit?: number;
  requiredTags?: string[];
}): Promise<Array<CatalogWorkflow & { score: number }>> {
  const { query, limit = 10, requiredTags = [] } = params;
  const tokens = tokenize(query);
  const required = requiredTags.map((t) => t.toLowerCase());

  const index = await getCatalogIndex();
  const scored = index
    .filter((wf) => required.every((t) => wf.tags.some((tag) => tag.toLowerCase().includes(t))))
    .map((wf) => {
      let score = 0;
      let matchedAny = false;
      const hayName = wf.name.toLowerCase();
      const hayDesc = wf.description.toLowerCase();
      const hayTags = wf.tags.map((t) => t.toLowerCase());
      const haySearch = wf.searchTokens ?? [];

      for (const token of tokens) {
        let tokenMatched = false;
        if (hayName.includes(token)) {
          score += 10;
          tokenMatched = true;
        }
        if (hayTags.some((t) => t.includes(token))) {
          score += 6;
          tokenMatched = true;
        }
        if (hayDesc.includes(token)) {
          score += 3;
          tokenMatched = true;
        }
        if (haySearch.some((t) => t.includes(token))) {
          score += 4;
          tokenMatched = true;
        }
        if (tokenMatched) matchedAny = true;
      }

      if (tokens.length === 0) score = 1;

      // Light-weight scoring signals for "installation difficulty / risk / maintenance"
      // without breaking keyword search relevance.
      if (wf.complexity === "Low") score += 2;
      if (wf.complexity === "High") score -= 4;

      if (wf.credentials.length >= 2) score -= Math.min(6, wf.credentials.length); // more creds = more setup

      const nodeTypes = wf.nodeTypes.map((t) => t.toLowerCase());
      if (nodeTypes.some((t) => t.includes("webhook"))) score += 2; // better for demos
      if (nodeTypes.some((t) => t.includes("schedule") || t.includes("cron"))) score += 1;
      if (nodeTypes.some((t) => t.includes("http"))) score -= 2;
      if (nodeTypes.some((t) => t.includes("code") || t.includes("function"))) score -= 4;

      return { ...wf, score, matchedAny };
    })
    .filter((wf) => tokens.length === 0 || wf.matchedAny)
    .map(({ matchedAny: _matchedAny, ...wf }) => wf)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export async function readWorkflowJsonById(id: string): Promise<any> {
  const relativePath = decodeWorkflowId(id);
  const fullPath = path.resolve(WORKFLOWS_DIR, relativePath);
  if (!fullPath.startsWith(WORKFLOWS_DIR + path.sep)) throw new Error("Invalid workflow id");
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}
