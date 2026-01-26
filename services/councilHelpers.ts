/**
 * Council Helper Functions
 *
 * Provides reusable utilities for integrating AI Council reviews
 * into various components throughout the application.
 *
 * Uses the existing runCouncilSession API - no new external integrations.
 */

import type {
  AppLanguage,
  CouncilGate,
  CouncilPricing,
  CouncilSession,
} from '../types';
import { runCouncilSession } from './api';

// ============================================
// TYPES
// ============================================

export interface CouncilReviewRequest {
  /** Context data to pass to the council for review */
  context: Record<string, unknown>;
  /** Type of council gate to use */
  gateType: CouncilGate;
  /** Topic/subject for the council review */
  topic: string;
  /** Language for the council response */
  language: AppLanguage;
  /** Optional project ID to associate with the session */
  projectId?: string;
}

export interface CouncilReviewResult {
  /** The council's decision */
  decision: 'Approved' | 'Rejected' | 'Needs Revision';
  /** Average confidence score from council members (0-100) */
  confidence: number;
  /** Brief summary of the council's findings */
  summary: string;
  /** List of recommended next steps */
  recommendations: string[];
  /** Pricing recommendations if Strategic gate was used */
  pricing?: CouncilPricing;
  /** Full council session for detailed access */
  session: CouncilSession;
}

export type CouncilDecision = CouncilSession['decision'];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract a simplified review result from a council session
 */
export function extractCouncilReview(session: CouncilSession): CouncilReviewResult {
  const avgScore =
    session.opinions.length > 0
      ? session.opinions.reduce((sum, op) => sum + op.score, 0) / session.opinions.length
      : 0;

  return {
    decision: session.decision,
    confidence: Math.round(avgScore),
    summary: session.boardSummary || session.synthesis.slice(0, 300),
    recommendations: session.nextSteps || [],
    pricing: session.pricing,
    session,
  };
}

/**
 * Run a quick council review with simplified interface
 *
 * @example
 * ```ts
 * const result = await quickCouncilReview({
 *   context: { clientName: 'Acme Inc', budget: '$5000' },
 *   gateType: 'Strategic',
 *   topic: 'Proposal Pricing Review',
 *   language: 'en'
 * });
 *
 * if (result.decision === 'Approved') {
 *   proceedWithProposal();
 * }
 * ```
 */
export async function quickCouncilReview(
  request: CouncilReviewRequest
): Promise<CouncilReviewResult> {
  const session = await runCouncilSession({
    projectId: request.projectId || `review-${Date.now()}`,
    gateType: request.gateType,
    topic: request.topic,
    context: request.context,
    language: request.language,
  });

  return extractCouncilReview(session);
}

/**
 * Check if a council decision passes a confidence threshold
 */
export function isCouncilApproved(
  result: CouncilReviewResult,
  minConfidence: number = 70
): boolean {
  return result.decision === 'Approved' && result.confidence >= minConfidence;
}

/**
 * Get the appropriate gate type for a given use case
 */
export function getGateTypeForContext(
  context: 'proposal' | 'lead' | 'deployment' | 'risk' | 'launch' | 'review'
): CouncilGate {
  switch (context) {
    case 'proposal':
    case 'lead':
      return 'Strategic';
    case 'risk':
      return 'Risk';
    case 'launch':
    case 'deployment':
      return 'Launch';
    case 'review':
      return 'Post-Mortem';
    default:
      return 'Strategic';
  }
}

/**
 * Format council decision for display with localization
 */
export function formatCouncilDecision(
  decision: CouncilDecision,
  language: AppLanguage
): { label: string; icon: string; color: string } {
  const decisions: Record<CouncilDecision, { en: string; tr: string; icon: string; color: string }> = {
    Approved: {
      en: 'Approved',
      tr: 'Onaylandı',
      icon: '✓',
      color: 'green',
    },
    Rejected: {
      en: 'Rejected',
      tr: 'Reddedildi',
      icon: '✗',
      color: 'red',
    },
    'Needs Revision': {
      en: 'Needs Revision',
      tr: 'Revizyon Gerekli',
      icon: '⚠',
      color: 'yellow',
    },
  };

  const d = decisions[decision];
  return {
    label: language === 'tr' ? d.tr : d.en,
    icon: d.icon,
    color: d.color,
  };
}

/**
 * Build a council topic string for common use cases
 */
export function buildCouncilTopic(
  type: 'proposal' | 'lead' | 'solution' | 'project',
  name: string,
  language: AppLanguage
): string {
  const templates: Record<string, { en: string; tr: string }> = {
    proposal: {
      en: `Proposal Review: ${name}`,
      tr: `Teklif İncelemesi: ${name}`,
    },
    lead: {
      en: `Lead Qualification: ${name}`,
      tr: `Lead Değerlendirmesi: ${name}`,
    },
    solution: {
      en: `Solution Validation: ${name}`,
      tr: `Çözüm Doğrulaması: ${name}`,
    },
    project: {
      en: `Project Risk Assessment: ${name}`,
      tr: `Proje Risk Değerlendirmesi: ${name}`,
    },
  };

  const t = templates[type];
  return language === 'tr' ? t.tr : t.en;
}

/**
 * Extract risk level from council synthesis text
 */
export function extractRiskLevel(synthesis: string): 'Low' | 'Medium' | 'High' {
  const lowerSynthesis = synthesis.toLowerCase();

  // Check for explicit risk mentions
  if (lowerSynthesis.includes('high risk') || lowerSynthesis.includes('yüksek risk')) {
    return 'High';
  }
  if (lowerSynthesis.includes('low risk') || lowerSynthesis.includes('düşük risk')) {
    return 'Low';
  }
  if (lowerSynthesis.includes('medium risk') || lowerSynthesis.includes('orta risk')) {
    return 'Medium';
  }

  // Fallback to keyword analysis
  const highRiskKeywords = ['critical', 'severe', 'urgent', 'dangerous', 'kritik', 'ciddi'];
  const lowRiskKeywords = ['safe', 'minimal', 'negligible', 'straightforward', 'güvenli', 'basit'];

  if (highRiskKeywords.some((k) => lowerSynthesis.includes(k))) {
    return 'High';
  }
  if (lowRiskKeywords.some((k) => lowerSynthesis.includes(k))) {
    return 'Low';
  }

  return 'Medium';
}

/**
 * Get council member labels for display
 */
export function getCouncilMemberLabels(language: AppLanguage): Array<{
  id: string;
  title: string;
  icon: string;
  focus: string;
}> {
  return [
    {
      id: 'strategy',
      title: language === 'tr' ? 'Strateji' : 'Strategy',
      icon: '📈',
      focus: language === 'tr' ? 'Teklif, konumlandırma, fiyat' : 'Offer, positioning, pricing',
    },
    {
      id: 'risk',
      title: language === 'tr' ? 'Risk' : 'Risk',
      icon: '⚖️',
      focus: language === 'tr' ? 'Güvenlik, gizlilik, gerçekçilik' : 'Security, privacy, realism',
    },
    {
      id: 'ops',
      title: language === 'tr' ? 'Operasyon' : 'Ops',
      icon: '🛠️',
      focus: language === 'tr' ? 'Teslimat, checklist, izleme' : 'Delivery, checklist, monitoring',
    },
    {
      id: 'growth',
      title: language === 'tr' ? 'Büyüme' : 'Growth',
      icon: '🎯',
      focus: language === 'tr' ? 'Outbound, mesajlar, dağıtım' : 'Outbound, messaging, distribution',
    },
    {
      id: 'chair',
      title: language === 'tr' ? 'Başkan' : 'Chair',
      icon: '🏛️',
      focus: language === 'tr' ? 'Sentez + karar' : 'Synthesis + decision',
    },
  ];
}

// ============================================
// CONTEXT BUILDERS
// ============================================

/**
 * Build context for proposal review
 */
export function buildProposalContext(proposal: {
  clientName: string;
  title: string;
  tiers: Array<{ name: string; setupFee: number; monthlyFee: number }>;
  scope?: { objectives?: string[]; deliverables?: string[] };
  currency?: string;
}): Record<string, unknown> {
  return {
    clientName: proposal.clientName,
    proposalTitle: proposal.title,
    pricingTiers: proposal.tiers.map((t) => ({
      name: t.name,
      setup: t.setupFee,
      monthly: t.monthlyFee,
    })),
    objectives: proposal.scope?.objectives || [],
    deliverables: proposal.scope?.deliverables || [],
    currency: proposal.currency || 'USD',
  };
}

/**
 * Build context for lead qualification
 */
export function buildLeadContext(lead: {
  name: string;
  category?: string;
  stage: string;
  notes?: string;
  website?: string;
  city?: string;
  country?: string;
}): Record<string, unknown> {
  return {
    leadName: lead.name,
    category: lead.category || 'Unknown',
    currentStage: lead.stage,
    notes: lead.notes || '',
    website: lead.website || '',
    location: [lead.city, lead.country].filter(Boolean).join(', '),
  };
}

/**
 * Build context for agency solution validation
 */
export function buildSolutionContext(solution: {
  name: string;
  sectorId: string;
  nicheId?: string;
  servicePackages: Array<{ name: string; setupFee: number; monthlyFee: number }>;
  targetCustomer?: { description?: string };
  pricingStrategy?: { recommendedSetup?: number; recommendedMonthly?: number };
}): Record<string, unknown> {
  return {
    solutionName: solution.name,
    sector: solution.sectorId,
    niche: solution.nicheId || '',
    packages: solution.servicePackages.map((p) => ({
      name: p.name,
      setup: p.setupFee,
      monthly: p.monthlyFee,
    })),
    targetCustomer: solution.targetCustomer?.description || '',
    recommendedPricing: {
      setup: solution.pricingStrategy?.recommendedSetup || 0,
      monthly: solution.pricingStrategy?.recommendedMonthly || 0,
    },
  };
}

/**
 * Build context for project risk assessment
 */
export function buildProjectContext(project: {
  clientName: string;
  industry?: string;
  goals: string[];
  budget: string;
  riskLevel?: string;
}): Record<string, unknown> {
  return {
    clientName: project.clientName,
    industry: project.industry || 'Not specified',
    goals: project.goals,
    budget: project.budget,
    currentRiskLevel: project.riskLevel || 'Medium',
  };
}
