export function getInfisicalBaseUrl(): string {
  return String(process.env.INFISICAL_BASE_URL ?? "http://localhost:8081").replace(/\/+$/, "");
}

export function getInfisicalToken(): string | null {
  const token = String(process.env.INFISICAL_TOKEN ?? "").trim();
  return token.length ? token : null;
}

async function infisicalRequest<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = getInfisicalBaseUrl();
  const token = getInfisicalToken();
  if (!token) throw new Error("Infisical not configured (set INFISICAL_TOKEN)");

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Infisical API error (${res.status}): ${body.slice(0, 800)}`);
  }

  return (await res.json()) as T;
}

export async function infisicalListSecretsRaw(params: {
  workspaceId: string;
  environment: string;
  secretPath: string;
  recursive?: boolean;
}): Promise<{
  secrets: Array<{ secretKey: string; secretValue: string; secretComment?: string; version: number }>;
  imports: Array<{ secretPath: string; environment: string; folderId: string; secrets: any[] }>;
}> {
  const qs = new URLSearchParams({
    workspaceId: params.workspaceId,
    environment: params.environment,
    secretPath: params.secretPath,
    expandSecretReferences: "true",
    include_imports: "true",
    recursive: String(params.recursive ?? false),
  }).toString();

  return infisicalRequest<{
    secrets: Array<{ secretKey: string; secretValue: string; secretComment?: string; version: number }>;
    imports: Array<{ secretPath: string; environment: string; folderId: string; secrets: any[] }>;
  }>(`/api/v3/secrets/raw?${qs}`, { method: "GET" });
}

export async function infisicalUpsertSecretRaw(params: {
  workspaceId: string;
  environment: string;
  secretPath: string;
  key: string;
  value: string;
  comment?: string;
  type?: "shared" | "personal";
}): Promise<{ secret: { secretKey: string; secretValue: string; secretComment?: string; version: number } }> {
  const key = String(params.key ?? "").trim();
  if (!key) throw new Error("Missing secret key");

  return infisicalRequest<{ secret: { secretKey: string; secretValue: string; secretComment?: string; version: number } }>(
    `/api/v3/secrets/raw/${encodeURIComponent(key)}`,
    {
      method: "POST",
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        environment: params.environment,
        type: params.type ?? "shared",
        secretPath: params.secretPath,
        secretKey: key,
        secretValue: params.value,
        secretComment: params.comment,
      }),
    },
  );
}

