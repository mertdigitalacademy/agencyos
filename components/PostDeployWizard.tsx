import React, { useState, useEffect } from 'react';
import { View, AgencySolution, LocalizedString } from '../types';

interface PostDeployWizardProps {
  solution: AgencySolution;
  language?: 'en' | 'tr';
  onNavigate: (view: View) => void;
  onClose: () => void;
}

interface NextStep {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  targetView: View;
  icon: string;
  actionLabel: LocalizedString;
}

const NEXT_STEPS: NextStep[] = [
  {
    id: 'test_workflow',
    title: { en: 'Test Your Workflows', tr: 'Workflow\'larını Test Et' },
    description: { en: 'Open n8n and run your first workflow to make sure everything works', tr: 'n8n\'i aç ve her şeyin çalıştığından emin olmak için ilk workflow\'unu çalıştır' },
    targetView: View.DASHBOARD,
    icon: '🧪',
    actionLabel: { en: 'Open Dashboard', tr: 'Dashboard\'u Aç' },
  },
  {
    id: 'find_lead',
    title: { en: 'Find Your First Lead', tr: 'İlk Lead\'ini Bul' },
    description: { en: 'Use Market Radar to discover businesses that need your services', tr: 'Hizmetlerine ihtiyaç duyan işletmeleri keşfetmek için Market Radar\'ı kullan' },
    targetView: View.JOURNEY,
    icon: '🔍',
    actionLabel: { en: 'Find Leads', tr: 'Lead Bul' },
  },
  {
    id: 'create_proposal',
    title: { en: 'Create Your First Proposal', tr: 'İlk Teklifini Oluştur' },
    description: { en: 'AI will help you create a professional proposal for your lead', tr: 'AI, lead\'in için profesyonel bir teklif oluşturmanı sağlayacak' },
    targetView: View.PROPOSALS,
    icon: '📝',
    actionLabel: { en: 'Create Proposal', tr: 'Teklif Oluştur' },
  },
];

export default function PostDeployWizard({
  solution,
  language = 'en',
  onNavigate,
  onClose,
}: PostDeployWizardProps) {
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const saved = localStorage.getItem('agencyos_post_deploy_progress');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const tt = (en: string, tr: string) => (language === 'tr' ? tr : en);
  const label = (ls: LocalizedString) => ls[language] || ls.en;

  // Persist progress
  useEffect(() => {
    localStorage.setItem('agencyos_post_deploy_progress', JSON.stringify(completedSteps));
  }, [completedSteps]);

  const handleStepAction = (step: NextStep) => {
    if (!completedSteps.includes(step.id)) {
      setCompletedSteps(prev => [...prev, step.id]);
    }
    onNavigate(step.targetView);
    onClose();
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleDismiss = () => {
    localStorage.setItem('agencyos_post_deploy_dismissed', 'true');
    handleSkip();
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #cbd5e1',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Celebration Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            boxShadow: '0 10px 40px rgba(34, 197, 94, 0.4)',
          }}>
            🎉
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            {tt('Congratulations!', 'Tebrikler!')}
          </h1>
          <p style={{ fontSize: '16px', color: '#475569' }}>
            {tt('Your agency is ready!', 'Ajansın hazır!')}
          </p>
        </div>

        {/* Solution Summary */}
        <div style={{
          background: '#f1f5f9',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '32px',
          border: '1px solid #cbd5e1',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>🚀</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                {label(solution.name)}
              </h3>
              <p style={{ fontSize: '13px', color: '#475569' }}>
                {solution.recommendedWorkflows.filter(w => w.priority !== 'optional').length} {tt('workflows deployed', 'workflow dağıtıldı')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {solution.servicePackages.slice(0, 3).map((pkg, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  background: '#e2e8f0',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#334155',
                }}
              >
                {label(pkg.name)}
              </span>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
            {tt('Next Steps', 'Sonraki Adımlar')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {NEXT_STEPS.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = index === completedSteps.length;

              return (
                <div
                  key={step.id}
                  style={{
                    background: isCurrent
                      ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                      : isCompleted
                      ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                      : '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: isCurrent ? '2px solid #60a5fa' : '1px solid #cbd5e1',
                    opacity: !isCurrent && !isCompleted ? 0.6 : 1,
                  }}
                >
                  {/* Step Number */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: isCompleted ? '#22c55e' : 'rgba(15,23,42,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {isCompleted ? '✓' : step.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                      {label(step.title)}
                    </h3>
                    <p style={{ fontSize: '12px', color: isCompleted || isCurrent ? '#475569' : '#64748b' }}>
                      {label(step.description)}
                    </p>
                  </div>

                  {/* Action Button */}
                  {isCurrent && (
                    <button
                      onClick={() => handleStepAction(step)}
                      style={{
                        padding: '8px 16px',
                        background: '#e2e8f0',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#0f172a',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label(step.actionLabel)} →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Indicator */}
        <div style={{
          background: '#f1f5f9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          border: '1px solid #cbd5e1',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>
              {tt('Getting Started Progress', 'Başlangıç İlerlemesi')}
            </span>
            <span style={{ fontSize: '13px', color: '#475569' }}>
              {completedSteps.length}/{NEXT_STEPS.length}
            </span>
          </div>
          <div style={{
            height: '6px',
            background: '#e2e8f0',
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(completedSteps.length / NEXT_STEPS.length) * 100}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
              borderRadius: '3px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '14px 24px',
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '12px',
              color: '#334155',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tt('Skip for Now', 'Şimdilik Atla')}
          </button>
          <button
            onClick={() => {
              const currentStep = NEXT_STEPS[completedSteps.length];
              if (currentStep) {
                handleStepAction(currentStep);
              } else {
                onClose();
              }
            }}
            style={{
              flex: 2,
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(22, 163, 74, 0.2)',
            }}
          >
            {completedSteps.length === NEXT_STEPS.length
              ? tt('Go to Dashboard', 'Dashboard\'a Git')
              : tt('Continue', 'Devam Et')
            } →
          </button>
        </div>

        {/* Don't Show Again */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {tt("Don't show this again", 'Bunu bir daha gösterme')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
