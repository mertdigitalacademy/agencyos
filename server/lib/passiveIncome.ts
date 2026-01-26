import type { JourneyGoal, MarketRadarState } from "../../types";
import { getGeminiClient } from "./gemini";
import { openRouterChat } from "./openrouter";

export type PassiveIdea = {
  id: string;
  title: { en: string; tr: string };
  description: { en: string; tr: string };
  exampleOffer: { en: string; tr: string };
  defaultCatalogQuery: string;
  requiredTags?: string[];
  assets: Array<{ en: string; tr: string }>;
};

const IDEAS: PassiveIdea[] = [
  {
    id: "workflow-starter-pack",
    title: { en: "n8n Starter Pack (templates)", tr: "n8n Starter Pack (şablonlar)" },
    description: {
      en: "Sell a packaged automation bundle for one niche (workflows + checklist + setup guide).",
      tr: "Tek bir niş için paketlenmiş otomasyon paketi sat (workflow + checklist + kurulum rehberi).",
    },
    exampleOffer: {
      en: "‘Appointment + follow-up automation pack’ for local clinics.",
      tr: "‘Randevu + takip otomasyon paketi’ (yerel klinikler için).",
    },
    defaultCatalogQuery: "webhook google sheets email follow up calendar reminders",
    requiredTags: ["webhook"],
    assets: [
      { en: "1-page landing page copy", tr: "1 sayfalık satış sayfası metni" },
      { en: "Onboarding checklist", tr: "Onboarding checklist" },
      { en: "Delivery automation plan", tr: "Teslimat otomasyon planı" },
    ],
  },
  {
    id: "audit-product",
    title: { en: "Automation Audit (productized)", tr: "Otomasyon Audit (ürünleştirilmiş)" },
    description: {
      en: "Sell a fixed-scope audit: checklist + risk report + recommended workflows.",
      tr: "Sabit kapsam audit sat: checklist + risk raporu + önerilen workflow’lar.",
    },
    exampleOffer: {
      en: "‘7-day AI automation audit’ for real estate agencies.",
      tr: "‘7 günde AI otomasyon audit’ (emlak ofisleri için).",
    },
    defaultCatalogQuery: "report google sheets email slack weekly summary",
    assets: [
      { en: "Audit template (PDF/Notion)", tr: "Audit şablonu (PDF/Notion)" },
      { en: "Risk checklist", tr: "Risk checklist" },
      { en: "Proposal upgrade path", tr: "Teklife upgrade yolu" },
    ],
  },
  {
    id: "newsletter-funnel",
    title: { en: "Newsletter Funnel", tr: "Newsletter Funnel" },
    description: {
      en: "Build an audience → lead magnet → email automation → product or service.",
      tr: "Kitle oluştur → lead magnet → email otomasyonu → ürün veya hizmet sat.",
    },
    exampleOffer: {
      en: "Weekly ‘AI ops’ newsletter with a paid starter pack.",
      tr: "Haftalık ‘AI ops’ bülteni + ücretli starter pack.",
    },
    defaultCatalogQuery: "email newsletter webhook google sheets lead magnet",
    requiredTags: ["webhook"],
    assets: [
      { en: "Lead magnet outline", tr: "Lead magnet taslağı" },
      { en: "5-email sequence", tr: "5 e-postalık sekans" },
      { en: "Weekly content calendar", tr: "Haftalık içerik takvimi" },
    ],
  },
  {
    id: "affiliate-toolstack",
    title: { en: "Affiliate Toolstack + Tutorials", tr: "Affiliate Toolstack + Eğitim" },
    description: {
      en: "Create tutorials and templates for a specific tool stack; earn affiliate + upsell services.",
      tr: "Belirli bir tool stack için eğitim + template üret; affiliate kazan + hizmet upsell.",
    },
    exampleOffer: {
      en: "‘n8n + Notion + Sheets’ automation tutorials.",
      tr: "‘n8n + Notion + Sheets’ otomasyon eğitimleri.",
    },
    defaultCatalogQuery: "notion google sheets automation webhook",
    requiredTags: ["webhook"],
    assets: [
      { en: "Tutorial outline", tr: "Eğitim taslağı" },
      { en: "Template pack", tr: "Template paketi" },
      { en: "Support FAQ", tr: "Destek FAQ" },
    ],
  },
  {
    id: "youtube-lead-machine",
    title: { en: "YouTube → Leads → Product", tr: "YouTube → Lead → Ürün" },
    description: {
      en: "Turn YouTube topics into a lead machine, then sell a starter pack or audit.",
      tr: "YouTube konularını lead makinesine çevir, sonra starter pack veya audit sat.",
    },
    exampleOffer: {
      en: "‘AI receptionist for dentists’ content series + pack.",
      tr: "‘Diş klinikleri için AI resepsiyonist’ içerik serisi + pack.",
    },
    defaultCatalogQuery: "youtube analytics report google sheets email",
    assets: [
      { en: "10 video ideas", tr: "10 video fikri" },
      { en: "CTA + landing copy", tr: "CTA + landing metni" },
      { en: "Automation delivery checklist", tr: "Teslimat otomasyon checklist" },
    ],
  },
];

function safeText(input: unknown): string {
  return String(input ?? "").trim();
}

function pickOpenRouterModel(): string {
  const assistant = safeText(process.env.ASSISTANT_MODEL);
  if (assistant) return assistant;
  const chairman = safeText(process.env.COUNCIL_CHAIRMAN_MODEL);
  if (chairman) return chairman;
  const first = safeText(process.env.COUNCIL_MODELS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || "openai/gpt-5-mini";
}

function summarizeMarket(market?: MarketRadarState | null): string {
  if (!market) return "";
  return JSON.stringify({
    country: market.country,
    city: market.city,
    niche: market.niche,
    opportunities: (market.opportunities ?? []).slice(0, 3).map((o) => ({ niche: o.niche, offer: o.offer })),
    youtubeTrends: (market.youtubeTrends ?? []).slice(0, 3).map((t) => t.title),
  });
}

export function listPassiveIdeas(): PassiveIdea[] {
  return IDEAS;
}

export function getPassiveIdeaById(id: string): PassiveIdea | null {
  const key = safeText(id);
  return IDEAS.find((i) => i.id === key) ?? null;
}

export async function generatePassiveIdeaPlan(params: {
  idea: PassiveIdea;
  goal: JourneyGoal;
  language: "tr" | "en";
  market?: MarketRadarState | null;
}): Promise<string> {
  const prompt = [
    params.language === "tr" ? "Türkçe yaz." : "Write in English.",
    `You are building a passive income system for an agency founder.`,
    `Primary goal: ${params.goal}`,
    `Passive idea: ${params.idea.title.en}`,
    `Idea description: ${params.idea.description.en}`,
    `Example offer: ${params.idea.exampleOffer.en}`,
    params.market ? `Market Radar context (short JSON): ${summarizeMarket(params.market)}` : "",
    ``,
    `Output format: Markdown.`,
    `Make it extremely actionable and beginner-friendly.`,
    `Include:`,
    `- Positioning: niche + ICP + promise`,
    `- Offer packaging: what is included / excluded`,
    `- Assets to create (from the idea assets list)`,
    `- Automation plan: which workflows to search (keywords) + credential checklist`,
    `- 14-day execution plan (daily checklist)`,
    `- Metrics + risk notes`,
    ``,
    `Do not request secrets. Do not include real tokens.`,
  ]
    .filter(Boolean)
    .join("\n");

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    const raw = await openRouterChat({
      apiKey: openRouterKey,
      model: pickOpenRouterModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are AgencyOS. Output ONLY valid markdown. Do not reveal secrets." },
        { role: "user", content: prompt },
      ],
    });
    const out = safeText(raw);
    if (out) return out;
  }

  const ai = getGeminiClient();
  if (ai) {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    const text = safeText(response.text);
    if (text) return text;
  }

  const lang = params.language;
  const idea = params.idea;
  const assets = idea.assets.map((a) => `- ${a[lang]}`).join("\n");
  return [
    `# ${idea.title[lang]}`,
    ``,
    `${idea.description[lang]}`,
    ``,
    `## Offer`,
    `${idea.exampleOffer[lang]}`,
    ``,
    `## Assets`,
    assets,
    ``,
    `## Automation keywords (n8n catalog)`,
    `- ${idea.defaultCatalogQuery}`,
    ``,
    `## 14-day plan`,
    lang === "tr"
      ? `- Gün 1–2: niş + teklif\n- Gün 3–5: landing + lead magnet\n- Gün 6–7: n8n automation taslağı\n- Gün 8–14: içerik + satış`
      : `- Days 1–2: niche + offer\n- Days 3–5: landing + lead magnet\n- Days 6–7: n8n automation draft\n- Days 8–14: content + sales`,
  ].join("\n");
}

export async function generatePassiveAsset(params: {
  idea: PassiveIdea;
  goal: JourneyGoal;
  language: "tr" | "en";
  market?: MarketRadarState | null;
  assetTitle: string;
}): Promise<string> {
  const assetTitle = safeText(params.assetTitle) || (params.language === "tr" ? "Asset" : "Asset");

  const prompt = [
    params.language === "tr" ? "Türkçe yaz." : "Write in English.",
    `You are creating a deliverable asset for a passive income product launch.`,
    `Primary goal: ${params.goal}`,
    `Passive idea: ${params.idea.title.en}`,
    `Asset to generate: ${assetTitle}`,
    params.market ? `Market Radar context (short JSON): ${summarizeMarket(params.market)}` : "",
    ``,
    `Output format: Markdown.`,
    `Rules: beginner-friendly, concrete, no hype, no secrets.`,
    `Include a short checklist at the end titled "Next steps".`,
  ]
    .filter(Boolean)
    .join("\n");

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    const raw = await openRouterChat({
      apiKey: openRouterKey,
      model: pickOpenRouterModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are AgencyOS. Output ONLY valid markdown. Do not reveal secrets." },
        { role: "user", content: prompt },
      ],
    });
    const out = safeText(raw);
    if (out) return out;
  }

  const ai = getGeminiClient();
  if (ai) {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    const text = safeText(response.text);
    if (text) return text;
  }

  const lang = params.language;
  return [
    `# ${assetTitle}`,
    ``,
    lang === "tr"
      ? `Bu asset, "${params.idea.title.tr}" pasif gelir fikri için hızlı bir başlangıç taslağıdır.`
      : `This asset is a quick starter draft for "${params.idea.title.en}".`,
    ``,
    `## Next steps`,
    lang === "tr"
      ? `- Metni nişine göre özelleştir\n- Landing'e koy\n- CTA ekle\n- Workflow kataloğunda keyword ile otomasyonu ara`
      : `- Customize for your niche\n- Put on your landing page\n- Add a CTA\n- Search the workflow catalog for automation`,
  ].join("\n");
}
