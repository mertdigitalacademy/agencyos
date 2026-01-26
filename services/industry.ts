export type IndustryPreset = {
  id: string;
  label: { en: string; tr: string };
  matches: string[];
  requiredTags: string[];
  keywords: string[];
};

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: "ecom",
    label: { en: "E-commerce Ops", tr: "E-ticaret Operasyonları" },
    matches: ["e-commerce", "ecommerce", "ecom", "e-ticaret", "eticaret", "shopify", "woo", "woocommerce"],
    requiredTags: ["shopify", "woocommerce"],
    keywords: ["shopify", "woocommerce", "order", "payment", "stripe", "paypal", "fulfillment", "refund"],
  },
  {
    id: "marketing",
    label: { en: "Marketing Ops", tr: "Pazarlama Operasyonları" },
    matches: ["marketing", "pazarlama", "growth", "lead", "ads", "reklam", "performance"],
    requiredTags: ["hubspot", "mailchimp"],
    keywords: ["lead", "crm", "hubspot", "mailchimp", "google ads", "facebook", "slack", "utm", "report"],
  },
  {
    id: "finance",
    label: { en: "Finance / Accounting", tr: "Finans / Muhasebe" },
    matches: ["muhasebe", "accounting", "finance", "fatura", "invoice", "billing", "tahsilat", "payment"],
    requiredTags: ["invoice", "google sheets"],
    keywords: ["invoice", "billing", "payment", "stripe", "google sheets", "pdf", "reminder"],
  },
  {
    id: "real-estate",
    label: { en: "Real Estate Ops", tr: "Emlak Operasyonları" },
    matches: ["emlak", "real estate"],
    requiredTags: ["gmail", "google calendar"],
    keywords: ["lead", "appointment", "calendar", "gmail", "google sheets", "follow up"],
  },
  {
    id: "saas",
    label: { en: "SaaS Ops", tr: "SaaS Operasyonları" },
    matches: ["saas", "software", "subscription", "product-led"],
    requiredTags: ["stripe", "slack"],
    keywords: ["stripe", "subscription", "billing", "slack", "notion", "hubspot", "webhook"],
  },
  {
    id: "support",
    label: { en: "Support Ops", tr: "Müşteri Destek Operasyonları" },
    matches: ["destek", "support", "customer support", "helpdesk", "ticket", "zendesk", "intercom"],
    requiredTags: ["slack", "gmail"],
    keywords: ["ticket", "support", "zendesk", "intercom", "email", "slack", "ai"],
  },
];

export function getIndustryHints(industryRaw: string): { requiredTags: string[]; keywords: string[]; preset?: IndustryPreset } {
  const industry = String(industryRaw || "").trim().toLowerCase();
  if (!industry) return { requiredTags: [], keywords: [] };

  for (const preset of INDUSTRY_PRESETS) {
    if (preset.matches.some((m) => industry.includes(m))) {
      return { requiredTags: preset.requiredTags, keywords: preset.keywords, preset };
    }
  }

  return { requiredTags: [], keywords: [] };
}
