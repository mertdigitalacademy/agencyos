import type { AssistantMessage, AssistantPreferences, AssistantState } from "../../types";
import { readJsonFile, writeJsonFile } from "./storage";
import { isPostgresEnabled, pgKvGet, pgKvSet } from "./postgres";

const FILE = "assistant.json";
const KV_KEY = "assistant.state";

function nowIso(): string {
  return new Date().toISOString();
}

function safeText(input: unknown): string {
  return String(input ?? "").trim();
}

function normalizeLanguage(input: unknown): "tr" | "en" | undefined {
  const v = safeText(input).toLowerCase();
  if (v === "tr" || v === "en") return v;
  return undefined;
}

function normalizeIncomeFocus(input: unknown): Array<"ai_agency" | "youtube" | "passive"> | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: Array<"ai_agency" | "youtube" | "passive"> = [];
  const seen = new Set<string>();
  for (const v of input) {
    const s = safeText(v);
    if (s !== "ai_agency" && s !== "youtube" && s !== "passive") continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.length ? out.slice(0, 3) : undefined;
}

function defaultState(): AssistantState {
  const now = nowIso();
  return {
    id: "assistant-default",
    preferences: {},
    messages: [
      {
        id: "msg-welcome",
        role: "system",
        content:
          "You are the AgencyOS Global Assistant. Keep answers actionable, and use tool calls when helpful. Never request secrets.",
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
}

function sanitizePreferences(input: unknown): AssistantPreferences {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const language = normalizeLanguage(obj.language);
  const goalRaw = safeText(obj.goal);
  const goal =
    goalRaw === "ai_agency" ||
    goalRaw === "automation_agency" ||
    goalRaw === "web_design_agency" ||
    goalRaw === "ads_agency" ||
    goalRaw === "youtube_systems"
      ? (goalRaw as any)
      : undefined;
  const country = safeText(obj.country) || undefined;
  const city = safeText(obj.city) || undefined;
  const niche = safeText(obj.niche) || undefined;
  const incomeFocus = normalizeIncomeFocus(obj.incomeFocus);

  return {
    language,
    goal,
    country,
    city,
    niche,
    incomeFocus,
  };
}

function sanitizeMessages(input: unknown): AssistantMessage[] {
  if (!Array.isArray(input)) return [];
  const out: AssistantMessage[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = safeText(rec.id);
    const roleRaw = safeText(rec.role);
    const role = roleRaw === "user" || roleRaw === "assistant" || roleRaw === "system" ? (roleRaw as any) : null;
    const content = safeText(rec.content);
    const createdAt = safeText(rec.createdAt) || nowIso();
    if (!id || !role || !content) continue;
    const toolCallRaw = rec.toolCall && typeof rec.toolCall === "object" ? (rec.toolCall as Record<string, unknown>) : null;
    const name = toolCallRaw ? safeText(toolCallRaw.name) : "";
    const args = toolCallRaw && toolCallRaw.args && typeof toolCallRaw.args === "object" ? (toolCallRaw.args as Record<string, unknown>) : undefined;

    out.push({
      id,
      role,
      content: content.slice(0, 12_000),
      toolCall: name ? { name, args: args ?? {} } : undefined,
      createdAt,
    });
  }

  return out.slice(-300);
}

function sanitizeState(input: unknown): AssistantState {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const id = safeText(obj.id) || "assistant-default";
  const preferences = sanitizePreferences(obj.preferences);
  const messages = sanitizeMessages(obj.messages);
  const updatedAt = safeText(obj.updatedAt) || nowIso();
  return { id, preferences, messages: messages.length ? messages : defaultState().messages, updatedAt };
}

async function readFromDisk(): Promise<AssistantState> {
  const saved = await readJsonFile<Partial<AssistantState>>(FILE, {});
  return sanitizeState(saved);
}

async function writeToDisk(state: AssistantState): Promise<void> {
  await writeJsonFile(FILE, state);
}

export async function readAssistantState(): Promise<AssistantState> {
  if (isPostgresEnabled()) {
    try {
      const data = await pgKvGet<AssistantState>(KV_KEY);
      if (data) return sanitizeState(data);
      const initial = defaultState();
      await pgKvSet(KV_KEY, initial);
      return initial;
    } catch {
      // fall back to disk
    }
  }
  const disk = await readFromDisk();
  if (!disk.messages?.length) return defaultState();
  return disk;
}

export async function writeAssistantState(next: AssistantState): Promise<void> {
  const state = sanitizeState(next);
  if (isPostgresEnabled()) {
    try {
      await pgKvSet(KV_KEY, state);
      return;
    } catch {
      // fall back to disk
    }
  }
  await writeToDisk(state);
}

export async function appendAssistantMessage(msg: Omit<AssistantMessage, "createdAt"> & { createdAt?: string }): Promise<AssistantState> {
  const current = await readAssistantState();
  const nextMsg: AssistantMessage = {
    id: safeText(msg.id) || `msg-${Date.now()}`,
    role: msg.role,
    content: safeText(msg.content).slice(0, 12_000),
    toolCall: msg.toolCall && safeText(msg.toolCall.name) ? { name: safeText(msg.toolCall.name), args: (msg.toolCall.args ?? {}) as any } : undefined,
    createdAt: safeText(msg.createdAt) || nowIso(),
  };
  const next: AssistantState = {
    ...current,
    messages: [...current.messages, nextMsg].slice(-300),
    updatedAt: nowIso(),
  };
  await writeAssistantState(next);
  return next;
}

export async function patchAssistantPreferences(patch: Partial<AssistantPreferences>): Promise<AssistantState> {
  const current = await readAssistantState();
  const merged: AssistantPreferences = {
    ...current.preferences,
    ...patch,
  };
  const next: AssistantState = {
    ...current,
    preferences: sanitizePreferences(merged),
    updatedAt: nowIso(),
  };
  await writeAssistantState(next);
  return next;
}

export async function resetAssistantState(): Promise<AssistantState> {
  const initial = defaultState();
  await writeAssistantState(initial);
  return initial;
}

