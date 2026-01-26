import type { Project, ProjectBrief, ProjectDocument, Workflow } from "../../types";
import { createProjectFromBrief, listProjects, saveProject } from "./projects";
import { buildInstallPlan, searchCatalog } from "./catalog";

function nowIso(): string {
  return new Date().toISOString();
}

function mkDoc(params: {
  projectId: string;
  clientName: string;
  title: string;
  type: ProjectDocument["type"];
  status: ProjectDocument["status"];
  content: string;
}): ProjectDocument {
  return {
    id: `doc-${params.projectId}-${Date.now()}`,
    name: params.title,
    type: params.type,
    status: params.status,
    content: params.content,
    url: "#",
    createdAt: nowIso(),
  };
}

async function pickStagedWorkflows(params: {
  query: string;
  requiredTags?: string[];
  limit: number;
}): Promise<Workflow[]> {
  const items = await searchCatalog({
    query: params.query,
    requiredTags: params.requiredTags ?? [],
    limit: Math.max(3, params.limit * 3),
  });

  const picked = items.slice(0, params.limit);
  const now = nowIso();

  return picked.map((meta) => ({
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
      status: "Staged",
      updatedAt: now,
    },
  }));
}

function demoBriefs(): ProjectBrief[] {
  return [
    {
      id: "demo-acme-ecom",
      clientName: "Acme Ecom (Shopify Ops)",
      industry: "E-commerce",
      description:
        "Shopify siparişleri geldiğinde CRM’e lead aç, fatura/ödeme akışını yönet, Slack’ten operasyon bildirimi gönder ve haftalık KPI raporu üret.",
      goals: ["Lead → CRM", "Invoice → Payment tracking", "Weekly ops report", "Alerting / MTTR"],
      tools: ["n8n", "Shopify", "SuiteCRM", "InvoiceShelf", "Slack", "Google Sheets"],
      budget: "$2,500 / month",
      riskLevel: "Medium",
    },
    {
      id: "demo-nova-marketing",
      clientName: "Nova Growth (Marketing Ops)",
      industry: "Marketing Ops",
      description:
        "Lead form’dan gelen başvuruları otomatik nitelendir, CRM’e yaz, Council ile fiyat/scope netleştir, sözleşme gönder (e-imza) ve fatura kes.",
      goals: ["Lead qualification", "Proposal & pricing", "Contract signature", "Invoice", "Client onboarding"],
      tools: ["n8n", "SuiteCRM", "Documenso", "InvoiceShelf", "Slack", "Notion"],
      budget: "$4,000 / month",
      riskLevel: "High",
    },
  ];
}

function flowDocContent(brief: ProjectBrief): string {
  const lines: string[] = [];
  lines.push(`# AgencyOS Demo Flow — ${brief.clientName}`);
  lines.push("");
  lines.push("## What to demo (3–5 minutes)");
  lines.push("1) Open the project.");
  lines.push("2) Click **Run Revenue Machine** (Council → Catalog → Deploy → CRM → Invoice).");
  lines.push("3) Open **CRM** tab to see the SuiteCRM sync + leads list.");
  lines.push("4) Open **Documents / Financials** to see invoice + generated report.");
  lines.push("5) Open **Monitoring** to see n8n execution feed (needs N8N_API_KEY).");
  lines.push("");
  lines.push("## Core integrations in this demo");
  lines.push("- n8n: workflow staging/import/activate (API key required for import).");
  lines.push("- n8n-workflows: offline catalog search + JSON download.");
  lines.push("- LLM Council: proposal/pricing + risk gates (OpenRouter recommended).");
  lines.push("- SuiteCRM: lead sync + lead list.");
  lines.push("- InvoiceShelf: invoice creation (token required).");
  lines.push("- Documenso: e-sign contract (token + template required).");
  lines.push("");
  lines.push("## Data mapping (SuiteCRM Lead)");
  lines.push(`- last_name: ${brief.clientName}`);
  lines.push(`- lead_source: AgencyOS`);
  lines.push(`- description: ${brief.description}`);
  lines.push("");
  lines.push("## Notes");
  lines.push("- If an integration is not configured, the pipeline will skip that step and continue.");
  lines.push("- Configure tokens/URLs in **Settings → Vault / Runtime Settings**.");
  return lines.join("\n");
}

export async function seedDemoProjects(): Promise<{ projects: Project[]; createdIds: string[] }> {
  const existing = await listProjects();
  const byId = new Map(existing.map((p) => [p.id, p] as const));

  const createdIds: string[] = [];
  for (const brief of demoBriefs()) {
    if (byId.has(brief.id)) continue;

    const project = createProjectFromBrief(brief);

    const staged = await pickStagedWorkflows({
      query: [brief.industry ?? "", brief.description, ...brief.tools, ...brief.goals].filter(Boolean).join(" "),
      requiredTags: [],
      limit: 3,
    }).catch(() => []);

    const doc = mkDoc({
      projectId: project.id,
      clientName: brief.clientName,
      title: "Demo Flow Map (Runbook)",
      type: "Report",
      status: "Draft",
      content: flowDocContent(brief),
    });

    const seeded: Project = {
      ...project,
      status: "Proposal",
      activeWorkflows: staged,
      documents: [doc, ...project.documents],
      crmActivities: [
        {
          id: `crm-${Date.now()}`,
          type: "Note",
          subject: "Demo project seeded (use Run Demo Pipeline).",
          status: "Completed",
          timestamp: nowIso(),
        },
        ...project.crmActivities,
      ],
      financials: {
        ...project.financials,
        hoursSaved: 12,
      },
    };

    await saveProject(seeded);
    createdIds.push(brief.id);
  }

  const projects = await listProjects();
  return { projects, createdIds };
}
