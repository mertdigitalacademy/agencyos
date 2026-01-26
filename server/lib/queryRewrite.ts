type RewriteResult = {
  query: string;
  requiredTags: string[];
  keywords: string[];
  notes?: string;
};

const KEYWORD_SYNONYMS: Array<{ match: RegExp; add: string[]; tags?: string[] }> = [
  { match: /\bfatura\b|\binvoice\b|\bfaturalama\b/i, add: ["invoice", "billing", "payment"], tags: ["invoice"] },
  { match: /\bsözleşme\b|\bkontrat\b|\bcontract\b|\be-?imza\b|\bimza\b/i, add: ["contract", "sign", "pdf"] },
  { match: /\bcrm\b|\blead\b|\bsatış\b|\bfunnel\b/i, add: ["crm", "lead", "deal"], tags: ["hubspot"] },
  { match: /\bslack\b/i, add: ["slack"], tags: ["slack"] },
  { match: /\bdiscord\b/i, add: ["discord"], tags: ["discord"] },
  { match: /\btelegram\b/i, add: ["telegram"], tags: ["telegram"] },
  { match: /\bwhatsapp\b/i, add: ["whatsapp"], tags: ["whatsapp"] },
  { match: /\bgoogle\s*sheets?\b|\bgsheets?\b|\bsheet\b|\bsheets\b/i, add: ["google sheets"], tags: ["google sheets"] },
  { match: /\bgmail\b|\bemail\b|\be-?posta\b/i, add: ["gmail", "email"], tags: ["gmail"] },
  { match: /\bcalendar\b|\btakvim\b|\brandevu\b/i, add: ["google calendar", "calendar"], tags: ["google calendar"] },
  { match: /\bwebhook\b|\bform\b|\btypeform\b|\bform\s*submit\b/i, add: ["webhook", "form"], tags: ["webhook"] },
  { match: /\bshopify\b|\be-?ticaret\b|\beticaret\b|\becommerce\b/i, add: ["shopify", "order", "payment"], tags: ["shopify"] },
  { match: /\bwoocommerce\b|\bwoo\b/i, add: ["woocommerce", "order", "payment"], tags: ["woocommerce"] },
  { match: /\bstripe\b|\bödeme\b|\bpayment\b/i, add: ["stripe", "payment"], tags: ["stripe"] },
  { match: /\bnotion\b/i, add: ["notion"], tags: ["notion"] },
  { match: /\bairtable\b/i, add: ["airtable"], tags: ["airtable"] },
  { match: /\bzapier\b/i, add: ["zapier"] },
  { match: /\bheygen\b/i, add: ["heygen", "video", "avatar"] },
];

function uniq(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

function compactQuery(tokens: string[]): string {
  const cleaned = uniq(tokens)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
  return cleaned.slice(0, 18).join(" ");
}

export function rewriteCatalogQueryFallback(input: { query: string }): RewriteResult {
  const q = String(input.query ?? "").trim();
  if (!q) return { query: "", requiredTags: [], keywords: [] };

  const keywords: string[] = [];
  const requiredTags: string[] = [];

  keywords.push(q);

  for (const rule of KEYWORD_SYNONYMS) {
    if (!rule.match.test(q)) continue;
    keywords.push(...rule.add);
    if (rule.tags?.length) requiredTags.push(...rule.tags);
  }

  const out = compactQuery(keywords);
  return {
    query: out || q,
    requiredTags: uniq(requiredTags).slice(0, 3),
    keywords: uniq(keywords).slice(0, 24),
    notes: "Fallback rewrite (no LLM): added common integration keywords.",
  };
}

