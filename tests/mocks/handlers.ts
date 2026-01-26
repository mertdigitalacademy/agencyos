import { http, HttpResponse } from 'msw';

// Mock data for tests
const mockProposals = [
  {
    id: 'proposal-1',
    clientName: 'Acme Corp',
    title: 'AI Automation Solution',
    status: 'Sent',
    tiers: [
      { id: 'starter', tier: 'starter', name: 'Starter', setupFee: 500, monthlyFee: 200, currency: 'USD' },
      { id: 'standard', tier: 'standard', name: 'Standard', setupFee: 1000, monthlyFee: 500, currency: 'USD', isRecommended: true },
      { id: 'premium', tier: 'premium', name: 'Premium', setupFee: 2000, monthlyFee: 1000, currency: 'USD' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockLeads = [
  {
    id: 'lead-1',
    name: 'Test Company',
    category: 'Technology',
    stage: 'New',
    city: 'Istanbul',
    country: 'Turkey',
    source: 'market_radar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-2',
    name: 'Demo Business',
    category: 'Healthcare',
    stage: 'Contacted',
    city: 'Ankara',
    country: 'Turkey',
    source: 'manual',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockSolution = {
  id: 'solution-1',
  sectorId: 'healthcare',
  name: { en: 'Healthcare AI Agency', tr: 'Sağlık AI Ajansı' },
  description: { en: 'AI solutions for healthcare', tr: 'Sağlık için AI çözümleri' },
  servicePackages: [
    {
      id: 'pkg-1',
      tier: 'starter',
      name: { en: 'Starter', tr: 'Başlangıç' },
      setupFee: 500,
      monthlyFee: 200,
      currency: 'USD',
    },
  ],
  recommendedWorkflows: [
    { workflowId: 'wf-1', workflowName: 'Lead Capture', priority: 'required' },
    { workflowId: 'wf-2', workflowName: 'Email Automation', priority: 'recommended' },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  confidence: 85,
};

const mockCouncilSession = {
  id: 'council-session-1',
  projectId: 'test-project',
  gateType: 'Strategic' as const,
  topic: 'Test Council Review',
  opinions: [
    { persona: 'Strategy', role: 'Strategic Advisor', opinion: 'Good pricing strategy.', score: 85 },
    { persona: 'Risk', role: 'Risk Analyst', opinion: 'Low risk identified.', score: 80 },
    { persona: 'Ops', role: 'Operations', opinion: 'Deliverable timeline is realistic.', score: 75 },
  ],
  synthesis: 'The council recommends approval of this proposal with minor adjustments.',
  decision: 'Approved' as const,
  pricing: {
    currency: 'USD',
    lineItems: [
      { label: 'Setup Fee', amount: 1000, cadence: 'One-Time' as const },
      { label: 'Monthly Retainer', amount: 500, cadence: 'Monthly' as const },
    ],
    totalOneTime: 1000,
    totalMonthly: 500,
    totalFirstMonth: 1500,
  },
  nextSteps: ['Finalize contract', 'Schedule kickoff call', 'Send invoice'],
  boardSummary: 'Proposal is well-structured with competitive pricing.',
  createdAt: new Date().toISOString(),
};

// Helper function to simulate network delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const handlers = [
  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // Agency Builder API
  http.post('/api/agency-builder/generate-solution', async () => {
    await delay(100); // Simulate network delay
    return HttpResponse.json(mockSolution);
  }),

  http.post('/api/agency-builder/deploy', async () => {
    await delay(100);
    return HttpResponse.json({
      success: true,
      workflowsInstalled: 2,
      workflowsTotal: 2,
      message: 'Deployment successful',
    });
  }),

  // Proposals API
  http.get('/api/proposals', () => {
    return HttpResponse.json(mockProposals);
  }),

  http.get('/api/proposals/:id', ({ params }) => {
    const proposal = mockProposals.find(p => p.id === params.id);
    if (!proposal) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(proposal);
  }),

  http.post('/api/proposals', async ({ request }) => {
    await delay(100);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: `proposal-${Date.now()}`,
      ...body,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.post('/api/proposals/generate-content', async () => {
    await delay(100);
    return HttpResponse.json({
      summary: 'AI-generated proposal summary for your business needs.',
      scope: {
        objectives: ['Increase efficiency', 'Reduce costs'],
        deliverables: ['Custom AI workflows', 'Training documentation'],
        timeline: '4-6 weeks',
        assumptions: ['Client provides necessary data'],
        exclusions: ['Hardware procurement'],
      },
    });
  }),

  // Leads API
  http.get('/api/leads', () => {
    return HttpResponse.json(mockLeads);
  }),

  http.patch('/api/leads/:id/stage', async ({ params, request }) => {
    await delay(50);
    const { stage } = await request.json() as { stage: string };
    const lead = mockLeads.find(l => l.id === params.id);
    if (lead) {
      lead.stage = stage;
    }
    return HttpResponse.json({ success: true, lead });
  }),

  // Assistant API
  http.post('/api/assistant/chat', async ({ request }) => {
    await delay(100);
    const { message } = await request.json() as { message: string };
    return HttpResponse.json({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Response to: ${message}`,
      createdAt: new Date().toISOString(),
    });
  }),

  // AI content generation
  http.post('/api/ai/generate', async () => {
    await delay(100);
    return HttpResponse.json({
      content: 'AI generated content for your request.',
    });
  }),

  // Council API
  http.post('/api/council/run', async ({ request }) => {
    await delay(100);
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...mockCouncilSession,
      projectId: body.projectId || mockCouncilSession.projectId,
      gateType: body.gateType || mockCouncilSession.gateType,
      topic: body.topic || mockCouncilSession.topic,
    });
  }),

  http.get('/api/council/sessions', () => {
    return HttpResponse.json([mockCouncilSession]);
  }),

  http.post('/api/council/playground', async () => {
    await delay(100);
    return HttpResponse.json({
      id: 'playground-1',
      prompt: 'Test prompt',
      stage1: [{ model: 'gpt-4', content: 'Stage 1 response' }],
      stage2: [],
      labelToModel: {},
      aggregateRankings: [],
      chairmanModel: 'gpt-4',
      final: { model: 'gpt-4', content: 'Final synthesis response' },
      createdAt: new Date().toISOString(),
    });
  }),
];

// Export mock data for use in tests
export const mockData = {
  proposals: mockProposals,
  leads: mockLeads,
  solution: mockSolution,
  councilSession: mockCouncilSession,
};
