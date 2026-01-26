import React, { useState, useMemo } from 'react';
import { OutboundLead, OutboundStage, Proposal, View, LocalizedString, AppLanguage } from '../types';
import { CouncilBadge } from './CouncilBadge';
import {
  quickCouncilReview,
  buildLeadContext,
  buildCouncilTopic,
  type CouncilReviewResult,
} from '../services/councilHelpers';

interface SalesPipelineProps {
  leads: OutboundLead[];
  proposals: Proposal[];
  language?: AppLanguage;
  onLeadClick?: (lead: OutboundLead) => void;
  onProposalClick?: (proposal: Proposal) => void;
  onLeadStageChange?: (leadId: string, newStage: OutboundStage) => void;
  onCreateProposal?: (lead: OutboundLead) => void;
  onNavigate?: (view: View) => void;
  /** Stored council reviews for leads (keyed by lead id) */
  leadCouncilReviews?: Record<string, CouncilReviewResult>;
  /** Callback when council review completes */
  onCouncilReview?: (leadId: string, result: CouncilReviewResult) => void;
}

// Pipeline stage configuration
const PIPELINE_STAGES: { id: OutboundStage; label: LocalizedString; icon: string; color: string }[] = [
  { id: 'New', label: { en: 'New Leads', tr: 'Yeni Leadler' }, icon: '🔵', color: '#3b82f6' },
  { id: 'Contacted', label: { en: 'Contacted', tr: 'İletişim Kuruldu' }, icon: '📞', color: '#8b5cf6' },
  { id: 'Replied', label: { en: 'Replied', tr: 'Yanıt Verdi' }, icon: '💬', color: '#f59e0b' },
  { id: 'Booked', label: { en: 'Meeting Booked', tr: 'Toplantı Planlandı' }, icon: '📅', color: '#06b6d4' },
  { id: 'Proposal', label: { en: 'Proposal Sent', tr: 'Teklif Gönderildi' }, icon: '📝', color: '#f97316' },
  { id: 'Won', label: { en: 'Won', tr: 'Kazanıldı' }, icon: '🏆', color: '#22c55e' },
];

// Estimated deal values by stage (for pipeline value calculation)
const STAGE_VALUE_MULTIPLIER: Record<OutboundStage, number> = {
  'New': 0.05,
  'Contacted': 0.1,
  'Replied': 0.25,
  'Booked': 0.5,
  'Proposal': 0.75,
  'Won': 1.0,
  'Lost': 0,
};

const AVG_DEAL_VALUE = 2000; // Default average deal value

export default function SalesPipeline({
  leads,
  proposals,
  language = 'en',
  onLeadClick,
  onProposalClick,
  onLeadStageChange,
  onCreateProposal,
  onNavigate,
  leadCouncilReviews = {},
  onCouncilReview,
}: SalesPipelineProps) {
  const [selectedStage, setSelectedStage] = useState<OutboundStage | null>(null);
  const [draggedLead, setDraggedLead] = useState<OutboundLead | null>(null);
  const [reviewingLeadId, setReviewingLeadId] = useState<string | null>(null);

  const tt = (en: string, tr: string) => (language === 'tr' ? tr : en);
  const label = (ls: LocalizedString) => ls[language] || ls.en;

  // Request council review for a lead
  const requestLeadCouncilReview = async (lead: OutboundLead) => {
    setReviewingLeadId(lead.id);
    try {
      const context = buildLeadContext({
        name: lead.name,
        category: lead.category,
        stage: lead.stage,
        notes: lead.notes,
        website: lead.website,
        city: lead.city,
        country: lead.country,
      });

      const result = await quickCouncilReview({
        context,
        gateType: 'Strategic',
        topic: buildCouncilTopic('lead', lead.name, language),
        language,
      });

      onCouncilReview?.(lead.id, result);
    } catch (e) {
      console.error('Council review failed:', e);
    } finally {
      setReviewingLeadId(null);
    }
  };

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<OutboundStage, OutboundLead[]> = {
      'New': [],
      'Contacted': [],
      'Replied': [],
      'Booked': [],
      'Proposal': [],
      'Won': [],
      'Lost': [],
    };
    leads.forEach(lead => {
      if (grouped[lead.stage]) {
        grouped[lead.stage].push(lead);
      }
    });
    return grouped;
  }, [leads]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalLeads = leads.filter(l => l.stage !== 'Lost').length;
    const wonLeads = leadsByStage['Won'].length;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    // Calculate weighted pipeline value
    let pipelineValue = 0;
    (Object.entries(leadsByStage) as [OutboundStage, OutboundLead[]][]).forEach(([stage, stageLeads]) => {
      const multiplier = STAGE_VALUE_MULTIPLIER[stage];
      pipelineValue += stageLeads.length * AVG_DEAL_VALUE * multiplier;
    });

    // Calculate average deal size from won deals (proposals)
    const acceptedProposals = proposals.filter(p => p.status === 'Accepted');
    let avgDealSize = AVG_DEAL_VALUE;
    if (acceptedProposals.length > 0) {
      const totalValue = acceptedProposals.reduce((sum, p) => {
        const selectedTier = p.tiers.find(t => t.id === p.selectedTierId);
        return sum + (selectedTier?.monthlyFee || 0) * 12 + (selectedTier?.setupFee || 0);
      }, 0);
      avgDealSize = totalValue / acceptedProposals.length;
    }

    // Calculate average time to close (in days)
    let avgTimeToClose = 14; // Default
    if (wonLeads > 0) {
      const wonWithDates = leadsByStage['Won'].filter(l => l.createdAt);
      if (wonWithDates.length > 0) {
        const totalDays = wonWithDates.reduce((sum, lead) => {
          const created = new Date(lead.createdAt);
          const updated = new Date(lead.updatedAt);
          return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgTimeToClose = Math.round(totalDays / wonWithDates.length);
      }
    }

    return {
      totalLeads,
      pipelineValue,
      conversionRate,
      avgDealSize,
      avgTimeToClose,
      wonDeals: wonLeads,
      activeProposals: proposals.filter(p => p.status === 'Sent' || p.status === 'Viewed').length,
    };
  }, [leads, leadsByStage, proposals]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, lead: OutboundLead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStage: OutboundStage) => {
    e.preventDefault();
    if (draggedLead && draggedLead.stage !== targetStage) {
      onLeadStageChange?.(draggedLead.id, targetStage);
    }
    setDraggedLead(null);
  };

  // Funnel visualization data
  const funnelData = PIPELINE_STAGES.map((stage, index) => ({
    ...stage,
    count: leadsByStage[stage.id].length,
    width: Math.max(30, 100 - index * 12), // Narrowing funnel
  }));

  return (
    <div style={{
      padding: '24px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      minHeight: '100vh',
      color: '#0f172a',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
          {tt('Sales Pipeline', 'Satis Hunisi')}
        </h1>
        <p style={{ color: '#475569', fontSize: '14px' }}>
          {tt('Track your leads from discovery to closed deals', 'Leadlerinizi keşiften kapanışa kadar takip edin')}
        </p>
      </div>

      {/* Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <MetricCard
          label={tt('Pipeline Value', 'Pipeline Değeri')}
          value={`$${metrics.pipelineValue.toLocaleString()}`}
          icon="💰"
          color="#22c55e"
          subtitle={tt(`${metrics.totalLeads} active leads`, `${metrics.totalLeads} aktif lead`)}
        />
        <MetricCard
          label={tt('Conversion Rate', 'Dönüşüm Oranı')}
          value={`${metrics.conversionRate.toFixed(1)}%`}
          icon="📈"
          color="#3b82f6"
          subtitle={tt(`${metrics.wonDeals} won deals`, `${metrics.wonDeals} kazanılan`)}
        />
        <MetricCard
          label={tt('Avg Deal Size', 'Ort. Anlaşma Değeri')}
          value={`$${metrics.avgDealSize.toLocaleString()}`}
          icon="💎"
          color="#8b5cf6"
          subtitle={tt('Per client', 'Müşteri başı')}
        />
        <MetricCard
          label={tt('Time to Close', 'Kapanış Süresi')}
          value={`${metrics.avgTimeToClose} ${tt('days', 'gün')}`}
          icon="⏱️"
          color="#f59e0b"
          subtitle={tt('Average', 'Ortalama')}
        />
      </div>

      {/* Funnel Visualization */}
      <div style={{
        background: '#f1f5f9',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        border: '1px solid #cbd5e1',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>
          {tt('Sales Funnel', 'Satış Hunisi')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          {funnelData.map((stage, index) => (
            <div
              key={stage.id}
              onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
              style={{
                width: `${stage.width}%`,
                minWidth: '200px',
                background: selectedStage === stage.id
                  ? stage.color
                  : `${stage.color}40`,
                borderRadius: '8px',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: selectedStage === stage.id ? `2px solid ${stage.color}` : '2px solid transparent',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{stage.icon}</span>
                <span style={{ fontWeight: 500 }}>{label(stage.label)}</span>
              </span>
              <span style={{
                background: '#e2e8f0',
                padding: '4px 12px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '14px',
              }}>
                {stage.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        background: '#f1f5f9',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #cbd5e1',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
            {tt('Pipeline Board', 'Pipeline Tablosu')}
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onNavigate?.(View.PROPOSALS)}
              style={{
                padding: '8px 16px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                color: '#0f172a',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              📝 {tt('View Proposals', 'Teklifleri Gör')}
              {metrics.activeProposals > 0 && (
                <span style={{
                  background: '#f59e0b',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}>
                  {metrics.activeProposals}
                </span>
              )}
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '12px',
          overflowX: 'auto',
        }}>
          {PIPELINE_STAGES.map(stage => (
            <div
              key={stage.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
              style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '16px',
                minHeight: '400px',
                border: draggedLead ? `2px dashed ${stage.color}50` : '2px solid transparent',
              }}
            >
              {/* Column Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: `2px solid ${stage.color}`,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{stage.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{label(stage.label)}</span>
                </span>
                <span style={{
                  background: `${stage.color}30`,
                  color: stage.color,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {leadsByStage[stage.id].length}
                </span>
              </div>

              {/* Lead Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leadsByStage[stage.id].map((lead: OutboundLead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    language={language}
                    stageColor={stage.color}
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onClick={() => onLeadClick?.(lead)}
                    onCreateProposal={() => onCreateProposal?.(lead)}
                    showProposalButton={stage.id === 'Booked' || stage.id === 'Proposal'}
                    councilReview={leadCouncilReviews[lead.id]}
                    isReviewingWithCouncil={reviewingLeadId === lead.id}
                    onRequestCouncilReview={() => requestLeadCouncilReview(lead)}
                    showCouncilAction={stage.id === 'Contacted' || stage.id === 'Replied' || stage.id === 'Booked'}
                  />
                ))}
                {leadsByStage[stage.id].length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#475569',
                    fontSize: '13px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                  }}>
                    {tt('Drop leads here', 'Leadleri buraya bırakın')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div style={{
        marginTop: '24px',
        padding: '16px 24px',
        background: '#f1f5f9',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-around',
        border: '1px solid #cbd5e1',
      }}>
        <QuickStat
          label={tt('This Week', 'Bu Hafta')}
          value={leads.filter(l => {
            const created = new Date(l.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return created > weekAgo;
          }).length}
          suffix={tt('new leads', 'yeni lead')}
        />
        <QuickStat
          label={tt('Pending Proposals', 'Bekleyen Teklifler')}
          value={proposals.filter(p => p.status === 'Sent' || p.status === 'Viewed').length}
          suffix={tt('awaiting response', 'yanıt bekliyor')}
        />
        <QuickStat
          label={tt('Lost This Month', 'Bu Ay Kaybedilen')}
          value={leads.filter(l => {
            if (l.stage !== 'Lost') return false;
            const updated = new Date(l.updatedAt);
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return updated > monthAgo;
          }).length}
          suffix={tt('deals', 'anlaşma')}
        />
      </div>
    </div>
  );
}

// Sub-components
function MetricCard({ label, value, icon, color, subtitle }: {
  label: string;
  value: string;
  icon: string;
  color: string;
  subtitle: string;
}) {
  return (
    <div style={{
      background: '#f1f5f9',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #cbd5e1',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: '#475569', fontSize: '13px', marginBottom: '4px' }}>{label}</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</p>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{subtitle}</p>
        </div>
        <span style={{ fontSize: '28px' }}>{icon}</span>
      </div>
    </div>
  );
}

interface LeadCardProps {
  lead: OutboundLead;
  language: AppLanguage;
  stageColor: string;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
  onCreateProposal: () => void;
  showProposalButton: boolean;
  councilReview?: CouncilReviewResult;
  isReviewingWithCouncil?: boolean;
  onRequestCouncilReview?: () => void;
  showCouncilAction?: boolean;
}

const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  language,
  stageColor,
  onDragStart,
  onClick,
  onCreateProposal,
  showProposalButton,
  councilReview,
  isReviewingWithCouncil,
  onRequestCouncilReview,
  showCouncilAction,
}) => {
  const tt = (en: string, tr: string) => (language === 'tr' ? tr : en);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: '#f1f5f9',
        borderRadius: '8px',
        padding: '12px',
        cursor: 'grab',
        borderLeft: `3px solid ${stageColor}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header with Council Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', flex: 1 }}>
          {lead.name}
        </div>
        {councilReview && (
          <CouncilBadge
            decision={councilReview.decision}
            confidence={councilReview.confidence}
            compact
            language={language}
          />
        )}
      </div>
      {lead.category && (
        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
          {lead.category}
        </div>
      )}
      {lead.city && (
        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
          📍 {lead.city}{lead.country ? `, ${lead.country}` : ''}
        </div>
      )}

      {/* Council Action Button */}
      {showCouncilAction && !councilReview && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRequestCouncilReview?.();
          }}
          disabled={isReviewingWithCouncil}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '6px 10px',
            background: isReviewingWithCouncil ? '#e2e8f0' : '#c7d2fe',
            border: 'none',
            borderRadius: '6px',
            color: '#0f172a',
            fontSize: '11px',
            fontWeight: 600,
            cursor: isReviewingWithCouncil ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          {isReviewingWithCouncil ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              {tt('Reviewing...', 'İnceleniyor...')}
            </>
          ) : (
            <>
              🏛️ {tt('Qualify Lead', 'Lead\'i Değerlendir')}
            </>
          )}
        </button>
      )}

      {showProposalButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateProposal();
          }}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '6px 10px',
            background: '#f59e0b',
            border: 'none',
            borderRadius: '6px',
            color: '#0f172a',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📝 {tt('Create Proposal', 'Teklif Oluştur')}
        </button>
      )}
      <div style={{
        marginTop: '8px',
        fontSize: '10px',
        color: '#64748b',
      }}>
        {new Date(lead.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
};

function QuickStat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#475569', fontSize: '12px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '11px' }}>{suffix}</div>
    </div>
  );
}
