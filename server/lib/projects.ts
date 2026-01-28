import type { Project, ProjectBrief } from "../../types";
import { isUsingSupabase } from "./storage";
import * as supabase from "./supabaseStorage";

function requireDb(): void {
  if (!isUsingSupabase()) {
    throw new Error("Database not available");
  }
}

export async function listProjects(userId?: string): Promise<Project[]> {
  requireDb();
  return await supabase.listProjects(userId);
}

export async function getProject(projectId: string, userId?: string): Promise<Project | null> {
  requireDb();
  return await supabase.getProject(projectId, userId);
}

export function createProjectFromBrief(brief: ProjectBrief): Project {
  const now = new Date().toISOString();
  return {
    id: brief.id,
    brief,
    status: "Intake",
    activeWorkflows: [],
    documents: [],
    executionLogs: [],
    incidents: [],
    crmActivities: [
      {
        id: "crm-1",
        type: "Note",
        subject: "Project Initialized from Intake Wizard",
        status: "Completed",
        timestamp: now,
      },
    ],
    operatorChat: [
      {
        id: "sys-1",
        role: "system",
        content: `Operator initialized for ${brief.clientName}. I am connected to your n8n MCP server cluster.`,
      },
    ],
    financials: {
      revenue: 0,
      expenses: 0,
      hoursSaved: 0,
      costPerExecution: 0,
    },
    governance: {
      certified: false,
      lastScore: 0,
      verdict: "None",
    },
    totalBilled: 0,
    createdAt: now,
  };
}

export async function createProject(brief: ProjectBrief, userId?: string): Promise<Project> {
  requireDb();
  const existing = await supabase.getProject(brief.id, userId);
  if (existing) return existing;
  return await supabase.createProject(brief, userId);
}

export async function saveProject(updated: Project, userId?: string): Promise<Project> {
  requireDb();
  return await supabase.saveProject(updated, userId);
}

export async function deleteProject(projectId: string, userId?: string): Promise<void> {
  requireDb();
  await supabase.deleteProject(projectId, userId);
}
