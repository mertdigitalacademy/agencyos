import { getGeminiClient } from './gemini';
import { Type } from '@google/genai';
import { searchCatalog } from './catalog';
import { openRouterChat } from './openrouter';
import { extractFirstJsonArray, extractFirstJsonObject } from './parseJson';

// Types
interface LocalizedString {
  en: string;
  tr?: string;
  es?: string;
  pt?: string;
  de?: string;
  fr?: string;
}

type CurrencyCode = 'USD' | 'TRY' | 'EUR' | 'GBP';
type MarketSize = 'small' | 'medium' | 'large';
type CompetitionLevel = 'low' | 'medium' | 'high';
type ServiceTier = 'starter' | 'standard' | 'premium';

interface DiscoveredNiche {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  marketSize: MarketSize;
  competitionLevel: CompetitionLevel;
  avgRevenue: { min: number; max: number; currency: CurrencyCode };
  confidence: number;
  reasoning: LocalizedString;
  suggestedWorkflows: string[];
  idealCustomer: LocalizedString;
  painPoints: LocalizedString[];
}

interface ServicePackage {
  id: string;
  tier: ServiceTier;
  name: LocalizedString;
  description: LocalizedString;
  features: LocalizedString[];
  deliverables: LocalizedString[];
  setupFee: number;
  monthlyFee: number;
  currency: CurrencyCode;
  estimatedHours: number;
  targetMargin: number;
}

interface WorkflowRecommendation {
  workflowId: string;
  workflowName: string;
  priority: 'required' | 'recommended' | 'optional';
  reason: LocalizedString;
  installOrder: number;
  estimatedSetupTime: string;
  requiredCredentials: string[];
}

interface PricingStrategy {
  recommendedSetup: number;
  recommendedMonthly: number;
  currency: CurrencyCode;
  scenarios: Array<{
    id: string;
    name: LocalizedString;
    setupFee: number;
    monthlyFee: number;
    margin: number;
    marketPosition: number;
    pros: LocalizedString[];
    cons: LocalizedString[];
  }>;
  marketPosition: {
    percentile: number;
    positioning: 'Budget' | 'Mid-Market' | 'Premium' | 'Enterprise';
    competitorComparison: LocalizedString;
  };
  reasoning: LocalizedString;
  confidence: number;
}

interface TargetCustomerProfile {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  companySize: 'solo' | 'small' | 'medium' | 'large' | 'enterprise';
  industry: string;
  budget: { min: number; max: number; currency: CurrencyCode };
  painPoints: LocalizedString[];
  goals: LocalizedString[];
  decisionMakers: LocalizedString[];
  whereToFind: LocalizedString[];
}

interface CommunicationTemplate {
  id: string;
  type: 'cold_email' | 'linkedin_message' | 'phone_script' | 'elevator_pitch' | 'follow_up';
  name: LocalizedString;
  subject?: LocalizedString;
  body: LocalizedString;
  variables: string[];
}

interface SalesPitch {
  id: string;
  name: LocalizedString;
  subject: LocalizedString;
  email: LocalizedString;
  dm: LocalizedString;
  phone: LocalizedString;
  elevator: LocalizedString;
  suggestedOffer: LocalizedString;
  suggestedAutomations: string[];
  nextSteps: LocalizedString[];
}

interface AgencySolution {
  id: string;
  sectorId: string;
  nicheId?: string;
  name: LocalizedString;
  description: LocalizedString;
  servicePackages: ServicePackage[];
  recommendedWorkflows: WorkflowRecommendation[];
  pricingStrategy: PricingStrategy;
  targetCustomer: TargetCustomerProfile;
  salesPitchTemplates: SalesPitch[];
  communicationTemplates: CommunicationTemplate[];
  createdAt: string;
  updatedAt: string;
  confidence: number;
}

// Schema definitions for Gemini
const nicheDiscoverySchema = {
  type: Type.OBJECT,
  properties: {
    niches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name_en: { type: Type.STRING },
          name_tr: { type: Type.STRING },
          description_en: { type: Type.STRING },
          description_tr: { type: Type.STRING },
          marketSize: { type: Type.STRING, enum: ['small', 'medium', 'large'] },
          competitionLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          avgRevenueMin: { type: Type.NUMBER },
          avgRevenueMax: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          reasoning_en: { type: Type.STRING },
          reasoning_tr: { type: Type.STRING },
          suggestedWorkflows: { type: Type.ARRAY, items: { type: Type.STRING } },
          idealCustomer_en: { type: Type.STRING },
          idealCustomer_tr: { type: Type.STRING },
          painPoints_en: { type: Type.ARRAY, items: { type: Type.STRING } },
          painPoints_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['id', 'name_en', 'description_en', 'marketSize', 'competitionLevel', 'avgRevenueMin', 'avgRevenueMax', 'confidence', 'reasoning_en', 'suggestedWorkflows', 'idealCustomer_en', 'painPoints_en'],
      },
    },
  },
  required: ['niches'],
};

const solutionGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    name_en: { type: Type.STRING },
    name_tr: { type: Type.STRING },
    description_en: { type: Type.STRING },
    description_tr: { type: Type.STRING },

    // Service packages
    packages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tier: { type: Type.STRING, enum: ['starter', 'standard', 'premium'] },
          name_en: { type: Type.STRING },
          name_tr: { type: Type.STRING },
          description_en: { type: Type.STRING },
          description_tr: { type: Type.STRING },
          features_en: { type: Type.ARRAY, items: { type: Type.STRING } },
          features_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
          deliverables_en: { type: Type.ARRAY, items: { type: Type.STRING } },
          deliverables_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
          setupFee: { type: Type.NUMBER },
          monthlyFee: { type: Type.NUMBER },
          estimatedHours: { type: Type.NUMBER },
          targetMargin: { type: Type.NUMBER },
        },
        required: ['tier', 'name_en', 'features_en', 'deliverables_en', 'setupFee', 'monthlyFee'],
      },
    },

    // Pricing strategy
    pricing: {
      type: Type.OBJECT,
      properties: {
        recommendedSetup: { type: Type.NUMBER },
        recommendedMonthly: { type: Type.NUMBER },
        percentile: { type: Type.NUMBER },
        positioning: { type: Type.STRING, enum: ['Budget', 'Mid-Market', 'Premium', 'Enterprise'] },
        reasoning_en: { type: Type.STRING },
        reasoning_tr: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
      },
      required: ['recommendedSetup', 'recommendedMonthly', 'percentile', 'positioning', 'reasoning_en', 'confidence'],
    },

    // Target customer
    targetCustomer: {
      type: Type.OBJECT,
      properties: {
        name_en: { type: Type.STRING },
        name_tr: { type: Type.STRING },
        description_en: { type: Type.STRING },
        description_tr: { type: Type.STRING },
        companySize: { type: Type.STRING, enum: ['solo', 'small', 'medium', 'large', 'enterprise'] },
        budgetMin: { type: Type.NUMBER },
        budgetMax: { type: Type.NUMBER },
        painPoints_en: { type: Type.ARRAY, items: { type: Type.STRING } },
        painPoints_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
        goals_en: { type: Type.ARRAY, items: { type: Type.STRING } },
        goals_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
        whereToFind_en: { type: Type.ARRAY, items: { type: Type.STRING } },
        whereToFind_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['name_en', 'companySize', 'budgetMin', 'budgetMax', 'painPoints_en', 'goals_en', 'whereToFind_en'],
    },

    // Sales pitch
    salesPitch: {
      type: Type.OBJECT,
      properties: {
        subject_en: { type: Type.STRING },
        subject_tr: { type: Type.STRING },
        email_en: { type: Type.STRING },
        email_tr: { type: Type.STRING },
        dm_en: { type: Type.STRING },
        dm_tr: { type: Type.STRING },
        elevator_en: { type: Type.STRING },
        elevator_tr: { type: Type.STRING },
        suggestedOffer_en: { type: Type.STRING },
        suggestedOffer_tr: { type: Type.STRING },
        suggestedAutomations: { type: Type.ARRAY, items: { type: Type.STRING } },
        nextSteps_en: { type: Type.ARRAY, items: { type: Type.STRING } },
        nextSteps_tr: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['subject_en', 'email_en', 'dm_en', 'elevator_en', 'suggestedOffer_en', 'suggestedAutomations', 'nextSteps_en'],
    },

    // Workflow suggestions
    suggestedWorkflowTags: { type: Type.ARRAY, items: { type: Type.STRING } },

    confidence: { type: Type.NUMBER },
  },
  required: ['name_en', 'description_en', 'packages', 'pricing', 'targetCustomer', 'salesPitch', 'suggestedWorkflowTags', 'confidence'],
};

const AI_CONFIG_ERROR =
  'AI not configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in server/.env or Settings -> Vault.';

function safeText(input: unknown): string {
  return String(input ?? '').trim();
}

function normalizeEnum<T extends string>(input: unknown, allowed: T[], fallback: T): T {
  const value = safeText(input).toLowerCase() as T;
  return allowed.includes(value) ? value : fallback;
}

function normalizeNumber(input: unknown, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeConfidence(input: unknown): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return 0.6;
  if (value > 1 && value <= 100) return Math.max(0, Math.min(1, value / 100));
  if (value > 100) return 1;
  return Math.max(0, Math.min(1, value));
}

function normalizeStringList(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => safeText(item)).filter(Boolean).slice(0, max);
}

function isOpenAiModel(model: string): boolean {
  return /^openai\//i.test(model);
}

function trimForRepair(raw: string, max = 6000): string {
  const text = safeText(raw);
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function pickOpenRouterModel(): string {
  const explicit = safeText(process.env.AGENCY_BUILDER_MODEL);
  if (explicit) return explicit;
  const chairman = safeText(process.env.COUNCIL_CHAIRMAN_MODEL);
  if (chairman) return chairman;
  const first = safeText(process.env.COUNCIL_MODELS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || 'openai/gpt-5-mini';
}

// Discover niches using AI
export async function discoverNiches(params: {
  sectorId: string;
  sectorName: string;
  description: string;
  language: 'en' | 'tr';
}): Promise<{ niches: DiscoveredNiche[] }> {
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  const client = getGeminiClient();

  if (!openRouterKey && !client) throw new Error(AI_CONFIG_ERROR);

  const prompt = `You are an AI agency business consultant. Based on the user's description and selected sector, discover 3 profitable niches for an AI automation agency.

SECTOR: ${params.sectorName}
USER DESCRIPTION: "${params.description}"

For each niche, analyze:
1. Market size and growth potential
2. Competition level
3. Average project/retainer value
4. Ideal customer profile
5. Main pain points to solve
6. Suggested automation workflows

Be specific and actionable. Focus on niches where AI automation can provide clear ROI.

IMPORTANT: Provide both English (en) and Turkish (tr) versions of all text fields.
Constraints:
- Output EXACTLY 3 niches.
- Keep description <= 200 chars.
- Keep reasoning <= 220 chars.
- painPoints: max 4 items.
- suggestedWorkflows: max 6 items.`;

  try {
    if (openRouterKey) {
      const model = pickOpenRouterModel();
      const schemaHint =
        '{\n  "niches": [\n    {\n      "id": "string",\n      "name_en": "string",\n      "name_tr": "string",\n      "description_en": "string",\n      "description_tr": "string",\n      "marketSize": "small|medium|large",\n      "competitionLevel": "low|medium|high",\n      "avgRevenueMin": 0,\n      "avgRevenueMax": 0,\n      "confidence": 0.0,\n      "reasoning_en": "string",\n      "reasoning_tr": "string",\n      "suggestedWorkflows": ["string"],\n      "idealCustomer_en": "string",\n      "idealCustomer_tr": "string",\n      "painPoints_en": ["string"],\n      "painPoints_tr": ["string"]\n    }\n  ]\n}';
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model,
        temperature: 0.2,
        maxTokens: 2800,
        responseFormat: isOpenAiModel(model) ? { type: "json_object" } : undefined,
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON. No markdown, no code fences, no extra keys.',
          },
          {
            role: 'user',
            content: `${prompt}\n\nReturn ONLY JSON with this schema:\n${schemaHint}`,
          },
        ],
      });
      const parseNiches = (input: string) => {
        const parsedObject = extractFirstJsonObject<any>(input);
        const parsedArray = extractFirstJsonArray<any>(input);
        const nichesRaw: any[] =
          (parsedObject && Array.isArray(parsedObject.niches) && parsedObject.niches) ||
          (parsedObject && Array.isArray(parsedObject.data?.niches) && parsedObject.data.niches) ||
          (parsedObject && Array.isArray(parsedObject.items) && parsedObject.items) ||
          (Array.isArray(parsedObject) ? parsedObject : []) ||
          (Array.isArray(parsedArray) ? parsedArray : []);
        return Array.isArray(nichesRaw) ? nichesRaw : [];
      };

      let nichesRaw = parseNiches(raw);
      let repairOutput = '';
      if (nichesRaw.length === 0) {
        console.error('Niche discovery: unparseable output', { model, output: trimForRepair(raw, 1200) });
        const repair = await openRouterChat({
          apiKey: openRouterKey,
          model,
          temperature: 0,
          maxTokens: 1800,
          responseFormat: isOpenAiModel(model) ? { type: "json_object" } : undefined,
          messages: [
            {
              role: 'system',
              content: 'You are a JSON repair assistant. Output ONLY valid JSON. No markdown, no code fences.',
            },
            {
              role: 'user',
              content: `Fix the following output into valid JSON using this schema only:\n${schemaHint}\n\nOUTPUT TO FIX:\n${trimForRepair(raw)}`,
            },
          ],
        });
        repairOutput = repair;
        nichesRaw = parseNiches(repair);
        if (nichesRaw.length === 0) {
          console.error('Niche discovery: repair failed', { model, output: trimForRepair(repair, 1200) });
        }
      }

      if (nichesRaw.length === 0) {
        const err = new Error('Niche discovery failed');
        (err as any).details = {
          model,
          raw: trimForRepair(raw, 1200),
          repair: trimForRepair(repairOutput, 1200),
        };
        throw err;
      }

      const niches: DiscoveredNiche[] = nichesRaw.map((n: any, idx: number) => {
        const nameEn = safeText(n?.name_en || n?.name || n?.title || `Niche ${idx + 1}`);
        const nameTr = safeText(n?.name_tr || n?.nameTr || n?.name || nameEn);
        const descEn = safeText(n?.description_en || n?.description || "");
        const descTr = safeText(n?.description_tr || n?.descriptionTr || n?.description || descEn);
        const marketSize = normalizeEnum<MarketSize>(n?.marketSize, ['small', 'medium', 'large'], 'medium');
        const competitionLevel = normalizeEnum<CompetitionLevel>(n?.competitionLevel, ['low', 'medium', 'high'], 'medium');
        const avgMin = normalizeNumber(n?.avgRevenueMin, 0);
        const avgMax = normalizeNumber(n?.avgRevenueMax, avgMin);
        const reasoningEn = safeText(n?.reasoning_en || n?.reasoning || "");
        const reasoningTr = safeText(n?.reasoning_tr || n?.reasoning_tr || n?.reasoning || reasoningEn);
        const workflows = normalizeStringList(n?.suggestedWorkflows || n?.workflows || n?.suggested_workflows, 12);
        const idealCustomerEn = safeText(n?.idealCustomer_en || n?.idealCustomer || "");
        const idealCustomerTr = safeText(n?.idealCustomer_tr || n?.idealCustomer_tr || n?.idealCustomer || idealCustomerEn);
        const painPointsEn = normalizeStringList(n?.painPoints_en || n?.painPoints || n?.pain_points, 12);
        const painPointsTr = normalizeStringList(n?.painPoints_tr, 12);

        return {
          id: safeText(n?.id) || `niche-${Date.now()}-${idx}`,
          name: { en: nameEn, tr: nameTr || nameEn },
          description: { en: descEn || nameEn, tr: descTr || descEn || nameTr || nameEn },
          marketSize,
          competitionLevel,
          avgRevenue: {
            min: Number.isFinite(avgMin) ? avgMin : 0,
            max: Number.isFinite(avgMax) ? Math.max(avgMax, avgMin) : Math.max(avgMin, 0),
            currency: 'USD' as CurrencyCode,
          },
          confidence: normalizeConfidence(n?.confidence),
          reasoning: { en: reasoningEn || descEn || nameEn, tr: reasoningTr || descTr || reasoningEn || nameTr || nameEn },
          suggestedWorkflows: workflows,
          idealCustomer: { en: idealCustomerEn || nameEn, tr: idealCustomerTr || idealCustomerEn || nameTr || nameEn },
          painPoints: (painPointsEn.length > 0 ? painPointsEn : workflows).slice(0, 8).map((p: string, i: number) => ({
            en: p,
            tr: painPointsTr[i] || p,
          })),
        };
      });

      return { niches };
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: nicheDiscoverySchema,
      },
    });

    const data = JSON.parse(response.text || '{}');

    // Transform the response to our format
    const niches: DiscoveredNiche[] = (data.niches || []).map((n: any) => ({
      id: n.id || `niche-${Date.now()}`,
      name: { en: n.name_en, tr: n.name_tr || n.name_en },
      description: { en: n.description_en, tr: n.description_tr || n.description_en },
      marketSize: n.marketSize,
      competitionLevel: n.competitionLevel,
      avgRevenue: { min: n.avgRevenueMin, max: n.avgRevenueMax, currency: 'USD' as CurrencyCode },
      confidence: n.confidence,
      reasoning: { en: n.reasoning_en, tr: n.reasoning_tr || n.reasoning_en },
      suggestedWorkflows: n.suggestedWorkflows,
      idealCustomer: { en: n.idealCustomer_en, tr: n.idealCustomer_tr || n.idealCustomer_en },
      painPoints: (n.painPoints_en || []).map((p: string, i: number) => ({
        en: p,
        tr: n.painPoints_tr?.[i] || p,
      })),
    }));

    return { niches };
  } catch (error) {
    console.error('Niche discovery failed:', error);
    throw error instanceof Error ? error : new Error('Niche discovery failed');
  }
}

// Generate complete agency solution
export async function generateSolution(params: {
  sectorId: string;
  sectorName: string;
  nicheId?: string;
  nicheName?: string;
  customDescription?: string;
  targetRegion?: string;
  language: 'en' | 'tr';
}): Promise<AgencySolution> {
  const openRouterKey = safeText(process.env.OPENROUTER_API_KEY);
  const client = getGeminiClient();

  // Search for relevant workflows
  const workflowQuery = params.nicheName || params.sectorName;
  const workflows = await searchCatalog({ query: workflowQuery, limit: 15 }).catch(() => []);

  if (!openRouterKey && !client) throw new Error(AI_CONFIG_ERROR);

  const prompt = `You are an AI agency business consultant creating a complete business solution for an AI automation agency.

SECTOR: ${params.sectorName}
${params.nicheName ? `NICHE: ${params.nicheName}` : ''}
${params.customDescription ? `CUSTOM REQUIREMENTS: ${params.customDescription}` : ''}
${params.targetRegion ? `TARGET REGION: ${params.targetRegion}` : 'TARGET REGION: Global (USD pricing)'}

Available workflows in our catalog: ${workflows.slice(0, 10).map(w => w.name).join(', ')}

Create a complete agency solution including:

1. SERVICE PACKAGES (3 tiers: starter, standard, premium)
   - Each with specific features, deliverables, setup fee, and monthly retainer
   - Realistic pricing based on market rates
   - Clear differentiation between tiers

2. PRICING STRATEGY
   - Recommended setup and monthly fees
   - Market positioning (Budget/Mid-Market/Premium/Enterprise)
   - Competitive analysis reasoning

3. TARGET CUSTOMER PROFILE
   - Company size and type
   - Budget range
   - Pain points they experience
   - Goals they want to achieve
   - Where to find them (channels)

4. SALES PITCH TEMPLATES
   - Cold email subject and body
   - LinkedIn DM message
   - 30-second elevator pitch
   - Suggested offer and automations
   - Next steps after initial contact

5. WORKFLOW RECOMMENDATIONS
   - Suggest relevant workflow tags from our catalog

IMPORTANT: Provide both English (en) and Turkish (tr) versions of all text fields.
Be specific, actionable, and based on real market data. Pricing should be in USD.
Constraints:
- Keep descriptions <= 220 chars.
- features/deliverables: max 5 items each.
- painPoints/goals/whereToFind: max 5 items each.
- suggestedWorkflowTags: max 8 items.
- salesPitch texts <= 280 chars each.`;

  try {
    if (openRouterKey) {
      const model = pickOpenRouterModel();
      const schemaHint =
        '{\n  "name_en":"string",\n  "name_tr":"string",\n  "description_en":"string",\n  "description_tr":"string",\n  "packages":[\n    {\n      "tier":"starter|standard|premium",\n      "name_en":"string",\n      "name_tr":"string",\n      "description_en":"string",\n      "description_tr":"string",\n      "features_en":["string"],\n      "features_tr":["string"],\n      "deliverables_en":["string"],\n      "deliverables_tr":["string"],\n      "setupFee":0,\n      "monthlyFee":0,\n      "estimatedHours":0,\n      "targetMargin":0\n    }\n  ],\n  "pricing":{\n    "recommendedSetup":0,\n    "recommendedMonthly":0,\n    "percentile":0,\n    "positioning":"Budget|Mid-Market|Premium|Enterprise",\n    "reasoning_en":"string",\n    "reasoning_tr":"string",\n    "confidence":0\n  },\n  "targetCustomer":{\n    "name_en":"string",\n    "name_tr":"string",\n    "description_en":"string",\n    "description_tr":"string",\n    "companySize":"solo|small|medium|large|enterprise",\n    "budgetMin":0,\n    "budgetMax":0,\n    "painPoints_en":["string"],\n    "painPoints_tr":["string"],\n    "goals_en":["string"],\n    "goals_tr":["string"],\n    "whereToFind_en":["string"],\n    "whereToFind_tr":["string"]\n  },\n  "salesPitch":{\n    "subject_en":"string",\n    "subject_tr":"string",\n    "email_en":"string",\n    "email_tr":"string",\n    "dm_en":"string",\n    "dm_tr":"string",\n    "elevator_en":"string",\n    "elevator_tr":"string",\n    "suggestedOffer_en":"string",\n    "suggestedOffer_tr":"string",\n    "suggestedAutomations":["string"],\n    "nextSteps_en":["string"],\n    "nextSteps_tr":["string"]\n  },\n  "suggestedWorkflowTags":["string"],\n  "confidence":0\n}';
      const raw = await openRouterChat({
        apiKey: openRouterKey,
        model,
        temperature: 0.2,
        maxTokens: 4200,
        responseFormat: isOpenAiModel(model) ? { type: "json_object" } : undefined,
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON. No markdown, no code fences, no extra keys.',
          },
          {
            role: 'user',
            content: `${prompt}\n\nReturn ONLY JSON with this schema:\n${schemaHint}`,
          },
        ],
      });
      let parsed = extractFirstJsonObject<any>(raw);
      if (!parsed || typeof parsed !== 'object') {
        const repair = await openRouterChat({
          apiKey: openRouterKey,
          model,
          temperature: 0,
          maxTokens: 2400,
          responseFormat: isOpenAiModel(model) ? { type: "json_object" } : undefined,
          messages: [
            {
              role: 'system',
              content: 'You are a JSON repair assistant. Output ONLY valid JSON. No markdown, no code fences.',
            },
            {
              role: 'user',
              content: `Fix the following output into valid JSON using this schema only:\n${schemaHint}\n\nOUTPUT TO FIX:\n${trimForRepair(raw)}`,
            },
          ],
        });
        parsed = extractFirstJsonObject<any>(repair);
      }
      if (!parsed || typeof parsed !== 'object') throw new Error('Solution generation failed');
      return transformToSolution(parsed, params, workflows);
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: solutionGenerationSchema,
      },
    });

    const data = JSON.parse(response.text || '{}');

    // Transform to our solution format
    const solution = transformToSolution(data, params, workflows);
    return solution;
  } catch (error) {
    console.error('Solution generation failed:', error);
    throw error instanceof Error ? error : new Error('Solution generation failed');
  }
}

// Match workflows for a solution
export async function matchWorkflows(params: {
  sectorId: string;
  nicheId?: string;
  serviceTypes: string[];
  keywords: string[];
}): Promise<WorkflowRecommendation[]> {
  // Search workflows from catalog
  const searchQueries = [...params.keywords, params.sectorId, params.nicheId].filter(Boolean);
  const allWorkflows: any[] = [];

  for (const query of searchQueries.slice(0, 3)) {
    const results = await searchCatalog({ query: query as string, limit: 10 }).catch(() => []);
    allWorkflows.push(...results);
  }

  // Deduplicate by ID
  const uniqueWorkflows = allWorkflows.filter((w, i, arr) =>
    arr.findIndex(x => x.id === w.id) === i
  );

  // Convert to recommendations
  const recommendations: WorkflowRecommendation[] = uniqueWorkflows.slice(0, 10).map((w, index) => ({
    workflowId: w.id,
    workflowName: w.name,
    priority: index < 3 ? 'required' : index < 6 ? 'recommended' : 'optional',
    reason: {
      en: `This workflow helps with ${w.tags?.slice(0, 2).join(' and ') || 'automation'}`,
      tr: `Bu workflow ${w.tags?.slice(0, 2).join(' ve ') || 'otomasyon'} konusunda yardımcı olur`,
    },
    installOrder: index + 1,
    estimatedSetupTime: w.complexity === 'High' ? '2-3 hours' : w.complexity === 'Medium' ? '1-2 hours' : '30 min',
    requiredCredentials: w.credentials || [],
  }));

  return recommendations;
}

// Get market pricing data for an industry
export async function getMarketPricing(params: {
  industry: string;
  region?: string;
  complexity?: 'Low' | 'Medium' | 'High' | 'Enterprise';
}): Promise<{
  range: { low: number; mid: number; high: number };
  currency: CurrencyCode;
  confidence: number;
}> {
  // Base pricing data by industry
  const industryPricing: Record<string, { low: number; mid: number; high: number }> = {
    ecom: { low: 500, mid: 1500, high: 3500 },
    marketing: { low: 800, mid: 2000, high: 5000 },
    finance: { low: 1000, mid: 3000, high: 6000 },
    realestate: { low: 600, mid: 1800, high: 4000 },
    saas: { low: 1500, mid: 4000, high: 8000 },
    support: { low: 600, mid: 1500, high: 3500 },
    healthcare: { low: 1200, mid: 3500, high: 7000 },
    education: { low: 400, mid: 1200, high: 3000 },
    hr: { low: 800, mid: 2500, high: 5000 },
    legal: { low: 1500, mid: 4000, high: 8000 },
    content: { low: 400, mid: 1200, high: 3000 },
    logistics: { low: 1000, mid: 2500, high: 5500 },
  };

  const base = industryPricing[params.industry] || { low: 500, mid: 1500, high: 4000 };

  // Adjust for complexity
  const complexityMultiplier = {
    Low: 0.7,
    Medium: 1.0,
    High: 1.5,
    Enterprise: 2.5,
  };
  const multiplier = complexityMultiplier[params.complexity || 'Medium'];

  // Regional adjustment
  const regionMultiplier: Record<string, number> = {
    US: 1.0,
    EU: 0.95,
    UK: 0.9,
    TR: 0.35,
    MENA: 0.7,
    LATAM: 0.5,
    APAC: 0.8,
  };
  const regionMult = regionMultiplier[params.region || 'US'] || 1.0;

  return {
    range: {
      low: Math.round(base.low * multiplier * regionMult),
      mid: Math.round(base.mid * multiplier * regionMult),
      high: Math.round(base.high * multiplier * regionMult),
    },
    currency: params.region === 'TR' ? 'TRY' : params.region === 'EU' || params.region === 'UK' ? 'EUR' : 'USD',
    confidence: 0.75,
  };
}

// Helper: Generate mock niches when AI is unavailable
function generateMockNiches(params: { sectorId: string; description: string; language: string }): DiscoveredNiche[] {
  const keywords = params.description.toLowerCase();

  return [
    {
      id: `${params.sectorId}-auto-1`,
      name: { en: 'Automation for Small Businesses', tr: 'Küçük İşletmeler için Otomasyon' },
      description: {
        en: 'AI-powered automation solutions for small businesses looking to streamline operations.',
        tr: 'Operasyonlarını düzene sokmak isteyen küçük işletmeler için AI destekli otomasyon çözümleri.',
      },
      marketSize: 'large',
      competitionLevel: 'medium',
      avgRevenue: { min: 800, max: 2500, currency: 'USD' },
      confidence: 0.85,
      reasoning: {
        en: 'High demand from SMBs for automation. Growing market with moderate competition.',
        tr: 'KOBİ\'lerden otomasyon için yüksek talep. Orta düzey rekabetle büyüyen pazar.',
      },
      suggestedWorkflows: ['lead-capture', 'email-automation', 'crm-sync'],
      idealCustomer: { en: 'Small business owners with 5-20 employees', tr: '5-20 çalışanlı küçük işletme sahipleri' },
      painPoints: [
        { en: 'Manual repetitive tasks', tr: 'Manuel tekrarlayan işler' },
        { en: 'Limited time for growth activities', tr: 'Büyüme faaliyetleri için sınırlı zaman' },
      ],
    },
    {
      id: `${params.sectorId}-auto-2`,
      name: { en: 'AI Chatbot Solutions', tr: 'AI Chatbot Çözümleri' },
      description: {
        en: 'Intelligent chatbots for customer support and lead qualification.',
        tr: 'Müşteri desteği ve lead nitelendirmesi için akıllı chatbot\'lar.',
      },
      marketSize: 'large',
      competitionLevel: 'high',
      avgRevenue: { min: 1200, max: 4000, currency: 'USD' },
      confidence: 0.78,
      reasoning: {
        en: 'Chatbots are in high demand. Higher competition but strong market size.',
        tr: 'Chatbot\'lar yüksek talep görüyor. Daha yüksek rekabet ama güçlü pazar büyüklüğü.',
      },
      suggestedWorkflows: ['chatbot', 'ticket-routing', 'sentiment-analysis'],
      idealCustomer: { en: 'E-commerce and SaaS companies', tr: 'E-ticaret ve SaaS şirketleri' },
      painPoints: [
        { en: 'High support costs', tr: 'Yüksek destek maliyetleri' },
        { en: '24/7 availability needs', tr: '7/24 erişilebilirlik ihtiyacı' },
      ],
    },
    {
      id: `${params.sectorId}-auto-3`,
      name: { en: 'Enterprise Integration Suite', tr: 'Kurumsal Entegrasyon Paketi' },
      description: {
        en: 'Complex multi-system integrations for larger organizations.',
        tr: 'Daha büyük kuruluşlar için karmaşık çoklu sistem entegrasyonları.',
      },
      marketSize: 'medium',
      competitionLevel: 'low',
      avgRevenue: { min: 3000, max: 8000, currency: 'USD' },
      confidence: 0.70,
      reasoning: {
        en: 'Lower competition in enterprise space. Requires expertise but offers higher margins.',
        tr: 'Kurumsal alanda daha düşük rekabet. Uzmanlık gerektirir ancak daha yüksek marjlar sunar.',
      },
      suggestedWorkflows: ['enterprise-sync', 'data-pipeline', 'reporting'],
      idealCustomer: { en: 'Enterprises with 100+ employees', tr: '100+ çalışanlı kurumsal şirketler' },
      painPoints: [
        { en: 'Legacy system integration', tr: 'Eski sistem entegrasyonu' },
        { en: 'Data silos', tr: 'Veri siloları' },
      ],
    },
  ];
}

// Helper: Generate mock solution when AI is unavailable
function generateMockSolution(params: { sectorId: string; sectorName: string; nicheName?: string; customDescription?: string }, workflows: any[]): AgencySolution {
  const now = new Date().toISOString();

  return {
    id: `solution-${Date.now()}`,
    sectorId: params.sectorId,
    nicheId: params.nicheName ? `${params.sectorId}-custom` : undefined,
    name: {
      en: params.nicheName || `${params.sectorName} Automation Solution`,
      tr: params.nicheName || `${params.sectorName} Otomasyon Çözümü`,
    },
    description: {
      en: `Complete AI automation solution for the ${params.sectorName} industry.`,
      tr: `${params.sectorName} sektörü için eksiksiz AI otomasyon çözümü.`,
    },
    servicePackages: [
      {
        id: 'starter',
        tier: 'starter',
        name: { en: 'Starter Package', tr: 'Başlangıç Paketi' },
        description: { en: 'Perfect for getting started with automation', tr: 'Otomasyona başlamak için ideal' },
        features: [
          { en: 'Up to 5 automated workflows', tr: '5 adete kadar otomatik workflow' },
          { en: 'Basic integrations', tr: 'Temel entegrasyonlar' },
          { en: 'Email support', tr: 'E-posta desteği' },
        ],
        deliverables: [
          { en: 'Setup and configuration', tr: 'Kurulum ve yapılandırma' },
          { en: 'Basic training', tr: 'Temel eğitim' },
          { en: 'Documentation', tr: 'Dokümantasyon' },
        ],
        setupFee: 500,
        monthlyFee: 500,
        currency: 'USD',
        estimatedHours: 10,
        targetMargin: 60,
      },
      {
        id: 'standard',
        tier: 'standard',
        name: { en: 'Standard Package', tr: 'Standart Paket' },
        description: { en: 'Most popular choice for growing businesses', tr: 'Büyüyen işletmeler için en popüler seçim' },
        features: [
          { en: 'Up to 15 automated workflows', tr: '15 adete kadar otomatik workflow' },
          { en: 'Advanced integrations', tr: 'Gelişmiş entegrasyonlar' },
          { en: 'Priority support', tr: 'Öncelikli destek' },
          { en: 'Monthly optimization calls', tr: 'Aylık optimizasyon görüşmeleri' },
        ],
        deliverables: [
          { en: 'Complete setup and configuration', tr: 'Eksiksiz kurulum ve yapılandırma' },
          { en: 'Team training session', tr: 'Ekip eğitim oturumu' },
          { en: 'Custom dashboard', tr: 'Özel dashboard' },
        ],
        setupFee: 1000,
        monthlyFee: 1200,
        currency: 'USD',
        estimatedHours: 25,
        targetMargin: 65,
      },
      {
        id: 'premium',
        tier: 'premium',
        name: { en: 'Premium Package', tr: 'Premium Paket' },
        description: { en: 'Enterprise-grade solution with full support', tr: 'Tam destekli kurumsal düzey çözüm' },
        features: [
          { en: 'Unlimited workflows', tr: 'Sınırsız workflow' },
          { en: 'All integrations', tr: 'Tüm entegrasyonlar' },
          { en: '24/7 support', tr: '7/24 destek' },
          { en: 'Dedicated account manager', tr: 'Özel hesap yöneticisi' },
          { en: 'Custom development', tr: 'Özel geliştirme' },
        ],
        deliverables: [
          { en: 'Full implementation', tr: 'Tam uygulama' },
          { en: 'Comprehensive training program', tr: 'Kapsamlı eğitim programı' },
          { en: 'Custom integrations', tr: 'Özel entegrasyonlar' },
          { en: 'Quarterly business reviews', tr: 'Üç aylık iş değerlendirmeleri' },
        ],
        setupFee: 2500,
        monthlyFee: 2500,
        currency: 'USD',
        estimatedHours: 50,
        targetMargin: 70,
      },
    ],
    recommendedWorkflows: workflows.slice(0, 8).map((w, i) => ({
      workflowId: w.id,
      workflowName: w.name,
      priority: i < 3 ? 'required' as const : i < 5 ? 'recommended' as const : 'optional' as const,
      reason: {
        en: `Essential for ${w.tags?.[0] || 'automation'}`,
        tr: `${w.tags?.[0] || 'otomasyon'} için gerekli`,
      },
      installOrder: i + 1,
      estimatedSetupTime: '1-2 hours',
      requiredCredentials: w.credentials || [],
    })),
    pricingStrategy: {
      recommendedSetup: 1000,
      recommendedMonthly: 1200,
      currency: 'USD',
      scenarios: [
        {
          id: 'budget',
          name: { en: 'Budget Option', tr: 'Bütçe Seçeneği' },
          setupFee: 500,
          monthlyFee: 500,
          margin: 50,
          marketPosition: 25,
          pros: [{ en: 'Easy to close', tr: 'Kapatması kolay' }],
          cons: [{ en: 'Lower margins', tr: 'Düşük marjlar' }],
        },
        {
          id: 'value',
          name: { en: 'Value Option', tr: 'Değer Seçeneği' },
          setupFee: 1000,
          monthlyFee: 1200,
          margin: 65,
          marketPosition: 50,
          pros: [{ en: 'Best balance', tr: 'En iyi denge' }],
          cons: [{ en: 'More sales effort', tr: 'Daha fazla satış çabası' }],
        },
        {
          id: 'premium',
          name: { en: 'Premium Option', tr: 'Premium Seçenek' },
          setupFee: 2500,
          monthlyFee: 2500,
          margin: 75,
          marketPosition: 80,
          pros: [{ en: 'Higher margins', tr: 'Yüksek marjlar' }],
          cons: [{ en: 'Harder to close', tr: 'Kapatması zor' }],
        },
      ],
      marketPosition: {
        percentile: 50,
        positioning: 'Mid-Market',
        competitorComparison: {
          en: 'Competitive pricing with premium service quality',
          tr: 'Premium hizmet kalitesiyle rekabetçi fiyatlandırma',
        },
      },
      reasoning: {
        en: 'Based on market research and competitor analysis, this pricing positions you as a value provider.',
        tr: 'Pazar araştırması ve rakip analizine dayanarak, bu fiyatlandırma sizi değer sağlayıcı olarak konumlandırır.',
      },
      confidence: 0.78,
    },
    targetCustomer: {
      id: 'target-1',
      name: { en: 'Growth-Focused SMB', tr: 'Büyüme Odaklı KOBİ' },
      description: { en: 'Small to medium businesses looking to scale with automation', tr: 'Otomasyonla ölçeklenmek isteyen küçük ve orta ölçekli işletmeler' },
      companySize: 'small',
      industry: params.sectorId,
      budget: { min: 500, max: 3000, currency: 'USD' },
      painPoints: [
        { en: 'Manual processes taking too much time', tr: 'Manuel süreçler çok fazla zaman alıyor' },
        { en: 'Difficulty scaling operations', tr: 'Operasyonları ölçekleme zorluğu' },
        { en: 'Limited technical resources', tr: 'Sınırlı teknik kaynaklar' },
      ],
      goals: [
        { en: 'Reduce manual work by 50%', tr: 'Manuel işi %50 azaltmak' },
        { en: 'Scale without hiring', tr: 'İşe almadan ölçeklenmek' },
        { en: 'Improve customer experience', tr: 'Müşteri deneyimini iyileştirmek' },
      ],
      decisionMakers: [
        { en: 'Business Owner', tr: 'İşletme Sahibi' },
        { en: 'Operations Manager', tr: 'Operasyon Müdürü' },
      ],
      whereToFind: [
        { en: 'LinkedIn', tr: 'LinkedIn' },
        { en: 'Industry conferences', tr: 'Sektör konferansları' },
        { en: 'Business Facebook groups', tr: 'İşletme Facebook grupları' },
        { en: 'Google My Business listings', tr: 'Google My Business listeleri' },
      ],
    },
    salesPitchTemplates: [
      {
        id: 'pitch-1',
        name: { en: 'Cold Outreach', tr: 'Soğuk Erişim' },
        subject: { en: 'Quick question about your operations', tr: 'Operasyonlarınız hakkında hızlı bir soru' },
        email: {
          en: `Hi {{name}},

I noticed {{company}} is doing great work in ${params.sectorName}. Many businesses in your industry are struggling with manual processes that eat up valuable time.

We help companies like yours automate repetitive tasks, saving 10-20 hours per week on average.

Would you be open to a quick 15-minute call to see if this could help {{company}}?

Best,
{{your_name}}`,
          tr: `Merhaba {{name}},

{{company}}'ın ${params.sectorName} alanında harika işler yaptığını fark ettim. Sektörünüzdeki birçok işletme, değerli zamanı tüketen manuel süreçlerle mücadele ediyor.

Sizin gibi şirketlere tekrarlayan görevleri otomatikleştirmelerine yardımcı oluyoruz, ortalama haftada 10-20 saat tasarruf sağlıyoruz.

Bunun {{company}}'a yardımcı olup olmayacağını görmek için kısa 15 dakikalık bir görüşmeye açık mısınız?

Saygılarımla,
{{your_name}}`,
        },
        dm: {
          en: `Hey {{name}} 👋 I help ${params.sectorName} businesses automate their operations. Would love to chat if you're looking to save time on repetitive tasks!`,
          tr: `Merhaba {{name}} 👋 ${params.sectorName} işletmelerinin operasyonlarını otomatikleştirmelerine yardımcı oluyorum. Tekrarlayan işlerde zaman kazanmak istiyorsanız sohbet etmek isterim!`,
        },
        phone: {
          en: `Hi {{name}}, this is {{your_name}}. I'm reaching out because we've helped several ${params.sectorName} businesses save significant time through automation. Do you have 2 minutes to hear how?`,
          tr: `Merhaba {{name}}, ben {{your_name}}. Birçok ${params.sectorName} işletmesinin otomasyon yoluyla önemli ölçüde zaman tasarrufu etmesine yardımcı olduk. Nasıl olduğunu duymak için 2 dakikanız var mı?`,
        },
        elevator: {
          en: `I help ${params.sectorName} businesses automate their operations so they can focus on growth instead of repetitive tasks. Our clients typically save 10-20 hours per week.`,
          tr: `${params.sectorName} işletmelerinin operasyonlarını otomatikleştirmelerine yardımcı oluyorum, böylece tekrarlayan işler yerine büyümeye odaklanabilirler. Müşterilerimiz genellikle haftada 10-20 saat tasarruf ediyor.`,
        },
        suggestedOffer: {
          en: 'Free automation audit + implementation roadmap',
          tr: 'Ücretsiz otomasyon denetimi + uygulama yol haritası',
        },
        suggestedAutomations: ['lead-capture', 'email-sequences', 'crm-integration', 'reporting'],
        nextSteps: [
          { en: 'Schedule discovery call', tr: 'Keşif görüşmesi planla' },
          { en: 'Send case study', tr: 'Vaka çalışması gönder' },
          { en: 'Prepare audit report', tr: 'Denetim raporu hazırla' },
        ],
      },
    ],
    communicationTemplates: [
      {
        id: 'followup-1',
        type: 'follow_up',
        name: { en: 'Follow-up After No Response', tr: 'Yanıt Alınmaması Durumunda Takip' },
        subject: { en: 'Following up', tr: 'Takip' },
        body: {
          en: `Hi {{name}},

Just following up on my previous message. I know you're busy, so I'll keep this short.

If automating manual tasks isn't a priority right now, no worries at all. But if you'd like to explore how we could save {{company}} 10+ hours per week, I'm happy to chat.

Best,
{{your_name}}`,
          tr: `Merhaba {{name}},

Önceki mesajımı takip ediyorum. Meşgul olduğunuzu biliyorum, bu yüzden kısa tutacağım.

Manuel görevleri otomatikleştirmek şu anda bir öncelik değilse, sorun değil. Ancak {{company}}'a haftada 10+ saat nasıl tasarruf ettirebileceğimizi keşfetmek isterseniz, sohbet etmekten mutluluk duyarım.

Saygılarımla,
{{your_name}}`,
        },
        variables: ['name', 'company', 'your_name'],
      },
    ],
    createdAt: now,
    updatedAt: now,
    confidence: 0.75,
  };
}

// Helper: Transform Gemini response to solution format
function transformToSolution(data: any, params: { sectorId: string; sectorName: string; nicheName?: string }, workflows: any[]): AgencySolution {
  const now = new Date().toISOString();

  return {
    id: `solution-${Date.now()}`,
    sectorId: params.sectorId,
    nicheId: params.nicheName ? `${params.sectorId}-custom` : undefined,
    name: {
      en: data.name_en || `${params.sectorName} Solution`,
      tr: data.name_tr || data.name_en || `${params.sectorName} Çözümü`,
    },
    description: {
      en: data.description_en || '',
      tr: data.description_tr || data.description_en || '',
    },
    servicePackages: (data.packages || []).map((pkg: any) => ({
      id: pkg.tier,
      tier: pkg.tier,
      name: { en: pkg.name_en, tr: pkg.name_tr || pkg.name_en },
      description: { en: pkg.description_en || '', tr: pkg.description_tr || pkg.description_en || '' },
      features: (pkg.features_en || []).map((f: string, i: number) => ({
        en: f,
        tr: pkg.features_tr?.[i] || f,
      })),
      deliverables: (pkg.deliverables_en || []).map((d: string, i: number) => ({
        en: d,
        tr: pkg.deliverables_tr?.[i] || d,
      })),
      setupFee: pkg.setupFee || 0,
      monthlyFee: pkg.monthlyFee || 0,
      currency: 'USD' as CurrencyCode,
      estimatedHours: pkg.estimatedHours || 20,
      targetMargin: pkg.targetMargin || 60,
    })),
    recommendedWorkflows: workflows.slice(0, 8).map((w, i) => ({
      workflowId: w.id,
      workflowName: w.name,
      priority: i < 3 ? 'required' as const : i < 5 ? 'recommended' as const : 'optional' as const,
      reason: { en: `Essential workflow`, tr: 'Temel workflow' },
      installOrder: i + 1,
      estimatedSetupTime: '1-2 hours',
      requiredCredentials: w.credentials || [],
    })),
    pricingStrategy: {
      recommendedSetup: data.pricing?.recommendedSetup || 1000,
      recommendedMonthly: data.pricing?.recommendedMonthly || 1200,
      currency: 'USD',
      scenarios: [],
      marketPosition: {
        percentile: data.pricing?.percentile || 50,
        positioning: data.pricing?.positioning || 'Mid-Market',
        competitorComparison: {
          en: data.pricing?.reasoning_en || 'Competitive pricing',
          tr: data.pricing?.reasoning_tr || 'Rekabetçi fiyatlandırma',
        },
      },
      reasoning: {
        en: data.pricing?.reasoning_en || '',
        tr: data.pricing?.reasoning_tr || '',
      },
      confidence: data.pricing?.confidence || 0.75,
    },
    targetCustomer: {
      id: 'target-1',
      name: { en: data.targetCustomer?.name_en || 'Target Customer', tr: data.targetCustomer?.name_tr || 'Hedef Müşteri' },
      description: { en: data.targetCustomer?.description_en || '', tr: data.targetCustomer?.description_tr || '' },
      companySize: data.targetCustomer?.companySize || 'small',
      industry: params.sectorId,
      budget: {
        min: data.targetCustomer?.budgetMin || 500,
        max: data.targetCustomer?.budgetMax || 3000,
        currency: 'USD',
      },
      painPoints: (data.targetCustomer?.painPoints_en || []).map((p: string, i: number) => ({
        en: p,
        tr: data.targetCustomer?.painPoints_tr?.[i] || p,
      })),
      goals: (data.targetCustomer?.goals_en || []).map((g: string, i: number) => ({
        en: g,
        tr: data.targetCustomer?.goals_tr?.[i] || g,
      })),
      decisionMakers: [],
      whereToFind: (data.targetCustomer?.whereToFind_en || []).map((w: string, i: number) => ({
        en: w,
        tr: data.targetCustomer?.whereToFind_tr?.[i] || w,
      })),
    },
    salesPitchTemplates: [
      {
        id: 'pitch-1',
        name: { en: 'Main Pitch', tr: 'Ana Pitch' },
        subject: { en: data.salesPitch?.subject_en || '', tr: data.salesPitch?.subject_tr || '' },
        email: { en: data.salesPitch?.email_en || '', tr: data.salesPitch?.email_tr || '' },
        dm: { en: data.salesPitch?.dm_en || '', tr: data.salesPitch?.dm_tr || '' },
        phone: { en: '', tr: '' },
        elevator: { en: data.salesPitch?.elevator_en || '', tr: data.salesPitch?.elevator_tr || '' },
        suggestedOffer: { en: data.salesPitch?.suggestedOffer_en || '', tr: data.salesPitch?.suggestedOffer_tr || '' },
        suggestedAutomations: data.salesPitch?.suggestedAutomations || [],
        nextSteps: (data.salesPitch?.nextSteps_en || []).map((s: string, i: number) => ({
          en: s,
          tr: data.salesPitch?.nextSteps_tr?.[i] || s,
        })),
      },
    ],
    communicationTemplates: [],
    createdAt: now,
    updatedAt: now,
    confidence: data.confidence || 0.75,
  };
}
