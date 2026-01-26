import type { AgencyDocument, AgencyDocumentType, AgencyState, CurrencyCode, JourneyGoal, RevenueGoal } from "../../types";
import { readJsonFile, writeJsonFile } from "./storage";

const AGENCY_FILE = "agency.json";

const GOALS: JourneyGoal[] = ["ai_agency", "automation_agency", "web_design_agency", "ads_agency", "youtube_systems"];
const DOC_TYPES: AgencyDocumentType[] = ["RevenuePlan", "Offer", "SalesPath", "OutboundPlaybook", "YouTubeSystem", "IncomeStack", "PassiveIncome"];
const CURRENCIES: CurrencyCode[] = ["USD", "TRY", "EUR", "GBP"];

function isGoal(value: unknown): value is JourneyGoal {
  return typeof value === "string" && (GOALS as string[]).includes(value);
}

function isDocType(value: unknown): value is AgencyDocumentType {
  return typeof value === "string" && (DOC_TYPES as string[]).includes(value);
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCIES as string[]).includes(value);
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (s.length > 120) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, 300);
}

function sanitizeDocuments(values: unknown): AgencyDocument[] {
  if (!Array.isArray(values)) return [];
  const out: AgencyDocument[] = [];

  for (const item of values) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (!isDocType(rec.type)) continue;
    const id = String(rec.id ?? "").trim();
    const name = String(rec.name ?? "").trim();
    const content = String(rec.content ?? "").trim();
    const status = String(rec.status ?? "Draft").trim() === "Final" ? "Final" : "Draft";
    const createdAt = String(rec.createdAt ?? "").trim();
    if (!id || !name || !content) continue;
    out.push({
      id,
      type: rec.type,
      name,
      status,
      content,
      createdAt: createdAt || new Date().toISOString(),
    });
  }

  return out.slice(0, 100);
}

function clampNumber(input: unknown, fallback: number, min: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeRevenueGoal(value: unknown): RevenueGoal {
  const now = new Date().toISOString();
  const defaults: RevenueGoal = {
    currency: "USD",
    targetMrr: 5000,
    avgRetainer: 800,
    closeRatePct: 25,
    bookingRatePct: 15,
    updatedAt: now,
  };

  if (!value || typeof value !== "object") return defaults;
  const rec = value as Record<string, unknown>;
  const currency = isCurrencyCode(rec.currency) ? rec.currency : defaults.currency;
  const targetMrr = clampNumber(rec.targetMrr, defaults.targetMrr, 0, 1_000_000);
  const avgRetainer = clampNumber(rec.avgRetainer, defaults.avgRetainer, 0, 1_000_000);
  const closeRatePct = clampNumber(rec.closeRatePct, defaults.closeRatePct, 0, 100);
  const bookingRatePct = clampNumber(rec.bookingRatePct, defaults.bookingRatePct, 0, 100);
  const updatedAt =
    typeof rec.updatedAt === "string" && rec.updatedAt.trim().length > 0 ? String(rec.updatedAt).trim() : defaults.updatedAt;

  return { currency, targetMrr, avgRetainer, closeRatePct, bookingRatePct, updatedAt };
}

export async function readAgencyState(): Promise<AgencyState> {
  const saved = await readJsonFile<Partial<AgencyState>>(AGENCY_FILE, {});
  const goal = isGoal(saved.goal) ? saved.goal : "automation_agency";
  const completedTaskIds = uniqueStrings(saved.completedTaskIds);
  const documents = sanitizeDocuments(saved.documents);
  const revenueGoal = sanitizeRevenueGoal((saved as any).revenueGoal);
  const updatedAt = typeof saved.updatedAt === "string" && saved.updatedAt ? saved.updatedAt : new Date().toISOString();
  return { goal, completedTaskIds, documents, revenueGoal, updatedAt };
}

export async function writeAgencyState(next: AgencyState): Promise<void> {
  await writeJsonFile(AGENCY_FILE, next);
}

export async function patchAgencyState(
  patch: Partial<Pick<AgencyState, "goal" | "completedTaskIds" | "revenueGoal">>,
): Promise<AgencyState> {
  const current = await readAgencyState();
  const next: AgencyState = {
    ...current,
    goal: patch.goal && isGoal(patch.goal) ? patch.goal : current.goal,
    completedTaskIds: patch.completedTaskIds ? uniqueStrings(patch.completedTaskIds) : current.completedTaskIds,
    revenueGoal: patch.revenueGoal ? sanitizeRevenueGoal(patch.revenueGoal) : current.revenueGoal,
    updatedAt: new Date().toISOString(),
  };
  await writeAgencyState(next);
  return next;
}

export async function addAgencyDocument(doc: { type: AgencyDocumentType; name: string; content: string }): Promise<AgencyState> {
  const current = await readAgencyState();
  const now = new Date().toISOString();
  const nextDoc: AgencyDocument = {
    id: `agency-doc-${Date.now()}`,
    type: doc.type,
    name: doc.name,
    status: "Draft",
    content: doc.content,
    createdAt: now,
  };
  const next: AgencyState = {
    ...current,
    documents: [nextDoc, ...current.documents].slice(0, 100),
    updatedAt: now,
  };
  await writeAgencyState(next);
  return next;
}
