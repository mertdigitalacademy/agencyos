export function getDocumensoBaseUrl(): string {
  return String(process.env.DOCUMENSO_BASE_URL ?? "http://localhost:8092").replace(/\/+$/, "");
}

export function getDocumensoApiToken(): string | null {
  const token = String(process.env.DOCUMENSO_API_TOKEN ?? "").trim();
  return token.length ? token : null;
}

async function documensoRequest<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = getDocumensoBaseUrl();
  const token = getDocumensoApiToken();
  if (!token) throw new Error("Documenso not configured (set DOCUMENSO_API_TOKEN)");

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Documenso API error (${res.status}): ${body.slice(0, 800)}`);
  }

  return (await res.json()) as T;
}

export async function documensoMe(): Promise<{ name: string }> {
  return documensoRequest<{ name: string }>("/api/v1/me", { method: "GET" });
}

export async function documensoListTemplates(params?: {
  page?: number;
  perPage?: number;
}): Promise<{ templates: Array<{ id: number; title: string; type?: string }>; totalPages: number }> {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 25;
  const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) }).toString();
  return documensoRequest<{ templates: Array<{ id: number; title: string; type?: string }>; totalPages: number }>(
    `/api/v1/templates?${qs}`,
    { method: "GET" },
  );
}

export async function documensoGetTemplate(templateId: number): Promise<{
  id: number;
  title: string;
  type?: string;
  Recipient: Array<{ id: number; name: string; email: string; role?: string; signingOrder?: number | null }>;
}> {
  return documensoRequest<{
    id: number;
    title: string;
    type?: string;
    Recipient: Array<{ id: number; name: string; email: string; role?: string; signingOrder?: number | null }>;
  }>(`/api/v1/templates/${encodeURIComponent(String(templateId))}`, { method: "GET" });
}

export async function documensoListDocuments(params?: {
  page?: number;
  perPage?: number;
}): Promise<{ documents: Array<{ id: number; title: string; status: string; createdAt: string; completedAt?: string | null }>; totalPages: number }> {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 10;
  const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) }).toString();
  return documensoRequest<{ documents: any[]; totalPages: number }>(`/api/v1/documents?${qs}`, { method: "GET" });
}

export async function documensoCreateDocumentFromTemplate(params: {
  templateId: number;
  title: string;
  recipients: Array<{ name: string; email: string }>;
  meta?: { subject?: string; message?: string; redirectUrl?: string };
}): Promise<{ documentId: number; externalId?: string | null; recipients: Array<{ signingUrl: string; email: string; name: string }> }> {
  return documensoRequest<{
    documentId: number;
    externalId?: string | null;
    recipients: Array<{ signingUrl: string; email: string; name: string }>;
  }>(`/api/v1/templates/${encodeURIComponent(String(params.templateId))}/create-document`, {
    method: "POST",
    body: JSON.stringify({
      title: params.title,
      recipients: params.recipients.map((r) => ({ name: r.name, email: r.email })),
      meta: params.meta ?? {},
    }),
  });
}

export async function documensoGenerateDocumentFromTemplate(params: {
  templateId: number;
  title?: string;
  recipients: Array<{ id: number; name?: string; email: string; signingOrder?: number }>;
  meta?: { subject?: string; message?: string; redirectUrl?: string };
}): Promise<{
  documentId: number;
  externalId?: string | null;
  recipients: Array<{ recipientId: number; signingUrl: string; email: string; name: string }>;
}> {
  return documensoRequest<{
    documentId: number;
    externalId?: string | null;
    recipients: Array<{ recipientId: number; signingUrl: string; email: string; name: string }>;
  }>(`/api/v1/templates/${encodeURIComponent(String(params.templateId))}/generate-document`, {
    method: "POST",
    body: JSON.stringify({
      title: params.title,
      recipients: params.recipients.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        signingOrder: r.signingOrder,
      })),
      meta: params.meta ?? {},
    }),
  });
}

export async function documensoSendDocument(params: { documentId: number; sendEmail?: boolean }): Promise<{ message: string }> {
  return documensoRequest<{ message: string }>(`/api/v1/documents/${encodeURIComponent(String(params.documentId))}/send`, {
    method: "POST",
    body: JSON.stringify({ sendEmail: params.sendEmail ?? true }),
  });
}

export async function documensoGetDocument(documentId: number): Promise<{
  id: number;
  externalId?: string | null;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  recipients?: Array<{ id: number; email: string; name: string; signingStatus?: string; sendStatus?: string; signedAt?: string | null; signingUrl?: string }>;
}> {
  return documensoRequest<any>(`/api/v1/documents/${encodeURIComponent(String(documentId))}`, { method: "GET" });
}
