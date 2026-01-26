export type PingResult = {
  ok: boolean;
  status?: number;
  reason?: string;
};

export async function pingUrl(
  url: string,
  options?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<PingResult> {
  const timeoutMs = options?.timeoutMs ?? 1500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: options?.headers,
    });
    const ok = res.status >= 200 && res.status < 400;
    return { ok, status: res.status, reason: ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeUrl(
  url: string,
  options?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<PingResult> {
  const timeoutMs = options?.timeoutMs ?? 1500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: options?.headers,
    });
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}
