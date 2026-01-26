import { Type } from "@google/genai";
import type { AgencyDocumentType, JourneyGoal, MarketRadarState, Project, ProjectBrief } from "../../types";
import { getGeminiClient } from "./gemini";
import { openRouterChat } from "./openrouter";
import { extractFirstJsonObject } from "./parseJson";

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

function pickOperatorModel(): string {
  const operator = safeText(process.env.OPERATOR_MODEL);
  if (operator) return operator;
  return pickOpenRouterModel();
}

function clampNumber(input: unknown, fallback: number, min: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const goalLabel: Record<JourneyGoal, string> = {
  ai_agency: "AI Ajansı",
  automation_agency: "Otomasyon Ajansı",
  web_design_agency: "Web Tasarım Ajansı",
  ads_agency: "Reklam Ajansı",
  youtube_systems: "YouTube Sistemleri",
};

function fallbackAgencyDoc(type: AgencyDocumentType, goal: JourneyGoal): string {
  const goalName = goalLabel[goal] || "Ajans";

  if (type === "IncomeStack") {
    return [
      `# Gelir Stack’i — ${goalName}`,
      ``,
      `Bu doküman “AI Ajansı + YouTube + Pasif Gelir” modelini tek bir **gelir motoru** gibi kurmak için yazılmıştır.`,
      ``,
      `## 1) Ana Motor: AI Ajansı Geliri (Aktif)`,
      `- **Tek cümle teklif:** “X işletmesi için Y sonucu Z sürede getiririz.”`,
      `- Paketler: Starter / Standard / Premium (scope sınırları net)`,
      `- Satış yolu: Lead → CRM → Teklif → Sözleşme → Fatura`,
      `- Council Gate: fiyat + risk`,
      ``,
      `## 2) Büyüme Motoru: YouTube Geliri (ve Lead)`,
      `- Haftalık içerik planı: 2 video + 5 kısa format`,
      `- CTA: “demo / audit / checklist” → lead capture`,
      `- Ölçüm: CTR, retention, lead dönüşümü`,
      ``,
      `## 3) Pasif Motor: Ürünleştirme`,
      `- Şablonlar: SOP, teklif/SOW template, n8n starter pack`,
      `- Dijital ürün: “1 niş için otomasyon paketi”`,
      `- Dağıtım: YouTube → landing → ödeme → teslimat otomasyonu`,
      ``,
      `## 4) 30 Günlük Plan (Özet)`,
      `- Hafta 1: teklif + demo akışı + 10 lead`,
      `- Hafta 2: 1 müşteri kapanış + teslimat SOP`,
      `- Hafta 3: YouTube içerik hattı + 10 video fikri`,
      `- Hafta 4: ürünleştirme (starter pack) + satış sayfası`,
      ``,
      `## 5) Metrikler`,
      `- Haftalık: lead, meeting, teklif, kapanış`,
      `- Aylık: retainer, churn, içerik üretim sayısı`,
    ].join("\n");
  }

  if (type === "PassiveIncome") {
    return [
      `# Pasif Gelir Sistemi — ${goalName}`,
      ``,
      `## Hedef`,
      `- Ajans gelirini “ürünleştirme” ile pasife bağlamak.`,
      ``,
      `## 1) Ürün Fikirleri (Ajans için en kolay)`,
      `- n8n starter pack (workflow + kurulum checklist)`,
      `- SOP + şablon kütüphanesi (teklif, SOW, onboarding)`,
      `- Audit raporu (checklist + aksiyon planı)`,
      ``,
      `## 2) Paketleme`,
      `- Kim için? (ICP)`,
      `- Hangi sonucu veriyor?`,
      `- Teslimat formatı: Notion/PDF + n8n JSON + video walkthrough`,
      ``,
      `## 3) Dağıtım`,
      `- YouTube → lead magnet → email sequence → satış`,
      `- Affiliate: tool stack referansları (etik/şeffaf)`,
      ``,
      `## 4) Otomasyon`,
      `- Ödeme sonrası: otomatik onboarding + teslim linkleri`,
      `- Support: ticket triage + FAQ`,
      ``,
      `## 5) 14 Günlük Sprint`,
      `- Gün 1–2: ICP + ürün vaadi`,
      `- Gün 3–5: starter pack oluştur`,
      `- Gün 6–7: satış sayfası`,
      `- Gün 8–14: içerik + outreach`,
    ].join("\n");
  }

  if (type === "RevenuePlan") {
    return [
      `# Gelir Yolculuğu Planı — ${goalName}`,
      ``,
      `## 0) Hedef`,
      `- 30 günde ilk satış / ilk kazanç.`,
      ``,
      `## 1) Konumlandırma (Gün 1–2)`,
      `- Niş + ICP: 1 cümle tanım`,
      `- Tek “çekirdek teklif”: problem → çözüm → sonuç`,
      ``,
      `## 2) Paketler (Gün 3–4)`,
      `- Starter / Standard / Premium`,
      `- Kapsam dışı (scope boundaries)`,
      ``,
      `## 3) Satış Yolu (Gün 5–7)`,
      `- Lead → CRM → Teklif → Sözleşme → Fatura`,
      `- Council Gate: fiyat + risk`,
      ``,
      `## 4) Teslimat (Hafta 2)`,
      `- 1 demo client ile uçtan uca prova`,
      `- Workflow staging/import + test + activate`,
      ``,
      `## 5) İçerik / Dağıtım (Hafta 3)`,
      `- Günlük 1 outreach veya haftalık 2 içerik`,
      `- 1 lead magnet + otomatik takip`,
      ``,
      `## 6) Ölçek (Hafta 4)`,
      `- SOP + checklist`,
      `- İzleme: hata oranı, MTTR, SLA`,
      ``,
      `## Metrikler`,
      `- Haftalık lead sayısı`,
      `- Teklif → kapanış oranı`,
      `- İlk değere kadar süre (TTFV)`,
    ].join("\n");
  }

  if (type === "Offer") {
    return [
      `# Hizmet Paketleri — ${goalName}`,
      ``,
      `## Paket 1: Starter`,
      `- Amaç: hızlı “ilk değer”`,
      `- Teslimatlar: 1 workflow / 1 doküman / 1 rapor`,
      `- Süre: 3–5 gün`,
      ``,
      `## Paket 2: Standard`,
      `- Amaç: uçtan uca satış→teslimat otomasyonu`,
      `- Teslimatlar: 3–5 workflow + izleme + runbook`,
      `- Süre: 2 hafta`,
      ``,
      `## Paket 3: Premium`,
      `- Amaç: governance + ölçek + bakım`,
      `- Teslimatlar: 5–10 workflow + alerting + aylık bakım`,
      `- Süre: 4 hafta`,
      ``,
      `## Kapsam Sınırları (Örnek)`,
      `- Yeni entegrasyon ekleme: ayrı kalem`,
      `- Özel kod node’ları: güvenlik incelemesi şart`,
      ``,
      `## Notlar`,
      `- Fiyatlandırmayı Council “Strategic Gate” ile pressure test et.`,
    ].join("\n");
  }

  if (type === "SalesPath") {
    return [
      `# Satış Yolu — ${goalName}`,
      ``,
      `## A) Lead Toplama`,
      `- Form/Webhook → CRM Lead`,
      `- Otomatik teşekkür + toplantı linki`,
      ``,
      `## B) Keşif & Kapsam`,
      `- 5–7 intake sorusu (stack, kanal, SLA, bütçe, risk)`,
      ``,
      `## C) Teklif`,
      `- Council Gate: fiyat/scope riskleri`,
      `- Proposal + SOW üret`,
      ``,
      `## D) Sözleşme`,
      `- Documenso ile e-imza`,
      `- İmzadan sonra otomatik “go-live checklist”`,
      ``,
      `## E) Fatura`,
      `- InvoiceShelf draft → send → status sync`,
      ``,
      `## F) Teslimat`,
      `- Workflow import/test/activate`,
      `- Monitoring + rollback plan`,
    ].join("\n");
  }

  if (type === "OutboundPlaybook") {
    return [
      `# Outbound Playbook (Lead Gen + Outreach) — ${goalName}`,
      ``,
      `## 0) Amaç`,
      `- 14 gün içinde ilk 10 görüşme ve 1 ilk satış için “günlük yapılacaklar + mesaj şablonları + takip sistemi” oluşturmak.`,
      ``,
      `## 1) ICP (İdeal Müşteri Profili)`,
      `- Sektör: (seç)`,
      `- Ülke/Şehir: (seç)`,
      `- Rol: Owner / Ops / Pazarlama`,
      `- Problem: manuel süreç, düşük dönüşüm, raporsuzluk, dağınık CRM`,
      ``,
      `## 2) Lead Kaynakları (en hızlı)`,
      `- Google Maps işletme listeleri (Market Radar → Leads)`,
      `- LinkedIn / Instagram bio + website iletişim`,
      `- Mevcut network + referans`,
      ``,
      `## 3) Tek Cümle Teklif (Hook)`,
      `- “${goalName}: X işletmesi için Y sonucu Z sürede otomasyonla getiriyoruz.”`,
      ``,
      `## 4) Outreach Şablonları`,
      `### A) İlk mesaj (kısa)`,
      `- Merhaba {isim}, {sektör} işletmelerinde genelde {problem} görüyoruz.`,
      `- 10 dakikalık ücretsiz mini-audit yapıp 3 otomasyon fırsatı çıkarabilirim. Uygun musunuz?`,
      ``,
      `### B) Follow-up (24 saat)`,
      `- “Yanlış kişiye mi yazdım?” + tek soru`,
      ``,
      `### C) Follow-up (72 saat)`,
      `- 1 case-study cümlesi + meeting link`,
      ``,
      `## 5) Günlük Kota (14 gün)`,
      `- Günlük 20 yeni lead → 20 outreach`,
      `- 5 follow-up`,
      `- 1 kısa içerik (YouTube Shorts/LinkedIn)`,
      ``,
      `## 6) Takip Sistemi (AgencyOS ile)`,
      `- Market Radar → Leads: lead listesi çıkar`,
      `- Lead Pitch üret → SuiteCRM’e ekle`,
      `- 10 dakikalık görüşme sonrası: Project Intake → Catalog → Council (pricing/risk)`,
      ``,
      `## 7) Metrikler`,
      `- Günlük: outreach sayısı, cevap oranı`,
      `- Haftalık: görüşme sayısı, teklif sayısı, kapanış`,
      `- Aylık: retainer MRR, churn`,
    ].join("\n");
  }

  return [
    `# YouTube Sistemleri — ${goalName}`,
    ``,
    `## 1) İçerik Sütunları`,
    `- 3 içerik sütunu (eğitim / case study / hikaye)`,
    ``,
    `## 2) Haftalık Plan`,
    `- 2 video + 5 kısa format`,
    ``,
    `## 3) Üretim Hattı`,
    `- Brief → script → çekim → kurgu → yayın`,
    ``,
    `## 4) Ölçüm`,
    `- İzlenme, CTR, retention, lead dönüşümü`,
    ``,
    `## 5) Gelir`,
    `- CTA → lead magnet → satış yolu`,
  ].join("\n");
}

function summarizeMarketForPrompt(market?: MarketRadarState | null): string {
  if (!market) return "";
  const summary = {
    country: market.country,
    city: market.city,
    niche: market.niche,
    opportunities: (market.opportunities ?? []).slice(0, 3).map((o) => ({
      niche: o.niche,
      offer: o.offer,
      suggestedCatalogQuery: o.suggestedCatalogQuery,
    })),
    youtubeTrends: (market.youtubeTrends ?? []).slice(0, 3).map((t) => ({
      title: t.title,
      url: t.url,
      channel: t.channel,
    })),
    youtubeIdeas: (market.youtubeIdeas ?? []).slice(0, 3).map((i) => ({ title: i.title })),
  };
  return JSON.stringify(summary);
}

export async function generateAgencyDocument(params: { type: AgencyDocumentType; goal: JourneyGoal; market?: MarketRadarState | null }): Promise<string> {
  const { type, goal, market } = params;
  const goalName = goalLabel[goal] || "Ajans";

  const title =
    type === "RevenuePlan"
      ? "Gelir Yolculuğu Planı (0’dan kazanca)"
      : type === "Offer"
        ? "Ajans Hizmet Paketleri ve Fiyatlandırma"
        : type === "SalesPath"
          ? "Ajans Satış Yolu (Lead→CRM→Teklif→Sözleşme→Fatura)"
          : type === "OutboundPlaybook"
            ? "Outbound Playbook (Lead Gen + Outreach)"
          : type === "YouTubeSystem"
            ? "YouTube Sistemleri (İçerik→Büyüme→Gelir)"
            : type === "IncomeStack"
              ? "Gelir Stack’i (AI Ajansı + YouTube + Pasif Gelir)"
              : "Pasif Gelir Sistemi (Ürünleştirme + Dağıtım + Otomasyon)";

  const prompt = [
    `Türkçe yaz.`,
    `Hedef: ${goalName}.`,
    `Doküman türü: ${title}.`,
    market ? `Market Radar bağlamı (kısa JSON): ${summarizeMarketForPrompt(market)}` : "",
    ``,
    `İstenen çıktı formatı: Markdown.`,
    `Kurallar:`,
    `- İzlenecek video gibi değil, uygulanabilir sistem + checklist gibi yaz.`,
    `- Mümkünse 30 günlük yol haritası, metrikler ve risk notları ekle.`,
    `- "Council Gate" (Strategic/Risk) ve "Workflow Catalog + n8n import/test/activate" kullanımını somut adımlarla bağla.`,
    type === "IncomeStack"
      ? `- Gelir stack’i mutlaka 3 akış halinde yaz: (1) AI Ajansı aktif gelir (2) YouTube büyüme+gelir (3) pasif ürün gelir.`
      : "",
    type === "OutboundPlaybook"
      ? `- Outbound playbook: lead kaynakları, outreach mesajları (TR), follow-up planı, günlük/haftalık kota ve KPI’lar içersin. Market Radar + SuiteCRM + Council Gate ile bağla.`
      : "",
    type === "PassiveIncome"
      ? `- Pasif gelir için: dijital ürün, template/pack, dağıtım kanalı ve otomasyon teslimat adımlarını netleştir.`
      : "",
    `- Gizli anahtar/secret isteme, örnek token yazma.`,
  ].join("\n");

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 1400,
        messages: [
          { role: "system", content: "You are AgencyOS. Output ONLY valid markdown. Do not reveal secrets." },
          { role: "user", content: prompt },
        ],
      });
      const text = safeText(raw);
      if (text) return text;
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return fallbackAgencyDoc(type, goal);

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
  });

  const text = (response.text || "").trim();
  if (!text) return fallbackAgencyDoc(type, goal);
  return text;
}

export async function generateExecutiveSummary(projects: Project[]): Promise<string> {
  const summaryData = projects.map((p) => ({
    client: p.brief.clientName,
    status: p.status,
    revenue: p.financials?.revenue ?? 0,
  }));

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 320,
        messages: [
          { role: "system", content: "You are the AgencyOS Intelligence Engine. Output a single paragraph. No secrets." },
          {
            role: "user",
            content: `Provide a one-paragraph executive summary of the current agency pipeline state. Data: ${JSON.stringify(
              summaryData,
            )}. Tone: Strategic, crisp, operational.`,
          },
        ],
      });
      const text = safeText(raw);
      if (text) return text;
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return "Intelligence feed offline.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `As the AgencyOS Intelligence Engine, provide a one-paragraph executive summary of the current agency pipeline state. Data: ${JSON.stringify(
      summaryData,
    )}. Tone: Strategic, crisp, operational.`,
  });

  return response.text || "Intelligence feed offline.";
}

export async function generateStrategicAdvice(project: Project): Promise<string> {
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 240,
        messages: [
          { role: "system", content: "You are a strategic advisor. Output a single punchy paragraph. No secrets." },
          {
            role: "user",
            content: `Analyze project ${project.brief.clientName} (Status: ${project.status}) and provide one hard-hitting strategic advice for growth or risk mitigation. Context: ${JSON.stringify(
              project.brief,
            )}`,
          },
        ],
      });
      const text = safeText(raw);
      if (text) return text;
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return "Strategic advice engine offline.";

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Analyze project ${project.brief.clientName} (Status: ${project.status}) and provide one hard-hitting strategic advice for growth or risk mitigation. Context: ${JSON.stringify(
      project.brief,
    )}`,
  });

  return response.text || "Strategic advice engine offline.";
}

export async function generateProposal(brief: ProjectBrief): Promise<string> {
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 1400,
        messages: [
          { role: "system", content: "You are an expert proposal writer. Output Markdown. No secrets." },
          {
            role: "user",
            content: `Draft an elite, high-fidelity automation agency proposal for ${brief.clientName}. Include solution architecture, project timeline, and ROI projections. Use Markdown format.`,
          },
        ],
      });
      const text = safeText(raw);
      if (text) return text;
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return "Proposal synthesis failed.";

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Draft an elite, high-fidelity automation agency proposal for ${brief.clientName}. Include solution architecture, project timeline, and ROI projections. Use Markdown format.`,
  });

  return response.text || "Proposal synthesis failed.";
}

export async function generateSow(project: Project): Promise<string> {
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 1400,
        messages: [
          { role: "system", content: "You are a technical SOW writer. Output Markdown. No secrets." },
          {
            role: "user",
            content: `Draft a technical Statement of Work for ${project.brief.clientName}. Focus on n8n integration details, credential security, and scope of work for the active units: ${project.activeWorkflows
              .map((w) => w.name)
              .join(", ")}. Use Markdown.`,
          },
        ],
      });
      const text = safeText(raw);
      if (text) return text;
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return "SOW synthesis failed.";

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Draft a technical Statement of Work for ${project.brief.clientName}. Focus on n8n integration details, credential security, and scope of work for the active units: ${project.activeWorkflows
      .map((w) => w.name)
      .join(", ")}. Use Markdown.`,
  });

  return response.text || "SOW synthesis failed.";
}

export async function analyzeStrategicPivot(
  project: Project,
): Promise<{ assessment: string; recommendation: string; urgency: number }> {
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    const prompt = [
      "Return ONLY JSON.",
      'Schema: {"assessment":"string","recommendation":"string","urgency":0-100}',
      `Project: ${project.brief.clientName}`,
      `Status: ${project.status}`,
      `Workflows: ${project.activeWorkflows.length}`,
      `Logs: ${JSON.stringify(project.executionLogs?.slice(0, 5) ?? [])}`,
    ].join("\n");

    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOpenRouterModel(),
        temperature: 0.2,
        maxTokens: 500,
        messages: [
          { role: "system", content: "You are a strategic analyst. Output ONLY valid JSON. No secrets." },
          { role: "user", content: prompt },
        ],
      });

      const parsed = extractFirstJsonObject<{ assessment?: string; recommendation?: string; urgency?: number }>(raw);
      if (parsed && safeText(parsed.assessment) && safeText(parsed.recommendation)) {
        return {
          assessment: safeText(parsed.assessment),
          recommendation: safeText(parsed.recommendation),
          urgency: clampNumber(parsed.urgency, 50, 0, 100),
        };
      }
    } catch {
      // fall through to Gemini or fallback
    }
  }

  const ai = getGeminiClient();
  if (!ai) return { assessment: "Analysis failed", recommendation: "Manual review required", urgency: 0 };

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Perform a Strategic Pivot Analysis for project: ${project.brief.clientName}. Current Status: ${project.status}. Workflows: ${project.activeWorkflows.length}. Logs: ${JSON.stringify(
      project.executionLogs?.slice(0, 5) ?? [],
    )}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assessment: { type: Type.STRING, description: "Evaluation of current operational efficiency" },
          recommendation: { type: Type.STRING, description: "Should the project pivot or persevere? Details." },
          urgency: { type: Type.NUMBER, description: "Scale 0-100" },
        },
        required: ["assessment", "recommendation", "urgency"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch {
    return { assessment: "Analysis failed", recommendation: "Manual review required", urgency: 0 };
  }
}

export async function getOperatorResponse(
  query: string,
  context: any,
): Promise<{ content: string; toolCall?: { name: string; args: Record<string, unknown> } }> {
  const toolGuide = {
    notes: [
      "Always return valid JSON.",
      "You may include at most ONE toolCall.",
      "Never ask for or output secrets.",
      "If you use a toolCall, keep `content` short and action-oriented.",
      "If a tool needs client emails/IDs that are missing, ask a short clarifying question instead of guessing.",
    ],
    tools: [
      { name: "catalog.search", args: { query: "string", limit: "number?", requiredTags: "string[]?" } },
      { name: "workflow.install", args: { workflowId: "string", activate: "boolean?" } },
      { name: "workflow.activate", args: { workflowId: "string" } },
      { name: "council.run", args: { gateType: "Strategic|Risk|Launch|Post-Mortem", topic: "string" } },
      { name: "crm.suitecrm.syncLead", args: {} },
      { name: "finance.invoiceshelf.createInvoice", args: { amount: "number", description: "string?" } },
      { name: "finance.invoiceshelf.createInvoiceFromCouncilLatest", args: { mode: "first_month|setup|monthly|all?" } },
      { name: "finance.invoiceshelf.sync", args: {} },
      {
        name: "contract.documenso.send",
        args: {
          templateId: "number",
          recipients: "Array<{name:string,email:string}>",
          title: "string?",
          subject: "string?",
          message: "string?",
          sendEmail: "boolean?",
        },
      },
      { name: "contract.documenso.sync", args: {} },
    ],
  };

  const safeContext = {
    status: context?.status,
    brief: context?.brief,
    activeWorkflows: Array.isArray(context?.activeWorkflows)
      ? context.activeWorkflows.map((w: any) => ({
          id: w?.id,
          name: w?.name,
          deploymentStatus: w?.deployment?.status,
          n8nWorkflowId: w?.deployment?.n8nWorkflowId,
        }))
      : [],
    documents: Array.isArray(context?.documents)
      ? context.documents.map((d: any) => ({
          id: d?.id,
          type: d?.type,
          status: d?.status,
          external: d?.externalRef?.provider ? { provider: d.externalRef.provider, id: d.externalRef.id } : undefined,
        }))
      : [],
  };

  const prompt = `You are the "AgencyOS Operator" for an automation agency. You can answer normally, or you can request ONE action via toolCall.\n\nTool guide:\n${JSON.stringify(
    toolGuide,
  )}\n\nUser request:\n${query}\n\nProject context (redacted):\n${JSON.stringify(
    safeContext,
  )}\n\nReturn JSON: {\"content\":\"...\",\"toolCall\":{\"name\":\"...\",\"args\":{...}} } (toolCall optional).`;

  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  if (openRouterKey) {
    try {
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model: pickOperatorModel(),
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are the AgencyOS Operator. Output ONLY valid JSON. Do not reveal secrets.",
          },
          { role: "user", content: prompt },
        ],
      });

      const parsed = extractFirstJsonObject<{ content: string; toolCall?: { name: string; args: Record<string, unknown> } }>(raw);
      if (parsed && typeof parsed.content === "string") return parsed;
      return { content: raw.slice(0, 1200) };
    } catch {
      // fall through to Gemini
    }
  }

  const ai = getGeminiClient();
  if (ai) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            toolCall: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                args: { type: Type.OBJECT },
              },
            },
          },
          required: ["content"],
        },
      },
    });

    try {
      return JSON.parse(response.text || "{}");
    } catch {
      return { content: "Operator node sync timeout." };
    }
  }

  return { content: "Operator offline. Configure GEMINI_API_KEY or OPENROUTER_API_KEY in Settings → Vault." };
}
