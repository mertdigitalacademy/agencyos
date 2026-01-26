import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CouncilBadge, CouncilBadgeLarge, CouncilReviewButton } from '../../components/CouncilBadge';

// Mock useI18n hook
vi.mock('../../services/i18n', () => ({
  useI18n: () => ({
    lang: 'en',
    tt: (en: string, _tr: string) => en,
  }),
}));

describe('CouncilBadge', () => {
  describe('Rendering', () => {
    it('renders Approved state correctly', () => {
      render(<CouncilBadge decision="Approved" />);

      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders Rejected state correctly', () => {
      render(<CouncilBadge decision="Rejected" />);

      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('renders Needs Revision state correctly', () => {
      render(<CouncilBadge decision="Needs Revision" />);

      expect(screen.getByText('Needs Revision')).toBeInTheDocument();
      expect(screen.getByText('⚠')).toBeInTheDocument();
    });

    it('renders pending state correctly', () => {
      render(<CouncilBadge decision="pending" />);

      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('🏛️')).toBeInTheDocument();
    });

    it('renders loading state with spinner', () => {
      render(<CouncilBadge decision="Approved" loading />);

      expect(screen.getByText('Reviewing...')).toBeInTheDocument();
      // Spinner should be present (an animated element)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Confidence Display', () => {
    it('displays confidence percentage when provided', () => {
      render(<CouncilBadge decision="Approved" confidence={85} />);

      expect(screen.getByText('(85%)')).toBeInTheDocument();
    });

    it('does not display confidence in compact mode', () => {
      render(<CouncilBadge decision="Approved" confidence={85} compact />);

      expect(screen.queryByText('(85%)')).not.toBeInTheDocument();
    });

    it('does not display confidence when loading', () => {
      render(<CouncilBadge decision="Approved" confidence={85} loading />);

      expect(screen.queryByText('(85%)')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('shows only icon in compact mode', () => {
      render(<CouncilBadge decision="Approved" compact />);

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<CouncilBadge decision="Approved" onClick={handleClick} />);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders as button when onClick is provided', () => {
      render(<CouncilBadge decision="Approved" onClick={() => {}} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders as span when onClick is not provided', () => {
      render(<CouncilBadge decision="Approved" />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has aria-label for decision', () => {
      render(<CouncilBadge decision="Approved" />);

      expect(screen.getByLabelText('Council decision: Approved')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      render(<CouncilBadge decision="Approved" className="custom-class" />);

      const badge = screen.getByLabelText('Council decision: Approved');
      expect(badge).toHaveClass('custom-class');
    });

    it('applies green styling for Approved', () => {
      render(<CouncilBadge decision="Approved" />);

      const badge = screen.getByLabelText('Council decision: Approved');
      expect(badge).toHaveClass('text-green-400');
    });

    it('applies red styling for Rejected', () => {
      render(<CouncilBadge decision="Rejected" />);

      const badge = screen.getByLabelText('Council decision: Rejected');
      expect(badge).toHaveClass('text-red-400');
    });

    it('applies yellow styling for Needs Revision', () => {
      render(<CouncilBadge decision="Needs Revision" />);

      const badge = screen.getByLabelText('Council decision: Needs Revision');
      expect(badge).toHaveClass('text-yellow-400');
    });
  });
});

describe('CouncilBadgeLarge', () => {
  it('renders with larger styling', () => {
    render(<CouncilBadgeLarge decision="Approved" />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('displays confidence in a separate chip', () => {
    render(<CouncilBadgeLarge decision="Approved" confidence={90} />);

    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<CouncilBadgeLarge decision="Approved" onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe('CouncilReviewButton', () => {
  it('renders request review button when no review exists', () => {
    const handleReview = vi.fn();
    render(<CouncilReviewButton onRequestReview={handleReview} />);

    expect(screen.getByText('Ask Council')).toBeInTheDocument();
    expect(screen.getByText('🏛️')).toBeInTheDocument();
  });

  it('shows loading state when loading', () => {
    render(<CouncilReviewButton onRequestReview={() => {}} loading />);

    expect(screen.getByText('Reviewing...')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<CouncilReviewButton onRequestReview={() => {}} disabled />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows badge when hasReview is true with decision', () => {
    render(
      <CouncilReviewButton
        onRequestReview={() => {}}
        hasReview
        decision="Approved"
        confidence={85}
      />
    );

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('(85%)')).toBeInTheDocument();
  });

  it('calls onRequestReview when clicked', () => {
    const handleReview = vi.fn();
    render(<CouncilReviewButton onRequestReview={handleReview} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleReview).toHaveBeenCalledTimes(1);
  });

  it('does not call onRequestReview when disabled', () => {
    const handleReview = vi.fn();
    render(<CouncilReviewButton onRequestReview={handleReview} disabled />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleReview).not.toHaveBeenCalled();
  });
});
