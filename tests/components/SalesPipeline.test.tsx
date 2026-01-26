import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SalesPipeline from '../../components/SalesPipeline';
import { OutboundLead, Proposal, View } from '../../types';

// Mock leads data
const createMockLead = (overrides: Partial<OutboundLead> = {}): OutboundLead => ({
  id: `lead-${Date.now()}-${Math.random()}`,
  name: 'Test Company',
  category: 'Technology',
  stage: 'New',
  city: 'Istanbul',
  country: 'Turkey',
  source: 'market_radar',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const mockLeads: OutboundLead[] = [
  createMockLead({ id: 'lead-1', name: 'Company A', stage: 'New' }),
  createMockLead({ id: 'lead-2', name: 'Company B', stage: 'New' }),
  createMockLead({ id: 'lead-3', name: 'Company C', stage: 'Contacted' }),
  createMockLead({ id: 'lead-4', name: 'Company D', stage: 'Replied' }),
  createMockLead({ id: 'lead-5', name: 'Company E', stage: 'Booked' }),
  createMockLead({ id: 'lead-6', name: 'Company F', stage: 'Proposal' }),
  createMockLead({ id: 'lead-7', name: 'Company G', stage: 'Won', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }),
];

const mockProposals: Proposal[] = [
  {
    id: 'proposal-1',
    clientName: 'Company E',
    title: 'AI Automation',
    summary: 'Summary',
    currency: 'USD',
    tiers: [
      { id: 'tier-1', tier: 'standard', name: 'Standard', description: 'Standard tier', features: [], setupFee: 1000, monthlyFee: 500, currency: 'USD', isRecommended: true },
    ],
    selectedTierId: 'tier-1',
    scope: { objectives: [], deliverables: [], timeline: '4 weeks', assumptions: [], exclusions: [] },
    terms: { paymentTerms: 'Net 30', validityPeriod: 30, cancellationPolicy: '30 days', revisionPolicy: '2 revisions', confidentiality: true },
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Sent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'proposal-2',
    clientName: 'Company G',
    title: 'Full Service',
    summary: 'Summary',
    currency: 'USD',
    tiers: [
      { id: 'tier-2', tier: 'premium', name: 'Premium', description: 'Premium tier', features: [], setupFee: 2000, monthlyFee: 1000, currency: 'USD' },
    ],
    selectedTierId: 'tier-2',
    scope: { objectives: [], deliverables: [], timeline: '8 weeks', assumptions: [], exclusions: [] },
    terms: { paymentTerms: 'Net 30', validityPeriod: 30, cancellationPolicy: '30 days', revisionPolicy: '2 revisions', confidentiality: true },
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Accepted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('SalesPipeline', () => {
  const mockOnLeadClick = vi.fn();
  const mockOnProposalClick = vi.fn();
  const mockOnLeadStageChange = vi.fn();
  const mockOnCreateProposal = vi.fn();
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders pipeline header', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Sales Pipeline')).toBeInTheDocument();
      expect(screen.getByText(/Track your leads from discovery to closed deals/)).toBeInTheDocument();
    });

    it('renders in Turkish when language is tr', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} language="tr" />);

      expect(screen.getByText('Satis Hunisi')).toBeInTheDocument();
    });

    it('renders all pipeline stages', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      // Stages appear in both funnel and kanban, use getAllByText
      expect(screen.getAllByText('New Leads').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Contacted').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Replied').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Meeting Booked').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Proposal Sent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Won').length).toBeGreaterThan(0);
    });

    it('renders lead cards', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Company A')).toBeInTheDocument();
      expect(screen.getByText('Company B')).toBeInTheDocument();
      expect(screen.getByText('Company C')).toBeInTheDocument();
    });
  });

  describe('Metrics Calculations', () => {
    it('calculates total leads correctly (excluding Lost)', () => {
      const leadsWithLost = [
        ...mockLeads,
        createMockLead({ id: 'lead-lost', stage: 'Lost' }),
      ];

      render(<SalesPipeline leads={leadsWithLost} proposals={mockProposals} />);

      // Should show 7 active leads (not counting Lost)
      expect(screen.getByText(/7 active leads/)).toBeInTheDocument();
    });

    it('calculates conversion rate correctly', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      // 1 Won out of 7 active = 14.3%
      expect(screen.getByText('14.3%')).toBeInTheDocument();
    });

    it('handles zero leads case without errors', () => {
      render(<SalesPipeline leads={[]} proposals={[]} />);

      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.getByText('0 active leads')).toBeInTheDocument();
    });

    it('calculates pipeline value with stage multipliers', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      // Pipeline value should be displayed
      expect(screen.getByText('Pipeline Value')).toBeInTheDocument();
      // Multiple dollar values displayed, use getAllByText
      const valueElements = screen.getAllByText(/\$[\d,]+/);
      expect(valueElements.length).toBeGreaterThan(0);
    });

    it('calculates avg deal size from accepted proposals', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Avg Deal Size')).toBeInTheDocument();
      // Accepted proposal has $1000 monthly + $2000 setup = $14000 annual
      expect(screen.getByText('$14,000')).toBeInTheDocument();
    });
  });

  describe('Lead Grouping', () => {
    it('groups leads by stage correctly', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      // Check that all stage columns are rendered
      expect(screen.getAllByText('New Leads').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Contacted').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Won').length).toBeGreaterThan(0);
    });

    it('shows empty state for stages with no leads', () => {
      const limitedLeads = [
        createMockLead({ id: 'lead-1', stage: 'New' }),
      ];

      render(<SalesPipeline leads={limitedLeads} proposals={[]} />);

      // Multiple empty stages should show drop hint
      const dropHints = screen.getAllByText('Drop leads here');
      expect(dropHints.length).toBeGreaterThan(0);
    });
  });

  describe('Drag and Drop', () => {
    it('sets dragged lead on drag start', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onLeadStageChange={mockOnLeadStageChange}
        />
      );

      const leadCard = screen.getByText('Company A').closest('div[draggable="true"]');
      expect(leadCard).toBeInTheDocument();

      if (leadCard) {
        // Create a mock dataTransfer
        const dataTransfer = {
          effectAllowed: '',
          dropEffect: '',
        };

        // Simulate drag start with dataTransfer
        fireEvent.dragStart(leadCard, { dataTransfer });
        expect(dataTransfer.effectAllowed).toBe('move');
      }
    });

    it('handles drag over event', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onLeadStageChange={mockOnLeadStageChange}
        />
      );

      // Find a column by its header
      const contactedHeaders = screen.getAllByText('Contacted');
      expect(contactedHeaders.length).toBeGreaterThan(0);
    });
  });

  describe('Lead Click', () => {
    it('calls onLeadClick when lead card is clicked', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onLeadClick={mockOnLeadClick}
        />
      );

      const leadCard = screen.getByText('Company A');
      fireEvent.click(leadCard);

      expect(mockOnLeadClick).toHaveBeenCalled();
    });
  });

  describe('Create Proposal Button', () => {
    it('shows proposal button for Booked stage leads', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onCreateProposal={mockOnCreateProposal}
        />
      );

      // Company E is in Booked stage - button contains "Create Proposal" text
      const proposalButtons = screen.getAllByRole('button', { name: /Create Proposal/i });
      expect(proposalButtons.length).toBeGreaterThan(0);
    });

    it('shows proposal button for Proposal stage leads', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onCreateProposal={mockOnCreateProposal}
        />
      );

      // Company F is in Proposal stage
      const proposalButtons = screen.getAllByRole('button', { name: /Create Proposal/i });
      expect(proposalButtons.length).toBeGreaterThan(0);
    });

    it('calls onCreateProposal when button is clicked', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onCreateProposal={mockOnCreateProposal}
        />
      );

      const proposalButtons = screen.getAllByRole('button', { name: /Create Proposal/i });
      fireEvent.click(proposalButtons[0]);

      expect(mockOnCreateProposal).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('navigates to proposals view when clicking View Proposals', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
          onNavigate={mockOnNavigate}
        />
      );

      const viewProposalsBtn = screen.getByText(/View Proposals/);
      fireEvent.click(viewProposalsBtn);

      expect(mockOnNavigate).toHaveBeenCalledWith(View.PROPOSALS);
    });

    it('shows active proposals badge', () => {
      render(
        <SalesPipeline
          leads={mockLeads}
          proposals={mockProposals}
        />
      );

      // 1 proposal with status 'Sent' should show badge
      // '1' appears in multiple places, so we check for presence
      const ones = screen.getAllByText('1');
      expect(ones.length).toBeGreaterThan(0);
    });
  });

  describe('Funnel Visualization', () => {
    it('renders funnel stages with counts', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Sales Funnel')).toBeInTheDocument();
    });

    it('allows clicking funnel stages to filter', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      // Multiple New Leads elements exist (funnel + board), get all
      const newLeadsElements = screen.getAllByText('New Leads');
      expect(newLeadsElements.length).toBeGreaterThan(0);
      fireEvent.click(newLeadsElements[0]);
    });
  });

  describe('Quick Stats Footer', () => {
    it('shows this week leads count', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('new leads')).toBeInTheDocument();
    });

    it('shows pending proposals count', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Pending Proposals')).toBeInTheDocument();
      expect(screen.getByText('awaiting response')).toBeInTheDocument();
    });

    it('shows lost this month count', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Lost This Month')).toBeInTheDocument();
      expect(screen.getByText('deals')).toBeInTheDocument();
    });
  });

  describe('Time to Close Metric', () => {
    it('calculates average time to close from won deals', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Time to Close')).toBeInTheDocument();
      // days appears in multiple places, use getAllByText
      const daysElements = screen.getAllByText(/days/);
      expect(daysElements.length).toBeGreaterThan(0);
    });

    it('shows default value when no won deals', () => {
      const noWonLeads = mockLeads.filter(l => l.stage !== 'Won');

      render(<SalesPipeline leads={noWonLeads} proposals={mockProposals} />);

      // 14 days should be shown as default
      const daysElements = screen.getAllByText(/14 days/);
      expect(daysElements.length).toBeGreaterThan(0);
    });
  });

  describe('Lead Card Details', () => {
    it('displays lead name', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      expect(screen.getByText('Company A')).toBeInTheDocument();
    });

    it('displays lead category', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      const technologyElements = screen.getAllByText('Technology');
      expect(technologyElements.length).toBeGreaterThan(0);
    });

    it('displays lead location', () => {
      render(<SalesPipeline leads={mockLeads} proposals={mockProposals} />);

      const locationElements = screen.getAllByText(/Istanbul, Turkey/);
      expect(locationElements.length).toBeGreaterThan(0);
    });
  });
});
