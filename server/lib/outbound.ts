import type { OutboundLead, OutboundStage } from "../../types";
import { readJsonFile, writeJsonFile } from "./storage";

const FILE = "outbound-leads.json";

const STAGES: OutboundStage[] = ["New", "Contacted", "Replied", "Booked", "Proposal", "Won", "Lost"];
const SOURCES = ["market_radar", "manual"] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function safeText(input: unknown): string {
  return String(input ?? "").trim();
}

function clampText(input: unknown, max: number): string {
  const s = safeText(input);
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max);
}

function isStage(value: unknown): value is OutboundStage {
  return typeof value === "string" && (STAGES as string[]).includes(value);
}

function normalizeStage(value: unknown): OutboundStage {
  return isStage(value) ? value : "New";
}

function normalizeSource(value: unknown): OutboundLead["source"] {
  const v = safeText(value).toLowerCase();
  return (SOURCES as readonly string[]).includes(v) ? (v as any) : "manual";
}

function sanitizeIso(value: unknown): string {
  const v = safeText(value);
  return v ? v : nowIso();
}

function sanitizeLead(value: unknown): OutboundLead | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;

  const id = clampText(rec.id, 120);
  const name = clampText(rec.name, 200);
  if (!id || !name) return null;

  const stage = normalizeStage(rec.stage);
  const source = normalizeSource(rec.source);

  const lead: OutboundLead = {
    id,
    name,
    category: clampText(rec.category, 160) || undefined,
    address: clampText(rec.address, 400) || undefined,
    website: clampText(rec.website, 300) || undefined,
    phone: clampText(rec.phone, 80) || undefined,
    mapsUrl: clampText(rec.mapsUrl, 600) || undefined,
    country: clampText(rec.country, 120) || undefined,
    city: clampText(rec.city, 120) || undefined,
    stage,
    notes: clampText(rec.notes, 2000) || undefined,
    lastActionAt: safeText(rec.lastActionAt) || undefined,
    nextFollowUpAt: safeText(rec.nextFollowUpAt) || undefined,
    source,
    sourceRef: clampText(rec.sourceRef, 200) || undefined,
    externalRef: rec.externalRef && typeof rec.externalRef === "object" ? (rec.externalRef as any) : undefined,
    projectId: clampText(rec.projectId, 120) || undefined,
    createdAt: sanitizeIso(rec.createdAt),
    updatedAt: sanitizeIso(rec.updatedAt),
  };

  return lead;
}

function sanitizeLeads(values: unknown): OutboundLead[] {
  if (!Array.isArray(values)) return [];
  const out: OutboundLead[] = [];
  const seen = new Set<string>();

  for (const v of values) {
    const lead = sanitizeLead(v);
    if (!lead) continue;
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    out.push(lead);
  }

  return out.slice(0, 1000);
}

async function readAll(): Promise<OutboundLead[]> {
  const stored = await readJsonFile<unknown>(FILE, []);
  const leads = sanitizeLeads(stored);
  leads.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return leads;
}

async function writeAll(items: OutboundLead[]): Promise<void> {
  await writeJsonFile(FILE, items.slice(0, 1000));
}

export async function listOutboundLeads(): Promise<OutboundLead[]> {
  return readAll();
}

export async function createOutboundLead(input: unknown): Promise<OutboundLead> {
  const now = nowIso();
  const rec = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const name = clampText(rec.name, 200);
  if (!name) throw new Error("Missing lead name");

  const source = normalizeSource(rec.source);
  const sourceRef = clampText(rec.sourceRef, 200) || undefined;
  const website = clampText(rec.website, 300) || undefined;

  const items = await readAll();
  const existing =
    (sourceRef ? items.find((l) => l.source === source && l.sourceRef && l.sourceRef === sourceRef) : undefined) ??
    (website ? items.find((l) => l.website && l.website === website) : undefined);
  if (existing) return existing;

  const id = `outlead-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const lead: OutboundLead = {
    id,
    name,
    category: clampText(rec.category, 160) || undefined,
    address: clampText(rec.address, 400) || undefined,
    website,
    phone: clampText(rec.phone, 80) || undefined,
    mapsUrl: clampText(rec.mapsUrl, 600) || undefined,
    country: clampText(rec.country, 120) || undefined,
    city: clampText(rec.city, 120) || undefined,
    stage: normalizeStage(rec.stage),
    notes: clampText(rec.notes, 2000) || undefined,
    lastActionAt: safeText(rec.lastActionAt) || undefined,
    nextFollowUpAt: safeText(rec.nextFollowUpAt) || undefined,
    source,
    sourceRef,
    externalRef: rec.externalRef && typeof rec.externalRef === "object" ? (rec.externalRef as any) : undefined,
    projectId: clampText(rec.projectId, 120) || undefined,
    createdAt: now,
    updatedAt: now,
  };

  const next = [lead, ...items].slice(0, 1000);
  await writeAll(next);
  return lead;
}

export async function updateOutboundLead(id: string, patch: unknown): Promise<OutboundLead> {
  const safeId = clampText(id, 120);
  if (!safeId) throw new Error("Missing lead id");
  const rec = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};

  const items = await readAll();
  const idx = items.findIndex((l) => l.id === safeId);
  if (idx < 0) throw new Error("Lead not found");
  const current = items[idx]!;

  const next: OutboundLead = {
    ...current,
    name: clampText(rec.name ?? current.name, 200) || current.name,
    category: clampText(rec.category ?? current.category, 160) || undefined,
    address: clampText(rec.address ?? current.address, 400) || undefined,
    website: clampText(rec.website ?? current.website, 300) || undefined,
    phone: clampText(rec.phone ?? current.phone, 80) || undefined,
    mapsUrl: clampText(rec.mapsUrl ?? current.mapsUrl, 600) || undefined,
    country: clampText(rec.country ?? current.country, 120) || undefined,
    city: clampText(rec.city ?? current.city, 120) || undefined,
    stage: normalizeStage(rec.stage ?? current.stage),
    notes: clampText(rec.notes ?? current.notes, 2000) || undefined,
    lastActionAt: safeText(rec.lastActionAt ?? current.lastActionAt) || undefined,
    nextFollowUpAt: safeText(rec.nextFollowUpAt ?? current.nextFollowUpAt) || undefined,
    source: normalizeSource(rec.source ?? current.source),
    sourceRef: clampText(rec.sourceRef ?? current.sourceRef, 200) || undefined,
    externalRef: rec.externalRef && typeof rec.externalRef === "object" ? (rec.externalRef as any) : current.externalRef,
    projectId: clampText(rec.projectId ?? current.projectId, 120) || undefined,
    updatedAt: nowIso(),
  };

  const updated = [...items];
  updated[idx] = next;
  updated.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  await writeAll(updated);
  return next;
}

export async function deleteOutboundLead(id: string): Promise<{ removed: boolean }> {
  const safeId = clampText(id, 120);
  if (!safeId) throw new Error("Missing lead id");
  const items = await readAll();
  const next = items.filter((l) => l.id !== safeId);
  const removed = next.length !== items.length;
  if (removed) await writeAll(next);
  return { removed };
}

