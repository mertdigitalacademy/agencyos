import { describe, it, expect, vi } from 'vitest';
import {
  extractCouncilReview,
  isCouncilApproved,
  getGateTypeForContext,
  formatCouncilDecision,
  buildCouncilTopic,
  extractRiskLevel,
  getCouncilMemberLabels,
  buildProposalContext,
  buildLeadContext,
  buildSolutionContext,
  buildProjectContext,
} from '../../services/councilHelpers';
import type { CouncilSession } from '../../types';

// Mock council session for testing
const createMockSession = (overrides: Partial<CouncilSession> = {}): CouncilSession => ({
  id: 'session-1',
  projectId: 'project-1',
  gateType: 'Strategic',
  topic: 'Test Review',
  opinions: [
    { persona: 'Strategy', role: 'Advisor', opinion: 'Good approach.', score: 85 },
    { persona: 'Risk', role: 'Analyst', opinion: 'Low risk.', score: 80 },
    { persona: 'Ops', role: 'Manager', opinion: 'Feasible.', score: 75 },
  ],
  synthesis: 'The council recommends approval.',
  decision: 'Approved',
  boardSummary: 'Well-structured proposal.',
  nextSteps: ['Step 1', 'Step 2'],
  pricing: {
    currency: 'USD',
    lineItems: [{ label: 'Setup', amount: 1000, cadence: 'One-Time' }],
    totalOneTime: 1000,
    totalMonthly: 500,
    totalFirstMonth: 1500,
  },
  ...overrides,
});

describe('extractCouncilReview', () => {
  it('extracts decision from session', () => {
    const session = createMockSession();
    const result = extractCouncilReview(session);

    expect(result.decision).toBe('Approved');
  });

  it('calculates average confidence from opinions', () => {
    const session = createMockSession();
    const result = extractCouncilReview(session);

    // (85 + 80 + 75) / 3 = 80
    expect(result.confidence).toBe(80);
  });

  it('uses boardSummary for summary when available', () => {
    const session = createMockSession({ boardSummary: 'Custom summary' });
    const result = extractCouncilReview(session);

    expect(result.summary).toBe('Custom summary');
  });

  it('falls back to synthesis when boardSummary is empty', () => {
    const session = createMockSession({ boardSummary: undefined });
    const result = extractCouncilReview(session);

    expect(result.summary).toContain('council recommends');
  });

  it('extracts recommendations from nextSteps', () => {
    const session = createMockSession({ nextSteps: ['Do A', 'Do B'] });
    const result = extractCouncilReview(session);

    expect(result.recommendations).toEqual(['Do A', 'Do B']);
  });

  it('extracts pricing when available', () => {
    const session = createMockSession();
    const result = extractCouncilReview(session);

    expect(result.pricing).toBeDefined();
    expect(result.pricing?.currency).toBe('USD');
  });

  it('handles empty opinions array', () => {
    const session = createMockSession({ opinions: [] });
    const result = extractCouncilReview(session);

    expect(result.confidence).toBe(0);
  });

  it('includes full session in result', () => {
    const session = createMockSession();
    const result = extractCouncilReview(session);

    expect(result.session).toBe(session);
  });
});

describe('isCouncilApproved', () => {
  it('returns true for Approved with high confidence', () => {
    const result = {
      decision: 'Approved' as const,
      confidence: 85,
      summary: '',
      recommendations: [],
      session: createMockSession(),
    };

    expect(isCouncilApproved(result)).toBe(true);
  });

  it('returns false for Approved with low confidence', () => {
    const result = {
      decision: 'Approved' as const,
      confidence: 60,
      summary: '',
      recommendations: [],
      session: createMockSession(),
    };

    expect(isCouncilApproved(result)).toBe(false);
  });

  it('returns false for Rejected', () => {
    const result = {
      decision: 'Rejected' as const,
      confidence: 90,
      summary: '',
      recommendations: [],
      session: createMockSession({ decision: 'Rejected' }),
    };

    expect(isCouncilApproved(result)).toBe(false);
  });

  it('uses custom threshold', () => {
    const result = {
      decision: 'Approved' as const,
      confidence: 50,
      summary: '',
      recommendations: [],
      session: createMockSession(),
    };

    expect(isCouncilApproved(result, 40)).toBe(true);
    expect(isCouncilApproved(result, 60)).toBe(false);
  });
});

describe('getGateTypeForContext', () => {
  it('returns Strategic for proposal', () => {
    expect(getGateTypeForContext('proposal')).toBe('Strategic');
  });

  it('returns Strategic for lead', () => {
    expect(getGateTypeForContext('lead')).toBe('Strategic');
  });

  it('returns Risk for risk', () => {
    expect(getGateTypeForContext('risk')).toBe('Risk');
  });

  it('returns Launch for deployment', () => {
    expect(getGateTypeForContext('deployment')).toBe('Launch');
  });

  it('returns Launch for launch', () => {
    expect(getGateTypeForContext('launch')).toBe('Launch');
  });

  it('returns Post-Mortem for review', () => {
    expect(getGateTypeForContext('review')).toBe('Post-Mortem');
  });
});

describe('formatCouncilDecision', () => {
  it('returns English labels for en language', () => {
    const result = formatCouncilDecision('Approved', 'en');

    expect(result.label).toBe('Approved');
    expect(result.icon).toBe('✓');
    expect(result.color).toBe('green');
  });

  it('returns Turkish labels for tr language', () => {
    const result = formatCouncilDecision('Approved', 'tr');

    expect(result.label).toBe('Onaylandı');
  });

  it('returns correct formatting for Rejected', () => {
    const result = formatCouncilDecision('Rejected', 'en');

    expect(result.label).toBe('Rejected');
    expect(result.icon).toBe('✗');
    expect(result.color).toBe('red');
  });

  it('returns correct formatting for Needs Revision', () => {
    const result = formatCouncilDecision('Needs Revision', 'en');

    expect(result.label).toBe('Needs Revision');
    expect(result.icon).toBe('⚠');
    expect(result.color).toBe('yellow');
  });
});

describe('buildCouncilTopic', () => {
  it('builds proposal topic in English', () => {
    const topic = buildCouncilTopic('proposal', 'Acme Corp', 'en');

    expect(topic).toBe('Proposal Review: Acme Corp');
  });

  it('builds proposal topic in Turkish', () => {
    const topic = buildCouncilTopic('proposal', 'Acme Corp', 'tr');

    expect(topic).toBe('Teklif İncelemesi: Acme Corp');
  });

  it('builds lead topic', () => {
    const topic = buildCouncilTopic('lead', 'Test Lead', 'en');

    expect(topic).toBe('Lead Qualification: Test Lead');
  });

  it('builds solution topic', () => {
    const topic = buildCouncilTopic('solution', 'Healthcare AI', 'en');

    expect(topic).toBe('Solution Validation: Healthcare AI');
  });

  it('builds project topic', () => {
    const topic = buildCouncilTopic('project', 'Big Project', 'en');

    expect(topic).toBe('Project Risk Assessment: Big Project');
  });
});

describe('extractRiskLevel', () => {
  it('extracts High risk from text', () => {
    expect(extractRiskLevel('This is a high risk project')).toBe('High');
    expect(extractRiskLevel('yüksek risk var')).toBe('High');
  });

  it('extracts Low risk from text', () => {
    expect(extractRiskLevel('This is a low risk project')).toBe('Low');
    expect(extractRiskLevel('düşük risk seviyesi')).toBe('Low');
  });

  it('extracts Medium risk from text', () => {
    expect(extractRiskLevel('This is a medium risk project')).toBe('Medium');
    expect(extractRiskLevel('orta risk var')).toBe('Medium');
  });

  it('detects high risk from keywords', () => {
    expect(extractRiskLevel('This is critical and urgent')).toBe('High');
    expect(extractRiskLevel('ciddi sorunlar var')).toBe('High');
  });

  it('detects low risk from keywords', () => {
    expect(extractRiskLevel('This is safe and straightforward')).toBe('Low');
    expect(extractRiskLevel('güvenli ve basit')).toBe('Low');
  });

  it('defaults to Medium when uncertain', () => {
    expect(extractRiskLevel('This is a normal project')).toBe('Medium');
  });
});

describe('getCouncilMemberLabels', () => {
  it('returns 5 council members', () => {
    const members = getCouncilMemberLabels('en');

    expect(members).toHaveLength(5);
  });

  it('includes Strategy member', () => {
    const members = getCouncilMemberLabels('en');
    const strategy = members.find((m) => m.id === 'strategy');

    expect(strategy).toBeDefined();
    expect(strategy?.title).toBe('Strategy');
    expect(strategy?.icon).toBe('📈');
  });

  it('returns Turkish labels when language is tr', () => {
    const members = getCouncilMemberLabels('tr');
    const strategy = members.find((m) => m.id === 'strategy');

    expect(strategy?.title).toBe('Strateji');
  });

  it('includes all required members', () => {
    const members = getCouncilMemberLabels('en');
    const ids = members.map((m) => m.id);

    expect(ids).toContain('strategy');
    expect(ids).toContain('risk');
    expect(ids).toContain('ops');
    expect(ids).toContain('growth');
    expect(ids).toContain('chair');
  });
});

describe('buildProposalContext', () => {
  it('builds context from proposal data', () => {
    const context = buildProposalContext({
      clientName: 'Acme Corp',
      title: 'AI Solution',
      tiers: [
        { name: 'Starter', setupFee: 500, monthlyFee: 200 },
        { name: 'Standard', setupFee: 1000, monthlyFee: 500 },
      ],
      scope: {
        objectives: ['Increase efficiency'],
        deliverables: ['Custom workflows'],
      },
      currency: 'USD',
    });

    expect(context.clientName).toBe('Acme Corp');
    expect(context.proposalTitle).toBe('AI Solution');
    expect(context.pricingTiers).toHaveLength(2);
    expect(context.objectives).toContain('Increase efficiency');
    expect(context.currency).toBe('USD');
  });

  it('handles missing optional fields', () => {
    const context = buildProposalContext({
      clientName: 'Acme',
      title: 'Test',
      tiers: [],
    });

    expect(context.objectives).toEqual([]);
    expect(context.deliverables).toEqual([]);
    expect(context.currency).toBe('USD');
  });
});

describe('buildLeadContext', () => {
  it('builds context from lead data', () => {
    const context = buildLeadContext({
      name: 'Test Company',
      category: 'Technology',
      stage: 'Contacted',
      notes: 'Good prospect',
      website: 'https://test.com',
      city: 'Istanbul',
      country: 'Turkey',
    });

    expect(context.leadName).toBe('Test Company');
    expect(context.category).toBe('Technology');
    expect(context.currentStage).toBe('Contacted');
    expect(context.location).toBe('Istanbul, Turkey');
  });

  it('handles missing optional fields', () => {
    const context = buildLeadContext({
      name: 'Test',
      stage: 'New',
    });

    expect(context.category).toBe('Unknown');
    expect(context.notes).toBe('');
    expect(context.location).toBe('');
  });
});

describe('buildSolutionContext', () => {
  it('builds context from solution data', () => {
    const context = buildSolutionContext({
      name: 'Healthcare AI',
      sectorId: 'healthcare',
      nicheId: 'clinics',
      servicePackages: [
        { name: 'Starter', setupFee: 500, monthlyFee: 200 },
      ],
      targetCustomer: { description: 'Small clinics' },
      pricingStrategy: { recommendedSetup: 1000, recommendedMonthly: 500 },
    });

    expect(context.solutionName).toBe('Healthcare AI');
    expect(context.sector).toBe('healthcare');
    expect(context.niche).toBe('clinics');
    expect(context.packages).toHaveLength(1);
    expect(context.targetCustomer).toBe('Small clinics');
  });
});

describe('buildProjectContext', () => {
  it('builds context from project brief', () => {
    const context = buildProjectContext({
      clientName: 'Acme Corp',
      industry: 'Technology',
      goals: ['Automate processes', 'Reduce costs'],
      budget: '$5000-10000',
      riskLevel: 'Medium',
    });

    expect(context.clientName).toBe('Acme Corp');
    expect(context.industry).toBe('Technology');
    expect(context.goals).toHaveLength(2);
    expect(context.budget).toBe('$5000-10000');
    expect(context.currentRiskLevel).toBe('Medium');
  });

  it('handles missing optional fields', () => {
    const context = buildProjectContext({
      clientName: 'Test',
      goals: [],
      budget: 'TBD',
    });

    expect(context.industry).toBe('Not specified');
    expect(context.currentRiskLevel).toBe('Medium');
  });
});
