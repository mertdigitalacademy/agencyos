import crypto from "node:crypto";

export function getSuiteCrmBaseUrl(): string {
  return String(process.env.SUITECRM_BASE_URL ?? "http://localhost:8091").replace(/\/+$/, "");
}

export function getSuiteCrmCredentials(): { username: string; password: string } | null {
  const username = String(process.env.SUITECRM_USERNAME ?? "").trim();
  const password = String(process.env.SUITECRM_PASSWORD ?? "").trim();
  if (!username || !password) return null;
  return { username, password };
}

function suiteCrmRestEndpoint(baseUrl: string): string {
  return `${baseUrl}/service/v4_1/rest.php`;
}

async function suiteCrmCall<T>(params: { method: string; restData: any }): Promise<T> {
  const url = suiteCrmRestEndpoint(getSuiteCrmBaseUrl());

  const body = new URLSearchParams();
  body.set("method", params.method);
  body.set("input_type", "JSON");
  body.set("response_type", "JSON");
  body.set("rest_data", JSON.stringify(params.restData));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SuiteCRM API error (${res.status}): ${text.slice(0, 800)}`);
  }

  const json = (await res.json()) as T;
  return json;
}

export async function suiteCrmLogin(params: { username: string; password: string }): Promise<{ sessionId: string }> {
  const passwordMd5 = crypto.createHash("md5").update(params.password).digest("hex");
  const out = await suiteCrmCall<any>({
    method: "login",
    restData: {
      user_auth: {
        user_name: params.username,
        password: passwordMd5,
        version: "1",
      },
      application_name: "AgencyOS",
    },
  });

  const sessionId = String(out?.id ?? "").trim();
  if (!sessionId) throw new Error("SuiteCRM login failed (missing session id)");
  return { sessionId };
}

export async function suiteCrmCreateLead(params: {
  sessionId: string;
  lastName: string;
  description?: string;
  status?: string;
  leadSource?: string;
}): Promise<{ id: string }> {
  const name_value_list = [
    { name: "last_name", value: params.lastName },
    ...(params.description ? [{ name: "description", value: params.description }] : []),
    ...(params.status ? [{ name: "status", value: params.status }] : []),
    ...(params.leadSource ? [{ name: "lead_source", value: params.leadSource }] : []),
  ];

  const out = await suiteCrmCall<any>({
    method: "set_entry",
    restData: {
      session: params.sessionId,
      module_name: "Leads",
      name_value_list,
    },
  });

  const id = String(out?.id ?? "").trim();
  if (!id) throw new Error("SuiteCRM lead create failed (missing id)");
  return { id };
}

function nameValueListToObject(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};

  if (Array.isArray(input)) {
    const out: Record<string, string> = {};
    for (const item of input) {
      const name = String((item as any)?.name ?? "").trim();
      if (!name) continue;
      out[name] = String((item as any)?.value ?? "");
    }
    return out;
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    if (value && typeof value === "object" && "value" in value) {
      out[key] = String((value as any).value ?? "");
      continue;
    }
    out[key] = String(value ?? "");
  }
  return out;
}

export type SuiteCrmLeadSummary = {
  id: string;
  last_name?: string;
  status?: string;
  lead_source?: string;
  date_entered?: string;
  description?: string;
};

export async function suiteCrmListLeads(params: {
  sessionId: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ leads: SuiteCrmLeadSummary[]; nextOffset: number | null; totalCount?: number }> {
  const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(50, Number(params.limit))) : 20;
  const offset = Number.isFinite(params.offset) ? Math.max(0, Number(params.offset)) : 0;

  const out = await suiteCrmCall<any>({
    method: "get_entry_list",
    restData: {
      session: params.sessionId,
      module_name: "Leads",
      query: String(params.query ?? ""),
      order_by: "date_entered DESC",
      offset,
      select_fields: ["id", "last_name", "status", "lead_source", "date_entered", "description"],
      link_name_to_fields_array: [],
      max_results: limit,
      deleted: 0,
      favorites: false,
    },
  });

  const entryList = Array.isArray(out?.entry_list) ? out.entry_list : [];
  const leads: SuiteCrmLeadSummary[] = entryList
    .map((entry: any) => {
      const id = String(entry?.id ?? "").trim();
      const fields = nameValueListToObject(entry?.name_value_list);
      return {
        id: id || String(fields.id ?? "").trim(),
        last_name: fields.last_name,
        status: fields.status,
        lead_source: fields.lead_source,
        date_entered: fields.date_entered,
        description: fields.description,
      };
    })
    .filter((l) => Boolean(l.id));

  const nextOffsetRaw = String(out?.next_offset ?? "").trim();
  const nextOffset = nextOffsetRaw ? Number(nextOffsetRaw) : null;
  const totalCountRaw = String(out?.total_count ?? "").trim();
  const totalCount = totalCountRaw ? Number(totalCountRaw) : undefined;

  return {
    leads,
    nextOffset: Number.isFinite(nextOffset) ? nextOffset : null,
    totalCount: Number.isFinite(totalCount) ? totalCount : undefined,
  };
}
