type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openRouterChat(params: {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  reasoning?: any;
  responseFormat?: { type: "json_object" | "json_schema"; json_schema?: any };
}): Promise<string> {
  const { apiKey, model, messages, temperature = 0.2, maxTokens, timeoutMs = 30_000, reasoning, responseFormat } = params;
  const autoReasoning = /^openai\/gpt-5/i.test(model) ? { effort: "low" } : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "AgencyOS",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(reasoning ? { reasoning } : autoReasoning ? { reasoning: autoReasoning } : {}),
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(Number.isFinite(maxTokens) && (maxTokens as number) > 0 ? { max_tokens: Math.floor(maxTokens as number) } : {}),
      }),
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as any;
  const msg = data?.choices?.[0]?.message ?? {};
  const content = String(msg?.content ?? "");
  if (content.trim()) return content;
  const fallback = String(msg?.reasoning ?? "");
  return fallback;
}
