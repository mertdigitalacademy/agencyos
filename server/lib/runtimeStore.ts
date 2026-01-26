import { readJsonFile, writeJsonFile } from "./storage";

export type EnvironmentName = "Development" | "Staging" | "Production";

export type RuntimeSettings = {
  activeEnvironment: EnvironmentName;
  n8nBaseUrl: string;
  suitecrmBaseUrl: string;
  invoiceshelfBaseUrl: string;
  documensoBaseUrl: string;
  infisicalBaseUrl: string;
  infisicalWorkspaceId: string;
  infisicalSecretPath: string;
  infisicalEnvDevelopmentSlug: string;
  infisicalEnvStagingSlug: string;
  infisicalEnvProductionSlug: string;
  councilModels: string;
  councilChairmanModel: string;
  councilStage2Enabled: boolean;
};

export type StoredSecret = {
  id: string;
  key: string;
  value: string;
  environment: EnvironmentName;
  lastUpdated: string;
};

export type RedactedSecret = Omit<StoredSecret, "value"> & { value: string; hasValue: boolean };

const SETTINGS_FILE = "settings.json";
const SECRETS_FILE = "secrets.json";

const DEFAULT_COUNCIL_MODELS = "openai/gpt-5-mini, anthropic/claude-sonnet-4, google/gemini-2.5-flash";
const DEFAULT_COUNCIL_CHAIRMAN_MODEL = "openai/gpt-5-mini";
const SLOW_DEFAULT_COUNCIL_MODELS = ["openai/gpt-5", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro"];
const SLOW_DEFAULT_CHAIRMAN_MODEL = "openai/gpt-5";

function normalizeUrl(input: string, fallback: string): string {
  const v = String(input ?? "").trim();
  const raw = v.length > 0 ? v : fallback;
  return raw.replace(/\/+$/, "");
}

function normalizeString(input: unknown, fallback: string): string {
  const v = String(input ?? "").trim();
  return v.length > 0 ? v : fallback;
}

function normalizeSecretPath(input: unknown, fallback: string): string {
  const raw = normalizeString(input, fallback).replace(/\/+$/, "");
  if (raw === "") return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeBoolean(input: unknown, fallback: boolean): boolean {
  if (typeof input === "boolean") return input;
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

function normalizeEnvironment(input: unknown): EnvironmentName {
  const v = String(input ?? "").trim();
  if (v === "Development" || v === "Staging" || v === "Production") return v;
  return "Production";
}

function normalizeModelList(input: unknown): string[] {
  return String(input ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function readRuntimeSettings(): Promise<RuntimeSettings> {
  const defaults: RuntimeSettings = {
    activeEnvironment: normalizeEnvironment(process.env.AGENCYOS_ENV),
    n8nBaseUrl: normalizeUrl(process.env.N8N_BASE_URL ?? "", "http://localhost:5678"),
    suitecrmBaseUrl: normalizeUrl(process.env.SUITECRM_BASE_URL ?? "", "http://localhost:8091"),
    invoiceshelfBaseUrl: normalizeUrl(process.env.INVOICESHELF_BASE_URL ?? "", "http://localhost:8090"),
    documensoBaseUrl: normalizeUrl(process.env.DOCUMENSO_BASE_URL ?? "", "http://localhost:8092"),
    infisicalBaseUrl: normalizeUrl(process.env.INFISICAL_BASE_URL ?? "", "http://localhost:8081"),
    infisicalWorkspaceId: normalizeString(process.env.INFISICAL_WORKSPACE_ID, ""),
    infisicalSecretPath: normalizeSecretPath(process.env.INFISICAL_SECRET_PATH, "/"),
    infisicalEnvDevelopmentSlug: normalizeString(process.env.INFISICAL_ENV_DEVELOPMENT_SLUG, "dev"),
    infisicalEnvStagingSlug: normalizeString(process.env.INFISICAL_ENV_STAGING_SLUG, "staging"),
    infisicalEnvProductionSlug: normalizeString(process.env.INFISICAL_ENV_PRODUCTION_SLUG, "prod"),
    councilModels: normalizeString(process.env.COUNCIL_MODELS, DEFAULT_COUNCIL_MODELS),
    councilChairmanModel: normalizeString(process.env.COUNCIL_CHAIRMAN_MODEL, DEFAULT_COUNCIL_CHAIRMAN_MODEL),
    councilStage2Enabled: normalizeBoolean(process.env.COUNCIL_STAGE2_ENABLED, false),
  };

  const saved = await readJsonFile<Partial<RuntimeSettings>>(SETTINGS_FILE, {});
  const merged: RuntimeSettings = {
    activeEnvironment: normalizeEnvironment(saved.activeEnvironment ?? defaults.activeEnvironment),
    n8nBaseUrl: normalizeUrl(saved.n8nBaseUrl ?? defaults.n8nBaseUrl, "http://localhost:5678"),
    suitecrmBaseUrl: normalizeUrl(saved.suitecrmBaseUrl ?? defaults.suitecrmBaseUrl, "http://localhost:8091"),
    invoiceshelfBaseUrl: normalizeUrl(saved.invoiceshelfBaseUrl ?? defaults.invoiceshelfBaseUrl, "http://localhost:8090"),
    documensoBaseUrl: normalizeUrl(saved.documensoBaseUrl ?? defaults.documensoBaseUrl, "http://localhost:8092"),
    infisicalBaseUrl: normalizeUrl(saved.infisicalBaseUrl ?? defaults.infisicalBaseUrl, "http://localhost:8081"),
    infisicalWorkspaceId: normalizeString(saved.infisicalWorkspaceId ?? defaults.infisicalWorkspaceId, ""),
    infisicalSecretPath: normalizeSecretPath(saved.infisicalSecretPath ?? defaults.infisicalSecretPath, "/"),
    infisicalEnvDevelopmentSlug: normalizeString(saved.infisicalEnvDevelopmentSlug ?? defaults.infisicalEnvDevelopmentSlug, "dev"),
    infisicalEnvStagingSlug: normalizeString(saved.infisicalEnvStagingSlug ?? defaults.infisicalEnvStagingSlug, "staging"),
    infisicalEnvProductionSlug: normalizeString(saved.infisicalEnvProductionSlug ?? defaults.infisicalEnvProductionSlug, "prod"),
    councilModels: normalizeString(saved.councilModels ?? defaults.councilModels, ""),
    councilChairmanModel: normalizeString(saved.councilChairmanModel ?? defaults.councilChairmanModel, ""),
    councilStage2Enabled: normalizeBoolean(saved.councilStage2Enabled ?? defaults.councilStage2Enabled, defaults.councilStage2Enabled),
  };

  // Migration: old default council settings were slow (Stage2 + heavyweight models).
  // If the user never customized them, switch to fast defaults for a better out-of-box experience.
  try {
    const savedModels = normalizeModelList(saved.councilModels ?? "");
    const savedChairman = normalizeString(saved.councilChairmanModel ?? "", "");
    const savedStage2 = normalizeBoolean(saved.councilStage2Enabled ?? undefined, false);
    const isSlowDefault =
      sameList(savedModels, SLOW_DEFAULT_COUNCIL_MODELS) &&
      savedChairman === SLOW_DEFAULT_CHAIRMAN_MODEL &&
      savedStage2 === true;
    if (isSlowDefault) {
      const next: RuntimeSettings = {
        ...merged,
        councilModels: DEFAULT_COUNCIL_MODELS,
        councilChairmanModel: DEFAULT_COUNCIL_CHAIRMAN_MODEL,
        councilStage2Enabled: false,
      };
      await writeRuntimeSettings(next);
      return next;
    }
  } catch {
    // ignore migration failures
  }

  return merged;
}

export async function writeRuntimeSettings(next: RuntimeSettings): Promise<void> {
  await writeJsonFile(SETTINGS_FILE, next);
}

export async function updateRuntimeSettings(patch: Partial<RuntimeSettings>): Promise<RuntimeSettings> {
  const current = await readRuntimeSettings();
  const merged: RuntimeSettings = {
    activeEnvironment: normalizeEnvironment(patch.activeEnvironment ?? current.activeEnvironment),
    n8nBaseUrl: normalizeUrl(patch.n8nBaseUrl ?? current.n8nBaseUrl, "http://localhost:5678"),
    suitecrmBaseUrl: normalizeUrl(patch.suitecrmBaseUrl ?? current.suitecrmBaseUrl, "http://localhost:8091"),
    invoiceshelfBaseUrl: normalizeUrl(patch.invoiceshelfBaseUrl ?? current.invoiceshelfBaseUrl, "http://localhost:8090"),
    documensoBaseUrl: normalizeUrl(patch.documensoBaseUrl ?? current.documensoBaseUrl, "http://localhost:8092"),
    infisicalBaseUrl: normalizeUrl(patch.infisicalBaseUrl ?? current.infisicalBaseUrl, "http://localhost:8081"),
    infisicalWorkspaceId: normalizeString(patch.infisicalWorkspaceId ?? current.infisicalWorkspaceId, ""),
    infisicalSecretPath: normalizeSecretPath(patch.infisicalSecretPath ?? current.infisicalSecretPath, "/"),
    infisicalEnvDevelopmentSlug: normalizeString(patch.infisicalEnvDevelopmentSlug ?? current.infisicalEnvDevelopmentSlug, "dev"),
    infisicalEnvStagingSlug: normalizeString(patch.infisicalEnvStagingSlug ?? current.infisicalEnvStagingSlug, "staging"),
    infisicalEnvProductionSlug: normalizeString(patch.infisicalEnvProductionSlug ?? current.infisicalEnvProductionSlug, "prod"),
    councilModels: normalizeString(patch.councilModels ?? current.councilModels, ""),
    councilChairmanModel: normalizeString(patch.councilChairmanModel ?? current.councilChairmanModel, ""),
    councilStage2Enabled: normalizeBoolean(patch.councilStage2Enabled ?? current.councilStage2Enabled, current.councilStage2Enabled),
  };
  await writeRuntimeSettings(merged);
  applySettingsToProcessEnv(merged, { force: true });
  await applySecretsFromStoreForEnvironment(merged.activeEnvironment);
  return merged;
}

export async function readSecrets(): Promise<StoredSecret[]> {
  return readJsonFile<StoredSecret[]>(SECRETS_FILE, []);
}

export async function listSecretsRedacted(): Promise<RedactedSecret[]> {
  const secrets = await readSecrets();
  return secrets.map((s) => ({
    ...s,
    value: "••••••••••••••••",
    hasValue: true,
  }));
}

export async function upsertSecret(input: {
  id?: string;
  key: string;
  value: string;
  environment: EnvironmentName;
}): Promise<RedactedSecret> {
  const now = new Date().toISOString();
  const secrets = await readSecrets();
  const key = String(input.key ?? "").trim().toUpperCase();
  const value = String(input.value ?? "").trim();
  const environment = normalizeEnvironment(input.environment);
  if (!key) throw new Error("Missing secret key");
  if (!value) throw new Error("Missing secret value");

  const existingIndex = secrets.findIndex((s) => (input.id ? s.id === input.id : s.key === key && s.environment === environment));
  const next: StoredSecret = existingIndex === -1
    ? {
        id: input.id ?? `sec-${Date.now()}`,
        key,
        value,
        environment,
        lastUpdated: now,
      }
    : {
        ...secrets[existingIndex],
        id: input.id ?? secrets[existingIndex].id,
        key,
        value,
        environment,
        lastUpdated: now,
      };

  const updated = existingIndex === -1 ? [next, ...secrets] : secrets.map((s, i) => (i === existingIndex ? next : s));
  await writeJsonFile(SECRETS_FILE, updated);

  const settings = await readRuntimeSettings();
  if (environment === settings.activeEnvironment) {
    process.env[key] = value;
  }

  return { ...next, value: "••••••••••••••••", hasValue: true };
}

export async function deleteSecret(id: string): Promise<void> {
  const secrets = await readSecrets();
  const next = secrets.filter((s) => s.id !== id);
  await writeJsonFile(SECRETS_FILE, next);
}

export async function applySecretsFromStoreForEnvironment(environment: EnvironmentName): Promise<void> {
  const secrets = await readSecrets();
  const byKey = new Map<string, StoredSecret[]>();
  for (const s of secrets) {
    const list = byKey.get(s.key) ?? [];
    list.push(s);
    byKey.set(s.key, list);
  }

  for (const [key, list] of byKey.entries()) {
    const selected = list.find((s) => s.environment === environment);
    if (selected) {
      process.env[key] = selected.value;
      continue;
    }

    const current = process.env[key];
    if (!current) continue;
    const matchesAnyStored = list.some((s) => s.value === current);
    if (matchesAnyStored) delete process.env[key];
  }
}

export function applySettingsToProcessEnv(settings: RuntimeSettings, opts?: { force?: boolean }): void {
  const force = Boolean(opts?.force);

  if (force || !process.env.AGENCYOS_ENV) process.env.AGENCYOS_ENV = settings.activeEnvironment;
  if (force || !process.env.N8N_BASE_URL) process.env.N8N_BASE_URL = settings.n8nBaseUrl;
  if (force || !process.env.SUITECRM_BASE_URL) process.env.SUITECRM_BASE_URL = settings.suitecrmBaseUrl;
  if (force || !process.env.INVOICESHELF_BASE_URL) process.env.INVOICESHELF_BASE_URL = settings.invoiceshelfBaseUrl;
  if (force || !process.env.DOCUMENSO_BASE_URL) process.env.DOCUMENSO_BASE_URL = settings.documensoBaseUrl;
  if (force || !process.env.INFISICAL_BASE_URL) process.env.INFISICAL_BASE_URL = settings.infisicalBaseUrl;
  if (force || !process.env.INFISICAL_WORKSPACE_ID) process.env.INFISICAL_WORKSPACE_ID = settings.infisicalWorkspaceId;
  if (force || !process.env.INFISICAL_SECRET_PATH) process.env.INFISICAL_SECRET_PATH = settings.infisicalSecretPath;
  if (force || !process.env.INFISICAL_ENV_DEVELOPMENT_SLUG) process.env.INFISICAL_ENV_DEVELOPMENT_SLUG = settings.infisicalEnvDevelopmentSlug;
  if (force || !process.env.INFISICAL_ENV_STAGING_SLUG) process.env.INFISICAL_ENV_STAGING_SLUG = settings.infisicalEnvStagingSlug;
  if (force || !process.env.INFISICAL_ENV_PRODUCTION_SLUG) process.env.INFISICAL_ENV_PRODUCTION_SLUG = settings.infisicalEnvProductionSlug;
  if (force || !process.env.COUNCIL_MODELS) process.env.COUNCIL_MODELS = settings.councilModels;
  if (force || !process.env.COUNCIL_CHAIRMAN_MODEL) process.env.COUNCIL_CHAIRMAN_MODEL = settings.councilChairmanModel;
  if (force || !process.env.COUNCIL_STAGE2_ENABLED) process.env.COUNCIL_STAGE2_ENABLED = settings.councilStage2Enabled ? "true" : "false";
}

export async function hydrateProcessEnvFromDisk(): Promise<void> {
  const settings = await readRuntimeSettings();
  applySettingsToProcessEnv(settings, { force: false });

  const secrets = await readSecrets();
  for (const s of secrets) {
    if (s.environment !== settings.activeEnvironment) continue;
    if (!process.env[s.key] || String(process.env[s.key]).trim().length === 0) {
      process.env[s.key] = s.value;
    }
  }
}
