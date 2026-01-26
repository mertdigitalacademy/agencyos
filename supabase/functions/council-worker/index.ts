/**
 * Council Worker - Supabase Edge Function
 *
 * This Edge Function processes council jobs asynchronously in the background.
 * It's triggered by database webhooks when new jobs are created, or can be
 * called directly via HTTP for polling-based processing.
 *
 * Features:
 * - Processes council_run, council_playground, and doc_generate jobs
 * - Updates job progress in real-time
 * - Handles timeouts gracefully (up to 60 seconds per job)
 * - Supports both webhook-triggered and cron-based execution
 *
 * Environment Variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for database access
 * - OPENROUTER_API_KEY: API key for AI model calls
 * - COUNCIL_MODELS: Comma-separated list of models to use
 * - COUNCIL_CHAIRMAN_MODEL: Model for chairman synthesis
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
interface CouncilJob {
  id: string;
  user_id?: string;
  project_id?: string;
  job_type: "council_run" | "council_playground" | "doc_generate";
  status: "pending" | "processing" | "completed" | "failed";
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface CouncilOpinion {
  persona: string;
  role: string;
  opinion: string;
  score: number;
}

interface CouncilResult {
  id: string;
  opinions: CouncilOpinion[];
  synthesis: string;
  decision: "Approved" | "Rejected" | "Needs Revision";
  pricing?: {
    currency: string;
    lineItems: Array<{
      label: string;
      amount: number;
      cadence: "One-Time" | "Monthly" | "Usage";
      notes?: string;
    }>;
    totalOneTime?: number;
    totalMonthly?: number;
    totalFirstMonth?: number;
    assumptions?: string[];
  };
  nextSteps?: string[];
  moneySteps?: string[];
  modelOutputs?: Array<{ model: string; content: string }>;
  chairmanModel?: string;
  createdAt: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Create Supabase client
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Helper: Update job progress
async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  progress: number,
  status?: CouncilJob["status"],
  result?: Record<string, unknown>,
  error?: string
): Promise<void> {
  const updates: Partial<CouncilJob> = { progress };

  if (status) updates.status = status;
  if (result) updates.result = result;
  if (error) updates.error = error;
  if (status === "processing" && !updates.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (status === "completed" || status === "failed") {
    updates.completed_at = new Date().toISOString();
  }

  await supabase.from("council_jobs").update(updates).eq("id", jobId);
}

// Helper: Call OpenRouter API
async function callOpenRouter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const allMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": Deno.env.get("SUPABASE_URL") ?? "https://agencyos.app",
      "X-Title": "AgencyOS Council",
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Process Council Run Job
async function processCouncilRun(
  supabase: SupabaseClient,
  job: CouncilJob
): Promise<CouncilResult> {
  const input = job.input as {
    projectId: string;
    topic: string;
    gateType: string;
    context?: string;
    language?: "tr" | "en";
  };

  const models = (Deno.env.get("COUNCIL_MODELS") ?? "openai/gpt-5-mini, anthropic/claude-sonnet-4, google/gemini-2.5-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const chairmanModel = Deno.env.get("COUNCIL_CHAIRMAN_MODEL") ?? "openai/gpt-5-mini";

  const personas = [
    { name: "Alex", role: "Efficiency Expert", focus: "operational efficiency and automation potential" },
    { name: "Maya", role: "Risk Analyst", focus: "risks, compliance, and potential pitfalls" },
    { name: "Chen", role: "Financial Advisor", focus: "ROI, cost-benefit analysis, and pricing strategy" },
  ];

  const language = input.language ?? "en";
  const isEnglish = language === "en";

  const councilPrompt = isEnglish
    ? `You are an AI advisor on the AgencyOS Council. Your task is to evaluate a client project proposal.

Gate Type: ${input.gateType}
Topic: ${input.topic}
${input.context ? `Context: ${input.context}` : ""}

Provide your analysis focusing on your area of expertise. Include:
1. Key observations
2. Potential concerns
3. Recommendations
4. A score from 1-10 (10 being highest recommendation to proceed)

Format your response as JSON:
{
  "opinion": "Your detailed analysis...",
  "score": 8
}`
    : `AgencyOS Konseyi'nde bir yapay zeka danışmanısınız. Göreviniz bir müşteri proje teklifini değerlendirmektir.

Kapı Tipi: ${input.gateType}
Konu: ${input.topic}
${input.context ? `Bağlam: ${input.context}` : ""}

Uzmanlık alanınıza odaklanarak analizinizi sunun. Dahil edin:
1. Temel gözlemler
2. Potansiyel endişeler
3. Öneriler
4. 1-10 arası bir puan (10 en yüksek devam önerisi)

Yanıtınızı JSON formatında verin:
{
  "opinion": "Detaylı analiziniz...",
  "score": 8
}`;

  // Update progress: Starting
  await updateJobProgress(supabase, job.id, 10, "processing");

  // Collect opinions from all models
  const opinions: CouncilOpinion[] = [];
  const modelOutputs: Array<{ model: string; content: string }> = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const persona = personas[i % personas.length];

    try {
      const systemPrompt = isEnglish
        ? `You are ${persona.name}, a ${persona.role}. Focus on ${persona.focus}. Respond in JSON format only.`
        : `Sen ${persona.name}, bir ${persona.role}'sın. ${persona.focus} üzerine odaklan. Sadece JSON formatında yanıt ver.`;

      const content = await callOpenRouter(model, [{ role: "user", content: councilPrompt }], systemPrompt);

      modelOutputs.push({ model, content });

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        opinions.push({
          persona: persona.name,
          role: persona.role,
          opinion: parsed.opinion ?? content,
          score: Number(parsed.score) || 5,
        });
      } else {
        opinions.push({
          persona: persona.name,
          role: persona.role,
          opinion: content,
          score: 5,
        });
      }

      // Update progress
      await updateJobProgress(supabase, job.id, 10 + Math.floor((i + 1) / models.length * 60));
    } catch (e) {
      console.error(`Model ${model} failed:`, e);
      opinions.push({
        persona: persona.name,
        role: persona.role,
        opinion: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
        score: 0,
      });
    }
  }

  // Chairman synthesis
  await updateJobProgress(supabase, job.id, 75);

  const synthesisPrompt = isEnglish
    ? `You are the Council Chairman. Synthesize the following expert opinions into a final decision.

Opinions:
${opinions.map((o) => `${o.persona} (${o.role}): ${o.opinion} [Score: ${o.score}]`).join("\n\n")}

Provide:
1. A synthesis of all viewpoints
2. A final decision: "Approved", "Rejected", or "Needs Revision"
3. Next steps (3-5 actionable items)
4. Money-making steps (2-3 revenue opportunities)

Format as JSON:
{
  "synthesis": "...",
  "decision": "Approved|Rejected|Needs Revision",
  "nextSteps": ["..."],
  "moneySteps": ["..."]
}`
    : `Konsey Başkanısınız. Aşağıdaki uzman görüşlerini sentezleyerek nihai bir karar verin.

Görüşler:
${opinions.map((o) => `${o.persona} (${o.role}): ${o.opinion} [Puan: ${o.score}]`).join("\n\n")}

Sağlayın:
1. Tüm bakış açılarının sentezi
2. Nihai karar: "Approved" (Onaylandı), "Rejected" (Reddedildi) veya "Needs Revision" (Revizyon Gerekli)
3. Sonraki adımlar (3-5 uygulanabilir madde)
4. Para kazanma adımları (2-3 gelir fırsatı)

JSON formatında:
{
  "synthesis": "...",
  "decision": "Approved|Rejected|Needs Revision",
  "nextSteps": ["..."],
  "moneySteps": ["..."]
}`;

  let synthesis = "";
  let decision: CouncilResult["decision"] = "Needs Revision";
  let nextSteps: string[] = [];
  let moneySteps: string[] = [];

  try {
    const chairmanResponse = await callOpenRouter(
      chairmanModel,
      [{ role: "user", content: synthesisPrompt }],
      isEnglish
        ? "You are the Council Chairman. Synthesize opinions and make a final decision. Respond in JSON format only."
        : "Konsey Başkanısınız. Görüşleri sentezleyin ve nihai bir karar verin. Sadece JSON formatında yanıt verin."
    );

    const jsonMatch = chairmanResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      synthesis = parsed.synthesis ?? chairmanResponse;
      decision = parsed.decision ?? "Needs Revision";
      nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];
      moneySteps = Array.isArray(parsed.moneySteps) ? parsed.moneySteps : [];
    } else {
      synthesis = chairmanResponse;
    }
  } catch (e) {
    console.error("Chairman synthesis failed:", e);
    synthesis = `Council opinions collected. Average score: ${(opinions.reduce((sum, o) => sum + o.score, 0) / opinions.length).toFixed(1)}`;
    decision = opinions.every((o) => o.score >= 6) ? "Approved" : "Needs Revision";
  }

  // Update progress: Completed
  await updateJobProgress(supabase, job.id, 100, "completed");

  return {
    id: `council-${Date.now()}`,
    opinions,
    synthesis,
    decision,
    nextSteps,
    moneySteps,
    modelOutputs,
    chairmanModel,
    createdAt: new Date().toISOString(),
  };
}

// Main handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    // Check for specific job ID in request
    let jobId: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      jobId = body.job_id ?? body.record?.id ?? null;
    }

    // Get job to process
    let job: CouncilJob | null = null;

    if (jobId) {
      // Process specific job
      const { data } = await supabase
        .from("council_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      job = data;
    } else {
      // Claim next pending job (for cron-based processing)
      const { data } = await supabase
        .from("council_jobs")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .select()
        .single();
      job = data;
    }

    if (!job) {
      return new Response(
        JSON.stringify({ message: "No pending jobs" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Skip if already processed
    if (job.status === "completed" || job.status === "failed") {
      return new Response(
        JSON.stringify({ message: "Job already processed", job_id: job.id, status: job.status }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process based on job type
    let result: Record<string, unknown>;

    switch (job.job_type) {
      case "council_run":
      case "council_playground":
        result = await processCouncilRun(supabase, job);
        break;

      case "doc_generate":
        // TODO: Implement document generation
        result = { message: "Document generation not yet implemented" };
        break;

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // Mark job as completed
    await updateJobProgress(supabase, job.id, 100, "completed", result);

    // Also save the council session if it's a council job
    if (job.job_type === "council_run" || job.job_type === "council_playground") {
      const councilResult = result as CouncilResult;
      const input = job.input as { projectId?: string; gateType?: string; topic?: string; language?: string };

      await supabase.from("council_sessions").insert({
        id: councilResult.id,
        user_id: job.user_id,
        project_id: input.projectId ?? job.project_id,
        gate_type: input.gateType ?? "Strategic",
        topic: input.topic ?? "",
        opinions: councilResult.opinions,
        synthesis: councilResult.synthesis,
        decision: councilResult.decision,
        pricing: councilResult.pricing,
        language: input.language,
        next_steps: councilResult.nextSteps,
        money_steps: councilResult.moneySteps,
        model_outputs: councilResult.modelOutputs,
        chairman_model: councilResult.chairmanModel,
        created_at: councilResult.createdAt,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: "completed",
        result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Council worker error:", error);

    // Try to mark job as failed
    try {
      const supabase = getSupabaseClient();
      const body = await req.clone().json().catch(() => ({}));
      const jobId = body.job_id ?? body.record?.id;

      if (jobId) {
        await updateJobProgress(
          supabase,
          jobId,
          0,
          "failed",
          undefined,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
