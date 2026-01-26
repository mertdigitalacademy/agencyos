export function tryParseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function extractFirstJsonObject<T = unknown>(text: string): T | null {
  const trimmed = text.trim();
  const direct = tryParseJson<T>(trimmed);
  if (direct) return direct;

  const start = trimmed.indexOf("{");
  if (start === -1) return null;

  // Find the first balanced JSON object, ignoring braces inside strings.
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") inString = false;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;

    if (depth === 0 && i > start) {
      const sliced = trimmed.slice(start, i + 1);
      const parsed = tryParseJson<T>(sliced);
      if (parsed) return parsed;
      // If parsing failed, keep scanning — the first "{" might not belong to JSON.
    }
  }

  return null;
}

export function extractFirstJsonArray<T = unknown>(text: string): T[] | null {
  const trimmed = text.trim();
  const direct = tryParseJson<T[]>(trimmed);
  if (Array.isArray(direct)) return direct;

  const start = trimmed.indexOf("[");
  if (start === -1) return null;

  // Find the first balanced JSON array, ignoring brackets inside strings.
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") inString = false;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "[") depth += 1;
    if (ch === "]") depth -= 1;

    if (depth === 0 && i > start) {
      const sliced = trimmed.slice(start, i + 1);
      const parsed = tryParseJson<T[]>(sliced);
      if (Array.isArray(parsed)) return parsed;
      // Keep scanning if parsing failed.
    }
  }

  return null;
}
