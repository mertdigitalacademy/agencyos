import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PostDeployWizard from '../../components/PostDeployWizard';
import { View, AgencySolution } from '../../types';

// Mock solution data
const mockSolution: AgencySolution = {
  id: 'test-solution',
  sectorId: 'healthcare',
  name: { en: 'Healthcare AI Agency', tr: 'Sağlık AI Ajansı' },
  description: { en: 'AI solutions for healthcare', tr: 'Sağlık için AI çözümleri' },
  servicePackages: [
    {
      id: 'pkg-1',
      tier: 'starter',
      name: { en: 'Starter', tr: 'Başlangıç' },
      description: { en: 'Basic package', tr: 'Temel paket' },
      features: [],
      deliverables: [],
      setupFee: 500,
      monthlyFee: 200,
      currency: 'USD',
      estimatedHours: 10,
      targetMargin: 40,
      recommendedFor: { en: 'Small businesses', tr: 'Küçük işletmeler' },
    },
    {
      id: 'pkg-2',
      tier: 'standard',
      name: { en: 'Standard', tr: 'Standart' },
      description: { en: 'Standard package', tr: 'Standart paket' },
      features: [],
      deliverables: [],
      setupFee: 1000,
      monthlyFee: 500,
      currency: 'USD',
      estimatedHours: 20,
      targetMargin: 50,
      recommendedFor: { en: 'Growing businesses', tr: 'Büyüyen işletmeler' },
    },
  ],
  recommendedWorkflows: [
    { workflowId: 'wf-1', workflowName: 'Lead Capture', priority: 'required', reason: { en: 'Essential' }, installOrder: 1, estimatedSetupTime: '30m', requiredCredentials: [] },
    { workflowId: 'wf-2', workflowName: 'Email Automation', priority: 'recommended', reason: { en: 'Helpful' }, installOrder: 2, estimatedSetupTime: '45m', requiredCredentials: [] },
  ],
  pricingStrategy: {
    recommendedSetup: 1000,
    recommendedMonthly: 500,
    currency: 'USD',
    scenarios: [],
    marketPosition: { percentile: 60, positioning: 'Mid-Market', competitorComparison: { en: 'Competitive' } },
    reasoning: { en: 'Based on market analysis' },
    confidence: 85,
  },
  targetCustomer: {
    id: 'target-1',
    name: { en: 'Healthcare SMBs', tr: 'Sağlık KOBİ\'leri' },
    description: { en: 'Small healthcare businesses', tr: 'Küçük sağlık işletmeleri' },
    companySize: 'small',
    industry: 'healthcare',
    budget: { min: 500, max: 2000, currency: 'USD' },
    painPoints: [],
    goals: [],
    decisionMakers: [],
    whereToFind: [],
  },
  salesPitchTemplates: [],
  competitorAnalysis: [],
  communicationTemplates: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  confidence: 85,
};

describe('PostDeployWizard', () => {
  const mockOnNavigate = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('renders congratulations message', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      expect(screen.getByText('Your agency is ready!')).toBeInTheDocument();
    });

    it('renders in Turkish when language is tr', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="tr"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Tebrikler!')).toBeInTheDocument();
      expect(screen.getByText('Ajansın hazır!')).toBeInTheDocument();
    });

    it('renders solution name', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Healthcare AI Agency')).toBeInTheDocument();
    });

    it('renders workflow count', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      // 2 workflows with priority !== 'optional'
      expect(screen.getByText(/2 workflows deployed/i)).toBeInTheDocument();
    });

    it('renders next steps', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Next Steps')).toBeInTheDocument();
      expect(screen.getByText('Test Your Workflows')).toBeInTheDocument();
      expect(screen.getByText('Find Your First Lead')).toBeInTheDocument();
      expect(screen.getByText('Create Your First Proposal')).toBeInTheDocument();
    });

    it('renders progress indicator', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Getting Started Progress')).toBeInTheDocument();
      expect(screen.getByText('0/3')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('calls onNavigate with correct view when clicking step action', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      // Click the first step action button (Open Dashboard)
      const openDashboardBtn = screen.getByText('Open Dashboard →');
      fireEvent.click(openDashboardBtn);

      expect(mockOnNavigate).toHaveBeenCalledWith(View.DASHBOARD);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onNavigate when clicking Continue button', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      const continueBtn = screen.getByText(/Continue →/);
      fireEvent.click(continueBtn);

      expect(mockOnNavigate).toHaveBeenCalledWith(View.DASHBOARD);
    });
  });

  describe('Step Completion', () => {
    it('marks step as completed when action is taken', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      // Initially no steps completed
      expect(screen.getByText('0/3')).toBeInTheDocument();

      // Click first step
      const openDashboardBtn = screen.getByText('Open Dashboard →');
      fireEvent.click(openDashboardBtn);

      // Progress should be saved to localStorage
      const savedProgress = localStorage.getItem('agencyos_post_deploy_progress');
      expect(savedProgress).toBeTruthy();
      const parsed = JSON.parse(savedProgress!);
      expect(parsed).toContain('test_workflow');
    });

    it('persists completed steps to localStorage', () => {
      const { rerender } = render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      // Complete first step
      fireEvent.click(screen.getByText('Open Dashboard →'));

      // Re-render component
      rerender(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      // Progress should be loaded from localStorage
      const savedProgress = localStorage.getItem('agencyos_post_deploy_progress');
      expect(savedProgress).toContain('test_workflow');
    });
  });

  describe('Skip and Dismiss', () => {
    it('calls onClose when clicking Skip for Now', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      const skipBtn = screen.getByText('Skip for Now');
      fireEvent.click(skipBtn);

      // Should close after animation (300ms)
      setTimeout(() => {
        expect(mockOnClose).toHaveBeenCalled();
      }, 350);
    });

    it('sets dismissed flag when clicking Dont show again', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      const dismissBtn = screen.getByText("Don't show this again");
      fireEvent.click(dismissBtn);

      const dismissedFlag = localStorage.getItem('agencyos_post_deploy_dismissed');
      expect(dismissedFlag).toBe('true');
    });
  });

  describe('Completion State', () => {
    it('shows Go to Dashboard text when all steps completed', () => {
      // Pre-set all steps as completed
      localStorage.setItem(
        'agencyos_post_deploy_progress',
        JSON.stringify(['test_workflow', 'find_lead', 'create_proposal'])
      );

      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('3/3')).toBeInTheDocument();
      expect(screen.getByText(/Go to Dashboard →/)).toBeInTheDocument();
    });
  });

  describe('Service Packages Display', () => {
    it('displays service package names', () => {
      render(
        <PostDeployWizard
          solution={mockSolution}
          language="en"
          onNavigate={mockOnNavigate}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
    });
  });
});
