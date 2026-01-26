
export interface Workflow {
  id: string;
  name: string;
  description: string;
  tags: string[];
  jsonUrl: string;
  complexity: 'Low' | 'Medium' | 'High';
  credentials: string[];
  installPlan?: WorkflowInstallPlan;
  deployment?: WorkflowDeployment;
}

export type WorkflowDeploymentStatus = 'Staged' | 'Imported' | 'Activated' | 'Error';

export interface WorkflowDeployment {
  provider: 'n8n';
  status: WorkflowDeploymentStatus;
  n8nWorkflowId?: string;
  message?: string;
  updatedAt: string;
}

export interface WorkflowInstallPlan {
  credentialChecklist: string[];
  installSteps: string[];
  testSteps: string[];
  riskNotes: string[];
}

export interface WorkflowCandidate {
  workflow: Workflow;
  score: number;
  installPlan: WorkflowInstallPlan;
  reason?: string;
}

export interface ProjectBrief {
  id: string;
  clientName: string;
  description: string;
  industry?: string;
  goals: string[];
  tools: string[];
  budget: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface CRMActivity {
  id: string;
  type: 'Call' | 'Meeting' | 'Email' | 'Note' | 'Status Change';
  subject: string;
  status: 'Completed' | 'Scheduled' | 'Pending' | 'Draft';
  timestamp: string;
}

export type ExternalProvider = 'documenso' | 'invoiceshelf' | 'suitecrm' | 'n8n' | 'infisical';

export interface ExternalRef {
  provider: ExternalProvider;
  id: string;
  url?: string;
  meta?: Record<string, any>;
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: 'Proposal' | 'SOW' | 'Invoice' | 'Contract' | 'Report';
  status: 'Draft' | 'Sent' | 'Signed' | 'Paid';
  content?: string;
  url: string;
  amount?: number;
  externalRef?: ExternalRef;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  workflowName: string;
  status: 'Success' | 'Error';
  errorDetails?: string;
  timestamp: string;
  duration: string;
}

export interface ProjectIncident {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Investigating' | 'Resolved';
  rootCause?: string;
  resolutionPlan?: string;
  timestamp: string;
}

export interface OperatorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCall?: {
    name: string;
    status: 'pending' | 'success' | 'error';
    result?: string;
    executionProgress?: number;
  };
}

export interface ProjectFinancials {
  revenue: number;
  expenses: number;
  hoursSaved: number;
  costPerExecution: number;
}

export type ProjectTab = 'Workflows' | 'Operator' | 'CRM' | 'Documents' | 'Financials' | 'Monitoring' | 'Settings';

export interface ProjectGovernance {
  certified: boolean;
  lastScore: number;
  verdict: 'Approved' | 'Risk' | 'None';
}

export interface Project {
  id: string;
  brief: ProjectBrief;
  status: 'Intake' | 'Proposal' | 'Developing' | 'Testing' | 'Live';
  activeWorkflows: Workflow[];
  documents: ProjectDocument[];
  executionLogs: ExecutionLog[];
  incidents: ProjectIncident[];
  operatorChat: OperatorMessage[];
  crmActivities: CRMActivity[];
  financials: ProjectFinancials;
  governance: ProjectGovernance;
  totalBilled: number;
  createdAt: string;
}

export interface Lead {
  id: string;
  source: string;
  clientName: string;
  brief: string;
  timestamp: string;
  aiScore: number;
  qualificationReason?: string;
}

export type OutboundStage = 'New' | 'Contacted' | 'Replied' | 'Booked' | 'Proposal' | 'Won' | 'Lost';

export interface OutboundLead {
  id: string;
  name: string;
  category?: string;
  address?: string;
  website?: string;
  phone?: string;
  mapsUrl?: string;
  country?: string;
  city?: string;
  stage: OutboundStage;
  notes?: string;
  lastActionAt?: string;
  nextFollowUpAt?: string;
  source: 'market_radar' | 'manual';
  sourceRef?: string;
  externalRef?: ExternalRef;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CouncilOpinion {
  persona: string;
  role: string;
  opinion: string;
  score: number;
}

export type PricingCadence = 'One-Time' | 'Monthly' | 'Usage';

export interface CouncilPricingLineItem {
  label: string;
  amount: number;
  cadence: PricingCadence;
  notes?: string;
}

export interface CouncilPricing {
  currency: string;
  lineItems: CouncilPricingLineItem[];
  totalOneTime?: number;
  totalMonthly?: number;
  totalFirstMonth?: number;
  assumptions?: string[];
}

export type CouncilGate = 'Strategic' | 'Risk' | 'Launch' | 'Post-Mortem';

export interface CouncilSession {
  id: string;
  projectId: string;
  gateType: CouncilGate;
  topic: string;
  opinions: CouncilOpinion[];
  synthesis: string;
  decision: 'Approved' | 'Rejected' | 'Needs Revision';
  pricing?: CouncilPricing;
  language?: 'tr' | 'en';
  boardName?: string;
  currentStage?: { id: Project['status']; label: string };
  boardSummary?: string;
  nextSteps?: string[];
  moneySteps?: string[];
  workflowSuggestions?: WorkflowCandidate[];
  suggestedCatalogQuery?: { query: string; requiredTags?: string[] };
  modelOutputs?: Array<{ model: string; content: string }>;
  chairmanModel?: string;
  stage2Rankings?: Array<{ model: string; content: string; parsedRanking: string[] }>;
  labelToModel?: Record<string, string>;
  aggregateRankings?: Array<{ model: string; averageRank: number; rankingsCount: number }>;
  createdAt?: string;
}

export interface AgencySecret {
  id: string;
  key: string;
  value: string;
  environment: 'Development' | 'Staging' | 'Production';
  lastUpdated: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  type: 'AI' | 'Human';
  avatar: string;
  specialization: string[];
  status: 'Online' | 'Busy' | 'Offline';
}

export interface SystemEvent {
  id: string;
  type: 'Info' | 'Warning' | 'Alert' | 'Success';
  message: string;
  timestamp: string;
  projectRef?: string;
}

export enum WorkspaceType {
  AGENCY = 'AGENCY',
  CLIENT = 'CLIENT'
}

export enum View {
  LANDING = 'LANDING',
  SETUP = 'SETUP',
  HOME = 'HOME',
  JOURNEY = 'JOURNEY',
  ASSISTANT = 'ASSISTANT',
  PASSIVE_HUB = 'PASSIVE_HUB',
  DASHBOARD = 'DASHBOARD',
  PROJECTS = 'PROJECTS',
  MONEY = 'MONEY',
  INTAKE = 'INTAKE',
  PROJECT_DETAIL = 'PROJECT_DETAIL',
  COUNCIL = 'COUNCIL',
  BOARD_STUDIO = 'BOARD_STUDIO',
  CATALOG = 'CATALOG',
  DOCUMENTS = 'DOCUMENTS',
  SETTINGS = 'SETTINGS',
  AGENCY_BUILDER = 'AGENCY_BUILDER',
  PROPOSALS = 'PROPOSALS',
  FINANCIALS = 'FINANCIALS',
  SALES_PIPELINE = 'SALES_PIPELINE',
  GUIDED_JOURNEY = 'GUIDED_JOURNEY'
}

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export type JourneyGoal = 'ai_agency' | 'automation_agency' | 'web_design_agency' | 'ads_agency' | 'youtube_systems';

export type AgencyDocumentType =
  | 'RevenuePlan'
  | 'Offer'
  | 'SalesPath'
  | 'OutboundPlaybook'
  | 'YouTubeSystem'
  | 'IncomeStack'
  | 'PassiveIncome';
export type AgencyDocumentStatus = 'Draft' | 'Final';

export interface AgencyDocument {
  id: string;
  type: AgencyDocumentType;
  name: string;
  status: AgencyDocumentStatus;
  content: string;
  createdAt: string;
}

export type CurrencyCode = 'USD' | 'TRY' | 'EUR' | 'GBP';

export interface RevenueGoal {
  currency: CurrencyCode;
  targetMrr: number;
  avgRetainer: number;
  closeRatePct: number;
  bookingRatePct: number;
  updatedAt: string;
}

export interface AgencyState {
  goal: JourneyGoal;
  completedTaskIds: string[];
  documents: AgencyDocument[];
  revenueGoal: RevenueGoal;
  updatedAt: string;
}

export type AppLanguage = 'tr' | 'en';

export type MarketSource = 'mock' | 'apify' | 'ai' | 'web';

export type MarketInternetTrendProvider = 'HackerNews' | 'GitHubTrending';

export interface MarketInternetTrend {
  id: string;
  provider: MarketInternetTrendProvider;
  title: string;
  url?: string;
  description?: string;
  score?: number;
  source: MarketSource;
  raw?: any;
}

export interface MarketTrendVideo {
  id: string;
  title: string;
  url?: string;
  channel?: string;
  views?: number;
  publishedAt?: string;
  source: MarketSource;
  raw?: any;
}

export interface MarketVideoIdea {
  id: string;
  title: string;
  hook: string;
  angle: string;
  outline: string[];
  cta: string;
  keywords: string[];
}

export interface MarketOpportunity {
  id: string;
  niche: string;
  idealCustomer: string;
  painPoints: string[];
  offer: string;
  suggestedCatalogQuery: string;
  suggestedTags?: string[];
  pricingHint?: string;
  pricing?: { currency: string; setup?: number; monthly?: number; firstMonth?: number; notes?: string };
  source: MarketSource;
}

export interface MarketLeadCandidate {
  id: string;
  name: string;
  category?: string;
  address?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  mapsUrl?: string;
  source: MarketSource;
  raw?: any;
}

export interface MarketLeadPitch {
  subject: string;
  email: string;
  dm: string;
  suggestedOffer: string;
  suggestedAutomations: string[];
  nextSteps: string[];
  source: MarketSource;
}

export interface MarketRadarState {
  country: string;
  city: string;
  niche: string;
  updatedAt: string;
  opportunities: MarketOpportunity[];
  youtubeTrends: MarketTrendVideo[];
  youtubeIdeas: MarketVideoIdea[];
  internetTrends: MarketInternetTrend[];
  leads: MarketLeadCandidate[];
}

export type AssistantRole = 'user' | 'assistant' | 'system';

export interface AssistantToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  toolCall?: AssistantToolCall;
  createdAt: string;
}

export interface AssistantPreferences {
  language?: AppLanguage;
  goal?: JourneyGoal;
  country?: string;
  city?: string;
  niche?: string;
  incomeFocus?: Array<'ai_agency' | 'youtube' | 'passive'>;
}

export interface AssistantState {
  id: string;
  preferences: AssistantPreferences;
  messages: AssistantMessage[];
  updatedAt: string;
}

export interface PassiveIdea {
  id: string;
  title: { en: string; tr: string };
  description: { en: string; tr: string };
  exampleOffer: { en: string; tr: string };
  defaultCatalogQuery: string;
  requiredTags?: string[];
  assets: Array<{ en: string; tr: string }>;
}

// ============================================
// AGENCY BUILDER TYPES
// ============================================

// Language Support
export type LanguageCode = 'en' | 'tr' | 'es' | 'pt' | 'de' | 'fr' | 'ar' | 'ja' | 'zh' | 'ko';
export type LocalizedString = Partial<Record<LanguageCode, string>> & { en: string };

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  currency: CurrencyCode;
  dateLocale: string;
}

// Sector & Niche Types
export type MarketSize = 'small' | 'medium' | 'large';
export type CompetitionLevel = 'low' | 'medium' | 'high';

export interface AgencyBuilderSector {
  id: string;
  name: LocalizedString;
  icon: string;
  description: LocalizedString;
  subNiches: AgencyBuilderNiche[];
  marketSize: MarketSize;
  competitionLevel: CompetitionLevel;
  avgProjectValue: { min: number; max: number; currency: CurrencyCode };
  growthTrend: 'declining' | 'stable' | 'growing' | 'booming';
}

export interface AgencyBuilderNiche {
  id: string;
  sectorId: string;
  name: LocalizedString;
  description: LocalizedString;
  keywords: string[];
  requiredWorkflowTags: string[];
  avgProjectValue: { min: number; max: number; currency: CurrencyCode };
  marketSize: MarketSize;
  competitionLevel: CompetitionLevel;
  idealCustomer: LocalizedString;
  painPoints: LocalizedString[];
}

// Service Package Types
export type ServiceTier = 'starter' | 'standard' | 'premium';

export interface ServicePackage {
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
  recommendedFor: LocalizedString;
}

// Workflow Recommendation
export type WorkflowPriority = 'required' | 'recommended' | 'optional';

export interface SolutionWorkflowRecommendation {
  workflowId: string;
  workflowName: string;
  priority: WorkflowPriority;
  reason: LocalizedString;
  installOrder: number;
  estimatedSetupTime: string;
  requiredCredentials: string[];
}

// Pricing Intelligence
export interface MarketPricingRange {
  low: number;
  mid: number;
  high: number;
  currency: CurrencyCode;
  confidence: number;
  sampleSize: number;
  region: string;
}

export type ServicePricingType = 'setup' | 'retainer' | 'project' | 'hourly';
export type PricingComplexity = 'Low' | 'Medium' | 'High' | 'Enterprise';

export interface IndustryPricingData {
  industry: string;
  region: string;
  serviceType: ServicePricingType;
  complexity: PricingComplexity;
  range: MarketPricingRange;
  lastUpdated: string;
}

export type MarketPositioning = 'Budget' | 'Mid-Market' | 'Premium' | 'Enterprise';

export interface CompetitorPricing {
  id: string;
  name: string;
  website?: string;
  region: string;
  services: Array<{
    name: string;
    priceRange: MarketPricingRange;
    features: string[];
  }>;
  positioning: MarketPositioning;
  notes?: string;
}

export interface PricingScenario {
  id: string;
  name: LocalizedString;
  setupFee: number;
  monthlyFee: number;
  margin: number;
  marketPosition: number;
  pros: LocalizedString[];
  cons: LocalizedString[];
}

export interface PricingStrategy {
  recommendedSetup: number;
  recommendedMonthly: number;
  currency: CurrencyCode;
  scenarios: PricingScenario[];
  marketPosition: {
    percentile: number;
    positioning: MarketPositioning;
    competitorComparison: LocalizedString;
  };
  reasoning: LocalizedString;
  confidence: number;
}

// Target Customer
export interface TargetCustomerProfile {
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

// Sales & Communication
export type CommunicationType = 'cold_email' | 'linkedin_message' | 'phone_script' | 'elevator_pitch' | 'follow_up' | 'proposal_intro';

export interface CommunicationTemplate {
  id: string;
  type: CommunicationType;
  name: LocalizedString;
  subject?: LocalizedString;
  body: LocalizedString;
  variables: string[];
  tone: 'formal' | 'friendly' | 'professional' | 'casual';
  useCase: LocalizedString;
}

export interface SalesPitch {
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

// Competitor Analysis
export interface CompetitorInsight {
  id: string;
  name: string;
  website?: string;
  positioning: MarketPositioning;
  strengths: LocalizedString[];
  weaknesses: LocalizedString[];
  pricing: MarketPricingRange;
  services: string[];
  differentiators: LocalizedString[];
}

// Complete Agency Solution
export interface AgencySolution {
  id: string;
  sectorId: string;
  nicheId?: string;
  name: LocalizedString;
  description: LocalizedString;

  // Service Packages (3 tiers)
  servicePackages: ServicePackage[];

  // Workflow Recommendations
  recommendedWorkflows: SolutionWorkflowRecommendation[];

  // Pricing Strategy
  pricingStrategy: PricingStrategy;

  // Target Customer Profile
  targetCustomer: TargetCustomerProfile;

  // Sales Materials
  salesPitchTemplates: SalesPitch[];

  // Competitor Analysis
  competitorAnalysis: CompetitorInsight[];

  // Communication Templates
  communicationTemplates: CommunicationTemplate[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  confidence: number;
}

// Proposal Types
export type ProposalStatus = 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Rejected' | 'Expired';

export interface ProposalPricingTier {
  id: string;
  tier: ServiceTier;
  name: string;
  description: string;
  features: string[];
  setupFee: number;
  monthlyFee: number;
  currency: CurrencyCode;
  isRecommended?: boolean;
}

export interface ProposalScope {
  objectives: string[];
  deliverables: string[];
  timeline: string;
  assumptions: string[];
  exclusions: string[];
}

export interface ProposalTerms {
  paymentTerms: string;
  validityPeriod: number;
  cancellationPolicy: string;
  revisionPolicy: string;
  confidentiality: boolean;
}

export interface Proposal {
  id: string;
  projectId?: string;
  clientName: string;
  clientEmail?: string;
  clientCompany?: string;

  title: string;
  summary: string;

  currency: CurrencyCode;
  tiers: ProposalPricingTier[];
  selectedTierId?: string;

  scope: ProposalScope;
  terms: ProposalTerms;

  validUntil: string;
  status: ProposalStatus;

  viewedAt?: string;
  respondedAt?: string;

  externalRef?: {
    documensoId?: string;
    documensoUrl?: string;
  };

  createdAt: string;
  updatedAt: string;
}

// Financial Types
export type TransactionType = 'Invoice' | 'Payment' | 'Expense' | 'Refund';
export type TransactionStatus = 'Pending' | 'Completed' | 'Failed' | 'Cancelled';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  status: TransactionStatus;
  description: string;
  projectId?: string;
  clientName?: string;
  invoiceRef?: string;
  date: string;
  createdAt: string;
}

export interface FinancialMetrics {
  currentMrr: number;
  projectedMrr: number;
  avgClientValue: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  currency: CurrencyCode;
  period: 'month' | 'quarter' | 'year';
}

export interface InvoiceSummary {
  draft: number;
  sent: number;
  overdue: number;
  paid: number;
  totalOutstanding: number;
  currency: CurrencyCode;
}

export interface FinancialDashboardState {
  metrics: FinancialMetrics;
  invoices: InvoiceSummary;
  pipelineValue: number;
  proposalsSent: number;
  proposalsWon: number;
  recentTransactions: FinancialTransaction[];
  updatedAt: string;
}

// Agency Builder State
export interface AgencyBuilderState {
  currentStep: 'sector' | 'niche' | 'solution' | 'customize' | 'deploy';
  selectedSectorId?: string;
  selectedNicheId?: string;
  targetRegion?: string;
  solution?: AgencySolution;
  customizations?: {
    packageTiers?: Partial<ServicePackage>[];
    workflows?: string[];
    pricing?: Partial<PricingStrategy>;
  };
  deploymentStatus?: {
    workflowsInstalled: number;
    workflowsTotal: number;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    message?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Extend View enum for Agency Builder
export enum AgencyBuilderView {
  SECTOR_EXPLORER = 'SECTOR_EXPLORER',
  NICHE_DISCOVERY = 'NICHE_DISCOVERY',
  SOLUTION_PREVIEW = 'SOLUTION_PREVIEW',
  SOLUTION_CUSTOMIZE = 'SOLUTION_CUSTOMIZE',
  SOLUTION_DEPLOY = 'SOLUTION_DEPLOY'
}
