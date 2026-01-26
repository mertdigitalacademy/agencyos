import { useState, useEffect } from 'react';
import type { Project, CouncilSession } from '../types';
import { runCouncilSession, createInvoiceShelfInvoiceFromCouncil } from '../services/api';
import { useI18n } from '../services/i18n';

interface CouncilRoomSimpleProps {
  selectedProjectId: string | null;
  projects: Project[];
  sessions: CouncilSession[];
  onNewSession: (session: CouncilSession) => void;
  onProjectUpdate: (project: Project) => void;
}

type CouncilGate = 'Strategic' | 'Risk' | 'Launch' | 'Post-Mortem';

export default function CouncilRoomSimple({
  selectedProjectId,
  projects,
  sessions,
  onNewSession,
  onProjectUpdate
}: CouncilRoomSimpleProps) {
  const { lang } = useI18n();
  const [selectedGate, setSelectedGate] = useState<CouncilGate>('Strategic');
  const [customTopic, setCustomTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSession, setLastSession] = useState<CouncilSession | null>(null);

  const project = projects.find(p => p.id === selectedProjectId);
  const projectSessions = sessions.filter(s => s.projectId === selectedProjectId);

  const gates = [
    {
      id: 'Strategic' as CouncilGate,
      icon: '🎯',
      label: lang === 'tr' ? 'Strateji' : 'Strategy',
      desc: lang === 'tr' ? 'Fiyat ve teklif onayı' : 'Pricing & proposal'
    },
    {
      id: 'Risk' as CouncilGate,
      icon: '⚠️',
      label: lang === 'tr' ? 'Risk' : 'Risk',
      desc: lang === 'tr' ? 'Güvenlik ve testler' : 'Security & testing'
    },
    {
      id: 'Launch' as CouncilGate,
      icon: '🚀',
      label: lang === 'tr' ? 'Yayın' : 'Launch',
      desc: lang === 'tr' ? 'Canlıya alma onayı' : 'Go-live approval'
    },
    {
      id: 'Post-Mortem' as CouncilGate,
      icon: '📊',
      label: lang === 'tr' ? 'Analiz' : 'Review',
      desc: lang === 'tr' ? 'Sonuç değerlendirme' : 'Post-launch review'
    }
  ];

  async function runCouncil() {
    if (!project) return;

    setLoading(true);
    try {
      const topic = customTopic.trim() || `${selectedGate} review for ${project.brief.clientName}`;

      const session = await runCouncilSession({
        projectId: project.id,
        gateType: selectedGate,
        topic,
        projectBrief: project.brief
      });

      setLastSession(session);
      onNewSession(session);
      setCustomTopic('');
    } catch (error) {
      console.error('Council session failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createInvoice() {
    if (!lastSession || !project) return;

    try {
      await createInvoiceShelfInvoiceFromCouncil(project.id, lastSession.id);
      alert(lang === 'tr' ? 'Fatura oluşturuldu!' : 'Invoice created!');
    } catch (error) {
      console.error('Invoice creation failed:', error);
    }
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="text-6xl">🏛️</div>
          <div className="text-xl font-medium text-white">
            {lang === 'tr' ? 'Proje Seçin' : 'Select a Project'}
          </div>
          <p className="text-gray-400">
            {lang === 'tr'
              ? 'AI ekibinize danışmak için bir proje seçin'
              : 'Select a project to consult your AI team'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Başlık */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
          <span>🏛️</span>
          <span>{lang === 'tr' ? 'AI Konsey' : 'AI Council'}</span>
        </h1>
        <p className="text-gray-400">
          {lang === 'tr'
            ? 'Çoklu AI modellerine danışın, en iyi kararı alın'
            : 'Consult multiple AI models, get the best decision'}
        </p>
      </div>

      {/* Proje Bilgisi */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl">📁</div>
          <div className="flex-1">
            <div className="font-semibold text-white text-lg">{project.brief.clientName}</div>
            <div className="text-sm text-gray-400">
              {project.brief.industry} • {project.status}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">
              {lang === 'tr' ? 'Konsey Sayısı' : 'Council Sessions'}
            </div>
            <div className="text-2xl font-bold text-blue-400">{projectSessions.length}</div>
          </div>
        </div>
      </div>

      {/* Gate Seçimi */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          {lang === 'tr' ? 'Karar Tipi Seçin' : 'Select Decision Type'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {gates.map((gate) => (
            <button
              key={gate.id}
              onClick={() => setSelectedGate(gate.id)}
              className={`p-4 rounded-lg border-2 transition text-left ${
                selectedGate === gate.id
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <div className="text-3xl mb-2">{gate.icon}</div>
              <div className="font-semibold text-white mb-1">{gate.label}</div>
              <div className="text-xs text-gray-400">{gate.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Konu Girişi */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-400">
          {lang === 'tr' ? 'Özel Soru (Opsiyonel)' : 'Custom Question (Optional)'}
        </label>
        <textarea
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          placeholder={
            lang === 'tr'
              ? 'Örn: Bu projeyi $2000/ay yerine $1500/ay fiyatlandırmalı mıyız?'
              : 'e.g., Should we price this at $1500/month instead of $2000?'
          }
          className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Konsey Çalıştır Butonu */}
      <button
        onClick={runCouncil}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-bold py-6 rounded-lg transition flex items-center justify-center gap-3 text-lg"
      >
        {loading ? (
          <>
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>{lang === 'tr' ? 'AI Ekibi Çalışıyor...' : 'AI Team Consulting...'}</span>
          </>
        ) : (
          <>
            <span>🤖</span>
            <span>{lang === 'tr' ? 'AI Ekibine Danış' : 'Ask AI Team'}</span>
          </>
        )}
      </button>

      {/* Son Karar */}
      {lastSession && (
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-700/50 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>✨</span>
              <span>{lang === 'tr' ? 'AI Ekibi Kararı' : 'AI Team Decision'}</span>
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                lastSession.decision === 'Approved'
                  ? 'bg-green-900/50 text-green-300'
                  : lastSession.decision === 'Rejected'
                  ? 'bg-red-900/50 text-red-300'
                  : 'bg-yellow-900/50 text-yellow-300'
              }`}
            >
              {lastSession.decision === 'Approved'
                ? lang === 'tr'
                  ? '✓ Onaylandı'
                  : '✓ Approved'
                : lastSession.decision === 'Rejected'
                ? lang === 'tr'
                  ? '✗ Reddedildi'
                  : '✗ Rejected'
                : lang === 'tr'
                ? '⚠ Revizyon Gerekli'
                : '⚠ Needs Revision'}
            </span>
          </div>

          {/* Özet */}
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-white whitespace-pre-wrap">{lastSession.synthesis}</div>
          </div>

          {/* Fiyatlandırma (varsa) */}
          {lastSession.pricing && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lastSession.pricing.totalOneTime && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">
                    {lang === 'tr' ? 'Tek Seferlik' : 'One-Time'}
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {lastSession.pricing.currency}
                    {lastSession.pricing.totalOneTime}
                  </div>
                </div>
              )}
              {lastSession.pricing.totalMonthly && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">
                    {lang === 'tr' ? 'Aylık' : 'Monthly'}
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {lastSession.pricing.currency}
                    {lastSession.pricing.totalMonthly}
                    /ay
                  </div>
                </div>
              )}
              {lastSession.pricing.totalFirstMonth && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">
                    {lang === 'tr' ? 'İlk Ay' : 'First Month'}
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {lastSession.pricing.currency}
                    {lastSession.pricing.totalFirstMonth}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aksiyonlar */}
          {lastSession.decision === 'Approved' && lastSession.pricing && (
            <div className="flex gap-3">
              <button
                onClick={createInvoice}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <span>📄</span>
                <span>{lang === 'tr' ? 'Fatura Oluştur' : 'Create Invoice'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Son Kararlar Geçmişi */}
      {projectSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {lang === 'tr' ? 'Geçmiş Kararlar' : 'Decision History'}
          </h2>
          <div className="space-y-3">
            {projectSessions.slice(0, 5).map((session) => (
              <button
                key={session.id}
                onClick={() => setLastSession(session)}
                className="w-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg p-4 transition text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-white">{session.topic}</div>
                    <div className="text-sm text-gray-400">
                      {session.gateType} • {new Date(session.createdAt || Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      session.decision === 'Approved'
                        ? 'bg-green-900/50 text-green-300'
                        : session.decision === 'Rejected'
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-yellow-900/50 text-yellow-300'
                    }`}
                  >
                    {session.decision}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
