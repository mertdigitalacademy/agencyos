import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedJourney from '../../components/GuidedJourney';
import { View } from '../../types';

describe('GuidedJourney', () => {
  const mockOnNavigate = vi.fn();
  const mockOnStepComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('renders journey header', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Your Agency Journey')).toBeInTheDocument();
      expect(screen.getByText(/Follow these steps to build and grow your AI agency/)).toBeInTheDocument();
    });

    it('renders in Turkish when language is tr', () => {
      render(<GuidedJourney language="tr" onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Ajans Yolculuğun')).toBeInTheDocument();
    });

    it('renders all journey steps', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByText('Build Your Agency')).toBeInTheDocument();
      expect(screen.getByText('Find Your First Client')).toBeInTheDocument();
      expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      expect(screen.getByText('Track Sales Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Manage Project')).toBeInTheDocument();
    });

    it('renders step durations', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      // Multiple steps may have same duration, use getAllByText
      expect(screen.getAllByText('5 min').length).toBeGreaterThan(0);
      expect(screen.getAllByText('10 min').length).toBeGreaterThan(0);
      expect(screen.getByText('15 min')).toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('shows initial progress as 0%', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('0/6 steps completed')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('calculates progress percentage correctly', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome', 'build_agency'])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('2/6 steps completed')).toBeInTheDocument();
      // 2/6 = 33%
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('loads progress from localStorage', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome'])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('1/6 steps completed')).toBeInTheDocument();
    });

    it('accepts external completedSteps prop', () => {
      render(
        <GuidedJourney
          onNavigate={mockOnNavigate}
          completedSteps={['welcome', 'build_agency', 'find_clients']}
        />
      );

      expect(screen.getByText('3/6 steps completed')).toBeInTheDocument();
    });

    it('persists progress to localStorage', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      // Mark first step as done
      const doneBtns = screen.getAllByText(/Done/);
      fireEvent.click(doneBtns[0]);

      const savedProgress = localStorage.getItem('agencyos_journey_progress');
      expect(savedProgress).toContain('welcome');
    });
  });

  describe('Step Navigation', () => {
    it('navigates to target view when clicking current step Start button', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      const startBtns = screen.getAllByText(/Start →/);
      fireEvent.click(startBtns[0]);

      expect(mockOnNavigate).toHaveBeenCalledWith(View.SETUP);
    });

    it('allows clicking on completed steps', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome'])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      // Click Review button for completed step
      const reviewBtn = screen.getByText('Review →');
      fireEvent.click(reviewBtn);

      expect(mockOnNavigate).toHaveBeenCalledWith(View.SETUP);
    });

    it('blocks clicking on locked steps', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      // Find locked step text
      const lockedTexts = screen.getAllByText(/Complete previous steps first/);
      expect(lockedTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Step Completion', () => {
    it('marks step as completed when Done button is clicked', () => {
      render(
        <GuidedJourney
          onNavigate={mockOnNavigate}
          onStepComplete={mockOnStepComplete}
        />
      );

      const doneBtns = screen.getAllByText(/Done/);
      fireEvent.click(doneBtns[0]);

      expect(mockOnStepComplete).toHaveBeenCalledWith('welcome');
    });

    it('does not duplicate completed steps', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome'])
      );

      render(
        <GuidedJourney
          onNavigate={mockOnNavigate}
          completedSteps={['welcome']}
        />
      );

      // Progress should still be 1/6
      expect(screen.getByText('1/6 steps completed')).toBeInTheDocument();
    });

    it('advances to next step after completion', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      // Complete first step
      const doneBtns = screen.getAllByText(/Done/);
      fireEvent.click(doneBtns[0]);

      // Now "Build Your Agency" should be current (have Start button)
      const startBtns = screen.getAllByText(/Start →/);
      fireEvent.click(startBtns[0]);

      expect(mockOnNavigate).toHaveBeenCalledWith(View.AGENCY_BUILDER);
    });
  });

  describe('AI Coach Tip', () => {
    it('shows AI Coach tip for current step', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('AI Coach')).toBeInTheDocument();
      expect(screen.getByText(/First, let's set up your agency/)).toBeInTheDocument();
    });

    it('can dismiss AI Coach tip', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      // Find and click dismiss button (✕)
      const dismissBtn = screen.getByText('✕');
      fireEvent.click(dismissBtn);

      // AI Coach should be hidden
      expect(screen.queryByText('AI Coach')).not.toBeInTheDocument();
    });

    it('shows coach tip in Turkish', () => {
      render(<GuidedJourney language="tr" onNavigate={mockOnNavigate} />);

      expect(screen.getByText('AI Koç')).toBeInTheDocument();
      expect(screen.getByText(/Önce ajansını kuralım/)).toBeInTheDocument();
    });
  });

  describe('Completion Message', () => {
    it('shows congratulations when all steps completed', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify([
          'welcome',
          'build_agency',
          'find_clients',
          'create_proposal',
          'track_pipeline',
          'manage_project',
        ])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      expect(screen.getByText(/You've completed the agency journey/)).toBeInTheDocument();
    });

    it('provides navigation buttons on completion', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify([
          'welcome',
          'build_agency',
          'find_clients',
          'create_proposal',
          'track_pipeline',
          'manage_project',
        ])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      const pipelineBtn = screen.getByText('View Pipeline');
      fireEvent.click(pipelineBtn);
      expect(mockOnNavigate).toHaveBeenCalledWith(View.SALES_PIPELINE);

      const dashboardBtn = screen.getByText('Go to Dashboard');
      fireEvent.click(dashboardBtn);
      expect(mockOnNavigate).toHaveBeenCalledWith(View.DASHBOARD);
    });
  });

  describe('Reset Progress', () => {
    it('shows reset button', () => {
      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Reset Progress')).toBeInTheDocument();
    });

    it('resets progress when confirmed', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome', 'build_agency'])
      );

      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      const resetBtn = screen.getByText('Reset Progress');
      fireEvent.click(resetBtn);

      // Progress should be reset to empty array or null
      const progress = localStorage.getItem('agencyos_journey_progress');
      expect(progress === null || progress === '[]').toBe(true);
    });

    it('does not reset if user cancels', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome', 'build_agency'])
      );

      // Mock window.confirm to return false
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      const resetBtn = screen.getByText('Reset Progress');
      fireEvent.click(resetBtn);

      // Progress should not be reset
      const savedProgress = localStorage.getItem('agencyos_journey_progress');
      expect(savedProgress).toContain('welcome');
    });
  });

  describe('Quick Stats', () => {
    it('displays quick stats', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify(['welcome', 'build_agency'])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Steps Done')).toBeInTheDocument();
      expect(screen.getByText('Remaining')).toBeInTheDocument();
      // 'Progress' appears in header and stats
      expect(screen.getAllByText('Progress').length).toBeGreaterThan(0);
      expect(screen.getByText('Status')).toBeInTheDocument();

      // Values - use getAllByText as numbers may appear multiple places
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); // completed
      expect(screen.getAllByText('4').length).toBeGreaterThan(0); // remaining
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('shows Complete status when finished', () => {
      localStorage.setItem(
        'agencyos_journey_progress',
        JSON.stringify([
          'welcome',
          'build_agency',
          'find_clients',
          'create_proposal',
          'track_pipeline',
          'manage_project',
        ])
      );

      render(<GuidedJourney onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Complete!')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
