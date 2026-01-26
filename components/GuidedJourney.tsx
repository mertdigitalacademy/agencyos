import React, { useState, useEffect } from 'react';
import { View, LocalizedString } from '../types';

interface GuidedJourneyProps {
  language?: 'en' | 'tr';
  onNavigate: (view: View) => void;
  completedSteps?: string[];
  onStepComplete?: (stepId: string) => void;
}

interface JourneyStep {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  coachTip: LocalizedString;
  targetView: View;
  icon: string;
  duration: LocalizedString;
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 'welcome',
    title: { en: 'Welcome', tr: 'Hoş Geldin' },
    description: { en: 'Set up your agency profile and preferences', tr: 'Ajans profilini ve tercihlerini ayarla' },
    coachTip: { en: 'First, let\'s set up your agency. Choose your niche and target market.', tr: 'Önce ajansını kuralım. Nişini ve hedef pazarını seç.' },
    targetView: View.SETUP,
    icon: '👋',
    duration: { en: '5 min', tr: '5 dk' },
  },
  {
    id: 'build_agency',
    title: { en: 'Build Your Agency', tr: 'Ajansını Kur' },
    description: { en: 'AI will create your custom agency with workflows', tr: 'AI ajansını workflow\'larla birlikte oluşturacak' },
    coachTip: { en: 'Now let\'s build your agency. Select your sector and niche, then AI will generate solutions for you.', tr: 'Şimdi ajansını kuralım. Sektörünü ve nişini seç, AI sana çözümler üretsin.' },
    targetView: View.AGENCY_BUILDER,
    icon: '🏗️',
    duration: { en: '10 min', tr: '10 dk' },
  },
  {
    id: 'find_clients',
    title: { en: 'Find Your First Client', tr: 'İlk Müşterini Bul' },
    description: { en: 'Use Market Radar to discover potential leads', tr: 'Market Radar ile potansiyel müşterileri keşfet' },
    coachTip: { en: 'Time to find clients! Use the Market Radar to search for businesses that need your services.', tr: 'Müşteri bulma zamanı! Market Radar\'ı kullanarak hizmetlerine ihtiyaç duyan işletmeleri bul.' },
    targetView: View.JOURNEY,
    icon: '🔍',
    duration: { en: '15 min', tr: '15 dk' },
  },
  {
    id: 'create_proposal',
    title: { en: 'Create Proposal', tr: 'Teklif Oluştur' },
    description: { en: 'AI will help you create professional proposals', tr: 'AI profesyonel teklifler oluşturmanı sağlayacak' },
    coachTip: { en: 'Great! Now create a proposal for your lead. AI will fill in most details automatically.', tr: 'Harika! Şimdi lead\'in için bir teklif oluştur. AI çoğu detayı otomatik dolduracak.' },
    targetView: View.PROPOSALS,
    icon: '📝',
    duration: { en: '10 min', tr: '10 dk' },
  },
  {
    id: 'track_pipeline',
    title: { en: 'Track Sales Pipeline', tr: 'Satış Pipeline\'ı Takip Et' },
    description: { en: 'Monitor your leads and proposals in one place', tr: 'Lead\'leri ve teklifleri tek yerden izle' },
    coachTip: { en: 'Keep track of all your leads and proposals. Move them through the pipeline as you progress.', tr: 'Tüm lead\'lerini ve tekliflerini takip et. İlerledikçe pipeline\'da hareket ettir.' },
    targetView: View.SALES_PIPELINE,
    icon: '📊',
    duration: { en: '5 min', tr: '5 dk' },
  },
  {
    id: 'manage_project',
    title: { en: 'Manage Project', tr: 'Projeyi Yönet' },
    description: { en: 'Deliver value with automated workflows', tr: 'Otomatik workflow\'larla değer sun' },
    coachTip: { en: 'Once a client accepts, manage their project here. Your AI workflows will do most of the work!', tr: 'Müşteri kabul ettiğinde, projesini buradan yönet. AI workflow\'ların işin çoğunu yapacak!' },
    targetView: View.DASHBOARD,
    icon: '⚙️',
    duration: { en: 'Ongoing', tr: 'Sürekli' },
  },
];

export default function GuidedJourney({
  language = 'en',
  onNavigate,
  completedSteps: externalCompleted,
  onStepComplete,
}: GuidedJourneyProps) {
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    if (externalCompleted) return externalCompleted;
    const saved = localStorage.getItem('agencyos_journey_progress');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [showCoachTip, setShowCoachTip] = useState(true);

  const tt = (en: string, tr: string) => (language === 'tr' ? tr : en);
  const label = (ls: LocalizedString) => ls[language] || ls.en;

  // Persist progress
  useEffect(() => {
    localStorage.setItem('agencyos_journey_progress', JSON.stringify(completedSteps));
  }, [completedSteps]);

  // Find current step (first incomplete)
  const currentStepIndex = JOURNEY_STEPS.findIndex(step => !completedSteps.includes(step.id));
  const currentStep = currentStepIndex >= 0 ? JOURNEY_STEPS[currentStepIndex] : null;

  // Calculate progress
  const progressPercent = (completedSteps.length / JOURNEY_STEPS.length) * 100;

  const handleStepClick = (step: JourneyStep, index: number) => {
    // Can only click completed steps or current step
    if (index <= currentStepIndex || completedSteps.includes(step.id)) {
      setActiveStep(step.id);
      onNavigate(step.targetView);
    }
  };

  const handleMarkComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      const newCompleted = [...completedSteps, stepId];
      setCompletedSteps(newCompleted);
      onStepComplete?.(stepId);
    }
  };

  const handleResetProgress = () => {
    if (confirm(tt('Are you sure you want to reset your progress?', 'İlerlemenizi sıfırlamak istediğinizden emin misiniz?'))) {
      setCompletedSteps([]);
      localStorage.removeItem('agencyos_journey_progress');
    }
  };

  return (
    <div style={{
      padding: '24px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      minHeight: '100vh',
      color: '#0f172a',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
              {tt('Your Agency Journey', 'Ajans Yolculuğun')}
            </h1>
            <p style={{ color: '#475569', fontSize: '14px' }}>
              {tt('Follow these steps to build and grow your AI agency', 'AI ajansını kurmak ve büyütmek için bu adımları takip et')}
            </p>
          </div>
          <button
            onClick={handleResetProgress}
            style={{
              padding: '8px 16px',
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {tt('Reset Progress', 'İlerlemeyi Sıfırla')}
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{
          marginTop: '24px',
          background: '#f1f5f9',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #cbd5e1',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              {tt('Progress', 'İlerleme')}
            </span>
            <span style={{ fontSize: '14px', color: '#475569' }}>
              {completedSteps.length}/{JOURNEY_STEPS.length} {tt('steps completed', 'adım tamamlandı')}
            </span>
          </div>
          <div style={{
            height: '8px',
            background: '#e2e8f0',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* AI Coach Tip */}
      {currentStep && showCoachTip && (
        <div style={{
          background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '32px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
          boxShadow: '0 10px 40px rgba(79, 70, 229, 0.3)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'rgba(15,23,42,0.08)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0,
          }}>
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {tt('AI Coach', 'AI Koç')}
            </div>
            <p style={{ fontSize: '14px', opacity: 0.9, lineHeight: 1.6 }}>
              {label(currentStep.coachTip)}
            </p>
          </div>
          <button
            onClick={() => setShowCoachTip(false)}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Journey Steps */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
      }}>
        {JOURNEY_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = index === currentStepIndex;
          const isLocked = index > currentStepIndex && !isCompleted;

          return (
            <div
              key={step.id}
              onClick={() => handleStepClick(step, index)}
              style={{
                background: isCompleted
                  ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                  : isCurrent
                  ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                  : '#f8fafc',
                borderRadius: '16px',
                padding: '24px',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.5 : 1,
                border: isCurrent ? '2px solid #60a5fa' : '1px solid #cbd5e1',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {/* Step Number */}
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '20px',
                background: isCompleted ? '#86efac' : isCurrent ? '#93c5fd' : '#cbd5e1',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                border: '3px solid #e2e8f0',
              }}>
                {isCompleted ? '✓' : index + 1}
              </div>

              {/* Step Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '28px' }}>{step.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                      {label(step.title)}
                    </h3>
                    <p style={{ fontSize: '13px', color: isCompleted || isCurrent ? '#475569' : '#64748b' }}>
                      {label(step.description)}
                    </p>
                  </div>
                </div>
                <span style={{
                  background: 'rgba(15,23,42,0.08)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                }}>
                  {label(step.duration)}
                </span>
              </div>

              {/* Action Button */}
              {(isCurrent || isCompleted) && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(step.targetView);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#0f172a',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isCompleted ? tt('Review', 'İncele') : tt('Start', 'Başla')} →
                  </button>
                  {isCurrent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkComplete(step.id);
                      }}
                      style={{
                        padding: '10px 16px',
                        background: '#86efac',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✓ {tt('Done', 'Tamam')}
                    </button>
                  )}
                </div>
              )}

              {/* Locked Indicator */}
              {isLocked && (
                <div style={{
                  marginTop: '16px',
                  padding: '10px 16px',
                  background: 'rgba(15,23,42,0.08)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#64748b',
                }}>
                  🔒 {tt('Complete previous steps first', 'Önce önceki adımları tamamla')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion Message */}
      {completedSteps.length === JOURNEY_STEPS.length && (
        <div style={{
          marginTop: '32px',
          background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(22, 163, 74, 0.3)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            {tt('Congratulations!', 'Tebrikler!')}
          </h2>
          <p style={{ fontSize: '16px', opacity: 0.9, marginBottom: '24px' }}>
            {tt(
              'You\'ve completed the agency journey. Your AI agency is now ready to serve clients!',
              'Ajans yolculuğunu tamamladın. AI ajansın artık müşterilere hizmet vermeye hazır!'
            )}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => onNavigate(View.SALES_PIPELINE)}
              style={{
                padding: '12px 24px',
                background: 'white',
                color: '#166534',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tt('View Pipeline', 'Pipeline\'ı Gör')}
            </button>
            <button
              onClick={() => onNavigate(View.DASHBOARD)}
              style={{
                padding: '12px 24px',
                background: '#e2e8f0',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tt('Go to Dashboard', 'Dashboard\'a Git')}
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div style={{
        marginTop: '32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
      }}>
        <QuickStat
          icon="📈"
          label={tt('Steps Done', 'Tamamlanan')}
          value={completedSteps.length.toString()}
        />
        <QuickStat
          icon="⏳"
          label={tt('Remaining', 'Kalan')}
          value={(JOURNEY_STEPS.length - completedSteps.length).toString()}
        />
        <QuickStat
          icon="🎯"
          label={tt('Progress', 'İlerleme')}
          value={`${Math.round(progressPercent)}%`}
        />
        <QuickStat
          icon="🚀"
          label={tt('Status', 'Durum')}
          value={completedSteps.length === JOURNEY_STEPS.length ? tt('Complete!', 'Tamam!') : tt('In Progress', 'Devam Ediyor')}
        />
      </div>
    </div>
  );
}

function QuickStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      background: '#f1f5f9',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
      border: '1px solid #cbd5e1',
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 700 }}>{value}</div>
    </div>
  );
}
