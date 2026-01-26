export function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return fallback;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

