/**
 * CouncilBadge Component
 *
 * A compact, reusable component for displaying AI Council review status.
 * Shows decision state (Approved/Rejected/Needs Revision) with optional
 * confidence score and click-to-view-details functionality.
 *
 * Uses existing design system patterns - no new external dependencies.
 */

import type { AppLanguage } from '../types';
import { useI18n } from '../services/i18n';

// ============================================
// TYPES
// ============================================

export type CouncilBadgeDecision = 'Approved' | 'Rejected' | 'Needs Revision' | 'pending' | 'loading';

export interface CouncilBadgeProps {
  /** The council's decision or current state */
  decision: CouncilBadgeDecision;
  /** Optional confidence score (0-100) */
  confidence?: number;
  /** Click handler for viewing details */
  onClick?: () => void;
  /** Show compact version (icon only) */
  compact?: boolean;
  /** Show loading spinner when loading */
  loading?: boolean;
  /** Custom className for additional styling */
  className?: string;
  /** Language override (uses i18n context if not provided) */
  language?: AppLanguage;
}

// ============================================
// STYLING CONFIG
// ============================================

const DECISION_STYLES: Record<
  CouncilBadgeDecision,
  { bg: string; text: string; border: string; icon: string }
> = {
  Approved: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
    icon: '✓',
  },
  Rejected: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    icon: '✗',
  },
  'Needs Revision': {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    icon: '⚠',
  },
  pending: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    icon: '🏛️',
  },
  loading: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    icon: '⏳',
  },
};

const DECISION_LABELS: Record<CouncilBadgeDecision, { en: string; tr: string }> = {
  Approved: { en: 'Approved', tr: 'Onaylandı' },
  Rejected: { en: 'Rejected', tr: 'Reddedildi' },
  'Needs Revision': { en: 'Needs Revision', tr: 'Revizyon Gerekli' },
  pending: { en: 'Review', tr: 'İncele' },
  loading: { en: 'Reviewing...', tr: 'İnceleniyor...' },
};

// ============================================
// COMPONENT
// ============================================

export function CouncilBadge({
  decision,
  confidence,
  onClick,
  compact = false,
  loading = false,
  className = '',
  language,
}: CouncilBadgeProps) {
  const { lang } = useI18n();
  const currentLang = language || lang;

  const actualDecision = loading ? 'loading' : decision;
  const style = DECISION_STYLES[actualDecision];
  const label = DECISION_LABELS[actualDecision][currentLang];

  const isClickable = !!onClick;
  const showConfidence = confidence !== undefined && !compact && !loading;

  const baseClasses = `
    inline-flex items-center gap-1.5
    px-3 py-1
    rounded-full
    text-xs font-bold
    border
    transition-all duration-200
    ${style.bg} ${style.text} ${style.border}
    ${isClickable ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''}
    ${className}
  `.trim();

  const content = (
    <>
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="text-sm">{style.icon}</span>
      )}
      {!compact && <span>{label}</span>}
      {showConfidence && (
        <span className="opacity-70">({confidence}%)</span>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={baseClasses}
        aria-label={`Council decision: ${label}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={baseClasses} aria-label={`Council decision: ${label}`}>
      {content}
    </span>
  );
}

// ============================================
// VARIANTS
// ============================================

/**
 * Large badge variant for prominent display
 */
export function CouncilBadgeLarge({
  decision,
  confidence,
  onClick,
  loading = false,
  className = '',
  language,
}: Omit<CouncilBadgeProps, 'compact'>) {
  const { lang } = useI18n();
  const currentLang = language || lang;

  const actualDecision = loading ? 'loading' : decision;
  const style = DECISION_STYLES[actualDecision];
  const label = DECISION_LABELS[actualDecision][currentLang];

  const isClickable = !!onClick;

  const baseClasses = `
    inline-flex items-center gap-3
    px-6 py-3
    rounded-2xl
    text-sm font-black uppercase tracking-widest
    border
    transition-all duration-200
    ${style.bg} ${style.text} ${style.border}
    ${isClickable ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''}
    ${className}
  `.trim();

  const content = (
    <>
      {loading ? (
        <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="text-xl">{style.icon}</span>
      )}
      <span>{label}</span>
      {confidence !== undefined && !loading && (
        <span className="ml-1 px-2 py-0.5 rounded-lg bg-black/20 text-[10px]">
          {confidence}%
        </span>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {content}
      </button>
    );
  }

  return <span className={baseClasses}>{content}</span>;
}

/**
 * Council review button - shows pending state and triggers review on click
 */
export function CouncilReviewButton({
  onRequestReview,
  loading = false,
  disabled = false,
  hasReview = false,
  decision,
  confidence,
  className = '',
  language,
}: {
  onRequestReview: () => void;
  loading?: boolean;
  disabled?: boolean;
  hasReview?: boolean;
  decision?: CouncilBadgeDecision;
  confidence?: number;
  className?: string;
  language?: AppLanguage;
}) {
  const { lang, tt } = useI18n();
  const currentLang = language || lang;

  // If already has a review, show the badge
  if (hasReview && decision && decision !== 'pending') {
    return (
      <CouncilBadge
        decision={decision}
        confidence={confidence}
        onClick={onRequestReview}
        loading={loading}
        language={currentLang}
        className={className}
      />
    );
  }

  // Show request review button
  return (
    <button
      type="button"
      onClick={onRequestReview}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2
        px-4 py-2
        rounded-xl
        text-xs font-bold
        border border-indigo-500/30
        bg-indigo-600/10 text-indigo-400
        hover:bg-indigo-600/20
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200
        ${className}
      `}
    >
      {loading ? (
        <>
          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{tt('Reviewing...', 'İnceleniyor...')}</span>
        </>
      ) : (
        <>
          <span>🏛️</span>
          <span>{tt('Ask Council', 'Kurula Danış')}</span>
        </>
      )}
    </button>
  );
}

// ============================================
// EXPORTS
// ============================================

export default CouncilBadge;
