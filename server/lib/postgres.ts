import pg from "pg";

type PgPool = pg.Pool;

let pool: PgPool | null = null;
let ensuredKv = false;

function getDatabaseUrl(): string {
  return String(process.env.AGENCYOS_DATABASE_URL ?? "").trim();
}

export function redactDatabaseUrl(): string {
  const raw = getDatabaseUrl();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const port = u.port ? `:${u.port}` : "";
    const db = u.pathname && u.pathname !== "/" ? u.pathname : "";
    return `${u.protocol}//${host}${port}${db}`;
  } catch {
    return "postgres";
  }
}

export function isPostgresEnabled(): boolean {
  return getDatabaseUrl().length > 0;
}

export function getPgPool(): PgPool | null {
  const url = getDatabaseUrl();
  if (!url) return null;
  if (pool) return pool;
  const { Pool } = pg;
  pool = new Pool({ connectionString: url });
  return pool;
}

async function ensureKvTable(): Promise<void> {
  const p = getPgPool();
  if (!p) return;
  if (ensuredKv) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS agencyos_kv (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  ensuredKv = true;
}

export async function pgKvGet<T>(key: string): Promise<T | null> {
  const p = getPgPool();
  if (!p) return null;
  await ensureKvTable();
  const res = await p.query("SELECT value FROM agencyos_kv WHERE key = $1 LIMIT 1", [key]);
  const row = res.rows?.[0];
  if (!row) return null;
  return row.value as T;
}

export async function pgKvSet<T>(key: string, value: T): Promise<void> {
  const p = getPgPool();
  if (!p) return;
  await ensureKvTable();
  await p.query(
    `INSERT INTO agencyos_kv (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function pgHealthcheck(): Promise<{ connected: boolean; reason?: string }> {
  const p = getPgPool();
  if (!p) return { connected: false, reason: "Missing AGENCYOS_DATABASE_URL" };
  try {
    await p.query("SELECT 1 as ok");
    return { connected: true };
  } catch (e) {
    return { connected: false, reason: e instanceof Error ? e.message : "Postgres connection failed" };
  }
}
