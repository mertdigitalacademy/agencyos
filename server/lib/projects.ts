import type { Project, ProjectBrief } from "../../types";
import { readJsonFile, writeJsonFile, isUsingSupabase } from "./storage";
import * as supabase from "./supabaseStorage";

const PROJECTS_FILE = "projects.json";

export async function listProjects(userId?: string): Promise<Project[]> {
  if (isUsingSupabase()) {
    try {
      return await supabase.listProjects(userId);
    } catch (e) {
      console.error("Supabase listProjects failed, falling back to JSON:", e);
    }
  }
  return readJsonFile<Project[]>(PROJECTS_FILE, []);
}

export async function getProject(projectId: string, userId?: string): Promise<Project | null> {
  if (isUsingSupabase()) {
    try {
      return await supabase.getProject(projectId, userId);
    } catch (e) {
      console.error("Supabase getProject failed, falling back to JSON:", e);
    }
  }
  const projects = await listProjects();
  return projects.find((p) => p.id === projectId) ?? null;
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
  if (isUsingSupabase()) {
    try {
      // Check if project exists first
      const existing = await supabase.getProject(brief.id, userId);
      if (existing) return existing;
      return await supabase.createProject(brief, userId);
    } catch (e) {
      console.error("Supabase createProject failed, falling back to JSON:", e);
    }
  }

  const projects = await listProjects();
  const existing = projects.find((p) => p.id === brief.id);
  if (existing) return existing;

  const project = createProjectFromBrief(brief);
  await writeJsonFile(PROJECTS_FILE, [project, ...projects]);
  return project;
}

export async function saveProject(updated: Project, userId?: string): Promise<Project> {
  if (isUsingSupabase()) {
    try {
      return await supabase.saveProject(updated, userId);
    } catch (e) {
      console.error("Supabase saveProject failed, falling back to JSON:", e);
    }
  }

  const projects = await listProjects();
  const next = projects.some((p) => p.id === updated.id)
    ? projects.map((p) => (p.id === updated.id ? updated : p))
    : [updated, ...projects];
  await writeJsonFile(PROJECTS_FILE, next);
  return updated;
}

export async function deleteProject(projectId: string, userId?: string): Promise<void> {
  if (isUsingSupabase()) {
    try {
      await supabase.deleteProject(projectId, userId);
      return;
    } catch (e) {
      console.error("Supabase deleteProject failed, falling back to JSON:", e);
    }
  }

  const projects = await listProjects();
  const next = projects.filter((p) => p.id !== projectId);
  await writeJsonFile(PROJECTS_FILE, next);
}

